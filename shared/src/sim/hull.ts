// The hull against the coast and the sea's solid things (owner, 2026-10-08: «корабли не чувствуют границ островов и
// некоторых других объектов», «врезаясь в объекты корабль должен получать урон»). Shared by the server's step and the
// client's prediction, so she stops where she is drawn to stop on both.
//
// What was wrong: three points on her keel (bow and stern at 0.45 of her length, and her middle) were tested against
// the island's raw polygon, and a point inside was put back on that polygon 3 m out. The coast the captain sees is
// another line: the renderer rounds the polygon (quadratic curves through the edges' midpoints, which bulge past it in
// every bay) and strokes a 20 m band of shore stones over it, 10 m of it over the water. So her bow came to rest in the
// stones, her sides (never tested: no beam) lay over them, and in a bay her middle could be pushed through one edge
// onto the next and end ashore. The client's prediction did not collide at all and carried her another fifth of a
// second in.
//
// Now: the coast is the drawn line itself (the same curves, sampled), with a grid of its edges for the lookups; her hull
// is a chain of circles along her keel, each as wide as she is there; each circle keeps the shore band and a margin off
// the drawn coast (or its own clearance off a solid thing). Whatever pierces it is pushed out along the coast's normal
// until nothing does; then her way into it is lost (the impact), her way along it kept, and on a glancing blow her bow
// swings along the coast, so she slides rather than sticks.

import { SPEED_SCALE } from '../constants.ts';

// ------------------------------------------------------------------ the coast as drawn

/** Metres between two of a coast's grid lines, and how far from an edge a cell still lists it (the deepest query). */
const CELL = 32;
export const COAST_REACH = 48;

export interface Coast {
  /** The rounded outline, sampled: x,y interleaved, closed (the last point joins the first). */
  pts: Float64Array;
  /** The outward unit normal at each point (the mean of its two edges'). */
  nrm: Float32Array;
  /** The distance along the outline to each point, and the whole length. */
  along: Float32Array;
  total: number;
  n: number;
  /** Her middle (the polygon's mean) and the reach of the outline about it. */
  cx: number;
  cy: number;
  r: number;
  /** +1 when the outline runs with the inside on its left (the signed area positive). */
  wind: number;
  /** The edge grid: its corner, size; each cell's edges (start offsets into `list`); each cell's centre ashore. */
  gx0: number;
  gy0: number;
  gw: number;
  gh: number;
  start: Int32Array;
  list: Int32Array;
  land: Uint8Array;
}

const coasts = new WeakMap<ArrayLike<number>, Coast>();

/** The coast of a polygon as the renderer draws it (renderer.ts path()): rounded through the edges' midpoints with the
 *  vertices as control points. The polygon is rounded to whole metres first, as the client receives it, so the server
 *  and the client hold one and the same line. Cached on the polygon. */
export function coastOf(poly: ArrayLike<number>): Coast {
  let c = coasts.get(poly);
  if (!c) coasts.set(poly, (c = buildCoast(poly)));
  return c;
}

/** The drawn outline's points (as path() draws it: straight for under four vertices). */
export function roundedOutline(poly: ArrayLike<number>): number[] {
  const n = poly.length >> 1;
  const X = (i: number) => Math.round(poly[(((i % n) + n) % n) * 2]);
  const Y = (i: number) => Math.round(poly[(((i % n) + n) % n) * 2 + 1]);
  const out: number[] = [];
  if (n < 4) {
    for (let i = 0; i < n; i++) out.push(X(i), Y(i));
    return out;
  }
  for (let i = 1; i <= n; i++) {
    const m0x = (X(i - 1) + X(i)) / 2, m0y = (Y(i - 1) + Y(i)) / 2;
    const m1x = (X(i) + X(i + 1)) / 2, m1y = (Y(i) + Y(i + 1)) / 2;
    const bx = X(i), by = Y(i);
    // As many points as the curve is long (one every 12 m or so; a tight corner at least four).
    const k = Math.max(4, Math.min(12, Math.ceil((Math.hypot(bx - m0x, by - m0y) + Math.hypot(m1x - bx, m1y - by)) / 12)));
    for (let j = 0; j < k; j++) {
      const t = j / k, u = 1 - t;
      out.push(u * u * m0x + 2 * u * t * bx + t * t * m1x, u * u * m0y + 2 * u * t * by + t * t * m1y);
    }
  }
  return out;
}

function buildCoast(poly: ArrayLike<number>): Coast {
  const raw = roundedOutline(poly);
  const n = raw.length >> 1;
  const pts = Float64Array.from(raw);
  let area = 0, mx = 0, my = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const j = (i + 1) % n;
    area += ax * pts[j * 2 + 1] - pts[j * 2] * ay;
    mx += ax;
    my += ay;
    if (ax < x0) x0 = ax;
    if (ay < y0) y0 = ay;
    if (ax > x1) x1 = ax;
    if (ay > y1) y1 = ay;
  }
  const wind = area >= 0 ? 1 : -1;
  const cx = n ? mx / n : 0, cy = n ? my / n : 0;
  let r = 0;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(pts[i * 2] - cx, pts[i * 2 + 1] - cy));
  // Outward normals: an edge's right hand when the inside is on its left.
  const ex = new Float64Array(n), ey = new Float64Array(n);
  const along = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1];
    const l = Math.hypot(dx, dy) || 1;
    ex[i] = (dy / l) * wind;
    ey[i] = (-dx / l) * wind;
    along[i] = total;
    total += l;
  }
  const nrm = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n;
    const ax = ex[p] + ex[i], ay = ey[p] + ey[i];
    const l = Math.hypot(ax, ay) || 1;
    nrm[i * 2] = ax / l;
    nrm[i * 2 + 1] = ay / l;
  }
  // The grid over the outline and its reach: each cell lists the edges within COAST_REACH of it.
  const gx0 = Math.floor((x0 - COAST_REACH) / CELL) * CELL, gy0 = Math.floor((y0 - COAST_REACH) / CELL) * CELL;
  const gw = Math.max(1, Math.ceil((x1 + COAST_REACH - gx0) / CELL)), gh = Math.max(1, Math.ceil((y1 + COAST_REACH - gy0) / CELL));
  const count = new Int32Array(gw * gh + 1);
  const span = (i: number, f: (k: number) => void) => {
    const j = (i + 1) % n;
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const cx0 = Math.max(0, Math.floor((Math.min(ax, bx) - COAST_REACH - gx0) / CELL)), cx1 = Math.min(gw - 1, Math.floor((Math.max(ax, bx) + COAST_REACH - gx0) / CELL));
    const cy0 = Math.max(0, Math.floor((Math.min(ay, by) - COAST_REACH - gy0) / CELL)), cy1 = Math.min(gh - 1, Math.floor((Math.max(ay, by) + COAST_REACH - gy0) / CELL));
    for (let gy = cy0; gy <= cy1; gy++) for (let gx = cx0; gx <= cx1; gx++) f(gy * gw + gx);
  };
  for (let i = 0; i < n; i++) span(i, (k) => count[k + 1]++);
  const start = new Int32Array(gw * gh + 1);
  for (let k = 0; k < gw * gh; k++) start[k + 1] = start[k] + count[k + 1];
  const list = new Int32Array(start[gw * gh]);
  const fill = start.slice(0, gw * gh);
  for (let i = 0; i < n; i++) span(i, (k) => (list[fill[k]++] = i));
  // Each cell's centre ashore or afloat: a scanline across each row of centres.
  const land = new Uint8Array(gw * gh);
  const xs: number[] = [];
  for (let gy = 0; gy < gh; gy++) {
    const yc = gy0 + (gy + 0.5) * CELL;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ay = pts[i * 2 + 1], by = pts[j * 2 + 1];
      if (ay > yc !== by > yc) xs.push(pts[i * 2] + ((yc - ay) * (pts[j * 2] - pts[i * 2])) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const ga = Math.max(0, Math.ceil((xs[q] - gx0) / CELL - 0.5)), gb = Math.min(gw - 1, Math.floor((xs[q + 1] - gx0) / CELL - 0.5));
      for (let gx = ga; gx <= gb; gx++) land[gy * gw + gx] = 1;
    }
  }
  return { pts, nrm, along, total, n, cx, cy, r, wind, gx0, gy0, gw, gh, start, list, land };
}

/** A query's answer (one object reused: the hot path allocates nothing). `d` is signed: negative ashore. */
export interface Probe {
  d: number;
  /** The outward normal there (from the land toward her), and the nearest point of the coast. */
  nx: number;
  ny: number;
  qx: number;
  qy: number;
}

/** Signed distance from a point to the drawn coast, exact within COAST_REACH of it; farther out `d` is COAST_REACH
 *  (afloat) or the true depth inland (found by a sweep of the whole outline, for a hull set down deep ashore). */
export function coastProbe(c: Coast, x: number, y: number, out: Probe): Probe {
  const gx = Math.floor((x - c.gx0) / CELL), gy = Math.floor((y - c.gy0) / CELL);
  if (gx < 0 || gy < 0 || gx >= c.gw || gy >= c.gh || c.n < 2) {
    out.d = COAST_REACH;
    out.nx = 0;
    out.ny = 0;
    out.qx = x;
    out.qy = y;
    return out;
  }
  const k = gy * c.gw + gx;
  const s = c.start[k], e = c.start[k + 1];
  if (s === e) {
    if (!c.land[k]) {
      out.d = COAST_REACH;
      out.nx = 0;
      out.ny = 0;
      out.qx = x;
      out.qy = y;
      return out;
    }
    return nearest(c, x, y, 0, c.n, null, out, true);
  }
  return nearest(c, x, y, s, e, c.list, out, false);
}

/** The nearest point of the outline among edges [s, e) (of `list`, or every edge), and which side she is on. */
function nearest(c: Coast, x: number, y: number, s: number, e: number, list: Int32Array | null, out: Probe, deep: boolean): Probe {
  const P = c.pts, n = c.n;
  let bd = Infinity, bi = 0, bt = 0, bx = x, by = y;
  for (let q = s; q < e; q++) {
    const i = list ? list[q] : q;
    const j = i + 1 === n ? 0 : i + 1;
    const ax = P[i * 2], ay = P[i * 2 + 1];
    const dx = P[j * 2] - ax, dy = P[j * 2 + 1] - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t, py = ay + dy * t;
    const d2 = (x - px) * (x - px) + (y - py) * (y - py);
    if (d2 < bd) {
      bd = d2;
      bi = i;
      bt = t;
      bx = px;
      by = py;
    }
  }
  // The side: the edge's own normal on its run, the vertex's (the mean of its two edges') at an end.
  let nx: number, ny: number;
  if (bt <= 1e-6) {
    nx = c.nrm[bi * 2];
    ny = c.nrm[bi * 2 + 1];
  } else if (bt >= 1 - 1e-6) {
    const j = bi + 1 === n ? 0 : bi + 1;
    nx = c.nrm[j * 2];
    ny = c.nrm[j * 2 + 1];
  } else {
    const j = bi + 1 === n ? 0 : bi + 1;
    const dx = P[j * 2] - P[bi * 2], dy = P[j * 2 + 1] - P[bi * 2 + 1];
    const l = Math.hypot(dx, dy) || 1;
    nx = (dy / l) * c.wind;
    ny = (-dx / l) * c.wind;
  }
  const d = Math.sqrt(bd);
  if (d > COAST_REACH && !deep) {
    // Farther from every edge listed than they reach: afloat, or deep ashore in a cell by the coast (a hull set down
    // inland) — the outline's own crossing test tells which, and ashore the whole outline is swept for the way out.
    if (crossings(c, x, y)) return nearest(c, x, y, 0, c.n, null, out, true);
    out.d = COAST_REACH;
    out.nx = 0;
    out.ny = 0;
    out.qx = x;
    out.qy = y;
    return out;
  }
  const outside = deep ? false : (x - bx) * nx + (y - by) * ny >= 0;
  out.d = outside ? d : -d;
  out.qx = bx;
  out.qy = by;
  // The way out: from the coast toward her when afloat, from her toward the coast when ashore (the same line); the
  // normal itself when she sits on the line.
  if (d > 1e-3) {
    const s = outside ? 1 : -1;
    out.nx = ((x - bx) / d) * s;
    out.ny = ((y - by) / d) * s;
  } else {
    out.nx = nx;
    out.ny = ny;
  }
  return out;
}

/** Inside the outline by the even-odd rule (every edge: the slow test, for the rare deep cases). */
function crossings(c: Coast, x: number, y: number): boolean {
  const P = c.pts, n = c.n;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = P[i * 2], yi = P[i * 2 + 1], xj = P[j * 2], yj = P[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point is ashore by the drawn coast (the outline's own test, for the client's chart work and the tests). */
export function inCoast(c: Coast, x: number, y: number): boolean {
  const gx = Math.floor((x - c.gx0) / CELL), gy = Math.floor((y - c.gy0) / CELL);
  if (gx < 0 || gy < 0 || gx >= c.gw || gy >= c.gh) return false;
  const k = gy * c.gw + gx;
  if (c.start[k] === c.start[k + 1]) return c.land[k] === 1;
  return coastProbe(c, x, y, SCRATCH).d < 0;
}

// ------------------------------------------------------------------ the things she can strike

/** What she strikes, for the words and the splinters: the rocks of a coast, a wreck, ice, a buoy, moored hulks, a pier,
 *  a sandbank the tide has bared, a turtle island's shell. */
export type StrikeKind = 'rock' | 'wreck' | 'ice' | 'buoy' | 'hulks' | 'pier' | 'sand' | 'shell';

export interface Blocker {
  shape: 'coast' | 'disc' | 'box';
  coast: Coast | null;
  /** A disc's or a box's middle (a coast's: its centre), the reach about it for the broad test. */
  x: number;
  y: number;
  reach: number;
  /** A disc's radius; a box's half sizes and its turn (cos, sin). */
  r: number;
  hw: number;
  hh: number;
  ca: number;
  sa: number;
  /** The water she keeps between her hull and it (a coast: its shore band and a margin). */
  pad: number;
  kind: StrikeKind;
  /** How hard it bites (1 a rock; a buoy far less). */
  dmg: number;
}

/** The shore band the renderer strokes over the coast is 20 m wide, half of it over the water; she keeps 3 m off it. */
export const SHORE_PAD = 13;
/** A floating town's hulks are drawn inside its outline (no band): a few metres off them. */
export const RAFT_PAD = 6;
/** A solid thing's margin. */
export const SOLID_PAD = 3;

export function coastBlocker(poly: ArrayLike<number>, pad: number, kind: StrikeKind = 'rock', dmg = 1): Blocker {
  const c = coastOf(poly);
  return { shape: 'coast', coast: c, x: c.cx, y: c.cy, reach: c.r + pad, r: 0, hw: 0, hh: 0, ca: 1, sa: 0, pad, kind, dmg };
}

export function discBlocker(x: number, y: number, r: number, kind: StrikeKind, dmg = 1, pad = SOLID_PAD): Blocker {
  return { shape: 'disc', coast: null, x, y, reach: r + pad, r, hw: 0, hh: 0, ca: 1, sa: 0, pad, kind, dmg };
}

/** A box `hw`×`hh` (half sizes) about (x, y), turned `rot` (its local +y along the heading `rot`... as the canvas
 *  turns it: local (u, v) → world (x + u·cos − v·sin, y + u·sin + v·cos)). */
export function boxBlocker(x: number, y: number, hw: number, hh: number, rot: number, kind: StrikeKind, dmg = 1, pad = SOLID_PAD): Blocker {
  return { shape: 'box', coast: null, x, y, reach: Math.hypot(hw, hh) + pad, r: 0, hw, hh, ca: Math.cos(rot), sa: Math.sin(rot), pad, kind, dmg };
}

const SCRATCH: Probe = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };

/** Signed distance from a point to a blocker (negative inside it), with the way out. */
export function blockerProbe(b: Blocker, x: number, y: number, out: Probe): Probe {
  if (b.shape === 'coast') return coastProbe(b.coast!, x, y, out);
  if (b.shape === 'disc') {
    const dx = x - b.x, dy = y - b.y;
    const l = Math.hypot(dx, dy);
    out.d = l - b.r;
    out.nx = l > 1e-6 ? dx / l : 1;
    out.ny = l > 1e-6 ? dy / l : 0;
    out.qx = b.x + out.nx * b.r;
    out.qy = b.y + out.ny * b.r;
    return out;
  }
  // A box in its own frame.
  const dx = x - b.x, dy = y - b.y;
  const u = dx * b.ca + dy * b.sa, v = -dx * b.sa + dy * b.ca;
  const ou = Math.abs(u) - b.hw, ov = Math.abs(v) - b.hh;
  let lu: number, lv: number, d: number;
  if (ou > 0 || ov > 0) {
    const cu = Math.max(ou, 0), cv = Math.max(ov, 0);
    d = Math.hypot(cu, cv);
    lu = cu * Math.sign(u);
    lv = cv * Math.sign(v);
    const l = d || 1;
    lu /= l;
    lv /= l;
  } else if (ou > ov) {
    d = ou;
    lu = Math.sign(u) || 1;
    lv = 0;
  } else {
    d = ov;
    lu = 0;
    lv = Math.sign(v) || 1;
  }
  out.d = d;
  out.nx = lu * b.ca - lv * b.sa;
  out.ny = lu * b.sa + lv * b.ca;
  out.qx = x - out.nx * d;
  out.qy = y - out.ny * d;
  return out;
}

// ------------------------------------------------------------------ her hull

/** Her hull from above as circles along her keel: [share of her length forward of her middle, share of her half beam]
 *  — a fine bow, the full midships, a broad stern. */
const STATIONS: readonly [number, number][] = [[0.47, 0.3], [0.34, 0.7], [0.17, 0.95], [0, 1], [-0.17, 0.97], [-0.33, 0.88], [-0.46, 0.75]];

/** What a resolve found: how far she was pushed and which way (the push's normal), where she touched, what. */
export interface HullHit {
  depth: number;
  nx: number;
  ny: number;
  px: number;
  py: number;
  kind: StrikeKind;
  dmg: number;
}

export function newHit(): HullHit {
  return { depth: 0, nx: 0, ny: 0, px: 0, py: 0, kind: 'rock', dmg: 1 };
}

const PR: Probe = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };

/** Her hull out of everything in `list` (the blockers about her): pushed out along the way out of the deepest
 *  overlap, again until none is left (four passes at most: a bay's two shores, a pier and its coast). Moves `st` in
 *  place; true when anything touched, with the hit filled in. */
export function resolveHull(st: { x: number; y: number; heading: number }, length: number, beam: number, list: readonly Blocker[], hit: HullHit): boolean {
  hit.depth = 0;
  if (!list.length) return false;
  let any = false, tx = 0, ty = 0, best = 0;
  const half = beam / 2;
  for (let pass = 0; pass < 4; pass++) {
    const fx = Math.sin(st.heading), fy = -Math.cos(st.heading);
    let worst = 0, wnx = 0, wny = 0, wpx = 0, wpy = 0;
    let wb: Blocker | null = null;
    for (const b of list) {
      // Broad: her middle within reach of it and her half length.
      const lim = b.reach + length * 0.5 + half;
      if (Math.abs(st.x - b.x) > lim || Math.abs(st.y - b.y) > lim) continue;
      for (const [s, w] of STATIONS) {
        const sx = st.x + fx * s * length, sy = st.y + fy * s * length;
        const rad = w * half;
        if (Math.abs(sx - b.x) > b.reach + rad || Math.abs(sy - b.y) > b.reach + rad) continue;
        blockerProbe(b, sx, sy, PR);
        const pen = rad + b.pad - PR.d;
        if (pen > worst) {
          worst = pen;
          wnx = PR.nx;
          wny = PR.ny;
          wpx = sx - PR.nx * rad;
          wpy = sy - PR.ny * rad;
          wb = b;
        }
      }
    }
    if (worst <= 1e-3 || !wb || (wnx === 0 && wny === 0)) break;
    // A hair beyond, so a resting hull does not touch again next tick for nothing.
    const push = worst + 0.02;
    st.x += wnx * push;
    st.y += wny * push;
    tx += wnx * push;
    ty += wny * push;
    any = true;
    if (worst > best) {
      best = worst;
      hit.px = wpx;
      hit.py = wpy;
      hit.kind = wb.kind;
      hit.dmg = wb.dmg;
    }
  }
  if (!any) return false;
  const l = Math.hypot(tx, ty) || 1;
  hit.depth = l;
  hit.nx = tx / l;
  hit.ny = ty / l;
  return true;
}

/** How much water her hull keeps beyond each blocker's own clearance (negative: she is inside it), the least of all
 *  her circles (the tests' and the sims' measure). */
export function hullClearance(st: { x: number; y: number; heading: number }, length: number, beam: number, list: readonly Blocker[]): number {
  const fx = Math.sin(st.heading), fy = -Math.cos(st.heading);
  let least = Infinity;
  for (const b of list) {
    for (const [s, w] of STATIONS) {
      blockerProbe(b, st.x + fx * s * length, st.y + fy * s * length, PR);
      least = Math.min(least, PR.d - w * beam * 0.5 - b.pad);
    }
  }
  return least;
}

/** How fast her bow swings along a coast she strikes a glancing blow (radians a second). */
export const GLANCE_YAW = 1.6;
/** Her way along a coast she grinds is kept, less this much each touch. */
export const GRIND_KEEP = 0.94;

/** Her way after a touch: what she had into the obstacle is lost (returned: the impact, in her speed's units), what
 *  she had along it is kept; on a glancing blow (her way along it at least a third of it) her bow swings toward the
 *  way she still has, at GLANCE_YAW, so she slides on along the coast instead of sticking to it. */
export function hullResponse(st: { heading: number; speed: number }, hit: HullHit, dt: number): number {
  if (hit.depth <= 0) return 0;
  const fx = Math.sin(st.heading), fy = -Math.cos(st.heading);
  const vn = (fx * hit.nx + fy * hit.ny) * st.speed;
  if (vn >= 0) return 0;
  const vx = fx * st.speed - vn * hit.nx, vy = fy * st.speed - vn * hit.ny;
  const along = Math.hypot(vx, vy);
  if (along > st.speed * 0.33 && along > 0.05) {
    const want = Math.atan2(vx, -vy);
    let diff = want - st.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = GLANCE_YAW * dt;
    st.heading += Math.max(-step, Math.min(step, diff));
    if (st.heading > Math.PI) st.heading -= Math.PI * 2;
    else if (st.heading < -Math.PI) st.heading += Math.PI * 2;
  }
  st.speed = along * GRIND_KEEP;
  return -vn;
}

// ------------------------------------------------------------------ the blow

/** The displayed knots of a way (client/src/ui/dom.ts knots()). */
export const KNOTS_PER_SPEED = 0.8;
/** Under this many knots into it a touch costs nothing. */
export const STRIKE_FREE_KN = 1.5;
/** The hull a knot into it costs (of her whole hull), and the most one blow takes. */
export const STRIKE_PER_KN = 0.016;
export const STRIKE_MAX = 0.25;
/** No second blow within this many seconds (grinding along a coast does not drain her). */
export const STRIKE_COOLDOWN = 2.5;
/** A healthy hull (this share and more) is never sunk by one blow: she is left this much at least. */
export const STRIKE_HEALTHY = 0.3;
export const STRIKE_FLOOR = 0.05;

/** A blow's hull damage: her impact (speed units into it) × the thing's bite, against her hull's whole and what she
 *  has. Zero for a gentle touch; never more than a quarter of her; never her last plank if she was sound. */
export function strikeDamage(impact: number, bite: number, hullMax: number, hull: number): number {
  const kn = impact * KNOTS_PER_SPEED;
  if (kn < STRIKE_FREE_KN || bite <= 0) return 0;
  let dmg = Math.min(STRIKE_MAX, STRIKE_PER_KN * (kn - STRIKE_FREE_KN * 0.5) * bite) * hullMax;
  if (hull >= hullMax * STRIKE_HEALTHY) dmg = Math.min(dmg, Math.max(0, hull - hullMax * STRIKE_FLOOR));
  return Math.max(0, dmg);
}

/** Her way in world metres a second (the sea's pace), for the tests' and the effects' reckoning. */
export const worldSpeed = (speed: number): number => speed * SPEED_SCALE;
