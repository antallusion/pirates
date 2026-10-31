// «Острова не бесконечны» (forum post 40): the navigator's charting perks stay useful once every island is on her
// chart. Charting is no longer only a new island — it is any new knowledge of the sea:
//   · a page of soundings — every SOUNDING_PAGE km² of fog her own ship's lookouts lift (fog.ts fogSecond);
//   · a lookout climbed (isles.ts; each rests two hours, then shows its waters again);
//   · a lane buoy read (seamarks.ts; each mark is hers once a day);
//   · a star fix taken (abilities.ts) — and when it finds no new island, the reckoning is exact: +8% speed for 3 min,
//     the sea's marks, wrecks and guards within its 7 km charted as well.
// «Первопроходец» (exp_pathfinder): +2% speed a rank for 10 min (and the crew's lift) at every charting, not only an
// island's. «Картограф» (exp_cartographer): its +20% a rank of the charting's experience counts on the lookouts, the
// buoys and the pages of soundings too (a page gives experience only to a Cartographer).

import { pointsXp } from '../../../shared/src/data/xpcurve.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** Square kilometres of new sea her own lookouts lift that make a page of soundings. */
export const SOUNDING_PAGE = 100;
/** A page's charting experience for each rank of «Картограф» (points of the level's curve). */
export const PAGE_XP = 10;
/** The star fix's exact reckoning when there is nothing new to chart: speed, for how long (s). */
export const RECKONING_SPEED = 0.08;
export const RECKONING_SEC = 180;
/** How long «Первопроходец»'s lift lasts (s). */
export const PATHFINDER_SEC = 600;

export type ChartHow = 'island' | 'sea' | 'lookout' | 'buoy' | 'star';

/** The Cartographer's share of a charting's experience (0.2 a rank). */
export function cartography(s: PlayerSession): number {
  return s.ship ? tval(s.ship.stats, 'cartography') : 0;
}

/** Something new charted: «Первопроходец» lifts the crew and the sails (an island and a lookout the most; a page of
 *  soundings, a buoy, a star fix half the crew's lift). */
export function charted(game: Game, s: PlayerSession, how: ChartHow): void {
  const ship = s.ship;
  if (!ship || !ship.alive) return;
  const pf = tval(ship.stats, 'pathfinder');
  if (pf <= 0) return;
  ship.morale = Math.min(100, ship.morale + (how === 'island' || how === 'lookout' ? 10 : 5));
  ship.addEffect({ id: 'pathfinder', until: game.now + PATHFINDER_SEC, mods: { maxSpeed: pf } }, game.now);
}

/** The new squares her own ship's lookouts lifted (at sea, not in port): a page of soundings each SOUNDING_PAGE. */
export function soundings(game: Game, s: PlayerSession, n: number): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || n <= 0 || ship.docked) return;
  p.soundings = (p.soundings ?? 0) + n;
  while (p.soundings >= SOUNDING_PAGE) {
    p.soundings -= SOUNDING_PAGE;
    p.soundingPages = (p.soundingPages ?? 0) + 1;
    const carto = cartography(s);
    if (carto > 0) game.grantXp(s, pointsXp(p.level, PAGE_XP * (carto / 0.2)), null);
    charted(game, s, 'sea');
  }
}
