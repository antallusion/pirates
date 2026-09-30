// The island's town of the Heroes (docs/17 H3 item 13): the third tab of "My Island", laid out as HoMM3's town hall
// screen — each building of the town a card with its isometric picture (the frame of beams before it stands, the
// weathered stage while the builders are at it), its level, a dwelling's men and growth, the next level's cost and
// what stands in its way; over them the treasury and its daily silver, the keep's growth, the week, and "Recruit";
// under them the captain's mines and the market's poor rates.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { MINES } from '../../../shared/src/data/mines.ts';
import { MARKET_GOODS, TOWN } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import { WEEKS } from '../../../shared/src/data/week.ts';
import type { TownThingView } from '../../../shared/src/h3proto.ts';
import type { BaseView, ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h3.ts';
import { EN as B_EN, RU as B_RU } from '../lang/ui/base.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { costLine, townName } from './recruit.ts';
import { timeText } from './base.ts';

const L = dict(EN, RU);
const B = dict(B_EN, B_RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

function art(id: TownId, level: number, working: boolean): string {
  const a = `build_${TOWN[id].art}`;
  const stage = level <= 0 ? 1 : working ? 2 : 0;
  return (stage ? assetUrl(`icon.${a}_${stage}`) : null) ?? assetUrl(`icon.${a}`) ?? '';
}

function card(v: BaseView, t: TownThingView, gold: number, have: Partial<Record<GoodId, number>>): string {
  const now = v.now;
  const d = TOWN[t.id];
  const name = townName(t.id, Math.max(1, t.level));
  const pic = art(t.id, t.level, !!t.job);
  const lvl = t.level > 0 ? L('town.lvl', { n: t.level, max: t.max }) : L('town.not');
  const pool = d.tier && t.level > 0 ? `<p class="tw-pool">${esc(L('town.pool', { n: t.pool ?? 0, g: dec1(t.growth ?? 0).replace(/[.,]0$/, '') }))}</p>` : '';
  const extra = t.id === 'guild' && t.level > 0 ? `<p class="muted tw-note">${esc(L('town.guild'))}</p>` : '';
  const j = t.job;
  const job = j ? `<div class="tw-job"><span class="muted">${esc(L('town.building'))}</span> <span class="btime" data-end="${j.end}">${esc(timeText((j.end - now) / 1000))}</span>
      <span class="bprog"><i data-start="${j.start}" data-stop="${j.end}" style="width:0%"></i></span>
      <div class="bspeed"><button class="btn btn-small btn-primary" data-bspeed="silver" data-job="${j.id}">${esc(B('finish'))} <span data-price="${j.end}">${money(j.silver)}</span></button>
      <button class="btn btn-small" data-bspeed="token" data-job="${j.id}"${v.speedups ? '' : ' disabled'}>⌛ ${esc(B('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>` : '';
  const n = t.next;
  const next = !j && n ? `<div class="tw-next"><b class="tw-nn">${esc(t.level > 0 ? `${L('town.up')}: ${townName(t.id, n.level)}` : townName(t.id, 1))}</b>${costLine({ silver: n.silver, goods: n.goods }, gold, have)}<span class="bcost btimec">⏱ ${esc(timeText(n.secs))}</span>
      ${n.why ? `<p class="muted tw-why">${esc(serverText(n.why))}</p>` : ''}<button class="btn btn-small${t.level ? '' : ' btn-primary'}" data-tbuild="${t.id}"${n.why ? ' disabled' : ''}>${esc(t.level > 0 ? L('town.up') : L('town.build'))}</button></div>`
    : !j ? `<p class="muted tw-max">${esc(L('town.max'))}</p>` : '';
  return `<div class="tw-card${t.level > 0 ? ' built' : ''}${d.tier ? ' dw' : ''}" data-town="${t.id}"><div class="tw-top">${pic ? `<img class="tw-art" src="${pic}" alt="" draggable="false">` : ''}<div class="tw-id"><b>${esc(name)}</b><span class="muted">${esc(lvl)}</span></div></div>
    <p class="muted tw-text">${esc(d.text[ru()])}</p>${pool}${extra}${job}${next}</div>`;
}

export function townTab(v: BaseView, state: ClientState, mk: { give: string; get: string; n: number }): string {
  const t = v.town!;
  const gold = state.self?.gold ?? 0;
  const have: Partial<Record<GoodId, number>> = Object.fromEntries(t.res.map((r) => [r.good, r.n]));
  const w = t.week;
  const week = `<span class="bmeta tw-week" title="${esc(WEEKS[w.kind].text[ru()])}">${esc(L('week', { n: w.n, d: w.day }))} · <b>${esc(WEEKS[w.kind].name[ru()])}</b></span>`;
  const res = t.res.map((r) => `<span class="bcost" title="${esc(GOODS[r.good].name)}">${icon(`good_${r.good}`, '', 'ico-sm')}${fmt(r.n)}</span>`).join('');
  const dwellings = t.things.filter((x) => TOWN[x.id].tier && x.level > 0);
  const head = `<div class="tw-head"><p class="muted">${esc(L('town.head'))}</p><div class="tw-meta">${week}
      <span class="bmeta" title="${esc(L('town.hall', { n: t.hall }))}">${icon('coin', '', 'ico-sm')}${esc(L('town.treasury', { n: fmt(t.treasury) }))}${t.hall ? ` <span class="good">${esc(L('town.hall', { n: fmt(t.hall) }))}</span>` : ''}</span>
      <span class="bmeta">${icon('build_fort', '', 'ico-sm')}${esc(L('town.growth', { n: dec1(t.growthMul).replace(/[.,]0$/, '') }))}</span>
      <button class="btn btn-small btn-primary" data-trecruit${dwellings.length ? '' : ' disabled'} title="${esc(t.near ? L('town.recruit') : L('town.far'))}">${icon('prof_marine', '', 'ico-sm')}${esc(L('town.recruit'))}</button></div>
      <div class="tw-res"><span class="muted">${esc(L('town.res'))}:</span> ${res}</div></div>`;
  const cards = t.things.filter((x) => x.id !== 'dw7' || t.deep || x.level > 0).map((x) => card(v, x, gold, have)).join('');
  // The captain's mines and what they pay a day.
  const mines = t.mines.length
    ? t.mines.map((m) => `<div class="tw-mine">${icon(MINES[m.kind].art, '', 'ico-md')}<span><b>${esc(L('town.mine', { kind: MINES[m.kind].name[ru()], island: placeName(m.island) }))}</b><br><span class="muted">${esc(L('town.day', { n: dec1(m.daily).replace(/[.,]0$/, '') }))} ${m.kind === 'silver' ? icon('coin', '', 'ico-sm') : icon(`good_${m.kind}`, '', 'ico-sm')}</span></span></div>`).join('')
    : `<p class="muted">${esc(L('town.mines.none'))}</p>`;
  const mk2 = t.market;
  const opt = (sel: string) => ['silver', ...MARKET_GOODS].map((g) => `<option value="${g}"${g === sel ? ' selected' : ''}>${esc(g === 'silver' ? L('market.silver') : GOODS[g as GoodId].name)}</option>`).join('');
  const market = mk2
    ? `<div class="tw-mk"><label>${esc(L('market.give'))} <select class="field" data-mkgive>${opt(mk.give)}</select></label><input class="field" type="number" min="1" value="${mk.n}" data-mkn aria-label="${esc(L('market.give'))}">
        <label>${esc(L('market.get'))} <select class="field" data-mkget>${opt(mk.get)}</select></label></div>
        <p class="tw-mkout" data-mkout>${esc(L('market.out', { n: fmt(marketOut(mk2, mk)) }))}</p>
        <p class="muted tw-rates">${esc(rateLine(mk2, mk))}</p>
        <button class="btn btn-small btn-primary" data-mkgo>${esc(L('market.btn'))}</button>`
    : `<p class="muted">${esc(L('market.none'))}</p>`;
  return `<div class="town">${head}<div class="tw-grid">${cards}</div>
    <div class="tw-cols"><div class="card"><h4 class="card-h">${icon('outpost_mine', '', 'ico-md')}${esc(L('town.mines'))}</h4>${mines}</div>
    <div class="card"><h4 class="card-h">${icon('build_caravan_office', '', 'ico-md')}${esc(L('market.title'))}</h4>${market}</div></div></div>`;
}

type Market = NonNullable<NonNullable<BaseView['town']>['market']>;

/** What the market gives for the order (the same sums as the server's). */
function marketOut(m: Market, mk: { give: string; get: string; n: number }): number {
  const n = Math.max(0, Math.floor(mk.n));
  if (mk.give === mk.get) return 0;
  if (mk.give === 'silver') return Math.floor(n / (m.buy[mk.get as GoodId] ?? Infinity));
  const value = n * (m.sell[mk.give as GoodId] ?? 0);
  return mk.get === 'silver' ? Math.floor(value) : Math.floor(value / (m.buy[mk.get as GoodId] ?? Infinity));
}

function rateLine(m: Market, mk: { give: string; get: string }): string {
  const g = (mk.give !== 'silver' ? mk.give : mk.get) as GoodId;
  if (!GOODS[g]) return '';
  return `${GOODS[g].name}: ${L('market.rates', { s: dec1(m.sell[g] ?? 0), b: dec1(m.buy[g] ?? 0) })}`;
}

export function bindTown(root: HTMLElement, send: (m: ClientMsg) => void, mk: { give: string; get: string; n: number }, recruit: () => void, redraw: () => void): void {
  root.querySelectorAll<HTMLElement>('[data-tbuild]').forEach((el) => (el.onclick = () => send({ t: 'h3', action: 'build', id: el.dataset.tbuild as TownId })));
  root.querySelector<HTMLElement>('[data-trecruit]')?.addEventListener('click', () => recruit());
  const give = root.querySelector<HTMLSelectElement>('[data-mkgive]');
  const get = root.querySelector<HTMLSelectElement>('[data-mkget]');
  const n = root.querySelector<HTMLInputElement>('[data-mkn]');
  if (give) give.onchange = () => {
    mk.give = give.value;
    if (mk.give === mk.get) mk.get = mk.give === 'silver' ? 'timber' : 'silver';
    redraw();
  };
  if (get) get.onchange = () => {
    mk.get = get.value;
    if (mk.give === mk.get) mk.give = mk.get === 'silver' ? 'timber' : 'silver';
    redraw();
  };
  if (n) n.onchange = () => {
    mk.n = Math.max(1, Math.floor(Number(n.value) || 1));
    redraw();
  };
  root.querySelector<HTMLElement>('[data-mkgo]')?.addEventListener('click', () => send({ t: 'h3', action: 'market', give: mk.give as GoodId | 'silver', get: mk.get as GoodId | 'silver', n: mk.n }));
}

/** The week in the HUD's line under the clock (docs/17 H3 item 10): «Нед. 12·3 · Неделя морпеха», its effect on hover. */
export function weekChip(state: ClientState): string {
  const w = state.week;
  if (!w) return '';
  const left = Math.max(0, w.nextIn - (Date.now() - state.weekAt) / 1000);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  const t = h > 0 ? B('t_hm', { h, m: String(m).padStart(2, '0') }) : B('t_m', { m: Math.max(1, m) });
  const d = WEEKS[w.kind];
  return `<span class="rg-week" title="${esc(L('hud.tip', { n: w.n, d: w.day, name: d.name[ru()], text: d.text[ru()], t }))}"><span class="rg-dot"> · </span>${esc(L('hud.week', { n: w.n, d: w.day }))} <span class="rg-wk">${esc(d.name[ru()])}</span></span>`;
}
