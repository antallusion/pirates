// docs/19 E4: the citadels on the sea, strictly from above — the painted star fort (`prop.life_fort`) on its island
// behind the anchorage, its holder's pennant over it (the painted pennant, dyed the guild's colour; the castellan's a
// dark iron grey; the Masters of the Throne's with a gold crown), its name and its holder under it; an open window a
// slow amber ring on the water before its gate, a siege a red one. On the charts (the world map and the dial): the
// painted fort's icon in a ring of the holder's colour.

import { guildColour } from '../../../shared/src/data/citadels.ts';
import type { CitMark } from '../../../shared/src/data/citadels.ts';
import { sprite } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/citadels.ts';
import type { ClientState } from '../state.ts';
import { citLabel } from '../ui/citadels.ts';
import { drawArt, markRing } from './seaart.ts';

const L = dict(EN, RU);
type G = CanvasRenderingContext2D;

const IRON = '#5d6066';
const colourOf = (c: CitMark): string => (c.tag ? guildColour(c.tag) : IRON);

interface Ctx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

function label(g: G, text: string, x: number, y: number, col: string, size = 11): void {
  g.font = `600 ${size}px Inter, sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillText(text, x + 1, y + 1);
  g.fillStyle = col;
  g.fillText(text, x, y);
}

/** The holder's flag on its pole, waving (a crown over it for the Masters of the Throne). */
function pennant(g: G, x: number, y: number, len: number, col: string, crown: boolean, t: number): void {
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.lineWidth = Math.max(2, len * 0.08);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - len);
  g.stroke();
  g.strokeStyle = '#8a7a5a';
  g.lineWidth = Math.max(1, len * 0.04);
  g.stroke();
  // The cloth: a swallow-tailed flag in the guild's colour, its far edge waving.
  const fw = len * 0.62, fh = len * 0.36, top = y - len, wv = Math.sin(t * 3 + x * 0.01) * fh * 0.12;
  g.beginPath();
  g.moveTo(x, top);
  g.quadraticCurveTo(x + fw * 0.5, top - wv, x + fw, top + wv);
  g.lineTo(x + fw * 0.78, top + fh * 0.5 + wv);
  g.lineTo(x + fw, top + fh + wv);
  g.quadraticCurveTo(x + fw * 0.5, top + fh - wv, x, top + fh);
  g.closePath();
  g.fillStyle = col;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(x + 1, top + 1, fw * 0.4, fh * 0.18);
  if (crown) {
    const cx = x, cy = y - len * 1.08, s = len * 0.22;
    g.fillStyle = '#e0b862';
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - s, cy + s * 0.6);
    g.lineTo(cx - s, cy - s * 0.3);
    g.lineTo(cx - s * 0.5, cy + s * 0.1);
    g.lineTo(cx, cy - s * 0.6);
    g.lineTo(cx + s * 0.5, cy + s * 0.1);
    g.lineTo(cx + s, cy - s * 0.3);
    g.lineTo(cx + s, cy + s * 0.6);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/** The citadels on the sea. */
export function drawCitadelsWorld(g: G, state: ClientState, c: Ctx): void {
  if (!state.citadels.length || c.zoom < 0.05) return;
  for (const m of state.citadels) {
    const x = c.sx(m.fx), y = c.sy(m.fy);
    const s = Math.max(34, 300 * c.zoom);
    if (x < -s * 2 || y < -s * 2 || x > c.w + s * 2 || y > c.h + s * 2) continue;
    g.save();
    // The fort: its shadow on the ground, then the painting (a drawn star of stone when it is missing).
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(x + s * 0.05, y + s * 0.07, s * 0.46, s * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    if (!drawArt(g, 'prop.life_fort', x, y, s, 0, 1)) {
      g.fillStyle = '#6a6760';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, rr = (i % 2 ? 0.3 : 0.48) * s;
        if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    }
    const col = colourOf(m);
    pennant(g, x + s * 0.22, y - s * 0.18, Math.max(18, s * 0.34), col, !!m.crown, c.time);
    // Before its gate: an open window's slow amber ring, a siege's red one.
    const ax = c.sx(m.x), ay = c.sy(m.y);
    const pulse = 0.5 + 0.5 * Math.sin(c.time * 2 + m.id);
    if (m.siege) markRing(g, ax, ay, Math.max(16, 120 * c.zoom), '#d0503c', true, 0.7 + 0.3 * pulse);
    else if (m.open) markRing(g, ax, ay, Math.max(16, 120 * c.zoom), '#e7a35a', false, 0.55 + 0.35 * pulse);
    if (c.zoom > 0.12) {
      label(g, `${citLabel(m)} · ⚓${m.level}`, x, y + s * 0.56 + 12, '#f0d58f', 12);
      label(g, m.tag ? `[${m.tag}]${m.siege ? ` · ${L('map.siege', { tag: m.siege })}` : ''}` : `${L('map.castellan')}${m.siege ? ` · ${L('map.siege', { tag: m.siege })}` : m.open ? ` · ${L('map.open')}` : ''}`, x, y + s * 0.56 + 26, m.siege ? '#e07a5e' : col);
    }
    g.restore();
  }
}

/** The citadels on the world map: the fort's icon in a ring of its holder's colour, a pennant, the name and holder. */
export function drawCitadelsChart(
  g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, zoom: number, ms: number,
  mark: (id: string, x: number, y: number, size?: number) => boolean, lab: (text: string, x: number, y: number, color?: string) => void,
): void {
  for (const m of state.citadels) {
    const x = tx(m.fx), y = ty(m.fy);
    const size = ms * 1.35;
    const col = colourOf(m);
    g.beginPath();
    g.arc(x, y, size * 0.55, 0, Math.PI * 2);
    g.fillStyle = 'rgba(232, 220, 190, 0.22)';
    g.fill();
    g.lineWidth = m.tag ? 2.2 : 1.4;
    g.strokeStyle = m.siege ? '#d0503c' : col;
    g.stroke();
    if (m.open || m.siege) {
      g.setLineDash([3, 3]);
      g.strokeStyle = m.siege ? 'rgba(208,80,60,0.9)' : 'rgba(231,163,90,0.9)';
      g.beginPath();
      g.arc(x, y, size * 0.75, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    if (!mark('icon.build_fort_2', x, y, size)) {
      g.fillStyle = col;
      g.fillRect(x - 5, y - 4, 10, 8);
    }
    // The pennant.
    const px = x + size * 0.32, py = y - size * 0.55;
    g.fillStyle = col;
    g.fillRect(px - 1, py, 2, size * 0.45);
    g.beginPath();
    g.moveTo(px + 1, py);
    g.lineTo(px + 10, py + 3.5);
    g.lineTo(px + 1, py + 7);
    g.closePath();
    g.fill();
    if (m.crown) {
      g.fillStyle = '#e0b862';
      g.font = '700 10px serif';
      g.textAlign = 'center';
      g.fillText('♛', px + 4, py - 2);
    }
    g.font = '600 11px Inter, system-ui, sans-serif';
    lab(`${citLabel(m)}${m.tag ? ` [${m.tag}]` : ''}`, x, y + size * 0.85, m.tag ? col : '#e8dcc0');
    if (zoom >= 1.2 && (m.siege || m.open)) lab(m.siege ? L('map.siege', { tag: m.siege }) : L('map.open'), x, y + size * 0.85 + 13, m.siege ? '#e07a5e' : '#e7a35a');
  }
}

/** The citadels on the dial: a small castle in its holder's colour, an open window ringed. */
export function drawCitadelsMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  for (const m of state.citadels) {
    if (Math.abs(m.fx - own.x) > range || Math.abs(m.fy - own.y) > range) continue;
    const x = tx(m.fx), y = ty(m.fy);
    const col = colourOf(m);
    const art = sprite('icon.build_fort_2');
    if (art) {
      const k = 16 / Math.max(art.img.naturalWidth, art.img.naturalHeight);
      g.drawImage(art.img, x - (art.img.naturalWidth * k) / 2, y - (art.img.naturalHeight * k) / 2, art.img.naturalWidth * k, art.img.naturalHeight * k);
    } else {
      g.fillStyle = col;
      g.fillRect(x - 4, y - 3, 8, 6);
      for (const dx of [-4, -1, 2]) g.fillRect(x + dx, y - 5, 2, 2);
    }
    g.strokeStyle = m.siege ? '#d0503c' : col;
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.stroke();
    if (m.open && !m.siege) {
      g.strokeStyle = 'rgba(231,163,90,0.8)';
      g.setLineDash([2, 2]);
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
}
