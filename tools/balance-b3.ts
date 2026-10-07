// docs/24 B3: what the order of the cannon's dead does to the boarding that follows (tests/balance/b3.ts). A captain's
// crew and a pirate's of her level each take the same cannonade, their dead taken by the old rule (exposure), by count
// with the order changed only, and by the game's rule (the same hit points, the fewest hit points a man first); then the
// boarding (the hex battle's quick finish): the men left, the strength left, and the captain's chance.
//
//   node --disable-warning=ExperimentalWarning tools/balance-b3.ts [--hits 12] [--n 150]

import { armyForLevel, armyMen, armyPower } from '../shared/src/data/army.ts';
import { cannonade } from '../tests/balance/b3.ts';
import type { LossRule } from '../tests/balance/b3.ts';
import { winRate } from '../tests/balance/recruit.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const HITS = Number(arg('hits', '12'));
const N = Number(arg('n', '150'));
const MEN = 120;
const R = 5;

console.log(`B3: ${HITS} hits on ${MEN} men each side, then the boarding (${N} fights × ${R} cannonades)`);
console.log('⚓  | rule  | men left (cap / pir) | strength left (cap / pir) | captain wins');
for (const L of [2, 3, 5, 7, 9]) {
  for (const rule of ['old', 'count', 'hp'] as LossRule[]) {
    let mc = 0, mp = 0, pc = 0, pp = 0, w = 0;
    for (let r = 0; r < R; r++) {
      const c = cannonade(L, 'player', rule, 11 + r, HITS, MEN), p = cannonade(L, 'pirate', rule, 101 + r, HITS, MEN);
      mc += armyMen(c) / R;
      mp += armyMen(p) / R;
      pc += armyPower(c) / armyPower(armyForLevel(L, MEN, 7, 'player')) / R;
      pp += armyPower(p) / armyPower(armyForLevel(L, MEN, 7, 'pirate')) / R;
      w += winRate(c, p, N) / R;
    }
    console.log(`${String(L).padEnd(2)} | ${rule.padEnd(5)} | ${mc.toFixed(0).padStart(4)} / ${mp.toFixed(0).padStart(4)}          | ${(pc * 100).toFixed(0).padStart(3)}% / ${(pp * 100).toFixed(0).padStart(3)}%               | ${(w * 100).toFixed(0)}%`);
  }
  const fresh = winRate(armyForLevel(L, MEN, 7, 'player'), armyForLevel(L, MEN, 7, 'pirate'), N);
  console.log(`${String(L).padEnd(2)} | none  | ${MEN} / ${MEN} (no cannonade)                               | ${(fresh * 100).toFixed(0)}%`);
}
