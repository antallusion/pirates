// Her personal offers on screen (owner, 2026-10-15: «нужно везде продвигать свои пакеты с обратным отсчетом … на острове
// … для острова, в море - на море и абордажные пакеты … с возможностью закрыть офферы. и при входе в игру разворачивать
// офферы для игрока»; server/src/game/promo.ts decides every card and price). One module, its own DOM:
//  - the entry carousel: after loading (never in the First Watch, never in a fight), once a day — 1–3 cards, big
//    countdowns, arrows and swipe, «Купить», «Подробнее», «Позже», ✕;
//  - the sea's chip under the chart's dial: a sea or boarding offer, out of a fight only;
//  - the island scene's card in its right column, under «В море» (hidden while a building's card is open there);
//  - the harbour's strip (its slot in the port window, client/src/ui/port.ts);
//  - a boarding's end: a boarding offer in the top band of the result.
// A tap opens the offer as one card; ✕ hides it in that place (the server keeps it); every card shown is told once.

import { OFFERS } from '../../../shared/src/data/shop.ts';
import type { PromoCard, PromoPlace, PromoView } from '../../../shared/src/premiumproto.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/promo.ts';
import type { ClientState } from '../state.ts';
import { ask } from './confirm.ts';
import { esc, fmt } from './dom.ts';
import { doubloonIcon, famArt, qtyOf } from './premium.ts';

const L = dict(EN, RU);
const T = (x: readonly [string, string]) => x[lang() === 'ru' ? 1 : 0];
const pid = (): string => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** A countdown: «2 д 4 ч», «5 ч 12 м», «42:07». */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const ru = lang() === 'ru';
  if (d) return `${d}${ru ? ' д' : 'd'} ${h}${ru ? ' ч' : 'h'}`;
  if (h) return `${h}${ru ? ' ч' : 'h'} ${String(m).padStart(2, '0')}${ru ? ' м' : 'm'}`;
  return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

export interface PromoDeps {
  send: (m: ClientMsg) => void;
  on: (f: (m: ServerMsg) => void) => void;
  state: ClientState;
  /** A window open (its name), or null. */
  modal: () => string | null;
  /** Hostile ships near, a chase, a boarding: no promo then. */
  busy: () => boolean;
}

export class Promos {
  view: PromoView | null = null;
  private at = 0;
  private d: PromoDeps;
  /** Closed here this session (also told to the server, which keeps them). */
  private closed = new Set<string>();
  private seen = new Set<string>();
  /** A place closed by her: the cards it had then stay away from it (only a new offer shows there again). */
  private quiet = new Map<PromoPlace, Set<string>>();
  /** The overlay: the entry carousel or one offer's card. */
  private over: HTMLElement | null = null;
  private list: PromoCard[] = [];
  private idx = 0;
  private overPlace: PromoPlace = 'entry';

  constructor(d: PromoDeps) {
    this.d = d;
    d.on((m) => {
      if (m.t !== 'promo') return;
      this.view = m.view;
      this.at = performance.now();
      this.place();
    });
    setInterval(() => this.place(), 1000);
    // the harbour's window redraws itself: its slot filled again each time it comes back empty
    const panel = document.getElementById('modal-panel');
    if (panel) new MutationObserver(() => this.port()).observe(panel, { childList: true, subtree: true });
  }

  /** The server's wall clock now. */
  private now(): number {
    return (this.view?.now ?? Date.now()) + (performance.now() - this.at);
  }

  private card(id: string): PromoCard | undefined {
    return this.view?.cards.find((c) => c.id === id);
  }

  /** The cards for a place: live, not closed there, and (a context's place) of its contexts. */
  cardsFor(where: PromoPlace): PromoCard[] {
    const now = this.now();
    const ctx: Record<PromoPlace, string[]> = { entry: ['isle', 'sea', 'board', 'all'], isle: ['isle'], sea: ['sea', 'board'], port: ['sea', 'board', 'isle', 'all'], board: ['board'] };
    const quiet = this.quiet.get(where);
    return (this.view?.cards ?? []).filter((c) => (!c.until || c.until > now) && ctx[where].includes(c.ctx) && !c.closed.includes(where) && !this.closed.has(`${c.id}:${where}`) && !quiet?.has(c.id) && !(c.ctx === 'isle' && c.why === 'island'));
  }

  private tell(c: PromoCard, where: PromoPlace): void {
    const k = `${c.id}:${where}`;
    if (this.seen.has(k)) return;
    this.seen.add(k);
    this.d.send({ t: 'premium', action: 'promo_seen', id: c.id, where });
  }

  private close(c: PromoCard, where: PromoPlace): void {
    this.closed.add(`${c.id}:${where}`);
    // (not the next card in its stead: the place keeps quiet until a new offer comes — owner: «не надоедать»)
    if (where !== 'entry') this.quiet.set(where, new Set((this.view?.cards ?? []).map((x) => x.id)));
    this.d.send({ t: 'premium', action: 'promo_close', id: c.id, where });
    this.place();
  }

  // ---------------------------------------------------------------------------------------------- what a card says

  private nameOf(c: PromoCard): string {
    if (c.special === 'first') return L('first');
    const f = OFFERS.get(c.offer);
    return f ? T(f.fam.name) : c.offer;
  }

  private qtyOf(c: PromoCard): string {
    const f = OFFERS.get(c.offer);
    return f ? qtyOf(f.offer, f.fam) : '';
  }

  private artOf(c: PromoCard): string {
    return famArt(c.special === 'first' ? 'doubloon' : OFFERS.get(c.offer)?.fam.icon ?? 'doubloon');
  }

  /** The price: the old one struck through, the new one in gold, the ribbon. */
  private priceHtml(c: PromoCard): string {
    if (c.special === 'first') return `<span class="po-new">${doubloonIcon('ico-xs')}×2</span>`;
    return `${c.off > 0 && c.was > c.price ? `<s class="po-was">${fmt(c.was)}</s>` : ''}<span class="po-new">${doubloonIcon('ico-xs')}${fmt(c.price)}</span>`;
  }

  private clock(c: PromoCard): string {
    if (!c.until) return '';
    const left = c.until - this.now();
    return `<b class="po-clock${left < 3_600_000 ? ' urgent' : ''}" data-poend="${c.until}">${esc(countdown(left))}</b>`;
  }

  private ribbon(c: PromoCard): string {
    return c.off > 0 ? `<i class="po-off">−${c.off}%</i>` : '';
  }

  // ---------------------------------------------------------------------------------------------- the small ones

  /** Where each small card goes now, and the countdowns. */
  place(): void {
    this.sea();
    this.isle();
    this.port();
    this.board();
    this.entry();
    const now = this.now();
    document.querySelectorAll<HTMLElement>('[data-poend]').forEach((el) => {
      const left = Number(el.dataset.poend) - now;
      const t = countdown(left);
      if (el.textContent !== t) el.textContent = t;
      el.classList.toggle('urgent', left < 3_600_000);
    });
  }

  /** A small card in a mount: its picture, name, the clock, the price and ✕; a tap opens it. */
  private chip(el: HTMLElement, c: PromoCard | undefined, where: PromoPlace, cls: string): void {
    if (!c) {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
      el.dataset.po = '';
      return;
    }
    el.classList.remove('hidden');
    const key = `${c.id}|${c.price}|${c.why}|${lang()}`;
    if (el.dataset.po !== key) {
      el.dataset.po = key;
      el.className = `po-chip ${cls}`;
      el.innerHTML = `<button type="button" class="po-open" data-poopen="${esc(c.id)}" aria-label="${esc(this.nameOf(c))}">${this.artOf(c)}${this.ribbon(c)}<span class="po-t"><span class="po-n">${esc(this.nameOf(c))}${c.special ? '' : ` <small>${esc(this.qtyOf(c))}</small>`}</span><span class="po-l">${this.clock(c)}${this.priceHtml(c)}</span></span></button><button type="button" class="po-x" data-pox aria-label="${esc(L('close'))}" title="${esc(L('close'))}">×</button>`;
      el.querySelector<HTMLElement>('[data-poopen]')!.onclick = () => this.open([c], where);
      el.querySelector<HTMLElement>('[data-pox]')!.onclick = (e) => {
        e.stopPropagation();
        this.close(c, where);
      };
    }
    this.tell(c, where);
  }

  private mount(id: string, parent: HTMLElement): HTMLElement {
    let el = document.getElementById(id);
    if (!el || el.parentElement !== parent) {
      el?.remove();
      el = document.createElement('div');
      el.id = id;
      el.className = 'hidden';
      parent.appendChild(el);
    }
    return el;
  }

  /** At sea: a sea offer (or a boarding one) under the chart's dial, out of every fight and window. */
  private sea(): void {
    const el = this.mount('promo-sea', document.body);
    const hud = document.getElementById('hud');
    const isle = document.getElementById('isle');
    const on = !!this.view && !!hud && !hud.classList.contains('hidden') && !this.d.modal() && !this.d.busy() && !this.d.state.self?.dockedAt && !(isle && !isle.classList.contains('hidden')) && !this.d.state.onboarding?.stage && !this.over;
    let card = on ? this.cardsFor('sea').find((c) => c.ctx === 'sea') ?? this.cardsFor('sea')[0] : undefined;
    // its place: under the lowest of the HUD's things in the screen's top right (the dial, the round buttons, the chat),
    // and only if it clears those of the bottom right
    if (card) {
      const W = innerWidth, Hh = innerHeight;
      let top = 0, floor = Hh;
      for (const o of document.querySelectorAll<HTMLElement>('#hud-map, #touch > *, #hud-chat > .chat-toggle, #hud-region')) {
        const r = o.getBoundingClientRect();
        if (!r.width || !r.height || r.right < W - 240 || getComputedStyle(o).visibility === 'hidden' || o.offsetParent === null) continue;
        if (r.top < Hh * 0.45) top = Math.max(top, r.bottom);
        else floor = Math.min(floor, r.top);
      }
      el.style.top = `${Math.round(top + 6)}px`;
      if (top + 6 + (el.offsetHeight || 40) > floor - 4) card = undefined;
    }
    this.chip(el, card, 'sea', 'po-sea');
  }

  /** On the island: its offer in the scene's right column, while no building's card is open there. */
  private isle(): void {
    const scene = document.getElementById('isle');
    if (!scene) return;
    const el = this.mount('promo-isle', scene);
    const card = scene.querySelector('.is-card');
    const on = !scene.classList.contains('hidden') && !(card && !card.classList.contains('hidden')) && !this.d.modal() && !this.over;
    this.chip(el, on ? this.cardsFor('isle')[0] : undefined, 'isle', 'po-isle');
  }

  /** The harbour: a strip in its window's slot (a sea or boarding offer first, then the rest). */
  private port(): void {
    const slot = document.querySelector<HTMLElement>('#modal-panel[data-modal="port"] .promo-port-slot');
    if (!slot) return;
    // the sea's and the boarding's first, then the island's and the specials, each in turn every eight seconds
    const rank = (x: PromoCard) => ({ sea: 0, board: 1, isle: 2, all: 3 })[x.ctx];
    const list = [...this.cardsFor('port')].sort((a, b) => rank(a) - rank(b));
    const c = list.length ? list[Math.floor(this.now() / 8000) % list.length] : undefined;
    const el = slot.querySelector<HTMLElement>('.po-chip') ?? slot.appendChild(document.createElement('div'));
    this.chip(el, c, 'port', 'po-port');
    slot.classList.toggle('hidden', !c);
  }

  /** A boarding's end: a boarding offer in the result's top band. */
  private board(): void {
    const tac = document.getElementById('board-tac');
    const end = tac && !tac.classList.contains('hidden') && tac.querySelector('.tb-end');
    const el = this.mount('promo-board', document.body);
    this.chip(el, end ? this.cardsFor('board')[0] : undefined, 'board', 'po-board');
  }

  // ---------------------------------------------------------------------------------------------- the carousel

  /** On coming aboard, once a day (the server says when): after the First Watch, out of a fight, no window open. */
  private entry(): void {
    const v = this.view;
    if (!v?.carousel || this.over) return;
    const hud = document.getElementById('hud');
    // (the harbour's window opens by itself on coming aboard in port: the carousel stands over it)
    const m = this.d.modal();
    if (!hud || hud.classList.contains('hidden') || this.d.state.onboarding?.stage || (m && m !== 'port') || this.d.busy() || document.querySelector('.k-sheet-root:not(.hidden) .k-sheet')) return;
    const cards = this.cardsFor('entry');
    // the specials first (the first top-up's double, a level's gift, the starter), then her offers; three at most
    const order = (c: PromoCard) => (c.special === 'first' ? 0 : c.special === 'level' ? 1 : c.special === 'starter' ? 2 : c.special ? 5 : 3);
    const pick = [...cards].sort((a, b) => order(a) - order(b)).slice(0, 3);
    v.carousel = false;
    this.d.send({ t: 'premium', action: 'promo_carousel' });
    if (pick.length) this.open(pick, 'entry');
  }

  /** The overlay with one card or several (arrows, dots, a swipe). */
  open(cards: PromoCard[], where: PromoPlace): void {
    this.list = cards;
    this.idx = 0;
    this.overPlace = where;
    this.over?.remove();
    const el = document.createElement('div');
    el.id = 'promo-over';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    this.over = el;
    let x0 = 0;
    el.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    el.addEventListener('pointerup', (e) => {
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 50 && this.list.length > 1) this.go(this.idx + (dx < 0 ? 1 : -1));
    });
    el.addEventListener('click', (e) => {
      if (e.target === el) this.shut();
    });
    this.drawOver();
  }

  private go(i: number): void {
    this.idx = (i + this.list.length) % this.list.length;
    this.drawOver();
  }

  private shut(): void {
    this.over?.remove();
    this.over = null;
    this.place();
  }

  private drawOver(): void {
    const el = this.over;
    if (!el) return;
    const c = this.list[this.idx];
    const live = c && (this.card(c.id) ?? c);
    if (!live) return this.shut();
    const many = this.list.length > 1;
    const f = OFFERS.get(live.offer);
    const what = live.special === 'first' ? L('firstText') : f ? T(f.fam.text) : '';
    const why = live.why ? `<small class="po-why">${esc(L(live.why === 'poor' ? 'why.poor' : 'why.other'))}</small>` : '';
    const buy = live.special === 'first' ? L('topup') : L('buy');
    el.innerHTML = `<div class="po-box${many ? ' many' : ''}">
      <header class="po-head"><b>${esc(this.overPlace === 'entry' ? L('title') : L(`ctx.${live.ctx}` as 'ctx.all'))}</b><button type="button" class="po-x po-x-big" data-poshut aria-label="${esc(L('close'))}">×</button></header>
      <div class="po-card">${this.ribbon(live)}${this.artOf(live)}
        <div class="po-body"><span class="po-ctx">${esc(L(`ctx.${live.ctx}` as 'ctx.all'))}</span><b class="po-name">${esc(this.nameOf(live))}${live.special ? '' : ` · ${esc(this.qtyOf(live))}`}</b><p class="po-text">${esc(what)}</p>
          ${live.until ? `<div class="po-hurry">${esc(L('hurry'))} ${this.clock(live)}</div>` : ''}
          <div class="po-price">${this.priceHtml(live)}</div>${why}</div></div>
      <div class="po-acts">${many ? `<button type="button" class="btn btn-small po-nav" data-poprev aria-label="${esc(L('prev'))}">‹</button>` : ''}
        <button type="button" class="btn btn-small" data-polater>${esc(this.overPlace === 'entry' ? L('later') : L('close'))}</button>
        ${live.special === 'first' ? '' : `<button type="button" class="btn btn-small" data-pomore>${esc(L('more'))}</button>`}
        <button type="button" class="btn btn-small btn-primary po-buy" data-pobuy${live.why && live.why !== 'poor' ? ' disabled' : ''}>${esc(buy)}</button>
        ${many ? `<button type="button" class="btn btn-small po-nav" data-ponext aria-label="${esc(L('next'))}">›</button>` : ''}</div>
      ${many ? `<div class="po-dots">${this.list.map((_, i) => `<i class="${i === this.idx ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
    this.tell(live, this.overPlace);
    el.querySelector<HTMLElement>('[data-poshut]')!.onclick = () => {
      if (this.overPlace !== 'entry') this.close(live, this.overPlace);
      this.shut();
    };
    el.querySelector<HTMLElement>('[data-polater]')!.onclick = () => this.shut();
    el.querySelector<HTMLElement>('[data-poprev]')?.addEventListener('click', () => this.go(this.idx - 1));
    el.querySelector<HTMLElement>('[data-ponext]')?.addEventListener('click', () => this.go(this.idx + 1));
    el.querySelector<HTMLElement>('[data-pomore]')?.addEventListener('click', () => {
      this.shut();
      const fam = OFFERS.get(live.offer)?.fam;
      dispatchEvent(new CustomEvent('gravetide:shop', { detail: fam ? { tab: fam.sec === 'deals' ? 'sea' : fam.tabs[0], sec: fam.sec } : 'topup' }));
    });
    el.querySelector<HTMLElement>('[data-pobuy]')!.onclick = () => this.buy(live);
  }

  /** «Купить»: a personal offer at its own price, a special at the shop's, the first top-up's packs. */
  private buy(c: PromoCard): void {
    if (c.special === 'first' || c.why === 'poor') {
      this.shut();
      dispatchEvent(new CustomEvent('gravetide:shop', { detail: 'topup' }));
      return;
    }
    const ticket = pid();
    void ask(L('ask', { name: this.nameOf(c), q: this.qtyOf(c), n: fmt(c.price) })).then((ok) => {
      if (!ok) return;
      if (c.special) this.d.send({ t: 'premium', action: 'shop', offer: c.offer, pid: ticket });
      else this.d.send({ t: 'premium', action: 'promo_buy', id: c.id, pid: ticket });
      this.shut();
    });
  }
}

/** The harbour window's slot for the strip (port.ts puts it in its pane). */
export const PROMO_PORT_SLOT = '<div class="promo-port-slot hidden"></div>';
