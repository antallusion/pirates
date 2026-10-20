// The Telegram notices' switches in the game (owner, 2026-10-16: «Настройки → Уведомления в Телеграме»; the server's
// rules: server/src/game/tgnotify.ts). Only for a captain with Telegram linked (the server sends `tgn` to her alone):
// all of them on or off, and each kind; the day's count and the quiet hours said under them; a bot she blocked is
// told. In the Mini App, turning them on asks Telegram's write access first (requestWriteAccess), so the bot may write.
// Also: a notice's «Играть» opened the Mini App — its kind (start parameter `n_<kind>`, or `?n=` on the address) is
// told to the server once, for the funnel.

import { TGN_CATS } from '../../../shared/src/data/telegram.ts';
import type { TgnCat, TgnView } from '../../../shared/src/data/telegram.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/dailygift.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import { esc } from './dom.ts';
import { inVk, vkLaunchHash } from '../vk.ts';

const L = dict(EN, RU);
const W = dict(WIN_EN, WIN_RU);

let view: TgnView | null = null;
let send: ((m: ClientMsg) => void) | null = null;

type TgWin = { WebApp?: { requestWriteAccess?: (cb: (ok: boolean) => void) => void; isVersionAtLeast?: (v: string) => boolean; initData?: string; initDataUnsafe?: { start_param?: string } } };
const tgApp = () => (globalThis as { Telegram?: TgWin }).Telegram?.WebApp;

/** The kind of notice the Mini App was opened from, or null. Pure but for the page's address and Telegram's data. */
export function noticeKind(search = location.search, hash = location.hash, startParam = tgApp()?.initDataUnsafe?.start_param): string | null {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const sp = startParam ?? q.get('tgWebAppStartParam') ?? h.get('tgWebAppStartParam') ?? '';
  const m = /^n_([a-z]{3,8})$/.exec(sp);
  // (VK: the notice's fragment #n_<kind>, kept by vk.ts before the game's start wiped the address — docs/36)
  const k = m?.[1] ?? q.get('n') ?? /(?:^#?|&)n_([a-z]{3,8})/.exec(hash || vkLaunchHash)?.[1] ?? '';
  return (TGN_CATS as string[]).includes(k) ? k : null;
}

/** main.ts: the wire. The switches' view as it comes; the notice's tap told once, after coming aboard. */
export function initTgNotices(sendFn: (m: ClientMsg) => void, on: (f: (m: ServerMsg) => void) => void): void {
  send = sendFn;
  let told = false;
  on((m) => {
    if (m.t === 'tgn') {
      view = m.view;
      dispatchEvent(new CustomEvent('gravetide:tgn'));
    }
    if (!told && (m.t === 'gift' || m.t === 'tgn')) {
      told = true;
      const k = noticeKind();
      if (k) sendFn({ t: 'premium', action: 'tgn_click', cat: k });
    }
  });
}

export function tgnView(): TgnView | null {
  // (inside VK nothing of Telegram's is shown: docs/36)
  return inVk() ? null : view;
}

/** A switch: all of them or one kind. Turning them on in the Mini App asks Telegram's write access first. */
export function tgnSet(cat: TgnCat | 'all', on: boolean): void {
  const go = () => send?.({ t: 'premium', action: 'tgn_set', cat, on, lang: lang() === 'ru' ? 'ru' : 'en' });
  const w = tgApp();
  let asked = false;
  try {
    if (on && cat === 'all' && w?.requestWriteAccess && (!w.isVersionAtLeast || w.isVersionAtLeast('6.9'))) {
      asked = true;
      w.requestWriteAccess(() => go());
    }
  } catch {
    asked = false;
  }
  if (!asked) go();
}

const sw = (k: string, on: boolean, label: string, disabled = false) =>
  `<button type="button" class="w-switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-tgn="${k}"${disabled ? ' disabled' : ''}><i aria-hidden="true"></i><span>${esc(on ? W('opt.on') : W('opt.off'))}</span></button>`;

/** The section (the options' «Уведомления в Телеграме» tab), or '' with no Telegram linked. */
export function tgnHtml(): string {
  const v = view;
  if (!v) return '';
  const rows = TGN_CATS.map((c) => `<div class="tgn-row${v.on ? '' : ' off'}"><span>${esc(L(`tgn.${c}` as 'tgn.build'))}</span>${sw(c, v.cats[c], L(`tgn.${c}` as 'tgn.build'), !v.on)}</div>`).join('');
  return `<div class="tgn">
    <div class="tgn-row"><span><b>${esc(L('tgn.all'))}</b></span>${sw('all', v.on, L('tgn.all'))}</div>
    ${v.blocked ? `<p class="tgn-bad">${esc(L('tgn.blocked'))}</p>` : ''}
    <p class="tgn-hint">${esc(L('tgn.hint'))} <span class="tgn-sent">${esc(L('tgn.sent', { n: v.sent, cap: v.cap }))}</span></p>
    <div class="tgn-grid">${rows}</div></div>`;
}

/** The section's switches wired (`redraw` after each). */
export function wireTgn(root: HTMLElement, redraw: () => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-tgn]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.tgn as TgnCat | 'all';
    const v = view;
    if (!v) return;
    const on = k === 'all' ? !v.on : !v.cats[k];
    // at once on the screen; the server's view follows
    view = k === 'all' ? { ...v, on, blocked: on ? false : v.blocked } : { ...v, cats: { ...v.cats, [k]: on } };
    tgnSet(k, on);
    redraw();
  }));
}
