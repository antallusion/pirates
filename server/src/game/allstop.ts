// Owner, 2026-10-22: «любое действие, типа там победа над кораблем, над нпс, абордаж, посещение чего либо, рыбалка,
// короче вообще все это должно останавливать корабль … я могу доплыть до сражения с нпс, начать битву там условно с
// тюленями, победить и мой корабль после того как окно закроется победное — продолжает плыть, это очень странно».
//
// One stop for every interaction (supersedes 2026-10-19 «после боя курс продолжается сам»). She lies still after it —
// sails in, the wheel amidships, no course of the helmsman's, no order sailed to, no run to a goal, no «Атаковать», no
// course kept to be taken up — until her own hand sets sail or gives a course. Her phone sends its helm four times a
// second with the sail step it last had: that step is held off (PlayerSession.sailHold) until she sets another, and the
// phone is told to bring its own sail control down to nothing (`allstop`, client main.ts).
//
// Where it is called:
//  - every battle's start and end: a fight ashore (beastlairs.ts: the stacks, the lairs, the drifts, the seals, the
//    shore's bosses), the bosses' hex battles, the arena, a boarding (boarding.ts startBoarding; its end inbattle.ts
//    battleEnded), a ship sunk by her (Game.creditKill), a fish fought on the line (fishing.ts);
//  - the arena, the trials, the raids, a duel: their field or ring as it comes up (STOP_CARDS), a duel's end (pvp.ts);
//  - every order of hers that does a thing at sea (STOP_ORDERS below, Game.handle): done there and then, or on arrival
//    when the helmsman sailed her to it (approach.ts gives the order again) — never while it still waits for her;
//  - every modal card put before her (STOP_CARDS below, Game.sendTo): a boarding's spoils, a struck ship's terms, an
//    encounter, a fish on the line, the net hauled, a trek ashore, a dive, a duel, a battle's field.

import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { cancelApproach } from './approach.ts';
import { autosailOf, dropPaused, releaseGuard, stopAutosail } from './autosail.ts';
import type { Game } from './Game.ts';
import { cancelRoute } from './goalroute.ts';
import type { PlayerSession } from './player.ts';
import { pursuitOf, stopPursuit } from './pursuit.ts';
import type { ShipEntity } from './ship.ts';

/** Why she was stopped (tests; the client is told, it says nothing of it). */
export type StopWhy = 'battle' | 'battle_end' | 'boarding' | 'sunk' | 'order' | 'card';

const last = new WeakMap<PlayerSession, { why: StopWhy; what: string; at: number }>();

/** The last stop and its cause (tests). */
export function lastAllStop(s: PlayerSession): { why: StopWhy; what: string; at: number } | null {
  return last.get(s) ?? null;
}

/** The sail her phone keeps sending is held off until she sets another step (Game.ts 'input'). */
export function holdSail(s: PlayerSession): void {
  s.sailHold = s.lastSail >= 0 ? s.lastSail : 0;
}

/** Every course and every sail of hers taken in: she lies still until her own hand sets sail or gives a course. */
export function allStop(game: Game, s: PlayerSession | null | undefined, why: StopWhy, what = ''): void {
  const ship = s?.ship;
  if (!s || !ship || !ship.alive || ship.docked) return;
  last.set(s, { why, what, at: game.now });
  // (first: the phone puts its sail control down and keeps the helmsman's «the helm is yours» quiet)
  game.sendTo(s, { t: 'allstop', why });
  cancelApproach(game, s);
  cancelRoute(game, s);
  if (pursuitOf(ship)) stopPursuit(game, s, 'off');
  if (autosailOf(ship)) stopAutosail(game, s, 'manual');
  dropPaused(ship);
  releaseGuard(ship);
  ship.input = { rudder: 0, sailTarget: 0 };
  holdSail(s);
}

/** A captain's ship: her session stopped (a battle of two ships stops both, a ship of the sea is nobody's). */
export function allStopShip(game: Game, ship: ShipEntity | null | undefined, why: StopWhy, what = ''): void {
  if (!ship || ship.accountId === null) return;
  allStop(game, game.sessionOf(ship), why, what);
}

/** The orders that do a thing at sea (`true`: every action of it; else the actions that do). Table-tested
 *  (tests/allstop.test.ts): visiting, using, landing, fishing, flensing, fighting, trading with or hailing a ship. */
export const STOP_ORDERS: Readonly<Record<string, true | readonly string[]>> = {
  land: true, // ashore: a landing, a dig, a wreck raised, an expedition, a descent, a keeper, a dive, a lair (docs/18)
  seafind: ['work'], // the sea's small things: a bottle, flying fish, a fog searched, a shoal marked, castaways, a chest
  seamark: ['work'], // the sea marks
  lair: ['fight', 'join', 'flee', 'settle'], // the lairs ashore (docs/18 II)
  drift: ['way', 'tap', 'roll', 'fight', 'capture'], // the drifts and their rescues (docs/18 IV)
  roam: ['attack', 'join', 'flee'], // the creature stacks (docs/19 D7)
  h4: ['visit', 'guard', 'dig'], // the adventure map's objects, their guards, the Grail's dig (docs/17 H4)
  way: ['moor'], // the floating waystations (docs/35)
  fishing: true, // the net, the line, the traps, the deep line, the salting
  hunt: ['flense'], // a carcass flensed
  tribute: true, // a tribute paid to a ship
  surrender: true, // a struck ship's terms taken
  loot_take: true, // a boarding's spoils taken
  ceasefire: ['pay'], // a ceasefire bought
  encounter: true, // an encounter's choice
  minigame: true, // a find's little game
  trek: true, // a trek ashore
  estate: ['buy', 'rob_isle', 'found'], // an island claimed, an island robbed, an outpost founded
  isle18: ['supply'], // a floating house supplied (docs/18 #32)
  board_join: true, // a group mate's boarding joined
  abyss: true, // the ritual
  dive_surface: true,
};

/** Whether this order is one that stops her once done. */
export function stopsOrder(msg: { t: string; action?: string; op?: string }): boolean {
  const e = STOP_ORDERS[msg.t];
  if (!e) return false;
  if (e === true) return true;
  const a = msg.action ?? msg.op;
  return typeof a === 'string' && e.includes(a);
}

/** An order of hers handled (Game.handle): done — not refused, not waiting for her to come up with it or for the shot
 *  to stop — she lies still. */
export function orderDone(game: Game, s: PlayerSession, msg: ClientMsg, refused: boolean, waiting: boolean): void {
  if (refused || waiting || !stopsOrder(msg as { t: string; action?: string })) return;
  allStop(game, s, 'order', msg.t + ('action' in msg && typeof msg.action === 'string' ? `:${msg.action}` : ''));
}

/** The modal cards put before her: each one, as it comes up, stops her (`view`: the field that is null when it goes). */
export const STOP_CARDS: Readonly<Record<string, string>> = {
  boarding: 'result', // a boarding's spoils
  surrender_offer: 'offer', // a struck ship's terms
  encounter: 'view', // an encounter
  minigame: 'view', // a find's little game
  fishfight: 'view', // a fish on the line
  nethaul: 'view', // the net hauled
  trek: 'view', // a trek ashore
  dive: 'view', // a dive
  duel: 'view', // a duel's ring (its end: pvp.ts)
  board_tac: 'view', // a battle's field (a boarding, a fight ashore, the arena, a boss)
  board_fight: 'view', // a boarding round by round
};

const up = new WeakMap<PlayerSession, Set<string>>();

/** Each message to her (Game.sendTo): a card coming up stops her, once (not on every refresh of it). */
export function cardSent(game: Game, s: PlayerSession, msg: ServerMsg): void {
  const field = STOP_CARDS[msg.t];
  if (!field) return;
  let on = up.get(s);
  if (!on) up.set(s, (on = new Set()));
  const shown = (msg as unknown as Record<string, unknown>)[field] != null;
  if (!shown) {
    on.delete(msg.t);
    return;
  }
  if (on.has(msg.t)) return;
  on.add(msg.t);
  allStop(game, s, 'card', msg.t);
}
