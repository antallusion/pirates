// Castaways (seaux, owner 2026-10-11: «в море должны быть сгенерированы плавающие матросы, проплывая мимо них их можно
// на борт поднимать»): men clinging to a spar, drawn by hand (no picture made for them) — the spar a weathered plank with
// its grain, each man a small head and an arm waving over the water, the swell breaking white round them, a soft gold
// ring so she sees them, and on it a clock of the time they can still hold on. Her own only (the server sends hers).

import type { CastawayView } from '../../../shared/src/data/wrecks.ts';
import { CAST_TTL } from '../../../shared/src/data/wrecks.ts';
import { clockBadge, foam, markRing } from './seaart.ts';

type G = CanvasRenderingContext2D;

export interface CastCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

/** One castaway's group: the spar, the men on it (1–3), their waving arms. */
export function drawCastaway(g: G, x: number, y: number, R: number, t: number, id: number, n: number): void {
  const bob = Math.sin(t * 1.7 + id) * R * 0.05;
  const rot = 0.5 + Math.sin(t * 0.6 + id * 1.3) * 0.12;
  foam(g, x, y, R * 1.35, t, id, 0.24);
  g.save();
  g.translate(x, y + bob);
  g.rotate(rot);
  // the shadow on the water, the plank, its grain and its broken end
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(R * 0.08, R * 0.12, R * 1.25, R * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  const wood = g.createLinearGradient(0, -R * 0.24, 0, R * 0.24);
  wood.addColorStop(0, '#8a6a43');
  wood.addColorStop(1, '#4e3a22');
  g.fillStyle = wood;
  g.beginPath();
  g.moveTo(-R * 1.15, -R * 0.2);
  g.lineTo(R * 1.0, -R * 0.24);
  g.lineTo(R * 1.18, -R * 0.05);
  g.lineTo(R * 1.04, R * 0.2);
  g.lineTo(-R * 1.15, R * 0.2);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(30,20,10,0.55)';
  g.lineWidth = Math.max(0.6, R * 0.04);
  g.beginPath();
  g.moveTo(-R * 1.0, -R * 0.06);
  g.lineTo(R * 0.9, -R * 0.09);
  g.moveTo(-R * 0.9, R * 0.08);
  g.lineTo(R * 0.8, R * 0.06);
  g.stroke();
  // the men: a head and shoulders out of the water each, one arm up and waving
  const k = Math.max(1, Math.min(3, n));
  for (let i = 0; i < k; i++) {
    const px = (i - (k - 1) / 2) * R * 0.7, py = -R * 0.02;
    const wave = Math.sin(t * 5 + i * 1.9 + id) * 0.5;
    g.fillStyle = 'rgba(14,34,44,0.55)'; // the water round his chest
    g.beginPath();
    g.ellipse(px, py + R * 0.28, R * 0.3, R * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = i % 2 ? '#6b4b33' : '#7d5a3c'; // his shirt
    g.beginPath();
    g.ellipse(px, py + R * 0.12, R * 0.22, R * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d9b48c'; // his arm
    g.lineWidth = Math.max(1, R * 0.09);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(px + R * 0.12, py + R * 0.04);
    g.lineTo(px + R * 0.28 + Math.sin(wave) * R * 0.12, py - R * 0.42 - Math.cos(wave) * R * 0.05);
    g.stroke();
    g.fillStyle = '#e2bf94'; // his head
    g.beginPath();
    g.arc(px, py - R * 0.08, R * 0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2c2118'; // his hair, wet
    g.beginPath();
    g.arc(px, py - R * 0.13, R * 0.13, Math.PI, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** The minimap's marks (seaux): her castaways a white figure-dot in a gold ring, her wreckage small brown chips — so
 *  she finds them beyond the screen (a tap there on the chart's long press sails her to them). */
export function drawWrecksMini(g: G, wrecks: readonly { x: number; y: number }[], casts: readonly { x: number; y: number }[], tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  g.save();
  g.lineWidth = 1;
  for (const w of wrecks) {
    if (Math.abs(w.x - own.x) > range || Math.abs(w.y - own.y) > range) continue;
    g.fillStyle = '#a07a4a';
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(tx(w.x) - 2, ty(w.y) - 1.5, 4, 3);
    g.strokeRect(tx(w.x) - 2, ty(w.y) - 1.5, 4, 3);
  }
  for (const c of casts) {
    if (Math.abs(c.x - own.x) > range || Math.abs(c.y - own.y) > range) continue;
    const x = tx(c.x), y = ty(c.y);
    g.strokeStyle = '#e0b862';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, 4.5, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#f2e6cc';
    g.beginPath();
    g.arc(x, y, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Her castaways on the sea: each group, its gold ring and the clock of their time left. */
export function drawCastawaysWorld(g: G, list: readonly CastawayView[], since: number, now: number, c: CastCtx): void {
  if (!list.length) return;
  const R = Math.max(8, 20 * c.zoom);
  for (const v of list) {
    const x = c.sx(v.x), y = c.sy(v.y);
    if (x < -R * 3 || y < -R * 3 || x > c.w + R * 3 || y > c.h + R * 3) continue;
    const left = Math.max(0, v.left - (now - since));
    markRing(g, x, y, R * 1.9 * (1 + 0.05 * Math.sin(c.time * 3 + v.id)), '#e0b862', false, 0.85);
    drawCastaway(g, x, y, R, c.time, v.id, v.n);
    clockBadge(g, x + R * 1.55, y - R * 1.35, Math.max(6, R * 0.38), left / CAST_TTL, '#e0b862');
  }
}
