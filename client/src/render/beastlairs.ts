// The lairs of the land's creatures on the islands (docs/18 II #13), strictly from above and from the art (owner,
// 2026-10-07: no drawn signs): the earth trampled bare about the lair with a ring of the battle sheet's boulders, the
// creature's token in the UI's brass ring — its own picture, or a tinted one that stands in for it — with a red enamel
// bezel while it stands, grey once beaten; a dwelling's painted pennant over it (gold hers, red another's); and over
// it the lair's level in its frame and HoMM3's word for their number, read from the sea («[4] Стая»).

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
import { TOKEN_IN, addHot, bezel, drawArt, drawPiece, levelTag, markRing, put, tokenStamp, word } from './seaart.ts';

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

/** The lair's ground: the earth trampled bare about it (a soft shading, no drawn ring) and a ring of the battle
 *  sheet's boulders — a cult's circle, a grotto's mouth, the stones a beast has dragged about its nest. */
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
  const n = m.role === 'guardian' ? 9 : 6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
    const d = r * (0.66 + rnd() * 0.22);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    if (!drawArt(g, 'prop.bt_boulder', px, py, r * (0.13 + rnd() * 0.07), rnd() * 6.28, m.role === 'grotto' ? 0.8 : 0.95)) {
      g.fillStyle = m.role === 'grotto' ? '#2a2620' : '#5b6670';
      g.beginPath();
      g.arc(px, py, Math.max(1.2, r * 0.07), 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** The creature's picture in the token: its own figure from the head down, or the tinted picture that stands in;
 *  grey once beaten. */
function face(u: string, down: boolean): (g: G, cx: number, cy: number, r: number) => boolean {
  return (g, cx, cy, r) => {
    const f = beastFace(u);
    const sp = sprite(f.id);
    if (!sp) return false;
    g.filter = down ? `${f.tint ?? ''} grayscale(1) brightness(0.6)`.trim() : f.tint ?? 'none';
    drawFace(g, sp.img, cx, cy, r, f.fig);
    g.filter = 'none';
    return true;
  };
}

/** A creature's token from above: its picture in the UI's brass ring (stamped), the enamel bezel red while the lair
 *  stands (breathing), grey once beaten; a guardian's engraved gold ring about it. */
function token(g: G, x: number, y: number, R: number, m: LairMark, t: number): void {
  const u = LAIRS[m.kind].mix[0][0];
  const c = tokenStamp(`lair|${u}|${m.down ? 1 : 0}`, R, face(u, !!m.down), false);
  if (c) put(g, c, x, y);
  else {
    g.fillStyle = '#15110d';
    g.beginPath();
    g.arc(x, y, R * TOKEN_IN, 0, Math.PI * 2);
    g.fill();
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + x * 0.01);
  bezel(g, x, y, R, m.down ? 'rgba(170,170,160,0.9)' : '#d04634', m.down ? 0.55 : 0.6 + 0.35 * pulse);
  if (m.role === 'guardian') markRing(g, x, y, R * 1.45, m.down ? '#aaaaa0' : '#e8c46a', false, m.down ? 0.6 : 0.95);
}

/** A dwelling's pennant on a staff by the token (the painted pennant, dyed): gold hers, red another captain's. */
function pennant(g: G, x: number, y: number, R: number, own: boolean, t: number): void {
  const bx = x + R * 0.95, by = y - R * 0.65;
  g.strokeStyle = '#2a1e14';
  g.lineWidth = Math.max(1, R * 0.08);
  g.beginPath();
  g.moveTo(bx, by + R * 0.9);
  g.lineTo(bx, by - R * 0.5);
  g.stroke();
  const L0 = R * 1.25;
  if (!drawPiece(g, 'pennant', bx + L0 * 0.5, by - R * 0.42, L0, Math.sin(t * 3 + x) * 0.06, 1, own ? '#c9a24a' : '#8e2a24')) {
    g.fillStyle = own ? '#e8c46a' : '#c4473a';
    g.beginPath();
    g.moveTo(bx, by - R * 0.5);
    g.lineTo(bx + R * 0.75, by - R * 0.32);
    g.lineTo(bx, by - R * 0.12);
    g.closePath();
    g.fill();
  }
}

/** Every lair she has seen, on its island: the ground, the token, the flag, and its level and word read from the sea. */
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
    addHot(x, y, R * 1.25);
    token(g, x, y, R, m, c.time);
    if (m.flag) pennant(g, x, y, R, m.flag === 'own', c.time);
    // The level in its frame in the ladder's colour against her ship, HoMM3's word beside it; «разбито» once beaten.
    const col = THREAT_COLOR[threatOf(mine, m.level)];
    const big = c.zoom > 0.45 ? 12 : 11;
    levelTag(g, m.down ? W['tag.down'] : strengthWord(m.men).word, m.level, m.down ? '#9a9f94' : col, x, y - R * 1.2 - 8, big, m.down ? '#b9c2a8' : '#e9dfc6');
    if (c.zoom > 0.55) word(g, LAIRS[m.kind].name[ru ? 1 : 0], x, y + R * 1.2 + 8, '#f0d58f', 10.5);
    g.restore();
  }
}
