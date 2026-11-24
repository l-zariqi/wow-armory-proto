import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const namedValue = (value, label) => value?.name || (value?.id != null ? `${label} #${value.id}` : 'N/A');
const memberName = character => [character.name, character.surname].filter(Boolean).join(' ');
const columns = [
  { key: 'name', label: 'Name', value: member => memberName(member.character || {}) || null },
  { key: 'level', label: 'Level', numeric: true, value: member => member.character?.level },
  { key: 'class', label: 'Class', value: member => {
    const character = member.character || {};
    return namedValue(character.playable_class || character.character_class, 'Class');
  } },
  { key: 'race', label: 'Race', value: member => {
    const character = member.character || {};
    return namedValue(character.playable_race || character.race, 'Race');
  } },
  { key: 'rank', label: 'Rank', numeric: true, value: member => member.rank }
];

const characterUrl = (character, location) => {
  const name = memberName(character).trim();
  if (!name || (location.version === 'wow-forever' && name.split(/\s+/).length < 2)) return null;
  const params = new URLSearchParams({ version: location.version, region: location.region, name });
  if (location.version !== 'wow-forever') {
    if (!character.realm?.slug) return null;
    params.set('realm', character.realm.slug);
  }
  return `${window.location.pathname}?${params}`;
};

const CharacterGuild = ({ profile, location, apiBase, getClassColor }) => {
  const [roster, setRoster] = useState(null);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(profile.guild));
  const [sort, setSort] = useState({ key: 'rank', direction: 'ascending' });
  const name = [profile.name, profile.surname].filter(Boolean).join(' ');

  useEffect(() => {
    if (!profile.guild) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ version: location.version, name });
    if (location.realm) params.set('realm', location.realm);

    const loadRoster = async () => {
      try {
        const response = await fetch(`${apiBase}/character-guild/${encodeURIComponent(location.region)}?${params}`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load the guild roster.');
        if (!data.guild || !Array.isArray(data.roster?.members)) {
          throw new Error('Guild roster is not available for this character.');
        }
        if (!controller.signal.aborted) {
          setRoster(data.roster);
          setWarning(data.warning || '');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadRoster();
    return () => controller.abort();
  }, [apiBase, location.region, location.realm, location.version, name, profile.guild]);

  if (!profile.guild) {
    return <p role="status" className="text-gray-300">This character is not in a guild.</p>;
  }
  if (loading) return <p role="status" className="text-gray-300">Loading guild roster...</p>;
  if (error) return <p role="alert" className="text-red-300">{error}</p>;

  const selectedColumn = columns.find(column => column.key === sort?.key);
  const members = [...roster.members];
  if (selectedColumn) {
    members.sort((a, b) => {
      const first = selectedColumn.value(a);
      const second = selectedColumn.value(b);
      const isMissing = value => value == null || value === '' || value === 'N/A'
        || (selectedColumn.numeric && (typeof value !== 'number' || !Number.isFinite(value)));
      const firstMissing = isMissing(first);
      const secondMissing = isMissing(second);
      if (firstMissing || secondMissing) return firstMissing === secondMissing ? 0 : firstMissing ? 1 : -1;
      const comparison = selectedColumn.numeric
        ? first - second
        : String(first).localeCompare(String(second), undefined, { sensitivity: 'base', numeric: true });
      return sort.direction === 'ascending' ? comparison : -comparison;
    });
  }

  return (
    <section aria-label="Guild roster" className="rounded border-2 border-gray-700 bg-black bg-opacity-40 p-4">
      <h4 className="mb-3 text-lg font-semibold text-yellow-300">
        {profile.guild.name} ({roster.members.length} members)
      </h4>
      {warning && <p role="alert" className="mb-3 text-sm text-red-300">{warning}</p>}
      {roster.members.length === 0 ? (
        <p className="text-gray-300">No guild members were returned.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-200">
            <thead className="border-b border-gray-700 text-gray-400">
              <tr>
                {columns.map(column => {
                  const direction = sort?.key === column.key ? sort.direction : undefined;
                  return (
                    <th key={column.key} scope="col" className="p-2" aria-sort={direction}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300"
                        onClick={() => setSort(current => ({
                          key: column.key,
                          direction: current?.key === column.key
                            ? current.direction === 'ascending' ? 'descending' : 'ascending'
                            : column.numeric ? 'descending' : 'ascending'
                        }))}
                      >
                        {column.label}
                        {direction === 'ascending' && <ChevronUp size={14} aria-hidden="true" />}
                        {direction === 'descending' && <ChevronDown size={14} aria-hidden="true" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => {
                const character = member.character || {};
                const className = character.playable_class?.name || character.character_class?.name;
                const classColor = className ? getClassColor(className) : undefined;
                const url = characterUrl(character, location);
                return (
                  <tr key={`${character.id ?? character.name ?? 'member'}-${index}`} className="border-b border-gray-800">
                    <td className="p-2" style={{ color: classColor }}>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: classColor }}>
                          {memberName(character)}
                        </a>
                      ) : (
                        <span title="Character profile link unavailable: missing name or realm">{memberName(character) || 'N/A'}</span>
                      )}
                    </td>
                    <td className="p-2">{character.level ?? 'N/A'}</td>
                    <td className="p-2" style={{ color: classColor }}>{namedValue(character.playable_class || character.character_class, 'Class')}</td>
                    <td className="p-2">{namedValue(character.playable_race || character.race, 'Race')}</td>
                    <td className="p-2">{member.rank === 0 ? 'Guild Master' : member.rank === 1 ? 'Officer' : member.rank ?? 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CharacterGuild;
