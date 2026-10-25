// POST /boot-report (owner, 2026-10-16: «игра просто не запускается вообще»): a phone whose start stalled (30 s and
// 90 s without the game's code running, or its import failed) — and any start under ?bootdebug — sends the stages its
// page went through (client/index.html, client/src/viewport.ts). One line in the server's log each, so a start that
// fails on a real phone can be read afterwards. Small and rate-limited: at most 4 KB, 10 a minute from an address.
// Every start that came up says so too (prod 2026-10-25, the bundle: tools/build-client.ts): «[boot-report] ok» with its
// time, the code's size and how it came (bundle / src) — one short line, so the share of the starts that fail can be
// counted: grep -cF '[boot-report] ok' against grep -cF '[boot-report] fail'. The search engines' and the ad networks'
// robots (YandexBot, Googlebot, headless checkers…) go to «[boot-bot]», one short line, never among the failures.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp } from '../net/conn.ts';

const MAX = 4096;

/** The robots that open the page (the search engines, the ad networks' checkers, the link previews, headless browsers). */
export const BOT_UA = /bot\b|bot\/|crawler|spider|slurp|yandex(?:bot|images|metrika|direct|renderresources|screenshot|mobilebot|accessibility|adnet|favicons|pagechecker|webmaster)|googlebot|google-inspectiontool|adsbot|mediapartners|lighthouse|pagespeed|headlesschrome|phantomjs|bingpreview|facebookexternalhit|vkshare|telegrambot|whatsapp|prerender|python-requests|curl\/|wget/i;

/** Whether an agent is a robot's (a CUBOT phone is not). */
export const isBot = (ua: string): boolean => BOT_UA.test(ua.replace(/cubot/gi, ''));

/** A report's line in the log: a robot's apart, a start that came up in short, a failure with its log. */
export function reportLine(r: { why?: string; log?: unknown; w?: number; h?: number; dpr?: number; ua?: string; path?: string; tg?: boolean; ms?: number; mode?: string; kb?: number }): string {
  const why = String(r.why ?? '?').slice(0, 40);
  const ua = String(r.ua ?? '').slice(0, 160);
  const where = `${r.tg ? 'tg ' : ''}${Number(r.w) || 0}x${Number(r.h) || 0}@${Number(r.dpr) || 1} ${String(r.path ?? '').slice(0, 80)}`;
  const how = `${Math.max(0, Math.round(Number(r.ms) || 0))}ms ${String(r.mode ?? '').replace(/[^a-z]/g, '').slice(0, 8) || '?'} ${Math.max(0, Math.round(Number(r.kb) || 0))}KB`;
  if (isBot(ua)) return `[boot-bot] ${why} ${how} ua=${ua}`;
  if (why === 'ok') return `[boot-report] ok ${how} ${where} ua=${ua}`;
  const log = Array.isArray(r.log) ? r.log.slice(-60).map((x) => String(x).slice(0, 160)).join(' | ') : '';
  return `[boot-report] ${why} ${how} ${where} ua=${ua} :: ${log}`;
}

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
    const r = JSON.parse(Buffer.concat(parts).toString('utf8')) as Parameters<typeof reportLine>[0];
    // (the robot's agent as the browser sent it, not as the page says: a checker may dress its page's words)
    const line = reportLine({ ...r, ua: isBot(String(req.headers['user-agent'] ?? '')) ? String(req.headers['user-agent']) : r.ua });
    if (line.startsWith('[boot-report] ok') || line.startsWith('[boot-bot]')) console.log(line);
    else console.warn(line);
  } catch {
    /* a broken report says nothing */
  }
  res.writeHead(204).end();
  return true;
}
