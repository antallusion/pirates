// VK on the client (owner, 2026-10-20: «надо сделать версию для вк»; docs/36_VK.md). VK moderation turned down a game
// like this one for five things, each answered here:
//  1. its own fullscreen hid VK's payment window — inside VK the game never asks for fullscreen (main.ts holdSideways
//     keeps off), and before VKWebAppShowOrderBox a fullscreen still on is left; the order's answer is read defensively;
//  2. (the shop's cut texts and prices: shop.css / fit.css, measured by tools/vk/qa.mjs);
//  3. the game did not start on phones — VKWebAppInit goes out at once by every channel (index.html's first script,
//     and again here if that one did not run), the bridge in vkbridge.ts;
//  4. (the phone on its side inside m.vk.com: the layout, measured by tools/vk/qa.mjs);
//  5. links out of VK — html.vk-app hides them (styles.css) and every place that builds one asks inVk() first; the only
//     «share» is VKWebAppShare with the mini app's own address (vk.com/app<ID>), «Позвать друзей» in the settings.
// The sign-in: the launch parameters VK appended to the address (kept in sessionStorage: the game's start wipes the
// address) posted to /auth/vk/launch, signed by VK with the app's secret; the token adopted as Telegram's is.

import { dict } from './i18n.ts';
import { EN, RU } from './lang/ui/vk.ts';
import type { Net } from './net.ts';
import type { ServerMsg } from '../../shared/src/protocol.ts';
import { esc } from './ui/dom.ts';
import { bootMark, settleViewport } from './viewport.ts';
import { VkFail, bindViewEvents, createBridge, orderOutcome } from './vkbridge.ts';
import { pauseApp, resumeApp } from './lifecycle.ts';
import type { Bridge, BridgeWin } from './vkbridge.ts';

const L = dict(EN, RU);
const KEY = 'gt.vkLaunch';

/** The launch parameters of this page (VK appends them: vk_app_id, vk_user_id, vk_ts, …, sign), kept for a reload. */
const LAUNCH = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('vk_app_id') && q.has('sign')) {
      try {
        sessionStorage.setItem(KEY, location.search);
      } catch {
        /* no storage: this page's own address keeps them */
      }
      return location.search;
    }
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
})();

/** Inside VK: its launch parameters in the address (or kept from it), or `?vk` for a local check. */
export function inVk(): boolean {
  if (LAUNCH) return true;
  try {
    return new URLSearchParams(location.search).has('vk') || document.documentElement.classList.contains('vk-app');
  } catch {
    return false;
  }
}

// (the class before anything is drawn: the styles hide what leads out of VK)
if (typeof document !== 'undefined' && inVk()) document.documentElement.classList.add('vk-app');

let bridge: Bridge | null = null;
/** The page's bridge (made once; the early script's VKWebAppInit is not sent twice). */
export function vkBridge(): Bridge {
  bridge ??= createBridge(globalThis as unknown as BridgeWin);
  return bridge;
}

// ------------------------------------------------------------------------------------------------ the config

interface VkConfig {
  enabled: boolean;
  appId?: number | null;
  pay?: boolean;
}
let config: Promise<VkConfig | null> | null = null;
let cfgNow: VkConfig | null = null;

export function vkConfig(): Promise<VkConfig | null> {
  config ??= fetch('/auth/vk/config').then((r) => (r.ok ? (r.json() as Promise<VkConfig>) : null)).catch(() => null).then((c) => (cfgNow = c));
  return config;
}

/** Payments in votes open (the server has the app's secret and so takes VK's callback): the shop's Buy in VK. */
export function vkPayOpen(): boolean {
  return !!cfgNow?.enabled && cfgNow.pay !== false;
}

/** The mini app's id: the server's, else the launch's own. */
function appId(): number | null {
  if (cfgNow?.appId) return cfgNow.appId;
  try {
    const n = Number(new URLSearchParams(LAUNCH ?? '').get('vk_app_id'));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------ the sign-in

async function post<T>(path: string, body: Record<string, unknown>, timeout = 15_000): Promise<T & { error?: string }> {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ac?.abort(), timeout);
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac?.signal });
    return (await r.json()) as T & { error?: string };
  } catch {
    return { error: 'network' } as T & { error?: string };
  } finally {
    clearTimeout(timer);
  }
}

let bootSlow = 0;
/** The loading screen of the sign-in: Telegram's own (tg.css #tg-boot — the painting, the logo, the wheel). */
function bootScreen(text: string, failed = false): void {
  let el = document.getElementById('tg-boot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tg-boot';
    el.className = 'vk-boot';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  const logo = document.querySelector('#rotate-lock .rl-logo')?.innerHTML;
  el.innerHTML = `<div class="tgb-card"><b class="tgb-name">${logo ? `<picture class="tgb-logo">${logo}</picture>` : 'GRAVETIDE'}</b>${failed ? '' : '<i class="gt-wheel" aria-hidden="true"></i>'}<p>${esc(text)}</p></div>`;
  el.classList.toggle('failed', failed);
  clearTimeout(bootSlow);
  if (!failed) {
    bootSlow = setTimeout(() => {
      const card = document.querySelector('#tg-boot .tgb-card');
      if (!card || card.querySelector('.tgb-retry')) return;
      bootMark('vk slow');
      card.insertAdjacentHTML('beforeend', `<small class="tgb-slow">${esc(L('bootSlow'))}</small><button type="button" class="btn tgb-retry">${esc(L('bootRetry'))}</button>`);
      card.querySelector<HTMLButtonElement>('.tgb-retry')!.onclick = () => location.reload();
    }, 15_000) as unknown as number;
  }
}

function bootDone(): void {
  clearTimeout(bootSlow);
  document.getElementById('tg-boot')?.remove();
}

/** VK's safe areas (VKWebAppUpdateConfig's insets on the phones) into the HUD's insets (styles.css --sa-*). */
function applyInsets(d: Record<string, unknown>): void {
  const ins = d.insets as Partial<Record<'top' | 'bottom' | 'left' | 'right', number>> | undefined;
  if (!ins || typeof ins !== 'object') return;
  const root = document.documentElement.style;
  for (const [k, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']] as const) {
    const px = Math.max(0, Math.round(Number(ins[side] ?? 0) || 0));
    root.setProperty(`--sa-${k}`, `max(env(safe-area-inset-${side}, 0px), ${px}px)`);
  }
  settleViewport('vk insets');
}

/** The game's start inside VK (true: VK takes the sign-in; false: the website's own start goes on). */
export function vkStart(net: Net): boolean {
  if (!inVk()) return false;
  const b = vkBridge();
  // (index.html's first script sent it already, by every channel; this one only if that did not run)
  b.init();
  bootMark('vk init');
  b.on((type, data) => {
    if (type === 'VKWebAppUpdateConfig') applyInsets(data);
  });
  // Minimised, the game sleeps: VK's ViewHide / ViewRestore (lifecycle.ts — the page's own hiding is main.ts's), and the
  // window's blur as the fallback inside VK (a client that sends neither).
  bindViewEvents(b);
  addEventListener('blur', () => pauseApp('blur'));
  addEventListener('focus', () => resumeApp('blur'));
  bootScreen(L('boot'));
  net.on((m: ServerMsg) => {
    if (m.t === 'welcome' || (m.t === 'err' && m.msg === 'auth_required')) bootDone();
  });
  void (async () => {
    void vkConfig();
    if (!LAUNCH) {
      // `?vk` without VK's launch: the website's own start, as VK's look
      bootDone();
      if (net.token) net.connect();
      return;
    }
    // her first name for a new captain (optional: two and a half seconds at most)
    let name = '';
    try {
      const u = await b.send('VKWebAppGetUserInfo', {}, 2500);
      name = typeof u.first_name === 'string' ? u.first_name : '';
    } catch {
      /* no name: «Капитан» */
    }
    let r = await post<{ token?: string }>('/auth/vk/launch', { launch: LAUNCH, name, token: net.token ?? undefined });
    if (!r.token && r.error === 'network') r = await post<{ token?: string }>('/auth/vk/launch', { launch: LAUNCH, name, token: net.token ?? undefined });
    bootMark(r.token ? 'vk signed in' : `vk sign-in failed: ${r.error ?? ''}`);
    if (!r.token) {
      bootScreen(L('bootFailed'), true);
      setTimeout(() => {
        bootDone();
        if (net.token && !net.live) net.connect();
      }, 5000);
      return;
    }
    net.adopt(r.token);
    if (!net.live) net.connect();
  })();
  return true;
}

// ------------------------------------------------------------------------------------------------ fullscreen

/** Inside VK the page never asks for fullscreen (VK's own windows — the payment's — must stay over it). */
export function mayFullscreen(): boolean {
  return !inVk();
}

/** A fullscreen still on (another script's, the browser's) left before VK's own window opens over the game. */
export async function leaveFullscreen(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch {
    /* it stays: VK's window still opens */
  }
}

// ------------------------------------------------------------------------------------------------ the votes

/** The pack's Buy in votes: VK's order box over the game; its answer told as a toast, and as the 'gravetide:pay' event
 *  (a purchase waiting for this top-up stops waiting when it was not paid — ui/price.ts). Never throws. */
export async function vkBuy(packId: string, toast?: (msg: string, kind: string) => void): Promise<'paid' | 'cancelled' | 'failed'> {
  await leaveFullscreen();
  let st: 'paid' | 'cancelled' | 'failed';
  try {
    st = orderOutcome(await vkBridge().send('VKWebAppShowOrderBox', { type: 'item', item: String(packId) }, 10 * 60_000));
  } catch (e) {
    st = e instanceof VkFail ? orderOutcome(e) : 'failed';
  }
  try {
    dispatchEvent(new CustomEvent('gravetide:pay', { detail: st }));
  } catch {
    /* no events: nothing waits */
  }
  toast?.(L(st === 'paid' ? 'paid' : st === 'cancelled' ? 'payCancelled' : 'payFailed'), st === 'paid' ? 'good' : st === 'cancelled' ? 'info' : 'bad');
  return st;
}

/** The pack's Buy in VK: the price in votes on it («41 голос»). */
export function vkPackButton(packId: string, price: string): string {
  return `<button type="button" class="btn btn-small btn-primary pm-votes" data-pmvk="${esc(packId)}" aria-label="${esc(`${L('buyVotes')} ${price}`)}"><b>${esc(price)}</b></button>`;
}

export const vkPayNote = (): string => L('payNote');

// ------------------------------------------------------------------------------------------------ «Позвать друзей»

/** The mini app's own address: the only link the game hands out inside VK. */
export function vkAppLink(): string | null {
  const id = appId();
  return id ? `https://vk.com/app${id}` : null;
}

/** «Позвать друзей»: VK's share sheet with the mini app's address. */
export async function vkShare(toast?: (msg: string, kind: string) => void): Promise<boolean> {
  await vkConfig();
  const link = vkAppLink();
  if (!link) {
    toast?.(L('shareFailed'), 'bad');
    return false;
  }
  try {
    await vkBridge().send('VKWebAppShare', { link }, 5 * 60_000);
    toast?.(L('shared'), 'good');
    return true;
  } catch (e) {
    if (!(e instanceof VkFail && e.cancelled)) toast?.(L('shareFailed'), 'bad');
    return false;
  }
}

/** The settings' «Позвать друзей» (VK only; nothing elsewhere). */
export function vkInviteButton(): string {
  if (!inVk()) return '';
  return `<button type="button" class="k-btn k-btn--secondary k-btn--md opt-vk" data-ovk title="${esc(L('inviteHint'))}"><span>${esc(L('invite'))}</span></button>`;
}
