// docs/18 VI item 47: the balance report of docs/18 in one place —
//   1. the path books 6×6 at hero levels 10/30/55, each path against each and against the sea of its level;
//   2. the targets of docs/17 kept: an even fight of two ladder crews, ten per cent fewer men, the ladder's crew
//      against the pirates of each level;
//   3. the lairs: each of the 14 kinds at its levels, the share of the landed men a captain of its level loses
//      against a weak / average / strong lair (12 / 30 / 60%);
//   4. armies with creatures against plain ones: a drift's group aboard the ladder's crew in place of as many hands,
//      against the pirates of the level (tests/balance/creatures.ts: over a band of hammocks, the battle being steep in
//      the make-up of small stacks), with a mixed army's −1 morale and with the path's own people;
//   5. what the creatures cost to keep against an hour at sea, and the land's resources' income against their sinks.
//
//   node tools/balance-h7.ts [--fast] [--only=paths,keep,lairs,armies,upkeep]
//   node tools/balance-h7.ts --calibrate-drifts [kind…]       DRIFT_CAL from the battle (printed to paste)

import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { advHour } from '../shared/src/data/advmap.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { DRIFTS, DRIFT_CAL, DRIFT_KINDS, driftCount, upkeepHour } from '../shared/src/data/drifts.ts';
import type { DriftKind } from '../shared/src/data/drifts.ts';
import { LAIRS, LAIR_KINDS, LAIR_LOSS, LAIR_SIZES, lairPay } from '../shared/src/data/lairs.ts';
import { LAND_RES, LAND_RES_DEF } from '../shared/src/data/bestiary.ts';
import { CRAFTS, DWELL_UP, FITTINGS, FITTING_IDS, FITTING_MAX, LAND_RES_CAP, fittingCost, townLand } from '../shared/src/data/landecon.ts';
import { TOWN_IDS, TOWN } from '../shared/src/data/town.ts';
import { print, table } from './balance-paths.ts';
import type { Table } from './balance-paths.ts';
import { CREW, calibrateDrift, driftKindsAt, groupWin, ladderBand, side, wins } from '../tests/balance/creatures.ts';
import { lairFight, levelsOf } from '../tests/balance/lairs.ts';

const args = process.argv.slice(2);
const FAST = args.includes('--fast');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? ['paths', 'keep', 'lairs', 'armies', 'upkeep'];
const pc = (x: number) => `${Math.round(x * 100)}%`;
const flag = (ok: boolean) => (ok ? '' : ' ✗');

if (args.includes('--calibrate-drifts')) {
  const only = args.filter((a) => (DRIFT_KINDS as string[]).includes(a)) as DriftKind[];
  const kinds = (only.length ? only : DRIFT_KINDS).filter((k) => !DRIFTS[k].legend);
  for (const k of kinds) {
    const saved = DRIFT_CAL[k];
    delete DRIFT_CAL[k];
    const row = calibrateDrift(k, (L) => driftCount(k, L), FAST ? 40 : 60, Number(process.env.TARGET ?? 0.49), (s) => console.error(s));
    if (saved) DRIFT_CAL[k] = saved;
    console.log(`  ${k}: [${row.join(', ')}],`);
  }
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------ 1. the paths

if (ONLY.includes('paths')) {
  const N = FAST ? 120 : 400;
  console.log(`1. The path books 6×6 (${2 * N} battles a pair; targets: every pair 42–58%, every path against the sea of its level 50–70%)`);
  for (const level of [10, 30, 55]) {
    const t: Table = table(level, N);
    print(t);
    const out: string[] = [];
    CAPTAIN_IDS.forEach((a, i) => {
      for (const b of CAPTAIN_IDS.slice(i + 1)) if (t.m[a][b] < 0.42 || t.m[a][b] > 0.58) out.push(`${a}–${b} ${pc(t.m[a][b])}`);
      if (t.sea[a] < 0.5 || t.sea[a] > 0.7) out.push(`${a}×sea ${pc(t.sea[a])}`);
    });
    console.log(`  out of target: ${out.length ? out.join(', ') : 'none'}`);
  }
}

// ------------------------------------------------------------------------------------------------ 2. docs/17 kept

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

if (ONLY.includes('keep')) {
  const N = FAST ? 120 : 300;
  console.log(`\n2. The targets of docs/17 (${N} battles each): an even fight ≈50%, a tenth fewer men loses 65–75%, the ladder's crew against the pirates 45–55% at every level`);
  for (const L of [3, 5, 7]) {
    const a = armyForLevel(L, 100, 6, 'pirate');
    const lose = 1 - wins(side(thin(a, 0.1)), side(a), N);
    console.log(`  ⚓${L}: even ${pc(wins(side(a), side(a), N))} · 10% fewer men lose ${pc(lose)}${flag(lose >= 0.65 && lose <= 0.75)}`);
  }
  const row: string[] = [];
  for (let L = 1; L <= 10; L++) {
    const lad = armyForLevel(L, CREW[L], 7, 'player'), pir = armyForLevel(L, CREW[L], 7, 'pirate');
    const even = wins(side(lad), side(lad), N), vs = wins(side(lad), side(pir), N);
    row.push(`⚓${L} even ${pc(even)} · ×pirates ${pc(vs)}${flag(vs >= 0.45 && vs <= 0.55)}`);
  }
  console.log(`  ${row.join('\n  ')}`);
}

// ------------------------------------------------------------------------------------------------ 3. the lairs

if (ONLY.includes('lairs')) {
  const N = FAST ? 16 : 30;
  console.log(`\n3. The lairs (${N} battles ashore each): a captain of the lair's level loses ${LAIR_SIZES.map((s) => `${s} ${pc(LAIR_LOSS[s])}`).join(' / ')} of the men she lands`);
  let worst = 0;
  for (const kind of LAIR_KINDS) {
    const cells: string[] = [];
    for (const L of levelsOf(kind)) {
      const row = LAIR_SIZES.map((size) => {
        const f = lairFight(kind, L, size, N);
        worst = Math.max(worst, Math.abs(f.loss - LAIR_LOSS[size]));
        return Math.round(f.loss * 100);
      });
      cells.push(`⚓${L} ${row.join('/')}`);
    }
    console.log(`  ${kind.padEnd(16)} ${cells.join(' · ')}`);
  }
  console.log(`  the largest miss from its target: ${Math.round(worst * 100)} points`);
}

// ------------------------------------------------------------------------------------------------ 4. armies with creatures

if (ONLY.includes('armies')) {
  const F = FAST ? 30 : 60;
  console.log(`\n4. Armies with creatures against the pirates of their level (target 45–60%): a drift's group in place of as many hands; over the hammocks ±15% (${F} battles a step), with a mixed army's −1 morale · with the path's own people (morale 0, the favourite's +10%) · at the ladder's own hammocks (−1)`);
  const all: number[] = [];
  for (let L = 1; L <= 10; L++) {
    const cells = driftKindsAt(L).map((k) => {
      const g = groupWin(k, L, F);
      all.push(g.band, g.native);
      return `${g.n} ${DRIFTS[k].u}: ${pc(g.band)}${flag(g.band >= 0.45 && g.band <= 0.6)} · ${pc(g.native)}${flag(g.native >= 0.45 && g.native <= 0.6)} · ${pc(g.exact)}`;
    });
    console.log(`  ⚓${L} (plain ladder over the band ${pc(ladderBand(L, F))}): ${cells.join(' | ')}`);
  }
  console.log(`  every group: ${pc(Math.min(...all))}–${pc(Math.max(...all))}`);
}

// ------------------------------------------------------------------------------------------------ 5. upkeep and the land's resources

if (ONLY.includes('upkeep')) {
  console.log('\n5. Keeping creatures against the hour at sea (a drift group\'s food an hour; a full slot of the level\'s strongest group)');
  for (let L = 1; L <= 10; L++) {
    const cells = driftKindsAt(L).map((k) => {
      const up = upkeepHour([{ u: DRIFTS[k].u, n: driftCount(k, L) }]);
      return `${DRIFTS[k].u} ${Math.round(up)} (${(up / advHour(L) * 100).toFixed(1)}%)`;
    });
    console.log(`  ⚓${L} (an hour at sea ${Math.round(advHour(L))}): ${cells.join(' · ')}`);
  }
  console.log('\n   The land\'s resources: what an average shore lair leaves (once a week a captain) against what asks for them');
  for (const L of [2, 4, 6, 8, 10]) {
    const kinds = LAIR_KINDS.filter((k) => LAIRS[k].role === 'shore' && L >= LAIRS[k].lv[0] && L <= LAIRS[k].lv[1]);
    const got: Record<string, number> = {};
    for (const k of kinds) for (const [r, n] of Object.entries(lairPay(k, L, 'avg', LAIRS[k].types[0]).res)) got[r] = (got[r] ?? 0) + n / kinds.length;
    console.log(`  ⚓${L}: a lair ${Object.entries(got).map(([r, n]) => `${n.toFixed(1)} ${r}`).join(', ')}`);
  }
  const town = TOWN_IDS.flatMap((id) => Array.from({ length: TOWN[id].max }, (_, i) => [id, i + 1] as const)).map(([id, lv]) => townLand(id, lv)).reduce((a, c) => {
    for (const [r, n] of Object.entries(c)) a[r] = (a[r] ?? 0) + n;
    return a;
  }, {} as Record<string, number>);
  const fits = FITTING_IDS.reduce((a, id) => {
    for (let r = 1; r <= FITTING_MAX; r++) for (const [k, n] of Object.entries(fittingCost(id, r).land)) a[k] = (a[k] ?? 0) + n;
    return a;
  }, {} as Record<string, number>);
  const crafts = CRAFTS.reduce((a, c) => {
    for (const [k, n] of Object.entries(c.land)) a[k] = (a[k] ?? 0) + n;
    return a;
  }, {} as Record<string, number>);
  const words = (o: Record<string, number>) => LAND_RES.map((r) => `${o[r] ?? 0} ${LAND_RES_DEF[r].name[0]}`).join(', ');
  console.log(`  the whole town: ${words(town)}; every fitting to its top: ${words(fits)} (${FITTING_IDS.map((id) => FITTINGS[id].name[0]).join(', ')}); one of each artifact: ${words(crafts)}`);
  console.log(`  a settled dwelling of tier t: ${DWELL_UP.cost(1).land.shell}·t shell and bone once, then ⌈t/2⌉ bone a week; the store keeps ${LAND_RES_CAP} of each (the rest rots), the market buys at 40–60% of the reckoning`);
}
