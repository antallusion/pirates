// Dead Man's Dice at the tavern tables (docs/12 P10 #4). A captain opens a table at a stake; the port's captains may
// sit down while it is open; the regulars fill the empty seats; the pot (less the house's cut) goes to the last cup
// with dice. A captain who dawdles past her turn has the table bid for her. The week's wins make a tournament: its
// winner is named Master of Dice at the week's turn. At midnight in the Abyss, Davy Jones plays: a cursed thing
// against a toll from the ship.

import { unlockDeed } from './looks.ts';
import { DAVY, DAVY_STAKE, DICE_HOUSE_CUT, DICE_MAX_SEATS, DICE_OPEN_S, DICE_REGULARS, DICE_STAKES, DICE_START, DICE_TURN_S, countFace, npcMove, validRaise } from '../../../shared/src/data/dice.ts';
import type { Bid } from '../../../shared/src/data/dice.ts';
import { timeOfDay } from '../../../shared/src/constants.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import type { DiceView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import { fresh } from './onboarding.ts';

interface Seat {
  name: string;
  account: number | null;
  cup: number[];
  dice: number;
  nerve: number;
}

interface Table {
  id: number;
  port: string;
  stake: number;
  davy: boolean;
  phase: 'open' | 'play' | 'done';
  seats: Seat[];
  turn: number;
  bid: (Bid & { by: number }) | null;
  deadline: number;
  log: string[];
  reveal: { cups: number[][]; face: number; count: number; loser: number } | null;
  /** The cups stay up a moment before the next round (the loser opens it). */
  revealUntil: number;
  starter: number;
  winner: number | null;
  pot: number;
}

interface DiceState {
  tables: Map<number, Table>;
  seq: number;
  rng: Rng;
}

const states = new WeakMap<Game, DiceState>();
function ds(game: Game): DiceState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { tables: new Map(), seq: 1, rng: new Rng(game.world.seed ^ 0xd1ce) }));
  return s;
}

const WEEK_MS = 7 * 86_400_000;

function tableOf(game: Game, account: number): Table | undefined {
  for (const t of ds(game).tables.values()) if (t.seats.some((x) => x.account === account)) return t;
  return undefined;
}

function roll(S: DiceState, n: number): number[] {
  return Array.from({ length: n }, () => S.rng.int(1, 6));
}

function say(game: Game, t: Table, line: string): void {
  t.log.push(line);
  t.log = t.log.slice(-8);
}

function alive(t: Table): number[] {
  return t.seats.map((_, i) => i).filter((i) => t.seats[i].dice > 0);
}

function nextSeat(t: Table, from: number): number {
  for (let k = 1; k <= t.seats.length; k++) {
    const i = (from + k) % t.seats.length;
    if (t.seats[i].dice > 0) return i;
  }
  return from;
}

function total(t: Table): number {
  return t.seats.reduce((a, x) => a + x.dice, 0);
}

function newRound(game: Game, t: Table, starter: number): void {
  const S = ds(game);
  t.reveal = null;
  t.revealUntil = 0;
  for (const x of t.seats) x.cup = roll(S, x.dice);
  t.bid = null;
  t.turn = t.seats[starter].dice > 0 ? starter : nextSeat(t, starter);
  t.deadline = game.now + DICE_TURN_S;
}

export function diceAvailableDavy(game: Game, s: PlayerSession): boolean {
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (!port || port.region !== 'the_abyss') return false;
  const t = timeOfDay(game.now);
  return t < 1.5 / 24 || t > 23.5 / 24;
}

/** Open a table at a stake (or Davy's), and sit at it. */
export function diceOpen(game: Game, s: PlayerSession, stake: number, davy = false): string | null {
  const p = s.profile!;
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  if (!port) return 'Dice are played in a tavern.';
  if (tableOf(game, s.accountId)) return 'You are at a table already.';
  if (davy && !diceAvailableDavy(game, s)) return 'Davy Jones plays only at midnight, and only in the Abyss.';
  const st = davy ? DAVY_STAKE : DICE_STAKES.includes(stake) ? stake : DICE_STAKES[0];
  if (p.gold < st) return 'Not enough silver';
  p.gold -= st;
  const S = ds(game);
  const t: Table = { id: S.seq++, port: port.id, stake: st, davy, phase: 'open', seats: [], turn: 0, bid: null, deadline: game.now + (davy ? 2 : DICE_OPEN_S), log: [], reveal: null, revealUntil: 0, starter: 0, winner: null, pot: st };
  t.seats.push({ name: s.name, account: s.accountId, cup: [], dice: DICE_START, nerve: 0.5 });
  S.tables.set(t.id, t);
  say(game, t, `${s.name} sits down at the table.`);
  if (davy) t.seats.push({ name: DAVY[0], account: null, cup: [], dice: DICE_START, nerve: 0.8 });
  sendTable(game, t);
  game.pushSelf(s, true);
  return null;
}

export function diceJoin(game: Game, s: PlayerSession, id: number): string | null {
  const p = s.profile!;
  const t = ds(game).tables.get(id);
  if (tableOf(game, s.accountId)) return 'You are at a table already.';
  if (!t || t.phase !== 'open' || t.davy || t.seats.length >= DICE_MAX_SEATS || s.ship?.docked !== t.port) return 'That table is full or already playing.';
  if (p.gold < t.stake) return 'Not enough silver';
  p.gold -= t.stake;
  t.pot += t.stake;
  t.seats.push({ name: s.name, account: s.accountId, cup: [], dice: DICE_START, nerve: 0.5 });
  say(game, t, `${s.name} sits down at the table.`);
  sendTable(game, t);
  game.pushSelf(s, true);
  return null;
}

/** The regulars fill the empty seats and the cups are shaken. */
function start(game: Game, t: Table): void {
  const S = ds(game);
  const free = [...DICE_REGULARS].sort(() => S.rng.float() - 0.5);
  const want = t.davy ? 2 : Math.max(2, Math.min(DICE_MAX_SEATS, t.seats.length + 2));
  while (t.seats.length < want) {
    const r = free.pop()!;
    t.seats.push({ name: r[0], account: null, cup: [], dice: DICE_START, nerve: S.rng.float() });
    t.pot += t.stake;
    say(game, t, `${r[0]} sits down at the table.`);
  }
  t.phase = 'play';
  newRound(game, t, S.rng.int(0, t.seats.length - 1));
}

export function diceStart(game: Game, s: PlayerSession): string | null {
  const t = tableOf(game, s.accountId);
  if (!t || t.phase !== 'open' || t.seats[0].account !== s.accountId) return 'That table is full or already playing.';
  start(game, t);
  sendTable(game, t);
  return null;
}

function doBid(game: Game, t: Table, seat: number, bid: Bid): void {
  const faces = ['', '', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  t.bid = { ...bid, by: seat };
  say(game, t, `${t.seats[seat].name} bids ${bid.q} ${faces[bid.f]}.`);
  t.turn = nextSeat(t, seat);
  t.deadline = game.now + DICE_TURN_S;
}

function doLiar(game: Game, t: Table, seat: number): void {
  const bid = t.bid!;
  say(game, t, `${t.seats[seat].name} calls it a lie!`);
  const cups = t.seats.map((x) => [...x.cup]);
  const count = countFace(cups, bid.f);
  const loser = count >= bid.q ? seat : bid.by;
  t.seats[loser].dice--;
  t.reveal = { cups, face: bid.f, count, loser };
  say(game, t, `The cups come up: ${count} of them. ${t.seats[loser].name} loses a die.`);
  if (t.seats[loser].dice <= 0) say(game, t, `${t.seats[loser].name} is out of dice.`);
  const left = alive(t);
  if (left.length <= 1) return finish(game, t, left[0] ?? seat);
  // The cups stay up four seconds for all to see; then the loser opens the next round.
  t.turn = -1;
  t.bid = null;
  t.starter = loser;
  t.revealUntil = game.now + 4;
  t.deadline = t.revealUntil;
}

/** The last cup with dice: the pot, the tournament's count, Davy's due. */
function finish(game: Game, t: Table, winner: number): void {
  t.phase = 'done';
  t.winner = winner;
  t.deadline = game.now + 12;
  const w = t.seats[winner];
  const prize = t.davy ? 0 : Math.floor(t.pot * (1 - DICE_HOUSE_CUT));
  say(game, t, `${w.name} takes the pot: ${prize} silver.`);
  for (const [i, x] of t.seats.entries()) {
    if (x.account === null) continue;
    const s = game.sessionByAccount(x.account);
    const p = s?.profile;
    if (!s || !p) continue;
    if (i === winner) {
      if (t.davy) {
        // A cursed thing: strong, and it weighs on the ship.
        const it = makeItem(game.rng, p.itemSeq++, { ilvl: 10, rarity: 4, source: 'elite' });
        takeItem(game, s, it);
        if (s.ship) s.ship.curse = Math.min(100, s.ship.curse + 20);
        game.sendTo(s, { t: 'toast', msg: 'Davy Jones pushes a cursed thing across the table: it is yours.', kind: 'gold' });
      } else {
        p.gold += prize;
        game.db.ledger(s.accountId, 'dice', prize - t.stake, t.port);
        game.sendTo(s, { t: 'toast', msg: `Dead Man’s Dice: you won ${prize} silver.`, kind: 'gold' });
      }
      weekWin(game, s.name);
    } else {
      game.db.ledger(s.accountId, 'dice', -t.stake, t.port);
      if (t.davy) {
        if (s.ship) {
          s.ship.curse = Math.min(100, s.ship.curse + 10);
          s.ship.crew = Math.max(1, s.ship.crew - 2);
        }
        game.sendTo(s, { t: 'toast', msg: 'Davy Jones laughs, and the sea takes its due from your ship.', kind: 'bad' });
      } else game.sendTo(s, { t: 'toast', msg: 'Dead Man’s Dice: you lost your stake.', kind: 'bad' });
    }
    game.pushSelf(s, true);
  }
}

export function diceBid(game: Game, s: PlayerSession, q: number, f: number): string | null {
  const t = tableOf(game, s.accountId);
  if (!t || t.phase !== 'play') return 'Not your turn.';
  const seat = t.seats.findIndex((x) => x.account === s.accountId);
  if (t.turn !== seat) return 'Not your turn.';
  const bid = { q: Math.trunc(q), f: Math.trunc(f) };
  if (!validRaise(t.bid, bid, total(t))) return 'That bid does not raise the last one.';
  doBid(game, t, seat, bid);
  sendTable(game, t);
  return null;
}

export function diceLiar(game: Game, s: PlayerSession): string | null {
  const t = tableOf(game, s.accountId);
  if (!t || t.phase !== 'play') return 'Not your turn.';
  const seat = t.seats.findIndex((x) => x.account === s.accountId);
  if (t.turn !== seat) return 'Not your turn.';
  if (!t.bid) return 'There is no bid to call.';
  doLiar(game, t, seat);
  sendTable(game, t);
  return null;
}

/** Up from the table: an open table returns the stake (and breaks up if the host goes); in play, the cup is lost. */
export function diceLeave(game: Game, s: PlayerSession): string | null {
  const t = tableOf(game, s.accountId);
  if (!t) return null;
  const seat = t.seats.findIndex((x) => x.account === s.accountId);
  const p = s.profile!;
  if (t.phase === 'open') {
    if (seat === 0) return breakUp(game, t);
    p.gold += t.stake;
    t.pot -= t.stake;
    t.seats.splice(seat, 1);
    say(game, t, `${s.name} gets up from the table.`);
  } else if (t.phase === 'play') {
    t.seats[seat].dice = 0;
    t.seats[seat].account = null;
    say(game, t, `${s.name} gets up from the table.`);
    const left = alive(t);
    if (left.length <= 1) finish(game, t, left[0] ?? 0);
    else if (t.turn === seat && !t.revealUntil) newRound(game, t, nextSeat(t, seat));
  } else t.seats[seat].account = null;
  game.sendTo(s, { t: 'dice', view: null });
  sendTable(game, t);
  game.pushSelf(s, true);
  return null;
}

function breakUp(game: Game, t: Table): null {
  for (const x of t.seats) {
    if (x.account === null) continue;
    const s = game.sessionByAccount(x.account);
    if (s?.profile) {
      s.profile.gold += t.stake;
      game.sendTo(s, { t: 'toast', msg: 'The table breaks up: the stakes are returned.', kind: 'info' });
      game.sendTo(s, { t: 'dice', view: null });
      game.pushSelf(s, true);
    }
  }
  ds(game).tables.delete(t.id);
  return null;
}

/** Every second: the regulars think and bid, the clock runs, open tables start, done tables clear. */
export function stepDice(game: Game): void {
  const S = ds(game);
  for (const t of [...S.tables.values()]) {
    let changed = false;
    if (t.phase === 'open' && game.now >= t.deadline) {
      start(game, t);
      changed = true;
    } else if (t.phase === 'play' && t.revealUntil) {
      if (game.now >= t.revealUntil) {
        newRound(game, t, t.starter);
        changed = true;
      }
    } else if (t.phase === 'play') {
      const seat = t.seats[t.turn];
      const npc = seat.account === null;
      // A regular takes a moment; a captain has her twenty seconds.
      const ready = npc ? game.now >= t.deadline - DICE_TURN_S + 2 + S.rng.float() * 1.5 : game.now >= t.deadline;
      if (ready) {
        if (!npc) say(game, t, `${seat.name} dawdles: the table bids for them.`);
        const m = npcMove(seat.cup, total(t), t.bid, t.davy && npc ? 0.8 : seat.nerve, () => S.rng.float());
        if ('liar' in m && t.bid) doLiar(game, t, t.turn);
        else doBid(game, t, t.turn, 'bid' in m ? m.bid : { q: (t.bid?.q ?? 0) + 1, f: t.bid?.f ?? 2 });
        changed = true;
      }
    } else if (t.phase === 'done' && game.now >= t.deadline) {
      for (const x of t.seats) {
        const s = x.account !== null ? game.sessionByAccount(x.account) : undefined;
        if (s) game.sendTo(s, { t: 'dice', view: null });
      }
      S.tables.delete(t.id);
      continue;
    }
    // A seated captain who left port or went offline: her cup is lost.
    for (const x of t.seats) {
      if (x.account === null) continue;
      const s = game.sessionByAccount(x.account);
      if (!s || s.ship?.docked !== t.port) {
        if (s) diceLeave(game, s);
        else {
          x.account = null;
          x.dice = t.phase === 'play' ? 0 : x.dice;
        }
        changed = true;
      }
    }
    if (changed) sendTable(game, t);
  }
  if (Math.floor(game.now) % 60 === 0) weekTurn(game);
}

function sendTable(game: Game, t: Table): void {
  for (const x of t.seats) {
    if (x.account === null) continue;
    const s = game.sessionByAccount(x.account);
    if (s) game.sendTo(s, { t: 'dice', view: tableView(game, t, x.account) });
  }
}

export function tableView(game: Game, t: Table, account: number): DiceView {
  return {
    id: t.id, stake: t.stake, pot: t.pot, phase: t.phase, davy: t.davy, turn: t.turn, bid: t.bid,
    sec: Math.max(0, Math.ceil(t.deadline - game.now)),
    seats: t.seats.map((x) => ({ name: x.name, dice: x.dice, npc: x.account === null, me: x.account === account, ...(x.account === account ? { cup: [...x.cup] } : {}) })),
    host: t.seats[0]?.account === account,
    log: [...t.log], reveal: t.reveal, winner: t.winner,
  };
}

/** The tables open in a port, for its tavern's board. */
export function openTables(game: Game, portId: string): { id: number; host: string; stake: number; seats: number }[] {
  return [...ds(game).tables.values()].filter((t) => t.port === portId && t.phase === 'open' && !t.davy).map((t) => ({ id: t.id, host: t.seats[0]?.name ?? '', stake: t.stake, seats: t.seats.length }));
}

// ------------------------------------------------------------------------------------------------ the week's tournament

interface Week {
  week: number;
  wins: Record<string, number>;
}

function weekOf(game: Game): Week {
  const w = game.db.getKv<Week>('dice_week') ?? { week: Math.floor(game.wallNow() / WEEK_MS), wins: {} };
  return w;
}

function weekWin(game: Game, name: string): void {
  const w = weekOf(game);
  w.wins[name] = (w.wins[name] ?? 0) + 1;
  game.db.setKv('dice_week', w);
}

/** The week's top: the tavern's board. */
export function weekBoard(game: Game): { name: string; wins: number }[] {
  return Object.entries(weekOf(game).wins).map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins).slice(0, 5);
}

/** The week turns: its best player is named Master of Dice. */
function weekTurn(game: Game): void {
  const w = weekOf(game);
  const now = Math.floor(game.wallNow() / WEEK_MS);
  if (w.week === now) return;
  const top = weekBoard(game)[0];
  if (top) {
    for (const o of game.sessions) if (!fresh(o.profile)) game.sendTo(o, { t: 'toast', msg: `The week’s dice tournament is won by ${top.name}: ${top.wins} wins.`, kind: 'gold' });
    const acc = game.db.accountByName(top.name)?.id;
    const s = [...game.sessions].find((x) => x.name === top.name);
    if (s?.profile) {
      if (!s.profile.titles.includes('Master of Dice')) s.profile.titles.push('Master of Dice');
      unlockDeed(game, s, 'dice');
      s.profile.gold += 5000;
    } else if (acc) deliver(game, acc, { from: 'The Tavern Keepers', subject: 'Master of Dice', body: `The week’s dice tournament is won by ${top.name}: ${top.wins} wins.`, gold: 5000, goods: null });
  }
  game.db.setKv('dice_week', { week: now, wins: {} });
}

