// HTTP endpoints for accounts (the game socket only resumes tokens). JSON in, JSON out, a small per-address
// rate limit, and the OAuth redirects.
//   POST /auth/register {email, password, name}   POST /auth/login {email, password}
//   POST /auth/claim {token, email, password}      POST /auth/forgot {email}      POST /auth/reset {token, password}
//   GET  /auth/verify?token=…                       GET  /auth/providers
//   GET  /auth/oauth/:id  → provider               GET  /auth/oauth/:id/callback → /#token=…
//   POST /auth/support {email, message, token?}  → a letter to the support desk, replies to her address
// Every form that sends a letter carries the honeypot (`website`, empty) and `t` (ms since it was shown), and is held
// to 3 letters an hour an address and 10 an IP (mailguard.ts; owner, 2026-10-11).

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthService } from '../auth.ts';
import { CHECK_EMAIL, isEmail, mailLocale } from '../auth.ts';
import { formTrapped, MailGuard } from '../mailguard.ts';
import type { OAuthFlow } from '../oauth.ts';
import { clientIp } from '../net/conn.ts';

/** The letters' guard (one per process); tests make their own. */
let guard = new MailGuard();
export function resetMailGuard(g: MailGuard = new MailGuard()): void {
  guard = g;
}
export const MAIL_LIMIT = 'Too many letters for now. Try again in an hour.';
const SUPPORT_TO = process.env.SUPPORT_EMAIL ?? 'support@gravetidegame.com';

const LIMIT = 20; // requests per address per minute
const hits = new Map<string, { n: number; reset: number }>();

function limited(addr: string): boolean {
  const now = Date.now();
  const h = hits.get(addr);
  if (!h || h.reset < now) {
    hits.set(addr, { n: 1, reset: now + 60_000 });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  h.n++;
  return h.n > LIMIT;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, string>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 16_384) throw new Error('too large');
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const v = raw ? JSON.parse(raw) : {};
  return typeof v === 'object' && v ? v : {};
}

/** Returns true when the request was an /auth route (handled). */
export async function handleAuth(req: IncomingMessage, res: ServerResponse, auth: AuthService, oauth: OAuthFlow): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/auth/')) return false;
  const addr = clientIp(req);
  if (limited(addr)) {
    json(res, 429, { error: 'Too many attempts. Wait a minute.' });
    return true;
  }
  const path = url.pathname;
  try {
    if (req.method === 'GET' && path === '/auth/providers') {
      json(res, 200, { providers: oauth.list() });
      return true;
    }
    if (req.method === 'GET' && path === '/auth/verify') {
      const ok = auth.verifyEmail(url.searchParams.get('token') ?? '');
      res.writeHead(302, { Location: ok ? '/#verified' : '/#verify-failed' });
      res.end();
      return true;
    }
    const m = /^\/auth\/oauth\/([a-z]+)(\/callback)?$/.exec(path);
    if (req.method === 'GET' && m) {
      if (!m[2]) {
        const to = oauth.start(m[1]);
        if (!to) json(res, 404, { error: 'Unknown provider' });
        else {
          res.writeHead(302, { Location: to });
          res.end();
        }
        return true;
      }
      try {
        const prof = await oauth.finish(m[1], url.searchParams.get('code') ?? '', url.searchParams.get('state') ?? '');
        const r = auth.oauthLogin(m[1], prof.subject, prof.email, prof.name);
        res.writeHead(302, { Location: `/#token=${encodeURIComponent(r.token)}` });
      } catch (e) {
        res.writeHead(302, { Location: `/#auth-error=${encodeURIComponent((e as Error).message)}` });
      }
      res.end();
      return true;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST only' });
      return true;
    }
    const b = await readBody(req);
    let r: { token?: string; name?: string; accountId?: number; error?: string } | null = null;
    switch (path) {
      case '/auth/register':
      case '/auth/claim': {
        // (a form that sends a letter: the trap, then the hour's count — only for an address that could take one)
        if (formTrapped(b)) {
          json(res, 400, { error: 'Bad request' });
          return true;
        }
        const email = String(b.email ?? '').trim().toLowerCase();
        if (isEmail(email) && !guard.take(addr, email)) {
          json(res, 429, { error: MAIL_LIMIT });
          return true;
        }
        r = path === '/auth/register'
          ? await auth.registerEmail(b.email, b.password, b.name, mailLocale(b.lang))
          : await auth.claim(b.token, b.email, b.password, mailLocale(b.lang));
        if (r && 'error' in r && r.error === CHECK_EMAIL) {
          json(res, 422, { error: CHECK_EMAIL });
          return true;
        }
        break;
      }
      case '/auth/login':
        r = await auth.loginEmail(b.email, b.password);
        break;
      case '/auth/forgot': {
        // Always the same answer (nobody may probe which addresses have accounts); a trapped or over-count ask sends nothing.
        const email = String(b.email ?? '').trim().toLowerCase();
        if (!formTrapped(b) && isEmail(email) && guard.take(addr, email)) await auth.forgot(email, mailLocale(b.lang));
        json(res, 200, { ok: true });
        return true;
      }
      case '/auth/support': {
        // The feedback form (owner, 2026-10-11): to the support desk, the reply to her address once it is checked.
        if (formTrapped(b)) {
          json(res, 200, { ok: true });
          return true;
        }
        const email = String(b.email ?? '').trim().toLowerCase();
        const message = String(b.message ?? '').trim();
        if (!isEmail(email)) {
          json(res, 400, { error: 'That does not look like an e-mail address.' });
          return true;
        }
        if (message.length < 10 || message.length > 4000) {
          json(res, 400, { error: 'Write between 10 and 4000 characters.' });
          return true;
        }
        if (!guard.take(addr, `support:${email}`)) {
          json(res, 429, { error: MAIL_LIMIT });
          return true;
        }
        const who = b.token ? auth.resume(String(b.token)) : null;
        try {
          await auth.mailer.send({
            to: SUPPORT_TO,
            replyTo: email,
            subject: `GRAVETIDE · ${message.replace(/\s+/g, ' ').slice(0, 60)}`,
            text: `${message}\n\n— ${who ? `captain ${who.name} (#${who.accountId})` : 'no captain signed in'} · ${email}`,
          });
          json(res, 200, { ok: true });
        } catch {
          json(res, 503, { error: 'The letter could not be sent. Try again later.' });
        }
        return true;
      }
      case '/auth/reset':
        r = auth.reset(b.token, b.password);
        break;
      default:
        json(res, 404, { error: 'Not found' });
        return true;
    }
    if (r && 'error' in r && r.error) json(res, 400, { error: r.error });
    else json(res, 200, { token: r?.token, name: r?.name, accountId: r?.accountId });
  } catch {
    json(res, 400, { error: 'Bad request' });
  }
  return true;
}
