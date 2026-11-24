import React from 'react';

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const formatNumber = value => isNumber(value) ? value.toLocaleString('en-US') : 'N/A';

const PvpRows = ({ rows }) => (
  <dl className="space-y-2 text-sm">
    {rows.map(([label, value]) => (
      <div key={label} className="flex justify-between gap-4">
        <dt className="text-gray-400">{label}</dt>
        <dd className="text-right text-gray-200">{value}</dd>
      </div>
    ))}
  </dl>
);

const matchRows = statistics => [
  ['Played', formatNumber(statistics?.played)],
  ['Won', formatNumber(statistics?.won)],
  ['Lost', formatNumber(statistics?.lost)]
];

const CharacterPvp = ({ pvp }) => {
  if (!pvp?.summary) {
    return (
      <div role="status" className="rounded border border-gray-700 bg-black bg-opacity-40 p-6 text-gray-300">
        {pvp?.error || 'PvP data is not available for this character.'}
      </div>
    );
  }

  const { summary, brackets = [], warning } = pvp;
  const summaryRows = [
    ['Honorable Kills', summary.honorable_kills],
    ['PvP Rank', summary.pvp_rank],
    ['Honor Level', summary.honor_level]
  ].filter(([, value]) => isNumber(value))
    .map(([label, value]) => [label, formatNumber(value)]);
  const battlegrounds = Array.isArray(summary.pvp_map_statistics) ? summary.pvp_map_statistics : [];

  return (
    <div className="space-y-6">
      {warning && <p role="alert" className="text-sm text-red-300">{warning}</p>}
      {summaryRows.length > 0 && (
        <section aria-label="PvP summary" className="rounded border-2 border-gray-700 bg-black bg-opacity-40 p-4">
          <h4 className="mb-3 border-b border-gray-700 pb-2 text-lg font-semibold text-yellow-300">Summary</h4>
          <PvpRows rows={summaryRows} />
        </section>
      )}
      {brackets.length > 0 && (
        <section aria-label="Rated brackets">
          <h4 className="mb-3 text-lg font-semibold text-yellow-300">Rated Brackets</h4>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {brackets.map(({ slug, data }) => (
              <article key={slug} className="rounded border-2 border-gray-700 bg-black bg-opacity-40 p-4">
                <h5 className="mb-3 border-b border-gray-700 pb-2 font-semibold text-white">
                  {data.bracket?.name || data.bracket?.type || slug}
                </h5>
                <PvpRows rows={[
                  ...(isNumber(data.rating) ? [['Rating', formatNumber(data.rating)]] : []),
                  ...(isNumber(data.season?.id) ? [['Season', formatNumber(data.season.id)]] : []),
                  ...(data.tier?.name ? [['Tier', data.tier.name]] : []),
                  ...(data.specialization?.name ? [['Specialization', data.specialization.name]] : [])
                ]} />
                {data.season_match_statistics && (
                  <div className="mt-3">
                    <h6 className="mb-2 text-sm font-semibold text-gray-300">Season</h6>
                    <PvpRows rows={matchRows(data.season_match_statistics)} />
                  </div>
                )}
                {data.weekly_match_statistics && (
                  <div className="mt-3">
                    <h6 className="mb-2 text-sm font-semibold text-gray-300">This Week</h6>
                    <PvpRows rows={matchRows(data.weekly_match_statistics)} />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {battlegrounds.length > 0 && (
        <section aria-label="Battlegrounds">
          <h4 className="mb-3 text-lg font-semibold text-yellow-300">Battlegrounds</h4>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {battlegrounds.map((battleground, index) => (
              <article key={battleground.world_map?.id ?? index} className="rounded border-2 border-gray-700 bg-black bg-opacity-40 p-4">
                <h5 className="mb-3 border-b border-gray-700 pb-2 font-semibold text-white">
                  {battleground.world_map?.name || 'Unknown battleground'}
                </h5>
                <PvpRows rows={matchRows(battleground.match_statistics)} />
              </article>
            ))}
          </div>
        </section>
      )}
      {summaryRows.length === 0 && brackets.length === 0 && battlegrounds.length === 0 && (
        <p className="text-gray-300">No PvP statistics were returned for this character.</p>
      )}
    </div>
  );
};

export default CharacterPvp;
