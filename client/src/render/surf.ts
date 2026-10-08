// The surf on every coast, drawn in code (owner, 2026-10-08: «вокруг островов не нарисованы волны, там просто какая-то
// обводка некрасивая, нужны прям волны красивые, кодом моушен графикой сделай красиво»). It replaces the wide pale
// strokes of the coast (the shallows' three and the kind's halo) with:
//   - the shallows: a soft tint of the coast's water, strongest at the shore and gone some 80 m out — each kind its own
//     (the pale grey-green over a tropical shelf, the cold grey of a rocky one, the ash water of a fire island, the murk
//     of a swamp, the brown of a graveyard's, the Choir's pale light) — painted once per island into a small canvas and
//     laid under her each frame;
//   - the breakers: crests of a swell rolling in to the coast — a faint line far out, steepening, then breaking into a
//     ragged band of foam, a dark trough behind each — broken into lengths that change with every wave, the swell's
//     fronts sweeping slantwise along the shore;
//   - over the shore band, after the land: the white water at the waterline, brightening as each wave arrives and
//     settling after, a bright edge where the sea meets the stones or the sand, and the swash running up the band and
//     fading on it;
//   - spray thrown up where a wave meets a rock (the painted splash), on the rocky coasts and the sea stacks.
// The foam's texture is made here too: a tile of blotches and lace from tileable noise, laid along the strokes and
// anchored to the world (it drifts a little with the water, never with the camera). Everything follows the coast as
// drawn (shared/src/sim/hull.ts coastOf: the outline the keel keeps off), so the waves break where she would strike.
// Thinned by the zoom: from far off the tint and a line of white; up close all of it.

import type { IslandData } from '../../../shared/src/protocol.ts';
import { coastOf } from '../../../shared/src/sim/hull.ts';
import type { Coast } from '../../../shared/src/sim/hull.ts';
import type { IsleType } from '../../../shared/src/world/archipelago.ts';
import type { Fx } from './fx.ts';

type G = CanvasRenderingContext2D;

export interface SurfCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  night: number;
  w: number;
  h: number;
  fx: Fx | null;
}

/** Half the shore band the renderer strokes over the coast (renderer.ts drawIsland: 20 m): the waterline. */
const BAND = 10;
/** A swell's period (seconds). */
const PERIOD = 7.5;

interface Look {
  /** The shallows' tint and how strong; the foam's colour; the swell's height (alpha); how many crests. */
  tint: [number, number, number];
  tintA: number;
  foam: [number, number, number];
  amp: number;
  crests: number;
}

const LOOKS: Record<IsleType | 'none', Look> = {
  tropical: { tint: [116, 146, 128], tintA: 0.46, foam: [230, 234, 226], amp: 1, crests: 3 },
  rocky: { tint: [100, 120, 134], tintA: 0.36, foam: [226, 232, 234], amp: 1, crests: 3 },
  volcanic: { tint: [14, 10, 9], tintA: 0.5, foam: [182, 178, 172], amp: 0.8, crests: 3 },
  swamp: { tint: [68, 86, 50], tintA: 0.5, foam: [188, 196, 168], amp: 0.5, crests: 1 },
  graveyard: { tint: [92, 82, 62], tintA: 0.44, foam: [210, 202, 184], amp: 0.85, crests: 2 },
  dead: { tint: [94, 166, 158], tintA: 0.3, foam: [200, 236, 228], amp: 0.85, crests: 2 },
  none: { tint: [44, 84, 94], tintA: 0.4, foam: [222, 230, 232], amp: 0.9, crests: 2 },
};

/** The biomes whose coasts are rock (the stones off the shore and the spray on them). */
const ROCK_BIOMES = new Set(['volcanic', 'crystal', 'ice', 'blacksand', 'ruins', 'barren', 'temperate', 'bone']);

/** A stone off the shore, at the band's outer edge (inside her clearance: no hull ever lies on one). */
export interface ShoreRock {
  x: number;
  y: number;
  r: number;
  rot: number;
  /** The coast point it stands off, for the spray's timing. */
  i: number;
}

interface Surf {
  c: Coast;
  look: Look;
  /** Each coast point's own small jitter (the crests not ruler-straight). */
  jit: Float32Array;
  /** The swell's slant along the coast (its sign) and its fronts' spacing (metres). */
  dir: number;
  lam: number;
  /** The breakers' reach out from the waterline (metres). */
  reach: number;
  rocks: ShoreRock[];
  /** Each rock's last wave (for its spray). */
  hitAt: Int32Array;
  glow: { c: HTMLCanvasElement; x0: number; y0: number; k: number } | null;
}

const surfs = new WeakMap<object, Surf>();

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

const hash = (n: number) => {
  let v = Math.imul(n ^ 0x27d4eb2d, 0x165667b1);
  v ^= v >>> 15;
  v = Math.imul(v, 0x85ebca6b);
  v ^= v >>> 13;
  return (v >>> 0) / 4294967296;
};

/** Smooth 1-D value noise in [0, 1] (the crests' broken lengths). */
function vnoise(x: number): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function surfOf(is: IslandData): Surf {
  let s = surfs.get(is);
  if (s) return s;
  const c = coastOf(is.poly);
  const rnd = seeded(is.id * 7919 + 17);
  const jit = new Float32Array(c.n);
  for (let i = 0; i < c.n; i++) jit[i] = rnd();
  const look = LOOKS[is.ty ?? 'none'];
  const rocks: ShoreRock[] = [];
  const stony = is.minor || is.isle === 'ridge' || ROCK_BIOMES.has(is.biome);
  if (stony && c.n > 8) {
    const count = Math.min(16, Math.max(3, Math.round(c.n / 14)));
    for (let k = 0; k < count; k++) {
      const i = Math.floor(rnd() * c.n);
      const off = 3 + rnd() * 5, r = 2.5 + rnd() * 2.5;
      rocks.push({ x: c.pts[i * 2] + c.nrm[i * 2] * off, y: c.pts[i * 2 + 1] + c.nrm[i * 2 + 1] * off, r, rot: rnd() * Math.PI, i });
    }
  }
  s = {
    c, look, jit, dir: rnd() < 0.5 ? -1 : 1, lam: 300 + rnd() * 200, reach: Math.max(22, Math.min(54, 14 + c.r * 0.07)),
    rocks, hitAt: new Int32Array(rocks.length).fill(-1), glow: null,
  };
  surfs.set(is, s);
  return s;
}

/** The stones off a rocky coast (the renderer draws them; the spray breaks on them). */
export function shoreRocks(is: IslandData): ShoreRock[] {
  return surfOf(is).rocks;
}

// ------------------------------------------------------------------ the foam's texture (made once)

/** Metres a texel of the foam's tile (the tile some 56 m across). */
const TEXEL = 0.22;
const TILE = 256;
let foamTile: HTMLCanvasElement | null | undefined;

/** A tile of foam: tileable value noise in four octaves, cut into blotches and lace, white on clear. */
function makeFoamTile(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE;
  const g = cv.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(TILE, TILE);
  // Each octave's lattice once (a table of p×p values, wrapping: the tile repeats without a seam).
  const tables = new Map<string, Float32Array>();
  const table = (p: number, salt: number) => {
    const key = `${p}|${salt}`;
    let t = tables.get(key);
    if (!t) {
      t = new Float32Array(p * p);
      for (let i = 0; i < p * p; i++) t[i] = hash((i * 73856093) ^ salt);
      tables.set(key, t);
    }
    return t;
  };
  const noise = (x: number, y: number, p: number, salt: number) => {
    const t = table(p, salt);
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = xi % p, y0 = yi % p, x1 = (xi + 1) % p, y1 = (yi + 1) % p;
    const a = t[y0 * p + x0], b = t[y0 * p + x1], c = t[y1 * p + x0], d = t[y1 * p + x1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let n = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < 4; o++) {
        const p = 8 << o;
        n += noise((x / TILE) * p, (y / TILE) * p, p, o * 1013) * amp;
        tot += amp;
        amp *= 0.5;
      }
      n /= tot;
      // The fine bubbles (a high octave of its own) and the holes between them, kept where the foam is.
      const fine = noise((x / TILE) * 64, (y / TILE) * 64, 64, 7777);
      const holes = noise((x / TILE) * 32, (y / TILE) * 32, 32, 4242);
      const body = smooth(0.36, 0.7, n);
      const a = Math.min(1, body * (0.45 + 0.55 * fine) * (0.55 + 0.45 * smooth(0.25, 0.6, holes)));
      const k = (y * TILE + x) * 4;
      img.data[k] = 255;
      img.data[k + 1] = 255;
      img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

let pattern: CanvasPattern | null = null;
let patternOf: G | null = null;

/** The foam's pattern: anchored to the world (no sliding with the camera), drifting a little, `texel` metres a texel
 *  (finer along a crest than in the white water). */
function foamPattern(g: G, x: SurfCtx, texel = TEXEL): CanvasPattern | null {
  if (foamTile === undefined) foamTile = makeFoamTile();
  if (!foamTile) return null;
  if (!pattern || patternOf !== g) {
    pattern = g.createPattern(foamTile, 'repeat');
    patternOf = g;
  }
  if (!pattern || typeof DOMMatrix === 'undefined') return pattern;
  const span = TILE * texel * x.zoom;
  const ox = x.sx(x.time * 0.9), oy = x.sy(x.time * 0.35);
  pattern.setTransform(new DOMMatrix().translate(((ox % span) + span) % span, ((oy % span) + span) % span).scale(texel * x.zoom));
  return pattern;
}

// ------------------------------------------------------------------ the shallows' tint (painted once per island)

let builtThisFrame = 0;
let frameMark = -1;

/** The tint of the coast's water: the coast stroked wide and faint again and again, so it fades off smoothly. */
function buildGlow(s: Surf): void {
  const c = s.c;
  const M = 110;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < c.n; i++) {
    x0 = Math.min(x0, c.pts[i * 2]);
    y0 = Math.min(y0, c.pts[i * 2 + 1]);
    x1 = Math.max(x1, c.pts[i * 2]);
    y1 = Math.max(y1, c.pts[i * 2 + 1]);
  }
  x0 -= M;
  y0 -= M;
  x1 += M;
  y1 += M;
  // Four metres a pixel (a soft thing needs no more), at most 768 pixels a side.
  const k = Math.min(0.25, 768 / Math.max(x1 - x0, y1 - y0));
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!cv) return;
  cv.width = Math.max(4, Math.ceil((x1 - x0) * k));
  cv.height = Math.max(4, Math.ceil((y1 - y0) * k));
  const g = cv.getContext('2d');
  if (!g) return;
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  g.beginPath();
  g.moveTo(c.pts[0], c.pts[1]);
  for (let i = 1; i < c.n; i++) g.lineTo(c.pts[i * 2], c.pts[i * 2 + 1]);
  g.closePath();
  g.lineJoin = 'round';
  const [r, gr, b] = s.look.tint;
  const steps = 16;
  // Widths falling off faster than evenly: most of the tint in the first thirty metres, a breath of it at eighty.
  for (let j = 0; j < steps; j++) {
    const w = 14 + 186 * Math.pow(1 - j / steps, 1.7);
    g.strokeStyle = `rgba(${r},${gr},${b},${(s.look.tintA / steps).toFixed(4)})`;
    g.lineWidth = w;
    g.stroke();
  }
  g.fillStyle = `rgba(${r},${gr},${b},${s.look.tintA.toFixed(3)})`;
  g.fill();
  s.glow = { c: cv, x0, y0, k };
}

/** On the screen at all (her reach and a margin about it). */
function inView(s: Surf, x: SurfCtx, pad: number): boolean {
  const R = (s.c.r + pad) * x.zoom;
  const cx = x.sx(s.c.cx), cy = x.sy(s.c.cy);
  return !(cx < -R || cy < -R || cx > x.w + R || cy > x.h + R);
}

/** The swell at coast point `j` for crest `k` (its whole part the wave's count, its fraction 0 far out, 1 at the band). */
function phase(s: Surf, j: number, k: number, crests: number, t: number): number {
  return t / PERIOD + (s.dir * s.c.along[j]) / s.lam + s.jit[j] * 0.05 + k / Math.max(1, crests);
}

// ------------------------------------------------------------------ under the land: the tint and the breakers

/** The water about her coast, under the land: the shallows' tint and the breakers rolling in. */
export function drawSurfUnder(g: G, is: IslandData, x: SurfCtx, frame: number): void {
  if (is.mist || is.raft || x.zoom < 0.04) return;
  const s = surfOf(is);
  if (!inView(s, x, 130)) return;
  const c = s.c;
  if (frame !== frameMark) {
    frameMark = frame;
    builtThisFrame = 0;
  }
  if (!s.glow && builtThisFrame < 1) {
    builtThisFrame++;
    buildGlow(s);
  }
  if (s.glow) {
    const gl = s.glow;
    const a0 = g.globalAlpha;
    // The Choir's pale light under the water breathes, brighter by night.
    if (is.ty === 'dead') g.globalAlpha = a0 * Math.min(1, 0.75 + 0.15 * Math.sin(x.time * 0.8 + is.id) + 0.25 * x.night);
    g.drawImage(gl.c, x.sx(gl.x0), x.sy(gl.y0), (gl.c.width / gl.k) * x.zoom, (gl.c.height / gl.k) * x.zoom);
    g.globalAlpha = a0;
  }
  if (x.zoom < 0.12) return;
  const look = s.look;
  const z = x.zoom;
  const full = z >= 0.3;
  const textured = z >= 0.5;
  const crests = full ? look.crests : 1;
  const amp = look.amp * (1 - 0.15 * x.night);
  const [fr, fg, fb] = look.foam;
  const m = (s.reach + 30) * z;
  const t = x.time;
  const pat = textured ? foamPattern(g, x, 0.09) : null;
  g.save();
  g.lineJoin = 'round';
  for (let k = 0; k < crests; k++) {
    // By its age: 0 a swell line far out, 1 running in, 2 breaking, 3 the white water spreading to the band.
    const bins = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const trough = textured ? new Path2D() : null;
    let lastBin = -1, lastOk = false, lastTr = false;
    let px = 0, py = 0;
    for (let i = 0; i <= c.n; i++) {
      const j = i === c.n ? 0 : i;
      // Off the screen by more than the breakers' reach: nothing to reckon here.
      const bsx = x.sx(c.pts[j * 2]), bsy = x.sy(c.pts[j * 2 + 1]);
      if (bsx < -m || bsy < -m || bsx > x.w + m || bsy > x.h + m) {
        lastOk = false;
        lastTr = false;
        lastBin = -1;
        continue;
      }
      const s0 = c.along[j];
      const th = phase(s, j, k, crests, t);
      const ph = th - Math.floor(th);
      const cyc = Math.floor(th);
      // In from her reach to the waterline, faster as it shoals; never ruler-straight.
      const wob = Math.sin(s0 / 37 + t * 0.7 + k * 2.1) * 2.2 + Math.sin(s0 / 11 + t * 1.3 + k) * 0.7;
      const d = BAND + 2 + s.reach * Math.pow(1 - ph, 1.25) + wob;
      const nx = c.nrm[j * 2], ny = c.nrm[j * 2 + 1];
      const sx = x.sx(c.pts[j * 2] + nx * d), sy = x.sy(c.pts[j * 2 + 1] + ny * d);
      const on = sx > -m && sy > -m && sx < x.w + m && sy < x.h + m;
      // Broken into lengths that change with every wave (the white water less broken than the lines far out).
      const bin = ph < 0.25 ? 0 : ph < 0.62 ? 1 : ph < 0.88 ? 2 : 3;
      const whole = bin >= 2 ? vnoise(s0 / 29 + cyc * 3.71 + k * 17.3 + is.id * 0.13) > 0.3 : vnoise(s0 / 17 + cyc * 2.93 + k * 11.1 + is.id * 0.17) > 0.52;
      const ok = on && whole && (full || bin === 2);
      // (Where the swell wraps — a crest done at the band, the next forming far out — no line is carried across.)
      const wrap = (lastBin === 3 && bin === 0) || (lastBin === 0 && bin === 3);
      if (ok && lastOk && !wrap && i > 0) {
        if (bin === lastBin) bins[bin].lineTo(sx, sy);
        else {
          bins[bin].moveTo(px, py);
          bins[bin].lineTo(sx, sy);
        }
      } else if (ok) bins[bin].moveTo(sx, sy);
      // The dark trough behind a crest running in and breaking.
      if (trough) {
        const tr = ok && (bin === 1 || bin === 2);
        const tx = sx + nx * 3 * z, ty = sy + ny * 3 * z;
        if (tr && lastTr && !wrap) trough.lineTo(tx, ty);
        else if (tr) trough.moveTo(tx, ty);
        lastTr = tr;
      }
      lastOk = ok;
      lastBin = bin;
      px = sx;
      py = sy;
    }
    if (trough) {
      g.lineCap = 'round';
      g.strokeStyle = `rgba(2,8,12,${(0.16 * amp).toFixed(3)})`;
      g.lineWidth = Math.max(1, 3.4 * z);
      g.stroke(trough);
    }
    // The swell lines: a faint rise of the water far out (its trough behind it), a little brighter running in.
    g.lineCap = 'round';
    g.strokeStyle = `rgba(${fr},${fg},${fb},${(0.09 * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.7, 0.9 * z);
    g.stroke(bins[0]);
    g.strokeStyle = `rgba(${fr},${fg},${fb},${((pat ? 0.14 : 0.2) * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, 1.1 * z);
    g.stroke(bins[1]);
    // The breaking crest: a ragged band of foam (the tile along it) and its bright lip; the spent white water wider.
    g.lineCap = 'butt';
    if (pat) {
      g.strokeStyle = pat;
      g.globalAlpha = amp;
      g.lineWidth = 4 * z;
      g.stroke(bins[2]);
      g.globalAlpha = 0.5 * amp;
      g.lineWidth = 7 * z;
      g.stroke(bins[2]);
      g.globalAlpha = 0.75 * amp;
      g.lineWidth = 7 * z;
      g.stroke(bins[3]);
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = `rgba(${fr},${fg},${fb},${(0.3 * amp).toFixed(3)})`;
      g.lineWidth = Math.max(1, 3 * z);
      g.stroke(bins[2]);
      g.strokeStyle = `rgba(${fr},${fg},${fb},${(0.18 * amp).toFixed(3)})`;
      g.lineWidth = Math.max(1, 4.5 * z);
      g.stroke(bins[3]);
    }
    // Its lip: a hair of brighter white along the break (only when the foam's tile is not there to draw it).
    g.lineCap = 'round';
    g.strokeStyle = `rgba(${fr},${fg},${fb},${((pat ? 0.14 : 0.5) * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, 1 * z);
    g.stroke(bins[2]);
  }
  g.restore();
}

/** Her coast drawn `d` metres out from the drawn line (inland when negative), as a path: a beach or a dark rim that
 *  keeps to the waterline whatever her size (a radial scale wandered inland on a great island). */
export function coastPath(g: G, is: IslandData, x: { sx: (x: number) => number; sy: (y: number) => number }, d: number): void {
  const c = coastOf(is.poly);
  g.beginPath();
  for (let i = 0; i < c.n; i++) {
    const px = x.sx(c.pts[i * 2] + c.nrm[i * 2] * d), py = x.sy(c.pts[i * 2 + 1] + c.nrm[i * 2 + 1] * d);
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
}

// ------------------------------------------------------------------ over the band: the white water and the swash

/** Over the shore band, after the land: the white water at the waterline, its bright edge, the swash up the band, and
 *  the spray on the rocks. */
export function drawSurfOver(g: G, is: IslandData, x: SurfCtx): void {
  if (is.mist || is.raft || x.zoom < 0.12) return;
  const s = surfOf(is);
  if (!inView(s, x, 60)) return;
  const c = s.c;
  const look = s.look;
  const z = x.zoom;
  const full = z >= 0.3;
  const textured = z >= 0.5;
  const crests = look.crests;
  const amp = look.amp * (1 - 0.15 * x.night);
  const [fr, fg, fb] = look.foam;
  const t = x.time;
  const m = 40 * z;
  // Six strengths by how near a wave is (fine steps, so no seam shows where one gives way to the next): it brightens
  // as each arrives, lingers a moment after, settles.
  const NB = 6;
  const white = Array.from({ length: NB }, () => new Path2D());
  const edge = Array.from({ length: NB }, () => new Path2D());
  const swash = full ? [new Path2D(), new Path2D()] : null;
  let lastL = -1, lastOn = false, lastSb = -1, lastSw = false;
  let px = 0, py = 0, ex = 0, ey = 0, qx = 0, qy = 0;
  for (let i = 0; i <= c.n; i++) {
    const j = i === c.n ? 0 : i;
    const nx = c.nrm[j * 2], ny = c.nrm[j * 2 + 1];
    const bx = c.pts[j * 2], by = c.pts[j * 2 + 1];
    const lx = x.sx(bx + nx * (BAND + 0.5)), ly = x.sy(by + ny * (BAND + 0.5));
    const on = lx > -m && ly > -m && lx < x.w + m && ly < x.h + m;
    if (!on) {
      lastOn = false;
      lastSw = false;
      continue;
    }
    const wx = x.sx(bx + nx * (BAND + 4.5)), wy = x.sy(by + ny * (BAND + 4.5));
    let pulse = 0, sw = -1;
    for (let k = 0; k < crests; k++) {
      const th = phase(s, j, k, crests, t);
      const ph = th - Math.floor(th);
      pulse = Math.max(pulse, smooth(0.78, 0.98, ph), 1 - smooth(0, 0.2, ph));
      if (ph >= 0.88) sw = Math.max(sw, (ph - 0.88) / 0.12);
    }
    // Some stretches of a coast catch more of the swell than others (a slow drift along it).
    pulse *= 0.55 + 0.45 * vnoise(c.along[j] / 60 + t * 0.03 + is.id);
    const lb = Math.min(NB - 1, Math.floor(pulse * NB));
    if (on) {
      if (lastOn && lb === lastL) {
        white[lb].lineTo(wx, wy);
        edge[lb].lineTo(lx, ly);
      } else if (lastOn) {
        white[lb].moveTo(px, py);
        white[lb].lineTo(wx, wy);
        edge[lb].moveTo(ex, ey);
        edge[lb].lineTo(lx, ly);
      } else {
        white[lb].moveTo(wx, wy);
        edge[lb].moveTo(lx, ly);
      }
    }
    // The swash: the wave's last run up the band, from the waterline to two metres short of the land, fading.
    if (swash) {
      const okS = on && sw >= 0;
      const sb = sw < 0.5 ? 0 : 1;
      const d = BAND - Math.max(0, sw) * (BAND - 2);
      const sx = x.sx(bx + nx * d), sy = x.sy(by + ny * d);
      if (okS && lastSw && sb === lastSb) swash[sb].lineTo(sx, sy);
      else if (okS && lastSw) {
        swash[sb].moveTo(qx, qy);
        swash[sb].lineTo(sx, sy);
      } else if (okS) swash[sb].moveTo(sx, sy);
      lastSw = okS;
      lastSb = sb;
      qx = sx;
      qy = sy;
    }
    lastOn = on;
    lastL = lb;
    px = wx;
    py = wy;
    ex = lx;
    ey = ly;
  }
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const pat = textured ? foamPattern(g, x, 0.14) : null;
  // The white water: its strength by the wave's arrival, a fainter fringe beyond it so it has no edge to speak of.
  for (let b = 0; b < NB; b++) {
    const q = (b + 0.5) / NB;
    const wa = 0.22 + 0.76 * q, ea = 0.12 + 0.46 * q;
    if (pat) {
      g.strokeStyle = pat;
      g.globalAlpha = wa * 0.38 * amp;
      g.lineWidth = 14 * z;
      g.stroke(white[b]);
      g.globalAlpha = wa * amp;
      g.lineWidth = 8.5 * z;
    } else {
      g.strokeStyle = `rgba(${fr},${fg},${fb},${(wa * 0.32 * amp).toFixed(3)})`;
      g.lineWidth = Math.max(1, 5 * z);
    }
    g.stroke(white[b]);
    g.globalAlpha = 1;
    g.strokeStyle = `rgba(${fr},${fg},${fb},${(ea * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, 1.3 * z);
    g.stroke(edge[b]);
  }
  if (swash) {
    if (pat) {
      g.strokeStyle = pat;
      g.globalAlpha = 0.85 * amp;
    } else g.strokeStyle = `rgba(${fr},${fg},${fb},${(0.4 * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, 3 * z);
    g.stroke(swash[0]);
    g.globalAlpha = pat ? 0.4 * amp : 1;
    if (!pat) g.strokeStyle = `rgba(${fr},${fg},${fb},${(0.18 * amp).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, 2.4 * z);
    g.stroke(swash[1]);
    g.globalAlpha = 1;
  }
  g.restore();
  // Spray where a wave meets a rock: the painted splash thrown up and a few drops off it, once a wave or so.
  if (x.fx && z >= 0.35 && x.time > 0 && s.rocks.length) {
    for (let r = 0; r < s.rocks.length; r++) {
      const rk = s.rocks[r];
      const sx = x.sx(rk.x), sy = x.sy(rk.y);
      if (sx < -20 || sy < -20 || sx > x.w + 20 || sy > x.h + 20) continue;
      const wave = Math.floor(phase(s, rk.i, 0, 1, t) * crests + 0.1);
      if (s.hitAt[r] === wave) continue;
      const first = s.hitAt[r] < 0;
      s.hitAt[r] = wave;
      if (first || vnoise(wave * 1.37 + r * 7.1 + is.id) < 0.4) continue;
      const nx = c.nrm[rk.i * 2], ny = c.nrm[rk.i * 2 + 1];
      const ox = rk.x + nx * rk.r, oy = rk.y + ny * rk.r;
      x.fx.add({ kind: 'splash', x: ox, y: oy, life: 0.9, size: 1.6 + rk.r * 0.25, grow: 9 + rk.r, color: '#d6e0e4' });
      for (let q = 0; q < 4; q++) {
        const a = Math.atan2(ny, nx) + (q - 1.5) * 0.45, v = 4 + q * 1.5;
        x.fx.add({ kind: 'foam', x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + q * 0.12, size: 0.9 + (q % 2) * 0.6, color: '#e4ecef' });
      }
    }
  }
}
