// docs/19 D7: the creatures roaming the sea as HoMM3's neutral stacks, strictly from above: the swell broken round the
// stack and its shadow in the water, the creature's token (its own picture, or a tinted, framed token of one where it
// has none), ringed in the ladder's colour against her ship; over it HoMM3's word for their number and the square's
// level («Стая · ⚓3»); «в бою» and a grey token while another captain's party fights it. Each wanders slowly round
// its spot by the world's clock (the server reckons the same). On the minimap a small mark in the ladder's colour,
// one to a few pixels, fainter the further it is; the tooltip names it.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_TINT } from '../../../shared/src/data/bestiary.ts';
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

function label(g: G, text: string, x: number, y: number, col: string, size = 11): void {
  g.font = `700 ${size}px Inter, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.78)';
  g.strokeText(text, x, y);
  g.fillStyle = col;
  g.fillText(text, x, y);
}

/** The water about it: a ring the swell breaks round it, the dark of the creatures under the surface, and — for a
 *  flock, a school or a pod — a few of them about the token. */
function water(g: G, x: number, y: number, R: number, v: RoamView, t: number): void {
  const sw = 0.5 + 0.5 * Math.sin(t * 1.2 + v.id);
  const grd = g.createRadialGradient(x, y, R * 0.4, x, y, R * 2.3);
  grd.addColorStop(0, 'rgba(8,22,30,0.5)');
  grd.addColorStop(1, 'rgba(8,22,30,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(x, y, R * 2.3, R * 1.9, 0.3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = `rgba(205,228,236,${0.18 + 0.14 * sw})`;
  g.lineWidth = Math.max(1, R * 0.07);
  g.beginPath();
  g.ellipse(x, y, R * (1.55 + sw * 0.2), R * (1.3 + sw * 0.16), 0.3, 0, Math.PI * 2);
  g.stroke();
  // A few of them about it: wings over the swell for the gulls, fins for the sharks, backs for the rest.
  const many = Math.min(5, Math.max(0, Math.round(Math.log2(Math.max(1, v.n)))));
  for (let i = 0; i < many; i++) {
    const a = t * (v.kind === 'gull' ? 0.9 : 0.35) + i * ((Math.PI * 2) / many) + v.id;
    const d = R * (1.75 + 0.15 * Math.sin(t * 0.8 + i));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    g.save();
    g.translate(px, py);
    g.rotate(a + Math.PI / 2);
    if (v.kind === 'gull') {
      g.strokeStyle = 'rgba(245,245,240,0.9)';
      g.lineWidth = Math.max(1, R * 0.07);
      const fl = Math.sin(t * 7 + i) * R * 0.08;
      g.beginPath();
      g.moveTo(-R * 0.28, fl);
      g.quadraticCurveTo(-R * 0.1, -R * 0.14, 0, 0);
      g.quadraticCurveTo(R * 0.1, -R * 0.14, R * 0.28, fl);
      g.stroke();
    } else if (v.kind === 'reef_shark') {
      g.fillStyle = '#39454c';
      g.beginPath();
      g.moveTo(0, -R * 0.3);
      g.lineTo(R * 0.12, R * 0.16);
      g.lineTo(-R * 0.12, R * 0.16);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = 'rgba(30,44,50,0.75)';
      g.beginPath();
      g.ellipse(0, 0, R * 0.12, R * 0.26, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** Its token: the creature's picture in a dark disc (tinted and framed where it is a stand-in), ringed. */
function token(g: G, x: number, y: number, R: number, v: RoamView, col: string, t: number): void {
  const u = ROAMS[v.kind].u as UnitId;
  const sp = sprite(UNITS[u].art);
  const grey = !!v.fight;
  g.fillStyle = 'rgba(0,0,0,0.42)';
  g.beginPath();
  g.ellipse(x + R * 0.12, y + R * 0.25, R * 1.02, R * 0.85, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#10161a';
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  if (sp) {
    g.save();
    g.beginPath();
    g.arc(x, y, R - 1, 0, Math.PI * 2);
    g.clip();
    const tint = BEAST_TINT[u as keyof typeof BEAST_TINT];
    g.filter = grey ? `${tint ?? ''} grayscale(1) brightness(0.65)`.trim() : tint ?? 'none';
    const iw = sp.img.naturalWidth, ih = sp.img.naturalHeight;
    const k = (R * 2.2) / Math.min(iw, ih);
    g.drawImage(sp.img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
    g.filter = 'none';
    g.restore();
  }
  if (BEAST_TINT[u as keyof typeof BEAST_TINT]) {
    g.strokeStyle = '#a8894e';
    g.lineWidth = Math.max(1.5, R * 0.12);
    g.beginPath();
    g.arc(x, y, R - R * 0.06, 0, Math.PI * 2);
    g.stroke();
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 + v.id);
  g.globalAlpha = grey ? 0.6 : 0.7 + 0.3 * pulse;
  g.strokeStyle = grey ? 'rgba(170,170,160,0.9)' : col;
  g.lineWidth = Math.max(1.5, R * 0.14);
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  if (grey) {
    // Crossed blades over it: a fight under way.
    g.strokeStyle = 'rgba(235,225,200,0.95)';
    g.lineWidth = Math.max(1.5, R * 0.1);
    g.beginPath();
    g.moveTo(x - R * 0.55, y - R * 0.55);
    g.lineTo(x + R * 0.55, y + R * 0.55);
    g.moveTo(x + R * 0.55, y - R * 0.55);
    g.lineTo(x - R * 0.55, y + R * 0.55);
    g.stroke();
  }
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
    if (c.zoom >= 0.2) water(g, x, y, R, v, c.time);
    token(g, x, y, R, v, col, c.time);
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
