// The full balance tables (docs/12 §3.6): `npm run balance`. Duels between scripted captains and bots across the
// ladder, 60 a cell by default (BALANCE_N to change).

import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { duelSea, squad, winRate } from './duel.ts';
import { LEVEL_HULL, captainRun, pct as pctOf, seaDuel } from './seafight.ts';
import { OUTPOSTS, OUTPOST_KINDS, OUTPOST_MAX_LEVEL, outpostCap, outpostRate, outpostUpgrade } from '../../shared/src/data/estate.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { defenceOdds } from '../../shared/src/data/caravans.ts';
import { huntRate } from './hunt.ts';
import type { BeastId } from '../../shared/src/data/beasts.ts';

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
// The sea fight's clock (docs/23 item 47): broadsides only to the bottom, and «Атаковать» to the grapples.
console.log(`
The quick sea fight, ${Math.min(N, 30)} a cell (seconds: median / 90th percentile)`);
for (const L of [1, 3, 5, 8]) {
  const f: number[] = [], g: number[] = [];
  let balls = 0, hits = 0;
  for (let k = 0; k < Math.min(N, 30); k++) {
    f.push(seaDuel(game, LEVEL_HULL[L], L, 500 + k).fight);
    g.push(captainRun(game, LEVEL_HULL[L], L, 700 + k, 'board', 40).sec);
    if (k < 6) {
      const r = captainRun(game, LEVEL_HULL[L], L, 900 + k, 'guns', 60);
      balls += r.balls;
      hits += r.hits;
    }
  }
  const a = pctOf(f), b = pctOf(g);
  console.log(`⚓${L} ${LEVEL_HULL[L].padEnd(8)}: broadsides ${a.med} / ${a.p90} s · «Атаковать» → grapples ${b.med} / ${b.p90} s · the captain's balls ${Math.round((hits / Math.max(1, balls)) * 100)}%`);
}
const m = winRate(game, { cls: 'fluyt', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, N);
console.log(`merchant fluyt 5 (perfect) against a brig 5: ${pct(m.wins)}`);

// The hunt (docs/12 P4): a captain who fired first on a pod or a lone great beast.
const hunts: [ShipClassId, number, 'average' | 'perfect', BeastId, number, number][] = [
  ['schooner', 3, 'average', 'orca', 3, 4],
  ['schooner', 3, 'perfect', 'orca', 4, 4],
  ['schooner', 3, 'perfect', 'orca', 5, 4],
  ['brig', 6, 'average', 'sperm_whale', 6, 1],
  ['brig', 6, 'perfect', 'sperm_whale', 7, 1],
  ['brig', 7, 'average', 'young_serpent', 7, 1],
  ['brig', 7, 'perfect', 'young_serpent', 8, 1],
  ['sloop', 2, 'average', 'shark', 2, 3],
];
console.log(`\nThe hunt, ${N} a cell (the captain's wins, and her hull left on average)`);
for (const [cls, lv, craft, beast, bl, n] of hunts) {
  const r = huntRate(game, cls, lv, craft, beast, bl, n, N);
  console.log(`${`${cls} ${lv} ${craft}`.padEnd(22)} vs ${`${n}× ${beast} ${bl}`.padEnd(20)} ${pct(r.wins)}  hull ${r.hull}%`);
}

// The weight of numbers (docs/12 §3.6): three of a level against one a level up.
console.log(`
Three against one a level up, ${N} a cell (the three's wins)`);
for (const [cls, lv] of [['sloop', 1], ['schooner', 3], ['brig', 5], ['frigate', 7], ['man_o_war', 9]] as [ShipClassId, number][]) {
  let w = 0;
  for (let k = 0; k < N; k++) if (squad(game, { cls, level: lv, craft: 'bot' }, 3, { cls, level: lv + 1, craft: 'bot' }, k) === 'many') w++;
  console.log(`${`${cls} ${lv}`.padEnd(12)} ${pct(w)}`);
}

// Caravans against pirates, reckoned far from their owner (docs/12 P8): odds of beating them off.
console.log(`
Caravans (two hulls) against the waters’ pirates: odds by escorts (rows) and level against the band (columns −1 … +2)`);
for (let e = 0; e <= 3; e++) console.log(`escorts ${e}:  ${[-1, 0, 1, 2].map((g) => `${Math.round(defenceOdds({ escorts: e, ships: 2, level: 5 + g, band: 5 }) * 100)}%`.padStart(5)).join(' ')}`);

// Outposts (docs/12 P7): a day's yield with two hauls, and the days each level takes to pay for itself.
console.log(`
Outposts: silver a day at levels 1 … 5 (two hauls), and days to pay back each level`);
for (const k of OUTPOST_KINDS) {
  const day = (lv: number) => Math.min(outpostRate(k, lv) * 24, outpostCap(k, lv) * 2) * GOODS[OUTPOSTS[k].good].basePrice;
  const days = Array.from({ length: OUTPOST_MAX_LEVEL - 1 }, (_, i) => {
    const up = outpostUpgrade(i + 1, k);
    const cost = up.silver + Object.entries(up.goods).reduce((a, [g, n]) => a + GOODS[g as GoodId].basePrice * (n ?? 0), 0);
    return (cost / (day(i + 2) - day(i + 1))).toFixed(1);
  });
  console.log(`${k.padEnd(11)} ${[1, 2, 3, 4, 5].map((lv) => String(Math.round(day(lv))).padStart(6)).join('')} | ${days.join(' ')}`);
}
