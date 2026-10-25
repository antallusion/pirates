// Owner 2026-10-26: «мне на 3 уровне убил корабль 2 щас. бред. режь всем нпс прям на 50% хп». The measure behind it:
// a fresh level-3 captain (her starter sloop, ⚓1, no talents, auto-fire, «Атаковать» with the guns) against a pirate of
// ⚓2, and the duel tables (an average and a perfect captain against a bot of her ⚓) on the sloop, brig, frigate, line.
//   node tools/balance-npchp.ts [n=60] [--tiers]

import os from 'node:os';
import { duelSea, winRate } from '../tests/balance/duel.ts';
import { captainRun } from '../tests/balance/seafight.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';

try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  /* not allowed */
}

const n = Number(process.argv[2] ?? 60);
const game = duelSea();
const rows: string[] = [];
for (const [foeCls, foeLv] of [['sloop', 2], ['sloop', 1], ['schooner', 3]] as [ShipClassId, number][]) {
  let won = 0, lost = 0, sec = 0;
  for (let k = 0; k < n; k++) {
    const r = captainRun(game, 'sloop', 1, 900 + k, 'guns', 180, { foe: { cls: foeCls, level: foeLv }, captainLevel: 3 });
    if (r.won) {
      won++;
      sec += r.end;
    } else if (r.end >= 0) lost++;
  }
  rows.push(`level-3 captain, sloop ⚓1 vs ${foeCls} ⚓${foeLv}: won ${won}/${n} (${Math.round((won / n) * 100)}%), sunk ${lost}, mean win ${won ? (sec / won).toFixed(1) : '-'} s`);
  console.log(rows.at(-1));
}
if (process.argv.includes('--tiers')) {
  for (const [cls, lv] of [['sloop', 1], ['brig', 5], ['frigate', 7], ['man_o_war', 9]] as [ShipClassId, number][]) {
    const avg = winRate(game, { cls, level: lv, craft: 'average' }, { cls, level: lv, craft: 'bot' }, n, 500);
    const perf = winRate(game, { cls, level: lv, craft: 'perfect' }, { cls, level: lv, craft: 'bot' }, n, 500);
    const up = winRate(game, { cls, level: lv, craft: 'average' }, { cls, level: lv + 1, craft: 'bot' }, n, 600);
    console.log(`${cls} ⚓${lv}: even average ${Math.round(avg.rate * 100)}%, perfect ${Math.round(perf.rate * 100)}%; +1 average ${Math.round(up.rate * 100)}%`);
  }
}
