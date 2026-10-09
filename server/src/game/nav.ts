// NPC navigation: A* over the coarse nav grid with line-of-sight smoothing, plus a route cache.
// Routes between ports are reused by every merchant, so the cost is paid once per port pair.
//
// The solid things (2026-10-09): the grid's cells are 400 m and know the coasts, the reefs and the maelstroms, not
// what a keel strikes besides (shared/src/world/solids.ts: a hulk, a wreck, a floe, a buoy, a skerry, a pier, a bared
// bank). A plan for a hull (`hull`: the helmsman's runs, a captain's pursuit round the land) is made good for her: its
// end the nearest water she may lie in by her mark, every leg sounded for her hull and her keel (seaway.ts), and a leg
// that runs over something a way round it on a fine grid of its own window (fineDetour) — her run never ends against
// a hulk or a pier, and never leads her onto one.

import { NAV_CELL } from '../../../shared/src/constants.ts';
import type { World } from '../../../shared/src/world/worldgen.ts';
import { navBlocked } from '../../../shared/src/world/worldgen.ts';
import { fineDetour, nearestWater, runClear, waterAt } from './seaway.ts';
import type { HullWater } from './seaway.ts';

export type Path = [number, number][];

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastI = this.items.pop()!;
    const lastP = this.prio.pop()!;
    if (this.items.length) {
      this.items[0] = lastI;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.items.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

export function nearestFree(world: World, gx: number, gy: number): [number, number] | null {
  if (!navBlocked(world, gx, gy)) return [gx, gy];
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!navBlocked(world, gx + dx, gy + dy)) return [gx + dx, gy + dy];
      }
    }
  }
  return null;
}

export function lineFree(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (NAV_CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.floor((x0 + (x1 - x0) * t) / NAV_CELL);
    const gy = Math.floor((y0 + (y1 - y0) * t) / NAV_CELL);
    if (navBlocked(world, gx, gy)) return false;
  }
  return true;
}

export function findPath(world: World, sx: number, sy: number, tx: number, ty: number, maxExpand = 60000, hull?: HullWater): Path | null {
  // For a hull: her mark the nearest water she may lie in (a mark on a hulk or a pier: the water by it).
  if (hull && !waterAt(world, tx, ty, hull)) {
    const w = nearestWater(world, tx, ty, hull);
    if (w) [tx, ty] = w;
  }
  const n = world.navSize;
  const s = nearestFree(world, Math.floor(sx / NAV_CELL), Math.floor(sy / NAV_CELL));
  const t = nearestFree(world, Math.floor(tx / NAV_CELL), Math.floor(ty / NAV_CELL));
  if (!s || !t) return null;
  const start = s[1] * n + s[0];
  const goal = t[1] * n + t[0];
  const g = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, 0);
  const h = (i: number) => {
    const dx = Math.abs((i % n) - t[0]), dy = Math.abs(Math.floor(i / n) - t[1]);
    return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * 1.02;
  };
  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > maxExpand) return null;
    const cx = cur % n, cy = Math.floor(cur / n);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (navBlocked(world, nx, ny)) continue;
        if (dx && dy && (navBlocked(world, cx + dx, cy) || navBlocked(world, cx, cy + dy))) continue;
        const ni = ny * n + nx;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          open.push(ni, ng + h(ni));
        }
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const cells: [number, number][] = [];
  for (let i = goal; i !== -1; i = came[i]) {
    cells.push([(i % n) * NAV_CELL + NAV_CELL / 2, Math.floor(i / n) * NAV_CELL + NAV_CELL / 2]);
    if (i === start) break;
  }
  cells.reverse();
  cells[0] = [sx, sy];
  cells[cells.length - 1] = [tx, ty];
  // String pulling.
  const out: Path = [cells[0]];
  const at = [0];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineFree(world, cells[anchor][0], cells[anchor][1], cells[i][0], cells[i][1])) {
      out.push(cells[i - 1]);
      at.push(i - 1);
      anchor = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  at.push(cells.length - 1);
  return hull ? soundPath(world, out, at, cells, hull) : out;
}

/** A pulled path made good for a hull: each leg sounded for her hull and keel; a foul one split back into the grid's
 *  own cells, and a cell-to-cell leg still foul taken round what lies on it on the fine grid. Then the points she can
 *  pass by in clear water dropped again. */
export function soundPath(world: World, out: Path, at: number[], cells: [number, number][], hull: HullWater): Path {
  const made: Path = [out[0]];
  for (let k = 1; k < out.length; k++) {
    const a = made[made.length - 1], b = out[k];
    if (runClear(world, a[0], a[1], b[0], b[1], hull)) {
      made.push(b);
      continue;
    }
    // Back to the grid's cells between them, each step sounded; round what lies on a step.
    const steps: [number, number][] = [];
    // (A cell's middle on a hulk or a skerry: the water by it.)
    for (let i = at[k - 1] + 1; i < at[k]; i++) steps.push(waterAt(world, cells[i][0], cells[i][1], hull) ? cells[i] : nearestWater(world, cells[i][0], cells[i][1], hull, 200) ?? cells[i]);
    steps.push(b);
    for (const [j, c] of steps.entries()) {
      const p = made[made.length - 1];
      if (!runClear(world, p[0], p[1], c[0], c[1], hull)) {
        const way = fineDetour(world, p[0], p[1], c[0], c[1], hull);
        if (way) for (let i = 1; i < way.length - 1; i++) made.push(way[i]);
        else if (k === out.length - 1 && j === steps.length - 1) {
          // Her mark's water is a pocket she cannot sail into (a slip too narrow for her between two piers): the run
          // ends where the clear water toward it does.
          const len = Math.hypot(c[0] - p[0], c[1] - p[1]);
          let far = 0;
          for (let d = 10; d < len; d += 10) {
            const q: [number, number] = [p[0] + ((c[0] - p[0]) * d) / len, p[1] + ((c[1] - p[1]) * d) / len];
            if (!runClear(world, p[0], p[1], q[0], q[1], hull)) break;
            far = d;
          }
          if (far > 0) made.push([p[0] + ((c[0] - p[0]) * far) / len, p[1] + ((c[1] - p[1]) * far) / len]);
          continue;
        }
      }
      made.push(c);
    }
  }
  // Pull it tight again where clear water allows (one pass: a point dropped when its neighbours see each other).
  const tight: Path = [made[0]];
  for (let i = 1; i < made.length - 1; i++) {
    const p = tight[tight.length - 1], q = made[i + 1];
    if (!(lineFree(world, p[0], p[1], q[0], q[1]) && runClear(world, p[0], p[1], q[0], q[1], hull))) tight.push(made[i]);
  }
  tight.push(made[made.length - 1]);
  return tight;
}

export function pathLength(p: Path): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return d;
}

/** Position and heading at distance `d` along a path. */
export function pointAlong(p: Path, d: number): { x: number; y: number; heading: number; index: number } {
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (d <= seg || i === p.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 1;
      const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1];
      return { x: p[i - 1][0] + dx * t, y: p[i - 1][1] + dy * t, heading: Math.atan2(dx, -dy), index: i };
    }
    d -= seg;
  }
  const last = p[p.length - 1];
  return { x: last[0], y: last[1], heading: 0, index: p.length - 1 };
}

export class RouteCache {
  private cache = new Map<string, Path | null>();
  private world: World;
  constructor(world: World) {
    this.world = world;
  }
  between(a: { id: string; x: number; y: number }, b: { id: string; x: number; y: number }): Path | null {
    const key = a.id + '>' + b.id;
    if (!this.cache.has(key)) this.cache.set(key, findPath(this.world, a.x, a.y, b.x, b.y, 120000));
    const p = this.cache.get(key);
    return p ? p.map((q) => [q[0], q[1]] as [number, number]) : null;
  }
  /** The sea changed shape (a new island): plan every route afresh. */
  clear(): void {
    this.cache.clear();
  }
}
