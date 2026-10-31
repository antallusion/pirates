// The treasure's scroll on the water (Нефигугум, forum post 34: the chart shows a search circle, never the spot): once her
// lookouts see it (the server sends MapView.spot within TM_SIGHT of her), a rolled parchment with a red wax seal bobs on
// the swell where the boats must dig, a faint gold light breathing under it and slow rings spreading on the water. No
// word over it till she is close — then «Клад: копать здесь». Drawn in code (no art file).

import type { MapView } from '../../../shared/src/protocol.ts';

/** Within this of the scroll (metres) its words come up. */
export const SCROLL_WORDS_R = 140;

export interface ScrollCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  /** Seconds (0 with «меньше движения»: it lies still). */
  time: number;
  w: number;
  h: number;
  own: { x: number; y: number } | null;
  /** The words over it, close by. */
  words: string;
}

/** The maps whose scroll is to be drawn: a spot in sight, not a circle drawn to a point (the chart's ✕ is that one's). */
export function scrollsOf(maps: readonly MapView[] | undefined): MapView[] {
  return (maps ?? []).filter((m) => m.spot && m.r !== 0);
}

/** Every scroll on the screen; returns the screen spots drawn (for a tap on one). */
export function drawTreasureScrolls(g: CanvasRenderingContext2D, maps: readonly MapView[] | undefined, c: ScrollCtx): { id: string; x: number; y: number }[] {
  const out: { id: string; x: number; y: number }[] = [];
  for (const m of scrollsOf(maps)) {
    const [wx, wy] = m.spot!;
    const px = c.sx(wx), py = c.sy(wy);
    if (px < -60 || py < -60 || px > c.w + 60 || py > c.h + 60) continue;
    const near = !!c.own && Math.hypot(c.own.x - wx, c.own.y - wy) <= SCROLL_WORDS_R;
    drawScroll(g, px, py, Math.max(1, Math.min(1.6, c.zoom / 1.6)), c.time + (wx % 7), m.tier >= 3, near ? c.words : '');
    out.push({ id: m.id, x: px, y: py });
  }
  return out;
}

/** One scroll at a screen point, `k` its scale. */
export function drawScroll(g: CanvasRenderingContext2D, px: number, py: number, k: number, t: number, grand: boolean, words: string): void {
  g.save();
  // the light under it, breathing
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
  const glowR = 34 * k;
  const halo = g.createRadialGradient(px, py, 2, px, py, glowR);
  halo.addColorStop(0, `rgba(255,214,120,${0.32 + 0.18 * pulse})`);
  halo.addColorStop(0.55, `rgba(240,190,90,${0.12 + 0.08 * pulse})`);
  halo.addColorStop(1, 'rgba(240,190,90,0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(px, py, glowR, 0, Math.PI * 2);
  g.fill();
  // rings spreading on the water (flattened: the sea is seen from above and a little aslant)
  for (let i = 0; i < 2; i++) {
    const f = ((t * 0.45 + i * 0.5) % 1 + 1) % 1;
    g.strokeStyle = `rgba(255,232,170,${0.42 * (1 - f)})`;
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(px, py + 5 * k, (10 + 26 * f) * k, (4 + 10 * f) * k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // the scroll itself, riding the swell
  const bob = Math.sin(t * 1.7) * 2.6 * k;
  const roll = Math.sin(t * 1.15) * 0.13;
  g.translate(px, py - 4 * k + bob);
  g.rotate(-0.18 + roll);
  const W = 30 * k, H = 15 * k, R = 4.2 * k;
  // its shadow on the water
  g.fillStyle = 'rgba(8,18,24,0.35)';
  g.beginPath();
  g.ellipse(1.5 * k, H * 0.62, W * 0.55, 3.2 * k, 0, 0, Math.PI * 2);
  g.fill();
  // the open sheet between the rolls
  const sheet = g.createLinearGradient(0, -H / 2, 0, H / 2);
  sheet.addColorStop(0, '#f6e7bf');
  sheet.addColorStop(0.6, '#e9d29c');
  sheet.addColorStop(1, '#cfae6c');
  g.fillStyle = sheet;
  g.strokeStyle = '#6b4a24';
  g.lineWidth = Math.max(1, 1.2 * k);
  g.beginPath();
  g.moveTo(-W / 2 + R, -H / 2);
  g.bezierCurveTo(-W / 6, -H / 2 - 2 * k, W / 6, -H / 2 + 2 * k, W / 2 - R, -H / 2);
  g.lineTo(W / 2 - R, H / 2);
  g.bezierCurveTo(W / 6, H / 2 + 2 * k, -W / 6, H / 2 - 2 * k, -W / 2 + R, H / 2);
  g.closePath();
  g.fill();
  g.stroke();
  // ink: a few faded lines and a little red cross
  g.strokeStyle = 'rgba(90,62,30,0.55)';
  g.lineWidth = Math.max(0.8, 0.9 * k);
  for (const yy of [-0.24, 0, 0.24]) {
    g.beginPath();
    g.moveTo(-W / 2 + R + 3 * k, yy * H);
    g.lineTo(W / 2 - R - 8 * k, yy * H + 0.6 * k);
    g.stroke();
  }
  g.strokeStyle = '#b8322a';
  g.lineWidth = Math.max(1, 1.4 * k);
  const cx = W / 2 - R - 4.5 * k, cy = -H * 0.12, cr = 2.2 * k;
  g.beginPath();
  g.moveTo(cx - cr, cy - cr); g.lineTo(cx + cr, cy + cr);
  g.moveTo(cx + cr, cy - cr); g.lineTo(cx - cr, cy + cr);
  g.stroke();
  // the two rolls
  for (const sx of [-1, 1]) {
    const rx = sx * (W / 2 - R * 0.4);
    const roll = g.createLinearGradient(rx - R, 0, rx + R, 0);
    roll.addColorStop(0, '#b48a4c');
    roll.addColorStop(0.45, '#f3dfae');
    roll.addColorStop(1, '#9c7238');
    g.fillStyle = roll;
    g.strokeStyle = '#5a3d1c';
    g.beginPath();
    g.ellipse(rx, 0, R, H / 2 + 2.2 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(90,60,26,0.6)';
    g.beginPath();
    g.ellipse(rx, -H / 2 - 1.2 * k, R * 0.55, 1.3 * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  // the seal on a ribbon (a legendary hoard's in gold)
  g.strokeStyle = grand ? '#d9a93a' : '#8e2a22';
  g.lineWidth = Math.max(1.2, 2 * k);
  g.beginPath();
  g.moveTo(-2 * k, H / 2 - 1 * k);
  g.lineTo(-4 * k, H / 2 + 6 * k);
  g.moveTo(2 * k, H / 2 - 1 * k);
  g.lineTo(4.5 * k, H / 2 + 5.5 * k);
  g.stroke();
  const seal = g.createRadialGradient(-1 * k, H / 2 - 2.5 * k, 0.5, 0, H / 2 - 1.5 * k, 4.4 * k);
  seal.addColorStop(0, grand ? '#ffe7a0' : '#e0614e');
  seal.addColorStop(1, grand ? '#b07d1e' : '#7e1e18');
  g.fillStyle = seal;
  g.beginPath();
  g.arc(0, H / 2 - 1.5 * k, 4.2 * k, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (words) {
    g.save();
    g.font = '600 12px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.lineWidth = 3.5;
    g.strokeStyle = 'rgba(10,8,6,0.85)';
    g.lineJoin = 'round';
    const ty = py - 22 * k + bob;
    g.strokeText(words, px, ty);
    g.fillStyle = '#f6dc8e';
    g.fillText(words, px, ty);
    g.restore();
  }
}
