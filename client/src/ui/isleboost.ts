// Finishing an island work (owner, 2026-10-29: «на острове завершить сразу за серебро продается, а надо за дублоны и
// ускорители»): every work under way — a building, a town building, a ship of the yard — shows two buttons, no silver:
//  - «⌛ Ускорить (ускорители: N)»: the server spends her speed-ups on it (shop.ts useSpeed: the free tokens first, then
//    the shop's minutes) and the toast says how much time is left; with none, the shop's speed-ups shelf opens;
//  - «Завершить за ◉ N дублонов»: asked once more, then the shop's finishNow (its price: finishPrice, the shop's own
//    rate); short of doubloons, the top-up opens.

import { finishPrice } from '../../../shared/src/data/shop.ts';
import type { BaseView, ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, plural } from '../i18n.ts';
import { EN, RU } from '../lang/ui/base.ts';
import { EN as P_EN, RU as P_RU } from '../lang/ui/premium.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon } from './dom.ts';
import { doubloonIcon, priceText } from './price.ts';

const L = dict(EN, RU);
const P = dict(P_EN, P_RU);

/** What she has to speed up with (the island's view). */
export interface BoostStore {
  speedups: number;
  tokenSecs: number;
  speedMin: number;
}

const pid = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function span(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  if (s < 60) return L('t_s', { s });
  const m = Math.ceil(s / 60);
  return m < 60 ? L('t_m', { m }) : L('t_hm', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') });
}

const dblWord = (n: number): string => plural(n, P('dbl.one'), P('dbl.few'), P('dbl.many'));
const dblHtml = (n: number): string => `${doubloonIcon('ico-xs')}<b>${fmt(n)}</b> ${esc(dblWord(n))}`;

/** The two buttons of a work under way. */
export function boostHtml(j: { id: number; end: number; doubloons: number }, v: BoostStore): string {
  const have = `${fmt(v.speedups)}${v.speedMin > 0 ? ` + ${span(v.speedMin * 60)}` : ''}`;
  return `<div class="bspeed ibst"><button class="btn btn-small ibst-up" data-iboost="${j.id}" title="${esc(L('boost_tip', { m: v.tokenSecs / 60 }))}">${icon('ui_hourglass', '⌛', 'ico-xs')} ${esc(L('boost'))} <span class="muted">(${esc(L('boost_have', { n: have }))})</span></button>
    <button class="btn btn-small btn-primary ibst-fin" data-ifin="${j.id}" data-end="${j.end}" title="${esc(L('fin_tip'))}">${esc(L('fin_dbl'))} <span data-dblprice="${j.end}">${dblHtml(j.doubloons)}</span></button></div>`;
}

let pending: { job: number; at: number } | null = null;

/** The buttons wired: `now` the server's wall clock, `balance` her doubloons. */
export function wireBoost(root: HTMLElement, o: { send: (m: ClientMsg) => void; store: BoostStore; balance: () => number; now: () => number }): void {
  root.querySelectorAll<HTMLButtonElement>('[data-iboost]').forEach((b) => (b.onclick = () => {
    if (o.store.speedups <= 0 && o.store.speedMin <= 0) {
      dispatchEvent(new CustomEvent('gravetide:shop', { detail: 'isle' }));
      return;
    }
    b.disabled = true;
    pending = { job: Number(b.dataset.iboost), at: Date.now() };
    o.send({ t: 'premium', action: 'speed', job: Number(b.dataset.iboost) });
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-ifin]').forEach((b) => (b.onclick = () => {
    const price = finishPrice((Number(b.dataset.end) - o.now()) / 1000);
    if (o.balance() < price) {
      dispatchEvent(new CustomEvent('gravetide:shop', { detail: 'topup' }));
      return;
    }
    const msg: ClientMsg = { t: 'premium', action: 'finish', job: Number(b.dataset.ifin), pid: pid() };
    void ask(L('fin_ask', { n: priceText(price) })).then((ok) => {
      if (!ok) return;
      b.disabled = true;
      o.send(msg);
    });
  }));
}

/** Every second: the doubloons' price by the time left. */
export function tickBoost(root: HTMLElement, now: number): void {
  root.querySelectorAll<HTMLElement>('[data-dblprice]').forEach((el) => {
    const html = dblHtml(finishPrice((Number(el.dataset.dblprice) - now) / 1000));
    if (el.innerHTML !== html) el.innerHTML = html;
  });
}

/** A fresh view after «Ускорить»: what is left of that work (the jobs of the view: `ends` by id), told once. */
export function boostReport(ends: Map<number, number>, now: number): string | null {
  if (!pending) return null;
  if (Date.now() - pending.at > 15_000) {
    pending = null;
    return null;
  }
  const end = ends.get(pending.job);
  pending = null;
  return end !== undefined && end > now ? L('boost_left', { t: span((end - now) / 1000) }) : L('boost_done');
}

/** Every work of the island's view by its id: its end (the plots, the town, the yard's ships). */
export function jobEnds(v: BaseView): Map<number, number> {
  const out = new Map<number, number>();
  for (const c of v.cells) if (c.job) out.set(c.job.id, c.job.end);
  for (const t of v.town?.things ?? []) if (t.job) out.set(t.job.id, t.job.end);
  for (const x of v.shipyard?.ships ?? []) if (x.job) out.set(x.job.id, x.job.end);
  return out;
}
