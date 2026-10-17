// The fog of war and the scouts (owner, 2026-10-17: «я бы еще сделал туман войны условно, который можно разведовать
// частями с острова. на личном острове в верфи можно строить специальные разведовательные корабли которые будут
// путешестровать по карте и открывать зоны … разведку надо сделать беслпатной»).
//
// The sea is cut into squares of a kilometre (the region grid's own cells): 96 × 96 = 9 216 of them, one bit each —
// 1 152 bytes a captain, kept in her profile as base64. A square once seen stays seen (the bits are only ever set).
// Seen by: her ship's lookouts as she sails (SHIP_SIGHT), her own island (isleSight: its hall, lighthouse, signal tower
// and chart house), her scouts (SCOUT_SIGHT along their whole course), and every chart she already has — a charted
// island, a lookout climbed, a watchtower, a star fix, the port she starts in.
//
// Scouts: small fast unarmed hulls of the island's shipyard, built for nothing (SCOUT_BUILD_SECS on the wall clock);
// one at a shipyard of the first level, a second at the third, a third at the fifth. Sent to a point of the chart (or
// «авто»: the nearest fog, then the next, as far as SCOUT_AUTO_REACH), they sail out and home at SCOUT_SPEED by the
// wall clock (admin /speed runs it faster), and no one can touch them: they are not ships of the sea at all.

import { WORLD_SIZE } from '../constants.ts';

/** A square of the fog, metres. */
export const FOG_CELL = 1000;
export const FOG_SIDE = WORLD_SIZE / FOG_CELL;
export const FOG_CELLS = FOG_SIDE * FOG_SIDE;
export const FOG_BYTES = FOG_CELLS / 8;

/** Her ship's lookouts clear this far about her (the weather's murk takes its share). */
export const SHIP_SIGHT = 2400;
/** A scout's lookouts, along her whole course. */
export const SCOUT_SIGHT = 2200;
/** The sea about the port a captain starts in. */
export const START_SIGHT = 6000;
/** About a port she has put in at (the migration of a save from before the fog). */
export const PORT_SIGHT = 3500;

/** The sea her own island keeps clear: 4 km with a hall of the first level, a kilometre more each hall level after;
 *  its lighthouse, its signal tower and its chart house see farther still. */
export function isleSight(hall: number, b: { lighthouse?: boolean; signal?: boolean; chart?: boolean } = {}): number {
  return 4000 + 1000 * Math.max(0, Math.min(5, hall) - 1) + (b.lighthouse ? 1500 : 0) + (b.signal ? 1500 : 0) + (b.chart ? 2000 : 0);
}

/** A scout's way, metres a second of the wall clock (a fast cutter's, on the sea's scale). */
export const SCOUT_SPEED = 20;
/** Building one: no silver, no goods, a minute on the slipway. */
export const SCOUT_BUILD_SECS = 60;
/** The farthest point she is sent to, straight from home. */
export const SCOUT_RANGE = 30_000;
/** «Авто»: how far she sails out from fog to fog before she turns for home. */
export const SCOUT_AUTO_REACH = 24_000;
/** «Авто»: the most patches of fog in one voyage. */
export const SCOUT_AUTO_LEGS = 8;
/** The greatest number of scouts at all. */
export const SCOUT_MAX = 3;

/** Scouts a shipyard keeps: 1 at the first level, +1 for every two more, 3 at the most. */
export function scoutLimit(yardLevel: number): number {
  return yardLevel <= 0 ? 0 : Math.min(SCOUT_MAX, 1 + Math.floor((yardLevel - 1) / 2));
}

/** The scouts' names (by index). */
export const SCOUT_NAMES: [string, string][] = [
  ['Lark', 'Жаворонок'], ['Petrel', 'Буревестник'], ['Kestrel', 'Пустельга'], ['Swift', 'Стриж'], ['Tern', 'Крачка'], ['Plover', 'Зуёк'],
];

/** The hull a scout is drawn as (a cutter: the smallest fast hull of the sea). */
export const SCOUT_HULL = 'cutter';

// ------------------------------------------------------------------------------------------------ the bits

export function newFog(): Uint8Array {
  return new Uint8Array(FOG_BYTES);
}

/** The square a point lies in (-1 off the sea). */
export function fogCell(x: number, y: number): number {
  const cx = Math.floor(x / FOG_CELL), cy = Math.floor(y / FOG_CELL);
  if (cx < 0 || cy < 0 || cx >= FOG_SIDE || cy >= FOG_SIDE) return -1;
  return cy * FOG_SIDE + cx;
}

export function fogHas(bits: Uint8Array, i: number): boolean {
  return i >= 0 && i < FOG_CELLS && (bits[i >> 3] & (1 << (i & 7))) !== 0;
}

/** A square seen; true when it was not before. */
export function fogSet(bits: Uint8Array, i: number): boolean {
  if (i < 0 || i >= FOG_CELLS) return false;
  const m = 1 << (i & 7);
  if (bits[i >> 3] & m) return false;
  bits[i >> 3] |= m;
  return true;
}

/** Whether the sea at a point is seen (off the sea: never). */
export function fogSeen(bits: Uint8Array | null | undefined, x: number, y: number): boolean {
  if (!bits) return true;
  return fogHas(bits, fogCell(x, y));
}

/** The squares within `r` of a point seen (a square counts when its middle is within reach, and the square the point
 *  is in always). The newly seen pushed to `out`; their number returned. */
export function fogDisc(bits: Uint8Array, x: number, y: number, r: number, out?: number[]): number {
  let n = 0;
  const c = fogCell(x, y);
  if (fogSet(bits, c)) {
    n++;
    out?.push(c);
  }
  const x0 = Math.max(0, Math.floor((x - r) / FOG_CELL)), x1 = Math.min(FOG_SIDE - 1, Math.floor((x + r) / FOG_CELL));
  const y0 = Math.max(0, Math.floor((y - r) / FOG_CELL)), y1 = Math.min(FOG_SIDE - 1, Math.floor((y + r) / FOG_CELL));
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) {
    const dy = (cy + 0.5) * FOG_CELL - y;
    for (let cx = x0; cx <= x1; cx++) {
      const dx = (cx + 0.5) * FOG_CELL - x;
      if (dx * dx + dy * dy > r2) continue;
      const i = cy * FOG_SIDE + cx;
      if (fogSet(bits, i)) {
        n++;
        out?.push(i);
      }
    }
  }
  return n;
}

export function fogCount(bits: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    let v = bits[i];
    while (v) {
      v &= v - 1;
      n++;
    }
  }
  return n;
}

/** Everything `b` has seen added to `a` (the fog never comes back). */
export function fogMerge(a: Uint8Array, b: Uint8Array): void {
  for (let i = 0; i < a.length && i < b.length; i++) a[i] |= b[i];
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The bits as base64 (the profile's `fog`, the wire's `all`): no Buffer, no atob — the same on the server and the page. */
export function fogEncode(bits: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bits.length; i += 3) {
    const a = bits[i], b = i + 1 < bits.length ? bits[i + 1] : 0, c = i + 2 < bits.length ? bits[i + 2] : 0;
    const v = (a << 16) | (b << 8) | c;
    s += B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + (i + 1 < bits.length ? B64[(v >> 6) & 63] : '=') + (i + 2 < bits.length ? B64[v & 63] : '=');
  }
  return s;
}

/** The bits from base64; anything broken or short gives what it can (the rest unseen), never throws. */
export function fogDecode(s: string | null | undefined): Uint8Array {
  const out = newFog();
  if (typeof s !== 'string') return out;
  let o = 0;
  for (let i = 0; i + 3 < s.length && o < out.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => B64.indexOf(s[i + k]));
    if (v[0] < 0 || v[1] < 0) break;
    const n = (v[0] << 18) | (v[1] << 12) | (Math.max(0, v[2]) << 6) | Math.max(0, v[3]);
    out[o++] = (n >> 16) & 255;
    if (v[2] >= 0 && o < out.length) out[o++] = (n >> 8) & 255;
    if (v[3] >= 0 && o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** The middle of a square. */
export function cellMid(i: number): [number, number] {
  return [((i % FOG_SIDE) + 0.5) * FOG_CELL, (Math.floor(i / FOG_SIDE) + 0.5) * FOG_CELL];
}

/** The unseen squares nearest a point, nearest first, up to `max` metres away and `limit` of them (`ok` may refuse one). */
export function fogNearest(bits: Uint8Array, x: number, y: number, max: number, limit = 8, ok?: (i: number) => boolean): number[] {
  const cx = Math.floor(x / FOG_CELL), cy = Math.floor(y / FOG_CELL);
  const out: { i: number; d: number }[] = [];
  const R = Math.ceil(max / FOG_CELL);
  for (let ring = 0; ring <= R; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= FOG_SIDE || gy >= FOG_SIDE) continue;
        const i = gy * FOG_SIDE + gx;
        if (fogHas(bits, i)) continue;
        const [mx, my] = cellMid(i);
        const d = Math.hypot(mx - x, my - y);
        if (d > max || (ok && !ok(i))) continue;
        out.push({ i, d });
      }
    }
    // A ring further out can still hold a nearer square by the corner: stop a ring after enough are found.
    if (out.length >= limit && ring * FOG_CELL > out[Math.min(out.length, limit) - 1].d + FOG_CELL) break;
  }
  return out.sort((a, b) => a.d - b.d).slice(0, limit).map((e) => e.i);
}

// ------------------------------------------------------------------------------------------------ a scout's course

/** The length of a flat course [x0, y0, x1, y1, …]. */
export function courseLength(pts: number[]): number {
  let d = 0;
  for (let i = 2; i + 1 < pts.length; i += 2) d += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return d;
}

/** Where a flat course is `d` metres along, and her heading there (radians, 0 = north, clockwise). */
export function courseAt(pts: number[], d: number): { x: number; y: number; heading: number } {
  if (pts.length < 2) return { x: 0, y: 0, heading: 0 };
  let left = Math.max(0, d);
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const dx = pts[i] - pts[i - 2], dy = pts[i + 1] - pts[i - 1];
    const seg = Math.hypot(dx, dy);
    if (left <= seg || i + 2 >= pts.length) {
      const t = seg > 0 ? Math.min(1, left / seg) : 1;
      return { x: pts[i - 2] + dx * t, y: pts[i - 1] + dy * t, heading: Math.atan2(dx, -dy) };
    }
    left -= seg;
  }
  return { x: pts[pts.length - 2], y: pts[pts.length - 1], heading: 0 };
}

/** The points a course passes between `d0` and `d1` metres along, every `step` metres (both ends included): what a
 *  scout's lookouts have seen in that stretch. */
export function courseSamples(pts: number[], d0: number, d1: number, step: number): [number, number][] {
  const out: [number, number][] = [];
  if (pts.length < 2 || d1 < d0) return out;
  for (let d = d0; d < d1; d += step) {
    const p = courseAt(pts, d);
    out.push([p.x, p.y]);
  }
  const p = courseAt(pts, d1);
  out.push([p.x, p.y]);
  return out;
}
