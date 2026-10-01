// docs/17 H5 item 17: the balance pass of the Heroes on the sea — how steep a boarding is in the head count, the
// town-fed crew against the sea's armies of her level, the guards' chests, recruits against income, artifacts and will.
// node tools/balance-h5.ts

import { UNITS, armyCost, armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { ART_WEIGHTS } from '../shared/src/data/artifacts.ts';
import { CHEST_ART, GUARD_ART, chestPay } from '../shared/src/data/advmap.ts';
import { WILL_DAY, WILL_PORT, manaMaxOf } from '../shared/src/data/hero.ts';
import { MIGHT_CAP, recruitPrice } from '../shared/src/data/town.ts';
import { MONTH, month, winRate } from '../tests/balance/recruit.ts';
import { seaHour } from '../tests/balance/island.ts';

function thin(a: ArmyStack[], share: number): ArmyStack[] {
  const out = a.map((x) => ({ ...x }));
  let left = Math.round(armyMen(a) * share);
  for (const s of out) {
    const k = Math.min(s.n - 1, Math.round(s.n * share), left);
    s.n -= k;
    left -= k;
  }
  return out;
}

const N = Number(process.argv[2] ?? 200);
console.log('Steepness: the first side wins against the second thinned by a share (100 men, pirates of a level):');
for (const L of [3, 5, 7]) {
  const a = armyForLevel(L, 100, 6, 'pirate');
  const row = [0, 0.05, 0.1, 0.2, 0.34].map((f) => `${Math.round(f * 100)}% fewer: ${Math.round(winRate(a, thin(a, f), N) * 100)}%`);
  console.log(`  ⚓${L}: ${row.join(' · ')}`);
}
// The picked men's might cap, level by level (the town-fed month under it, H3's without it), and the ladder's own
// crew against the sea's pirates of her level (docs/17, after H5: even at every level).
console.log("\nThe picked men's might cap (MIGHT_CAP) — a month of a castle's men against a pirate of her level; the ladder's own crew against her:");
const HAMMOCKS = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];
const lads: number[] = [], towns: number[] = [];
for (let L = 1; L <= 10; L++) {
  const M = HAMMOCKS[L];
  const pir = armyForLevel(L, M, 7, 'pirate'), lad = armyForLevel(L, M, 7, 'player');
  const ladder = winRate(lad, pir, N);
  lads.push(ladder);
  if (L === 1) {
    console.log(`  ⚓1 (${M}): ladder ${Math.round(ladder * 100)}%`);
    continue;
  }
  const capped = month({ ...MONTH, level: L, crewMax: M }), free = month({ ...MONTH, level: L, crewMax: M, cap: 0 });
  const town = winRate(capped.army, pir, N / 2);
  towns.push(town);
  console.log(`  ⚓${L} (${M}): cap ×${MIGHT_CAP[L]} · town-fed ${Math.round(town * 100)}% (uncapped ${Math.round(winRate(free.army, pir, N / 2) * 100)}%) · ladder ${Math.round(ladder * 100)}% · spent ${Math.round((capped.spent / capped.earned) * 100)}% of income (uncapped ${Math.round((free.spent / free.earned) * 100)}%)`);
}
const avg = (a: number[]) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100);
console.log(`  on average: town-fed ${avg(towns)}%, the ladder ${avg(lads)}% (${Math.round(Math.min(...lads) * 100)}–${Math.round(Math.max(...lads) * 100)}%)`);
console.log(`  the pirates of each level: ${[3, 5, 7, 10].map((L) => `⚓${L} ${armyForLevel(L, HAMMOCKS[L], 7, 'pirate').map((x) => `${x.n} ${x.u}`).join(', ')}`).join('; ')}`);

// Sanity: men against income, artifacts' worth, will.
console.log('\nSanity — men against the hour at sea:');
for (const L of [1, 3, 5, 7, 10]) {
  const lad = armyForLevel(L, HAMMOCKS[L], 7, 'player');
  console.log(`  ⚓${L}: a hour at sea ${seaHour(L)} · the ladder's crew (${HAMMOCKS[L]}) worth ${armyCost(lad)} = ${(armyCost(lad) / seaHour(L)).toFixed(2)} h · a quarter of it lost refilled in ${((armyCost(lad) * 0.25) / seaHour(L)).toFixed(2)} h · a deckhand ${UNITS.deckhand.cost}, a marine ${recruitPrice('marine', 1, true).silver} in port`);
}
const evArt = (src: keyof typeof ART_WEIGHTS) => {
  const w = ART_WEIGHTS[src];
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  return (Object.entries(w) as [keyof typeof w, number][]).reduce((a, [c, k]) => a + (k / tot) * ({ treasure: 1500, minor: 4000, major: 11000, relic: 30000 }[c]), 0);
};
console.log(`\nSanity — artifacts: a chest's artifact is worth ${Math.round(evArt('chest'))} on average (sold for a quarter: ${Math.round(evArt('chest') / 4)}); a map chest holds one ${CHEST_ART.open * 100}% of weeks (behind a guard ${CHEST_ART.guarded * 100}%), a guard's chest ${GUARD_ART.weak * 100}/${GUARD_ART.avg * 100}/${GUARD_ART.strong * 100}% (weak/avg/strong, once a week a captain)`);
for (const L of [1, 5, 10]) console.log(`  ⚓${L}: guarded chest ${chestPay(L, true).silver} silver vs its artifact's resale ${Math.round(evArt('chest') / 4)} (the artifact is taken instead of the silver)`);
console.log('  An artifact\'s primary +1 = ±5% on every stack in a boarding (cap ×0.3–×3); the 16 altars teach +4 of each primary over the world (a captain of level 30 has ~35 points from her levels).');
console.log('\nSanity — will:');
for (const w of [1, 2, 4, 8]) {
  const max = manaMaxOf(w);
  console.log(`  Will ${w}: store ${max} · a day at sea (48 min) +${Math.round(max * WILL_DAY)} · a port +${Math.round(max * WILL_PORT)} · cheapest battle order 3, a level-5 order 15–16: ${Math.floor(max / 3)} cheap or ${Math.floor(max / 16)} great orders a full store`);
}
