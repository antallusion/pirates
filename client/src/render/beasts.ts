// The beasts of the sea (docs/12 P4), drawn procedurally from above: an orca's black and white, the White Orca's
// scars, a humpback's long white flippers, a sperm whale's blunt box of a head, a narwhal's spiral tusk, a shark's
// fin and a young serpent's coils — every one swimming (the flukes beat, the body flexes). A carcass floats belly
// up, cut where it has been flensed, in a slick of its blood.
//
// The canvas is already at the beast's place and turned to its heading: the head is toward −y. When the painted beast
// is loaded (docs/12 P11, `monster.<id>` from one sheet) it is drawn instead, cut across in segments that turn one after
// another so its tail still beats; the procedural beast is the stand-in.

import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { sprite } from '../assets.ts';

type G = CanvasRenderingContext2D;

/** A tapering body from snout to tail stock, flexed by `bend` toward the tail. */
function body(g: G, len: number, beam: number, bend: number, snout = 0.5, fat = 0.5): void {
  const h = len / 2, w = beam / 2;
  g.beginPath();
  g.moveTo(0, -h);
  g.bezierCurveTo(w * snout * 1.4, -h, w, -h * fat, w * 0.95 + bend * 0.2, 0);
  g.bezierCurveTo(w * 0.8 + bend * 0.5, h * 0.45, w * 0.25 + bend, h * 0.85, bend, h * 0.9);
  g.bezierCurveTo(-w * 0.25 + bend, h * 0.85, -w * 0.8 + bend * 0.5, h * 0.45, -w * 0.95 + bend * 0.2, 0);
  g.bezierCurveTo(-w, -h * fat, -w * snout * 1.4, -h, 0, -h);
  g.closePath();
}

/** The tail flukes at the end of the stock, swinging. */
function flukes(g: G, len: number, beam: number, bend: number, span = 1.2, color = '#101418'): void {
  const h = len / 2;
  g.save();
  g.translate(bend, h * 0.88);
  g.rotate(bend / Math.max(1, len) * 2.5);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(beam * span * 0.5, len * 0.02, beam * span * 0.62, len * 0.12);
  g.quadraticCurveTo(beam * span * 0.25, len * 0.08, 0, len * 0.1);
  g.quadraticCurveTo(-beam * span * 0.25, len * 0.08, -beam * span * 0.62, len * 0.12);
  g.quadraticCurveTo(-beam * span * 0.5, len * 0.02, 0, 0);
  g.fill();
  g.restore();
}

/** Pectoral fins: a pair swept back from `at` (0 head … 1 tail). */
function fins(g: G, len: number, beam: number, at: number, reach: number, sweep: number, width: number, color: string, flap = 0): void {
  const y = -len / 2 + len * at;
  g.fillStyle = color;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * beam * 0.42, y);
    g.rotate(side * (sweep + flap));
    g.beginPath();
    g.moveTo(0, -width / 2);
    g.quadraticCurveTo(side * reach * 0.7, reach * 0.1, side * reach, reach * 0.45);
    g.quadraticCurveTo(side * reach * 0.5, reach * 0.3, 0, width / 2);
    g.closePath();
    g.fill();
    g.restore();
  }
}

function eyeDots(g: G, len: number, beam: number, at: number, color: string, r = 0.06): void {
  g.fillStyle = color;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(side * beam * 0.36, -len / 2 + len * at, Math.max(0.6, beam * r), 0, Math.PI * 2);
    g.fill();
  }
}

function orca(g: G, len: number, beam: number, t: number, white: boolean): void {
  const bend = Math.sin(t * 5) * beam * 0.35;
  const hide = white ? '#e9ecea' : '#0b0d10';
  const belly = white ? '#c9d0d0' : '#f2f4f2';
  fins(g, len, beam, 0.3, beam * 0.9, 0.5, beam * 0.3, hide, Math.sin(t * 2) * 0.1);
  flukes(g, len, beam, bend, 1.4, hide);
  body(g, len, beam, bend, 0.55, 0.6);
  g.fillStyle = hide;
  g.fill();
  // The white of the flanks and the eye patch; on the White Orca, her scars.
  g.save();
  g.clip();
  g.fillStyle = belly;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * beam * 0.46, len * 0.05, beam * 0.16, len * 0.2, side * 0.1, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(side * beam * 0.26, -len * 0.3, beam * 0.13, len * 0.07, side * -0.3, 0, Math.PI * 2);
    g.fill();
  }
  // The grey saddle behind the fin.
  g.fillStyle = white ? 'rgba(120,130,135,0.45)' : 'rgba(150,158,165,0.55)';
  g.beginPath();
  g.ellipse(0, len * 0.08, beam * 0.3, len * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  if (white) {
    g.strokeStyle = 'rgba(150,60,60,0.55)';
    g.lineWidth = Math.max(0.6, beam * 0.04);
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(-beam * 0.3 + i * beam * 0.14, -len * 0.15 + i * len * 0.07);
      g.lineTo(-beam * 0.1 + i * beam * 0.14, -len * 0.05 + i * len * 0.07);
      g.stroke();
    }
  }
  g.restore();
  // The tall dorsal fin seen from above: a dark blade with its shadow.
  g.fillStyle = white ? '#b9c0c2' : '#000';
  g.beginPath();
  g.moveTo(0, -len * 0.08);
  g.lineTo(beam * 0.1 + bend * 0.1, len * 0.12);
  g.lineTo(-beam * 0.08, len * 0.1);
  g.closePath();
  g.fill();
}

function humpback(g: G, len: number, beam: number, t: number): void {
  const bend = Math.sin(t * 1.6) * beam * 0.3;
  // The long white flippers, a third of its length.
  fins(g, len, beam, 0.3, len * 0.32, 0.9, beam * 0.28, '#d8dfe2', Math.sin(t * 0.9) * 0.15);
  flukes(g, len, beam, bend, 1.5, '#243039');
  body(g, len, beam, bend, 0.7, 0.4);
  const grad = g.createLinearGradient(-beam / 2, 0, beam / 2, 0);
  grad.addColorStop(0, '#1d2830');
  grad.addColorStop(0.5, '#35444f');
  grad.addColorStop(1, '#1d2830');
  g.fillStyle = grad;
  g.fill();
  // Knobs on the head, barnacles.
  g.fillStyle = 'rgba(200,205,195,0.55)';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(((i % 3) - 1) * beam * 0.18, -len * 0.44 + Math.floor(i / 3) * len * 0.05, Math.max(0.5, beam * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  // The small hump of a dorsal fin.
  g.fillStyle = '#141c22';
  g.beginPath();
  g.ellipse(bend * 0.3, len * 0.22, beam * 0.07, len * 0.05, 0, 0, Math.PI * 2);
  g.fill();
}

function spermWhale(g: G, len: number, beam: number, t: number): void {
  const bend = Math.sin(t * 1.3) * beam * 0.28;
  fins(g, len, beam, 0.38, beam * 0.45, 0.8, beam * 0.2, '#2b2622');
  flukes(g, len, beam, bend, 1.3, '#2b2622');
  // A blunt box of a head, a third of it, then the tapering rest.
  const h = len / 2, w = beam / 2;
  g.beginPath();
  g.moveTo(-w * 0.85, -h);
  g.lineTo(w * 0.85, -h);
  g.quadraticCurveTo(w, -h, w, -h * 0.85);
  g.lineTo(w, -h * 0.2);
  g.bezierCurveTo(w * 0.9 + bend * 0.3, h * 0.3, w * 0.3 + bend, h * 0.85, bend, h * 0.9);
  g.bezierCurveTo(-w * 0.3 + bend, h * 0.85, -w * 0.9 + bend * 0.3, h * 0.3, -w, -h * 0.2);
  g.lineTo(-w, -h * 0.85);
  g.quadraticCurveTo(-w, -h, -w * 0.85, -h);
  g.closePath();
  g.fillStyle = '#3d3630';
  g.fill();
  // Wrinkled hide, the blowhole to one side.
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(20,16,14,0.45)';
  g.lineWidth = Math.max(0.5, beam * 0.03);
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(-w, -h * 0.1 + i * len * 0.07);
    g.quadraticCurveTo(0, -h * 0.06 + i * len * 0.07, w, -h * 0.1 + i * len * 0.07);
    g.stroke();
  }
  g.restore();
  g.fillStyle = '#0c0a09';
  g.beginPath();
  g.ellipse(-w * 0.45, -h * 0.92, Math.max(0.6, beam * 0.07), Math.max(0.6, beam * 0.04), 0, 0, Math.PI * 2);
  g.fill();
}

function narwhal(g: G, len: number, beam: number, t: number): void {
  const bend = Math.sin(t * 3) * beam * 0.3;
  // The tusk: a spiral half as long again as the head is from the tail.
  g.strokeStyle = '#efe6cf';
  g.lineWidth = Math.max(0.8, beam * 0.08);
  g.beginPath();
  g.moveTo(0, -len / 2);
  g.lineTo(0, -len / 2 - len * 0.45);
  g.stroke();
  g.strokeStyle = 'rgba(120,100,70,0.6)';
  g.lineWidth = Math.max(0.4, beam * 0.03);
  for (let i = 1; i < 8; i++) {
    const y = -len / 2 - (len * 0.45 * i) / 8;
    g.beginPath();
    g.moveTo(-beam * 0.05, y);
    g.lineTo(beam * 0.05, y - len * 0.02);
    g.stroke();
  }
  fins(g, len, beam, 0.3, beam * 0.5, 0.7, beam * 0.22, '#5d6663');
  flukes(g, len, beam, bend, 1.3, '#4a524f');
  body(g, len, beam, bend, 0.6, 0.55);
  g.fillStyle = '#7f8a86';
  g.fill();
  // Mottled like a stone.
  g.save();
  g.clip();
  g.fillStyle = 'rgba(40,46,44,0.55)';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc(Math.sin(i * 2.3) * beam * 0.35, -len * 0.4 + ((i * 37) % 100) / 100 * len * 0.85, Math.max(0.5, beam * 0.07), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function shark(g: G, len: number, beam: number, t: number): void {
  const bend = Math.sin(t * 6) * beam * 0.5;
  fins(g, len, beam, 0.35, beam * 1.1, 1.0, beam * 0.3, '#48525a');
  // A crescent tail, upright: from above, a blade flicking side to side.
  g.save();
  g.translate(bend, len * 0.42);
  g.rotate(bend / Math.max(1, len) * 3);
  g.fillStyle = '#3d464d';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(beam * 0.35, len * 0.18);
  g.lineTo(-beam * 0.25, len * 0.14);
  g.closePath();
  g.fill();
  g.restore();
  body(g, len, beam, bend, 0.35, 0.65);
  g.fillStyle = '#5b666e';
  g.fill();
  g.fillStyle = '#2c3338';
  g.beginPath();
  g.moveTo(0, -len * 0.08);
  g.lineTo(beam * 0.12, len * 0.08);
  g.lineTo(-beam * 0.12, len * 0.08);
  g.closePath();
  g.fill();
  eyeDots(g, len, beam, 0.12, '#0a0a0a', 0.07);
}

function youngSerpent(g: G, len: number, beam: number, t: number): void {
  const segs = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    pts.push([Math.sin(t * 3.4 - u * 8) * beam * 1.8 * u, -len * 0.5 + u * len]);
  }
  for (let i = segs; i >= 1; i--) {
    const [x, y] = pts[i];
    const w = beam * (1 - (i / segs) * 0.6);
    g.fillStyle = i % 2 ? '#1f4a32' : '#2c6343';
    g.beginPath();
    g.ellipse(x, y, w * 0.55, (len / segs) * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    // A pale ridge of scales down the back.
    g.fillStyle = 'rgba(170,220,150,0.45)';
    g.beginPath();
    g.arc(x, y, Math.max(0.5, w * 0.12), 0, Math.PI * 2);
    g.fill();
  }
  const [hx, hy] = pts[0];
  g.fillStyle = '#163a27';
  g.beginPath();
  g.ellipse(hx, hy, beam * 0.65, beam * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8d34a';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(hx + side * beam * 0.3, hy - beam * 0.35, Math.max(0.8, beam * 0.12), 0, Math.PI * 2);
    g.fill();
  }
}

/** The painted beast, `len` from snout to tail, its body in segments: the fore part still, each piece behind it turned a
 * little more, the wave running down to the tail. False when it is not loaded. */
function painted(g: G, id: BeastId, len: number, t: number, seed: number, limp: boolean): boolean {
  const spr = sprite(`monster.${id}`);
  if (!spr) return false;
  const img = spr.img;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const h = len / spr.extentY, w = h * (iw / ih);
  const top = -h * spr.cy, left = -w * spr.cx;
  const head = spr.cy - spr.extentY / 2;
  const pieces = id === 'young_serpent' ? 5 : 4;
  const fore = id === 'young_serpent' ? 0.3 : 0.42;
  const cut = [0];
  for (let k = 0; k < pieces - 1; k++) cut.push(head + spr.extentY * (fore + ((1 - fore) * k) / (pieces - 1)));
  cut.push(1);
  const ph = t * (id === 'shark' ? 2.4 : id === 'young_serpent' ? 1.5 : 1.1) + seed * 0.61;
  const amp = limp ? 0 : id === 'young_serpent' ? 0.2 : id === 'shark' ? 0.11 : 0.07;
  const breathe = limp ? 1 : 1 + Math.sin(ph * 0.9) * 0.012;
  // A soft shadow under the water beneath it (docs/12 P11), not for a carcass afloat.
  if (!limp) {
    g.save();
    g.globalAlpha *= 0.35;
    g.filter = `brightness(0) blur(${Math.max(1, Math.round(len * 0.03))}px)`;
    g.drawImage(img, left + len * 0.04, top + len * 0.05, w, h);
    g.restore();
  }
  g.save();
  g.scale(breathe, 1);
  // The overlap hides the seams where a piece turns.
  const ov = 2 / ih;
  g.drawImage(img, 0, 0, iw, cut[1] * ih, left, top, w, cut[1] * h);
  g.translate(0, top + cut[1] * h);
  for (let k = 1; k < cut.length - 1; k++) {
    g.rotate(amp * Math.sin(ph - k * 0.9));
    const s0 = Math.max(0, cut[k] - ov), s1 = cut[k + 1];
    g.drawImage(img, 0, s0 * ih, iw, (s1 - s0) * ih, left, (s0 - cut[k]) * h, w, (s1 - s0) * h);
    g.translate(0, (cut[k + 1] - cut[k]) * h);
  }
  g.restore();
  return true;
}

/** A beast at the canvas origin, head toward −y (len and beam in px). */
export function drawBeast(g: G, id: BeastId, len: number, beam: number, t: number, seed: number): void {
  if (painted(g, id, len, t, seed, false)) return;
  const ph = t + seed * 0.61;
  switch (id) {
    case 'orca': return orca(g, len, beam, ph, false);
    case 'white_orca': return orca(g, len, beam, ph, true);
    case 'humpback': return humpback(g, len, beam, ph);
    case 'sperm_whale': return spermWhale(g, len, beam, ph);
    case 'narwhal': return narwhal(g, len, beam, ph);
    case 'shark': return shark(g, len, beam, ph);
    case 'young_serpent': return youngSerpent(g, len, beam, ph);
  }
}

/** A carcass belly up in its blood: pale, bloated, cut where the knives have been. */
export function drawCarcass(g: G, id: BeastId, len: number, beam: number, progress: number, blood: boolean, t: number, seed: number): void {
  // The slick first, under it.
  if (blood) {
    const r = len * (0.9 + 0.1 * Math.sin(t * 0.7 + seed));
    const grad = g.createRadialGradient(0, 0, len * 0.2, 0, 0, r);
    grad.addColorStop(0, 'rgba(120,10,14,0.55)');
    grad.addColorStop(0.6, 'rgba(110,12,16,0.28)');
    grad.addColorStop(1, 'rgba(90,10,14,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
  }
  // The painted one, turned belly up: pale, washed of its colour, the knife cuts across it.
  if (sprite(`monster.${id}`)) {
    g.save();
    g.scale(-1, 1);
    g.filter = 'saturate(0.25) brightness(1.4) contrast(0.85)';
    painted(g, id, len, t, seed, true);
    g.filter = 'none';
    g.restore();
    g.strokeStyle = 'rgba(170,20,26,0.85)';
    g.lineWidth = Math.max(0.8, beam * 0.08);
    const n = Math.round(progress * 8);
    for (let i = 0; i < n; i++) {
      const y = -len * 0.34 + (i * len * 0.6) / 8;
      g.beginPath();
      g.moveTo(-beam * 0.3, y);
      g.lineTo(beam * 0.3, y + len * 0.02);
      g.stroke();
    }
    return;
  }
  if (id === 'young_serpent') {
    g.globalAlpha *= 0.85;
    youngSerpent(g, len, beam, 0);
    return;
  }
  const w = id === 'humpback' ? 0.55 : id === 'sperm_whale' ? 0.6 : 0.5;
  body(g, len, beam * 1.15, 0, w, 0.5);
  g.fillStyle = id === 'orca' || id === 'white_orca' ? '#e7e2da' : id === 'shark' ? '#d9d6ce' : '#b9b2a6';
  g.fill();
  g.strokeStyle = 'rgba(60,40,36,0.7)';
  g.lineWidth = Math.max(0.6, beam * 0.04);
  g.stroke();
  // Throat grooves on the whales, a pale belly on the rest.
  g.save();
  g.clip();
  if (id === 'humpback') {
    g.strokeStyle = 'rgba(80,70,64,0.5)';
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * beam * 0.1, -len * 0.48);
      g.lineTo(i * beam * 0.12, -len * 0.1);
      g.stroke();
    }
  }
  // The flensing: red cuts across it, more as the work goes on.
  const cuts = Math.round(progress * 8);
  g.strokeStyle = 'rgba(170,20,26,0.85)';
  g.lineWidth = Math.max(0.8, beam * 0.08);
  for (let i = 0; i < cuts; i++) {
    const y = -len * 0.38 + (i * len * 0.72) / 8;
    g.beginPath();
    g.moveTo(-beam * 0.6, y);
    g.lineTo(beam * 0.6, y + len * 0.03);
    g.stroke();
  }
  g.restore();
  // The flukes, limp.
  flukes(g, len, beam, 0, 1.2, '#8a8277');
}
