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