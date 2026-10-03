// docs/19 D7: the creatures roaming the sea as HoMM3's neutral stacks, strictly from above: the swell broken round the
// stack and its shadow in the water, the creature's token (its own picture, or a tinted, framed token of one where it
// has none), ringed in the ladder's colour against her ship; over it HoMM3's word for their number and the square's
// level («Стая · ⚓3»); «в бою» and a grey token while another captain's party fights it. Each wanders slowly round
// its spot by the world's clock (the server reckons the same). On the minimap a small mark in the ladder's colour,
// one to a few pixels, fainter the further it is; the tooltip names it.

import type { UnitId } from '../../../shared/src/data/army.ts';
import { beastFace, drawFace } from './beastface.ts';
import { ROAMS, ROAM_MINI, roamPos } from '../../../shared/src/data/roamers.ts';
import type { RoamKind } from '../../../shared/src/data/roamers.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import type { RoamView } from '../../../shared/src/roamproto.ts';
import { sprite } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/roamers.ts';
import type { ClientState } from '../state.ts';
import { strengthWord } from '../ui/army.ts';
import { esc } from '../ui/dom.ts';

type G = CanvasRenderingContext2D;
const L = dict(EN, RU);

export interface RoamCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

export const roamName = (k: RoamKind): string => L(`k.${k}`);

/** Where a stack is now (its wander round its spot by the world's clock). */
export function roamNow(state: ClientState, v: RoamView): { x: number; y: number } {
  return roamPos(v.seed, v.x, v.y, state.estServerTime());
}

/** Its colour against her ship's level (the ladder's). */
function colourOf(state: ClientState, v: RoamView): string {
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  return THREAT_COLOR[threatOf(mine, v.level)];
}

/** The phone's frames (docs/19 D6–D7): what does not change from frame to frame — a token's art, tint, frame and
 *  shadow, a label's outlined words — is drawn once into a small canvas and stamped after. */
const stamps = new Map<string, HTMLCanvasElement>();
function stamp(key: string, w: number, h: number, draw: (g: G) => void): HTMLCanvasElement | null {
  let c = stamps.get(key);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  if (stamps.size > 400) stamps.clear();
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  draw(g);
  stamps.set(key, c);
  return c;
}

const labelW = new Map<string, number>();
function label(g: G, text: string, x: number, y: number, col: string, size = 11): void {
  const key = `l|${text}|${col}|${size}`;
  const font = `700 ${size}px Inter, sans-serif`;
  let mw = labelW.get(key);
  if (mw === undefined) {
    g.font = font;
    mw = Math.ceil(g.measureText(text).width) + 8;
    if (labelW.size > 400) labelW.clear();
    labelW.set(key, mw);
  }
  const w = mw, h = size + 8;
  const c = stamp(key, w, h, (s) => {
    s.font = font;
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.lineWidth = 3;
    s.strokeStyle = 'rgba(0,0,0,0.78)';
    s.strokeText(text, w / 2, h / 2);
    s.fillStyle = col;
    s.fillText(text, w / 2, h / 2);
  });
  if (c) g.drawImage(c, x - w / 2, y - h / 2, w, h);
}

/** The water about it: a ring the swell breaks round it, the dark of the creatures under the surface, and — for a
 *  flock, a school or a pod — a few of them about the token. */
function water(g: G, x: number, y: number, R: number, v: RoamView, t: number, swimmers: boolean): void {
  const sw = 0.5 + 0.5 * Math.sin(t * 1.2 + v.id);
  g.strokeStyle = `rgba(205,228,236,${0.18 + 0.14 * sw})`;
  g.lineWidth = Math.max(1, R * 0.07);
  g.beginPath();
  g.ellipse(x, y, R * (1.55 + sw * 0.2), R * (1.3 + sw * 0.16), 0.3, 0, Math.PI * 2);
  g.stroke();
  // A few of them about it, all in one path: wings over the swell for the gulls, fins for the sharks, backs for the
  // rest (no transforms: the phone's frames).
  const many = swimmers ? Math.min(3, Math.max(0, Math.round(Math.log2(Math.max(1, v.n)) / 1.5))) : 0;
  if (!many) return;
  g.beginPath();
  for (let i = 0; i < many; i++) {
    const a = t * (v.kind === 'gull' ? 0.9 : 0.35) + i * ((Math.PI * 2) / many) + v.id;
    const d = R * (1.75 + 0.15 * Math.sin(t * 0.8 + i));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    if (v.kind === 'gull') {
      const fl = Math.sin(t * 7 + i) * R * 0.08;
      g.moveTo(px - R * 0.28, py + fl);
      g.lineTo(px, py - R * 0.06);
      g.lineTo(px + R * 0.28, py + fl);
    } else {
      g.moveTo(px + R * 0.14, py);
      g.arc(px, py, R * 0.14, 0, Math.PI * 2);
    }
  }
  if (v.kind === 'gull') {
    g.strokeStyle = 'rgba(245,245,240,0.9)';
    g.lineWidth = Math.max(1, R * 0.07);
    g.stroke();
  } else {
    g.fillStyle = v.kind === 'reef_shark' ? '#39454c' : 'rgba(30,44,50,0.75)';
    g.fill();
  }
}

/** The token's still part, drawn once a kind, size and state: the dark of the creatures in the water, the shadow, the
 *  disc, the picture (tinted where it is a stand-in, grey in battle), the brass frame, the crossed blades. */
function tokenFace(g: G, R: number, u: UnitId, grey: boolean, cx: number, cy: number): void {
  const face = beastFace(u);
  const sp = sprite(face.id);
  const grd = g.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.75);
  grd.addColorStop(0, 'rgba(8,22,30,0.5)');
  grd.addColorStop(1, 'rgba(8,22,30,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, cy, R * 1.75, R * 1.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.42)';
  g.beginPath();
  g.ellipse(cx + R * 0.12, cy + R * 0.25, R * 1.02, R * 0.85, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#10161a';
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  if (sp) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, R - 1, 0, Math.PI * 2);
    g.clip();
    const tint = face.tint;
    g.filter = grey ? `${tint ?? ''} grayscale(1) brightness(0.65)`.trim() : tint ?? 'none';
    drawFace(g, sp.img, cx, cy, R, face.fig);
    g.filter = 'none';
    g.restore();
  }
  if (face.tint) {
    g.strokeStyle = '#a8894e';
    g.lineWidth = Math.max(1.5, R * 0.12);
    g.beginPath();
    g.arc(cx, cy, R - R * 0.06, 0, Math.PI * 2);
    g.stroke();
  }
  if (grey) {
    // Crossed blades over it: a fight under way.
    g.strokeStyle = 'rgba(235,225,200,0.95)';
    g.lineWidth = Math.max(1.5, R * 0.1);
    g.beginPath();
    g.moveTo(cx - R * 0.55, cy - R * 0.55);
    g.lineTo(cx + R * 0.55, cy + R * 0.55);
    g.moveTo(cx + R * 0.55, cy - R * 0.55);
    g.lineTo(cx - R * 0.55, cy + R * 0.55);
    g.stroke();
  }
}

function token(g: G, x: number, y: number, R: number, v: RoamView, col: string, t: number): void {
  const u = ROAMS[v.kind].u as UnitId;
  const grey = !!v.fight;
  const Rr = Math.round(R);
  const S = Math.ceil(Rr * 3.6);
  // (stamped only once the picture is in: until then drawn as it comes)
  const c = sprite(beastFace(u).id) ? stamp(`t|${u}|${Rr}|${grey ? 1 : 0}`, S, S, (s) => tokenFace(s, Rr, u, grey, S / 2, S / 2)) : null;
  if (c) g.drawImage(c, x - S / 2, y - S / 2, S, S);
  else tokenFace(g, R, u, grey, x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 + v.id);
  g.globalAlpha = grey ? 0.6 : 0.7 + 0.3 * pulse;
  g.strokeStyle = grey ? 'rgba(170,170,160,0.9)' : col;
  g.lineWidth = Math.max(1.5, R * 0.14);
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
}

/** Every stack about her on the sea. */
export function drawRoamsWorld(g: G, state: ClientState, c: RoamCtx): void {
  const list = state.roams;
  if (!list.length || c.zoom < 0.05) return;
  const now = state.estServerTime();
  const R = Math.max(11, Math.min(22, 19 * c.zoom));
  const small = c.zoom < 0.13;
  for (const v of list) {
    const p = roamPos(v.seed, v.x, v.y, now);
    const x = c.sx(p.x), y = c.sy(p.y);
    if (x < -R * 4 || y < -R * 4 || x > c.w + R * 4 || y > c.h + R * 4) continue;
    const col = colourOf(state, v);
    g.save();
    if (small) {
      // Far out: a mark, not a token (the sea stays readable).
      g.fillStyle = v.fight ? 'rgba(170,170,160,0.8)' : col;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
      continue;
    }
    token(g, x, y, R, v, col, c.time);
    if (c.zoom >= 0.2) water(g, x, y, R, v, c.time, c.zoom >= 0.8);
    if (v.fight) {
      // «в бою» under it (her ship's own name rides over the fight), the kind beside it.
      label(g, c.zoom > 0.5 ? `${L('fight')} · ${roamName(v.kind)}` : L('fight'), x, y + R + 12, '#f0a890', c.zoom > 0.45 ? 12 : 11);
    } else {
      label(g, `${strengthWord(v.n).word} · ⚓${v.level}`, x, y - R - 9, col, c.zoom > 0.45 ? 12 : 11);
      if (c.zoom > 0.5) label(g, roamName(v.kind), x, y + R + 11, '#d9e6e8', 10.5);
    }
    g.restore();
  }
}

/** The stacks on her minimap: one mark to a few pixels (the nearest wins), fainter toward the dial's edge and past
 *  ROAM_MINI; a fight's grey and hollow. */
export function drawRoamsMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  if (!state.roams.length) return;
  const cells = new Set<number>();
  const list = state.roams.filter((v) => Math.abs(v.x - own.x) <= range && Math.abs(v.y - own.y) <= range)
    .sort((a, b) => Math.abs(a.x - own.x) + Math.abs(a.y - own.y) - (Math.abs(b.x - own.x) + Math.abs(b.y - own.y)));
  for (const v of list) {
    const px = tx(v.x), py = ty(v.y);
    const cell = Math.floor(px / 6) * 4096 + Math.floor(py / 6);
    if (cells.has(cell)) continue;
    cells.add(cell);
    const d = Math.max(Math.abs(v.x - own.x), Math.abs(v.y - own.y));
    g.globalAlpha = d > ROAM_MINI ? 0.35 : 1 - 0.45 * (d / ROAM_MINI);
    g.beginPath();
    g.moveTo(px, py - 3);
    g.lineTo(px + 3, py);
    g.lineTo(px, py + 3);
    g.lineTo(px - 3, py);
    g.closePath();
    if (v.fight) {
      g.strokeStyle = 'rgba(190,190,180,0.9)';
      g.lineWidth = 1.2;
      g.stroke();
    } else {
      g.fillStyle = colourOf(state, v);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 0.8;
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

/** The world map close in: the stacks she has word of, a small diamond each in the ladder's colour (grey in battle). */
export function drawRoamsChart(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number): void {
  for (const v of state.roams) {
    const px = tx(v.x), py = ty(v.y);
    g.beginPath();
    g.moveTo(px, py - 3.5);
    g.lineTo(px + 3.5, py);
    g.lineTo(px, py + 3.5);
    g.lineTo(px - 3.5, py);
    g.closePath();
    g.fillStyle = v.fight ? 'rgba(170,170,160,0.8)' : colourOf(state, v);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 0.8;
    g.stroke();
  }
}

/** The minimap's tooltip over one. */
export function roamTip(state: ClientState, x: number, y: number, slack: number): string | null {
  let best: RoamView | null = null, bd = slack + 120;
  for (const v of state.roams) {
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) [best, bd] = [v, d];
  }
  if (!best) return null;
  return esc(best.fight ? L('tipFight', { what: roamName(best.kind) }) : L('tip', { what: roamName(best.kind), word: strengthWord(best.n).word, lv: best.level }));
}
