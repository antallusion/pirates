// docs/19 E16 (balance): the Choir's waves against groups of captains of the waters' level, at sea.
//   node tools/balance-invasions.ts [fights a cell] [levels, e.g. 3,6,9]
// See tests/balance/invasions.ts.

import { INV_WAVE_SHIPS, INV_WAVES } from '../shared/src/data/invasions.ts';
import { duelSea } from '../tests/balance/duel.ts';
import { waveShare } from '../tests/balance/invasions.ts';

const N = Number(process.argv[2] ?? 12);
const LEVELS = (process.argv[3] ?? '3,6,9').split(',').map(Number);
const game = duelSea();
const pc = (x: number) => `${Math.round(x * 100)}%`;
console.log(`A wave of the Choir against captains of its level (${N} fights a cell; the last wave led by a flagship a level up):`);
for (const L of LEVELS) {
  const cells: string[] = [];
  for (let w = 1; w <= INV_WAVES; w++) {
    const ships = INV_WAVE_SHIPS[w - 1];
    for (const c of [1, 2, 3, 4, 5]) cells.push(`w${w}(${ships}) vs ${c}: ${pc(waveShare(game, L, c, ships, w === INV_WAVES, N, L * 100))}`);
  }
  console.log(`  ⚓${L}: ${cells.join(' · ')}`);
}
