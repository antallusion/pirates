// The fog of war and the island's scouts (owner, 2026-10-17; the rules in shared/src/data/fog.ts, the wire in
// shared/src/fogproto.ts).
//
// Each captain's fog is a bitset of the sea's kilometre squares, kept in her profile (`fog`, base64) and on her session
// while she plays. It is only ever added to: her ship's lookouts as she sails, her island's reach, her scouts' courses,
// and every chart she gets (an island charted — by sight, a bought chart, a lookout, a watchtower, a star fix — clears
// the water about it). New squares go to her client once a second as a short list; the whole at the start.
// A save from before the fog (no `fog`) is given what she already knew: the waters about every island on her chart,
// every port she has put in at, her lookouts, her island and where she is — never less than she knew.
//
// The scouts are kept in her profile too, and sail by the wall clock: a voyage is planned whole when she sends one
// (out by the pathfinder to the point or from fog to fog, then home), so where the scout is is only arithmetic. While
// her captain is aboard the course run since the last second is swept (its squares seen, the islands on it charted);
// a captain away finds the rest swept when she comes back, and the bot tells her when a scout came home (once,
// through the notices' caps: the island's kind). They are no ships of the sea: nothing sees, chases or sinks them.

import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import {
  FOG_CELLS, PORT_SIGHT, SCOUT_AUTO_LEGS, SCOUT_AUTO_REACH, SCOUT_BUILD_SECS, SCOUT_NAMES, SCOUT_RANGE, SCOUT_SIGHT, SCOUT_SPEED, SHIP_SIGHT, START_SIGHT,
  cellMid, courseAt, courseLength, courseSamples, fogCount, fogDecode, fogDisc, fogEncode, fogNearest, isleSight, newFog, scoutLimit,
} from '../../../shared/src/data/fog.ts';
import { LOOKOUT_R } from '../../../shared/src/data/isles.ts';
import type { FogClientMsg, ScoutView, ScoutsView } from '../../../shared/src/fogproto.ts';
import { chunkKey, chunkOf } from '../../../shared/src/world/worldgen.ts';
import { NAV_CELL } from '../../../shared/src/constants.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { findPath, nearestFree } from './nav.ts';
import { has } from './holdings.ts';
import { shipyardLevel } from './baseships.ts';
import { townLevel } from './town.ts';
import { notifyAway } from './tgnotify.ts';
import { soundings } from './charting.ts';

/** A scout as her captain's profile keeps her. */
export interface ScoutRec {
  id: string;
  name: number;
  /** Off the slipway at (wall ms). */
  ready: number;
  /** At sea: her course (flat x, y), when she set out, its length, where she turns for home, «авто», how far along it
   *  her lookouts have swept, and the squares seen on this voyage. */
  route?: number[];
  t0?: number;
  total?: number;
  back?: number;
  auto?: boolean;
  swept?: number;
  found?: number;
}

/** What the session holds of her fog while she plays. */
interface FogState {
  bits: Uint8Array;
  /** Squares seen since the last word to her client. */
  fresh: number[];
  /** The profile's copy is behind. */
  dirty: boolean;
  /** Where her ship's lookouts last swept, and how far. */
  sx: number;
  sy: number;
  sr: number;
  /** Her island's reach last cleared (`island:metres`). */
  isle: string;
}

const states = new WeakMap<PlayerSession, FogState>();
const SWEEP_STEP = 600;
const SHIP_MOVE = 250;

// ------------------------------------------------------------------------------------------------ her fog

/** Her fog (made from what she knew the first time: the migration of a save from before it). */
export function fogState(game: Game, s: PlayerSession): FogState {
  let st = states.get(s);
  if (st) return st;
  const p = s.profile!;
  const bits = typeof p.fog === 'string' ? fogDecode(p.fog) : knownSea(game, s);
  st = { bits, fresh: [], dirty: typeof p.fog !== 'string', sx: NaN, sy: NaN, sr: 0, isle: '' };
  states.set(s, st);
  if (st.dirty) p.fog = fogEncode(bits);
  return st;
}

/** Her fog taken off the session (a profile loaded anew: made again from it at the next call). */
export function fogReset(s: PlayerSession): void {
  states.delete(s);
}

/** The sea a captain knew before the fog: about every island on her chart, every port she put in at (the port she
 *  starts in for a new one), her lookouts, her island and her ship. */
export function knownSea(game: Game, s: PlayerSession): Uint8Array {
  const p = s.profile!;
  const bits = newFog();
  const w = game.world;
  for (const id of p.discovered ?? []) {
    const is = w.islands[id];
    if (is) fogDisc(bits, is.x, is.y, is.radius + 800);
  }
  const visited = (p.regionsSeen ?? []).filter((r) => r.startsWith('visited:')).map((r) => game.portById(r.slice(8))).filter((x) => !!x);
  for (const pt of visited) fogDisc(bits, pt.x, pt.y, PORT_SIGHT);
  const fresh = !visited.length && !(p.discovered ?? []).length;
  const last = game.portById(p.lastPort);
  if (last) fogDisc(bits, last.x, last.y, fresh ? START_SIGHT : PORT_SIGHT);
  for (const id of Object.keys(p.isles?.lookouts ?? {})) {
    const is = w.islands[Number(id)];
    if (is) fogDisc(bits, is.x, is.y, LOOKOUT_R);
  }
  const home = homeOf(game, s);
  if (home) fogDisc(bits, home.x, home.y, home.sight);
  if (s.ship) fogDisc(bits, s.ship.state.x, s.ship.state.y, SHIP_SIGHT);
  return bits;
}

/** The sea within `r` of a point seen by her; with `chart`, the islands there go on her chart as well (a scout's
 *  course, her island's reach). The squares newly seen. */
export function fogReveal(game: Game, s: PlayerSession, x: number, y: number, r: number, chart = false): number {
  if (!s.profile) return 0;
  const st = fogState(game, s);
  const n = fogDisc(st.bits, x, y, r, st.fresh);
  if (n) st.dirty = true;
  if (chart) chartNear(game, s, x, y, r);
  return n;
}

/** The islands within `r` of a point put on her chart (quietly: no discovery's experience — the scouts are free). */
function chartNear(game: Game, s: PlayerSession, x: number, y: number, r: number): void {
  const w = game.world;
  const [x0, y0] = chunkOf(x - r, y - r);
  const [x1, y1] = chunkOf(x + r, y + r);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (const id of w.chunks.get(chunkKey(cx, cy)) ?? []) {
        if (s.discovered.has(id)) continue;
        const is = w.islands[id];
        if (is.minor || is.hidden) continue;
        if (Math.hypot(is.x - x, is.y - y) > r + is.radius * 0.5) continue;
        game.chartIsland(s, is);
      }
    }
  }
}

/** Her new squares to her client, and the profile's copy brought up (once a second, and at a save). */
export function fogFlush(game: Game, s: PlayerSession): void {
  const st = states.get(s);
  if (!st || !s.profile) return;
  if (st.dirty) {
    s.profile.fog = fogEncode(st.bits);
    st.dirty = false;
  }
  if (st.fresh.length) {
    const add = st.fresh;
    st.fresh = [];
    game.sendTo(s, { t: 'fog', add });
  }
}

/** At the start: all her fog, her island's reach, her scouts (their voyages while she was away swept now). */
export function fogInit(game: Game, s: PlayerSession): void {
  if (!s.profile) return;
  const st = fogState(game, s);
  st.isle = '';
  isleReach(game, s, st);
  stepScouts(game, s, false);
  st.fresh = [];
  if (st.dirty) {
    s.profile.fog = fogEncode(st.bits);
    st.dirty = false;
  }
  game.sendTo(s, { t: 'fog', all: s.profile.fog! });
  pushScouts(game, s);
}

/** Her island's reach cleared, when it grew (a new hall, a lighthouse) or she moved her island. */
function isleReach(game: Game, s: PlayerSession, st: FogState): void {
  const home = homeOf(game, s);
  if (!home) return;
  const key = `${home.island}:${home.sight}`;
  if (st.isle === key) return;
  st.isle = key;
  fogReveal(game, s, home.x, home.y, home.sight, true);
}

/** Once a second for each captain: her ship's lookouts, her island's reach, her scouts, and the word to her client. */
export function fogSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship || !s.profile) return;
  const st = fogState(game, s);
  if (ship.alive) {
    const r = Math.max(1500, SHIP_SIGHT * game.sightFactor(ship));
    if (!(Math.hypot(ship.state.x - st.sx, ship.state.y - st.sy) < SHIP_MOVE) || r > st.sr + 1) {
      st.sx = ship.state.x;
      st.sy = ship.state.y;
      st.sr = r;
      soundings(game, s, fogReveal(game, s, ship.state.x, ship.state.y, r)); // her own soundings (forum post 40, charting.ts)
    }
  }
  if (game.tick % 200 < 20) isleReach(game, s, st); // every ten seconds: a hall raised shows soon enough
  stepScouts(game, s, true);
  fogFlush(game, s);
}

// ------------------------------------------------------------------------------------------------ her island

/** Her own island (where the scouts put out from), its shipyard and how far it sees. */
export function homeOf(game: Game, s: PlayerSession): { island: number; x: number; y: number; yard: number; sight: number } | null {
  const h = s.accountId ? game.holdings.own(game, s.accountId) : undefined;
  const is = h ? game.world.islands[h.island] : undefined;
  if (!h || !is) return null;
  const hall = h.yard ? Math.max(1, townLevel(h.yard, 'hall')) : Math.max(1, h.level ?? 1);
  const sight = isleSight(hall, { lighthouse: !!has(h, 'lighthouse'), signal: !!has(h, 'signal_tower'), chart: !!has(h, 'chart_house') });
  return { island: is.id, x: is.x, y: is.y, yard: shipyardLevel(h), sight };
}

// ------------------------------------------------------------------------------------------------ the scouts

function scoutsOf(s: PlayerSession): ScoutRec[] {
  const p = s.profile!;
  p.scouts ??= [];
  return p.scouts;
}

/** Where a scout is on her voyage now (metres along). */
function along(game: Game, x: ScoutRec): number {
  if (!x.route || x.t0 === undefined) return 0;
  return Math.min(x.total ?? 0, Math.max(0, ((game.wallNow() - x.t0) / 1000) * SCOUT_SPEED));
}

function stateOf(game: Game, x: ScoutRec): ScoutView['state'] {
  if (x.ready > game.wallNow()) return 'building';
  return x.route ? 'out' : 'home';
}

/** Why a new scout cannot be laid down now (null: she can). */
function buildWhy(game: Game, s: PlayerSession): string | null {
  const home = homeOf(game, s);
  if (!home) return 'Claim an island of your own first.';
  if (!home.yard) return 'Build a shipyard on the island first.';
  const max = scoutLimit(home.yard);
  if (scoutsOf(s).length >= max) return max < 3 ? `The shipyard keeps ${max} scouts: raise it for more.` : `The shipyard keeps ${max} scouts.`;
  if (scoutsOf(s).some((x) => x.ready > game.wallNow())) return 'A scout is on the slipway already.';
  return null;
}

export function scoutsView(game: Game, s: PlayerSession): ScoutsView {
  const home = homeOf(game, s);
  const st = fogState(game, s);
  const list = scoutsOf(s).map((x): ScoutView => {
    const state = stateOf(game, x);
    return state === 'out'
      ? { id: x.id, name: x.name, state, route: x.route!.map((v) => Math.round(v)), t0: x.t0, total: Math.round(x.total ?? 0), back: Math.round(x.back ?? 0), auto: !!x.auto, found: x.found ?? 0 }
      : state === 'building' ? { id: x.id, name: x.name, state, ready: x.ready } : { id: x.id, name: x.name, state };
  });
  return {
    yard: home?.yard ?? 0, max: scoutLimit(home?.yard ?? 0), list, home: home ? { x: Math.round(home.x), y: Math.round(home.y) } : null, why: buildWhy(game, s),
    speed: SCOUT_SPEED, range: SCOUT_RANGE, now: game.wallNow(), rate: game.timeScale, seen: fogCount(st.bits), cells: FOG_CELLS,
  };
}

export function pushScouts(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'scouts', view: scoutsView(game, s) });
}

/** A scout laid down: free (no silver, no goods, no builders), a minute on the slipway. */
export function scoutBuild(game: Game, s: PlayerSession): string | null {
  const why = buildWhy(game, s);
  if (why) return why;
  const list = scoutsOf(s);
  const used = new Set(list.map((x) => x.name));
  let name = 0;
  while (used.has(name) && name < SCOUT_NAMES.length - 1) name++;
  const p = s.profile!;
  p.scoutSeq = (p.scoutSeq ?? 0) + 1;
  list.push({ id: `sc${p.scoutSeq}`, name, ready: game.wallNow() + SCOUT_BUILD_SECS * 1000 });
  return null;
}

function scoutById(s: PlayerSession, id: unknown): ScoutRec | undefined {
  return scoutsOf(s).find((x) => x.id === String(id));
}

/** A course by the water between two points (flat), or null. */
function courseBetween(game: Game, x0: number, y0: number, x1: number, y1: number, expand = 60000): number[] | null {
  const p = findPath(game.world, x0, y0, x1, y1, expand);
  if (!p || p.length < 2) return null;
  return p.flat();
}

function sendWhy(game: Game, s: PlayerSession, x: ScoutRec | undefined): string | null {
  if (!x) return 'No such scout.';
  const state = stateOf(game, x);
  if (state === 'building') return 'She is still on the slipway.';
  if (state === 'out') return 'She is at sea already.';
  if (!homeOf(game, s)) return 'Claim an island of your own first.';
  return null;
}

/** A scout sent to a point of the chart, and home again. */
export function scoutSend(game: Game, s: PlayerSession, id: unknown, tx: number, ty: number): string | null {
  const x = scoutById(s, id);
  const why = sendWhy(game, s, x);
  if (why) return why;
  const home = homeOf(game, s)!;
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 2600 || ty < 2600 || tx > WORLD_SIZE - 2600 || ty > WORLD_SIZE - 2600) return 'That is beyond the maelstrom wall.';
  if (Math.hypot(tx - home.x, ty - home.y) > SCOUT_RANGE) return `Too far: a scout sails ${SCOUT_RANGE / 1000} km from the island at most.`;
  const out = courseBetween(game, home.x, home.y, tx, ty);
  if (!out) return 'No way by the water leads there.';
  const back = courseBetween(game, out[out.length - 2], out[out.length - 1], home.x, home.y);
  if (!back) return 'No way by the water leads there.';
  setSail(game, s, x!, out, back, false);
  return null;
}

/** «Авто»: from the island to the nearest fog, then the next nearest from there, as far as SCOUT_AUTO_REACH, and home.
 *  Planned whole now on a copy of her fog, as her lookouts would clear it. */
export function scoutAuto(game: Game, s: PlayerSession, id: unknown): string | null {
  const x = scoutById(s, id);
  const why = sendWhy(game, s, x);
  if (why) return why;
  const home = homeOf(game, s)!;
  const sim = fogState(game, s).bits.slice();
  const w = game.world;
  const lo = 2600, hi = WORLD_SIZE - 2600;
  // A square worth the trip: within the maelstrom wall, within reach of home, with open water about its middle.
  const water = (i: number) => {
    const [mx, my] = cellMid(i);
    if (mx < lo || my < lo || mx > hi || my > hi || Math.hypot(mx - home.x, my - home.y) > SCOUT_RANGE) return false;
    const f = nearestFree(w, Math.floor(mx / NAV_CELL), Math.floor(my / NAV_CELL));
    return !!f && Math.abs((f[0] + 0.5) * NAV_CELL - mx) < 900 && Math.abs((f[1] + 0.5) * NAV_CELL - my) < 900;
  };
  const out: number[] = [home.x, home.y];
  let cx = home.x, cy = home.y, run = 0, tries = 0;
  for (let leg = 0; leg < SCOUT_AUTO_LEGS && run < SCOUT_AUTO_REACH && tries < 14; ) {
    const next = fogNearest(sim, cx, cy, SCOUT_RANGE, 1, water)[0];
    if (next === undefined) break;
    tries++;
    const [mx, my] = cellMid(next);
    const c = courseBetween(game, cx, cy, mx, my, 20000);
    if (!c) {
      fogDisc(sim, mx, my, 10); // no way there: not tried again
      continue;
    }
    for (const [px, py] of courseSamples(c, 0, courseLength(c), SWEEP_STEP)) fogDisc(sim, px, py, SCOUT_SIGHT);
    out.push(...c.slice(2));
    run += courseLength(c);
    [cx, cy] = [c[c.length - 2], c[c.length - 1]];
    leg++;
  }
  if (out.length < 4) return 'No fog is left within a scout’s reach.';
  const back = courseBetween(game, cx, cy, home.x, home.y);
  if (!back) return 'No way by the water leads there.';
  setSail(game, s, x!, out, back, true);
  return null;
}

function setSail(game: Game, s: PlayerSession, x: ScoutRec, out: number[], back: number[], auto: boolean): void {
  const route = [...out, ...back.slice(2)];
  x.route = route;
  x.t0 = game.wallNow();
  x.total = courseLength(route);
  x.back = courseLength(out);
  x.auto = auto;
  x.swept = 0;
  x.found = 0;
  dueAdd(game, s.accountId, x.t0 + (x.total / SCOUT_SPEED) * 1000);
}

/** Home now: from where she is by the shortest water (her course so far swept first). */
export function scoutRecall(game: Game, s: PlayerSession, id: unknown): string | null {
  const x = scoutById(s, id);
  if (!x) return 'No such scout.';
  if (stateOf(game, x) !== 'out') return 'She is not at sea.';
  stepScout(game, s, x, true);
  if (!x.route) return null;
  const d = along(game, x);
  if (d >= (x.back ?? 0)) return 'She is on her way home already.';
  const home = homeOf(game, s);
  const at = courseAt(x.route, d);
  const back = home ? courseBetween(game, at.x, at.y, home.x, home.y) : null;
  // No island now (given up): she comes home the way she came.
  const way = back ?? reversed(x.route, d);
  const found = x.found ?? 0;
  dueDrop(game, s.accountId, x.t0! + ((x.total ?? 0) / SCOUT_SPEED) * 1000);
  setSail(game, s, x, [at.x, at.y], way, false);
  x.back = 0;
  x.found = found;
  return null;
}

function reversed(route: number[], d: number): number[] {
  const out: number[] = [];
  let run = 0;
  const at = courseAt(route, d);
  out.push(at.x, at.y);
  const pts: number[][] = [];
  for (let i = 0; i + 1 < route.length; i += 2) {
    if (i >= 2) run += Math.hypot(route[i] - route[i - 2], route[i + 1] - route[i - 1]);
    if (run < d) pts.push([route[i], route[i + 1]]);
  }
  for (let i = pts.length - 1; i >= 0; i--) out.push(pts[i][0], pts[i][1]);
  return out;
}

/** Her scouts' courses swept up to now; one home is told (a toast when she is aboard). */
export function stepScouts(game: Game, s: PlayerSession, aboard: boolean): void {
  for (const x of scoutsOf(s)) if (x.route) stepScout(game, s, x, aboard);
}

function stepScout(game: Game, s: PlayerSession, x: ScoutRec, aboard: boolean): void {
  if (!x.route) return;
  const d = along(game, x);
  const from = x.swept ?? 0;
  if (d > from + 1 || (d >= (x.total ?? 0) && from < d)) {
    for (const [px, py] of courseSamples(x.route, from, d, SWEEP_STEP)) x.found = (x.found ?? 0) + fogReveal(game, s, px, py, SCOUT_SIGHT, true);
    x.swept = d;
  }
  if (d < (x.total ?? 0)) return;
  // Home.
  const found = x.found ?? 0;
  dueDrop(game, s.accountId, x.t0! + ((x.total ?? 0) / SCOUT_SPEED) * 1000);
  delete x.route;
  delete x.t0;
  delete x.total;
  delete x.back;
  delete x.auto;
  delete x.swept;
  delete x.found;
  const name = SCOUT_NAMES[x.name % SCOUT_NAMES.length][0];
  game.sendTo(s, { t: 'toast', msg: `The scout ${name} is home: ${found} squares of the sea charted.`, kind: 'good' });
  if (aboard) pushScouts(game, s);
}

export function scoutMessage(game: Game, s: PlayerSession, msg: FogClientMsg): void {
  let e: string | null = null;
  switch (msg.action) {
    case 'build': e = scoutBuild(game, s); break;
    case 'send': e = scoutSend(game, s, msg.id, Number(msg.x), Number(msg.y)); break;
    case 'auto': e = scoutAuto(game, s, msg.id); break;
    case 'recall': e = scoutRecall(game, s, msg.id); break;
    default: break;
  }
  if (e) game.refuse(s, e, 'scout');
  pushScouts(game, s);
}

// ------------------------------------------------------------------------------------------------ the bot's word

const DUE = 'scout:due';

function dueAll(game: Game): Record<string, number[]> {
  return game.db.getKv<Record<string, number[]>>(DUE) ?? {};
}

function dueAdd(game: Game, acc: number, at: number): void {
  if (!acc) return;
  const all = dueAll(game);
  all[acc] = [...(all[acc] ?? []), Math.round(at)].slice(-6);
  game.db.setKv(DUE, all);
}

function dueDrop(game: Game, acc: number, at: number): void {
  if (!acc) return;
  const all = dueAll(game);
  const list = (all[acc] ?? []).filter((t) => Math.abs(t - at) > 2);
  if (list.length === (all[acc] ?? []).length) return;
  if (list.length) all[acc] = list;
  else delete all[acc];
  game.db.setKv(DUE, all);
}

const lastDue = new WeakMap<Game, number>();

/** Once a minute: a scout home while her captain is away — the bot tells her (the island's kind of notice, within its
 *  caps; a no-op without the bot). Her toast and the sweep wait for her return. */
export function stepScoutNotices(game: Game): void {
  const now = game.wallNow();
  const last = lastDue.get(game) ?? -Infinity;
  if (now - last < 60_000 && now >= last) return;
  lastDue.set(game, now);
  const all = dueAll(game);
  let changed = false;
  for (const [acc, list] of Object.entries(all)) {
    const due = list.filter((t) => t <= now);
    if (!due.length) continue;
    const s = game.sessionByAccount(Number(acc));
    if (!s || !game.sessions.has(s)) notifyAway(game, Number(acc), 'build', {}, 'n.scout');
    const left = list.filter((t) => t > now);
    if (left.length) all[acc] = left;
    else delete all[acc];
    changed = true;
  }
  if (changed) game.db.setKv(DUE, all);
}

// ------------------------------------------------------------------------------------------------ the tester's /fog

/** /fog all: the whole sea seen; /fog reset: only her port's waters (as a new captain); /fog home: her scouts home now. */
export function fogAdmin(game: Game, s: PlayerSession, arg: string): string {
  const p = s.profile!;
  if (arg === 'all') {
    const st = fogState(game, s);
    st.bits.fill(255);
    p.fog = fogEncode(st.bits);
    game.sendTo(s, { t: 'fog', all: p.fog });
    return 'The fog has lifted from the whole sea.';
  }
  if (arg === 'reset') {
    const port = game.portById(p.lastPort);
    const bits = newFog();
    if (port) fogDisc(bits, port.x, port.y, START_SIGHT);
    p.fog = fogEncode(bits);
    fogReset(s);
    const st = fogState(game, s);
    game.sendTo(s, { t: 'fog', all: fogEncode(st.bits) });
    pushScouts(game, s);
    return `The fog is back: only the waters about ${port?.name ?? '?'} are seen.`;
  }
  if (arg === 'home') {
    for (const x of scoutsOf(s)) {
      if (x.route && x.t0 !== undefined) x.t0 = game.wallNow() - ((x.total ?? 0) / SCOUT_SPEED) * 1000 - 1;
      x.ready = Math.min(x.ready, game.wallNow());
    }
    stepScouts(game, s, true);
    fogFlush(game, s);
    pushScouts(game, s);
    return 'Your scouts are home.';
  }
  return 'Usage: /fog all|reset|home';
}
