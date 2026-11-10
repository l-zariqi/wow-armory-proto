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
    case 'wow-forever':
      return `${type}-forever-${region}`;
    case 'classic-era':
      return `${type}-classic1x-${region}`;
    case 'tbc-anniversary':
      return `${type}-classicann-${region}`;
    default:
      return `${type}-classic1x-${region}`;
  }
};

const getItemMediaNamespace = (version, region) => {
  if (version === 'wow-forever') return `static-forever-${region}`;
  return `static-${version === 'tbc-anniversary' ? 'classicann' : 'classic1x'}-${region}`;
};

const foreverTalentTreeCache = new Map();
const foreverSpellIconCache = new Map();
const classicTalentTreeCache = new Map();
const classicTalentDataCache = new Map();
const classicSpellTooltipCache = new Map();
const foreverTalentBackgroundIds = {
  1: [161, 164, 163],
  2: [382, 383, 381],
  3: [361, 363, 362],
  4: [182, 181, 183],
  5: [201, 202, 203],
  7: [261, 263, 262],
  8: [81, 41, 61],
  9: [302, 303, 301],
  11: [283, 281, 282]
};
const classicClassNames = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  11: 'Druid'
};
const classicTalentTreeNames = {
  161: 'Arms',
  164: 'Fury',
  163: 'Protection',
  382: 'Holy',
  383: 'Protection',
  381: 'Retribution',
  361: 'Beast Mastery',
  363: 'Marksmanship',
  362: 'Survival',
  182: 'Assassination',
  181: 'Combat',
  183: 'Subtlety',
  201: 'Discipline',
  202: 'Holy',
  203: 'Shadow',
  261: 'Elemental',
  263: 'Enhancement',
  262: 'Restoration',
  81: 'Arcane',
  41: 'Fire',
  61: 'Frost',
  302: 'Affliction',
  303: 'Demonology',
  301: 'Destruction',
  283: 'Balance',
  281: 'Feral Combat',
  282: 'Restoration'
};

const stripWowheadTooltipHtml = html => html
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
  .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCharCode(parseInt(value, 16)))
  .trim();

const fetchClassicTalentCalculatorData = version => {
  const wowheadVersion = version === 'tbc-anniversary' ? 'tbc' : 'classic';
  if (!classicTalentDataCache.has(wowheadVersion)) {
    const request = axios.get(
      `https://nether.wowhead.com/${wowheadVersion}/data/talents-classic`,
      { params: { dv: 34 }, timeout: 20000, maxContentLength: 2 * 1024 * 1024 }
    ).then(({ data: responseText }) => {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.indexOf(');', jsonStart);
      if (jsonStart < 0 || jsonEnd < 0) {
        throw new Error('Unexpected Wowhead talent data response');
      }
      return JSON.parse(responseText.slice(jsonStart, jsonEnd));
    });
    classicTalentDataCache.set(wowheadVersion, request);
    request.catch(() => classicTalentDataCache.delete(wowheadVersion));
  }
  return classicTalentDataCache.get(wowheadVersion);
};

const fetchClassicTalentTreeData = async (version, classId) => {
  const wowheadVersion = version === 'tbc-anniversary' ? 'tbc' : 'classic';
  const backgroundIds = foreverTalentBackgroundIds[classId];
  const className = classicClassNames[classId];
  if (!backgroundIds || !className) return [];

  const cacheKey = `${wowheadVersion}-${classId}`;
  if (!classicTalentTreeCache.has(cacheKey)) {
    const request = (async () => {
      const calculatorData = await fetchClassicTalentCalculatorData(version);
      const treeIds = backgroundIds.filter(treeId =>
        calculatorData.trees?.[treeId]?.description?.startsWith(className)
      );
      const spellIds = [...new Set(treeIds.flatMap(treeId =>
        Object.values(calculatorData.talents?.[treeId] || {}).flatMap(talent => talent.ranks || [])
      ))];
      let nextSpellIndex = 0;
      const tooltipWorkers = Array.from({ length: Math.min(12, spellIds.length) }, async () => {
        while (nextSpellIndex < spellIds.length) {
          const spellId = spellIds[nextSpellIndex++];
          const tooltipKey = `${wowheadVersion}-${spellId}`;
          if (!classicSpellTooltipCache.has(tooltipKey)) {
            const tooltipRequest = axios.get(
              `https://nether.wowhead.com/${wowheadVersion}/tooltip/spell/${spellId}`,
              { timeout: 10000 }
            ).then(({ data }) => {
              const description = data.tooltip?.match(/<div class="q">([\s\S]*?)<\/div>/i)?.[1] || '';
              return {
                name: data.name || '',
                description: stripWowheadTooltipHtml(description)
              };
            }).catch(error => {
              console.error(`Could not fetch ${wowheadVersion} talent tooltip for spell ${spellId}:`, error.message);
              return null;
            });
            classicSpellTooltipCache.set(tooltipKey, tooltipRequest);
          }
          await classicSpellTooltipCache.get(tooltipKey);
        }
      });
      await Promise.all(tooltipWorkers);
      const tooltips = new Map(await Promise.all(
        spellIds.map(async spellId => [
          spellId,
          await classicSpellTooltipCache.get(`${wowheadVersion}-${spellId}`)
        ])
      ));

      return treeIds.map(treeId => {
        const treeName = classicTalentTreeNames[treeId];
        const talentEntries = Object.values(calculatorData.talents[treeId]);
        return {
          id: treeId,
          name: treeName,
          maxPoints: version === 'classic-era' ? 51 : 61,
          backgroundImage: `https://wow.zamimg.com/images/wow/talents/backgrounds/${wowheadVersion}/${treeId}.jpg`,
          talents: talentEntries.map(talent => {
            const rankDescriptions = (talent.ranks || []).map((spellId, index) => ({
              rank: index + 1,
              spellId,
              description: tooltips.get(spellId)?.description || ''
            }));
            return {
              id: talent.id,
              talentId: talent.id,
              name: tooltips.get(talent.ranks?.[0])?.name || 'Unknown talent',
              description: rankDescriptions[0]?.description || '',
              row: talent.row + 1,
              column: talent.col + 1,
              maxRank: talent.ranks?.length || 1,
              icon: `https://wow.zamimg.com/images/wow/icons/large/${talent.icon}.jpg`,
              spellIds: talent.ranks || [],
              requirements: (talent.requires || []).map(requirement => ({
                talentId: requirement.id,
                rank: requirement.qty
              })),
              rankDescriptions
            };
          })
        };
      });
    })();
    classicTalentTreeCache.set(cacheKey, request);
    request.catch(() => classicTalentTreeCache.delete(cacheKey));
  }

  return classicTalentTreeCache.get(cacheKey);
};

const buildClassicTalentBuilds = async (version, classId, specializationGroups) => {
  if (!specializationGroups?.length) return [];
  const trees = await fetchClassicTalentTreeData(version, classId);
  return specializationGroups.map(group => {
    const allocatedTrees = group.specializations || [];
    const allocatedRanks = new Map();
    const allocatedRanksByName = new Map();
    allocatedTrees.forEach(allocatedTree => {
      (allocatedTree.talents || []).forEach(talent => {
        const id = talent.talent?.id ?? talent.id;
        const rank = talent.talent_rank ?? talent.rank ?? 0;
        if (id !== undefined) allocatedRanks.set(id, rank);
        const spellId = talent.spell_tooltip?.spell?.id || talent.spell?.id;
        if (spellId !== undefined) allocatedRanks.set(spellId, rank);
        const name = talent.talent?.name || talent.name;
        if (name) allocatedRanksByName.set(name.toLowerCase(), rank);
      });
    });

    return {
      isActive: group.is_active,
      trees: trees.map(tree => {
        const allocatedTree = allocatedTrees.find(specialization =>
          (specialization.specialization_name || specialization.specialization?.name || '')
            .toLowerCase() === tree.name.toLowerCase()
        );
        const talents = tree.talents.map(talent => {
          const rankFromSpellId = talent.spellIds
            .map(spellId => allocatedRanks.get(spellId))
            .find(rank => rank !== undefined);
          return {
            ...talent,
            rank: allocatedRanks.get(talent.talentId)
              ?? rankFromSpellId
              ?? allocatedRanksByName.get(talent.name.toLowerCase())
              ?? 0
          };
        });
        return {
          ...tree,
          maxPoints: version === 'classic-era' ? 51 : 61,
          spentPoints: allocatedTree?.spent_points
            ?? talents.reduce((total, talent) => total + talent.rank, 0),
          talents
        };
      })
    };
  });
};

const fetchForeverTalentTreeData = async (region, classId, token) => {
  const cacheKey = `${region}-${classId}`;
  if (!foreverTalentTreeCache.has(cacheKey)) {
    const request = (async () => {
      const requestConfig = {
        params: {
          namespace: `static-1.60.1_70399-forever-${region}`,
          locale: LOCALE
        },
        headers: { Authorization: `Bearer ${token}` }
      };
      const classResponse = await axios.get(
        `https://${region}.api.blizzard.com/data/wow/playable-class/${classId}`,
        requestConfig
      );
      const trees = await Promise.all(
        classResponse.data.specializations.map(async (specialization, index) => {
          const specializationResponse = await axios.get(
            `https://${region}.api.blizzard.com/data/wow/playable-specialization/${specialization.id}`,
            requestConfig
          );
          const treeResponse = await axios.get(
            specializationResponse.data.spec_talent_tree.key.href,
            requestConfig
          );
          const backgroundId = foreverTalentBackgroundIds[classId]?.[index];
          return {
            id: specialization.id,
            name: specialization.name,
            backgroundImage: backgroundId
              ? `https://wow.zamimg.com/images/wow/talents/backgrounds/classicplus/${backgroundId}.jpg`
              : null,
            nodes: treeResponse.data.spec_talent_nodes || []
          };
        })
      );
      const spellIds = [...new Set(trees.flatMap(tree =>
        tree.nodes.map(node => node.ranks?.[0]?.tooltip?.spell_tooltip?.spell?.id).filter(Boolean)
      ))];
      let nextSpellIndex = 0;
      const iconWorkers = Array.from({ length: Math.min(8, spellIds.length) }, async () => {
        while (nextSpellIndex < spellIds.length) {
          const spellId = spellIds[nextSpellIndex++];
          const iconKey = `${region}-${spellId}`;
          if (!foreverSpellIconCache.has(iconKey)) {
            const iconRequest = axios.get(
              `https://${region}.api.blizzard.com/data/wow/media/spell/${spellId}`,
              requestConfig
            ).then(response =>
              response.data.assets?.find(asset => asset.key === 'icon')?.value || null
            ).catch(error => {
              console.error(`Could not fetch Forever talent icon for spell ${spellId}:`, error.message);
              return null;
            });
            foreverSpellIconCache.set(iconKey, iconRequest);
          }
          await foreverSpellIconCache.get(iconKey);
        }
      });
      await Promise.all(iconWorkers);
      const iconUrls = new Map(await Promise.all(
        spellIds.map(async spellId => [
          spellId,
          await foreverSpellIconCache.get(`${region}-${spellId}`)
        ])
      ));

      return trees.map(tree => {
        const minColumn = Math.min(...tree.nodes.map(node => node.display_col || 1));
        const talentIdsByNodeId = new Map(tree.nodes.map(node => [
          node.id,
          node.ranks?.[0]?.tooltip?.talent?.id
        ]));
        return {
          id: tree.id,
          name: tree.name,
          backgroundImage: tree.backgroundImage,
          talents: tree.nodes.map(node => {
            const firstRank = node.ranks?.[0];
            const tooltip = firstRank?.tooltip;
            const spellId = tooltip?.spell_tooltip?.spell?.id;
            return {
              id: node.id,
              talentId: tooltip?.talent?.id,
              spellId,
              name: tooltip?.talent?.name || tooltip?.spell_tooltip?.spell?.name || 'Unknown talent',
              description: tooltip?.spell_tooltip?.description || '',
              row: node.display_row || 1,
              column: (node.display_col || minColumn) - minColumn + 1,
              maxRank: node.ranks?.length || 1,
              icon: spellId ? iconUrls.get(spellId) : null,
              requirements: (node.locked_by || [])
                .map(lockedByNodeId => {
                  const requiredNode = tree.nodes.find(candidate => candidate.id === lockedByNodeId);
                  const talentId = talentIdsByNodeId.get(lockedByNodeId);
                  return talentId === undefined
                    ? null
                    : { talentId, rank: requiredNode?.ranks?.length || 1 };
                })
                .filter(Boolean),
              rankDescriptions: (node.ranks || []).map(rank => ({
                rank: rank.rank,
                spellId: rank.tooltip?.spell_tooltip?.spell?.id,
                description: rank.tooltip?.spell_tooltip?.description || ''
              }))
            };
          })
        };
      });
    })();
    foreverTalentTreeCache.set(cacheKey, request);
    request.catch(() => foreverTalentTreeCache.delete(cacheKey));
  }

  return foreverTalentTreeCache.get(cacheKey);
};

const buildForeverTalentBuilds = async (region, classId, specializationGroups, token) => {
  if (!classId || !specializationGroups?.length) return [];
  const trees = await fetchForeverTalentTreeData(region, classId, token);
  return specializationGroups.map(group => ({
    isActive: group.is_active,
    trees: trees.map(tree => {
      const allocatedTree = group.specializations?.find(
        specialization => specialization.specialization?.id === tree.id
      );
      const allocatedRanks = new Map(
        (allocatedTree?.talents || []).map(talent => [talent.talent?.id, talent.talent_rank || 0])
      );
      return {
        id: tree.id,
        name: tree.name,
        backgroundImage: tree.backgroundImage,
        maxPoints: 61,
        spentPoints: allocatedTree?.spent_points || 0,
        talents: tree.talents.map(talent => ({
          ...talent,
          rank: allocatedRanks.get(talent.talentId) || 0
        }))
      };
    })
  }));
};

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
      'wow-forever': { subdomain: 'classic', dataEnv: 2 },
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

// WoW Forever characters are looked up by first name and surname, without a realm.
app.get('/api/forever/character/:region', async (req, res) => {
  const region = req.params.region.toLowerCase();
  const characterName = req.query.name;
  if (!['us', 'eu', 'kr', 'tw'].includes(region)) {
    return res.status(400).json({ error: 'Region must be us, eu, kr, or tw' });
  }
  if (typeof characterName !== 'string' || characterName.trim().split(/\s+/).length < 2) {
    return res.status(400).json({ error: 'Enter the character first name and surname' });
  }

  try {
    const token = await getAccessToken();
    const characterSlug = characterName.trim().toLowerCase().replace(/\s+/g, '-');
    const characterUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(characterSlug)}`;
    const requestConfig = {
      params: {
        namespace: getNamespace('wow-forever', region, 'profile'),
        locale: LOCALE
      },
      headers: { Authorization: `Bearer ${token}` }
    };

    const profileResponse = await axios.get(characterUrl, requestConfig);
    let characterMedia = null;
    let specializations = null;
    try {
      const mediaResponse = await axios.get(`${characterUrl}/character-media`, requestConfig);
      characterMedia = mediaResponse.data;
    } catch (mediaError) {
      console.log('Character media not available');
    }
    try {
      const specializationsResponse = await axios.get(`${characterUrl}/specializations`, requestConfig);
      specializations = specializationsResponse.data.specialization_groups || [];
    } catch (specializationsError) {
      console.error(
        'Could not fetch WoW Forever specializations:',
        specializationsError.response?.data || specializationsError.message
      );
    }
    let talentBuilds = null;
    try {
      talentBuilds = await buildForeverTalentBuilds(
        region,
        profileResponse.data.character_class?.id,
        specializations,
        token
      );
    } catch (talentError) {
      console.error(
        'Could not fetch WoW Forever talent trees:',
        talentError.response?.data || talentError.message
      );
    }

    const equipmentResponse = await axios.get(`${characterUrl}/equipment`, requestConfig);
    const equipmentWithIcons = await Promise.all(
      (equipmentResponse.data.equipped_items || []).map(async (item) => {
        try {
          if (item.media?.id) {
            const mediaResponse = await axios.get(
              `https://${region}.api.blizzard.com/data/wow/media/item/${item.media.id}`,
              {
                params: {
                  namespace: getItemMediaNamespace('wow-forever', region),
                  locale: LOCALE
                },
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            const iconAsset = mediaResponse.data.assets?.find(asset => asset.key === 'icon')
              || mediaResponse.data.assets?.[0];
            item.icon = iconAsset?.value?.replace(/^http:\/\//, 'https://') || null;
          }
        } catch (error) {
          console.log(`Could not fetch media for item ${item.item?.id}`);
        }
        return item;
      })
    );

    equipmentResponse.data.equipped_items = equipmentWithIcons;
    profileResponse.data.gearscore = calculateGearScore(equipmentWithIcons);

    let statistics = null;
    try {
      const statisticsResponse = await axios.get(`${characterUrl}/statistics`, requestConfig);
      statistics = statisticsResponse.data;
    } catch (error) {
      console.log('Stats not available for this character');
    }

    res.json({
      profile: profileResponse.data,
      equipment: equipmentResponse.data,
      statistics,
      specializations,
      talentBuilds,
      media: characterMedia
    });
  } catch (error) {
    console.error('Error fetching WoW Forever character:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || 'Failed to fetch character data',
      message: error.message
    });
  }
});

app.get('/api/forever/character-suggestions/:region', async (req, res) => {
  const region = req.params.region.toLowerCase();
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!['us', 'eu', 'kr', 'tw'].includes(region)) {
    return res.status(400).json({ error: 'Region must be us, eu, kr, or tw' });
  }
  if (query.length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    const words = query.split(/\s+/);
    const firstName = words[0];
    const surname = words.slice(1).join(' ');
    const searchSuggestions = async (field, value) => {
      const response = await axios.get('https://wow-classic-premium.com/en/forever/suggestions', {
        params: {
          kind: 'character',
          region,
          q: value,
          field
        },
        timeout: 8000
      });
      return Array.isArray(response.data.suggestions) ? response.data.suggestions : [];
    };

    const nameSuggestions = await searchSuggestions('name', firstName);
    let suggestions = nameSuggestions;
    if (surname) {
      const surnameSuggestions = await searchSuggestions('surname', surname);
      const candidates = new Map(
        [...nameSuggestions, ...surnameSuggestions].map(suggestion => [
          `${suggestion.name}-${suggestion.surname}`.toLowerCase(),
          suggestion
        ])
      );
      suggestions = Array.from(candidates.values()).filter(suggestion =>
        suggestion.name.toLowerCase().startsWith(firstName.toLowerCase())
        && suggestion.surname.toLowerCase().startsWith(surname.toLowerCase())
      );
    }

    res.json({
      suggestions: suggestions.slice(0, 8)
    });
  } catch (error) {
    console.error('Error fetching WoW Forever character suggestions:', error.response?.data || error.message);
    res.status(502).json({ error: 'Character suggestions are temporarily unavailable' });
  }
});

// Get character profile
app.get('/api/character/:region/:realm/:characterName', async (req, res) => {
  try {
    const { region, realm, characterName } = req.params;
    const version = req.query.version || 'classic-era';
    const token = await getAccessToken();
    
    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const characterSlug = version === 'wow-forever'
      ? characterName.trim().toLowerCase().replace(/\s+/g, '-')
      : characterName.toLowerCase();

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

    let specializations = null;
    try {
      const specializationsResponse = await axios.get(`${profileUrl}/specializations`, {
        params: {
          namespace: getNamespace(version, region, 'profile'),
          locale: LOCALE
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      specializations = specializationsResponse.data.specialization_groups || [];
    } catch (specializationsError) {
      console.error(
        'Could not fetch character specializations:',
        specializationsError.response?.data || specializationsError.message
      );
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

    let talentBuilds = null;
    try {
      talentBuilds = version === 'wow-forever'
        ? await buildForeverTalentBuilds(
          region,
          profileResponse.data.character_class?.id,
          specializations,
          token
        )
        : await buildClassicTalentBuilds(
          version,
          profileResponse.data.character_class?.id,
          specializations
        );
    } catch (talentError) {
      console.error(
        'Could not build character talent trees:',
        talentError.response?.data || talentError.message
      );
    }

    res.json({
      profile: profileResponse.data,
      equipment: equipmentResponse.data,
      statistics: statsResponse.data,
      media: characterMedia,
      specializations,
      talentBuilds
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