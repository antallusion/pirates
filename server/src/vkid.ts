// «Войти через VK ID» on the website (owner, 2026-10-25; docs/36_VK.md §8). The VK Mini App signs in by its launch
// parameters (vk.ts); the website has none of them, so it takes VK ID — OAuth 2.1, the authorization code with PKCE:
//   1. GET /auth/vkid/start — a one-time `state` and a `code_verifier` kept here (ten minutes, server memory), the
//      browser sent to id.vk.com/authorize with code_challenge = base64url(SHA-256(verifier));
//   2. VK sends her back to /auth/vkid/callback?code=…&state=…&device_id=…;
//   3. the code exchanged (POST id.vk.com/oauth2/auth with the same verifier and the device id), and who she is asked
//      (POST id.vk.com/oauth2/user_info). Her account is the OAuth table's (provider 'vk', subject = VK user id) — the
//      very link the Mini App's sign-in makes, so the website and VK are one captain.
// Linking («Привязать VK»): the page trades its game token for a one-time ticket (POST /auth/vkid/link), the start
// carries the ticket, and the callback ties that VK user to the captain — only if the VK user has no captain of its
// own (two captains are never merged) and the captain has no other VK user.
// No secret: VK ID with PKCE needs only the app's public id (VKID_APP_ID). Never a token in a log.

import { createHash, randomBytes } from 'node:crypto';
import type { AuthService } from './auth.ts';
import type { Db } from './persistence/db.ts';
import type { Game } from './game/Game.ts';
import { tgnState, vkNoticeLink } from './game/tgnotify.ts';

const PROVIDER = 'vk'; // the Mini App's own (vk.ts): one account for both doors
const PENDING_MS = 10 * 60_000;
const TICKET_MS = 2 * 60_000;
/** The Mini App's id when the environment names none (docs/36). */
export const VK_MINI_APP_DEFAULT = 54838627;
export const VKID_REDIRECT_DEFAULT = 'https://gravetidegame.com/auth/vkid/callback';

export type VkIdFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ json(): Promise<unknown> }>;

export interface VkIdOptions {
  db: Db;
  auth: AuthService;
  game: Game;
  /** VKID_APP_ID: the VK ID app's public client id. */
  appId: string;
  /** The trusted Redirect URL registered at id.vk.com (VKID_REDIRECT_URL, else gravetidegame.com's). */
  redirectUri?: string;
  /** VK ID's host (VKID_API_BASE: a QA server's mock; else https://id.vk.com). */
  apiBase?: string;
  /** The VK Mini App's id (VK_APP_ID) — the hint's link to allow the notices there. */
  miniAppId?: number | null;
  fetch?: VkIdFetch;
  now?: () => number;
  log?: (line: string) => void;
}

interface Pending {
  verifier: string;
  expires: number;
  /** Linking: the captain the VK user is to be tied to (else a sign-in). */
  link?: number;
  lang: 'ru' | 'en';
}

/** The words of a refusal (English; the page has them in Russian: client/src/lang/server.ru.tg.ts). */
export const VKID_ERR = {
  expired: 'This VK ID sign-in has expired. Try again.',
  denied: 'VK ID sign-in was cancelled.',
  failed: 'VK ID did not answer. Try again in a minute.',
  signIn: 'Sign in first.',
  taken: 'That VK ID already belongs to another captain.',
  other: 'This captain already has another VK linked.',
} as const;

export type VkIdOutcome =
  | { kind: 'login'; token: string; accountId: number; name: string; vkUser: number; notify: boolean }
  | { kind: 'linked'; accountId: number; vkUser: number; notify: boolean }
  | { kind: 'error'; error: string };

export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export class VkIdService {
  readonly appId: string;
  readonly redirectUri: string;
  readonly apiBase: string;
  readonly miniApp: string;
  private db: Db;
  private auth: AuthService;
  private game: Game;
  private f: VkIdFetch;
  private now: () => number;
  private log: (line: string) => void;
  private pending = new Map<string, Pending>();
  private tickets = new Map<string, { account: number; expires: number }>();
  private hits = new Map<string, { n: number; reset: number }>();

  constructor(o: VkIdOptions) {
    this.db = o.db;
    this.auth = o.auth;
    this.game = o.game;
    this.appId = o.appId;
    this.redirectUri = o.redirectUri || VKID_REDIRECT_DEFAULT;
    this.apiBase = (o.apiBase || 'https://id.vk.com').replace(/\/$/, '');
    this.miniApp = `https://vk.com/app${o.miniAppId && o.miniAppId > 0 ? o.miniAppId : VK_MINI_APP_DEFAULT}`;
    this.f = o.fetch ?? (globalThis.fetch as unknown as VkIdFetch);
    this.now = o.now ?? Date.now;
    this.log = o.log ?? ((l) => console.log(l));
  }

  config(): { enabled: true; miniApp: string } {
    return { enabled: true, miniApp: this.miniApp };
  }

  /** A budget of asks per key in a window (30 a minute from one address). */
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

  private sweep(): void {
    const now = this.now();
    for (const [k, v] of this.pending) if (v.expires < now) this.pending.delete(k);
    for (const [k, v] of this.tickets) if (v.expires < now) this.tickets.delete(k);
    // (a flood of starts never grows the memory past this)
    if (this.pending.size > 20_000) this.pending.clear();
    if (this.tickets.size > 20_000) this.tickets.clear();
  }

  /** «Привязать VK»: her game token traded for a one-time ticket the start carries (the token never in an address). */
  linkTicket(gameToken: string): { url: string } | { error: string } {
    const cur = this.auth.resume(String(gameToken ?? ''));
    if (!cur) return { error: VKID_ERR.signIn };
    this.sweep();
    const ticket = randomBytes(18).toString('base64url');
    this.tickets.set(ticket, { account: cur.accountId, expires: this.now() + TICKET_MS });
    return { url: `/auth/vkid/start?link=${ticket}` };
  }

  /** Where to send her browser: VK ID's authorize with a fresh state and PKCE. `link`: a ticket (else a sign-in). */
  start(o: { link?: string | null; lang?: string | null } = {}): { url: string } | { error: string } {
    this.sweep();
    let link: number | undefined;
    if (o.link) {
      const t = this.tickets.get(o.link);
      this.tickets.delete(o.link);
      if (!t || t.expires < this.now()) return { error: VKID_ERR.expired };
      link = t.account;
    }
    const verifier = randomBytes(48).toString('base64url');
    const state = randomBytes(24).toString('base64url');
    this.pending.set(state, { verifier, expires: this.now() + PENDING_MS, link, lang: o.lang === 'en' ? 'en' : 'ru' });
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: pkceChallenge(verifier),
      // (VK ID's own spelling, as fovgame.com's working sign-in sends it)
      code_challenge_method: 's256',
      scope: 'vkid.personal_info',
    });
    return { url: `${this.apiBase}/authorize?${q}` };
  }

  private async post(path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
    const r = await this.f(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const v = await r.json();
    return typeof v === 'object' && v ? (v as Record<string, unknown>) : {};
  }

  /** VK's answer at the callback: the state checked (once), the code exchanged, the VK user read, the captain found,
   *  made or linked. */
  async finish(q: URLSearchParams): Promise<VkIdOutcome> {
    const state = q.get('state') ?? '';
    const p = state ? this.pending.get(state) : undefined;
    if (state) this.pending.delete(state);
    if (!p || p.expires < this.now()) return { kind: 'error', error: VKID_ERR.expired };
    const code = q.get('code') ?? '';
    if (!code || code.length > 2048) return { kind: 'error', error: VKID_ERR.denied };
    const deviceId = (q.get('device_id') ?? '').slice(0, 512);
    let user: { id: number; first: string };
    try {
      const tok = await this.post('/oauth2/auth', {
        grant_type: 'authorization_code', code_verifier: p.verifier, redirect_uri: this.redirectUri, code, client_id: this.appId, device_id: deviceId, state,
      });
      const access = typeof tok.access_token === 'string' ? tok.access_token : '';
      if (!access || (typeof tok.state === 'string' && tok.state !== state)) {
        this.log(`[vkid] code exchange refused: ${typeof tok.error === 'string' ? tok.error.slice(0, 60) : 'no access token'}`);
        return { kind: 'error', error: VKID_ERR.failed };
      }
      const info = await this.post('/oauth2/user_info', { client_id: this.appId, access_token: access });
      const u = (info.user ?? {}) as { user_id?: string | number; first_name?: string };
      const id = Number(u.user_id ?? tok.user_id);
      if (!Number.isSafeInteger(id) || id <= 0 || (tok.user_id !== undefined && Number(tok.user_id) !== id)) {
        this.log('[vkid] no VK user in the answer');
        return { kind: 'error', error: VKID_ERR.failed };
      }
      user = { id, first: typeof u.first_name === 'string' ? u.first_name : '' };
    } catch {
      this.log('[vkid] VK ID unreachable');
      return { kind: 'error', error: VKID_ERR.failed };
    }
    const subject = String(user.id);
    const owner = this.db.accountByOAuth(PROVIDER, subject);
    if (p.link !== undefined) {
      const acc = this.db.accountById(p.link);
      if (!acc) return { kind: 'error', error: VKID_ERR.signIn };
      if (owner && owner.id !== acc.id) return { kind: 'error', error: VKID_ERR.taken };
      const had = tgnState(this.game, acc.id)?.vk;
      if (had && had !== user.id) return { kind: 'error', error: VKID_ERR.other };
      if (!owner) this.db.linkOAuth(PROVIDER, subject, acc.id);
      const st = vkNoticeLink(this.game, acc.id, user.id, p.lang, null);
      this.log(`[vkid] VK linked to account ${acc.id}`);
      return { kind: 'linked', accountId: acc.id, vkUser: user.id, notify: st.vkOff === false };
    }
    const first = user.first.replace(/\s+/g, ' ').trim().slice(0, 20);
    // (as the Mini App names her: the VK first name, or «Капитан» for one too short)
    const display = first.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().length >= 3 ? first : 'Капитан';
    const r = this.auth.oauthLogin(PROVIDER, subject, null, display);
    // her VK user tied for the notices — their permission as it was (only VK's own «allow» in the Mini App gives it)
    const st = vkNoticeLink(this.game, r.accountId, user.id, p.lang, null);
    return { kind: 'login', token: r.token, accountId: r.accountId, name: r.name, vkUser: user.id, notify: st.vkOff === false };
  }

  /** The settings' button: whether her captain has VK, and whether VK may write to her. */
  status(gameToken: string): { linked: boolean; notify: boolean } | { error: string } {
    const cur = this.auth.resume(String(gameToken ?? ''));
    if (!cur) return { error: VKID_ERR.signIn };
    const st = tgnState(this.game, cur.accountId);
    return { linked: !!st?.vk, notify: st?.vkOff === false };
  }
}

/** The service from the environment, or null without VKID_APP_ID (then the button is hidden and the routes 404). */
export function vkIdFromEnv(o: { db: Db; auth: AuthService; game: Game }, env: NodeJS.ProcessEnv = process.env): VkIdService | null {
  const appId = env.VKID_APP_ID?.trim();
  if (!appId || !/^\d{1,20}$/.test(appId)) return null;
  const mini = Number(env.VK_APP_ID ?? 0);
  return new VkIdService({
    ...o,
    appId,
    redirectUri: env.VKID_REDIRECT_URL?.trim() || VKID_REDIRECT_DEFAULT,
    apiBase: env.VKID_API_BASE?.trim() || undefined,
    miniAppId: Number.isSafeInteger(mini) && mini > 0 ? mini : null,
  });
}
