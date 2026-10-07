// Before setting sail (owner, 2026-09-30: «in ports I don't understand how to buy food; before going out to sea
// there should be hints saying what is missing for a full normal voyage and offering to buy more»): when the
// captain casts off, what is short — provisions, hands, shot, repairs — each with what is aboard, what a normal
// voyage wants and its price here, a button to buy it, «Buy all», «Set sail anyway» and «Stay». Buying goes by
// the harbour's own orders (trade, hire_crew, buy_ammo, shipyard repair); the list follows the ship as it fills.

import { GOODS, walkBuyCost } from '../../../shared/src/data/goods.ts';
import { VOYAGE_MINUTES, foodMinutes, voyageNeeds } from '../../../shared/src/data/voyage.ts';
import type { VoyageNeed, VoyageShip } from '../../../shared/src/data/voyage.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
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

/** One shortage as the harbour can meet it: how many, at what price, and the orders that buy it. */
export interface Offer {
  need: VoyageNeed;
  n: number;
  cost: number;
  msgs: ClientMsg[];
}

function offerOf(need: VoyageNeed, state: ClientState): Offer {
  const view = state.portView;
  switch (need.kind) {
    case 'food': {
      const row = view?.market.find((r) => r.good === 'provisions');
      const n = row ? Math.min(need.buy, row.stock) : 0;
      return { need, n, cost: row ? walkBuyCost('provisions', row.buy, row.stock, n) : 0, msgs: n > 0 ? [{ t: 'trade', good: 'provisions', qty: n }] : [] };
    }
    case 'crew': {
      const n = Math.max(0, Math.min(need.buy, view?.crewAvailable ?? 0));
      return { need, n, cost: Math.ceil((view?.crewHireCost ?? 0) * n), msgs: n > 0 ? [{ t: 'hire_crew', qty: n, prof: 'sailor' }] : [] };
    }
    case 'ammo': {
      const price = view?.ammoPrices.round ?? 0;
      const n = price > 0 ? need.buy : 0;
      return { need, n, cost: Math.ceil(price * n), msgs: n > 0 ? [{ t: 'buy_ammo', ammo: 'round', qty: n }] : [] };
    }
    case 'repair': {
      const cost = view?.shipyard.repairCost ?? 0;
      return { need, n: cost > 0 ? 1 : 0, cost, msgs: cost > 0 ? [{ t: 'shipyard', action: 'repair' }] : [] };
    }
  }
}

/** The harbour's one-tap orders for some of what a voyage wants (docs/23 item 66: «Припасы» buys the food and the
 *  round shot; the market's «Починить» and «Нанять» the rest): how many, the price, the orders. */
export function voyageOrder(state: ClientState, kinds: VoyageNeed['kind'][]): { n: number; cost: number; msgs: ClientMsg[] } {
  const ship = voyageShip(state);
  if (!ship || !state.portView) return { n: 0, cost: 0, msgs: [] };
  const offers = voyageNeeds(ship).filter((x) => kinds.includes(x.kind)).map((x) => offerOf(x, state));
  return { n: offers.reduce((a, o) => a + o.n, 0), cost: offers.reduce((a, o) => a + o.cost, 0), msgs: offers.flatMap((o) => o.msgs) };
}

function row(o: Offer, i: number, state: ClientState): string {
  const n = o.need;
  const crew = state.self?.crew ?? 0;
  let ico = '', title = '', line = '', btn = '', none = '';
  switch (n.kind) {
    case 'food': {
      const left = L('depart.foodLeft', { n: Math.max(0, Math.floor(foodMinutes(n.have, crew, state.ownStats?.provisionUse ?? 1))) });
      ico = 'good_provisions';
      title = L('depart.food');
      line = n.have <= 0 ? L('depart.foodNone', { want: n.want, min: n.minutes }) : L('depart.foodLine', { have: n.have, left, want: n.want, min: n.minutes });
      btn = L('depart.buyN', { n: o.n });
      none = n.buy <= 0 ? L('depart.foodNoRoom') : L('depart.notSold');
      break;
    }
    case 'crew':
      ico = 'stat_crew';
      title = L('depart.crew');
      line = L('depart.crewLine', { have: n.have, want: n.want });
      btn = L('depart.hireN', { n: o.n });
      none = L('depart.noHands');
      break;
    case 'ammo':
      ico = 'ammo_round';
      title = L('depart.ammo');
      line = L('depart.ammoLine', { have: n.have, want: n.want });
      btn = L('depart.buyN', { n: o.n });
      none = L('depart.notSold');
      break;
    case 'repair':
      ico = 'good_planks';
      title = L('depart.repair');
      line = L('depart.repairLine', { hull: Math.round(n.hull * 100), sails: Math.round(n.sails * 100) });
      btn = L('depart.mend');
      none = L('depart.notSold');
      break;
  }
  const act = o.n > 0 ? `<button class="btn btn-small dp-buy" data-dp="${i}">${esc(btn)} · ${money(o.cost)}</button>` : `<span class="muted dp-none">${esc(none)}</span>`;
  return `<div class="dp-row">${icon(ico, '', 'ico-md')}<div class="dp-text"><b>${esc(title)}</b><span class="muted">${esc(line)}</span></div>${act}</div>`;
}

let openSheetHandle: SheetHandle | null = null;

/** A share of the purse the way out keeps back for the next repairs (docs/23 item 96: a newcomer's purse went whole on
 *  the voyage's stores, and every homecoming after a fight met the harbour's check with nothing to mend her with). */
export const RESERVE_SHARE = 0.25;
export const RESERVE_MIN = 60;
/** Below this share of hull or canvas, unmended, the way out asks before she sails (above it she sails as she is). */
export const ASK_BELOW = 0.5;

/** What the way out does by itself (docs/23 items 66, 96), pure: the repairs first when the purse holds them, then the
 *  food, then — keeping RESERVE_SHARE of the purse back — the shot and the hands. Asked only when what is left is
 *  grave: a hull or canvas under ASK_BELOW, or no food aboard and none bought. */
export function departPlan(offers: Offer[], gold: number): { buy: Offer[]; cost: number; short: Offer[]; ask: boolean } {
  const order = ['repair', 'food', 'ammo', 'crew'] as const;
  const sorted = [...offers].sort((a, b) => order.indexOf(a.need.kind) - order.indexOf(b.need.kind));
  const reserve = Math.max(RESERVE_MIN, Math.round(gold * RESERVE_SHARE));
  let left = gold;
  const buy: Offer[] = [], short: Offer[] = [];
  for (const o of sorted) {
    const keep = o.need.kind === 'ammo' || o.need.kind === 'crew' ? reserve : 0;
    if (o.n > 0 && o.cost <= left - keep) {
      buy.push(o);
      left -= o.cost;
    } else short.push(o);
  }
  const grave = short.some((o) => (o.need.kind === 'repair' && (o.need.hull < ASK_BELOW || o.need.sails < ASK_BELOW)) || (o.need.kind === 'food' && o.need.have <= 0));
  return { buy, cost: gold - left, short, ask: grave };
}

/** Where the way out says what it bought (main.ts gives it the HUD's toasts). */
let say: (msg: string, kind: string) => void = () => {};
export function setDepartSay(fn: (msg: string, kind: string) => void): void {
  say = fn;
}
/** The grave shortfall she last sailed with anyway, and when (the page's clock): not asked again for it for a while. */
let sailedAnyway: { key: string; at: number } | null = null;
const ASK_AGAIN_MS = 10 * 60_000;
const graveKey = (short: Offer[]) => short.map((o) => o.need.kind).sort().join(',');

function boughtLine(buy: Offer[], cost: number): string {
  const what = buy.map((o) => o.need.kind === 'repair' ? L('depart.w.repair') : L(`depart.w.${o.need.kind}`, { n: o.n })).join(', ');
  return L('depart.bought', { what, cost: fmt(cost) });
}

/** Casting off: straight away when all is aboard, else the list of what is short first — in the kit's bottom sheet
 *  (docs/23 phase 1): the list scrolls, the three buttons stay at its foot. */
export function departOrAsk(state: ClientState, send: (m: ClientMsg) => void, go: () => void): void {
  const ship = voyageShip(state);
  // The First Watch sails a mile off the quay and is towed home if it goes wrong (docs/23 item 79): no list to read
  // between «Поднять паруса» and the sea — the 2026-10-06 newcomer's run stopped on it.
  if (!ship || !state.portView || !voyageNeeds(ship).length || state.onboarding?.stage) return go();
  // docs/23 phase 6 and item 96: what a voyage wants is simply had on the way out when the purse holds it — the repairs,
  // the food, and (a quarter of the purse kept back for the next repairs) the shot and the hands — by the harbour's own
  // orders before the order to cast off, and said in one line. Only a grave shortfall is asked: a hull or canvas under
  // half unmended, no food at all — and not again for a while once she sailed anyway with it.
  const plan = departPlan(voyageNeeds(ship).map((n) => offerOf(n, state)), state.self!.gold);
  const key = graveKey(plan.short.filter((o) => o.need.kind === 'repair' || o.need.kind === 'food'));
  const askedLately = !!sailedAnyway && sailedAnyway.key === key && performance.now() - sailedAnyway.at < ASK_AGAIN_MS;
  if (!plan.ask || askedLately) {
    for (const o of plan.buy) for (const m of o.msgs) send(m);
    if (plan.buy.length) say(boughtLine(plan.buy, plan.cost), 'info');
    const mend = plan.short.find((o) => o.need.kind === 'repair' && o.n > 0);
    if (mend) say(L('depart.cantRepair', { cost: fmt(mend.cost) }), 'info');
    return go();
  }
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
    const s = voyageShip(state);
    if (!s) return sheet.close('code');
    offers = voyageNeeds(s).map((n) => offerOf(n, state));
    const total = offers.reduce((a, o) => a + o.cost, 0);
    const buyable = offers.filter((o) => o.n > 0);
    const gold = state.self.gold;
    const body = `<h3 id="dp-title" class="dp-title">${icon('stat_sails', '', 'ico-md')}${esc(L('depart.title'))}</h3>
      ${offers.length ? `<p class="dp-lead">${esc(L('depart.lead', { min: VOYAGE_MINUTES }))}</p><div class="dp-list">${offers.map((o, i) => row(o, i, state)).join('')}</div>` : `<p class="dp-lead dp-ok">${esc(L('depart.ready'))}</p>`}
      ${buyable.length && total > gold ? `<p class="dp-warn">${esc(L('depart.short', { gold: fmt(gold) }))}</p>` : ''}`;
    const foot = `${buyable.length > 1 || (buyable.length === 1 && offers.length > 1) ? buttonHtml({ kind: 'primary', size: 'md', label: L('depart.buyAll', { cost: fmt(total) }), data: { dp: 'all' } }) : ''}${buttonHtml({ kind: offers.length ? 'secondary' : 'primary', size: 'md', label: offers.length ? L('depart.sailAnyway') : L('depart.sail'), data: { dp: 'sail' } })}${buttonHtml({ kind: 'secondary', label: L('depart.stay'), data: { dp: 'stay' } })}`;
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
    if (!b) return;
    const what = b.dataset.dp!;
    if (what === 'stay') return sheet.close('button');
    if (what === 'sail') {
      sheet.close('button');
      // She chose to sail with it: that shortfall is not asked again for a while (docs/23 item 96).
      const s2 = voyageShip(state);
      if (s2 && state.self) sailedAnyway = { key: graveKey(departPlan(voyageNeeds(s2).map((n) => offerOf(n, state)), state.self.gold).short.filter((o) => o.need.kind === 'repair' || o.need.kind === 'food')), at: performance.now() };
      return go();
    }
    const list = what === 'all' ? offers : [offers[Number(what)]].filter(Boolean);
    for (const o of list) for (const m of o.msgs) send(m);
  });
  const timer = setInterval(draw, 400);
  draw();
  sheet.panel.querySelector<HTMLElement>('[data-dp="all"], [data-dp="0"], [data-dp="sail"]')?.focus({ preventScroll: true });
}
