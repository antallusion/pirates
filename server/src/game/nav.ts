// NPC navigation: A* over the coarse nav grid with line-of-sight smoothing, plus a route cache.
// Routes between ports are reused by every merchant, so the cost is paid once per port pair.

import { NAV_CELL } from '../../../shared/src/constants.ts';
import type { World } from '../../../shared/src/world/worldgen.ts';
import { navBlocked } from '../../../shared/src/world/worldgen.ts';

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

function nearestFree(world: World, gx: number, gy: number): [number, number] | null {
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

function lineFree(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (NAV_CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.floor((x0 + (x1 - x0) * t) / NAV_CELL);
    const gy = Math.floor((y0 + (y1 - y0) * t) / NAV_CELL);
    if (navBlocked(world, gx, gy)) return false;
  }
  return true;
}

export function findPath(world: World, sx: number, sy: number, tx: number, ty: number, maxExpand = 60000): Path | null {
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
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineFree(world, cells[anchor][0], cells[anchor][1], cells[i][0], cells[i][1])) {
      out.push(cells[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
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
}
