// Before setting sail (owner, 2026-09-30: «in ports I don't understand how to buy food; before going out to sea
// there should be hints saying what is missing for a full normal voyage and offering to buy more»; 2026-10-09: «не
// прям автодокупку, а при выходе из порта должно показываться окошко где будет сказано что нужно докупить чтобы
// отправиться в море нормально»): when the captain casts off with something short — provisions for the voyage, the
// repairs (the yard's, or planks and sailcloth for her carpenters when the yard is past her purse), round shot, hands —
// a window lists each with what is aboard, what a normal voyage wants, how many and their price here; a button on each
// that fits her purse, «Докупить всё» (all of it at the harbour's prices, as far as her silver goes), «Отплыть так» and
// «Остаться». Nothing is bought by itself, and nothing short is no window. Buying goes by the harbour's own orders
// (trade, hire_crew, buy_ammo, shipyard repair); the list follows the ship as it fills.

import { GOODS, walkBuyCost } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { VOYAGE_MINUTES, foodMinutes, voyageNeeds, voyageStores } from '../../../shared/src/data/voyage.ts';
import type { VoyageNeed, VoyageShip } from '../../../shared/src/data/voyage.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { cargoVolume, tx } from '../../../shared/src/sim/shipstats.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/port.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { buttonHtml } from './kit/button.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';

const L = dict(EN, RU);

/** The ship as the voyage reckoning wants her, from what the client knows. */
export function voyageShip(state: ClientState): VoyageShip | null {
  const self = state.self, st = state.ownStats, you = state.you;
  if (!self || !st) return null;
  const used = cargoVolume(self.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
  return {
    crew: self.crew, crewMin: st.crewMin, crewMax: st.crewMax, provisions: self.cargo.provisions ?? 0, provisionUse: st.provisionUse,
    holdVolume: st.holdVolume, holdFree: st.holdVolume - used, provisionVolume: GOODS.provisions.volume * st.provisionVolumeMul,
    roundShot: self.ammo.round ?? 0, gunsPerSide: st.gunsPerSide,
    hull: you?.hull ?? 1, hullMax: you?.hullMax ?? 1, sails: you?.sails ?? 1, sailsMax: you?.sailsMax ?? 1,
  };
}

/** One shortage as the harbour can meet it: how many (`n`, 0 when the harbour has none to sell her), their price, the
 *  orders that buy them — and, for a part of them (what her purse reaches), `price(k)` and `orders(k)` by steps of
 *  `step`. Repairs are the yard's whole mending (`via: 'yard'`, all or nothing) with the carpenters' planks and
 *  sailcloth as `alt` (`via: 'stores'`), bought when the yard is past her purse. */
export interface Offer {
  need: VoyageNeed;
  n: number;
  cost: number;
  msgs: ClientMsg[];
  step: number;
  price: (k: number) => number;
  orders: (k: number) => ClientMsg[];
  /** The hold's room `k` of them take (m³; 0 for the hands, the shot, the yard). */
  vol: (k: number) => number;
  via?: 'yard' | 'stores';
  /** The stores' planks and sailcloth (via 'stores'). */
  stores?: { planks: number; cloth: number };
  alt?: Offer | null;
}

/** An offer of `n` with its price and orders by the step. */
function offer(need: VoyageNeed, n: number, step: number, price: (k: number) => number, orders: (k: number) => ClientMsg[], extra: Partial<Offer> = {}): Offer {
  const k = Math.max(0, n);
  return { need, n: k, cost: k > 0 ? price(k) : 0, msgs: k > 0 ? orders(k) : [], step, price, orders, vol: () => 0, ...extra };
}

/** The room a good takes in her hold, a unit (m³, as the server reckons it: cargoVolume). */
function unitVol(state: ClientState, good: GoodId): number {
  const st = state.ownStats;
  const g = GOODS[good];
  return g.volume * (good === 'planks' || good === 'sailcloth' ? st?.materialVolumeMul ?? 1 : good === 'provisions' ? st?.provisionVolumeMul ?? 1 : 1);
}

/** The free room in her hold now (m³). */
export function holdRoom(state: ClientState): number {
  const ship = voyageShip(state);
  return ship ? Math.max(0, ship.holdFree) : 0;
}

/** The harbour's market row for a good, if it sells it. */
function row(state: ClientState, good: GoodId) {
  const r = state.portView?.market.find((x) => x.good === good);
  return r && r.stock > 0 ? r : null;
}

/** The planks and sailcloth for her carpenters as the harbour can sell them. */
function storesOffer(need: VoyageNeed, state: ClientState): Offer | null {
  const you = state.you, st = state.ownStats, self = state.self;
  if (!you || !st || !self) return null;
  const want = voyageStores({ hull: you.hull, hullMax: you.hullMax, sails: you.sails, sailsMax: you.sailsMax, rudderHp: you.rudderHp, use: 1 + tx(st, 'materialUse'), planks: self.cargo.planks ?? 0, cloth: self.cargo.sailcloth ?? 0 });
  const p = row(state, 'planks'), c = row(state, 'sailcloth');
  const planks = p ? Math.min(want.planks, p.stock) : 0, cloth = c ? Math.min(want.cloth, c.stock) : 0;
  if (planks + cloth <= 0) return null;
  // A part of them: the planks and the bolts in the same proportion, k of the whole by its count.
  const total = planks + cloth;
  const split = (k: number) => {
    const pk = Math.min(planks, Math.round((k * planks) / total));
    return { pk, ck: Math.min(cloth, k - pk) };
  };
  const price = (k: number) => {
    const { pk, ck } = split(k);
    return (pk > 0 && p ? walkBuyCost('planks', p.buy, p.stock, pk) : 0) + (ck > 0 && c ? walkBuyCost('sailcloth', c.buy, c.stock, ck) : 0);
  };
  const orders = (k: number): ClientMsg[] => {
    const { pk, ck } = split(k);
    return [...(pk > 0 ? [{ t: 'trade', good: 'planks', qty: pk } as ClientMsg] : []), ...(ck > 0 ? [{ t: 'trade', good: 'sailcloth', qty: ck } as ClientMsg] : [])];
  };
  const vp = unitVol(state, 'planks'), vc = unitVol(state, 'sailcloth');
  const vol = (k: number) => {
    const { pk, ck } = split(k);
    return pk * vp + ck * vc;
  };
  return offer(need, total, 1, price, orders, { via: 'stores', stores: { planks, cloth }, vol });
}

function offerOf(need: VoyageNeed, state: ClientState): Offer {
  const view = state.portView;
  switch (need.kind) {
    case 'food': {
      const r = row(state, 'provisions');
      const v = unitVol(state, 'provisions');
      return offer(need, r ? Math.min(need.buy, r.stock) : 0, 1, (k) => (r ? walkBuyCost('provisions', r.buy, r.stock, k) : 0), (k) => [{ t: 'trade', good: 'provisions', qty: k }], { vol: (k) => k * v });
    }
    case 'crew': {
      const per = view?.crewHireCost ?? 0;
      return offer(need, Math.min(need.buy, view?.crewAvailable ?? 0), 1, (k) => Math.ceil(per * k), (k) => [{ t: 'hire_crew', qty: k, prof: 'sailor' }]);
    }
    case 'ammo': {
      const per = view?.ammoPrices.round ?? 0;
      return offer(need, per > 0 ? need.buy : 0, 10, (k) => Math.ceil(per * k), (k) => [{ t: 'buy_ammo', ammo: 'round', qty: k }]);
    }
    case 'repair': {
      const cost = view?.shipyard.repairCost ?? 0;
      return offer(need, cost > 0 ? 1 : 0, 1, () => cost, () => [{ t: 'shipyard', action: 'repair' }], { via: 'yard', alt: storesOffer(need, state) });
    }
  }
}

/** What a voyage wants, as this harbour can meet it (in the order a voyage needs it: food, repairs, shot, hands). */
export function departOffers(state: ClientState): Offer[] {
  const ship = voyageShip(state);
  if (!ship || !state.portView) return [];
  const order = ['food', 'repair', 'ammo', 'crew'];
  const needs = voyageNeeds(ship);
  // The provisions for the hands she would hire here too (the hands hired, the food wanted grows: «Докупить всё» left
  // four barrels short of it).
  const crew = needs.find((n) => n.kind === 'crew');
  const hire = crew ? Math.min(crew.buy, state.portView.crewAvailable ?? 0) : 0;
  const food = hire > 0 ? voyageNeeds({ ...ship, crew: ship.crew + hire }).find((n) => n.kind === 'food') : undefined;
  const list = food ? [...needs.filter((n) => n.kind !== 'food'), food] : needs;
  return list.map((n) => offerOf(n, state)).sort((a, b) => order.indexOf(a.need.kind) - order.indexOf(b.need.kind));
}

/** The most of an offer within `left` silver and `room` m³ of the hold: all of it, a part by its steps, the stores for
 *  a yard past the purse, or null. */
export function fitOffer(o: Offer, left: number, room = Infinity): Offer | null {
  if (o.n <= 0) return o.alt ? fitOffer(o.alt, left, room) : null;
  const ok = (k: number) => o.price(k) <= left && o.vol(k) <= room + 1e-6;
  if (ok(o.n)) return o;
  if (o.via === 'yard') return o.alt ? fitOffer(o.alt, left, room) : null;
  // A part: the most steps the purse and the hold take (price and room only grow with the count).
  let lo = 0, hi = Math.floor(o.n / o.step);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ok(mid * o.step)) lo = mid;
    else hi = mid - 1;
  }
  const k = lo * o.step;
  return k > 0 ? { ...o, n: k, cost: o.price(k), msgs: o.orders(k) } : null;
}

/** An offer whole: itself, or the stores where the harbour has no yard to mend her. */
const wholeOf = (o: Offer): Offer | null => (o.n > 0 ? o : o.alt ?? null);

/** «Докупить всё» (owner, 2026-10-09): everything short at the harbour's prices, in the order a voyage needs it, as far
 *  as her silver goes — a part where the whole does not fit, the carpenters' stores where the yard does not. `all`:
 *  every one of them whole (the yard for the repairs). */
export function departPlan(offers: Offer[], gold: number, room = Infinity): { buy: Offer[]; cost: number; all: boolean } {
  let left = Math.max(0, gold), space = room;
  const buy: Offer[] = [];
  let all = true;
  for (const o of offers) {
    const whole = wholeOf(o);
    if (!whole) continue; // none to be had here: not hers to buy
    const f = fitOffer(o, left, space);
    if (f !== whole) all = false;
    if (!f) continue;
    buy.push(f);
    left -= f.cost;
    space -= f.vol(f.n);
  }
  return { buy, cost: Math.max(0, gold) - left, all };
}

/** The harbour's one-tap orders for some of what a voyage wants (docs/23 item 66: «Припасы» buys the food and the
 *  round shot; the market's «Починить» and «Нанять» the rest): how many, the price, the orders. */
export function voyageOrder(state: ClientState, kinds: VoyageNeed['kind'][]): { n: number; cost: number; msgs: ClientMsg[] } {
  const offers = departOffers(state).filter((x) => kinds.includes(x.need.kind));
  return { n: offers.reduce((a, o) => a + o.n, 0), cost: offers.reduce((a, o) => a + o.cost, 0), msgs: offers.flatMap((o) => o.msgs) };
}

/** A row of the window: what is short and why, and its button — the whole of it, or the part her purse and her hold
 *  reach; else why not (no silver, no room, none here). */
function rowHtml(o: Offer, i: number, state: ClientState): string {
  const n = o.need;
  const crew = state.self?.crew ?? 0;
  const gold = state.self?.gold ?? 0;
  const room = holdRoom(state);
  const f = fitOffer(o, gold, room);
  let ico = '', title = '', line = '', none = '';
  switch (n.kind) {
    case 'food': {
      const left = L('depart.foodLeft', { n: Math.max(0, Math.floor(foodMinutes(n.have, crew, state.ownStats?.provisionUse ?? 1))) });
      ico = 'good_provisions';
      title = L('depart.food');
      line = n.have <= 0 ? L('depart.foodNone', { want: n.want }) : L('depart.foodLine', { have: n.have, left, want: n.want });
      none = n.buy <= 0 ? L('depart.foodNoRoom') : L('depart.notSold');
      break;
    }
    case 'crew':
      ico = 'stat_crew';
      title = L('depart.crew');
      line = L('depart.crewLine', { have: n.have, want: n.want });
      none = L('depart.noHands');
      break;
    case 'ammo':
      ico = 'ammo_round';
      title = L('depart.ammo');
      line = L('depart.ammoLine', { have: n.have, want: n.want });
      none = L('depart.notSold');
      break;
    case 'repair': {
      ico = 'good_planks';
      title = L('depart.repair');
      line = L('depart.repairLine', { hull: Math.round(n.hull * 100), sails: Math.round(n.sails * 100) });
      // The yard past her purse (or none here): the planks and sailcloth her carpenters mend her with at sea.
      if (f?.via === 'stores' && f.stores) {
        const what = [f.stores.planks > 0 ? L('depart.planksN', { n: f.stores.planks }) : '', f.stores.cloth > 0 ? L('depart.clothN', { n: f.stores.cloth }) : ''].filter(Boolean).join(', ');
        line += ` · ${o.n > 0 ? `${L('depart.yardDear', { yard: fmt(o.cost) })}; ` : ''}${L('depart.storesLine', { what })}`;
      }
      none = L('depart.notSold');
      break;
    }
  }
  const label = !f ? '' : f.via === 'yard' ? L('depart.mend') : f.via === 'stores' ? L('depart.stores') : n.kind === 'crew' ? L('depart.hireN', { n: f.n }) : L('depart.buyN', { n: f.n });
  const why = !wholeOf(o) ? none : fitOffer(o, gold) ? L('depart.foodNoRoom') : L('depart.noSilver');
  const act = f ? `<button type="button" class="btn btn-small dp-buy${f !== wholeOf(o) ? ' dp-part' : ''}" data-dp="${i}">${esc(label)} · ${money(f.cost)}</button>` : `<span class="muted dp-none">${esc(why)}</span>`;
  return `<div class="dp-row" data-kind="${n.kind}">${icon(ico, '', 'ico-md')}<div class="dp-text"><b>${esc(title)}</b><span class="muted">${esc(line)}</span></div>${act}</div>`;
}

let openSheetHandle: SheetHandle | null = null;

/** Casting off: straight away when all is aboard, else the window of what is short first (the kit's bottom sheet,
 *  docs/23 phase 1): the list, and its three buttons at the foot. Nothing is bought unless she says so. */
export function departOrAsk(state: ClientState, send: (m: ClientMsg) => void, go: () => void): void {
  const ship = voyageShip(state);
  // The First Watch sails a mile off the quay and is towed home if it goes wrong (docs/23 item 79): no list to read
  // between «Поднять паруса» and the sea — the 2026-10-06 newcomer's run stopped on it.
  if (!ship || !state.portView || !voyageNeeds(ship).length || state.onboarding?.stage) return go();
  openSheetHandle?.close('code');
  let offers: Offer[] = [];
  let lastBody = '', lastFoot = '';
  const sheet = openSheet({
    id: 'confirm', cls: 'confirm-panel depart-panel', role: 'alertdialog', height: 'auto', noClose: true, labelledBy: 'dp-title', body: '', foot: '',
    onClose: () => {
      clearInterval(timer);
      if (openSheetHandle === sheet) openSheetHandle = null;
    },
  });
  openSheetHandle = sheet;
  const draw = () => {
    if (!state.self?.dockedAt) return sheet.close('code');
    if (!voyageShip(state)) return sheet.close('code');
    offers = departOffers(state);
    const gold = state.self.gold;
    const plan = departPlan(offers, gold, holdRoom(state));
    // (on a phone held sideways the heading, the lead and the purse's word share one line: the four rows and the foot
    // stand in one screen with nothing to scroll — owner, 2026-10-09)
    const head = `<div class="dp-head"><h3 id="dp-title" class="dp-title">${icon('stat_sails', '', 'ico-md')}${esc(L('depart.title'))}</h3>${offers.length ? `<p class="dp-lead">${esc(L('depart.lead', { min: VOYAGE_MINUTES }))}</p>` : `<p class="dp-lead dp-ok">${esc(L('depart.ready'))}</p>`}${plan.buy.length && !plan.all ? `<p class="dp-warn">${esc(L('depart.short', { gold: fmt(gold) }))}</p>` : ''}</div>`;
    const body = `${head}${offers.length ? `<div class="dp-list">${offers.map((o, i) => rowHtml(o, i, state)).join('')}</div>` : ''}`;
    const foot = `${plan.buy.length ? buttonHtml({ kind: 'primary', size: 'md', label: plan.all ? L('depart.buyAll', { cost: fmt(plan.cost) }) : L('depart.buyFit', { cost: fmt(plan.cost) }), data: { dp: 'all' } }) : ''}${buttonHtml({ kind: offers.length && plan.buy.length ? 'secondary' : 'primary', size: 'md', label: offers.length ? L('depart.sailAnyway') : L('depart.sail'), data: { dp: 'sail' } })}${buttonHtml({ kind: 'secondary', label: L('depart.stay'), data: { dp: 'stay' } })}`;
    if (body !== lastBody) {
      lastBody = body;
      sheet.body.innerHTML = body;
    }
    if (foot !== lastFoot) {
      const had = (document.activeElement as HTMLElement | null)?.dataset?.dp;
      lastFoot = foot;
      sheet.foot!.innerHTML = foot;
      if (had) sheet.foot!.querySelector<HTMLElement>(`[data-dp="${had}"]`)?.focus({ preventScroll: true });
    }
  };
  sheet.panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-dp]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    const what = b.dataset.dp!;
    if (what === 'stay') return sheet.close('button');
    if (what === 'sail') {
      sheet.close('button');
      return go();
    }
    const gold = state.self?.gold ?? 0, room = holdRoom(state);
    const list = what === 'all' ? departPlan(offers, gold, room).buy : [offers[Number(what)]].map((o) => (o ? fitOffer(o, gold, room) : null)).filter((o): o is Offer => !!o);
    for (const o of list) for (const m of o.msgs) send(m);
  });
  const timer = setInterval(draw, 400);
  draw();
  sheet.panel.querySelector<HTMLElement>('[data-dp="all"], [data-dp="0"], [data-dp="sail"]')?.focus({ preventScroll: true });
}
