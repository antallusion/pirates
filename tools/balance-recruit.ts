// The Heroes' economy balance report (docs/17 H3): node tools/balance-recruit.ts
// The dwellings' weeks against the hour at sea and the hammocks; a captain's month refilling her losses from her
// island's castle (tests/balance/recruit.ts).

import { MONTH, WEEKS_A_DAY, WEEK_HOURS, isleWeek, month, portWeek, winRate } from '../tests/balance/recruit.ts';
import { armyForLevel, armyCost, armyMen } from '../shared/src/data/army.ts';
import { PVE_JUNIOR, PVE_SENIOR } from '../shared/src/data/shiplevel.ts';
import { seaHour } from '../tests/balance/island.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';

console.log(`A week of the sea's calendar: ${WEEK_HOURS.toFixed(1)} real hours (${WEEKS_A_DAY.toFixed(2)} a real day).`);
for (const [name, keep, top, up] of [['island, keep, tiers 1–6', 1, 6, false], ['island, keep, tiers 1–7', 1, 7, false], ['island, castle, tiers 1–6', 3, 6, false], ['island, castle, 1–6 upgraded', 3, 6, true]] as const) {
  const w = isleWeek(keep, top, up);
  console.log(`${name.padEnd(30)} ${String(Math.round(w.men)).padStart(4)} men (${Math.round(w.high)} of tier 4+) worth ${String(Math.round(w.worth)).padStart(6)} a week · ${(w.worth / seaHour(6)).toFixed(2)} sea hours at ⚓6 · ${(w.worth / seaHour(9)).toFixed(2)} at ⚓9`);
}
const w = generateWorld(1);
for (const id of ['gravesend', 'cinderhold', 'saint_maw', 'hollowmere', 'black_coast_v0']) {
  const p = w.ports.find((x) => x.id === id)!;
  const r = portWeek(p);
  console.log(`port ${id.padEnd(16)} ${String(Math.round(r.men)).padStart(4)} men a week (besides the tavern) worth ${Math.round(r.worth)}`);
}
console.log('\nA month refilling a frigate (⚓7, 220 hammocks) from the island, half the income on men, a quarter of the men lost a day:');
for (const [name, plan] of [['castle, tiers 1–6', MONTH], ['keep, tiers 1–6', { ...MONTH, keep: 1 }], ['castle, a tenth lost a day', { ...MONTH, loss: 0.1 }], ['castle, a fifth of the income', { ...MONTH, share: 0.2 }], ['⚓4 brig (110), castle', { ...MONTH, level: 4, crewMax: 110 }], ['⚓10 ship of the line (600), castle', { ...MONTH, level: 10, crewMax: 600 }]] as const) {
  const r = month(plan);
  const L = plan.level, M = plan.crewMax;
  const same = winRate(r.army, armyForLevel(L, M, 7, 'pirate'));
  const up1 = L < 10 ? winRate(r.army, armyForLevel(L + 1, M, 7, 'pirate'), 40, PVE_JUNIOR[1], PVE_SENIOR[1]) : NaN;
  console.log(`${name.padEnd(36)} might ×${r.ratio[6].toFixed(2)} after a week, ×${r.ratio[r.ratio.length - 1].toFixed(2)} after a month (of the ladder's army) · ${armyMen(r.army)} men worth ${armyCost(r.army)} (ladder ${armyCost(armyForLevel(L, M, 7, 'player'))}) · tier 4+ ${Math.round(r.highShare * 100)}% · spent ${Math.round(r.spent / 1000)}k of ${Math.round(r.earned / 1000)}k (${Math.round((r.spent / r.earned) * 100)}%) · boards a pirate of ⚓${L}: ${Math.round(same * 100)}%, of ⚓${L + 1} under the ladder: ${Number.isNaN(up1) ? '—' : Math.round(up1 * 100) + '%'}`);
}
{
  const lad = armyForLevel(7, 220, 7, 'player');
  console.log(`\nReference: the ladder's own crew of ⚓7 (220, worth ${armyCost(lad)}) boards a pirate of ⚓7: ${Math.round(winRate(lad, armyForLevel(7, 220, 7, 'pirate')) * 100)}%, of ⚓8 under the ladder: ${Math.round(winRate(lad, armyForLevel(8, 220, 7, 'pirate'), 40, PVE_JUNIOR[1], PVE_SENIOR[1]) * 100)}%; boarding ⚓9 and up is barred by the ladder (canon D12).`);
}
