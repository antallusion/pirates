// Auto-sail to a mark on the chart (docs/16 #36). The helm is the server's (the client only sends rudder and sail),
// so the helmsman steers here: a route over the nav grid round the islands and reefs, beating to windward on the
// better tack, feeling ahead for shoal water; and he hands the wheel back the moment there is danger — a hostile
// sail within range, a shot at her, a storm, a reef he cannot steer round, a low hull — or the captain touches the
// helm herself. No dice anywhere: the same sea gives the same course (tests replay `game.rng`).

import {
  AUTOSAIL_ARRIVE, AUTOSAIL_DANGER_R, AUTOSAIL_LOW_HULL, AUTOSAIL_MAX_RANGE, AUTOSAIL_REPLANS, AUTOSAIL_STUCK_SEC, autosailSail,
} from '../../../shared/src/data/autosail.ts';
import type { AutosailStop } from '../../../shared/src/data/autosail.ts';
import { NAV_CELL, SAIL_STEPS, WORLD_SIZE } from '../../../shared/src/constants.ts';
import { angleDiff, clamp, headingOf, headingVec, pointInPolygon, wrapAngle } from '../../../shared/src/math.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { depthAt, isLand, navBlocked } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { banksUp } from './isles.ts';
import { findPath, lineFree, nearestFree } from './nav.ts';
import type { Path } from './nav.ts';
import { beatAngle } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

const DEG = Math.PI / 180;

export interface AutoSail {
  /** Her mark, and the point of open water nearest it the route ends at. */
  x: number;
  y: number;
  path: Path;
  /** The route's point she steers for. */
  i: number;
  /** The sail step she carries (0–4); a different one from the captain is her hand on the sheets. */
  sail: number;
  since: number;
  tackSide: number;
  tackAt: number;
  beatAt: number;
  stuck: { x: number; y: number; t: number };
  replans: number;
}

const runs = new WeakMap<ShipEntity, AutoSail>();

export function autosailOf(ship: ShipEntity | null | undefined): AutoSail | null {
  return ship ? runs.get(ship) ?? null : null;
}

function draftOf(ship: ShipEntity): number {
  return ship.cls.draft * Math.max(0.5, 1 + tval(ship.stats, 'draftMul'));
}

/** Whether the water at a point would take her keel (land, shoal, a reef, a bank the tide has bared). */
export function foulWater(game: Game, ship: ShipEntity, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > WORLD_SIZE || y > WORLD_SIZE) return true;
  if (ship.cls.passive.id === 'shallow_runner') {
    if (isLand(game.world, x, y)) return true;
  } else if (depthAt(game.world, x, y) < draftOf(ship) + 0.4) return true;
  for (const b of banksUp(game)) {
    if (Math.abs(b.x - x) > b.r || Math.abs(b.y - y) > b.r) continue;
    if (pointInPolygon(x, y, b.poly)) return true;
  }
  return false;
}

/** What stops the helmsman now, if anything (checked every tick while he has the wheel, and before he takes it). */
export function autosailDanger(game: Game, s: PlayerSession, ship: ShipEntity, since: number): AutosailStop | null {
  if (!ship.alive) return 'lost';
  if (ship.docked) return 'port';
  if (s.profile?.company.mutiny || ship.seizedHelm) return 'helm';
  if (ship.grappled || ship.boarding || ship.landing) return 'attack';
  if (ship.hull < ship.stats.hullMax * AUTOSAIL_LOW_HULL) return 'hull';
  // Her keel on a reef or a shoal already (a bank the tide bared, a reef the chart did not show).
  if (ship.cls.passive.id !== 'shallow_runner' && depthAt(game.world, ship.state.x, ship.state.y) < draftOf(ship)) return 'reef';
  // A shot at her, or her own guns, since he took the wheel (or in the last seconds before).
  if (ship.lastCombat > since || game.now - ship.lastCombat < 5) return 'attack';
  for (const t of ship.attackers.values()) if (t > since) return 'attack';
  const w = game.weatherOf(ship);
  if (w === 'storm' || w === 'black_storm') return 'storm';
  let hostile = false;
  game.forShipsNear(ship.state.x, ship.state.y, AUTOSAIL_DANGER_R, (o) => {
    if (hostile || o.id === ship.id || !o.alive || o.docked || o.ghost || o.surrendered || o.prize) return;
    if (Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) > AUTOSAIL_DANGER_R) return;
    if (game.isHostile(o, ship)) hostile = true;
  });
  return hostile ? 'hostile' : null;
}

/** A route from her to the mark, ending on the open water nearest it when the mark itself is ashore or shoal. */
function plan(game: Game, ship: ShipEntity, x: number, y: number): Path | null {
  let tx = x, ty = y;
  if (foulWater(game, ship, x, y) || navBlocked(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL))) {
    const c = nearestFree(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL));
    if (!c) return null;
    tx = c[0] * NAV_CELL + NAV_CELL / 2;
    ty = c[1] * NAV_CELL + NAV_CELL / 2;
  }
  // Open water all the way: straight there (the grid's coarse cells would only bend a clear line).
  if (lineFree(game.world, ship.state.x, ship.state.y, tx, ty) && !probeLine(game, ship, ship.state.x, ship.state.y, tx, ty)) return [[ship.state.x, ship.state.y], [tx, ty]];
  return findPath(game.world, ship.state.x, ship.state.y, tx, ty, 80_000);
}

/** Foul water somewhere on a straight line (every 60 m). */
function probeLine(game: Game, ship: ShipEntity, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 60);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (foulWater(game, ship, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

function send(game: Game, s: PlayerSession, run: AutoSail | null, why?: AutosailStop): void {
  game.sendTo(s, run ? { t: 'autosail', on: true, x: Math.round(run.x), y: Math.round(run.y), sail: run.sail } : { t: 'autosail', on: false, why: why ?? 'off' });
}

/** The captain gives the helmsman the wheel for her mark. Null when he has it; else why not. */
export function startAutosail(game: Game, s: PlayerSession, x: number, y: number, sail?: number): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WORLD_SIZE || y > WORLD_SIZE) return 'That mark is off the chart';
  if (ship.docked) return 'Cast off first: the helmsman sails from open water';
  const d = Math.hypot(x - ship.state.x, y - ship.state.y);
  if (d <= AUTOSAIL_ARRIVE) return 'You are at your mark already';
  if (d > AUTOSAIL_MAX_RANGE) return 'That mark is too far for one run: set a nearer one';
  const why = autosailDanger(game, s, ship, game.now);
  if (why) return STOP_WORDS[why];
  const path = plan(game, ship, x, y);
  if (!path || path.length < 2) return 'No open water leads to that mark';
  const idx = autosailSail(sail ?? SAIL_STEPS.indexOf(ship.input.sailTarget as never));
  const run: AutoSail = {
    x, y, path, i: 1, sail: idx, since: game.now, tackSide: 1, tackAt: -Infinity, beatAt: -Infinity,
    stuck: { x: ship.state.x, y: ship.state.y, t: game.now }, replans: 0,
  };
  runs.set(ship, run);
  ship.input = { rudder: 0, sailTarget: SAIL_STEPS[idx] };
  send(game, s, run);
  return null;
}

/** The wheel back to the captain, with the reason. */
export function stopAutosail(game: Game, s: PlayerSession, why: AutosailStop): void {
  const ship = s.ship;
  if (!ship || !runs.has(ship)) return;
  runs.delete(ship);
  ship.input = { rudder: 0, sailTarget: ship.input.sailTarget };
  send(game, s, null, why);
}

/** The captain's own helm while the helmsman has the wheel: the steady beat of an idle helm (no rudder, the same
 *  sail) is swallowed; any turn of the wheel or change of sail takes it back. True when the input is swallowed. */
export function autosailInput(game: Game, s: PlayerSession, rudder: number, sail: number): boolean {
  const run = autosailOf(s.ship);
  if (!run) return false;
  if (rudder === 0 && Math.round(sail) === run.sail) return true;
  stopAutosail(game, s, 'manual');
  return false;
}

/** The words for a reason he will not take the wheel (translated on the client, server.ru.h.ts). */
export const STOP_WORDS: Record<AutosailStop, string> = {
  arrived: 'You are at your mark already',
  manual: 'The helm is yours',
  hostile: 'Hostile sails in range: the helm stays with you',
  attack: 'Not while there is fighting',
  storm: 'Not in a storm: the helm stays with you',
  reef: 'Foul water ahead: the helm stays with you',
  hull: 'The hull is too weak to leave her to the helmsman',
  port: 'Cast off first: the helmsman sails from open water',
  lost: 'No ship',
  helm: 'Someone else has the wheel',
  stuck: 'No open water leads to that mark',
  off: 'The helm is yours',
};

/** Steering for her route's next point: beats to windward on the better tack, feels ahead for foul water. Returns the
 *  heading to steer, or null when there is no clear water ahead at all. Exported for the tests. */
export function autosailHeading(game: Game, ship: ShipEntity, run: AutoSail): number | null {
  const now = game.now;
  const { x, y } = ship.state;
  // The next point of the route: skip ahead while a later one is in clear sight.
  while (run.i < run.path.length - 1) {
    const [px, py] = run.path[run.i];
    const [nx, ny] = run.path[run.i + 1];
    if (Math.hypot(px - x, py - y) < NAV_CELL * 0.75 || (lineFree(game.world, x, y, nx, ny) && !probeLine(game, ship, x, y, nx, ny))) run.i++;
    else break;
  }
  const [tx, ty] = run.path[run.i];
  let desired = headingOf(tx - x, ty - y);
  // To windward: on the tack that points nearer the mark, held until the other points clearly nearer (as the NPCs,
  // npc.ts steer, docs/16 P5).
  const wind = game.windFor(ship);
  const rel = relWindDeg(desired, wind);
  const beat = beatAngle(ship.cls.rig, ship.stats.noGoDeg, ship.cls.passive.id === 'weatherly', wind.strength);
  if (beat > 0 && rel < beat) {
    const from = wrapAngle(wind.dir + Math.PI);
    const a = wrapAngle(from + beat * DEG), b = wrapAngle(from - beat * DEG);
    const offA = Math.abs(angleDiff(a, desired)), offB = Math.abs(angleDiff(b, desired));
    const better = offA <= offB ? 1 : -1;
    const fresh = now - run.beatAt > 3;
    if (fresh) run.tackSide = better;
    else if (better !== run.tackSide && Math.abs(offA - offB) > 12 * DEG && now - run.tackAt > 8) {
      run.tackSide = better;
      run.tackAt = now;
    }
    run.beatAt = now;
    desired = run.tackSide > 0 ? a : b;
  }
  // Feeling ahead: the lead line at half and full look; round whatever is there, the nearer turn first. A beat
  // that runs her at foul water comes about onto the other tack before anything else.
  const look = 160 + ship.state.speed * 8;
  const foul = (h: number) => {
    const v = headingVec(h);
    return foulWater(game, ship, x + v.x * look, y + v.y * look) || foulWater(game, ship, x + v.x * look * 0.5, y + v.y * look * 0.5);
  };
  if (!foul(desired)) return desired;
  if (beat > 0 && rel < beat && now - run.tackAt > 8) {
    const from = wrapAngle(wind.dir + Math.PI);
    const other = wrapAngle(from - run.tackSide * beat * DEG);
    if (!foul(other)) {
      run.tackSide = -run.tackSide;
      run.tackAt = now;
      return other;
    }
  }
  for (const off of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2]) if (!foul(desired + off)) return wrapAngle(desired + off);
  return null;
}

/** Every tick, before the ships move: each helmsman checks for danger, then steers. */
export function stepAutosail(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    const run = autosailOf(ship);
    if (!ship || !run) continue;
    if (s.disconnectedAt !== null) {
      stopAutosail(game, s, 'off');
      continue;
    }
    const d = Math.hypot(run.x - ship.state.x, run.y - ship.state.y);
    const end = run.path[run.path.length - 1];
    if (d <= AUTOSAIL_ARRIVE || Math.hypot(end[0] - ship.state.x, end[1] - ship.state.y) <= AUTOSAIL_ARRIVE) {
      stopAutosail(game, s, 'arrived');
      continue;
    }
    const why = autosailDanger(game, s, ship, run.since);
    if (why) {
      stopAutosail(game, s, why);
      continue;
    }
    // Stuck (a headland the grid did not see, a dead calm): plan afresh a few times, then give up.
    if (game.now - run.stuck.t > AUTOSAIL_STUCK_SEC) {
      const moved = Math.hypot(ship.state.x - run.stuck.x, ship.state.y - run.stuck.y);
      run.stuck = { x: ship.state.x, y: ship.state.y, t: game.now };
      if (moved < 60) {
        if (++run.replans > AUTOSAIL_REPLANS) {
          stopAutosail(game, s, 'stuck');
          continue;
        }
        const p = plan(game, ship, run.x, run.y);
        if (p && p.length >= 2) {
          run.path = p;
          run.i = 1;
        }
      }
    }
    const h = autosailHeading(game, ship, run);
    if (h === null) {
      stopAutosail(game, s, 'reef');
      continue;
    }
    ship.input = { rudder: clamp(angleDiff(ship.state.heading, h) * 2.2, -1, 1), sailTarget: SAIL_STEPS[run.sail] };
  }
}
