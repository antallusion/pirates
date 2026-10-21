// The web game's top-up through YooKassa (owner, 2026-10-21: «подключай кассу на сайт и в игре, но вк версию и тг не
// трогай, там свои платежки»). In the browser only — Telegram's Mini App keeps its Stars (tg.ts), VK its votes (vk.ts):
// ui/price.ts asks for a checkout only when payIn() is roubles. No name typed: the server makes the order for the
// session's own account (server/src/game/webshop.ts gameCheckout) and sends YooKassa's page, opened here in a tab of its
// own so the game stays where it was — and a purchase waiting for the doubloons (price.ts) with it. Paid, the provider's
// notice credits the doubloons and the waiting purchase goes by itself; meanwhile this tab asks the server about the
// order every few seconds (the notice may be late) and at once when the page comes back (/api/site/pay/back tells its
// opener, or, opened in place of the game, brings her back to /play?yk=<order>).

import type { ClientMsg, ServerMsg } from '../../shared/src/protocol.ts';
import { dict, lang } from './i18n.ts';
import { EN, RU } from './lang/ui/premium.ts';
import type { Net } from './net.ts';
import { ask } from './ui/confirm.ts';
import { esc } from './ui/dom.ts';
import { buttonHtml } from './ui/kit/button.ts';
import { openSheet } from './ui/kit/sheet.ts';

const L = dict(EN, RU);

/** The checkout takes her payment (the server's word: YooKassa live, or the test mode open to her). */
let open = false;
export const webPayOpen = (): boolean => open;

/** The receipt's e-mail (owner, 2026-10-21: live 54-FZ receipts): the server says when none is known for her account
 *  (`webEmail` of the shop's view); the e-mail typed here is kept for this page, and on the server only if she ticks it. */
let mailNeeded = false;
let pageMail: string | null = null;
export const MAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
/** For the tests: what the checkout knows of the e-mail. */
export const mailState = (): { needed: boolean; page: string | null } => ({ needed: mailNeeded, page: pageMail });

/** The top-up's order for a pack: straight to the server when an e-mail is known (or none is needed), else the e-mail
 *  asked first, inline (one field, checked), and the order sent with it. */
export function sendCheckout(send: (m: ClientMsg) => void, pack: string): void {
  const l = lang() === 'ru' ? 'ru' : 'en';
  if (!mailNeeded || pageMail) return send({ t: 'premium', action: 'checkout', pack, lang: l, ...(pageMail ? { email: pageMail } : {}) });
  askMail(send, pack);
}

/** The one field of the e-mail, a box to keep it, «Перейти к оплате»; cancelled — the waiting purchase stops waiting. */
function askMail(send: (m: ClientMsg) => void, pack: string): void {
  if (typeof document === 'undefined') return;
  document.getElementById('yk-mail')?.remove();
  let done = false;
  const sheet = openSheet({
    id: 'yk-mail', title: L('yk.mailTitle'), cls: 'yk-mail-panel', height: 'auto',
    body: `<p class="yk-mail-lead">${esc(L('yk.mailLead'))}</p>
      <label class="yk-mail-f"><span>${esc(L('yk.mailField'))}</span><input type="email" inputmode="email" autocomplete="email" maxlength="254" spellcheck="false" data-ykmail placeholder="name@mail.ru"></label>
      <p class="yk-mail-bad hidden" role="alert">${esc(L('yk.mailBad'))}</p>
      <label class="check yk-mail-save"><input type="checkbox" data-yksave> ${esc(L('yk.mailSave'))}</label>`,
    foot: `${buttonHtml({ kind: 'primary', size: 'md', label: L('yk.mailGo'), data: { ykgo: '1' } })}${buttonHtml({ kind: 'secondary', size: 'md', label: L('yk.cancel'), data: { ykno: '1' } })}`,
    onClose: () => {
      if (!done) unpaid();
    },
  });
  const input = sheet.panel.querySelector<HTMLInputElement>('[data-ykmail]')!;
  const bad = sheet.panel.querySelector<HTMLElement>('.yk-mail-bad')!;
  const go = () => {
    const v = input.value.trim().toLowerCase();
    if (!MAIL_RE.test(v)) {
      bad.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const save = !!sheet.panel.querySelector<HTMLInputElement>('[data-yksave]')?.checked;
    pageMail = v;
    if (save) mailNeeded = false;
    done = true;
    sheet.close('button');
    send({ t: 'premium', action: 'checkout', pack, lang: lang() === 'ru' ? 'ru' : 'en', email: v, ...(save ? { save: true } : {}) });
  };
  input.addEventListener('input', () => {
    bad.classList.add('hidden');
    input.removeAttribute('aria-invalid');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
  sheet.panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ykgo], [data-ykno]');
    if (!b) return;
    if (b.dataset.ykgo) go();
    else sheet.close('button');
  });
  input.focus({ preventScroll: true });
}

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
    if (m.t === 'premium') {
      open = !!m.view.web;
      mailNeeded = !!m.view.webEmail;
    }
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
      } else if (m.needEmail) {
        // the receipt wants her e-mail (none known, or the one typed was refused): asked inline, the order sent again
        mailNeeded = true;
        pageMail = null;
        askMail((x) => net.send(x), m.pack);
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
