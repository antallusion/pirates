// The website's API (owner, 2026-10-20: «рейтинг капитанов и магазин»): JSON under /api/site/….
//   GET  /api/site/rating?board=level|glory|boarded|arena|campaign|guilds   a board's top 100 (cached a minute)
//   GET  /api/site/rating/find?name=…                                       a captain's places on every board
//   GET  /api/site/shop                                                     the shop's mode and its catalogue now
//   GET  /api/site/shop/item?id=…                                           a thing's whole card (the site's window)
//   GET  /api/site/captain?name=…                                           the shop's step 1: her captain, what she has
//   POST /api/site/order {name,item,lang,email?}                            an order → { orderId, url } (go pay there)
//   GET  /api/site/order?id=…                                               an order's state (the return page polls it)
//   POST /api/site/pay/yookassa                                             YooKassa's webhook (re-fetched, never trusted)
//   GET|POST /api/site/pay/test?order=…                                     the test mode's fake checkout
//   GET  /api/site/pay/back?order=…                                         the web game's buyer back from the checkout
// No cookies and no sign-in: a cross-site page can neither read these answers (no CORS) nor make an order in a buyer's
// name (a POST must come from this site's own pages: its Origin is checked, and an order's body is JSON only). Every
// public door has a limit per address; the captain lookup's is tight, against walking the list of names.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Limiter } from '../forum/service.ts';
import type { SiteRating } from '../game/siterating.ts';
import { BOARDS } from '../game/siterating.ts';
import type { Board } from '../game/siterating.ts';
import type { WebShop } from '../game/webshop.ts';
import { noticePid, yooAddress } from '../pay/yookassa.ts';
import type { YooKassa } from '../pay/yookassa.ts';
import { gameBackPage, testCheckoutPage } from '../pay/testpage.ts';
import { randomBytes } from 'node:crypto';
import { clientIp } from '../net/conn.ts';

const BODY_MAX = 16 * 1024;
const MIN = 60_000;
const HOUR = 3_600_000;
/** A board may be kept a minute by the browser and any cache on the way (the board itself is a minute's snapshot). */
const MINUTE_CACHE = ['public', 'max-age=60'].join(', ');

/** The limits per address: [max, window]. */
export const SITE_LIMITS = {
  all: [240, MIN],
  captain: [[12, MIN], [120, HOUR]],
  find: [[30, MIN]],
  order: [[8, MIN], [40, HOUR]],
  status: [[90, MIN]],
} as const;

class HttpError extends Error {
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.status = status;
  }
}

function json(res: ServerResponse, status: number, body: unknown, cache = 'no-store'): true {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
  return true;
}

async function readBody(req: IncomingMessage): Promise<string> {
  if (Number(req.headers['content-length'] ?? 0) > BODY_MAX) throw new HttpError('too_large', 413);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > BODY_MAX) throw new HttpError('too_large', 413);
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** A POST from this site's own pages: its Origin is this host's (or the public address's). */
export function sameOrigin(req: IncomingMessage, publicUrl: string): boolean {
  const origin = String(req.headers.origin ?? '');
  if (!origin || origin === 'null') return false;
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  const host = String(req.headers.host ?? '').toLowerCase();
  if (o.host.toLowerCase() === host) return true;
  try {
    return o.origin === new URL(publicUrl).origin;
  } catch {
    return false;
  }
}

export interface SiteDeps {
  rating: SiteRating;
  shop: WebShop;
  publicUrl: string;
  now?: () => number;
}

/** The handler: true when the request was the site API's. */
export function siteRoutes(d: SiteDeps) {
  const lim = new Limiter(d.now ?? Date.now);
  const take = (key: string, ip: string, rules: readonly (readonly [number, number])[]) => {
    for (const [max, win] of rules) if (!lim.take(`${key}:${win}:${ip}`, max, win)) throw new HttpError('rate', 429);
  };
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/site/')) return false;
    const path = url.pathname.slice('/api/site/'.length);
    const method = req.method ?? 'GET';
    const ip = clientIp(req);
    try {
      // ---- the payment provider's word: never limited by the visitors' counters, never trusted by itself
      if (path === 'pay/yookassa') {
        if (method !== 'POST') throw new HttpError('bad_request', 405);
        const yoo = d.shop.provider.name === 'yookassa' ? (d.shop.provider as YooKassa) : null;
        if (!yoo) throw new HttpError('not_found', 404);
        if (yoo.checkIp && !yooAddress(ip)) throw new HttpError('forbidden', 403);
        let raw: unknown = null;
        try {
          raw = JSON.parse(await readBody(req));
        } catch {
          throw new HttpError('bad_request');
        }
        const pid = noticePid(raw);
        if (!pid) return json(res, 200, { ok: true, ignored: true });
        // (not verified — the provider could not be asked: a 5xx makes YooKassa send it again later)
        return (await d.shop.notice(pid)) ? json(res, 200, { ok: true }) : json(res, 503, { error: 'retry' });
      }
      const [max, win] = SITE_LIMITS.all;
      if (!lim.take(`all:${ip}`, max, win)) throw new HttpError('rate', 429);

      if (path === 'pay/test') return await testCheckout(req, res, url, method);
      // the web game's buyer back from the checkout (owner, 2026-10-21): the order's payment checked again, a word, and
      // back to the game (its tab told to look, this one closed)
      if (path === 'pay/back') {
        if (method !== 'GET') throw new HttpError('bad_request', 405);
        take('status', ip, SITE_LIMITS.status);
        const id = String(url.searchParams.get('order') ?? '');
        await d.shop.refresh(id);
        const v = d.shop.view(id);
        if (!v?.game) throw new HttpError('not_found', 404);
        const nonce = randomBytes(12).toString('base64');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': `default-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'self'` });
        res.end(gameBackPage({ id, lang: d.shop.get(id)?.lang ?? 'ru', status: v.status, nonce }));
        return true;
      }

      if (method === 'GET') {
        if (path === 'rating') {
          const b = (url.searchParams.get('board') ?? 'level') as Board;
          if (!BOARDS.includes(b)) throw new HttpError('bad_board');
          return json(res, 200, d.rating.board(b), MINUTE_CACHE);
        }
        if (path === 'rating/find') {
          take('find', ip, SITE_LIMITS.find);
          const name = String(url.searchParams.get('name') ?? '').trim().slice(0, 40);
          if (name.length < 2) throw new HttpError('bad_name');
          const f = d.rating.find(name);
          return f ? json(res, 200, f) : json(res, 404, { error: 'not_found' });
        }
        if (path === 'shop') return json(res, 200, { ...d.shop.status(), items: d.shop.catalog() });
        if (path === 'shop/item') {
          const r = d.shop.item(url.searchParams.get('id') ?? '');
          return r ? json(res, 200, r, MINUTE_CACHE) : json(res, 404, { error: 'not_found' });
        }
        if (path === 'captain') {
          take('captain', ip, SITE_LIMITS.captain);
          const r = d.shop.lookup(url.searchParams.get('name') ?? '');
          if (r === 'bad_name') throw new HttpError('bad_name');
          return r ? json(res, 200, r) : json(res, 404, { error: 'not_found' });
        }
        if (path === 'order') {
          take('status', ip, SITE_LIMITS.status);
          const id = String(url.searchParams.get('id') ?? '');
          await d.shop.refresh(id);
          const v = d.shop.view(id);
          return v ? json(res, 200, v) : json(res, 404, { error: 'not_found' });
        }
        throw new HttpError('not_found', 404);
      }
      if (method !== 'POST') throw new HttpError('bad_request', 405);
      if (path === 'order') {
        if (!sameOrigin(req, d.publicUrl)) throw new HttpError('origin', 403);
        if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) throw new HttpError('bad_request', 415);
        take('order', ip, SITE_LIMITS.order);
        let b: Record<string, unknown>;
        try {
          const v = JSON.parse(await readBody(req));
          b = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        } catch {
          throw new HttpError('bad_request');
        }
        const r = await d.shop.order(b);
        if ('error' in r) return json(res, r.error === 'rate' ? 429 : r.error === 'not_found' ? 404 : r.error === 'provider' ? 502 : 400, r);
        return json(res, 200, r);
      }
      throw new HttpError('not_found', 404);
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.message });
      console.error('[site]', e);
      return json(res, 500, { error: 'server' });
    }
  };

  /** The test mode's checkout: a page of this server where no money moves (open to the test accounts only). */
  async function testCheckout(req: IncomingMessage, res: ServerResponse, url: URL, method: string): Promise<true> {
    const shop = d.shop;
    if (!shop.test) throw new HttpError('not_found', 404);
    if (method === 'POST') {
      if (!sameOrigin(req, d.publicUrl)) throw new HttpError('origin', 403);
      const form = new URLSearchParams((await readBody(req)).slice(0, 2000));
      const id = String(form.get('order') ?? '');
      const o = shop.get(id);
      if (!o || !shop.testAllowed(o.acc)) throw new HttpError('not_found', 404);
      await shop.settleTest(id, form.get('act') === 'pay');
      const back = o.from === 'game' ? `/api/site/pay/back?order=${id}` : `${o.lang === 'en' ? '/site/en/shop/' : '/site/shop/'}?order=${id}`;
      res.writeHead(303, { Location: back, 'Cache-Control': 'no-store' }).end();
      return true;
    }
    const id = String(url.searchParams.get('order') ?? '');
    const o = shop.get(id);
    if (!o || o.provider !== 'test' || !shop.testAllowed(o.acc)) throw new HttpError('not_found', 404);
    const x = shop.itemOf(o);
    const html = testCheckoutPage({ id: o.id, lang: o.lang, name: o.name, item: x ? x.name[o.lang === 'en' ? 0 : 1] : o.item, rub: o.rub, open: o.status === 'pending' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.end(html);
    return true;
  }
}
