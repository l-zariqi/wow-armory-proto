/* eslint-disable react/jsx-no-target-blank */
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import CharacterModel from "./CharacterModel.js";

const WoWArmory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRealm, setSelectedRealm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [realmSearch, setRealmSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('classic-era');
  const [activeTab, setActiveTab] = useState('character');
  const [showCharacter, setShowCharacter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [characterData, setCharacterData] = useState(null);
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
    if (selectedVersion !== 'wow-forever' || searchQuery.trim().length < 2) {
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
        const response = await fetch(
          `${API_BASE}/forever/character-suggestions/${selectedRegion}?q=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load character suggestions');
        }
        const data = await response.json();
        setForeverCharacterSuggestions(data.suggestions || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
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
  }, [selectedVersion, selectedRegion, searchQuery]);

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
  };

  const loadCharacter = async (characterName, realm, version, realmLabel, region) => {
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
      setActiveTab('character');
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
      region
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (selectedVersion === 'wow-forever') {
      if (searchQuery.trim().split(/\s+/).length < 2) {
        setError('Please enter the character first name and surname');
        return;
      }
      await loadCharacter(searchQuery, '', selectedVersion, selectedRegion.toUpperCase(), selectedRegion);
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
    const itemLevel = item.level?.value || item.item?.level || 0;
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
              <div className="absolute bottom-0 right-0 bg-black bg-opacity-80 px-1 text-xs font-bold text-white rounded-tl">
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
            <div className="mb-4 p-3 rounded bg-red-900 bg-opacity-50 border border-red-600 text-red-200">
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
            <div
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setShowCharacterDropdown(false);
                }
              }}
            >
              <input
                type="text"
                placeholder={selectedVersion === 'wow-forever' ? 'First and Last Name' : 'Character Name'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowCharacterDropdown(true);
                }}
                onFocus={() => setShowCharacterDropdown(true)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-3 rounded border-2 bg-black bg-opacity-60 text-white placeholder-gray-500 focus:outline-none font-sans"
                style={{
                  borderColor: '#8B7355',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)'
                }}
              />
              {showCharacterDropdown && selectedVersion === 'wow-forever' && (
                <div
                  className="absolute z-20 w-full mt-1 rounded border-2 bg-black bg-opacity-95 max-h-72 overflow-y-auto"
                  style={{
                    borderColor: '#8B7355',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.9)'
                  }}
                  role="listbox"
                  aria-label="Character search suggestions"
                >
                  {foreverCharacterSuggestions.map(suggestion => (
                    <button
                      type="button"
                      key={`${suggestion.region}-${suggestion.name}-${suggestion.surname}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCharacterSelect(suggestion)}
                      className="w-full px-4 py-3 cursor-pointer hover:bg-blue-900 hover:bg-opacity-30 text-left text-white flex items-center gap-3 font-sans border-b border-gray-800 last:border-0"
                      role="option"
                      aria-selected={false}
                    >
                      {suggestion.portrait ? (
                        <img
                          src={suggestion.portrait}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-800 flex-shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className="block font-semibold truncate"
                          style={{ color: getClassColor(suggestion.detail) }}
                        >
                          {suggestion.label}
                        </span>
                        <span className="block text-xs text-gray-400">
                          {suggestion.detail} · {suggestion.region.toUpperCase()}
                        </span>
                      </span>
                    </button>
                  ))}
                  {suggestionsLoading && (
                    <div className="px-4 py-3 text-sm text-gray-400">Searching characters...</div>
                  )}
                  {!suggestionsLoading && !suggestionsError && searchQuery.trim().length >= 2
                    && foreverCharacterSuggestions.length === 0 && (
                      <div className="p-3 text-sm text-gray-300">
                        <p className="mb-2">
                          No suggestions available. The suggestion index may not include every character.
                        </p>
                        {searchQuery.trim().split(/\s+/).length >= 2 && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setShowCharacterDropdown(false);
                              handleSearch();
                            }}
                            className="rounded px-3 py-2 font-semibold"
                            style={{ backgroundColor: '#14566a', color: '#fff' }}
                          >
                            Search “{searchQuery.trim()}” directly
                          </button>
                        )}
                      </div>
                    )}
                  {suggestionsError && (
                    <div className="px-4 py-3 text-sm text-red-300">{suggestionsError}</div>
                  )}
                </div>
              )}
              {showCharacterDropdown && selectedVersion !== 'wow-forever'
                && filteredCharacterSuggestions.length > 0 && (
                <div
                  className="absolute z-10 w-full mt-1 rounded border-2 bg-black bg-opacity-95 max-h-60 overflow-y-auto"
                  style={{
                    borderColor: '#8B7355',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.9)'
                  }}
                >
                  {filteredCharacterSuggestions.map(suggestion => (
                    <button
                      type="button"
                      key={`${suggestion.version}-${suggestion.region || suggestion.selectedRealm}-${suggestion.name}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCharacterSelect(suggestion)}
                      className="w-full px-4 py-2 cursor-pointer hover:bg-gray-800 text-left text-white flex justify-between items-center font-sans"
                    >
                      <span>{suggestion.name}</span>
                      <span className="text-xs text-gray-400">{suggestion.realmLabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedVersion === 'wow-forever' ? (
              <select
                aria-label="Region"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-3 rounded border-2 bg-black bg-opacity-60 text-white focus:outline-none font-sans"
                style={{
                  borderColor: '#8B7355',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)'
                }}
              >
                <option value="us">United States</option>
                <option value="eu">Europe</option>
                <option value="kr">Korea</option>
                <option value="tw">Taiwan</option>
              </select>
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
  const isAlliance = factionName.toLowerCase() === 'alliance';
  const factionIcon = isAlliance ? '/assets/icons/alliance.png' : '/assets/icons/horde.png';
  const factionColor = isAlliance ? '#4da6ff' : '#ff4d4d';

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
              <div className="relative min-w-[180px] flex-1">
                <input
                  type="search"
                  aria-label="Search another character"
                  placeholder={selectedVersion === 'wow-forever' ? 'First and Last Name' : 'Character name'}
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="w-full min-w-0 rounded border-2 bg-black bg-opacity-60 px-3 py-2 text-white placeholder-gray-500 focus:outline-none font-sans"
                  style={{ borderColor: '#8B7355' }}
                />
              </div>
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
            <div className="mb-4 rounded border border-red-700 bg-red-950 bg-opacity-60 px-3 py-2 text-sm text-red-200">
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
                  Level {profile.level} {profile.race?.name} {profile.character_class?.name}
                </p>
                {profile.guild && (
                  <p className="text-lg text-blue-400 font-sans">&lt;{profile.guild.name}&gt;</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={selectedVersion === 'wow-forever' ? 'https://forever.warcraftlogs.com/' : (() => {
                  const [region, selectedRealmSlug] = selectedRealm.split(':');
                  const logsHost = selectedVersion === 'tbc-anniversary'
                    ? 'fresh.warcraftlogs.com'
                    : 'vanilla.warcraftlogs.com';
                  const realmSlug = profile.realm?.slug || selectedRealmSlug;
                  return `https://${logsHost}/character/${region}/${realmSlug}/${profile.name}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Warcraft Logs"
                title="Open Warcraft Logs"
                className="text-orange-400 hover:text-orange-300 transition-colors p-2 rounded"
                style={{
                  background: 'linear-gradient(to bottom, #2d2d2d, #1a1a1a)',
                  border: '2px solid #3d3d3d',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
                }}
              >
                <img
                  src="/assets/icons/warcraft-logs.png"
                  alt=""
                  className="w-6 h-6 object-contain"
                />
              </a>
              <button
              onClick={() => {
                setShowCharacter(false);
                setCharacterData(null);
                const currentUrl = new URL(window.location.href);
                ['version', 'region', 'name', 'realm'].forEach(param => currentUrl.searchParams.delete(param));
                window.history.replaceState(window.history.state, '', currentUrl);
              }}
              className="text-red-500 hover:text-red-400 transition-colors p-2 rounded"
              style={{
                background: 'linear-gradient(to bottom, #2d2d2d, #1a1a1a)',
                border: '2px solid #3d3d3d',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
              }}
            >
              <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'talents' ? (
          <div className="p-8 font-sans" style={{ minHeight: '700px' }}>
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
                  const buildMaxPoints = selectedVersion === 'tbc-anniversary' ? 61 : 51;
                  const primaryTree = build.trees.reduce(
                    (primary, tree) => tree.spentPoints > (primary?.spentPoints || 0) ? tree : primary,
                    null
                  );
                  return (
                    <section
                      key={buildIndex}
                      className="rounded border-2 p-5"
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
                      <div className="grid gap-4 md:grid-cols-3">
                        {build.trees.map(tree => {
                          const maxColumn = 4;
                          const maxRow = Math.max(...tree.talents.map(talent => talent.row), 1);
                          const talentRanks = new Map(
                            tree.talents.map(treeTalent => [
                              treeTalent.talentId,
                              treeTalent.rank || 0
                            ])
                          );
                          return (
                            <div
                              key={tree.id}
                              className="relative z-0 min-w-0 rounded border border-gray-700 bg-center bg-no-repeat hover:z-30 focus-within:z-30"
                              style={{
                                backgroundColor: '#080808',
                                backgroundImage: tree.backgroundImage
                                  ? `linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.85)), url("${tree.backgroundImage.replace(/^http:\/\//, 'https://')}")`
                                  : 'linear-gradient(to bottom, rgba(20, 20, 20, 0.94), rgba(0, 0, 0, 0.98))',
                                backgroundSize: '100% 100%, auto 100%'
                              }}
                            >
                              <div className="flex items-center justify-between border-b border-gray-700 bg-black bg-opacity-80 px-3 py-2">
                                <h5 className="text-base font-semibold text-white">
                                  {tree.name}
                                </h5>
                                <span className="text-sm text-gray-300">
                                  {tree.spentPoints} / {tree.maxPoints || (selectedVersion === 'classic-era' ? 51 : 61)}
                                </span>
                              </div>
                              <div
                                className="relative mx-auto grid w-full"
                                style={{
                                  gridTemplateColumns: `repeat(${maxColumn}, minmax(0, 1fr))`,
                                  gridTemplateRows: `repeat(${maxRow}, 3.25rem)`,
                                  padding: '0.5rem 0.5rem'
                                }}
                              >
                                {tree.talents.map(talent => {
                                  const isMaxed = talent.rank > 0 && talent.rank >= talent.maxRank;
                                  const isAvailable = !isMaxed
                                    && totalPoints < buildMaxPoints
                                    && (talent.row - 1) * 5 <= tree.spentPoints
                                    && (talent.requirements || []).every(requirement =>
                                      (talentRanks.get(requirement.talentId) || 0) >= requirement.rank
                                    );
                                  const isActive = talent.rank > 0 || isAvailable;
                                  const borderColor = isMaxed
                                    ? '#ffd700'
                                    : isActive ? '#1eff00' : '#555';
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
                                    className="group relative z-10 h-10 w-10 self-center justify-self-center rounded border-2 bg-black p-0 focus:outline-none focus:ring-2 focus:ring-yellow-500 hover:z-50 focus:z-50"
                                    style={{
                                      gridColumn: talent.column,
                                      gridRow: talent.row,
                                      borderColor,
                                      boxShadow: `0 0 3px ${borderColor}`
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
                                        className="absolute -bottom-1 -right-1 min-w-5 rounded border border-black bg-black px-1 text-center text-xs font-bold leading-4"
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
        <div className="p-8" style={{ minHeight: '700px' }}>
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
                <CharacterModel
                  media={characterData.media}
                />
              </div>
              <div className="w-full rounded border-2 p-4 font-sans space-y-2 mb-4" style={{
                background: 'linear-gradient(to bottom, #0d0d0d, #000000)',
                borderColor: '#3d3d3d'
              }}>
                <div className="grid grid-cols-2 gap-4 px-3 text-sm">
                  <div className="text-left">
                    <div className="text-base text-gray-500">
                      Equipped iLvl: <span className="text-base text-gray-400">{profile.equipped_item_level || 0}</span>
                    </div>
                    <div className="mt-2 text-base text-gray-500">
                      {profile.ruleset ? 'Ruleset' : 'Realm'}: <span className="text-base text-gray-400">
                        {profile.ruleset?.name || profile.realm?.name || 'WoW Forever'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-base text-gray-500">
                      Gearscore: <span className="text-base text-gray-400">{profile.gearscore || profile.gear_score || 'N/A'}</span>
                    </div>
                    <div className="mt-2 text-base text-gray-500">
                      Faction: <span className="text-base" style={{ color: factionColor }}>{factionName}</span>
                    </div>
                  </div>
                </div>
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

        {/* Bottom Tabs */}
        <div className="border-t-2 px-8 py-4 flex gap-6 font-sans" style={{
          background: 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
          borderColor: '#3d3d3d'
        }}>
          <button
            onClick={() => setActiveTab('character')}
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
          <button className="px-6 py-3 rounded text-lg text-gray-400 hover:text-gray-300 transition-all">
            Stats
          </button>
          <button
            onClick={() => setActiveTab('talents')}
            className={`px-6 py-3 rounded text-lg transition-all ${activeTab === 'talents' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            style={activeTab === 'talents' ? {
              background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
              color: '#ffd700',
              border: '2px solid #8B7355'
            } : undefined}
          >
            Talents
          </button>
          <button className="px-6 py-3 rounded text-lg text-gray-400 hover:text-gray-300 transition-all">
            PvP
          </button>
        </div>
      </div>
    </div>
  );
};

export default WoWArmory;