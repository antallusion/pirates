// docs/19 D5: the sea's small things, strictly from above and from the art (owner, 2026-10-07: no drawn signs): the
// corked green bottle of the missiles' sheet bobbing with its glint, the catch sheet's silver fish leaping over her
// deck, a bank of mist on flat dead water, the painted gulls wheeling over the dark of a shoal, the islands' ship's boat
// low in the water with the sea over her stern, the buried cache's iron-bound chest afloat with the sharks circling it
// under the water; over it its name with a small brass clock of the time it has left. On the minimap a small mark with
// its clock.

import type { FindKind } from '../../../shared/src/data/seafinds.ts';
import { FIND_REACH } from '../../../shared/src/data/seafinds.ts';
import type { FindView } from '../../../shared/src/findproto.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seafinds.ts';
import type { ClientState } from '../state.ts';
import { addHot, circlers, clockBadge, drawArt, drawPiece, foam, levelTag, piece } from './seaart.ts';
import { gulls } from './sights.ts';

type G = CanvasRenderingContext2D;
const L = dict(EN, RU);

export interface FindCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

export const findTitle = (k: FindKind): string => L(`n.${k}`);

/** World seconds a small thing has left now. */
export function findLeft(state: ClientState, f: FindView): number {
  return Math.max(0, f.left - (state.estServerTime() - state.findsAt));
}

function clock(g: G, x: number, y: number, r: number, share: number, w: number): void {
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = w + 2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(232,206,120,0.95)';
  g.lineWidth = w;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, share)));
  g.stroke();
  g.restore();
}

/** The corked bottle of the missiles' sheet bobbing on its side, the swell white about it, a glint now and then. */
function bottle(g: G, x: number, y: number, R: number, t: number, id: number): void {
  foam(g, x, y, R * 0.85, t, id, 0.2);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x + R * 0.2, y + R * 0.3, R * 0.9, R * 0.45, 0.6, 0, Math.PI * 2);
  g.fill();
  if (!drawPiece(g, 'bottle', x, y, R * 2.1, 0.15 + Math.sin(t * 1.2) * 0.25)) {
    g.fillStyle = 'rgba(60,140,90,0.92)';
    g.beginPath();
    g.ellipse(x, y, R * 0.42, R * 0.8, 0.6, 0, Math.PI * 2);
    g.fill();
  }
  const glint = Math.max(0, Math.sin(t * 2.3));
  if (glint > 0.85) {
    g.fillStyle = `rgba(255,252,236,${(glint - 0.85) * 4})`;
    g.beginPath();
    g.arc(x - R * 0.25, y - R * 0.12, R * 0.12, 0, Math.PI * 2);
    g.fill();
  }
}

/** Flying fish over her deck: the catch sheet's silver fish, leaping out and falling back. */
function flyfish(g: G, x: number, y: number, R: number, t: number, id: number): void {
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.9 + i / 9 + id * 0.13) % 1;
    const a = i * 0.7 + id;
    const d = R * (0.8 + ph * 2.6);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8 - Math.sin(ph * Math.PI) * R * 0.9;
    // Its nose along its flight (the sheet's fish lie head low-left, about 160° from +x).
    if (!drawArt(g, i % 3 ? 'icon.fish_herring' : 'icon.fish_mackerel', px, py, R * 0.36, a - (160 * Math.PI) / 180, 0.95)) {
      g.fillStyle = 'rgba(200,215,230,0.95)';
      g.beginPath();
      g.ellipse(px, py, R * 0.09, R * 0.28, a + Math.PI / 2, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** A bank of fog on dead flat water: a sheet of pale, still water and over it the painted gun smoke made mist, in soft
 *  drifting puffs. */
function fogBank(g: G, x: number, y: number, Rf: number, t: number, id: number): void {
  const calm = g.createRadialGradient(x, y, Rf * 0.1, x, y, Rf);
  calm.addColorStop(0, 'rgba(150,170,175,0.2)');
  calm.addColorStop(1, 'rgba(150,170,175,0)');
  g.fillStyle = calm;
  g.beginPath();
  g.arc(x, y, Rf, 0, Math.PI * 2);
  g.fill();
  const mist = piece('smoke');
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996 + id;
    const d = Rf * (0.15 + ((i * 37) % 70) / 100);
    const drift = Math.sin(t * 0.15 + i) * Rf * 0.05;
    const px = x + Math.cos(a) * d + drift, py = y + Math.sin(a) * d * 0.85;
    const r = Rf * (0.3 + ((i * 53) % 30) / 100);
    if (mist) {
      g.save();
      g.globalAlpha = 0.3;
      g.translate(px, py);
      g.rotate(i * 1.3 + t * 0.02);
      g.drawImage(mist, -r, -r, r * 2, r * 2);
      g.restore();
      continue;
    }
    const grd = g.createRadialGradient(px, py, r * 0.1, px, py, r);
    grd.addColorStop(0, 'rgba(225,230,232,0.42)');
    grd.addColorStop(1, 'rgba(225,230,232,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Gulls over a shoal: the dark of the fish under the water, the water broken white over them, and the painted gulls
 *  wheeling and diving with their shadows. */
function shoal(g: G, x: number, y: number, R: number, t: number, id: number): void {
  const grd = g.createRadialGradient(x, y, R * 0.3, x, y, R * 2.2);
  grd.addColorStop(0, 'rgba(20,40,55,0.55)');
  grd.addColorStop(1, 'rgba(20,40,55,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(x, y, R * 2.2, R * 1.7, 0.4, 0, Math.PI * 2);
  g.fill();
  foam(g, x - R * 0.3, y + R * 0.1, R * 0.7, t, id, 0.22);
  foam(g, x + R * 0.5, y - R * 0.2, R * 0.5, t, id + 3, 0.18);
  g.save();
  g.translate(x, y);
  const ok = gulls(g, 6, Math.max(0.8, R / 22), t + id, R * 1.5);
  g.restore();
  if (ok) return;
  g.strokeStyle = 'rgba(245,245,240,0.95)';
  g.lineWidth = Math.max(1.2, R * 0.08);
  for (let i = 0; i < 7; i++) {
    const a = t * (0.7 + i * 0.05) + i * 0.9;
    const px = x + Math.cos(a) * R * (1.2 + (i % 3) * 0.45), py = y + Math.sin(a) * R * (1.0 + (i % 2) * 0.4) - R * 0.3;
    g.beginPath();
    g.moveTo(px - R * 0.3, py);
    g.quadraticCurveTo(px, py - R * 0.15, px + R * 0.3, py);
    g.stroke();
  }
}

/** A ship's boat low in the water (the islands' painted boat): the sea over her stern, the white water along her side. */
function boat(g: G, x: number, y: number, R: number, t: number, id: number): void {
  const rot = 0.6 + Math.sin(t * 0.8) * 0.12;
  foam(g, x, y, R * 1.2, t, id, 0.22);
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.ellipse(x + R * 0.25, y + R * 0.35, R * 0.75, R * 1.5, rot, 0, Math.PI * 2);
  g.fill();
  if (!drawPiece(g, 'boat', x, y, R * 3.1, rot)) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = '#6a4c2c';
    g.beginPath();
    g.moveTo(0, -R * 1.5);
    g.quadraticCurveTo(R * 0.8, -R * 0.4, R * 0.65, R * 1.2);
    g.lineTo(-R * 0.65, R * 1.2);
    g.quadraticCurveTo(-R * 0.8, -R * 0.4, 0, -R * 1.5);
    g.fill();
    g.restore();
  }
  // Swamped: the sea washing over her stern.
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const sw = g.createLinearGradient(0, R * 0.2, 0, R * 1.6);
  sw.addColorStop(0, 'rgba(14,34,44,0)');
  sw.addColorStop(0.5, 'rgba(14,34,44,0.55)');
  sw.addColorStop(1, 'rgba(14,34,44,0.85)');
  g.fillStyle = sw;
  g.beginPath();
  g.ellipse(0, R * 0.95, R * 0.75, R * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A chest afloat — the buried cache's iron-bound chest — with the sharks circling it, under the water. */
function chest(g: G, x: number, y: number, R: number, t: number, id: number): void {
  foam(g, x, y, R * 1.05, t, id, 0.2);
  circlers(g, 'monster.shark', x, y, R * 2.5, R * 1.5, 3, t, id, 0.6, 0.5);
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.ellipse(x + R * 0.2, y + R * 0.3, R * 1.1, R * 0.8, 0.3, 0, Math.PI * 2);
  g.fill();
  if (!drawPiece(g, 'chest', x, y, R * 2.3, 0.3 + Math.sin(t * 1.1 + id) * 0.08)) {
    g.save();
    g.translate(x, y);
    g.rotate(0.3);
    g.fillStyle = '#7a5530';
    g.fillRect(-R * 0.9, -R * 0.6, R * 1.8, R * 1.2);
    g.restore();
  }
}

/** Every small thing of hers on the sea: the thing itself, from the art, and over it its name with a small brass
 *  clock of the time it has left (no ring round the thing: owner, 2026-10-07). */
export function drawFindsWorld(g: G, state: ClientState, c: FindCtx): void {
  const list = state.finds;
  if (!list.length || c.zoom < 0.05) return;
  const own = state.ownDisplay;
  for (const f of list) {
    // The fish are over her own deck.
    const wx = f.kind === 'flyfish' && own ? own.x : f.x, wy = f.kind === 'flyfish' && own ? own.y : f.y;
    const x = c.sx(wx), y = c.sy(wy);
    const R = Math.max(11, Math.min(22, 18 * c.zoom));
    const far = f.kind === 'calm' ? FIND_REACH.calm * c.zoom : R * 4;
    if (x < -far || y < -far || x > c.w + far || y > c.h + far) continue;
    const bob = Math.sin(c.time * 1.5 + f.id) * R * 0.06;
    g.save();
    switch (f.kind) {
      case 'bottle':
        bottle(g, x, y + bob, R, c.time, f.id);
        break;
      case 'flyfish':
        flyfish(g, x, y, Math.max(10, 34 * c.zoom), c.time, f.id);
        break;
      case 'calm':
        fogBank(g, x, y, Math.max(40, FIND_REACH.calm * c.zoom), c.time, f.id);
        break;
      case 'gulls':
        shoal(g, x, y, R * 1.3, c.time, f.id);
        break;
      case 'boat':
        boat(g, x, y + bob, R, c.time, f.id);
        break;
      case 'chest':
        chest(g, x, y + bob, R * 0.9, c.time, f.id);
        break;
    }
    if (f.kind !== 'flyfish') {
      if (f.kind !== 'calm') addHot(x, y, R * 1.3);
      const ly = y - R * 1.6 - Math.max(6, R * 0.3);
      const half = levelTag(g, f.kind === 'chest' && f.n ? `${findTitle(f.kind)} · ${f.n}` : findTitle(f.kind), null, '#e8ce78', x + 9, ly, c.zoom > 0.45 ? 12 : 11, '#ecd690');
      clockBadge(g, x + 9 - half - 7, ly, 7, f.ttl > 0 ? findLeft(state, f) / f.ttl : 0, 'rgba(232,206,120,0.95)');
    }
    g.restore();
  }
}

/** Her small things on the minimap: a gold dot ringed by its clock. */
export function drawFindsMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  for (const f of state.finds) {
    if (f.kind === 'flyfish') continue;
    if (Math.abs(f.x - own.x) > range || Math.abs(f.y - own.y) > range) continue;
    const x = tx(f.x), y = ty(f.y);
    g.save();
    g.fillStyle = '#e8ce78';
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    clock(g, x, y, 6, f.ttl > 0 ? findLeft(state, f) / f.ttl : 0, 1.4);
  }
}

/** The minimap's tooltip over one. */
export function findTip(state: ClientState, x: number, y: number, slack: number): string | null {
  for (const f of state.finds) {
    if (f.kind === 'flyfish' || Math.hypot(f.x - x, f.y - y) > slack + 60) continue;
    return `${findTitle(f.kind)}<br>${L('left', { t: Math.max(1, Math.ceil(findLeft(state, f) / 60)) })}`;
  }
  return null;
}
