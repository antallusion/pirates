// The web game's top-up through YooKassa (owner, 2026-10-21: «подключай кассу на сайт и в игре, но вк версию и тг не
// трогай, там свои платежки»; server/src/game/webshop.ts gameCheckout, client/src/checkout.ts): the order is made for the
// session's own account (no name typed) at the ladder's price in roubles, YooKassa's page comes back to the game; the
// webhook (re-fetched, never believed) credits that very account once and the purchase that waited for the doubloons goes
// by itself, once; Telegram keeps its Stars and VK its votes — no YooKassa there. All of it on the fake API: no key.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import type { Server } from 'node:http';
import { DOUBLOON_PACKS } from '../shared/src/data/premium.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import type { PremiumView } from '../shared/src/premiumproto.ts';
import { SiteRating } from '../server/src/game/siterating.ts';
import { WebShop } from '../server/src/game/webshop.ts';
import { siteRoutes } from '../server/src/http/site-routes.ts';
import { YooKassa } from '../server/src/pay/yookassa.ts';
import { webCheckouts, webPayOpen } from '../client/src/checkout.ts';
import { dropPending, heardDoubloons, payIn, payOpen, viaCheckout, waitForTopUp } from '../client/src/ui/price.ts';
import { topUp } from '../client/src/ui/premium.ts';
import type { Net } from '../client/src/net.ts';
import type { ClientState } from '../client/src/state.ts';
import { join, makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>;
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

/** YooKassa's API, faked: payments made by POST, read by GET; `pay(pid)` marks one paid. */
function fakeYoo() {
  const pays = new Map<string, Record<string, unknown>>();
  const bodies: Record<string, unknown>[] = [];
  let n = 0;
  const http = async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body!);
      bodies.push(b);
      const id = `2e6c1a2b-000f-5000-9000-${String(++n).padStart(12, '0')}`;
      pays.set(id, { id, status: 'pending', paid: false, amount: b.amount, metadata: b.metadata });
      return { ok: true, status: 200, json: async () => ({ id, confirmation: { confirmation_url: `https://yoomoney.ru/checkout?id=${id}` } }), text: async () => '' };
    }
    const p = pays.get(url.split('/').pop()!);
    return p ? { ok: true, status: 200, json: async () => p, text: async () => '' } : { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  const yoo = new YooKassa({ shopId: '1', secret: 'fake', receipt: false, vatCode: 1, checkIp: false }, http, () => {});
  return { yoo, bodies, pay: (pid: string) => Object.assign(pays.get(pid)!, { status: 'succeeded', paid: true }) };
}

async function serve(shop: WebShop, g: G): Promise<{ srv: Server; port: number }> {
  const handle = siteRoutes({ rating: new SiteRating(g.game), shop, publicUrl: 'https://gravetidegame.com' });
  const srv = createServer((req, res) => void handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, port: (srv.address() as { port: number }).port };
}

function call(port: number, method: string, path: string, body?: string): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((ok, bad) => {
    const rq = request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...(body ? { 'Content-Type': 'application/json' } : {}) } }, (rs) => {
      let b = '';
      rs.setEncoding('utf8');
      rs.on('data', (c) => (b += c));
      rs.on('end', () => ok({ status: rs.statusCode ?? 0, body: b, headers: rs.headers }));
    });
    rq.on('error', bad);
    if (body) rq.write(body);
    rq.end();
  });
}

test('the web game’s top-up: an order for the session’s own account at the ladder’s price, YooKassa’s page coming back to the game', async () => {
  const g = makeGame();
  const { yoo, bodies } = fakeYoo();
  const shop = new WebShop(g.game, { provider: yoo, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {}, pumpMs: 0 });
  const conn = join(g.game, 'Browser Bess');
  const s = [...g.game.sessions].find((x) => x.name === 'Browser Bess')!;
  conn.push({ t: 'premium', action: 'checkout', pack: 'd990', lang: 'ru' });
  await settle();
  const m = conn.last('premium_checkout')!;
  assert.match(m.url!, /^https:\/\/yoomoney\.ru\//, 'YooKassa’s page');
  const o = shop.get(m.order!)!;
  assert.equal(o.acc, s.accountId, 'her own account, no name typed');
  assert.equal(o.from, 'game');
  assert.equal(o.rub, 990, 'the ladder’s price in roubles');
  assert.equal(o.status, 'pending');
  assert.deepEqual(bodies[0].amount, { value: '990.00', currency: 'RUB' });
  assert.deepEqual(bodies[0].metadata, { orderId: o.id });
  assert.equal((bodies[0].confirmation as { return_url: string }).return_url, `https://gravetidegame.com/api/site/pay/back?order=${o.id}`, 'back to the game');
  // only a pack of the ladder (a captain, a hull — the shop's own Buy after the doubloons); nothing of another account
  conn.push({ t: 'premium', action: 'checkout', pack: 'cap_drowned', lang: 'ru' });
  await settle();
  assert.equal(conn.last('premium_checkout')!.url, null);
  assert.ok(conn.all('toast').some((t) => t.msg === 'The payment could not be made. Try again in a minute.'));
  const other = join(g.game, 'Other Olga');
  other.push({ t: 'premium', action: 'checkout_check', order: o.id });
  await settle();
  assert.equal(other.last('premium_checkout'), undefined, 'another’s order is not hers to ask about');
  // her shop's view says the checkout takes her payment
  conn.push({ t: 'premium', action: 'view' });
  assert.equal(conn.last('premium')?.view.web, true);
});

test('the webhook credits that very account once and the waiting purchase goes once; the back page and the test mode', async () => {
  const g = makeGame();
  const { yoo, pay } = fakeYoo();
  const shop = new WebShop(g.game, { provider: yoo, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {}, pumpMs: 0 });
  const conn = join(g.game, 'Paying Pam');
  const s = [...g.game.sessions].find((x) => x.name === 'Paying Pam')!;
  const before = g.db.doubloons(s.accountId);
  // the client: a purchase of 590 doubloons waits for the top-up (price.ts topUpThenBuy), the checkout asked for
  const buy: ClientMsg = { t: 'premium', action: 'buy_scrolls', pack: 'x' };
  const sent: ClientMsg[] = [];
  dropPending();
  waitForTopUp(before + 590, buy, 'Свитки');
  conn.push({ t: 'premium', action: 'checkout', pack: 'd590', lang: 'en' });
  await settle();
  const id = conn.last('premium_checkout')!.order!;
  const pid = shop.get(id)!.pid!;
  const { srv, port } = await serve(shop, g);
  try {
    const notice = JSON.stringify({ type: 'notification', event: 'payment.succeeded', object: { id: pid, status: 'succeeded', paid: true, amount: { value: '590.00', currency: 'RUB' }, metadata: { orderId: id } } });
    // a forged notice (YooKassa still says pending): nothing
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice)).status, 200);
    assert.equal(g.db.doubloons(s.accountId), before);
    // paid: the notice (twice), the back page, the game's own asking — credited once
    pay(pid);
    for (let i = 0; i < 2; i++) assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice)).status, 200);
    const pack = DOUBLOON_PACKS.find((p) => p.id === 'd590')!;
    assert.equal(g.db.doubloons(s.accountId), before + pack.n + pack.bonus, 'her account, once');
    const back = await call(port, 'GET', `/api/site/pay/back?order=${id}`);
    assert.equal(back.status, 200);
    assert.match(back.body, /Payment received/);
    assert.match(String(back.headers['content-security-policy']), /script-src 'nonce-/);
    conn.push({ t: 'premium', action: 'checkout_check', order: id });
    await settle();
    assert.equal(conn.last('premium_checkout')!.status, 'done');
    assert.equal(g.db.doubloons(s.accountId), before + pack.n + pack.bonus, 'still once');
    assert.ok(conn.all('toast').some((t) => t.msg === `Doubloons credited to your account: ${pack.n + pack.bonus}.`));
    // the client hears the doubloons: the purchase goes, once
    const dbl = conn.all('doubloons').map((x) => x.n);
    for (const n of dbl) heardDoubloons(n, (x) => sent.push(x));
    assert.deepEqual(sent, [buy], 'the waiting purchase sent once');
    // an unknown order's back page: nothing
    assert.equal((await call(port, 'GET', `/api/site/pay/back?order=${'f'.repeat(24)}`)).status, 404);
  } finally {
    srv.close();
  }
  // the test mode (GRAVETIDE_PAY_TEST=1): the fake checkout sends her back to the game, not to the site's shop
  const g2 = makeGame();
  const shop2 = new WebShop(g2.game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', payTest: true, log: () => {}, pumpMs: 0 });
  const c2 = join(g2.game, 'Tester Tom');
  c2.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru' });
  await settle();
  const m2 = c2.last('premium_checkout')!;
  assert.equal(m2.url, `/api/site/pay/test?order=${m2.order}`);
  const { srv: srv2, port: port2 } = await serve(shop2, g2);
  try {
    const r = await new Promise<{ status: number; loc: string }>((ok, bad) => {
      const body = `order=${m2.order}&act=pay`;
      const rq = request({ host: '127.0.0.1', port: port2, method: 'POST', path: '/api/site/pay/test', headers: { host: 'gravetidegame.com', origin: 'https://gravetidegame.com', 'Content-Type': 'application/x-www-form-urlencoded' } }, (rs) => {
        rs.resume();
        rs.on('end', () => ok({ status: rs.statusCode ?? 0, loc: String(rs.headers.location ?? '') }));
      });
      rq.on('error', bad);
      rq.end(body);
    });
    assert.equal(r.status, 303);
    assert.equal(r.loc, `/api/site/pay/back?order=${m2.order}`);
    assert.equal(shop2.get(m2.order!)!.status, 'done');
  } finally {
    srv2.close();
  }
  // without the test mode open to her (no keys, no GRAVETIDE_PAY_TEST, not an admin): no checkout
  const g3 = makeGame();
  new WebShop(g3.game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {}, pumpMs: 0 });
  const c3 = join(g3.game, 'Plain Pat');
  c3.push({ t: 'premium', action: 'view' });
  assert.equal(c3.last('premium')?.view.web, false);
  c3.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru' });
  await settle();
  assert.equal(c3.last('premium_checkout')!.url, null);
});

test('YooKassa only in the browser: Telegram keeps its Stars, VK its votes', () => {
  const g = globalThis as unknown as { document?: unknown; location?: unknown };
  const had = { document: g.document, location: g.location };
  let cls = '';
  g.document = { documentElement: { classList: { contains: (c: string) => c === cls } } };
  g.location = { hostname: 'gravetidegame.com', search: '', href: 'https://gravetidegame.com/play' };
  try {
    // the server says the checkout is open to her
    const handlers: ((m: ServerMsg) => void)[] = [];
    const net = { on: (fn: (m: ServerMsg) => void) => void handlers.push(fn), send: () => {} } as unknown as Net;
    webCheckouts(net, () => {});
    const view = { pay: true, web: true, shop: { firstPay: false } } as unknown as PremiumView;
    for (const h of handlers) h({ t: 'premium', view } as ServerMsg);
    assert.equal(webPayOpen(), true);
    const state = { self: { name: 'Anne' } } as unknown as ClientState;
    // the browser: roubles, «Оплатить» through YooKassa, no Stars
    cls = '';
    assert.equal(payIn(), 'rub');
    assert.equal(viaCheckout(), true);
    let html = topUp(view, state);
    assert.ok(html.includes('data-pmyk="d290"'), 'YooKassa’s Buy');
    assert.ok(!html.includes('data-pmpack') && !html.includes('tg-star'), 'no Stars in the browser');
    // Telegram's Mini App: Stars, no YooKassa
    cls = 'tg-app';
    assert.equal(payIn(), 'stars');
    assert.equal(viaCheckout(), false);
    html = topUp(view, state);
    assert.ok(html.includes('data-pmpack="d290"'), 'Stars');
    assert.ok(!html.includes('data-pmyk') && !html.includes('ЮKassa') && !html.includes('YooKassa'), 'no YooKassa in Telegram');
    // VK: votes, no YooKassa
    cls = 'vk-app';
    assert.equal(payIn(), 'votes');
    assert.equal(viaCheckout(), false);
    html = topUp(view, state);
    assert.ok(!html.includes('data-pmyk') && !html.includes('ЮKassa') && !html.includes('YooKassa'), 'no YooKassa in VK');
    // the checkout closed (no keys, no test mode): the browser's top-up falls back as before
    for (const h of handlers) h({ t: 'premium', view: { ...view, web: false } } as ServerMsg);
    cls = '';
    assert.equal(viaCheckout(), false);
    assert.equal(payOpen(true), true, 'Stars by a link, as before');
  } finally {
    g.document = had.document;
    g.location = had.location;
  }
});
