// A ship of the sea hired at sea as a guard (owner, 2026-10-25: «сделай чтобы я мог нанять в море корабль любого нпс на
// время… он бы плыл рядом и охранял меня»). Two small things over the sea, the server deciding everything
// (server/src/game/seahire.ts):
//   the card    opened from a peaceful ship's «Нанять» (the target's choices): the ship — her class, ⚓, guns, men, hull —
//               the three contracts (10 / 15 / 20 min) with their prices, her silver, why not; the rules in one line
//               (no port, nothing back when sunk or dismissed). It stands where the ceasefire's card stands.
//   the chip    while a guard sails with her: the guard's time left and hull, by the minimap; a tap dismisses her
//               (asked first: nothing is refunded).

import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { HIRE_MINUTES } from '../../../shared/src/data/seahire.ts';
import type { HireOffer, HireView } from '../../../shared/src/data/seahire.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seahire.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { ask } from './confirm.ts';
import { esc, fmt, glyphSvg, icon } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

/** While the card is up the offer is asked again this often (her hull, the reach, the silver change). */
const REQUOTE_MS = 2500;

export class HireCard {
  private el: HTMLElement;
  private offer: HireOffer | null = null;
  private askedAt = 0;
  private lastKey = '';
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.createElement('div');
    this.el.id = 'seahire';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.el);
  }

  get shown(): boolean {
    return !!this.offer;
  }

  /** Ask the server about ship `id`. */
  ask(id: number): void {
    this.askedAt = performance.now();
    this.send({ t: 'seahire', op: 'quote', id });
  }

  show(offer: HireOffer | null): void {
    if (!offer) return this.close();
    this.offer = offer;
    this.lastKey = '';
  }

  close(): void {
    this.offer = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.lastKey = '';
  }

  frame(state: ClientState): void {
    const o = this.offer;
    if (!o) return;
    if (state.self?.dockedAt || !state.ships.has(o.id)) return this.close();
    if (performance.now() - this.askedAt > REQUOTE_MS) this.ask(o.id);
    const key = JSON.stringify(o);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(o);
  }

  private draw(o: HireOffer): void {
    const cls = SHIP_CLASSES[o.classId];
    const stats = [L('hr.guns', { n: o.guns * 2 }), L('hr.crew', { n: o.crew, max: o.crewMax }), L('hr.hull', { n: fmt(o.hull), max: fmt(o.hullMax) })].map((t) => `<span>${esc(t)}</span>`).join('');
    const buttons = HIRE_MINUTES.map((m, i) => {
      const p = o.prices[i] ?? 0;
      const short = p > o.silver;
      return `<button class="btn btn-small hr-buy${i === HIRE_MINUTES.length - 1 ? ' btn-primary' : ''}" data-hr-min="${m}"${!o.ok || short ? ' disabled' : ''}${short ? ` title="${esc(L('hr.short'))}"` : ''}><b>${esc(L('hr.min', { n: m }))}</b><span>${icon('coin', '', 'ico-sm')}${fmt(p)}</span></button>`;
    }).join('');
    this.el.innerHTML = `<div class="enc-card hr-card">
      <div class="hr-head"><div class="enc-h">${icon('ab_call_escort', '', 'ico-md')}${esc(L('hr.title'))}</div><button class="btn btn-small hr-x" data-hr-close aria-label="${esc(L('hr.close'))}">${glyphSvg('close')}</button></div>
      <div class="hr-ship"><b>${esc(placeName(o.name))}</b><span class="muted">${esc(L('hr.ship', { cls: cls?.name ?? o.classId, lvl: o.shipLevel }))}</span></div>
      <div class="hr-stats muted">${stats}</div>
      <div class="hr-buys">${buttons}</div>
      <p class="hr-line"><span>${icon('coin', '', 'ico-sm')}${esc(L('hr.silver', { n: fmt(o.silver) }))}</span>${!o.ok && o.why ? ` <span class="bad">${esc(serverText(o.why))}</span>` : ''}</p>
      <p class="hr-line muted">${esc(L('hr.rules'))}</p>
    </div>`;
    this.el.classList.remove('hidden');
    this.el.querySelector<HTMLButtonElement>('[data-hr-close]')!.onclick = () => this.close();
    this.el.querySelectorAll<HTMLButtonElement>('[data-hr-min]').forEach((b) => (b.onclick = () => {
      this.el.querySelectorAll<HTMLButtonElement>('[data-hr-min]').forEach((x) => (x.disabled = true));
      this.send({ t: 'seahire', op: 'hire', id: o.id, minutes: Number(b.dataset.hrMin) });
    }));
  }
}

/** The guard's chip: her time left and her hull, a tap to dismiss her. */
export class HireChip {
  private el: HTMLElement;
  private lastKey = '';
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.createElement('div');
    this.el.id = 'hire-chip';
    this.el.className = 'hidden';
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.el);
  }

  frame(state: ClientState): void {
    const v: HireView | null = state.hire;
    const now = state.estServerTime();
    const list = (v?.escorts ?? []).map((e) => {
      const live = state.ships.get(e.id);
      const hull = live ? Math.round(live.cur.hull * 100) : Math.round((e.hull / Math.max(1, e.hullMax)) * 100);
      const left = Math.max(0, Math.ceil(e.until - now));
      return { e, hull: Math.max(0, Math.min(100, hull)), left };
    });
    const key = `${list.map((x) => `${x.e.id}:${x.left}:${x.hull}:${x.e.waiting ? 1 : 0}`).join('|')}|${!!state.self?.dockedAt}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (!list.length) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      return;
    }
    this.el.innerHTML = list.map(({ e, hull, left }) => {
      const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      return `<button class="hr-chip${hull < 35 ? ' low' : ''}" data-hr-dismiss="${e.id}" title="${esc(L('hr.chipT'))}" aria-label="${esc(`${placeName(e.name)} · ${mm}:${ss}`)}">
        ${icon('ab_call_escort', '', 'ico-sm')}<span class="hr-t">${mm}:${ss}</span><span class="hr-bar"><i style="width:${hull}%"></i></span>${e.waiting ? `<span class="hr-w">${esc(L('hr.wait'))}</span>` : ''}</button>`;
    }).join('');
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLButtonElement>('[data-hr-dismiss]').forEach((b) => (b.onclick = () => {
      const id = Number(b.dataset.hrDismiss);
      const e = list.find((x) => x.e.id === id)?.e;
      void ask(L('hr.dismiss', { name: placeName(e?.name ?? '') })).then((ok) => ok && this.send({ t: 'seahire', op: 'dismiss', id }));
    }));
  }
}
