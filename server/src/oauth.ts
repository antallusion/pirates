// OAuth 2.0 sign-in (authorization-code flow). Providers are turned on by their client id and secret in the
// environment: OAUTH_GITHUB_ID / OAUTH_GITHUB_SECRET, OAUTH_GOOGLE_ID / …, OAUTH_DISCORD_ID / …
// The callback exchanges the code, reads the user's id, e-mail and name, and signs them in through AuthService.

import { randomBytes } from 'node:crypto';

export interface OAuthProfile {
  subject: string;
  email: string | null;
  name: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Reads the signed-in user with the access token. */
  profile(accessToken: string, fetchFn: typeof fetch): Promise<OAuthProfile>;
}

type Env = Record<string, string | undefined>;

export function providersFromEnv(env: Env = process.env): OAuthProvider[] {
  const out: OAuthProvider[] = [];
  if (env.OAUTH_GITHUB_ID && env.OAUTH_GITHUB_SECRET) {
    out.push({
      id: 'github', name: 'GitHub', clientId: env.OAUTH_GITHUB_ID, clientSecret: env.OAUTH_GITHUB_SECRET,
      authorizeUrl: 'https://github.com/login/oauth/authorize', tokenUrl: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email',
      async profile(token, f) {
        const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'gravetide' };
        const u = (await (await f('https://api.github.com/user', { headers: h })).json()) as { id: number; login: string; name?: string; email?: string };
        let email = u.email ?? null;
        if (!email) {
          const list = (await (await f('https://api.github.com/user/emails', { headers: h })).json()) as { email: string; primary: boolean; verified: boolean }[];
          email = list.find((e) => e.primary && e.verified)?.email ?? null;
        }
        return { subject: String(u.id), email, name: u.name || u.login };
      },
    });
  }
  if (env.OAUTH_GOOGLE_ID && env.OAUTH_GOOGLE_SECRET) {
    out.push({
      id: 'google', name: 'Google', clientId: env.OAUTH_GOOGLE_ID, clientSecret: env.OAUTH_GOOGLE_SECRET,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scope: 'openid email profile',
      async profile(token, f) {
        const u = (await (await f('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } })).json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
        return { subject: u.sub, email: u.email_verified ? u.email ?? null : null, name: u.name ?? 'Captain' };
      },
    });
  }
  if (env.OAUTH_DISCORD_ID && env.OAUTH_DISCORD_SECRET) {
    out.push({
      id: 'discord', name: 'Discord', clientId: env.OAUTH_DISCORD_ID, clientSecret: env.OAUTH_DISCORD_SECRET,
      authorizeUrl: 'https://discord.com/oauth2/authorize', tokenUrl: 'https://discord.com/api/oauth2/token', scope: 'identify email',
      async profile(token, f) {
        const u = (await (await f('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } })).json()) as { id: string; username: string; global_name?: string; email?: string; verified?: boolean };
        return { subject: u.id, email: u.verified ? u.email ?? null : null, name: u.global_name || u.username };
      },
    });
  }
  return out;
}

/** The flow: remembers `state` values for ten minutes so a callback cannot be forged or replayed. */
export class OAuthFlow {
  readonly providers: Map<string, OAuthProvider>;
  private states = new Map<string, { provider: string; expires: number }>();
  private fetchFn: typeof fetch;
  private redirectBase: string;

  constructor(providers: OAuthProvider[], redirectBase: string, fetchFn: typeof fetch = fetch) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
    this.redirectBase = redirectBase.replace(/\/$/, '');
    this.fetchFn = fetchFn;
  }

  list(): { id: string; name: string }[] {
    return [...this.providers.values()].map((p) => ({ id: p.id, name: p.name }));
  }

  callbackUrl(id: string): string {
    return `${this.redirectBase}/auth/oauth/${id}/callback`;
  }

  /** Where to send the player's browser. */
  start(id: string): string | null {
    const p = this.providers.get(id);
    if (!p) return null;
    const now = Date.now();
    for (const [k, v] of this.states) if (v.expires < now) this.states.delete(k);
    const state = randomBytes(18).toString('base64url');
    this.states.set(state, { provider: id, expires: now + 600_000 });
    const q = new URLSearchParams({ client_id: p.clientId, redirect_uri: this.callbackUrl(id), response_type: 'code', scope: p.scope, state });
    return `${p.authorizeUrl}?${q}`;
  }

  /** Exchange the code for the user. */
  async finish(id: string, code: string, state: string): Promise<OAuthProfile> {
    const p = this.providers.get(id);
    const st = this.states.get(state);
    this.states.delete(state);
    if (!p || !st || st.provider !== id || st.expires < Date.now()) throw new Error('This sign-in link has expired. Try again.');
    const body = new URLSearchParams({ client_id: p.clientId, client_secret: p.clientSecret, code, grant_type: 'authorization_code', redirect_uri: this.callbackUrl(id) });
    const res = await this.fetchFn(p.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
    const tok = (await res.json()) as { access_token?: string; error?: string };
    if (!tok.access_token) throw new Error(`The provider refused: ${tok.error ?? res.status}`);
    return p.profile(tok.access_token, this.fetchFn);
  }
}
