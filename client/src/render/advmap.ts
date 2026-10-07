// The adventure map on the water (docs/17 H4), strictly from above: each thing on its own skerry — a ring of the painted
// rock, wet and dark toward the water, the swell breaking white about it — with the painted prop on it (the chest, the
// altar, the well, the bell tower, the mill with its sails turning, the warehouse's crates, the sea fort of the prison)
// or the obelisk, a black stone drawn by hand with its rune glowing; the engraved gold ring of a mark on what she may
// visit now, a faint one when she has. The guards stand as what they are: a pirate hold-out's camp on a rock beside its
// ship at anchor under the painted black pennant, a rotting hulk among the painted flotsam, the wreck of the drowned in
// a sick light, a pack of the deep circling in the water — and HoMM3's word for their number over them.

import { OBJS } from '../../../shared/src/data/advmap.ts';
import type { GuardMark, ObjMark } from '../../../shared/src/h4proto.ts';
import { pattern, sprite } from '../assets.ts';
import { drawArt, drawPiece, foam, markRing } from './seaart.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h4.ts';
import type { ClientState } from '../state.ts';
import { strengthWord } from '../ui/army.ts';

const L = dict(EN, RU);
type G = CanvasRenderingContext2D;

export interface AdvCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

const ru = () => (lang() === 'ru' ? 1 : 0);

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

/** A skerry: a ragged ring of the painted rock (tex.rock, its grain riding with it), dark and wet toward the water,
 *  the white water of the swell breaking about it (the painted spray, not a drawn ring). */
function skerry(g: G, x: number, y: number, r: number, id: string, t: number): void {
  const rnd = seeded(id);
  const n = 11;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r * (0.78 + rnd() * 0.35);
    pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k]);
  }
  const path = (s: number) => {
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n], q = pts[(i + 1) % n];
      const mx = x + ((p[0] + q[0]) / 2 - x) * s, my = y + ((p[1] + q[1]) / 2 - y) * s;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(x + (p[0] - x) * s, y + (p[1] - y) * s, mx, my);
    }
    g.closePath();
  };
  foam(g, x, y, r * 1.05, t, rnd() * 100, 0.22);
  path(1.04);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();
  path(1);
  const rock = pattern(g, 'tex.rock'), spr = sprite('tex.rock');
  if (rock && spr) rock.setTransform(new DOMMatrix().translate(x - r, y - r).scale((r * 2.6) / spr.img.naturalWidth));
  g.fillStyle = rock ?? '#4f4b44';
  g.fill();
  // Wet and dark toward the water, the light on its crown.
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.05);
  grd.addColorStop(0, 'rgba(200,196,180,0.12)');
  grd.addColorStop(0.65, 'rgba(10,14,16,0.1)');
  grd.addColorStop(1, 'rgba(6,10,12,0.6)');
  g.fillStyle = grd;
  g.fill();
}

/** The obelisk from above: a black needle of stone, its long shadow, its rune alight. */
function obelisk(g: G, x: number, y: number, s: number, lit: boolean, t: number): void {
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.moveTo(x - s * 0.18, y + s * 0.1);
  g.lineTo(x + s * 0.9, y + s * 0.55);
  g.lineTo(x + s * 0.9, y + s * 0.75);
  g.lineTo(x + s * 0.18, y + s * 0.3);
  g.closePath();
  g.fill();
  const faces: [string, number[]][] = [
    ['#2a2a30', [-0.22, -0.22, 0.22, -0.22, 0, 0]],
    ['#3d3c46', [0.22, -0.22, 0.22, 0.22, 0, 0]],
    ['#1b1b20', [0.22, 0.22, -0.22, 0.22, 0, 0]],
    ['#33323b', [-0.22, 0.22, -0.22, -0.22, 0, 0]],
  ];
  for (const [col, p] of faces) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x + p[0] * s, y + p[1] * s);
    g.lineTo(x + p[2] * s, y + p[3] * s);
    g.lineTo(x + p[4] * s, y + p[5] * s);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 1;
  g.strokeRect(x - s * 0.22, y - s * 0.22, s * 0.44, s * 0.44);
  const a = lit ? 0.55 + 0.35 * Math.sin(t * 2.2) : 0.25;
  g.fillStyle = `rgba(120,230,210,${a})`;
  g.beginPath();
  g.arc(x, y, Math.max(1.5, s * 0.07), 0, Math.PI * 2);
  g.fill();
  if (lit) {
    const glow = g.createRadialGradient(x, y, 0, x, y, s * 0.5);
    glow.addColorStop(0, `rgba(120,230,210,${0.35 * a})`);
    glow.addColorStop(1, 'rgba(120,230,210,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, s * 0.5, 0, Math.PI * 2);
    g.fill();
  }
}

/** The mill's four sails, turning in the wind. */
function vanes(g: G, x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(t * 0.8);
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(225,214,186,0.92)';
    g.fillRect(s * 0.04, -s * 0.05, s * 0.5, s * 0.12);
    g.strokeStyle = '#3a2c1c';
    g.lineWidth = Math.max(1, s * 0.02);
    g.strokeRect(s * 0.04, -s * 0.05, s * 0.5, s * 0.12);
  }
  g.fillStyle = '#3a2c1c';
  g.beginPath();
  g.arc(0, 0, s * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function label(g: G, text: string, x: number, y: number, col: string): void {
  g.font = '600 11px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fillText(text, x + 1, y + 1);
  g.fillStyle = col;
  g.fillText(text, x, y);
}

/** The things on the map she has seen, on their skerries. */
export function drawAdvWorld(g: G, state: ClientState, c: AdvCtx): void {
  const list = state.adv?.objs;
  if (!list?.length || c.zoom < 0.1) return;
  for (const o of list) drawObj(g, o, c);
}

function drawObj(g: G, o: ObjMark, c: AdvCtx): void {
  const x = c.sx(o.x), y = c.sy(o.y);
  const s = Math.max(22, 54 * c.zoom);
  if (x < -s * 2 || y < -s * 2 || x > c.w + s * 2 || y > c.h + s * 2) return;
  g.save();
  skerry(g, x, y, s * 0.62, o.id, c.time);
  g.globalAlpha = o.ready ? 1 : 0.7;
  if (o.kind === 'obelisk') obelisk(g, x, y, s * 0.95, o.ready, c.time);
  else {
    const art = sprite(OBJS[o.kind].art);
    if (art) {
      const k = (s * 1.05) / Math.max(art.extentX, art.extentY);
      const iw = k, ih = k * (art.img.naturalHeight / art.img.naturalWidth);
      g.drawImage(art.img, x - iw * art.cx, y - ih * art.cy, iw, ih);
    }
    if (o.kind === 'mill') vanes(g, x + s * 0.05, y - s * 0.05, s * 0.9, c.time);
  }
  g.globalAlpha = 1;
  // The engraved ring of a mark: gold on what she may visit now (red while a guard stands before it), faint once she has.
  const pulse = 0.5 + 0.5 * Math.sin(c.time * 2 + o.x);
  if (o.guarded) markRing(g, x, y, s * 0.85, '#d0503c', false, 0.75 + 0.25 * pulse);
  else if (o.ready) markRing(g, x, y, s * 0.85, '#e8c46a', true, 0.7 + 0.3 * pulse);
  else markRing(g, x, y, s * 0.85, '#c8c8be', false, 0.45);
  if (c.zoom > 0.55) label(g, OBJS[o.kind].name[ru()], x, y + s * 0.85 + 13, o.ready ? '#f0d58f' : '#b9c2a8');
  g.restore();
}

/** A guard's ship drawn as the guard it is (false: draw her hull as usual, over what was drawn here). */
export function drawGuardShip(g: G, state: ClientState, s: { id: number; x: number; y: number; h: number; classId: string }, len: number, c: AdvCtx): boolean {
  const m = guardOfEntity(state, s.id);
  if (!m) return false;
  const x = c.sx(s.x), y = c.sy(s.y);
  const L0 = Math.max(18, len);
  switch (m.kind) {
    case 'holdout': {
      // The camp on a rock beside her: tents, a stockade, the black flag.
      // Below her and astern on the screen: clear of her name and strength over her.
      const ox = x - L0 * 1.05, oy = y + L0 * 0.7;
      skerry(g, ox, oy, L0 * 0.55, m.id, c.time);
      const tent = sprite('prop.life_pirate_tent');
      if (tent) {
        const w = L0 * 0.9, hh = w * (tent.img.naturalHeight / tent.img.naturalWidth);
        g.drawImage(tent.img, ox - w / 2, oy - hh / 2, w, hh);
      }
      g.strokeStyle = '#2a1e14';
      g.lineWidth = Math.max(1, L0 * 0.03);
      g.beginPath();
      g.moveTo(ox + L0 * 0.3, oy);
      g.lineTo(ox + L0 * 0.3, oy - L0 * 0.45);
      g.stroke();
      // The black flag: the painted pennant, dyed black.
      if (!drawPiece(g, 'pennant', ox + L0 * 0.5, oy - L0 * 0.42, L0 * 0.42, Math.sin(c.time * 3 + s.id) * 0.06, 1, '#121212')) {
        g.fillStyle = '#111';
        g.beginPath();
        g.moveTo(ox + L0 * 0.3, oy - L0 * 0.45);
        g.lineTo(ox + L0 * 0.58, oy - L0 * 0.4);
        g.lineTo(ox + L0 * 0.3, oy - L0 * 0.32);
        g.closePath();
        g.fill();
      }
      return false;
    }
    case 'hulk':
    case 'wreck': {
      const spr = sprite(m.kind === 'hulk' ? 'monster.hulk' : 'prop.shipwreck');
      g.save();
      g.translate(x, y);
      g.rotate(s.h + (m.kind === 'wreck' ? 0.35 : 0.12));
      if (spr) {
        const ih = (L0 * 1.15) / spr.extentY, iw = ih * (spr.img.naturalWidth / spr.img.naturalHeight);
        if (m.kind === 'wreck') g.filter = 'saturate(0.55) hue-rotate(60deg) brightness(0.85)';
        g.drawImage(spr.img, -iw * spr.cx, -ih * spr.cy, iw, ih);
        g.filter = 'none';
      }
      g.restore();
      // Rot-light about the wreck of the drowned, and the swell breaking white on her.
      if (m.kind === 'wreck') {
        const a = 0.25 + 0.15 * Math.sin(c.time * 1.7 + s.id);
        const glow = g.createRadialGradient(x, y, 0, x, y, L0 * 0.9);
        glow.addColorStop(0, `rgba(80,220,180,${a})`);
        glow.addColorStop(1, 'rgba(80,220,180,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(x, y, L0 * 0.9, 0, Math.PI * 2);
        g.fill();
        foam(g, x, y, L0 * 0.45, c.time, s.id, 0.16);
      } else {
        // Flotsam about the hulk: the painted casks and planks.
        const rnd = seeded(m.id);
        for (let k = 0; k < 5; k++) {
          const ang = rnd() * Math.PI * 2, r = L0 * (0.6 + rnd() * 0.5);
          drawArt(g, 'prop.flotsam', x + Math.cos(ang) * r, y + Math.sin(ang) * r, L0 * (0.12 + rnd() * 0.08), rnd() * 6.28, 0.85);
        }
      }
      return true;
    }
    case 'beasts': {
      // Dark water where they nest, and the pack circling it.
      const swirl = g.createRadialGradient(x, y, 0, x, y, L0 * 1.2);
      swirl.addColorStop(0, 'rgba(5,20,25,0.55)');
      swirl.addColorStop(1, 'rgba(5,20,25,0)');
      g.fillStyle = swirl;
      g.beginPath();
      g.arc(x, y, L0 * 1.2, 0, Math.PI * 2);
      g.fill();
      const spr = sprite(m.level >= 8 ? 'monster.young_serpent' : 'monster.shark');
      const n = 3;
      for (let k = 0; k < n; k++) {
        const ang = c.time * 0.35 + (k / n) * Math.PI * 2 + s.id;
        const r = L0 * 0.75;
        const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
        g.save();
        g.translate(px, py);
        g.rotate(ang + Math.PI);
        if (spr) {
          const ih = L0 * (m.level >= 8 ? 0.9 : 0.55), iw = ih * (spr.img.naturalWidth / spr.img.naturalHeight);
          g.drawImage(spr.img, -iw / 2, -ih / 2, iw, ih);
        } else {
          g.fillStyle = '#28343a';
          g.beginPath();
          g.ellipse(0, 0, L0 * 0.08, L0 * 0.25, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      return true;
    }
  }
  return false;
}

export function guardOfEntity(state: ClientState, id: number): GuardMark | null {
  const list = state.adv?.guards;
  if (!list) return null;
  for (const m of list) if (m.e === id) return m;
  return null;
}

/** The line under a guard's name over the water: HoMM3's word for their number, and that they stand guard. */
export function guardTag(state: ClientState, id: number): string | null {
  const m = guardOfEntity(state, id);
  if (!m) return null;
  const w = strengthWord(m.men);
  return `${w.word} ${w.range} · ${L('guard.stands')}`;
}
