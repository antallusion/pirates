// The Floating Bazaar on the client (docs/12 P10 #19): in a port's market, the other captains' stalls (buy from them),
// and her own — open one here, set out goods from her hold and pieces from her locker at her prices, take them back,
// close it; where it stands if it is elsewhere.

import { STALL_FEE, STALL_GOODS, STALL_ITEMS } from '../../../shared/src/data/bazaar.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SLOT_NAMES, itemName, itemSlot, itemValue } from '../../../shared/src/data/items.ts';
import type { BazaarStallView, ClientMsg, PortView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';
import { coloured, itemCardHtml, itemIcon } from './gear.ts';
import { placeName } from './maps.ts';
import { personName } from '../lang/names.ts';

const L = dict({
  title: 'The Floating Bazaar',
  text: 'Open a stall on your ship here and set out goods and pieces at your own prices. When you sail, a shadow of your ship with a signboard stays at the anchorage; the captains in port buy from it, and your takings follow you by letter (the harbour keeps 5%). A stall stands a week.',
  open: 'Open a stall here',
  elsewhere: 'Your stall stands at {port} (taken so far {sold}).',
  stall: '{name}’s stall — “{ship}”',
  mineTitle: 'Your stall',
  days: '{n} d left',
  empty: 'Nothing set out.',
  none: 'No other stalls in this port.',
  buy: 'Buy',
  take: 'Take back',
  close: 'Close the stall',
  addGood: 'Set out goods',
  addItem: 'Set out a piece',
  qty: 'Qty',
  price: 'Price',
  each: 'each',
  put: 'Set out',
  noGoods: 'Nothing in the hold.',
  noItems: 'No piece to sell (bound ones are not for sale).',
  sold: 'Taken so far: {n}',
}, {
  title: 'Плавучий базар',
  text: 'Откройте лавку на своём корабле здесь и выставьте товары и вещи по своим ценам. Когда уйдёте в море, на рейде останется тень вашего корабля с вывеской; капитаны в порту покупают у неё, а выручка идёт за вами письмом (гавань берёт 5%). Лавка стоит неделю.',
  open: 'Открыть лавку здесь',
  elsewhere: 'Ваша лавка стоит в порту {port} (выручено {sold}).',
  stall: 'Лавка капитана {name} — «{ship}»',
  mineTitle: 'Ваша лавка',
  days: 'ещё {n} дн.',
  empty: 'Пока ничего не выставлено.',
  none: 'Других лавок в этом порту нет.',
  buy: 'Купить',
  take: 'Забрать',
  close: 'Закрыть лавку',
  addGood: 'Выставить товар',
  addItem: 'Выставить вещь',
  qty: 'Кол-во',
  price: 'Цена',
  each: 'за ед.',
  put: 'Выставить',
  noGoods: 'В трюме пусто.',
  noItems: 'Нечего продать (привязанные вещи не продаются).',
  sold: 'Выручено: {n}',
});

const ru = () => (lang() === 'ru' ? 1 : 0);

function lines(st: BazaarStallView, own: boolean): string {
  const goods = st.goods.map((g, i) => `<div class="bz-line">${icon(`good_${g.good}`, '', 'ico-sm')}<span class="bz-name">${esc(GOODS[g.good].name)} <span class="muted">× ${g.qty}</span></span>
    <span class="bz-price">${money(g.price)} <span class="muted">${esc(L('each'))}</span></span>
    ${own ? `<button class="btn btn-small" data-act="bz" data-bz="remove" data-kind="good" data-i="${i}">${esc(L('take'))}</button>`
      : `<span class="bz-buy">${[1, 10].filter((n) => n <= g.qty || n === 1).map((n) => `<button class="btn btn-small" data-act="bz" data-bz="buy" data-owner="${st.owner}" data-kind="good" data-i="${i}" data-n="${n}">×${n}</button>`).join('')}</span>`}</div>`).join('');
  const items = st.items.map((it, i) => `<details class="bz-item"><summary>${itemIcon(it.item, itemSlot(it.item), 'ico-sm')}<span class="bz-name">${coloured(it.item)} <span class="muted">${esc(SLOT_NAMES[itemSlot(it.item)][ru()])} · ⚓${it.item.ilvl}</span></span>
    <span class="bz-price">${money(it.price)}</span>
    ${own ? `<button class="btn btn-small" data-act="bz" data-bz="remove" data-kind="item" data-i="${i}">${esc(L('take'))}</button>`
      : `<button class="btn btn-small" data-act="bz" data-bz="buy" data-owner="${st.owner}" data-kind="item" data-i="${i}" data-n="1">${esc(L('buy'))}</button>`}</summary>${itemCardHtml(it.item)}</details>`).join('');
  return goods + items || `<p class="muted">${esc(L('empty'))}</p>`;
}

/** The market's card of the bazaar. */
export function bazaarCard(state: ClientState, view: PortView): string {
  const self = state.self;
  const bz = view.bazaar;
  if (!self || !bz) return '';
  const others = bz.stalls.length
    ? bz.stalls.map((st) => `<div class="bz-stall"><div class="bz-head"><b>${esc(L('stall', { name: personName(st.name), ship: placeName(st.ship) }))}</b><span class="muted">${esc(L('days', { n: st.daysLeft }))}</span></div>${lines(st, false)}</div>`).join('')
    : `<p class="muted">${esc(L('none'))}</p>`;
  let mine = '';
  if (bz.mine) {
    const st = bz.mine;
    const hold = (Object.keys(self.cargo) as GoodId[]).filter((g) => Math.floor(self.cargo[g] ?? 0) >= 1 && GOODS[g]);
    const sell = new Map(view.market.map((r) => [r.good, r.sell]));
    const locker = self.stash.filter((it) => !it.bound);
    mine = `<div class="bz-stall bz-mine"><div class="bz-head"><b>${esc(L('mineTitle'))}</b><span class="muted">${esc(L('sold', { n: st.sold }))} · ${esc(L('days', { n: st.daysLeft }))}</span></div>${lines(st, true)}
      ${st.goods.length < STALL_GOODS ? (hold.length ? `<div class="bz-form"><span class="giver-h">${esc(L('addGood'))}</span>
        <select data-bzgood>${hold.map((g) => `<option value="${g}" data-price="${Math.max(1, Math.round((sell.get(g) ?? GOODS[g].basePrice) * 1.15))}">${esc(GOODS[g].name)} (${Math.floor(self.cargo[g] ?? 0)})</option>`).join('')}</select>
        <label>${esc(L('qty'))} <input class="field" type="number" min="1" data-bzqty value="10"></label>
        <label>${esc(L('price'))} <input class="field" type="number" min="1" data-bzprice value="${Math.max(1, Math.round((sell.get(hold[0]) ?? GOODS[hold[0]].basePrice) * 1.15))}"></label>
        <button class="btn btn-small btn-primary" data-act="bz" data-bz="add_good">${esc(L('put'))}</button></div>` : `<p class="muted">${esc(L('noGoods'))}</p>`) : ''}
      ${st.items.length < STALL_ITEMS ? (locker.length ? `<div class="bz-form"><span class="giver-h">${esc(L('addItem'))}</span>
        <select data-bzitem>${locker.map((it) => `<option value="${it.uid}" data-price="${Math.round(itemValue(it) * 0.6)}">${esc(itemName(it, ru() === 1))} · ⚓${it.ilvl}</option>`).join('')}</select>
        <label>${esc(L('price'))} <input class="field" type="number" min="1" data-bzitemprice value="${Math.round(itemValue(locker[0]) * 0.6)}"></label>
        <button class="btn btn-small btn-primary" data-act="bz" data-bz="add_item">${esc(L('put'))}</button></div>` : `<p class="muted">${esc(L('noItems'))}</p>`) : ''}
      <div class="bz-foot"><button class="btn btn-small btn-danger" data-act="bz" data-bz="close">${esc(L('close'))}</button></div></div>`;
  } else if (bz.elsewhere) {
    mine = `<p class="bz-else">${esc(L('elsewhere', { port: placeName(state.ports.find((p) => p.id === bz.elsewhere!.port)?.name ?? bz.elsewhere.port), sold: bz.elsewhere.sold }))}</p>`;
  } else {
    mine = `<button class="btn btn-small btn-primary" data-act="bz" data-bz="open" ${self.gold < STALL_FEE ? 'disabled' : ''}>${esc(L('open'))} — ${money(STALL_FEE)}</button>`;
  }
  return `<div class="card bz-card"><h4 class="card-h">${icon('tab_tavern', '', 'ico-md')}${esc(L('title'))}</h4><p class="muted">${esc(L('text'))}</p>${mine}${others}</div>`;
}

/** A bazaar button: what it sends (the forms read from the card). */
export function bazaarAct(d: DOMStringMap, root: HTMLElement, send: (m: ClientMsg) => void): void {
  const num = (sel: string) => Number(root.querySelector<HTMLInputElement>(sel)?.value ?? 0);
  switch (d.bz) {
    case 'open': return send({ t: 'bazaar', action: 'open' });
    case 'close': return send({ t: 'bazaar', action: 'close' });
    case 'remove': return send({ t: 'bazaar', action: 'remove', kind: d.kind === 'item' ? 'item' : 'good', index: Number(d.i) });
    case 'buy': return send({ t: 'bazaar', action: 'buy', owner: Number(d.owner), kind: d.kind === 'item' ? 'item' : 'good', index: Number(d.i), qty: Number(d.n) });
    case 'add_good': {
      const g = root.querySelector<HTMLSelectElement>('[data-bzgood]')?.value as GoodId | undefined;
      if (g) send({ t: 'bazaar', action: 'add_good', good: g, qty: num('[data-bzqty]'), price: num('[data-bzprice]') });
      return;
    }
    case 'add_item': {
      const uid = Number(root.querySelector<HTMLSelectElement>('[data-bzitem]')?.value);
      if (uid) send({ t: 'bazaar', action: 'add_item', uid, price: num('[data-bzitemprice]') });
      return;
    }
  }
}

/** The forms' suggested prices follow the chosen good or piece. */
export function bindBazaar(root: HTMLElement): void {
  const g = root.querySelector<HTMLSelectElement>('[data-bzgood]');
  if (g) g.onchange = () => {
    const p = g.selectedOptions[0]?.dataset.price;
    const inp = root.querySelector<HTMLInputElement>('[data-bzprice]');
    if (p && inp) inp.value = p;
  };
  const it = root.querySelector<HTMLSelectElement>('[data-bzitem]');
  if (it) it.onchange = () => {
    const p = it.selectedOptions[0]?.dataset.price;
    const inp = root.querySelector<HTMLInputElement>('[data-bzitemprice]');
    if (p && inp) inp.value = p;
  };
}
