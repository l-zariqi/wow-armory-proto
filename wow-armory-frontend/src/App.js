/* eslint-disable react/jsx-no-target-blank */
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import CharacterModel from "./CharacterModel.js";
import CharacterSearch from './CharacterSearch.js';
import CharacterStats from './CharacterStats.js';
import CharacterPvp from './CharacterPvp.js';
import CharacterGuild from './CharacterGuild.js';

const FOREVER_REGIONS = ['us', 'eu', 'kr', 'tw'];
const CHARACTER_TABS = ['character', 'stats', 'talents', 'pvp', 'guild'];
const TALENT_CELL_SIZE = 60;
const TALENT_ICON_SIZE = 44;
const TALENT_ARROW_WIDTH = 15;
const TALENT_ARROW = '/assets/icons/talent-arrow-down.png';
const TALENT_ARROW_ACTIVE = '/assets/icons/talent-arrow-down-active.png';

const TalentConnections = ({ talents }) => {
  const talentsById = new Map(talents.map(talent => [talent.talentId, talent]));
  const segments = [];
  const addSegment = (key, x1, y1, x2, y2, arrow, active) => {
    const horizontal = y1 === y2;
    const length = horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
    if (!length) return;
    const angle = horizontal ? (x2 > x1 ? -90 : 90) : (y2 > y1 ? 0 : 180);
    segments.push(
      <div
        key={key}
        className="talent-connection absolute"
        style={{
          left: (x1 + x2) / 2 - TALENT_ARROW_WIDTH / 2,
          top: (y1 + y2) / 2 - length / 2,
          width: TALENT_ARROW_WIDTH,
          height: length,
          transform: `rotate(${angle}deg)`,
          backgroundImage: `url("${active ? TALENT_ARROW_ACTIVE : TALENT_ARROW}")`,
          backgroundPosition: arrow ? 'center bottom' : 'center top',
          backgroundRepeat: 'no-repeat',
          backgroundSize: length > (active ? 257 : 264) ? '15px 100%' : 'auto'
        }}
      />
    );
  };

  talents.forEach(talent => {
    (talent.requirements || []).forEach((requirement, index) => {
      const source = talentsById.get(requirement.talentId);
      if (!source || source === talent) return;
      const active = source.rank > 0;
      const sourceX = (source.column - 0.5) * TALENT_CELL_SIZE;
      const sourceY = (source.row - 0.5) * TALENT_CELL_SIZE;
      const targetX = (talent.column - 0.5) * TALENT_CELL_SIZE;
      const targetY = (talent.row - 0.5) * TALENT_CELL_SIZE;
      const key = `${talent.id}-${index}`;
      if (sourceY === targetY) {
        const direction = Math.sign(targetX - sourceX);
        addSegment(key, sourceX + direction * TALENT_ICON_SIZE / 2, sourceY,
          targetX - direction * TALENT_ICON_SIZE / 2, targetY, true, active);
      } else {
        const direction = Math.sign(targetY - sourceY);
        const startY = sourceY + direction * TALENT_ICON_SIZE / 2;
        const endY = targetY - direction * TALENT_ICON_SIZE / 2;
        if (sourceX === targetX) {
          addSegment(key, sourceX, startY, targetX, endY, true, active);
        } else {
          const bendY = startY + direction * (TALENT_CELL_SIZE - TALENT_ICON_SIZE) / 2;
          addSegment(`${key}-start`, sourceX, startY, sourceX, bendY, false, active);
          addSegment(`${key}-bend`, sourceX, bendY, targetX, bendY, false, active);
          addSegment(`${key}-end`, targetX, bendY, targetX, endY, true, active);
        }
      }
    });
  });

  return <div aria-hidden="true" className="pointer-events-none absolute inset-0">{segments}</div>;
};

const RegionSelect = ({ value, onChange, compact = false }) => (
  <select
    aria-label="Region"
    value={value}
    onChange={event => onChange(event.target.value)}
    className={`${compact ? 'px-3 py-2' : 'w-full px-4 py-3'} rounded border-2 bg-black bg-opacity-60 text-white focus:outline-none font-sans`}
    style={{ borderColor: '#8B7355', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)' }}
  >
    <option value="all">All regions</option>
    <option value="us">United States</option>
    <option value="eu">Europe</option>
    <option value="kr">Korea</option>
    <option value="tw">Taiwan</option>
  </select>
);

const WoWArmory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRealm, setSelectedRealm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [searchRegion, setSearchRegion] = useState('all');
  const [realmSearch, setRealmSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('classic-era');
  const [activeTab, setActiveTab] = useState('character');
  const [showCharacter, setShowCharacter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [characterLocation, setCharacterLocation] = useState(null);
  const [realms, setRealms] = useState([]);
  const [showRealmDropdown, setShowRealmDropdown] = useState(false);
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [foreverCharacterSuggestions, setForeverCharacterSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [showCharacterDropdown, setShowCharacterDropdown] = useState(false);

  const API_BASE = 'http://localhost:3001/api';

  useEffect(() => {
    window.whTooltips = {
      colorLinks: true,
      iconizeLinks: false,
      renameLinks: false
    };

    if (!document.querySelector('script[data-wowhead-tooltips]')) {
      const script = document.createElement('script');
      script.src = 'https://wow.zamimg.com/js/tooltips.js';
      script.async = true;
      script.dataset.wowheadTooltips = 'true';
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (window.WH?.Tooltips?.refreshLinks) {
      window.WH.Tooltips.refreshLinks();
    }
  }, [characterData, selectedVersion]);

  // Fetch realms on mount and when version changes
  useEffect(() => {
    fetchRealms();
  }, [selectedVersion]);

  useEffect(() => {
    if (selectedVersion !== 'wow-forever' || !showCharacterDropdown || searchQuery.trim().length < 2) {
      setForeverCharacterSuggestions([]);
      setSuggestionsError('');
      setSuggestionsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setForeverCharacterSuggestions([]);
    setSuggestionsLoading(true);
    setSuggestionsError('');
    const timeoutId = window.setTimeout(async () => {
      try {
        const regions = searchRegion === 'all' ? FOREVER_REGIONS : [searchRegion];
        const results = await Promise.all(regions.map(async region => {
          const response = await fetch(
            `${API_BASE}/forever/character-suggestions/${region}?q=${encodeURIComponent(searchQuery.trim())}`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load character suggestions');
          }
          const data = await response.json();
          return (data.suggestions || []).map(suggestion => ({ ...suggestion, region }));
        }));
        if (!controller.signal.aborted) {
          setForeverCharacterSuggestions(results.flat());
        }
      } catch (err) {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          setForeverCharacterSuggestions([]);
          setSuggestionsError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedVersion, searchRegion, searchQuery, showCharacterDropdown]);

  useEffect(() => {
    try {
      const savedCharacters = window.localStorage.getItem('wow-armory-character-suggestions');
      if (savedCharacters) {
        const parsedCharacters = JSON.parse(savedCharacters);
        if (Array.isArray(parsedCharacters)) {
          setCharacterSuggestions(parsedCharacters);
        }
      }
    } catch (err) {
      console.error('Failed to load character suggestions:', err);
    }
  }, []);

  const fetchRealms = async () => {
    if (selectedVersion === 'wow-forever') {
      setRealms([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/realms?version=${selectedVersion}`);
      if (!response.ok) {
        throw new Error('Failed to fetch realms');
      }

      const data = await response.json();
      setRealms((data.realms || []).sort((a, b) =>
        `${a.name} ${a.region}`.localeCompare(`${b.name} ${b.region}`)
      ));
    } catch (err) {
      console.error('Failed to fetch realms:', err);
    }
  };

  const normalizedRealmSearch = realmSearch.trim().toLowerCase();
  const filteredRealms = realms.filter(realm => {
    const searchableText = `${realm.name} ${realm.slug} ${realm.region}`.toLowerCase();
    return searchableText.includes(normalizedRealmSearch);
  });
  const normalizedCharacterSearch = searchQuery.trim().toLowerCase();
  const filteredCharacterSuggestions = characterSuggestions.filter(suggestion => {
    const matchesVersion = suggestion.version === selectedVersion;
    const suggestionRegion = suggestion.region || suggestion.selectedRealm?.split(':')[0];
    const matchesRealm = selectedVersion === 'wow-forever'
      ? suggestionRegion === selectedRegion
      : !selectedRealm || suggestion.selectedRealm === selectedRealm;
    const matchesName = suggestion.name.toLowerCase().includes(normalizedCharacterSearch);
    return matchesVersion && matchesRealm && matchesName;
  });

  const handleRealmSelect = (realm) => {
    setSelectedRealm(`${realm.region.toLowerCase()}:${realm.slug}`);
    setSelectedRegion(realm.region.toLowerCase());
    setRealmSearch(`${realm.name} (${realm.region.toUpperCase()})`);
    setShowRealmDropdown(false);
  };

  const getRegionLabel = (region) => {
    const regionCode = region.toUpperCase();
    const flag = regionCode === 'US' ? '🇺🇸' : regionCode === 'EU' ? '🇪🇺' : '';
    return `${flag} ${regionCode}`.trim();
  };

  const saveCharacterSuggestion = (character) => {
    const updatedSuggestions = [
      character,
      ...characterSuggestions.filter(savedCharacter =>
        !(savedCharacter.name.toLowerCase() === character.name.toLowerCase()
          && savedCharacter.selectedRealm === character.selectedRealm
          && savedCharacter.version === character.version
          && (character.version !== 'wow-forever' || savedCharacter.region === character.region))
      )
    ].slice(0, 10);

    setCharacterSuggestions(updatedSuggestions);
    try {
      window.localStorage.setItem(
        'wow-armory-character-suggestions',
        JSON.stringify(updatedSuggestions)
      );
    } catch (err) {
      console.error('Failed to save character suggestion:', err);
    }
  };

  const handleCharacterSelect = (suggestion) => {
    setSearchQuery(suggestion.label || suggestion.name);
    setSelectedRealm(suggestion.selectedRealm || '');
    setSelectedRegion(
      suggestion.region || suggestion.selectedRealm?.split(':')[0] || selectedRegion || 'us'
    );
    setRealmSearch(
      suggestion.realmLabel?.replace(/\((us|eu)\)/i, (_, region) => `(${getRegionLabel(region)})`) || ''
    );
    setShowCharacterDropdown(false);
    if (selectedVersion === 'wow-forever') {
      const region = suggestion.region || selectedRegion;
      loadCharacter(suggestion.label || suggestion.name, '', selectedVersion, region.toUpperCase(), region);
    }
  };

  const changeTab = tab => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'character') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(window.history.state, '', url);
  };

  const loadCharacter = async (characterName, realm, version, realmLabel, region, tab = 'character') => {
    setLoading(true);
    setError(null);

    try {
      const requestRegion = version === 'wow-forever' ? region : realm.split(':')[0];
      const requestUrl = version === 'wow-forever'
        ? `${API_BASE}/forever/character/${requestRegion}?name=${encodeURIComponent(characterName.trim())}`
        : `${API_BASE}/character/${requestRegion}/${realm.split(':')[1]}/${encodeURIComponent(characterName.trim())}?version=${version}`;
      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Character not found');
      }

      const data = await response.json();
      console.log('Character data:', data);
      setCharacterData(data);
      setCharacterLocation({ region: requestRegion, version, realm: realm.split(':')[1] });
      setActiveTab(tab);
      setShowCharacter(true);
      setSearchQuery(characterName);
      setSelectedRealm(realm || '');
      setSelectedRegion(requestRegion);
      setSelectedVersion(version);
      setRealmSearch(realmLabel || '');
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('version', version);
      currentUrl.searchParams.set('region', requestRegion);
      currentUrl.searchParams.set('name', characterName.trim());
      if (tab === 'character') currentUrl.searchParams.delete('tab');
      else currentUrl.searchParams.set('tab', tab);
      if (realm) {
        currentUrl.searchParams.set('realm', realm.split(':')[1]);
      } else {
        currentUrl.searchParams.delete('realm');
      }
      window.history.replaceState(window.history.state, '', currentUrl);
      saveCharacterSuggestion({
        name: characterName.trim(),
        selectedRealm: realm || '',
        realmLabel: realmLabel || requestRegion.toUpperCase(),
        version,
        region: requestRegion
      });
      setShowCharacterDropdown(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Restore a URL-selected character once, on initial page load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const version = params.get('version');
    const name = params.get('name');
    const region = params.get('region');
    const realmSlug = params.get('realm');
    const tab = CHARACTER_TABS.includes(params.get('tab')) ? params.get('tab') : 'character';
    const supportedVersions = ['classic-era', 'tbc-anniversary', 'wow-forever'];

    if (!name || !region || !supportedVersions.includes(version)) {
      return;
    }

    if (version !== 'wow-forever' && !realmSlug) {
      return;
    }

    const realm = version === 'wow-forever' ? '' : `${region}:${realmSlug}`;
    setSelectedVersion(version);
    setSelectedRegion(region);
    loadCharacter(
      name,
      realm,
      version,
      realmSlug || region.toUpperCase(),
      region,
      tab
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (selectedVersion === 'wow-forever') {
      if (searchQuery.trim().split(/\s+/).length < 2) {
        setError('Please enter the character first name and surname');
        return;
      }
      if (searchRegion === 'all') {
        setError('Select a character suggestion or choose a region to search directly');
        return;
      }
      await loadCharacter(searchQuery, '', selectedVersion, searchRegion.toUpperCase(), searchRegion);
      return;
    }

    if (!searchQuery || !selectedRealm) {
      setError('Please enter a character name and select a realm');
      return;
    }

    await loadCharacter(searchQuery, selectedRealm, selectedVersion, realmSearch, selectedRegion);
  };

  const getQualityColor = (quality) => {
    const qualityMap = {
      'POOR': '#9d9d9d',
      'COMMON': '#ffffff',
      'UNCOMMON': '#1eff00',
      'RARE': '#0070dd',
      'EPIC': '#a335ee',
      'LEGENDARY': '#ff8000'
    };
    return qualityMap[quality] || '#ffffff';
  };

  const getClassColor = (className) => {
    const colors = {
      'Warrior': '#C79C6E',
      'Paladin': '#F58CBA',
      'Hunter': '#ABD473',
      'Rogue': '#FFF569',
      'Priest': '#FFFFFF',
      'Shaman': '#0070DE',
      'Mage': '#69CCF0',
      'Warlock': '#9482C9',
      'Druid': '#FF7D0A'
    };
    return colors[className] || '#FFFFFF';
  };

  const getClassIcon = (className) => {
    const classIcons = {
      'Warrior': 'classicon_warrior',
      'Paladin': 'classicon_paladin',
      'Hunter': 'classicon_hunter',
      'Rogue': 'classicon_rogue',
      'Priest': 'classicon_priest',
      'Shaman': 'classicon_shaman',
      'Mage': 'classicon_mage',
      'Warlock': 'classicon_warlock',
      'Druid': 'classicon_druid'
    };
    return classIcons[className] || 'inv_misc_questionmark';
  };

  const getEquipmentBySlot = (slot) => {
    if (!characterData?.equipment?.equipped_items) return null;
    return characterData.equipment.equipped_items.find(item => item.slot.type === slot);
  };

  const GearSlot = ({ slot, showName = false, alignRight = false }) => {
    const item = getEquipmentBySlot(slot);

    if (!item) {
      return (
        <div className={`flex items-center gap-4 ${alignRight ? 'flex-row-reverse' : ''}`}>
          <div className="relative w-16 h-16 rounded border-2 border-gray-700 bg-black bg-opacity-60"></div>
          {showName && <div className={`text-base text-gray-500 ${alignRight ? 'text-right' : ''} font-sans`}>Empty</div>}
        </div>
      );
    }

    const itemId = item.item?.id;
    const iconUrl = item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
    const enchant = item.enchantments?.[0];
    const itemLevel = item.level?.value ?? (typeof item.level !== 'object' ? item.level : undefined)
      ?? item.item?.level?.value ?? item.item?.level ?? 0;
    const enchantText = enchant?.display_string?.replace(/^(Enchant(ed)?:?\s*|Enchant\s+\w+\s+-\s*)/i, '') || '';
    const wowheadDomain = selectedVersion === 'wow-forever'
      ? 'forever'
      : selectedVersion === 'tbc-anniversary' ? 'tbc' : 'classic';
    
    // Determine the CSS class for the quality color
    const qualityClass = `q${item.quality?.type === 'EPIC' ? '4' : item.quality?.type === 'RARE' ? '3' : item.quality?.type === 'UNCOMMON' ? '2' : item.quality?.type === 'LEGENDARY' ? '5' : '1'}`;

    return (
      <div className={`flex items-center gap-4 ${alignRight ? 'flex-row-reverse' : ''}`}>
        <div className="relative">
          <a
            href={`https://www.wowhead.com/${wowheadDomain}/item=${itemId}`}
            data-wowhead={`item=${itemId}&domain=${wowheadDomain}`}
            className={`${qualityClass} relative w-16 h-16 rounded border-2 bg-black bg-opacity-60 cursor-pointer block overflow-hidden flex-shrink-0`}
            style={{ borderColor: getQualityColor(item.quality?.type) }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              role="img"
              aria-label={item.name}
              className="absolute inset-0 bg-center bg-no-repeat"
              style={{
                backgroundImage: `url("${iconUrl}")`,
                backgroundColor: '#111',
                backgroundSize: 'cover'
              }}
            />
            {itemLevel > 0 && (
              <div className="absolute bottom-0 right-0 bg-black bg-opacity-80 px-1 text-xs font-bold text-white rounded-tl" style={{ fontFamily: 'Arial, sans-serif' }}>
                {itemLevel}
              </div>
            )}
          </a>
        </div>
        
        {showName && (
          <div className={`min-w-0 flex-1 flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
            <span
              className={`text-base font-sans break-words ${alignRight ? 'text-right' : ''}`}
              style={{ color: getQualityColor(item.quality?.type) }}
            >
              {item.name}
            </span>
            {enchantText && (
              <span
                className={`text-sm ${alignRight ? 'text-right' : ''} font-sans`}
                style={{ color: '#1eff00' }}
              >
                {enchantText}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!showCharacter) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center" style={{
        backgroundImage: 'url(/assets/textures/UI-Background-Rock.PNG)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat'
      }}>
        <div className="max-w-2xl w-full rounded-lg p-8" style={{
          background: 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
          border: '3px solid #3d3d3d',
          boxShadow: '0 0 40px rgba(0,0,0,0.9), inset 0 2px 10px rgba(255,255,255,0.1)'
        }}>
          <div className="text-center mb-8">
          {selectedVersion === 'wow-forever' ? (
            <div className="flex flex-col items-center">
              <img
                src="/assets/logos/camelot-logo-gamepage.png"
                alt="WoW Forever"
                className="h-40 mb-2"
                style={{
                  filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                }}
              />
            </div>
          ) : selectedVersion === 'tbc-anniversary' ? (
              <div className="flex flex-col items-center">
                <img 
                  src="/assets/logos/WOW_BCC_Anniversary_Logo.png" 
                  alt="WoW Burning Crusade Classic Anniversary Edition"
                  className="h-40 mb-2"
                  style={{
                    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <img 
                  src="/assets/logos/WOW_Classic_Logo.png" 
                  alt="WoW Classic Era"
                  className="h-40 mb-2"
                  style={{
                    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                  }}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-900 bg-opacity-50 border border-red-600 text-red-200" style={{ fontFamily: 'Arial, sans-serif' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedVersion('classic-era');
                  setSearchQuery('');
                  setSelectedRealm('');
                  setRealmSearch('');
                }}
                className="flex-1 px-4 py-2 rounded font-semibold transition-all font-sans"
                style={{
                  background: selectedVersion === 'classic-era' ? 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)' : 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
                  border: `2px solid ${selectedVersion === 'classic-era' ? '#ffd700' : '#8B7355'}`,
                  color: selectedVersion === 'classic-era' ? '#ffd700' : '#999'
                }}
              >
                Classic Era
              </button>
              <button
                onClick={() => {
                  setSelectedVersion('wow-forever');
                  setSearchQuery('');
                  setSelectedRealm('');
                  setRealmSearch('');
                }}
                className="flex-1 px-4 py-2 rounded font-semibold transition-all font-sans"
                style={{
                  background: selectedVersion === 'wow-forever' ? 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)' : 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
                  border: `2px solid ${selectedVersion === 'wow-forever' ? '#2bbae2' : '#8B7355'}`,
                  color: selectedVersion === 'wow-forever' ? '#2bbae2' : '#999'
                }}
              >
                WoW Forever
              </button>
              <button
                onClick={() => {
                  setSelectedVersion('tbc-anniversary');
                  setSearchQuery('');
                  setSelectedRealm('');
                  setRealmSearch('');
                }}
                className="flex-1 px-4 py-2 rounded font-semibold transition-all font-sans"
                style={{
                  background: selectedVersion === 'tbc-anniversary' ? 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)' : 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
                  border: `2px solid ${selectedVersion === 'tbc-anniversary' ? '#b8d904' : '#8B7355'}`,
                  color: selectedVersion === 'tbc-anniversary' ? 'rgba(184, 217, 4)' : '#999'
                }}
              >
                Anniversary (TBC)
              </button>
            </div>
            <CharacterSearch
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              onSelect={handleCharacterSelect}
              suggestions={selectedVersion === 'wow-forever' ? foreverCharacterSuggestions : filteredCharacterSuggestions}
              isForever={selectedVersion === 'wow-forever'}
              loading={suggestionsLoading}
              error={suggestionsError}
              open={showCharacterDropdown}
              onOpenChange={setShowCharacterDropdown}
              getClassColor={getClassColor}
            />
            {selectedVersion === 'wow-forever' ? (
              <RegionSelect value={searchRegion} onChange={setSearchRegion} />
            ) : (
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setShowRealmDropdown(false);
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="Search Realm (US & EU)"
                  value={realmSearch}
                  onChange={(e) => {
                    setRealmSearch(e.target.value);
                    setSelectedRealm('');
                    setShowRealmDropdown(true);
                  }}
                  onFocus={() => setShowRealmDropdown(true)}
                  className="w-full px-4 py-3 rounded border-2 bg-black bg-opacity-60 text-white placeholder-gray-500 focus:outline-none font-sans"
                  style={{
                    borderColor: '#8B7355',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)'
                  }}
                />
                {showRealmDropdown && filteredRealms.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded border-2 bg-black bg-opacity-95 max-h-60 overflow-y-auto"
                    style={{
                      borderColor: '#8B7355',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.9)'
                    }}
                  >
                    {filteredRealms.slice(0, 50).map(realm => (
                      <div
                        key={`${realm.region}-${realm.id}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleRealmSelect(realm)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-800 text-white flex justify-between items-center font-sans"
                      >
                        <span>{realm.name}</span>
                        <span className="text-xs text-gray-400">{getRegionLabel(realm.region)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full px-8 py-3 rounded font-bold border-2 transition-all flex items-center justify-center gap-2 font-sans"
              style={{
                background: loading ? '#1a1a1a' : 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)',
                borderColor: '#8B7355',
                color: loading ? '#666' : '#ffd700',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Searching...' : 'Search Character'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profile = characterData?.profile;

  if (!profile) return null;

  const factionName = profile.faction?.name || '';
  const factionType = (profile.faction?.type || factionName).toLowerCase();
  const isAlliance = factionType === 'alliance';
  const factionIcon = isAlliance ? '/assets/icons/alliance.png' : '/assets/icons/horde.png';
  const guildColor = factionType === 'alliance' ? '#4da6ff' : factionType === 'horde' ? '#ff4d4d' : '#ffffff';
  const ruleset = profile.ruleset?.name?.trim();
  const characterName = [profile.name, profile.surname].filter(Boolean).join(' ');
  const logsHost = characterLocation.version === 'wow-forever'
    ? 'forever.warcraftlogs.com'
    : characterLocation.version === 'tbc-anniversary' ? 'fresh.warcraftlogs.com' : 'vanilla.warcraftlogs.com';
  const logsRealm = characterLocation.version === 'wow-forever'
    ? ruleset?.toLowerCase()
    : profile.realm?.slug || characterLocation.realm;
  const logsCharacterName = characterLocation.version === 'wow-forever'
    ? characterName.toLowerCase()
    : profile.name;
  const logsUrl = logsRealm
    ? `https://${logsHost}/character/${encodeURIComponent(characterLocation.region.toLowerCase())}/${encodeURIComponent(logsRealm)}/${encodeURIComponent(logsCharacterName)}`
    : null;

  return (
    <div className="min-h-screen p-4 flex items-center justify-center" style={{
      backgroundImage: 'url(/assets/textures/UI-Background-Rock.PNG)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'repeat'
    }}>
      <div className="relative w-full max-w-7xl rounded-lg" style={{
        background: 'linear-gradient(to bottom, #1a1a1a 0%, #0d0d0d 100%)',
        border: '3px solid #3d3d3d',
        boxShadow: '0 0 50px rgba(0,0,0,0.9), inset 0 2px 10px rgba(255,255,255,0.1)'
      }}>
        {/* Header */}
        <div className="relative px-8 py-6 border-b-2" style={{
          background: 'linear-gradient(to bottom, #2d2d2d, #1a1a1a)',
          borderColor: '#3d3d3d'
        }}>
          <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-gray-700 pb-4">
            <div className="flex shrink-0 items-center gap-3">
              <img
                src={selectedVersion === 'wow-forever'
                  ? '/assets/logos/camelot-logo-gamepage.png'
                  : selectedVersion === 'tbc-anniversary'
                    ? '/assets/logos/WOW_BCC_Anniversary_Logo.png'
                    : '/assets/logos/WOW_Classic_Logo.png'}
                alt={selectedVersion === 'wow-forever'
                  ? 'WoW Forever'
                  : selectedVersion === 'tbc-anniversary'
                    ? 'WoW Burning Crusade Classic Anniversary'
                    : 'WoW Classic Era'}
                className="h-12 max-w-28 object-contain"
              />
            </div>
            <form
              className="flex min-w-0 flex-1 flex-wrap gap-2"
              onSubmit={event => {
                event.preventDefault();
                handleSearch();
              }}
            >
              <CharacterSearch
                compact
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                onSelect={handleCharacterSelect}
                suggestions={selectedVersion === 'wow-forever' ? foreverCharacterSuggestions : filteredCharacterSuggestions}
                isForever={selectedVersion === 'wow-forever'}
                loading={suggestionsLoading}
                error={suggestionsError}
                open={showCharacterDropdown}
                onOpenChange={setShowCharacterDropdown}
                getClassColor={getClassColor}
              />
              {selectedVersion === 'wow-forever' && (
                <RegionSelect compact value={searchRegion} onChange={setSearchRegion} />
              )}
              {selectedVersion !== 'wow-forever' && (
                <div
                  className="relative min-w-[180px] flex-1"
                  onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setShowRealmDropdown(false);
                    }
                  }}
                >
                  <input
                    type="search"
                    aria-label="Search realm"
                    placeholder="Search Realm (US & EU)"
                    value={realmSearch}
                    onChange={event => {
                      setRealmSearch(event.target.value);
                      setSelectedRealm('');
                      setShowRealmDropdown(true);
                    }}
                    onFocus={() => setShowRealmDropdown(true)}
                    className="w-full rounded border-2 bg-black bg-opacity-60 px-3 py-2 text-white placeholder-gray-500 focus:outline-none font-sans"
                    style={{ borderColor: '#8B7355' }}
                  />
                  {showRealmDropdown && filteredRealms.length > 0 && (
                    <div
                      className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded border-2 bg-black bg-opacity-95"
                      style={{
                        borderColor: '#8B7355',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.9)'
                      }}
                    >
                      {filteredRealms.slice(0, 50).map(realm => (
                        <button
                          type="button"
                          key={`${realm.region}-${realm.id}`}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => handleRealmSelect(realm)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-white hover:bg-gray-800 font-sans"
                        >
                          <span>{realm.name}</span>
                          <span className="text-xs text-gray-400">
                            {getRegionLabel(realm.region)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex shrink-0 items-center gap-2 rounded border-2 px-4 py-2 font-semibold text-yellow-300 disabled:opacity-60"
                style={{
                  borderColor: '#8B7355',
                  background: 'linear-gradient(to bottom, #3d3d3d, #222)',
                  color: '#ffd700',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                {loading && <Loader2 className="animate-spin" size={16} />}
                Search
              </button>
            </form>
          </div>
          {error && (
            <div className="mb-4 rounded border border-red-700 bg-red-950 bg-opacity-60 px-3 py-2 text-sm text-red-200" style={{ fontFamily: 'Arial, sans-serif' }}>
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div
                className="w-24 h-24 rounded-full border-4 bg-black bg-opacity-60 overflow-hidden flex items-center justify-center"
                style={{
                  borderColor: '#8B7355',
                  boxShadow: '0 0 20px rgba(139,115,85,0.5)'
                }}
              >
                <img
                  src={
                    characterData?.media?.assets?.find(a => a.key === 'avatar')?.value
                    || `https://wow.zamimg.com/images/wow/icons/large/${getClassIcon(profile.character_class?.name)}.jpg`
                  }
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = `https://wow.zamimg.com/images/wow/icons/large/${getClassIcon(profile.character_class?.name)}.jpg`;
                  }}
                />
              </div>
              <div>
                <h2 className="text-4xl font-bold flex items-center gap-2" style={{
                  color: getClassColor(profile.character_class?.name),
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}>
                  <span>{[profile.name, profile.surname].filter(Boolean).join(' ')}</span>
                  <img
                    src={factionIcon}
                    alt={`${factionName} faction`}
                    className="w-8 h-8 object-contain"
                  />
                </h2>
                <p className="text-lg font-sans" style={{ color: '#ffd700' }}>
                  {[
                    [`Level ${profile.level}`, profile.race?.name, profile.character_class?.name].filter(Boolean).join(' '),
                    characterLocation.region.toUpperCase(),
                    ruleset
                  ].filter(Boolean).join(' - ')}
                </p>
                {profile.guild && (
                  <button type="button" onClick={() => changeTab('guild')} className="text-lg font-sans hover:underline" style={{ color: guildColor }}>&lt;{profile.guild.name}&gt;</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {logsUrl ? <a
                href={logsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Warcraft Logs"
                title="Open Warcraft Logs"
                className="text-orange-400 hover:text-orange-300 transition-colors p-2 rounded border-2 border-[#3d3d3d] hover:border-white"
                style={{
                  background: 'linear-gradient(to bottom, #2d2d2d, #1a1a1a)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
                }}
              >
                <img
                  src="/assets/icons/warcraft-logs.png"
                  alt=""
                  className="w-6 h-6 object-contain"
                />
              </a> : (
                <button
                  type="button"
                  disabled
                  aria-label="Warcraft Logs link unavailable"
                  title="Warcraft Logs link unavailable: character ruleset or realm is missing"
                  className="p-2 rounded border-2 border-[#3d3d3d] opacity-50"
                >
                  <img src="/assets/icons/warcraft-logs.png" alt="" className="w-6 h-6 object-contain" />
                </button>
              )}
              <button
              onClick={() => {
                setShowCharacter(false);
                setCharacterData(null);
                const currentUrl = new URL(window.location.href);
                ['version', 'region', 'name', 'realm', 'tab'].forEach(param => currentUrl.searchParams.delete(param));
                window.history.replaceState(window.history.state, '', currentUrl);
              }}
              aria-label="Close character"
              className="text-red-500 hover:text-red-400 transition-colors p-2 rounded border-2 border-[#3d3d3d] hover:border-red-500"
              style={{
                background: 'linear-gradient(to bottom, #2d2d2d, #1a1a1a)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
              }}
            >
              <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div key={activeTab} role="region" aria-label={`${activeTab} details`} tabIndex={0} className="h-[860px] overflow-auto">
        {activeTab === 'guild' ? (
          <div className="p-3 sm:p-8 font-sans">
            <h3 className="mb-4 text-2xl font-bold text-white">Guild</h3>
            <CharacterGuild profile={profile} location={characterLocation} apiBase={API_BASE} getClassColor={getClassColor} />
          </div>
        ) : activeTab === 'pvp' ? (
          <div className="p-3 sm:p-8 font-sans">
            <h3 className="mb-4 text-2xl font-bold text-white">PvP</h3>
            <CharacterPvp pvp={characterData.pvp} />
          </div>
        ) : activeTab === 'stats' ? (
          <div className="p-3 sm:p-8 font-sans">
            <h3 className="mb-4 text-2xl font-bold text-white">Stats</h3>
            <CharacterStats statistics={characterData.statistics} />
          </div>
        ) : activeTab === 'talents' ? (
          <div className="p-3 sm:p-8 font-sans">
            <h3 className="text-2xl font-bold text-white mb-2">Talents</h3>
            <p className="text-sm text-gray-400 mb-6">
              Talent trees and ranks reported by Blizzard for this character.
            </p>
            {characterData.talentBuilds?.length ? (
              <div className="space-y-8">
                {characterData.talentBuilds.map((build, buildIndex) => {
                  const totalPoints = build.trees.reduce(
                    (total, tree) => total + tree.spentPoints,
                    0
                  );
                  const primaryTree = build.trees.reduce(
                    (primary, tree) => tree.spentPoints > (primary?.spentPoints || 0) ? tree : primary,
                    null
                  );
                  return (
                    <section
                      key={buildIndex}
                      className="rounded border-2 p-3 sm:p-5"
                      style={{
                        background: 'linear-gradient(to bottom, #171717, #0b0b0b)',
                        borderColor: build.isActive ? '#8B7355' : '#3d3d3d'
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-xl font-semibold text-white">
                            {primaryTree?.spentPoints > 0 ? primaryTree.name : `Build ${buildIndex + 1}`}
                          </h4>
                          {primaryTree?.spentPoints > 0 && (
                            <p className="text-sm text-gray-400">
                              Build {buildIndex + 1}{build.isActive ? ' · Active' : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">{totalPoints} points spent</span>
                      </div>
                      {build.trees.some(tree => tree.invalidPositions > 0) && (
                        <p role="status" className="mb-4 text-sm text-yellow-300">
                          Some talents have invalid positions in Blizzard&apos;s data and cannot be displayed.
                        </p>
                      )}
                      <div className="flex flex-wrap justify-center gap-4">
                        {build.trees.map(tree => {
                          const maxColumn = 4;
                          const maxRow = Math.max(...tree.talents.map(talent => talent.row), 1);
                          return (
                            <div
                              key={tree.id}
                              className="relative z-0 w-[280px] shrink-0 rounded border border-gray-700 bg-center bg-no-repeat hover:z-30 focus-within:z-30"
                              style={{
                                backgroundColor: '#080808',
                                backgroundImage: tree.backgroundImage
                                  ? `linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.85)), url("${tree.backgroundImage.replace(/^http:\/\//, 'https://')}")`
                                  : 'linear-gradient(to bottom, rgba(20, 20, 20, 0.94), rgba(0, 0, 0, 0.98))',
                                backgroundSize: '100% 100%, 100% 100%'
                              }}
                            >
                              <div className="flex items-center justify-between border-b border-gray-700 bg-black bg-opacity-80 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {tree.icon && (
                                    <img
                                      src={tree.icon.replace(/^http:\/\//, 'https://')}
                                      alt=""
                                      className="h-8 w-8 shrink-0 rounded-full border-2 object-cover"
                                      style={{ borderColor: getClassColor(profile.character_class?.name) }}
                                    />
                                  )}
                                  <h5 className="text-base font-semibold text-white">{tree.name}</h5>
                                </div>
                                <span className="text-sm text-gray-300">
                                  {tree.spentPoints} / {tree.maxPoints || (selectedVersion === 'classic-era' ? 51 : 61)}
                                </span>
                              </div>
                              <div
                                className="relative mx-auto grid my-5"
                                style={{
                                  width: maxColumn * TALENT_CELL_SIZE,
                                  gridTemplateColumns: `repeat(${maxColumn}, ${TALENT_CELL_SIZE}px)`,
                                  gridTemplateRows: `repeat(${maxRow}, ${TALENT_CELL_SIZE}px)`
                                }}
                              >
                                <TalentConnections talents={tree.talents} />
                                {tree.talents.map(talent => {
                                  const isMaxed = talent.rank > 0 && talent.rank >= talent.maxRank;
                                  const isActive = talent.rank > 0;
                                  const borderColor = isMaxed
                                    ? '#ffd700'
                                    : isActive ? '#1eff00' : '#374151';
                                  const displayedRank = talent.rank > 0 ? talent.rank : 1;
                                  const selectedRankDescription = talent.rankDescriptions.find(
                                    rankDescription => rankDescription.rank === displayedRank
                                  );
                                  const wowheadDomain = selectedVersion === 'wow-forever'
                                    ? 'forever'
                                    : selectedVersion === 'tbc-anniversary' ? 'tbc' : 'classic';
                                  const tooltipSpellId = selectedRankDescription?.spellId || talent.spellId;
                                  return (
                                  <a
                                    key={talent.id}
                                    href={tooltipSpellId
                                      ? `https://www.wowhead.com/${wowheadDomain}/spell=${tooltipSpellId}`
                                      : '#'}
                                    data-wowhead={tooltipSpellId
                                      ? `spell=${tooltipSpellId}&domain=${wowheadDomain}`
                                      : undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`${talent.name}, ${talent.rank} of ${talent.maxRank} ranks`}
                                    className="group relative z-10 h-11 w-11 self-center justify-self-center rounded border-2 bg-black p-0 focus:outline-none focus:ring-2 focus:ring-yellow-500 hover:z-50 focus:z-50"
                                    style={{
                                      gridColumn: talent.column,
                                      gridRow: talent.row,
                                      borderColor
                                    }}
                                  >
                                    {talent.icon && (
                                      <img
                                        src={talent.icon.replace(/^http:\/\//, 'https://')}
                                        alt=""
                                        className="h-full w-full rounded-sm object-cover"
                                        style={{
                                          filter: isActive ? 'none' : 'grayscale(1) brightness(0.65)'
                                        }}
                                      />
                                    )}
                                    {talent.rank > 0 && (
                                      <span
                                        className="absolute -bottom-2 -right-2 rounded-sm bg-black px-0.5 text-center font-sans text-[11px] leading-3"
                                        style={{ color: isMaxed ? '#ffd700' : '#1eff00', textShadow: '1px 1px 1px #000' }}
                                      >
                                        {talent.rank}/{talent.maxRank}
                                      </span>
                                    )}
                                  </a>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="rounded border border-gray-700 bg-black bg-opacity-40 p-6 text-gray-300">
                Talent data is not available for this character.
              </div>
            )}
          </div>
        ) : (
        <div className="p-8">
          <div className="grid grid-cols-3 gap-8 h-full">
            {/* Left Equipment Column */}
            <div className="space-y-5">
              <GearSlot slot="HEAD" showName={true} />
              <GearSlot slot="NECK" showName={true} />
              <GearSlot slot="SHOULDER" showName={true} />
              <GearSlot slot="BACK" showName={true} />
              <GearSlot slot="CHEST" showName={true} />
              <GearSlot slot="SHIRT" showName={true} />
              <GearSlot slot="TABARD" showName={true} />
              <GearSlot slot="WRIST" showName={true} />
            </div>

            {/* Center - Character Model & Stats */}
            <div className="flex flex-col items-center justify-between">
              <div className="w-96 h-[32rem] mb-6 flex items-center justify-center overflow-hidden">
                <CharacterModel media={characterData.media} />
              </div>
              <div className="w-full rounded border-2 p-4 font-sans space-y-2 mb-4" style={{
                background: 'linear-gradient(to bottom, #0d0d0d, #000000)',
                borderColor: '#3d3d3d'
              }}>
                <div className="grid grid-cols-2 gap-4 px-3 text-sm">
                  <div className="text-left">
                    <div className="text-base text-gray-500" style={{ fontFamily: 'Arial, sans-serif' }}>
                      Equipped iLvl: <span className="text-base text-gray-400">{profile.equipped_item_level || 0}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-base text-gray-500">
                      Gearscore: <span className="text-base text-gray-400">{profile.gearscore !== undefined ? profile.gearscore ?? 'N/A' : profile.gear_score ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {characterData.equipment?.warning && (
                  <p role="status" className="px-3 text-sm text-yellow-300">{characterData.equipment.warning}</p>
                )}
              </div>
            </div>

            {/* Right Equipment Column */}
            <div className="space-y-5">
              <GearSlot slot="HANDS" showName={true} alignRight={true} />
              <GearSlot slot="WAIST" showName={true} alignRight={true} />
              <GearSlot slot="LEGS" showName={true} alignRight={true} />
              <GearSlot slot="FEET" showName={true} alignRight={true} />
              <GearSlot slot="FINGER_1" showName={true} alignRight={true} />
              <GearSlot slot="FINGER_2" showName={true} alignRight={true} />
              <GearSlot slot="TRINKET_1" showName={true} alignRight={true} />
              <GearSlot slot="TRINKET_2" showName={true} alignRight={true} />
            </div>
          </div>

          {/* Bottom Weapon Slots */}
          <div className="mt-8 flex justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <GearSlot slot="MAIN_HAND" showName={true} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <GearSlot slot="OFF_HAND" showName={true} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <GearSlot slot="RANGED" showName={true} />
            </div>
          </div>
        </div>
        )}
        </div>

        {/* Bottom Tabs */}
        <div className="border-t-2 px-8 py-4 flex flex-wrap gap-6 font-sans" style={{
          background: 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
          borderColor: '#3d3d3d'
        }}>
          <button
            onClick={() => changeTab('character')}
            className="px-6 py-3 rounded font-semibold text-lg transition-all"
            style={{
              background: activeTab === 'character'
                ? 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)'
                : 'transparent',
              color: activeTab === 'character' ? '#ffd700' : '#999',
              border: `2px solid ${activeTab === 'character' ? '#8B7355' : 'transparent'}`
            }}
          >
            Character
          </button>
          <button
            onClick={() => changeTab('stats')}
            className={`px-6 py-3 rounded text-lg transition-all ${activeTab === 'stats' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            style={activeTab === 'stats' ? {
              background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
              color: '#ffd700',
              border: '2px solid #8B7355'
            } : { border: '2px solid transparent' }}
          >
            Stats
          </button>
          <button
            onClick={() => changeTab('talents')}
            className={`px-6 py-3 rounded text-lg transition-all ${activeTab === 'talents' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            style={activeTab === 'talents' ? {
              background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
              color: '#ffd700',
              border: '2px solid #8B7355'
            } : { border: '2px solid transparent' }}
          >
            Talents
          </button>
          <button
            onClick={() => changeTab('pvp')}
            className={`px-6 py-3 rounded text-lg transition-all ${activeTab === 'pvp' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            style={activeTab === 'pvp' ? {
              background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
              color: '#ffd700',
              border: '2px solid #8B7355'
            } : { border: '2px solid transparent' }}
          >
            PvP
          </button>
          <button
            onClick={() => changeTab('guild')}
            className={`px-6 py-3 rounded text-lg transition-all ${activeTab === 'guild' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            style={activeTab === 'guild' ? {
              background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
              color: '#ffd700',
              border: '2px solid #8B7355'
            } : { border: '2px solid transparent' }}
          >
            Guild
          </button>
        </div>
      </div>
    </div>
  );
};

export default WoWArmory;