// docs/19 E14, the Colosseum: rated hero battles in the manner of HoMM3 HotA's tournaments — equal armies by a draft,
// three bans on kinds each, nothing grown or bought on the field. What both the server and the screens read.
//
//  - The table: ARENA_POOL's kinds, each one lot (a stack of so many men at a price in draft points). Each captain bans
//    three kinds (BAN_ORDER), then they pick lots by turns (PICK_ORDER, a snake), a lot to the one who takes it, seven
//    stacks at the most, within ARENA_BUDGET points. A lot's men are as many as its price buys of the kind's battle
//    weight (armyWeight's square law, with the kind's own measure ARENA_CAL set by the bouts themselves: tools/
//    balance-arena.ts), and the points a captain leaves unspent reinforce the stacks she took — so both armies always
//    weigh the same, and the draft decides only what they are made of and who gets which lot.
//  - The hero: a fixed template on her own path (ARENA_SKILLS, arenaHero): the path's standard primaries at the cap, the
//    same eight battle skills at expert for everyone, her path's book, innate move and ultimate, a full store of will.
//    No artifacts, glory, mastery, grandmasters, talents, officers or hull gifts.
//  - The rating: Elo, a season's table (the calendar's, seasons.ts), its rewards at the season's end.

import { MAX_LEVEL } from '../constants.ts';
import { UNITS, armyWeight, hasSpecial } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import type { CaptainId } from './captains.ts';
import { PRIMS, PRIM_BASE, PRIM_WEIGHTS, heroBattle, manaMaxOf, startingOrders } from './hero.ts';
import type { HeroBattle, Prims, SkillId } from './hero.ts';
import { mixMorale } from './drifts.ts';
import type { Rng } from '../rng.ts';

export type Tr = [string, string];

/** The Colosseum opens to captains of the cap (its tab is the Throne's; its season pays in glory). */
export const ARENA_LEVEL = MAX_LEVEL;
/** Draft points a captain spends. */
export const ARENA_BUDGET = 100;
/** Stacks a captain takes at the most (a hull's seven slots). */
export const ARENA_SLOTS = 7;
/** Kinds each captain bans. */
export const ARENA_BANS = 3;
/** Seconds a captain has for a ban or a pick (then the Colosseum's steward takes it for her). */
export const ARENA_TURN = 20;
/** Seconds the sea's side (a legend at practice) thinks over a ban or a pick. */
export const ARENA_AI_TURN = 1.6;
/** Seconds in the queue before a legend of the sea comes to spar instead (an unrated practice bout). */
export const ARENA_WAIT = 45;
/** Rated bouts the same two captains may fight a day (more are friendly: no rating). */
export const ARENA_PAIR_DAY = 3;

/** The men of the seven tiers, plain and upgraded, and eight of the land's creatures (none that dives: the sand of the
 *  Colosseum has no surf). */
export const ARENA_MEN: UnitId[] = ['deckhand', 'sailor', 'marine', 'sea_guard', 'musketeer', 'sharpshooter', 'gunner', 'bombardier', 'boarder', 'cutthroat', 'guard', 'life_guard', 'drowned', 'deep_spawn'];
export const ARENA_BEASTS: UnitId[] = ['bilge_rat', 'cave_bat', 'giant_centipede', 'jungle_spider', 'cliff_harpy', 'cultist', 'mangrove_hydra', 'wreck_titan'];
export const ARENA_POOL: UnitId[] = [...ARENA_MEN, ...ARENA_BEASTS];

/** A lot's price by its kind's tier: a high tier is a big share of the budget in one stack. */
export const ARENA_PRICE = [0, 8, 10, 12, 14, 16, 19, 22];
/** A draft point's worth in plain deckhands of battle weight: the hundred points weigh what the ladder's army of ⚓10
 *  does (600 men: armyWeight 1415), the army a hero of the cap leads. */
export const ARENA_POINT = 14.15;
/** Each kind's measure in the Colosseum beside its square-law weight (>1: it fights above its weight, and a lot of it
 *  has fewer men), set by the bouts themselves (`node tools/balance-arena.ts --calibrate`): every kind's pick wins
 *  about half the bouts. */
// docs/25 block Г (2026-10-09): re-set by `balance-arena.ts 1200 --calibrate 3` under the boarding's reckoning of Attack and
// Defense, guards and orders (items 45–47): the shooters weigh more, the life guard's and the titans' walls less.
export const ARENA_CAL: Partial<Record<UnitId, number>> = {
  deckhand: 0.71, sailor: 0.77, marine: 0.82, sea_guard: 0.9, musketeer: 1.1, sharpshooter: 1.33, gunner: 1.07,
  bombardier: 1, boarder: 0.96, cutthroat: 0.96, guard: 1.12, life_guard: 0.99, drowned: 0.97, deep_spawn: 1.21,
  bilge_rat: 0.99, cave_bat: 0.88, giant_centipede: 0.94, jungle_spider: 1.09, cliff_harpy: 0.81, cultist: 1.13,
  mangrove_hydra: 1.11, wreck_titan: 0.88,
};

/** One man of a kind's battle weight in plain deckhands (armyWeight's square law). */
const manWeight = (u: UnitId): number => armyWeight([{ u, n: 1 }]);

export interface ArenaLot {
  u: UnitId;
  n: number;
  price: number;
}

/** A kind's lot on the table: its price by tier, its men as many as the price buys. */
export function arenaLot(u: UnitId): ArenaLot {
  const price = ARENA_PRICE[Math.max(1, Math.min(7, UNITS[u]?.tier ?? 1))];
  const n = Math.max(1, Math.round((price * ARENA_POINT) / (manWeight(u) * (ARENA_CAL[u] ?? 1))));
  return { u, n, price };
}

// ------------------------------------------------------------------ the draft

/** Who bans when (seat 0 first), and who picks when (seat 1 first, then by twos: a snake), repeating. */
export const BAN_ORDER: (0 | 1)[] = [0, 1, 0, 1, 0, 1];
export const PICK_ORDER: (0 | 1)[] = [1, 0, 0, 1];

export interface Draft {
  /** The kinds on the table this bout. */
  pool: UnitId[];
  bans: [UnitId[], UnitId[]];
  picks: [UnitId[], UnitId[]];
  /** A side that has said «Done», or can take nothing more. */
  done: [boolean, boolean];
  /** The place in PICK_ORDER (it runs on past a side that is done). */
  pos: number;
}

export type DraftStage = 'ban' | 'pick' | 'done';
export interface DraftAction {
  op: 'ban' | 'pick' | 'pass';
  u?: UnitId;
}

export function newDraft(pool: readonly UnitId[] = ARENA_POOL): Draft {
  return { pool: [...pool], bans: [[], []], picks: [[], []], done: [false, false], pos: 0 };
}

/** Points a side has spent, and has left. */
export const draftSpent = (d: Draft, side: 0 | 1): number => d.picks[side].reduce((n, u) => n + arenaLot(u).price, 0);
export const draftLeft = (d: Draft, side: 0 | 1): number => ARENA_BUDGET - draftSpent(d, side);

/** The kinds still on the table (not banned, not taken). */
export function draftOpen(d: Draft): UnitId[] {
  const gone = new Set([...d.bans[0], ...d.bans[1], ...d.picks[0], ...d.picks[1]]);
  return d.pool.filter((u) => !gone.has(u));
}

/** The lots a side may take now (open, within her points, a slot free). */
export function draftAffordable(d: Draft, side: 0 | 1): UnitId[] {
  if (d.picks[side].length >= ARENA_SLOTS) return [];
  const left = draftLeft(d, side);
  return draftOpen(d).filter((u) => arenaLot(u).price <= left);
}

/** Whose turn it is, and to do what. */
export function draftTurn(d: Draft): { stage: DraftStage; side: 0 | 1 } {
  const nb = d.bans[0].length + d.bans[1].length;
  if (nb < BAN_ORDER.length) return { stage: 'ban', side: BAN_ORDER[nb] };
  if (d.done[0] && d.done[1]) return { stage: 'done', side: 0 };
  return { stage: 'pick', side: PICK_ORDER[d.pos % PICK_ORDER.length] };
}

/** A side that can take nothing more is done; the turn runs on past a side that is done. */
function settle(d: Draft): void {
  if (d.bans[0].length + d.bans[1].length < BAN_ORDER.length) return;
  for (const s of [0, 1] as const) if (!d.done[s] && !draftAffordable(d, s).length) d.done[s] = true;
  if (d.done[0] && d.done[1]) return;
  for (let guard = 0; guard < 8 && d.done[PICK_ORDER[d.pos % PICK_ORDER.length]]; guard++) d.pos++;
}

/** A side's ban, pick or «Done». Null when done; else why not. */
export function draftAct(d: Draft, side: 0 | 1, a: DraftAction): string | null {
  const t = draftTurn(d);
  if (t.stage === 'done') return 'The draft is over.';
  if (t.side !== side) return 'Not your turn.';
  if (a.op === 'ban') {
    if (t.stage !== 'ban') return 'The bans are over: pick.';
    if (!a.u || !draftOpen(d).includes(a.u)) return 'That kind is not on the table.';
    d.bans[side].push(a.u);
    settle(d);
    return null;
  }
  if (t.stage !== 'pick') return 'Ban first.';
  if (a.op === 'pass') {
    if (!d.picks[side].length) return 'Take one lot at least.';
    d.done[side] = true;
    d.pos++;
    settle(d);
    return null;
  }
  if (a.op !== 'pick' || !a.u) return 'No such move.';
  if (!draftOpen(d).includes(a.u)) return 'That lot is gone.';
  if (d.picks[side].length >= ARENA_SLOTS) return 'Seven stacks at the most.';
  if (arenaLot(a.u).price > draftLeft(d, side)) return 'Not enough points for that lot.';
  d.picks[side].push(a.u);
  d.pos++;
  settle(d);
  return null;
}

/** A side's army from her draft: each lot's men, the points left unspent laid on them all alike (so both armies weigh
 *  the same). A side that took nothing fights with the budget's worth of deckhands. */
export function draftArmy(d: Draft, side: 0 | 1): ArmyStack[] {
  const picks = d.picks[side];
  if (!picks.length) return [{ u: 'deckhand', n: Math.round((ARENA_BUDGET * ARENA_POINT) / manWeight('deckhand')) }];
  const spent = Math.max(1, draftSpent(d, side));
  const k = ARENA_BUDGET / spent;
  return picks.map((u) => ({ u, n: Math.max(1, Math.round(arenaLot(u).n * k)) }));
}

// ------------------------------------------------------------------ the steward's hand (the sea's side, a captain's turn run out)

/** How each kind has fared in the bouts (the share of bouts won by the side that took it in the dice's drafts,
 *  `node tools/balance-arena.ts 8000 --fame`): what a steward who has watched the Colosseum knows, and bans by. Absent:
 *  an even half. */
export const ARENA_FAME: Partial<Record<UnitId, number>> = {
  deckhand: 0.49, sailor: 0.5, marine: 0.5, sea_guard: 0.51, musketeer: 0.49, sharpshooter: 0.49, gunner: 0.51, bombardier: 0.5, boarder: 0.49, cutthroat: 0.49, guard: 0.49,
  life_guard: 0.48, drowned: 0.51, deep_spawn: 0.51, bilge_rat: 0.5, cave_bat: 0.49, giant_centipede: 0.49, jungle_spider: 0.49, cliff_harpy: 0.51, cultist: 0.5,
  mangrove_hydra: 0.48, wreck_titan: 0.52,
};

const isShooterKind = (u: UnitId): boolean => hasSpecial(u, 'shooter');
const isSwift = (u: UnitId): boolean => hasSpecial(u, 'flying') || (UNITS[u]?.speed ?? 0) >= 6;

/** How much a side would like a lot now: the kind's fame, a line of steel before two shooters at the most, swift ones
 *  against shooters, one people (a mixed army's heart is lower), the big lots early. */
export function lotWish(d: Draft, side: 0 | 1, u: UnitId, path: CaptainId | null): number {
  const mine = d.picks[side], theirs = d.picks[1 - side];
  let v = 2 * (ARENA_FAME[u] ?? 0.5);
  const shooters = mine.filter(isShooterKind).length;
  if (isShooterKind(u)) v += shooters < 2 ? 0.12 : -0.2;
  else if (mine.length - shooters < 2) v += 0.05;
  if (theirs.filter(isShooterKind).length >= 2 && isSwift(u)) v += 0.08;
  const army = (list: readonly UnitId[]) => list.map((x) => ({ u: x, n: 1 }));
  v += 0.1 * (mixMorale(army([...mine, u]), path) - mixMorale(army(mine), path));
  v += 0.004 * arenaLot(u).price * (1 - mine.length / ARENA_SLOTS);
  return v;
}

/** The steward's (or a legend's) move for a side: a ban of a kind the Colosseum has seen win most, the lot she likes
 *  most, a little of the dice in both (`care` 0: by the dice alone — the random drafter of the sims). */
export function draftChoice(d: Draft, side: 0 | 1, rng: Rng, path: CaptainId | null, care = 1): DraftAction {
  const t = draftTurn(d);
  const best = (list: UnitId[], score: (u: UnitId) => number, noise = 0.12): UnitId => {
    let top = list[0], tv = -Infinity;
    for (const u of list) {
      const v = care > 0 ? score(u) + rng.float() * noise / care : rng.float();
      if (v > tv) {
        tv = v;
        top = u;
      }
    }
    return top;
  };
  if (t.stage === 'ban') {
    const open = draftOpen(d);
    // The kinds stand near even (ARENA_CAL): what it has seen win is a leaning, not a certainty.
    return { op: 'ban', u: best(open, (u) => 2 * (ARENA_FAME[u] ?? 0.5), 0.5) };
  }
  const can = draftAffordable(d, side);
  if (!can.length) return { op: 'pass' };
  return { op: 'pick', u: best(can, (u) => lotWish(d, side, u, path)) };
}

// ------------------------------------------------------------------ the hero

/** The eight battle skills every hero of the Colosseum has at expert. */
export const ARENA_SKILLS: SkillId[] = ['boarding', 'armor', 'artillery', 'leadership', 'tactics', 'luck', 'first_aid', 'mysticism'];

/** Each path's weight on the sand: points of its primaries more (or fewer) than its standard ones, so that every pair
 *  of paths stands near even in the Colosseum as HotA's tournaments even out their heroes (`node tools/balance-arena.ts
 *  400 --pairs`; the paths' own books, innate moves and ultimates stay theirs). A point of Attack or Defence is about
 *  three bouts in a hundred. The admiral's Defence goes into Attack: Defence blunts only blows and shots, never an
 *  order's damage, so her wall of 28 held off the paths of steel and not the Drowned's orders (they took 57 % of her
 *  bouts with the means even). The smuggler and the navigator, of the same standard primaries, stand on the same.
 *  docs/25 block Г (2026-10-09): re-set under the boarding's reckoning of Attack and Defense, guards and orders (items
 *  45–47: +100% and −50% at most, the common orders to ×3) by `balance-arena.ts 60 --paths 6` and a step on the test's
 *  own table: the pairs at 45–59%, the means 48–55%.
 *  docs/25 block Д (2026-10-09): re-set again for the paths' own knobs (items 53–61: a page's share no longer fades by
 *  60, a path's blows land her level's boarding share on the sand too, the Reaver evened out, the dead pages alive) by
 *  `balance-arena.ts 200 --paths 6` and a point of Attack and Defence to the corsair after `--pairs` at 400 bouts a cell:
 *  the means 48–52%, the pairs 41.5–57% (the smuggler against the reaver the lowest) — before it
 *  the corsair stood at 20% and against the admiral at 8%. */
export const ARENA_PATH: Partial<Record<CaptainId, Partial<Prims>>> = {
  corsair: { atk: 1, def: 0 }, smuggler: { atk: 2, def: 1 }, reaver: { atk: 0, def: -1 }, navigator: { atk: 2, def: 2 }, drowned: { atk: 3, def: 1 }, admiral: { atk: 3, def: -4 },
};

/** A path's standard primaries at the cap: its start and its odds over the level-ups, whole points by the largest
 *  remainders (no dice: every captain of a path the same), and its weight on the sand (ARENA_PATH). */
export function arenaPrims(path: CaptainId): Prims {
  const base = PRIM_BASE[path], w = PRIM_WEIGHTS[path];
  const ups = MAX_LEVEL - 1;
  const tot = PRIMS.reduce((n, k) => n + w[k], 0);
  const raw = PRIMS.map((k) => (ups * w[k]) / tot);
  const whole = raw.map(Math.floor);
  let rest = ups - whole.reduce((a, b) => a + b, 0);
  for (const i of PRIMS.map((_, i) => i).sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])) || a - b)) {
    if (rest <= 0) break;
    whole[i]++;
    rest--;
  }
  const out = { ...base };
  const sand = ARENA_PATH[path];
  PRIMS.forEach((k, i) => (out[k] = Math.max(0, out[k] + whole[i] + Math.round(sand?.[k] ?? 0))));
  return out;
}

/** The hero of the Colosseum on a path: its standard primaries, the eight skills at expert, its book, a full store. */
export function arenaHero(path: CaptainId): HeroBattle {
  const prim = arenaPrims(path);
  return heroBattle(prim, ARENA_SKILLS.map((id) => ({ id, r: 3 as const })), null, startingOrders(path), manaMaxOf(prim.will), { path, level: MAX_LEVEL });
}

// ------------------------------------------------------------------ the rating

export const ARENA_START = 1000;
/** Elo's step, and the larger one of a captain's first bouts of the season (her place found sooner). */
export const ARENA_K = 32;
export const ARENA_K_NEW = 48;
export const ARENA_PLACEMENT = 10;

/** Her rating's change for a bout won or lost against a captain of `theirs` (her own step by her bouts). */
export function eloShift(mine: number, theirs: number, won: boolean, bouts: number): number {
  const k = bouts < ARENA_PLACEMENT ? ARENA_K_NEW : ARENA_K;
  const exp = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(k * ((won ? 1 : 0) - exp));
}

/** How far apart two ratings may be matched after `waited` seconds in the queue (the wider the longer). */
export const matchGap = (waited: number): number => 150 + 10 * Math.max(0, waited);

// ------------------------------------------------------------------ the season's rewards

/** Rated bouts a captain needs in a season for its rewards. */
export const ARENA_MIN_BOUTS = 10;
export const ARENA_TITLE: Tr = ['Champion of the Colosseum', 'Чемпион Колизея'];
export const ARENA_TITLE_TOP: Tr = ['Gladiator of the Colosseum', 'Гладиатор Колизея'];
export const ARENA_PENNANT = '#a8763e';

export interface ArenaReward {
  /** Places (from, to) on the season's table, or a rating at the least. */
  places?: [number, number];
  rating?: number;
  title?: Tr;
  pennant?: boolean;
  /** Glory in ranks of her own (gloryXp), and silver in hours at sea of ⚓10 (seaHourOf). */
  glory: number;
  hours: number;
}

/** The season's rewards, the first row that fits a captain of ARENA_MIN_BOUTS rated bouts. */
export const ARENA_REWARDS: ArenaReward[] = [
  { places: [1, 1], title: ARENA_TITLE, pennant: true, glory: 1, hours: 2 },
  { places: [2, 3], pennant: true, glory: 0.6, hours: 1.5 },
  { places: [4, 10], title: ARENA_TITLE_TOP, glory: 0.4, hours: 1 },
  { rating: 1100, glory: 0.2, hours: 0.5 },
  { glory: 0, hours: 0.25 },
];

export function arenaReward(place: number, rating: number): ArenaReward {
  return ARENA_REWARDS.find((r) => (r.places ? place >= r.places[0] && place <= r.places[1] : r.rating === undefined || rating >= r.rating))!;
}

// ------------------------------------------------------------------ what the screens see

export interface ArenaSeatView {
  name: string;
  path: CaptainId;
  /** Her rating (none: a legend of the sea at practice). */
  rating?: number;
  ai?: boolean;
}

export interface ArenaDraftView {
  you: 0 | 1;
  seats: [ArenaSeatView, ArenaSeatView];
  pool: ArenaLot[];
  bans: [UnitId[], UnitId[]];
  picks: [UnitId[], UnitId[]];
  left: [number, number];
  done: [boolean, boolean];
  /** 'fight': the draft is over and the bout is on the sand. */
  stage: DraftStage | 'fight';
  turn: 0 | 1;
  /** World seconds the turn runs out. */
  until: number;
  rated: boolean;
  practice: boolean;
}

export interface ArenaRow {
  name: string;
  rating: number;
  bouts: number;
  wins: number;
  you?: boolean;
}

export interface ArenaView {
  rating: number;
  bouts: number;
  wins: number;
  best: number;
  /** Her place on the season's table (0: no rated bout yet). */
  place: number;
  season: number;
  /** Wall ms the season ends. */
  ends: number;
  /** In the queue since (world seconds), and how many captains wait in it. */
  queue?: { since: number; n: number };
  draft?: ArenaDraftView;
  /** Why she may not join the queue now (null: she may). */
  why: string | null;
  table: ArenaRow[];
  champion?: { name: string; season: number };
  /** Her last bout: won, the rating's change, the foe, practice. */
  last?: { won: boolean; delta: number; foe: string; practice?: boolean };
}

/** The result of a bout on the battle's own end screen (protocol TacView.result.arena). */
export interface ArenaResult {
  rated: boolean;
  practice: boolean;
  rating: number;
  delta: number;
}

/** The server's words of the Colosseum, English → Russian (the titles it hands out). */
export function arenaPatterns(): [string, string][] {
  return [ARENA_TITLE, ARENA_TITLE_TOP];
}
