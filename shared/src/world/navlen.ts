// How far a ship sails between two points: the sea route's length, not the straight line (owner, 2026-10-23: «все
// квесты цепочек надо делать так, что они были максимум на удалении 3км друг от друга» — measured on the route). The
// same coarse grid the server's helmsman plans on (server/src/game/nav.ts findPath: A* over NAV_CELL cells, the line
// of sight pulled tight), without a hull's soundings: a quest's builder and its tests ask it, not a ship.

import { NAV_CELL } from '../constants.ts';
import type { World } from './worldgen.ts';
import { navBlocked } from './worldgen.ts';

function nearestFree(world: World, gx: number, gy: number): [number, number] | null {
  if (!navBlocked(world, gx, gy)) return [gx, gy];
  for (let r = 1; r < 12; r++) {
    let best: [number, number] | null = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || navBlocked(world, gx + dx, gy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) [best, bd] = [[gx + dx, gy + dy], d];
      }
    }
    if (best) return best;
  }
  return null;
}

function lineFree(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (NAV_CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (navBlocked(world, Math.floor((x0 + (x1 - x0) * t) / NAV_CELL), Math.floor((y0 + (y1 - y0) * t) / NAV_CELL))) return false;
  }
  return true;
}

const caches = new WeakMap<World, Map<string, number>>();

/**
 * The sea route's length from (ax, ay) to (bx, by), metres; Infinity when there is none, or it runs past `cap` (the
 * search gives up there — a builder asking «within 3 km?» pays for 3 km of sea, not the world's). Points on land (a
 * quay, a beach) are taken from the nearest water cell.
 */
export function navLen(world: World, ax: number, ay: number, bx: number, by: number, cap = 6000): number {
  const straight = Math.hypot(bx - ax, by - ay);
  if (straight > cap) return Infinity;
  const key = `${Math.round(ax)},${Math.round(ay)},${Math.round(bx)},${Math.round(by)},${cap}`;
  let cache = caches.get(world);
  if (!cache) caches.set(world, (cache = new Map()));
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const len = search(world, ax, ay, bx, by, cap);
  cache.set(key, len);
  return len;
}

function search(world: World, ax: number, ay: number, bx: number, by: number, cap: number): number {
  if (lineFree(world, ax, ay, bx, by)) return Math.hypot(bx - ax, by - ay);
  const n = world.navSize;
  const s = nearestFree(world, Math.floor(ax / NAV_CELL), Math.floor(ay / NAV_CELL));
  const t = nearestFree(world, Math.floor(bx / NAV_CELL), Math.floor(by / NAV_CELL));
  if (!s || !t) return Infinity;
  // a window about the two ends wide enough for any route under the cap
  const pad = Math.ceil(cap / NAV_CELL) + 1;
  const x0 = Math.max(0, Math.min(s[0], t[0]) - pad), y0 = Math.max(0, Math.min(s[1], t[1]) - pad);
  const x1 = Math.min(n - 1, Math.max(s[0], t[0]) + pad), y1 = Math.min(n - 1, Math.max(s[1], t[1]) + pad);
  const w = x1 - x0 + 1, hgt = y1 - y0 + 1;
  const idx = (gx: number, gy: number) => (gy - y0) * w + (gx - x0);
  const g = new Float32Array(w * hgt).fill(Infinity);
  const came = new Int32Array(w * hgt).fill(-1);
  const closed = new Uint8Array(w * hgt);
  const heap: number[] = [], prio: number[] = [];
  const push = (i: number, p: number) => {
    heap.push(i); prio.push(p);
    let k = heap.length - 1;
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (prio[up] <= prio[k]) break;
      [heap[up], heap[k]] = [heap[k], heap[up]];
      [prio[up], prio[k]] = [prio[k], prio[up]];
      k = up;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const li = heap.pop()!, lp = prio.pop()!;
    if (heap.length) {
      heap[0] = li; prio[0] = lp;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && prio[l] < prio[m]) m = l;
        if (r < heap.length && prio[r] < prio[m]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        [prio[m], prio[k]] = [prio[k], prio[m]];
        k = m;
      }
    }
    return top;
  };
  const start = idx(s[0], s[1]), goal = idx(t[0], t[1]);
  const h = (i: number) => {
    const dx = Math.abs((i % w) + x0 - t[0]), dy = Math.abs(Math.floor(i / w) + y0 - t[1]);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const limit = cap / NAV_CELL + 2;
  g[start] = 0;
  push(start, h(start));
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (g[cur] + h(cur) > limit) return Infinity;
    const cx = (cur % w) + x0, cy = Math.floor(cur / w) + y0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || navBlocked(world, nx, ny)) continue;
        if (dx && dy && (navBlocked(world, cx + dx, cy) || navBlocked(world, cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          push(ni, ng + h(ni));
        }
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return Infinity;
  const cells: [number, number][] = [];
  for (let i = goal; i !== -1; i = came[i]) {
    cells.push([((i % w) + x0) * NAV_CELL + NAV_CELL / 2, (Math.floor(i / w) + y0) * NAV_CELL + NAV_CELL / 2]);
    if (i === start) break;
  }
  cells.reverse();
  // from the point itself to its water, the route, then to the other point (the string pulled tight between)
  const pts: [number, number][] = [[ax, ay], ...cells, [bx, by]];
  let len = 0, anchor = 0;
  for (let i = 2; i < pts.length; i++) {
    if (!lineFree(world, pts[anchor][0], pts[anchor][1], pts[i][0], pts[i][1])) {
      len += Math.hypot(pts[i - 1][0] - pts[anchor][0], pts[i - 1][1] - pts[anchor][1]);
      anchor = i - 1;
    }
  }
  len += Math.hypot(pts[pts.length - 1][0] - pts[anchor][0], pts[pts.length - 1][1] - pts[anchor][1]);
  return len > cap ? Infinity : len;
}
