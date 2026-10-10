// docs/25 §1.2 and items 44–52, 69: how long a boarding runs by its level — whole battles played by the engine's own
// sea's mind on both sides, with each turn's time on the screen (the field's pace, TAC_PACE, as the server waits for it)
// and a captain's thinking over it. Shared by tests/balance/boarding.test.ts and tools/boarding-time.ts.
//
// The model (owner, 2026-10-09: «абордаж на высоких уровнях должен быть такой, чтобы люди играли по 5-10 минут…»):
// - real seconds = Σ over the stacks' turns of (what the turn plays on the screen + the decision);
// - the decision: HUMAN_DECIDE seconds a stack for a captain (an assumption: a practised player's pick of a move or a
//   blow with the preview shown, an order now and then), TAC_AI_DELAY for the sea's mind;
// - against a player both sides are captains; against the sea only the boarder is;
// - the captains' moves (orders, the path's innate and ultimate) are the auto-battle's, as a fair stand-in for a player.

import { Rng } from '../../shared/src/rng.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { armyForLevel } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { heroBattle, npcHeroBattle, npcHeroLevel, npcKit, npcSkills, primsAtLevel, startingOrders } from '../../shared/src/data/hero.ts';
import type { HeroBattle } from '../../shared/src/data/hero.ts';
import { artTotals, makeArtifact } from '../../shared/src/data/artifacts.ts';
import { TAC_AI_DELAY, boardSlots, npcBoardSlots, tacSchedule } from '../../shared/src/data/tactical.ts';
import { aiAct, battleLevel, capOf, newBattle, tacHp } from '../../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../../server/src/game/tacbattle.ts';
import { battleFit } from '../../server/src/game/tactical.ts';

export const PATHS: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];
/** A captain's thinking over one stack's turn, seconds (the model's assumption, docs/25 §1.2). */
export const HUMAN_DECIDE = 6;
/** The ladder's crews by ship level (tools/balance-paths.ts hammocks): men a hull of her waters carries. */
export const HAMMOCKS = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];
export const slOf = (L: number): number => Math.min(10, Math.max(1, Math.ceil(L / 6)));

/** docs/25 §1.2 by level band — minutes against a captain and against the sea, rounds (a captain's fight), stacks a side,
 *  the share of an equal army cut in round 1.
 *  Owner, 2026-10-10 («9 матросов убили 20 моих матросов с одного удара … чини атаку всем, чини баланс»): a blow is what
 *  the stacks' cards say, so the table is the honest one — what the battles with the stacks' own blows take (tools/
 *  boarding-time.ts n=4, 2026-10-10), the levers left being the stacks a side brings, the clocks, the quick fight and
 *  the flag. `want`: the owner's table of 2026-10-09 (docs/25 §1.2 before), which the tempo by level, the sea's lift and
 *  round 1's scale reached by inflating the blows; the bottom (≈1 min, 2–3 rounds) and the top (5–10 min, 5–7 rounds)
 *  are out of the honest reach. */
export interface Band {
  lo: number;
  hi: number;
  pvp: [number, number];
  npc: [number, number];
  rounds: [number, number];
  stacks: [number, number];
  r1: [number, number];
  want: { pvp: [number, number]; npc: [number, number]; rounds: [number, number]; r1: [number, number] };
}
export const BANDS: Band[] = [
  { lo: 1, hi: 10, pvp: [2, 3], npc: [1, 1.75], rounds: [3.5, 4.5], stacks: [3, 4], r1: [0.2, 0.4], want: { pvp: [1, 1], npc: [0.5, 0.75], rounds: [2, 3], r1: [0.35, 0.35] } },
  { lo: 11, hi: 20, pvp: [2.25, 3.5], npc: [1.25, 2.25], rounds: [3, 4.5], stacks: [4, 5], r1: [0.25, 0.5], want: { pvp: [1.5, 2.5], npc: [1, 1], rounds: [3, 3], r1: [0.25, 0.3] } },
  { lo: 21, hi: 30, pvp: [2.75, 4], npc: [1.75, 2.75], rounds: [3, 4], stacks: [5, 6], r1: [0.2, 0.45], want: { pvp: [2.5, 4], npc: [1, 1.5], rounds: [3, 4], r1: [0.22, 0.27] } },
  { lo: 31, hi: 40, pvp: [3.25, 4.75], npc: [2, 3], rounds: [3, 4.5], stacks: [6, 7], r1: [0.25, 0.5], want: { pvp: [4, 6], npc: [1.5, 2.5], rounds: [4, 5], r1: [0.19, 0.24] } },
  { lo: 41, hi: 50, pvp: [3.5, 5], npc: [2, 3], rounds: [3.25, 4.5], stacks: [7, 7], r1: [0.25, 0.5], want: { pvp: [5, 8], npc: [2, 3], rounds: [5, 6], r1: [0.17, 0.21] } },
  { lo: 51, hi: 60, pvp: [3.5, 5], npc: [2, 3], rounds: [3.25, 4.5], stacks: [7, 7], r1: [0.25, 0.5], want: { pvp: [5, 10], npc: [2.5, 4], rounds: [5, 7], r1: [0.15, 0.18] } },
];

/** The eight battle skills the balance tools give a captain (tools/balance-glory.ts BUILD): a pick a level, rank by
 *  rank; and the artifacts of her level (captainIlvl's bands: the treasures, the minors, then the three sets and the
 *  Medal). A captain of the sea has the same since docs/25 item 63 (shared/src/data/hero.ts). */
export const skillsAt = npcSkills;
export const lvlKit = npcKit;
/** A captain of `path` at level `L` in her level's kit (`bare`: no skills, no artifacts). */
export function captainAt(path: CaptainId, L: number, seed: number, bare = false): HeroBattle {
  const prim = primsAtLevel(path, seed, L);
  const items = bare ? [] : lvlKit(L).map((id, i) => makeArtifact(id, i + 1));
  const a = artTotals(items);
  const p = { atk: prim.atk + a.prim.atk, def: prim.def + a.prim.def, pow: prim.pow + a.prim.pow, will: prim.will + a.prim.will };
  return heroBattle(p, bare ? [] : skillsAt(L), items.length ? a : null, startingOrders(path), Number.POSITIVE_INFINITY, { path, level: L });
}

export const side = (army: ArmyStack[], hero: HeroBattle | undefined, captain: CaptainId | null, human: boolean): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ ...x, src: x.u })), officers: [], skill: 3, morale: 70, dealt: 1,
  power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human, ...(hero ? { hero } : {}),
});

/** A captain's army at level L: her waters' crew in her hull's stacks (docs/25 §1.2). */
export const playerArmy = (L: number): ArmyStack[] => armyForLevel(slOf(L), HAMMOCKS[slOf(L)], boardSlots(L), 'player');
/** A pirate of her waters as the sea brings her to a boarding: one or two stacks fewer (item 50). */
export function pirateArmy(L: number): ArmyStack[] {
  const sl = slOf(L);
  return battleFit(armyForLevel(sl, HAMMOCKS[sl], 7, 'pirate').map((x) => ({ ...x, src: x.u })), npcBoardSlots(npcHeroLevel(sl))).map(({ u, n }) => ({ u, n }));
}

/** The two sides of a boarding at level L: `pvp` — two captains of her level and kit (paths `p` and `q`); else she
 *  against a pirate of her waters. */
export function sidesAt(L: number, pvp: boolean, p: CaptainId, q: CaptainId, seed: number, bare = false): [TacSideInput, TacSideInput] {
  const me = side(playerArmy(L), captainAt(p, L, 11 + seed * 7, bare), p, true);
  if (pvp) return [me, side(playerArmy(L), captainAt(q, L, 5 + seed * 13, bare), q, true)];
  return [me, side(pirateArmy(L), npcHeroBattle(slOf(L), null), null, false)];
}

const hpSide = (bt: TacBattle, s: 0 | 1) => bt.stacks.filter((x) => x.side === s && x.count > 0).reduce((n, x) => n + tacHp(x), 0);

export interface BoardRun {
  rounds: number;
  winner: 0 | 1;
  why: string;
  /** Share of each side's army (hit points as it came aboard) cut down in round 1. */
  cut1: [number, number];
  /** Stack turns each side had, and the seconds the battle took in the model. */
  turns: [number, number];
  secs: number;
  /** Seconds on the screen alone (the field's pace). */
  play: number;
  /** Share of each side's harm laid by her captain's moves (orders, innate, ultimate), by kind. */
  moves: [Record<string, number>, Record<string, number>];
  harm: [number, number];
  /** The battle as it ended (docs/25 block Е: what each captain cut down and lost). */
  end: TacBattle;
}

/** One boarding played to its end by the sea's mind on both sides, timed turn by turn. */
export function playBoard(a: TacSideInput, b: TacSideInput, seed: number, opts: { len?: 'board' | 'long'; level?: number; decide?: number; allies?: { side: 0 | 1; input: TacSideInput; grow?: boolean | number }[]; start?: (bt: TacBattle) => void } = {}): BoardRun {
  const rng = new Rng(1000 + seed * 17);
  const level = opts.level ?? battleLevel(a, b);
  const bt = newBattle(a, b, seed + 1, 0, rng, { len: opts.len ?? 'board', level, ...(opts.allies ? { allies: opts.allies } : {}) });
  // The balance tools' hand on the battle before its first turn (tools/balance-paths.ts --rates: a strike's worth).
  opts.start?.(bt);
  const start = [hpSide(bt, 0), hpSide(bt, 1)];
  const run: BoardRun = { rounds: 0, winner: 0, why: '', cut1: [0, 0], turns: [0, 0], secs: 0, play: 0, moves: [{}, {}], harm: [0, 0], end: bt };
  // docs/25 block Е: an ally's stack is decided by her captain (a captain thinks, the sea breathes).
  const decide = (s: Parameters<typeof capOf>[1]) => (capOf(bt, s).input.human ? opts.decide ?? HUMAN_DECIDE : TAC_AI_DELAY);
  let r1done = false;
  for (let i = 0; i < 4000 && !bt.over && bt.active !== null; i++) {
    const s = bt.stacks.find((x) => x.id === bt.active)!;
    const ev0 = bt.events;
    const hp0 = [hpSide(bt, 0), hpSide(bt, 1)];
    aiAct(bt, 0, rng);
    const fresh = bt.log.filter((e) => e.i > ev0);
    const play = tacSchedule(fresh).total;
    run.turns[s.side]++;
    run.play += play;
    run.secs += play + decide(s);
    // Who laid what: a turn's harm of the captain's moves (orders, innate, ultimate) against her blows.
    for (const e of fresh) if ((e.k === 'spell' || e.k === 'innate' || e.k === 'ult') && e.side !== undefined) {
      const k = e.k === 'spell' ? String(e.id) : e.k;
      run.moves[e.side][k] = (run.moves[e.side][k] ?? 0) + 1;
    }
    for (const x of [0, 1] as const) run.harm[1 - x] += Math.max(0, hp0[x] - hpSide(bt, x));
    if (!r1done && (bt.round > 1 || bt.over)) {
      r1done = true;
      run.cut1 = [Math.max(0, start[0] - hpSide(bt, 0)) / Math.max(1, start[0]), Math.max(0, start[1] - hpSide(bt, 1)) / Math.max(1, start[1])];
    }
  }
  run.rounds = bt.round;
  run.winner = bt.over?.winner ?? 1;
  run.why = bt.over?.why ?? 'open';
  return run;
}

export interface BandStat { L: number; pvp: boolean; n: number; rounds: number; mins: number; cut1: number; win: number; turns: number; play: number; flags: number }

/** Battles at level L (every pairing of the six paths `n` times over): the mean rounds, minutes, round-1 cut (of an
 *  equal army, both sides) and the boarder's wins. */
export function bandStat(L: number, pvp: boolean, n: number): BandStat {
  let k = 0, rounds = 0, secs = 0, cut = 0, win = 0, turns = 0, play = 0, flags = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < PATHS.length; j++) {
    const p = PATHS[j], q = PATHS[(j + i) % PATHS.length];
    const [a, b] = sidesAt(L, pvp, p, q, i * 7 + j);
    const r = playBoard(a, b, i * 31 + j * 5 + L);
    k++;
    rounds += r.rounds;
    secs += r.secs;
    cut += pvp ? (r.cut1[0] + r.cut1[1]) / 2 : r.cut1[1];
    win += r.winner === 0 ? 1 : 0;
    turns += r.turns[0] + r.turns[1];
    play += r.play;
    if (r.why === 'flag') flags++;
  }
  return { L, pvp, n: k, rounds: rounds / k, mins: secs / k / 60, cut1: cut / k, win: win / k, turns: turns / k, play: play / k, flags: flags / k };
}
