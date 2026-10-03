// The drifting creatures on the sea (docs/18 #34, #40), strictly from above and drawn by hand: the raft of broken
// spars under a wounded serpent, a cracked floe with its rookery, a boat of the drowned in its green glow, a net with
// its floats and the sharks' fins circling it, a raft of weed, a floating mast white with gulls, a lost chain and its
// buoy in a cloud of ink; the creature's token on it (its own picture, or a tinted, framed token of one); the ring of
// its clock; and over it its name and the square's level. A legend wears gold rings and leaves a trail (blood for
// the whale, ink for the kraken). On the minimap: a mark with its clock; the tooltip names it.

import { beastFace, drawFace } from './beastface.ts';
import { DRIFTS } from '../../../shared/src/data/drifts.ts';
import type { DriftKind } from '../../../shared/src/data/drifts.ts';
import type { DriftMark } from '../../../shared/src/driftproto.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { sprite } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/drifts.ts';
import type { ClientState } from '../state.ts';
import { esc } from '../ui/dom.ts';

type G = CanvasRenderingContext2D;
const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

export interface DriftCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

export const driftTitle = (k: DriftKind): string => DRIFTS[k].name[ru()];

/** World seconds a mark has left now (its clock runs from when the list came). */
export function driftLeft(state: ClientState, m: DriftMark): number {
  return Math.max(0, m.left - (state.estServerTime() - state.driftsAt));
}

function rnd(seed: number): () => number {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** What it drifts on, by its kind, at a radius `R` (the token's). */
function raft(g: G, k: DriftKind, x: number, y: number, R: number, t: number, id: number): void {
  const r = rnd(id + 7);
  g.save();
  // A ripple ring the swell makes round anything afloat.
  const sw = 0.5 + 0.5 * Math.sin(t * 1.3 + id);
  g.strokeStyle = `rgba(200,225,235,${0.18 + 0.12 * sw})`;
  g.lineWidth = Math.max(1, R * 0.06);
  g.beginPath();
  g.ellipse(x, y, R * (2.1 + sw * 0.25), R * (1.8 + sw * 0.2), 0.2, 0, Math.PI * 2);
  g.stroke();
  switch (k) {
    case 'serpent_wreck':
    case 'white_whale': {
      // Broken spars and planks, crossed.
      if (k === 'white_whale') {
        // A blood trail astern of the whale.
        const grd = g.createLinearGradient(x, y, x - R * 4, y + R * 2);
        grd.addColorStop(0, 'rgba(150,20,20,0.45)');
        grd.addColorStop(1, 'rgba(150,20,20,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(x - R * 2, y + R, R * 2.6, R * 0.9, -0.45, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(210,200,170,0.75)';
        g.lineWidth = Math.max(1, R * 0.05);
        g.beginPath();
        g.moveTo(x - R * 0.6, y + R * 0.4);
        g.bezierCurveTo(x - R * 2, y + R * 1.6, x - R * 3, y + R * 0.4, x - R * 4.2, y + R * 1.4);
        g.stroke();
        break;
      }
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI, len = R * (1.4 + r() * 1.2), w = R * (0.14 + r() * 0.12);
        const ox = (r() - 0.5) * R * 1.4, oy = (r() - 0.5) * R * 1.2;
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(a);
        g.fillStyle = i % 2 ? '#6b4a2c' : '#82603a';
        g.fillRect(-len / 2, -w / 2, len, w);
        g.strokeStyle = 'rgba(30,20,10,0.7)';
        g.lineWidth = 1;
        g.strokeRect(-len / 2, -w / 2, len, w);
        g.restore();
      }
      break;
    }
    case 'seal_floe': {
      g.fillStyle = 'rgba(228,240,246,0.95)';
      g.strokeStyle = 'rgba(150,185,205,0.9)';
      g.lineWidth = Math.max(1, R * 0.06);
      g.beginPath();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const d = R * (1.55 + r() * 0.6);
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
      g.stroke();
      // Cracks.
      g.strokeStyle = 'rgba(120,160,185,0.8)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = r() * Math.PI * 2;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.5);
        g.lineTo(x + Math.cos(a + 0.3) * R * 1.3, y + Math.sin(a + 0.3) * R * 1.1);
        g.lineTo(x + Math.cos(a - 0.1) * R * 1.8, y + Math.sin(a - 0.1) * R * 1.5);
        g.stroke();
      }
      break;
    }
    case 'drowned_boat': {
      // A ship's boat from above (pointed at the bow), its thwarts, the green glow of the drowned.
      const grd = g.createRadialGradient(x, y, R * 0.2, x, y, R * 2.4);
      grd.addColorStop(0, 'rgba(90,200,150,0.35)');
      grd.addColorStop(1, 'rgba(90,200,150,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, R * 2.4, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(x, y);
      g.rotate(0.5);
      g.fillStyle = '#4d3a26';
      g.strokeStyle = '#1f150c';
      g.lineWidth = Math.max(1, R * 0.07);
      g.beginPath();
      g.moveTo(0, -R * 1.9);
      g.quadraticCurveTo(R * 0.95, -R * 0.6, R * 0.8, R * 1.5);
      g.lineTo(-R * 0.8, R * 1.5);
      g.quadraticCurveTo(-R * 0.95, -R * 0.6, 0, -R * 1.9);
      g.fill();
      g.stroke();
      g.strokeStyle = '#7b6040';
      for (const ty of [-0.5, 0.4, 1.1]) {
        g.beginPath();
        g.moveTo(-R * 0.75, R * ty);
        g.lineTo(R * 0.75, R * ty);
        g.stroke();
      }
      // Oars raised.
      g.strokeStyle = '#a58a5c';
      g.lineWidth = Math.max(1, R * 0.06);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * R * 0.7, R * 0.2);
        g.lineTo(s * R * 1.9, -R * 0.5);
        g.stroke();
      }
      g.restore();
      break;
    }
    case 'mermaid_net':
    case 'turtle_weed':
    case 'young_kraken': {
      if (k === 'turtle_weed') {
        // Strands of weed in a raft.
        g.strokeStyle = 'rgba(96,110,40,0.85)';
        g.lineWidth = Math.max(1.2, R * 0.12);
        for (let i = 0; i < 14; i++) {
          const a = r() * Math.PI * 2, d = R * (0.4 + r() * 1.6);
          const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;
          g.beginPath();
          g.moveTo(px, py);
          g.quadraticCurveTo(px + (r() - 0.5) * R, py + (r() - 0.5) * R, px + (r() - 0.5) * R * 1.4, py + (r() - 0.5) * R * 1.4);
          g.stroke();
        }
        break;
      }
      if (k === 'young_kraken') {
        // A cloud of ink and a wreck's rigging under the water.
        const grd = g.createRadialGradient(x, y, R * 0.3, x, y, R * 3.2);
        grd.addColorStop(0, 'rgba(20,10,30,0.7)');
        grd.addColorStop(1, 'rgba(20,10,30,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, R * 3.2, 0, Math.PI * 2);
        g.fill();
      }
      // A net: a disc of mesh and its cork floats.
      g.strokeStyle = k === 'young_kraken' ? 'rgba(150,140,110,0.6)' : 'rgba(215,205,170,0.8)';
      g.lineWidth = 1;
      const nr = R * 1.9;
      for (let i = -4; i <= 4; i++) {
        const o = (i / 4) * nr, c = Math.sqrt(Math.max(0, nr * nr - o * o));
        g.beginPath();
        g.moveTo(x + o, y - c);
        g.lineTo(x + o, y + c);
        g.stroke();
        g.beginPath();
        g.moveTo(x - c, y + o);
        g.lineTo(x + c, y + o);
        g.stroke();
      }
      g.fillStyle = '#c99a4a';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * nr, y + Math.sin(a) * nr, Math.max(1.5, R * 0.12), 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'gull_mast': {
      g.save();
      g.translate(x, y);
      g.rotate(-0.6);
      g.fillStyle = '#7a5a36';
      g.fillRect(-R * 2.6, -R * 0.16, R * 5.2, R * 0.32);
      g.fillRect(-R * 0.12, -R * 1.2, R * 0.24, R * 2.4);
      g.strokeStyle = 'rgba(30,20,10,0.8)';
      g.lineWidth = 1;
      g.strokeRect(-R * 2.6, -R * 0.16, R * 5.2, R * 0.32);
      g.restore();
      break;
    }
    case 'tentacle_chain': {
      const grd = g.createRadialGradient(x, y, R * 0.2, x, y, R * 2.4);
      grd.addColorStop(0, 'rgba(40,20,60,0.55)');
      grd.addColorStop(1, 'rgba(40,20,60,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, R * 2.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#8c8c8c';
      g.lineWidth = Math.max(1, R * 0.08);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * R * 1.6, y + Math.sin(a) * R * 1.6, R * 0.22, R * 0.12, a, 0, Math.PI * 2);
        g.stroke();
      }
      // The buoy.
      g.fillStyle = '#c4473a';
      g.beginPath();
      g.arc(x + R * 1.6, y - R * 0.2, Math.max(2, R * 0.3), 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  g.restore();
}

/** Sharks' fins circling (the mermaid's net, the seals' floe). */
function fins(g: G, x: number, y: number, R: number, t: number, id: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t * (0.5 + i * 0.07) + id + (i * Math.PI * 2) / 3;
    const d = R * (2.6 + 0.3 * Math.sin(t + i));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    const dir = a + Math.PI / 2;
    g.save();
    g.translate(px, py);
    g.rotate(dir);
    g.fillStyle = '#39454c';
    g.beginPath();
    g.moveTo(0, -R * 0.35);
    g.lineTo(R * 0.14, R * 0.2);
    g.lineTo(-R * 0.14, R * 0.2);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(220,235,240,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-R * 0.3, R * 0.35);
    g.lineTo(R * 0.3, R * 0.35);
    g.stroke();
    g.restore();
  }
}

/** Gulls wheeling over the mast (little bent strokes). */
function gulls(g: G, x: number, y: number, R: number, t: number): void {
  g.strokeStyle = 'rgba(245,245,240,0.9)';
  g.lineWidth = Math.max(1, R * 0.07);
  for (let i = 0; i < 5; i++) {
    const a = t * 0.9 + i * 1.3;
    const px = x + Math.cos(a) * R * (1.6 + (i % 2) * 0.5), py = y + Math.sin(a) * R * 1.3;
    const fl = Math.sin(t * 6 + i) * R * 0.08;
    g.beginPath();
    g.moveTo(px - R * 0.25, py + fl);
    g.quadraticCurveTo(px - R * 0.1, py - R * 0.12, px, py);
    g.quadraticCurveTo(px + R * 0.1, py - R * 0.12, px + R * 0.25, py + fl);
    g.stroke();
  }
}

/** The creature's token: its picture in a dark disc, tinted and brass-rimmed where it stands in for one. */
function token(g: G, x: number, y: number, R: number, m: DriftMark): void {
  const u = DRIFTS[m.kind].u;
  const face = beastFace(u);
  const sp = sprite(face.id);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + R * 0.12, y + R * 0.22, R * 1.02, R * 0.86, 0, 0, Math.PI * 2);
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
    if (face.tint) g.filter = face.tint;
    drawFace(g, sp.img, x, y, R, face.fig);
    g.filter = 'none';
    g.restore();
  }
  if (face.tint) {
    g.strokeStyle = '#a8894e';
    g.lineWidth = Math.max(1.5, R * 0.12);
    g.beginPath();
    g.arc(x, y, R - R * 0.06, 0, Math.PI * 2);
    g.stroke();
  }
}

/** The ring of its clock: how much of its time is left (teal; gold for a legend). */
function clock(g: G, x: number, y: number, r: number, share: number, legend: boolean, w: number): void {
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = w + 2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = legend ? 'rgba(240,200,100,0.95)' : 'rgba(110,215,205,0.95)';
  g.lineWidth = w;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, share)));
  g.stroke();
  g.restore();
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

/** Every drift in sight on the sea. */
export function drawDriftsWorld(g: G, state: ClientState, c: DriftCtx): void {
  const list = state.drifts;
  if (!list.length || c.zoom < 0.06) return;
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  for (const m of list) {
    const x = c.sx(m.x), y = c.sy(m.y);
    const R = Math.max(9, Math.min(m.legend ? 34 : 24, (m.legend ? 40 : 22) * c.zoom));
    if (x < -R * 5 || y < -R * 5 || x > c.w + R * 5 || y > c.h + R * 5) continue;
    const bob = Math.sin(c.time * 1.6 + m.id) * R * 0.05;
    g.save();
    raft(g, m.kind, x, y + bob, R, c.time, m.id);
    if (m.kind === 'mermaid_net' || m.kind === 'seal_floe') fins(g, x, y, R, c.time, m.id);
    token(g, x, y + bob, R, m);
    if (m.kind === 'gull_mast') gulls(g, x, y, R, c.time);
    const left = driftLeft(state, m);
    clock(g, x, y + bob, R + Math.max(3, R * 0.18), m.ttl > 0 ? left / m.ttl : 0, !!m.legend, Math.max(2, R * 0.12));
    if (m.legend) {
      const pulse = 0.5 + 0.5 * Math.sin(c.time * 2);
      g.strokeStyle = `rgba(240,200,100,${0.35 + 0.4 * pulse})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y + bob, R * 1.7 + pulse * 3, 0, Math.PI * 2);
      g.stroke();
    }
    const col = m.legend ? '#f0c864' : THREAT_COLOR[threatOf(mine, m.level)];
    label(g, `${driftTitle(m.kind)} · ⚓${m.level}`, x, y - R - Math.max(10, R * 0.5), col, c.zoom > 0.45 ? 12 : 11);
    if (m.taken) label(g, L('taken'), x, y + R + 12, '#d8c8a0', 10);
    g.restore();
  }
}

/** The drifts on the minimap: a teal diamond (a gold star for a legend) with its clock. */
export function drawDriftsMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  for (const m of state.drifts) {
    if (Math.abs(m.x - own.x) > range || Math.abs(m.y - own.y) > range) continue;
    const x = tx(m.x), y = ty(m.y);
    const s = m.legend ? 5.5 : 4;
    g.save();
    g.fillStyle = m.legend ? '#f0c864' : '#6ed7cd';
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.lineWidth = 1.2;
    g.beginPath();
    if (m.legend) {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.45 : s;
        if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    } else {
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    clock(g, x, y, s + 3, m.ttl > 0 ? driftLeft(state, m) / m.ttl : 0, !!m.legend, 1.6);
  }
}

/** The minimap's tooltip over a drift: its name, level and time left. */
export function driftTip(state: ClientState, x: number, y: number, slack: number): string | null {
  for (const m of state.drifts) {
    if (Math.hypot(m.x - x, m.y - y) > slack + 60) continue;
    const mins = Math.max(1, Math.ceil(driftLeft(state, m) / 60));
    return `${esc(driftTitle(m.kind))} · ⚓${m.level}${m.legend ? ` · ${esc(L('tag.legend'))}` : ''}<br>${esc(L('left', { t: lang() === 'ru' ? `${mins} мин` : `${mins} min` }))}`;
  }
  return null;
}
