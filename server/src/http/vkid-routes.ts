// HTTP routes of «Войти через VK ID» on the website (owner, 2026-10-25; server/src/vkid.ts, docs/36_VK.md §8).
// Answered before the VK Mini App's and the /auth routes. Without VKID_APP_ID every one of them is a 404 but the config,
// which says «off» (the page shows no button).
//   GET  /auth/vkid/config                    → {enabled, miniApp}
//   GET  /auth/vkid/start[?link=<ticket>&lang=ru|en] → 302 to id.vk.com/authorize (state + PKCE)
//   GET  /auth/vkid/callback?code&state&device_id   → 302 /play#token=…&vkid=1[&vknote=1]   (a sign-in)
//                                                   → 302 /play#vkid=linked[&vknote=1]       (a link)
//                                                   → 302 /play#vkid-error=…                 (refused)
//   POST /auth/vkid/link {token}              → {url: '/auth/vkid/start?link=<ticket>'}   «Привязать VK»
//   POST /auth/vkid/status {token}            → {linked, notify}

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { VkIdService } from '../vkid.ts';
import { clientIp } from '../net/conn.ts';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function go(res: ServerResponse, to: string): void {
  res.writeHead(302, { Location: to, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 4096) throw new Error('too large');
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const v = raw ? JSON.parse(raw) : {};
  return typeof v === 'object' && v ? (v as Record<string, unknown>) : {};
}

/** Returns true when the request was a VK ID route (handled — a 404 when VK ID is off). */
export async function handleVkId(req: IncomingMessage, res: ServerResponse, vkid: VkIdService | null): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = url.pathname;
  if (path !== '/auth/vkid' && !path.startsWith('/auth/vkid/')) return false;
  if (!vkid) {
    if (req.method === 'GET' && path === '/auth/vkid/config') return (json(res, 200, { enabled: false }), true);
    json(res, 404, { error: 'Not found' });
    return true;
  }
  if (req.method === 'GET' && path === '/auth/vkid/config') return (json(res, 200, vkid.config()), true);
  if (!vkid.allow(`vkid:${clientIp(req)}`)) {
    if (req.method === 'GET') go(res, `/play#vkid-error=${encodeURIComponent('Too many attempts. Wait a minute.')}`);
    else json(res, 429, { error: 'Too many attempts. Wait a minute.' });
    return true;
  }
  try {
    if (req.method === 'GET' && path === '/auth/vkid/start') {
      const r = vkid.start({ link: url.searchParams.get('link'), lang: url.searchParams.get('lang') });
      go(res, 'url' in r ? r.url : `/play#vkid-error=${encodeURIComponent(r.error)}`);
      return true;
    }
    if (req.method === 'GET' && path === '/auth/vkid/callback') {
      const r = await vkid.finish(url.searchParams);
      if (r.kind === 'login') go(res, `/play#token=${encodeURIComponent(r.token)}&vkid=1${r.notify ? '' : '&vknote=1'}`);
      else if (r.kind === 'linked') go(res, `/play#vkid=linked${r.notify ? '' : '&vknote=1'}`);
      else go(res, `/play#vkid-error=${encodeURIComponent(r.error)}`);
      return true;
    }
    if (req.method === 'POST' && (path === '/auth/vkid/link' || path === '/auth/vkid/status')) {
      const b = await readJson(req);
      const r = path === '/auth/vkid/link' ? vkid.linkTicket(String(b.token ?? '')) : vkid.status(String(b.token ?? ''));
      json(res, 'error' in r ? 401 : 200, r);
      return true;
    }
    json(res, 404, { error: 'Not found' });
  } catch {
    json(res, 400, { error: 'Bad request' });
  }
  return true;
}
