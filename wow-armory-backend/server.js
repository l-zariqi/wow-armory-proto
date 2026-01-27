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

// Check for required environment variables
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: CLIENT_ID and CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

console.log('✓ Environment variables loaded successfully');
console.log('✓ CLIENT_ID:', CLIENT_ID);
console.log('✓ CLIENT_SECRET:', CLIENT_SECRET ? '***configured***' : 'MISSING');

// Namespace mapping for different Classic versions
const getNamespace = (version, region, type = 'profile') => {
  const namespaces = {
    'classic-era': `${type}-classic1x-${region}`,
    'classic-anniversary': `${type}-classic-${region}`,
    'classic': `${type}-classic-${region}` // Anniversary uses the same namespace as regular classic
  };
  return namespaces[version] || namespaces['classic-era'];
};

// Token storage (in production, use Redis or similar)
let accessToken = null;
let tokenExpiry = null;

// Get OAuth token
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

// Get character profile
app.get('/api/character/:region/:realm/:characterName', async (req, res) => {
  try {
    const { region, realm, characterName } = req.params;
    const version = req.query.version || 'classic-era'; // classic-era or classic (anniversary)
    const token = await getAccessToken();
    
    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const characterSlug = characterName.toLowerCase();

    // Get character profile summary
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

    // Get character media (avatar/portrait)
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

    // Get character equipment
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

    // Fetch media/icon data for each equipped item
    const equipmentWithIcons = await Promise.all(
      (equipmentResponse.data.equipped_items || []).map(async (item) => {
        try {
          if (item.media?.id) {
            const mediaUrl = `https://${region}.api.blizzard.com/data/wow/media/item/${item.media.id}`;
            const mediaResponse = await axios.get(mediaUrl, {
              params: {
                namespace: getNamespace(version, region, 'static'),
                locale: LOCALE
              },
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            item.icon = mediaResponse.data.assets?.[0]?.value || null;
          }
        } catch (err) {
          console.log(`Could not fetch media for item ${item.item?.id}`);
        }
        return item;
      })
    );

    equipmentResponse.data.equipped_items = equipmentWithIcons;

    // Get character statistics
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
app.get('/api/guild/:realm/:guildName', async (req, res) => {
  try {
    const { realm, guildName } = req.params;
    const token = await getAccessToken();
    
    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const guildSlug = guildName.toLowerCase().replace(/\s+/g, '-');

    // Get guild profile
    const guildUrl = `https://${REGION}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildSlug}`;
    
    const guildResponse = await axios.get(guildUrl, {
      params: {
        namespace: `profile-classic1x-${REGION}`,
        locale: LOCALE
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Get guild roster
    const rosterUrl = `https://${REGION}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildSlug}/roster`;
    
    const rosterResponse = await axios.get(rosterUrl, {
      params: {
        namespace: `profile-classic1x-${REGION}`,
        locale: LOCALE
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json({
      guild: guildResponse.data,
      roster: rosterResponse.data
    });

  } catch (error) {
    console.error('Error fetching guild:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || 'Failed to fetch guild data',
      message: error.message
    });
  }
});

// Get available realms
app.get('/api/realms', async (req, res) => {
  try {
    const token = await getAccessToken();
    const region = req.query.region || REGION;
    const version = req.query.version || 'classic-era'; // classic-era or classic (anniversary)
    
    const realmsUrl = `https://${region}.api.blizzard.com/data/wow/realm/index`;
    
    const response = await axios.get(realmsUrl, {
      params: {
        namespace: getNamespace(version, region, 'dynamic'),
        locale: LOCALE
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching realms:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch realms',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✓ Backend server running on http://localhost:${PORT}`);
});