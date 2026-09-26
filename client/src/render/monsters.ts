// Monsters of the deep and their fights (docs/02 §11.A.4), drawn procedurally: the world bosses and their
// parts, and the zones of their fights (whirlpool, coil, eye, ink, false lights, white water, the maze, the Song).

import { serverText } from '../lang/server.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { BossView, PveSiteView } from '../../../shared/src/protocol.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { sprite } from '../assets.ts';

export interface MonsterDraw {
  id: number;
  x: number; // screen
  y: number;
  h: number;
  classId: ShipClassId;
  flags: number;
  hull: number; // 0..1
  sinkT: number;
}

function rnd(seed: number): () => number {
  let s = (seed * 16807) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A monster at screen (x, y), zoom px/m, animated by t seconds. */
export function drawMonster(g: CanvasRenderingContext2D, m: MonsterDraw, zoom: number, t: number): void {
  const cls = SHIP_CLASSES[m.classId];
  const len = cls.length * zoom, beam = cls.beam * zoom;
  const submerged = (m.flags & SF.SUBMERGED) !== 0;
  const sinkF = m.sinkT > 0 ? Math.min(1, m.sinkT / 6) : 0;
  g.save();
  g.translate(m.x, m.y);
  g.rotate(m.h);
  g.globalAlpha = (submerged ? 0.28 : 1) * (1 - sinkF * 0.85);
  const spr = sprite(cls.sprite);
  if (spr) {
    const imgH = len / spr.extentY;
    const imgW = imgH * (spr.img.naturalWidth / spr.img.naturalHeight);
    animate(g, m.classId, t, m.id, imgW, imgH, spr.cy);
    // Under the surface: its own dark, blurred shadow instead of the painted hide.
    if (submerged) g.filter = 'brightness(0.22) blur(3px)';
    g.drawImage(spr.img, -imgW * spr.cx, -imgH * spr.cy, imgW, imgH);
    g.filter = 'none';
  } else {
    switch (m.classId) {
      case 'leviathan': leviathan(g, len, beam, t, submerged); break;
      case 'kraken': kraken(g, len, beam, t); break;
      case 'kraken_tentacle': tentacle(g, len, beam, t, m.id); break;
      case 'drowned_whale': whale(g, len, beam, t); break;
      case 'whale_heart': orb(g, beam, t, '150,20,30', 1.6); break;
      case 'lantern_maw': maw(g, len, beam, t); break;
      case 'black_serpent': serpent(g, len, beam, t); break;
      case 'mother_of_wrecks': mother(g, len, beam, t, m.id); break;
      case 'wreck_core': orb(g, beam, t, '46,230,200', 2.2); break;
      case 'storm_widow': widow(g, len, t); break;
      case 'hulk': hulk(g, len, beam, m.id); break;
      case 'abyss_eye': eye(g, len, t); break;
      default: orb(g, beam, t, '120,120,120', 1);
    }
  }
  g.restore();
}

/**
 * Life for a painted monster (applied to the canvas before the sprite is drawn): every beast breathes, arms sway
 * from their root, the serpent ripples, the Widow turns, hearts beat twice. The painting stays one piece.
 */
function animate(g: CanvasRenderingContext2D, id: ShipClassId, t: number, seed: number, w: number, h: number, cy: number): void {
  const ph = t + seed * 0.37;
  const breathe = 1 + Math.sin(ph * 1.1) * 0.012;
  switch (id) {
    case 'kraken_tentacle': {
      // Sway about the root at the foot of the sprite.
      const root = h * (1 - cy);
      g.translate(0, root);
      g.rotate(Math.sin(ph * 1.7) * 0.14 + Math.sin(ph * 0.6) * 0.06);
      g.translate(0, -root);
      break;
    }
    case 'black_serpent':
      g.transform(1, 0, Math.sin(ph * 1.3) * 0.09, 1, 0, 0);
      g.scale(breathe, 1);
      break;
    case 'storm_widow':
      g.rotate(ph * 0.12);
      g.scale(breathe * 1.01, breathe * 1.01);
      break;
    case 'abyss_eye':
      g.scale(1 + Math.sin(ph * 0.7) * 0.025, 1 + Math.sin(ph * 0.7) * 0.025);
      break;
    case 'whale_heart':
    case 'wreck_core': {
      // Lub-dub: two quick swells, then rest.
      const beat = ph % 1.4;
      const k = 1 + 0.05 * Math.exp(-(((beat - 0.1) / 0.07) ** 2)) + 0.035 * Math.exp(-(((beat - 0.35) / 0.08) ** 2));
      g.scale(k, k);
      break;
    }
    default:
      // The great bodies roll a little in the swell and breathe.
      g.scale(breathe + Math.sin(ph * 0.8) * 0.02, breathe);
  }
  void w;
}

function leviathan(g: CanvasRenderingContext2D, len: number, beam: number, t: number, submerged: boolean): void {
  const flex = Math.sin(t * 1.4) * beam * 0.25;
  // Body: a long tapering shape from snout (−y… +y is the bow in ship space: heading points up = −y).
  g.beginPath();
  g.moveTo(0, -len * 0.5);
  g.bezierCurveTo(beam * 0.7, -len * 0.35, beam * 0.55 + flex, len * 0.2, flex * 1.6, len * 0.42);
  g.lineTo(flex * 1.6 + beam * 0.6, len * 0.52);
  g.lineTo(flex * 1.6, len * 0.47);
  g.lineTo(flex * 1.6 - beam * 0.6, len * 0.52);
  g.lineTo(flex * 1.6, len * 0.42);
  g.bezierCurveTo(-beam * 0.55 + flex, len * 0.2, -beam * 0.7, -len * 0.35, 0, -len * 0.5);
  g.closePath();
  const grad = g.createLinearGradient(-beam, 0, beam, 0);
  grad.addColorStop(0, '#1b2a33');
  grad.addColorStop(0.5, '#3a525c');
  grad.addColorStop(1, '#16222a');
  g.fillStyle = submerged ? '#0a1216' : grad;
  g.fill();
  if (submerged) return;
  // Bony ridge down the spine.
  g.fillStyle = '#b9b2a0';
  for (let i = 0; i < 9; i++) {
    const y = -len * 0.34 + i * len * 0.08;
    const x = flex * (i / 9) * 1.2;
    g.beginPath();
    g.moveTo(x - beam * 0.07, y + len * 0.02);
    g.lineTo(x, y - len * 0.03);
    g.lineTo(x + beam * 0.07, y + len * 0.02);
    g.fill();
  }
  // Gills and eyes.
  g.strokeStyle = 'rgba(210,90,80,0.8)';
  g.lineWidth = Math.max(1, beam * 0.03);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(side * beam * 0.36, -len * 0.3 + k * len * 0.03, beam * 0.12, side > 0 ? 2.2 : -0.9, side > 0 ? 4 : 0.9);
      g.stroke();
    }
    g.fillStyle = '#d6e6c8';
    g.beginPath();
    g.arc(side * beam * 0.28, -len * 0.42, Math.max(1.5, beam * 0.05), 0, Math.PI * 2);
    g.fill();
  }
}

function kraken(g: CanvasRenderingContext2D, len: number, beam: number, t: number): void {
  const pulse = 1 + Math.sin(t * 1.8) * 0.04;
  g.scale(pulse, pulse);
  const grad = g.createRadialGradient(0, 0, beam * 0.1, 0, 0, beam * 0.6);
  grad.addColorStop(0, '#6a2a3a');
  grad.addColorStop(1, '#2a0f18');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(0, len * 0.05, beam * 0.5, len * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  // Mottling.
  g.fillStyle = 'rgba(200,120,110,0.25)';
  const r = rnd(7);
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc((r() - 0.5) * beam * 0.7, (r() - 0.5) * len * 0.8, beam * (0.03 + r() * 0.05), 0, Math.PI * 2);
    g.fill();
  }
  // Eyes.
  for (const side of [-1, 1]) {
    g.fillStyle = '#e8d27a';
    g.beginPath();
    g.ellipse(side * beam * 0.26, -len * 0.25, beam * 0.08, beam * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#000';
    g.fillRect(side * beam * 0.26 - beam * 0.06, -len * 0.25 - 0.5, beam * 0.12, Math.max(1, beam * 0.015));
  }
}

function tentacle(g: CanvasRenderingContext2D, len: number, beam: number, t: number, id: number): void {
  // Base at the stern end (+y), tip at the bow (−y), whipping.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const y = len * (0.5 - u);
    const x = Math.sin(t * 2.2 + u * 4 + id) * beam * 1.6 * u;
    pts.push([x, y]);
  }
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineCap = 'round';
    g.strokeStyle = pass === 0 ? '#2a0f18' : '#7a3346';
    g.lineWidth = pass === 0 ? beam * 1.1 : beam * 0.7;
    g.stroke();
  }
  g.fillStyle = 'rgba(230,190,180,0.7)';
  for (let i = 1; i < pts.length - 1; i += 2) {
    g.beginPath();
    g.arc(pts[i][0] + beam * 0.15, pts[i][1], Math.max(0.8, beam * 0.12 * (1 - i / 14)), 0, Math.PI * 2);
    g.fill();
  }
}

function whale(g: CanvasRenderingContext2D, len: number, beam: number, t: number): void {
  const roll = Math.sin(t * 0.5) * beam * 0.03;
  g.translate(roll, 0);
  g.beginPath();
  g.ellipse(0, 0, beam * 0.5, len * 0.5, 0, 0, Math.PI * 2);
  g.fillStyle = '#4d5a52';
  g.fill();
  g.strokeStyle = '#1c2420';
  g.lineWidth = 2;
  g.stroke();
  // Rot and barnacles.
  const r = rnd(31);
  g.fillStyle = 'rgba(160,170,140,0.35)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.arc((r() - 0.5) * beam * 0.8, (r() - 0.5) * len * 0.9, beam * (0.01 + r() * 0.03), 0, Math.PI * 2);
    g.fill();
  }
  // The drowned town on its back: roofs and a bell tower.
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * beam * 0.45, y = (r() - 0.5) * len * 0.5;
    g.fillStyle = '#2a2320';
    g.fillRect(x - beam * 0.06, y - beam * 0.05, beam * 0.12, beam * 0.1);
    g.fillStyle = '#5a3a2a';
    g.beginPath();
    g.moveTo(x - beam * 0.08, y - beam * 0.05);
    g.lineTo(x, y - beam * 0.12);
    g.lineTo(x + beam * 0.08, y - beam * 0.05);
    g.fill();
  }
  g.fillStyle = '#3a3029';
  g.fillRect(-beam * 0.05, -len * 0.08, beam * 0.1, beam * 0.3);
  g.fillStyle = 'rgba(140,220,200,0.7)';
  g.beginPath();
  g.arc(0, -len * 0.08, beam * 0.05, 0, Math.PI * 2);
  g.fill();
  // Tail fluke.
  g.fillStyle = '#3c4741';
  g.beginPath();
  g.moveTo(0, len * 0.45);
  g.lineTo(beam * 0.45, len * 0.55);
  g.lineTo(0, len * 0.5);
  g.lineTo(-beam * 0.45, len * 0.55);
  g.fill();
}

function orb(g: CanvasRenderingContext2D, beam: number, t: number, rgb: string, glow: number): void {
  const r = beam * 0.5 * (1 + Math.sin(t * 3) * 0.12);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * glow);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.6)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r * glow, 0, Math.PI * 2);
  g.fill();
}

function maw(g: CanvasRenderingContext2D, len: number, beam: number, t: number): void {
  const jaw = 0.15 + Math.max(0, Math.sin(t * 0.9)) * 0.25;
  g.fillStyle = '#0b0d10';
  g.beginPath();
  g.ellipse(0, len * 0.1, beam * 0.5, len * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  // Jaws with needle teeth.
  for (const side of [-1, 1]) {
    g.save();
    g.rotate(side * jaw);
    g.fillStyle = '#16191e';
    g.beginPath();
    g.moveTo(0, -len * 0.25);
    g.quadraticCurveTo(side * beam * 0.55, -len * 0.35, side * beam * 0.05, -len * 0.52);
    g.lineTo(0, -len * 0.25);
    g.fill();
    g.fillStyle = '#d9d2bd';
    for (let k = 0; k < 6; k++) {
      const y = -len * 0.28 - k * len * 0.035;
      g.beginPath();
      g.moveTo(side * beam * 0.02, y);
      g.lineTo(side * beam * (0.08 + k * 0.03), y - len * 0.01);
      g.lineTo(side * beam * 0.02, y - len * 0.02);
      g.fill();
    }
    g.restore();
  }
  // The lure on its stalk.
  const lx = Math.sin(t * 1.3) * beam * 0.15, ly = -len * 0.62;
  g.strokeStyle = '#2a2e33';
  g.lineWidth = Math.max(1, beam * 0.03);
  g.beginPath();
  g.moveTo(0, -len * 0.1);
  g.quadraticCurveTo(beam * 0.1, -len * 0.5, lx, ly);
  g.stroke();
  g.translate(lx, ly);
  orb(g, beam * 0.18, t * 1.7, '255,240,190', 2.5);
}

function serpent(g: CanvasRenderingContext2D, len: number, beam: number, t: number): void {
  const segs = 22;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    pts.push([Math.sin(t * 3 - u * 7) * beam * 2.2 * u, -len * 0.5 + u * len]);
  }
  for (let i = segs; i >= 1; i--) {
    const [x, y] = pts[i];
    const w = beam * (1 - (i / segs) * 0.6);
    g.fillStyle = i % 2 ? '#101213' : '#1c2022';
    g.beginPath();
    g.ellipse(x, y, w * 0.55, (len / segs) * 0.75, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Head.
  const [hx, hy] = pts[0];
  g.fillStyle = '#0d0f10';
  g.beginPath();
  g.ellipse(hx, hy, beam * 0.7, beam * 1.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c9e04a';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(hx + side * beam * 0.35, hy - beam * 0.4, Math.max(1, beam * 0.12), 0, Math.PI * 2);
    g.fill();
  }
}

function mother(g: CanvasRenderingContext2D, len: number, beam: number, t: number, id: number): void {
  const r = rnd(id % 997 + 13);
  // A mound of broken hulls, masts and ribs.
  g.fillStyle = '#1d1712';
  g.beginPath();
  g.ellipse(0, 0, beam * 0.5, len * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.48;
    const x = Math.sin(a) * beam * d, y = Math.cos(a) * len * d;
    if (Math.hypot(x / beam, y / len) < 0.2) continue; // the heart of the maze is open water
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI);
    g.fillStyle = ['#3a2d20', '#4b3a28', '#2d241b', '#5a4630'][i % 4];
    g.fillRect(-beam * 0.06, -beam * 0.012, beam * (0.08 + r() * 0.1), beam * 0.024);
    g.restore();
  }
  // The maze: a dark channel spiralling in.
  g.strokeStyle = 'rgba(12,20,26,0.9)';
  g.lineWidth = Math.max(2, beam * 0.04);
  g.beginPath();
  for (let k = 0; k <= 60; k++) {
    const a = k * 0.25, d = 0.48 - k * 0.006;
    const x = Math.sin(a) * beam * d, y = Math.cos(a) * len * d;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // Claws.
  for (const side of [-1, 1]) {
    const open = Math.sin(t * 1.5 + side) * 0.3;
    g.save();
    g.translate(side * beam * 0.45, -len * 0.3);
    g.rotate(side * (0.6 + open));
    g.fillStyle = '#6b4a35';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(side * beam * 0.2, -len * 0.15, 0, -len * 0.25);
    g.quadraticCurveTo(-side * beam * 0.05, -len * 0.12, 0, 0);
    g.fill();
    g.restore();
  }
}

function widow(g: CanvasRenderingContext2D, len: number, t: number): void {
  // A spiral of storm cloud around a pale veiled figure.
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate(t * (0.6 + i * 0.1) + i);
    g.strokeStyle = `rgba(150,160,175,${0.35 - i * 0.05})`;
    g.lineWidth = len * 0.06;
    g.beginPath();
    g.arc(0, 0, len * (0.18 + i * 0.07), 0, Math.PI * 1.3);
    g.stroke();
    g.restore();
  }
  g.fillStyle = 'rgba(225,230,240,0.85)';
  g.beginPath();
  g.moveTo(0, -len * 0.14);
  g.quadraticCurveTo(len * 0.08, 0, len * 0.06, len * 0.12);
  g.lineTo(-len * 0.06, len * 0.12);
  g.quadraticCurveTo(-len * 0.08, 0, 0, -len * 0.14);
  g.fill();
  if (Math.sin(t * 7.3) > 0.93) {
    g.strokeStyle = 'rgba(210,225,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    let x = 0, y = 0;
    for (let k = 0; k < 6; k++) {
      x += (Math.sin(t * 13 + k) * 0.5) * len * 0.12;
      y -= len * 0.08;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

function eye(g: CanvasRenderingContext2D, len: number, t: number): void {
  // A hole in the sea that looks back: black at the centre, a ring of wrong starlight, water pouring in.
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate(-t * (0.3 + i * 0.12) + i * 1.3);
    g.strokeStyle = `rgba(90,70,140,${0.5 - i * 0.07})`;
    g.lineWidth = len * 0.05;
    g.beginPath();
    g.arc(0, 0, len * (0.2 + i * 0.06), 0, Math.PI * 1.4);
    g.stroke();
    g.restore();
  }
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, len * 0.22);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.8, '#05030a');
  grad.addColorStop(1, 'rgba(5,3,10,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, len * 0.22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(220,210,255,0.9)';
  for (let i = 0; i < 12; i++) {
    const a = i * 0.52 + t * 0.05, r = len * (0.12 + ((i * 37) % 10) / 100);
    g.beginPath();
    g.arc(Math.sin(a) * r, -Math.cos(a) * r, Math.max(0.8, len * 0.006), 0, Math.PI * 2);
    g.fill();
  }
}

function hulk(g: CanvasRenderingContext2D, len: number, beam: number, id: number): void {
  const r = rnd(id % 991 + 5);
  g.rotate((r() - 0.5) * 0.3);
  g.beginPath();
  g.moveTo(0, -len / 2);
  g.bezierCurveTo(beam * 0.55, -len * 0.3, beam * 0.55, len * 0.3, beam * 0.4, len / 2);
  g.lineTo(-beam * 0.4, len / 2);
  g.bezierCurveTo(-beam * 0.55, len * 0.3, -beam * 0.55, -len * 0.3, 0, -len / 2);
  g.closePath();
  g.fillStyle = '#2a2118';
  g.fill();
  g.strokeStyle = '#120d09';
  g.lineWidth = 1.5;
  g.stroke();
  // Stove-in planking and a broken mast.
  g.fillStyle = '#0c0907';
  for (let i = 0; i < 4; i++) g.fillRect((r() - 0.5) * beam * 0.6, (r() - 0.5) * len * 0.7, beam * 0.18, len * 0.06);
  g.strokeStyle = '#4b3a28';
  g.lineWidth = Math.max(1, beam * 0.12);
  g.beginPath();
  g.moveTo(0, -len * 0.1);
  g.lineTo(beam * (r() - 0.5) * 1.6, -len * 0.1 - len * 0.35);
  g.stroke();
  g.fillStyle = 'rgba(120,140,110,0.35)';
  for (let i = 0; i < 20; i++) {
    g.beginPath();
    g.arc((r() - 0.5) * beam * 0.8, (r() - 0.5) * len * 0.9, Math.max(0.6, beam * 0.04), 0, Math.PI * 2);
    g.fill();
  }
}

/** Sunken cities (the bell buoy) and ship graveyards (the wall of wrecks, its gates, the silted field). */
export function drawPveSites(g: CanvasRenderingContext2D, sites: PveSiteView[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, w: number, h: number): void {
  for (const s of sites) {
    const x = sx(s.x), y = sy(s.y), r = s.r * zoom;
    if (x < -r - 50 || y < -r - 50 || x > w + r + 50 || y > h + r + 50) continue;
    g.save();
    if (s.kind === 'city') {
      // The drowned city itself, seen through dark water.
      const city = sprite('prop.drowned_city');
      if (city) {
        const size = Math.max(r * 2.6, 900 * zoom);
        g.globalAlpha = 0.5;
        g.drawImage(city.img, x - size / 2, y - size / 2, size, size);
        g.globalAlpha = 1;
      }
      // The bell buoy: a lantern on a float, and the drowned city's shadow below.
      const grad = g.createRadialGradient(x, y, 0, x, y, r * 1.8);
      grad.addColorStop(0, 'rgba(40,90,90,0.25)');
      grad.addColorStop(1, 'rgba(40,90,90,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r * 1.8, 0, Math.PI * 2);
      g.fill();
      // The bell's reach: a soft band of light on the water, no dashes.
      g.beginPath();
      g.arc(x, y, 250 * zoom, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(46,230,200,0.08)';
      g.lineWidth = Math.max(6, 14 * zoom);
      g.stroke();
      g.strokeStyle = 'rgba(46,230,200,0.3)';
      g.lineWidth = 1.2;
      g.stroke();
      const bob = Math.sin(t * 2) * 2;
      g.fillStyle = '#b08d57';
      g.beginPath();
      g.arc(x, y + bob, Math.max(3, 3 * zoom), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(255,230,150,${0.6 + Math.sin(t * 3) * 0.3})`;
      g.beginPath();
      g.arc(x, y + bob - Math.max(4, 4 * zoom), Math.max(2, 1.6 * zoom), 0, Math.PI * 2);
      g.fill();
    } else {
      const wall = (s.wall ?? 360) * zoom;
      // The silted field.
      g.fillStyle = 'rgba(60,48,32,0.10)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(160,120,80,0.1)';
      g.lineWidth = Math.max(6, 16 * zoom);
      g.stroke();
      g.strokeStyle = 'rgba(160,120,80,0.3)';
      g.lineWidth = 1.2;
      g.stroke();
      // The wall of wrecks, broken only where a gate is open.
      const open = (s.gates ?? []).filter((q) => q.open).map((q) => q.a);
      const gap = 0.14;
      const wallArt = sprite('prop.wreck_wall');
      if (wallArt) {
        // The wall as painted wreck piles laid end to end round the ring, broken where a gate stands open.
        const segLen = 110 * zoom, segH = segLen * (wallArt.img.naturalHeight / wallArt.img.naturalWidth) * 1.4;
        const n = Math.max(12, Math.ceil((Math.PI * 2 * wall) / (segLen * 0.85)));
        for (let i = 0; i < n; i++) {
          const mid = (i / n) * Math.PI * 2;
          if (open.some((a) => Math.abs(Math.atan2(Math.sin(mid - a), Math.cos(mid - a))) < gap)) continue;
          g.save();
          g.translate(x + Math.sin(mid) * wall, y - Math.cos(mid) * wall);
          g.rotate(mid + (i % 2 ? Math.PI : 0));
          g.drawImage(wallArt.img, -segLen / 2, -segH / 2, segLen, segH);
          g.restore();
        }
      }
      const steps = wallArt ? 0 : 180;
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        if (open.some((a) => Math.abs(Math.atan2(Math.sin(mid - a), Math.cos(mid - a))) < gap)) continue;
        g.strokeStyle = i % 3 === 0 ? '#3a2d20' : i % 3 === 1 ? '#2a2118' : '#4b3a28';
        g.lineWidth = Math.max(3, 16 * zoom);
        g.beginPath();
        g.arc(x, y, wall, a0 - Math.PI / 2, a1 - Math.PI / 2);
        g.stroke();
      }
      if (s.captain) {
        g.fillStyle = `rgba(46,230,200,${0.12 + Math.sin(t * 2) * 0.05})`;
        g.beginPath();
        g.arc(x, y, 90 * zoom, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.font = '12px "IM Fell English SC", serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(216,210,196,0.7)';
    g.fillText(serverText(s.name), x, y - (s.kind === 'city' ? 20 : (s.wall ?? 360) * zoom + 14));
    g.restore();
  }
}

/** The zones of a fight on the water, under the ships. */
export function drawBossZones(g: CanvasRenderingContext2D, bosses: BossView[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, lights: boolean): void {
  for (const b of bosses) {
    for (const z of b.zones) {
      const x = sx(z.x), y = sy(z.y), r = z.r * zoom;
      const glow = z.k === 'lure' || z.k === 'eye';
      if (glow !== lights) continue;
      g.save();
      switch (z.k) {
        case 'whirl':
          g.strokeStyle = 'rgba(170,200,210,0.35)';
          g.lineWidth = 2;
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            for (let a = 0; a < Math.PI * 4; a += 0.2) {
              const rr = r * (1 - a / (Math.PI * 4)) ;
              const px = x + Math.sin(a + t * 1.5 + k * 1.25) * rr, py = y - Math.cos(a + t * 1.5 + k * 1.25) * rr;
              if (a === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.stroke();
          }
          break;
        case 'ring':
          g.strokeStyle = 'rgba(20,24,26,0.85)';
          g.lineWidth = Math.max(4, 12 * zoom);
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.stroke();
          g.strokeStyle = 'rgba(201,224,74,0.25)';
          g.lineWidth = 1;
          g.stroke();
          break;
        case 'eye': {
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, 'rgba(200,220,255,0.10)');
          grad.addColorStop(1, 'rgba(200,220,255,0.02)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(200,220,255,0.12)';
          g.lineWidth = Math.max(6, 18 * zoom);
          g.stroke();
          g.strokeStyle = 'rgba(200,220,255,0.5)';
          g.lineWidth = 1.5;
          g.stroke();
          break;
        }
        case 'ink':
          // Ink in the water: soft, drifting blooms that thin out at their edges — never a flat black disc.
          for (let k = 0; k < 7; k++) {
            const bx = x + Math.sin(k * 2.1 + t * 0.15) * r * 0.45, by = y + Math.cos(k * 1.7 - t * 0.12) * r * 0.45;
            const br = r * (0.45 + 0.2 * Math.sin(k * 3.3 + t * 0.4));
            const ink = g.createRadialGradient(bx, by, 0, bx, by, br);
            ink.addColorStop(0, 'rgba(6,6,14,0.5)');
            ink.addColorStop(0.55, 'rgba(8,10,20,0.28)');
            ink.addColorStop(1, 'rgba(10,14,24,0)');
            g.fillStyle = ink;
            g.beginPath();
            g.arc(bx, by, br, 0, Math.PI * 2);
            g.fill();
          }
          break;
        case 'lure': {
          const pulse = 0.75 + Math.sin(t * 2 + z.x) * 0.25;
          const grad = g.createRadialGradient(x, y, 0, x, y, r * 1.6);
          grad.addColorStop(0, `rgba(255,225,150,${0.9 * pulse})`);
          grad.addColorStop(0.2, `rgba(255,210,120,${0.35 * pulse})`);
          grad.addColorStop(1, 'rgba(255,210,120,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(x, y, r * 1.6, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'telegraph': {
          const p = (t * 2) % 1;
          g.strokeStyle = `rgba(235,240,245,${0.9 - p * 0.6})`;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x, y, r * (0.4 + p * 0.8), 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = 'rgba(235,240,245,0.18)';
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'maze':
          g.strokeStyle = 'rgba(160,120,80,0.5)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'song':
          g.strokeStyle = 'rgba(155,107,208,0.18)';
          g.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const p = ((t * 0.3 + k / 3) % 1);
            g.beginPath();
            g.arc(x, y, r * p, 0, Math.PI * 2);
            g.stroke();
          }
          break;
        case 'bile':
          g.fillStyle = 'rgba(150,190,40,0.35)';
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          break;
      }
      g.restore();
    }
  }
}
