// Signs on the horizon (docs/12 P2): smoke, birds over a shoal, a spout, a glint, a raft, a fire, fins, a squall line,
// lights in the dark — each a small moving thing that makes a captain turn to look, made from the art (owner,
// 2026-10-07: the painted smoke and flame, flotsam, the boat, the wreck, an iron ball, the sharks, the tentacle, the
// gulls, a plate of ice); a gold "?" in a brass medallion over it while it is still far off.

import type { ShoalView, SightView } from '../../../shared/src/protocol.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { lang } from '../i18n.ts';
import { sprite } from '../assets.ts';
import { brassRing, circlers, drawArt, drawPiece, foam, icePlate, piece } from './seaart.ts';

/** A small deterministic generator (a sign's ice keeps its shape). */
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

type G = CanvasRenderingContext2D;

export function drawSights(g: G, list: SightView[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, own: { x: number; y: number } | null, w: number, h: number): void {
  for (const s of list) {
    const x = sx(s.x), y = sy(s.y);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) {
      edgeMark(g, x, y, w, h, t + s.id);
      continue;
    }
    const k = Math.max(0.55, zoom);
    g.save();
    g.translate(x, y);
    drawOne(g, s.kind, k, t + s.id * 1.7);
    g.restore();
    // The question over it while she is still a way off.
    const d = own ? Math.hypot(s.x - own.x, s.y - own.y) : 0;
    if (d > 420) {
      const bob = Math.sin(t * 2 + s.id) * 3;
      askMedallion(g, x, y - 34 * k + bob, 9 + 2 * Math.min(1, zoom));
    }
  }
}

/** A sign beyond the screen's edge: a gold "?" at the rim, pointing the way. */
function edgeMark(g: G, x: number, y: number, w: number, h: number, t: number): void {
  const cx = w / 2, cy = h / 2;
  const a = Math.atan2(y - cy, x - cx);
  const pad = 34;
  const k = Math.min((w / 2 - pad) / Math.max(1e-6, Math.abs(Math.cos(a))), (h / 2 - pad) / Math.max(1e-6, Math.abs(Math.sin(a))));
  const ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
  const pulse = 0.75 + 0.25 * Math.sin(t * 3);
  askMedallion(g, ex, ey, 11);
  g.save();
  g.translate(ex, ey);
  // The arrowhead toward it, outside the brass.
  g.fillStyle = `rgba(232,196,106,${0.9 * pulse})`;
  g.rotate(a);
  g.beginPath();
  g.moveTo(23, 0);
  g.lineTo(17, -5);
  g.lineTo(17, 5);
  g.closePath();
  g.fill();
  g.restore();
}

/** A gold «?» in a small brass medallion (the UI's ring): a sign not yet made out. */
function askMedallion(g: G, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = 'rgba(8,10,14,0.85)';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8c46a';
  g.font = `700 ${Math.round(r * 1.3)}px Inter, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', x, y + 1);
  g.restore();
  if (!brassRing(g, x, y, r)) {
    g.strokeStyle = '#8c6b3a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
  }
}

function puff(g: G, x: number, y: number, r: number, a: number, color = '120,120,125'): void {
  // The painted smoke, tinted (CLAUDE.md §2: from the art); a soft disc only while it loads.
  const sm = piece('smoke');
  if (sm) {
    g.save();
    g.globalAlpha *= Math.min(1, a * 1.25);
    g.drawImage(tinted(sm, color), x - r * 1.25, y - r * 1.25, r * 2.5, r * 2.5);
    g.restore();
    return;
  }
  g.fillStyle = `rgba(${color},${a})`;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** The painted smoke dyed to a tone ('r,g,b'), made once a tone. */
const tones = new Map<string, HTMLCanvasElement>();
function tinted(sm: HTMLCanvasElement, rgb: string): HTMLCanvasElement {
  const hit = tones.get(rgb);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = sm.width;
  c.height = sm.height;
  const x = c.getContext('2d')!;
  x.drawImage(sm, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = `rgb(${rgb})`;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(sm, 0, 0);
  tones.set(rgb, c);
  return c;
}

/** One sign at the origin, `k` its scale — every one from the art (owner, 2026-10-07): the painted smoke and flame,
 *  the flotsam, the boat, the wreck, the iron ball of a mine, the sharks and the tentacle, the gulls, the ice. */
function drawOne(g: G, kind: string, k: number, t: number): void {
  switch (kind) {
    case 'smoke':
    case 'beacon':
    case 'fire': {
      if (kind === 'fire') {
        // A burning raft: the flotsam alight, the painted flame over it, its glow on the water.
        const f = 0.6 + 0.4 * Math.sin(t * 9);
        const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30 * k);
        glow.addColorStop(0, `rgba(255,170,60,${0.6 * f})`);
        glow.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(0, 0, 30 * k, 0, Math.PI * 2);
        g.fill();
        if (!drawArt(g, 'prop.flotsam', 0, 0, 26 * k, t * 0.05)) {
          g.fillStyle = '#2a1e14';
          g.fillRect(-12 * k, -3 * k, 24 * k, 6 * k);
        }
        g.save();
        g.globalCompositeOperation = 'lighter';
        drawArt(g, 'part.fire', 0, -6 * k, (14 + 3 * f) * k, Math.sin(t * 5) * 0.1, 0.8);
        g.restore();
      }
      for (let i = 0; i < 5; i++) {
        const life = (t * 0.35 + i / 5) % 1;
        puff(g, Math.sin(t * 0.7 + i) * 4 * k + life * 10 * k, -life * 60 * k, (4 + life * 10) * k, 0.45 * (1 - life), kind === 'fire' ? '60,55,55' : '150,150,155');
      }
      if (kind === 'beacon') {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 8 * k);
        gr.addColorStop(0, 'rgba(255,170,80,0.95)');
        gr.addColorStop(1, 'rgba(255,150,60,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, 8 * k, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'flare': {
      // A distress flare climbing from a ship's boat.
      const life = (t * 0.4) % 1;
      const gr = g.createRadialGradient(0, -life * 70 * k, 0, 0, -life * 70 * k, 14 * k);
      gr.addColorStop(0, `rgba(255,90,70,${1 - life})`);
      gr.addColorStop(1, 'rgba(255,70,60,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, -life * 70 * k, 14 * k, 0, Math.PI * 2);
      g.fill();
      if (!drawPiece(g, 'boat', 0, 0, 22 * k, 1.3)) {
        g.fillStyle = '#5a4630';
        g.beginPath();
        g.ellipse(0, 0, 14 * k, 5 * k, 0.3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'birds': {
      // Gulls (the painted top-down gull) wheeling over the water.
      if (gulls(g, 5, Math.min(1.4, k) * 0.8, t, 26 * k)) break;
      g.strokeStyle = 'rgba(235,235,230,0.9)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = t * 0.9 + (i * Math.PI * 2) / 6;
        const r = (14 + (i % 3) * 7) * k;
        const bx = Math.cos(a) * r, by = Math.sin(a) * r * 0.6 - 10 * k;
        const flap = Math.sin(t * 8 + i) * 2.5 * k;
        g.beginPath();
        g.moveTo(bx - 4 * k, by - flap);
        g.lineTo(bx, by);
        g.lineTo(bx + 4 * k, by - flap);
        g.stroke();
      }
      break;
    }
    case 'raft':
    case 'boat': {
      // Castaways: a raft of flotsam or a ship's boat, a rag waving on an oar (the painted pennant, bleached).
      const bob = Math.sin(t * 1.6) * 0.12;
      foam(g, 0, 0, 12 * k, t, 3, 0.2);
      const drawn = kind === 'raft' ? drawArt(g, 'prop.flotsam', 0, 0, 26 * k, bob) : drawPiece(g, 'boat', 0, 0, 26 * k, 1.4 + bob);
      if (!drawn) {
        g.fillStyle = kind === 'raft' ? '#6b5436' : '#5a4630';
        g.fillRect(-10 * k, -7 * k, 20 * k, 14 * k);
      }
      g.strokeStyle = '#3a2e22';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(6 * k, 0);
      g.lineTo(6 * k, -16 * k);
      g.stroke();
      drawPiece(g, 'pennant', 11 * k, -15 * k, 11 * k, Math.sin(t * 6) * 0.15, 1, '#d8d0bc');
      break;
    }
    case 'lantern':
    case 'ghostlight':
    case 'glow': {
      const color = kind === 'lantern' ? '255,210,120' : kind === 'ghostlight' ? '160,255,200' : '90,210,255';
      const f = 0.6 + 0.4 * Math.sin(t * (kind === 'glow' ? 1.2 : 3));
      const r = (kind === 'glow' ? 60 : 22) * k;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(${color},${0.55 * f})`);
      gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      if (kind === 'lantern') drawPiece(g, 'lantern', 0, 0, 12 * k, 0.4);
      break;
    }
    case 'glint': {
      // Something bright in the water: the light off it, and the spray as the swell turns it.
      const f = Math.max(0, Math.sin(t * 3));
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, (5 + 6 * f) * k);
      gr.addColorStop(0, `rgba(255,240,190,${0.5 + 0.5 * f})`);
      gr.addColorStop(1, 'rgba(255,236,170,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, (5 + 6 * f) * k, 0, Math.PI * 2);
      g.fill();
      foam(g, 0, 0, 6 * k, t, 5, 0.25);
      break;
    }
    case 'wreck': {
      if (drawArt(g, 'prop.shipwreck', 0, 0, 46 * k, 0.5 + Math.sin(t * 0.5) * 0.05, 0.9)) break;
      g.rotate(0.5);
      g.fillStyle = 'rgba(40,34,30,0.9)';
      g.beginPath();
      g.ellipse(0, 0, 22 * k, 7 * k, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'debris': {
      if (drawArt(g, 'prop.wreckage', 0, 0, 44 * k, Math.sin(t * 0.3) * 0.1, 0.9)) break;
      g.fillStyle = '#6b5436';
      for (let i = 0; i < 7; i++) {
        g.save();
        g.translate(Math.sin(i * 2.3) * 22 * k, Math.cos(i * 1.7) * 14 * k);
        g.rotate(i);
        g.fillRect(-5 * k, -1.5 * k, 10 * k, 3 * k);
        g.restore();
      }
      break;
    }
    case 'mine': {
      // A mine adrift: the painted iron ball, blackened, its horns.
      const bob = Math.sin(t * 1.3) * 2 * k;
      g.strokeStyle = '#141414';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(Math.cos(a) * 6 * k, bob + Math.sin(a) * 6 * k);
        g.lineTo(Math.cos(a) * 10 * k, bob + Math.sin(a) * 10 * k);
        g.stroke();
      }
      if (!drawPiece(g, 'buoy', 0, bob, 15 * k, t * 0.2, 1, '#1a1a1a')) {
        g.fillStyle = '#141414';
        g.beginPath();
        g.arc(0, bob, 7 * k, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'bubbles': {
      for (let i = 0; i < 6; i++) {
        const life = (t * 0.6 + i / 6) % 1;
        g.strokeStyle = `rgba(210,235,245,${0.8 * (1 - life)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(Math.sin(i * 2.4) * 10 * k, Math.cos(i * 1.9) * 8 * k, (1.5 + life * 5) * k, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'fins': {
      // Sharks circling, just under the surface.
      if (circlers(g, 'monster.shark', 0, 0, 18 * k, 22 * k, 3, t, 0, 0.8, 0.6)) {
        foam(g, 0, 0, 10 * k, t, 9, 0.12);
        break;
      }
      g.fillStyle = '#2e3438';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + (i * Math.PI * 2) / 3;
        const fx = Math.cos(a) * 18 * k, fy = Math.sin(a) * 10 * k;
        g.beginPath();
        g.moveTo(fx - 4 * k, fy);
        g.lineTo(fx, fy - 8 * k);
        g.lineTo(fx + 3 * k, fy);
        g.fill();
      }
      break;
    }
    case 'spout':
    case 'twister': {
      if (kind === 'twister') {
        // A waterspout: a column of the painted mist turning, the spray at its foot.
        foam(g, 0, 0, 14 * k, t, 11, 0.3);
        for (let i = 0; i < 6; i++) puff(g, Math.sin(t * 3 + i) * 3 * k, -i * 12 * k, (5 + i * 2.5) * k, 0.4, '160,170,180');
      } else {
        // A whale blows: the mist rising from the water, the dark of its back under it.
        const life = (t * 0.5) % 1;
        const hgt = Math.sin(life * Math.PI) * 30 * k;
        g.fillStyle = 'rgba(30,40,50,0.5)';
        g.beginPath();
        g.ellipse(0, 3 * k, 16 * k, 4 * k, 0, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 5; i++) puff(g, Math.sin(i * 1.3) * 5 * k, -hgt * (i / 5), (3 + i) * k, 0.5 * (1 - i / 8), '235,240,245');
      }
      break;
    }
    case 'squall': {
      // A squall line: dark cloud from the painted smoke, its rain.
      for (let i = 0; i < 5; i++) puff(g, (i - 2) * 26 * k, Math.sin(i * 1.7) * 6 * k, 22 * k, 0.4, '40,46,56');
      g.strokeStyle = 'rgba(170,185,200,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const rx = (i - 5) * 12 * k, ry = ((t * 40 + i * 13) % 30) * k - 15 * k;
        g.beginPath();
        g.moveTo(rx, ry);
        g.lineTo(rx - 3 * k, ry + 8 * k);
        g.stroke();
      }
      break;
    }
    case 'ice':
      icePlate(g, 0, 0, 16 * k, 9, 0.6, rnd(7), 1);
      break;
    case 'turtle': {
      g.rotate(Math.sin(t * 0.3) * 0.1);
      // The painted turtle (docs/12 P11), head toward the bow of its drift (+x); the drawn one is its stand-in.
      const spr = sprite('sight.giant_turtle');
      if (spr) {
        const len = 64 * k;
        const ih = len / spr.extentY, iw = ih * (spr.img.naturalWidth / spr.img.naturalHeight);
        g.rotate(Math.PI / 2);
        g.drawImage(spr.img, -iw * spr.cx, -ih * spr.cy, iw, ih);
        break;
      }
      g.fillStyle = '#4a5a34';
      g.beginPath();
      g.ellipse(0, 0, 26 * k, 18 * k, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'tentacle': {
      // A tentacle breaking the surface: the kraken's own, the white water about it.
      foam(g, 0, 4 * k, 10 * k, t, 13, 0.3);
      if (drawArt(g, 'monster.kraken_tentacle', 0, -8 * k, 34 * k, Math.sin(t * 1.5) * 0.25)) break;
      g.strokeStyle = 'rgba(120,70,120,0.95)';
      g.lineWidth = 5 * k;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 6 * k);
      g.quadraticCurveTo(10 * k * Math.sin(t * 1.5), -14 * k, 6 * k * Math.cos(t), -26 * k);
      g.stroke();
      break;
    }
    case 'calm': {
      // Dead calm: a sheet of glassy water, paler, breathing.
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60 * k);
      gr.addColorStop(0, `rgba(170,190,200,${0.16 + 0.06 * Math.sin(t)})`);
      gr.addColorStop(1, 'rgba(170,190,200,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 60 * k, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'albatross': {
      // One great bird gliding wide circles: the gull's art, larger and slower.
      if (gulls(g, 1, Math.min(1.4, k) * 1.5, t * 0.6, 22 * k)) break;
      const a = t * 0.6;
      const bx = Math.cos(a) * 20 * k, by = Math.sin(a) * 10 * k - 14 * k;
      g.strokeStyle = 'rgba(250,250,245,0.95)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx - 10 * k, by);
      g.quadraticCurveTo(bx, by - 3 * k, bx + 10 * k, by);
      g.stroke();
      break;
    }
    case 'sails': {
      // Sails on the horizon: a ship's painting far off, faint in the haze.
      if (drawArt(g, 'ship.sloop', 0, 0, 30 * k, 0.4, 0.55) || drawArt(g, 'ship.brig', 0, 0, 30 * k, 0.4, 0.55)) break;
      g.fillStyle = 'rgba(235,230,215,0.9)';
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(i * 16 * k - 8 * k, 4 * k);
        g.lineTo(i * 16 * k - 8 * k, -16 * k);
        g.lineTo(i * 16 * k + 2 * k, 4 * k);
        g.fill();
      }
      break;
    }
    case 'song': {
      // The song over the water: a violet mist drifting in slow coils.
      for (let i = 0; i < 4; i++) puff(g, Math.sin(t * 0.8 + i * 1.6) * 18 * k, -i * 7 * k + Math.cos(t + i) * 3 * k, 10 * k, 0.35, '150,120,190');
      break;
    }
    case 'wisps': {
      for (let i = 0; i < 5; i++) {
        const wx = Math.sin(t * 0.7 + i * 1.3) * 22 * k, wy = Math.cos(t * 0.9 + i * 2.1) * 12 * k;
        const gr = g.createRadialGradient(wx, wy, 0, wx, wy, 7 * k);
        gr.addColorStop(0, 'rgba(140,200,255,0.9)');
        gr.addColorStop(1, 'rgba(140,200,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(wx, wy, 7 * k, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'fog': {
      for (let i = 0; i < 6; i++) puff(g, Math.sin(i * 1.7 + t * 0.2) * 30 * k, Math.cos(i * 2.3) * 16 * k, 22 * k, 0.12, '200,205,210');
      break;
    }
    default:
      puff(g, 0, 0, 6 * k, 0.8, '232,196,106');
  }
}

// ------------------------------------------------------------------------------------------------ shoals and gulls

/** The art darkened into a flat shape (a fish seen through the water, a bird's shadow), cached per id. */
const shapes = new Map<string, HTMLCanvasElement>();

/** The sheet's fish lie head low-left, tail high-right: about 160° from +x. */
const FISH_HEAD = (160 * Math.PI) / 180;

/** The painted fish of the catch sheet laid flat — head to +x, squashed as if seen from above — in one dark colour. */
function fishShape(fish: string, tone: string): HTMLCanvasElement | null {
  const key = `fish:${fish}:${tone}`;
  const hit = shapes.get(key);
  if (hit) return hit;
  const spr = sprite(`icon.fish_${fish}`);
  if (!spr) return null;
  const c = document.createElement('canvas');
  c.width = 72;
  c.height = 30;
  const x = c.getContext('2d')!;
  x.translate(36, 15);
  x.scale(1, 0.72);
  x.rotate(-FISH_HEAD);
  const s = 78, ar = spr.img.naturalHeight / spr.img.naturalWidth;
  x.drawImage(spr.img, -s * spr.cx, -s * ar * spr.cy, s, s * ar);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = tone;
  x.fillRect(0, 0, c.width, c.height);
  shapes.set(key, c);
  return c;
}

/** The gull's shadow on the water: the painted gull, dark. */
function gullShadow(): HTMLCanvasElement | null {
  const hit = shapes.get('gull');
  if (hit) return hit;
  const spr = sprite('creature.gull');
  if (!spr) return null;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = Math.round((96 * spr.img.naturalHeight) / spr.img.naturalWidth);
  const x = c.getContext('2d')!;
  x.drawImage(spr.img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  shapes.set('gull', c);
  return c;
}

/** Gulls wheeling round the origin (the painted top-down gull, beating its wings), their shadows on the water. */
export function gulls(g: G, n: number, k: number, t: number, radius: number): boolean {
  const spr = sprite('creature.gull');
  if (!spr) return false;
  const shadow = gullShadow();
  const aspect = spr.img.naturalHeight / spr.img.naturalWidth;
  for (let i = 0; i < n; i++) {
    const dir = i % 3 === 2 ? -1 : 1;
    const a = dir * t * (0.5 + (i % 2) * 0.13) + (i * Math.PI * 2) / n + i * 0.7;
    const r = radius * (0.7 + 0.3 * Math.sin(i * 1.9 + 0.4));
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75 - 6 * k;
    // Heading along its circle (the art faces up the image).
    const dx = -Math.sin(a) * dir, dy = Math.cos(a) * 0.75 * dir;
    const rot = Math.atan2(dx, -dy);
    const size = (21 + (i % 3) * 3) * k;
    // Now a few beats, now a glide.
    const beat = Math.sin(t * 7 + i * 2.1);
    const flap = Math.sin(t * 0.9 + i) > 0.2 ? 0.62 + 0.38 * Math.abs(beat) : 1;
    const w = size, h = size * aspect;
    if (shadow) {
      g.save();
      g.globalAlpha = 0.16;
      g.translate(x + 7 * k, y + 11 * k);
      g.rotate(rot);
      g.scale(flap * 0.85, 0.85);
      g.drawImage(shadow, -w / 2, -h / 2, w, h);
      g.restore();
    }
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(flap, 1);
    g.drawImage(spr.img, -w / 2, -h / 2, w, h);
    g.restore();
  }
  return true;
}

function onScreen(x: number, y: number, r: number, w: number, h: number): boolean {
  return !(x < -r - 60 || y < -r - 60 || x > w + r + 60 || y > h + r + 60);
}

/** Shoals (docs/12 P3; art, 2026-09-30): a dark ripple on the water with the shapes of its fish turning in it — the
 *  painted fish of the catch sheet, laid flat and dark — and, once the craft reads the water, its fish and name.
 *  The gulls over it come after the ships (drawShoalBirds). And a captain's own pots, as red buoys. */
export function drawShoals(g: G, list: ShoalView[], traps: { x: number; y: number }[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, w: number, h: number): void {
  for (const s of list) {
    const x = sx(s.x), y = sy(s.y);
    const r = s.r * zoom;
    if (!onScreen(x, y, r, w, h)) continue;
    g.save();
    g.translate(x, y);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(6,22,30,${0.2 + 0.18 * s.full})`);
    gr.addColorStop(0.7, `rgba(6,22,30,${0.1 + 0.08 * s.full})`);
    gr.addColorStop(1, 'rgba(6,22,30,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    // The ripple of fish working under the surface: two slow rings.
    g.lineWidth = Math.max(1, 1.2 * zoom);
    for (let i = 0; i < 2; i++) {
      const life = (t * 0.18 + i * 0.5 + s.id * 0.13) % 1;
      g.strokeStyle = `rgba(190,220,232,${0.14 * (1 - life)})`;
      g.beginPath();
      g.ellipse(0, 0, r * (0.25 + life * 0.6), r * (0.2 + life * 0.5), 0.3, 0, Math.PI * 2);
      g.stroke();
    }
    // The fish themselves: a few dark shapes turning slowly round the heart of the shoal.
    // Pale backs glinting under the water over their own dark shadows (the sea is dark: a dark fish alone is lost).
    const shape = fishShape(s.fish ?? 'herring', '#b9dde6'), under = fishShape(s.fish ?? 'herring', '#02080c');
    if (shape && under) {
      const n = 3 + Math.round(s.full * 4) + (r > 260 ? 3 : 0);
      const len = Math.max(12, Math.min(30, 13 * zoom));
      const dir = s.id % 2 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = dir * t * (0.22 + (i % 3) * 0.04) + (i * Math.PI * 2) / n + s.id;
        const rr = r * (0.18 + ((i * 37 + s.id * 11) % 50) / 100);
        const fx = Math.cos(a) * rr, fy = Math.sin(a) * rr;
        // Nose along the circle, with a small wriggle.
        const heading = Math.atan2(Math.cos(a) * dir, -Math.sin(a) * dir) + Math.sin(t * 3 + i) * 0.12;
        g.save();
        g.translate(fx, fy);
        g.rotate(heading);
        g.globalAlpha = 0.4;
        g.drawImage(under, -len / 2 + 2, -len * 0.26 + 2.5, len, len * 0.52);
        g.globalAlpha = 0.3 + 0.16 * Math.sin(t * 0.8 + i * 1.3);
        g.drawImage(shape, -len / 2, -len * 0.26, len, len * 0.52);
        g.restore();
      }
    }
    if (s.fish) {
      const label = FISH[s.fish].name[lang() === 'ru' ? 1 : 0];
      const fs = Math.round(10 + 2 * Math.min(1, zoom));
      g.font = `600 ${fs}px Inter, sans-serif`;
      const icon = sprite(`icon.fish_${s.fish}`);
      const iw = icon ? fs + 8 : 0;
      const tw = g.measureText(label).width;
      // Under the shoal, or inside its rim when it fills the screen.
      const ly = Math.min(r + 14, Math.max(56, r * 0.42));
      const x0 = -(tw + iw + (icon ? 3 : 0)) / 2;
      g.fillStyle = 'rgba(5,12,16,0.62)';
      g.beginPath();
      g.roundRect(x0 - 5, ly - fs / 2 - 4, tw + iw + (icon ? 3 : 0) + 10, fs + 8, 4);
      g.fill();
      if (icon) g.drawImage(icon.img, x0, ly - iw / 2, iw, iw);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = '#bfe3ee';
      g.fillText(label, x0 + iw + (icon ? 3 : 0), ly + 0.5);
      g.textBaseline = 'alphabetic';
    }
    g.restore();
  }
  for (const tr of traps) {
    const x = sx(tr.x), y = sy(tr.y);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const bob = Math.sin(t * 2 + tr.x) * 2;
    // Her pot's buoy: the iron ball painted dull red, its little pennant (the art, owner 2026-10-07).
    const k = Math.max(0.7, zoom);
    drawPiece(g, 'pennant', x + 6 * k, y + bob - 5 * k, 10 * k, -0.2 + Math.sin(t * 3 + tr.x) * 0.08, 0.9, '#d8cfb8');
    if (!drawPiece(g, 'redBuoy', x, y + bob, 10 * k, tr.x)) {
      g.fillStyle = '#c23d33';
      g.beginPath();
      g.arc(x, y + bob, 4.5 * k, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** The gulls over the shoals, drawn above the ships (a shoal is known by its birds). */
export function drawShoalBirds(g: G, list: ShoalView[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, w: number, h: number): void {
  for (const s of list) {
    const x = sx(s.x), y = sy(s.y);
    const r = s.r * zoom;
    if (!onScreen(x, y, r, w, h)) continue;
    g.save();
    g.translate(x, y);
    const k = Math.max(0.8, Math.min(1.6, zoom));
    gulls(g, 3 + (s.id % 2) + (s.full > 0.6 ? 1 : 0), k, t + s.id * 3.1, Math.max(24 * k, r * 0.55));
    g.restore();
  }
}
