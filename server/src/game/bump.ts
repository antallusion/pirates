// A bump between ships at peace costs the captain's own hull (forum 40, approved by the owner: «верните урон себе при
// ударах о берег и об мирных нпс. Удар о мирных нпс наносит урон своему кораблю, наносит/не наносит урон нпс — не
// считается атакой/тараном, не вызывает агрессию. Тот же лор. И аккуратность в управлении»).
//
// The ram stays what it was (Game.ts collideShips / ram: Ramming Speed, one's own mark, a ship struck just now, ships at
// war — under the pirate flag a peaceful ship rammed so is a skull, flaglaw.ts). A bump is everything else between two
// ships that fend off: the captain who ran into her pays in her own planks, by her way into the other, as on the rocks
// (strike.ts, at BUMP_BITE of the rocks' bite); the other ship loses nothing; no gun was laid, so nobody is struck on the
// record — no aggression, no quarrel, no skull, no infamy, no protection lifted. Her own squadron's ships fend off for
// free (the station-keeping's nudges). No dice.

import { KNOTS_PER_SPEED, STRIKE_COOLDOWN, strikeDamage } from '../../../shared/src/sim/hull.ts';
import { applyDamage } from './combat.ts';
import type { Game } from './Game.ts';
import { onHullDamage } from './mind.ts';
import type { ShipEntity } from './ship.ts';

/** A ship's side against the rocks' bite (1): she gives, so half. */
export const BUMP_BITE = 0.5;

const lastBump = new WeakMap<ShipEntity, number>();

/** The captain behind a ship: her own, or the one whose escort or prize she is. */
function owner(game: Game, x: ShipEntity): number | null {
  if (x.isPlayer) return x.id;
  return x.ownerId !== null && game.ships.get(x.ownerId)?.isPlayer ? x.ownerId : null;
}

/** Two ships that fend off (no ram) met at `closing`: each captain's own ship that ran into one not of her squadron
 *  takes the blow of her own way into it. Returns the hull she lost, by ship id (for the tests). */
export function bumpBlow(game: Game, a: ShipEntity, b: ShipEntity, closing: number, intoB: number, intoA: number): Map<number, number> {
  const out = new Map<number, number>();
  const oa = owner(game, a), ob = owner(game, b);
  if (oa !== null && oa === ob) return out; // her squadron, or herself and hers: fending off
  // (her way into the other — the one at anchor run into pays nothing; both under way, each her own share)
  const hit = (x: ShipEntity, y: ShipEntity, way: number) => {
    if (!x.isPlayer || way <= 0) return;
    const dmg = blow(game, x, y, Math.min(closing, way));
    if (dmg > 0) out.set(x.id, dmg);
  };
  hit(a, b, intoB);
  hit(b, a, intoA);
  return out;
}

function blow(game: Game, ship: ShipEntity, other: ShipEntity, impact: number): number {
  if (!ship.alive || ship.docked || ship.ghost || ship.god || ship.sinkingUntil) return 0;
  const now = game.now;
  if (now - (lastBump.get(ship) ?? -Infinity) < STRIKE_COOLDOWN) return 0;
  const dmg = strikeDamage(impact, BUMP_BITE, ship.stats.hullMax, ship.hull);
  if (dmg <= 0) return 0;
  lastBump.set(ship, now);
  // Straight off her hull, as the rocks take it: no gun laid, no fight begun, nobody on the record.
  ship.hull = Math.max(0, ship.hull - dmg);
  onHullDamage(game, ship, dmg, null);
  if (ship.hull <= 0) applyDamage(game, ship, { hull: 1, laddered: true }, null);
  const x = Math.round((ship.state.x + other.state.x) / 2), y = Math.round((ship.state.y + other.state.y) / 2);
  game.emit({ k: 'fx', fx: 'strike', x, y, r: Math.round(impact * KNOTS_PER_SPEED), ship: ship.id }, x, y);
  game.toastShip(ship, `Bumped the ${other.name} −${Math.round(dmg)}`, 'bad');
  return dmg;
}
