// What a keel strikes besides a coast (owner, 2026-10-08: «корабли не чувствуют … некоторых других объектов»), each
// as it is drawn, for the server's step and the client's prediction alike (shared/src/sim/hull.ts):
//   - the dense sea's marks: a wreck field's hulk (the painted shipwreck lies across its square: three circles down
//     its length), the wreckage of the "bones" mark, an ice floe, a lane buoy and a lantern float (driftwood floats:
//     she sails through it);
//   - the adventure map's skerries (the ring of rock each thing stands on);
//   - the wonders that are rock or ice above the water (the sea arch, the singing rocks, the floes);
//   - a graveyard island's hulks run up on her shore (their places now one shared reckoning, drawn and struck alike);
//   - a town's quays and piers (the foot of its painting, out over the water: no ship stands on a pier, CLAUDE.md §3).
// The server indexes them by chunk once per world; the client makes the same blockers from what it has been sent.

import { CHUNK_SIZE, CHUNKS_PER_SIDE } from '../constants.ts';
import { buildAdv } from '../data/advmap.ts';
import { placeWonders } from '../data/wonders.ts';
import type { WonderKind } from '../data/wonders.ts';
import { RAFT_PAD, SHORE_PAD, SOLID_PAD, blockerProbe, boxBlocker, coastBlocker, discBlocker } from '../sim/hull.ts';
import type { Blocker, Probe } from '../sim/hull.ts';
import { isleType } from './archipelago.ts';
import type { Island, World } from './worldgen.ts';
import { chunkKey, legacyIslands } from './worldgen.ts';

/** A small generator of its own (each placement its own stream: nothing here draws on the sea's dice). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local (u, v) of a thing drawn turned `rot` about (x, y), in the world (the canvas's rotate()). */
const turn = (x: number, y: number, rot: number, u: number, v: number): [number, number] => [x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)];

/** The painted shipwreck (prop.shipwreck) lies corner to corner across its square: three circles down it. */
function wreckDiscs(x: number, y: number, size: number, rot: number, kind: Blocker['kind'], bite: number, out: Blocker[]): void {
  for (const [u, v] of [[-0.28, -0.27], [0, 0.03], [0.27, 0.27]] as const) {
    const [px, py] = turn(x, y, rot, u * size, v * size);
    out.push(discBlocker(px, py, 0.13 * size, kind, bite));
  }
}

/** The painted wreckage (prop.wreckage): the broken hull left of its middle; the rest floats. */
function wreckageDisc(x: number, y: number, size: number, rot: number, bite: number, out: Blocker[]): void {
  const [px, py] = turn(x, y, rot, -0.18 * size, 0.02 * size);
  out.push(discBlocker(px, py, 0.17 * size, 'wreck', bite));
}

// ------------------------------------------------------------------ one thing at a time (cached on the thing)

const cache = new WeakMap<object, Blocker[]>();
function once(o: object, make: (out: Blocker[]) => void): Blocker[] {
  let b = cache.get(o);
  if (!b) {
    b = [];
    make(b);
    cache.set(o, b);
  }
  return b;
}

/** An island's coast (the shore band and a margin; a floating town's hulks a few metres). */
export function islandBlockers(is: { poly: ArrayLike<number>; raft?: boolean }): Blocker[] {
  return once(is, (out) => {
    if (is.poly.length >= 6) out.push(coastBlocker(is.poly, is.raft ? RAFT_PAD : SHORE_PAD, is.raft ? 'hulks' : 'rock', is.raft ? 0.6 : 1));
  });
}

/** A mark of the dense sea, as the renderer draws it (renderer.ts drawSeaMarks: its square is twice its r). */
export function markBlockers(m: { kind: string; x: number; y: number; r: number; rot: number }): Blocker[] {
  return once(m, (out) => {
    // As the chunk sends it (Game.ts: whole metres, the turn to a hundredth), so the client strikes the same hulk.
    const x = Math.round(m.x), y = Math.round(m.y), r = Math.round(m.r), rot = Math.round(m.rot * 100) / 100;
    const size = r * 2;
    if (m.kind === 'wreck') wreckDiscs(x, y, size, rot, 'wreck', 0.8, out);
    else if (m.kind === 'bones') wreckageDisc(x, y, size, rot, 0.8, out);
    else if (m.kind === 'floe') out.push(discBlocker(x, y, r * 0.8, 'ice', 0.7));
    else if (m.kind === 'buoy' || m.kind === 'lantern') out.push(discBlocker(x, y, r, 'buoy', 0.3, 2));
  });
}

/** The skerry an adventure map's thing stands on (client/src/render/advmap.ts: a ring of rock 0.62 of 54 m). */
export const SKERRY_R = 30;
export function skerryBlockers(o: { x: number; y: number }): Blocker[] {
  return once(o, (out) => out.push(discBlocker(o.x, o.y, SKERRY_R, 'rock', 1)));
}

/** A wonder's turn on the chart (renderer.ts drawWonders: from its id's letters). */
export const wonderTurn = (id: string): number => id.charCodeAt(1) * 13 + (id.charCodeAt(2) || 0);

/** The wonders that stand above the water: the sea arch (a half ring of rock, 22–36 m), the singing rocks (four
 *  boulders 24 m out), the floes (a cluster some 40 m across). The rest are under the water or in it. */
export function wonderBlockers(w: { id: string; kind: WonderKind | string; x: number; y: number }): Blocker[] {
  return once(w, (out) => {
    if (w.kind === 'arch') {
      const rot = wonderTurn(w.id);
      for (let k = 0; k <= 4; k++) {
        const a = Math.PI + (k / 4) * Math.PI;
        const [px, py] = turn(w.x, w.y, rot, Math.cos(a) * 29, Math.sin(a) * 29);
        out.push(discBlocker(px, py, 8, 'rock', 1));
      }
    } else if (w.kind === 'singing') out.push(discBlocker(w.x, w.y, 34, 'rock', 1));
    else if (w.kind === 'ice') out.push(discBlocker(w.x, w.y, 40, 'ice', 0.7));
  });
}

/** A graveyard island's hulks and flotsam along her shore (drawn by client/src/render/isletype.ts drawIsleOver). */
export interface Hulk {
  x: number;
  y: number;
  size: number;
  rot: number;
  art: 'prop.shipwreck' | 'prop.wreckage' | 'prop.flotsam';
}

const hulks = new WeakMap<object, Hulk[]>();
/** Where a graveyard island's wrecks lie: up to seven by her coast's vertices, a hulk and a wreckage half on her shore,
 *  then flotsam a little off it. One reckoning for the drawing and the keel (its own generator, from her id). */
export function graveHulks(is: { id: number; x: number; y: number; r: number; poly: ArrayLike<number> }): Hulk[] {
  let h = hulks.get(is);
  if (h) return h;
  h = [];
  const rnd = seeded(is.id * 9173 + 41);
  const n = is.poly.length >> 1;
  const k = Math.min(7, 3 + Math.floor(is.r / 150));
  const arts = ['prop.shipwreck', 'prop.wreckage', 'prop.flotsam'] as const;
  for (let i = 0; i < k && n > 0; i++) {
    const v = Math.floor(((i + rnd() * 0.6) / k) * n) % n;
    const px = Math.round(is.poly[v * 2]), py = Math.round(is.poly[v * 2 + 1]);
    const art = arts[i % 3];
    const size = art === 'prop.flotsam' ? 40 : 80 + rnd() * 50;
    const outk = art === 'prop.flotsam' ? -0.18 : -0.02;
    const rot = Math.atan2(px - is.x, -(py - is.y)) + (rnd() - 0.5) * 1.2;
    h.push({ x: px + (is.x - px) * outk, y: py + (is.y - py) * outk, size, rot, art });
  }
  hulks.set(is, h);
  return h;
}

export function hulkBlockers(is: { id: number; x: number; y: number; r: number; poly: ArrayLike<number> }): Blocker[] {
  return once(graveHulks(is), (out) => {
    for (const w of graveHulks(is)) {
      if (w.art === 'prop.shipwreck') wreckDiscs(w.x, w.y, w.size, w.rot, 'wreck', 1, out);
      else if (w.art === 'prop.wreckage') wreckageDisc(w.x, w.y, w.size, w.rot, 1, out);
    }
  });
}

/** Where a port town stands: on the land behind its anchorage, its quays at the shore (the renderer's own reckoning,
 *  renderer.ts drawPorts, moved here so the keel knows its piers). `size` the painting's side, `ang` its turn (its
 *  local +y to the sea), `reach` the anchorage's distance from the shore. */
export interface PortLay {
  x: number;
  y: number;
  ang: number;
  size: number;
  reach: number;
}

function inPoly(poly: ArrayLike<number>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function portLayout(port: { x: number; y: number; size: number }, island: { x: number; y: number; r: number; poly: ArrayLike<number> }): PortLay {
  // (In whole metres, as the client has the port: one layout on both sides.)
  const p = { x: Math.round(port.x), y: Math.round(port.y), size: port.size };
  const dx = island.x - p.x, dy = island.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  // The ray from the anchorage to the island's heart: where it makes landfall and where it leaves the land again.
  const hits: number[] = [];
  const poly = island.poly;
  for (let i = 0; i < poly.length; i += 2) {
    const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % poly.length], by = poly[(i + 3) % poly.length];
    const ex = bx - ax, ey = by - ay;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - p.x) * ey - (ay - p.y) * ex) / den;
    const u = ((ax - p.x) * uy - (ay - p.y) * ux) / den;
    if (t > 0 && u >= 0 && u <= 1) hits.push(t);
  }
  hits.sort((m, n) => m - n);
  // An anchorage already on the land (a river mouth, a lagoon) starts the town where it lies.
  const ashore = inPoly(poly, p.x, p.y);
  const tIn = ashore ? 0 : hits[0] ?? d * 0.6;
  const tOut = (ashore ? hits[0] : hits[1]) ?? d + island.r * 0.5;
  // The town's body fills the upper three quarters of the painting, the quays the foot: the body must fit the land.
  const depth = Math.max(80, tOut - tIn, d - tIn + island.r * 0.25);
  const size = Math.max(140, Math.min(230 + p.size * 80, (depth * 0.8) / 0.64));
  const shoreX = p.x + ux * tIn, shoreY = p.y + uy * tIn;
  // Local +y turns to the sea, so the quays at the painting's foot reach into the water.
  return { x: shoreX + ux * size * 0.24, y: shoreY + uy * size * 0.24, ang: Math.atan2(-dx, dy) + Math.PI, size, reach: tIn };
}

/** A town's quays: the painting's foot (its lowest quarter, 0.235–0.5 of it below its middle) where the piers run out
 *  over the water — 0.64 of its width, out to the pier heads at 0.47. */
export function quayBlockers(p: { x: number; y: number; size: number; raft?: boolean }, island: { x: number; y: number; r: number; poly: ArrayLike<number> }): Blocker[] {
  return once(p, (out) => {
    if (p.raft) return;
    const lay = portLayout(p, island);
    const [qx, qy] = turn(lay.x, lay.y, lay.ang, 0, lay.size * 0.355);
    out.push(boxBlocker(qx, qy, lay.size * 0.32, lay.size * 0.115, lay.ang, 'pier', 0.8, SOLID_PAD));
  });
}

/** A bank the ebb or the season has bared (docs/16 #25): its rounded sand and the foam about it (client/src/render/
 *  isles.ts drawBanks: the fringe a tenth of it beyond). */
export function bankBlockers(b: { r: number; poly: ArrayLike<number> }): Blocker[] {
  return once(b, (out) => {
    if (b.poly.length >= 6) out.push(coastBlocker(b.poly, 4 + b.r * 0.08, 'sand', 0.6));
  });
}

/** A turtle island up (docs/18 #31): her shell where she swims now (a new disc each step: she moves). */
export function turtleBlocker(x: number, y: number, r: number): Blocker {
  return discBlocker(x, y, r * 1.05, 'shell', 0.7);
}

// ------------------------------------------------------------------ the server's index (by chunk, once per world)

const indexes = new WeakMap<World, Map<number, Blocker[]>>();

function rounded(is: Island): { id: number; x: number; y: number; r: number; poly: number[] } {
  return { id: is.id, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly: is.poly.map((v) => Math.round(v)) };
}

/** Every solid thing of a world that is not a coast, by the chunks it touches. */
export function solidIndex(world: World): Map<number, Blocker[]> {
  let idx = indexes.get(world);
  if (idx) return idx;
  idx = new Map();
  const add = (b: Blocker) => {
    const c0 = Math.max(0, Math.floor((b.x - b.reach) / CHUNK_SIZE)), c1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor((b.x + b.reach) / CHUNK_SIZE));
    const r0 = Math.max(0, Math.floor((b.y - b.reach) / CHUNK_SIZE)), r1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor((b.y + b.reach) / CHUNK_SIZE));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const k = chunkKey(cx, cy);
      let l = idx!.get(k);
      if (!l) idx!.set(k, (l = []));
      l.push(b);
    }
  };
  for (const m of world.marks) for (const b of markBlockers(m)) add(b);
  for (const o of buildAdv(world).objs) for (const b of skerryBlockers(o)) add(b);
  for (const w of placeWonders(world.seed, legacyIslands(world))) for (const b of wonderBlockers(w)) add(b);
  for (const is of world.islands) {
    if (is.slot || is.raft || !is.poly.length || isleType(is) !== 'graveyard') continue;
    for (const b of hulkBlockers(rounded(is))) add(b);
  }
  for (const p of world.ports) {
    const is = world.islands[p.islandId];
    if (!is || p.raft) continue;
    for (const b of quayBlockers(p, rounded(is))) add(b);
  }
  indexes.set(world, idx);
  return idx;
}

/** The blockers about a point within `reach` (her half length and more): the coasts of the islands in the chunks it
 *  touches and the indexed solid things there. Into `out` (cleared), each once. */
export function blockersNear(world: World, x: number, y: number, reach: number, out: Blocker[]): Blocker[] {
  out.length = 0;
  const idx = solidIndex(world);
  const c0 = Math.max(0, Math.floor((x - reach) / CHUNK_SIZE)), c1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor((x + reach) / CHUNK_SIZE));
  const r0 = Math.max(0, Math.floor((y - reach) / CHUNK_SIZE)), r1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor((y + reach) / CHUNK_SIZE));
  const many = c0 !== c1 || r0 !== r1;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const k = chunkKey(cx, cy);
    for (const id of world.chunks.get(k) ?? []) {
      const is = world.islands[id];
      if (!is || is.slot) continue;
      if (Math.abs(is.x - x) > is.radius + reach + SHORE_PAD || Math.abs(is.y - y) > is.radius + reach + SHORE_PAD) continue;
      for (const b of islandBlockers(is)) if (!many || !out.includes(b)) out.push(b);
    }
    for (const b of idx.get(k) ?? []) {
      if (Math.abs(b.x - x) > b.reach + reach || Math.abs(b.y - y) > b.reach + reach) continue;
      if (!many || !out.includes(b)) out.push(b);
    }
  }
  return out;
}

const around: Blocker[] = [];
const PB: Probe = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };

/** Whether a hull `r` wide about a point keeps clear of every coast's shore band and every solid thing (the helmsmen's
 *  and the sea's own captains' lead line, npc.ts and autosail.ts: they steer round what the keel would strike). */
export function clearAt(world: World, x: number, y: number, r: number): boolean {
  blockersNear(world, x, y, r, around);
  for (const b of around) {
    blockerProbe(b, x, y, PB);
    if (PB.d < r + b.pad) return false;
  }
  return true;
}

/** A world whose sea has no solid things but its coasts (the balance sims weigh ship against ship on the open sea they
 *  were tuned on: tests/balance/duel.ts duelSea takes the dense sea off the chart, and these with it). */
export function clearSolids(world: World): void {
  indexes.set(world, new Map());
}

/** Whether a hull `r` wide sailing the straight line from (x0, y0) to (x1, y1) keeps clear of every coast's band and
 *  every solid thing: the line swept every r metres or so (a wreck of 30 m between two soundings is not missed). */
export function clearPath(world: World, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  blockersNear(world, (x0 + x1) / 2, (y0 + y1) / 2, len / 2 + r, around);
  if (!around.length) return true;
  const n = Math.max(1, Math.ceil(len / Math.max(8, r)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (const b of around) {
      if (Math.abs(b.x - x) > b.reach + r || Math.abs(b.y - y) > b.reach + r) continue;
      blockerProbe(b, x, y, PB);
      if (PB.d < r + b.pad) return false;
    }
  }
  return true;
}
