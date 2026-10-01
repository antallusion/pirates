// The adventure map on the charts (docs/17 H4): the guards she has seen as red marks with HoMM3's word for their
// number (grey when beaten for now), the things on the map as their marks — gold while she may visit them, faded
// when she has, ringed red while a guard stands before them. On the minimap: a red diamond for a guard, a gold dot
// for a thing to visit.

import { GUARDS, OBJS } from '../../../shared/src/data/advmap.ts';
import { artMerchantAt } from '../../../shared/src/data/artifacts.ts';
import { guildOf } from '../../../shared/src/data/hero.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h4.ts';
import type { ClientState } from '../state.ts';
import { strengthWord } from './army.ts';

const L = dict(EN, RU);

export function drawAdvChart(
  g: CanvasRenderingContext2D, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, zoom: number, ms: number,
  mark: (id: string, x: number, y: number, size?: number) => boolean, label: (text: string, x: number, y: number, color?: string) => void,
): void {
  const v = state.adv;
  if (!v) return;
  const ru = lang() === 'ru' ? 1 : 0;
  if (zoom >= 1.5) {
    for (const o of v.objs) {
      const x = tx(o.x), y = ty(o.y);
      const size = ms * 0.8;
      g.globalAlpha = o.ready ? 1 : 0.45;
      g.beginPath();
      g.arc(x, y, size * 0.5, 0, Math.PI * 2);
      g.fillStyle = 'rgba(232,220,190,0.25)';
      g.fill();
      g.lineWidth = o.guarded ? 2 : 1.2;
      g.strokeStyle = o.guarded ? '#d0503c' : o.ready ? '#e8c46a' : 'rgba(200,200,190,0.6)';
      g.stroke();
      if (!mark(`icon.${OBJS[o.kind].icon}`, x, y, size * 0.85)) {
        g.fillStyle = '#e8c46a';
        g.fillRect(x - 2, y - 2, 4, 4);
      }
      g.globalAlpha = 1;
      if (zoom >= 3) {
        g.font = '600 10px Inter, system-ui, sans-serif';
        label(OBJS[o.kind].name[ru], x, y + size * 0.75, o.ready ? '#e8c46a' : 'rgba(200,200,190,0.7)');
      }
    }
  }
  for (const m of v.guards) {
    if (zoom < 1.2) continue;
    const x = tx(m.x), y = ty(m.y);
    const r = Math.max(4, ms * 0.28);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
    g.fillStyle = m.down ? 'rgba(140,140,130,0.6)' : '#b8352a';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1;
    g.stroke();
    if (zoom >= 2.5) {
      g.font = '600 10px Inter, system-ui, sans-serif';
      const text = m.down ? `${GUARDS[m.kind].name[ru]} · ${L('map.down')}` : `${strengthWord(m.men).word} · ${GUARDS[m.kind].name[ru]} ⚓${m.level}`;
      label(text, x, y + r + 10, m.down ? 'rgba(200,200,190,0.7)' : '#f09a8a');
    }
  }
}

/** On the minimap: the guards and the things on the map about her. */
export function drawAdvMini(g: CanvasRenderingContext2D, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  const v = state.adv;
  if (!v) return;
  for (const o of v.objs) {
    if (Math.abs(o.x - own.x) > range || Math.abs(o.y - own.y) > range) continue;
    g.fillStyle = o.guarded ? '#d0503c' : o.ready ? '#f0c860' : 'rgba(180,180,170,0.6)';
    g.beginPath();
    g.arc(tx(o.x), ty(o.y), o.ready ? 2.6 : 2, 0, Math.PI * 2);
    g.fill();
    if (o.ready && !o.guarded) {
      g.strokeStyle = 'rgba(255,230,160,0.8)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  for (const m of v.guards) {
    if (m.down || Math.abs(m.x - own.x) > range || Math.abs(m.y - own.y) > range) continue;
    const x = tx(m.x), y = ty(m.y);
    g.fillStyle = '#e04434';
    g.beginPath();
    g.moveTo(x, y - 4);
    g.lineTo(x + 4, y);
    g.lineTo(x, y + 4);
    g.lineTo(x - 4, y);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1;
    g.stroke();
  }
}

/** docs/17 H5: the hero's places on the chart — a port's guild of orders and its artifact merchant (small marks beside
 *  the port), and the drowned shrines on the islands she has charted (each teaches an order and fills her will). */
export function drawHeroSites(
  g: CanvasRenderingContext2D, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, zoom: number, ms: number,
  mark: (id: string, x: number, y: number, size?: number) => boolean, label: (text: string, x: number, y: number, color?: string) => void,
): void {
  if (zoom < 1.8) return;
  const size = ms * 0.55;
  const dot = (x: number, y: number, color: string) => {
    g.beginPath();
    g.arc(x, y, size * 0.32, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
  };
  const charted = new Set([...state.discovered].map((id) => state.islands.get(id)?.portId).filter(Boolean));
  for (const p of state.ports) {
    if (p.id.includes('_v') && !charted.has(p.id)) continue;
    const x = tx(p.x), y = ty(p.y);
    let dx = ms * 0.62;
    if (guildOf(p.id, p.size)) {
      if (!mark('icon.build_lighthouse', x + dx, y, size)) dot(x + dx, y, '#7fb8e8');
      dx += size * 0.95;
    }
    if (artMerchantAt(p.id, p.size) && !mark('icon.item_skull_ring', x + dx, y, size)) dot(x + dx, y, '#e8c46a');
  }
  for (const id of state.discovered) {
    const is = state.islands.get(id);
    if (!is || !is.features.includes('shrine')) continue;
    const x = tx(is.x), y = ty(is.y);
    if (!mark('icon.build_chapel', x, y, size)) dot(x, y, '#2ee6c8');
    if (zoom >= 3.5) {
      g.font = '600 10px Inter, system-ui, sans-serif';
      label(L('map.shrine'), x, y + size * 0.9, '#8fe8d8');
    }
  }
}
