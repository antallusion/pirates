// HTTP endpoints for accounts (the game socket only resumes tokens). JSON in, JSON out, a small per-address
// rate limit, and the OAuth redirects.
//   POST /auth/register {email, password, name}   POST /auth/login {email, password}
//   POST /auth/claim {token, email, password}      POST /auth/forgot {email}      POST /auth/reset {token, password}
//   GET  /auth/verify?token=…                       GET  /auth/providers
//   GET  /auth/oauth/:id  → provider               GET  /auth/oauth/:id/callback → /#token=…

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthService } from '../auth.ts';
import type { OAuthFlow } from '../oauth.ts';

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
  const addr = req.socket.remoteAddress ?? '?';
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
        r = await auth.registerEmail(b.email, b.password, b.name);
        break;
      case '/auth/login':
        r = await auth.loginEmail(b.email, b.password);
        break;
      case '/auth/claim':
        r = await auth.claim(b.token, b.email, b.password);
        break;
      case '/auth/forgot':
        await auth.forgot(b.email);
        json(res, 200, { ok: true });
        return true;
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
