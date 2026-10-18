// The forum page's ground (docs/32_FORUM.md): its language and address, the words, the API, time and counts, the toast.

import { EN_PLURAL, FORUM_EN, FORUM_RU, RU_PLURAL } from '../lang/forum.ts';
import { typo } from '../../../shared/src/typo.ts';
import type { ForumErrorCode } from '../../../shared/src/forum/meta.ts';

export const LANG: 'ru' | 'en' = document.documentElement.lang === 'en' ? 'en' : 'ru';
export const BASE = LANG === 'en' ? '/site/en/forum/' : '/site/forum/';
const DICT = LANG === 'ru' ? FORUM_RU : FORUM_EN;

/** A word of the page, with {n}-style slots filled. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = DICT[key] ?? FORUM_EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const esc = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Escaped with the site's typography (short words held to the next, no lone last word). */
export const tx = (s: unknown): string => esc(typo(String(s ?? ''), LANG));

/** A count with its noun: 1 сообщение, 5 сообщений / 1 post, 5 posts. */
export function count(n: number, noun: keyof typeof EN_PLURAL): string {
  const v = fmtNum(n);
  if (LANG === 'en') return `${v} ${EN_PLURAL[noun][n === 1 ? 0 : 1]}`;
  const a = n % 100, b = n % 10;
  const f = RU_PLURAL[noun];
  return `${v} ${a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2]}`;
}

/** The noun alone for a count: «темы» for 2, «тем» for 5. */
export const noun = (n: number, key: keyof typeof EN_PLURAL): string => count(n, key).replace(/^[\d\s ,.]+/, '');

export const fmtNum = (n: number): string => (Number(n) || 0).toLocaleString(LANG === 'ru' ? 'ru-RU' : 'en-GB').replace(/\s/g, ' ');

const hm = (d: Date) => d.toLocaleTimeString(LANG === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
/** «5 мин назад», «вчера в 14:05», «12 окт 2026». */
export function ago(ts: number | null | undefined): string {
  if (!ts) return '';
  const now = Date.now();
  const d = new Date(ts);
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return t('just_now');
  if (s < 3600) return t('min_ago', { n: Math.floor(s / 60) });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ts >= today.getTime()) return s < 6 * 3600 ? t('h_ago', { n: Math.floor(s / 3600) }) : t('today_at', { t: hm(d) });
  if (ts >= today.getTime() - 86_400_000) return t('yesterday', { t: hm(d) });
  return fullDate(ts);
}
export const fullDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(LANG === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\s?г\.$/, '').replace(/\s/g, ' ');
export const isoDate = (ts: number): string => new Date(ts).toISOString();

/** A site kit picture. */
export const K = (p: string): string => `/site/img/${p}.webp`;
export const ico = (name: string, cls = 'f-ico', alt = ''): string => `<img class="${cls}" src="${K(`ico/${name}`)}" alt="${esc(alt)}" width="20" height="20" loading="lazy" decoding="async">`;

// ------------------------------------------------------------------------------------------------ the API

export class ApiError extends Error {
  code: ForumErrorCode | 'network';
  status: number;
  constructor(code: ForumErrorCode | 'network', status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export const token = (): string | null => {
  try {
    return localStorage.getItem('gravetide.token');
  } catch {
    return null;
  }
};

export async function api<T = any>(path: string, body?: unknown, raw?: Blob): Promise<T> {
  const headers: Record<string, string> = {};
  const tok = token();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const sep = path.includes('?') ? '&' : '?';
  let res: Response;
  try {
    if (raw) {
      headers['Content-Type'] = raw.type || 'application/octet-stream';
      res = await fetch(`/api/forum/${path}`, { method: 'POST', headers, body: raw });
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      res = await fetch(`/api/forum/${path}${sep}lang=${LANG}`, { method: 'POST', headers, body: JSON.stringify(body) });
    } else {
      res = await fetch(`/api/forum/${path}${sep}lang=${LANG}`, { headers });
    }
  } catch {
    throw new ApiError('network', 0);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* an empty or broken answer */
  }
  if (!res.ok) throw new ApiError((data?.error as ForumErrorCode) ?? 'bad_request', res.status);
  return data as T;
}

export const errText = (e: unknown): string => (e instanceof ApiError ? t(`err_${e.code}`) : t('err_bad_request'));

// ------------------------------------------------------------------------------------------------ the toast (a strip at the bottom, never the middle)

let toastTimer = 0;
export function toast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
  let el = document.getElementById('f-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'f-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `f-toast ${kind} on`;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('on'), 3200);
}

// ------------------------------------------------------------------------------------------------ who is reading

export interface Me {
  user: any | null;
  unread?: { notifications: number; messages: number; reports: number };
  avatars?: string[];
  chars?: { id: string; captain: string; level: number; ship: string }[];
}
export const state: { me: Me; staff: boolean; admin: boolean } = { me: { user: null }, staff: false, admin: false };

export async function loadMe(): Promise<Me> {
  if (!token()) {
    state.me = { user: null };
  } else {
    try {
      state.me = await api<Me>('me');
    } catch {
      state.me = { user: null };
    }
  }
  const r = state.me.user?.role;
  state.staff = r === 'moderator' || r === 'admin';
  state.admin = r === 'admin';
  return state.me;
}

/** A forum address. */
export const href = (p = ''): string => `${BASE}${p}`;
