// docs/16 Batch C in port and at sea: the merchants' runs on the contracts board (#12), the trophy auction of the free
// ports (#13), the tavern's whispers for silver (#14), repairs at sea set against the yard's (#15). The clocks tick in
// place (no redraw of the harbour page, so a half-typed bid is not lost); a whisper bought becomes her mark.

import { AUCTION_BIDDERS, RELIABILITY, RESERVE_MAX, RESERVE_MIN, RUN_HOUSES, RUN_LEGS, RUN_SLOTS, OWN_LOTS } from '../../../shared/src/data/dealings.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { RARITY_NAMES, SLOT_NAMES, itemName, itemSlot, itemValue } from '../../../shared/src/data/items.ts';
import type { ClientMsg, HearsayView, PortView, PrivateState, TradeRunView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/dealings.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { coloured, itemCardHtml, itemIcon } from './gear.ts';
import { placeName } from './maps.ts';
import { personName } from '../lang/names.ts';
import { compassKey, setWaypoint } from './track.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);
/** A tenth-precise number the reader's way (6.7 / 6,7). */
const num1 = (n: number) => (ru() ? String(n).replace('.', ',') : String(n));

// ------------------------------------------------------------------ the clocks

/** The auction house's wall clock against this browser's (ms). */
let wallOffset = 0;
let worldNow: () => number = () => 0;

function mmss(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

function tick(): void {
  if (typeof document === 'undefined') return;
  const wall = Date.now() + wallOffset;
  document.querySelectorAll<HTMLElement>('[data-wend]').forEach((el) => {
    const left = (Number(el.dataset.wend) - wall) / 1000;
    el.textContent = left > 0 ? mmss(left) : L('au.closed');
    el.classList.toggle('dl-hot', left > 0 && left < 60);
  });
  const now = worldNow();
  document.querySelectorAll<HTMLElement>('[data-gend]').forEach((el) => {
    const left = Number(el.dataset.gend) - now;
    el.textContent = mmss(left);
    el.classList.toggle('dl-hot', left < 120);
  });
  document.querySelectorAll<HTMLElement>('[data-early]').forEach((el) => {
    const left = Number(el.dataset.early) - now;
    el.textContent = left > 0 ? mmss(left) : L('run.late');
    el.classList.toggle('dl-late', left <= 0);
  });
}
if (typeof window !== 'undefined') window.setInterval(tick, 1000);

function clockFor(state: ClientState): void {
  worldNow = () => state.estServerTime();
  queueMicrotask(tick);
}

/** A bidder of the room by its own name in her language; a captain by hers. */
function bidder(n: string): string {
  const b = AUCTION_BIDDERS.find((x) => x[0] === n);
  return b ? b[ru()] : personName(n);
}

function portNameOf(state: ClientState, id: string): string {
  return placeName(state.ports.find((p) => p.id === id)?.name ?? id);
}

function goodName(g: string): string {
  return GOODS[g as keyof typeof GOODS]?.name ?? g;
}

// ------------------------------------------------------------------ 12. merchants' runs

function runOffer(state: ClientState, r: TradeRunView, next: boolean): string {
  const house = RUN_HOUSES[r.house]?.[ru()] ?? '';
  const early = Math.round((r.window * 0.55) / 60);
  return `<div class="dl-run${next ? ' dl-next' : ''}">
    <div class="dl-run-h">${icon(`good_${r.good}`, '', 'ico-md')}<div class="dl-run-t"><b>${esc(L('run.route', { qty: r.qty, good: goodName(r.good), to: portNameOf(state, r.to) }))}</b>
      <span class="muted">${esc(L('run.leg', { n: r.leg, max: RUN_LEGS, house }))}</span></div></div>
    <div class="dl-facts"><span>${esc(L('run.cost', { n: fmt(r.cost * r.qty) }))}</span><span>${esc(L('run.pays', { each: fmt(r.pay), n: fmt(r.pay * r.qty) }))}</span>
      <span class="gold">${esc(L('run.bonus', { n: fmt(r.bonus) }))}</span><span class="muted">${esc(L('run.window', { km: Math.round(r.dist / 1000), min: Math.round(r.window / 60), early }))}</span></div>
    <div class="row"><span></span><button class="btn btn-small btn-primary" data-act="dl" data-dl="run_accept" data-id="${esc(r.id)}">${esc(L('run.take'))}</button></div></div>`;
}

function runMine(state: ClientState, r: TradeRunView): string {
  const house = RUN_HOUSES[r.house]?.[ru()] ?? '';
  return `<div class="dl-run dl-own"><div class="dl-run-h">${icon(`good_${r.good}`, '', 'ico-md')}<div class="dl-run-t"><b>${esc(r.qty)} × ${esc(goodName(r.good))} ${esc(L('run.to', { to: portNameOf(state, r.to) }))}</b>
    <span class="muted">${esc(L('run.leg', { n: r.leg, max: RUN_LEGS, house }))}</span></div></div>
    <div class="dl-facts"><span>${esc(L('run.left'))} <b class="dl-clock" data-gend="${r.deadline}"></b></span><span class="gold">${esc(L('run.bonus', { n: fmt(r.bonus) }))}: <b class="dl-clock" data-early="${r.early}"></b></span></div>
    <div class="row"><span class="muted">${esc(L('run.pays', { each: fmt(r.pay), n: fmt(r.pay * r.qty) }))}</span><button class="btn btn-small btn-danger" data-act="dl" data-dl="run_abandon" data-id="${esc(r.id)}">${esc(L('run.abandon'))}</button></div></div>`;
}

/** The contracts board's card of the merchants' runs: her next leg, the offers, hers under way. */
export function runsCard(view: PortView, state: ClientState): string {
  clockFor(state);
  const b = view.runs;
  if (!b) return '';
  const mine = state.self?.runs ?? [];
  const next = b.next ? `<div class="giver-h">${esc(L('run.next', { house: RUN_HOUSES[b.next.house]?.[ru()] ?? '' }))}</div>${runOffer(state, b.next, true)}` : '';
  const offers = b.offers.map((r) => runOffer(state, r, false)).join('') || `<p class="muted">${esc(L('run.none'))}</p>`;
  const own = mine.length ? `<div class="giver-h">${esc(L('run.mine'))} <span class="h-count" title="${esc(L('run.slots'))}">${mine.length}/${RUN_SLOTS}</span></div>${mine.map((r) => runMine(state, r)).join('')}` : '';
  return `<div class="card dl-card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('run.title'))}</h4><p class="muted">${esc(L('run.text'))}</p>${next}${offers}${own}</div>`;
}

// ------------------------------------------------------------------ 13. the trophy auction

export function auctionCard(view: PortView, state: ClientState): string {
  const au = view.auction;
  if (!au) return '';
  wallOffset = au.wall - Date.now();
  queueMicrotask(tick);
  const self = state.self!;
  const lots = au.lots.map((l) => {
    const slot = itemSlot(l.item);
    const who = l.mine ? L('au.mine') : l.seller ? L('au.seller', { name: personName(l.seller) }) : L('au.house');
    const lead = l.leading ? `<span class="dl-lead">${esc(L('au.you'))}</span>` : l.leader ? `<span class="muted">${esc(L('au.leader', { name: bidder(l.leader) }))}</span>` : '';
    const can = !l.mine && !l.leading;
    return `<div class="au-lot"><details><summary>${itemIcon(l.item, slot, 'ico-md')}<span class="au-name">${coloured(l.item)}<span class="muted">${esc(RARITY_NAMES[l.item.rarity][ru()])} · ${esc(SLOT_NAMES[slot][ru()])} · ⚓${l.item.ilvl} · ${esc(who)}</span></span></summary>${itemCardHtml(l.item)}</details>
      <div class="au-state"><span class="au-bid">${esc(l.bids ? L('au.standing') : L('au.opening'))} ${money(l.bid)}</span><span class="muted">${esc(L('au.worth', { n: fmt(l.worth) }))}${l.bids ? ` · ${esc(L('au.bids', { n: l.bids }))}` : ''}</span>${lead}
        <span class="au-time">${esc(L('au.ends'))} <b class="dl-clock" data-wend="${l.endsAt}"></b></span></div>
      ${can ? `<div class="au-form"><input class="field" type="number" min="${l.next}" step="1" value="${l.next}" data-aubid="${esc(l.id)}" aria-label="${esc(L('au.bid'))}"><button class="btn btn-small btn-primary" data-act="dl" data-dl="au_bid" data-id="${esc(l.id)}" ${self.gold < l.next ? 'disabled' : ''}>${esc(L('au.bid'))}</button></div>` : ''}</div>`;
  }).join('');
  const locker = self.stash.filter((it) => !it.bound);
  const reserveOf = (v: number) => Math.round(v * 0.6);
  const put = au.own >= OWN_LOTS ? `<p class="muted">${esc(L('au.full', { n: au.own }))}</p>` : locker.length
    ? `<div class="au-put"><span class="giver-h">${esc(L('au.put'))}</span><select data-auitem>${locker.map((it) => `<option value="${it.uid}" data-reserve="${reserveOf(itemValue(it))}" data-lo="${Math.max(10, Math.round(itemValue(it) * RESERVE_MIN))}" data-hi="${Math.round(itemValue(it) * RESERVE_MAX)}">${esc(itemName(it, ru() === 1))} · ⚓${it.ilvl}</option>`).join('')}</select>
      <label>${esc(L('au.reserve'))} <input class="field" type="number" min="1" data-aureserve value="${reserveOf(itemValue(locker[0]))}"></label><button class="btn btn-small" data-act="dl" data-dl="au_put">${esc(L('au.putBtn'))}</button></div>`
    : `<p class="muted">${esc(L('au.noItems'))}</p>`;
  return `<div class="card dl-card au-card"><h4 class="card-h">${icon('tab_legends', '', 'ico-md')}${esc(L('au.title'))}</h4><p class="muted">${esc(L('au.text'))}</p><div class="au-lots">${lots}</div>${put}</div>`;
}

// ------------------------------------------------------------------ 14. the tavern's whispers

function where(bearing: number): string {
  return L(`to.${compassKey(bearing)}` as keyof typeof EN);
}

export function hearsayCard(view: PortView, state: ClientState): string {
  clockFor(state);
  const offers = view.hearsay ?? [];
  const rows = offers.map((o) => {
    const text = o.kind === 'cache' ? L('hs.cache', { km: o.km, dir: where(o.bearing) }) : L('hs.caravan', { km: o.km, dir: where(o.bearing) });
    return `<div class="hs-row">${icon(o.kind === 'cache' ? 'map_treasure' : 'map_contract', '', 'ico-md')}<div class="hs-t"><b>${esc(text)}</b><span class="hs-grade ${o.reliability}">${esc(L('hs.odds', { grade: L(`hs.${o.reliability}`), pct: Math.round(RELIABILITY[o.reliability] * 100) }))}</span></div>
      ${o.bought ? `<span class="tag">${esc(L('hs.bought'))}</span>` : `<button class="btn btn-small btn-primary" data-act="dl" data-dl="hs_buy" data-id="${esc(o.id)}" ${(state.self?.gold ?? 0) < o.price ? 'disabled' : ''}>${money(o.price)}</button>`}</div>`;
  }).join('') || `<p class="muted">${esc(L('hs.none'))}</p>`;
  return `<div class="card dl-card hs-card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('hs.title'))}</h4><p class="muted">${esc(L('hs.text'))}</p>${rows}${followed(state)}</div>`;
}

function followed(state: ClientState): string {
  const list = state.self?.hearsay ?? [];
  if (!list.length) return '';
  return `<div class="giver-h">${esc(L('hs.mine'))}</div>${list.map((h) => `<div class="hs-row">${icon(h.kind === 'cache' ? 'map_treasure' : 'map_contract', '', 'ico-sm')}<div class="hs-t"><b>${esc(hearsayLabel(h))}</b><span class="muted">${esc(L('hs.cold'))} <b class="dl-clock" data-gend="${h.expiresAt}"></b></span></div>
    <span class="hs-btns"><button class="btn btn-small" data-act="dl" data-dl="hs_mark" data-x="${h.x}" data-y="${h.y}">${esc(L('hs.show'))}</button><button class="btn btn-small btn-danger" data-act="dl" data-dl="hs_forget" data-id="${esc(h.id)}">${esc(L('hs.forget'))}</button></span></div>`).join('')}`;
}

export function hearsayLabel(h: HearsayView): string {
  return h.kind === 'cache' ? L('hs.cacheOn', { name: placeName(h.name) }) : L('hs.caravanAt', { name: placeName(h.name), dir: L(`hd.${compassKey(h.heading ?? 0)}` as keyof typeof EN) });
}

/** A whisper just bought becomes her mark (the first look at the state only learns what she had). */
let heard: Set<string> | null = null;
export function noteHearsay(self: PrivateState | null): void {
  const list = self?.hearsay ?? [];
  if (!heard) {
    heard = new Set(list.map((h) => h.id));
    return;
  }
  for (const h of list) {
    if (heard.has(h.id)) continue;
    heard.add(h.id);
    setWaypoint({ x: h.x, y: h.y });
  }
}

// ------------------------------------------------------------------ 15. repairs at sea and in port

/** The yard's repair card, with the carpenters' way at sea set beside it. */
export function repairCompare(view: PortView): string {
  const r = view.seaRepair;
  if (!r) return '';
  return `<div class="rep-cmp"><div class="rep-way sea"><div class="rep-h"><b>${icon('good_planks', '', 'ico-sm')}${esc(L('rep.sea'))}</b><span class="tag">${esc(L('rep.slow'))}</span></div>
      <p>${esc(L('rep.seaText', { hull: num1(r.hullPerMin), sails: num1(r.sailsPerMin) }))}</p>${r.minutes ? `<p class="muted">${esc(L('rep.seaNeeds', { min: r.minutes, planks: r.planks, cloth: r.cloth, hp: r.havePlanks, hc: r.haveCloth }))}</p>` : ''}</div>
    <div class="rep-way port"><div class="rep-h"><b>${icon('anchor', '', 'ico-sm')}${esc(L('rep.port'))}</b><span class="tag tag-gold">${esc(L('rep.fast'))}</span></div><p>${esc(L('rep.portText'))}</p></div></div>`;
}

/** The carpenters' state for the action bar (docs/16 #15): whether she is hurt enough to mend, whether the hold has
 *  what it takes, and the muted line of their pace (or of what they lack). The button itself is the bar's. */
export function repairState(self: PrivateState, you: { hull: number; hullMax: number; sails: number; sailsMax: number; combat?: boolean; flags: number }, repairing: boolean): { hurt: boolean; short: boolean; line: string } | null {
  const r = self.seaRepair;
  if (!r || self.dockedAt) return null;
  const hurt = you.hull < you.hullMax * 0.97 || you.sails < you.sailsMax * 0.95;
  const short = r.havePlanks < Math.min(1, r.planks) && r.haveCloth < Math.min(1, r.cloth);
  let line = '';
  if (repairing) line = esc(L('rep.working', { rate: num1(r.hullPerMin), min: r.minutes, planks: r.havePlanks, cloth: r.haveCloth }));
  else if (hurt && short && !you.combat) line = esc(L('rep.short', { planks: r.havePlanks, need: r.planks, cloth: r.haveCloth, needc: r.cloth }));
  return { hurt, short, line };
}

// ------------------------------------------------------------------ the buttons

export function dealingsAct(d: DOMStringMap, root: HTMLElement, send: (m: ClientMsg) => void): void {
  switch (d.dl) {
    case 'run_accept':
      return send({ t: 'run', action: 'accept', id: d.id! });
    case 'run_abandon':
      return send({ t: 'run', action: 'abandon', id: d.id! });
    case 'hs_buy':
      return send({ t: 'hearsay', action: 'buy', id: d.id! });
    case 'hs_forget':
      return send({ t: 'hearsay', action: 'forget', id: d.id! });
    case 'hs_mark':
      setWaypoint({ x: Number(d.x), y: Number(d.y) });
      return;
    case 'au_bid': {
      const v = Number(root.querySelector<HTMLInputElement>(`[data-aubid="${CSS.escape(d.id!)}"]`)?.value ?? 0);
      return send({ t: 'auction', action: 'bid', id: d.id!, amount: Math.floor(v) });
    }
    case 'au_put': {
      const uid = Number(root.querySelector<HTMLSelectElement>('[data-auitem]')?.value);
      const reserve = Number(root.querySelector<HTMLInputElement>('[data-aureserve]')?.value ?? 0);
      if (uid) send({ t: 'auction', action: 'sell', uid, reserve: Math.round(reserve) });
      return;
    }
  }
}

/** The put-up form's reserve follows the piece chosen. */
export function bindDealings(root: HTMLElement): void {
  const it = root.querySelector<HTMLSelectElement>('[data-auitem]');
  if (it) it.onchange = () => {
    const v = it.selectedOptions[0]?.dataset.reserve;
    const inp = root.querySelector<HTMLInputElement>('[data-aureserve]');
    if (v && inp) inp.value = v;
  };
}
