// Island landscape (docs/06 art direction; Phase 10): a relief mask per island — a height field rising with the
// distance from the coast (any shape of island, crescents and hooks too) with ridges of noise, cliffs along stretches of the coast (the land rises sharply from the surf) and beaches
// elsewhere, hill-shaded from the north-west like an engraved chart. The field is pure (tested without a DOM); the
// renderer turns it into a canvas once per island and draws it over the textured land.

import { fbm } from '../../../shared/src/rng.ts';

export interface Relief {
  w: number;
  h: number;
  res: number; // metres per pixel
  x0: number; // world position of the top-left pixel
  y0: number;
  rgba: Uint8ClampedArray;
  cliffShare: number; // share of the coast that is cliff (for tests and the surf)
  height: Float32Array; // the field before shading (for tests)
}

const MAX_PX = 320;

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The coast's distance from the centre at any bearing — the outermost vertex near that bearing. Only for islands
 *  that are star-shaped round their centre; the relief measures the true distance to the coast instead. */
export function radiusAt(poly: number[], cx: number, cy: number): (a: number) => number {
  const pts: [number, number][] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push([Math.atan2(poly[i + 1] - cy, poly[i] - cx), Math.hypot(poly[i] - cx, poly[i + 1] - cy)]);
  pts.sort((p, q) => p[0] - q[0]);
  return (a: number) => {
    if (!pts.length) return 1;
    let i = pts.findIndex((p) => p[0] >= a);
    if (i < 0) i = 0;
    const b = pts[i], p = pts[(i - 1 + pts.length) % pts.length];
    let span = b[0] - p[0];
    let off = a - p[0];
    if (span <= 0) span += Math.PI * 2;
    if (off < 0) off += Math.PI * 2;
    const t = Math.min(1, off / span);
    return p[1] + (b[1] - p[1]) * t;
  };
}

/** Whether the coast at this bearing is cliff (coherent stretches, set by the island's seed). */
export function cliffAt(a: number, seed: number, rocky: number): number {
  // A wide ramp: a cliff stretch rises out of the beach over some way of coast, not in a step (a step stood up walls).
  return smooth(0.56 - rocky * 0.12, 0.8 - rocky * 0.12, fbm(Math.cos(a) * 2.2 + 11, Math.sin(a) * 2.2 + 7, seed + 5, 3));
}

export type Palette = 'green' | 'dark' | 'ice' | 'pale';

export function buildRelief(poly: number[], cx: number, cy: number, seed: number, palette: Palette, rocky = 0): Relief {
  let ext = 0;
  for (let i = 0; i < poly.length; i += 2) ext = Math.max(ext, Math.hypot(poly[i] - cx, poly[i + 1] - cy));
  ext += 30;
  const res = Math.max(3, (ext * 2) / MAX_PX);
  const w = Math.ceil((ext * 2) / res), h = w;
  const x0 = cx - ext, y0 = cy - ext;
  // Inside the coast, and how far from it (metres). Measured to the coast itself, not along a ray from the centre:
  // a ray crosses a crescent's coast twice, and a radius per bearing drew wedges across such islands.
  const n = poly.length / 2;
  const D = new Float32Array(w * h);
  const IN = new Uint8Array(w * h);
  let dMax = 1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
      let inside = false, best = Infinity;
      for (let e = 0, f = n - 1; e < n; f = e++) {
        const ax = poly[f * 2], ay = poly[f * 2 + 1], bx = poly[e * 2], by = poly[e * 2 + 1];
        if (by > wy !== ay > wy && wx < ((ax - bx) * (wy - by)) / (ay - by) + bx) inside = !inside;
        const dx = bx - ax, dy = by - ay;
        let t = ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx - wx, qy = ay + t * dy - wy;
        const d2 = qx * qx + qy * qy;
        if (d2 < best) best = d2;
      }
      const k = j * w + i;
      if (!inside) continue;
      IN[k] = 1;
      D[k] = Math.sqrt(best);
      if (D[k] > dMax) dMax = D[k];
    }
  }
  const H0 = new Float32Array(w * h);
  const U = new Float32Array(w * h);
  const C = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!IN[k]) continue;
      const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
      // u: 0 deep inland … 1 on the coast; the coastal band (beaches, cliffs) is a share of the island's depth.
      const u = 1 - Math.min(1, D[k] / (dMax * 1.4));
      U[k] = u;
      const cliff = cliffAt(Math.atan2(wy - cy, wx - cx), seed, rocky);
      C[k] = cliff;
      const base = Math.pow(Math.min(1, D[k] / dMax), 0.7);
      const nz = fbm(wx * 0.0035, wy * 0.0035, seed, 4);
      const ridge = 1 - Math.abs(fbm(wx * 0.009, wy * 0.009, seed + 3, 3) * 2 - 1);
      // Cliffs: along those stretches the land climbs toward the coast, stands high right to the edge and drops within
      // the last few metres. (Raised over the whole bearing, it stood up wedge-shaped plateaus from the centre.)
      const shelf = cliff * 0.45 * smooth(0.72, 0.9, u) * smooth(1.0, 0.94, u);
      H0[k] = base * (0.5 + 0.5 * nz) + ridge * 0.12 * base + shelf;
    }
  }
  // Round off the crest where the distances from two coasts meet (the island's spine), so it reads as a ridge
  // and not as a drawn line.
  const H = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      if (!IN[k]) continue;
      let sum = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += H0[k + dj * w + di];
      H[k] = sum / 9;
    }
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  // Light from the north-west, fairly low: the relief reads like an engraving.
  const lx = -0.6, ly = -0.6, lz = 0.53;
  const relief = 220 / res; // exaggeration
  let coast = 0, cliffCoast = 0;
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      if (!IN[k]) continue;
      const u = U[k];
      const gx = (H[k + 1] - H[k - 1]) * relief, gy = (H[k + w] - H[k - w]) * relief;
      const nl = Math.hypot(gx, gy, 1);
      const shade = (-gx * lx - gy * ly + lz) / nl; // 0..1
      const steep = Math.min(1, Math.hypot(gx, gy) / 2.5);
      const o = k * 4;
      const cliff = C[k];
      const edge = smooth(0.9, 1, u);
      if (u > 0.97) {
        coast++;
        if (cliff > 0.5) cliffCoast++;
      }
      // Beaches: a pale rim where the coast is low.
      const beach = edge * (1 - cliff);
      let r: number, g: number, b: number, al: number;
      const d = shade - lz; // below zero: in shadow
      if (d < 0) {
        r = g = b = palette === 'ice' ? 40 : 4;
        al = Math.min(1, -d * 1.6 + steep * 0.35);
      } else {
        const lit = palette === 'ice' ? [245, 250, 255] : palette === 'pale' ? [220, 212, 190] : palette === 'dark' ? [120, 96, 80] : [196, 204, 160];
        [r, g, b] = lit;
        al = Math.min(0.55, d * 1.1);
      }
      // Cliff faces: dark rock with a lit lip.
      if (cliff > 0.4 && edge > 0.2) {
        const rock = palette === 'ice' ? [150, 160, 170] : palette === 'dark' ? [18, 12, 10] : [34, 32, 28];
        const m = cliff * edge * 0.85;
        r = r * (1 - m) + rock[0] * m;
        g = g * (1 - m) + rock[1] * m;
        b = b * (1 - m) + rock[2] * m;
        al = Math.max(al, m);
      } else if (beach > 0.3 && palette !== 'ice') {
        const m = beach * 0.5;
        r = r * (1 - m) + 170 * m;
        g = g * (1 - m) + 150 * m;
        b = b * (1 - m) + 112 * m;
        al = Math.max(al, m * 0.8);
      }
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = al * 255;
    }
  }
  return { w, h, res, x0, y0, rgba, cliffShare: coast ? cliffCoast / coast : 0, height: H };
}
