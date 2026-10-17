// docs/35: the floating waystations on the sea, the minimap and the chart — strictly from above and from the art
// already in assets/ (no generation): a raft tavern (a plank raft under the fisher's hut with its smoke, crates and
// a boat alongside, a lantern's warm light), a hulk chapel (an old hulk at anchor, the shrine's bell on her deck, the
// candles' glow), a floating market (a raft under a sailcloth stall, crates, boats moored round it). On the minimap a
// small warm lozenge; on the chart the same, close in. A fog of war may hide any of them (setWayFog).

import { WAY_SIZE } from '../../../shared/src/world/waystations.ts';
import type { WayData } from '../../../shared/src/wayproto.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/waystation.ts';
import type { ClientState } from '../state.ts';
import { drawArt, foam } from './seaart.ts';

type G = CanvasRenderingContext2D;
const L = dict(EN, RU);

export interface WayCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

/** The fog of war's say (another pass adds the fog): a waystation it hides is drawn nowhere. */
let fogHides: (x: number, y: number) => boolean = () => false;
export function setWayFog(f: ((x: number, y: number) => boolean) | null): void {
  fogHides = f ?? (() => false);
}

/** The waystations as points of the map (for the fog, the chart and the tests): those she knows about her. */
export function wayPois(state: ClientState): { id: number; x: number; y: number; kind: WayData['kind'] }[] {
  const out: { id: number; x: number; y: number; kind: WayData['kind'] }[] = [];
  for (const w of state.ways.values()) if (!fogHides(w.x, w.y)) out.push({ id: w.id, x: w.x, y: w.y, kind: w.kind });
  return out;
}

export const wayName = (k: WayData['kind']): string => L(`kind.${k}`);

function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A raft of planks lashed across two logs, drawn in code under the art (its own size `s`, rotated by the caller). */
function raft(g: G, s: number, rnd: () => number): void {
  const w = s, h = s * 0.62;
  g.fillStyle = 'rgba(3,8,11,0.4)';
  g.beginPath();
  g.ellipse(s * 0.04, s * 0.06, w * 0.62, h * 0.66, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3b2a1b';
  g.fillRect(-w / 2, -h * 0.42, w, h * 0.12);
  g.fillRect(-w / 2, h * 0.3, w, h * 0.12);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    const len = h * (0.92 + rnd() * 0.12);
    g.fillStyle = i % 2 ? '#5a4129' : '#4d3722';
    g.fillRect(x - w / n / 2 + 0.6, -len / 2, w / n - 1.2, len);
  }
  g.strokeStyle = 'rgba(20,12,6,0.65)';
  g.lineWidth = Math.max(1, s * 0.012);
  g.strokeRect(-w / 2, -h / 2, w, h);
}

function glow(g: G, x: number, y: number, r: number, a: number, col = '255,190,110'): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${col},${a})`);
  grad.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Every waystation on the screen, from the art, and its name over it while she is near. */
export function drawWaysWorld(g: G, state: ClientState, c: WayCtx): void {
  if (!state.ways.size) return;
  const z = c.zoom;
  const S = WAY_SIZE * z;
  const own = state.ownDisplay;
  const near = state.wayView?.id ?? -1;
  for (const w of state.ways.values()) {
    const x = c.sx(w.x), y = c.sy(w.y);
    if (x < -S * 2 || y < -S * 2 || x > c.w + S * 2 || y > c.h + S * 2) continue;
    if (fogHides(w.x, w.y)) continue;
    const rnd = seeded(w.id + 17);
    const bob = Math.sin(c.time * 0.8 + w.id) * 0.02;
    foam(g, x, y, S * 0.42, c.time, w.id, 0.1);
    g.save();
    g.translate(x, y);
    g.rotate(w.rot + bob);
    if (w.kind === 'chapel') {
      // An old hulk at her moorings, a raft of planks alongside, the shrine's bell on her waist and the candles lit.
      g.fillStyle = 'rgba(3,8,11,0.35)';
      g.beginPath();
      g.ellipse(0, 0, S * 0.3, S * 0.58, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(S * 0.3, S * 0.05);
      raft(g, S * 0.42, rnd);
      g.restore();
      if (!drawArt(g, 'ship.hulk', -S * 0.06, 0, S * 1.05, 0, 0.9)) {
        g.fillStyle = '#2d2219';
        g.beginPath();
        g.ellipse(-S * 0.06, 0, S * 0.16, S * 0.48, 0, 0, Math.PI * 2);
        g.fill();
      }
      glow(g, -S * 0.06, -S * 0.04, S * 0.42, 0.3 + 0.08 * Math.sin(c.time * 2.3 + w.id), '255,214,150');
      drawArt(g, 'prop.shrine', -S * 0.06, -S * 0.04, S * 0.4, 0, 0.97);
      drawArt(g, 'prop.life_boat', S * 0.32, S * 0.38, S * 0.28, 0.3, 0.9);
      for (const [cx, cy] of [[S * 0.22, -S * 0.02], [S * 0.36, S * 0.1], [S * 0.26, S * 0.16]]) glow(g, cx, cy, S * 0.06, 0.7, '255,200,120');
    } else if (w.kind === 'tavern') {
      raft(g, S * 0.86, rnd);
      drawArt(g, 'prop.life_hut', -S * 0.1, -S * 0.02, S * 0.5, 0, 0.96);
      drawArt(g, 'prop.life_crates', S * 0.27, S * 0.1, S * 0.26, 0.4, 0.95);
      drawArt(g, 'prop.life_boat', -S * 0.08, S * 0.44, S * 0.32, Math.PI / 2 + 0.15, 0.9);
      glow(g, S * 0.22, -S * 0.18, S * 0.3, 0.26 + 0.07 * Math.sin(c.time * 3.1 + w.id));
    } else {
      raft(g, S * 0.9, rnd);
      drawArt(g, 'prop.life_tent', -S * 0.08, 0, S * 0.46, 0.05, 0.96);
      drawArt(g, 'prop.life_crates', S * 0.28, -S * 0.08, S * 0.24, -0.3, 0.95);
      drawArt(g, 'prop.life_boat', S * 0.06, -S * 0.46, S * 0.3, Math.PI / 2 - 0.2, 0.9);
      drawArt(g, 'prop.life_boat', -S * 0.12, S * 0.46, S * 0.3, Math.PI / 2 + 0.25, 0.9);
      glow(g, -S * 0.3, S * 0.12, S * 0.24, 0.18 + 0.05 * Math.sin(c.time * 2.7 + w.id));
    }
    g.restore();
    // Her name over it while she is within a couple of cables (and the one she is moored at, ringed).
    if (own && Math.hypot(own.x - w.x, own.y - w.y) < 420 && z > 0.6) {
      g.font = 'italic 600 12px "Cormorant Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.fillStyle = 'rgba(240,222,180,0.95)';
      const t = wayName(w.kind);
      g.strokeText(t, x, y - S * 0.62);
      g.fillText(t, x, y - S * 0.62);
    }
    if (w.id === near) {
      g.strokeStyle = 'rgba(232,196,106,0.7)';
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.arc(x, y, S * 0.7, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
}

function lozenge(g: G, x: number, y: number, r: number, kind: WayData['kind']): void {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fillStyle = kind === 'chapel' ? '#d9c9a0' : kind === 'market' ? '#c99a52' : '#e2a85a';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 1;
  g.stroke();
}

/** The minimap: a small warm lozenge for each waystation within its dial (the nearest kept where they crowd). */
export function drawWaysMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  const cells = new Set<number>();
  for (const w of state.ways.values()) {
    if (Math.abs(w.x - own.x) > range || Math.abs(w.y - own.y) > range || fogHides(w.x, w.y)) continue;
    const px = tx(w.x), py = ty(w.y);
    const cell = Math.floor(px / 7) * 4096 + Math.floor(py / 7);
    if (cells.has(cell)) continue;
    cells.add(cell);
    g.globalAlpha = 1 - 0.5 * Math.min(1, Math.max(Math.abs(w.x - own.x), Math.abs(w.y - own.y)) / range);
    lozenge(g, px, py, 2.6, w.kind);
  }
  g.globalAlpha = 1;
}

/** The chart, close in: the waystations she has streamed about her. */
export function drawWaysChart(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, zoom: number): void {
  if (zoom < 2) return;
  for (const w of state.ways.values()) {
    if (fogHides(w.x, w.y)) continue;
    lozenge(g, tx(w.x), ty(w.y), zoom >= 4 ? 4 : 3, w.kind);
  }
}

/** The minimap's tooltip over one. */
export function wayTip(state: ClientState, x: number, y: number, slack: number): string | null {
  for (const w of state.ways.values()) if (Math.hypot(w.x - x, w.y - y) <= slack + 40 && !fogHides(w.x, w.y)) return wayName(w.kind);
  return null;
}
