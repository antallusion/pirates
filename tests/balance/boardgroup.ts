// docs/25 block Е (items 64–67, owner 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и
// умения решали … делай все пункты»): a group's boarding measured with the engine's own mind on every side — how long
// it runs (the same model as tests/balance/boardlen.ts: each stack's turn as the screens play it and her captain's
// decision), how a group of the sea's foes is grown (item 66), whether a mixed group of paths is stronger than three of
// one (item 65), and how what each captain cut down shares the spoils (item 67). Shared by tests/balance/boarding.test.ts,
// tests/boardgroup.test.ts and tools/boarding-time.ts / tools/balance-group.ts.

import type { CaptainId } from '../../shared/src/data/captains.ts';
import { UNITS } from '../../shared/src/data/army.ts';
import { tacBring } from '../../shared/src/data/tactical.ts';
import { lossesOf, sharesOf, tacHp } from '../../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../../server/src/game/tacbattle.ts';
import { pickBring } from '../../server/src/game/tactical.ts';
import { PATHS, captainAt, playBoard, playerArmy, side, sidesAt } from './boardlen.ts';
import type { BoardRun } from './boardlen.ts';

/** An ally of level L walking `path`: her strongest tacBring(L) stacks of her waters' crew, her captain in her
 *  level's kit, her orders reckoned from her whole crew (a captain's orders are a captain's: tactical.ts allyInput). */
export function allyAt(path: CaptainId, L: number, seed: number, bring = tacBring(L)): TacSideInput {
  const army = playerArmy(L);
  const hp = army.reduce((n, x) => n + x.n * (UNITS[x.u]?.hp ?? 0), 0);
  return { ...side(pickBring(army, bring), captainAt(path, L, 3 + seed * 11), path, true), name: `Mate ${seed}`, spellHp: hp };
}

export interface GroupRun extends BoardRun {
  /** Each captain's share of what her side cut down (slot order: the side's own first). */
  shares: [number[], number[]];
  /** Share of each captain's own men (as they came aboard) she lost. */
  lost: [number[], number[]];
}

function shareRow(bt: TacBattle, x: 0 | 1): number[] {
  return [...sharesOf(bt, x).values()];
}
function lostRow(bt: TacBattle, x: 0 | 1): number[] {
  const slots = [0, ...(bt.allies ?? []).filter((a) => a.side === x).map((a) => a.slot)];
  return slots.map((sl) => {
    const mine = bt.stacks.filter((s) => s.side === x && (s.own ?? 0) === sl);
    const start = mine.reduce((n, s) => n + (s.start - (s.boost ?? 0)) * s.hpMax, 0);
    const lost = lossesOf(bt, x, sl).reduce((n, l) => n + l.n * (UNITS[l.u]?.hp ?? 0), 0);
    return start > 0 ? Math.min(1, lost / start) : 0;
  });
}

/** A boarding of a group: side 0 her own captain (`p[0]`) and her allies (`p[1..]`); against `q` — a captain of the
 *  same paths' count (`q` paths, the first hers, the rest her allies: a group of captains, nobody grown) or, `q` null,
 *  a pirate of her waters grown as a group's foe is (`grow`: item 66's factor, true; a number; false: not grown). */
export function playGroup(L: number, p: CaptainId[], q: CaptainId[] | null, seed: number, opts: { grow?: boolean | number; late?: number; decide?: number } = {}): GroupRun {
  const [a, b] = sidesAt(L, !!q, p[0], q?.[0] ?? p[0], seed);
  const allies: { side: 0 | 1; input: TacSideInput; grow?: boolean | number }[] = [];
  p.slice(1).forEach((path, i) => allies.push({ side: 0, input: allyAt(path, L, seed * 3 + i + 1), grow: q ? false : opts.grow ?? true }));
  (q ?? []).slice(1).forEach((path, i) => allies.push({ side: 1, input: allyAt(path, L, seed * 5 + i + 7), grow: false }));
  const r = playBoard(a, b, seed * 13 + L, { allies, ...(opts.decide !== undefined ? { decide: opts.decide } : {}) });
  return { ...r, shares: [shareRow(r.end, 0), shareRow(r.end, 1)], lost: [lostRow(r.end, 0), lostRow(r.end, 1)] };
}

export interface GroupStat { L: number; n: number; win: number; rounds: number; mins: number; lost: number; lostMain: number; turns: number }

/** `n` boardings of a group (paths `p`) against `q` (or the sea), every pairing of the six paths over the seeds: the
 *  boarder side's wins, rounds, minutes, and the share of her men each captain of the boarders lost (the mean). */
export function groupStat(L: number, size: number, q: number | null, n: number, opts: { grow?: boolean | number } = {}): GroupStat {
  let k = 0, win = 0, rounds = 0, secs = 0, lost = 0, lostMain = 0, turns = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < PATHS.length; j++) {
    const p = Array.from({ length: size }, (_, x) => PATHS[(j + x * 2 + i) % PATHS.length]);
    const qq = q === null ? null : Array.from({ length: q }, (_, x) => PATHS[(j + i + x * 2 + 1) % PATHS.length]);
    const r = playGroup(L, p, qq, i * 7 + j, opts);
    k++;
    win += r.winner === 0 ? 1 : 0;
    rounds += r.rounds;
    secs += r.secs;
    lost += r.lost[0].reduce((a, x) => a + x, 0) / r.lost[0].length;
    lostMain += r.lost[0][0];
    turns += r.turns[0] + r.turns[1];
  }
  return { L, n: k, win: win / k, rounds: rounds / k, mins: secs / k / 60, lost: lost / k, lostMain: lostMain / k, turns: turns / k };
}

/** Item 65: a mixed group of three (three different paths) against three of one path, the same armies and kits: the
 *  mixed side's wins over `n` seeds a pairing, each side boarding in turn. */
export function mixedVsSame(L: number, mixed: CaptainId[], same: CaptainId, n: number): number {
  let w = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const a = playGroup(L, mixed, [same, same, same], 100 + i * 7);
    const b = playGroup(L, [same, same, same], mixed, 200 + i * 7);
    w += (a.winner === 0 ? 1 : 0) + (b.winner === 1 ? 1 : 0);
    k += 2;
  }
  return w / k;
}

/** The hit points a side brought aboard (the grown ones counted). */
export const sideHp = (bt: TacBattle, x: 0 | 1): number => bt.stacks.filter((s) => s.side === x).reduce((n, s) => n + s.start * s.hpMax, 0) || bt.stacks.filter((s) => s.side === x).reduce((n, s) => n + tacHp(s), 0);
