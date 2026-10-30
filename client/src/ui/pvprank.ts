// The «ПвП» page of the Captain window (owner, 2026-10-30: «введи еще рейтинг пвп, показывай его в статистике типа
// сколько заработано баллов, сколько убито игроков, сделай какие-то ежемесячные награды»): her season (points, place,
// days left), all time (points, kills, deaths, K/D, duels, the best streak), the month's top ten with her place, the
// rewards and the rules. The server's view: server/src/game/pvprank.ts; the numbers: shared/src/data/pvprank.ts.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { titleOf } from '../../../shared/src/data/cosmetics.ts';
import { MONTH_NAMES, PVP_PARTICIPATION, PVP_POINTS, PVP_REWARDS, PVP_REWARD_MIN } from '../../../shared/src/data/pvprank.ts';
import type { PvpRankView, PvpRow } from '../../../shared/src/pvprankproto.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/pvprank.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { doubloonIcon } from './price.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);
const monthName = (m: number) => `${MONTH_NAMES[m % 12][ru()]} ${Math.floor(m / 12)}`;
const kd = (k: number, d: number) => (d > 0 ? (k / d).toFixed(2).replace('.', ru() ? ',' : '.') : k > 0 ? '∞' : '—');

function stat(ico: string, name: string, val: string, sub = '', cls = ''): string {
  return `<div class="pv-stat${cls ? ` ${cls}` : ''}">${icon(ico, '', 'ico-md')}<span><b>${val}</b><i>${esc(name)}</i>${sub ? `<small>${sub}</small>` : ''}</span></div>`;
}

function row(r: PvpRow, me: string): string {
  const cap = CAPTAINS[r.captain as keyof typeof CAPTAINS];
  const mine = r.name === me;
  return `<li class="pv-row${mine ? ' me' : ''}${r.rank <= 3 ? ` top${r.rank}` : ''}"><span class="pv-rk">${r.rank}</span>${cap ? icon(cap.portrait, '', 'ico-md ico-round pv-face') : ''}<span class="pv-nm"><b>${esc(r.name)}</b>${mine ? ` <em>${esc(L('you'))}</em>` : ''}<small>⚓${r.level}</small></span><span class="pv-kd">${fmt(r.kills)} / ${fmt(r.deaths)}</span><b class="pv-pt">${fmt(r.pts)}</b></li>`;
}

/** The page (null view: asked for, on its way). */
export function pvpPage(v: PvpRankView | null, me: string): string {
  if (!v) return `<p class="muted">${esc(L('loading'))}</p>`;
  const s = v.season, a = v.all;
  const head = `<div class="pv-head card"><div class="pv-season">${icon('act_attack', '', 'ico-md')}<span><b>${esc(L('season', { m: monthName(v.month) }))}</b><small>${esc(L('daysLeft', { n: v.daysLeft }))}</small></span></div>
    <div class="pv-big"><span><b>${fmt(s.pts)}</b><i>${esc(L('pts'))}</i></span><span><b>${v.rank ? `#${fmt(v.rank)}` : '—'}</b><i>${esc(v.rank ? L('rank') : L('noRank'))}</i></span></div></div>`;
  const stats = `<div class="pv-stats">
    ${stat('xp', L('allPts'), fmt(a.pts))}
    ${stat('map_wreck', L('kills'), `${fmt(s.kills)} <span class="pv-of">/ ${fmt(a.kills)}</span>`, esc(L('sunkTaken', { s: fmt(a.sunk), b: fmt(a.boarded) })))}
    ${stat('danger', L('deaths'), `${fmt(s.deaths)} <span class="pv-of">/ ${fmt(a.deaths)}</span>`)}
    ${stat('ui_cutlasses', L('kd'), kd(a.kills, a.deaths), esc(`${L('month')}: ${kd(s.kills, s.deaths)}`))}
    ${stat('wanted', L('duels'), `${fmt(s.duels)} <span class="pv-of">/ ${fmt(a.duels)}</span>`, a.assists ? esc(`${L('assists')}: ${fmt(a.assists)}`) : '')}
    ${stat('build_trophy_hall', L('streak'), fmt(v.streak), esc(L('best', { n: v.best })))}
  </div><p class="muted pv-legend">${esc(`${L('month')} / ${L('all')}`)}</p>`;
  const meIn = v.top.some((r) => r.name === me);
  const meRow: PvpRow | null = !meIn && v.rank ? { rank: v.rank, name: me, captain: '', level: 0, pts: s.pts, kills: s.kills, deaths: s.deaths } : null;
  const top = `<div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${esc(L('top'))}<span class="muted h-count">${esc(L('ranked', { n: v.ranked }))}</span></h4>
    ${v.top.length ? `<ol class="pv-list"><li class="pv-row pv-hd" aria-hidden="true"><span></span><span></span><span></span><span class="pv-kd">${esc(L('colKd'))}</span><span class="pv-pt">${esc(L('colPts'))}</span></li>${v.top.map((r) => row(r, me)).join('')}${meRow ? `<li class="pv-gap">…</li>${row(meRow, me).replace('<small>⚓0</small>', '')}` : ''}</ol>` : `<p class="muted">${esc(L('empty'))}</p>`}</div>`;
  const rw = PVP_REWARDS.map((r) => {
    const t = r.title ? titleOf(r.title) : undefined;
    const bits = [money(r.silver), r.doubloons ? `<span class="money">${doubloonIcon('ico-sm')}${fmt(r.doubloons)}</span>` : ''];
    return `<li><b>${esc(L('rw13', { p: r.place }))}</b><span>${t ? `<em class="pv-title">${esc(L('rwTitle', { t: t.name[ru()] }))}</em> · ` : ''}${bits.filter(Boolean).join(' ')}</span></li>`;
  }).join('');
  const rewards = `<div class="card"><h4 class="card-h">${icon('ui_chest', '', 'ico-md')}${esc(L('rewards'))}</h4><ul class="pv-rw">${rw}<li><b>${esc(L('rwAll', { n: PVP_REWARD_MIN }))}</b><span>${money(PVP_PARTICIPATION.silver)}</span></li></ul></div>`;
  const last = v.last && v.last.top.length ? `<p class="muted pv-last">${esc(L('last', { m: monthName(v.last.month) }))}: ${v.last.top.map((r) => `${r.rank}. ${esc(r.name)} (${fmt(r.pts)})`).join(' · ')}</p>` : '';
  const rules = `<div class="card pv-rules"><h4 class="card-h">${icon('ui_scroll', '', 'ico-md')}${esc(L('rules'))}</h4><ul>${[L('r1', { s: PVP_POINTS.sunk, b: PVP_POINTS.boarded, d: PVP_POINTS.duel }), L('r2'), L('r3'), L('r4')].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  return `<div class="pv">${head}${stats}${top}${last}${rewards}${rules}</div>`;
}
