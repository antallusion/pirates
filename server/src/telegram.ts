// Telegram (owner, 2026-10-11: «сделай мне еще телеграм версию на поддомене tg. … премиум шоп сделай звездами, и надо
// дать возможность подключаться к игре на начальном экране не только через почту, но и телеграм»). One service, three
// doors — docs/27_TELEGRAM.md:
//  - the Mini App at TG_PUBLIC_URL signs in by its initData (HMAC-SHA256 with HMAC_SHA256("WebAppData", token));
//  - the website's «Войти через Телеграм» is a deep link: a one-time nonce, `t.me/<bot>?start=login_<nonce>`, the bot
//    binds it to the Telegram user, the page polls and takes the game token once (or links an account it names);
//  - the bot's webhook: /start, /paysupport, /terms, the Stars payments (pre_checkout_query, successful_payment).
// Accounts are linked by the OAuth table (provider 'telegram', subject = the Telegram user id): AuthService.oauthLogin
// signs in or makes a guest captain named from the first name. The bot token lives only in the server's environment:
// it is never logged, never sent to a client, and a Bot API error is reported by its code and a cleaned description.

import { telemetry } from './http/telemetry.ts';
import { opsLineRu } from './http/ops.ts';
import { opsOf, trackEvent } from './game/liveops.ts';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthResult, AuthService } from './auth.ts';
import type { Db } from './persistence/db.ts';
import type { Game } from './game/Game.ts';
import { chargebackPremium, payIn, setPayDesk } from './game/premium.ts';
import { doubloonPack } from '../../shared/src/data/premium.ts';
import type { DoubloonPack } from '../../shared/src/data/premium.ts';
import { passProduct } from '../../shared/src/data/seasonpass.ts';
import { passPaid, passRefund } from './game/seasonpass.ts'; // «Сезонная карта» (owner, 2026-10-30)
import { tgDevice, tgLang, tgText, tgTime } from '../../shared/src/data/telegram.ts';
import type { TgLang, TgnCat } from '../../shared/src/data/telegram.ts';
import { noticeLink, notifyCommand, setNoticeDesk, setNotices } from './game/tgnotify.ts';
import { tgFetchFromEnv } from './net/egress.ts';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  /** The Mini App's user: she let the bot write to her (Bot API 6.9+). */
  allows_write_to_pm?: boolean;
}

/** The fetch the Bot API is called with: the global one, or a test's stub. */
export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ json(): Promise<unknown> }>;

const DAY_S = 86_400;
const NONCE_TTL = 10 * 60_000;
const START_LIMIT = 20; // nonces per address per 10 minutes (a carrier's NAT puts many phones behind one address)
const POLL_LIMIT = 90; // polls per address per minute (the page asks every 2 s)
const PROVIDER = 'telegram';

// ------------------------------------------------------------------------------------------------ initData

const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/** The hash Telegram puts on a Mini App's initData: HMAC-SHA256 of the sorted data-check-string under the key
 *  HMAC_SHA256("WebAppData", bot_token). Exported for the tests and the QA's fake Mini App. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dcs = Object.keys(fields).filter((k) => k !== 'hash').sort().map((k) => `${k}=${fields[k]}`).join('\n');
  return hmac(hmac('WebAppData', botToken), dcs).toString('hex');
}

/** The Mini App's initData checked: its hash (with the Bot API 8 `signature` field in the check string, or without it),
 *  its age (no older than a day, not from the future) and its user. Null: not from Telegram, stale, or malformed. */
export function checkInitData(initData: string, botToken: string, nowS = Math.floor(Date.now() / 1000), maxAgeS = DAY_S): { user: TgUser; authDate: number } | null {
  if (typeof initData !== 'string' || !initData || initData.length > 8192 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') ?? '';
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  const fields: Record<string, string> = {};
  for (const [k, v] of params) if (k !== 'hash') fields[k] = v;
  const want = Buffer.from(hash, 'hex');
  const same = (f: Record<string, string>) => timingSafeEqual(Buffer.from(signInitData(f, botToken), 'hex'), want);
  let ok = same(fields);
  if (!ok && 'signature' in fields) {
    const { signature: _drop, ...rest } = fields;
    ok = same(rest);
  }
  if (!ok) return null;
  const authDate = Number(fields.auth_date);
  if (!Number.isInteger(authDate) || nowS - authDate > maxAgeS || authDate - nowS > 300) return null;
  let user: TgUser;
  try {
    user = JSON.parse(fields.user ?? '') as TgUser;
  } catch {
    return null;
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
  return { user: { ...user, first_name: String(user.first_name ?? '') }, authDate };
}

/** The webhook's secret: TELEGRAM_WEBHOOK_SECRET, or the SHA-256 of the token (hex: within Telegram's 1–256 [A-Za-z0-9_-]). */
export function webhookSecret(botToken: string, configured?: string): string {
  return configured && /^[\w-]{1,256}$/.test(configured) ? configured : createHash('sha256').update(botToken).digest('hex');
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// ------------------------------------------------------------------------------------------------ the Bot API

/** A refusal of the Bot API: the method, Telegram's error code and its description with the token cut out. */
export class TgApiError extends Error {
  method: string;
  code: number;
  constructor(method: string, code: number, description: string) {
    super(`${method}: ${code} ${description}`);
    this.method = method;
    this.code = code;
  }
}

export class BotApi {
  #token: string;
  #fetch: FetchFn;

  constructor(token: string, fetchFn: FetchFn) {
    this.#token = token;
    this.#fetch = fetchFn;
  }

  /** A Bot API method with JSON parameters: its result, or a TgApiError (never carrying the token or the raw reply). */
  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let body: { ok?: boolean; result?: T; error_code?: number; description?: string };
    try {
      const res = await this.#fetch(`https://api.telegram.org/bot${this.#token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      body = (await res.json()) as typeof body;
    } catch {
      throw new TgApiError(method, 0, 'unreachable');
    }
    if (!body || body.ok !== true) {
      const desc = String(body?.description ?? 'refused').split(this.#token).join('***').slice(0, 160);
      throw new TgApiError(method, Number(body?.error_code ?? 0), desc);
    }
    return body.result as T;
  }
}

// ------------------------------------------------------------------------------------------------ the service

interface Pending {
  ip: string;
  expires: number;
  created: number;
  /** The code the page shows: the Telegram user picks it among three in the bot before anything is bound. */
  code: string;
  /** The browser that asked (its User-Agent): named in the bot's question. */
  ua: string;
  /** Linking: the account the Telegram user is to be linked to (else a sign-in). */
  link?: number;
  /** The Telegram user who opened the link and was asked for the code (not yet bound). */
  asked?: TgUser;
  /** The three codes the bot offered (the real one among them), in their order. */
  choices?: string[];
  /** The Telegram user who picked the right code: only now is the nonce bound. */
  user?: TgUser;
  /** Linking refused: that Telegram user belongs to another captain. */
  taken?: boolean;
  /** Killed: a wrong code picked, or a second Telegram user on the same link (the page says the code did not match). */
  dead?: boolean;
}

/** Three distinct three-digit codes, the real one among them, in a random order. */
function codeChoices(code: string): string[] {
  const out = new Set([code]);
  while (out.size < 3) out.add(String(randomInt(100, 1000)));
  const list = [...out];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** A payment as kept in the kv table under `tgpay:<telegram_payment_charge_id>` (its doubloons are the ledger's
 *  `doubloons_pay` row with the reference `tg:<charge id>`). */
export interface TgPayment {
  account: number;
  user: number;
  pack: string;
  stars: number;
  n: number;
  at: number;
  refunded: boolean;
}

export type PollResult =
  | { status: 'wait' }
  | { status: 'expired' }
  | { status: 'taken' }
  | { status: 'mismatch' }
  | { status: 'linked'; name: string }
  | ({ status: 'done' } & AuthResult);

export interface TelegramOptions {
  db: Db;
  auth: AuthService;
  game: Game;
  token: string;
  fetch: FetchFn;
  /** The website (the webhook is set to <publicUrl>/tg/webhook). */
  publicUrl: string;
  /** The Mini App's address (the bot's «Играть» buttons). */
  webappUrl: string;
  /** The bot's username, without the @. */
  bot?: string;
  secret?: string;
  /** Telegram user ids allowed the bot's /refund (TELEGRAM_ADMIN_IDS). */
  admins?: number[];
  /** ux2 (2026-10-11): the bot's Main Mini App is set up in BotFather (TG_MAIN_APP=1): the «Играть» buttons in its messages
   *  open it by its direct link in fullscreen (`t.me/<bot>?startapp=play&mode=fullscreen`) instead of a web_app button,
   *  which Telegram opens in its tall mode with its own header (the Mini App then asks for fullscreen itself). */
  mainApp?: boolean;
  /** How the bot's updates arrive (TG_UPDATES): 'webhook' (default, setWebhook), 'poll' (getUpdates long polling:
   *  outbound only, so it works through TG_PROXY when Telegram can't reach the server), 'auto' (the webhook, and long
   *  polling as soon as getWebhookInfo shows Telegram failing to deliver, or setWebhook fails). */
  updates?: TgUpdatesMode;
  /** getUpdates' long-poll wait, seconds (under the egress proxy's 30 s request timeout). */
  pollTimeoutS?: number;
  /** auto: how often getWebhookInfo is asked, ms. */
  watchMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
}

export type TgUpdatesMode = 'webhook' | 'poll' | 'auto';

/** The updates the bot asks for, by webhook or by getUpdates. */
const ALLOWED_UPDATES = ['message', 'callback_query', 'pre_checkout_query'];
/** auto: a delivery error this recent (s) with updates waiting means the webhook doesn't get through. */
const WEBHOOK_ERROR_WINDOW_S = 600;

export interface TgWebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
}

export class TelegramService {
  readonly api: BotApi;
  readonly bot: string;
  readonly secret: string;
  readonly webappUrl: string;
  readonly publicUrl: string;
  readonly mainApp: boolean;
  private db: Db;
  private auth: AuthService;
  private game: Game;
  private token: string;
  private admins: Set<number>;
  private now: () => number;
  private log: (line: string) => void;
  private pending = new Map<string, Pending>();
  private hits = new Map<string, { n: number; reset: number }>();
  readonly updates: TgUpdatesMode;
  /** Long polling is running (TG_UPDATES=poll, or auto after the webhook failed). */
  polling = false;
  private pollTimeoutS: number;
  private watchMs: number;
  private sleep: (ms: number) => Promise<void>;
  private offset = 0;
  private watch: ReturnType<typeof setInterval> | null = null;
  private pollDone: Promise<void> | null = null;

  constructor(o: TelegramOptions) {
    this.db = o.db;
    this.auth = o.auth;
    this.game = o.game;
    this.token = o.token;
    this.api = new BotApi(o.token, o.fetch);
    this.bot = (o.bot ?? 'gravetide_bot').replace(/^@/, '');
    this.secret = webhookSecret(o.token, o.secret);
    this.webappUrl = o.webappUrl;
    this.publicUrl = o.publicUrl.replace(/\/$/, '');
    this.mainApp = o.mainApp === true;
    this.admins = new Set(o.admins ?? []);
    this.now = o.now ?? Date.now;
    this.log = o.log ?? ((l) => console.log(l));
    this.updates = o.updates ?? 'webhook';
    this.pollTimeoutS = o.pollTimeoutS ?? 25;
    this.watchMs = o.watchMs ?? 60_000;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    setPayDesk(o.game, { invoice: (a, p, l) => this.invoice(a, p, l), refund: (c) => this.refund(c) });
    setNoticeDesk(o.game, { send: (chat, cat, text, l) => this.notice(chat, cat, text, l) });
  }

  /** On start: the webhook (message and pre_checkout_query only), the menu button «Играть» → the Mini App, the
   *  commands. Failures are logged by their code and do not stop the world. */
  async setup(): Promise<void> {
    const hook: [string, Record<string, unknown>] = this.updates === 'poll'
      ? ['deleteWebhook', { drop_pending_updates: false }]
      : ['setWebhook', { url: `${this.publicUrl}/tg/webhook`, secret_token: this.secret, allowed_updates: ALLOWED_UPDATES }];
    const steps: [string, Record<string, unknown>][] = [
      hook,
      ['setChatMenuButton', { menu_button: { type: 'web_app', text: tgText('play', 'ru'), web_app: { url: this.webappUrl } } }],
      ['setMyCommands', { commands: this.commands('en') }],
      ['setMyCommands', { commands: this.commands('ru'), language_code: 'ru' }],
    ];
    let hookFailed = false;
    for (const [m, p] of steps) {
      try {
        await this.api.call(m, p);
        this.log(`[tg] ${m} ok`);
      } catch (e) {
        if (m === hook[0]) hookFailed = true;
        this.log(`[tg] ${m} failed: ${(e as Error).message}`);
      }
    }
    if (this.updates === 'poll') this.startPolling('TG_UPDATES=poll');
    else if (this.updates === 'auto') {
      if (hookFailed) await this.toPolling('setWebhook failed');
      else {
        this.watch = setInterval(() => void this.checkWebhook(), this.watchMs);
        this.watch.unref?.();
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- long polling

  /** auto: Telegram's own account of the webhook: a fresh delivery error with updates piling up, or no webhook at
   *  all, and the bot polls instead. True once polling. */
  async checkWebhook(): Promise<boolean> {
    if (this.polling) return true;
    let info: TgWebhookInfo;
    try {
      info = await this.api.call<TgWebhookInfo>('getWebhookInfo');
    } catch (e) {
      this.log(`[tg] getWebhookInfo failed: ${(e as Error).message}`);
      return false;
    }
    const age = Math.floor(this.now() / 1000) - (info.last_error_date ?? 0);
    const failing = !!info.last_error_date && age < WEBHOOK_ERROR_WINDOW_S && (info.pending_update_count ?? 0) > 0;
    if (!failing && info.url) return false;
    const why = info.url ? `webhook failing: ${String(info.last_error_message ?? '').slice(0, 120)} (${info.pending_update_count} waiting)` : 'no webhook set';
    await this.toPolling(why);
    return true;
  }

  /** Drops the webhook (keeping the waiting updates) and polls instead. */
  private async toPolling(why: string): Promise<void> {
    if (this.polling) return;
    if (this.watch) clearInterval(this.watch);
    this.watch = null;
    try {
      await this.api.call('deleteWebhook', { drop_pending_updates: false });
    } catch (e) {
      this.log(`[tg] deleteWebhook failed: ${(e as Error).message}`);
    }
    this.startPolling(why);
  }

  private startPolling(why: string): void {
    if (this.polling) return;
    this.polling = true;
    this.log(`[tg] updates by long polling (${why})`);
    this.pollDone = this.pollLoop();
  }

  /** Stops the long polling and the webhook watch (the server's shutdown); resolves once the loop is out. */
  async stop(): Promise<void> {
    if (this.watch) clearInterval(this.watch);
    this.watch = null;
    this.polling = false;
    await this.pollDone;
  }

  private async pollLoop(): Promise<void> {
    let backoff = 1000;
    let lastLog = -Infinity;
    while (this.polling) {
      let batch: TgUpdate[];
      try {
        batch = await this.api.call<TgUpdate[]>('getUpdates', { offset: this.offset, timeout: this.pollTimeoutS, allowed_updates: ALLOWED_UPDATES });
        backoff = 1000;
      } catch (e) {
        if (!this.polling) break;
        // 409: a webhook is set again (another process' setup); getUpdates refuses while one is set
        if (e instanceof TgApiError && e.code === 409) await this.api.call('deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);
        if (this.now() - lastLog > 60_000) {
          lastLog = this.now();
          this.log(`[tg] getUpdates failed: ${(e as Error).message}`);
        }
        await this.sleep(backoff);
        backoff = Math.min(backoff * 2, 30_000);
        continue;
      }
      if (Array.isArray(batch) && batch.length) await this.handleBatch(batch);
    }
  }

  /** A getUpdates batch: the pre-checkout queries first and together (Telegram gives them 10 s), then the rest in
   *  order; the offset moves past the batch after (a payment seen twice is credited once: `paid` keys on the charge). */
  async handleBatch(batch: TgUpdate[]): Promise<void> {
    const pre = batch.filter((u) => u.pre_checkout_query);
    const rest = batch.filter((u) => !u.pre_checkout_query);
    const fail = (e: unknown): void => this.log(`[tg] update failed: ${(e as Error).message}`);
    await Promise.all(pre.map((u) => this.handleUpdate(u).catch(fail)));
    for (const u of rest) await this.handleUpdate(u).catch(fail);
    const last = Math.max(...batch.map((u) => u.update_id ?? -1));
    if (last >= this.offset) this.offset = last + 1;
  }

  /** The «Играть» button under a message: the Main Mini App's fullscreen direct link (TG_MAIN_APP), else the web_app. */
  playButton(l: TgLang, cat?: TgnCat): { text: string; url: string } | { text: string; web_app: { url: string } } {
    // A notice's button carries its kind (`n_<kind>`: the start parameter, or `?n=` on the web_app's address), so the
    // Mini App opened from it is counted (tgnotify.ts tgn_click).
    if (this.mainApp) return { text: tgText('play', l), url: `https://t.me/${this.bot}?startapp=${cat ? `n_${cat}` : 'play'}&mode=fullscreen` };
    let url = this.webappUrl;
    if (cat) {
      try {
        const u = new URL(this.webappUrl);
        u.searchParams.set('n', cat);
        url = u.toString();
      } catch {
        url = this.webappUrl;
      }
    }
    return { text: tgText('play', l), web_app: { url } };
  }

  /** A notice (tgnotify.ts): its line, the «Играть» button with its kind and «Отключить уведомления». A 403 (the bot
   *  blocked, the chat gone) comes back as 'blocked' — the notices then stop; nothing else is retried. */
  async notice(chat: number, cat: TgnCat, text: string, l: TgLang): Promise<'ok' | 'blocked' | 'error'> {
    try {
      await this.api.call('sendMessage', { chat_id: chat, text, reply_markup: { inline_keyboard: [[this.playButton(l, cat)], [{ text: tgText('n.offBtn', l), callback_data: 'tgn:off' }]] } });
      return 'ok';
    } catch (e) {
      const code = (e as TgApiError).code ?? 0;
      this.log(`[tg] notice ${cat}: ${code}`);
      return code === 403 ? 'blocked' : 'error';
    }
  }

  private commands(l: TgLang): { command: string; description: string }[] {
    return [
      { command: 'start', description: tgText('cmdStart', l) },
      { command: 'paysupport', description: tgText('cmdPaysupport', l) },
      { command: 'terms', description: tgText('cmdTerms', l) },
      { command: 'notify', description: tgText('cmdNotify', l) },
    ];
  }

  /** A per-address budget over a window (false: spent). */
  private allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const h = this.hits.get(key);
    if (!h || h.reset < now) {
      this.hits.set(key, { n: 1, reset: now + windowMs });
      if (this.hits.size > 20_000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
      return true;
    }
    return ++h.n <= limit;
  }

  private sweep(): void {
    const now = this.now();
    for (const [k, p] of this.pending) if (p.expires < now) this.pending.delete(k);
  }

  // ---------------------------------------------------------------------------------------------- the Mini App

  /** The Mini App's sign-in: its initData checked, the linked account signed in (its own token kept when the page
   *  still holds it), or a new guest captain named from the Telegram first name. */
  webappLogin(initData: string, gameToken?: string): AuthResult | { error: string } {
    const v = checkInitData(initData, this.token, Math.floor(this.now() / 1000));
    if (!v) return { error: 'Telegram sign-in failed: open the game from the bot again.' };
    return this.signIn(v.user, gameToken, v.user.allows_write_to_pm === true);
  }

  /** Signed in as this Telegram user; `consent`: Telegram says the bot may write to her (the notices' yes). */
  private signIn(user: TgUser, gameToken?: string, consent = false): AuthResult {
    const linked = this.db.accountByOAuth(PROVIDER, String(user.id));
    if (linked && gameToken) {
      const cur = this.auth.resume(gameToken);
      if (cur && cur.accountId === linked.id) {
        noticeLink(this.game, cur.accountId, user.id, tgLang(user.language_code), consent);
        return cur;
      }
    }
    const r = this.auth.oauthLogin(PROVIDER, String(user.id), null, user.first_name || user.username || 'Captain');
    this.db.setKv(`tglink:${r.accountId}`, user.id);
    noticeLink(this.game, r.accountId, user.id, tgLang(user.language_code), consent);
    return r;
  }

  // ---------------------------------------------------------------------------------------------- the deep link

  /** A one-time nonce for «Войти через Телеграм» (or, with the page's game token, «Привязать Телеграм»): its bot link
   *  and the code the page shows — the bot binds the nonce only to the Telegram user who picks that code. */
  start(ip: string, gameToken?: string, ua = ''): { nonce: string; link: string; expires: number; code: string } | { error: string; status: number } {
    if (!this.allow(`start:${ip}`, START_LIMIT, 10 * 60_000)) return { error: 'Too many attempts. Wait a minute.', status: 429 };
    let link: number | undefined;
    if (gameToken) {
      const cur = this.auth.resume(gameToken);
      if (!cur) return { error: 'Sign in first.', status: 400 };
      link = cur.accountId;
    }
    this.sweep();
    if (this.pending.size > 10_000) return { error: 'Too many attempts. Wait a minute.', status: 429 };
    const nonce = randomBytes(18).toString('base64url');
    const created = this.now();
    const expires = created + NONCE_TTL;
    const code = String(randomInt(100, 1000));
    this.pending.set(nonce, { ip, expires, created, code, ua: String(ua).slice(0, 300), link });
    return { nonce, link: `https://t.me/${this.bot}?start=login_${nonce}`, expires, code };
  }

  /** The page asking whether the bot has seen its nonce: the game token (or the link made) once, then the nonce is gone. */
  poll(nonce: string, ip: string): PollResult | { error: string; status: number } {
    if (!this.allow(`poll:${ip}`, POLL_LIMIT, 60_000)) return { error: 'Too many attempts. Wait a minute.', status: 429 };
    const p = this.pending.get(String(nonce ?? ''));
    if (!p || p.expires < this.now()) {
      if (p) this.pending.delete(nonce);
      return { status: 'expired' };
    }
    if (p.dead) {
      this.pending.delete(nonce);
      return { status: 'mismatch' };
    }
    // nothing is handed over before the right code was picked in the bot
    if (!p.user) return { status: 'wait' };
    this.pending.delete(nonce);
    if (p.taken) return { status: 'taken' };
    if (p.link !== undefined) return { status: 'linked', name: this.db.accountById(p.link)?.name ?? '' };
    return { status: 'done', ...this.signIn(p.user, undefined, true) }; // (she wrote to the bot: it may write back)
  }

  /** The bot's `/start login_<nonce>`: nothing bound yet — the question «choose the code shown on your screen» with
   *  three buttons (the real code and two decoys), the captain to be linked named, the device and the time of the ask.
   *  A second Telegram user on the same link kills it. */
  private async ask(chatId: number, nonce: string, user: TgUser, l: TgLang): Promise<void> {
    const p = this.pending.get(nonce);
    if (!p || p.user || p.dead || p.expires < this.now()) return this.say(chatId, tgText('loginExpired', l));
    if (p.asked && p.asked.id !== user.id) {
      p.dead = true;
      return this.say(chatId, tgText('loginExpired', l));
    }
    p.asked = user;
    p.choices ??= codeChoices(p.code);
    const head = p.link === undefined ? tgText('confirmLogin', l) : tgText('confirmLink', l, { name: this.db.accountById(p.link)?.name ?? '' });
    const text = `${head}\n\n${tgText('confirmFrom', l, { device: tgDevice(p.ua, l), time: tgTime(p.created) })}\n${tgText('confirmWarn', l)}`;
    const keyboard = [p.choices.map((c) => ({ text: c, callback_data: `tgc:${nonce}:${c}` }))];
    try {
      await this.api.call('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard } });
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  /** A code picked in the bot: the right one binds the nonce (the reply's text); a wrong one kills it. */
  private pick(nonce: string, code: string, user: TgUser, l: TgLang): string {
    const p = this.pending.get(nonce);
    if (!p || p.user || p.dead || p.expires < this.now()) return tgText('loginExpired', l);
    if (!p.asked || p.asked.id !== user.id) return tgText('notYours', l);
    if (!p.choices?.includes(code) || !sameSecret(code, p.code)) {
      p.dead = true;
      return tgText('codeWrong', l);
    }
    return this.bind(p, user, l);
  }

  /** The nonce bound to this Telegram user (a link made at once). The reply's text. */
  private bind(p: Pending, user: TgUser, l: TgLang): string {
    p.user = user;
    if (p.link === undefined) return tgText('loginDone', l);
    const other = this.db.accountByOAuth(PROVIDER, String(user.id));
    if (other && other.id !== p.link) {
      p.taken = true;
      return tgText('linkTaken', l, { name: other.name });
    }
    this.db.linkOAuth(PROVIDER, String(user.id), p.link);
    this.db.setKv(`tglink:${p.link}`, user.id);
    noticeLink(this.game, p.link, user.id, l, true);
    return tgText('linkDone', l, { name: this.db.accountById(p.link)?.name ?? '' });
  }

  /** Whether this account has a Telegram user linked (settings show «Телеграм привязан»). */
  linkedFor(gameToken: string): boolean | null {
    const cur = this.auth.resume(gameToken);
    if (!cur) return null;
    return this.db.getKv<number>(`tglink:${cur.accountId}`) !== undefined;
  }

  // ---------------------------------------------------------------------------------------------- the webhook

  /** Whether a webhook request carries the secret set with setWebhook. */
  checkSecret(header: string | string[] | undefined): boolean {
    return typeof header === 'string' && sameSecret(header, this.secret);
  }

  /** One update from Telegram: a command, a code picked, a pre-checkout query, a payment. */
  async handleUpdate(u: TgUpdate): Promise<void> {
    if (u.pre_checkout_query) return this.preCheckout(u.pre_checkout_query);
    if (u.callback_query) return this.callback(u.callback_query);
    const m = u.message;
    if (!m || !m.from) return;
    if (m.successful_payment) return this.paid(m.from, m.successful_payment);
    if (m.refunded_payment) {
      this.takeBack(m.refunded_payment.telegram_payment_charge_id);
      return;
    }
    if (m.chat?.type !== 'private' || typeof m.text !== 'string') return;
    const l = tgLang(m.from.language_code);
    const cmd = /^\/([a-z_]+)(?:@\w+)?(?:\s+(\S+))?/i.exec(m.text.trim());
    if (!cmd) return this.say(m.chat.id, tgText('help', l));
    const arg = cmd[2] ?? '';
    switch (cmd[1].toLowerCase()) {
      case 'start': {
        const login = /^login_([\w-]{16,48})$/.exec(arg);
        if (login) return this.ask(m.chat.id, login[1], m.from, l);
        // She wrote to the bot: it may write to her captain's notices (once she has one; tgnotify.ts).
        const acc = this.db.accountByOAuth(PROVIDER, String(m.from.id));
        if (acc) noticeLink(this.game, acc.id, m.from.id, l, true);
        return this.say(m.chat.id, tgText('welcome', l, { name: m.from.first_name || 'captain' }), true, l);
      }
      case 'paysupport':
        return this.say(m.chat.id, tgText('paysupport', l));
      case 'terms':
        return this.say(m.chat.id, tgText('terms', l));
      case 'notify': {
        // The notices on or off from the chat (tgnotify.ts); a Telegram user with no captain gets the help.
        const acc = this.db.accountByOAuth(PROVIDER, String(m.from.id));
        if (!acc) return this.say(m.chat.id, tgText('help', l));
        noticeLink(this.game, acc.id, m.from.id, l, false);
        return this.say(m.chat.id, notifyCommand(this.game, acc.id, l));
      }
      case 'refund':
        if (!this.admins.has(m.from.id)) return this.say(m.chat.id, tgText('help', l));
        return this.say(m.chat.id, await this.refund(arg));
      case 'telemetry': {
        // docs/33: the owner's look at the players' devices from the bot (the page: /telemetry/admin)
        if (!this.admins.has(m.from.id)) return this.say(m.chat.id, tgText('help', l));
        const t = telemetry();
        if (!t) return this.say(m.chat.id, 'Телеметрия выключена.');
        const days = Math.max(1, Math.min(60, Math.trunc(Number(arg)) || 1));
        const x = t.line(days);
        return this.say(m.chat.id, `Телеметрия за ${days} дн.: отчётов ${x.reports}, устройств ${x.devices}; в море обычно ${x.p50} кадр/с, в худших 5% — ${x.p95}; запуск ${x.boot} с; ошибок JS: ${x.errors}.
${this.publicUrl}/telemetry/admin`);
      }
      case 'ops': {
        // docs/34: the live ops' day from the bot (the panel: /ops/admin)
        if (!this.admins.has(m.from.id)) return this.say(m.chat.id, tgText('help', l));
        const ops = opsOf(this.game);
        if (!ops) return this.say(m.chat.id, 'Лайв-опс выключен.');
        return this.say(m.chat.id, opsLineRu(this.game, ops, this.publicUrl));
      }
      default:
        return this.say(m.chat.id, tgText('help', l));
    }
  }

  /** A button of the code question pressed: answered (the small notice) and the question replaced by the outcome. */
  private async callback(q: NonNullable<TgUpdate['callback_query']>): Promise<void> {
    const l = tgLang(q.from?.language_code);
    if (q.data === 'tgn:off') return this.noticesOff(q, l);
    const m = /^tgc:([\w-]{16,48}):(\d{3})$/.exec(String(q.data ?? ''));
    const text = m && q.from ? this.pick(m[1], m[2], q.from, l) : tgText('loginExpired', l);
    const done = this.pending.get(m?.[1] ?? '')?.user !== undefined;
    try {
      await this.api.call('answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, 190) });
      if (q.message?.chat) {
        const play = done ? { reply_markup: { inline_keyboard: [[this.playButton(l)]] } } : {};
        await this.api.call('editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text, ...play });
      }
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  /** A notice's «Отключить уведомления»: her notices off, the button's answer says so (the notice itself stays). */
  private async noticesOff(q: NonNullable<TgUpdate['callback_query']>, l: TgLang): Promise<void> {
    const acc = q.from ? this.db.accountByOAuth(PROVIDER, String(q.from.id)) : undefined;
    if (acc) setNotices(this.game, acc.id, 'all', false);
    try {
      await this.api.call('answerCallbackQuery', { callback_query_id: q.id, text: tgText('n.off', l).slice(0, 190), show_alert: true });
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  /** A message to a chat, with the «Играть» web_app button under it when asked. */
  private async say(chatId: number, text: string, play = false, l: TgLang = 'ru'): Promise<void> {
    const markup = play ? { reply_markup: { inline_keyboard: [[this.playButton(l)]] } } : {};
    try {
      await this.api.call('sendMessage', { chat_id: chatId, text, ...markup });
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------------------------- Stars

  /** The invoice's payload: `<account>:<pack>:<nonce>` (Telegram keeps up to 128 bytes). */
  static payload(accountId: number, packId: string, nonce = randomBytes(6).toString('base64url')): string {
    return `${accountId}:${packId}:${nonce}`;
  }

  /** The payload read back and checked against the account and the pack (null: no longer valid). A season card's pass
   *  (owner, 2026-10-30) stands as a pack of its roubles' doubloons, no bonus, at its own Stars. */
  private order(payload: string): { accountId: number; pack: DoubloonPack } | null {
    const m = /^(\d{1,12}):([a-z0-9_]{1,16}):[\w-]{1,24}$/.exec(String(payload ?? ''));
    if (!m) return null;
    const accountId = Number(m[1]);
    const pack = packOrPass(m[2]);
    if (!pack || !this.db.accountById(accountId)) return null;
    return { accountId, pack };
  }

  /** A Stars invoice link for a pack (createInvoiceLink, XTR, no provider token). */
  async invoice(accountId: number, packId: string, l: TgLang): Promise<string | null> {
    const pack = packOrPass(packId);
    const acc = this.db.accountById(accountId);
    if (!pack || !acc) return null;
    const n = pack.n + pack.bonus;
    const pass = passProduct(pack.id);
    const title = pass ? tgText('passTitle', l, { pass: pass.name[l === 'ru' ? 1 : 0] }) : tgText('invoiceTitle', l, { n });
    try {
      return await this.api.call<string>('createInvoiceLink', {
        title,
        description: pass ? tgText('passText', l, { pass: pass.name[l === 'ru' ? 1 : 0], name: acc.name }) : tgText('invoiceText', l, { n, name: acc.name }),
        payload: TelegramService.payload(accountId, pack.id),
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: title, amount: pack.stars }],
      });
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
      return null;
    }
  }

  /** The last word before Telegram takes the Stars: the account still there, the pack and its price the same. */
  private async preCheckout(q: NonNullable<TgUpdate['pre_checkout_query']>): Promise<void> {
    const o = this.order(q.invoice_payload);
    const ok = !!o && q.currency === 'XTR' && q.total_amount === o.pack.stars;
    const answer: Record<string, unknown> = { pre_checkout_query_id: q.id, ok };
    if (!ok) answer.error_message = tgText('badPayment', tgLang(q.from?.language_code));
    try {
      await this.api.call('answerPreCheckoutQuery', answer);
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  /** The Stars are in: the pack's doubloons credited once per charge id (the ledger's reference and the kv record),
   *  the captain told in the game and in the chat. */
  private async paid(from: TgUser, p: NonNullable<TgMessage['successful_payment']>): Promise<void> {
    const charge = String(p.telegram_payment_charge_id ?? '');
    if (!charge || p.currency !== 'XTR') return;
    const key = `tgpay:${charge}`;
    if (this.db.getKv<TgPayment>(key)) return;
    const o = this.order(p.invoice_payload);
    if (!o) {
      this.log(`[tg] payment ${charge.slice(0, 12)}… with a payload no longer valid: left for /paysupport`);
      return;
    }
    const n = o.pack.n + o.pack.bonus;
    const pass = passProduct(o.pack.id);
    if (pass) {
      // the season card's pass (owner, 2026-10-30): its roubles in as doubloons, the pass bought with them, once by the charge
      const why = passPaid(this.game, o.accountId, pass.id, `tg:${charge}`, pass.rub);
      if (why === 'No such account') return;
      this.db.setKv(key, { account: o.accountId, user: from.id, pack: o.pack.id, stars: p.total_amount, n, at: this.now(), refunded: false } satisfies TgPayment);
      this.log(`[tg] paid: account ${o.accountId}, ${o.pack.id}, ${p.total_amount} XTR, charge ${charge}${why ? ` (kept as doubloons: ${why})` : ''}`);
      await this.say(from.id, tgText(why ? 'paid' : 'passPaid', tgLang(from.language_code), { n, pass: pass.name[tgLang(from.language_code) === 'ru' ? 1 : 0], name: this.db.accountById(o.accountId)?.name ?? '' }));
      return;
    }
    // docs/34: the revenue — the pack's roubles (its doubloons before the bonus; a doubloon ≈ 1 ₽)
    const bal = payIn(this.game, o.accountId, n, o.pack.n, o.pack.id, `tg:${charge}`);
    if (bal === null) return;
    this.db.setKv(key, { account: o.accountId, user: from.id, pack: o.pack.id, stars: p.total_amount, n, at: this.now(), refunded: false } satisfies TgPayment);
    this.log(`[tg] paid: account ${o.accountId}, ${o.pack.id}, ${p.total_amount} XTR, charge ${charge}`);
    await this.say(from.id, tgText('paid', tgLang(from.language_code), { n, name: this.db.accountById(o.accountId)?.name ?? '' }));
  }

  /** A refunded payment's doubloons taken back (as far as the balance goes), once. The amount taken, or null. */
  private takeBack(charge: string): number | null {
    const key = `tgpay:${charge}`;
    const rec = this.db.getKv<TgPayment>(key);
    if (!rec || rec.refunded) return null;
    // a season card's pass (owner, 2026-10-30): the pass taken back and its doubloons put back for the chargeback
    const pass = passProduct(rec.pack);
    if (pass) passRefund(this.game, rec.account, pass.id, `tg:${charge}`);
    const n = chargebackPremium(this.game, rec.account, rec.n, `tg:${charge}`);
    this.db.setKv(key, { ...rec, refunded: true });
    // docs/34: the revenue given back (the pack's roubles: its id is d<roubles>)
    trackEvent(this.game, rec.account, 'refund', { amount: Number(/^d(\d+)$/.exec(rec.pack)?.[1] ?? 0), product: rec.pack });
    return n;
  }

  /** The admin's refund: refundStarPayment to the payer, then the doubloons taken back. The reply in words. */
  async refund(chargeId: string): Promise<string> {
    const charge = String(chargeId ?? '').trim();
    const rec = this.db.getKv<TgPayment>(`tgpay:${charge}`);
    if (!rec) return `No Stars payment ${charge} on record.`;
    if (rec.refunded) return `Payment ${charge} was refunded already.`;
    try {
      await this.api.call('refundStarPayment', { user_id: rec.user, telegram_payment_charge_id: charge });
    } catch (e) {
      return `The refund failed: Bot API error ${(e as TgApiError).code ?? 0}.`;
    }
    const n = this.takeBack(charge) ?? 0;
    return `Refunded ${rec.stars} stars for payment ${charge}; ${n} of ${rec.n} doubloons taken back.`;
  }
}

/** A pack of the top-up, or a season card's pass as a pack of its roubles' doubloons at its own Stars (owner, 2026-10-30). */
function packOrPass(id: string): DoubloonPack | undefined {
  const pack = doubloonPack(id);
  if (pack) return pack;
  const p = passProduct(id);
  return p ? { id: p.id, n: p.rub, bonus: 0, stars: p.stars } : undefined;
}

// ------------------------------------------------------------------------------------------------ the updates' shape

export interface TgMessage {
  message_id?: number;
  from?: TgUser;
  chat?: { id: number; type: string };
  text?: string;
  successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string; provider_payment_charge_id?: string };
  refunded_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string };
}

export interface TgUpdate {
  update_id?: number;
  message?: TgMessage;
  callback_query?: { id: string; from?: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
  pre_checkout_query?: { id: string; from?: TgUser; currency: string; total_amount: number; invoice_payload: string };
}

// ------------------------------------------------------------------------------------------------ from the environment

/** The service from the environment, or null without TELEGRAM_BOT_TOKEN (then every Telegram route is a 404 and the
 *  client shows no Telegram button). TELEGRAM_FAKE=1 answers the Bot API locally (QA: no network, no webhook).
 *  TG_PROXY=http://127.0.0.1:8118 sends the Bot API through the server's egress proxy (net/egress.ts). */
export function telegramFromEnv(o: { db: Db; auth: AuthService; game: Game; publicUrl: string }, env: NodeJS.ProcessEnv = process.env): TelegramService | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  const fake = env.TELEGRAM_FAKE === '1';
  return new TelegramService({
    ...o,
    token,
    fetch: fake ? fakeBotApi() : (tgFetchFromEnv(env) as unknown as FetchFn),
    webappUrl: env.TG_PUBLIC_URL ?? 'https://tg.gravetidegame.com',
    bot: env.TELEGRAM_BOT_USERNAME ?? 'gravetide_bot',
    secret: env.TELEGRAM_WEBHOOK_SECRET,
    admins: (env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isSafeInteger(x) && x > 0),
    mainApp: env.TG_MAIN_APP === '1',
    updates: tgUpdatesMode(env.TG_UPDATES),
  });
}

/** TG_UPDATES: poll | auto | webhook (anything else = webhook). */
export function tgUpdatesMode(v: string | undefined): TgUpdatesMode {
  const m = (v ?? '').trim().toLowerCase();
  return m === 'poll' || m === 'auto' ? m : 'webhook';
}

/** A Bot API that answers every method locally (TELEGRAM_FAKE=1 and the tests): `calls` keeps what was asked. */
export function fakeBotApi(calls: { method: string; params: Record<string, unknown> }[] = []): FetchFn {
  return async (url, init) => {
    const method = url.slice(url.lastIndexOf('/') + 1);
    const params = JSON.parse(init.body || '{}') as Record<string, unknown>;
    calls.push({ method, params });
    const result = method === 'createInvoiceLink' ? `https://t.me/$fake-invoice-${String(params.payload ?? '').replace(/[^\w-]/g, '_')}` : true;
    return { json: async () => ({ ok: true, result }) };
  };
}
