// docs/18 III on the water, drawn by hand over the painted islands: each kind's own shore and colour (the pale sandy
// shallows of a tropical island, the surf on a rocky one, the ash water and the embers of a volcanic one, the murk of a
// swamp, the hulks and flotsam of a ship graveyard, the pale dead light of the Choir's), an atoll's lagoon, the mist
// over a hidden island not yet found, the island's level ⚓ by her when close, and the turtle islands — the painted
// giant turtle with sand, palms and a cache on her back, or the rings where she sounded.

import type { IslandData } from '../../../shared/src/protocol.ts';
import type { TurtleView } from '../../../shared/src/isleproto.ts';
import { THREAT_COLOR, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { isleDanger } from '../../../shared/src/world/archipelago.ts';
import type { IsleType } from '../../../shared/src/world/archipelago.ts';
import { turtlePos } from '../../../shared/src/world/drift.ts';
import type { TurtleDef } from '../../../shared/src/world/drift.ts';
import { sprite } from '../assets.ts';

type G = CanvasRenderingContext2D;

export interface IsleTypeCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  night: number;
  w: number;
  h: number;
  /** The renderer's rounded coast path (scaled about a centre). */
  path: (poly: number[], scale?: number, cx?: number, cy?: number) => void;
}

function rnd(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HALO: Record<IsleType, string> = {
  tropical: 'rgba(120,150,132,0.24)',
  rocky: 'rgba(214,224,230,0.10)',
  volcanic: 'rgba(22,12,10,0.5)',
  swamp: 'rgba(70,92,40,0.42)',
  graveyard: 'rgba(96,78,54,0.36)',
  dead: 'rgba(110,200,196,0.11)',
};

/** The water about her coast, by her kind (under the island). */
export function drawIsleHalo(g: G, is: IslandData, c: IsleTypeCtx): void {
  if (!is.ty || is.mist || is.raft || c.zoom < 0.08) return;
  g.save();
  g.lineJoin = 'round';
  c.path(is.poly);
  g.strokeStyle = HALO[is.ty];
  g.lineWidth = (is.ty === 'tropical' ? 70 : is.ty === 'rocky' ? 40 : 60) * c.zoom;
  g.stroke();
  if (is.ty === 'tropical') {
    // Pale sandy shallows, a shade of the dark sea (docs/06 §6.1: never azure — turquoise is the deep's own light).
    g.strokeStyle = 'rgba(150,160,130,0.12)';
    g.lineWidth = 120 * c.zoom;
    g.stroke();
  }
  if (is.ty === 'volcanic' && c.night > 0.3) {
    g.strokeStyle = `rgba(255,96,40,${0.12 * c.night})`;
    g.lineWidth = 30 * c.zoom;
    g.stroke();
  }
  if (is.ty === 'dead') {
    // A pale light under the water that breathes.
    g.strokeStyle = `rgba(120,230,214,${0.06 + 0.05 * Math.sin(c.time * 0.8 + is.id) + 0.1 * c.night})`;
    g.lineWidth = 90 * c.zoom;
    g.stroke();
  }
  g.restore();
}

/** Her kind on her land (over the painting, under what grows and stands on it). */
export function drawIsleOver(g: G, is: IslandData, c: IsleTypeCtx): void {
  if (!is.ty || is.mist || is.raft) return;
  const z = c.zoom;
  const r = rnd(is.id * 9173 + 41);
  g.save();
  g.lineJoin = 'round';
  // An atoll's lagoon (a coral one has its own from the biome's drawing): a shallow of the dark sea inside the ring,
  // a shade lighter toward its rim (docs/06 §6.1), and a channel out to the open water.
  if (is.isle === 'atoll') {
    const x = c.sx(is.x), y = c.sy(is.y);
    if (is.biome !== 'atoll') {
      c.path(is.poly, 0.66, is.x, is.y);
      const grd = g.createRadialGradient(x, y, 0, x, y, is.r * 0.6 * z);
      grd.addColorStop(0, 'rgba(18,28,30,0.95)');
      grd.addColorStop(0.8, 'rgba(30,43,44,0.93)');
      grd.addColorStop(1, 'rgba(52,64,60,0.88)');
      g.fillStyle = grd;
      g.fill();
      g.strokeStyle = 'rgba(127,144,156,0.3)';
      g.lineWidth = Math.max(1, 3 * z);
      g.stroke();
    }
    const a = r() * Math.PI * 2;
    g.strokeStyle = 'rgba(30,43,44,0.95)';
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, is.r * 0.14 * z);
    g.beginPath();
    g.moveTo(x + Math.sin(a) * is.r * 0.5 * z, y - Math.cos(a) * is.r * 0.5 * z);
    g.lineTo(x + Math.sin(a) * is.r * 0.95 * z, y - Math.cos(a) * is.r * 0.95 * z);
    g.stroke();
  }
  c.path(is.poly);
  g.clip();
  switch (is.ty) {
    case 'tropical':
      // Bright sand along the waterline.
      c.path(is.poly);
      g.strokeStyle = 'rgba(244,226,168,0.42)';
      g.lineWidth = 16 * z;
      g.stroke();
      break;
    case 'rocky':
      c.path(is.poly);
      g.strokeStyle = 'rgba(34,34,36,0.5)';
      g.lineWidth = 10 * z;
      g.stroke();
      g.fillStyle = 'rgba(120,124,128,0.12)';
      g.fill();
      break;
    case 'volcanic': {
      g.fillStyle = 'rgba(30,14,10,0.22)';
      c.path(is.poly);
      g.fill();
      // Cracks of fire from the middle, glowing by night.
      const glow = 0.5 + 0.4 * c.night + 0.1 * Math.sin(c.time * 2 + is.id);
      g.strokeStyle = `rgba(255,${100 + Math.round(50 * c.night)},36,${Math.min(0.9, glow)})`;
      g.lineWidth = Math.max(1.4, 3.2 * z);
      g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        let a = r() * Math.PI * 2, d = 0;
        let px = is.x, py = is.y;
        g.beginPath();
        g.moveTo(c.sx(px), c.sy(py));
        for (let s = 0; s < 5; s++) {
          a += (r() - 0.5) * 0.9;
          d = is.r * 0.12 * (1 + r());
          px += Math.sin(a) * d;
          py -= Math.cos(a) * d;
          g.lineTo(c.sx(px), c.sy(py));
        }
        g.stroke();
      }
      break;
    }
    case 'swamp': {
      g.fillStyle = 'rgba(18,40,18,0.26)';
      c.path(is.poly);
      g.fill();
      // Black pools among the reeds.
      for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 2, d = r() * is.r * 0.55;
        g.fillStyle = 'rgba(10,20,14,0.45)';
        g.beginPath();
        g.ellipse(c.sx(is.x + Math.sin(a) * d), c.sy(is.y - Math.cos(a) * d), (14 + r() * 26) * z, (8 + r() * 14) * z, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'graveyard': {
      g.fillStyle = 'rgba(70,58,44,0.22)';
      c.path(is.poly);
      g.fill();
      break;
    }
    case 'dead': {
      g.fillStyle = 'rgba(40,50,70,0.34)';
      c.path(is.poly);
      g.fill();
      g.fillStyle = `rgba(190,215,220,${0.06 + 0.04 * c.night})`;
      g.fill();
      break;
    }
  }
  g.restore();
  // The hulks of a graveyard, run up on her shore and rotting in her shallows (the painted wrecks), and flotsam.
  if (is.ty === 'graveyard' && z > 0.15) {
    const art = [sprite('prop.shipwreck'), sprite('prop.wreckage'), sprite('prop.flotsam')];
    const n = is.poly.length / 2;
    const k = Math.min(7, 3 + Math.floor(is.r / 150));
    for (let i = 0; i < k; i++) {
      const v = Math.floor(((i + r() * 0.6) / k) * n) % n;
      const px = is.poly[v * 2], py = is.poly[v * 2 + 1];
      const spr = art[i % 3];
      if (!spr) continue;
      const size = (i % 3 === 2 ? 40 : 80 + r() * 50) * z;
      const out = i % 3 === 2 ? -0.18 : -0.02;
      g.save();
      g.translate(c.sx(px + (is.x - px) * out), c.sy(py + (is.y - py) * out));
      g.rotate(Math.atan2(px - is.x, -(py - is.y)) + (r() - 0.5) * 1.2);
      g.globalAlpha = 0.95;
      g.drawImage(spr.img, -size / 2, -size / 2, size, size);
      g.restore();
    }
  }
}

/** A hidden island not yet found: a bank of mist that does not lift, curling slowly. */
export function drawMist(g: G, is: IslandData, c: IsleTypeCtx): void {
  const x = c.sx(is.x), y = c.sy(is.y), R = is.r * 1.3 * c.zoom;
  if (x < -R || y < -R || x > c.w + R || y > c.h + R) return;
  g.save();
  const r = rnd(is.id * 31 + 7);
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2 + c.time * 0.04 * (k % 2 ? 1 : -1), d = r() * is.r * 0.7;
    const px = x + Math.sin(a) * d * c.zoom, py = y - Math.cos(a) * d * c.zoom;
    const rr = (is.r * (0.45 + r() * 0.4)) * c.zoom;
    const grd = g.createRadialGradient(px, py, 0, px, py, rr);
    grd.addColorStop(0, 'rgba(205,212,214,0.42)');
    grd.addColorStop(0.6, 'rgba(190,198,202,0.22)');
    grd.addColorStop(1, 'rgba(180,190,195,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Her level by her, when she is close: ⚓N in the ladder's colour against hers; three or more above, Darkness. */
export function drawIsleLevel(g: G, is: IslandData, c: IsleTypeCtx, mine: number, deadly: string): void {
  if (!is.lv || is.minor || is.raft || is.portId) return;
  const x = c.sx(is.x), y = c.sy(is.y + is.r * 0.82) + 14;
  if (x < -40 || y < -20 || x > c.w + 40 || y > c.h + 20) return;
  const d = isleDanger(mine, is.lv);
  const text = `${is.secret ? '✦ ' : ''}${d === 'deadly' ? `☠ ⚓${is.lv} ${deadly}` : `⚓${is.lv}`}`; // ✦ a hidden island she has found
  g.save();
  g.font = '700 11px Inter, sans-serif';
  const w = g.measureText(text).width + 10;
  g.fillStyle = 'rgba(8,10,12,0.72)';
  g.strokeStyle = THREAT_COLOR[threatOf(mine, is.lv)];
  g.lineWidth = d ? 1.6 : 1;
  g.beginPath();
  g.roundRect(x - w / 2, y - 9, w, 16, 4);
  g.fill();
  g.stroke();
  g.fillStyle = THREAT_COLOR[threatOf(mine, is.lv)];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
  g.restore();
}

/** A turtle's loop as the shared drift functions take it. */
export function turtleDef(t: TurtleView): TurtleDef {
  return { id: t.id, name: ['', ''], region: 'gravewater', cx: t.cx, cy: t.cy, rx: t.rx, ry: t.ry, rot: t.rot, lap: t.lap, ph: t.ph, r: t.r, cph: 0 };
}

/** The turtle islands: where they are now; up, the turtle with her island on her back; under, the rings she left. */
export function drawTurtles(g: G, list: TurtleView[], now: number, c: IsleTypeCtx, label: (t: TurtleView) => string): void {
  for (const t of list) {
    const p = turtlePos(turtleDef(t), now);
    const x = c.sx(p.x), y = c.sy(p.y), R = t.r * 1.6 * c.zoom;
    if (x < -R || y < -R || x > c.w + R || y > c.h + R) continue;
    g.save();
    if (!t.up) {
      for (let k = 0; k < 3; k++) {
        const f = ((c.time * 0.25 + k / 3) % 1);
        g.strokeStyle = `rgba(200,220,225,${0.35 * (1 - f)})`;
        g.lineWidth = Math.max(1, 2 * c.zoom);
        g.beginPath();
        g.ellipse(x, y, t.r * (0.4 + f) * c.zoom, t.r * (0.3 + f * 0.8) * c.zoom, p.heading, 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      g.translate(x, y);
      g.rotate(p.heading);
      // Her shadow on the water, then the painted turtle.
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(10 * c.zoom, 14 * c.zoom, t.r * 1.05 * c.zoom, t.r * 1.25 * c.zoom, 0, 0, Math.PI * 2);
      g.fill();
      const art = sprite('sight.giant_turtle');
      const S = t.r * 2.5 * c.zoom;
      if (art) g.drawImage(art.img, -S / 2, -S / 2, S, S);
      else {
        g.fillStyle = '#4b5a3a';
        g.beginPath();
        g.ellipse(0, 0, t.r * 0.95 * c.zoom, t.r * 1.15 * c.zoom, 0, 0, Math.PI * 2);
        g.fill();
      }
      // The island on her shell: sand, a scatter of green, a chest where something waits.
      const sand = g.createRadialGradient(0, 0, 0, 0, 0, t.r * 0.62 * c.zoom);
      sand.addColorStop(0, 'rgba(228,206,150,0.95)');
      sand.addColorStop(0.8, 'rgba(204,178,120,0.9)');
      sand.addColorStop(1, 'rgba(160,140,96,0)');
      g.fillStyle = sand;
      g.beginPath();
      g.ellipse(0, 0, t.r * 0.6 * c.zoom, t.r * 0.7 * c.zoom, 0, 0, Math.PI * 2);
      g.fill();
      const deco = sprite('prop.decor_atoll') ?? sprite('prop.decor_jungle');
      if (deco && c.zoom > 0.2) {
        const s = t.r * 0.95 * c.zoom;
        g.drawImage(deco.img, -s / 2, -s / 2, s, s);
      }
      if (!t.combed && c.zoom > 0.25) {
        const chest = sprite('prop.cache');
        const s = 22 * Math.max(0.6, c.zoom);
        if (chest) g.drawImage(chest.img, t.r * 0.18 * c.zoom - s / 2, -s / 2, s, s);
      }
    }
    g.restore();
    if (c.zoom > 0.2) {
      g.save();
      g.font = 'italic 600 12px "Cormorant Garamond", Georgia, serif';
      g.textAlign = 'center';
      const text = label(t);
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillText(text, x + 1, y + t.r * 1.25 * c.zoom + 15);
      g.fillStyle = t.up ? '#efe1b8' : 'rgba(200,214,220,0.85)';
      g.fillText(text, x, y + t.r * 1.25 * c.zoom + 14);
      g.restore();
    }
  }
}
