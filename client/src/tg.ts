// Telegram on the client (owner, 2026-10-11: «сделай мне еще телеграм версию на поддомене tg … премиум шоп сделай
// звездами … подключаться к игре на начальном экране не только через почту, но и телеграм»; docs/27_TELEGRAM.md).
//  - The Mini App (tg.<host>, or opened inside Telegram): telegram-web-app.js loaded only then; ready, expand,
//    fullscreen and the orientation lock where the Bot API allows (8.0+ on phones), no vertical swipes; Telegram's
//    safe areas into the HUD's --sa-* insets; its BackButton closes the top window; the theme's colours on the
//    loading screen only; the sign-in by initData (POST /auth/tg/webapp).
//  - The website: «Войти через Телеграм» on the start screen and «Привязать Телеграм» in settings — a nonce from
//    POST /auth/tg/start, the bot's link opened, GET /auth/tg/poll every 2 s for at most 5 minutes.
//  - The shop's Stars: the invoice the server sends is opened by WebApp.openInvoice, or as a link (it opens Telegram).
// Without the bot's token on the server /auth/tg/config is a 404 and nothing of this shows.

import { dict } from './i18n.ts';
import { EN, RU } from './lang/ui/tg.ts';
import type { Net } from './net.ts';
import type { ServerMsg } from '../../shared/src/protocol.ts';
import { esc } from './ui/dom.ts';
import { ask } from './ui/confirm.ts';

const L = dict(EN, RU);

interface Inset { top: number; bottom: number; left: number; right: number }
type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/** What the game uses of window.Telegram.WebApp (every newer call feature-detected). */
export interface TgWebApp {
  initData: string;
  version?: string;
  platform?: string;
  themeParams?: { bg_color?: string; text_color?: string; hint_color?: string; button_color?: string; button_text_color?: string };
  isVersionAtLeast?(v: string): boolean;
  ready(): void;
  expand?(): void;
  requestFullscreen?(): void;
  lockOrientation?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  safeAreaInset?: Inset;
  contentSafeAreaInset?: Inset;
  onEvent?(ev: string, cb: () => void): void;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void };
  openInvoice?(url: string, cb?: (status: InvoiceStatus) => void): void;
}

type G = typeof globalThis & { Telegram?: { WebApp?: TgWebApp } };
const g = globalThis as G;

// Telegram hands a Mini App its launch data in the address's #hash; the game's own start wipes the hash (main.ts, the
// links back from letters), and this module is evaluated before it: the data is kept where telegram-web-app.js looks
// for it after a reload (sessionStorage), and its initData kept here.
const LAUNCH = (() => {
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has('tgWebAppData')) return null;
    sessionStorage.setItem('__telegram__initParams', JSON.stringify(Object.fromEntries(h)));
    return h.get('tgWebAppData');
  } catch {
    return null;
  }
})();

function storedLaunch(): boolean {
  try {
    return /tgWebAppData/.test(sessionStorage.getItem('__telegram__initParams') ?? '');
  } catch {
    return false;
  }
}

/** Served on the Telegram host (tg.<domain>; `?tg` for a local check). */
export function onTgHost(): boolean {
  return /^tg\./i.test(location.hostname) || new URLSearchParams(location.search).has('tg');
}

/** Opened inside Telegram (its launch data in the address, or kept from it, or a WebApp already there). */
export function inTelegram(): boolean {
  return !!LAUNCH || storedLaunch() || !!g.Telegram?.WebApp?.initData;
}

let webApp: TgWebApp | null = null;

/** The Mini App's WebApp: telegram-web-app.js loaded on the Telegram host or inside Telegram only (null elsewhere). */
async function loadWebApp(): Promise<TgWebApp | null> {
  if (g.Telegram?.WebApp) return g.Telegram.WebApp;
  if (!onTgHost() && !inTelegram()) return null;
  await new Promise<void>((done) => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = s.onerror = () => done();
    document.head.appendChild(s);
    setTimeout(done, 6000);
  });
  return g.Telegram?.WebApp ?? null;
}

// ------------------------------------------------------------------------------------------------ config

let config: Promise<{ enabled: boolean; bot: string; webapp: string } | null> | null = null;

/** The server's Telegram, or null (no bot token there: a 404). */
export function tgConfig(): Promise<{ enabled: boolean; bot: string; webapp: string } | null> {
  config ??= fetch('/auth/tg/config').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return config;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T & { error?: string }> {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as T & { error?: string };
  } catch {
    return { error: L('wait.failed') } as T & { error?: string };
  }
}

// ------------------------------------------------------------------------------------------------ the Mini App

const ANSWER = new Set(['boarding', 'sunk', 'mutiny', 'choice']);

/** Telegram's safe areas (the device's and its own controls') into the HUD's insets (styles.css --sa-*). */
function applyInsets(w: TgWebApp): void {
  const s = w.safeAreaInset, c = w.contentSafeAreaInset;
  const root = document.documentElement.style;
  for (const [k, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']] as const) {
    const px = Math.max(0, Math.round((s?.[side] ?? 0) + (c?.[side] ?? 0)));
    root.setProperty(`--sa-${k}`, `max(env(safe-area-inset-${side}, 0px), ${px}px)`);
    root.setProperty(`--tg-${side}`, `${px}px`);
  }
}

function setupMiniApp(w: TgWebApp): void {
  webApp = w;
  document.documentElement.classList.add('tg-app');
  const at = (v: string) => !!w.isVersionAtLeast?.(v);
  const phone = /^(android|ios)$/i.test(w.platform ?? '');
  try {
    w.ready();
    w.expand?.();
    // the game's own ink behind Telegram's bars (the theme's colours are for the loading screen only)
    if (at('6.1')) {
      w.setHeaderColor?.('#0b0d10');
      w.setBackgroundColor?.('#0b0d10');
    }
    if (at('7.10')) w.setBottomBarColor?.('#0b0d10');
    if (at('7.7')) w.disableVerticalSwipes?.();
    if (at('8.0') && phone) w.requestFullscreen?.();
  } catch {
    /* an older client: what it has */
  }
  // The game is played sideways: once the phone is turned, the orientation is locked there (Bot API 8 locks the
  // current one; upright, the «turn your phone» veil asks first — with a word on Telegram's auto-rotate).
  const lock = () => {
    if (at('8.0') && phone && innerWidth > innerHeight) {
      try {
        w.lockOrientation?.();
      } catch {
        /* not allowed here */
      }
    }
  };
  lock();
  addEventListener('resize', lock);
  const veil = document.querySelector('#rotate-lock small');
  if (veil && !document.querySelector('#rotate-lock .tg-rot')) veil.insertAdjacentHTML('afterend', `<small class="tg-rot">${esc(L('rotateTg'))}</small>`);
  applyInsets(w);
  for (const ev of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged']) w.onEvent?.(ev, () => applyInsets(w));
  // The BackButton: shown while a window is up (not one that must be answered), it closes it as Esc does.
  const modal = document.getElementById('modal');
  const panel = document.getElementById('modal-panel');
  const back = w.BackButton;
  if (modal && back) {
    const sync = () => (!modal.classList.contains('hidden') && !ANSWER.has(panel?.dataset.modal ?? '') ? back.show() : back.hide());
    const mo = new MutationObserver(sync);
    mo.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (panel) mo.observe(panel, { attributes: true, attributeFilter: ['data-modal'] });
    back.onClick(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    sync();
  }
}

/** The loading screen of the Mini App's sign-in, in Telegram's theme colours. */
function bootScreen(w: TgWebApp | null, text: string, failed = false): void {
  let el = document.getElementById('tg-boot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tg-boot';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  const th = w?.themeParams ?? {};
  if (th.bg_color) el.style.setProperty('--tgb-bg', th.bg_color);
  if (th.text_color) el.style.setProperty('--tgb-fg', th.text_color);
  if (th.button_color) el.style.setProperty('--tgb-accent', th.button_color);
  el.innerHTML = `<div class="tgb-card">${failed ? '' : '<i class="tgb-spin" aria-hidden="true"></i>'}<b class="tgb-name">GRAVETIDE</b><p>${esc(text)}</p></div>`;
  el.classList.toggle('failed', failed);
}

function bootDone(): void {
  document.getElementById('tg-boot')?.remove();
}

/** The game's start inside Telegram (true: Telegram takes the sign-in; false: the website's own start goes on). */
export function tgStart(net: Net): boolean {
  if (!onTgHost() && !inTelegram()) return false;
  bootScreen(g.Telegram?.WebApp ?? null, L('boot'));
  net.on((m: ServerMsg) => {
    if (m.t === 'welcome' || (m.t === 'err' && m.msg === 'auth_required')) bootDone();
  });
  void (async () => {
    const w = await loadWebApp();
    const initData = w?.initData || LAUNCH || '';
    if (!w || !initData) {
      // the Telegram host opened in a browser: the website's own start
      bootDone();
      if (net.token) net.connect();
      return;
    }
    setupMiniApp(w);
    bootScreen(w, L('boot'));
    const r = await post<{ token?: string }>('/auth/tg/webapp', { initData, token: net.token ?? undefined });
    if (!r.token) {
      bootScreen(w, L('bootFailed'), true);
      setTimeout(bootDone, 5000);
      return;
    }
    net.adopt(r.token);
    if (!net.live) net.connect();
  })();
  return true;
}

// ------------------------------------------------------------------------------------------------ the deep link

let waiting: { stop: () => void } | null = null;

/** «Войти через Телеграм» (no token) or «Привязать Телеграм» (the captain's token): the bot's link, the wait. */
export async function tgDeepLink(o: { net?: Net; token?: string | null; onLinked?: (name: string) => void; toast?: (msg: string, kind: string) => void }): Promise<void> {
  waiting?.stop();
  const s = await post<{ nonce?: string; link?: string; expires?: number }>('/auth/tg/start', o.token ? { token: o.token } : {});
  if (!s.nonce || !s.link) {
    o.toast?.(s.error ?? L('wait.failed'), 'bad');
    const err = document.getElementById('login-error');
    if (err && !o.token) err.textContent = s.error ?? L('wait.failed');
    return;
  }
  // Within the tap's moment the link opens Telegram; a blocked window leaves the card's own button.
  try {
    window.open(s.link, '_blank');
  } catch {
    /* the button below */
  }
  const card = document.createElement('div');
  card.id = 'tg-wait';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'tgw-h');
  const until = Math.min(s.expires ?? Date.now() + 600_000, Date.now() + 300_000);
  card.innerHTML = `<div class="tgw-card panel">
      <h3 id="tgw-h" class="tgw-h">${tgIcon()}<span>${esc(L('wait.title'))}</span></h3>
      <p class="tgw-text">${esc(o.token ? L('wait.linkText') : L('wait.text'))}</p>
      <p class="tgw-left muted" aria-live="polite"></p>
      <div class="tgw-btns"><a class="btn btn-primary tgw-open" href="${esc(s.link)}" target="_blank" rel="noopener">${esc(L('wait.open'))}</a><button type="button" class="btn tgw-cancel">${esc(L('wait.cancel'))}</button></div>
    </div>`;
  document.body.appendChild(card);
  const left = card.querySelector<HTMLElement>('.tgw-left')!;
  let timer = 0, fails = 0;
  const stop = () => {
    clearTimeout(timer);
    card.remove();
    if (waiting?.stop === stop) waiting = null;
  };
  waiting = { stop };
  card.querySelector<HTMLButtonElement>('.tgw-cancel')!.onclick = stop;
  const end = (text: string) => {
    clearTimeout(timer);
    left.textContent = text;
    left.classList.add('bad');
    card.querySelector('.tgw-open')?.remove();
  };
  const tick = async () => {
    if (!card.isConnected) return;
    if (Date.now() > until) return end(L('wait.expired'));
    left.textContent = L('wait.left', { m: Math.max(1, Math.ceil((until - Date.now()) / 60_000)) });
    let r: { status?: string; token?: string; name?: string } = {};
    try {
      const res = await fetch(`/auth/tg/poll?nonce=${encodeURIComponent(s.nonce!)}`);
      r = (await res.json()) as typeof r;
      fails = res.ok ? 0 : fails + 1;
    } catch {
      fails++;
    }
    if (!card.isConnected) return;
    if (r.status === 'done' && r.token && o.net) {
      stop();
      o.net.adopt(r.token);
      if (!o.net.live) o.net.connect();
      return;
    }
    if (r.status === 'linked') {
      // the card says it, and closes by itself
      linkedCache = Promise.resolve(true);
      left.textContent = L('linkedToast', { name: r.name ?? '' });
      left.classList.add('good');
      card.querySelector('.tgw-open')?.remove();
      o.toast?.(L('linkedToast', { name: r.name ?? '' }), 'good');
      o.onLinked?.(r.name ?? '');
      timer = setTimeout(stop, 2500) as unknown as number;
      return;
    }
    if (r.status === 'taken') return end(L('wait.taken'));
    if (r.status === 'expired') return end(L('wait.expired'));
    if (fails >= 6) return end(L('wait.failed'));
    timer = setTimeout(() => void tick(), 2000) as unknown as number;
  };
  timer = setTimeout(() => void tick(), 1500) as unknown as number;
  left.textContent = L('wait.left', { m: Math.ceil((until - Date.now()) / 60_000) });
}

/** The start screen's «Войти через Телеграм»: shown when the server has a bot and the page is not inside Telegram. */
export function tgLoginButton(net: Net, onLang: (f: () => void) => void): void {
  const b = document.getElementById('login-tg') as HTMLButtonElement | null;
  if (!b) return;
  // the whole words, and the short one for the smallest phones (tg.css)
  const label = () => {
    b.innerHTML = `${tgIcon()}<span class="tgl-long">${esc(L('login'))}</span><span class="tgl-short">${esc(L('loginShort'))}</span>`;
    b.title = L('login');
  };
  label();
  onLang(label);
  void tgConfig().then((c) => b.classList.toggle('hidden', !c?.enabled || inTelegram() || onTgHost()));
  b.onclick = () => {
    b.disabled = true;
    setTimeout(() => (b.disabled = false), 3000);
    void tgDeepLink({ net });
  };
}

// ------------------------------------------------------------------------------------------------ settings

let linkedCache: Promise<boolean | null> | null = null;
let linkedFor: string | null = null;

/** Whether the captain's account has its Telegram linked (null: no Telegram on the server, or not signed in). */
export function tgLinked(token: string | null): Promise<boolean | null> {
  if (!token) return Promise.resolve(null);
  if (linkedFor !== token) linkedCache = null;
  linkedFor = token;
  linkedCache ??= tgConfig().then((c) => (c?.enabled ? post<{ linked?: boolean }>('/auth/tg/linked', { token }).then((r) => (typeof r.linked === 'boolean' ? r.linked : null)) : null));
  return linkedCache;
}

/** The settings' button: «Привязать Телеграм», or «Телеграм привязан» shut; nothing without Telegram. */
export function tgSettingsButton(linked: boolean | null): string {
  if (linked === null) return '';
  return `<button type="button" class="k-btn k-btn--secondary k-btn--md opt-tg" data-otg${linked ? ' disabled aria-disabled="true"' : ''}>${tgIcon()}<span>${esc(linked ? L('linked') : L('link'))}</span></button>`;
}

// ------------------------------------------------------------------------------------------------ Stars

/** A Telegram Star, drawn (gold, the size of the text). */
export function starIcon(): string {
  return '<svg class="tg-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1L1.8 9.2 9 8.4z"/></svg>';
}

/** Telegram's paper plane, drawn. */
export function tgIcon(): string {
  return '<svg class="tg-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21.5 3.6L2.9 10.8c-1 .4-1 1.8.1 2.1l4.6 1.5 1.8 5.6c.3.9 1.4 1.1 2 .4l2.6-2.7 4.8 3.5c.8.6 1.9.1 2.1-.9l3-15.2c.2-1.1-.9-2-1.9-1.5zM9.6 14.6l8.4-7.6-6.6 8.9-.3 2.7z"/></svg>';
}

/** The pack's Buy: the price in Stars on it. */
export function tgPackButton(packId: string, stars: number): string {
  return `<button class="btn btn-small btn-primary pm-stars" data-pmpack="${esc(packId)}" aria-label="${esc(`${L('buyStars')}: ${L('stars', { n: stars })}`)}">${starIcon()}<b>${stars}</b></button>`;
}

export const tgPayNote = (): string => L('payNote');

/** The invoices the server sends: the Mini App opens them in place, the website as a link (it opens Telegram). */
export function tgInvoices(net: Net, toast: (msg: string, kind: string) => void): void {
  net.on((m: ServerMsg) => {
    if (m.t !== 'premium_invoice' || !m.link) return;
    const link = m.link;
    const w = webApp ?? g.Telegram?.WebApp;
    if (w?.openInvoice && w.initData) {
      w.openInvoice(link, (status) => {
        if (status === 'paid') toast(L('paid'), 'good');
        else if (status === 'cancelled') toast(L('payCancelled'), 'info');
        else if (status === 'failed') toast(L('payFailed'), 'bad');
      });
      return;
    }
    let win: Window | null = null;
    try {
      win = window.open(link, '_blank');
      if (win) win.opener = null;
    } catch {
      win = null;
    }
    if (win) toast(L('payOpened'), 'info');
    // a blocked window (the tap's moment passed while the server made the invoice): one more tap opens it
    else void ask(L('payOpened'), L('wait.open'), L('wait.cancel')).then((ok) => ok && window.open(link, '_blank', 'noopener'));
  });
}
