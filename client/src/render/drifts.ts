// The drifting creatures on the sea (docs/18 #34, #40), strictly from above and from the art (owner, 2026-10-07: no
// drawn signs): the painted wreckage under a wounded serpent, a plate of the shore ice with its rookery, the islands'
// boat in the green glow of the drowned, the fisherman's net with its weights and the sharks circling it under the
// water, a mat of weed, the floating mast with its torn sail white with the painted gulls, a length of chain and its
// iron buoy in a cloud of ink; the creature's token in the UI's brass ring (its own picture, or a tinted one that
// stands in); over it its name and level with a small brass clock of its time. A legend wears gold and its golden light
// on the water, and leaves the white water of its wake (the whale; the kraken its ink). On the minimap: a mark with its
// clock; the tooltip names it.

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
import { TOKEN_IN, addHot, bezel, circlers, clockBadge, drawArt, drawPiece, foam, icePlate, levelTag, put, tokenStamp, word } from './seaart.ts';
import { gulls } from './sights.ts';

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

/** What it drifts on, by its kind, at a radius `R` (the token's) — from the art: the painted wreckage, a plate of the
 *  shore ice, the islands' boat in the green glow of the drowned, the fisherman's net with its weights, a mat of the
 *  mossy isles' weed, the floating mast with its torn sail, a length of chain and its iron buoy in a cloud of ink. */
function raft(g: G, k: DriftKind, x: number, y: number, R: number, t: number, id: number): void {
  const r = rnd(id + 7);
  g.save();
  // The white water the swell makes about anything afloat (the painted spray, not a drawn ring).
  foam(g, x, y, R * 1.7, t, id, 0.16);
  switch (k) {
    case 'serpent_wreck':
      drawArt(g, 'prop.wreckage', x, y, R * 4.4, id * 0.9, 0.9) || planks(g, x, y, R, r);
      break;
    case 'white_whale': {
      // The white water of her wake astern (no blood: CLAUDE.md §2), fading.
      for (let i = 1; i <= 5; i++) {
        const u = i / 5;
        foam(g, x - R * (0.9 + u * 3.2), y + R * (0.4 + Math.sin(u * 3 + t * 0.4) * 0.5), R * (0.75 - u * 0.35), t, id + i, 0.2 * (1 - u * 0.7));
      }
      break;
    }
    case 'seal_floe':
      icePlate(g, x, y, R * 2.1, 14, id * 0.37, r, 1);
      break;
    case 'drowned_boat': {
      // The green glow of the drowned about her (light, not a shape), the boat dark and low.
      const grd = g.createRadialGradient(x, y, R * 0.2, x, y, R * 2.4);
      grd.addColorStop(0, 'rgba(90,200,150,0.3)');
      grd.addColorStop(1, 'rgba(90,200,150,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, R * 2.4, 0, Math.PI * 2);
      g.fill();
      drawPiece(g, 'drownedBoat', x, y, R * 4, 0.5, 0.92);
      break;
    }
    case 'mermaid_net':
    case 'turtle_weed':
    case 'young_kraken': {
      if (k === 'turtle_weed') {
        drawPiece(g, 'weed', x, y, R * 4.4, id * 0.6, 0.95);
        break;
      }
      if (k === 'young_kraken') {
        // A cloud of ink, and the net of a wreck's rigging dark under it.
        const grd = g.createRadialGradient(x, y, R * 0.3, x, y, R * 3.2);
        grd.addColorStop(0, 'rgba(20,10,30,0.7)');
        grd.addColorStop(1, 'rgba(20,10,30,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, R * 3.2, 0, Math.PI * 2);
        g.fill();
      }
      drawPiece(g, 'net', x, y, R * 3.9, id * 0.8, k === 'young_kraken' ? 0.55 : 0.9);
      break;
    }
    case 'gull_mast':
      drawArt(g, 'prop.wreckage', x, y, R * 4.6, -0.6 + id * 0.3, 0.95) || planks(g, x, y, R, r);
      break;
    case 'tentacle_chain': {
      const grd = g.createRadialGradient(x, y, R * 0.2, x, y, R * 2.4);
      grd.addColorStop(0, 'rgba(40,20,60,0.55)');
      grd.addColorStop(1, 'rgba(40,20,60,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, R * 2.4, 0, Math.PI * 2);
      g.fill();
      // The chain in a loose ring about it, and its iron buoy.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + id;
        drawPiece(g, 'chain', x + Math.cos(a) * R * 1.55, y + Math.sin(a) * R * 1.4, R * 1.5, a + Math.PI / 2, 0.9);
      }
      drawPiece(g, 'redBuoy', x + R * 1.75, y - R * 0.3, R * 0.8, id);
      break;
    }
  }
  g.restore();
}

/** Broken spars, crossed: the stand-in while the wreckage loads. */
function planks(g: G, x: number, y: number, R: number, r: () => number): boolean {
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI, len = R * (1.4 + r() * 1.2), w = R * (0.14 + r() * 0.12);
    g.save();
    g.translate(x + (r() - 0.5) * R * 1.4, y + (r() - 0.5) * R * 1.2);
    g.rotate(a);
    g.fillStyle = i % 2 ? '#6b4a2c' : '#82603a';
    g.fillRect(-len / 2, -w / 2, len, w);
    g.restore();
  }
  return true;
}

/** The creature's picture in the token: its own figure from the head down, or the tinted picture that stands in. */
function face(u: string): (g: G, cx: number, cy: number, r: number) => boolean {
  return (g, cx, cy, r) => {
    const f = beastFace(u);
    const sp = sprite(f.id);
    if (!sp) return false;
    if (f.tint) g.filter = f.tint;
    drawFace(g, sp.img, cx, cy, r, f.fig);
    g.filter = 'none';
    return true;
  };
}

/** The creature's token: its picture in the UI's brass ring (stamped), the enamel bezel in the ladder's colour — gold
 *  for a legend. */
function token(g: G, x: number, y: number, R: number, m: DriftMark, col: string, t: number): void {
  const u = DRIFTS[m.kind].u;
  const c = tokenStamp(`drift|${u}`, R, face(u), false);
  if (c) put(g, c, x, y);
  else {
    g.fillStyle = '#10161a';
    g.beginPath();
    g.arc(x, y, R * TOKEN_IN, 0, Math.PI * 2);
    g.fill();
  }
  bezel(g, x, y, R, col, 0.7 + 0.3 * Math.sin(t * 2 + m.id));
}

/** The ring of its clock (the minimap's): how much of its time is left (teal; gold for a legend). */
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

/** Every drift in sight on the sea: what it drifts on, the creatures about it (fins under the water, gulls over the
 *  mast), its token, and over it its name and level with a small brass clock of its time; a legend in gold, its
 *  golden light about it. */
export function drawDriftsWorld(g: G, state: ClientState, c: DriftCtx): void {
  const list = state.drifts;
  if (!list.length || c.zoom < 0.06) return;
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  for (const m of list) {
    const x = c.sx(m.x), y = c.sy(m.y);
    const R = Math.max(9, Math.min(m.legend ? 34 : 24, (m.legend ? 40 : 22) * c.zoom));
    if (x < -R * 5 || y < -R * 5 || x > c.w + R * 5 || y > c.h + R * 5) continue;
    const bob = Math.sin(c.time * 1.6 + m.id) * R * 0.05;
    const col = m.legend ? '#f0c864' : THREAT_COLOR[threatOf(mine, m.level)];
    g.save();
    if (m.legend) {
      // A legend's light on the water about it, breathing.
      const pulse = 0.5 + 0.5 * Math.sin(c.time * 2);
      const glow = g.createRadialGradient(x, y, R * 0.8, x, y, R * 2.6);
      glow.addColorStop(0, `rgba(240,200,100,${0.16 + 0.1 * pulse})`);
      glow.addColorStop(1, 'rgba(240,200,100,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, R * 2.6, 0, Math.PI * 2);
      g.fill();
    }
    raft(g, m.kind, x, y + bob, R, c.time, m.id);
    if (m.kind === 'mermaid_net' || m.kind === 'seal_floe') circlers(g, 'monster.shark', x, y, R * 2.7, R * 1.3, 3, c.time, m.id, 0.5, 0.5);
    addHot(x, y + bob, R * 1.25);
    token(g, x, y + bob, R, m, col, c.time);
    if (m.kind === 'gull_mast') {
      g.translate(x, y);
      gulls(g, 5, Math.max(0.7, R / 24), c.time + m.id, R * 1.8);
      g.translate(-x, -y);
    }
    const ly = y - R * 1.2 - Math.max(9, R * 0.35);
    const half = levelTag(g, driftTitle(m.kind), m.level, col, x + 9, ly, c.zoom > 0.45 ? 12 : 11, m.legend ? '#f4dc96' : '#e9dfc6');
    clockBadge(g, x + 9 - half - 7, ly, 7, m.ttl > 0 ? driftLeft(state, m) / m.ttl : 0, m.legend ? 'rgba(240,200,100,0.95)' : 'rgba(110,215,205,0.95)');
    if (m.taken) word(g, L('taken'), x, y + R * 1.2 + 9, '#d8c8a0', 10);
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
