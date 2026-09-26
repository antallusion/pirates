// The diving bell in a sunken city (expeditions.ts): the drowned maze as the bell has seen it, air, divers,
// the key, the haul, and the log. The leader steers the bell with the arrow keys (or the buttons).

import type { ClientMsg, DiveView } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/dive.ts';
import { serverText } from '../lang/server.ts';
import { $, esc } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const roomName = (k: string) => (`room.${k}` in EN ? L(`room.${k}` as keyof typeof EN) : k);

const ICON: Record<string, string> = { entry: '⇑', hall: '', relic: '✦', trap: '!', guardian: '☠', key: '⚷', vault: '▣', shrine: '◌', '?': '' };

export class DivePanel {
  private key = '';
  private send: (m: ClientMsg) => void;
  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  render(v: DiveView | null): void {
    const el = $('hud-dive');
    if (!v) {
      if (this.key) {
        el.classList.add('hidden');
        el.innerHTML = '';
        this.key = '';
      }
      return;
    }
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    el.classList.remove('hidden');
    const cell = 26;
    const grid = v.rooms.map((r, i) => {
      const x = (i % v.w) * cell, y = Math.floor(i / v.w) * cell;
      const here = i === v.pos;
      const walls = r.k === '?' ? '' : `border-top:${r.d & 1 ? 0 : 2}px solid #6f5a38;border-right:${r.d & 2 ? 0 : 2}px solid #6f5a38;border-bottom:${r.d & 4 ? 0 : 2}px solid #6f5a38;border-left:${r.d & 8 ? 0 : 2}px solid #6f5a38;`;
      const bg = r.k === '?' ? '#07090b' : here ? '#2b4a4f' : r.done ? '#16252a' : '#1d3238';
      return `<div class="dcell" style="left:${x}px;top:${y}px;width:${cell}px;height:${cell}px;background:${bg};${walls}" title="${esc(roomName(r.k))}">${here ? '<b>◉</b>' : ICON[r.k] ?? ''}</div>`;
    }).join('');
    const air = Math.max(0, Math.min(100, (v.air / v.airMax) * 100));
    const ctl = v.leader
      ? `<div class="dctl"><button data-dd="n">▲</button><div><button data-dd="w">◀</button><button data-dd="s">▼</button><button data-dd="e">▶</button></div><button data-surface class="btn">${esc(L('surface'))}</button></div><div class="muted" style="font-size:11px">${esc(L('steerHint'))}</div>`
      : `<div class="muted" style="font-size:11px">${esc(L('allySteers'))}</div>`;
    el.innerHTML = `<div class="dname">${esc(L('title', { site: placeName(v.site) }))}</div><div class="muted" style="font-size:11px">${esc(L('status', { tide: serverText(v.tide), wave: v.waveIn, min: Math.ceil(v.endsIn / 60) }))}</div>
      <div class="dmaze" style="width:${v.w * cell}px;height:${v.h * cell}px">${grid}</div>
      <div class="bbar"><i style="width:${air.toFixed(0)}%;background:linear-gradient(90deg,#1f6a78,#58b8c8)"></i></div>
      <div style="font-size:12px">${esc(L('stats', { air: Math.round(v.air), max: v.airMax, divers: v.divers, keys: v.keys, silver: v.silver }))}${v.haul ? ` · ${esc(serverText(v.haul))}` : ''}</div>
      <div class="dlog">${v.log.map((l) => `<div>${esc(serverText(l))}</div>`).join('')}</div>${ctl}`;
    el.querySelectorAll<HTMLElement>('[data-dd]').forEach((b) => (b.onclick = () => this.send({ t: 'dive_move', dir: b.dataset.dd as 'n' | 'e' | 's' | 'w' })));
    el.querySelector<HTMLElement>('[data-surface]')?.addEventListener('click', () => this.send({ t: 'dive_surface' }));
  }
}
