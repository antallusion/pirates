// «Шлюпы с острова» on the sea (owner, 2026-11-02; server/src/game/isleboats.ts): the island's boats running her down —
// her own HUD's only (no ship of the sea: nobody can touch them). Drawn from the boats' last place on the sea's clock,
// carried along the way ahead at their way (shared/src/data/islandboats.ts boatsAt): the small boats of the props
// (prop.life_boat, no picture made for them) in a little line abreast, their wake, and a dashed gold line on to her. On
// the dial and the chart: a gold dot and the same dashed line.

import type { BoatsView } from '../../../shared/src/data/islandboats.ts';
import { boatsAt } from '../../../shared/src/data/islandboats.ts';
import { drawArt, foam } from './seaart.ts';

type G = CanvasRenderingContext2D;

export interface BoatsCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
}

/** The way still ahead of the boats at `now` (from their place to her hull). */
function ahead(v: BoatsView, now: number, own: { x: number; y: number }): { at: { x: number; y: number; h: number }; pts: [number, number][] } {
  const at = boatsAt(v, now);
  // the points of the way not yet passed: those nearer her than the boats are along it
  let d = v.wait ? 0 : Math.max(0, now - v.at) * v.v;
  let x = v.x, y = v.y;
  const pts: [number, number][] = [];
  for (const [qx, qy] of v.path) {
    const L = Math.hypot(qx - x, qy - y);
    if (L > d) pts.push([qx, qy]);
    d = Math.max(0, d - L);
    x = qx;
    y = qy;
  }
  if (pts.length) pts[pts.length - 1] = [own.x, own.y];
  else pts.push([own.x, own.y]);
  return { at, pts };
}

/** The boats and their dashed line on the sea. */
export function drawBoatsWorld(g: G, v: BoatsView | null | undefined, now: number, own: { x: number; y: number } | null, c: BoatsCtx): void {
  if (!v || !own) return;
  const { at, pts } = ahead(v, now, own);
  g.save();
  // the dashed line on to her
  g.strokeStyle = 'rgba(232,196,106,0.75)';
  g.lineWidth = Math.max(1.5, 2.2 * Math.min(1, c.zoom * 2));
  g.setLineDash([10, 8]);
  g.lineDashOffset = -c.time * 30;
  g.beginPath();
  g.moveTo(c.sx(at.x), c.sy(at.y));
  for (const [x, y] of pts) g.lineTo(c.sx(x), c.sy(y));
  g.stroke();
  g.setLineDash([]);
  // the boats abreast, their wake behind
  const n = Math.max(1, Math.min(3, v.boats));
  const size = Math.max(22, 18 * c.zoom);
  const px = Math.cos(at.h), py = Math.sin(at.h); // abreast: across the heading (heading 0 is north)
  const bx = Math.sin(at.h), by = -Math.cos(at.h);
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * size * 0.8;
    const lag = Math.abs(i - (n - 1) / 2) * size * 0.35;
    const x = c.sx(at.x) + px * o - bx * lag, y = c.sy(at.y) + py * o - by * lag;
    if (!v.wait) foam(g, x - bx * size * 0.6, y - by * size * 0.6, size * 0.55, c.time, 7 + i, 0.35);
    if (!drawArt(g, 'prop.life_boat', x, y, size, at.h + Math.PI / 2, 1)) {
      g.fillStyle = '#8a6a43';
      g.beginPath();
      g.ellipse(x, y, size * 0.18, size * 0.45, at.h, 0, Math.PI * 2);
      g.fill();
    }
  }
  // a gold ring so she sees them
  g.strokeStyle = 'rgba(232,196,106,0.55)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(c.sx(at.x), c.sy(at.y), size * (n > 1 ? 1.35 : 0.9), 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** On the dial (the minimap) and the chart: a gold dot and the dashed line on to her. */
export function drawBoatsMini(g: G, v: BoatsView | null | undefined, now: number, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }): void {
  if (!v) return;
  const { at, pts } = ahead(v, now, own);
  g.save();
  g.strokeStyle = 'rgba(232,196,106,0.85)';
  g.lineWidth = 1.2;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(tx(at.x), ty(at.y));
  for (const [x, y] of pts) g.lineTo(tx(x), ty(y));
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#e8c46a';
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.beginPath();
  g.arc(tx(at.x), ty(at.y), 3.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}
