// Small, allocation-light math helpers shared by server simulation and client prediction.
// Coordinate system: world meters, +x east, +y south (screen-down). Heading 0 = north (-y), clockwise radians.

export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** Wrap angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
}

export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** Unit vector for a heading (0 = north, clockwise). */
export function headingVec(h: number): Vec2 {
  return { x: Math.sin(h), y: -Math.cos(h) };
}

/** Heading that points from (0,0) toward (dx,dy). */
export function headingOf(dx: number, dy: number): number {
  return Math.atan2(dx, -dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ray-casting point-in-polygon. `poly` is a flat [x0,y0,x1,y1,...] array. */
export function pointInPolygon(px: number, py: number, poly: ArrayLike<number>): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1];
    const xj = poly[j], yj = poly[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Closest point on segment AB to P; returns squared distance and the point. */
export function closestOnSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): { x: number; y: number; d2: number; t: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  return { x, y, d2: dist2(px, py, x, y), t };
}

/** Nearest point on polygon boundary. */
export function closestOnPolygon(px: number, py: number, poly: ArrayLike<number>): { x: number; y: number; d2: number } {
  let best = { x: poly[0], y: poly[1], d2: Infinity };
  const n = poly.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const c = closestOnSegment(px, py, poly[j], poly[j + 1], poly[i], poly[i + 1]);
    if (c.d2 < best.d2) best = { x: c.x, y: c.y, d2: c.d2 };
  }
  return best;
}

/**
 * Segment vs oriented ellipse (ship hull approximation) intersection.
 * Returns the parametric t along the segment of first contact, or -1.
 * Ellipse centered at (cx,cy), heading h, half-length a (along heading), half-beam b.
 */
export function segmentHitsHull(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, h: number, a: number, b: number,
): number {
  // Transform into hull local space: local y = along heading, local x = to starboard.
  const s = Math.sin(h), c = Math.cos(h);
  const toLocal = (wx: number, wy: number): [number, number] => {
    const dx = wx - cx, dy = wy - cy;
    // forward = (s, -c); right = (c, s)
    return [(dx * c + dy * s) / b, (dx * s - dy * c) / a];
  };
  const [lx0, ly0] = toLocal(x0, y0);
  const [lx1, ly1] = toLocal(x1, y1);
  const dx = lx1 - lx0, dy = ly1 - ly0;
  const A = dx * dx + dy * dy;
  const B = 2 * (lx0 * dx + ly0 * dy);
  const C = lx0 * lx0 + ly0 * ly0 - 1;
  if (C <= 0) return 0; // starts inside
  if (A === 0) return -1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : -1;
}

/** Transform world point to ship-local coordinates (x = starboard, y = forward). */
export function toShipLocal(wx: number, wy: number, cx: number, cy: number, h: number): Vec2 {
  const s = Math.sin(h), c = Math.cos(h);
  const dx = wx - cx, dy = wy - cy;
  return { x: dx * c + dy * s, y: dx * s - dy * c };
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
