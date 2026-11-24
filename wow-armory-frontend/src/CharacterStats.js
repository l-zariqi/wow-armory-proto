import React from 'react';

const formatNumber = (value, decimals = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatPercent = value => {
  const formatted = formatNumber(value, 2);
  return formatted === 'N/A' ? formatted : `${formatted}%`;
};

const CharacterStats = ({ statistics }) => {
  if (!statistics) {
    return (
      <div className="rounded border border-gray-700 bg-black bg-opacity-40 p-6 text-gray-300">
        Character statistics are unavailable.
      </div>
    );
  }

  const damageMin = statistics.main_hand_damage_min;
  const damageMax = statistics.main_hand_damage_max;
  const damage = [damageMin, damageMax].every(value => typeof value === 'number' && Number.isFinite(value))
    ? `${formatNumber(damageMin)} - ${formatNumber(damageMax)}`
    : 'N/A';
  const sections = [
    {
      name: 'Base',
      rows: [
        ['Health', formatNumber(statistics.health)],
        [statistics.power_type?.name || 'Power', formatNumber(statistics.power)],
        ['Stamina', formatNumber(statistics.stamina?.effective)],
        ['Strength', formatNumber(statistics.strength?.effective)],
        ['Agility', formatNumber(statistics.agility?.effective)],
        ['Intellect', formatNumber(statistics.intellect?.effective)],
        ['Spirit', formatNumber(statistics.spirit?.effective)]
      ]
    },
    {
      name: 'Melee',
      rows: [
        ['Damage', damage],
        ['Speed', formatNumber(statistics.main_hand_speed, 2)],
        ['Attack Power', formatNumber(statistics.attack_power)],
        ['Crit Chance', formatPercent(statistics.melee_crit?.value)],
        ['Haste', formatPercent(statistics.melee_haste?.value)],
        ['Mastery', formatPercent(statistics.mastery?.value)]
      ]
    },
    {
      name: 'Spell',
      rows: [
        ['Bonus Healing', formatNumber(statistics.spell_healing)],
        ['Bonus Damage', formatNumber(statistics.spell_power)],
        ['Penetration', formatNumber(statistics.spell_penetration)],
        ['Mana Regen', formatNumber(statistics.mana_regen)],
        ['Combat Regen', formatNumber(statistics.mana_regen_combat)],
        ['Crit Chance', formatPercent(statistics.spell_crit?.value)],
        ['Haste', formatPercent(statistics.spell_haste?.value)]
      ]
    },
    {
      name: 'Defense',
      rows: [
        ['Armor', formatNumber(statistics.armor?.effective)],
        ['Dodge', formatPercent(statistics.dodge?.value)],
        ['Parry', formatPercent(statistics.parry?.value)],
        ['Block', formatPercent(statistics.block?.value)],
        ['Defense', formatNumber(statistics.defense?.effective)]
      ]
    }
  ];

  return (
    <>
      <p className="mb-6 text-sm text-gray-400">Unavailable statistics are shown as N/A.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map(section => (
          <section key={section.name} aria-label={section.name} className="rounded border-2 border-gray-700 bg-black bg-opacity-40 p-4">
            <h4 className="mb-3 border-b border-gray-700 pb-2 text-lg font-semibold text-yellow-300">
              {section.name}
            </h4>
            <dl className="space-y-2 text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="text-right text-gray-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
};

export default CharacterStats;
