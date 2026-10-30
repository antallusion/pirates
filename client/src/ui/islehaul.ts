// The island's «Завезти» card (Нефигугум, forum 2026-10-29: «А можно как то серебро и ресы (дерево/смола/железо/
// провизия) завезти на остров?»): the captain's silver into the treasury from anywhere, the hold into the yard lying
// off the island (its cap holds), and the barge for those without a ship to spare. The island scene's side bar opens it,
// and so does a tap on the treasury in its top bar.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { BARGE, BARGE_MUL, YARD_GOODS } from '../../../shared/src/data/base.ts';
import type { BaseRes } from '../../../shared/src/data/base.ts';
import type { BaseView, ClientMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/islehaul.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';

export const HL = dict(EN, RU);

export function haulCard(v: BaseView, state: ClientState): string {
  const gold = Math.max(0, Math.floor(state.self?.gold ?? 0));
  const tre = Math.max(0, Math.floor(v.claim?.treasury ?? 0));
  const def = Math.min(gold, 1000);
  const treasury = `<div class="card ih-card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(HL('treH'))}</h4>
    <p>${esc(HL('treNow', { t: fmt(tre), g: fmt(gold) }))}</p>
    <div class="ih-row"><label>${esc(HL('amount'))} <input class="field" type="number" min="1" step="100" value="${def || 1}" data-ihamt></label>
      <button class="btn btn-small btn-primary" data-ihdep${gold > 0 ? '' : ' disabled'}>${icon('coin', '', 'ico-sm')}${esc(HL('deposit'))}</button>
      <button class="btn btn-small" data-ihall${gold > 0 ? '' : ' disabled'}>${esc(HL('depositAll'))} · ${money(gold)}</button>
      <button class="btn btn-small" data-ihout${tre > 0 ? '' : ' disabled'} title="${esc(HL('withdrawHint'))}">${esc(HL('withdraw'))}</button></div>
    <p class="muted">${esc(HL('treHint'))} ${esc(HL('withdrawHint'))}</p></div>`;
  const cargo = state.self?.cargo ?? {};
  const aboard = YARD_GOODS.filter((g) => Math.floor(cargo[g] ?? 0) > 0);
  const cap = v.store[0]?.cap ?? 0;
  const rows = aboard.map((g) => {
    const a = Math.floor(cargo[g] ?? 0);
    const inYard = v.store.find((r) => r.good === g);
    const full = !!inYard && inYard.n >= inYard.cap;
    const line = inYard ? HL('row', { a: fmt(a), y: fmt(inYard.n), cap: fmt(cap) }) : HL('rowA', { a: fmt(a) });
    return `<div class="ih-good">${icon(`good_${g}`, '', 'ico-md')}<span class="ih-gn"><b>${esc(GOODS[g].name)}</b><br><span class="muted">${esc(line)}</span></span>
      <button class="btn btn-small btn-primary" data-ihun="${g}"${!v.near || full ? ' disabled' : ''}>${esc(full ? HL('full') : HL('unloadAll'))}</button></div>`;
  }).join('');
  const yard = `<div class="card ih-card"><h4 class="card-h">${icon('ui_chest', '', 'ico-md')}${esc(HL('yardH'))}</h4>
    <p class="muted">${esc(HL('yardHint'))}</p>
    ${v.near ? '' : `<p class="tw-why">${esc(HL('yardFar'))}</p>`}
    ${rows || `<p class="muted">${esc(HL('yardNone'))}</p>`}</div>`;
  // The barge (Нефигугум, post 26: «Кто такой лист острова? … где там кнопка отправить»): its own button here, what it
  // brings, the price and that it comes at once — from anywhere, at sea or in port (server: base.ts orderBarge).
  const hall = Math.max(1, v.hall ?? 1);
  const bc = bargeCostOf(v.store, hall);
  const short = bc > 0 && gold + tre < bc;
  const barge = `<div class="card ih-card ih-barge"><h4 class="card-h">${icon('good_timber', '', 'ico-md')}${esc(HL('bargeH'))}</h4>
    <p>${esc(HL('bargeLine', { t: fmt((BARGE.timber ?? 0) * hall), c: fmt((BARGE.coal ?? 0) * hall), i: fmt((BARGE.iron ?? 0) * hall) }))}</p>
    <div class="ih-row"><button class="btn btn-primary" data-ihbarge${!bc || short ? ' disabled' : ''}>${icon('good_timber', '', 'ico-sm')}${esc(HL('bargeBtn'))}${bc ? ` · ${money(bc)}` : ''}</button></div>
    <p class="muted">${esc(!bc ? HL('bargeFull') : short ? HL('bargeShort', { n: fmt(bc - gold - tre) }) : HL('bargeHint'))}</p></div>`;
  return `<div class="ih">${treasury}${barge}${yard}</div>`;
}

/** What a barge of building stuff costs now, by the yard's room (docs/30; server: base.ts orderBarge, bargeCost). */
export function bargeCostOf(store: { good: string; n: number; cap: number }[], hall: number): number {
  let cost = 0;
  for (const [g, n0] of Object.entries(BARGE) as [BaseRes, number][]) {
    const n = n0 * hall; // as big as her town hall (server: bargeSize)
    const row = store.find((x) => x.good === g);
    const room = row ? Math.max(0, Math.floor(row.cap - row.n)) : n;
    cost += Math.round(Math.min(n, room) * GOODS[g].basePrice * BARGE_MUL);
  }
  return cost;
}

export function bindHaul(root: HTMLElement, v: BaseView, state: ClientState, send: (m: ClientMsg) => void): void {
  const amt = () => Math.max(0, Math.floor(Number(root.querySelector<HTMLInputElement>('[data-ihamt]')?.value) || 0));
  root.querySelector<HTMLElement>('[data-ihdep]')?.addEventListener('click', () => {
    const n = Math.min(amt(), Math.floor(state.self?.gold ?? 0));
    if (n > 0) send({ t: 'base', action: 'deposit', n });
  });
  root.querySelector<HTMLElement>('[data-ihall]')?.addEventListener('click', () => {
    const n = Math.floor(state.self?.gold ?? 0);
    if (n > 0) send({ t: 'base', action: 'deposit', n });
  });
  root.querySelector<HTMLElement>('[data-ihout]')?.addEventListener('click', () => {
    const n = Math.min(amt(), Math.floor(v.claim?.treasury ?? 0));
    if (n > 0) send({ t: 'base', action: 'withdraw', n });
  });
  root.querySelector<HTMLButtonElement>('[data-ihbarge]')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    send({ t: 'base', action: 'barge' });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-ihun]').forEach((el) => (el.onclick = () => {
    el.disabled = true;
    send({ t: 'base', action: 'unload', good: el.dataset.ihun as GoodId, n: 0 });
  }));
}
