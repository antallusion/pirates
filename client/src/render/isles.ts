// Batch E of docs/16 on the water, drawn by hand and from the painted props: the banks the tide or a season bares
// (wet sand over the reef, a rim of foam, shells and a glint where something waits), the lookouts on the headlands (a
// cairn with a pole and a pennant), the beams of the lit lighthouses sweeping the dark, and the warm edge a lit light
// throws on the shoals within its reach.

import type { IslandData, LightView, ReefData, TidalView } from '../../../shared/src/protocol.ts';
import { sprite } from '../assets.ts';
import type { ClientState } from '../state.ts';

type G = CanvasRenderingContext2D;

export interface IslesCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  night: number;
  w: number;
  h: number;
  label: (b: TidalView) => string;
  lookLabel: (climbed: boolean) => string;
}

/** The lit lighthouses she knows of (island ids), and each light's reach. */
export function litLights(state: ClientState): LightView[] {
  return (state.isles?.lights ?? []).filter((l) => l.lit);
}

/** Whether a reef lies in the reach of a lit light. */
export function reefInLight(lights: LightView[], rf: { x: number; y: number; r: number }): boolean {
  return lights.some((l) => Math.hypot(rf.x - l.x, rf.y - l.y) < l.r + rf.r);
}

function path(g: G, poly: number[], c: IslesCtx, k = 1, cx = 0, cy = 0): void {
  g.beginPath();
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const x = c.sx(cx + (poly[i * 2] - cx) * k), y = c.sy(cy + (poly[i * 2 + 1] - cy) * k);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** The banks that stand above the sea now. */
export function drawBanks(g: G, state: ClientState, c: IslesCtx): void {
  for (const b of state.isles?.tidal ?? []) {
    if (!b.up || !b.poly) continue;
    const x = c.sx(b.x), y = c.sy(b.y), R = (b.r + 60) * c.zoom;
    if (x < -R || y < -R || x > c.w + R || y > c.h + R) continue;
    g.save();
    g.lineJoin = 'round';
    // Foam where the last of the ebb runs off it.
    path(g, b.poly, c, 1.12, b.x, b.y);
    g.fillStyle = 'rgba(200,215,210,0.16)';
    g.fill();
    g.setLineDash([3 * c.zoom, 6 * c.zoom]);
    g.lineDashOffset = -c.time * 4 * c.zoom;
    g.strokeStyle = 'rgba(235,240,238,0.55)';
    g.lineWidth = Math.max(1, 2 * c.zoom);
    g.stroke();
    g.setLineDash([]);
    // Wet sand darkening to dry at the crown.
    path(g, b.poly, c);
    const grd = g.createRadialGradient(x, y, 0, x, y, b.r * c.zoom);
    grd.addColorStop(0, b.kind === 'season' && b.season === 3 ? '#d9dee0' : '#cdb98a');
    grd.addColorStop(0.7, b.kind === 'season' && b.season === 3 ? '#aebcc3' : '#a8946a');
    grd.addColorStop(1, b.kind === 'season' && b.season === 3 ? '#7f95a0' : '#6f6a55');
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = 'rgba(40,36,28,0.55)';
    g.lineWidth = Math.max(1, 1.4 * c.zoom);
    g.stroke();
    // Ripples left in the sand.
    g.strokeStyle = 'rgba(90,80,60,0.28)';
    g.lineWidth = Math.max(0.6, 0.8 * c.zoom);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(x + ((b.id * 13 + k * 29) % 30 - 15) * c.zoom, y + (k - 1.5) * b.r * 0.28 * c.zoom, b.r * 0.45 * c.zoom, b.r * 0.08 * c.zoom, 0.3, 0, Math.PI);
      g.stroke();
    }
    // A painted scatter on it (the atoll's or the ice's bits), and a glint where something waits.
    const deco = sprite(b.kind === 'season' && b.season === 3 ? 'prop.decor_ice' : 'prop.decor_saltflat');
    if (deco && c.zoom > 0.25) {
      const s = Math.min(b.r * 0.9, 70) * c.zoom;
      g.globalAlpha = 0.85;
      g.drawImage(deco.img, x - s / 2, y - s / 2, s, s);
      g.globalAlpha = 1;
    }
    if (!b.combed) {
      const chest = sprite('prop.cache');
      const s = 22 * Math.max(0.6, c.zoom);
      if (chest && c.zoom > 0.3) g.drawImage(chest.img, x + b.r * 0.25 * c.zoom - s / 2, y - b.r * 0.2 * c.zoom - s / 2, s, s);
      const tw = 0.5 + 0.5 * Math.sin(c.time * 3 + b.id);
      g.fillStyle = `rgba(255,236,170,${0.35 + 0.5 * tw})`;
      g.beginPath();
      g.arc(x + b.r * 0.25 * c.zoom, y - b.r * 0.2 * c.zoom - s * 0.4, 2 + 2 * tw, 0, Math.PI * 2);
      g.fill();
    }
    if (c.zoom > 0.3) {
      g.font = 'italic 600 12px "Cormorant Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.7)';
      const t = c.label(b);
      g.fillText(t, x + 1, y + b.r * c.zoom + 15);
      g.fillStyle = '#efe1b8';
      g.fillText(t, x, y + b.r * c.zoom + 14);
    }
    g.restore();
  }
}

/** The lookouts on the headlands: a cairn, a pole, a pennant in the wind; a ring on one not yet climbed. */
export function drawLookouts(g: G, state: ClientState, c: IslesCtx, wind: number): void {
  if (c.zoom < 0.22) return;
  for (const l of state.isles?.lookouts ?? []) {
    const x = c.sx(l.x), y = c.sy(l.y);
    if (x < -60 || y < -60 || x > c.w + 60 || y > c.h + 60) continue;
    const z = Math.max(0.5, c.zoom);
    g.save();
    // The cairn: a few stones heaped.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x + 3 * z, y + 4 * z, 11 * z, 6 * z, 0, 0, Math.PI * 2);
    g.fill();
    const stones: [number, number, number][] = [[-6, 2, 5], [5, 2, 5], [0, -1, 6], [-2, -6, 4], [3, -8, 3.5]];
    for (const [dx, dy, r] of stones) {
      g.fillStyle = '#8d877a';
      g.beginPath();
      g.arc(x + dx * z, y + dy * z, r * z, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(30,28,24,0.7)';
      g.lineWidth = Math.max(0.6, 0.8 * z);
      g.stroke();
    }
    // The pole and its pennant, streaming downwind.
    g.strokeStyle = '#3b2e1f';
    g.lineWidth = Math.max(1, 1.6 * z);
    g.beginPath();
    g.moveTo(x, y - 8 * z);
    g.lineTo(x, y - 24 * z);
    g.stroke();
    const flap = Math.sin(c.time * 5 + l.island) * 2 * z;
    const vx = Math.sin(wind), vy = -Math.cos(wind);
    g.fillStyle = l.at ? '#7d8a6a' : '#c8452f';
    g.beginPath();
    g.moveTo(x, y - 24 * z);
    g.lineTo(x + vx * 14 * z + flap, y - 24 * z + vy * 14 * z + 3 * z);
    g.lineTo(x, y - 18 * z);
    g.closePath();
    g.fill();
    if (!l.at) {
      g.strokeStyle = `rgba(232,196,106,${0.35 + 0.25 * Math.sin(c.time * 2 + l.island)})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y - 4 * z, 20 * z, 0, Math.PI * 2);
      g.stroke();
    }
    if (c.zoom > 0.8) {
      g.font = '600 11px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.7)';
      const t = c.lookLabel(!!l.at);
      g.fillText(t, x + 1, y + 17 * z + 1);
      g.fillStyle = l.at ? '#b9c2a8' : '#f0d58f';
      g.fillText(t, x, y + 17 * z);
    }
    g.restore();
  }
}

/** A lit light's warm edge on a reef in its reach, at night. */
export function drawReefLight(g: G, rf: ReefData, c: IslesCtx, pathFn: () => void): void {
  if (c.night < 0.35) return;
  const a = Math.min(1, (c.night - 0.35) / 0.4);
  pathFn();
  g.fillStyle = `rgba(245,199,122,${0.07 * a})`;
  g.fill();
  g.strokeStyle = `rgba(245,199,122,${0.5 * a})`;
  g.lineWidth = Math.max(1.2, 2.2 * c.zoom);
  g.stroke();
  void rf;
}

/** The sweeping beams of the lit lighthouses, over the dark (additive light). */
export function drawBeams(g: G, lights: LightView[], towers: Map<number, { x: number; y: number }>, c: IslesCtx): void {
  if (c.night < 0.25) return;
  const a = Math.min(1, (c.night - 0.25) / 0.45);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const p = towers.get(l.island) ?? { x: l.x, y: l.y };
    const x = c.sx(p.x), y = c.sy(p.y);
    const len = 1600 * c.zoom;
    if (x < -len || y < -len || x > c.w + len || y > c.h + len) continue;
    const ang = c.time * 0.6 + l.island;
    for (const off of [0, Math.PI]) {
      const d = ang + off;
      const grd = g.createRadialGradient(x, y, 0, x, y, len);
      grd.addColorStop(0, `rgba(255,226,160,${0.34 * a})`);
      grd.addColorStop(0.5, `rgba(255,214,140,${0.12 * a})`);
      grd.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, len, d - Math.PI / 2 - 0.09, d - Math.PI / 2 + 0.09);
      g.closePath();
      g.fill();
    }
    // The lamp itself.
    const lamp = g.createRadialGradient(x, y, 0, x, y, 26 * Math.max(0.6, c.zoom));
    lamp.addColorStop(0, `rgba(255,240,200,${0.9 * a})`);
    lamp.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = lamp;
    g.beginPath();
    g.arc(x, y, 26 * Math.max(0.6, c.zoom), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Where a lighthouse tower stands on its island (the renderer's feature point, for the beam). */
export function towerPoints(islands: Map<number, IslandData>, lights: LightView[], point: (is: IslandData) => { x: number; y: number }): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  for (const l of lights) {
    const is = islands.get(l.island);
    if (is && is.features.includes('lighthouse')) out.set(l.island, point(is));
  }
  return out;
}
