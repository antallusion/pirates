// The «sell before you buy» advisor (owner, 2026-10-21: «еще нужен обработчик который советует что-то продать, прежде
// чем купить»): a purchase refused for its one real reason (the server's `buyfail`, shared/src/data/buyfail.ts) is not
// a dead-end toast —
//   room      — «Нет места в трюме: нужно 6 м³, свободно 0», what to sell here (the server's plan: the goods this harbour
//               pays well for first, then the cheapest for their room; never quest cargo, never the voyage's minimum),
//               each with its price and the room it frees; «Продать и купить» (one order, done at once on the server),
//               «Продать вручную» (the market's list), «Купить, сколько влезет»;
//   notsold   — where it IS sold: the nearest harbours, a course to each;
//   stock     — how many the harbour has (buy those), and where there is more;
//   hammocks  — the crew full: said so, and the hands that could be paid off.
// The purse, a lock, a slot: the toast says it with its numbers (nothing to do here but read it).

import type { BuyFail } from '../../../shared/src/data/buyfail.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/buyadvice.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { buttonHtml } from './kit/button.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);

export interface AdviceCtx {
  state: ClientState;
  send: (m: ClientMsg) => void;
  /** The market's list (her goods to sell by hand). */
  market: () => void;
  /** A course to a harbour (the helmsman takes her there). */
  sailTo: (port: string) => void;
}

/** The refusals the advisor draws (the rest are told by the toast alone). */
export function adviceFor(f: BuyFail): boolean {
  if (f.why === 'room') return true;
  if (f.why === 'hammocks') return true;
  if (f.why === 'notsold') return true;
  return f.why === 'stock' && ((f.can ?? 0) > 0 || !!f.sellers?.length);
}

let open: SheetHandle | null = null;

const gName = (g: string) => (GOODS[g as keyof typeof GOODS]?.name ?? g).toLowerCase();
const m3 = (n: number) => String(Math.round(n * 10) / 10).replace('.', lang() === 'ru' ? ',' : '.');

function sellersHtml(f: BuyFail): string {
  const list = f.sellers ?? [];
  if (!list.length) return `<p class="muted ba-note">${esc(L('noSellers'))}</p>`;
  return `<p class="ba-sub">${esc(L('sellers'))}</p><div class="ba-list">${list.map((x) => `<div class="w-row ba-row">
    <span class="w-row-t"><b>${esc(placeName(x.name))}</b><small>${esc(L('seller', { n: x.stock, price: fmt(x.price) }))}</small></span>
    <span class="w-row-b">${buttonHtml({ kind: 'secondary', size: 'md', label: L('course', { km: (x.dist / 1000).toFixed(1) }), data: { ba: 'sail', port: x.port } })}</span></div>`).join('')}</div>`;
}

/** The advisor for a refused purchase (a sheet from the bottom edge; the toast stays quiet). */
export function showAdvice(f: BuyFail, ctx: AdviceCtx): SheetHandle | null {
  if (!adviceFor(f)) return null;
  open?.close('code');
  const port = ctx.state.ports.find((p) => p.id === ctx.state.self?.dockedAt);
  const portName = placeName(port?.name ?? '');
  const good = f.good ? gName(f.good) : '';
  let title = '', body = '', foot = '';
  if (f.why === 'room') {
    const need = Math.max(0, (f.need ?? 0) - (f.free ?? 0));
    const plan = f.plan ?? [];
    const covers = (f.planFree ?? 0) + 1e-6 >= need && plan.length > 0;
    title = L('room.title');
    const lead = f.pickup ? `${L('room.pickup', { n: f.want, good })} ` : '';
    body = `<p class="ba-lead"><b>${esc(lead + L('room.lead', { need: m3(f.need ?? 0), free: m3(f.free ?? 0), n: f.want, good }))}</b></p>
      ${plan.length ? `<p class="ba-sub">${esc(L('room.plan'))}</p><div class="ba-list">${plan.map((l) => `<div class="w-row ba-row" data-good="${l.good}">${icon(`good_${l.good}`, '', 'w-row-ico')}
        <span class="w-row-t"><b>${esc(L('room.line', { n: l.qty, good: gName(l.good) }))}</b><small>${esc(L('room.frees', { v: m3(l.vol) }))}</small></span>
        <span class="w-row-n">+${money(l.price)}</span></div>`).join('')}</div>` : `<p class="muted ba-note">${esc(L('room.none'))}</p>`}
      ${plan.length && !covers ? `<p class="muted ba-note">${esc(L('room.short', { v: m3(f.planFree ?? 0), need: m3(need) }))}</p>` : ''}`;
    foot = `${covers ? buttonHtml({ kind: 'primary', size: 'md', id: 'ba-go', label: f.pickup ? L('room.sellOnly') : L('room.sellBuy'), data: { ba: f.pickup ? 'sell' : 'sellbuy' } }) : ''}${!f.pickup && (f.can ?? 0) > 0 ? buttonHtml({ kind: 'secondary', size: 'md', label: L('room.fit', { n: f.can! }), data: { ba: 'fit' } }) : ''}${buttonHtml({ kind: covers ? 'secondary' : 'primary', size: 'md', label: L('room.manual'), data: { ba: 'manual' } })}`;
  } else if (f.why === 'notsold') {
    title = L('nots.title');
    body = `<p class="ba-lead"><b>${esc(L('nots.lead', { port: portName, good }))}</b></p>${sellersHtml(f)}`;
  } else if (f.why === 'stock') {
    title = L('stock.title');
    const have = f.can ?? 0;
    body = `<p class="ba-lead"><b>${esc(have > 0 ? L('stock.lead', { port: portName, have, n: f.want, good }) : L('stock.none', { port: portName, good }))}</b></p>${f.sellers?.length ? sellersHtml(f) : ''}`;
    foot = have > 0 ? buttonHtml({ kind: 'primary', size: 'md', id: 'ba-go', label: L('stock.buy', { n: have }), data: { ba: 'fit' } }) : '';
  } else if (f.why === 'hammocks') {
    title = L('ham.title');
    body = `<p class="ba-lead"><b>${esc(L('ham.lead', { crew: f.crew ?? 0, max: f.crewMax ?? 0 }))}</b></p><p class="muted ba-note">${esc(L('ham.full'))}</p>`;
  }
  foot += buttonHtml({ kind: 'secondary', size: 'md', label: L('cancel'), data: { ba: 'close' } });
  const sheet = openSheet({ title, body, foot, cls: 'ba-panel', height: 'auto', id: 'buy-advice', onClose: () => { if (open === sheet) open = null; } });
  open = sheet;
  sheet.panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ba]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    const what = b.dataset.ba!;
    sheet.close('button');
    if (what === 'sellbuy' && f.good) ctx.send({ t: 'sellbuy', good: f.good, qty: f.want });
    else if (what === 'sell') for (const l of f.plan ?? []) ctx.send({ t: 'trade', good: l.good, qty: -l.qty });
    else if (what === 'fit' && f.good && (f.can ?? 0) > 0) ctx.send({ t: 'trade', good: f.good, qty: f.can! });
    else if (what === 'manual') ctx.market();
    else if (what === 'sail' && b.dataset.port) ctx.sailTo(b.dataset.port);
  });
  sheet.panel.querySelector<HTMLElement>('#ba-go, [data-ba="manual"], [data-ba="close"]')?.focus({ preventScroll: true });
  return sheet;
}

/** The advisor up now (tests, the guide's finger). */
export function adviceOpen(): boolean {
  return !!open?.open;
}
