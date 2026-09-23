/* eslint-disable react/jsx-no-target-blank */
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import CharacterModel from "./CharacterModel.js";

const WoWArmory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRealm, setSelectedRealm] = useState('');
  const [realmSearch, setRealmSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('classic-era');
  const [showCharacter, setShowCharacter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [realms, setRealms] = useState([]);
  const [showRealmDropdown, setShowRealmDropdown] = useState(false);

  const API_BASE = 'http://localhost:3001/api';

  // Refresh Wowhead tooltips when character data changes
  useEffect(() => {
    if (characterData && window.$WowheadPower) {
      setTimeout(() => {
        window.$WowheadPower.refreshLinks();
      }, 100);
    }
  }, [characterData]);

  // Fetch realms on mount and when version changes
  useEffect(() => {
    fetchRealms();
  }, [selectedVersion]);

  const fetchRealms = async () => {
    try {
      const [usResponse, euResponse] = await Promise.all([
        fetch(`${API_BASE}/realms?region=us&version=${selectedVersion}`),
        fetch(`${API_BASE}/realms?region=eu&version=${selectedVersion}`)
      ]);

      const usData = await usResponse.json();
      const euData = await euResponse.json();

      const usRealms = (usData.realms || []).map(r => ({ ...r, region: 'US' }));
      const euRealms = (euData.realms || []).map(r => ({ ...r, region: 'EU' }));

      setRealms([...usRealms, ...euRealms].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to fetch realms:', err);
    }
  };

  const filteredRealms = realms.filter(realm =>
    realm.name.toLowerCase().includes(realmSearch.toLowerCase())
  );

  const handleRealmSelect = (realm) => {
    setSelectedRealm(`${realm.region.toLowerCase()}:${realm.slug}`);
    setRealmSearch(`${realm.name} (${realm.region})`);
    setShowRealmDropdown(false);
  };

  const handleSearch = async () => {
    if (!searchQuery || !selectedRealm) {
      setError('Please enter a character name and select a realm');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [region, realmSlug] = selectedRealm.split(':');
      const response = await fetch(
        `${API_BASE}/character/${region}/${realmSlug}/${searchQuery}?version=${selectedVersion}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Character not found');
      }

      const data = await response.json();
      console.log('Character data:', data);
      setCharacterData(data);
      setShowCharacter(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  const calculateAverageItemLevel = () => {
    if (!characterData?.equipment?.equipped_items) return 0;
    const items = characterData.equipment.equipped_items;
    if (items.length === 0) return 0;
    const total = items.reduce((sum, item) => sum + (item.level?.value || 0), 0);
    return Math.round(total / items.length);
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
    
    // Build Wowhead data attributes according to the official documentation
    let wowheadData = `item=${itemId}`;
    
    // Add domain for correct game version
    if (selectedVersion === 'tbc-anniversary') {
      wowheadData += '&domain=nether'; // TBC Classic domain
    } else {
      wowheadData += '&domain=classic'; // Classic Era domain
    }
    
    // Add gems if sockets exist (use 0 for empty sockets)
    const sockets = item.sockets || [];
    if (sockets.length > 0) {
      const gemIds = sockets.map(socket => socket.gem?.item?.id || 0).join(':');
      if (gemIds !== '0') { // Only add if there's at least one gem
        wowheadData += `&gems=${gemIds}`;
      }
    }
    
    // Add enchant if exists
    if (enchant?.enchantment_id) {
      wowheadData += `&ench=${enchant.enchantment_id}`;
    }
    
    // Add item set pieces if applicable
    if (item.set?.items && item.set.items.length > 0) {
      const setPieces = item.set.items.map(setItem => setItem.id).join(':');
      wowheadData += `&pcs=${setPieces}`;
    }

    // Determine the CSS class for the quality color
    const qualityClass = `q${item.quality?.type === 'EPIC' ? '4' : item.quality?.type === 'RARE' ? '3' : item.quality?.type === 'UNCOMMON' ? '2' : item.quality?.type === 'LEGENDARY' ? '5' : '1'}`;

    return (
      <div className={`flex items-center gap-4 ${alignRight ? 'flex-row-reverse' : ''}`}>
        <div className="relative">
          <a
            href={`https://www.wowhead.com/${selectedVersion === 'tbc-anniversary' ? 'tbc' : 'classic'}/item=${itemId}`}
            data-wowhead={wowheadData}
            className={`${qualityClass} relative w-16 h-16 rounded border-2 bg-black bg-opacity-60 cursor-pointer block overflow-hidden flex-shrink-0`}
            style={{ borderColor: getQualityColor(item.quality?.type) }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={iconUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
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
          <div className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
            <span
              className={`text-base font-sans ${alignRight ? 'text-right' : ''}`}
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
            {selectedVersion === 'tbc-anniversary' ? (
              <div className="flex flex-col items-center">
                <img 
                  src="/assets/logos/WOW_BCC_Anniversary_Logo.png" 
                  alt="WoW Burning Crusade Classic Anniversary Edition"
                  className="h-32 mb-2"
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
                  className="h-32 mb-2"
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
                  setSelectedRealm('');
                  setRealmSearch('');
                }}
                className="flex-1 px-4 py-2 rounded font-semibold transition-all font-sans"
                style={{
                  background: selectedVersion === 'classic-era' ? 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)' : 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
                  borderColor: '#8B7355',
                  border: '2px solid',
                  color: selectedVersion === 'classic-era' ? '#ffd700' : '#999'
                }}
              >
                Classic Era
              </button>
              <button
                onClick={() => {
                  setSelectedVersion('tbc-anniversary');
                  setSelectedRealm('');
                  setRealmSearch('');
                }}
                className="flex-1 px-4 py-2 rounded font-semibold transition-all font-sans"
                style={{
                  background: selectedVersion === 'tbc-anniversary' ? 'linear-gradient(to bottom, #4a4a4a, #2d2d2d)' : 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
                  borderColor: '#8B7355',
                  border: '2px solid',
                  color: selectedVersion === 'tbc-anniversary' ? 'rgba(184, 217, 4)' : '#999'
                }}
              >
                Anniversary (TBC)
              </button>
            </div>
            <input
              type="text"
              placeholder="Character Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-3 rounded border-2 bg-black bg-opacity-60 text-white placeholder-gray-500 focus:outline-none font-sans"
              style={{
                borderColor: '#8B7355',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)'
              }}
            />
            <div className="relative">
              <input
                type="text"
                placeholder="Search Realm (US & EU)"
                value={realmSearch}
                onChange={(e) => {
                  setRealmSearch(e.target.value);
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
                      onClick={() => handleRealmSelect(realm)}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-800 text-white flex justify-between items-center font-sans"
                    >
                      <span>{realm.name}</span>
                      <span className="text-xs text-gray-400">{realm.region}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <h2 className="text-4xl font-bold" style={{
                  color: getClassColor(profile.character_class?.name),
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}>
                  {profile.name}
                </h2>
                <p className="text-lg font-sans" style={{ color: '#ffd700' }}>
                  Level {profile.level} {profile.race?.name} {profile.character_class?.name}
                </p>
                {profile.guild && (
                  <p className="text-lg text-blue-400 font-sans">&lt;{profile.guild.name}&gt;</p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setShowCharacter(false);
                setCharacterData(null);
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

        {/* Main Content */}
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
              <div className="w-72 h-96 rounded border-2 mb-6 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden" style={{
                borderColor: '#3d3d3d',
                boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.8)'
              }}>
                <CharacterModel
                  region={profile.realm?.slug?.split('-')[0] || "us"}
                  realmSlug={profile.realm?.slug}
                  characterName={profile.name}
                />
              </div>
              <div className="w-full space-y-2 mb-4">
                <div className="flex justify-between items-center px-3 font-sans">
                  <span className="text-sm text-gray-500">Equipped iLvl</span>
                  <span className="text-base text-gray-400">{profile.equipped_item_level || 0}</span>
                  <span className="text-sm text-gray-500">Average iLvl</span>
                  <span className="text-base text-gray-400">{calculateAverageItemLevel()}</span>
                </div>
              </div>

              <div className="w-full rounded border-2 p-4 font-sans" style={{
                background: 'linear-gradient(to bottom, #0d0d0d, #000000)',
                borderColor: '#3d3d3d'
              }}>
                <div className="text-center text-gray-500 text-sm mb-2">
                  <span className="text-center text-gray-500">Realm: </span>
                  <span className="text-base text-gray-400">{profile.realm?.name}</span>
                </div>
                <div className="text-center text-gray-500 text-sm">
                  <span className="text-center text-gray-500">Faction: </span>
                  <span className="text-base text-gray-400">{profile.faction?.name}</span>
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

        {/* Bottom Tabs */}
        <div className="border-t-2 px-8 py-4 flex gap-6 font-sans" style={{
          background: 'linear-gradient(to bottom, #1a1a1a, #0d0d0d)',
          borderColor: '#3d3d3d'
        }}>
          <button className="px-6 py-3 rounded font-semibold text-lg transition-all" style={{
            background: 'linear-gradient(to bottom, #3d3d3d, #2d2d2d)',
            color: '#ffd700',
            border: '2px solid #8B7355'
          }}>
            Character
          </button>
          <button className="px-6 py-3 rounded text-lg text-gray-400 hover:text-gray-300 transition-all">
            Stats
          </button>
          <button className="px-6 py-3 rounded text-lg text-gray-400 hover:text-gray-300 transition-all">
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