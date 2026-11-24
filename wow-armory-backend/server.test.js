const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const express = require('express');

test('character profiles include talent tree icons and available PvP data', async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalListen = express.application.listen;
  const originalEnv = {
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    PORT: process.env.PORT
  };
  process.env.CLIENT_ID = 'test-client';
  process.env.CLIENT_SECRET = 'test-secret';
  process.env.PORT = '0';

  const iconRequests = [];
  const bracketRequests = [];
  let summaryFails = false;
  let guildScenario = '';
  const guildRequests = [];
  const raceRequests = [];
  const itemRequests = [];
  let classicEquipment = false;
  let itemLookupFails = false;
  const nodes = [1309969, 1225132].map((spellId, index) => ({
    id: index + 1,
    display_row: 1,
    display_col: index + 1,
    ranks: [{
      rank: 1,
      tooltip: {
        talent: { id: index + 1, name: `Talent ${index + 1}` },
        spell_tooltip: { spell: { id: spellId }, description: 'Description' }
      }
    }]
  }));
  axios.post = async () => ({ data: { access_token: 'test-token', expires_in: 3600 } });
  axios.get = async (url, config) => {
    if (url.endsWith('/data/wow/realm/index')) {
      return { data: { realms: [
        { name: 'PROGWOW US1 Web', slug: 'progwow-us1-web' },
        { name: 'Nightslayer', slug: 'nightslayer' },
        { name: 'Anniversary', slug: 'anniversary' },
        { name: 'EU4 CWOW GMSS 2', slug: 'eu4-cwow-gmss-2' },
        { name: 'Internal', slug: 'eu5-cwow-web' },
        { name: 'EU40', slug: 'eu40' },
        { name: 'Other', slug: 'progwow-eu4-gmss-1' }
      ] } };
    }
    if (url.endsWith('/data/wow/item/21329')) {
      itemRequests.push(config.params.namespace);
      if (itemLookupFails) throw new Error('Item unavailable');
      return { data: { level: config.params.namespace.includes('classicann') ? 120 : 81 } };
    }
    if (guildScenario && (url.endsWith('/character/zarlyn-forever') || url.endsWith('/character/whitemane/example'))) {
      if (guildScenario === 'none') return { data: {} };
      if (guildScenario === 'invalid-link') return { data: { guild: { name: 'Test', key: { href: 'https://evil.example/data/wow/guild/test' } } } };
      if (guildScenario === 'classic') return { data: { guild: { name: 'Test Guild', realm: { slug: 'whitemane' } } } };
      return { data: { guild: { name: 'Test Guild', key: { href: 'https://eu.api.blizzard.com/data/wow/guild/test-guild?namespace=ignored' } } } };
    }
    if (url.includes('/guild/') && url.endsWith('/roster')) {
      guildRequests.push({ url, namespace: config.params.namespace, maxRedirects: config.maxRedirects });
      if (guildScenario === 'unavailable') {
        const error = new Error('Not found');
        error.response = { status: 404 };
        throw error;
      }
      return { data: { members: [
        { rank: 0, character: { name: 'Zarlyn', playable_class: { id: 8 }, playable_race: { id: 96 } } },
        { rank: 1, character: { name: 'Other', playable_race: { id: 96 } } },
        { rank: 2, character: { race: { id: 5, name: 'Undead' } } }
      ] } };
    }
    if (url.includes('/playable-race/')) {
      raceRequests.push({ url, namespace: config.params.namespace });
      if (guildScenario === 'race-fails') throw new Error('Race unavailable');
      return { data: { name: 'Windshaper Skyborne' } };
    }
    if (url.includes('/tooltip/spell/')) {
      iconRequests.push(url);
      if (!url.includes('/forever/tooltip/')) {
        const error = new Error('Not found');
        error.response = { status: 404 };
        throw error;
      }
      return { data: { icon: url.endsWith('/1309969') ? 'spell_holy_searinglight' : 'spell_holy_sealofvengeance' } };
    }
    if (url.endsWith('/playable-class/5')) {
      return { data: { specializations: [
        { id: 1, name: 'Discipline' },
        { id: 2, name: 'Holy' },
        { id: 3, name: 'Shadow' }
      ] } };
    }
    if (/\/playable-specialization\/[123]$/.test(url)) {
      return { data: { spec_talent_tree: { key: { href: `https://example.test/talent-tree-${url.split('/').pop()}` } } } };
    }
    if (/^https:\/\/example\.test\/talent-tree-[123]$/.test(url)) {
      const index = Number(url.slice(-1)) - 1;
      const firstColumn = [1, 7, 14][index];
      const valid = nodes.map(node => ({ ...node, display_col: node.display_col + firstColumn - 1 }));
      const invalid = [
        { display_row: 63, display_col: 3 },
        { display_row: 33, display_col: 14 },
        { display_row: 7, display_col: 170 }
      ][index];
      return { data: { spec_talent_nodes: [...valid, { ...nodes[0], id: 99, ...invalid }] } };
    }
    if (url.endsWith('/pvp-summary')) {
      if (summaryFails) {
        const error = new Error('PvP unavailable');
        error.response = { status: 503 };
        throw error;
      }
      if (url.includes('/character/whitemane/')) {
        assert.ok(['profile-classicann-eu', 'profile-classic1x-eu'].includes(config.params.namespace));
        return { data: { honorable_kills: 23 } };
      }
      return { data: {
        honorable_kills: 71,
        pvp_rank: 0,
        brackets: [
          { href: 'https://eu.api.blizzard.com/profile/wow/character/zarlyn-forever/pvp-bracket/2v2' },
          { href: 'https://evil.example/profile/wow/character/zarlyn-forever/pvp-bracket/3v3' }
        ]
      } };
    }
    if (url.includes('/pvp-bracket/')) {
      bracketRequests.push(url);
      if (url.includes('/character/whitemane/') && !url.endsWith('/2v2')) {
        const error = new Error('Not found');
        error.response = { status: 404 };
        throw error;
      }
      return { data: { bracket: { type: '2v2' }, rating: 1500 } };
    }
    if (url.endsWith('/specializations')) {
      if (url.includes('/character/whitemane/')) return { data: { specialization_groups: [] } };
      return { data: { specialization_groups: [{ is_active: true, specializations: [] }] } };
    }
    if (url.endsWith('/equipment')) {
      return { data: { equipped_items: classicEquipment && url.includes('/character/whitemane/') ? [
        { item: { id: 21329 }, slot: { type: 'HEAD' }, quality: { type: 'EPIC' } },
        { item: { id: 21329 }, slot: { type: 'NECK' }, quality: { type: 'EPIC' } },
        { item: { id: 500 }, level: { value: 70 }, slot: { type: 'HANDS' }, quality: { type: 'EPIC' } }
      ] : [] } };
    }
    if (url.endsWith('/statistics') || url.endsWith('/character-media')) return { data: {} };
    if (url.endsWith('/character/zarlyn-forever')) {
      return { data: { character_class: { id: 5 } } };
    }
    if (url.endsWith('/character/whitemane/example')) {
      return { data: { character_class: { id: 5 } } };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  let server;
  express.application.listen = function (...args) {
    server = originalListen.apply(this, args);
    return server;
  };
  try {
    require('./server');
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/forever/character/eu?name=Zarlyn%20Forever`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.talentBuilds[0].trees[0].talents.map(talent => talent.icon), [
      'https://wow.zamimg.com/images/wow/icons/large/spell_holy_searinglight.jpg',
      'https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofvengeance.jpg'
    ]);
    assert.deepEqual(iconRequests, [
      'https://nether.wowhead.com/forever/tooltip/spell/1309969',
      'https://nether.wowhead.com/forever/tooltip/spell/1225132'
    ]);
    assert.equal(data.talentBuilds[0].trees[0].icon,
      'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_wordfortitude.jpg');
    assert.deepEqual(data.talentBuilds[0].trees.map(tree => tree.invalidPositions), [1, 1, 1]);
    assert.deepEqual(data.talentBuilds[0].trees.map(tree => tree.talents.map(talent => talent.column)), [
      [1, 2], [1, 2], [1, 2]
    ]);
    assert.equal(data.pvp.summary.honorable_kills, 71);
    assert.equal(data.pvp.summary.pvp_rank, 0);
    assert.equal(data.pvp.brackets[0].data.rating, 1500);
    assert.equal(data.pvp.warning, 'Some PvP bracket data could not be loaded.');
    assert.deepEqual(bracketRequests, [
      'https://eu.api.blizzard.com/profile/wow/character/zarlyn-forever/pvp-bracket/2v2'
    ]);

    summaryFails = true;
    const failedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/forever/character/eu?name=Zarlyn%20Forever`);
    const failedData = await failedResponse.json();
    assert.equal(failedResponse.status, 200);
    assert.equal(failedData.pvp.summary, null);
    assert.equal(failedData.pvp.error, 'Unable to load PvP data. Please try again later.');

    summaryFails = false;
    bracketRequests.length = 0;
    const classicResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/character/eu/whitemane/example?version=tbc-anniversary`);
    const classicData = await classicResponse.json();
    assert.equal(classicResponse.status, 200);
    assert.equal(classicData.pvp.summary.honorable_kills, 23);
    assert.equal(classicData.pvp.brackets[0].slug, '2v2');
    assert.equal(classicData.pvp.warning, null);
    assert.deepEqual(bracketRequests.map(url => url.split('/').pop()), ['2v2', '3v3', '5v5', 'rbg']);

    classicEquipment = true;
    for (const [version, namespace, level, score] of [
      ['classic-era', 'static-classic1x-eu', 81, 202],
      ['tbc-anniversary', 'static-classicann-eu', 120, 286]
    ]) {
      const equipmentResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/character/eu/whitemane/example?version=${version}`);
      const equipmentData = await equipmentResponse.json();
      assert.equal(equipmentResponse.status, 200);
      assert.deepEqual(equipmentData.equipment.equipped_items.map(item => item.level.value), [level, level, 70]);
      assert.equal(equipmentData.profile.gearscore, score);
      assert.deepEqual(itemRequests.splice(0), [namespace]);
    }
    itemLookupFails = true;
    const failedEquipmentResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/character/eu/whitemane/example?version=classic-era`);
    const failedEquipment = await failedEquipmentResponse.json();
    assert.equal(failedEquipmentResponse.status, 200);
    assert.equal(failedEquipment.profile.gearscore, null);
    assert.equal(failedEquipment.equipment.warning, 'Some item levels could not be loaded; gearscore is unavailable.');
    assert.equal(itemRequests.splice(0).length, 1);
    itemLookupFails = false;
    classicEquipment = false;

    const realmsResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/realms?version=tbc-anniversary`);
    const realms = (await realmsResponse.json()).realms;
    assert.deepEqual(realms.map(realm => [realm.name, realm.region]), [
      ['Nightslayer', 'us'], ['Anniversary', 'us'], ['EU4 CWOW GMSS 2', 'us'],
      ['Internal', 'us'], ['EU40', 'us'], ['Nightslayer', 'eu'],
      ['EU4 CWOW GMSS 2', 'eu'], ['Internal', 'eu'], ['EU40', 'eu']
    ]);
    const eraRealmsResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/realms?version=classic-era&region=eu`);
    const eraRealms = (await eraRealmsResponse.json()).realms;
    assert.deepEqual(eraRealms.map(realm => realm.name), ['Nightslayer', 'Anniversary', 'EU40']);

    guildScenario = 'forever';
    const foreverGuild = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=wow-forever&name=Zarlyn%20Forever`);
    assert.equal(foreverGuild.status, 200);
    const foreverResult = await foreverGuild.json();
    const foreverRoster = foreverResult.roster;
    assert.equal(foreverRoster.members[0].rank, 0);
    assert.equal(foreverRoster.members[0].character.playable_class.name, 'Mage');
    assert.equal(foreverRoster.members[0].character.playable_race.name, 'Windshaper Skyborne');
    assert.equal(foreverRoster.members[1].character.playable_race.name, 'Windshaper Skyborne');
    assert.equal(foreverRoster.members[2].character.race.name, 'Undead');
    assert.equal(foreverResult.warning, null);
    assert.deepEqual(raceRequests.splice(0), [{
      url: 'https://eu.api.blizzard.com/data/wow/playable-race/96',
      namespace: 'static-forever-eu'
    }]);
    assert.deepEqual(guildRequests.pop(), {
      url: 'https://eu.api.blizzard.com/data/wow/guild/test-guild/roster',
      namespace: 'profile-forever-eu',
      maxRedirects: 0
    });
    guildScenario = 'race-fails';
    const raceFailed = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=wow-forever&name=Zarlyn%20Forever`);
    const raceFailedData = await raceFailed.json();
    assert.equal(raceFailed.status, 200);
    assert.equal(raceFailedData.roster.members[0].character.playable_race.id, 96);
    assert.equal(raceFailedData.warning, 'Some race names could not be loaded.');
    raceRequests.length = 0;

    guildScenario = 'classic';
    const classicGuild = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=tbc-anniversary&name=Example&realm=whitemane`);
    assert.equal(classicGuild.status, 200);
    assert.deepEqual(guildRequests.pop(), {
      url: 'https://eu.api.blizzard.com/data/wow/guild/whitemane/test-guild/roster',
      namespace: 'profile-classicann-eu',
      maxRedirects: 0
    });
    assert.deepEqual(raceRequests.splice(0), [{
      url: 'https://eu.api.blizzard.com/data/wow/playable-race/96',
      namespace: 'static-classicann-eu'
    }]);

    guildScenario = 'none';
    const noGuild = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=wow-forever&name=Zarlyn%20Forever`);
    assert.deepEqual(await noGuild.json(), { guild: null, roster: null });
    guildScenario = 'invalid-link';
    const invalidGuild = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=wow-forever&name=Zarlyn%20Forever`);
    assert.equal(invalidGuild.status, 502);
    guildScenario = 'unavailable';
    const missingGuild = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/eu?version=wow-forever&name=Zarlyn%20Forever`);
    assert.equal(missingGuild.status, 404);
    assert.equal((await missingGuild.json()).error, 'Guild roster is not available for this character.');
    const invalidRegion = await fetch(`http://127.0.0.1:${server.address().port}/api/character-guild/invalid?version=wow-forever&name=Zarlyn`);
    assert.equal(invalidRegion.status, 400);
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    axios.get = originalGet;
    axios.post = originalPost;
    express.application.listen = originalListen;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
