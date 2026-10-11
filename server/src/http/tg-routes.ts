// HTTP routes of Telegram (owner, 2026-10-11; docs/27_TELEGRAM.md). Answered before the /auth routes (which keep their
// own budget of 20 a minute: the page's poll alone asks 30). Without the bot's token every one of them is a 404 and
// the client shows no Telegram button.
//   GET  /auth/tg/config                         → {enabled, bot, webapp}
//   POST /auth/tg/webapp {initData, token?}      → {token, name, accountId}   the Mini App's sign-in
//   POST /auth/tg/start {token?}                 → {nonce, link, expires}     «Войти через Телеграм» / «Привязать Телеграм»
//   GET  /auth/tg/poll?nonce=…                   → {status: wait|expired|taken|linked|done, token?, name?}
//   POST /auth/tg/linked {token}                 → {linked}
//   POST /tg/webhook                             ← Telegram (X-Telegram-Bot-Api-Secret-Token)

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TelegramService, TgUpdate } from '../telegram.ts';
import { clientIp } from '../net/conn.ts';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, max: number): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) throw new Error('too large');
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const v = raw ? JSON.parse(raw) : {};
  return typeof v === 'object' && v ? (v as Record<string, unknown>) : {};
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Returns true when the request was a Telegram route (handled — a 404 when Telegram is off). */
export async function handleTelegram(req: IncomingMessage, res: ServerResponse, tg: TelegramService | null): Promise<boolean> {
  const path = (req.url ?? '/').split('?')[0];
  if (!path.startsWith('/auth/tg/') && path !== '/auth/tg' && !path.startsWith('/tg/')) return false;
  if (!tg) {
    json(res, 404, { error: 'Not found' });
    return true;
  }
  try {
    if (path === '/tg/webhook') {
      if (req.method !== 'POST') return (json(res, 405, { error: 'POST only' }), true);
      if (!tg.checkSecret(req.headers['x-telegram-bot-api-secret-token'])) return (json(res, 401, { error: 'Not found' }), true);
      const update = (await readJson(req, 256_000)) as TgUpdate;
      // Telegram waits for the answer: the update is handled first (a pre-checkout must be answered within 10 s).
      await tg.handleUpdate(update).catch(() => undefined);
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === 'GET' && path === '/auth/tg/config') {
      json(res, 200, { enabled: true, bot: tg.bot, webapp: tg.webappUrl });
      return true;
    }
    if (req.method === 'GET' && path === '/auth/tg/poll') {
      const nonce = new URL(req.url ?? '/', 'http://x').searchParams.get('nonce') ?? '';
      const r = tg.poll(nonce, clientIp(req));
      if ('error' in r) json(res, r.status, { error: r.error });
      else json(res, 200, r);
      return true;
    }
    if (req.method !== 'POST') return (json(res, 405, { error: 'POST only' }), true);
    const b = await readJson(req, 16_384);
    switch (path) {
      case '/auth/tg/webapp': {
        const r = tg.webappLogin(String(b.initData ?? ''), str(b.token));
        if ('error' in r) json(res, 401, { error: r.error });
        else json(res, 200, { token: r.token, name: r.name, accountId: r.accountId });
        return true;
      }
      case '/auth/tg/start': {
        const r = tg.start(clientIp(req), str(b.token));
        if ('error' in r) json(res, r.status, { error: r.error });
        else json(res, 200, r);
        return true;
      }
      case '/auth/tg/linked': {
        const linked = tg.linkedFor(String(b.token ?? ''));
        if (linked === null) json(res, 400, { error: 'Sign in first.' });
        else json(res, 200, { linked });
        return true;
      }
      default:
        json(res, 404, { error: 'Not found' });
        return true;
    }
  } catch {
    json(res, 400, { error: 'Bad request' });
    return true;
  }
}
