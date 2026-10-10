// docs/25 item 70, the boarding's half (owner: «ни один капитан не сильнее другого больше чем на 15% … ни в абордаже,
// ни на одном уровне; каждое умение даёт не меньше +10% в своей роли»; 2026-10-10: «надо этот момент для всех
// капитанов проработать идеально … делай все пункты»): the six paths under the boarding's rules on real builds (her
// level's skills and kit, tests/balance/boardlen.ts), each against each.
//
// The figures that hold them even are tuned level by level — every hero level its own (shared/src/data/paths.ts
// POWER_AT, PATH_KNOBS, MOVE_KNOBS, ORDER_KNOBS) by tools/balance-paths.ts --balance and --pairs on dice of their own.
// The full check (400 boardings a pairing at each level band, other dice): node tools/balance-paths.ts --check — every
// path 42.5–57.5% against all and every pairing 35–65%. Here a reduced sample for the suite (`N` a way round, 2N a
// pairing, on dice neither tuner saw), so its bounds are widened by its noise:
// - against all: 10·N boardings a path — one standard error ~2.9 points at N = 30, and the full check's 42.5–57.5% stand
//   (a path tuned to 50% is two and a half errors inside);
// - a pairing: 2·N boardings — ~6.5 points, so 30–70% here (the full check holds 35–65%).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../shared/src/rng.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { INNATE, ORDER_KNOBS, POWER_AT, moveFx, orderPower, pathPower, powered } from '../../shared/src/data/paths.ts';
import { TAC_RESIST, tacEcho } from '../../shared/src/data/tactical.ts';
import { TAC_HEAL, castSpell, commonHeal, fxValue, newBattle, tacStats } from '../../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../../server/src/game/tacbattle.ts';
import { PATHS, captainAt, playBoard, playerArmy, side, sidesAt } from './boardlen.ts';
import { BAND_LEVELS, movesAt, roleOf } from './boardskill.ts';

const N = 50;
const SALT = 91000;
const LEVELS = [5, 15, 30, 45, 60];

/** Each pairing at level L, `n` boardings a way round (the sides swapped by turns): m[a][b] — a's wins against b. */
function matrix(L: number, n: number, salt: number): Record<CaptainId, Record<CaptainId, number>> {
  const m = {} as Record<CaptainId, Record<CaptainId, number>>;
  for (const a of PATHS) m[a] = { [a]: 0.5 } as Record<CaptainId, number>;
  PATHS.forEach((a, i) => PATHS.forEach((b, j) => {
    if (j <= i) return;
    let w = 0;
    for (let k = 0; k < 2 * n; k++) {
      const flip = k % 2 === 1;
      const [x, y] = sidesAt(L, true, flip ? b : a, flip ? a : b, k * 13 + i * 7 + j + salt);
      if ((playBoard(x, y, k * 31 + i * 5 + j + L + salt).winner === 0) !== flip) w++;
    }
    m[a][b] = w / (2 * n);
    m[b][a] = 1 - w / (2 * n);
  }));
  return m;
}
const tables = new Map(LEVELS.map((L) => [L, matrix(L, N, SALT)]));
const vsAll = (m: Record<CaptainId, Record<CaptainId, number>>, p: CaptainId) => PATHS.filter((q) => q !== p).reduce((s, q) => s + m[p][q], 0) / (PATHS.length - 1);

test('docs/25 item 70: under the boarding\'s rules every path wins 42.5–57.5% against all at every level band (5, 15, 30, 45, 60)', () => {
  const out: string[] = [];
  for (const [L, m] of tables) for (const p of PATHS) {
    const v = vsAll(m, p);
    if (v < 0.425 || v > 0.575) out.push(`level ${L}: ${p} ${(v * 100).toFixed(0)}%`);
  }
  assert.deepEqual(out, []);
});

test('docs/25 item 70: no pairing of paths further from even than 30–70% in the suite\'s sample (35–65% in the full check)', () => {
  const out: string[] = [];
  for (const [L, m] of tables) PATHS.forEach((a, i) => PATHS.forEach((b, j) => {
    if (j > i && (m[a][b] < 0.3 || m[a][b] > 0.7)) out.push(`level ${L}: ${a} against ${b} ${(m[a][b] * 100).toFixed(0)}%`);
  }));
  assert.deepEqual(out, []);
});

// «каждое умение даёт не меньше +10% в своей роли»: each move alone is held to 8% and more (tests/balance/boarding.test.ts,
// docs/25 item 69); a path's kit — her innate move, her pages open at the level, her ultimate — lays 10% or more in
// its role on the mean, at every band.
test('docs/25 item 70: a path\'s kit lays 10% or more in its role on the mean at every band', () => {
  const out: string[] = [];
  for (const p of PATHS) for (const L of BAND_LEVELS) {
    const ids = movesAt(p, L);
    const mean = ids.reduce((s, id) => s + roleOf(p, id, L).v, 0) / ids.length;
    if (mean < 0.1) out.push(`${p} at ${L}: ${(mean * 100).toFixed(1)}%`);
  }
  assert.deepEqual(out, []);
});

test('docs/25 item 70: every hero level has figures of its own; her own order by level, in a ship\'s boarding alone', () => {
  assert.equal(POWER_AT.length, 60);
  POWER_AT.forEach((L, i) => assert.equal(L, i + 1));
  for (const p of PATHS) {
    assert.equal(ORDER_KNOBS[p].length, 60);
    for (const L of [1, 30, 60]) assert.equal(orderPower(p, L), ORDER_KNOBS[p][L - 1]);
  }
  // The Reaver's Red Harvest: held at her knob in a ship's boarding, as before (×1) on the land's or the Colosseum's.
  const give = (len?: 'board'): number | undefined => {
    const a = side(playerArmy(8), captainAt('reaver', 8, 3), 'reaver', true), b = side(playerArmy(8), captainAt('admiral', 8, 4), 'admiral', true);
    const bt = newBattle(a, b, 3, 0, new Rng(3), len ? { len } : {});
    bt.round = 2;
    assert.equal(castSpell(bt, 0, 'red_harvest', undefined, new Rng(4)), null);
    return bt.heroes[0].fx.find((f) => f.id === 'red_harvest')?.k ?? 1;
  };
  assert.equal(give('board'), orderPower('reaver', 8));
  assert.equal(give(), 1);
});

test('docs/25 item 70: the Navigator\'s squall — her stack\'s blows by her moves\' power while it holds; the echo by level', () => {
  for (const L of [3, 8, 30, 60]) {
    const k = pathPower('navigator', L, 'move');
    const fx = powered(moveFx('navigator', 'innate', L), 'navigator', L, 'move');
    assert.equal(fx.again, true);
    if (k === 1) assert.equal(fx.one?.melee ?? 0, 0);
    else assert.ok(Math.abs((fx.one?.melee ?? 0) - (k - 1)) < 1e-9 && Math.abs((fx.one?.shot ?? 0) - (k - 1)) < 1e-9, `at ${L}: ×${k}`);
    assert.equal(fx.one?.speed, INNATE.navigator.fx.one?.speed);
  }
  assert.equal(tacEcho(10), 0.35);
  assert.equal(tacEcho(30), 0.6);
});

test('docs/25 item 70: a common heal stands up no more than 15% of a stack in a boarding (35–40% before at levels 30–60)', () => {
  const a = side(playerArmy(40), captainAt('drowned', 40, 3), 'drowned', true), b = side(playerArmy(40), captainAt('admiral', 40, 4), 'admiral', true);
  const board = newBattle(a, b, 3, 0, new Rng(3), { len: 'board' }), land = newBattle(a, b, 3, 0, new Rng(3));
  assert.equal(commonHeal(board, 'brine_mend', 4), TAC_HEAL.brine_mend.board);
  assert.equal(commonHeal(land, 'brine_mend', 4), TAC_HEAL.brine_mend.cap);
  assert.ok(Math.abs(commonHeal(board, 'brine_mend', 1) - 0.12) < 1e-9);
});

// The sea's mind (it is the auto-battle and every captain of the sea): «Шкура из ракушек» and «Поцелуй соли» were
// passed over (harm taken was weighed 0.2 a share against blows' 0.23: the engine has it a third more), and what a
// great one shrugs off was weighed as if it landed.
test('docs/25 item 70: the sea\'s mind weighs what resists as shrugged off — a page less on a titan by its resistance, the innate move not', () => {
  const titan = (resist: number): { bt: TacBattle; t: number } => {
    const b: TacSideInput = { ...side(playerArmy(50), captainAt('admiral', 50, 4), 'admiral', true), ...(resist ? { resist } : {}) };
    const bt = newBattle(side(playerArmy(50), captainAt('corsair', 50, 3), 'corsair', true), b, 5, 0, new Rng(5), { len: 'board' });
    bt.round = 2;
    const t = bt.stacks.filter((x) => x.side === 1).sort((x, y) => y.count * y.hpMax - x.count * x.hpMax)[0];
    t.count = t.start = t.count * 20; // deep, so no blow takes it whole
    return { bt, t: t.id };
  };
  const fx = { target: 'enemy' as const, dmg: 0.5 };
  const v = (resist: number, pierce: boolean) => {
    const { bt, t } = titan(resist);
    return fxValue(bt, 0, fx, 1, bt.stacks.find((x) => x.id === t), false, pierce);
  };
  const r = TAC_RESIST.titan;
  assert.ok(Math.abs(v(r, false) / v(0, false) - (1 - r)) < 0.02, `a page: ×${(v(r, false) / v(0, false)).toFixed(2)}`);
  assert.ok(Math.abs(v(r, true) / v(0, true) - 1) < 1e-9, 'the innate move and the ultimate pass');
});

test('docs/25 item 70: the sea\'s mind gives «Шкура из ракушек» and «Поцелуй соли» (the Drowned at level 45 against every path)', () => {
  tacStats.on = true;
  tacStats.casts.clear();
  try {
    let k = 0;
    PATHS.forEach((q, j) => {
      if (q === 'drowned') return;
      for (let i = 0; i < 6; i++) {
        const [a, b] = sidesAt(45, true, 'drowned', q, 300 + i * 13 + j * 7);
        playBoard(a, b, 300 + i * 31 + j * 5);
        k++;
      }
    });
    const per = (id: string) => (tacStats.casts.get(`drowned:${id}`) ?? 0) / k;
    assert.ok(per('dr_barnacles') >= 0.5, `«Шкура из ракушек» ${per('dr_barnacles').toFixed(2)} a battle (0 before)`);
    assert.ok(per('dr_brine_kiss') >= 0.3, `«Поцелуй соли» ${per('dr_brine_kiss').toFixed(2)} a battle`);
  } finally {
    tacStats.on = false;
    tacStats.casts.clear();
  }
});

