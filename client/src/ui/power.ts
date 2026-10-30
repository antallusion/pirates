// The «Мощь» page of the Captain window (owner, 2026-10-31: «рейтинг должен строиться на мощи: армии, корабля, апгрейдов
// зданий … и вещей»): her total and its four parts with her place on each board, the top ten by the total, and how it is
// counted. The server's view: server/src/game/power.ts; the formulas: shared/src/data/power.ts. (The page wears the PvP
// page's classes: the same card, tiles and table.)

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { PowerRankView, PowerRow } from '../../../shared/src/powerproto.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/power.ts';
import { esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);
const PARTS = [['army', 'stat_crew'], ['ship', 'stat_hull'], ['isle', 'tab_isles'], ['gear', 'item_tricorne']] as const;

function stat(ico: string, name: string, val: string, sub = ''): string {
  return `<div class="pv-stat">${icon(ico, '', 'ico-md')}<span><b>${val}</b><i>${esc(name)}</i>${sub ? `<small>${sub}</small>` : ''}</span></div>`;
}

function row(r: PowerRow, me: string): string {
  const cap = CAPTAINS[r.captain as keyof typeof CAPTAINS];
  const mine = r.name === me;
  return `<li class="pv-row${mine ? ' me' : ''}${r.rank <= 3 ? ` top${r.rank}` : ''}"><span class="pv-rk">${r.rank}</span>${cap ? icon(cap.portrait, '', 'ico-md ico-round pv-face') : '<span></span>'}<span class="pv-nm"><b>${esc(r.name)}</b>${mine ? ` <em>${esc(L('you'))}</em>` : ''}<small>⚓${r.level}</small></span><span class="pv-kd">${PARTS.map(([k]) => fmt(r.pw[k])).join(' · ')}</span><b class="pv-pt">${fmt(r.pw.total)}</b></li>`;
}

/** The page (null view: asked for, on its way). */
export function powerPage(v: PowerRankView | null, me: string): string {
  if (!v) return `<p class="muted">${esc(L('loading'))}</p>`;
  const rk = v.ranks.power;
  const head = `<div class="pv-head card"><div class="pv-season">${icon('act_attack', '', 'ico-md')}<span><b>${esc(L('title'))}</b><small>${esc(L('colParts'))}</small></span></div>
    <div class="pv-big"><span><b>${fmt(v.me.total)}</b><i>${esc(L('colTotal'))}</i></span><span><b>${rk ? `#${fmt(rk)}` : '—'}</b><i>${esc(rk ? L('of', { n: fmt(v.ranked) }) : L('noPlace'))}</i></span></div></div>`;
  const stats = `<div class="pv-stats pw-stats">${PARTS.map(([k, ico]) => stat(ico, L(k), fmt(v.me[k]), v.ranks[k] ? esc(L('rankOn', { n: fmt(v.ranks[k]!) })) : '')).join('')}</div>`;
  const meIn = v.top.some((r) => r.name === me);
  const meRow: PowerRow | null = !meIn && rk ? { rank: rk, name: me, captain: '', level: 0, pw: v.me } : null;
  const top = `<div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${esc(L('top'))}</h4>
    ${v.top.length ? `<ol class="pv-list"><li class="pv-row pv-hd" aria-hidden="true"><span></span><span></span><span></span><span class="pv-kd">${esc(L('colParts'))}</span><span class="pv-pt">${esc(L('colTotal'))}</span></li>${v.top.map((r) => row(r, me)).join('')}${meRow ? `<li class="pv-gap">…</li>${row(meRow, me).replace('<small>⚓0</small>', '')}` : ''}</ol>` : `<p class="muted">${esc(L('empty'))}</p>`}</div>`;
  const how = `<div class="card pv-rules"><h4 class="card-h">${icon('ui_scroll', '', 'ico-md')}${esc(L('how'))}</h4><ul>${(['h1', 'h2', 'h3', 'h4', 'h5'] as const).map((k) => `<li>${esc(L(k))}</li>`).join('')}</ul></div>`;
  return `<div class="pv">${head}${stats}${top}${how}</div>`;
}
