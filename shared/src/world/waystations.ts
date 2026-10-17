// Floating waystations (owner, 2026-10-17: «между островами сделать какие-то плавающие дома, чтобы примерно каждые 500
// метров я мог заплыть в такой плавающий дом и реснуть убитых существ с моего коробля, или кого-то нанять»; docs/35).
// A jittered grid of WAY_SPACING metres over the open sea: one waystation a cell, nudged inside it by the cell's own
// dice, kept only on open water — off every island, reef, maelstrom and sea mark by a margin, out of the harbours'
// waters and the first harbour's roads, inside the Maelstrom Wall. They are world data, not entities: made from the
// world's seed alone (the same world, the same waystations), never added to the world's arrays (no id of an island,
// reef or mark moves), indexed by the streaming chunk so a captain is sent only the ones about her.
//
// Three flavours from the same dice, drawn from the art already in assets/: a raft tavern (planks and crates under a
// lantern), a hulk chapel (an old hull moored with a shrine on her deck), a floating market (boats and stalls lashed
// round a raft).

import { CHUNKS_PER_SIDE, WORLD_SIZE } from '../constants.ts';
import { closestOnPolygon, pointInPolygon } from '../math.ts';
import { WORLD_EDGE_MARGIN } from './regions.ts';
import type { RegionId } from './regions.ts';
import type { World } from './worldgen.ts';
import { WHIRLPOOLS, chunkKey, chunkOf, regionAt } from './worldgen.ts';

export type WayKind = 'tavern' | 'chapel' | 'market';
export const WAY_KINDS: WayKind[] = ['tavern', 'chapel', 'market'];

export interface Waystation {
  id: number;
  kind: WayKind;
  region: RegionId;
  x: number;
  y: number;
  /** The way she lies (radians), for the drawing. */
  rot: number;
}

/** The grid's step: about one waystation every half a kilometre of open sea. */
export const WAY_SPACING = 500;
/** How far inside her cell the dice may move her from its middle (each way). */
export const WAY_JITTER = 140;
/** Open water she keeps from an island's coast, a reef's edge, a sea mark, a harbour and the first harbour. */
export const WAY_LAND_GAP = 220;
export const WAY_REEF_GAP = 160;
export const WAY_MARK_GAP = 90;
export const WAY_PORT_GAP = 900;
export const WAY_START_GAP = 3000;
/** The first harbour (Game.ts START_PORT): its roads are the First Watch's, no waystation in them. */
export const WAY_START_PORT = 'saltmarrow';
/** At most so many in one streaming chunk (3 km): the density cap for the drawing and the wire. */
export const WAY_CHUNK_CAP = 30;
/** How near she must be to moor (metres from the waystation), and how far she may drift before she is cast off. */
export const WAY_MOOR_RANGE = 150;
export const WAY_LEAVE_RANGE = 260;
/** The size she is drawn at (metres across). */
export const WAY_SIZE = 46;

export interface WayIndex {
  list: Waystation[];
  chunks: Map<number, number[]>;
}

const cache = new WeakMap<World, WayIndex>();

/** A cell's dice: three numbers in [0, 1) from the world's seed and the cell. */
function cellDice(seed: number, cx: number, cy: number): [number, number, number, number] {
  let h = (seed ^ Math.imul(cx + 0x3c1, 0x9e3779b1) ^ Math.imul(cy + 0x75b, 0x85ebca6b)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    out.push(h / 4294967296);
    h = (h + 0x6d2b79f5) >>> 0;
  }
  return out as [number, number, number, number];
}

/** The flavour a region leans to: the Abyss and the Drowned Crown keep chapels, the lanes of the safe seas markets. */
function kindOf(region: RegionId, roll: number): WayKind {
  const w: Record<WayKind, number> = region === 'the_abyss' || region === 'drowned_crown' ? { tavern: 2, chapel: 5, market: 1 }
    : region === 'black_coast' || region === 'gravewater' ? { tavern: 3, chapel: 2, market: 4 }
    : { tavern: 4, chapel: 3, market: 2 };
  let t = roll * (w.tavern + w.chapel + w.market);
  for (const k of WAY_KINDS) {
    if (t < w[k]) return k;
    t -= w[k];
  }
  return 'tavern';
}

/** The world's waystations and their chunk index (made once a world). */
export function waystations(world: World): WayIndex {
  const had = cache.get(world);
  if (had) return had;
  const list: Waystation[] = [];
  const chunks = new Map<number, number[]>();
  const lo = WORLD_EDGE_MARGIN + 600, hi = WORLD_SIZE - WORLD_EDGE_MARGIN - 600;
  const n = Math.floor(WORLD_SIZE / WAY_SPACING);
  const start = world.ports.find((p) => p.id === WAY_START_PORT);
  // (the islands, reefs and marks near a spot: the chunks its margin reaches)
  const near = (x: number, y: number, idx: Map<number, number[]>, reach: number, seen: Set<number>): number[] => {
    seen.clear();
    const out: number[] = [];
    for (const [dx, dy] of [[-reach, -reach], [reach, -reach], [-reach, reach], [reach, reach]]) {
      for (const id of idx.get(chunkKey(...chunkOf(x + dx, y + dy))) ?? []) if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };
  const seen = new Set<number>();
  const clear = (x: number, y: number): boolean => {
    if (x < lo || y < lo || x > hi || y > hi) return false;
    for (const w of WHIRLPOOLS) if (Math.hypot(w.x - x, w.y - y) < w.radius * 2 + 300) return false;
    if (start && Math.hypot(start.x - x, start.y - y) < WAY_START_GAP) return false;
    for (const p of world.ports) if (Math.abs(p.x - x) < WAY_PORT_GAP && Math.abs(p.y - y) < WAY_PORT_GAP && Math.hypot(p.x - x, p.y - y) < WAY_PORT_GAP) return false;
    for (const id of near(x, y, world.chunks, 400, seen)) {
      const is = world.islands[id];
      if (is.slot) continue;
      const reach = is.radius + WAY_LAND_GAP;
      if (Math.abs(is.x - x) > reach || Math.abs(is.y - y) > reach) continue;
      // (inside the coast, or within the gap of it: the nearest point of the coast is nearer than the gap)
      if (Math.hypot(is.x - x, is.y - y) < is.radius * 0.5) return false;
      if (closestOnPolygon(x, y, is.poly).d2 < WAY_LAND_GAP * WAY_LAND_GAP || pointInPolygon(x, y, is.poly)) return false;
    }
    for (const id of near(x, y, world.reefChunks, 300, seen)) {
      const rf = world.reefs[id];
      if (Math.hypot(rf.x - x, rf.y - y) < rf.radius + WAY_REEF_GAP) return false;
    }
    for (const id of near(x, y, world.markChunks, 200, seen)) {
      const m = world.marks[id];
      if (Math.hypot(m.x - x, m.y - y) < m.r + WAY_MARK_GAP) return false;
    }
    return true;
  };
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      const [a, b, c, d] = cellDice(world.seed, cx, cy);
      const x = Math.round((cx + 0.5) * WAY_SPACING + (a * 2 - 1) * WAY_JITTER);
      const y = Math.round((cy + 0.5) * WAY_SPACING + (b * 2 - 1) * WAY_JITTER);
      if (!clear(x, y)) continue;
      const key = chunkKey(...chunkOf(x, y));
      let at = chunks.get(key);
      if (!at) chunks.set(key, (at = []));
      if (at.length >= WAY_CHUNK_CAP) continue;
      const region = regionAt(world, x, y);
      const w: Waystation = { id: list.length, kind: kindOf(region, c), region, x, y, rot: Math.round(d * 628) / 100 };
      at.push(w.id);
      list.push(w);
    }
  }
  const out = { list, chunks };
  cache.set(world, out);
  return out;
}

/** The waystation nearest (x, y) within `range` metres, or null. */
export function wayNear(world: World, x: number, y: number, range: number): Waystation | null {
  const idx = waystations(world);
  let best: Waystation | null = null, bd = range;
  const [c0x, c0y] = chunkOf(x - range, y - range), [c1x, c1y] = chunkOf(x + range, y + range);
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      for (const id of idx.chunks.get(chunkKey(cx, cy)) ?? []) {
        const w = idx.list[id];
        const dd = Math.hypot(w.x - x, w.y - y);
        if (dd <= bd) {
          bd = dd;
          best = w;
        }
      }
    }
  }
  return best;
}

/** The waystations of one streaming chunk. */
export function waysOfChunk(world: World, key: number): Waystation[] {
  const idx = waystations(world);
  return (idx.chunks.get(key) ?? []).map((id) => idx.list[id]);
}

/** For the tests and the report: how many there are in all, and the chunks' most. */
export function wayStats(world: World): { n: number; maxChunk: number; chunks: number } {
  const idx = waystations(world);
  let maxChunk = 0;
  for (const v of idx.chunks.values()) maxChunk = Math.max(maxChunk, v.length);
  return { n: idx.list.length, maxChunk, chunks: CHUNKS_PER_SIDE * CHUNKS_PER_SIDE };
}

