// docs/19 E5: a citadel's siege drawn on the hex field, by hand over the island's ground (nothing generated: the stone
// is the painted rock texture, the doors and the causeway the battle's own planks, the rest drawn): the courtyard's
// flagstones within the walls; the moat's dark water between stone banks and the causeway's planks before the gate;
// the wall line as a thick band of stone down its column, lit from the north-west and casting its shadow into the
// courtyard, battlements along its outer face, scarred where it is cracked and broken into rubble where it fell; the
// gate a pair of iron-bound doors between two pillars; the two arrow towers round and crenellated, their arrow slits
// toward the sea, a stump once silenced; the besiegers' catapult beyond the field's edge. Readable on a phone: the
// band is half a hex thick, the towers wider than a hex, the moat a different water from the surf.

import { SIEGE, TAC_H, hexIndex, hexX } from '../../../shared/src/data/tactical.ts';
import { pattern, sprite } from '../assets.ts';

type G = CanvasRenderingContext2D;
type P = { x: number; y: number };

export interface SiegeDraw {
  cells: string;
  /** A hex's centre on the board, the hex's width and corner radius. */
  lc: (i: number) => P;
  w: number;
  r: number;
  hexPath: (g: G, x: number, y: number, r: number) => void;
  /** The neighbour across each edge of a hex (E, SE, SW, W, NW, NE). */
  across: (i: number, edge: number) => number | null;
  planks: HTMLCanvasElement;
}

const WALLS = new Set(['X', 'Y', 'G', 'J', 'T', 'U', 'V']);
const standing = (c: string | undefined) => !!c && WALLS.has(c);

/** A seeded roll for a hex (the same every draw). */
function rnd(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

let flags: HTMLCanvasElement | null = null;
/** The courtyard's flagstones: grey slabs in staggered rows, their joints dark. */
function flagstones(): HTMLCanvasElement {
  if (flags) return flags;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  const R = rnd(7);
  g.fillStyle = '#4b4842';
  g.fillRect(0, 0, 96, 96);
  for (let row = 0; row < 6; row++) {
    const h = 16, off = row % 2 ? 12 : 0;
    for (let x = -24; x < 96; x += 24) {
      const t = 66 + Math.floor(R() * 22);
      g.fillStyle = `rgb(${t},${t - 3},${t - 8})`;
      g.fillRect(x + off + 1, row * h + 1, 22, h - 2);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x + off + 1, row * h + 1, 22, 2);
    }
  }
  return (flags = c);
}

/** The ground of the siege, under the stacks: the courtyard, the moat, the causeway, the rubble and the wall line. */
export function drawSiegeField(g: G, d: SiegeDraw): void {
  const { cells, lc, w, r } = d;
  // The courtyard within the walls.
  const fp = g.createPattern(flagstones(), 'repeat');
  for (let i = 0; i < cells.length; i++) {
    if (hexX(i) <= SIEGE.wallX || cells[i] === '#') continue;
    const p = lc(i);
    g.save();
    d.hexPath(g, p.x, p.y, r + 0.8);
    g.clip();
    g.fillStyle = fp ?? '#4b4842';
    g.globalAlpha = 0.88;
    g.fillRect(p.x - w, p.y - r * 1.2, w * 2, r * 2.4);
    g.restore();
  }
  // The moat: dark still water, its stone banks where it meets the ground.
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'O') continue;
    const p = lc(i);
    const wg = g.createRadialGradient(p.x - r * 0.2, p.y - r * 0.2, r * 0.1, p.x, p.y, r * 1.2);
    wg.addColorStop(0, '#24474f');
    wg.addColorStop(1, '#13282e');
    g.fillStyle = wg;
    d.hexPath(g, p.x, p.y, r + 0.8);
    g.fill();
    const R = rnd(i + 11);
    g.strokeStyle = 'rgba(160,210,215,0.22)';
    g.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const yy = p.y - r * 0.35 + k * r * 0.6 + R() * 3, xx = p.x - w * 0.3 + R() * w * 0.1;
      g.beginPath();
      g.moveTo(xx, yy);
      g.quadraticCurveTo(xx + w * 0.25, yy - 2, xx + w * 0.5, yy);
      g.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const n = d.across(i, k);
      if (n === null || cells[n] === 'O' || cells[n] === 'D') continue;
      const a0 = ((60 * k - 30) * Math.PI) / 180, a1 = ((60 * (k + 1) - 30) * Math.PI) / 180;
      g.strokeStyle = '#26221d';
      g.lineWidth = Math.max(3, w * 0.12);
      g.beginPath();
      g.moveTo(p.x + r * Math.cos(a0), p.y + r * Math.sin(a0));
      g.lineTo(p.x + r * Math.cos(a1), p.y + r * Math.sin(a1));
      g.stroke();
      g.strokeStyle = '#8b8473';
      g.lineWidth = Math.max(1, w * 0.04);
      g.stroke();
    }
  }
  // The causeway before the gate: the battle's planks across the moat's line.
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'D') continue;
    const p = lc(i);
    g.save();
    g.translate(p.x, p.y);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(-w * 0.55, -r * 0.5 + 3, w * 1.1, r * 1.0);
    g.fillStyle = g.createPattern(d.planks, 'repeat') ?? '#6b4b2c';
    g.fillRect(-w * 0.55, -r * 0.5, w * 1.1, r * 1.0);
    g.strokeStyle = 'rgba(20,10,4,0.75)';
    g.lineWidth = 1.5;
    g.strokeRect(-w * 0.55, -r * 0.5, w * 1.1, r * 1.0);
    g.strokeStyle = '#2b2b2b';
    g.lineWidth = Math.max(1.5, w * 0.05);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(-w * 0.55, s * r * 0.5);
      g.lineTo(w * 0.55, s * r * 0.5);
      g.stroke();
    }
    g.restore();
  }
  // The rubble of what fell: broken stone heaped on the ground.
  for (let i = 0; i < cells.length; i++) if (cells[i] === 'r') rubble(g, lc(i), w, i);
  drawWallLine(g, d);
}

function rubble(g: G, p: P, w: number, seed: number): void {
  const R = rnd(seed + 101);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(p.x + w * 0.04, p.y + w * 0.06, w * 0.46, w * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  for (let k = 0; k < 9; k++) {
    const x = p.x + (R() - 0.5) * w * 0.75, y = p.y + (R() - 0.5) * w * 0.6, s = w * (0.07 + R() * 0.09);
    const t = 92 + Math.floor(R() * 40);
    g.fillStyle = `rgb(${t},${t - 4},${t - 12})`;
    g.beginPath();
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + R();
      const rr = s * (0.7 + R() * 0.5);
      if (j) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,18,15,0.6)';
    g.lineWidth = 1;
    g.stroke();
  }
}

/** The stone's fill: the painted rock, darkened to dressed stone. */
function stoneFill(g: G, tone: number): string | CanvasPattern {
  sprite('tex.rock');
  const pt = pattern(g, 'tex.rock');
  if (!pt) return tone > 0.5 ? '#8a8476' : '#6a655b';
  return pt;
}

/** The wall line down its column: the band between the standing parts, the battlements, the gate, the towers. */
function drawWallLine(g: G, d: SiegeDraw): void {
  const { cells, lc, w } = d;
  const at = (y: number) => lc(hexIndex(SIEGE.wallX, y));
  const cell = (y: number) => cells[hexIndex(SIEGE.wallX, y)];
  const T = w * 0.5; // the band's thickness
  // The band: each run between two standing neighbours (and to the field's edges), its shadow into the courtyard first.
  const runs: [P, P, boolean][] = [];
  for (let y = 0; y < TAC_H; y++) {
    if (!standing(cell(y))) continue;
    const p = at(y);
    if (y === 0) runs.push([{ x: p.x, y: p.y - d.r * 1.15 }, p, cell(y) === 'Y']);
    if (y === TAC_H - 1) runs.push([p, { x: p.x, y: p.y + d.r * 1.15 }, cell(y) === 'Y']);
    if (y + 1 < TAC_H && standing(cell(y + 1))) runs.push([p, at(y + 1), cell(y) === 'Y' || cell(y + 1) === 'Y']);
  }
  // A breach's broken ends: a stub of the band toward the rubble.
  for (let y = 0; y < TAC_H; y++) {
    if (!standing(cell(y))) continue;
    for (const n of [y - 1, y + 1]) {
      if (n < 0 || n >= TAC_H || standing(cell(n))) continue;
      const p = at(y), q = at(n);
      runs.push([p, { x: p.x + (q.x - p.x) * 0.35, y: p.y + (q.y - p.y) * 0.35 }, true]);
    }
  }
  g.save();
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  // Shadow into the courtyard (the light from the north-west).
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = T * 1.25;
  for (const [a, b] of runs) {
    g.beginPath();
    g.moveTo(a.x + T * 0.45, a.y + T * 0.3);
    g.lineTo(b.x + T * 0.45, b.y + T * 0.3);
    g.stroke();
  }
  // The dark mortar edge, then the stone, then the walkway's lit top.
  g.strokeStyle = '#1f1c18';
  g.lineWidth = T + 4;
  for (const [a, b] of runs) {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  g.strokeStyle = stoneFill(g, 1);
  g.lineWidth = T;
  for (const [a, b] of runs) {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(70,64,56,0.55)';
  g.lineWidth = T;
  for (const [a, b] of runs) {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(214,205,182,0.32)';
  g.lineWidth = T * 0.36;
  for (const [a, b] of runs) {
    g.beginPath();
    g.moveTo(a.x + T * 0.08, a.y);
    g.lineTo(b.x + T * 0.08, b.y);
    g.stroke();
  }
  // Battlements along the outer face (toward the besiegers): merlons every so often.
  for (const [a, b, cracked] of runs) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 2) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    // The outer side: the normal pointing to the field's left.
    let nx = -uy, ny = ux;
    if (nx > 0) [nx, ny] = [-nx, -ny];
    const step = w * 0.24, m = w * 0.13;
    let k = 0;
    for (let s = step * 0.5; s < len; s += step, k++) {
      if (cracked && k % 3 === 1) continue;
      const cx = a.x + ux * s + nx * T * 0.42, cy = a.y + uy * s + ny * T * 0.42;
      g.fillStyle = '#9a9384';
      g.strokeStyle = '#1f1c18';
      g.lineWidth = 1;
      g.beginPath();
      g.rect(cx - m / 2, cy - m / 2, m, m);
      g.fill();
      g.stroke();
    }
    if (cracked) crack(g, a, b, T, len);
  }
  g.restore();
  // The gate and the towers over the band.
  for (let y = 0; y < TAC_H; y++) {
    const c = cell(y);
    if (c === 'G' || c === 'J') gate(g, at(y), w, d.planks, c === 'J');
    else if (c === 'T' || c === 'U') tower(g, at(y), w, c === 'U');
    else if (c === 'V') stump(g, at(y), w, y);
  }
}

/** A crack zigzagging down a cracked run of the band. */
function crack(g: G, a: P, b: P, T: number, len: number): void {
  const R = rnd(Math.round(a.x * 7 + a.y * 13));
  g.strokeStyle = 'rgba(15,12,10,0.9)';
  g.lineWidth = Math.max(1.5, T * 0.08);
  g.beginPath();
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  for (let k = 0; k <= 6; k++) {
    const s = (len * k) / 6, off = (R() - 0.5) * T * 0.8;
    const x = a.x + ux * s - uy * off, y = a.y + uy * s + ux * off;
    if (k) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
}

/** The gate: two square pillars and a pair of iron-bound doors between them (one hanging off when cracked). */
function gate(g: G, p: P, w: number, planks: HTMLCanvasElement, cracked: boolean): void {
  const H = w * 0.62, W = w * 0.44;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(-W / 2 + 4, -H / 2 + 4, W, H);
  // The doors.
  g.fillStyle = g.createPattern(planks, 'repeat') ?? '#6b4b2c';
  g.save();
  if (cracked) {
    g.translate(0, -H * 0.05);
    g.rotate(0.12);
  }
  g.fillRect(-W / 2, -H / 2, W, H);
  g.strokeStyle = '#1a120a';
  g.lineWidth = 1.5;
  g.strokeRect(-W / 2, -H / 2, W, H);
  g.beginPath();
  g.moveTo(0, -H / 2);
  g.lineTo(0, H / 2);
  g.stroke();
  // The iron bands and studs.
  g.fillStyle = '#2b2b2e';
  for (const yy of [-H * 0.3, H * 0.25]) g.fillRect(-W / 2, yy - w * 0.025, W, w * 0.05);
  g.fillStyle = '#9c9c98';
  for (const yy of [-H * 0.3, H * 0.25]) for (const xx of [-W * 0.35, -W * 0.12, W * 0.12, W * 0.35]) g.fillRect(xx - 1, yy - 1, 2, 2);
  if (cracked) {
    g.strokeStyle = 'rgba(15,10,6,0.95)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-W * 0.3, -H * 0.4);
    g.lineTo(-W * 0.05, -H * 0.05);
    g.lineTo(-W * 0.25, H * 0.2);
    g.stroke();
  }
  g.restore();
  // The pillars above and below it.
  for (const s of [-1, 1]) {
    const py = s * (H / 2 + w * 0.1);
    g.fillStyle = stoneFill(g, 1);
    g.fillRect(-w * 0.2, py - w * 0.13, w * 0.4, w * 0.26);
    g.fillStyle = 'rgba(70,64,56,0.4)';
    g.fillRect(-w * 0.2, py - w * 0.13, w * 0.4, w * 0.26);
    g.strokeStyle = '#1f1c18';
    g.lineWidth = 1.5;
    g.strokeRect(-w * 0.2, py - w * 0.13, w * 0.4, w * 0.26);
  }
  g.restore();
}

/** An arrow tower from above: a round of stone wider than a hex, its crenellated rim, the dark of its top, its arrow
 *  slits toward the sea; cracked, scarred. */
function tower(g: G, p: P, w: number, cracked: boolean): void {
  const R0 = w * 0.6;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.arc(p.x + R0 * 0.22, p.y + R0 * 0.18, R0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(p.x, p.y, R0, 0, Math.PI * 2);
  g.fillStyle = '#1f1c18';
  g.fill();
  g.beginPath();
  g.arc(p.x, p.y, R0 - 2, 0, Math.PI * 2);
  g.fillStyle = stoneFill(g, 1);
  g.fill();
  const lit = g.createRadialGradient(p.x - R0 * 0.35, p.y - R0 * 0.35, R0 * 0.1, p.x, p.y, R0);
  lit.addColorStop(0, 'rgba(230,220,195,0.28)');
  lit.addColorStop(1, 'rgba(30,26,22,0.45)');
  g.fillStyle = lit;
  g.fill();
  // The rim's merlons.
  for (let k = 0; k < 10; k++) {
    if (cracked && k % 4 === 2) continue;
    const a = (k / 10) * Math.PI * 2;
    const x = p.x + Math.cos(a) * R0 * 0.8, y = p.y + Math.sin(a) * R0 * 0.8;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = '#a39b8a';
    g.strokeStyle = '#1f1c18';
    g.lineWidth = 1;
    g.fillRect(-R0 * 0.1, -R0 * 0.12, R0 * 0.2, R0 * 0.24);
    g.strokeRect(-R0 * 0.1, -R0 * 0.12, R0 * 0.2, R0 * 0.24);
    g.restore();
  }
  // The top's dark floor and the hatch.
  g.beginPath();
  g.arc(p.x, p.y, R0 * 0.58, 0, Math.PI * 2);
  g.fillStyle = '#3a3530';
  g.fill();
  g.fillStyle = '#5b4229';
  g.fillRect(p.x - R0 * 0.16, p.y - R0 * 0.16, R0 * 0.32, R0 * 0.32);
  // The slits toward the sea.
  g.strokeStyle = '#0d0b09';
  g.lineWidth = Math.max(1.5, R0 * 0.06);
  for (const a of [Math.PI - 0.5, Math.PI, Math.PI + 0.5]) {
    g.beginPath();
    g.moveTo(p.x + Math.cos(a) * R0 * 0.62, p.y + Math.sin(a) * R0 * 0.62);
    g.lineTo(p.x + Math.cos(a) * R0 * 0.92, p.y + Math.sin(a) * R0 * 0.92);
    g.stroke();
  }
  if (cracked) {
    g.strokeStyle = 'rgba(15,12,10,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(p.x - R0 * 0.2, p.y - R0 * 0.95);
    g.lineTo(p.x - R0 * 0.05, p.y - R0 * 0.5);
    g.lineTo(p.x - R0 * 0.3, p.y - R0 * 0.2);
    g.stroke();
  }
  g.restore();
}

/** A silenced tower: a broken ring of stone round a heap of its fallen top. */
function stump(g: G, p: P, w: number, seed: number): void {
  const R0 = w * 0.55;
  g.save();
  g.beginPath();
  g.arc(p.x, p.y, R0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();
  g.strokeStyle = '#1f1c18';
  g.lineWidth = R0 * 0.32;
  g.beginPath();
  g.arc(p.x, p.y, R0 * 0.78, 0.6, Math.PI * 1.55);
  g.stroke();
  g.strokeStyle = stoneFill(g, 0);
  g.lineWidth = R0 * 0.24;
  g.stroke();
  rubble(g, p, w * 0.9, seed + 500);
  g.restore();
}

/** The besiegers' catapult beyond the field's left edge (board space), its arm drawn back. */
export function drawCatapult(g: G, p: P, w: number, planks: HTMLCanvasElement): void {
  const s = w * 0.9;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(4, 6, s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = g.createPattern(planks, 'repeat') ?? '#6b4b2c';
  g.strokeStyle = '#1a120a';
  g.lineWidth = 1.5;
  // The frame: two rails and the cross-beams.
  for (const yy of [-s * 0.28, s * 0.28]) {
    g.fillRect(-s * 0.55, yy - s * 0.06, s * 1.1, s * 0.12);
    g.strokeRect(-s * 0.55, yy - s * 0.06, s * 1.1, s * 0.12);
  }
  for (const xx of [-s * 0.45, s * 0.1]) {
    g.fillRect(xx - s * 0.05, -s * 0.34, s * 0.1, s * 0.68);
    g.strokeRect(xx - s * 0.05, -s * 0.34, s * 0.1, s * 0.68);
  }
  // The arm and its bucket of stone.
  g.save();
  g.rotate(-0.25);
  g.fillRect(-s * 0.05, -s * 0.06, s * 0.75, s * 0.12);
  g.strokeRect(-s * 0.05, -s * 0.06, s * 0.75, s * 0.12);
  g.beginPath();
  g.arc(s * 0.72, 0, s * 0.12, 0, Math.PI * 2);
  g.fillStyle = '#7d776b';
  g.fill();
  g.stroke();
  g.restore();
  // The wheels.
  g.fillStyle = '#3a2a1a';
  for (const xx of [-s * 0.4, s * 0.4]) for (const yy of [-s * 0.34, s * 0.34]) {
    g.beginPath();
    g.ellipse(xx, yy, s * 0.11, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

/** Where the catapult stands (board space): left of the field, over against the gate. */
export function catapultAt(lc: (i: number) => P, w: number): P {
  const p = lc(hexIndex(0, SIEGE.gateY));
  return { x: p.x - w * 0.95, y: p.y };
}

