// «Переход» between hub ports on screen (owner, 2026-10-30, after Нефигугум's post 22 in forum topic 7; the rules are
// the server's, server/src/game/ferry.ts):
//  - in a hub port: the harbour's «Переход» page (and the top of «Гавань») — the other hubs with the distance and the
//    price, a «Переход» button each, her cooldown;
//  - the port card: the same list (buttons only when she lies there);
//  - the chart and the minimap: a small brass route badge by every hub.

import { HAVEN_R, isFerryHub } from '../../../shared/src/data/ferry.ts';
import type { ClientMsg, FerryView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dict } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { EN, RU } from '../lang/ui/ferry.ts';
import type { ClientState } from '../state.ts';
import { dec1, esc, icon, money } from './dom.ts';
import { placeName } from './maps.ts';

export const LF = dict(EN, RU);

/** The time in words: «12 мин», «1 ч 5 мин». */
function span(sec: number): string {
  const m = Math.max(1, Math.ceil(sec / 60));
  return m >= 60 ? LF('hmin', { h: Math.floor(m / 60), m: m % 60 }) : LF('min', { n: m });
}

/** The list of a hub's routes. `here`: she lies in this port (the buttons live); `left`: her cooldown now (s). */
export function ferryHtml(state: ClientState, view: FerryView, here: boolean, left = view.left, compact = false): string {
  const gold = state.self?.gold ?? 0;
  const why = here ? (left > 0 ? LF('wait', { t: span(left) }) : view.why ? serverText(view.why) : null) : null;
  const rows = view.routes.map((r) => {
    const p = state.ports.find((q) => q.id === r.to);
    if (!p) return '';
    // a hub she has not discovered (Нефигугум, post 24, topic 7): greyed, no button — and no faction or sea told
    if (r.locked) {
      const lock = here ? `<button type="button" class="btn btn-small fy-go" disabled>${esc(LF('go'))}</button>` : '';
      return `<div class="fy-row fy-row--locked" title="${esc(LF('locked'))}"><span class="fy-to">${icon('weather_fog', '🌫', 'ico-sm')}<b>${esc(placeName(p.name))}</b><small>${esc(LF('locked'))}</small></span><span class="fy-km">${esc(LF('km', { km: dec1(r.km) }))}</span>${lock}</div>`;
    }
    const can = here && !why && gold >= r.price;
    // (forum post 49: her price — the pirate flag's ×2, a quest's hub ×0.25 — and the plain one struck through by it)
    const was = r.base !== undefined && r.base !== r.price ? `<s class="fy-was">${money(r.base)}</s>` : '';
    const btn = here
      ? `<button type="button" class="btn btn-small${can ? ' btn-primary' : ''} fy-go" data-ferry="${esc(r.to)}" ${can ? '' : 'disabled'} title="${esc(gold < r.price ? LF('short') : '')}">${esc(LF('go'))} ${money(r.price)}</button>`
      : `<span class="fy-price">${money(r.price)}</span>`;
    const quest = r.quest ? `<em class="fy-quest" title="${esc(LF('questT'))}">${icon('tab_quests', '', 'ico-xs')}${esc(LF('quest'))}</em>` : '';
    return `<div class="fy-row${r.quest ? ' fy-row--quest' : ''}"><span class="fy-to">${icon(`faction_${p.faction}`, '', 'ico-sm')}<b>${esc(placeName(p.name))}</b><small>${esc(REGIONS[p.region].name)}${quest ? ' · ' : ''}${quest}</small></span><span class="fy-km">${esc(LF('km', { km: dec1(r.km) }))}${was}</span>${btn}</div>`;
  }).join('');
  const status = here ? `<p class="fy-st ${why ? 'warn' : 'good'}">${icon('ui_hourglass', '⌛', 'ico-sm')}${esc(why ?? LF('ready'))}</p>` : '';
  const pirate = view.pirate ? `<p class="fy-st warn fy-pirate">${icon('cos_flags', '', 'ico-sm')}${esc(LF('pirate'))}</p>` : '';
  return `<div class="fy${compact ? ' fy--compact' : ''}">${compact ? '' : `<p class="muted fy-text">${esc(LF('text'))}</p>`}${status}${pirate}<div class="fy-list">${rows}</div></div>`;
}

/** The harbour window's card. */
export function ferryCard(state: ClientState, view: FerryView): string {
  return `<div class="card fy-card"><h4 class="card-h">${icon('build_lighthouse', '⛵', 'ico-md')}${esc(LF('title'))}</h4>${ferryHtml(state, view, true)}</div>`;
}

/** Its buttons wired: the order to the server. */
export function bindFerry(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-ferry]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    b.disabled = true;
    send({ t: 'ferry', to: b.dataset.ferry! });
  }));
}

/** The chart's and the minimap's badge by a hub: a brass disc, two arrows across it (no painted art: drawn). */
export function drawHubMark(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = '#e8c46a';
  g.fill();
  g.lineWidth = Math.max(1, r * 0.22);
  g.strokeStyle = 'rgba(20,14,6,0.9)';
  g.stroke();
  // ⇄: two arrows, one each way
  const a = r * 0.55, h = r * 0.28, t = r * 0.3;
  g.lineWidth = Math.max(1, r * 0.2);
  g.strokeStyle = '#2a1c08';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - a, y - h); g.lineTo(x + a, y - h); g.lineTo(x + a - t, y - h - t);
  g.moveTo(x + a, y + h); g.lineTo(x - a, y + h); g.lineTo(x - a + t, y + h + t);
  g.stroke();
  g.restore();
}

/** «Тихая гавань» (forum post 49) on the chart and the minimap: a faint green ring of HAVEN_R about a hub, `k` px a
 *  metre — no captain attacks another inside it. */
export function drawHavenRing(g: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  const r = HAVEN_R * k;
  if (r < 3) return;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(159,211,122,0.1)';
  g.fill();
  g.setLineDash([Math.max(2, r * 0.08), Math.max(2, r * 0.06)]);
  g.lineWidth = Math.max(1.5, Math.min(2.5, r * 0.02));
  g.strokeStyle = 'rgba(159,211,122,0.6)';
  g.stroke();
  g.restore();
}

export { isFerryHub };
