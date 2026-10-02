// docs/19 D5: the sea's small things, strictly from above and drawn by hand — a green bottle bobbing with its glint, a
// shower of flying fish over her deck, a bank of fog on flat dead water, gulls wheeling over the dark of a shoal, a
// ship's boat low in the water with her sailors waving, a chest afloat with the fins circling it; the ring of its
// clock and its name over it. On the minimap a small mark with its clock.

import type { FindKind } from '../../../shared/src/data/seafinds.ts';
import { FIND_REACH } from '../../../shared/src/data/seafinds.ts';
import type { FindView } from '../../../shared/src/findproto.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seafinds.ts';
import type { ClientState } from '../state.ts';

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

function label(g: G, text: string, x: number, y: number, col: string, size = 11): void {
  g.font = `700 ${size}px Inter, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, x, y);
  g.fillStyle = col;
  g.fillText(text, x, y);
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

function ripple(g: G, x: number, y: number, R: number, t: number, id: number): void {
  const sw = 0.5 + 0.5 * Math.sin(t * 1.4 + id);
  g.strokeStyle = `rgba(200,225,235,${0.16 + 0.12 * sw})`;
  g.lineWidth = Math.max(1, R * 0.07);
  g.beginPath();
  g.ellipse(x, y, R * (1.9 + sw * 0.3), R * (1.6 + sw * 0.25), 0.3, 0, Math.PI * 2);
  g.stroke();
}

function bottle(g: G, x: number, y: number, R: number, t: number): void {
  const a = 0.6 + Math.sin(t * 1.2) * 0.25;
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = 'rgba(60,140,90,0.92)';
  g.strokeStyle = 'rgba(15,40,25,0.9)';
  g.lineWidth = Math.max(1, R * 0.08);
  g.beginPath();
  g.ellipse(0, R * 0.15, R * 0.42, R * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(60,140,90,0.92)';
  g.fillRect(-R * 0.16, -R * 1.05, R * 0.32, R * 0.5);
  g.fillStyle = '#9c7646';
  g.fillRect(-R * 0.18, -R * 1.25, R * 0.36, R * 0.24);
  // The rolled note inside.
  g.fillStyle = 'rgba(236,224,190,0.85)';
  g.fillRect(-R * 0.12, -R * 0.2, R * 0.24, R * 0.7);
  g.restore();
  // A glint now and then.
  const glint = Math.max(0, Math.sin(t * 2.3));
  if (glint > 0.8) {
    g.fillStyle = `rgba(255,255,240,${(glint - 0.8) * 4})`;
    g.beginPath();
    g.arc(x + R * 0.3, y - R * 0.3, R * 0.22, 0, Math.PI * 2);
    g.fill();
  }
}

function flyfish(g: G, x: number, y: number, R: number, t: number, id: number): void {
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.9 + i / 9 + id * 0.13) % 1;
    const a = i * 0.7 + id;
    const d = R * (0.8 + ph * 2.6);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8 - Math.sin(ph * Math.PI) * R * 0.9;
    g.save();
    g.translate(px, py);
    g.rotate(a + Math.PI / 2);
    g.fillStyle = 'rgba(200,215,230,0.95)';
    g.beginPath();
    g.ellipse(0, 0, R * 0.09, R * 0.28, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,190,215,0.8)';
    g.beginPath();
    g.moveTo(0, -R * 0.05);
    g.lineTo(R * 0.32, R * 0.1);
    g.lineTo(0, R * 0.08);
    g.lineTo(-R * 0.32, R * 0.1);
    g.closePath();
    g.fill();
    g.restore();
  }
}

function fogBank(g: G, x: number, y: number, Rf: number, t: number, id: number): void {
  // The dead calm: a sheet of flat, pale water; over it the fog in soft puffs.
  const calm = g.createRadialGradient(x, y, Rf * 0.1, x, y, Rf);
  calm.addColorStop(0, 'rgba(150,170,175,0.22)');
  calm.addColorStop(1, 'rgba(150,170,175,0)');
  g.fillStyle = calm;
  g.beginPath();
  g.arc(x, y, Rf, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996 + id;
    const d = Rf * (0.15 + ((i * 37) % 70) / 100);
    const drift = Math.sin(t * 0.15 + i) * Rf * 0.05;
    const px = x + Math.cos(a) * d + drift, py = y + Math.sin(a) * d * 0.85;
    const r = Rf * (0.28 + ((i * 53) % 30) / 100);
    const grd = g.createRadialGradient(px, py, r * 0.1, px, py, r);
    grd.addColorStop(0, 'rgba(225,230,232,0.42)');
    grd.addColorStop(1, 'rgba(225,230,232,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
  }
}

function shoal(g: G, x: number, y: number, R: number, t: number, id: number): void {
  // The dark of the shoal under the water, the water broken over it, and the gulls.
  const grd = g.createRadialGradient(x, y, R * 0.3, x, y, R * 2.2);
  grd.addColorStop(0, 'rgba(20,40,55,0.55)');
  grd.addColorStop(1, 'rgba(20,40,55,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(x, y, R * 2.2, R * 1.7, 0.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(220,235,240,0.55)';
  for (let i = 0; i < 10; i++) {
    const a = i * 1.7 + id, d = R * (0.3 + ((i * 29) % 100) / 70);
    const s = 0.5 + 0.5 * Math.sin(t * 3 + i);
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, Math.max(1, R * 0.08 * s), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(245,245,240,0.95)';
  g.lineWidth = Math.max(1.2, R * 0.08);
  for (let i = 0; i < 7; i++) {
    const a = t * (0.7 + i * 0.05) + i * 0.9;
    const px = x + Math.cos(a) * R * (1.2 + (i % 3) * 0.45), py = y + Math.sin(a) * R * (1.0 + (i % 2) * 0.4) - R * 0.3;
    const fl = Math.sin(t * 7 + i) * R * 0.1;
    g.beginPath();
    g.moveTo(px - R * 0.3, py + fl);
    g.quadraticCurveTo(px - R * 0.12, py - R * 0.15, px, py);
    g.quadraticCurveTo(px + R * 0.12, py - R * 0.15, px + R * 0.3, py + fl);
    g.stroke();
  }
}

function boat(g: G, x: number, y: number, R: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(0.6 + Math.sin(t * 0.8) * 0.12);
  // Low in the water: the swamped half darker.
  g.fillStyle = '#6a4c2c';
  g.strokeStyle = '#1f150c';
  g.lineWidth = Math.max(1, R * 0.08);
  g.beginPath();
  g.moveTo(0, -R * 1.5);
  g.quadraticCurveTo(R * 0.8, -R * 0.4, R * 0.65, R * 1.2);
  g.lineTo(-R * 0.65, R * 1.2);
  g.quadraticCurveTo(-R * 0.8, -R * 0.4, 0, -R * 1.5);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(40,70,85,0.75)';
  g.fillRect(-R * 0.6, R * 0.35, R * 1.2, R * 0.8);
  // The sailors: heads and a waving arm.
  for (const [hx, hy] of [[-0.25, -0.4], [0.25, -0.1], [-0.2, 0.25], [0.22, 0.55]] as const) {
    g.fillStyle = '#d9b48a';
    g.beginPath();
    g.arc(R * hx, R * hy, Math.max(1.5, R * 0.17), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#d9b48a';
  g.lineWidth = Math.max(1, R * 0.07);
  const wave = Math.sin(t * 6) * R * 0.25;
  g.beginPath();
  g.moveTo(R * 0.25, -R * 0.1);
  g.lineTo(R * 0.75 + wave * 0.3, -R * 0.65 + wave);
  g.stroke();
  g.restore();
  // Splashes along her side.
  g.fillStyle = 'rgba(225,240,245,0.7)';
  for (let i = 0; i < 5; i++) {
    const s = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.3);
    g.beginPath();
    g.arc(x + (i - 2) * R * 0.45, y + R * 1.1, Math.max(1, R * 0.12 * s), 0, Math.PI * 2);
    g.fill();
  }
}

function chest(g: G, x: number, y: number, R: number, t: number, id: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(0.3 + Math.sin(t * 1.1 + id) * 0.08);
  g.fillStyle = '#7a5530';
  g.strokeStyle = '#25170b';
  g.lineWidth = Math.max(1, R * 0.08);
  g.fillRect(-R * 0.9, -R * 0.6, R * 1.8, R * 1.2);
  g.strokeRect(-R * 0.9, -R * 0.6, R * 1.8, R * 1.2);
  g.fillStyle = '#5e6468';
  for (const bx of [-0.55, 0, 0.55]) g.fillRect(R * bx - R * 0.08, -R * 0.6, R * 0.16, R * 1.2);
  g.fillStyle = '#d6b45a';
  g.fillRect(-R * 0.12, -R * 0.12, R * 0.24, R * 0.24);
  g.restore();
  // The fins circling it.
  for (let i = 0; i < 3; i++) {
    const a = t * (0.6 + i * 0.08) + id + (i * Math.PI * 2) / 3;
    const d = R * (2.4 + 0.3 * Math.sin(t + i));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    g.save();
    g.translate(px, py);
    g.rotate(a + Math.PI / 2);
    g.fillStyle = '#39454c';
    g.beginPath();
    g.moveTo(0, -R * 0.4);
    g.lineTo(R * 0.16, R * 0.22);
    g.lineTo(-R * 0.16, R * 0.22);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(220,235,240,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-R * 0.35, R * 0.38);
    g.quadraticCurveTo(0, R * 0.55, R * 0.35, R * 0.38);
    g.stroke();
    g.restore();
  }
}

/** Every small thing of hers on the sea. */
export function drawFindsWorld(g: G, state: ClientState, c: FindCtx): void {
  const list = state.finds;
  if (!list.length || c.zoom < 0.05) return;
  const own = state.ownDisplay;
  for (const f of list) {
    // The fish are over her own deck.
    const wx = f.kind === 'flyfish' && own ? own.x : f.x, wy = f.kind === 'flyfish' && own ? own.y : f.y;
    const x = c.sx(wx), y = c.sy(wy);
    const R = Math.max(7, Math.min(20, 16 * c.zoom));
    const far = f.kind === 'calm' ? FIND_REACH.calm * c.zoom : R * 4;
    if (x < -far || y < -far || x > c.w + far || y > c.h + far) continue;
    const bob = Math.sin(c.time * 1.5 + f.id) * R * 0.06;
    g.save();
    switch (f.kind) {
      case 'bottle':
        ripple(g, x, y, R, c.time, f.id);
        bottle(g, x, y + bob, R, c.time);
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
        ripple(g, x, y, R, c.time, f.id);
        boat(g, x, y + bob, R, c.time);
        break;
      case 'chest':
        ripple(g, x, y, R, c.time, f.id);
        chest(g, x, y + bob, R * 0.9, c.time, f.id);
        break;
    }
    if (f.kind !== 'flyfish') {
      clock(g, x, y + bob, R * 1.5 + Math.max(3, R * 0.2), f.ttl > 0 ? findLeft(state, f) / f.ttl : 0, Math.max(2, R * 0.12));
      label(g, f.kind === 'chest' && f.n ? `${findTitle(f.kind)} · ${f.n}` : findTitle(f.kind), x, y - R * 1.6 - Math.max(10, R * 0.5), '#e8ce78', c.zoom > 0.45 ? 12 : 11);
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
