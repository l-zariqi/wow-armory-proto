import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

const response = data => ({ ok: true, json: async () => data });
const suggestions = {
  us: [{ label: 'Zarlyn West', name: 'zarlyn', surname: 'west', detail: 'Mage', ruleset: 'PvP' }],
  eu: [{ label: 'Zarlyn Forever', name: 'zarlyn', surname: 'forever', detail: 'Mage', ruleset: 'PvP' }],
  kr: [],
  tw: []
};

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  global.fetch = jest.fn(async url => {
    if (url.includes('/character-suggestions/')) {
      const region = url.match(/character-suggestions\/([^?]+)/)[1];
      return response({ suggestions: suggestions[region] });
    }
    if (url.includes('/forever/character/')) {
      return response({
        profile: {
          name: 'Zarlyn', surname: 'Forever', level: 57,
          race: { name: 'Undead' }, character_class: { name: 'Mage' }, ruleset: { name: 'PvP' }
        },
        equipment: { equipped_items: [
          { slot: { type: 'HEAD' }, item: { id: 123 }, level: { value: 74 } }
        ] },
        media: { assets: [] }
      });
    }
    return response({ realms: [] });
  });
});

afterEach(() => {
  delete global.fetch;
});

it('searches all regions by default, opens a result in its region, and keeps the header filter', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'WoW Forever' }));
  expect(screen.getByRole('combobox', { name: 'Region' }).value).toBe('all');
  fireEvent.change(screen.getByRole('combobox', { name: 'Character name' }), { target: { value: 'zarl' } });

  expect(await screen.findByText('Zarlyn West')).toBeTruthy();
  expect(screen.getByText('Zarlyn Forever')).toBeTruthy();
  expect(screen.getByText('Mage · PvP · US')).toBeTruthy();
  expect(screen.getByText('Mage · PvP · EU')).toBeTruthy();
  const calls = global.fetch.mock.calls.map(([url]) => url);
  for (const region of ['us', 'eu', 'kr', 'tw']) {
    expect(calls.some(url => url.includes(`/character-suggestions/${region}?`))).toBe(true);
  }

  fireEvent.click(screen.getByRole('option', { name: /Zarlyn Forever/ }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) =>
    url.includes('/forever/character/eu?name=Zarlyn%20Forever')
  )).toBe(true));
  expect(await screen.findByRole('combobox', { name: 'Search another character' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Region' }).value).toBe('all');
  expect(screen.queryByRole('link', { name: /dressing room/i })).toBeNull();
  expect(screen.getByText('74').style.fontFamily).toBe('Arial, sans-serif');
  expect(screen.getByText('Level 57 Undead Mage - EU - PvP')).toBeTruthy();
  const characterDetails = within(screen.getByRole('region', { name: 'character details' }));
  expect(characterDetails.getByText(/Equipped iLvl:/)).toBeTruthy();
  expect(characterDetails.getByText(/Gearscore:/)).toBeTruthy();
  expect(characterDetails.queryByText(/^Ruleset:/)).toBeNull();
  expect(characterDetails.queryByText(/^Faction:/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Open Warcraft Logs' }).getAttribute('href'))
    .toBe('https://forever.warcraftlogs.com/character/eu/pvp/zarlyn%20forever');
});

it('keeps the displayed character location while another search is pending', async () => {
  const originalFetch = global.fetch;
  let resolveSearch;
  global.fetch = jest.fn((...args) => {
    if (args[0].includes('/forever/character/us?')) {
      return new Promise(resolve => { resolveSearch = resolve; });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  const input = await screen.findByRole('combobox', { name: 'Search another character' });
  fireEvent.click(screen.getByRole('button', { name: 'Talents' }));
  expect(new URL(window.location.href).searchParams.get('tab')).toBe('talents');
  fireEvent.change(input, { target: { value: 'zarl' } });
  fireEvent.click(await screen.findByRole('option', { name: /Zarlyn West/ }));
  expect(screen.getByText('Level 57 Undead Mage - EU - PvP')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open Warcraft Logs' }).getAttribute('href'))
    .toBe('https://forever.warcraftlogs.com/character/eu/pvp/zarlyn%20forever');
  resolveSearch(response({
    profile: { name: 'Zarlyn', surname: 'West', level: 30, ruleset: { name: 'Normal' } },
    equipment: { equipped_items: [] }
  }));
  expect(await screen.findByText(/Level 30.*US - Normal/)).toBeTruthy();
  expect(screen.getByRole('region', { name: 'character details' })).toBeTruthy();
  expect(new URL(window.location.href).searchParams.has('tab')).toBe(false);
  expect(screen.getByRole('link', { name: 'Open Warcraft Logs' }).getAttribute('href'))
    .toBe('https://forever.warcraftlogs.com/character/us/normal/zarlyn%20west');
});

it('does not guess the Warcraft Logs ruleset when it is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn((...args) => args[0].includes('/forever/character/')
    ? Promise.resolve(response({ profile: { name: 'Zarlyn', surname: 'Forever', level: 57 }, equipment: { equipped_items: [] } }))
    : originalFetch(...args));
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  expect(await screen.findByText(/Level 57.*EU/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Warcraft Logs link unavailable' }).disabled).toBe(true);
  expect(screen.queryByRole('link', { name: 'Open Warcraft Logs' })).toBeNull();
});

it('keeps realm-based Warcraft Logs links and displays their region', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn((...args) => args[0].includes('/character/eu/whitemane/')
    ? Promise.resolve(response({
      profile: { name: 'Example', level: 70, realm: { slug: 'whitemane' } },
      equipment: { equipped_items: [] }
    }))
    : originalFetch(...args));
  window.history.replaceState({}, '', '/?version=tbc-anniversary&region=eu&realm=whitemane&name=Example');
  render(<App />);
  expect(await screen.findByText(/Level 70.*EU/)).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'character details' })).queryByText(/^Realm:/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Open Warcraft Logs' }).getAttribute('href'))
    .toBe('https://fresh.warcraftlogs.com/character/eu/whitemane/Example');
});

it.each([
  ['classic-era', 81, 202],
  ['tbc-anniversary', 120, 286]
])('shows %s item levels and gearscore', async (version, level, gearscore) => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character/eu/whitemane/')) {
      return response({
        profile: { name: 'Example', level: 60, gearscore },
        equipment: { equipped_items: [
          { name: 'Test Helm', item: { id: 21329 }, level: { value: level }, slot: { type: 'HEAD' } }
        ] }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', `/?version=${version}&region=eu&realm=whitemane&name=Example`);
  render(<App />);
  const icon = await screen.findByRole('img', { name: 'Test Helm' });
  expect(within(icon.parentElement).getByText(String(level)).style.fontFamily).toBe('Arial, sans-serif');
  expect(within(screen.getByRole('region', { name: 'character details' })).getByText(String(gearscore))).toBeTruthy();
});

it('explains unavailable Classic gearscore without showing a stale fallback', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character/eu/whitemane/')) {
      return response({
        profile: { name: 'Example', gearscore: null, gear_score: 999 },
        equipment: { equipped_items: [], warning: 'Some item levels could not be loaded; gearscore is unavailable.' }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=classic-era&region=eu&realm=whitemane&name=Example');
  render(<App />);
  expect((await screen.findByRole('status')).textContent).toBe('Some item levels could not be loaded; gearscore is unavailable.');
  const details = within(screen.getByRole('region', { name: 'character details' }));
  expect(details.getByText('N/A')).toBeTruthy();
  expect(details.queryByText('999')).toBeNull();
});

it('filters suggestions by region and requires a region for direct full-name search', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'WoW Forever' }));
  const input = screen.getByRole('combobox', { name: 'Character name' });
  fireEvent.change(input, { target: { value: 'Zarlyn Forever' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search Character' }));
  expect(screen.getByText('Select a character suggestion or choose a region to search directly').style.fontFamily)
    .toBe('Arial, sans-serif');
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/forever/character/all?'))).toBe(false);

  fireEvent.change(screen.getByRole('combobox', { name: 'Region' }), { target: { value: 'eu' } });
  fireEvent.focus(input);
  expect(await screen.findByText('Zarlyn Forever')).toBeTruthy();
  expect(screen.queryByText('Zarlyn West')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Search Character' }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) =>
    url.includes('/forever/character/eu?name=Zarlyn%20Forever')
  )).toBe(true));
});

it.each([
  ['Priest', '#ffffff'],
  ['Hunter', '#abd473'],
  ['Mage', '#69ccf0']
])('lays out %s talents with class-colored spec icons and prerequisite arrows', async (className, color) => {
  const originalFetch = global.fetch;
  const talent = (id, row, column, requirements = []) => ({
    id, talentId: id, name: `Talent ${id}`, row, column, requirements,
    maxRank: 2, rank: 0, rankDescriptions: [], icon: '/talent.jpg'
  });
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/forever/character/')) {
      return response({
        profile: { name: 'Zarlyn', surname: 'Forever', level: 57, character_class: { name: className } },
        equipment: { equipped_items: [] },
        talentBuilds: [{
          isActive: true,
          trees: [{
            id: 1, name: 'Arcane', spentPoints: 0, icon: '/arcane.jpg', invalidPositions: 1,
            talents: [
              talent(1, 1, 1),
              { ...talent(2, 3, 1, [{ talentId: 1, rank: 1 }]), rank: 1 },
              { ...talent(3, 1, 2, [{ talentId: 1, rank: 1 }]), rank: 2 },
              talent(4, 3, 3, [{ talentId: 1, rank: 1 }, { talentId: 99, rank: 1 }]),
              talent(5, 2, 3, [{ talentId: 2, rank: 2 }]),
              talent(6, 3, 2, [{ talentId: 3, rank: 2 }])
            ]
          }]
        }]
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Talents' }));

  const icon = screen.getByRole('link', { name: 'Talent 1, 0 of 2 ranks' });
  const treeIcon = screen.getByRole('heading', { name: 'Arcane', level: 5 }).parentElement.querySelector('img');
  expect(treeIcon.getAttribute('src')).toBe('/arcane.jpg');
  expect(treeIcon.style.borderColor).toBe(color);
  expect(screen.getByText("Some talents have invalid positions in Blizzard's data and cannot be displayed.")).toBeTruthy();
  const partial = screen.getByRole('link', { name: 'Talent 2, 1 of 2 ranks' });
  const maxed = screen.getByRole('link', { name: 'Talent 3, 2 of 2 ranks' });
  expect(icon.style.borderColor).toBe('#374151');
  expect(icon.querySelector('img').style.filter).toContain('grayscale(1)');
  expect(partial.style.borderColor).toBe('#1eff00');
  expect(maxed.style.borderColor).toBe('#ffd700');
  expect(partial.querySelector('img').style.filter).toBe('none');
  expect(within(partial).getByText('1/2')).toBeTruthy();
  expect(within(maxed).getByText('2/2')).toBeTruthy();
  expect(within(icon).queryByText('0/2')).toBeNull();
  for (const talentIcon of [icon, partial, maxed]) {
    expect(talentIcon.style.boxShadow).toBe('');
  }
  const grid = icon.parentElement;
  expect(grid.style.width).toBe('240px');
  expect(grid.style.gridTemplateRows).toBe('repeat(3, 60px)');
  const segments = grid.querySelectorAll('.talent-connection');
  expect(segments).toHaveLength(9);
  expect(segments[0].style.height).toBe('76px');
  expect(segments[1].style.transform).toBe('rotate(-90deg)');
  expect(segments[4].style.backgroundPosition).toBe('center bottom');
  expect(segments[4].style.backgroundImage).toContain('talent-arrow-down.png');
  for (const segment of [...segments].slice(0, 5)) {
    expect(segment.style.backgroundImage).toContain('/talent-arrow-down.png');
  }
  for (const segment of [...segments].slice(5)) {
    expect(segment.style.backgroundImage).toContain('/talent-arrow-down-active.png');
    expect(segment.style.filter).toBe('');
  }
});

it('shows reported statistics and marks missing fields without replacing zeroes', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/forever/character/')) {
      return response({
        profile: { name: 'Zarlyn', surname: 'Forever', level: 57 },
        equipment: { equipped_items: [] },
        statistics: {
          health: 1627, power: 4950, power_type: { name: 'Mana' },
          stamina: { effective: 57 }, intellect: { effective: 271 },
          main_hand_damage_min: 22.671429, main_hand_damage_max: 40.67143,
          main_hand_speed: 1.3, attack_power: 18,
          melee_crit: { value: 3.5 }, melee_haste: { value: 0 },
          spell_healing: 233, spell_power: 233, spell_penetration: 15,
          mana_regen: 132, mana_regen_combat: 66, spell_crit: { value: 8.4967 },
          armor: { effective: 494 }, dodge: { value: 4.2528 }, defense: { effective: 269 }
        }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Stats' }));
  const base = within(screen.getByRole('region', { name: 'Base' }));
  const melee = within(screen.getByRole('region', { name: 'Melee' }));
  const spell = within(screen.getByRole('region', { name: 'Spell' }));
  const defense = within(screen.getByRole('region', { name: 'Defense' }));
  expect(base.getByText('1,627')).toBeTruthy();
  expect(base.getByText('4,950')).toBeTruthy();
  expect(base.getAllByText('N/A')).toHaveLength(3);
  expect(melee.getByText('23 - 41')).toBeTruthy();
  expect(melee.getByText('1.30')).toBeTruthy();
  expect(melee.getByText('3.50%')).toBeTruthy();
  expect(melee.getByText('0.00%')).toBeTruthy();
  expect(melee.getByText('N/A')).toBeTruthy();
  expect(spell.getAllByText('233')).toHaveLength(2);
  expect(spell.getByText('8.50%')).toBeTruthy();
  expect(defense.getByText('4.25%')).toBeTruthy();
  expect(defense.getByText('269')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Character' }));
  expect(screen.queryByRole('region', { name: 'Base' })).toBeNull();
});

it('explains when character statistics are unavailable', async () => {
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Stats' }));
  expect(screen.getByText('Character statistics are unavailable.')).toBeTruthy();
});

it('keeps a shared scrollable tab body and resets its scroll position when switching tabs', async () => {
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  const characterPanel = await screen.findByRole('region', { name: 'character details' });
  characterPanel.scrollTop = 100;
  for (const tab of ['Stats', 'Talents', 'PvP', 'Guild', 'Character']) {
    fireEvent.click(screen.getByRole('button', { name: tab }));
    const panel = screen.getByRole('region', { name: `${tab.toLowerCase()} details` });
    expect(panel.className).toContain('h-[860px]');
    expect(panel.className).toContain('overflow-auto');
    expect(panel.scrollTop).toBe(0);
  }
});

it('restores the selected tab after refresh and resets it when closing a character', async () => {
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever&other=kept');
  let app = render(<App />);
  await screen.findByRole('region', { name: 'character details' });
  for (const tab of ['Stats', 'Talents', 'PvP', 'Guild', 'Character']) {
    fireEvent.click(screen.getByRole('button', { name: tab }));
    let url = new URL(window.location.href);
    expect(url.searchParams.get('tab')).toBe(tab === 'Character' ? null : tab.toLowerCase());
    expect(url.searchParams.get('other')).toBe('kept');
    app.unmount();
    app = render(<App />);
    expect(await screen.findByRole('region', { name: `${tab.toLowerCase()} details` })).toBeTruthy();
    url = new URL(window.location.href);
    expect(url.searchParams.get('tab')).toBe(tab === 'Character' ? null : tab.toLowerCase());
  }
  fireEvent.click(screen.getByRole('button', { name: 'Talents' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close character' }));
  expect(new URL(window.location.href).searchParams.has('tab')).toBe(false);
  app.unmount();
});

it('falls back to the character tab for an invalid saved tab', async () => {
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever&tab=unknown');
  render(<App />);
  expect(await screen.findByRole('region', { name: 'character details' })).toBeTruthy();
  expect(new URL(window.location.href).searchParams.has('tab')).toBe(false);
});

it('keeps inactive panel button borders transparent when switching tabs', async () => {
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  await screen.findByRole('region', { name: 'character details' });
  const tabs = ['Character', 'Stats', 'Talents', 'PvP', 'Guild'];

  for (const activeTab of [...tabs, 'Character']) {
    fireEvent.click(screen.getByRole('button', { name: activeTab }));
    for (const tab of tabs) {
      const button = screen.getByRole('button', { name: tab });
      expect(button.style.borderWidth).toBe('2px');
      expect(button.style.borderColor).toBe(tab === activeTab ? '#8b7355' : 'transparent');
    }
  }
});

it.each([
  ['ALLIANCE', 'rgb(77, 166, 255)'],
  ['HORDE', 'rgb(255, 77, 77)'],
  [null, 'rgb(255, 255, 255)']
])('colors the guild name for faction %s and shows roster details', async (faction, color) => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character-guild/')) {
      return response({ guild: { name: 'Test Guild' }, roster: { members: [
        { rank: 0, character: { id: 1, name: 'Zarlyn', surname: 'Forever', level: 57, playable_class: { id: 8, name: 'Mage' }, playable_race: { name: 'Undead' } } },
        { rank: 2, character: { id: 2, name: 'Other', realm: { name: 'Whitemane' } } }
      ] } });
    }
    if (args[0].includes('/forever/character/')) {
      return response({
        profile: { name: 'Zarlyn', surname: 'Forever', level: 57, guild: { name: 'Test Guild' }, faction: faction ? { type: faction } : null },
        equipment: { equipped_items: [] }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  const guildButton = await screen.findByRole('button', { name: '<Test Guild>' });
  expect(guildButton.style.color).toBe(color);
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/character-guild/'))).toBe(false);
  fireEvent.click(guildButton);
  expect(screen.getByRole('region', { name: 'guild details' })).toBeTruthy();
  const roster = await screen.findByRole('region', { name: 'Guild roster' });
  expect(within(roster).getByText('Test Guild (2 members)')).toBeTruthy();
  expect(within(roster).getByText('Zarlyn Forever').style.color).toBe('rgb(105, 204, 240)');
  const memberLink = within(roster).getByRole('link', { name: 'Zarlyn Forever' });
  expect(memberLink.getAttribute('href')).toBe('/?version=wow-forever&region=eu&name=Zarlyn+Forever');
  expect(memberLink.getAttribute('target')).toBe('_blank');
  expect(memberLink.getAttribute('rel')).toBe('noopener noreferrer');
  expect(within(roster).queryByRole('link', { name: 'Other' })).toBeNull();
  expect(within(roster).getByText('Mage').style.color).toBe('rgb(105, 204, 240)');
  expect(within(roster).getByText('Undead')).toBeTruthy();
  expect(within(roster).queryByRole('columnheader', { name: 'Realm' })).toBeNull();
  expect(within(roster).queryByRole('columnheader', { name: 'Gender' })).toBeNull();
  expect(within(roster).queryByRole('columnheader', { name: 'Faction' })).toBeNull();
  expect(within(roster).getByText('Guild Master')).toBeTruthy();
  expect(within(roster).getByText('2')).toBeTruthy();
  expect(within(roster).getAllByText('N/A').length).toBeGreaterThan(0);
  expect(global.fetch.mock.calls.some(([url]) =>
    url.includes('/character-guild/eu?version=wow-forever&name=Zarlyn+Forever')
  )).toBe(true);
});

it('explains absent guilds and roster errors', async () => {
  const originalFetch = global.fetch;
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  const { unmount } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Guild' }));
  expect(screen.getByText('This character is not in a guild.')).toBeTruthy();
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/character-guild/'))).toBe(false);
  unmount();

  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character-guild/')) {
      return { ok: false, json: async () => ({ error: 'Guild roster is not available for this character.' }) };
    }
    if (args[0].includes('/forever/character/')) {
      return response({ profile: { name: 'Zarlyn', surname: 'Forever', guild: { name: 'Test Guild' } }, equipment: { equipped_items: [] } });
    }
    return originalFetch(...args);
  });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Guild' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Guild roster is not available for this character.');
});

it('opens realm-based members using their own realm and omits links when it is unknown', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character-guild/')) {
      return response({ guild: { name: 'Test Guild' }, roster: { members: [
        { character: { name: 'Arden', realm: { slug: 'other-realm' } } },
        { character: { name: 'Unknown', realm: { name: 'Missing slug' } } }
      ] } });
    }
    if (args[0].includes('/character/eu/')) {
      return response({ profile: { name: 'Example', guild: { name: 'Test Guild' } }, equipment: { equipped_items: [] } });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=tbc-anniversary&region=eu&realm=whitemane&name=Example');
  const { unmount } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Guild' }));
  const roster = await screen.findByRole('region', { name: 'Guild roster' });
  const link = within(roster).getByRole('link', { name: 'Arden' });
  expect(link.getAttribute('href')).toBe('/?version=tbc-anniversary&region=eu&name=Arden&realm=other-realm');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(within(roster).queryByRole('link', { name: 'Unknown' })).toBeNull();
  const target = link.getAttribute('href');
  unmount();
  window.history.replaceState({}, '', target);
  render(<App />);
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) =>
    url.includes('/character/eu/other-realm/Arden?version=tbc-anniversary')
  )).toBe(true));
});

it('shows a warning and keeps race IDs when race lookup fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character-guild/')) {
      return response({
        guild: { name: 'Test Guild' },
        roster: { members: [{ character: { name: 'Example', playable_race: { id: 96 } } }] },
        warning: 'Some race names could not be loaded.'
      });
    }
    if (args[0].includes('/forever/character/')) {
      return response({ profile: { name: 'Zarlyn', surname: 'Forever', guild: { name: 'Test Guild' } }, equipment: { equipped_items: [] } });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Guild' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Some race names could not be loaded.');
  expect(screen.getByText('Race #96')).toBeTruthy();
});

it('sorts each guild column in both directions and keeps missing values last', async () => {
  const originalFetch = global.fetch;
  const members = [
    { rank: 0, character: { name: 'Zoe', level: 4, playable_class: { name: 'Warrior' }, playable_race: { name: 'Orc' }, faction: { type: 'HORDE' } } },
    { rank: 5, character: { name: 'Ana', level: 60, playable_class: { name: 'Mage' }, playable_race: { name: 'Human' }, faction: { type: 'ALLIANCE' } } },
    { rank: 1, character: { name: 'Bob', level: 12, playable_class: { name: 'Druid' }, playable_race: { name: 'Undead' }, faction: { type: 'HORDE' } } },
    { character: { name: 'Missing' } }
  ];
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/character-guild/')) return response({ guild: { name: 'Test Guild' }, roster: { members } });
    if (args[0].includes('/forever/character/')) {
      return response({ profile: { name: 'Zarlyn', surname: 'Forever', guild: { name: 'Test Guild' } }, equipment: { equipped_items: [] } });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Guild' }));
  const roster = await screen.findByRole('region', { name: 'Guild roster' });
  const rowNames = () => within(roster).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);
  const rankHeader = within(roster).getByRole('columnheader', { name: 'Rank' });
  expect(rowNames()).toEqual(['Zoe', 'Bob', 'Ana', 'Missing']);
  const rows = within(roster).getAllByRole('row').slice(1);
  expect(within(rows[0]).getByText('Guild Master')).toBeTruthy();
  expect(within(rows[1]).getByText('Officer')).toBeTruthy();
  expect(within(rows[2]).getByText('5')).toBeTruthy();
  expect(rankHeader.getAttribute('aria-sort')).toBe('ascending');
  expect(rankHeader.querySelector('.lucide-chevron-up')).toBeTruthy();
  fireEvent.click(within(rankHeader).getByRole('button', { name: 'Rank' }));
  expect(rowNames()).toEqual(['Ana', 'Bob', 'Zoe', 'Missing']);
  expect(rankHeader.getAttribute('aria-sort')).toBe('descending');
  const cases = [
    ['Level', ['Ana', 'Bob', 'Zoe', 'Missing'], ['Zoe', 'Bob', 'Ana', 'Missing'], 'descending'],
    ['Name', ['Ana', 'Bob', 'Missing', 'Zoe'], ['Zoe', 'Missing', 'Bob', 'Ana'], 'ascending'],
    ['Class', ['Bob', 'Ana', 'Zoe', 'Missing'], ['Zoe', 'Ana', 'Bob', 'Missing'], 'ascending'],
    ['Race', ['Ana', 'Zoe', 'Bob', 'Missing'], ['Bob', 'Zoe', 'Ana', 'Missing'], 'ascending'],
    ['Rank', ['Ana', 'Bob', 'Zoe', 'Missing'], ['Zoe', 'Bob', 'Ana', 'Missing'], 'descending']
  ];
  for (const [label, initial, reversed, direction] of cases) {
    const header = within(roster).getByRole('columnheader', { name: label });
    const button = within(header).getByRole('button', { name: label });
    fireEvent.click(button);
    expect(rowNames()).toEqual(initial);
    expect(header.getAttribute('aria-sort')).toBe(direction);
    expect(button.querySelector(direction === 'ascending' ? '.lucide-chevron-up' : '.lucide-chevron-down')).toBeTruthy();
    fireEvent.click(button);
    expect(rowNames()).toEqual(reversed);
    expect(header.getAttribute('aria-sort')).toBe(direction === 'ascending' ? 'descending' : 'ascending');
  }
  expect(members.map(member => member.character.name)).toEqual(['Zoe', 'Ana', 'Bob', 'Missing']);
});

it('shows PvP summary, rated brackets and battleground records', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/forever/character/')) {
      return response({
        profile: { name: 'Zarlyn', surname: 'Forever', level: 57 },
        equipment: { equipped_items: [] },
        pvp: {
          summary: {
            honorable_kills: 71, pvp_rank: 0,
            pvp_map_statistics: [{
              world_map: { id: 1, name: 'Warsong Gulch' },
              match_statistics: { played: 4, won: 3, lost: 1 }
            }]
          },
          brackets: [{
            slug: '2v2',
            data: {
              bracket: { type: '2v2' }, rating: 1500,
              season_match_statistics: { played: 10, won: 6, lost: 4 }
            }
          }],
          warning: 'Some PvP bracket data could not be loaded.'
        }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'PvP' }));
  const summary = within(screen.getByRole('region', { name: 'PvP summary' }));
  expect(summary.getByText('71')).toBeTruthy();
  expect(summary.getByText('0')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Rated brackets' })).getByText('1,500')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Battlegrounds' })).getByText('Warsong Gulch')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toBe('Some PvP bracket data could not be loaded.');
});

it('shows a PvP error when the API cannot provide a summary', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    if (args[0].includes('/forever/character/')) {
      return response({
        profile: { name: 'Zarlyn', surname: 'Forever', level: 57 },
        equipment: { equipped_items: [] },
        pvp: { summary: null, error: 'Unable to load PvP data. Please try again later.' }
      });
    }
    return originalFetch(...args);
  });
  window.history.replaceState({}, '', '/?version=wow-forever&region=eu&name=Zarlyn%20Forever');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'PvP' }));
  expect(screen.getByRole('status').textContent).toBe('Unable to load PvP data. Please try again later.');
});
