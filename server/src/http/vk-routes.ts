// HTTP routes of the VK Mini App (owner, 2026-10-20; docs/36_VK.md). Answered before the /auth routes, as Telegram's
// are. Without VK_APP_SECRET every one of them is a 404 but the config, which says «off».
//   GET  /auth/vk/config                        → {enabled, appId, pay}
//   POST /auth/vk/launch {launch, name?, token?} → {token, name, accountId}   the Mini App's sign-in
//   POST /vk/pay                                ← VK's payments callback (application/x-www-form-urlencoded, signed)
//   POST /auth/vk/notify {token, on}            → {ok}   VK notices allowed / denied in the game

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { VkService } from '../vk.ts';
import { clientIp } from '../net/conn.ts';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, max: number): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) throw new Error('too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Returns true when the request was a VK route (handled — a 404 when VK is off). */
export async function handleVk(req: IncomingMessage, res: ServerResponse, vk: VkService | null): Promise<boolean> {
  const path = (req.url ?? '/').split('?')[0];
  if (!path.startsWith('/auth/vk/') && path !== '/auth/vk' && !path.startsWith('/vk/')) return false;
  if (!vk) {
    if (req.method === 'GET' && path === '/auth/vk/config') return (json(res, 200, { enabled: false }), true);
    json(res, 404, { error: 'Not found' });
    return true;
  }
  try {
    if (req.method === 'GET' && path === '/auth/vk/config') return (json(res, 200, vk.config()), true);
    if (req.method !== 'POST') return (json(res, 405, { error: 'POST only' }), true);
    if (path === '/vk/pay') {
      // VK posts a form; a JSON body is taken too (the tests, a proxy that re-encodes)
      const raw = await readBody(req, 32_768);
      const ct = String(req.headers['content-type'] ?? '');
      const params: Record<string, string> = {};
      if (/json/i.test(ct)) {
        const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        for (const [k, x] of Object.entries(v)) params[k] = String(x);
      } else for (const [k, x] of new URLSearchParams(raw)) params[k] = x;
      // (VK wants a 200 with its own error object, never an HTTP error)
      json(res, 200, vk.pay(params));
      return true;
    }
    if (path === '/auth/vk/launch') {
      if (!vk.allow(`launch:${clientIp(req)}`)) return (json(res, 429, { error: 'Too many attempts. Wait a minute.' }), true);
      const raw = await readBody(req, 16_384);
      const b = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      const r = vk.launch(String(b.launch ?? ''), str(b.name), str(b.token));
      if ('error' in r) json(res, 401, { error: r.error });
      else json(res, 200, { token: r.token, name: r.name, accountId: r.accountId });
      return true;
    }
    if (path === '/auth/vk/notify') {
      // her «allow» / «deny» of VK's notices (VKWebAppAllowNotifications' answer), with her game token
      const raw = await readBody(req, 4096);
      const b = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      const r = vk.notifyAllow(String(b.token ?? ''), b.on === true);
      json(res, 'error' in r ? 400 : 200, r);
      return true;
    }
    json(res, 404, { error: 'Not found' });
    return true;
  } catch {
    if (path === '/vk/pay') json(res, 200, { error: { error_code: 1, error_msg: 'Bad request', critical: false } });
    else json(res, 400, { error: 'Bad request' });
    return true;
  }
}
