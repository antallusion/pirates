// docs/26: the curve of experience — what an hour teaches a captain by the way she plays, the hours each stretch of the
// road takes, the ships a level costs, the share of quests. Before (the reckonings of f094f45a) and after (the live ones).
//   node tools/balance-xp.ts [--after] [--levels]
// (the model: tests/balance/xp.ts; the targets: tests/xpcurve.test.ts)

import { BANDS, CURRENT, LEGACY, LEVELS, STYLES, firstHour, hoursBetween, killsPerLevel, minutesAt, mixedHour, ownerFight, questShare, questShareRoad, shipOf, styleHour } from '../tests/balance/xp.ts';
import type { Rules } from '../tests/balance/xp.ts';
import { prizeXp, xpGap, xpThreat, xpUnit } from '../shared/src/data/xpcurve.ts';

const args = process.argv.slice(2);
const sets: Rules[] = args.includes('--after') ? [CURRENT] : [LEGACY, CURRENT];
const pad = (s: string | number, n: number): string => String(s).padStart(n);
const hm = (h: number): string => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

for (const R of sets) {
  console.log(`\n=== ${R.name.toUpperCase()} ===`);
  console.log('XP an hour by the way she plays (and its units of her own level\'s ship sunk):');
  console.log(`  L   ⚓ ${STYLES.map((s) => pad(s, 15)).join('')}`);
  for (const L of LEVELS) {
    const unit = R.sink(L, shipOf(L));
    console.log(`  ${pad(L, 2)}  ${pad(shipOf(L), 2)} ${STYLES.map((s) => {
      const h = styleHour(R, s, L);
      return pad(`${Math.round(h.xp)} (${(h.xp / unit).toFixed(0)})`, 15);
    }).join('')}`);
  }
  console.log('\nA level: XP, own-level ships sunk to it, minutes of mixed play (and of hunting alone), quests\' share:');
  for (const L of LEVELS) {
    const h = mixedHour(R, L);
    console.log(`  L${pad(L, 2)}: ${pad(R.xpForLevel(L), 7)} XP, ${pad(killsPerLevel(R, L).toFixed(1), 6)} ships, ${pad(minutesAt(R, L).toFixed(1), 6)} min mixed (${minutesAt(R, L, 'hunt').toFixed(1)} hunting), quests ${Math.round((h.quests / h.xp) * 100)}%`);
  }
  console.log('\nHours of mixed play (hunting alone):');
  for (const [a, b] of BANDS) console.log(`  ${pad(a, 2)}→${pad(b, 2)}: ${pad(hm(hoursBetween(R, a, b)), 8)} (${hm(hoursBetween(R, a, b, 'hunt'))})`);
  console.log(`\nQuests' share of the mixed road 1→60: ${Math.round(questShareRoad(R) * 100)}% (at L1 ${Math.round(questShare(R, 1) * 100)}%, L30 ${Math.round(questShare(R, 30) * 100)}%, L59 ${Math.round(questShare(R, 59) * 100)}%)`);
  console.log('\nThe owner\'s fight: a boarding with a bounty and three hunting quests on the board (and without them):');
  for (const [L, v] of [[4, 1], [4, 2], [10, 3], [30, 6], [59, 10]]) {
    const f = ownerFight(R, L, v);
    console.log(`  L${pad(L, 2)} ⚓${v}: prize ${Math.round(f.prize)} + battle ${Math.round(f.battle)} + bounty ${Math.round(f.bounty)} + quests ${Math.round(f.quests)} = ${Math.round(f.total)} XP of ${R.xpForLevel(L)}: a level every ${f.perLevel.toFixed(1)} fights (${(R.xpForLevel(L) / (f.prize + f.battle)).toFixed(1)} boardings alone)`);
  }
  const fh = firstHour(R);
  console.log(`A new captain's first hour: ${fh.onceXp} XP of firsts (the watch, goals, ports, a sea, a deed), level ${fh.level} at its end`);
}

console.log('\nThe colours of the prize now (a ship sunk; her own ⚓ is yellow):');
for (const [L, v] of [[4, 1], [4, 2], [5, 1], [7, 1], [8, 2], [10, 2], [20, 4], [22, 4], [24, 4], [26, 4], [26, 5], [45, 7], [59, 8], [3, 2], [12, 5]] as [number, number][]) {
  console.log(`  L${pad(L, 2)} vs ⚓${v}: ${pad(xpThreat(L, v), 7)} ×${xpGap(L, v).toFixed(2)} = ${pad(prizeXp(L, v, 'sunk'), 4)} XP (own-level ship ${xpUnit(L)}); before ${Math.round(LEGACY.sink(L, v))} of ${Math.round(LEGACY.sink(L, shipOf(L)))}`);
}
if (args.includes('--levels')) {
  console.log('\nEvery level (after): XP, ships, minutes mixed');
  for (let L = 1; L < 60; L++) console.log(`  ${pad(L, 2)} ${pad(CURRENT.xpForLevel(L), 7)} ${pad(killsPerLevel(CURRENT, L).toFixed(0), 4)} ${pad(minutesAt(CURRENT, L).toFixed(0), 5)}`);
}
