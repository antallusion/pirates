// Before setting sail (owner, 2026-09-30: «in ports I don't understand how to buy food; before going out to sea
// there should be hints saying what is missing for a full normal voyage and offering to buy more»): when the
// captain casts off, what is short — provisions, hands, shot, repairs — each with what is aboard, what a normal
// voyage wants and its price here, a button to buy it, «Buy all», «Set sail anyway» and «Stay». Buying goes by
// the harbour's own orders (trade, hire_crew, buy_ammo, shipyard repair); the list follows the ship as it fills.

import { GOODS, walkBuyCost } from '../../../shared/src/data/goods.ts';
import { VOYAGE_MINUTES, foodMinutes, voyageFood, voyageNeeds } from '../../../shared/src/data/voyage.ts';
import type { VoyageNeed, VoyageShip } from '../../../shared/src/data/voyage.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/port.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';

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
interface Offer {
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

let openEl: HTMLElement | null = null;

/** Casting off: straight away when all is aboard, else the list of what is short first. */
export function departOrAsk(state: ClientState, send: (m: ClientMsg) => void, go: () => void): void {
  const ship = voyageShip(state);
  if (!ship || !state.portView || !voyageNeeds(ship).length) return go();
  openEl?.remove();
  const el = document.createElement('div');
  el.id = 'confirm';
  el.className = 'depart';
  openEl = el;
  let offers: Offer[] = [];
  let lastHtml = '';
  const close = () => {
    clearInterval(timer);
    removeEventListener('keydown', key, true);
    el.remove();
    if (openEl === el) openEl = null;
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Tab') return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  const draw = () => {
    if (!state.self?.dockedAt) return close();
    const s = voyageShip(state);
    if (!s) return close();
    offers = voyageNeeds(s).map((n) => offerOf(n, state));
    const total = offers.reduce((a, o) => a + o.cost, 0);
    const buyable = offers.filter((o) => o.n > 0);
    const gold = state.self.gold;
    const html = `<div class="panel confirm-panel depart-panel" role="alertdialog" aria-modal="true" aria-labelledby="dp-title">
      <h3 id="dp-title" class="dp-title">${icon('stat_sails', '', 'ico-md')}${esc(L('depart.title'))}</h3>
      ${offers.length ? `<p class="dp-lead">${esc(L('depart.lead', { min: VOYAGE_MINUTES }))}</p><div class="dp-list">${offers.map((o, i) => row(o, i, state)).join('')}</div>` : `<p class="dp-lead dp-ok">${esc(L('depart.ready'))}</p>`}
      ${buyable.length && total > gold ? `<p class="dp-warn">${esc(L('depart.short', { gold: fmt(gold) }))}</p>` : ''}
      <div class="dp-foot">${buyable.length > 1 || (buyable.length === 1 && offers.length > 1) ? `<button class="btn btn-primary" data-dp="all">${esc(L('depart.buyAll', { cost: fmt(total) }))}</button>` : ''}
        <button class="btn${offers.length ? '' : ' btn-primary'}" data-dp="sail">${esc(offers.length ? L('depart.sailAnyway') : L('depart.sail'))}</button>
        <button class="btn" data-dp="stay">${esc(L('depart.stay'))}</button></div></div>`;
    if (html === lastHtml) return;
    lastHtml = html;
    el.innerHTML = html;
  };
  el.addEventListener('click', (e) => {
    if (e.target === el) return close();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-dp]');
    if (!b) return;
    const what = b.dataset.dp!;
    if (what === 'stay') return close();
    if (what === 'sail') {
      close();
      return go();
    }
    const list = what === 'all' ? offers : [offers[Number(what)]].filter(Boolean);
    for (const o of list) for (const m of o.msgs) send(m);
  });
  const timer = setInterval(draw, 400);
  addEventListener('keydown', key, true);
  draw();
  document.body.append(el);
  el.querySelector<HTMLElement>('[data-dp="all"], [data-dp="0"], [data-dp="sail"]')?.focus({ preventScroll: true });
}

/** The market's quick row: provisions for a voyage, what is aboard and one button to buy the rest. */
export function voyageFoodCard(state: ClientState): string {
  const s = voyageShip(state);
  const row = state.portView?.market.find((r) => r.good === 'provisions');
  if (!s || !row) return '';
  const want = voyageFood(s);
  const have = Math.floor(s.provisions);
  const room = Math.floor(Math.max(0, s.holdFree) / Math.max(0.05, s.provisionVolume));
  const n = Math.max(0, Math.min(want - have, room, row.stock));
  const short = have < want;
  const line = short ? L('market.voyageLine', { crew: s.crew, have, want }) : L('market.voyageOk', { crew: s.crew, have, n: Math.floor(foodMinutes(have, s.crew, s.provisionUse)) });
  return `<div class="card voyage-food${short ? ' short' : ''}">${icon('good_provisions', '', 'shop-ico')}<div class="shop-text"><b>${esc(L('market.voyage', { min: VOYAGE_MINUTES }))}</b><span class="muted">${esc(line)}</span></div>
    ${n > 0 ? `<button class="btn ${short ? 'btn-primary' : 'btn-small'}" data-act="buyn" data-good="provisions" data-n="${n}">${esc(L('market.voyageBuy', { n }))} · ${money(walkBuyCost('provisions', row.buy, row.stock, n))}</button>` : ''}</div>`;
}

