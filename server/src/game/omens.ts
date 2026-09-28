// Omens of the day (docs/12 P10 #9) on the server: the day's omen for all; its mods on every captain's ship at sea;
// fortune for an hour to her who keeps it, misfortune for an hour to her who breaks it (once a day each).

import { COIN_COST, FAIR_WIND, FORTUNE, MISFORTUNE, OMENS, omenDay, omenOf } from '../../../shared/src/data/omens.ts';
import type { OmenId } from '../../../shared/src/data/omens.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

const HOUR = 3600;
const told = new WeakSet<PlayerSession>();

interface OmenState {
  day: number;
  /** Per captain: the day's omen kept or broken already, a storm ridden (seconds). */
  done: Map<number, { day: number; kept: boolean; broken: boolean; storm: number }>;
}

const states = new WeakMap<Game, OmenState>();
function os(game: Game): OmenState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { day: -1, done: new Map() }));
  return s;
}

export function todaysOmen(game: Game): OmenId {
  return omenOf(omenDay(game.now));
}

function mark(game: Game, s: PlayerSession): { day: number; kept: boolean; broken: boolean; storm: number } {
  const S = os(game);
  const day = omenDay(game.now);
  let m = S.done.get(s.accountId);
  if (!m || m.day !== day) S.done.set(s.accountId, (m = { day, kept: false, broken: false, storm: 0 }));
  return m;
}

/** She kept the day's omen: fortune for an hour (once a day). */
export function omenKept(game: Game, s: PlayerSession, what: 'fish' | 'ghost' | 'storm' | 'coin'): void {
  const o = OMENS[todaysOmen(game)];
  if (o.keep !== what || !s.ship) return;
  const m = mark(game, s);
  if (m.kept) return;
  m.kept = true;
  s.ship.addEffect({ id: 'omen_fortune', until: game.now + HOUR, mods: FORTUNE }, game.now);
  game.sendTo(s, { t: 'toast', msg: 'The omen is kept: fortune smiles on you for an hour.', kind: 'gold' });
}

/** She broke the day's omen: misfortune for an hour (once a day). */
export function omenBroken(game: Game, s: PlayerSession, what: 'merchant' | 'no_cat'): void {
  const o = OMENS[todaysOmen(game)];
  if (o.breaks !== what || !s.ship) return;
  const m = mark(game, s);
  if (m.broken) return;
  m.broken = true;
  s.ship.addEffect({ id: 'omen_misfortune', until: game.now + HOUR, mods: MISFORTUNE }, game.now);
  s.ship.curse = Math.min(100, s.ship.curse + 5);
  game.sendTo(s, { t: 'toast', msg: 'The omen is broken: misfortune follows you for an hour.', kind: 'bad' });
}

/** The old custom: a coin nailed under the mast in port — a fair wind all day. */
export function nailCoin(game: Game, s: PlayerSession): string | null {
  if (OMENS[todaysOmen(game)].keep !== 'coin') return 'Not today’s custom.';
  const ship = s.ship, p = s.profile!;
  if (!ship?.docked) return 'Only in port';
  if (ship.hasEffect('fair_wind')) return 'The coin is nailed already.';
  if (p.gold < COIN_COST) return 'Not enough silver';
  p.gold -= COIN_COST;
  game.db.ledger(s.accountId, 'omen_coin', -COIN_COST, '');
  ship.addEffect({ id: 'fair_wind', until: game.now + (48 * 60), mods: FAIR_WIND }, game.now);
  game.sendTo(s, { t: 'toast', msg: 'A coin is nailed under the mast: a fair wind all day.', kind: 'good' });
  omenKept(game, s, 'coin');
  game.pushSelf(s, true);
  return null;
}

/** A whaler's day: every carcass gives more. */
export function omenCarcassMul(game: Game): number {
  return todaysOmen(game) === 'whale_spout' ? 1.25 : 1;
}

/** Every five seconds: a new day's omen told to all; the day's mods kept on the ships at sea; the storm ridden out. */
export function stepOmens(game: Game): void {
  const S = os(game);
  const day = omenDay(game.now);
  const id = todaysOmen(game);
  const o = OMENS[id];
  if (day !== S.day) {
    const first = S.day === -1;
    S.day = day;
    for (const s of game.sessions) {
      // Yesterday's omen lifts.
      if (s.ship?.hasEffect('omen_day')) s.ship.addEffect({ id: 'omen_day', until: 0, mods: {} }, game.now);
      if (!first) game.sendTo(s, { t: 'toast', msg: `The omen of the day: ${o.text[0]}`, kind: 'info' });
      game.sendTo(s, { t: 'omen', id });
    }
  }
  for (const s of game.sessions) {
    // A captain just come aboard learns the day's omen.
    if (!told.has(s)) {
      told.add(s);
      game.sendTo(s, { t: 'omen', id });
    }
    const ship = s.ship;
    if (!ship) continue;
    applyDayMods(game, ship, o.mods);
    if (o.keep === 'storm' && !ship.docked && game.weatherOf(ship) === 'storm') {
      const m = mark(game, s);
      m.storm += 5;
      if (m.storm >= 60) omenKept(game, s, 'storm');
    }
  }
}

function applyDayMods(game: Game, ship: ShipEntity, mods: OmenDef['mods']): void {
  const has = ship.hasEffect('omen_day');
  if (!mods) {
    if (has) ship.addEffect({ id: 'omen_day', until: 0, mods: {} }, game.now);
    return;
  }
  if (!has) ship.addEffect({ id: 'omen_day', until: game.now + 48 * 60, mods }, game.now);
}

type OmenDef = (typeof OMENS)[OmenId];

/** A captain arriving learns the day's omen. */
export function sendOmen(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'omen', id: todaysOmen(game) });
}
