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
import { foam, piece } from './seaart.ts';

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
  // The fore part holds still past the flippers (a humpback's reach half her length), so no cut runs through one.
  const fore = id === 'young_serpent' ? 0.3 : id === 'humpback' ? 0.6 : id === 'sperm_whale' ? 0.5 : 0.46;
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
  const ov = 6 / ih;
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

/** A dolphin from above (docs/16 #9 — no painting of one, drawn by hand): a slate-grey spindle with a paler belly
 *  line, a short beak, a swept dorsal fin and small flukes, its tail beating fast. Head toward −y, len in px. */
export function drawDolphin(g: G, len: number, t: number, seed: number): void {
  const beam = len * 0.24;
  const ph = t * 7 + seed * 1.37;
  const bend = Math.sin(ph) * beam * 0.35;
  fins(g, len, beam, 0.34, beam * 0.75, 0.75, beam * 0.26, '#5d6d79', Math.sin(ph * 0.5) * 0.08);
  flukes(g, len, beam, bend, 1.5, '#56656f');
  body(g, len, beam, bend, 0.32, 0.5);
  g.fillStyle = '#7f909c';
  g.fill();
  g.save();
  g.clip();
  // The pale flank blaze and the darker cape along the back.
  g.fillStyle = 'rgba(222,230,234,0.7)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * beam * 0.42, -len * 0.02, beam * 0.14, len * 0.22, side * 0.08, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(44,54,62,0.6)';
  g.beginPath();
  g.ellipse(0, -len * 0.05, beam * 0.2, len * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // The beak.
  g.fillStyle = '#4c5963';
  g.beginPath();
  g.ellipse(0, -len * 0.5, beam * 0.12, len * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  // The dorsal fin, swept back.
  g.fillStyle = '#2b343b';
  g.beginPath();
  g.moveTo(0, -len * 0.04);
  g.lineTo(beam * 0.08 + bend * 0.15, len * 0.14);
  g.lineTo(-beam * 0.06, len * 0.1);
  g.closePath();
  g.fill();
}
// ------------------------------------------------------------------------------------------------ in the water
// Owner, 2026-10-07: «кит на какой-то подложке, он наоборот под водой должен быть еле-еле», the dolphins «очень плохо
// нарисованы, нету рассекания воды». The beasts swim under the surface: their own painting sunk in the water — blurred,
// its colours drowned in the sea's, faint — bending as it swims (the segments of `warp` turning one after another, the
// tail beating slowly), rising and diving by its own clock. Only the back breaks the surface when it rises (the painting
// itself, crisp, feathered out along the spine), with the white water about it, rings spreading on the surface, a V of
// foam astern when it moves, and — for the whales, the orcas, the narwhals — the blow. A shark shows its fin cutting
// the surface with its wake. All from the paintings and the painted spray and mist.

/** A painting's box: the image, where it lies in it, and where the beast lies in that box (its extent and middle). */
interface Src {
  img: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
  extentY: number;
  cx: number;
  cy: number;
}

const sea = new Map<string, Src>();

function blank(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** The painting of a sprite or a cut piece as a box. */
function boxOf(id: string): Src | null {
  if (id.startsWith('piece:')) {
    const c = piece(id.slice(6) as 'dolphin');
    return c ? { img: c, x: 0, y: 0, w: c.width, h: c.height, extentY: 0.97, cx: 0.5, cy: 0.5 } : null;
  }
  const spr = sprite(id);
  if (!spr) return null;
  return { img: spr.img, x: 0, y: 0, w: spr.img.naturalWidth, h: spr.img.naturalHeight, extentY: spr.extentY, cx: spr.cx, cy: spr.cy };
}

/** The painting sunk in the water: small, blurred, its colours drowned in the sea's (made once a kind). */
function sunk(id: string): Src | null {
  const hit = sea.get(`sunk|${id}`);
  if (hit) return hit;
  const b = boxOf(id);
  if (!b) return null;
  const k = Math.min(1, 150 / Math.max(b.w, b.h));
  const pad = 8;
  const c = blank(b.w * k + pad * 2, b.h * k + pad * 2);
  if (!c) return null;
  const x = c.getContext('2d')!;
  x.filter = 'blur(3px)';
  x.drawImage(b.img, b.x, b.y, b.w, b.h, pad, pad, b.w * k, b.h * k);
  x.filter = 'none';
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(10,34,44,0.45)';
  x.fillRect(0, 0, c.width, c.height);
  const out: Src = { img: c, x: pad, y: pad, w: b.w * k, h: b.h * k, extentY: b.extentY, cx: b.cx, cy: b.cy };
  sea.set(`sunk|${id}`, out);
  return out;
}

/** The back that breaks the surface: the painting itself, feathered out along the spine about `at` (share of its
 *  length from the head), `half` its length and `wide` its breadth either way (made once a kind). */
function backOf(id: string, at: number, half: number, wide: number): Src | null {
  const key = `back|${id}|${at}|${half}|${wide}`;
  const hit = sea.get(key);
  if (hit) return hit;
  const b = boxOf(id);
  if (!b) return null;
  const k = Math.min(1, 260 / Math.max(b.w, b.h));
  const c = blank(b.w * k, b.h * k);
  if (!c) return null;
  const x = c.getContext('2d')!;
  x.drawImage(b.img, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  // The feathered spine: an elliptical gradient (a circle's, squeezed) keeps the middle and lets the edges go.
  const head = (b.cy - b.extentY / 2) * c.height;
  const my = head + b.extentY * c.height * at, ry = b.extentY * c.height * half, rx = c.width * wide;
  x.globalCompositeOperation = 'destination-in';
  x.translate(c.width * b.cx, my);
  x.scale(rx / ry, 1);
  const grd = x.createRadialGradient(0, 0, ry * 0.35, 0, 0, ry);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grd;
  x.fillRect(-ry, -ry, ry * 2, ry * 2);
  const out: Src = { img: c, x: 0, y: 0, w: c.width, h: c.height, extentY: b.extentY, cx: b.cx, cy: b.cy };
  sea.set(key, out);
  return out;
}

/** A painting `len` from snout to tail at the origin, head toward −y, cut across in `pieces` segments behind its still
 *  fore part (`fore`), each turned a little more than the one before it: the wave runs down to the tail. */
function warp(g: G, b: Src, len: number, ph: number, amp: number, pieces: number, fore: number): void {
  const h = len / b.extentY, w = h * (b.w / b.h);
  const top = -h * b.cy, left = -w * b.cx;
  const head = b.cy - b.extentY / 2;
  const cut = [0];
  for (let k = 0; k < pieces - 1; k++) cut.push(head + b.extentY * (fore + ((1 - fore) * k) / (pieces - 1)));
  cut.push(1);
  const ov = 4 / b.h;
  g.save();
  g.drawImage(b.img, b.x, b.y, b.w, cut[1] * b.h, left, top, w, cut[1] * h);
  g.translate(0, top + cut[1] * h);
  for (let k = 1; k < cut.length - 1; k++) {
    g.rotate(amp * Math.sin(ph - k * 0.9));
    const s0 = Math.max(0, cut[k] - ov), s1 = cut[k + 1];
    g.drawImage(b.img, b.x, b.y + s0 * b.h, b.w, (s1 - s0) * b.h, left, (s0 - cut[k]) * h, w, (s1 - s0) * h);
    g.translate(0, (cut[k + 1] - cut[k]) * h);
  }
  g.restore();
}

/** How each beast swims and shows itself: its clock (radians a second), the blow (0 none … 1 a whale's), its back
 *  (where along it, how long and how wide the part breaking the surface is), the fin of a shark, its wave. */
const SWIM: Record<BeastId, { rate: number; blow: number; back: [number, number, number]; fin?: boolean; amp: number; beat: number }> = {
  humpback: { rate: 0.3, blow: 1, back: [0.42, 0.3, 0.3], amp: 0.06, beat: 0.9 },
  sperm_whale: { rate: 0.28, blow: 1, back: [0.33, 0.32, 0.36], amp: 0.06, beat: 0.8 },
  orca: { rate: 0.55, blow: 0.5, back: [0.4, 0.22, 0.26], amp: 0.08, beat: 1.4 },
  white_orca: { rate: 0.55, blow: 0.5, back: [0.4, 0.22, 0.26], amp: 0.08, beat: 1.4 },
  narwhal: { rate: 0.5, blow: 0.4, back: [0.52, 0.24, 0.3], amp: 0.08, beat: 1.3 },
  shark: { rate: 0.7, blow: 0, back: [0.37, 0.14, 0.16], fin: true, amp: 0.11, beat: 2.2 },
  young_serpent: { rate: 0.6, blow: 0, back: [0.5, 0.42, 0.42], amp: 0.2, beat: 1.5 },
};

const smooth = (v: number): number => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

/** The water where something breaks the surface at (0, y): the white water about it, rings spreading, and — moving —
 *  a V of foam astern. `a` how much of it is up (0…1). */
export function surfaceWater(g: G, y: number, len: number, a: number, t: number, seed: number, moving: number): void {
  if (a <= 0.02) return;
  foam(g, 0, y, len * (0.16 + 0.08 * a), t, seed, 0.3 * a);
  // The slick it leaves as it rolls: a ring of smooth water spreading and fading (a big beast's only — on a small one
  // it reads as a drawn ring).
  if (len > 40) {
    const life = (t * 0.35 + seed * 0.13) % 1;
    g.save();
    g.lineWidth = Math.max(1, len * 0.012);
    g.strokeStyle = `rgba(200,220,228,${(0.12 * a * (1 - life)).toFixed(3)})`;
    g.beginPath();
    g.ellipse(0, y, len * (0.2 + life * 0.3), len * (0.3 + life * 0.38), 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  if (moving > 0.05) {
    const sp = piece('splash');
    if (!sp) return;
    for (let i = 1; i <= 4; i++) {
      const u = i / 4, d = len * 0.07 * i * (0.8 + moving * 0.4);
      const s = len * (0.07 + 0.035 * i);
      g.globalAlpha = 0.32 * a * moving * (1 - u * 0.75);
      for (const side of [-1, 1]) g.drawImage(sp, side * d - s / 2, y + len * 0.13 * i - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }
}

/** The blow: white mist from the blowhole at (0, y), climbing and drifting astern as it thins (`k` 0…1 through it). */
function blow(g: G, y: number, len: number, k: number, size: number): void {
  const mist = piece('smoke');
  if (!mist) return;
  for (let i = 0; i < 3; i++) {
    const u = Math.min(1, k * 1.2 + i * 0.15);
    const s = len * size * (0.12 + u * 0.22) * (1 + i * 0.25);
    g.globalAlpha = 0.55 * Math.sin(Math.min(1, k) * Math.PI) * (1 - i * 0.25);
    g.drawImage(mist, -s / 2 + Math.sin(i * 2.1) * len * 0.02, y + len * (0.02 + u * 0.1 * (i + 1)) - s / 2, s, s);
  }
  g.globalAlpha = 1;
}

/** A beast in the sea at the origin, head toward −y: its body sunk and swimming, its back breaking the surface by its
 *  own clock (never while `submerged`), the water about it, the blow. `moving` 0…1 how fast it goes. */
export function drawBeastInSea(g: G, id: BeastId, len: number, beam: number, t: number, seed: number, submerged: boolean, moving = 0.6): void {
  const sw = SWIM[id];
  const body = sunk(`monster.${id}`);
  if (!body) {
    // The hand-drawn beast while the painting loads, dimmed under the water.
    g.save();
    g.globalAlpha *= submerged ? 0.25 : 0.6;
    drawBeast(g, id, len, beam, t, seed);
    g.restore();
    return;
  }
  const ph = t * sw.rate + seed * 1.37;
  const rise = 0.5 + 0.5 * Math.sin(ph);
  const up = submerged ? 0 : smooth((rise - 0.42) / 0.4);
  const swim = t * sw.beat + seed * 0.61;
  const pieces = id === 'young_serpent' ? 5 : 4;
  const fore = id === 'young_serpent' ? 0.3 : id === 'humpback' ? 0.6 : id === 'sperm_whale' ? 0.5 : 0.46;
  const a0 = g.globalAlpha;
  // The body under the water: fainter the deeper it is.
  g.globalAlpha = a0 * (submerged ? 0.3 : 0.5 + 0.3 * rise);
  warp(g, body, len, swim, sw.amp, pieces, fore);
  g.globalAlpha = a0;
  if (up <= 0.02) return;
  const [at, half, wide] = sw.back;
  const backY = -len / 2 + len * at;
  surfaceWater(g, backY, len, up, t, seed, moving);
  const back = backOf(`monster.${id}`, at, half, wide);
  if (back) {
    g.globalAlpha = a0 * up * (sw.fin ? 1 : 0.92);
    warp(g, back, len, swim, sw.amp, pieces, fore);
    g.globalAlpha = a0;
  }
  // The blow, once each time it rises, at the top of its roll.
  if (sw.blow > 0) {
    const k = (((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2); // 0 at the roll's middle, rising
    if (k > 0.05 && k < 0.3) blow(g, -len / 2 + len * 0.1, len, (k - 0.05) / 0.25, sw.blow);
  }
}

/** A dolphin riding a ship's bow wave at the origin, head toward −y, `len` px long: under the water between its leaps
 *  (sunk and faint, its V of foam at the surface), then out of it — the painted dolphin whole, its shadow on the water
 *  falling away from it — and the splash where it breaks the surface and goes back in, the foam ring after. */
export function drawDolphinSea(g: G, len: number, t: number, seed: number): void {
  const ph = t * 1.6 + seed * 1.3;
  const s = Math.sin(ph);
  const leap = Math.max(0, s);
  const deep = sunk('piece:dolphin');
  const art = piece('dolphin');
  if (!deep || !art) {
    drawDolphin(g, len, t, seed);
    return;
  }
  const a0 = g.globalAlpha;
  const swim = t * 4 + seed;
  if (s < 0.12) {
    // Under the water, near the surface: the sunk shape and the V of its wake over it.
    g.globalAlpha = a0 * (0.32 + 0.25 * Math.max(0, s + 0.4));
    warp(g, deep, len, swim, 0.12, 3, 0.45);
    g.globalAlpha = a0;
    surfaceWater(g, -len * 0.25, len, 0.5, t, seed, 1);
  }
  // Breaking the surface and going back in: the splash.
  const edge = 1 - Math.min(1, Math.abs(s) / 0.3);
  if (edge > 0) foam(g, 0, -len * 0.05, len * 0.3, t, seed + 7, 0.5 * edge);
  if (leap > 0.05) {
    const k = 1 + 0.22 * leap;
    const off = len * 0.3 * leap;
    // Its shadow on the water, falling away as it climbs.
    g.save();
    g.globalAlpha = a0 * 0.28 * leap;
    g.translate(off * 0.5, off);
    g.filter = 'none';
    g.drawImage(shadowOf(art), (-art.width / art.height) * len * 0.5, -len / 2, (art.width / art.height) * len, len);
    g.restore();
    g.save();
    g.globalAlpha = a0 * Math.min(1, leap * 3);
    g.scale(k, k);
    g.rotate(Math.sin(ph * 0.5) * 0.08);
    g.drawImage(art, (-art.width / art.height) * len * 0.5, -len / 2, (art.width / art.height) * len, len);
    g.restore();
  }
}

/** A cut piece made a flat dark shadow (made once). */
const shadows = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function shadowOf(c: HTMLCanvasElement): HTMLCanvasElement {
  const hit = shadows.get(c);
  if (hit) return hit;
  const s = blank(c.width, c.height) ?? c;
  if (s !== c) {
    const x = s.getContext('2d')!;
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#02080c';
    x.fillRect(0, 0, s.width, s.height);
  }
  shadows.set(c, s);
  return s;
}
