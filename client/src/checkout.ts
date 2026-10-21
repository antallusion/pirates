// The web game's top-up through YooKassa (owner, 2026-10-21: «подключай кассу на сайт и в игре, но вк версию и тг не
// трогай, там свои платежки»). In the browser only — Telegram's Mini App keeps its Stars (tg.ts), VK its votes (vk.ts):
// ui/price.ts asks for a checkout only when payIn() is roubles. No name typed: the server makes the order for the
// session's own account (server/src/game/webshop.ts gameCheckout) and sends YooKassa's page, opened here in a tab of its
// own so the game stays where it was — and a purchase waiting for the doubloons (price.ts) with it. Paid, the provider's
// notice credits the doubloons and the waiting purchase goes by itself; meanwhile this tab asks the server about the
// order every few seconds (the notice may be late) and at once when the page comes back (/api/site/pay/back tells its
// opener, or, opened in place of the game, brings her back to /play?yk=<order>).

import type { ServerMsg } from '../../shared/src/protocol.ts';
import { dict } from './i18n.ts';
import { EN, RU } from './lang/ui/premium.ts';
import type { Net } from './net.ts';
import { ask } from './ui/confirm.ts';

const L = dict(EN, RU);

/** The checkout takes her payment (the server's word: YooKassa live, or the test mode open to her). */
let open = false;
export const webPayOpen = (): boolean => open;

/** The orders being paid now, and until when they are asked about. */
const watching = new Map<string, number>();
const ASK_MS = 5000;
const WATCH_MS = 20 * 60_000;
const ORDER = /^[0-9a-f]{24}$/;

/** The purchase waiting for this top-up stops waiting (price.ts listens): the order was cancelled or failed. */
const unpaid = () => dispatchEvent(new CustomEvent('gravetide:pay', { detail: 'cancelled' }));

/** The order's page opened: a tab of its own (the game stays); a blocked one asked again on her tap; refused even so, the
 *  page in place of the game (the waiting purchase kept for her return: price.ts stashPending). */
function openPage(url: string, stash: () => void): void {
  const tab = (): Window | null => {
    try {
      return window.open(url, 'gravetide-pay');
    } catch {
      return null;
    }
  };
  if (tab()) return;
  void ask(L('yk.opened'), L('yk.open'), L('yk.cancel')).then((ok) => {
    if (!ok) return unpaid();
    if (tab()) return;
    stash();
    location.assign(url);
  });
}

export function webCheckouts(net: Net, toast: (msg: string, kind: string) => void, stash: () => void = () => {}): void {
  const check = (id: string) => net.send({ t: 'premium', action: 'checkout_check', order: id });
  // back from the checkout in place of the game: the order asked about as soon as she is aboard
  let back: string | null = null;
  try {
    const u = new URL(location.href);
    const yk = u.searchParams.get('yk');
    if (yk && ORDER.test(yk)) {
      back = yk;
      u.searchParams.delete('yk');
      history.replaceState(history.state, '', u.pathname + (u.search.length > 1 ? u.search : '') + u.hash);
    }
  } catch {
    back = null;
  }
  net.on((m: ServerMsg) => {
    if (m.t === 'premium') open = !!m.view.web;
    else if (m.t === 'captain_shop') open = !!m.web;
    else if (m.t === 'doubloons' && back) {
      watching.set(back, Date.now() + WATCH_MS);
      check(back);
      back = null;
    } else if (m.t === 'premium_checkout') {
      if (m.url && m.order) {
        watching.set(m.order, Date.now() + WATCH_MS);
        toast(L('yk.opened'), 'info');
        openPage(m.url, stash);
      } else if (!m.order) unpaid(); // (no page: the server said why)
      else if (m.status === 'done' || m.status === 'canceled' || m.status === 'failed') {
        watching.delete(m.order);
        if (m.status !== 'done') {
          unpaid();
          toast(L('yk.canceled'), 'info');
        }
      }
    }
  });
  if (typeof addEventListener !== 'function') return; // (no window: the tests)
  // the checkout's page back in its own tab: it tells this one
  addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { t?: unknown; order?: unknown } | null;
    if (e.origin !== location.origin || !d || d.t !== 'gravetide:checkout' || typeof d.order !== 'string' || !ORDER.test(d.order)) return;
    check(d.order);
  });
  // the game's tab looked at again, and every few seconds while an order is open
  const sweep = () => {
    const now = Date.now();
    for (const [id, until] of watching) if (until < now) watching.delete(id);
    else check(id);
  };
  addEventListener('focus', sweep);
  setInterval(() => watching.size && sweep(), ASK_MS);
}
