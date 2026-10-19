// The cosmetics drawn by code (docs/32 §12, shared/src/data/cosmetics.ts): the title on its plate, the flag at the
// masthead (the emblem tinted on its cloth, waving), the trail behind a ship (a pooled particle wake), an emote over a
// ship. The sea's renderer and the shop's previews draw with the same functions, so what she buys is what is seen.
//
// Cheap by design (owner: 30 ships on screen and no frame lost):
//  - a plate with its words is drawn once into a small canvas (per plate, words and pixel ratio) and blitted after;
//  - a flag's cloth is drawn once per emblem and colour, then waved as a few vertical strips;
//  - the trails share one pool of TRAIL_MAX motes (a ring: the oldest is reused), each ship emits only while on screen,
//    near enough and under way, at most TRAIL_SHIPS ships at once, the nearest first; a mote is one drawImage of a
//    pre-drawn soft dot.

import { CLOTHS, PLATES, TRAILS, clothOf, plateOf, trailOf } from '../../../shared/src/data/cosmetics.ts';
import type { ClothDef, PlateDef, TrailDef } from '../../../shared/src/data/cosmetics.ts';
import { sprite } from '../assets.ts';

const FONT = '"Cormorant Garamond", Georgia, serif';

// ------------------------------------------------------------------------------------------------ the plate

/** The plate's height on screen (CSS px) at its smallest; it grows (keeping its shape) only for long words. */
export const PLATE_H = 30;
const PLATE_MAX_W = 176;
const plates = new Map<string, HTMLCanvasElement>();

function fontsIn(): boolean {
  const f = (document as Document & { fonts?: FontFaceSet }).fonts;
  return !f || f.status === 'loaded';
}

/** The plate with its words, drawn once (null while its picture is not in). Its size in CSS px is the canvas's over
 *  `dpr`. */
export function plateCanvas(plateId: string, words: string, dpr: number, h = PLATE_H): HTMLCanvasElement | null {
  const p = plateOf(plateId);
  if (!p) return null;
  const spr = sprite(`cos.plate_${p.id}`);
  if (!spr) return null;
  const k = Math.max(1, Math.min(3, Math.round(dpr * 2) / 2));
  const key = `${p.id}|${words}|${k}|${h}`;
  const hit = plates.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const iw = spr.img.naturalWidth || 512, ih = spr.img.naturalHeight || 144;
  let H = h;
  let W = (H * iw) / ih;
  let fs = Math.round(H * 0.44);
  g.font = `700 ${fs}px ${FONT}`;
  let tw = g.measureText(words).width;
  const room = () => (p.span[1] - p.span[0]) * W;
  while (tw > room() && fs > Math.round(H * 0.36)) {
    fs -= 0.5;
    g.font = `700 ${fs}px ${FONT}`;
    tw = g.measureText(words).width;
  }
  if (tw > room()) {
    W = Math.min(PLATE_MAX_W, tw / (p.span[1] - p.span[0]) + 2);
    H = (W * ih) / iw;
  }
  c.width = Math.ceil(W * k);
  c.height = Math.ceil(H * k);
  g.scale(k, k);
  g.imageSmoothingQuality = 'high';
  g.drawImage(spr.img, 0, 0, W, H);
  g.font = `700 ${fs}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // (the words never past the plate's calm middle: squeezed a hair if still too long)
  const cx = ((p.span[0] + p.span[1]) / 2) * W, cy = H * 0.52;
  const maxW = room();
  g.lineJoin = 'round';
  g.strokeStyle = p.halo;
  g.lineWidth = Math.max(2, fs * 0.22);
  g.strokeText(words, cx, cy, maxW);
  g.fillStyle = p.ink;
  g.fillText(words, cx, cy, maxW);
  if (fontsIn()) {
    if (plates.size > 160) plates.clear();
    plates.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------------------------------------ the flag

const cloths = new Map<string, HTMLCanvasElement>();
const FLAG_W = 96, FLAG_H = 64;

/** The emblem in the cloth's ink (its silhouette), or null while not in. */
export function tintedEmblem(emblemId: string, ink: string): HTMLCanvasElement | null {
  const key = `e|${emblemId}|${ink}`;
  const hit = cloths.get(key);
  if (hit) return hit;
  const spr = sprite(`cos.emblem_${emblemId}`);
  if (!spr) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  g.drawImage(spr.img, 0, 0, 96, 96);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = ink;
  g.fillRect(0, 0, 96, 96);
  cloths.set(key, c);
  return c;
}

/** The flag's cloth with its emblem, flat (null while the emblem is not in). */
export function flagCloth(emblemId: string, clothId: string): HTMLCanvasElement | null {
  const cl = clothOf(clothId) ?? CLOTHS[0];
  const key = `f|${emblemId}|${cl.id}`;
  const hit = cloths.get(key);
  if (hit) return hit;
  const em = tintedEmblem(emblemId, cl.ink);
  if (!em) return null;
  const c = document.createElement('canvas');
  c.width = FLAG_W;
  c.height = FLAG_H;
  const g = c.getContext('2d')!;
  // a swallow-tailed cloth: the hoist straight, the fly cut in
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(FLAG_W, 0);
  g.lineTo(FLAG_W * 0.84, FLAG_H / 2);
  g.lineTo(FLAG_W, FLAG_H);
  g.lineTo(0, FLAG_H);
  g.closePath();
  g.fillStyle = cl.rgb;
  g.fill();
  const shade = g.createLinearGradient(0, 0, 0, FLAG_H);
  shade.addColorStop(0, 'rgba(255,255,255,0.12)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = shade;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 6, FLAG_H); // the hoist's hem
  const s = FLAG_H * 0.82;
  g.drawImage(em, FLAG_W * 0.43 - s / 2, FLAG_H / 2 - s / 2, s, s);
  cloths.set(key, c);
  return c;
}

/** The flag waving at (0, 0) — its hoist on the staff, its fly along +x — `w` by `h`, in `strips` vertical strips. */
export function drawWavingFlag(g: CanvasRenderingContext2D, cloth: HTMLCanvasElement, w: number, h: number, t: number, seed: number, strips = 6): void {
  const sw = cloth.width / strips;
  const dw = w / strips;
  for (let i = 0; i < strips; i++) {
    const k = (i + 0.5) / strips;
    const ph = t * 5.5 + seed - i * 0.9;
    const dy = Math.sin(ph) * h * 0.09 * k;
    const sq = 1 - 0.08 * k * (0.5 + 0.5 * Math.cos(ph));
    g.drawImage(cloth, i * sw, 0, sw + 0.6, cloth.height, i * dw - 0.2, -h / 2 + dy + (h * (1 - sq)) / 2, dw + 0.6, h * sq);
  }
}

// ------------------------------------------------------------------------------------------------ the trails

/** The pool's motes, every ship's together; the ships that may emit at once; a ship's motes a second at full speed. */
export const TRAIL_MAX = 720;
export const TRAIL_SHIPS = 16;
const RATE = 16;

const dots = new Map<string, HTMLCanvasElement>();

function dotOf(t: TrailDef): HTMLCanvasElement {
  let c = dots.get(t.id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, t.c[0]);
  gr.addColorStop(0.35, t.c[1]);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  dots.set(t.id, c);
  return c;
}

const KINDS: TrailDef[] = TRAILS;

/** One pool of motes for the whole sea. */
export class TrailPool {
  readonly x = new Float32Array(TRAIL_MAX);
  readonly y = new Float32Array(TRAIL_MAX);
  readonly vx = new Float32Array(TRAIL_MAX);
  readonly vy = new Float32Array(TRAIL_MAX);
  readonly age = new Float32Array(TRAIL_MAX);
  readonly life = new Float32Array(TRAIL_MAX);
  readonly size = new Float32Array(TRAIL_MAX);
  readonly kind = new Uint8Array(TRAIL_MAX); // 0: none, else 1 + the trail's index
  private next = 0;
  private debt = new Map<number, number>();
  /** Motes alive now (the measure's count). */
  live = 0;

  /** A ship under way leaves its trail behind her stern (`spdK` her share of full speed, `beam` and `len` in world
   *  units). */
  emit(id: number, trailId: string, x: number, y: number, h: number, spdK: number, len: number, beam: number, dt: number, low: boolean): void {
    const t = trailOf(trailId);
    if (!t || spdK < 0.08) return;
    const ki = KINDS.indexOf(t) + 1;
    let d = (this.debt.get(id) ?? 0) + RATE * Math.min(1.2, 0.35 + spdK) * dt * (low ? 0.5 : 1);
    const bx = -Math.sin(h), by = Math.cos(h); // astern (heading 0 = north, the bow up)
    while (d >= 1) {
      d -= 1;
      const i = this.next;
      this.next = (this.next + 1) % TRAIL_MAX;
      const side = (Math.random() - 0.5) * beam * 0.7;
      const back = len * (0.42 + Math.random() * 0.1);
      this.x[i] = x + bx * back + by * side;
      this.y[i] = y + by * back - bx * side;
      const drift = 2 + Math.random() * 3;
      this.vx[i] = bx * drift + (Math.random() - 0.5) * 3;
      this.vy[i] = by * drift + (Math.random() - 0.5) * 3 - t.rise * 4;
      this.age[i] = 0;
      this.life[i] = t.life * (0.7 + Math.random() * 0.6);
      this.size[i] = t.size * (0.7 + Math.random() * 0.6);
      this.kind[i] = ki;
    }
    this.debt.set(id, d);
  }

  forget(id: number): void {
    this.debt.delete(id);
  }

  step(dt: number): void {
    let n = 0;
    for (let i = 0; i < TRAIL_MAX; i++) {
      if (!this.kind[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kind[i] = 0;
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.vx[i] *= 0.97;
      this.vy[i] *= 0.97;
      n++;
    }
    this.live = n;
  }

  /** Every mote on the canvas (`sx`, `sy` world → screen; `k` px a world unit; `w`, `h` the screen). */
  draw(g: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, k: number, w: number, h: number): void {
    if (!this.live) return;
    g.save();
    for (let kk = 0; kk < KINDS.length; kk++) {
      const t = KINDS[kk];
      const ki = kk + 1;
      let any = false;
      for (let i = 0; i < TRAIL_MAX; i++) {
        if (this.kind[i] !== ki) continue;
        if (!any) {
          any = true;
          g.globalCompositeOperation = t.glow ? 'lighter' : 'source-over';
        }
        const a = this.age[i] / this.life[i];
        const r = this.size[i] * k * (t.id === 'mist' || t.id === 'ink' ? 0.6 + a * 1.6 : t.id === 'fire' ? 1.1 - a * 0.7 : 1) + 0.6;
        const px = sx(this.x[i]), py = sy(this.y[i]);
        if (px < -r || py < -r || px > w + r || py > h + r) continue;
        g.globalAlpha = (1 - a) * (a < 0.12 ? a / 0.12 : 1) * (t.glow ? 0.85 : 0.55);
        g.drawImage(dotOf(t), px - r, py - r, r * 2, r * 2);
      }
    }
    g.restore();
  }
}

// ------------------------------------------------------------------------------------------------ emotes over ships

/** An emote over a ship: its picture from the sheet, up for EMOTE_SHOW_S seconds. */
export interface ShipEmote {
  ship: number;
  e: string;
  at: number;
}

/** The emote's scale and alpha at `age` of `show` seconds: it pops in, bobs, fades out. */
export function emoteLook(age: number, show: number): { s: number; a: number; dy: number } {
  const pop = age < 0.18 ? 0.6 + (age / 0.18) * 0.5 : age < 0.3 ? 1.1 - ((age - 0.18) / 0.12) * 0.1 : 1;
  const a = age > show - 0.4 ? Math.max(0, (show - age) / 0.4) : 1;
  return { s: pop, a, dy: Math.sin(age * 4) * 2 };
}

export { PLATES, CLOTHS };
export type { PlateDef, ClothDef };
