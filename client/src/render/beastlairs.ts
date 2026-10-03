// The lairs of the land's creatures on the islands (docs/18 II #13), strictly from above: the trampled ground of the
// lair (sand scraped bare, a ring of stones, bones, a nest), the creature's token on it — its own picture, or a
// tinted, framed token of one where it has none — red-ringed while it stands, grey once beaten; a dwelling's flag over
// it (gold hers, red another's); the chain's step; and over it HoMM3's word for their number and the lair's level,
// read from the sea («Стая · ⚓4»).

import { beastFace, drawFace } from './beastface.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import type { LairMark } from '../../../shared/src/lairproto.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { turtlePos } from '../../../shared/src/world/drift.ts';
import { sprite } from '../assets.ts';
import { lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/lairs.ts';
import type { ClientState } from '../state.ts';
import { strengthWord } from '../ui/army.ts';
import { turtleDef } from './isletype.ts';

type G = CanvasRenderingContext2D;

export interface LairCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

function seeded(seed: string): () => number {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 16777619);
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** The lair's ground: sand scraped bare, a ring of stones, bones or a nest by its kind. */
function ground(g: G, x: number, y: number, r: number, m: LairMark): void {
  const rnd = seeded(m.id);
  const grd = g.createRadialGradient(x, y, r * 0.15, x, y, r);
  const dead = m.kind === 'choir_circle' || m.kind === 'maw_pit' || m.kind === 'drowned_surf' || m.kind === 'leviathan_shoal';
  grd.addColorStop(0, dead ? 'rgba(40,52,60,0.75)' : m.role === 'grotto' ? 'rgba(20,16,12,0.8)' : 'rgba(120,96,62,0.7)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.85, 0.3, 0, Math.PI * 2);
  g.fill();
  // Stones (a cult's ring, a grotto's mouth) or bones and shells about it.
  const n = m.role === 'guardian' ? 10 : 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
    const d = r * (0.62 + rnd() * 0.25);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    if (m.kind === 'choir_circle' || m.role === 'grotto') {
      g.fillStyle = m.role === 'grotto' ? '#2a2620' : '#5b6670';
      g.beginPath();
      g.arc(px, py, Math.max(1.2, r * 0.07), 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = 'rgba(225,215,190,0.75)';
      g.lineWidth = Math.max(1, r * 0.025);
      g.beginPath();
      g.moveTo(px - r * 0.05, py);
      g.lineTo(px + r * 0.05, py + r * 0.02);
      g.stroke();
    }
  }
}

/** A creature's token from above: its picture in a dark disc, tinted where it is a stand-in, ringed. */
function token(g: G, x: number, y: number, R: number, m: LairMark, t: number): void {
  const u = LAIRS[m.kind].mix[0][0];
  const face = beastFace(u);
  const sp = sprite(face.id);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(x + R * 0.12, y + R * 0.25, R * 1.02, R * 0.85, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#15110d';
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  if (sp) {
    g.save();
    g.beginPath();
    g.arc(x, y, R - 1, 0, Math.PI * 2);
    g.clip();
    const tint = face.tint;
    if (tint) g.filter = tint;
    if (m.down) g.filter = `${tint ?? ''} grayscale(1) brightness(0.6)`.trim();
    drawFace(g, sp.img, x, y, R, face.fig);
    g.filter = 'none';
    g.restore();
  }
  // A stand-in's frame (a brass rim), the lair's ring (red while it stands, pulsing; grey once beaten).
  if (face.tint) {
    g.strokeStyle = '#a8894e';
    g.lineWidth = Math.max(1.5, R * 0.12);
    g.beginPath();
    g.arc(x, y, R - R * 0.06, 0, Math.PI * 2);
    g.stroke();
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + x * 0.01);
  g.strokeStyle = m.down ? 'rgba(170,170,160,0.55)' : `rgba(208,70,52,${0.6 + 0.35 * pulse})`;
  g.lineWidth = Math.max(1.5, R * 0.14);
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.stroke();
  if (m.role === 'guardian') {
    g.strokeStyle = m.down ? 'rgba(170,170,160,0.4)' : 'rgba(232,196,106,0.85)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, R + 4, 0, Math.PI * 2);
    g.stroke();
  }
}

/** A dwelling's pennant on a staff by the token: gold hers, red another captain's. */
function pennant(g: G, x: number, y: number, R: number, own: boolean, t: number): void {
  const bx = x + R * 0.9, by = y - R * 0.6;
  g.strokeStyle = '#2a1e14';
  g.lineWidth = Math.max(1, R * 0.08);
  g.beginPath();
  g.moveTo(bx, by + R * 0.9);
  g.lineTo(bx, by - R * 0.5);
  g.stroke();
  const flap = Math.sin(t * 5 + x) * R * 0.08;
  g.fillStyle = own ? '#e8c46a' : '#c4473a';
  g.beginPath();
  g.moveTo(bx, by - R * 0.5);
  g.lineTo(bx + R * 0.75 + flap, by - R * 0.32);
  g.lineTo(bx, by - R * 0.12);
  g.closePath();
  g.fill();
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

/** Every lair she has seen, on its island: the ground, the token, the flag, and its word and level read from the sea. */
export function drawLairsWorld(g: G, state: ClientState, c: LairCtx): void {
  const list = state.lairs?.list;
  if (!list?.length || c.zoom < 0.08) return;
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  const now = state.estServerTime();
  const ru = lang() === 'ru';
  const W = ru ? RU : EN;
  for (const m of list) {
    let wx = m.x, wy = m.y;
    if (m.turtle !== undefined) {
      const tv = state.turtles.find((t) => t.id === m.turtle);
      if (!tv || !tv.up) continue;
      const p = turtlePos(turtleDef(tv), now);
      wx = p.x;
      wy = p.y;
    }
    const x = c.sx(wx), y = c.sy(wy);
    const R = Math.max(9, Math.min(26, (m.role === 'guardian' ? 34 : m.role === 'grotto' ? 28 : 24) * c.zoom));
    if (x < -R * 4 || y < -R * 4 || x > c.w + R * 4 || y > c.h + R * 4) continue;
    g.save();
    if (c.zoom >= 0.25) ground(g, x, y, R * 2.1, m);
    token(g, x, y, R, m, c.time);
    if (m.flag) pennant(g, x, y, R, m.flag === 'own', c.time);
    // HoMM3's word and the level over it, in the ladder's colour against her ship; «разбито» once beaten.
    const w = strengthWord(m.men);
    const col = THREAT_COLOR[threatOf(mine, m.level)];
    label(g, m.down ? `${W['tag.down']} · ⚓${m.level}` : `${w.word} · ⚓${m.level}`, x, y - R - 9, m.down ? '#b9c2a8' : col, c.zoom > 0.45 ? 12 : 11);
    if (c.zoom > 0.55) label(g, LAIRS[m.kind].name[ru ? 1 : 0], x, y + R + 11, '#f0d58f', 10.5);
    g.restore();
  }
}
