// The full balance tables (docs/12 §3.6): `npm run balance`. Duels between scripted captains and bots across the
// ladder, 60 a cell by default (BALANCE_N to change).

import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { duelSea, winRate } from './duel.ts';

const N = Number(process.env.BALANCE_N ?? 60);
const game = duelSea();
const pct = (w: number) => `${Math.round((w / N) * 100)}%`.padStart(5);
const rows: [ShipClassId, number, ShipClassId, number, ShipClassId, number][] = [
  ['sloop', 1, 'sloop', 2, 'sloop', 3],
  ['schooner', 3, 'schooner', 4, 'brig', 5],
  ['brig', 5, 'brig', 6, 'brig', 7],
  ['frigate', 7, 'frigate', 8, 'man_o_war', 9],
  ['man_o_war', 9, 'man_o_war', 10, 'man_o_war', 10],
];
console.log(`Balance duels, ${N} a cell (wins of the captain on the left)`);
console.log('ship      | even: avg perf | +1: avg perf | +2: perf');
for (const [ca, la, cb, lb, cc, lc] of rows) {
  const ea = winRate(game, { cls: ca, level: la, craft: 'average' }, { cls: ca, level: la, craft: 'bot' }, N);
  const ep = winRate(game, { cls: ca, level: la, craft: 'perfect' }, { cls: ca, level: la, craft: 'bot' }, N);
  const a1 = winRate(game, { cls: ca, level: la, craft: 'average' }, { cls: cb, level: lb, craft: 'bot' }, N);
  const p1 = winRate(game, { cls: ca, level: la, craft: 'perfect' }, { cls: cb, level: lb, craft: 'bot' }, N);
  const p2 = lc - la >= 2 ? pct(winRate(game, { cls: ca, level: la, craft: 'perfect' }, { cls: cc, level: lc, craft: 'bot' }, N).wins) : '    —';
  console.log(`${`${ca} ${la}`.padEnd(10)}|      ${pct(ea.wins)} ${pct(ep.wins)} |    ${pct(a1.wins)} ${pct(p1.wins)} |    ${p2}`);
}
const m = winRate(game, { cls: 'fluyt', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, N);
console.log(`merchant fluyt 5 (perfect) against a brig 5: ${pct(m.wins)}`);
