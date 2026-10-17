// docs/35: the floating waystation's window (moored), the port's surgeon and the field surgeon (the boarding's result,
// «Подробнее») — one window: her fallen kind by kind with what raising them costs where she stands (silver for the line
// kinds and the sea's creatures, doubloons for the shop's creatures at half price), a scroll on a stack, «Воскресить
// всех» with its total; at a waystation «Нанять» (the recruit window), «Починка», «В море». The buttons stand in a foot
// under the list, never scrolled away (owner's rule for the phone held sideways); the list scrolls.

import type { UnitId } from '../../../shared/src/data/army.ts';
import type { ResRow, ResView, WayView } from '../../../shared/src/wayproto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/waystation.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { unitIcon, unitName } from './army.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { doubloons } from './premium.ts';
import { wayName } from '../render/waystations.ts';

const L = dict(EN, RU);

let ridSeq = 0;
/** A request's own id (the server raises once by it). */
export const resRid = (): string => `r${Date.now().toString(36)}${(++ridSeq).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Its price as the window prints it: silver or doubloons. */
export function priceHtml(r: { silver: number; doubloons: number }): string {
  return [r.silver > 0 ? money(r.silver) : '', r.doubloons > 0 ? doubloons(r.doubloons) : ''].filter(Boolean).join(' + ');
}

/** The time the oldest of the record waits still. */
export function keepLeft(until: number, now: number): string {
  const s = Math.max(0, (until - now) / 1000);
  return s >= 3600 ? L('hours', { n: Math.ceil(s / 3600) }) : L('mins', { n: Math.max(1, Math.ceil(s / 60)) });
}

export interface WayHooks {
  send: (m: ClientMsg) => void;
  close: () => void;
  hire: () => void;
  shop: () => void;
  /** The infirmary at once (the shop's 'refill' bought by its purchase id). */
  instant: () => void;
}

export class WayWindow {
  private h: WayHooks;
  constructor(h: WayHooks) {
    this.h = h;
  }

  /** What can be raised now, at the price shown: the row's own why, the place, the purse. */
  private rowOk(v: ResView, r: ResRow): boolean {
    if (v.why || r.room <= 0) return false;
    if (r.prem) return v.balance >= r.doubloons;
    if (v.place === 'none') return false;
    // (a part of the stack if the purse is short: the server raises as many as it pays for)
    return v.gold >= Math.ceil(r.silver / Math.max(1, r.room));
  }

  render(root: HTMLElement, state: ClientState): void {
    const way: WayView | null = state.wayView;
    const v: ResView | null = way?.res ?? state.fallen;
    const title = way ? wayName(way.kind) : v?.place === 'port' ? L('title.port') : v?.place === 'field' ? L('title.field') : L('title.none');
    const art = way ? (way.kind === 'chapel' ? 'build_chapel' : way.kind === 'market' ? 'tab_market' : 'build_tavern') : 'prof_surgeon';
    if (!v) {
      root.innerHTML = `<div class="modal-head way-head"><div class="way-ht">${icon(art, '', 'way-art')}<div><h2>${esc(title)}</h2></div></div></div><div class="modal-body"><p class="muted">${esc(L('none'))}</p></div>`;
      return;
    }
    const chips = `<div class="way-chips"><span class="ph-chip gold">${money(v.gold)}</span><span class="ph-chip">${doubloons(v.balance)}</span>${v.scrolls > 0 ? `<span class="ph-chip">${icon('ui_phial', '', 'ico-sm')}${esc(L('scrolls', { n: v.scrolls }))}</span>` : ''}</div>`;
    const sub = way ? L('sub.way', { n: v.fallen }) : L('sub.res', { n: v.fallen });
    const head = `<div class="modal-head way-head"><div class="way-ht">${icon(art, '', 'way-art')}<div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div></div>${chips}</div>`;
    const rows = v.rows.map((r) => {
      const ok = this.rowOk(v, r);
      const scroll = !r.prem && v.scrolls > 0 && r.room > 0 && !v.why;
      const why = r.why ? serverText(r.why) : '';
      return `<div class="way-row${r.room <= 0 ? ' off' : ''}">${unitIcon(r.u, 'way-face')}
        <div class="way-rt"><b>${esc(unitName(r.u))} <span class="way-n">×${fmt(r.n)}</span></b>${r.room < r.n ? `<span class="muted">${esc(r.room > 0 ? L('room', { k: r.room, n: r.n }) : why)}</span>` : ''}</div>
        <span class="way-price">${priceHtml(r)}</span>
        <span class="way-btns">${scroll ? `<button class="btn btn-small" data-wscroll="${r.u}" title="${esc(L('scroll'))}">${icon('ui_phial', '', 'ico-sm')}</button>` : ''}<button class="btn btn-small${ok ? ' btn-primary' : ''}" data-wres="${r.u}"${ok ? '' : ' disabled'}>${esc(L('res'))}</button></span></div>`;
    }).join('');
    const now = Date.now();
    const notes = [
      v.place === 'field' ? L('note.field') : '',
      v.place === 'none' && v.rows.some((r) => !r.prem) ? L('note.none') : '',
      v.rows.some((r) => r.prem) ? L('note.prem') : '',
      v.until > 0 ? L('note.keep', { t: keepLeft(v.until, now) }) : '',
    ].filter(Boolean);
    const offer = v.offer ? `<div class="card way-offer">${icon('ui_phial', '', 'ico-md')}<div><b>${esc(L('offer.h'))}</b><span class="muted">${esc(L('offer.t'))}</span></div><button class="btn btn-small" data-wshop>${esc(L('offer.btn'))}</button></div>` : '';
    const body = v.rows.length
      ? `<div class="way-list">${rows}</div>${notes.length ? `<p class="muted way-note">${notes.map((n) => esc(n)).join(' ')}</p>` : ''}${offer}`
      : `<p class="muted way-empty">${esc(L('none'))}</p>`;
    const can = v.n > 0 && !v.why && (v.silver <= v.gold || v.rows.some((r) => this.rowOk(v, r)));
    const allPrice = priceHtml(v);
    const foot = [
      v.rows.length ? `<button class="btn btn-primary way-all" data-wall${can ? '' : ' disabled'}><span class="ch-long">${esc(L('all'))}</span><span class="ch-short">${esc(L('allShort'))}</span>${allPrice ? `<span class="way-sum">${allPrice}</span>` : ''}</button>` : '',
      v.place === 'none' && v.instant > 0 ? `<button class="btn" data-winstant>${esc(L('instant'))} <span class="way-sum">${doubloons(v.instant)}</span></button>` : '',
      way && way.hire > 0 ? `<button class="btn" data-whire>${icon('stat_crew', '', 'ico-sm')}${esc(L('hire'))}</button>` : '',
      way?.repair ? `<button class="btn" data-wrepair title="${esc(L('repairTip', { pct: Math.round(way.repair.to * 100) }))}">${icon('prof_carpenter', '', 'ico-sm')}${esc(L('repair'))} <span class="way-sum">${money(way.repair.cost)}</span></button>` : '',
      `<button class="btn" data-wclose>${esc(way ? L('sea') : L('close'))}</button>`,
    ].filter(Boolean).join('');
    root.innerHTML = `${head}<div class="modal-body way-body">${body}</div><div class="way-foot">${foot}</div>`;
    this.bind(root, v);
  }

  private bind(root: HTMLElement, v: ResView): void {
    const res = (u: UnitId | undefined, via: 'silver' | 'scroll') => this.h.send({ t: 'way', action: 'res', ...(u ? { u } : {}), via, rid: resRid() });
    root.querySelectorAll<HTMLButtonElement>('[data-wres]').forEach((b) => (b.onclick = () => {
      b.disabled = true;
      res(b.dataset.wres as UnitId, 'silver');
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-wscroll]').forEach((b) => (b.onclick = () => {
      b.disabled = true;
      res(b.dataset.wscroll as UnitId, 'scroll');
    }));
    const all = root.querySelector<HTMLButtonElement>('[data-wall]');
    if (all) all.onclick = () => {
      all.disabled = true;
      res(undefined, 'silver');
    };
    root.querySelector<HTMLElement>('[data-winstant]')?.addEventListener('click', () => this.h.instant());
    root.querySelector<HTMLElement>('[data-whire]')?.addEventListener('click', () => this.h.hire());
    root.querySelector<HTMLElement>('[data-wrepair]')?.addEventListener('click', () => this.h.send({ t: 'way', action: 'repair' }));
    root.querySelector<HTMLElement>('[data-wshop]')?.addEventListener('click', () => this.h.shop());
    root.querySelector<HTMLElement>('[data-wclose]')?.addEventListener('click', () => this.h.close());
    void v;
  }
}

/** The boarding result's card: her fallen and the quick «Воскресить» where she stands (the field surgeon's price), or
 *  at once for doubloons far from any waystation. */
export function fallenCard(v: ResView | null): string {
  if (!v || !v.rows.length) return '';
  const quick = v.place !== 'none' ? priceHtml(v) : '';
  const can = v.n > 0 && !v.why && (v.place !== 'none' ? v.silver <= v.gold && v.doubloons <= v.balance : false);
  const btn = v.place !== 'none'
    ? `<button class="btn btn-small btn-primary" data-fres${can ? '' : ' disabled'}>${esc(L('board.btn'))}${quick ? ` <span class="way-sum">${quick}</span>` : ''}</button>`
    : v.instant > 0 ? `<button class="btn btn-small btn-primary" data-finstant>${esc(L('instant'))} <span class="way-sum">${doubloons(v.instant)}</span></button>` : '';
  // (one line on the result: its fates stay where they were on a phone held sideways)
  const why = v.why ? serverText(v.why) : v.n <= 0 ? serverText(v.rows.find((r) => r.why)?.why ?? '') : v.n < v.fallen ? L('room', { k: v.n, n: v.fallen }) : '';
  const note = [why, v.place === 'field' ? L('note.fieldShort') : ''].filter(Boolean).join(' · ');
  const tip = [L('board.t', { n: v.fallen }), v.place === 'field' ? L('note.field') : v.place === 'none' ? L('note.none') : ''].filter(Boolean).join(' ');
  return `<div class="card way-card" title="${esc(tip)}">${icon('prof_surgeon', '', 'ico-md')}<div class="wc-t"><b>${esc(L('board.h'))}: ${fmt(v.fallen)}</b>${note ? `<span class="${why && v.n <= 0 ? 'way-why' : 'muted'}">${esc(note)}</span>` : ''}</div>${btn}</div>`;
}

/** The card put into its slot on the boarding's result (`[data-fallen-slot]`) and its buttons bound — again when her
 *  fallen change, without drawing the result anew (its sliders keep their place). */
export function mountFallen(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const slot = root.querySelector<HTMLElement>('[data-fallen-slot]');
  if (!slot) return;
  slot.innerHTML = fallenCard(state.fallen);
  const quick = slot.querySelector<HTMLButtonElement>('[data-fres]');
  if (quick) quick.onclick = () => {
    quick.disabled = true;
    send({ t: 'way', action: 'res', via: 'silver', rid: resRid() });
  };
  const now = slot.querySelector<HTMLButtonElement>('[data-finstant]');
  if (now) now.onclick = () => {
    now.disabled = true;
    send({ t: 'premium', action: 'shop', offer: 'refill', pid: resRid() });
  };
}

/** The port's tavern card: the surgeon. */
export function surgeonCard(v: ResView | null): string {
  const n = v?.fallen ?? 0;
  return `<div class="card way-surgeon"><h4 class="card-h">${icon('prof_surgeon', '', 'ico-md')}${esc(L('port.h'))}</h4><p class="muted">${esc(L('port.t'))}${n > 0 ? ` ${esc(L('sub.res', { n }))}.` : ''}</p><button class="btn btn-small${n > 0 ? ' btn-primary' : ''}" data-surgeon>${esc(L('port.btn'))}</button></div>`;
}

export const wayL = L;
