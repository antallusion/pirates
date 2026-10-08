// The hull against the coasts and the sea's solid things on the server's step, and the blow when she strikes one
// (owner, 2026-10-08: «корабли не чувствуют границ островов…», «врезаясь в объекты корабль должен получать урон»).
// The geometry is shared with the client's prediction (shared/src/sim/hull.ts, shared/src/world/solids.ts): the coast
// as drawn, her hull as drawn, pushed out and slid along.
//
// The blow: her way into it in knots, 1.6% of her hull a knot (a little under 1.5 kn is a touch and costs nothing),
// at most a quarter of her in one blow, never the last of a sound hull; then 2.5 s before another (grinding along a
// coast costs nothing more). A shake, splinters and white water where she struck, and one short line: «Удар о скалы −N».
// No dice: the sea's stream is the fights'.

import { KNOTS_PER_SPEED, STRIKE_COOLDOWN, hullResponse, newHit, resolveHull, strikeDamage } from '../../../shared/src/sim/hull.ts';
import type { Blocker, HullHit, StrikeKind } from '../../../shared/src/sim/hull.ts';
import { bankBlockers, blockersNear, turtleBlocker } from '../../../shared/src/world/solids.ts';
import { banksUp } from './isles.ts';
import { turtlesNow } from './isles18.ts';
import { applyDamage } from './combat.ts';
import type { Game } from './Game.ts';
import { onHullDamage } from './mind.ts';
import type { ShipEntity } from './ship.ts';

/** The words of a blow, by what she struck (with the hull lost after them: client/src/lang/server.ru.isle.ts). */
export const STRIKE_WORDS: Record<StrikeKind, string> = {
  rock: 'Struck the rocks',
  wreck: 'Struck the wreckage',
  ice: 'Struck the ice',
  buoy: 'Struck a buoy',
  hulks: 'Struck the moored hulks',
  pier: 'Struck the pier',
  sand: 'Ran onto a sandbank',
  shell: "Struck the turtle's shell",
};

const near: Blocker[] = [];
const hit: HullHit = newHit();
const lastBlow = new WeakMap<ShipEntity, number>();
/** When the step first had her (world seconds): a ship the sea has just put out (a new merchant at her anchorage, a
 *  rover set down by a coast) is eased clear of what she was put beside, not struck on it. */
const firstSeen = new WeakMap<ShipEntity, number>();
export const SETTLE_SEC = 1.5;

/** How many times a hull touched something and how many blows it took, by ship (for the tests and the sims). */
export const touches = new WeakMap<ShipEntity, { touch: number; blow: number; kind: StrikeKind; at: number }>();
const tally = (ship: ShipEntity) => {
  let t = touches.get(ship);
  if (!t) touches.set(ship, (t = { touch: 0, blow: 0, kind: 'rock', at: 0 }));
  return t;
};

/** When she last took a blow (world seconds; −∞ never). */
export const lastStrikeOf = (ship: ShipEntity): number => lastBlow.get(ship) ?? -Infinity;

/** After her sailing step: her hull out of whatever she ran into, her way along it kept, the blow taken. Returns the
 *  blow's hull damage (0: none, or only a touch). */
export function hullStep(game: Game, ship: ShipEntity, dt: number): number {
  if (!firstSeen.has(ship)) firstSeen.set(ship, game.now);
  const len = ship.stats.length, beam = ship.stats.beam, reach = len * 0.5 + beam * 0.5 + 2;
  blockersNear(game.world, ship.state.x, ship.state.y, reach, near);
  // The banks the tide has bared and the turtle islands up: land while they are up.
  for (const b of banksUp(game)) {
    if (Math.abs(b.x - ship.state.x) > b.r * 1.2 + reach || Math.abs(b.y - ship.state.y) > b.r * 1.2 + reach) continue;
    for (const q of bankBlockers(b)) near.push(q);
  }
  for (const { d, p } of turtlesNow(game)) {
    if (Math.abs(p.x - ship.state.x) > d.r * 1.2 + reach || Math.abs(p.y - ship.state.y) > d.r * 1.2 + reach) continue;
    near.push(turtleBlocker(p.x, p.y, d.r));
  }
  if (!near.length || !resolveHull(ship.state, len, beam, near, hit)) return 0;
  const t = tally(ship);
  t.touch++;
  t.kind = hit.kind;
  t.at = game.now;
  const impact = hullResponse(ship.state, hit, dt);
  const dmg = impact > 0 ? blow(game, ship, impact, hit) : 0;
  if (dmg > 0) t.blow++;
  return dmg;
}

/** The blow of a strike: damage by her way into it, once in STRIKE_COOLDOWN, never on a beast, a boss or a god. */
export function blow(game: Game, ship: ShipEntity, impact: number, h: HullHit): number {
  if (!ship.alive || ship.docked || ship.ghost || ship.god || ship.sinkingUntil || ship.npcRole === 'beast' || ship.npcRole === 'boss') return 0;
  const now = game.now;
  if (now - lastStrikeOf(ship) < STRIKE_COOLDOWN || now - (firstSeen.get(ship) ?? -Infinity) < SETTLE_SEC) return 0;
  const dmg = strikeDamage(impact, h.dmg, ship.stats.hullMax, ship.hull);
  if (dmg <= 0) return 0;
  lastBlow.set(ship, now);
  // Straight off her hull: no gun was laid on her, so no fight begins, no protection lifts and no flag is raised.
  ship.hull = Math.max(0, ship.hull - dmg);
  onHullDamage(game, ship, dmg, null);
  // A blow that leaves nothing: the sinking's own rules (a last stand, the unsinkable) by the usual road.
  if (ship.hull <= 0) applyDamage(game, ship, { hull: 1, laddered: true }, null);
  const x = Math.round(h.px), y = Math.round(h.py);
  game.emit({ k: 'fx', fx: 'strike', x, y, r: Math.round(impact * KNOTS_PER_SPEED), ship: ship.id }, x, y);
  game.toastShip(ship, `${STRIKE_WORDS[h.kind]} −${Math.round(dmg)}`, 'bad');
  return dmg;
}
