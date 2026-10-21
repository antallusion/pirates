// Owner, 2026-10-22: «если я сражаюсь с кем-то, то делай корабль неактивным для окружения вообще. ни для игроков, ни для
// нпс, никаких автонападений и багов быть не должно». One rule for the whole sea: a captain in ANY battle — a stack's or
// a lair's fight ashore, a boarding (her own or a group mate's as an ally), a bout, a boss's or a legend's battle on the
// hexes — is out of the sea's reach, and so for a short grace after it ends and while its reckoning is on her screen:
//  - nobody (a captain, a ship of the sea, a beast) targets, fires on, rams, grapples or boards her (combat.ts
//    damageBlocked / applyDamage, boarding.ts canBoard / startBoarding);
//  - the sea's ships drop her as their prey and do not take her up (npc.ts);
//  - nothing pulls her into a second fight (startBoarding, the fights ashore refuse);
//  - the others see her «в бою» (SF.IN_BATTLE: dimmed, crossed swords).
// The grace is no shield to fight from: it ends the moment she fires or grapples herself.

import { landFighting } from './beastlairs.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

/** Seconds she stays out of reach after a battle ends (owner: «~10–15 s»). */
export const BATTLE_GRACE = 12;
/** Her battle's reckoning on her screen keeps her out of reach this long at the most (an idle phone keeps no shield). */
export const BATTLE_CARD_MAX = 60;
/** Seconds of grace left once she puts the reckoning away (a moment to see the sea again). */
export const BATTLE_CARD_AFTER = 5;

export const IN_BATTLE_WHY = 'She is in battle: nobody may touch her until it is over.';
export const SELF_IN_BATTLE_WHY = 'Finish your battle first.';

/** In a battle now: a boarding at the rails (not the mother ship of a jolly-boat raid, who sails on), a group mate's
 *  boarding as her ally, a fight of her party ashore (its reckoning still up counts: the stacks, the lairs, the drifts,
 *  the seals, the shore's bosses). */
export function inBattle(game: Game, ship: ShipEntity): boolean {
  if (ship.grappled) return true;
  if (ship.accountId === null) return false;
  const s = game.sessionOf(ship);
  return !!s && landFighting(game, s);
}

/** Out of the sea's reach: in a battle, or in its grace (or its reckoning still on her screen). */
export function untouchable(game: Game, ship: ShipEntity): boolean {
  if (inBattle(game, ship)) return true;
  if (ship.accountId === null) return false;
  const now = game.now;
  return ship.battleGraceUntil > now || (ship.battleCardAt > 0 && now - ship.battleCardAt < BATTLE_CARD_MAX);
}

/** The one ship that may still touch her: the one she is locked with. */
export function battlePartner(a: ShipEntity, b: ShipEntity): boolean {
  return (!!a.boarding && a.boarding.with === b.id) || (!!b.boarding && b.boarding.with === a.id);
}

/** Why `a` may not touch `b` for the battles (null: the battles let her). */
export function battleBlocked(game: Game, a: ShipEntity | null, b: ShipEntity): string | null {
  if (a && battlePartner(a, b)) return null;
  if (untouchable(game, b)) return IN_BATTLE_WHY;
  if (a && a.id !== b.id && inBattle(game, a)) return SELF_IN_BATTLE_WHY;
  return null;
}

/** A battle of hers is over: the grace begins, and the reckoning is on her screen until she puts it away. */
export function battleEnded(game: Game, ship: ShipEntity | null | undefined, card = true): void {
  if (!ship || ship.accountId === null) return;
  ship.battleGraceUntil = Math.max(ship.battleGraceUntil, game.now + BATTLE_GRACE);
  ship.battleCardAt = card ? game.now : 0;
}

/** She put the battle's reckoning away. */
export function battleCardClosed(game: Game, ship: ShipEntity | null | undefined, force = false): void {
  if (!ship || (!ship.battleCardAt && !force)) return;
  ship.battleCardAt = 0;
  ship.battleGraceUntil = Math.max(Math.min(ship.battleGraceUntil, game.now + BATTLE_GRACE), game.now + BATTLE_CARD_AFTER);
}

/** She fires or grapples herself: her grace is over (no shield to fight from). */
export function dropGrace(ship: ShipEntity | null | undefined): void {
  if (!ship) return;
  ship.battleGraceUntil = 0;
  ship.battleCardAt = 0;
}
