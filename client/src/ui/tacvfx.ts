// docs/25 §3: the boarding field's effects, drawn on its canvas by hand (no new pictures: the painted sprites the field
// already has, and canvas strokes) — the particles (sparks of steel, embers, drops, smoke, splinters, a sabre or a hat
// flung loose), the weather over the field (rain, fog in banks, night with its moon, a storm's lightning), the rigging
// in the foreground, the water between the hulls, the shots' trails, the lanterns and pennants, the marks a fight leaves
// on a deck, and the ultimate's film frame. Positions are the stage's CSS px unless said; ui/tactical.ts lays the
// camera's transform under them.

import type { Sky } from './tacfx.ts';
import { rnd } from './tacfx.ts';

export type PartKind = 'spark' | 'ember' | 'drop' | 'smoke' | 'chip' | 'blade' | 'hat' | 'ring' | 'glint' | 'streak' | 'hook' | 'dust' | 'mist' | 'flash' | 'bubble' | 'shard';
/** One particle: where, how fast (px/s), its fall (px/s²), its drag (share of speed kept a second), since when (ms), how
 *  long, its size, its turn and spin, its colour ('r,g,b'). `land`: the y it lies down at (a sabre, a hat, a chip). */
export interface Part {
  k: PartKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  t0: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  rgb: string;
  land?: number;
  /** The board's hex it came off (a decal laid where it lands). */
  hex?: number;
  side?: 0 | 1;
  seed?: number;
}

/** A soft round light of a colour, drawn once (a cheap blob to scale for glows, smoke and fog). */
const glowCache = new Map<string, HTMLCanvasElement>();
export function glow(rgb: string, hard = 0.35): HTMLCanvasElement {
  const key = `${rgb}|${hard}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(hard, `rgba(${rgb},0.55)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}
/** A soft blob of `rgb` centred on (x, y), `r` its radius. */
export function blob(g: CanvasRenderingContext2D, rgb: string, x: number, y: number, r: number, a: number, hard = 0.35): void {
  if (!(a > 0.003) || !(r > 0.5)) return;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(glow(rgb, hard), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}

/** The field's particles: born by the effects, moved on the field's clock (still through a hit-stop), drawn after the
 *  figures. A sabre, a hat or a chip that lands is handed to `onLand` (it stays on the deck as a mark). */
export class Parts {
  list: Part[] = [];
  cap = 260;
  onLand: ((p: Part) => void) | null = null;
  private last = 0;

  add(p: Omit<Part, 'rot' | 'vr' | 'drag' | 'g'> & Partial<Pick<Part, 'rot' | 'vr' | 'drag' | 'g'>>): void {
    if (this.list.length >= this.cap) return;
    this.list.push({ rot: 0, vr: 0, drag: 1, g: 0, ...p });
  }

  /** On by the field's clock to `t`. */
  step(t: number): void {
    const dt = this.last ? Math.min(0.1, Math.max(0, (t - this.last) / 1000)) : 0;
    this.last = t;
    if (!dt) {
      this.list = this.list.filter((p) => t - p.t0 < p.life);
      return;
    }
    const keep: Part[] = [];
    for (const p of this.list) {
      if (t - p.t0 >= p.life) continue;
      if (t < p.t0) {
        keep.push(p);
        continue;
      }
      if (p.land !== undefined && p.y >= p.land && p.vy >= 0) {
        // Down on the deck: it stays where it fell (a mark of the fight), the moving one let go.
        this.onLand?.(p);
        continue;
      }
      const k = p.drag < 1 ? Math.pow(p.drag, dt) : 1;
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  draw(g: CanvasRenderingContext2D, t: number): void {
    for (const p of this.list) {
      if (t < p.t0) continue;
      const k = (t - p.t0) / p.life;
      const a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      switch (p.k) {
        case 'spark': {
          // A streak along its flight, white-hot to orange.
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const len = Math.min(p.size * 4, sp * 0.03);
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = `rgba(${p.rgb},${(a * 0.95).toFixed(3)})`;
          g.lineWidth = Math.max(1, p.size * 0.45);
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
          g.stroke();
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ember': {
          const fl = 0.7 + 0.3 * Math.sin(t / 60 + p.size * 7);
          g.globalCompositeOperation = 'lighter';
          blob(g, p.rgb, p.x, p.y, p.size * 2.4, a * 0.5 * fl);
          g.fillStyle = `rgba(255,236,170,${(a * fl).toFixed(3)})`;
          g.fillRect(p.x - p.size * 0.4, p.y - p.size * 0.4, p.size * 0.8, p.size * 0.8);
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'drop':
        case 'bubble': {
          g.fillStyle = `rgba(${p.rgb},${(a * 0.85).toFixed(3)})`;
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          if (p.k === 'bubble') {
            g.strokeStyle = g.fillStyle;
            g.lineWidth = 1;
            g.stroke();
          } else g.fill();
          break;
        }
        case 'smoke':
        case 'dust':
        case 'mist':
          blob(g, p.rgb, p.x, p.y, p.size * (1 + k * (p.k === 'mist' ? 0.6 : 1.4)), a * (p.k === 'mist' ? 0.32 : p.k === 'dust' ? 0.4 : 0.5), 0.2);
          break;
        case 'flash':
          g.globalCompositeOperation = 'lighter';
          blob(g, p.rgb, p.x, p.y, p.size * (1 + k * 0.3), (1 - k) ** 2, 0.15);
          g.globalCompositeOperation = 'source-over';
          break;
        case 'ring': {
          g.strokeStyle = `rgba(${p.rgb},${(a * 0.7).toFixed(3)})`;
          g.lineWidth = Math.max(1, p.size * 0.12 * (1 - k));
          g.beginPath();
          g.ellipse(p.x, p.y, p.size * (0.3 + k), p.size * (0.3 + k) * 0.42, 0, 0, Math.PI * 2);
          g.stroke();
          break;
        }
        case 'glint': {
          // A four-pointed glint of steel.
          const s = p.size * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7);
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = `rgba(${p.rgb},${(a * 0.95).toFixed(3)})`;
          g.beginPath();
          g.moveTo(p.x, p.y - s);
          g.lineTo(p.x + s * 0.18, p.y - s * 0.18);
          g.lineTo(p.x + s, p.y);
          g.lineTo(p.x + s * 0.18, p.y + s * 0.18);
          g.lineTo(p.x, p.y + s);
          g.lineTo(p.x - s * 0.18, p.y + s * 0.18);
          g.lineTo(p.x - s, p.y);
          g.lineTo(p.x - s * 0.18, p.y - s * 0.18);
          g.closePath();
          g.fill();
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'streak': {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          g.strokeStyle = `rgba(${p.rgb},${(a * 0.55).toFixed(3)})`;
          g.lineWidth = Math.max(1, p.size * 0.08);
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - (p.vx / sp) * p.size, p.y - (p.vy / sp) * p.size);
          g.stroke();
          break;
        }
        default: {
          // The things that turn as they fly: a chip of plank, a sabre, a hat, a grapple's hook, a shard of the plate.
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.globalAlpha = Math.max(0, a);
          drawThing(g, p.k, p.size, p.rgb);
          g.restore();
        }
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.list = [];
    this.last = 0;
  }
}

/** A thing lying or flying: at the origin, its size `s` (CSS px). */
export function drawThing(g: CanvasRenderingContext2D, k: PartKind, s: number, rgb: string): void {
  g.lineCap = 'round';
  if (k === 'chip') {
    g.fillStyle = `rgb(${rgb})`;
    g.fillRect(-s * 0.5, -s * 0.12, s, s * 0.24);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(-s * 0.5, s * 0.04, s, s * 0.08);
  } else if (k === 'blade') {
    // A sabre: a curved blade, its guard and grip.
    g.strokeStyle = 'rgba(16,14,12,0.85)';
    g.lineWidth = Math.max(2, s * 0.13);
    g.beginPath();
    g.moveTo(-s * 0.5, 0);
    g.quadraticCurveTo(0, -s * 0.12, s * 0.55, -s * 0.02);
    g.stroke();
    g.strokeStyle = 'rgb(214,220,226)';
    g.lineWidth = Math.max(1.2, s * 0.08);
    g.beginPath();
    g.moveTo(-s * 0.3, 0);
    g.quadraticCurveTo(0.05 * s, -s * 0.11, s * 0.55, -s * 0.02);
    g.stroke();
    g.strokeStyle = 'rgb(176,141,87)';
    g.lineWidth = Math.max(1.5, s * 0.1);
    g.beginPath();
    g.moveTo(-s * 0.32, -s * 0.12);
    g.lineTo(-s * 0.32, s * 0.12);
    g.moveTo(-s * 0.33, 0);
    g.lineTo(-s * 0.52, 0);
    g.stroke();
  } else if (k === 'hat') {
    // A tricorn, from above: three folded corners.
    g.fillStyle = 'rgb(28,22,18)';
    g.strokeStyle = 'rgba(180,150,90,0.8)';
    g.lineWidth = Math.max(1, s * 0.06);
    g.beginPath();
    g.moveTo(0, -s * 0.5);
    g.quadraticCurveTo(s * 0.18, -s * 0.05, s * 0.5, s * 0.32);
    g.quadraticCurveTo(0, s * 0.18, -s * 0.5, s * 0.32);
    g.quadraticCurveTo(-s * 0.18, -s * 0.05, 0, -s * 0.5);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = 'rgb(48,38,30)';
    g.beginPath();
    g.arc(0, s * 0.04, s * 0.2, 0, Math.PI * 2);
    g.fill();
  } else if (k === 'hook') {
    // A grapple: a shank and three flukes.
    g.strokeStyle = 'rgb(70,72,76)';
    g.lineWidth = Math.max(1.5, s * 0.14);
    g.beginPath();
    g.moveTo(-s * 0.5, 0);
    g.lineTo(s * 0.3, 0);
    for (const a of [-1, 0, 1]) {
      g.moveTo(s * 0.3, 0);
      g.quadraticCurveTo(s * 0.5, a * s * 0.25, s * 0.25, a * s * 0.45 + (a ? 0 : s * 0.001));
    }
    g.stroke();
  } else if (k === 'shard') {
    // A shard of a stack's plate flying apart.
    g.fillStyle = `rgba(${rgb},0.95)`;
    g.strokeStyle = 'rgb(201,164,90)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.3);
    g.lineTo(s * 0.5, -s * 0.36);
    g.lineTo(s * 0.2, s * 0.34);
    g.lineTo(-s * 0.45, s * 0.3);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

// ------------------------------------------------------------------ 7. the marks a fight leaves on a deck

export type DecalKind = 'soot' | 'splinter' | 'rum' | 'hat' | 'blade' | 'blood' | 'scorch';
/** A mark laid on a deck's painting (board px, its own seed): soot where powder burst, splinters where blows bit, rum
 *  from a stove barrel, a hat or a sabre dropped where men fell. Laid on the cached deck, so it costs nothing a frame. */
export function drawDecal(g: CanvasRenderingContext2D, k: DecalKind, x: number, y: number, w: number, seed: number): void {
  const r = (n: number) => rnd(seed * 7 + n);
  g.save();
  g.translate(x, y);
  g.rotate(r(1) * Math.PI * 2);
  if (k === 'soot' || k === 'scorch') {
    const R = w * (k === 'scorch' ? 0.5 : 0.36) * (0.8 + r(2) * 0.4);
    blob(g, '14,10,8', 0, 0, R, k === 'scorch' ? 0.75 : 0.55, 0.45);
    for (let j = 0; j < 5; j++) blob(g, '20,14,10', (r(3 + j) - 0.5) * R * 1.2, (r(9 + j) - 0.5) * R * 0.9, R * 0.35, 0.4, 0.3);
  } else if (k === 'rum') {
    g.fillStyle = 'rgba(122,58,18,0.42)';
    g.beginPath();
    g.ellipse(0, 0, w * 0.3 * (0.8 + r(2) * 0.4), w * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,90,30,0.3)';
    g.beginPath();
    g.ellipse(w * 0.18, w * 0.05, w * 0.12, w * 0.07, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,220,160,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(-w * 0.05, -w * 0.03, w * 0.14, w * 0.05, 0, Math.PI * 1.1, Math.PI * 1.7);
    g.stroke();
  } else if (k === 'blood') {
    g.fillStyle = 'rgba(70,8,6,0.45)';
    g.beginPath();
    g.ellipse(0, 0, w * 0.16 * (0.7 + r(2) * 0.5), w * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  } else if (k === 'splinter') {
    for (let j = 0; j < 5; j++) {
      g.save();
      g.translate((r(3 + j) - 0.5) * w * 0.5, (r(11 + j) - 0.5) * w * 0.3);
      g.rotate(r(20 + j) * Math.PI);
      drawThing(g, 'chip', w * (0.1 + r(30 + j) * 0.12), '186,150,104', );
      g.restore();
    }
  } else drawThing(g, k, w * (k === 'hat' ? 0.34 : 0.5), '');
  g.restore();
}

// ------------------------------------------------------------------ 8. the shots' trails

/** What a shot leaves behind it on the way (its kind's): a cannonball's smoke, a grenade's fuse sparks, a harpoon's
 *  rope, a rocket's fire, an arrow's streak, brine's drops. `pos(k)` its place at share k of its flight. */
export function trail(g: CanvasRenderingContext2D, id: string, k: number, pos: (k: number) => { x: number; y: number }, from: { x: number; y: number }, w: number, t: number, n: number): void {
  const p = pos(k);
  if (id === 'part.ms_harpoon' || id === 'part.ms_net') {
    // The line paid out behind it from the thrower, sagging.
    g.strokeStyle = 'rgba(214,196,150,0.85)';
    g.lineWidth = Math.max(1, w * 0.03);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.quadraticCurveTo((from.x + p.x) / 2, (from.y + p.y) / 2 + w * 0.25 * (1 - k * 0.6), p.x, p.y);
    g.stroke();
    return;
  }
  if (id === 'part.ms_arrow' || id === 'part.ms_dart' || id === 'part.ms_spear' || id === 'part.ms_knife') {
    const q = pos(Math.max(0, k - 0.12));
    const gr = g.createLinearGradient(q.x, q.y, p.x, p.y);
    gr.addColorStop(0, 'rgba(240,236,220,0)');
    gr.addColorStop(1, 'rgba(240,236,220,0.6)');
    g.strokeStyle = gr;
    g.lineWidth = Math.max(1, w * 0.03);
    g.beginPath();
    g.moveTo(q.x, q.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    return;
  }
  const fire = id === 'part.ms_rocket';
  const fuse = id === 'part.ms_grenade' || id === 'part.ms_smokebomb' || id === 'part.ms_flask';
  const wet = id === 'part.ms_brine' || id === 'part.ms_bell';
  for (let j = 1; j <= n; j++) {
    const kk = k - j * (fire ? 0.035 : 0.055);
    if (kk < 0) break;
    const q = pos(kk);
    const fade = 1 - j / (n + 1);
    if (fire) {
      g.globalCompositeOperation = 'lighter';
      blob(g, j < 3 ? '255,200,90' : '255,110,40', q.x, q.y, w * (0.12 + j * 0.02), fade * 0.8, 0.3);
      g.globalCompositeOperation = 'source-over';
      if (j > 2) blob(g, '120,116,110', q.x, q.y - j * 0.6, w * (0.1 + j * 0.03), fade * 0.35, 0.2);
    } else if (fuse) {
      g.globalCompositeOperation = 'lighter';
      const jx = (rnd(j * 13 + Math.floor(t / 40)) - 0.5) * w * 0.12, jy = (rnd(j * 7 + Math.floor(t / 40)) - 0.5) * w * 0.12;
      g.fillStyle = `rgba(255,${180 + j * 10},90,${fade.toFixed(3)})`;
      g.fillRect(q.x + jx - 1, q.y + jy - 1, 2, 2);
      g.globalCompositeOperation = 'source-over';
    } else if (wet) {
      g.fillStyle = `rgba(150,215,230,${(fade * 0.7).toFixed(3)})`;
      g.beginPath();
      g.arc(q.x, q.y + j * 1.5, Math.max(1, w * 0.035), 0, Math.PI * 2);
      g.fill();
    } else blob(g, '150,146,140', q.x, q.y, w * (0.07 + j * 0.025), fade * 0.42, 0.2);
  }
  if (fuse) {
    // The fuse's own spark at the shell.
    g.globalCompositeOperation = 'lighter';
    blob(g, '255,200,110', p.x, p.y - w * 0.08, w * 0.12 * (0.8 + 0.4 * Math.sin(t / 30)), 0.9, 0.2);
    g.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------------ 16. the weather over the field

/** Rain over the field: `n` streaks falling slant with the wind (the same streaks each frame, moving), drawn as one
 *  path. */
export function rain(g: CanvasRenderingContext2D, sky: Sky, t: number, cw: number, ch: number, n: number): void {
  const count = Math.round(n * sky.rain);
  if (!count) return;
  const fall = 900, drift = sky.wx * 260 * sky.wk;
  const len = 14 + 10 * sky.rain;
  const s = t / 1000;
  g.strokeStyle = `rgba(190,210,225,${(0.22 + 0.18 * sky.rain).toFixed(3)})`;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const sp = 0.8 + rnd(i * 3 + 1) * 0.4;
    const x0 = rnd(i * 3 + 2) * (cw + 200) - 100;
    const y = ((rnd(i * 3 + 3) * (ch + 60) + s * fall * sp) % (ch + 60)) - 30;
    const x = (((x0 + s * drift * sp) % (cw + 200)) + cw + 200) % (cw + 200) - 100;
    const dx = (drift / fall) * len;
    g.moveTo(x, y);
    g.lineTo(x - dx, y - len);
  }
  g.stroke();
}
/** The drops landing on the decks: small rings, `n` of them at once (board px, laid over the decks' boxes). */
export function rainRings(g: CanvasRenderingContext2D, sky: Sky, t: number, boxes: { x0: number; y0: number; x1: number; y1: number }[], n: number): void {
  const count = Math.round(n * sky.rain);
  if (!count || !boxes.length) return;
  g.strokeStyle = 'rgba(200,220,235,0.35)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const period = 700 + rnd(i * 5 + 1) * 500;
    const cyc = Math.floor((t + rnd(i) * period) / period);
    const k = ((t + rnd(i) * period) % period) / period;
    const b = boxes[(i + cyc) % boxes.length];
    const x = b.x0 + rnd(i * 31 + cyc * 7) * (b.x1 - b.x0), y = b.y0 + rnd(i * 17 + cyc * 3) * (b.y1 - b.y0);
    const r = 1.5 + k * 6;
    g.moveTo(x + r, y);
    g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  }
  g.stroke();
}
/** The boards wet in the rain: a sheen of the sky sliding slowly over them (board px, over the decks' boxes). */
export function wetSheen(g: CanvasRenderingContext2D, sky: Sky, t: number, boxes: { x0: number; y0: number; x1: number; y1: number }[]): void {
  if (!sky.rain) return;
  g.globalCompositeOperation = 'lighter';
  for (const [i, b] of boxes.entries()) {
    const span = b.x1 - b.x0 + (b.y1 - b.y0);
    const k = ((t / 9000 + i * 0.37) % 1) * 1.4 - 0.2;
    const cx = b.x0 + k * span * 0.7, cy = b.y0 + k * span * 0.5;
    g.save();
    g.beginPath();
    g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    g.clip();
    blob(g, '170,200,230', cx, cy, span * 0.35, 0.09 * sky.rain + 0.03 * sky.night, 0.1);
    g.restore();
  }
  g.globalCompositeOperation = 'source-over';
}
/** Fog lying in banks over the field, drifting with the wind: two or three great soft clouds, and a veil. */
export function fog(g: CanvasRenderingContext2D, sky: Sky, t: number, cw: number, ch: number, banks: number, level = sky.fog): void {
  if (!(level > 0.02)) return;
  g.fillStyle = `rgba(150,160,165,${(0.1 * level).toFixed(3)})`;
  g.fillRect(0, 0, cw, ch);
  const s = t / 1000;
  for (let i = 0; i < banks; i++) {
    const R = Math.max(cw, ch) * (0.45 + 0.15 * i);
    const span = cw + R * 2;
    const x = ((((rnd(i + 4) * span + s * (14 + 9 * i) * (sky.wx >= 0 ? 1 : -1)) % span) + span) % span) - R;
    const y = ch * (0.25 + 0.3 * i) + Math.sin(s * 0.2 + i) * ch * 0.05;
    blob(g, '170,178,182', x, y, R, 0.42 * level, 0.15);
  }
}
/** The night over the field: dark, cold light; a moon at the top corner with its halo (none in rain: clouds). */
export function night(g: CanvasRenderingContext2D, sky: Sky, cw: number, ch: number, moon: boolean): void {
  if (!(sky.night > 0.05)) return;
  g.fillStyle = `rgba(6,12,32,${(0.38 * sky.night).toFixed(3)})`;
  g.fillRect(0, 0, cw, ch);
  if (!moon || sky.rain > 0.5 || sky.night < 0.45) return;
  const x = cw * 0.86, y = ch * 0.12, r = Math.max(8, Math.min(cw, ch) * 0.035);
  g.globalCompositeOperation = 'lighter';
  blob(g, '150,175,220', x, y, r * 7, 0.25 * sky.night, 0.1);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgba(232,236,222,${(0.9 * sky.night).toFixed(3)})`;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(190,196,186,${(0.5 * sky.night).toFixed(3)})`;
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
  g.arc(x + r * 0.25, y + r * 0.3, r * 0.15, 0, Math.PI * 2);
  g.fill();
}
/** A lantern hung at (x, y) on its hook, swung by `a` (rad): its light on the deck by night (and a little by day). */
export function lantern(g: CanvasRenderingContext2D, x: number, y: number, w: number, a: number, nightK: number): void {
  const len = w * 0.28;
  const lx = x + Math.sin(a) * len, ly = y + Math.cos(a) * len;
  g.strokeStyle = 'rgba(20,14,8,0.9)';
  g.lineWidth = Math.max(1, w * 0.025);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(lx, ly);
  g.stroke();
  if (nightK > 0.02) {
    g.globalCompositeOperation = 'lighter';
    blob(g, '255,170,80', lx, ly + w * 0.06, w * (0.5 + 0.9 * nightK), 0.18 + 0.5 * nightK, 0.25);
    g.globalCompositeOperation = 'source-over';
  }
  const s = w * 0.09;
  g.fillStyle = 'rgb(40,30,20)';
  g.fillRect(lx - s * 0.6, ly, s * 1.2, s * 0.25);
  g.fillStyle = `rgba(255,${200 - Math.round(40 * nightK)},110,0.95)`;
  g.fillRect(lx - s * 0.45, ly + s * 0.25, s * 0.9, s * 1.1);
  g.fillStyle = 'rgb(40,30,20)';
  g.fillRect(lx - s * 0.6, ly + s * 1.35, s * 1.2, s * 0.25);
}
/** A pennant at a mast's head (x, y), in its side's colour, stirring in the wind; `down` 0–1 how far it is struck down
 *  the mast (`drop` px all the way); white when the colours are struck (the finale). */
export function pennant(g: CanvasRenderingContext2D, x: number, y: number, w: number, rgb: string, t: number, wave: number, down: number, drop: number, dir: number): void {
  const yy = y + down * drop;
  const len = w * 0.55, h = w * 0.26;
  const wv = Math.sin(t / 300 + x * 0.02) * wave;
  g.fillStyle = `rgb(${rgb})`;
  g.strokeStyle = 'rgba(10,8,6,0.85)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, yy);
  g.quadraticCurveTo(x + dir * len * 0.5, yy + wv * h * 0.3, x + dir * len, yy + h * 0.5 + wv * h * 0.2);
  g.quadraticCurveTo(x + dir * len * 0.5, yy + h + wv * h * 0.3, x, yy + h);
  g.closePath();
  g.fill();
  g.stroke();
}
/** The rigging in the foreground (17: depth): ropes hanging in from the screen's top corners, swaying more than the decks
 *  do — they are nearer. Desk only. */
export function rigging(g: CanvasRenderingContext2D, t: number, cw: number, ch: number, dx: number, dy: number): void {
  const s = t / 1000;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -10 : cw + 10;
    const sw = Math.sin(s * 0.9 + side) * 10 + dx * 2.5;
    // A heavy shroud and a lighter line beside it, a ratline or two across.
    for (const [k, wdt, col] of [[0, 7, 'rgba(26,18,10,0.82)'], [1, 3, 'rgba(70,52,32,0.75)']] as const) {
      const ex = side < 0 ? cw * (0.07 + 0.03 * k) : cw * (0.93 - 0.03 * k);
      g.strokeStyle = col;
      g.lineWidth = wdt;
      g.beginPath();
      g.moveTo(x0, -10);
      g.quadraticCurveTo((x0 + ex) / 2 + sw, ch * 0.18 + dy * 2, ex + sw * 0.6, ch * (0.38 + 0.06 * k) + dy * 3);
      g.stroke();
    }
    g.strokeStyle = 'rgba(40,28,16,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    for (const k of [0.25, 0.5]) {
      const ex0 = side < 0 ? cw * 0.07 * k : cw - cw * 0.07 * k;
      const ex1 = side < 0 ? cw * 0.1 * k : cw - cw * 0.1 * k;
      g.moveTo(ex0 + sw * k, ch * 0.38 * k);
      g.lineTo(ex1 + sw * k, ch * 0.44 * k);
    }
    g.stroke();
  }
}

// ------------------------------------------------------------------ 12. the ultimate's film frame

/** The edges dark, a band across the field with the captain's face and her move's name (a film's frame). `k` 0–1 of
 *  the ultimate; `face` her portrait (or none), `rgb` her path's colour. */
export function ultFrame(g: CanvasRenderingContext2D, k: number, cw: number, ch: number, face: HTMLImageElement | null, name: string, rgb: [number, number, number], mine: boolean, w: number): void {
  const fade = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
  if (!(fade > 0)) return;
  // The vignette: the edges dark.
  const R = Math.hypot(cw, ch) / 2;
  const vg = g.createRadialGradient(cw / 2, ch / 2, R * 0.45, cw / 2, ch / 2, R);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${(0.62 * fade).toFixed(3)})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, cw, ch);
  // The letterbox bars.
  const bar = ch * 0.07 * fade;
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.fillRect(0, 0, cw, bar);
  g.fillRect(0, ch - bar, cw, bar);
  // The band: slid in from her side, across the upper third.
  const bh = Math.max(34, Math.min(ch * 0.15, w * 1.5));
  const slide = k < 0.15 ? 1 - (1 - k / 0.15) ** 3 : 1;
  const by = ch * 0.3 - bh / 2;
  const bx = (mine ? -1 : 1) * cw * (1 - slide);
  const [r, gg, b] = rgb;
  const band = g.createLinearGradient(0, 0, cw, 0);
  band.addColorStop(0, `rgba(${r},${gg},${b},0)`);
  band.addColorStop(0.2, `rgba(10,8,6,${(0.82 * fade).toFixed(3)})`);
  band.addColorStop(0.8, `rgba(10,8,6,${(0.82 * fade).toFixed(3)})`);
  band.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.save();
  g.translate(bx, 0);
  g.fillStyle = band;
  g.fillRect(0, by, cw, bh);
  g.fillStyle = `rgba(${r},${gg},${b},${(0.9 * fade).toFixed(3)})`;
  g.fillRect(cw * 0.12, by, cw * 0.76, 2);
  g.fillRect(cw * 0.12, by + bh - 2, cw * 0.76, 2);
  // Her face in a ring at the band's near end.
  const fr = bh * 0.62;
  const fx = mine ? cw * 0.27 : cw * 0.73, fy = by + bh / 2;
  g.globalAlpha = fade;
  if (face) {
    g.save();
    g.beginPath();
    g.arc(fx, fy, fr, 0, Math.PI * 2);
    g.clip();
    const s = (fr * 2.3) / Math.min(face.naturalWidth, face.naturalHeight);
    g.drawImage(face, fx - (face.naturalWidth * s) / 2, fy - fr * 1.05, face.naturalWidth * s, face.naturalHeight * s);
    g.restore();
  }
  g.strokeStyle = `rgb(${r},${gg},${b})`;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(fx, fy, fr, 0, Math.PI * 2);
  g.stroke();
  // The move's name beside it.
  g.font = `700 ${Math.round(Math.max(16, bh * 0.42))}px Cormorant Garamond, Georgia, serif`;
  g.textAlign = mine ? 'left' : 'right';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.9)';
  const tx = mine ? fx + fr + 12 : fx - fr - 12;
  g.strokeText(name, tx, fy);
  g.fillStyle = `rgb(${Math.min(255, r + 40)},${Math.min(255, gg + 40)},${Math.min(255, b + 40)})`;
  g.fillText(name, tx, fy);
  g.globalAlpha = 1;
  g.restore();
}
