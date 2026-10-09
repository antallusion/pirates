// docs/19 E14 on the server: the Colosseum's tournament (shared/src/data/arena.ts holds its rules).
//  - The queue: a captain of the cap joins it from the Throne's tab, anywhere at sea (no voyage to a quay to wait in
//    a line: the phone is the arena's door). Two captains are matched by their ratings, the gap allowed growing the
//    longer they wait; one alone for ARENA_WAIT seconds is met by a legend of the sea for an unrated practice bout,
//    drafted the same way (and a practice bout may be asked for at once).
//  - The draft: three bans each, then the lots by turns within the budget (draftAct); a turn run out, or a captain gone,
//    is taken by the Colosseum's steward (draftChoice); the legend's own turns after a breath.
//  - The bout: both ships stop where they are and the battle is laid out on the sand of the Colosseum (tacbattle.ts
//    makeArenaField) with the drafted armies and the template heroes (tactical.ts startTactical asks arenaSetup); the
//    ships stay apart, nobody else may touch them while it lasts (they are in a boarding), nothing of either ship —
//    her men, her will, her officers, her hull — is touched by it, and it pays nothing of the sea's (tactical.ts settle
//    hands the end to arenaSettle). Practice: a legend's ship comes alongside, as a trial's does (throne.ts startTrial).
//  - The rating: Elo (eloShift), a season's table (the calendar's season, seasons.ts), the same two captains rated
//    ARENA_PAIR_DAY times a day at the most; at the season's end its rewards to everyone with ARENA_MIN_BOUTS rated
//    bouts (glory, silver by the hour at sea, the title and the pennant), the champion into the Pantheon (the Hall of
//    the Colosseum) and the chronicle.
// Every roll is on this system's own Rng; the clock is the game's wall clock (the season, the day) and world time
// (the turns).

import {
  ARENA_AI_TURN, ARENA_LEVEL, ARENA_MIN_BOUTS, ARENA_PAIR_DAY, ARENA_PENNANT, ARENA_START, ARENA_TURN, ARENA_WAIT, arenaHero, arenaLot, arenaReward, draftAct,
  draftArmy, draftChoice, draftLeft, draftTurn, eloShift, matchGap, newDraft,
} from '../../../shared/src/data/arena.ts';
import type { ArenaDraftView, ArenaResult, ArenaView, Draft, DraftAction, Tr } from '../../../shared/src/data/arena.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { mixMorale } from '../../../shared/src/data/drifts.ts';
import { SKILL_IDS } from '../../../shared/src/data/hero.ts';
import type { SkillId } from '../../../shared/src/data/hero.ts';
import { seaHourOf } from '../../../shared/src/data/seamarks.ts';
import { SEASON_DAYS, SEASON_EPOCH } from '../../../shared/src/data/seasons.ts';
import { LEGENDS, gloryXp } from '../../../shared/src/data/throne.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { ArenaOp } from '../../../shared/src/throneproto.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { inDuel } from './pvp.ts';
import { chronicle } from './renown.ts';
import { seasonId } from './seasons.ts';
import type { BoardFight, BoardingState, ShipEntity } from './ship.ts';
import { act } from './tacbattle.ts';
import type { TacSideInput } from './tacbattle.ts';
import { startTactical } from './tactical.ts';

const KEY = 'arena';
const DAY = 86_400_000;

/** A captain's season on the table. */
interface Row {
  name: string;
  path: CaptainId;
  r: number;
  n: number;
  w: number;
  best: number;
  at: number;
}

/** A season's reward waiting for her to come aboard. */
interface Owed {
  season: number;
  place: number;
  rating: number;
  glory: number;
  hours: number;
  title?: Tr;
  pennant?: boolean;
  champion?: boolean;
}

interface Store {
  v: 1;
  season: number;
  /** Seasons the tester has closed ahead of the calendar. */
  shift?: number;
  rows: Record<string, Row>;
  /** Rated bouts between two captains today (`a:b` by account, the lower first). */
  pairs: { day: number; n: Record<string, number> };
  champion?: { acc: number; name: string; season: number; rating: number };
  hall: { acc: number; name: string; season: number; rating: number }[];
  owed: Record<string, Owed[]>;
}

/** One side of a bout: a captain, or (acc null) a legend of the sea at practice. */
interface Seat {
  acc: number | null;
  name: string;
  path: CaptainId;
  rating: number;
  bouts: number;
  legend?: SkillId;
}

interface Bout {
  id: number;
  seats: [Seat, Seat];
  draft: Draft;
  /** World seconds the turn runs out. */
  until: number;
  rated: boolean;
  practice: boolean;
  stage: 'draft' | 'fight' | 'done';
  seed: number;
  /** The ships of the two sides once on the sand (seat 0 the boarder's side). */
  ships?: [number, number];
  result?: [ArenaResult, ArenaResult];
  winner?: 0 | 1;
}

interface Live {
  /** Who waits, since when (world seconds). */
  queue: Map<number, number>;
  bouts: Map<number, Bout>;
  of: Map<number, Bout>;
  seq: number;
  last: Map<number, NonNullable<ArenaView['last']>>;
}

const rngs = new WeakMap<Game, Rng>();
function ar(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0xa7e4a001)));
  return r;
}

const lives = new WeakMap<Game, Live>();
function live(game: Game): Live {
  let l = lives.get(game);
  if (!l) lives.set(game, (l = { queue: new Map(), bouts: new Map(), of: new Map(), seq: 0, last: new Map() }));
  return l;
}

/** The Colosseum's season: the calendar's, and as many more as the tester has closed. */
const arenaSeason = (game: Game, S: Store): number => seasonId(game) + (S.shift ?? 0);

const stores = new WeakMap<Game, Store>();
function store(game: Game): Store {
  let s = stores.get(game);
  if (s) return s;
  s = game.db.getKv<Store>(KEY) ?? undefined;
  if (!s || s.v !== 1 || typeof s.rows !== 'object') s = { v: 1, season: seasonId(game), rows: {}, pairs: { day: 0, n: {} }, hall: [], owed: {} };
  s.pairs ??= { day: 0, n: {} };
  s.hall ??= [];
  s.owed ??= {};
  stores.set(game, s);
  return s;
}
const save = (game: Game) => {
  const S = stores.get(game)!;
  tables.delete(S);
  game.db.setKv(KEY, S);
};

/** The fights that are bouts of the Colosseum, and the legends' ships at practice. */
const fights = new WeakMap<BoardFight, Bout>();
const legends = new WeakMap<ShipEntity, Bout>();
export const isArenaFight = (fight: BoardFight | null | undefined): boolean => !!fight && fights.has(fight);
/** A legend of the sea at practice (throne.ts isTrialShip: no artifact on her, none of hers joins). */
export const isArenaLegend = (ship: ShipEntity): boolean => legends.has(ship);

const rowOf = (S: Store, acc: number): Row | undefined => S.rows[acc];
const ratingOf = (S: Store, acc: number): number => S.rows[acc]?.r ?? ARENA_START;

// ------------------------------------------------------------------ who may come

/** Why she may not join the queue (or come to the sand) now; `fire`: under fire counts. */
function whyNot(game: Game, s: PlayerSession, fire = true): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || p.level < ARENA_LEVEL) return `The Colosseum opens at level ${ARENA_LEVEL}.`;
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not in the middle of a boarding';
  if (inDuel(game, ship)) return 'Not in the middle of a duel.';
  if (p.company.mutiny) return 'The crew holds the ship';
  if (live(game).of.has(s.accountId)) return 'Your bout is under way.';
  if (fire && ship.underFire(game.now)) return 'Not while under fire';
  return null;
}

export function arenaQueue(game: Game, s: PlayerSession): string | null {
  const L = live(game);
  if (L.queue.has(s.accountId)) return 'You are in the queue already.';
  const why = whyNot(game, s);
  if (why) return why;
  L.queue.set(s.accountId, game.now);
  game.sendTo(s, { t: 'toast', msg: `You join the queue of the Colosseum. If no captain comes within ${ARENA_WAIT} s, a legend of the sea will spar with you.`, kind: 'info' });
  return null;
}

export function arenaLeave(game: Game, s: PlayerSession): string | null {
  if (!live(game).queue.delete(s.accountId)) return 'You are not in the queue.';
  return null;
}

// ------------------------------------------------------------------ the draft

function seatOf(game: Game, s: PlayerSession): Seat {
  const S = store(game);
  const row = rowOf(S, s.accountId);
  return { acc: s.accountId, name: s.name, path: s.profile!.captain, rating: row?.r ?? ARENA_START, bouts: row?.n ?? 0 };
}

const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
function pairsToday(game: Game, a: number, b: number): number {
  const S = store(game);
  const day = Math.floor(game.wallNow() / DAY);
  if (S.pairs.day !== day) S.pairs = { day, n: {} };
  return S.pairs.n[pairKey(a, b)] ?? 0;
}

function newBout(game: Game, seats: [Seat, Seat], rated: boolean, practice: boolean): Bout {
  const L = live(game);
  const b: Bout = { id: ++L.seq, seats, draft: newDraft(), until: 0, rated, practice, stage: 'draft', seed: ar(game).int(1, 1e9) };
  L.bouts.set(b.id, b);
  for (const x of seats) if (x.acc !== null) {
    L.of.set(x.acc, b);
    L.queue.delete(x.acc);
  }
  turnClock(game, b);
  return b;
}

/** Two captains matched: the draft opens for both. */
function startDraft(game: Game, a: PlayerSession, b: PlayerSession): void {
  const rated = pairsToday(game, a.accountId, b.accountId) < ARENA_PAIR_DAY;
  const pair: [Seat, Seat] = ar(game).chance(0.5) ? [seatOf(game, a), seatOf(game, b)] : [seatOf(game, b), seatOf(game, a)];
  const bout = newBout(game, pair, rated, false);
  for (const [me, foe] of [[a, b], [b, a]] as const) {
    const r = Math.round(bout.seats.find((x) => x.acc === foe.accountId)!.rating);
    game.sendTo(me, { t: 'toast', msg: rated ? `The Colosseum: ${foe.name} (rating ${r}) is your match. Ban three kinds, then draft your army.` : `The Colosseum: ${foe.name} again — a friendly bout, the rating stands.`, kind: 'gold' });
    game.pushSelf(me, true);
  }
}

/** A legend of the sea comes to spar: an unrated practice bout, drafted the same way. */
function startPractice(game: Game, s: PlayerSession): void {
  const rng = ar(game);
  const id = SKILL_IDS[rng.int(0, SKILL_IDS.length - 1)];
  const lg = LEGENDS[id];
  const legend: Seat = { acc: null, name: lg.name[0], path: lg.path, rating: ARENA_START, bouts: 0, legend: id };
  const mine = seatOf(game, s);
  newBout(game, rng.chance(0.5) ? [mine, legend] : [legend, mine], false, true);
  game.sendTo(s, { t: 'toast', msg: `${lg.name[0]} comes to spar on the sand of the Colosseum: a practice bout, the rating stands. Ban three kinds, then draft your army.`, kind: 'gold' });
  game.pushSelf(s, true);
}

export function arenaPractice(game: Game, s: PlayerSession): string | null {
  const why = whyNot(game, s);
  if (why) return why;
  live(game).queue.delete(s.accountId);
  startPractice(game, s);
  return null;
}

/** A seat the steward plays: a legend, or a captain no longer aboard. */
const stewarded = (game: Game, x: Seat): boolean => x.acc === null || !game.sessionByAccount(x.acc);

/** The turn's clock: a captain's ARENA_TURN, a legend's (or a captain gone's) breath. */
function turnClock(game: Game, b: Bout): void {
  const t = draftTurn(b.draft);
  b.until = game.now + (t.stage === 'done' ? 0 : stewarded(game, b.seats[t.side]) ? ARENA_AI_TURN : ARENA_TURN);
}

function pushBout(game: Game, b: Bout): void {
  for (const x of b.seats) {
    const s = x.acc !== null ? game.sessionByAccount(x.acc) : null;
    if (s) game.pushSelf(s, true);
  }
}

/** A move of the draft made: the clock again, or the bout begins. */
function advance(game: Game, b: Bout): void {
  if (draftTurn(b.draft).stage === 'done') beginBout(game, b);
  else turnClock(game, b);
  pushBout(game, b);
}

/** Her ban, pick or «Done» in her bout's draft. */
export function arenaDraft(game: Game, s: PlayerSession, op: ArenaOp, u?: string): string | null {
  const b = live(game).of.get(s.accountId);
  if (!b || b.stage !== 'draft') return 'You are not drafting.';
  const side = b.seats[0].acc === s.accountId ? 0 : 1;
  const a: DraftAction = { op: op === 'ban' ? 'ban' : op === 'pass' ? 'pass' : 'pick', ...(u ? { u: u as UnitId } : {}) };
  const why = draftAct(b.draft, side, a);
  if (why) return why;
  advance(game, b);
  return null;
}

/** The steward's (or the legend's) move for the side whose turn ran out. */
function stewardMove(game: Game, b: Bout): void {
  const t = draftTurn(b.draft);
  if (t.stage === 'done') return;
  const seat = b.seats[t.side];
  const a = draftChoice(b.draft, t.side, ar(game), seat.path, 1);
  if (draftAct(b.draft, t.side, a) && draftAct(b.draft, t.side, { op: 'pass' })) {
    // Nothing she may take and no «Done» either (no lot yet): the cheapest open lot.
    const open = b.draft.pool.filter((u) => !b.draft.bans.flat().includes(u) && !b.draft.picks.flat().includes(u)).sort((x, y) => arenaLot(x).price - arenaLot(y).price);
    if (open[0]) draftAct(b.draft, t.side, { op: 'pick', u: open[0] });
  }
  if (seat.acc !== null && !stewarded(game, seat)) {
    const s = game.sessionByAccount(seat.acc);
    if (s) game.sendTo(s, { t: 'toast', msg: 'Your time ran out: the steward of the Colosseum chose for you.', kind: 'info' });
  }
  advance(game, b);
}

// ------------------------------------------------------------------ the bout

/** A bout called off before the sand (a captain cannot come): nobody's rating moves. */
function callOff(game: Game, b: Bout, who: string | null): void {
  b.stage = 'done';
  forget(game, b);
  for (const x of b.seats) {
    const s = x.acc !== null ? game.sessionByAccount(x.acc) : null;
    if (!s) continue;
    if (who) game.sendTo(s, { t: 'toast', msg: `The bout is called off: ${who} cannot come to the sand. The rating stands.`, kind: 'bad' });
    else game.sendTo(s, { t: 'toast', msg: 'The bout is called off. The rating stands.', kind: 'bad' });
    game.pushSelf(s, true);
  }
}

function forget(game: Game, b: Bout): void {
  const L = live(game);
  L.bouts.delete(b.id);
  for (const x of b.seats) if (x.acc !== null && L.of.get(x.acc) === b) L.of.delete(x.acc);
}

/** Both ships held in the bout's fight (a boarding to the rest of the sea: nobody else may touch them), apart. */
function lock(game: Game, A: ShipEntity, B: ShipEntity, b: Bout): void {
  const now = game.now;
  const fight: BoardFight = { round: 0, opened: now, deadline: now + 3600, log: [], last: null, fires: 0, duel: null, duelDone: true, endsAt: null, winner: null };
  const st = (other: ShipEntity, attacker: boolean, me: ShipEntity): BoardingState => ({
    with: other.id, attacker, aggression: 'standard', startedAt: now, nextRound: now + 3600, rounds: 0, startCrew: me.crew, enemyStartCrew: other.crew, killed: 0, lost: 0,
    fight, pick: null, lastPick: null, momentum: 0, won: 0, lostRounds: 0, moves: 0,
  });
  for (const x of [A, B]) {
    x.state.speed = 0;
    x.input = { rudder: 0, sailTarget: 0 };
    x.repairing = false;
  }
  A.boarding = st(B, true, A);
  B.boarding = st(A, false, B);
  fights.set(fight, b);
  b.ships = [A.id, B.id];
}

/** The draft is over: the ships stop, the battle is laid out on the sand. */
function beginBout(game: Game, b: Bout): void {
  const ships: (ShipEntity | null)[] = [null, null];
  let player: ShipEntity | null = null;
  for (const k of [0, 1] as const) {
    const x = b.seats[k];
    if (x.acc === null) continue;
    const s = game.sessionByAccount(x.acc);
    const why = s ? whyNot(game, s, false) : 'gone';
    // Her own bout is not a reason against it.
    if (!s || (why && why !== 'Your bout is under way.')) return callOff(game, b, x.name);
    ships[k] = player = s.ship!;
  }
  if (b.practice && player) {
    // The legend's ship comes alongside (throne.ts startTrial's way).
    const k = b.seats[0].acc === null ? 0 : 1;
    const lg = LEGENDS[b.seats[k].legend ?? 'boarding'];
    const side = ar(game).chance(0.5) ? 1 : -1;
    const v = headingVec(player.state.heading + (side * Math.PI) / 2);
    const o = game.spawnNpcShip('hunter', player.loadout.classId, 'free', player.state.x + v.x * 18, player.state.y + v.y * 18, player.state.heading, { ship: lg.ship[0], captain: lg.name[0] });
    game.setNpcLevel(o, player.shipLevel);
    o.god = true;
    o.morale = 85;
    o.purse = 0;
    o.input = { rudder: 0, sailTarget: 0 };
    const brain = game.npcs.get(o.id);
    if (brain) brain.active = true;
    game.grid.upsert(o.id, o.state.x, o.state.y);
    legends.set(o, b);
    ships[k] = o;
  }
  const [A, B] = ships;
  if (!A || !B) return callOff(game, b, null);
  b.stage = 'fight';
  lock(game, A, B, b);
  startTactical(game, A, B);
  for (const x of b.seats) {
    const s = x.acc !== null ? game.sessionByAccount(x.acc) : null;
    if (s) game.sendTo(s, { t: 'toast', msg: 'The draft is done: the bout begins on the sand of the Colosseum.', kind: 'gold' });
  }
}

/** What the battle is laid out from (tactical.ts startTactical): each side's drafted army and its template hero, its
 *  seed — nothing of the ships but their names. Null: not a bout. */
export function arenaSetup(game: Game, a: ShipEntity, b: ShipEntity): { sides: [TacSideInput, TacSideInput]; seed: number } | null {
  const bout = a.boarding ? fights.get(a.boarding.fight) : undefined;
  if (!bout) return null;
  const side = (k: 0 | 1, ship: ShipEntity): TacSideInput => {
    const seat = bout.seats[k];
    const army = draftArmy(bout.draft, k);
    return {
      name: seat.name, ship: ship.name, hull: ship.loadout.classId, captain: seat.path, hands: 0, marines: 0, gunners: 0,
      army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
      extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: seat.acc !== null && !!game.sessionOf(ship),
      holes: 0, gunsOut: 0, fire: false, hero: arenaHero(seat.path), mixed: mixMorale(army, seat.path),
    };
  };
  return { sides: [side(0, a), side(1, b)], seed: bout.seed };
}

/** The bout decided (tactical.ts settle, as the battle ends): the ratings move (a rated bout), the result kept for the
 *  end screen. Nothing of the sea's: no experience, no prize, no man of either ship lost. */
export function arenaSettle(game: Game, fight: BoardFight, winner: 0 | 1): void {
  const b = fights.get(fight);
  if (b) settleBout(game, b, winner);
}

function settleBout(game: Game, b: Bout, winner: 0 | 1): void {
  if (b.result) return;
  b.winner = winner;
  const S = store(game);
  const res: [ArenaResult, ArenaResult] = [0, 1].map((k) => ({ rated: b.rated, practice: b.practice, rating: Math.round(b.seats[k].rating), delta: 0 })) as [ArenaResult, ArenaResult];
  if (b.rated && b.seats[0].acc !== null && b.seats[1].acc !== null) {
    const now = game.wallNow();
    const before = b.seats.map((x) => ratingOf(S, x.acc!));
    for (const k of [0, 1] as const) {
      const x = b.seats[k];
      const row = (S.rows[x.acc!] ??= { name: x.name, path: x.path, r: ARENA_START, n: 0, w: 0, best: ARENA_START, at: now });
      const d = eloShift(before[k], before[1 - k], winner === k, row.n);
      row.r = Math.max(0, row.r + d);
      row.n++;
      if (winner === k) row.w++;
      row.best = Math.max(row.best, row.r);
      row.name = x.name;
      row.path = x.path;
      row.at = now;
      res[k] = { ...res[k], rating: row.r, delta: d };
    }
    const key = pairKey(b.seats[0].acc!, b.seats[1].acc!);
    pairsToday(game, b.seats[0].acc!, b.seats[1].acc!);
    S.pairs.n[key] = (S.pairs.n[key] ?? 0) + 1;
    save(game);
  }
  b.result = res;
  const L = live(game);
  for (const k of [0, 1] as const) {
    const x = b.seats[k];
    if (x.acc !== null) L.last.set(x.acc, { won: winner === k, delta: res[k].delta, foe: b.seats[1 - k].name, ...(b.practice ? { practice: true } : {}) });
  }
}

/** The result of a side of a bout, for its end screen (tactical.ts sendTac). */
export function arenaResultOf(fight: BoardFight, side: 0 | 1): ArenaResult | undefined {
  return fights.get(fight)?.result?.[side];
}
/** The bout's kind for the battle's screen. */
export function arenaTag(fight: BoardFight): { practice: boolean; rated: boolean } | undefined {
  const b = fights.get(fight);
  return b ? { practice: b.practice, rated: b.rated } : undefined;
}

/** The bout's boarding over (boarding.ts finishBoarding, before anything of the sea's): the legend goes, the ships
 *  are their own again, the captains told. True: it was a bout. */
export function arenaOver(game: Game, a: ShipEntity, b: ShipEntity, attackerWins: boolean, fight: BoardFight): boolean {
  const bout = fights.get(fight);
  if (!bout) return false;
  if (!bout.result) arenaSettle(game, fight, attackerWins ? 0 : 1);
  fights.delete(fight);
  finish(game, bout, [a, b]);
  return true;
}

function finish(game: Game, bout: Bout, ships: ShipEntity[]): void {
  bout.stage = 'done';
  for (const sh of ships) {
    if (legends.has(sh)) {
      legends.delete(sh);
      if (sh.alive) game.removeShip(sh.id);
    } else if (sh.alive) sh.state.speed = 0;
  }
  forget(game, bout);
  bout.seats.forEach((x, k) => {
    const s = x.acc !== null ? game.sessionByAccount(x.acc) : null;
    const r = bout.result?.[k];
    if (!s || !r) return;
    const won = bout.winner === k;
    const foe = bout.seats[1 - k].name;
    let msg: string;
    if (r.practice) msg = won ? `The Colosseum: you beat ${foe}. A practice bout: the rating stands.` : `The Colosseum: ${foe} beats you. A practice bout: the rating stands.`;
    else if (!r.rated) msg = won ? `The Colosseum: you beat ${foe}. A friendly bout: the rating stands.` : `The Colosseum: ${foe} beats you. A friendly bout: the rating stands.`;
    else msg = won ? `The Colosseum: you beat ${foe}. Rating ${r.rating} (+${r.delta}).` : `The Colosseum: ${foe} beats you. Rating ${r.rating} (${r.delta}).`;
    game.toastShip(s.ship, msg, won ? 'gold' : r.rated ? 'bad' : 'info');
    game.pushSelf(s, true);
  });
}

// ------------------------------------------------------------------ the clock

/** Twice a second: the queue matched (or a legend sent), the draft's clock, a bout whose ships are gone ended; every
 *  few seconds the season's turn and what it owes paid. */
export function stepArena(game: Game): void {
  if (game.tick % 10 !== 0) return;
  const L = live(game);
  const S = store(game);
  if (S.season !== arenaSeason(game, S)) closeSeason(game);
  matchQueue(game);
  for (const b of [...L.bouts.values()]) {
    if (b.stage === 'draft') {
      if (game.now >= b.until) stewardMove(game, b);
      continue;
    }
    if (b.stage !== 'fight' || !b.ships) continue;
    const [A, B] = b.ships.map((id) => game.ships.get(id));
    const fight = A?.boarding?.fight;
    if (A && B && fight && fights.get(fight) === b && B.boarding?.fight === fight) continue;
    // A ship gone from the sand (a captain gone for good, a legend's ship lost): the side still there wins; both there
    // and the fight gone all the same, the bout is called off.
    if (fight && fights.has(fight)) fights.delete(fight);
    const okA = !!A?.alive, okB = !!B?.alive;
    if (!b.result && okA !== okB) settleBout(game, b, okA ? 0 : 1);
    if (!b.result) {
      for (const sh of [A, B]) if (sh && legends.has(sh) && sh.alive) game.removeShip(sh.id);
      callOff(game, b, null);
      continue;
    }
    finish(game, b, [A, B].filter((x): x is ShipEntity => !!x));
  }
  if (game.tick % 100 === 0 && Object.keys(S.owed).length) payOwed(game);
}

/** The queue: the longest waiting first, each to the nearest rating within the gap their waits allow; one who has
 *  waited ARENA_WAIT alone is met by a legend of the sea. A captain gone into port, off the sea or down is let go. */
function matchQueue(game: Game): void {
  const L = live(game);
  if (!L.queue.size) return;
  const S = store(game);
  for (const [acc] of L.queue) {
    const s = game.sessionByAccount(acc);
    if (s?.ship && s.ship.alive && !s.ship.docked && (s.profile?.level ?? 0) >= ARENA_LEVEL) continue;
    L.queue.delete(acc);
    if (s) {
      game.sendTo(s, { t: 'toast', msg: 'You leave the queue of the Colosseum: it waits for captains at sea.', kind: 'info' });
      game.pushSelf(s, true);
    }
  }
  const list = [...L.queue].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const ready = (acc: number): PlayerSession | null => {
    const s = game.sessionByAccount(acc);
    return s && !whyNot(game, s, false) ? s : null;
  };
  const taken = new Set<number>();
  for (const [acc, since] of list) {
    if (taken.has(acc)) continue;
    const s = ready(acc);
    if (!s) continue;
    const r = ratingOf(S, acc);
    let best: [number, PlayerSession] | null = null, gap = Infinity;
    for (const [o, osince] of list) {
      if (o === acc || taken.has(o)) continue;
      const os = ready(o);
      if (!os) continue;
      const g = Math.abs(ratingOf(S, o) - r);
      if (g > Math.max(matchGap(game.now - since), matchGap(game.now - osince))) continue;
      if (g < gap) {
        gap = g;
        best = [o, os];
      }
    }
    if (best) {
      taken.add(acc);
      taken.add(best[0]);
      startDraft(game, s, best[1]);
    } else if (game.now - since >= ARENA_WAIT) {
      taken.add(acc);
      L.queue.delete(acc);
      startPractice(game, s);
    }
  }
}

// ------------------------------------------------------------------ the season

/** The season's turn: its rewards owed to everyone of ARENA_MIN_BOUTS rated bouts by their places, its champion into
 *  the Hall of the Colosseum and the chronicle; the table begins again. */
function closeSeason(game: Game): void {
  const S = store(game);
  const table = Object.entries(S.rows).filter(([, r]) => r.n >= ARENA_MIN_BOUTS).sort((a, b) => b[1].r - a[1].r || b[1].w - a[1].w || Number(a[0]) - Number(b[0]));
  table.forEach(([acc, r], i) => {
    const rw = arenaReward(i + 1, r.r);
    (S.owed[acc] ??= []).push({ season: S.season, place: i + 1, rating: r.r, glory: rw.glory, hours: rw.hours, ...(rw.title ? { title: rw.title } : {}), ...(rw.pennant ? { pennant: true } : {}), ...(i === 0 ? { champion: true } : {}) });
  });
  if (table.length) {
    const [acc, r] = table[0];
    S.champion = { acc: Number(acc), name: r.name, season: S.season, rating: r.r };
    S.hall.push({ ...S.champion });
    S.hall = S.hall.slice(-40);
    chronicle(game, `${r.name} is the Champion of the Colosseum of season ${S.season + 1}.`);
    for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${r.name} is the Champion of the Colosseum of season ${S.season + 1}.`, kind: 'gold' });
  }
  S.rows = {};
  S.season = arenaSeason(game, S);
  save(game);
  payOwed(game);
}

/** The season's rewards paid to those aboard (and to each as she comes back: seasons.ts applyPantheon). */
function payOwed(game: Game): void {
  const S = store(game);
  let any = false;
  for (const [k, list] of Object.entries(S.owed)) {
    const s = game.sessionByAccount(Number(k));
    if (!s?.profile || !list.length) continue;
    payTo(game, s, list);
    delete S.owed[k];
    any = true;
  }
  if (any) save(game);
}

function payTo(game: Game, s: PlayerSession, list: Owed[]): void {
  const p = s.profile!;
  for (const o of list) {
    game.sendTo(s, { t: 'toast', msg: `The Colosseum's season ${o.season + 1} is over: place ${o.place}, rating ${o.rating}.`, kind: 'gold' });
    const silver = Math.round(o.hours * seaHourOf(10));
    if (silver > 0) {
      p.gold += silver;
      game.db.ledger(s.accountId, 'arena', silver, `season ${o.season + 1}`);
      game.sendTo(s, { t: 'toast', msg: `The Colosseum pays you ${silver} silver.`, kind: 'gold' });
    }
    if (o.glory > 0) game.grantXp(s, Math.round(o.glory * gloryXp(p.throne?.rank ?? 0)), "The Colosseum's season");
    if (o.title && !p.titles.includes(o.title[0])) {
      p.titles.push(o.title[0]);
      game.sendTo(s, { t: 'toast', msg: `The title «${o.title[0]}» is yours.`, kind: 'gold' });
    }
    if (o.pennant && !p.pennants.includes(ARENA_PENNANT)) {
      p.pennants.push(ARENA_PENNANT);
      game.sendTo(s, { t: 'toast', msg: "The Colosseum's pennant is yours.", kind: 'gold' });
    }
    if (o.champion) {
      const key = `arena:${o.season}`;
      if (!p.pantheon.includes(key)) p.pantheon.push(key);
      p.title = o.title?.[0] ?? p.title;
      game.sendTo(s, { t: 'toast', msg: 'You enter the Pantheon: the Hall of the Colosseum.', kind: 'gold' });
    }
  }
  game.pushSelf(s, true);
}

/** A captain come aboard (seasons.ts applyPantheon): what the Colosseum's seasons owe her. */
export function applyArenaTitles(game: Game, s: PlayerSession): void {
  const S = store(game);
  const list = S.owed[s.accountId];
  if (!list?.length || !s.profile) return;
  payTo(game, s, list);
  delete S.owed[s.accountId];
  save(game);
}

/** The Hall of the Colosseum in the Pantheon (seasons.ts seasonView): each season's champion. */
export function arenaHall(game: Game): { name: string; season: number }[] {
  return store(game).hall.map((m) => ({ name: m.name, season: m.season + 1 }));
}

// ------------------------------------------------------------------ what she sees

function draftView(game: Game, b: Bout, acc: number): ArenaDraftView {
  const d = b.draft;
  const t = draftTurn(d);
  return {
    you: b.seats[0].acc === acc ? 0 : 1,
    seats: b.seats.map((x) => ({ name: x.name, path: x.path, ...(x.acc !== null ? { rating: Math.round(x.rating) } : { ai: true }) })) as ArenaDraftView['seats'],
    pool: d.pool.map(arenaLot), bans: [[...d.bans[0]], [...d.bans[1]]], picks: [[...d.picks[0]], [...d.picks[1]]],
    left: [draftLeft(d, 0), draftLeft(d, 1)], done: [d.done[0], d.done[1]],
    stage: b.stage === 'fight' ? 'fight' : t.stage, turn: t.side, until: Math.round(b.until * 10) / 10, rated: b.rated, practice: b.practice,
  };
}

/** The season's table, the best first (sorted at most once a second of the world: every captain's state reads it). */
const tables = new WeakMap<Store, { at: number; rows: [string, Row][] }>();
function tableOf(game: Game, S: Store): [string, Row][] {
  const c = tables.get(S);
  if (c && game.now - c.at < 1) return c.rows;
  const rows = Object.entries(S.rows).filter(([, r]) => r.n > 0).sort((a, b) => b[1].r - a[1].r || b[1].w - a[1].w || Number(a[0]) - Number(b[0]));
  tables.set(S, { at: game.now, rows });
  return rows;
}

/** The Colosseum's tab (undefined below level 55, as the Throne itself). */
export function arenaView(game: Game, s: PlayerSession): ArenaView | undefined {
  const p = s.profile;
  if (!p || p.level < ARENA_LEVEL - 5) return undefined;
  const S = store(game);
  const L = live(game);
  const rows = tableOf(game, S);
  const at = rows.findIndex(([k]) => Number(k) === s.accountId);
  const me = S.rows[s.accountId];
  const table = rows.slice(0, 10).map(([k, r]) => ({ name: r.name, rating: r.r, bouts: r.n, wins: r.w, ...(Number(k) === s.accountId ? { you: true } : {}) }));
  if (at >= 10 && me) table.push({ name: me.name, rating: me.r, bouts: me.n, wins: me.w, you: true });
  const b = L.of.get(s.accountId);
  const q = L.queue.get(s.accountId);
  const why = L.queue.has(s.accountId) ? 'You are in the queue already.' : whyNot(game, s);
  const last = L.last.get(s.accountId);
  return {
    rating: me?.r ?? ARENA_START, bouts: me?.n ?? 0, wins: me?.w ?? 0, best: me?.best ?? ARENA_START, place: at + 1,
    season: S.season + 1, ends: SEASON_EPOCH + (seasonId(game) + 1) * SEASON_DAYS * DAY,
    ...(q !== undefined ? { queue: { since: q, n: L.queue.size } } : {}),
    ...(b ? { draft: draftView(game, b, s.accountId) } : {}),
    why, table,
    ...(S.champion ? { champion: { name: S.champion.name, season: S.champion.season + 1 } } : {}),
    ...(last ? { last } : {}),
  };
}

/** A captain's word in the Colosseum's tab (throne.ts throneMessage). */
export function arenaMessage(game: Game, s: PlayerSession, op: ArenaOp | undefined, u?: string): string | null {
  switch (op) {
    case 'queue':
      return arenaQueue(game, s);
    case 'leave':
      return arenaLeave(game, s);
    case 'practice':
      return arenaPractice(game, s);
    case 'ban':
    case 'pick':
    case 'pass':
      return arenaDraft(game, s, op, u);
  }
  return 'No such order.';
}

// ------------------------------------------------------------------ the tester's command

/** `/arena [queue|bot|win|lose|rating N|season|reset]` (admin.ts): the queue joined, a practice bout at once, a bout
 *  won or lost at once (on the sand: the other side strikes; else a rated bout against a captain of her rating), her
 *  rating set (and her bouts to the season's least), the season closed, the Colosseum as new. */
export function adminArena(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  const S = store(game);
  const L = live(game);
  const op = args[0];
  if (op !== undefined && op !== 'season' && op !== 'reset' && p.level < ARENA_LEVEL) return `The Colosseum opens at level ${ARENA_LEVEL} (/level ${ARENA_LEVEL}).`;
  switch (op) {
    case undefined: {
      const r = S.rows[s.accountId];
      const b = L.of.get(s.accountId);
      const [se, rt, n, w, q] = [S.season + 1, r?.r ?? ARENA_START, r?.n ?? 0, r?.w ?? 0, L.queue.size];
      if (!b) return `Colosseum, season ${se}: rating ${rt}, bouts ${n}, won ${w}, in the queue ${q}.`;
      if (b.stage === 'draft') return `Colosseum, season ${se}: rating ${rt}, bouts ${n}, won ${w}, in the queue ${q}. Your draft is under way.`;
      return `Colosseum, season ${se}: rating ${rt}, bouts ${n}, won ${w}, in the queue ${q}. Your bout is on the sand.`;
    }
    case 'queue':
      return arenaQueue(game, s) ?? 'In the queue of the Colosseum.';
    case 'bot': {
      if (L.of.has(s.accountId)) return 'Your bout is under way.';
      const why = whyNot(game, s, false);
      if (why) return why;
      L.queue.delete(s.accountId);
      startPractice(game, s);
      return 'A legend of the sea comes to spar: the draft begins.';
    }
    case 'win':
    case 'lose': {
      const won = op === 'win';
      const b = L.of.get(s.accountId);
      const fight = s.ship?.boarding?.fight;
      if (b && b.stage === 'fight' && fight?.tac && fights.get(fight) === b) {
        const mine = b.seats[0].acc === s.accountId ? 0 : 1;
        act(fight.tac, (won ? 1 - mine : mine) as 0 | 1, { a: 'surrender' }, game.now, fight.tacRng ?? ar(game));
        return won ? 'The other side strikes: the bout is yours.' : 'You strike: the bout is theirs.';
      }
      if (b) return 'Your bout is under way.';
      const now = game.wallNow();
      const row = (S.rows[s.accountId] ??= { name: s.name, path: p.captain, r: ARENA_START, n: 0, w: 0, best: ARENA_START, at: now });
      const d = eloShift(row.r, row.r, won, row.n);
      row.r = Math.max(0, row.r + d);
      row.n++;
      if (won) row.w++;
      row.best = Math.max(row.best, row.r);
      row.at = now;
      save(game);
      L.last.set(s.accountId, { won, delta: d, foe: '' });
      game.pushSelf(s, true);
      const sd = `${d >= 0 ? '+' : ''}${d}`;
      return `Rating ${row.r} (${sd}), bouts ${row.n}.`;
    }
    case 'rating': {
      const n = Math.round(Number(args[1]));
      if (!Number.isFinite(n) || n < 0) return 'Usage: /arena rating N';
      const now = game.wallNow();
      const row = (S.rows[s.accountId] ??= { name: s.name, path: p.captain, r: ARENA_START, n: 0, w: 0, best: ARENA_START, at: now });
      row.r = n;
      row.n = Math.max(row.n, ARENA_MIN_BOUTS);
      row.w = Math.max(row.w, Math.ceil(row.n / 2));
      row.best = Math.max(row.best, n);
      row.at = now;
      save(game);
      game.pushSelf(s, true);
      return `Rating ${n}, bouts ${row.n}.`;
    }
    case 'season': {
      S.shift = (S.shift ?? 0) + 1;
      const had = S.champion?.season;
      closeSeason(game);
      game.pushSelf(s, true);
      return S.champion && S.champion.season !== had ? `The season of the Colosseum is closed: ${S.champion.name} is its champion.` : 'The season of the Colosseum is closed: nobody fought ten rated bouts.';
    }
    case 'reset':
      for (const b of [...L.bouts.values()]) if (b.stage === 'draft') forget(game, b);
      L.queue.clear();
      L.last.clear();
      stores.set(game, { v: 1, season: seasonId(game), rows: {}, pairs: { day: 0, n: {} }, hall: [], owed: {} });
      save(game);
      game.pushSelf(s, true);
      return 'The Colosseum begins anew.';
  }
  return 'Usage: /arena [queue|bot|win|lose|rating N|season|reset]';
}

// ------------------------------------------------------------------ the tests' hands

/** The tests' look at the Colosseum: the queue, the bouts, a bout's draft (by a captain's account). */
export const arenaLive = (game: Game) => {
  const L = live(game);
  return { queue: [...L.queue.keys()], bouts: [...L.bouts.values()].map((b) => ({ id: b.id, stage: b.stage, rated: b.rated, practice: b.practice, seats: b.seats.map((x) => x.acc) })), draftOf: (acc: number) => L.of.get(acc)?.draft };
};
