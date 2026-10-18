// The forum's HTTP API (docs/32_FORUM.md §4): JSON under /api/forum/…, the uploads under /api/forum/file/….
// The member is the game account behind `Authorization: Bearer <game token>` (the page reads it from the same origin's
// localStorage). No cookies are used, so another site cannot make a reader's browser act here (no CSRF): a cross-site
// form cannot set the header, and a cross-site script would need a CORS preflight this API never answers.

import { createReadStream } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { VIDEO_MAX } from '../../../shared/src/forum/meta.ts';
import { clientIp } from '../net/conn.ts';
import { ForumError, Limiter } from '../forum/service.ts';
import type { ForumService, Lang } from '../forum/service.ts';
import type { UserRow } from '../forum/store.ts';

const JSON_MAX = 160 * 1024;
const PER_IP_MIN = 300;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function readRaw(req: IncomingMessage, max: number): Promise<Buffer> {
  const len = Number(req.headers['content-length'] ?? 0);
  if (len > max) throw new ForumError('too_large', 413);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) throw new ForumError('too_large', 413);
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = (await readRaw(req, JSON_MAX)).toString('utf8');
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    throw new ForumError('bad_request');
  }
}

export interface ForumAuth {
  resume(token: string): { accountId: number; name: string } | null;
}

/** The handler: true when the request was the forum's. */
export function forumRoutes(svc: ForumService, auth: ForumAuth) {
  const perIp = new Limiter(svc.now);
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/forum/')) return false;
    const path = url.pathname.slice('/api/forum/'.length);
    const method = req.method ?? 'GET';
    try {
      // the uploads: public, by their random names, with their own type, never run as a page
      const fm = /^file\/([0-9a-f]{24}\.(?:png|jpg|webp|mp4))$/.exec(path);
      if (fm && (method === 'GET' || method === 'HEAD')) return serveFile(svc, fm[1], req, res);
      const ip = clientIp(req);
      if (!perIp.take(ip, PER_IP_MIN, 60_000)) throw new ForumError('rate', 429);
      const h = String(req.headers.authorization ?? '');
      const token = /^Bearer\s+(\S{20,128})$/.exec(h)?.[1];
      const acc = token ? auth.resume(token) : null;
      const me: UserRow | null = acc ? svc.touch(acc.accountId, acc.name) : null;
      const lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ru';
      const page = Number(url.searchParams.get('p') ?? 1);
      const q = url.searchParams;
      let m: RegExpExecArray | null;
      if (method === 'GET') {
        if (path === 'home') return ok(res, svc.home(me, lang));
        if (path === 'me') return ok(res, svc.me(me));
        if ((m = /^section\/([\w-]{1,40})$/.exec(path))) return ok(res, svc.section(me, m[1], page, lang));
        if ((m = /^topic\/(\d{1,10})$/.exec(path))) return ok(res, svc.topic(me, Number(m[1]), page, lang, me ? `u${me.id}` : `ip${ip}`));
        if ((m = /^post\/(\d{1,10})\/where$/.exec(path))) return ok(res, svc.where(me, Number(m[1])));
        if ((m = /^user\/(\d{1,10}|@[^/]{1,40})$/.exec(path))) return ok(res, svc.profile(me, decodeURIComponent(m[1]), lang));
        if ((m = /^guild\/([\p{L}\p{N}]{1,8})$/u.exec(decodeURIComponent(path)))) return ok(res, svc.guild(m[1]));
        if ((m = /^list\/(topics|posts|members|today|online)$/.exec(path))) return ok(res, svc.list(me, m[1], page, lang));
        if (path === 'search') return ok(res, svc.search(me, String(q.get('q') ?? '').slice(0, 200), q.get('in') === 'topics' ? 'topics' : 'posts', page, lang));
        if (path === 'fresh') return ok(res, { fresh: svc.fresh(me, lang, 10) });
        if (path === 'dialogs') return ok(res, svc.dialogs(me));
        if ((m = /^dialog\/(\d{1,10})$/.exec(path))) return ok(res, svc.dialog(me, Number(m[1]), lang));
        if (path === 'notifications') return ok(res, svc.notifications(me, lang));
        if (path === 'reports') return ok(res, svc.reports(me));
        if (path === 'stats') return ok(res, svc.stats());
        throw new ForumError('not_found', 404);
      }
      if (method !== 'POST') throw new ForumError('bad_request', 405);
      if (path === 'upload') {
        const me2 = me ?? null;
        if (!me2) throw new ForumError('auth', 401);
        const data = await readRaw(req, VIDEO_MAX + 1);
        return ok(res, svc.upload(me2, data));
      }
      const b = await readJson(req);
      if (path === 'me') return ok(res, svc.saveMe(me, b));
      if (path === 'topic') return ok(res, svc.createTopic(me, b));
      if (path === 'post') return ok(res, svc.reply(me, b));
      if ((m = /^post\/(\d{1,10})\/(edit|react|rep|report|mod)$/.exec(path))) {
        const id = Number(m[1]);
        if (m[2] === 'edit') return ok(res, svc.edit(me, id, b));
        if (m[2] === 'react') return ok(res, svc.react(me, id, String(b.emoji ?? '')));
        if (m[2] === 'rep') return ok(res, svc.rep(me, id, Number(b.v)));
        if (m[2] === 'report') return ok(res, svc.report(me, id, b.reason));
        return ok(res, svc.modPost(me, id, b));
      }
      if ((m = /^topic\/(\d{1,10})\/mod$/.exec(path))) return ok(res, svc.modTopic(me, Number(m[1]), b));
      if ((m = /^dialog\/(\d{1,10})$/.exec(path))) return ok(res, svc.send(me, Number(m[1]), b));
      if (path === 'notifications/read') return ok(res, svc.readNotifications(me, Number(b.upTo) || undefined));
      if ((m = /^report\/(\d{1,10})\/resolve$/.exec(path))) return ok(res, svc.resolveReport(me, Number(m[1])));
      if (path === 'role') return ok(res, svc.setRole(me, Number(b.user), b.role));
      throw new ForumError('not_found', 404);
    } catch (e) {
      if (e instanceof ForumError) json(res, e.status, { error: e.code });
      else {
        console.error('[forum]', e);
        json(res, 500, { error: 'bad_request' });
      }
      return true;
    }
  };
}

function ok(res: ServerResponse, body: unknown): true {
  json(res, 200, body);
  return true;
}

/** An upload as itself: its type, `nosniff`, a policy that runs nothing, a year in the cache (its name never changes);
 *  films in ranges (browsers seek in them). */
function serveFile(svc: ForumService, file: string, req: IncomingMessage, res: ServerResponse): true {
  const f = svc.uploadPath(file);
  const mem = svc.memFiles.get(file);
  if (!f || (!f.path && !mem)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return true;
  }
  const head: Record<string, string | number> = {
    'Content-Type': f.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes', 'Content-Disposition': 'inline',
  };
  const size = f.size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  let start = 0, end = size - 1, status = 200;
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return true;
    }
    status = 206;
    head['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  head['Content-Length'] = end - start + 1;
  res.writeHead(status, head);
  if (req.method === 'HEAD') res.end();
  else if (mem) res.end(mem.subarray(start, end + 1));
  else createReadStream(f.path!, { start, end }).on('error', () => res.destroy()).pipe(res);
  return true;
}
