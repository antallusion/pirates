// Coves and lights (docs/08 Phase 2): a hidden cove you have found is a secret harbour — hove to in it, out of a
// fight, and the ship lies hidden from patrols and hunters while her carpenters patch her (to 80%) and the crew
// steadies. Lighthouses are landmarks: their light is seen far beyond the lookout's sight — 5 km by day, 9 km at
// night (half in fog) — and charts their island. (Night navigation by lights is on the client: in the dark, the
// minimap shows shoals only within reach of a light.)

import { isNight } from '../../../shared/src/constants.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { coveAt } from './smugglefx.ts';

const HAVEN_CAP = 0.8;
const lightIslands = new WeakMap<Game, number[]>();

/** Islands with a lighthouse (cached per world). */
export function lighthouseIslands(game: Game): number[] {
  let list = lightIslands.get(game);
  if (!list) lightIslands.set(game, (list = game.world.islands.filter((is) => is.features.includes('lighthouse')).map((is) => is.id)));
  return list;
}

/** How far a lighthouse is seen: farther at night, halved in fog. */
export function lightRange(night: boolean, fog: boolean): number {
  return (night ? 9000 : 5000) * (fog ? 0.5 : 1);
}

/** Once a second: lights on the horizon, and the cove's shelter. */
export function havenSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship, p = s.profile;
  if (!ship || !p || ship.docked) return;
  // Lighthouses as landmarks.
  const range = lightRange(isNight(game.now), game.weatherOf(ship) === 'fog');
  for (const id of lighthouseIslands(game)) {
    if (s.discovered.has(id)) continue;
    const is = game.world.islands[id];
    if (dist(is.x, is.y, ship.state.x, ship.state.y) > range) continue;
    game.markDiscovered(s, is);
    game.sendTo(s, { t: 'toast', msg: `A light on the horizon: the lighthouse of ${is.name}.`, kind: 'info' });
  }
  // The secret harbour.
  const cove = coveAt(game, ship);
  if (!cove || !p.smuggle.coves.includes(cove.id) || ship.state.speed > 1 || ship.underFire(game.now)) {
    if (ship.havenOf !== null) ship.havenOf = null;
    return;
  }
  if (ship.havenOf !== cove.id) {
    ship.havenOf = cove.id;
    game.sendTo(s, { t: 'toast', msg: `At anchor in ${cove.name}: hidden from patrols, the carpenters at work.`, kind: 'good' });
  }
  ship.addEffect({ id: 'haven', until: game.now + 1.6, flags: ['hidden'] }, game.now);
  if (ship.hull < ship.stats.hullMax * HAVEN_CAP) ship.hull = Math.min(ship.stats.hullMax * HAVEN_CAP, ship.hull + ship.stats.hullMax * 0.004);
  if (ship.sails < ship.stats.sailHpMax * HAVEN_CAP) ship.sails = Math.min(ship.stats.sailHpMax * HAVEN_CAP, ship.sails + ship.stats.sailHpMax * 0.005);
  ship.sanity = Math.min(100, ship.sanity + 0.3);
}
