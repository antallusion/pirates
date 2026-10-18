// The ceasefire talks (owner, 2026-10-18: «с кораблями нужно дать возможность договариваться о прекращении огня, часто
// меня атакуют сразу несколько»): a small card over the sea, opened from a ship firing on her («Переговоры» in the
// target's choices). Every ship attacking her now, each with its price (the server's: 15 % of what she carries) and
// who may refuse; «Заплатить» one, or «Со всеми»; in silver, or in goods she picks (the rest in silver). After an offer:
// who agreed (a white flag) and who refused. The server decides everything (server/src/game/ceasefire.ts).

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { TRUCE_SHARE } from '../../../shared/src/data/ceasefire.ts';
import type { CeasefireView } from '../../../shared/src/data/ceasefire.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/outcome.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, glyphSvg } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

/** While the card is up the prices are asked again this often (the attackers come and go, what she carries changes). */
const REQUOTE_MS = 3000;

export class CeasefireCard {
  private el: HTMLElement;
  private view: CeasefireView | null = null;
  private focus: number | undefined;
  private pay: 'silver' | 'cargo' = 'silver';
  private goods = new Set<GoodId>();
  private askedAt = 0;
  private lastKey = '';
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.createElement('div');
    this.el.id = 'ceasefire';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.el);
  }

  get shown(): boolean {
    return !!this.view;
  }

  /** Ask the server for the talk about ship `id` (and every other ship firing on her). */
  ask(id?: number): void {
    this.focus = id;
    this.askedAt = performance.now();
    this.send({ t: 'ceasefire', op: 'quote', ...(id !== undefined ? { id } : {}) });
  }

  /** The server's talk (or none: nobody is firing on her, the card goes). */
  show(view: CeasefireView | null): void {
    if (!view) return this.close();
    // an offer's answers stay on the card through the next quotes, until a new offer
    const keep = !view.result && this.view?.result ? { result: this.view.result, paid: this.view.paid } : {};
    this.view = { ...view, ...keep };
    this.lastKey = '';
  }

  close(): void {
    this.view = null;
    this.goods.clear();
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.lastKey = '';
  }

  /** Every frame: the cool-down's seconds; a fresh quote now and then. */
  frame(state: ClientState): void {
    const v = this.view;
    if (!v) return;
    if (state.self?.dockedAt) return this.close();
    if (performance.now() - this.askedAt > REQUOTE_MS) {
      this.askedAt = performance.now();
      this.send({ t: 'ceasefire', op: 'quote', ...(this.focus !== undefined && v.ships.some((s) => s.id === this.focus) ? { id: this.focus } : {}) });
    }
    const now = state.estServerTime();
    const wait = Math.max(0, Math.ceil(v.cooldown - now));
    const cargo = state.self?.cargo ?? {};
    const key = `${JSON.stringify(v)}|${wait}|${this.pay}|${[...this.goods].join(',')}|${JSON.stringify(cargo)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(v, wait, cargo);
  }

  private draw(v: CeasefireView, wait: number, cargo: Partial<Record<GoodId, number>>): void {
    const answered = new Map((v.result ?? []).map((r) => [r.id, r]));
    const price = v.ships[0]?.price ?? 0;
    const okIds = v.ships.filter((s) => s.ok).map((s) => s.id);
    const held = (Object.keys(cargo) as GoodId[]).filter((g) => (cargo[g] ?? 0) >= 1 && GOODS[g]);
    const rows = v.ships.map((s) => {
      const a = answered.get(s.id);
      const state = a ? `<span class="${a.agreed ? 'good' : 'bad'}">${esc(L(a.agreed ? 'cf.agreed' : 'cf.refused'))}</span>` : '';
      const note = !s.ok && s.why ? `<span class="muted">${esc(serverText(s.why))}</span>` : s.risk > 0 ? `<span class="warn">${esc(L('cf.risk', { n: Math.round(s.risk * 100) }))}</span>` : '';
      return `<div class="cf-row${s.id === v.focus ? ' focus' : ''}"><span class="cf-name">${icon(s.ok ? 'menu_ship' : 'stat_hull', '', 'ico-sm')}<b>${esc(placeName(s.name))}</b>${state || note}</span>`
        + `<button class="btn btn-small" data-cf-one="${s.id}"${!s.ok || wait > 0 ? ' disabled' : ''}>${esc(L('cf.one', { price: fmt(s.price) }))}</button></div>`;
    }).join('');
    // Who answered and is no longer in the list (agreed: under a white flag now): her name and her answer.
    const listed = new Set(v.ships.map((s) => s.id));
    const gone = (v.result ?? []).filter((r) => !listed.has(r.id)).map((r) => `<div class="cf-row cf-done"><span class="cf-name">${icon(r.agreed ? 'faction_free' : 'stat_hull', '', 'ico-sm')}<b>${esc(placeName(r.name))}</b><span class="${r.agreed ? 'good' : 'bad'}">${esc(L(r.agreed ? 'cf.agreed' : 'cf.refused'))}</span></span></div>`).join('');
    const answeredLine = gone + (v.result ?? []).filter((r) => !r.agreed && r.why).map((r) => `<p class="cf-line bad">${esc(placeName(r.name))}: ${esc(serverText(r.why!))}</p>`).join('');
    this.el.innerHTML = `<div class="enc-card cf-card">
      <div class="cf-head"><div class="enc-h">${icon('faction_free', '', 'ico-md')}${esc(L('cf.title'))}</div><button class="btn btn-small cf-x g-only" data-cf-close aria-label="${esc(L('cf.close'))}">${glyphSvg('close')}</button></div>
      <p class="cf-line muted">${price ? `${esc(L('cf.text', { pct: Math.round(TRUCE_SHARE * 100), price: fmt(price) }))} ` : ''}${esc(L('cf.carry', { silver: fmt(v.silver), cargo: fmt(v.cargo) }))}</p>
      <div class="cf-rows">${rows || `<p class="cf-line muted">${esc(L('cf.none'))}</p>`}</div>
      ${answeredLine}${v.paid && (v.paid.silver || v.paid.cargo) ? `<p class="cf-line good">${esc(v.paid.cargo ? L('cf.paid', { silver: fmt(v.paid.silver), cargo: fmt(v.paid.cargo) }) : L('cf.paidSilver', { silver: fmt(v.paid.silver) }))}</p>` : ''}
      <div class="cf-pay"><span class="cf-seg"><button class="btn btn-small${this.pay === 'silver' ? ' on' : ''}" data-cf-pay="silver">${icon('coin', '', 'ico-sm')}${esc(L('cf.paySilver'))}</button><button class="btn btn-small${this.pay === 'cargo' ? ' on' : ''}" data-cf-pay="cargo"${held.length ? '' : ' disabled'}>${icon('tab_market', '', 'ico-sm')}${esc(L('cf.payCargo'))}</button></span>
        <button class="btn btn-primary btn-small cf-all" data-cf-all${okIds.length && wait <= 0 ? '' : ' disabled'}>${esc(L('cf.all', { total: fmt(v.total) }))}</button></div>
      ${this.pay === 'cargo' ? `<div class="cf-goods"><span class="muted">${esc(L(held.length ? 'cf.goods' : 'cf.noGoods'))}</span>${held.map((g) => `<button class="btn btn-small cf-good${this.goods.has(g) ? ' on' : ''}" data-cf-good="${g}" title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}<b>${cargo[g]}</b></button>`).join('')}</div>` : ''}
      ${wait > 0 ? `<p class="cf-line muted">${esc(L('cf.wait', { n: wait }))}</p>` : ''}
    </div>`;
    this.el.classList.remove('hidden');
    const payWith = (ids: number[]) => {
      if (!ids.length) return;
      this.el.querySelectorAll<HTMLButtonElement>('[data-cf-one], [data-cf-all]').forEach((b) => (b.disabled = true));
      this.send({ t: 'ceasefire', op: 'pay', ids, pay: this.pay, ...(this.pay === 'cargo' ? { goods: [...this.goods] } : {}) });
      if (this.view) this.view = { ...this.view, result: undefined, paid: undefined };
    };
    this.el.querySelectorAll<HTMLButtonElement>('[data-cf-one]').forEach((b) => (b.onclick = () => payWith([Number(b.dataset.cfOne)])));
    this.el.querySelector<HTMLButtonElement>('[data-cf-all]')!.onclick = () => payWith(okIds);
    this.el.querySelector<HTMLButtonElement>('[data-cf-close]')!.onclick = () => this.close();
    this.el.querySelectorAll<HTMLButtonElement>('[data-cf-pay]').forEach((b) => (b.onclick = () => {
      this.pay = b.dataset.cfPay === 'cargo' ? 'cargo' : 'silver';
      if (this.pay === 'cargo' && !this.goods.size) for (const g of held) this.goods.add(g);
      this.lastKey = '';
    }));
    this.el.querySelectorAll<HTMLButtonElement>('[data-cf-good]').forEach((b) => (b.onclick = () => {
      const g = b.dataset.cfGood as GoodId;
      if (this.goods.has(g)) this.goods.delete(g);
      else this.goods.add(g);
      this.lastKey = '';
    }));
  }
}
