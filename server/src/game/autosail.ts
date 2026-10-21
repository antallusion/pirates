// Auto-sail to a mark on the chart (docs/16 #36). The helm is the server's (the client only sends rudder and sail),
// so the helmsman steers here: a route over the nav grid round the islands and reefs, beating to windward on the
// better tack, feeling ahead for shoal water; and he hands the wheel back the moment there is danger — a hostile
// sail within range, a shot at her, a storm, a reef he cannot steer round, a low hull — or the captain touches the
// helm herself. No dice anywhere: the same sea gives the same course (tests replay `game.rng`).

import { inBattle } from './inbattle.ts';
import {
  AUTOSAIL_ARRIVE, AUTOSAIL_DANGER_R, AUTOSAIL_MAX_RANGE, AUTOSAIL_REPLANS, AUTOSAIL_STUCK_SEC, autosailSail,
} from '../../../shared/src/data/autosail.ts';
import type { AutosailStop } from '../../../shared/src/data/autosail.ts';
import { NAV_CELL, SAIL_STEPS, SPEED_SCALE, WORLD_SIZE } from '../../../shared/src/constants.ts';
import { angleDiff, clamp, headingOf, headingVec, pointInPolygon, wrapAngle } from '../../../shared/src/math.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { depthAt, isLand, navBlocked } from '../../../shared/src/world/worldgen.ts';
import { WORLD_EDGE_MARGIN } from '../../../shared/src/world/regions.ts';
import type { Game } from './Game.ts';
import { banksUp } from './isles.ts';
import { beastBrain } from './beasts.ts';
import { findPath, lineFree, nearestFree } from './nav.ts';
import { hullWater, keelOf, laneFoul, nearestWater, runClear, waterAt } from './seaway.ts';
import type { HullWater } from './seaway.ts';
import type { Path } from './nav.ts';
import { beatAngle } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { pursuitOf } from './pursuit.ts';

const DEG = Math.PI / 180;
/** Never 100 m nearer her mark in this many seconds: she is going round something, not to her mark (a beat to
 *  windward makes good far more than that). */
export const AUTOSAIL_ROUND = 60;
/** Never 100 m nearer her mark in this long, plan after plan: no water leads there (the only run given back short of it). */
export const AUTOSAIL_GIVEUP = 240;

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
  /** The nearest she has been to her mark in the whole run, and when she last came 100 m nearer. */
  ever?: number;
  gainAt?: number;
  /** The nearest she has been to her mark, and when (round and round a thing, never nearer: plan afresh). */
  best?: number;
  bestAt?: number;
  /** The sail her helm carried when he took the wheel (a beat already on its way carries it a moment yet). */
  was?: number;
  /** Within this of her mark she has arrived (seaux 2026-10-11: a sail-to on tap stops at the thing's own reach, not
   *  150 m short of it); AUTOSAIL_ARRIVE when unset. */
  arrive?: number;
  /** The plan last sent to her screen (a new one is sent again). */
  sentPlan?: Path;
  /** When it was last planned afresh (sea's clock): the re-plans off her route are a few seconds apart at most. */
  plannedAt?: number;
  /** When she last looked along the route for a point in clear sight. */
  seeAt?: number;
  /** The end of her first plan (the water by her mark): every new plan ends there too. */
  end?: [number, number];
  /** When she last looked how far off her route she is. */
  offAt?: number;
  /** The new plans made for no clear water ahead. */
  blocked?: number;
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

/** Why the helmsman last gave the wheel back, and when (route, goalroute.ts: her hand ends a run to a goal, a fight
 *  only breaks it off). */
const lastStop = new WeakMap<ShipEntity, { why: AutosailStop; at: number }>();
export function lastStopOf(ship: ShipEntity): { why: AutosailStop; at: number } | null {
  return lastStop.get(ship) ?? null;
}
/** When her own hand last turned the wheel with nobody else at it (-Infinity: never). */
export function helmTouched(ship: ShipEntity): number {
  return helmAt.get(ship) ?? -Infinity;
}

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
  const why = autosailDanger(game, s, ship, game.now - RESUME_CALM, p);
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

/** A mark this near a harbour is a run home: the low hull stops no helmsman taking her there. */
export const HOMEWARD_R = 800;

/** Whether a mark is a harbour (a run home for the yard). */
export function homeward(game: Game, x: number, y: number): boolean {
  return game.world.ports.some((pt) => Math.hypot(pt.x - x, pt.y - y) < HOMEWARD_R);
}

/** What stops the helmsman now, if anything (checked every tick while he has the wheel, and before he takes it);
 *  `mark` — where he is to take her.
 *
 *  Owner, 2026-10-19: «Автоплавание … надо чтобы работало всегда и везде»: no sailcloth (she sails slower, as torn
 *  canvas does), no provisions, a low hull, a short crew, a storm (he reefs to three quarters: the canvas is not
 *  shredded), fog, night, a hostile sail merely in sight, a reef under her keel (he works her off it) — none of them
 *  takes the wheel from him any longer. Only a fight under way breaks a course off (and it is taken up again once the
 *  sea is quiet, stepResume), her ship lost, a harbour, or another hand at the wheel (a mutiny). `mark` is kept for the
 *  callers (a run home was the one a low hull allowed). */
export function autosailDanger(game: Game, s: PlayerSession, ship: ShipEntity, since: number, mark?: { x: number; y: number }): AutosailStop | null {
  void mark;
  if (!ship.alive) return 'lost';
  if (ship.docked) return 'port';
  if (s.profile?.company.mutiny || ship.seizedHelm) return 'helm';
  if (ship.grappled || ship.boarding || ship.landing || inBattle(game, ship)) return 'attack'; // (her party's fight ashore too: owner, 2026-10-22)
  // A shot at her, or her own guns, since he took the wheel (or in the last seconds before) — another ship's, not the
  // sea's harm: a reef grinding her keel, a storm, a fire aboard are no fight (they were: «attack», and on a reef the
  // course never came back).
  const fight = Math.max(ship.gunsAt, ship.lastHitAt);
  if (fight > since || game.now - fight < 5) return 'attack';
  for (const t of ship.attackers.values()) if (t > since) return 'attack';
  return null;
}

/** A storm's sail (owner, 2026-10-19: the helmsman sails on in a storm): three quarters at most — the storm shreds only
 *  canvas carried past four fifths (Game.ts). */
export const STORM_SAIL = 3;
/** The sail he carries now for her captain's `sail`: reefed in a storm. */
export function carriedSail(game: Game, ship: ShipEntity, sail: number): number {
  const w = game.weatherOf(ship);
  return w === 'storm' || w === 'black_storm' ? Math.min(sail, STORM_SAIL) : sail;
}

/** A hostile sail within AUTOSAIL_DANGER_R (no longer a stop: the HUD's warning, the tests). */
export function hostileNear(game: Game, ship: ShipEntity): boolean {
  let hostile = false;
  game.forShipsNear(ship.state.x, ship.state.y, AUTOSAIL_DANGER_R, (o) => {
    if (hostile || o.id === ship.id || !o.alive || o.docked || o.ghost || o.surrendered || o.prize) return;
    if (Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) > AUTOSAIL_DANGER_R) return;
    if (o.npcRole === 'beast' && beastBrain(game, o.id)?.target !== ship.id && !((ship.attackers.get(o.id) ?? -999) > game.now - 30)) return;
    if (game.isHostile(o, ship)) hostile = true;
  });
  return hostile;
}

/** The planner's water for her hull (owner, 2026-10-18: «маршруты надо строить минуя заграждения, потому что часто
 *  врезаешься в острова»): her half beam and a margin, and a share of her length besides — her bow swings out as she
 *  turns onto a leg and yaws on a beat, and a long hull laid on a leg 20 m off a coast had it ashore. */
export function planWater(ship: ShipEntity): HullWater {
  const hw = hullWater(ship, 12);
  return { ...hw, r: hw.r + ship.stats.length * 0.3 };
}

/** Her mark's water: the mark itself when her hull may lie there, else the nearest such water within a cable or so
 *  (a quay's, a hulk's, the shore's off a mark on land — never the land: the run ends in water clear by the planner's
 *  margin), else the grid's nearest open cell. */
function endWater(game: Game, ship: ShipEntity, x: number, y: number, hw: HullWater): [number, number] | null {
  // (a fathom under her keel besides: a great hull's mark in a coast's shallows had her keel on the shoal as she came
  // up to it — «foul water», the wheel back, and her way ran her on — tools/nav/autosail-sim.ts)
  const deep = keelOf(ship).shallow ? 0 : keelOf(ship).draft + 1.2;
  const ok = (px: number, py: number) => !foulWater(game, ship, px, py) && (deep <= 0 || depthAt(game.world, px, py) >= deep);
  if (!foulWater(game, ship, x, y) && waterAt(game.world, x, y, hw)) return [x, y];
  const w = nearestWater(game.world, x, y, hw, 450, ok);
  if (w) return w;
  const c = nearestFree(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL));
  return c ? [c[0] * NAV_CELL + NAV_CELL / 2, c[1] * NAV_CELL + NAV_CELL / 2] : null;
}

/** A route from her to the mark, ending on the open water nearest it when the mark itself is ashore or shoal — or on
 *  a solid thing (2026-10-09: a hulk, a pier, a skerry: the water by it her hull may lie in, not the thing). Every leg
 *  sounded for her hull and keel with the planner's margin (planWater) and taken round what lies on it (nav.ts
 *  soundPath); a harbour too narrow for the margin is planned again with her bare hull's. */
export function plan(game: Game, ship: ShipEntity, x: number, y: number): Path | null {
  return planFrom(game, ship, ship.state.x, ship.state.y, x, y);
}

/** The same plan from another point of hers (in port: from the harbour she will cast off from). */
export function planFrom(game: Game, ship: ShipEntity, sx: number, sy: number, x: number, y: number): Path | null {
  const wide = planWater(ship), bare = hullWater(ship);
  for (const hw of [wide, bare]) {
    const end = endWater(game, ship, x, y, hw);
    if (!end) continue;
    const [tx, ty] = end;
    // Open water all the way: straight there (the grid's coarse cells would only bend a clear line).
    if (runFree(game, ship, sx, sy, tx, ty, hw)) return [[sx, sy], [tx, ty]];
    const p = findPath(game.world, sx, sy, tx, ty, 80_000, hw);
    if (p && p.length >= 2 && (hw === bare || pathClear(game, p, hw))) return pullTight(game, ship, p, hw);
  }
  return null;
}

/** Every leg of a route clear for her hull and keel (the planner's last word on a plan). */
export function pathClear(game: Game, p: Path, hw: HullWater): boolean {
  for (let i = 1; i < p.length; i++) if (!runClear(game.world, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], hw)) return false;
  return true;
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

/** A route as the client draws it (owner, 2026-10-18: «всегда должно быть показано направление линией и путь»): whole
 *  metres, from `from` on (the points behind her dropped), at most PATH_SENT points (a long one thinned evenly, its end
 *  kept). */
export const PATH_SENT = 64;
export function pathView(path: Path, from = 0): [number, number][] {
  const p = path.slice(Math.max(0, from));
  let pts = p;
  if (p.length > PATH_SENT) {
    pts = [];
    for (let i = 0; i < PATH_SENT - 1; i++) pts.push(p[Math.floor((i * (p.length - 1)) / (PATH_SENT - 1))]);
    pts.push(p[p.length - 1]);
  }
  return pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
}

function send(game: Game, s: PlayerSession, run: AutoSail | null, why?: AutosailStop): void {
  if (run) run.sentPlan = run.path;
  // (the leg she is on from where she is: her own place first, then the route's points ahead)
  const own: [number, number] | null = run && s.ship ? [s.ship.state.x, s.ship.state.y] : null;
  game.sendTo(s, run ? { t: 'autosail', on: true, x: Math.round(run.x), y: Math.round(run.y), sail: run.sail, path: pathView(own ? [own, ...run.path.slice(run.i)] : run.path) } : { t: 'autosail', on: false, why: why ?? 'off' });
}

/** What she is told when a course is kept for later (translated on the client, server.ru.h.ts). */
export const QUEUED_PORT = 'Course set: the helmsman takes her there as soon as she casts off.';

/** A course given in port, taken up the moment she casts off (owner, 2026-10-19: «работало всегда и везде»). */
const queued = new WeakMap<ShipEntity, Paused>();
/** The course waiting in port for her casting off, if any (tests). */
export function queuedCourse(ship: ShipEntity | null | undefined): { x: number; y: number } | null {
  const q = ship ? queued.get(ship) : undefined;
  return q ? { x: q.x, y: q.y } : null;
}

/** The captain gives the helmsman the wheel for her mark. Null when he has it — or will have it: in port as soon as
 *  she casts off, in a fight once it is over (the course kept, said to her); else why not (no ship, a mark off the
 *  chart or under her keel already, the mutineers at the wheel, no water at all leading there). */
export function startAutosail(game: Game, s: PlayerSession, x: number, y: number, sail?: number, arrive?: number): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WORLD_SIZE || y > WORLD_SIZE) return 'That mark is off the chart';
  const idx = autosailSail(sail ?? SAIL_STEPS.indexOf(ship.input.sailTarget as never));
  const keep: Paused = { x, y, sail: idx, ...(arrive !== undefined ? { arrive } : {}), at: game.now, calm: null };
  if (ship.docked) {
    queued.set(ship, keep);
    paused.delete(ship);
    game.sendTo(s, { t: 'toast', msg: QUEUED_PORT, kind: 'info' });
    return null;
  }
  const d = Math.hypot(x - ship.state.x, y - ship.state.y);
  if (d <= (arrive ?? AUTOSAIL_ARRIVE)) return 'You are at your mark already';
  if (d > AUTOSAIL_MAX_RANGE) return 'That mark is too far for one run: set a nearer one';
  const why = autosailDanger(game, s, ship, game.now, { x, y });
  if (why === 'attack') {
    // a fight under way: the course is kept and taken up once the sea is quiet (stepResume), its line drawn dimmed (the
    // client says «paused: the course goes on after the fight»)
    queued.delete(ship);
    paused.set(ship, keep);
    const p = plan(game, ship, x, y);
    game.sendTo(s, { t: 'autosail', on: false, why: 'attack', x: Math.round(x), y: Math.round(y), ...(p && p.length >= 2 ? { path: pathView(p) } : {}) });
    return null;
  }
  if (why) return STOP_WORDS[why];
  const path = plan(game, ship, x, y);
  if (!path || path.length < 2) return 'No open water leads to that mark';
  const was = SAIL_STEPS.indexOf(ship.input.sailTarget as never);
  const run: AutoSail = {
    was: was >= 0 ? was : lastIn.get(ship) ?? 0,
    x, y, path, i: 1, sail: idx, since: game.now, tackSide: 1, tackAt: -Infinity, beatAt: -Infinity,
    stuck: { x: ship.state.x, y: ship.state.y, t: game.now }, replans: 0, plannedAt: game.now, end: path[path.length - 1], ...(arrive !== undefined ? { arrive } : {}),
  };
  runs.set(ship, run);
  paused.delete(ship);
  queued.delete(ship);
  guards.delete(ship);
  s.sailHold = null;
  ship.input = { rudder: 0, sailTarget: SAIL_STEPS[carriedSail(game, ship, idx)] };
  send(game, s, run);
  return null;
}

/** Each tick for a captain with no helmsman at the wheel: the course given in port taken up once she is at sea. */
function stepQueued(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const q = queued.get(ship);
  if (!q || ship.docked) return;
  queued.delete(ship);
  if (!ship.alive || s.disconnectedAt !== null) return;
  const e = startAutosail(game, s, q.x, q.y, q.sail, q.arrive);
  if (e && e !== STOP_WORDS.arrived) game.sendTo(s, { t: 'toast', msg: e, kind: 'info' });
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
  lastStop.set(ship, { why, at: game.now });
  // Arrived: the sails are taken in — her mark is mostly by a shore, a quay or a lair, and under full sail she ran on
  // past it onto the rocks (docs/30: «Удар о скалы −81» a few seconds after «метка достигнута»); and on foul water or
  // with no way on he heaves to before he gives the wheel back (QA playthrough B: «Struck the rocks −190»).
  const heave = why === 'arrived' || why === 'reef' || why === 'stuck';
  ship.input = { rudder: 0, sailTarget: heave ? 0 : ship.input.sailTarget };
  // …and held so (2026-10-18): her phone sends its helm four times a second, the sail the helmsman was given among it,
  // and that sail set her running on past the mark onto the shore the moment the wheel was hers (the sims: a brig
  // brought to an island's water ran 220 ticks along its rocks). The old sail is held off until she sets another.
  if (heave) s.sailHold = run.sail;
  // Her hand off the wheel a while yet: the lead line still kept (stepGuard) — she is not run ashore by the way she was
  // left with, or by the course she held when a fight broke the run off.
  if (why !== 'manual' && why !== 'lost' && why !== 'port' && why !== 'helm') guards.set(ship, { since: game.now, until: game.now + (RESUMABLE.has(why) ? RESUME_WINDOW : GUARD_SEC), sail: run.sail });
  send(game, s, null, why);
}

/** After the helmsman gives the wheel back (arrived, a fight, foul water) the lead line is kept this long, until her
 *  own hand turns the wheel: no one else steers her, but she is not run onto a coast she was left heading for. */
export const GUARD_SEC = 30;
const guards = new WeakMap<ShipEntity, { since: number; until: number; sail: number }>();

/** Whether the helmsman still keeps her off the rocks after giving her the wheel (tests). */
export function guardOf(ship: ShipEntity): boolean {
  return guards.has(ship);
}

/** Each tick for a ship whose wheel the helmsman gave back: foul water ahead within the way she carries — she is turned
 *  off it (the nearer clear heading), or her sails taken in when none is. Her own hand on the wheel ends it. */
function stepGuard(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const g = guards.get(ship);
  if (!g) return;
  if (game.now > g.until || helmTouched(ship) > g.since || !ship.alive || ship.docked || ship.grappled || ship.boarding || ship.landing || pursuitOf(ship)) {
    guards.delete(ship);
    return;
  }
  const v = ship.state.speed;
  if (v < 0.5) return;
  const { x, y } = ship.state;
  // the water she covers in eight seconds at this way (and her length), her lane her hull's width
  const look = Math.max(ship.stats.length * 1.5 + 30, v * SPEED_SCALE * 8);
  const wide = ship.stats.beam * 0.5 + 6, bow = ship.stats.length * 0.5;
  const foul = (h: number) => {
    const u = headingVec(h);
    const x1 = x + u.x * look, y1 = y + u.y * look;
    return foulWater(game, ship, x1, y1) || foulWater(game, ship, x + u.x * look * 0.5, y + u.y * look * 0.5) || laneFoul(game, ship, x + u.x * bow, y + u.y * bow, x1, y1, wide);
  };
  const h0 = ship.state.heading;
  if (!foul(h0)) return;
  for (const off of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2]) {
    if (foul(h0 + off)) continue;
    ship.input = { rudder: clamp(angleDiff(h0, wrapAngle(h0 + off)) * 2.2, -1, 1), sailTarget: ship.input.sailTarget };
    return;
  }
  ship.input = { rudder: 0, sailTarget: 0 };
  s.sailHold = g.sail;
}

/** A beat of her helm sent before he took the wheel arrives within this many seconds of it. */
export const AUTOSAIL_BEAT = 2;
/** The sail each captain's helm last sent (her idle beat sends it again and again). */
const lastIn = new WeakMap<ShipEntity, number>();

/** The captain's own helm while the helmsman has the wheel: the steady beat of an idle helm (no rudder, the same
 *  sail) is swallowed; any turn of the wheel or change of sail takes it back. True when the input is swallowed.
 *  (2026-10-19: «the same sail» is the helmsman's, or the one her helm was already sending — a beat already on its way
 *  when he took the wheel carries her old sail, and it took the wheel straight back: «Выловить бутылку» far off set the
 *  course and it was gone the next quarter second.) */
export function autosailInput(game: Game, s: PlayerSession, rudder: number, sail: number): boolean {
  const ship = s.ship;
  const run = autosailOf(ship);
  const step = Math.round(sail);
  const before = ship ? lastIn.get(ship) : undefined;
  if (ship) lastIn.set(ship, step);
  if (!run) {
    if (ship && rudder !== 0) helmAt.set(ship, game.now);
    return false;
  }
  if (rudder === 0 && (step === run.sail || step === before || (step === run.was && game.now - run.since < AUTOSAIL_BEAT))) return true;
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

/** A straight run she may sail as it lies, sounded as it is (not by the coarse grid's 400 m cells: a cell is shut a
 *  whole 290 m round a reef, and a mark by one read as walled off from a few hundred metres — she turned back for the
 *  grid's next cell and round again, 2026-10-18): out of the maelstroms' eyes and inside the wall, no foul water on it
 *  (every 60 m), clear for her hull and keel by `hw` (the planner's margin by default). */
export function runFree(game: Game, ship: ShipEntity, x0: number, y0: number, x1: number, y1: number, hw: HullWater = planWater(ship), lead = true): boolean {
  const m = WORLD_EDGE_MARGIN;
  if (x1 < m || y1 < m || x1 > WORLD_SIZE - m || y1 > WORLD_SIZE - m) return false;
  for (const w of game.world.whirlpools) {
    const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey;
    const t = l2 > 0 ? clamp(((w.x - x0) * ex + (w.y - y0) * ey) / l2, 0, 1) : 0;
    if (Math.hypot(x0 + ex * t - w.x, y0 + ey * t - w.y) < w.radius * 0.6) return false;
  }
  return (!lead || !probeLine(game, ship, x0, y0, x1, y1)) && runClear(game.world, x0, y0, x1, y1, hw);
}

/** A straight run she may sail as it lies, by the planner's margin (runFree). */
export function sightClear(game: Game, ship: ShipEntity, x0: number, y0: number, x1: number, y1: number): boolean {
  return runFree(game, ship, x0, y0, x1, y1);
}

/** A plan pulled tight as the water really lies (runFree by `hw`): from each point on to the farthest of the next ones
 *  in clear sight of it, one pass forward (the grid's own pulling knows only its coarse cells). */
function pullTight(game: Game, ship: ShipEntity, p: Path, hw: HullWater): Path {
  if (p.length <= 2) return p;
  const out: Path = [p[0]];
  let a = 0;
  while (a < p.length - 1) {
    let j = a + 1;
    while (j + 1 < p.length && runFree(game, ship, p[a][0], p[a][1], p[j + 1][0], p[j + 1][1], hw)) j++;
    out.push(p[j]);
    a = j;
  }
  return out;
}

/** Steering for her route's next point: beats to windward on the better tack, feels ahead for foul water. Returns the
 *  heading to steer, or null when there is no clear water ahead at all. Exported for the tests. */
export function autosailHeading(game: Game, ship: ShipEntity, run: AutoSail): number | null {
  const now = game.now;
  const { x, y } = ship.state;
  // The next point of the route: on to the one after it once she is at it, or once that one is in clear sight for
  // her hull — sounded with the planner's own margin (2026-10-18: «на 300 м от поворота» she turned for the next point
  // over the headland the turn was there to round), looked at twice a second.
  const reach = Math.max(60, ship.stats.length * 2);
  const sight = now - (run.seeAt ?? -Infinity) >= 0.5;
  if (sight) run.seeAt = now;
  while (run.i < run.path.length - 1) {
    const [px, py] = run.path[run.i];
    const [nx, ny] = run.path[run.i + 1];
    if (Math.hypot(px - x, py - y) < reach || (sight && sightClear(game, ship, x, y, nx, ny))) run.i++;
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

/** Every tick, before the ships move: each helmsman checks for danger, then steers. He never gives the wheel back by
 *  himself short of her mark (owner, 2026-10-19: «работало всегда и везде»): no way through yet is planned afresh, again
 *  and again; no clear water ahead, she is worked off it under little sail — only her mark reached, a fight, port, her
 *  own hand, her ship lost or a mutiny end his run. */
export function stepAutosail(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    const run = autosailOf(ship);
    if (!ship) continue;
    if (!run) {
      stepQueued(game, s, ship);
      if (!autosailOf(ship)) stepResume(game, s, ship);
      if (!autosailOf(ship)) stepGuard(game, s, ship);
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
    const toEnd = Math.hypot(end[0] - ship.state.x, end[1] - ship.state.y);
    if (d <= near || toEnd <= near) {
      stopAutosail(game, s, 'arrived');
      continue;
    }
    // the last stretch to her end (a mark by a shore): as near as she safely comes
    const last = toEnd <= Math.max(near * 3, ship.stats.length * 2 + 60);
    const why = autosailDanger(game, s, ship, run.since, run);
    if (why) {
      stopAutosail(game, s, why);
      continue;
    }
    // Stuck (a headland the grid did not see, a dead calm), or going round and round (2026-10-09: never 100 m nearer
    // her mark in AUTOSAIL_ROUND seconds): plan afresh. Torn canvas or none (no sailcloth to mend it) makes her slow, not
    // stuck: he sails on all the same; and a shore's mark he cannot come nearer to is reached.
    if (run.best === undefined || d < run.best - 100) {
      run.best = d;
      run.bestAt = game.now;
    }
    if (run.ever === undefined || d < run.ever - 100) {
      run.ever = d;
      run.gainAt = game.now;
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
        if (++run.replans > AUTOSAIL_REPLANS && toEnd <= Math.max(near * 4, 600)) {
          stopAutosail(game, s, 'arrived');
          continue;
        }
        // Never 100 m nearer in AUTOSAIL_GIVEUP seconds, plan after plan: no water leads there at all (a wall she has no
        // leave to pass) — the one run he gives back. Slow is not that: a ship in rags gains her 100 m in a minute.
        if (game.now - (run.gainAt ?? run.since) > AUTOSAIL_GIVEUP) {
          stopAutosail(game, s, 'stuck');
          continue;
        }
        replan(game, ship, run);
      }
    }
    // Off her route (a long tack, the current's set, round a thing the lead line found) with no clear water back to
    // its point: planned afresh from where she is (2026-10-18), a few seconds apart at most.
    if (game.now - (run.offAt ?? -Infinity) >= 1) {
      run.offAt = game.now;
      if (offRoute(game, ship, run) && game.now - (run.plannedAt ?? -Infinity) >= REPLAN_GAP) replan(game, ship, run);
    }
    let h = autosailHeading(game, ship, run);
    // No clear water ahead in the last stretch to a mark by a shore (a great hull's lead line reaches past her mark onto
    // the coast beyond it): she is as near as she safely comes — arrived, hove to, not «foul water ahead».
    if (h === null && last) {
      stopAutosail(game, s, 'arrived');
      continue;
    }
    // No clear water ahead at all: a new plan from where she lies.
    if (h === null && game.now - (run.plannedAt ?? -Infinity) >= 2 && replan(game, ship, run)) h = autosailHeading(game, ship, run);
    let carry = carriedSail(game, ship, run.sail);
    if (h === null) {
      // …and none yet: worked off it under little sail — for the open water nearest her, or about
      run.blocked = (run.blocked ?? 0) + 1;
      h = escapeHeading(game, ship);
      carry = Math.min(carry, 1);
    } else run.blocked = 0;
    ship.input = { rudder: clamp(angleDiff(ship.state.heading, h) * 2.2, -1, 1), sailTarget: SAIL_STEPS[carry] };
    // a new plan: her screen draws it
    if (run.sentPlan !== run.path) send(game, s, run);
  }
}

/** The heading off foul water when no heading ahead is clear: for the open water nearest her (as her hull lies in it),
 *  else straight about. */
function escapeHeading(game: Game, ship: ShipEntity): number {
  const { x, y } = ship.state;
  const w = nearestWater(game.world, x, y, hullWater(ship), 600, (px, py) => !foulWater(game, ship, px, py));
  if (w && Math.hypot(w[0] - x, w[1] - y) > 5) return headingOf(w[0] - x, w[1] - y);
  return wrapAngle(ship.state.heading + Math.PI);
}

/** The new plans off her route are at least this many seconds apart. */
export const REPLAN_GAP = 4;

/** A new plan from where she is to her mark (kept when none is found). True when there is one. */
function replan(game: Game, ship: ShipEntity, run: AutoSail): boolean {
  run.plannedAt = game.now;
  // (to the same end as the first plan: a mark ashore re-read from each new place gave a new end each time, and she
  // chased them round a bay)
  const e = run.end ?? [run.x, run.y];
  const p = plan(game, ship, e[0], e[1]);
  if (!p || p.length < 2) return false;
  run.path = p;
  run.i = 1;
  return true;
}

/** Off her route, or her route blocked: the straight way to the point she steers for runs over something her hull
 *  strikes (a plan gone stale, a bank the tide has bared since), or she is farther from her leg than her lead line
 *  reaches and the way back to its point is not clear by the planner's margin. */
function offRoute(game: Game, ship: ShipEntity, run: AutoSail): boolean {
  const a = run.path[Math.max(0, run.i - 1)], b = run.path[run.i];
  const { x, y } = ship.state;
  // (blocked: what the plan itself was sounded for — her hull and keel, the reefs; a coast's shallows only steer her)
  if (!runFree(game, ship, x, y, b[0], b[1], hullWater(ship), false)) return true;
  const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
  const t = l2 > 0 ? clamp(((x - a[0]) * ex + (y - a[1]) * ey) / l2, 0, 1) : 0;
  const off = Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y);
  return off > Math.max(200, ship.stats.length * 4) && !sightClear(game, ship, x, y, b[0], b[1]);
}
