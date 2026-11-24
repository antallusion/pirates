// docs/40 §2: the Blighted Sea on the screen. The fel water is a screen-wide override of the sea's tint and grade, eased
// in over a second and a half at the rim and keyed by `state.self.blight.inside` — not a GRADES entry: the shader's own
// `tint` and `grade` uniforms and the lighting's one wash are blended toward a sickly luminous green with a slow pulse.
// From outside: a faint green ring and haze at the rim. On the minimap and the charts: a green disc with its name.
// And the zone's own things: the Raft with its green lamps, the green casks, the hunters' and the Heart's green light,
// the Chosen's mark, the mooring's ring. A captain whose view is null is drawn nothing at all.
//
// The frames matter (render/seaguard.ts): nothing here allocates per frame — the glow is one sprite made once, the
// blends write into arrays kept for it, the words are measured by the canvas as they are.

import type { BlightView } from '../../../shared/src/blightproto.ts';
import { BLIGHT_NAME, RAFT_MOOR_SECS, RAFT_NAME, RAFT_REACH } from '../../../shared/src/data/blight.ts';
import { lang } from '../i18n.ts';
import { sprite } from '../assets.ts';

type G = CanvasRenderingContext2D;

/** The ease at the rim, seconds. */
export const FEL_EASE_S = 1.5;
/** The fel water's tint and grade at the bottom and the top of the pulse (the shader: base × (0.55 + tint × 6) × grade). */
const FEL_TINT: readonly [number, number, number] = [0.012, 0.13, 0.04];
const FEL_GRADE_LO: readonly [number, number, number] = [0.46, 1.0, 0.52];
const FEL_GRADE_HI: readonly [number, number, number] = [0.54, 1.2, 0.6];
/** The wash over the world (soft light) inside: its colour and strength. */
const FEL_WASH: readonly [number, number, number] = [70, 255, 120];
const FEL_WASH_A = 0.15;
/** The mist inside. */
const FEL_FOG: readonly [number, number, number] = [0.5, 1.25, 0.62];
/** The lanterns' colour inside. */
export const FEL_LAMP = '#7dff8a';

const fel = { lin: 0, mix: 0, pulse: 0.5 };
const tintOut: [number, number, number] = [0, 0, 0];
const gradeOut: [number, number, number] = [1, 1, 1];
const fogOut: [number, number, number] = [1, 1, 1];
let cssKey = -1, cssBase = '', cssOut = '';
let washKey = -1, washOut = '';

/** Each frame: the fel water eased toward on or off — by the wall's clock (`now`, ms: the game's own step is capped,
 *  and on a slow device the rim would take many seconds); `time` 0 stills the pulse («меньше движения»). */
let felAt = 0;
export function stepFel(inside: boolean, now: number, time: number): number {
  const step = (felAt ? Math.min(0.4, Math.max(0, (now - felAt) / 1000)) : 0) / FEL_EASE_S;
  felAt = now;
  fel.lin = Math.min(1, Math.max(0, fel.lin + (inside ? step : -step)));
  fel.mix = fel.lin * fel.lin * (3 - 2 * fel.lin);
  fel.pulse = 0.5 + 0.5 * Math.sin(time * 0.9);
  return fel.mix;
}

/** How much of the fel water is on (0…1). */
export const felMix = (): number => fel.mix;

/** The sea's tint under the fel water (the shader's `tint`, 0…1). Writes into its own array. */
export function felTint(base: readonly [number, number, number]): [number, number, number] {
  const m = fel.mix;
  for (let i = 0; i < 3; i++) tintOut[i] = base[i] + (FEL_TINT[i] - base[i]) * m;
  return tintOut;
}

/** The sea's grade under the fel water (the shader's `grade`), with its slow pulse. */
export function felGrade(base: readonly [number, number, number]): [number, number, number] {
  const m = fel.mix, p = fel.pulse;
  for (let i = 0; i < 3; i++) gradeOut[i] = base[i] + (FEL_GRADE_LO[i] + (FEL_GRADE_HI[i] - FEL_GRADE_LO[i]) * p - base[i]) * m;
  return gradeOut;
}

/** The mist's colour multiply under the fel water (the sky shader's `fogTint`). */
export function felFog(): [number, number, number] {
  const m = fel.mix;
  for (let i = 0; i < 3; i++) fogOut[i] = 1 + (FEL_FOG[i] - 1) * m;
  return fogOut;
}

/** The canvas sea (no WebGL): the region's tint as a colour, turned green by the same measure. A new string only when
 *  the look has moved a step (64 steps of the ease and the pulse). */
export function felTintCss(base: string): string {
  const m = fel.mix;
  if (m <= 0) return base;
  const key = Math.round(m * 64) * 100 + Math.round(fel.pulse * 16);
  if (key !== cssKey || base !== cssBase) {
    cssKey = key;
    cssBase = base;
    const n = parseInt(base.replace('#', ''), 16);
    const p = 0.8 + 0.2 * fel.pulse;
    const r = ((n >> 16) & 255) + (16 * p - ((n >> 16) & 255)) * m, gg = ((n >> 8) & 255) + (104 * p - ((n >> 8) & 255)) * m, b = (n & 255) + (46 * p - (n & 255)) * m;
    cssOut = `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(b)})`;
  }
  return cssOut;
}

/** The lighting's wash (renderer.ts drawLighting — the composite is soft light already): the sea's own grade wash turned
 *  to the fel green. One rect, in place of the region's, never a second pass. Returns false when there is none to draw. */
export function felWash(g: G, w: number, h: number, wash: readonly [number, number, number], a: number): boolean {
  const m = fel.mix;
  const aa = a + (FEL_WASH_A * (0.8 + 0.2 * fel.pulse) - a) * m;
  if (aa <= 0) return false;
  const key = Math.round(m * 64) * 100 + Math.round(fel.pulse * 16) + wash[0] * 1e6 + a * 1e4;
  if (key !== washKey) {
    washKey = key;
    washOut = `rgba(${Math.round(wash[0] + (FEL_WASH[0] - wash[0]) * m)},${Math.round(wash[1] + (FEL_WASH[1] - wash[1]) * m)},${Math.round(wash[2] + (FEL_WASH[2] - wash[2]) * m)},${aa.toFixed(3)})`;
  }
  g.fillStyle = washOut;
  g.fillRect(0, 0, w, h);
  return true;
}

// ------------------------------------------------------------------------------------------------ the zone's things

/** One soft green light, made once: every glow of the zone is this sprite drawn at a size. */
let glowCv: HTMLCanvasElement | null = null;
function glowSprite(): HTMLCanvasElement {
  if (glowCv) return glowCv;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(150,255,160,0.95)');
  grd.addColorStop(0.35, 'rgba(90,240,120,0.42)');
  grd.addColorStop(1, 'rgba(60,220,100,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return (glowCv = c);
}

function glow(g: G, x: number, y: number, r: number, a: number): void {
  if (a <= 0 || r <= 0) return;
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * Math.min(1, a);
  g.drawImage(glowSprite(), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = a0;
}

function art(g: G, id: string, x: number, y: number, size: number, rot: number, alpha: number): boolean {
  const spr = sprite(id);
  if (!spr) return false;
  const iw = spr.img.naturalWidth, ih = spr.img.naturalHeight;
  const k = size / Math.max(iw, ih);
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  if (rot) {
    g.translate(x, y);
    g.rotate(rot);
    g.drawImage(spr.img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k);
    g.rotate(-rot);
    g.translate(-x, -y);
  } else g.drawImage(spr.img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
  g.globalAlpha = a0;
  return true;
}

function words(g: G, t: string, x: number, y: number, color: string): void {
  g.textAlign = 'center';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.78)';
  g.strokeText(t, x, y);
  g.fillStyle = color;
  g.fillText(t, x, y);
}

export interface BlightCtx {
  /** The camera (world metres), the scale (px a metre) and the screen. */
  camX: number;
  camY: number;
  zoom: number;
  w: number;
  h: number;
  /** The clock of the motion (0: «меньше движения»). */
  time: number;
}

/** A ship as the zone's light needs her. */
interface Lit { id: number; x: number; y: number }

/** The Raft's size on the sea, metres (the tavern raft's own painting, a little larger than a waystation's). */
const RAFT_SIZE = 78;

/** Under the hulls: the rim's ring and haze, the Raft with its green lamps and its reach, the casks, the light under
 *  the hunters and the Heart. */
export function drawBlightUnder(g: G, v: BlightView, ships: readonly Lit[], c: BlightCtx): void {
  const z = c.zoom, t = c.time;
  const hx = c.w / 2, hy = c.h / 2;
  const reachM = Math.hypot(hx, hy) / z;
  const dz = Math.hypot(c.camX - v.zone.x, c.camY - v.zone.y);
  // The rim: a wide faint haze, a narrower one, and the line itself — only where the rim crosses the screen.
  if (Math.abs(dz - v.zone.r) < reachM + 320) {
    const cx = (v.zone.x - c.camX) * z + hx, cy = (v.zone.y - c.camY) * z + hy, r = v.zone.r * z;
    const p = 0.75 + 0.25 * Math.sin(t * 0.9);
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    // (the haze: the same ring stroked ever narrower, each pass faint — a soft fall-off with no edge to it)
    g.strokeStyle = 'rgba(80,240,125,0.024)';
    for (let i = 0; i < HAZE.length; i++) {
      g.lineWidth = HAZE[i] * z;
      g.stroke();
    }
    g.strokeStyle = `rgba(140,255,160,${(0.34 * p).toFixed(2)})`;
    g.lineWidth = Math.max(1.5, 5 * z);
    g.stroke();
  }
  // The Raft.
  const rx = (v.raft.x - c.camX) * z + hx, ry = (v.raft.y - c.camY) * z + hy;
  const S = RAFT_SIZE * z;
  if (rx > -S * 3 && ry > -S * 3 && rx < c.w + S * 3 && ry < c.h + S * 3) {
    const bob = Math.sin(t * 0.8) * 0.02;
    g.globalCompositeOperation = 'lighter';
    glow(g, rx, ry, S * 1.5, 0.3 + 0.08 * Math.sin(t * 1.7));
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(3,8,11,0.34)';
    g.beginPath();
    g.ellipse(rx + S * 0.03, ry + S * 0.05, S * 0.46, S * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    if (!art(g, 'prop.way_tavern', rx, ry, S * 1.2, 0.35 + bob, 1)) {
      g.fillStyle = '#3d2c1c';
      g.fillRect(rx - S * 0.4, ry - S * 0.28, S * 0.8, S * 0.56);
    }
    // its lamps gone green: four on the raft's corners, breathing out of step
    for (let i = 0; i < 4; i++) {
      const a = 0.35 + i * (Math.PI / 2) + 0.6;
      const lx = rx + Math.cos(a) * S * 0.5, ly = ry + Math.sin(a) * S * 0.44;
      art(g, 'prop.bd_ghost_lamp', lx, ly, S * 0.2, 0, 0.95);
      g.globalCompositeOperation = 'lighter';
      glow(g, lx, ly, S * 0.34, 0.55 + 0.2 * Math.sin(t * 2.3 + i * 1.9));
      g.globalCompositeOperation = 'source-over';
    }
    // its reach, while she is not made fast
    if (v.inside && !v.moored) {
      g.strokeStyle = v.atRaft ? 'rgba(170,255,180,0.6)' : 'rgba(120,235,150,0.28)';
      g.lineWidth = 1.5;
      g.setLineDash(DASH);
      g.beginPath();
      g.arc(rx, ry, RAFT_REACH * z, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash(NO_DASH);
    }
    if (z > 0.45) {
      g.font = 'italic 600 13px "Cormorant Garamond", Georgia, serif';
      words(g, RAFT_NAME[lang() === 'ru' ? 1 : 0], rx, ry - S * 0.78, 'rgba(190,255,196,0.96)');
    }
  }
  // The green casks afloat.
  for (let i = 0; i < v.casks.length; i++) {
    const k = v.casks[i];
    const x = (k[0] - c.camX) * z + hx, y = (k[1] - c.camY) * z + hy;
    if (x < -60 || y < -60 || x > c.w + 60 || y > c.h + 60) continue;
    const s = Math.max(16, 22 * z);
    g.globalCompositeOperation = 'lighter';
    glow(g, x, y, s * 1.5, 0.6 + 0.2 * Math.sin(t * 2.1 + i));
    g.globalCompositeOperation = 'source-over';
    if (!art(g, 'prop.bt_barrels', x, y + Math.sin(t * 1.4 + i) * 1.5, s, Math.sin(t * 0.7 + i) * 0.12, 1)) {
      g.fillStyle = '#3f6a3a';
      g.beginPath();
      g.arc(x, y, s * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    glow(g, x, y, s * 0.7, 0.35); // (the cask's own wood greened)
    g.globalCompositeOperation = 'source-over';
  }
  // The light under the hunters and the Heart (her veins turning slowly under her).
  const heart = v.heart && 'id' in v.heart ? v.heart : null;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    const isHeart = heart !== null && s.id === heart.id;
    if (!isHeart && v.hunters.indexOf(s.id) < 0) continue;
    const x = (s.x - c.camX) * z + hx, y = (s.y - c.camY) * z + hy;
    const r = (isHeart ? 150 : 62) * z;
    if (x < -r || y < -r || x > c.w + r || y > c.h + r) continue;
    if (isHeart) {
      art(g, 'fx.curse_veins', x, y, r * 1.7, t * 0.12, 0.7);
      art(g, 'fx.curse_growth', x, y, r * 1.2, -t * 0.08, 0.5);
    }
    g.globalCompositeOperation = 'lighter';
    glow(g, x, y, r, isHeart ? 0.6 + 0.15 * Math.sin(t * 1.3) : 0.42);
    g.globalCompositeOperation = 'source-over';
  }
}

const DASH = [5, 5];
/** The rim's haze: the widths of its passes, metres. */
const HAZE = [640, 520, 410, 310, 220, 140, 70];
const NO_DASH: number[] = [];

/** Over the hulls: the hunters' and the Heart's hulls washed green, the Chosen's mark, the mooring's five-second ring
 *  about her own ship. `now`: the world's second (state.estServerTime). */
export function drawBlightOver(g: G, v: BlightView, ships: readonly Lit[], own: { x: number; y: number } | null, now: number, c: BlightCtx): void {
  const z = c.zoom, t = c.time;
  const hx = c.w / 2, hy = c.h / 2;
  const heart = v.heart && 'id' in v.heart ? v.heart : null;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    const isHeart = heart !== null && s.id === heart.id;
    if (!isHeart && v.hunters.indexOf(s.id) < 0) continue;
    const x = (s.x - c.camX) * z + hx, y = (s.y - c.camY) * z + hy;
    const r = (isHeart ? 70 : 34) * z;
    if (x < -r || y < -r || x > c.w + r || y > c.h + r) continue;
    glow(g, x, y, r, isHeart ? 0.5 : 0.36);
  }
  g.globalCompositeOperation = 'source-over';
  // «Избранник Скверны»: a green ring turning about her, her name under it (not her own: the HUD says that).
  const ch = v.chosen;
  if (ch) {
    const x = (ch.x - c.camX) * z + hx, y = (ch.y - c.camY) * z + hy;
    if (x > -80 && y > -80 && x < c.w + 80 && y < c.h + 80) {
      const r = Math.max(26, 44 * z);
      g.strokeStyle = 'rgba(160,255,120,0.85)';
      g.lineWidth = 2;
      g.setLineDash(DASH);
      g.lineDashOffset = -t * 8;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash(NO_DASH);
      g.lineDashOffset = 0;
      if (!ch.me) {
        g.font = '600 12px Inter, sans-serif';
        words(g, ch.name, x, y + r + 14, 'rgba(190,255,150,0.96)');
      }
    }
  }
  // The mooring: five seconds hove to, a ring closing about her.
  if (v.mooring > 0 && own) {
    const f = Math.min(1, Math.max(0, 1 - (v.mooring - now) / RAFT_MOOR_SECS));
    const x = (own.x - c.camX) * z + hx, y = (own.y - c.camY) * z + hy;
    const r = Math.max(30, 52 * z);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(150,255,160,0.95)';
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    g.stroke();
  }
}

/** The minimap: the hunters sent after her, each a small green dart's dot ringed dark (those her lookouts hold). */
export function drawBlightHunters(g: G, v: BlightView, ships: ReadonlyMap<number, { cur: { x: number; y: number } }>, tx: (x: number) => number, ty: (y: number) => number): void {
  if (!v.hunters.length) return;
  g.fillStyle = '#9dff6a';
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.lineWidth = 1;
  for (let i = 0; i < v.hunters.length; i++) {
    const s = ships.get(v.hunters[i]);
    if (!s) continue;
    g.beginPath();
    g.arc(tx(s.cur.x), ty(s.cur.y), 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

/** The minimap and the charts: the green disc (with its name where there is room), the Raft, the Chosen, the Heart.
 *  `k`: px a metre; `name`: write the names. */
export function drawBlightChart(g: G, v: BlightView, tx: (x: number) => number, ty: (y: number) => number, k: number, name: boolean, time = 0): void {
  const x = tx(v.zone.x), y = ty(v.zone.y), r = Math.max(4, v.zone.r * k);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(60,220,110,0.16)';
  g.fill();
  g.strokeStyle = 'rgba(130,255,150,0.75)';
  g.lineWidth = 1.2;
  g.stroke();
  // the Raft: a small green lozenge in the middle
  const rx = tx(v.raft.x), ry = ty(v.raft.y);
  if (r > 9) {
    g.beginPath();
    g.moveTo(rx, ry - 3.2);
    g.lineTo(rx + 3.2, ry);
    g.lineTo(rx, ry + 3.2);
    g.lineTo(rx - 3.2, ry);
    g.closePath();
    g.fillStyle = '#9dff6a';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1;
    g.stroke();
  }
  const heart = v.heart && 'id' in v.heart ? v.heart : null;
  if (heart) {
    g.strokeStyle = '#b7ff7a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(tx(heart.x), ty(heart.y), 5 + 1.5 * Math.sin(time * 3), 0, Math.PI * 2);
    g.stroke();
  }
  if (v.chosen && !v.chosen.me) {
    g.fillStyle = '#d6ff8a';
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(tx(v.chosen.x), ty(v.chosen.y), 3.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  if (name && r > 16) {
    g.font = 'italic 600 12px "Cormorant Garamond", Georgia, serif';
    words(g, BLIGHT_NAME[lang() === 'ru' ? 1 : 0], x, y - Math.min(r * 0.55, 40), 'rgba(180,255,190,0.95)');
  }
}
