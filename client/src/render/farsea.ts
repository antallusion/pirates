// The far view's chart (owner, 2026-10-17: «дай возможность отдалить море сильно… и просматривать где что»). Below
// CHART_FROM (freecam.ts) the painted sea gives way to a chart, all of it below CHART_FULL:
//   the sea         a dark chart's water, the 3 km squares of the world's chunks ruled faintly
//   what she knows  the islands she has had in sight (state.islands: the chunks streamed to her, kept), their names
//                   once found, the ports on them — the world map's layer, no live ships on it
//   the fog slot    FarCtx.layers: a fog of war (another helper's, ../pirates-board) draws here, over the land and
//                   under the live marks, in the same screen transform; nothing of it is drawn by this file
//   her lookouts    the server sends the ships and beasts within INTEREST_RADIUS of her and nothing beyond: that disc is
//                   lit, its edge ruled and named, and what moves is drawn there only, as marks (a ship a hull-shaped
//                   dart in her relation's colour, a beast or a stack the chart's own diamonds) — the ships' sprites,
//                   wakes and particles are not drawn at all, so a far view costs less than a near one
// Pure drawing: the renderer calls drawFarChart with its transform; the data is the client state.

import { CHUNK_SIZE, INTEREST_RADIUS, WORLD_SIZE } from '../../../shared/src/constants.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { SF } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { isleFill } from '../ui/islemap.ts';
import { placeName } from '../ui/maps.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/freecam.ts';
import { RELATION_COLOR, relationOf } from './relation.ts';
import { drawRoamsMini } from './roamers.ts';
import { drawDriftsMini } from './drifts.ts';
import { underFog, visibleOnChart } from './fog.ts';

const L = dict(EN, RU);

/** The screen transform and the view, as the renderer has them this frame. */
export interface FarCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  w: number;
  h: number;
  camX: number;
  camY: number;
  /** 0–1: how much of the chart shows (freecam.ts chartMix). */
  mix: number;
  /** Her ship, if at sea. */
  own: { x: number; y: number; heading: number } | null;
}

/** A layer drawn over the chart's land and under its live marks: the fog of war's slot (see the header). */
export type FarLayer = (g: CanvasRenderingContext2D, c: FarCtx) => void;

/** The chart over (mix < 1) or instead of (mix 1) the painted sea. */
export function drawFarChart(g: CanvasRenderingContext2D, state: ClientState, c: FarCtx, layers: readonly FarLayer[]): void {
  const { sx, sy, zoom, w, h, mix } = c;
  if (mix <= 0) return;
  const hw = w / 2 / zoom, hh = h / 2 / zoom;
  const x0 = c.camX - hw, x1 = c.camX + hw, y0 = c.camY - hh, y1 = c.camY + hh;
  g.save();
  // the water: opaque once the chart is all there is (the painted sea under it is not drawn then)
  g.globalAlpha = mix;
  g.fillStyle = '#0b161c';
  g.fillRect(0, 0, w, h);
  // outside the world: darker still
  if (x0 < 0 || y0 < 0 || x1 > WORLD_SIZE || y1 > WORLD_SIZE) {
    g.fillStyle = '#05090c';
    const L0 = sx(0), T0 = sy(0), R0 = sx(WORLD_SIZE), B0 = sy(WORLD_SIZE);
    if (L0 > 0) g.fillRect(0, 0, L0, h);
    if (R0 < w) g.fillRect(R0, 0, w - R0, h);
    if (T0 > 0) g.fillRect(0, 0, w, T0);
    if (B0 < h) g.fillRect(0, B0, w, h - B0);
  }
  // the chunks' squares, faint, while they are no closer than 40 px
  if (CHUNK_SIZE * zoom >= 40) {
    g.strokeStyle = 'rgba(140,170,170,0.07)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = Math.max(0, Math.ceil(x0 / CHUNK_SIZE)) * CHUNK_SIZE; x <= Math.min(WORLD_SIZE, x1); x += CHUNK_SIZE) {
      const px = Math.round(sx(x)) + 0.5;
      g.moveTo(px, 0);
      g.lineTo(px, h);
    }
    for (let y = Math.max(0, Math.ceil(y0 / CHUNK_SIZE)) * CHUNK_SIZE; y <= Math.min(WORLD_SIZE, y1); y += CHUNK_SIZE) {
      const py = Math.round(sy(y)) + 0.5;
      g.moveTo(0, py);
      g.lineTo(w, py);
    }
    g.stroke();
  }
  // what her lookouts see: the disc lit a little
  const own = c.own;
  const R = INTEREST_RADIUS * zoom;
  if (own) {
    g.fillStyle = 'rgba(90,140,150,0.10)';
    g.beginPath();
    g.arc(sx(own.x), sy(own.y), R, 0, Math.PI * 2);
    g.fill();
  }
  // the islands she has had in sight; the ports on them
  const ports = new Set<string>();
  const labels: { x: number; y: number; text: string; port: boolean }[] = [];
  for (const is of state.islands.values()) {
    if (is.x + is.r < x0 || is.x - is.r > x1 || is.y + is.r < y0 || is.y - is.r > y1) continue;
    if (underFog(state.seen, is.x, is.y)) continue; // the fog of war hides her and her name (pirates-board)
    if (is.portId) ports.add(is.portId);
    const r = is.r * zoom;
    if (is.mist) {
      g.fillStyle = 'rgba(190,198,202,0.16)';
      g.beginPath();
      g.arc(sx(is.x), sy(is.y), Math.max(1.5, r), 0, Math.PI * 2);
      g.fill();
      continue;
    }
    g.fillStyle = isleFill(is, false);
    if (r < 2.5 || is.poly.length < 6) {
      g.beginPath();
      g.arc(sx(is.x), sy(is.y), Math.max(1.2, r), 0, Math.PI * 2);
      g.fill();
    } else {
      // (fewer of the coast's points the smaller it is drawn)
      const step = r < 12 ? 8 : r < 40 ? 4 : 2;
      g.beginPath();
      for (let i = 0; i < is.poly.length; i += step) {
        const px = sx(is.poly[i]), py = sy(is.poly[i + 1]);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(176,150,100,0.55)';
      g.lineWidth = 1;
      g.stroke();
    }
    if (!is.portId && !is.town && state.discovered.has(is.id) && r > 14) labels.push({ x: sx(is.x), y: sy(is.y), text: is.name, port: false });
  }
  for (const p of state.ports) {
    if (!ports.has(p.id) || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || underFog(state.seen, p.x, p.y)) continue;
    const px = sx(p.x), py = sy(p.y);
    g.fillStyle = '#e0b862';
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(px, py, 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (zoom >= 0.06) labels.push({ x: px, y: py - 6, text: placeName(p.name), port: true });
  }
  // the fog of war's slot (and any other layer over the land)
  g.globalAlpha = 1;
  for (const f of layers) {
    g.save();
    try {
      f(g, c);
    } catch (e) {
      console.warn('[far] a chart layer failed', e);
    }
    g.restore();
  }
  g.globalAlpha = mix;
  // names: the ports first, none over another
  const boxes: [number, number, number, number][] = [];
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  for (const l of labels.sort((a, b) => Number(b.port) - Number(a.port))) {
    g.font = l.port ? '600 11px "Cormorant Garamond", Georgia, serif' : 'italic 11px "Cormorant Garamond", Georgia, serif';
    const tw = g.measureText(l.text).width;
    const b: [number, number, number, number] = [l.x - tw / 2 - 2, l.y - 13, l.x + tw / 2 + 2, l.y + 1];
    if (b[2] < 0 || b[0] > w || b[3] < 0 || b[1] > h) continue;
    if (boxes.some((q) => q[0] < b[2] && b[0] < q[2] && q[1] < b[3] && b[1] < q[3])) continue;
    boxes.push(b);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(5,8,10,0.85)';
    g.strokeText(l.text, l.x, l.y);
    g.fillStyle = l.port ? '#e8d7a8' : 'rgba(200,196,180,0.85)';
    g.fillText(l.text, l.x, l.y);
  }
  // the edge of what her lookouts see, and its name at the top
  if (own && R > 24) {
    const ox = sx(own.x), oy = sy(own.y);
    g.strokeStyle = 'rgba(224,184,98,0.55)';
    g.lineWidth = 1.2;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.arc(ox, oy, R, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    if (R > 48) {
      g.font = '600 10px system-ui, sans-serif';
      g.textBaseline = 'bottom';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(5,8,10,0.85)';
      const t = L('reach');
      g.strokeText(t, ox, oy - R - 3);
      g.fillStyle = 'rgba(224,184,98,0.85)';
      g.fillText(t, ox, oy - R - 3);
    }
  }
  // what moves: the beasts and stacks as the chart draws them; the ships as darts
  const view = { x: c.camX, y: c.camY }, range = Math.max(hw, hh);
  // (the fog of war hides the creatures in it as it hides the land: only those in seen water)
  const seen = state.seen ? Object.assign(Object.create(state) as ClientState, { drifts: visibleOnChart(state.seen, state.drifts), roams: visibleOnChart(state.seen, state.roams) }) : state;
  drawDriftsMini(g, seen, sx, sy, view, range);
  drawRoamsMini(g, seen, sx, sy, view, range);
  g.globalAlpha = mix;
  for (const s of state.ships.values()) {
    const p = s.cur;
    if (!p || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.flags & (SF.HIDDEN | SF.SWALLOWED)) continue;
    const cls = SHIP_CLASSES[s.info?.classId ?? 'sloop'];
    const col = cls?.monster ? '#b07ad0' : RELATION_COLOR[relationOf(state, s)];
    dart(g, sx(p.x), sy(p.y), p.h, Math.max(5, Math.min(9, (cls?.length ?? 30) * zoom)), col);
  }
  if (own) dart(g, sx(own.x), sy(own.y), own.heading, 8, '#f3ead2', true);
  g.restore();
}

/** A ship on the chart: a dart along her heading (0 = north), dark-edged. */
function dart(g: CanvasRenderingContext2D, x: number, y: number, h: number, r: number, color: string, own = false): void {
  g.save();
  g.translate(x, y);
  g.rotate(h);
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(r * 0.62, r * 0.8);
  g.lineTo(0, r * 0.4);
  g.lineTo(-r * 0.62, r * 0.8);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = own ? 1.6 : 1;
  g.strokeStyle = own ? '#1a1206' : 'rgba(0,0,0,0.85)';
  g.stroke();
  g.restore();
  if (own) {
    g.strokeStyle = 'rgba(243,234,210,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, r + 4, 0, Math.PI * 2);
    g.stroke();
  }
}
