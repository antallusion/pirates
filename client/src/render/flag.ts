// A captain's flag painted from her look (docs/12 P10 #12): the field in two colours, the emblem in the third — filled,
// outlined or ringed. Cached per look; the same painter serves the ships at sea and the editor.

import { GLYPHS, LOOK_COLORS } from '../../../shared/src/data/looks.ts';
import type { Look } from '../../../shared/src/data/looks.ts';

const cache = new Map<string, HTMLCanvasElement>();
const paths = new Map<number, Path2D>();

function glyph(i: number): Path2D {
  let p = paths.get(i);
  if (!p) paths.set(i, (p = new Path2D(GLYPHS[i].d)));
  return p;
}

/** Paint the flag into a context at w×h (top-left at 0,0). */
export function paintFlag(g: CanvasRenderingContext2D, l: Look, w: number, h: number): void {
  const c1 = LOOK_COLORS[l.c1].hex, c2 = LOOK_COLORS[l.c2].hex, c3 = LOOK_COLORS[l.c3].hex;
  g.save();
  g.fillStyle = c1;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c2;
  switch (l.field) {
    case 1: g.fillRect(0, h / 2, w, h / 2); break;
    case 2: g.fillRect(w / 2, 0, w / 2, h); break;
    case 3: g.fillRect(w / 2, 0, w / 2, h / 2); g.fillRect(0, h / 2, w / 2, h / 2); break;
    case 4: g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.25, 0); g.lineTo(w, h * 0.75); g.lineTo(w, h); g.lineTo(w * 0.75, h); g.lineTo(0, h * 0.25); g.closePath(); g.fill(); break;
    case 5: { const b = Math.min(w, h) * 0.12; g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h); break; }
    case 6: g.fillRect(w * 0.42, 0, w * 0.16, h); g.fillRect(0, h * 0.4, w, h * 0.2); break;
    case 7: g.lineWidth = Math.min(w, h) * 0.16; g.strokeStyle = c2; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); break;
    case 8: g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h * 0.35); g.lineTo(w, h); g.lineTo(w, h * 0.78); g.lineTo(w / 2, h * 0.12); g.lineTo(0, h * 0.78); g.closePath(); g.fill(); break;
    case 9: for (let i = 1; i < 6; i += 2) g.fillRect(0, (h / 6) * i, w, h / 6); break;
  }
  // The emblem, centred, in the third colour (with a thin dark edge to read on any field).
  const s = Math.min(w, h) * 0.8;
  g.translate(w / 2 - s / 2, h / 2 - s / 2);
  g.scale(s / 100, s / 100);
  const style = l.emblem % 3, p = glyph(Math.floor(l.emblem / 3));
  if (style === 2) {
    g.strokeStyle = c3;
    g.lineWidth = 6;
    g.beginPath(); g.arc(50, 50, 46, 0, Math.PI * 2); g.stroke();
    g.translate(18, 18);
    g.scale(0.64, 0.64);
  }
  if (style === 1) {
    g.strokeStyle = c3;
    g.lineWidth = 6;
    g.stroke(p);
  } else {
    g.fillStyle = c3;
    g.fill(p, 'evenodd');
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    g.stroke(p);
  }
  g.restore();
}

/** The flag as a small canvas (cached per look). */
export function flagCanvas(key: string, l: Look): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 96;
    c.height = 60;
    paintFlag(c.getContext('2d')!, l, 96, 60);
    cache.set(key, c);
  }
  return c;
}
