// «Войти через VK ID» on the website (owner, 2026-10-25; docs/36_VK.md §8; the server's side: server/src/vkid.ts).
//  - the start screen's button (the game's wooden plank as Telegram's, VK's logo in brass: owner, 2026-10-26) sends the browser to /auth/vkid/start — VK ID's page, then
//    back to /play#token=…&vkid=1, adopted as the other sign-ins' tokens are (main.ts);
//  - with a captain kept in this browser, the offer under it: «Привязать VK ID к капитану …» — the page trades its token
//    for a one-time ticket (POST /auth/vkid/link) and goes the same way; back at /play#vkid=linked (her token kept);
//  - settings' «Привязать VK» (or «VK привязан», shut);
//  - the hint, once: VK only writes to those who allowed the Mini App's notices — «откройте игру в VK и разрешите».
// Only on the website: never inside the VK Mini App (no link out of VK, docs/36) nor in Telegram's.

import { dict, lang } from './i18n.ts';
import { EN, RU } from './lang/ui/vkid.ts';
import { esc } from './ui/dom.ts';
import { askHtml, tell } from './ui/confirm.ts';
import { serverText } from './lang/server.ts';
import { inVk } from './vk.ts';
import { inTelegram, onTgHost } from './tg.ts';

const L = dict(EN, RU);
const NOTE_KEY = 'gt.vkidNote';
const TOKEN_KEY = 'gravetide.token';

/** The website, not a Mini App. */
export const vkIdPlace = (): boolean => !inVk() && !inTelegram() && !onTgHost();

let cfg: Promise<{ enabled: boolean; miniApp?: string } | null> | null = null;
/** The server's VK ID (null: off, or not the website). */
export function vkIdConfig(): Promise<{ enabled: boolean; miniApp?: string } | null> {
  if (!vkIdPlace()) return Promise.resolve(null);
  cfg ??= fetch('/auth/vkid/config').then((r) => r.json() as Promise<{ enabled: boolean; miniApp?: string }>).then((c) => (c?.enabled ? c : null)).catch(() => null);
  return cfg;
}

/** VK's logo, drawn in the button's own colour (vkid.css: ivory brass on the wood, no VK blue). */
export function vkIcon(): string {
  return '<svg class="vkid-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.9 17.3c-5.5 0-8.6-3.8-8.7-10h2.7c.1 4.6 2.1 6.5 3.7 6.9V7.3h2.6v3.9c1.6-.2 3.2-2 3.8-3.9h2.6c-.4 2.4-2.2 4.2-3.4 4.9 1.2.6 3.2 2.1 4 5.1h-2.8c-.6-2-2.2-3.5-4.2-3.7v3.7z"/></svg>';
}

function token(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** «Привязать VK»: the ticket, then VK ID's page. */
export async function vkIdLink(toast?: (msg: string, kind: string) => void): Promise<void> {
  const tok = token();
  const r = tok ? await post<{ url?: string; error?: string }>('/auth/vkid/link', { token: tok }) : null;
  if (r?.url) {
    location.href = `${r.url}&lang=${lang()}`;
    return;
  }
  const msg = r?.error ? serverText(r.error) : L('failed');
  if (toast) toast(msg, 'bad');
  else void tell(msg);
}

/** The start screen: «Войти через VK ID», and the offer to link the captain this browser keeps (`captain`: her name). */
export function vkIdLoginButton(onLang: (f: () => void) => void, captain: () => string | null): void {
  const b = document.getElementById('login-vkid') as HTMLButtonElement | null;
  const offer = document.getElementById('login-vkid-link') as HTMLButtonElement | null;
  if (!b) return;
  const label = () => {
    b.innerHTML = `${vkIcon()}<span class="vkl-long">${esc(L('login'))}</span><span class="vkl-short">${esc(L('loginShort'))}</span>`;
    b.title = L('login');
    const name = captain();
    if (offer) offer.textContent = name ? L('offer', { name }) : '';
  };
  label();
  onLang(label);
  void vkIdConfig().then((c) => {
    b.classList.toggle('hidden', !c);
    offer?.classList.toggle('hidden', !c || !token() || !captain());
  });
  b.onclick = () => {
    b.disabled = true;
    setTimeout(() => (b.disabled = false), 4000);
    location.href = `/auth/vkid/start?lang=${lang()}`;
  };
  if (offer) offer.onclick = () => {
    offer.disabled = true;
    setTimeout(() => (offer.disabled = false), 4000);
    void vkIdLink();
  };
}

// ------------------------------------------------------------------------------------------------ settings

let statusCache: Promise<{ linked: boolean; notify: boolean } | null> | null = null;
let statusFor: string | null = null;

/** Her captain's VK (null: no VK ID on the server, not the website, or not signed in). */
export function vkIdStatus(): Promise<{ linked: boolean; notify: boolean } | null> {
  const tok = token();
  if (!tok) return Promise.resolve(null);
  if (statusFor !== tok) statusCache = null;
  statusFor = tok;
  statusCache ??= vkIdConfig().then((c) => (c ? post<{ linked?: boolean; notify?: boolean }>('/auth/vkid/status', { token: tok }).then((r) => (typeof r?.linked === 'boolean' ? { linked: r.linked, notify: r.notify === true } : null)) : null));
  return statusCache;
}

/** The settings' button: «Привязать VK», or «VK привязан» shut; nothing without VK ID. */
export function vkIdSettingsButton(linked: boolean | null): string {
  if (linked === null) return '';
  return `<button type="button" class="k-btn k-btn--secondary k-btn--md opt-vkid" data-ovkid${linked ? ' disabled aria-disabled="true"' : ''}>${vkIcon()}<span>${esc(linked ? L('linked') : L('link'))}</span></button>`;
}

// ------------------------------------------------------------------------------------------------ back from VK ID

/** The page's address after VK ID (main.ts reads the hash before it wipes it): the link's word, a refusal, the hint. */
export function vkIdReturn(hash: URLSearchParams, ready: () => boolean): void {
  const err = hash.get('vkid-error');
  const linked = hash.get('vkid') === 'linked';
  const back = hash.has('vkid') || !!err;
  if (!back) return;
  const note = hash.get('vknote') === '1';
  // (said once the screen under it has settled: the game's own start, or the login screen)
  const later = (f: () => void) => {
    const until = Date.now() + 15_000;
    const tick = () => (ready() || Date.now() > until ? setTimeout(f, 1200) : setTimeout(tick, 400));
    tick();
  };
  later(async () => {
    if (err) {
      await tell(serverText(err));
      return;
    }
    if (linked) await tell(L('linkedToast'));
    if (note) await vkIdNote();
  });
}

/** The hint, once per browser: VK writes only to those who allowed the Mini App's notices (never pretended here). */
export async function vkIdNote(force = false): Promise<void> {
  try {
    if (!force && localStorage.getItem(NOTE_KEY)) return;
    localStorage.setItem(NOTE_KEY, '1');
  } catch {
    /* no storage: shown this once */
  }
  const c = await vkIdConfig();
  const app = c?.miniApp ?? 'https://vk.com/app54838627';
  const go = await askHtml(`<p id="confirm-text"><b>${esc(L('noteTitle'))}</b><br>${esc(L('note'))}</p>`, L('noteOpen'), L('noteLater'));
  if (go) window.open(app, '_blank', 'noopener');
}
