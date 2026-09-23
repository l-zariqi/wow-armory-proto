const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Blizzard API Configuration
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REGION = process.env.REGION || 'us';
const LOCALE = process.env.LOCALE || 'en_US';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: CLIENT_ID and CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

console.log('✓ Environment variables loaded successfully');

// Namespace mapping for different Classic versions
const getNamespace = (version, region, type = 'profile') => {
  switch (version) {
    case 'classic-era':
      return `${type}-classic1x-${region}`;
    case 'tbc-anniversary':
      return `${type}-classicann-${region}`;
    default:
      return `${type}-classic1x-${region}`;
  }
};

const getItemMediaNamespace = (version, region) => `static-${version === 'tbc-anniversary' ? 'classicann' : 'classic1x'}-${region}`;

const GEAR_SCORE_SLOT_MODIFIERS = {
  HEAD: 1,
  NECK: 0.5625,
  SHOULDER: 0.75,
  CHEST: 1,
  ROBE: 1,
  WAIST: 0.75,
  LEGS: 1,
  FEET: 0.75,
  WRIST: 0.5625,
  HANDS: 0.75,
  FINGER: 0.5625,
  FINGER_1: 0.5625,
  FINGER_2: 0.5625,
  BACK: 0.5625,
  SHIRT: 0,
  TABARD: 0,
  TRINKET: 0.5625,
  TRINKET_1: 0.5625,
  TRINKET_2: 0.5625,
  MAIN_HAND: 1,
  OFF_HAND: 1,
  RANGED: 0.3164,
  RELIC: 0.3164
};

const GEAR_SCORE_QUALITY = {
  POOR: 0,
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  ARTIFACT: 6,
  HEIRLOOM: 7
};

const calculateGearScore = (items = []) => {
  let score = 0;
  let hasTwoHandedWeapon = false;
  let hasMainHand = false;
  let hasOffHand = false;

  const scoredItems = items.map(item => {
    const slot = item.slot?.type || item.slot?.name;
    const itemLevel = Number(item.level?.value || item.level || 0);
    const rarityName = item.quality?.type || item.quality?.name;
    let rarity = GEAR_SCORE_QUALITY[rarityName] ?? Number(item.quality?.value);
    let qualityScale = 1;
    let adjustedItemLevel = itemLevel;
    const inventoryType = item.item?.inventory_type || item.inventory_type;

    if (inventoryType === 'INVTYPE_2HWEAPON' || item.equipment_slot === 'TWO_HAND') {
      hasTwoHandedWeapon = true;
    }
    if (slot === 'MAIN_HAND') hasMainHand = true;
    if (slot === 'OFF_HAND') hasOffHand = true;

    if (!Number.isFinite(rarity) || !itemLevel || !slot || GEAR_SCORE_SLOT_MODIFIERS[slot] === undefined) {
      return 0;
    }
    if (rarity === 5) {
      qualityScale = 1.3;
      rarity = 4;
    } else if (rarity === 1 || rarity === 0) {
      qualityScale = 0.005;
      rarity = 2;
    } else if (rarity === 7) {
      rarity = 3;
      adjustedItemLevel = 187.05;
    }

    let formula;
    if (adjustedItemLevel < 100 && rarity === 4) {
      formula = { A: 0.25, B: 1.6275 };
    } else if (adjustedItemLevel < 168 && rarity === 4) {
      formula = { A: 26, B: 1.2 };
    } else if (adjustedItemLevel < 148 && rarity === 3) {
      formula = { A: 0.75, B: 1.8 };
    } else if (adjustedItemLevel < 138 && rarity === 2) {
      formula = { A: 8, B: 2 };
    } else if (adjustedItemLevel <= 120) {
      formula = { A: 0, B: 2.25 };
    } else {
      formula = {
        4: { A: 91.45, B: 0.65 },
        3: { A: 81.375, B: 0.8125 },
        2: { A: 73, B: 1 }
      }[rarity];
    }

    if (!formula || rarity < 2 || rarity > 4) return 0;
    const rawScore = ((adjustedItemLevel - formula.A) / formula.B)
      * GEAR_SCORE_SLOT_MODIFIERS[slot] * 1.8618 * qualityScale;
    return Math.max(0, Math.floor(rawScore));
  });

  score = scoredItems.reduce((total, itemScore) => total + itemScore, 0);
  if (hasTwoHandedWeapon && hasMainHand && hasOffHand) {
    const mainHandIndex = items.findIndex(item => item.slot?.type === 'MAIN_HAND');
    score -= Math.floor((scoredItems[mainHandIndex] || 0) * 0.5);
  }
  return Math.floor(score);
};

let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await axios.post(
      `https://${REGION}.battle.net/oauth/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: CLIENT_ID,
          password: CLIENT_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    console.log('✓ Access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// New endpoint to proxy Wowhead tooltip requests
app.get('/api/tooltip/:version/:itemId', async (req, res) => {
  try {
    const { version, itemId } = req.params;
    const { ench, gems, bonus } = req.query;
    
    // Map game version to Wowhead subdomain and dataEnv
    const versionConfig = {
      'classic-era': { subdomain: 'classic', dataEnv: 2 },
      'classic-era-us': { subdomain: 'classic', dataEnv: 2 },
      'classic-era-eu': { subdomain: 'classic', dataEnv: 2 },
      'tbc-anniversary': { subdomain: 'nether', dataEnv: 5 },
      'tbc': { subdomain: 'nether', dataEnv: 5 }
    };
    
    const config = versionConfig[version] || versionConfig['tbc-anniversary'];
    
    // Build Wowhead tooltip API URL
    let tooltipUrl = `https://${config.subdomain}.wowhead.com/tooltip/item/${itemId}`;
    const params = {
      dataEnv: config.dataEnv,
      locale: 0
    };
    
    if (ench) params.ench = ench;
    if (gems) params.gems = gems;
    if (bonus) params.bonus = bonus;
    
    const response = await axios.get(tooltipUrl, { params });
    res.json(response.data);
    
  } catch (error) {
    console.error('Error fetching tooltip:', error.message);
    res.status(500).json({ error: 'Failed to fetch tooltip data' });
  }
});

// Get character profile
app.get('/api/character/:region/:realm/:characterName', async (req, res) => {
  try {
    const { region, realm, characterName } = req.params;
    const version = req.query.version || 'classic-era';
    const token = await getAccessToken();
    
    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const characterSlug = characterName.toLowerCase();

    const profileUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterSlug}`;
    
    const profileResponse = await axios.get(profileUrl, {
      params: {
        namespace: getNamespace(version, region, 'profile'),
        locale: LOCALE
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const mediaUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterSlug}/character-media`;
    
    let characterMedia = null;
    try {
      const mediaResponse = await axios.get(mediaUrl, {
        params: {
          namespace: getNamespace(version, region, 'profile'),
          locale: LOCALE
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      characterMedia = mediaResponse.data;
    } catch (mediaError) {
      console.log('Character media not available');
    }

    const equipmentUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterSlug}/equipment`;
    
    const equipmentResponse = await axios.get(equipmentUrl, {
      params: {
        namespace: getNamespace(version, region, 'profile'),
        locale: LOCALE
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const equipmentWithIcons = await Promise.all(
      (equipmentResponse.data.equipped_items || []).map(async (item) => {
        try {
          if (item.media?.id) {
            const mediaUrl = `https://${region}.api.blizzard.com/data/wow/media/item/${item.media.id}`;
            const mediaResponse = await axios.get(mediaUrl, {
              params: {
                namespace: getItemMediaNamespace(version, region),
                locale: LOCALE
              },
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            const iconAsset = mediaResponse.data.assets?.find(asset => asset.key === 'icon')
              || mediaResponse.data.assets?.[0];
            item.icon = iconAsset?.value?.replace(/^http:\/\//, 'https://') || null;
          }
        } catch (err) {
          console.log(`Could not fetch media for item ${item.item?.id}`);
        }
        return item;
      })
    );

    equipmentResponse.data.equipped_items = equipmentWithIcons;
    profileResponse.data.gearscore = calculateGearScore(equipmentWithIcons);

    const statsUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterSlug}/statistics`;
    
    let statsResponse;
    try {
      statsResponse = await axios.get(statsUrl, {
        params: {
          namespace: getNamespace(version, region, 'profile'),
          locale: LOCALE
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (statsError) {
      console.log('Stats not available for this character');
      statsResponse = { data: null };
    }

    res.json({
      profile: profileResponse.data,
      equipment: equipmentResponse.data,
      statistics: statsResponse.data,
      media: characterMedia
    });

  } catch (error) {
    console.error('Error fetching character:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || 'Failed to fetch character data',
      message: error.message
    });
  }
});

// Get guild roster
app.get('/api/guild/:region/:realm/:guildName', async (req, res) => {
  try {
    const { region, realm, guildName } = req.params;
    const version = req.query.version || 'classic-era';
    const token = await getAccessToken();

    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const guildSlug = guildName.toLowerCase().replace(/\s+/g, '-');

    const namespace = getNamespace(version, region, 'profile');

    const guildUrl = `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildSlug}`;
    const rosterUrl = `${guildUrl}/roster`;

    const [guildResponse, rosterResponse] = await Promise.all([
      axios.get(guildUrl, {
        params: { namespace, locale: LOCALE },
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(rosterUrl, {
        params: { namespace, locale: LOCALE },
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    res.json({
      guild: guildResponse.data,
      roster: rosterResponse.data
    });

  } catch (error) {
    console.error('Error fetching guild:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || 'Failed to fetch guild data'
    });
  }
});

// Get available realms
app.get('/api/realms', async (req, res) => {
  try {
    const token = await getAccessToken();
    const version = req.query.version || 'classic-era';
    const requestedRegion = req.query.region?.toLowerCase();
    const regions = requestedRegion ? [requestedRegion] : ['us', 'eu'];
    if (regions.some(region => !['us', 'eu'].includes(region))) {
      return res.status(400).json({ error: 'Region must be us or eu' });
    }
    const results = await Promise.all(
      regions.map(async (region) => {
        const response = await axios.get(
          `https://${region}.api.blizzard.com/data/wow/realm/index`,
          {
            params: {
              namespace: getNamespace(version, region, 'dynamic'),
              locale: LOCALE
            },
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        return response.data.realms.map(r => ({
          ...r,
          region
        }));
      })
    );

    res.json({
      realms: results.flat()
    });

  } catch (error) {
    console.error('Error fetching realms:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch realms' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✓ Backend server running on http://localhost:${PORT}`);
});