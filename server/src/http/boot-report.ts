// POST /boot-report (owner, 2026-10-16: «игра просто не запускается вообще»): a phone whose start stalled (30 s and
// 90 s without the game's code running, or its import failed) — and any start under ?bootdebug — sends the stages its
// page went through (client/index.html, client/src/viewport.ts). One line in the server's log each, so a start that
// fails on a real phone can be read afterwards. Small and rate-limited: at most 4 KB, 10 a minute from an address.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp } from '../net/conn.ts';

const MAX = 4096;
const hits = new Map<string, { n: number; at: number }>();

export async function handleBootReport(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.url !== '/boot-report') return false;
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return true;
  }
  const ip = clientIp(req);
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.at < 60_000 && h.n >= 10) {
    res.writeHead(429).end();
    req.resume();
    return true;
  }
  if (!h || now - h.at >= 60_000) hits.set(ip, { n: 1, at: now });
  else h.n++;
  if (hits.size > 5000) hits.clear();
  let size = 0;
  const parts: Buffer[] = [];
  try {
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > MAX) break;
      parts.push(c as Buffer);
    }
    const r = JSON.parse(Buffer.concat(parts).toString('utf8')) as { why?: string; log?: string[]; w?: number; h?: number; dpr?: number; ua?: string; path?: string; tg?: boolean };
    const log = Array.isArray(r.log) ? r.log.slice(-60).map((x) => String(x).slice(0, 160)).join(' | ') : '';
    console.warn(`[boot-report] ${String(r.why ?? '?').slice(0, 40)} ${r.tg ? 'tg ' : ''}${Number(r.w) || 0}x${Number(r.h) || 0}@${Number(r.dpr) || 1} ${String(r.path ?? '').slice(0, 80)} ua=${String(r.ua ?? '').slice(0, 160)} :: ${log}`);
  } catch {
    /* a broken report says nothing */
  }
  res.writeHead(204).end();
  return true;
}
