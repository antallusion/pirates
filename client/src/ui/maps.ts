// Treasure maps as a captain reads them (docs/01 §15): the circle's size, a riddle's verse, a drawing of a shore
// seen from the sea (an outline with a cross), a cursed map's needle, a piece of the season's legendary chart.

import type { MapView } from '../../../shared/src/protocol.ts';
import { esc } from './dom.ts';

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function mapCard(m: MapView): string {
  const tags: string[] = [];
  if (m.kind === 'circle' || (m.kind === 'fragment' && m.r >= 0)) tags.push(m.r === 0 ? 'the very spot' : `search ${Math.round(m.r)} m`);
  if (m.sealed) tags.push('<span style="color:var(--good)">Brokers\' seal</span>');
  else if (m.verdict) tags.push(m.verdict === 'genuine' ? '<span style="color:var(--good)">appraised genuine</span>' : '<span style="color:var(--bad)">appraised a forgery</span>');
  if (m.copy) tags.push('a copy');
  let art = '';
  if (m.shape && m.cross) {
    const pts = [];
    for (let i = 0; i < m.shape.length; i += 2) pts.push(`${(50 + m.shape[i] * 45).toFixed(1)},${(50 + m.shape[i + 1] * 45).toFixed(1)}`);
    const cx = 50 + m.cross[0] * 45, cy = 50 + m.cross[1] * 45;
    art = `<svg viewBox="0 0 100 100" width="96" height="96" style="background:#d9cba6;border:1px solid #6f5a38;float:right;margin-left:6px"><polygon points="${pts.join(' ')}" fill="#8a7650" stroke="#3a2d20" stroke-width="1.5"/><path d="M${cx - 5},${cy - 5}L${cx + 5},${cy + 5}M${cx + 5},${cy - 5}L${cx - 5},${cy + 5}" stroke="#8e2a2a" stroke-width="2.5"/></svg>`;
  }
  if (m.bearing !== undefined) {
    const deg = ((m.bearing * 180) / Math.PI + 360) % 360;
    art = `<svg viewBox="0 0 40 40" width="40" height="40" style="float:right"><circle cx="20" cy="20" r="18" fill="#101418" stroke="#2ee6c8"/><path d="M20,4 L24,20 L20,17 L16,20 Z" fill="#2ee6c8" transform="rotate(${deg.toFixed(0)} 20 20)"/></svg>`;
    tags.push(`the needle pulls ${POINTS[Math.round(deg / 45) % 8]}`);
  }
  return `<div class="tmap" style="overflow:hidden;padding:3px 0">${art}<b>${esc(m.name)}</b> <span class="muted">${tags.join(' · ')}</span>${m.clue ? `<div style="font-style:italic;font-size:12px;color:var(--fog)">${esc(m.clue)}</div>` : ''}</div>`;
}
