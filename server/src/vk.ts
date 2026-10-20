// VK Mini App (owner, 2026-10-20: «надо сделать версию для вк»; docs/36_VK.md). One service, two doors:
//  - the sign-in by the launch parameters VK appends to the app's address (vk_* and `sign`): HMAC-SHA256 of the sorted
//    vk_* pairs under the app's «Защищённый ключ» (VK_APP_SECRET), base64url without padding; no older than three days;
//    the account by the OAuth table (provider 'vk', subject = vk_user_id) — AuthService.oauthLogin signs in or makes a
//    captain named from the VK first name the page passes (or «Капитан»);
//  - the payments' callback (VK's «голоса»): get_item names a doubloon pack and its price in votes, order_status_change
//    with status 'chargeable' credits the pack once per order id (kv `vkpay:<order_id>`, the ledger's reference
//    `vk:<order_id>`). The callback is signed: md5 of the sorted `key=value` pairs (no separators) and the secret.
// Test orders (notification_type *_test, the app in its test mode) are credited — with the reference `vktest:<id>` and
// the kv key `vkpay:test:<id>` — only on a server with VK_PAY_TEST=1, or to an id of VK_ADMIN_IDS; elsewhere VK is told
// error 101 and nothing is credited. The secret lives only in the server's environment and is never logged or sent.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthResult, AuthService } from './auth.ts';
import type { Db } from './persistence/db.ts';
import type { Game } from './game/Game.ts';
import { payIn } from './game/premium.ts';
import { packVotes, vkPack } from '../../shared/src/data/vk.ts';
import { setVkNoticeDesk, tgnState, vkNoticeLink } from './game/tgnotify.ts';
import type { TgnCat } from '../../shared/src/data/telegram.ts';

const PROVIDER = 'vk';
/** A launch is good for three days (VK's own advice for the launch parameters' age). */
export const LAUNCH_MAX_AGE_S = 3 * 86_400;

// ------------------------------------------------------------------------------------------------ the launch parameters

/** The launch parameters' sign: the vk_* pairs sorted by key, `key=encodeURIComponent(value)` joined by '&',
 *  HMAC-SHA256 under the app's secret, base64url without the padding. Exported for the tests and the QA. */
export function signLaunch(params: Record<string, string> | URLSearchParams, secret: string): string {
  const all = params instanceof URLSearchParams ? Object.fromEntries(params) : params;
  const line = Object.keys(all).filter((k) => k.startsWith('vk_')).sort().map((k) => `${k}=${encodeURIComponent(all[k])}`).join('&');
  return createHmac('sha256', secret).update(line).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface VkLaunch {
  userId: number;
  appId: number;
  ts: number;
  lang: string;
  platform: string;
  /** vk_are_notifications_enabled: she has allowed the app's notices. */
  notify: boolean;
}

/** The launch checked: its sign, its age (three days, not from the future), its app and user. Null: not VK's, stale, or
 *  malformed. `search`: the page's location.search (with or without the '?', a hash cut off). */
export function checkLaunch(search: string, secret: string, appId: number | null, nowS = Math.floor(Date.now() / 1000), maxAgeS = LAUNCH_MAX_AGE_S): VkLaunch | null {
  if (typeof search !== 'string' || !search || search.length > 4096 || !secret) return null;
  const q = new URLSearchParams(search.replace(/^[?#]/, '').split('#')[0]);
  const sign = q.get('sign') ?? '';
  if (!/^[\w-]{20,64}$/.test(sign)) return null;
  const want = Buffer.from(signLaunch(q, secret));
  const got = Buffer.from(sign);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const ts = Number(q.get('vk_ts'));
  if (!Number.isInteger(ts) || nowS - ts > maxAgeS || ts - nowS > 300) return null;
  const userId = Number(q.get('vk_user_id'));
  const app = Number(q.get('vk_app_id'));
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(app) || app <= 0) return null;
  if (appId && app !== appId) return null;
  return { userId, appId: app, ts, lang: q.get('vk_language') ?? 'ru', platform: q.get('vk_platform') ?? '', notify: q.get('vk_are_notifications_enabled') === '1' };
}

// ------------------------------------------------------------------------------------------------ the payments' callback

/** The callback's sign: md5 of the pairs but `sig`, sorted by key, `key=value` with no separators, then the secret. */
export function paySig(params: Record<string, string>, secret: string): string {
  const line = Object.keys(params).filter((k) => k !== 'sig').sort().map((k) => `${k}=${params[k]}`).join('');
  return createHash('md5').update(line + secret, 'utf8').digest('hex');
}

export type VkPayAnswer = { response: Record<string, unknown> } | { error: { error_code: number; error_msg: string; critical: boolean } };

const fail = (error_code: number, error_msg: string, critical = true): VkPayAnswer => ({ error: { error_code, error_msg, critical } });

/** A payment kept in the kv table under `vkpay:<order_id>` (a test order: `vkpay:test:<order_id>`). */
export interface VkPayment {
  account: number;
  user: number;
  pack: string;
  votes: number;
  n: number;
  app: number;
  at: number;
  test: boolean;
}

/** «290 дублонов», «1 дублон», «2 дублона»; «290 doubloons». */
export function doubloonsTitle(n: number, lang: 'ru' | 'en'): string {
  const num = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (lang === 'en') return `${num} ${n === 1 ? 'doubloon' : 'doubloons'}`;
  const a = n % 100, b = n % 10;
  const w = a > 10 && a < 20 ? 'дублонов' : b === 1 ? 'дублон' : b >= 2 && b <= 4 ? 'дублона' : 'дублонов';
  return `${num} ${w}`;
}

export interface VkOptions {
  db: Db;
  auth: AuthService;
  game: Game;
  /** The app's id (VK_APP_ID): a launch of another app is refused; the share link is vk.com/app<id>. */
  appId: number | null;
  /** The app's «Защищённый ключ» (VK_APP_SECRET). */
  secret: string;
  /** The website (the pack's picture is <publicUrl>/vk-doubloon.png). */
  publicUrl: string;
  /** VK_PAY_TEST=1: test orders are credited for anyone. */
  payTest?: boolean;
  /** VK_ADMIN_IDS: VK user ids whose test orders are credited. */
  admins?: number[];
  now?: () => number;
  log?: (line: string) => void;
  /** VK_SERVICE_KEY: the app's service key — the notices by notifications.sendMessage (none without it). */
  serviceKey?: string;
  /** The fetch VK's API is called with (the tests' stub). */
  fetch?: VkFetch;
}

export type VkFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ json(): Promise<unknown> }>;

/** A notice's words for VK: one line of at most 254 characters (VK's limit). */
export const vkNoticeText = (text: string): string => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= 254 ? t : `${t.slice(0, 253).trimEnd()}…`;
};

export class VkService {
  readonly appId: number | null;
  readonly payTest: boolean;
  private db: Db;
  private auth: AuthService;
  private game: Game;
  private secret: string;
  private publicUrl: string;
  private admins: Set<number>;
  private now: () => number;
  private log: (line: string) => void;
  private hits = new Map<string, { n: number; reset: number }>();

  constructor(o: VkOptions) {
    this.db = o.db;
    this.auth = o.auth;
    this.game = o.game;
    this.appId = o.appId && o.appId > 0 ? o.appId : null;
    this.secret = o.secret;
    this.publicUrl = o.publicUrl.replace(/\/$/, '');
    this.payTest = o.payTest === true;
    this.admins = new Set(o.admins ?? []);
    this.now = o.now ?? Date.now;
    this.log = o.log ?? ((l) => console.log(l));
    const key = o.serviceKey?.trim();
    const f = o.fetch ?? (globalThis.fetch as unknown as VkFetch);
    if (key) setVkNoticeDesk(o.game, { send: (user, cat, text) => this.sendNotice(f, key, user, cat, text) });
  }

  /** notifications.sendMessage to one VK user (the notice's kind as the fragment: a tap opens the app at #n_<kind>).
   *  'blocked': VK says her notices are off (error code 1 for her, or the app not allowed); never the key in a log. */
  private async sendNotice(f: VkFetch, key: string, user: number, cat: TgnCat, text: string): Promise<'ok' | 'blocked' | 'error'> {
    const body = new URLSearchParams({ user_ids: String(user), message: vkNoticeText(text), fragment: `n_${cat}`, random_id: String(Math.floor(Math.random() * 2 ** 31)), v: '5.199', access_token: key });
    let r: { response?: { user_id?: number; status?: boolean; error?: { code?: number } }[]; error?: { error_code?: number } };
    try {
      r = (await (await f('https://api.vk.com/method/notifications.sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })).json()) as typeof r;
    } catch {
      this.log(`[vk] notice ${cat}: VK unreachable`);
      return 'error';
    }
    if (r?.error) {
      this.log(`[vk] notice ${cat}: VK API error ${Number(r.error.error_code ?? 0)}`);
      // (the app may not write to her: 15 access denied, 901 / 903 messages or notices not allowed)
      return [15, 901, 903].includes(Number(r.error.error_code)) ? 'blocked' : 'error';
    }
    const one = Array.isArray(r?.response) ? r.response[0] : undefined;
    if (one?.status === true) return 'ok';
    const code = Number(one?.error?.code ?? 0);
    this.log(`[vk] notice ${cat}: not delivered, code ${code}`);
    return code === 1 ? 'blocked' : 'error';
  }

  /** The game's «allow» / «deny» of VK's notices (POST /auth/vk/notify with her token): her VK user's switch. */
  notifyAllow(gameToken: string, on: boolean): { ok: true } | { error: string } {
    const cur = this.auth.resume(gameToken);
    if (!cur) return { error: 'Sign in first.' };
    const st = tgnState(this.game, cur.accountId);
    if (!st?.vk) return { error: 'Not a VK captain.' };
    vkNoticeLink(this.game, cur.accountId, st.vk, st.lang, on);
    return { ok: true };
  }

  /** What the page is told: on, the app's id, payments open (the shop's buttons in votes). */
  config(): { enabled: true; appId: number | null; pay: boolean } {
    return { enabled: true, appId: this.appId, pay: true };
  }

  /** A budget of asks per key in a window (the launch's sign-in: 30 a minute from one address). */
  allow(key: string, n = 30, ms = 60_000): boolean {
    const now = this.now();
    const h = this.hits.get(key);
    if (!h || h.reset < now) {
      if (this.hits.size > 5000) this.hits.clear();
      this.hits.set(key, { n: 1, reset: now + ms });
      return true;
    }
    return ++h.n <= n;
  }

  /** The Mini App's sign-in: the launch checked, the linked account signed in (its own token kept when the page still
   *  holds it), or a new captain named from the VK first name. */
  launch(search: string, name?: string, gameToken?: string): AuthResult | { error: string } {
    const v = checkLaunch(search, this.secret, this.appId, Math.floor(this.now() / 1000));
    if (!v) return { error: 'VK sign-in failed: open the game from VK again.' };
    const subject = String(v.userId);
    const linked = this.db.accountByOAuth(PROVIDER, subject);
    // (her VK user tied to the account for the notices: allowed when the launch says so — docs/36)
    const lang = /^en/i.test(v.lang) ? 'en' : 'ru';
    if (linked && gameToken) {
      const cur = this.auth.resume(gameToken);
      if (cur && cur.accountId === linked.id) {
        vkNoticeLink(this.game, cur.accountId, v.userId, lang, v.notify ? true : null);
        return cur;
      }
    }
    const first = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
    // (oauthLogin keeps letters, digits, spaces; a name shorter than three letters takes the default)
    const display = first.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().length >= 3 ? first : 'Капитан';
    const r = this.auth.oauthLogin(PROVIDER, subject, null, display);
    vkNoticeLink(this.game, r.accountId, v.userId, lang, v.notify ? true : null);
    return r;
  }

  /** The payments' callback (its form's fields): the answer VK wants, never a throw. */
  pay(params: Record<string, string>): VkPayAnswer {
    if (!params.sig || !/^[0-9a-f]{32}$/i.test(params.sig)) return fail(10, 'Bad signature');
    const want = Buffer.from(paySig(params, this.secret));
    const got = Buffer.from(params.sig.toLowerCase());
    if (want.length !== got.length || !timingSafeEqual(want, got)) return fail(10, 'Bad signature');
    if (this.appId && params.app_id && Number(params.app_id) !== this.appId) return fail(11, 'Wrong app');
    const type = String(params.notification_type ?? '');
    const test = type.endsWith('_test');
    const kind = test ? type.slice(0, -5) : type;
    const lang = /^en/i.test(params.lang ?? '') ? 'en' : 'ru';
    if (kind === 'get_item') {
      const pack = vkPack(String(params.item ?? ''));
      if (!pack) return fail(20, 'Item not found');
      return { response: { item_id: pack.id, title: doubloonsTitle(pack.n + pack.bonus, lang), photo_url: `${this.publicUrl}/vk-doubloon.png`, price: packVotes(pack), expiration: 0 } };
    }
    if (kind !== 'order_status_change') return fail(100, 'Unknown notification');
    if (params.status !== 'chargeable') return fail(100, 'Unknown status');
    const order = String(params.order_id ?? '');
    if (!/^\d{1,20}$/.test(order)) return fail(11, 'Bad order');
    const uid = Number(params.receiver_id || params.user_id);
    const key = `vkpay:${test ? 'test:' : ''}${order}`;
    const had = this.db.getKv<VkPayment>(key);
    if (had) return { response: { order_id: Number(order), app_order_id: had.app } };
    const pack = vkPack(String(params.item ?? params.item_id ?? ''));
    if (!pack) return fail(20, 'Item not found');
    if (params.item_price !== undefined && Number(params.item_price) < packVotes(pack)) return fail(11, 'Wrong price');
    if (test && !this.payTest && !this.admins.has(uid) && !this.admins.has(Number(params.user_id))) return fail(101, 'Test payments are not credited on this server');
    const acc = Number.isSafeInteger(uid) && uid > 0 ? this.db.accountByOAuth(PROVIDER, String(uid)) : undefined;
    if (!acc) return fail(22, 'User not found');
    const n = pack.n + pack.bonus;
    // docs/34: the revenue — the pack's roubles (its doubloons before the bonus; a doubloon ≈ 1 ₽)
    const bal = payIn(this.game, acc.id, n, test ? 0 : pack.n, pack.id, `${test ? 'vktest' : 'vk'}:${order}`);
    if (bal === null) return fail(2, 'Temporary error, try again', false);
    const app = (this.db.getKv<number>('vkpay:seq') ?? 0) + 1;
    this.db.setKv('vkpay:seq', app);
    this.db.setKv(key, { account: acc.id, user: uid, pack: pack.id, votes: Number(params.item_price ?? packVotes(pack)), n, app, at: this.now(), test } satisfies VkPayment);
    this.log(`[vk] paid${test ? ' (test)' : ''}: account ${acc.id}, ${pack.id}, ${params.item_price ?? '?'} votes, order ${order}`);
    return { response: { order_id: Number(order), app_order_id: app } };
  }
}

// ------------------------------------------------------------------------------------------------ from the environment

/** The service from the environment, or null without VK_APP_SECRET (then every VK route but the config is a 404). */
export function vkFromEnv(o: { db: Db; auth: AuthService; game: Game; publicUrl: string }, env: NodeJS.ProcessEnv = process.env): VkService | null {
  const secret = env.VK_APP_SECRET?.trim();
  if (!secret) return null;
  const appId = Number(env.VK_APP_ID ?? 0);
  return new VkService({
    ...o,
    secret,
    appId: Number.isSafeInteger(appId) && appId > 0 ? appId : null,
    payTest: env.VK_PAY_TEST === '1',
    serviceKey: env.VK_SERVICE_KEY,
    admins: (env.VK_ADMIN_IDS ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isSafeInteger(x) && x > 0),
  });
}
