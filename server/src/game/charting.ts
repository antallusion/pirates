// The navigator's charting perks. Forum post 40 made them fire on any new knowledge of the sea; forum post 45 (a
// player: «100 км² неизведанного моря тоже конечны, а туман снимают разведчики острова — упростите») ties them to the
// one thing that never runs out — the DISTANCE SAILED, her log:
//   · the log counts only real way between distinct points: a leg is credited when she stands LEG_M in a straight line
//     from where the last leg ended (a circle, a drift at anchor, a ship left turning while the captain is away count
//     nothing — a zigzag counts its straight legs only), and at most HOUR_KM an hour;
//   · every PAGE_KM of the log is a page of it:
//       «Картограф» (exp_cartographer): a page gives charting experience, PAGE_XP points a rank, at most DAY_PAGES pages
//         a day (a new island still +20 % a rank, Game.ts; the charts sell 15 % dearer a rank, ports.ts);
//       «Первопроходец» (exp_pathfinder): a page lifts the crew (+5 morale) and the sails (+2 % a rank) until the next
//         page, an hour at most (a new island too: +10 morale);
//   · «Обсервация по звёздам» (star_fix, abilities.ts): the reckoning is exact after every fix, whatever it found —
//     +8 % speed for 3 min, a minute more for every 10 km of the log since the last fix (10 min at most).

import { pointsXp } from '../../../shared/src/data/xpcurve.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** A leg of the log: this many metres in a straight line from where the last one ended. */
export const LEG_M = 5000;
/** A page of the log (km). */
export const PAGE_KM = 100;
/** The most of the log counted in an hour (km): a fast ship's best, no more. */
export const HOUR_KM = 120;
/** «Картограф»: the pages a day that give experience. */
export const DAY_PAGES = 12;
/** «Картограф»: a page's charting experience for each rank (points of the level's curve). */
export const PAGE_XP = 25;
/** The star fix's exact reckoning: speed, its base time (s), a minute more per FIX_KM_MIN km of the log, at most. */
export const RECKONING_SPEED = 0.08;
export const RECKONING_SEC = 180;
export const FIX_KM_MIN = 10;
export const RECKONING_MAX_SEC = 600;
/** «Первопроходец»'s lift: until the next page, this long at most (s). */
export const PATHFINDER_SEC = 3600;
/** Kept for the old saves' pages of soundings (forum post 40). */
export const SOUNDING_PAGE = 100;

export type ChartHow = 'island' | 'page';

/** Her log as the save keeps it. */
export interface NavLog {
  /** Where the leg under way began. */
  x: number;
  y: number;
  /** The log in all (km), and toward the next page. */
  km: number;
  page: number;
  /** The hour (wall, hours since the epoch) and the km counted in it. */
  hour: number;
  hourKm: number;
  /** The day (wall) and the pages of it that gave experience. */
  day: number;
  dayPages: number;
  /** The log at the last star fix. */
  fixKm: number;
}

/** The Cartographer's share of a charting's experience (0.2 a rank). */
export function cartography(s: PlayerSession): number {
  return s.ship ? tval(s.ship.stats, 'cartography') : 0;
}

/** A new island charted, or a page of the log: «Первопроходец» lifts the crew and the sails. */
export function charted(game: Game, s: PlayerSession, how: ChartHow): void {
  const ship = s.ship;
  if (!ship || !ship.alive) return;
  const pf = tval(ship.stats, 'pathfinder');
  if (pf <= 0) return;
  ship.morale = Math.min(100, ship.morale + (how === 'island' ? 10 : 5));
  ship.addEffect({ id: 'pathfinder', until: game.now + PATHFINDER_SEC, mods: { maxSpeed: pf } }, game.now);
}

/** Her log, begun where she is if new. */
export function navLog(game: Game, s: PlayerSession): NavLog | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return null;
  const wall = game.wallNow();
  return (p.navLog ??= { x: ship.state.x, y: ship.state.y, km: 0, page: 0, hour: Math.floor(wall / 3_600_000), hourKm: 0, day: Math.floor(wall / 86_400_000), dayPages: 0, fixKm: 0 });
}

/** Once a second for each captain at sea: a leg credited when she stands LEG_M from its start; a page every PAGE_KM. */
export function logSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship, p = s.profile;
  if (!ship || !p || !ship.alive) return;
  const L = navLog(game, s)!;
  // In port (or carried there): the next leg begins at the quay.
  if (ship.docked) {
    L.x = ship.state.x;
    L.y = ship.state.y;
    return;
  }
  const d = Math.hypot(ship.state.x - L.x, ship.state.y - L.y);
  if (d < LEG_M) return;
  L.x = ship.state.x;
  L.y = ship.state.y;
  const wall = game.wallNow();
  const hour = Math.floor(wall / 3_600_000);
  if (hour !== L.hour) {
    L.hour = hour;
    L.hourKm = 0;
  }
  const km = Math.min(d / 1000, Math.max(0, HOUR_KM - L.hourKm));
  if (km <= 0) return;
  L.hourKm += km;
  logKm(game, s, km);
}

/** Km credited to her log (a leg): the pages it turns. */
export function logKm(game: Game, s: PlayerSession, km: number): void {
  const p = s.profile;
  const L = navLog(game, s);
  if (!p || !L || km <= 0) return;
  L.km += km;
  L.page += km;
  while (L.page >= PAGE_KM) {
    L.page -= PAGE_KM;
    logPage(game, s, L);
  }
}

/** A page of her log: «Картограф»'s experience (DAY_PAGES a day), «Первопроходец»'s lift. */
function logPage(game: Game, s: PlayerSession, L: NavLog): void {
  const p = s.profile!;
  const day = Math.floor(game.wallNow() / 86_400_000);
  if (day !== L.day) {
    L.day = day;
    L.dayPages = 0;
  }
  const carto = cartography(s);
  if (carto > 0 && L.dayPages < DAY_PAGES) {
    L.dayPages++;
    game.grantXp(s, pointsXp(p.level, PAGE_XP * (carto / 0.2)), null);
    game.sendTo(s, { t: 'toast', msg: `A page of the log: ${PAGE_KM} km under sail charted.`, kind: 'xp' });
  }
  charted(game, s, 'page');
}

/** The star fix's reckoning (s): its base, a minute more per FIX_KM_MIN km of the log since the last fix. */
export function reckoningSec(game: Game, s: PlayerSession | null): number {
  const L = s ? navLog(game, s) : null;
  if (!L) return RECKONING_SEC;
  const since = Math.max(0, L.km - L.fixKm);
  L.fixKm = L.km;
  return Math.min(RECKONING_MAX_SEC, RECKONING_SEC + Math.floor(since / FIX_KM_MIN) * 60);
}

/** The new squares her own ship's lookouts lifted: counted (the old pages of soundings), no longer a perk's trigger
 *  (forum post 45: the log is). */
export function soundings(game: Game, s: PlayerSession, n: number): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || n <= 0 || ship.docked) return;
  p.soundings = (p.soundings ?? 0) + n;
  while (p.soundings >= SOUNDING_PAGE) {
    p.soundings -= SOUNDING_PAGE;
    p.soundingPages = (p.soundingPages ?? 0) + 1;
  }
}
