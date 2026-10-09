// The lead line every helm at sea sounds (2026-10-09, after the island collision of 2026-10-08): what lies on a straight
// run of water for her hull — the coast's band and the sea's solid things her hull would strike (shared/src/world/
// solids.ts clearPath, the same clearance her keel keeps: shared/src/sim/hull.ts), the reefs and sandbars her keel
// drags on, the banks the tide has bared. The sea's captains, the captains' helmsmen under «Атаковать» (npc.ts steer)
// and the planner of the helmsman's runs (nav.ts) all sound with it.
//
// What was wrong: the helms sounded the depth at two points of their look (its half and its end). A reef between the
// two, or nearer than the half, was not there for them; at a boarding run's way (70 m a second) a frigate's bow on a
// reef loses most of her hull in a second (Game.ts physics: the reef's bite by her way and her tier). The guns' fight,
// circling its mark in the close band, ran its broadside's course over a reef the mark had skated across.
//
// Now a run is sounded whole: the reefs' own outlines against the line, exactly, with a margin for the swing of her bow.
// No dice anywhere.

import { CHUNK_SIZE, CHUNKS_PER_SIDE } from '../../../shared/src/constants.ts';
import { pointInPolygon } from '../../../shared/src/math.ts';
import { blockerProbe } from '../../../shared/src/sim/hull.ts';
import type { Blocker, Probe } from '../../../shared/src/sim/hull.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { bankBlockers, blockersNear, clearPath } from '../../../shared/src/world/solids.ts';
import type { World } from '../../../shared/src/world/worldgen.ts';
import { chunkKey } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { banksUp } from './isles.ts';
import type { ShipEntity } from './ship.ts';

/** The water a keel keeps off a reef she would drag on: this much, and a quarter of her length besides (her bow, half
 *  her length ahead of her middle, swings out over the water beside her course as she turns onto it). */
export const REEF_MARGIN = 14;
export const reefMargin = (length: number): number => REEF_MARGIN + length * 0.25;

/** A keel's draft (her hull's, with her refits), and whether she skates over reefs and shoals. */
export function keelOf(ship: ShipEntity): { draft: number; shallow: boolean } {
  return { draft: ship.cls.draft * Math.max(0.5, 1 + tval(ship.stats, 'draftMul')), shallow: ship.cls.passive.id === 'shallow_runner' };
}

/** The squared distance between two segments (0 when they cross). */
function segSeg2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy;
  const den = ux * vy - uy * vx;
  if (Math.abs(den) > 1e-12) {
    const s = ((cx - ax) * vy - (cy - ay) * vx) / den, t = ((cx - ax) * uy - (cy - ay) * ux) / den;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return 0;
  }
  return Math.min(ptSeg2(ax, ay, cx, cy, dx, dy), ptSeg2(bx, by, cx, cy, dx, dy), ptSeg2(cx, cy, ax, ay, bx, by), ptSeg2(dx, dy, ax, ay, bx, by));
}

function ptSeg2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + ex * t - px, qy = ay + ey * t - py;
  return qx * qx + qy * qy;
}

let stamp = 0;
const seen = new WeakMap<World, Uint32Array>();

/** Whether a reef or a sandbar shallower than `draft` lies within `r` of the straight run (x0, y0)–(x1, y1): each reef
 *  about it, its outline against the line (exact), and the run's ends inside it. */
export function reefOnLine(world: World, x0: number, y0: number, x1: number, y1: number, r: number, draft: number): boolean {
  const lx = Math.min(x0, x1) - r, hx = Math.max(x0, x1) + r, ly = Math.min(y0, y1) - r, hy = Math.max(y0, y1) + r;
  const c0 = Math.max(0, Math.floor(lx / CHUNK_SIZE)), c1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor(hx / CHUNK_SIZE));
  const r0 = Math.max(0, Math.floor(ly / CHUNK_SIZE)), r1 = Math.min(CHUNKS_PER_SIDE - 1, Math.floor(hy / CHUNK_SIZE));
  let mark = seen.get(world);
  if (!mark || mark.length < world.reefs.length) seen.set(world, (mark = new Uint32Array(world.reefs.length + 64)));
  if (++stamp >= 0xffffffff) {
    mark.fill(0);
    stamp = 1;
  }
  const r2 = r * r;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    for (const id of world.reefChunks.get(chunkKey(cx, cy)) ?? []) {
      if (mark[id] === stamp) continue;
      mark[id] = stamp;
      const rf = world.reefs[id];
      if (rf.depth >= draft) continue;
      if (rf.x + rf.radius < lx || rf.x - rf.radius > hx || rf.y + rf.radius < ly || rf.y - rf.radius > hy) continue;
      if (ptSeg2(rf.x, rf.y, x0, y0, x1, y1) > (rf.radius + r) * (rf.radius + r)) continue;
      const p = rf.poly;
      if (pointInPolygon(x0, y0, p) || pointInPolygon(x1, y1, p)) return true;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if (segSeg2(x0, y0, x1, y1, p[j], p[j + 1], p[i], p[i + 1]) < r2) return true;
    }
  }
  return false;
}

const PB: Probe = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };

/** Whether a bank the tide has bared lies within `r` (and its own foam) of the straight run. */
export function bankOnLine(game: Game, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const banks = banksUp(game);
  if (!banks.length) return false;
  const len = Math.hypot(x1 - x0, y1 - y0);
  for (const b of banks) {
    if (ptSeg2(b.x, b.y, x0, y0, x1, y1) > (b.r * 1.2 + r + 20) ** 2) continue;
    for (const q of bankBlockers(b)) {
      const n = Math.max(1, Math.ceil(len / Math.max(8, r)));
      for (let i = 0; i <= n; i++) {
        blockerProbe(q, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, PB);
        if (PB.d < r + q.pad) return true;
      }
    }
  }
  return false;
}

/** Her lead line along a straight run: true when anything her hull or her keel would strike lies on it — the coast's
 *  band and the solid things (`wide`: her half beam and a margin), the reefs she drags on (by her keel's line, a margin
 *  for her bow's swing), the bared banks. A shallow keel skates over reefs and shoals. */
export function laneFoul(game: Game, ship: ShipEntity, x0: number, y0: number, x1: number, y1: number, wide: number): boolean {
  const k = keelOf(ship);
  if (!k.shallow && reefOnLine(game.world, x0, y0, x1, y1, reefMargin(ship.stats.length), k.draft)) return true;
  if (bankOnLine(game, x0, y0, x1, y1, wide)) return true;
  return !clearPath(game.world, x0, y0, x1, y1, wide);
}

// ------------------------------------------------------------------ the planner's water (nav.ts)

/** A hull's water for the planner: her half beam and a margin off every coast's band and solid thing, her keel off the
 *  reefs shallower than her draft. */
export interface HullWater {
  r: number;
  draft: number;
  shallow: boolean;
}

export function hullWater(ship: ShipEntity, margin = 8): HullWater {
  const k = keelOf(ship);
  return { r: ship.stats.beam * 0.5 + margin, draft: k.draft, shallow: k.shallow };
}

const around: Blocker[] = [];

/** Whether a point is water her hull and keel may lie in (the planner's test: the same clearances as the lead line). */
export function waterAt(world: World, x: number, y: number, hw: HullWater, list?: readonly Blocker[]): boolean {
  const near = list ?? blockersNear(world, x, y, hw.r, around);
  for (const b of near) {
    if (Math.abs(b.x - x) > b.reach + hw.r || Math.abs(b.y - y) > b.reach + hw.r) continue;
    blockerProbe(b, x, y, PB);
    if (PB.d < hw.r + b.pad) return false;
  }
  return hw.shallow || !reefOnLine(world, x, y, x, y, REEF_MARGIN, hw.draft);
}

/** Whether a straight run of the planner's is clear for her hull and keel (in pieces of a kilometre: the solid things
 *  of a long run are fetched a piece at a time). */
export function runClear(world: World, x0: number, y0: number, x1: number, y1: number, hw: HullWater): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len / 1000));
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n, ay = y0 + ((y1 - y0) * i) / n;
    const bx = x0 + ((x1 - x0) * (i + 1)) / n, by = y0 + ((y1 - y0) * (i + 1)) / n;
    if (!clearPath(world, ax, ay, bx, by, hw.r)) return false;
    if (!hw.shallow && reefOnLine(world, ax, ay, bx, by, REEF_MARGIN, hw.draft)) return false;
  }
  return true;
}

/** The nearest water to a point her hull may lie in (rings 15 m apart out to `max`; and `ok` there besides), or null. */
export function nearestWater(world: World, x: number, y: number, hw: HullWater, max = 450, ok?: (x: number, y: number) => boolean): [number, number] | null {
  const list = blockersNear(world, x, y, max + hw.r, []);
  if (waterAt(world, x, y, hw, list) && (!ok || ok(x, y))) return [x, y];
  for (let d = 15; d <= max; d += 15) {
    const n = Math.max(8, Math.ceil((2 * Math.PI * d) / 15));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.sin(a) * d, py = y - Math.cos(a) * d;
      if (waterAt(world, px, py, hw, list) && (!ok || ok(px, py))) return [px, py];
    }
  }
  return null;
}

/** A way round what lies on a short run (a hulk, a pier, a skerry, a reef between two of the coarse grid's cells): A*
 *  over a fine grid (`cell` metres) of the run's window and `pad` metres about it, its cells her water or not; the way
 *  string-pulled. Null when there is none within the window. */
export function fineDetour(world: World, x0: number, y0: number, x1: number, y1: number, hw: HullWater, cell = 20, pad = 260): [number, number][] | null {
  const lx = Math.min(x0, x1) - pad, ly = Math.min(y0, y1) - pad;
  const w = Math.ceil((Math.abs(x1 - x0) + pad * 2) / cell) + 1, h = Math.ceil((Math.abs(y1 - y0) + pad * 2) / cell) + 1;
  if (w * h > 40_000) return null;
  const list = blockersNear(world, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(w, h) * cell * 0.5 + hw.r, []);
  const free = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) free[gy * w + gx] = waterAt(world, lx + gx * cell, ly + gy * cell, hw, list) ? 1 : 0;
  const at = (x: number, y: number) => [Math.round((x - lx) / cell), Math.round((y - ly) / cell)] as const;
  const [sx, sy] = at(x0, y0), [tx, ty] = at(x1, y1);
  const start = sy * w + sx, goal = ty * w + tx;
  // (Her own cell and her mark's are water whatever the fine grid says: she is there, and the mark was chosen so.)
  free[start] = 1;
  free[goal] = 1;
  const g = new Float32Array(w * h).fill(Infinity);
  const came = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  // The open cells, a binary heap on their estimate (a cell pushed again when a shorter way to it is found).
  const heap: number[] = [], key: number[] = [];
  const push = (i: number, k: number) => {
    let at = heap.length;
    heap.push(i);
    key.push(k);
    while (at > 0) {
      const up = (at - 1) >> 1;
      if (key[up] <= key[at]) break;
      [heap[up], heap[at], key[up], key[at]] = [heap[at], heap[up], key[at], key[up]];
      at = up;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const li = heap.pop()!, lk = key.pop()!;
    if (heap.length) {
      heap[0] = li;
      key[0] = lk;
      for (let at = 0; ;) {
        const l = at * 2 + 1, r = l + 1;
        let m = at;
        if (l < heap.length && key[l] < key[m]) m = l;
        if (r < heap.length && key[r] < key[m]) m = r;
        if (m === at) break;
        [heap[m], heap[at], key[m], key[at]] = [heap[at], heap[m], key[at], key[m]];
        at = m;
      }
    }
    return top;
  };
  g[start] = 0;
  push(start, Math.hypot(tx - sx, ty - sy));
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w, cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!free[ni] || closed[ni]) continue;
      if (dx && dy && (!free[cy * w + nx] || !free[ny * w + cx])) continue;
      const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        push(ni, ng + Math.hypot(tx - nx, ty - ny));
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const cells: [number, number][] = [];
  for (let i = goal; i !== -1; i = came[i]) {
    cells.push([lx + (i % w) * cell, ly + ((i / w) | 0) * cell]);
    if (i === start) break;
  }
  cells.reverse();
  cells[0] = [x0, y0];
  cells[cells.length - 1] = [x1, y1];
  const out: [number, number][] = [cells[0]];
  let a = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!runClear(world, cells[a][0], cells[a][1], cells[i][0], cells[i][1], hw)) {
      out.push(cells[i - 1]);
      a = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

