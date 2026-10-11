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

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthResult, AuthService } from './auth.ts';
import type { Db } from './persistence/db.ts';
import type { Game } from './game/Game.ts';
import { chargebackPremium, creditPremium, sendPremium, setPayDesk } from './game/premium.ts';
import { doubloonPack } from '../../shared/src/data/premium.ts';
import { tgDevice, tgLang, tgText, tgTime } from '../../shared/src/data/telegram.ts';
import type { TgLang } from '../../shared/src/data/telegram.ts';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
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
  now?: () => number;
  log?: (line: string) => void;
}

export class TelegramService {
  readonly api: BotApi;
  readonly bot: string;
  readonly secret: string;
  readonly webappUrl: string;
  readonly publicUrl: string;
  private db: Db;
  private auth: AuthService;
  private game: Game;
  private token: string;
  private admins: Set<number>;
  private now: () => number;
  private log: (line: string) => void;
  private pending = new Map<string, Pending>();
  private hits = new Map<string, { n: number; reset: number }>();

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
    this.admins = new Set(o.admins ?? []);
    this.now = o.now ?? Date.now;
    this.log = o.log ?? ((l) => console.log(l));
    setPayDesk(o.game, { invoice: (a, p, l) => this.invoice(a, p, l), refund: (c) => this.refund(c) });
  }

  /** On start: the webhook (message and pre_checkout_query only), the menu button «Играть» → the Mini App, the
   *  commands. Failures are logged by their code and do not stop the world. */
  async setup(): Promise<void> {
    const steps: [string, Record<string, unknown>][] = [
      ['setWebhook', { url: `${this.publicUrl}/tg/webhook`, secret_token: this.secret, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] }],
      ['setChatMenuButton', { menu_button: { type: 'web_app', text: tgText('play', 'ru'), web_app: { url: this.webappUrl } } }],
      ['setMyCommands', { commands: this.commands('en') }],
      ['setMyCommands', { commands: this.commands('ru'), language_code: 'ru' }],
    ];
    for (const [m, p] of steps) {
      try {
        await this.api.call(m, p);
        this.log(`[tg] ${m} ok`);
      } catch (e) {
        this.log(`[tg] ${m} failed: ${(e as Error).message}`);
      }
    }
  }

  private commands(l: TgLang): { command: string; description: string }[] {
    return [
      { command: 'start', description: tgText('cmdStart', l) },
      { command: 'paysupport', description: tgText('cmdPaysupport', l) },
      { command: 'terms', description: tgText('cmdTerms', l) },
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
    return this.signIn(v.user, gameToken);
  }

  private signIn(user: TgUser, gameToken?: string): AuthResult {
    const linked = this.db.accountByOAuth(PROVIDER, String(user.id));
    if (linked && gameToken) {
      const cur = this.auth.resume(gameToken);
      if (cur && cur.accountId === linked.id) return cur;
    }
    const r = this.auth.oauthLogin(PROVIDER, String(user.id), null, user.first_name || user.username || 'Captain');
    this.db.setKv(`tglink:${r.accountId}`, user.id);
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
    return { status: 'done', ...this.signIn(p.user) };
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
        return this.say(m.chat.id, tgText('welcome', l, { name: m.from.first_name || 'captain' }), true, l);
      }
      case 'paysupport':
        return this.say(m.chat.id, tgText('paysupport', l));
      case 'terms':
        return this.say(m.chat.id, tgText('terms', l));
      case 'refund':
        if (!this.admins.has(m.from.id)) return this.say(m.chat.id, tgText('help', l));
        return this.say(m.chat.id, await this.refund(arg));
      default:
        return this.say(m.chat.id, tgText('help', l));
    }
  }

  /** A button of the code question pressed: answered (the small notice) and the question replaced by the outcome. */
  private async callback(q: NonNullable<TgUpdate['callback_query']>): Promise<void> {
    const l = tgLang(q.from?.language_code);
    const m = /^tgc:([\w-]{16,48}):(\d{3})$/.exec(String(q.data ?? ''));
    const text = m && q.from ? this.pick(m[1], m[2], q.from, l) : tgText('loginExpired', l);
    const done = this.pending.get(m?.[1] ?? '')?.user !== undefined;
    try {
      await this.api.call('answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, 190) });
      if (q.message?.chat) {
        const play = done ? { reply_markup: { inline_keyboard: [[{ text: tgText('play', l), web_app: { url: this.webappUrl } }]] } } : {};
        await this.api.call('editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text, ...play });
      }
    } catch (e) {
      this.log(`[tg] ${(e as Error).message}`);
    }
  }

  /** A message to a chat, with the «Играть» web_app button under it when asked. */
  private async say(chatId: number, text: string, play = false, l: TgLang = 'ru'): Promise<void> {
    const markup = play ? { reply_markup: { inline_keyboard: [[{ text: tgText('play', l), web_app: { url: this.webappUrl } }]] } } : {};
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

  /** The payload read back and checked against the account and the pack (null: no longer valid). */
  private order(payload: string): { accountId: number; pack: NonNullable<ReturnType<typeof doubloonPack>> } | null {
    const m = /^(\d{1,12}):([a-z0-9_]{1,16}):[\w-]{1,24}$/.exec(String(payload ?? ''));
    if (!m) return null;
    const accountId = Number(m[1]);
    const pack = doubloonPack(m[2]);
    if (!pack || !this.db.accountById(accountId)) return null;
    return { accountId, pack };
  }

  /** A Stars invoice link for a pack (createInvoiceLink, XTR, no provider token). */
  async invoice(accountId: number, packId: string, l: TgLang): Promise<string | null> {
    const pack = doubloonPack(packId);
    const acc = this.db.accountById(accountId);
    if (!pack || !acc) return null;
    const n = pack.n + pack.bonus;
    try {
      return await this.api.call<string>('createInvoiceLink', {
        title: tgText('invoiceTitle', l, { n }),
        description: tgText('invoiceText', l, { n, name: acc.name }),
        payload: TelegramService.payload(accountId, pack.id),
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: tgText('invoiceTitle', l, { n }), amount: pack.stars }],
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
    const bal = creditPremium(this.game, o.accountId, n, 'pay', `tg:${charge}`);
    if (bal === null) return;
    this.db.setKv(key, { account: o.accountId, user: from.id, pack: o.pack.id, stars: p.total_amount, n, at: this.now(), refunded: false } satisfies TgPayment);
    this.log(`[tg] paid: account ${o.accountId}, ${o.pack.id}, ${p.total_amount} XTR, charge ${charge}`);
    const s = this.game.sessionByAccount(o.accountId);
    if (s) sendPremium(this.game, s);
    await this.say(from.id, tgText('paid', tgLang(from.language_code), { n, name: this.db.accountById(o.accountId)?.name ?? '' }));
  }

  /** A refunded payment's doubloons taken back (as far as the balance goes), once. The amount taken, or null. */
  private takeBack(charge: string): number | null {
    const key = `tgpay:${charge}`;
    const rec = this.db.getKv<TgPayment>(key);
    if (!rec || rec.refunded) return null;
    const n = chargebackPremium(this.game, rec.account, rec.n, `tg:${charge}`);
    this.db.setKv(key, { ...rec, refunded: true });
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
 *  client shows no Telegram button). TELEGRAM_FAKE=1 answers the Bot API locally (QA: no network, no webhook). */
export function telegramFromEnv(o: { db: Db; auth: AuthService; game: Game; publicUrl: string }, env: NodeJS.ProcessEnv = process.env): TelegramService | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  const fake = env.TELEGRAM_FAKE === '1';
  return new TelegramService({
    ...o,
    token,
    fetch: fake ? fakeBotApi() : (globalThis.fetch as unknown as FetchFn),
    webappUrl: env.TG_PUBLIC_URL ?? 'https://tg.gravetidegame.com',
    bot: env.TELEGRAM_BOT_USERNAME ?? 'gravetide_bot',
    secret: env.TELEGRAM_WEBHOOK_SECRET,
    admins: (env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isSafeInteger(x) && x > 0),
  });
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
