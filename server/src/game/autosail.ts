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
import { beastBrain } from './beasts.ts';
import { findPath, lineFree, nearestFree } from './nav.ts';
import { hullWater, laneFoul, nearestWater, runClear, waterAt } from './seaway.ts';
import type { Path } from './nav.ts';
import { beatAngle } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { onboardingProtected } from './onboarding.ts';
import { pursuitOf } from './pursuit.ts';

const DEG = Math.PI / 180;
/** Never 100 m nearer her mark in this many seconds: she is going round something, not to her mark (a beat to
 *  windward makes good far more than that). */
export const AUTOSAIL_ROUND = 60;

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
  /** The nearest she has been to her mark, and when (round and round a thing, never nearer: plan afresh). */
  best?: number;
  bestAt?: number;
  /** Within this of her mark she has arrived (seaux 2026-10-11: a sail-to on tap stops at the thing's own reach, not
   *  150 m short of it); AUTOSAIL_ARRIVE when unset. */
  arrive?: number;
}

const runs = new WeakMap<ShipEntity, AutoSail>();

// ux2 (owner, 2026-10-11: «вообще нужно максимум автоматизировать все»): a course broken off by a fight — a hostile sail
// in range, a shot, a storm — is not lost. The helmsman keeps her mark and takes the wheel again by himself once the sea
// has been quiet RESUME_CALM seconds (no hostile sail near, no shot either way, no storm) and her own hand has been off
// the wheel as long; within RESUME_WINDOW of the break. Her own stop on the pill, a new mark, port, a weak hull or her
// ship lost drop it.
/** How long after the break a course may still be taken up again (seconds of the sea's clock). */
export const RESUME_WINDOW = 300;
/** The quiet (no danger, her hand off the wheel) before the helmsman takes it again. */
export const RESUME_CALM = 5;
/** What she is told when he does (translated on the client). */
export const RESUME_WORDS = 'The sea is quiet again: the helmsman takes her on to her mark.';
/** The reasons a course is only broken off, not ended. */
const RESUMABLE: ReadonlySet<AutosailStop> = new Set(['hostile', 'attack', 'storm']);

interface Paused {
  x: number;
  y: number;
  sail: number;
  arrive?: number;
  at: number;
  calm: number | null;
}
const paused = new WeakMap<ShipEntity, Paused>();
/** When her own hand last turned the wheel with nobody else at it. */
const helmAt = new WeakMap<ShipEntity, number>();

/** The course broken off by a fight and waiting to be taken up again, if any (tests, the HUD). */
export function pausedCourse(ship: ShipEntity | null | undefined): { x: number; y: number; at: number } | null {
  const p = ship ? paused.get(ship) : undefined;
  return p ? { x: p.x, y: p.y, at: p.at } : null;
}

/** Each tick for a captain with no helmsman at the wheel: a broken-off course taken up again once the sea is quiet. */
function stepResume(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const p = paused.get(ship);
  if (!p) return;
  if (!ship.alive || ship.docked || s.disconnectedAt !== null || game.now - p.at > RESUME_WINDOW || pursuitOf(ship)) {
    paused.delete(ship);
    return;
  }
  // (since RESUME_CALM ago: a shot or a hit in the last seconds is still the fight)
  const why = autosailDanger(game, s, ship, game.now - RESUME_CALM);
  if (why === 'hull' || why === 'lost' || why === 'helm' || why === 'port' || why === 'reef') {
    paused.delete(ship);
    return;
  }
  if (why || game.now - (helmAt.get(ship) ?? -Infinity) < RESUME_CALM) {
    p.calm = null;
    return;
  }
  p.calm ??= game.now;
  if (game.now - p.calm < RESUME_CALM) return;
  paused.delete(ship);
  if (startAutosail(game, s, p.x, p.y, p.sail, p.arrive) === null) game.sendTo(s, { t: 'toast', msg: RESUME_WORDS, kind: 'info' });
}

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
  // (In the First Watch nothing can be lost, and «В порт» after the lesson's battle is the low hull's very cure: the
  // helmsman gave the wheel back at once and the pupil sat a mile off the quay, QA 2026-10-07.)
  if (ship.hull < ship.stats.hullMax * AUTOSAIL_LOW_HULL && !onboardingProtected(s)) return 'hull';
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
    // A beast of the sea is danger once it comes for her — not every shark of the shoal off a harbour (docs/30: thirteen
    // sharks round Moon Landing, «Рядом враждебные паруса» every eight seconds, the helmsman never once took the wheel).
    if (o.npcRole === 'beast' && beastBrain(game, o.id)?.target !== ship.id && !((ship.attackers.get(o.id) ?? -999) > game.now - 30)) return;
    if (game.isHostile(o, ship)) hostile = true;
  });
  return hostile ? 'hostile' : null;
}

/** A route from her to the mark, ending on the open water nearest it when the mark itself is ashore or shoal — or on
 *  a solid thing (2026-10-09: a hulk, a pier, a skerry: the water by it her hull may lie in, not the thing). Every leg
 *  sounded for her hull and keel and taken round what lies on it (nav.ts soundPath). */
export function plan(game: Game, ship: ShipEntity, x: number, y: number): Path | null {
  let tx = x, ty = y;
  const hw = hullWater(ship);
  const ok = (px: number, py: number) => !foulWater(game, ship, px, py);
  if (foulWater(game, ship, x, y) || !waterAt(game.world, x, y, hw)) {
    // The water by the mark (a quay's, a hulk's) when there is some within a cable or so; else the grid's open cell.
    const w = nearestWater(game.world, x, y, hw, 450, ok);
    if (w) [tx, ty] = w;
    else {
      const c = nearestFree(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL));
      if (!c) return null;
      tx = c[0] * NAV_CELL + NAV_CELL / 2;
      ty = c[1] * NAV_CELL + NAV_CELL / 2;
    }
  }
  // Open water all the way: straight there (the grid's coarse cells would only bend a clear line).
  if (lineFree(game.world, ship.state.x, ship.state.y, tx, ty) && !probeLine(game, ship, ship.state.x, ship.state.y, tx, ty) && runClear(game.world, ship.state.x, ship.state.y, tx, ty, hw)) return [[ship.state.x, ship.state.y], [tx, ty]];
  return findPath(game.world, ship.state.x, ship.state.y, tx, ty, 80_000, hw);
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
export function startAutosail(game: Game, s: PlayerSession, x: number, y: number, sail?: number, arrive?: number): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WORLD_SIZE || y > WORLD_SIZE) return 'That mark is off the chart';
  if (ship.docked) return 'Cast off first: the helmsman sails from open water';
  const d = Math.hypot(x - ship.state.x, y - ship.state.y);
  if (d <= (arrive ?? AUTOSAIL_ARRIVE)) return 'You are at your mark already';
  if (d > AUTOSAIL_MAX_RANGE) return 'That mark is too far for one run: set a nearer one';
  const why = autosailDanger(game, s, ship, game.now);
  if (why) return STOP_WORDS[why];
  const path = plan(game, ship, x, y);
  if (!path || path.length < 2) return 'No open water leads to that mark';
  const idx = autosailSail(sail ?? SAIL_STEPS.indexOf(ship.input.sailTarget as never));
  const run: AutoSail = {
    x, y, path, i: 1, sail: idx, since: game.now, tackSide: 1, tackAt: -Infinity, beatAt: -Infinity,
    stuck: { x: ship.state.x, y: ship.state.y, t: game.now }, replans: 0, ...(arrive !== undefined ? { arrive } : {}),
  };
  runs.set(ship, run);
  paused.delete(ship);
  ship.input = { rudder: 0, sailTarget: SAIL_STEPS[idx] };
  send(game, s, run);
  return null;
}

/** The wheel back to the captain, with the reason. */
export function stopAutosail(game: Game, s: PlayerSession, why: AutosailStop): void {
  const ship = s.ship;
  if (!ship) return;
  const run = runs.get(ship);
  // broken off by a fight: kept to be taken up again (stepResume); any other end drops a course kept so
  if (run && RESUMABLE.has(why)) paused.set(ship, { x: run.x, y: run.y, sail: run.sail, ...(run.arrive !== undefined ? { arrive: run.arrive } : {}), at: game.now, calm: null });
  else paused.delete(ship);
  if (!run) return;
  runs.delete(ship);
  // Arrived: the sails are taken in — her mark is mostly by a shore, a quay or a lair, and under full sail she ran on
  // past it onto the rocks (docs/30: «Удар о скалы −81» a few seconds after «метка достигнута»); and on foul water or
  // with no way on he heaves to before he gives the wheel back (QA playthrough B: «Struck the rocks −190»).
  const heave = why === 'arrived' || why === 'reef' || why === 'stuck';
  ship.input = { rudder: 0, sailTarget: heave ? 0 : ship.input.sailTarget };
  send(game, s, null, why);
}

/** The captain's own helm while the helmsman has the wheel: the steady beat of an idle helm (no rudder, the same
 *  sail) is swallowed; any turn of the wheel or change of sail takes it back. True when the input is swallowed. */
export function autosailInput(game: Game, s: PlayerSession, rudder: number, sail: number): boolean {
  const run = autosailOf(s.ship);
  if (!run) {
    if (s.ship && rudder !== 0) helmAt.set(s.ship, game.now);
    return false;
  }
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
  // (And her hull's clearance, 2026-10-08: the shore band, a wreck, a skerry, a pier — what the keel would strike;
  // 2026-10-09: the whole run sounded for the reefs and the bared banks, seaway.ts — and no farther than the route's
  // point she steers for: the water beyond a mark by a hulk is the hulk, and she went round and round it.)
  const look = Math.min(160 + ship.state.speed * 8, Math.max(Math.hypot(tx - x, ty - y) + ship.stats.length * 0.5, ship.stats.length * 2 + 40));
  const wide = ship.stats.beam * 0.5 + 6, bow = ship.stats.length * 0.5;
  const foul = (h: number) => {
    const v = headingVec(h);
    const x1 = x + v.x * look, y1 = y + v.y * look, x2 = x + v.x * look * 0.5, y2 = y + v.y * look * 0.5;
    return foulWater(game, ship, x1, y1) || foulWater(game, ship, x2, y2) || laneFoul(game, ship, x + v.x * bow, y + v.y * bow, x1, y1, wide);
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
    if (!ship) continue;
    if (!run) {
      stepResume(game, s, ship);
      continue;
    }
    if (s.disconnectedAt !== null) {
      stopAutosail(game, s, 'off');
      continue;
    }
    // A prize alongside: the helmsman waits until the spoils are settled.
    if (s.pendingBoarding) {
      ship.input = { rudder: 0, sailTarget: 0 };
      continue;
    }
    const d = Math.hypot(run.x - ship.state.x, run.y - ship.state.y);
    const end = run.path[run.path.length - 1];
    const near = run.arrive ?? AUTOSAIL_ARRIVE;
    if (d <= near || Math.hypot(end[0] - ship.state.x, end[1] - ship.state.y) <= near) {
      stopAutosail(game, s, 'arrived');
      continue;
    }
    const why = autosailDanger(game, s, ship, run.since);
    if (why) {
      stopAutosail(game, s, why);
      continue;
    }
    // Stuck (a headland the grid did not see, a dead calm), or going round and round (2026-10-09: never 100 m nearer
    // her mark in AUTOSAIL_ROUND seconds): plan afresh a few times, then give up.
    if (run.best === undefined || d < run.best - 100) {
      run.best = d;
      run.bestAt = game.now;
    }
    const round = game.now - (run.bestAt ?? game.now) > AUTOSAIL_ROUND;
    if (round || game.now - run.stuck.t > AUTOSAIL_STUCK_SEC) {
      const moved = Math.hypot(ship.state.x - run.stuck.x, ship.state.y - run.stuck.y);
      run.stuck = { x: ship.state.x, y: ship.state.y, t: game.now };
      if (round) {
        run.best = d;
        run.bestAt = game.now;
      }
      if (moved < 60 || round) {
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
