// Letters of marque on the client (docs/12 P10 #15): the office of a port's flag (enlisting, the rank and its merit,
// the day's pay, the fleet order, the livery, the quartermaster's stores) and the order's panel at sea.

import { RANKS, RANK_MERIT, RANK_PAY, SERVICES } from '../../../shared/src/data/marque.ts';
import { SLOT_NAMES, itemSlot } from '../../../shared/src/data/items.ts';
import { compassPoint } from '../../../shared/src/data/companions.ts';
import type { ClientMsg, ServicePortView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';
import { coloured, itemCardHtml, itemIcon } from './gear.ts';

const L = dict({
  title: 'Letter of marque',
  offer: '{service} takes captains into its service here.',
  text: 'Ranks from midshipman to commodore, a day’s pay in the service’s ports, fleet orders to be done by sunset, the quartermaster’s stores and the service’s livery for her ship. Fire on your own flag, or turn outlaw under a lawful one, and the letter is taken away.',
  enlist: 'Enter the service',
  rank: '{rank} · merit {m}',
  next: 'Next rank at {n} merit',
  top: 'The highest rank.',
  pay: 'Pay: {n} a day',
  paid: 'Today’s pay is drawn.',
  payHere: 'Pay is drawn at any port of the service.',
  order: 'Fleet order',
  none: 'No order in hand.',
  take: 'Take an order',
  takeHere: 'Orders are given at the service’s ports.',
  left: '{n}/{need} · sunset in {m} min',
  livery: 'Fly the livery',
  resign: 'Leave the service',
  store: 'Quartermaster',
  storeText: 'Pieces for your rank, bound to you, at the service’s price.',
  sold: 'Sold',
  buy: 'Buy',
  panel: 'Order',
  dist: '{m} m to the {dir}',
  sunset: 'sunset in {m} min',
}, {
  title: 'Каперский патент',
  offer: '{service} принимает здесь капитанов на службу.',
  text: 'Чины от мичмана до коммодора, жалованье в портах службы, флотские приказы «до заката», склад интенданта и цвета службы для корабля. Поднимете оружие на свой флаг или станете преступником под законным — патент отберут.',
  enlist: 'Поступить на службу',
  rank: '{rank} · заслуги {m}',
  next: 'Следующий чин — при {n} заслуг',
  top: 'Высший чин.',
  pay: 'Жалованье: {n} в день',
  paid: 'Жалованье за сегодня получено.',
  payHere: 'Жалованье выдают в любом порту службы.',
  order: 'Флотский приказ',
  none: 'Приказа нет.',
  take: 'Взять приказ',
  takeHere: 'Приказы выдают в портах службы.',
  left: '{n}/{need} · до заката {m} мин',
  livery: 'Поднять цвета службы',
  resign: 'Уйти со службы',
  store: 'Интендант',
  storeText: 'Вещи по вашему чину, привязанные к вам, по цене службы.',
  sold: 'Продано',
  buy: 'Купить',
  panel: 'Приказ',
  dist: '{m} м на {dir}',
  sunset: 'до заката {m} мин',
});

const ru = () => (lang() === 'ru' ? 1 : 0);

function minutesLeft(state: ClientState, until: number): number {
  return Math.max(0, Math.ceil((until - state.estServerTime()) / Math.max(0.01, state.timeScale) / 60));
}

/** The office of this port's flag. */
export function serviceCard(state: ClientState, v: ServicePortView | undefined): string {
  const self = state.self;
  if (!self || !v) return '';
  const sv = self.service ?? null;
  if (!sv) {
    if (!v.offer) return '';
    const def = SERVICES[v.offer];
    return `<div class="card mq-card"><h4 class="card-h">${icon(`service_${v.offer}`, '', 'ico-md') || icon(`faction_${v.offer}`, '', 'ico-md')}${esc(L('title'))}</h4>
      <p>${esc(L('offer', { service: def.name[ru()] }))}</p><p class="muted">${esc(L('text'))}</p>
      <p class="muted">${RANKS.map((r, i) => `${esc(r[ru()])} — ${money(RANK_PAY[i])}`).join(' · ')}</p>
      ${v.blocked ? `<p class="refit-why">${esc(serverText(v.blocked))}</p>` : ''}
      <button class="btn btn-primary" data-act="service" data-sact="enlist" ${v.blocked ? 'disabled' : ''}>${esc(L('enlist'))}</button></div>`;
  }
  const def = SERVICES[sv.id];
  const here = v.offer === sv.id;
  const nextM = RANK_MERIT[sv.rank + 1];
  const pct = nextM ? Math.min(100, Math.round(((sv.merit - RANK_MERIT[sv.rank]) / (nextM - RANK_MERIT[sv.rank])) * 100)) : 100;
  const o = sv.order;
  const order = o
    ? `<p>${esc(serverText(o.text))}</p><p class="muted mq-left">${esc(L('left', { n: o.n, need: o.need, m: minutesLeft(state, o.until) }))}</p>`
    : `<p class="muted">${esc(L('none'))}</p>${here ? `<button class="btn btn-small btn-primary" data-act="service" data-sact="order">${esc(L('take'))}</button>` : `<p class="muted">${esc(L('takeHere'))}</p>`}`;
  const store = here && v.wares.length ? `<div class="giver-h">${esc(L('store'))}</div><p class="muted">${esc(L('storeText'))}</p>
    <div class="mq-wares">${v.wares.map((w, i) => `<details class="mq-ware"><summary>${itemIcon(w.item, itemSlot(w.item))}<span class="gs-t">${coloured(w.item)}<span class="muted gs-sub">${esc(SLOT_NAMES[itemSlot(w.item)][ru()])} · ⚓${w.item.ilvl}</span></span>
      ${w.sold ? `<span class="muted mq-sold">${esc(L('sold'))}</span>` : `<button class="btn btn-small" data-act="service" data-sact="buy" data-i="${i}" ${self.gold < w.price ? 'disabled' : ''}>${money(w.price)}</button>`}</summary>${itemCardHtml(w.item)}</details>`).join('')}</div>` : '';
  return `<div class="card mq-card"><h4 class="card-h">${icon(`service_${sv.id}`, '', 'ico-md') || icon(`faction_${sv.id}`, '', 'ico-md')}${esc(def.name[ru()])}</h4>
    <p class="mq-rank"><b>${esc(L('rank', { rank: RANKS[sv.rank][ru()], m: sv.merit }))}</b></p>
    <div class="st-bar mq-bar"><i style="width:${pct}%"></i></div>
    <p class="muted">${esc(nextM ? L('next', { n: nextM }) : L('top'))}</p>
    <p>${esc(L('pay', { n: RANK_PAY[sv.rank] }))} · <span class="muted">${esc(here && !v.payReady ? L('paid') : L('payHere'))}</span></p>
    <div class="giver-h">${esc(L('order'))}</div>${order}
    <div class="mq-acts">${state.self?.dockedAt ? `<button class="btn btn-small" data-act="service" data-sact="livery">${esc(L('livery'))}</button>` : ''}<button class="btn btn-small btn-danger" data-act="service" data-sact="resign">${esc(L('resign'))}</button></div>
    ${store}</div>`;
}

/** The order's panel at sea: what, how far along, which way, and the sunset. */
export function orderPanel(state: ClientState): string | null {
  const o = state.self?.service?.order, own = state.ownDisplay;
  if (!o || !own || state.self?.dockedAt) return null;
  let tx = o.x, ty = o.y;
  if (o.marks?.length) {
    const m = [...o.marks].sort((a, b) => Math.hypot(a[0] - own.x, a[1] - own.y) - Math.hypot(b[0] - own.x, b[1] - own.y))[0];
    [tx, ty] = m;
  }
  const d = Math.hypot(tx - own.x, ty - own.y);
  const dir = compassPoint(tx - own.x, ty - own.y)[ru()];
  return `<div class="fp-head"><b>${icon('map_contract', '', 'ico-sm')}${esc(L('panel'))}</b><span class="hp-lvl">${o.n}/${o.need}</span></div>
    <div class="rg-next">${esc(serverText(o.text))}</div>
    <div class="mq-where">${o.kind === 'hunt' ? '' : `${esc(L('dist', { m: Math.round(d / 10) * 10, dir }))} · `}${esc(L('sunset', { m: minutesLeft(state, o.until) }))}</div>`;
}

export function sendService(send: (m: ClientMsg) => void, act: string, i?: number): void {
  if (act === 'buy') send({ t: 'service', action: 'buy', index: Number(i) });
  else send({ t: 'service', action: act as 'enlist' });
}
