// The website's shop (owner, 2026-10-20: «магазин сделать типа как мы сделали на fovgame.com чтобы оставил ник, купил и
// купил»; server/src/game/webshop.ts, server/src/pay/yookassa.ts, server/src/http/site-routes.ts): the catalogue's
// server-side prices, the captain's lookup and its limit, the order, the delivery through the game's own purchase paths
// once only, the test mode end to end over HTTP, YooKassa's adapter (env only, a notice re-fetched), owned things not
// sold twice, and the pages in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import type { Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join as pjoin } from 'node:path';
import { CAPTAIN_PRICE } from '../shared/src/data/captains.ts';
import { BUNDLES } from '../shared/src/data/cosmetics.ts';
import { DOUBLOON_PACKS } from '../shared/src/data/premium.ts';
import { WEB_ITEMS, cleanCaptainName, webItem } from '../shared/src/data/webshop.ts';
import { ownsCaptain } from '../server/src/game/captainshop.ts';
import { cosState, forgetCos } from '../server/src/game/cosmetics.ts';
import { SiteRating } from '../server/src/game/siterating.ts';
import { WebShop } from '../server/src/game/webshop.ts';
import { SITE_LIMITS, siteRoutes } from '../server/src/http/site-routes.ts';
import { TestPay, YooKassa, noticePid, readPayment, yooAddress, yookassaFromEnv } from '../server/src/pay/yookassa.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>;
const SITE = pjoin(import.meta.dirname, '..', 'site');

function cap(g: G, name: string, p: Record<string, unknown> = {}): number {
  const id = g.db.createAccount(name, `h-${name}`);
  g.db.saveCaptain(id, { captain: 'corsair', level: 12, xp: 0, stats: { boarded: 0 }, ...p }, 0, 0, 0);
  return id;
}

function shopOf(g: G, o: Partial<ConstructorParameters<typeof WebShop>[1]> = {}): WebShop {
  const rating = new SiteRating(g.game);
  return new WebShop(g.game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', payTest: true, hidden: (a, n) => rating.hidden(a, n), log: () => {}, ...o });
}

/** The ledger's rows of an account (the purchase's proof). */
const rows = (g: G, acc: number, kind: string) =>
  (g.db as unknown as { db: { prepare(s: string): { all(...a: unknown[]): { kind: string; amount: number; detail: string }[] } } }).db.prepare('SELECT kind, amount, detail FROM ledger WHERE account_id = ? AND kind = ?').all(acc, kind);

test('the catalogue: the top-up’s ladder 290–9 900 ₽ with its bonus, premium captains at 2 490, the bundles, the marked chests', () => {
  const packs = WEB_ITEMS.filter((x) => x.kind === 'pack');
  assert.deepEqual(packs.map((x) => x.rub), [290, 590, 990, 1990, 4990, 9900]);
  for (const p of DOUBLOON_PACKS) assert.equal(webItem(p.id)?.doubloons, p.n + p.bonus);
  assert.deepEqual(WEB_ITEMS.filter((x) => x.kind === 'captain').map((x) => [x.id, x.rub]), [['cap_drowned', CAPTAIN_PRICE], ['cap_admiral', CAPTAIN_PRICE]]);
  assert.deepEqual(WEB_ITEMS.filter((x) => x.kind === 'bundle').map((x) => x.id), BUNDLES.map((b) => b.id));
  assert.deepEqual(WEB_ITEMS.filter((x) => x.kind === 'offer').map((x) => x.id), ['starter', 'sub30', 'weekly']);
  for (const x of WEB_ITEMS) assert.ok(x.name[1] && x.text[1] && !/[A-Za-z]{3,}/.test(x.name[1].replace(/GRAVETIDE/g, '')), `${x.id}: a Russian name`);
  assert.equal(webItem('__proto__'), undefined);
  assert.equal(webItem('constructor'), undefined);
  assert.equal(cleanCaptainName('  Red   Hook '), 'Red Hook');
  assert.equal(cleanCaptainName('a'), null);
  assert.equal(cleanCaptainName('<b>x</b>'), null);
});

test('the seasonal bundles are on sale only between their dates', () => {
  const g = makeGame();
  const shop = shopOf(g);
  const hw = BUNDLES.find((b) => b.id === 'cos_halloween')!;
  g.game.wallNow = () => hw.from! + 1000;
  assert.ok(shop.catalog().some((x) => x.id === 'cos_halloween'));
  g.game.wallNow = () => hw.until! + 1000;
  assert.ok(!shop.catalog().some((x) => x.id === 'cos_halloween'));
  assert.ok(shop.catalog().some((x) => x.id === 'cos_starter'), 'the starter outfit is always there');
});

test('the captain lookup: found with her captain and level, unknown and hidden are «not found», a bad name refused', () => {
  const g = makeGame();
  const shop = shopOf(g);
  cap(g, 'Salt Gull', { captain: 'navigator', level: 23 });
  cap(g, 'Bot a1b2c3');
  const r = shop.lookup('salt gull');
  assert.ok(r && r !== 'bad_name');
  assert.equal(r.name, 'Salt Gull', 'the name as the game writes it');
  assert.equal(r.captain, 'navigator');
  assert.equal(r.level, 23);
  assert.deepEqual(Object.keys(r).sort(), ['captain', 'level', 'name', 'unavailable'], 'nothing more: no account id, no e-mail');
  assert.equal(shop.lookup('Nobody Here'), null);
  assert.equal(shop.lookup('Bot a1b2c3'), null, 'a load-test bot is not a buyer');
  assert.equal(shop.lookup('x'), 'bad_name');
});

test('an order: the server’s price whatever the page says; the test mode closed to all but the admins without GRAVETIDE_PAY_TEST', async () => {
  const g = makeGame();
  const acc = cap(g, 'Thrifty Tom');
  const closed = shopOf(g, { payTest: false });
  assert.deepEqual(await closed.order({ name: 'Thrifty Tom', item: 'd290', lang: 'ru' }), { error: 'test_only' });
  const admin = shopOf(g, { payTest: false, admins: [acc] });
  const ok = await admin.order({ name: 'Thrifty Tom', item: 'd990', lang: 'ru', rub: 1, price: 1 } as never);
  assert.ok('orderId' in ok);
  assert.match(ok.url, /^\/api\/site\/pay\/test\?order=[0-9a-f]{24}$/);
  const o = admin.get(ok.orderId)!;
  assert.equal(o.rub, 990, 'the price is the catalogue’s');
  assert.equal(o.status, 'pending');
  assert.equal(o.acc, acc);
  const shop = shopOf(g);
  assert.deepEqual(await shop.order({ name: 'Thrifty Tom', item: 'free_stuff' }), { error: 'bad_item' });
  assert.deepEqual(await shop.order({ name: 'Nobody', item: 'd290' }), { error: 'not_found' });
  assert.deepEqual(await shop.order({ name: '', item: 'd290' }), { error: 'bad_name' });
});

test('a paid pack: credited once by the payment path of the game (doubloons_pay web:<order>) — a second notice delivers nothing', async () => {
  const g = makeGame();
  const acc = cap(g, 'Rich Ruth');
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Rich Ruth', item: 'd1990', lang: 'en' });
  assert.ok('orderId' in r);
  assert.equal(g.db.doubloons(acc), 0, 'nothing before the payment');
  assert.equal(await shop.settleTest(r.orderId, true), true);
  const pack = DOUBLOON_PACKS.find((p) => p.id === 'd1990')!;
  assert.equal(g.db.doubloons(acc), pack.n + pack.bonus);
  const o = shop.get(r.orderId)!;
  assert.equal(o.status, 'done');
  // the provider says it again (and again): nothing more
  assert.equal(await shop.notice(o.pid!), true);
  shop.apply({ pid: o.pid!, status: 'succeeded', paid: true, amountRub: 1990, currency: 'RUB', orderId: o.id });
  assert.equal(g.db.doubloons(acc), pack.n + pack.bonus, 'credited once');
  assert.deepEqual(rows(g, acc, 'doubloons_pay').map((x) => [x.amount, x.detail]), [[pack.n + pack.bonus, `web:${o.id}`]]);
  assert.equal(shop.view(o.id)!.status, 'done');
});

test('a premium captain from the site: the doubloons in, the captain bought by the game’s own purchase; then shown owned and not sold again', async () => {
  const g = makeGame();
  const acc = cap(g, 'Wants Ilse');
  const shop = shopOf(g);
  const before = shop.lookup('Wants Ilse');
  assert.ok(before && before !== 'bad_name' && before.unavailable.cap_drowned === undefined);
  const r = await shop.order({ name: 'Wants Ilse', item: 'cap_drowned', lang: 'ru' });
  assert.ok('orderId' in r);
  await shop.settleTest(r.orderId, true);
  assert.ok(ownsCaptain(g.game, acc, 'drowned'));
  assert.equal(g.db.doubloons(acc), 0, 'the price paid in, then spent');
  assert.deepEqual(rows(g, acc, 'doubloons_captain').map((x) => [x.amount, x.detail]), [[-CAPTAIN_PRICE, 'drowned']]);
  const again = shop.lookup('Wants Ilse');
  assert.ok(again && again !== 'bad_name');
  assert.equal(again.unavailable.cap_drowned, 'owned');
  assert.deepEqual(await shop.order({ name: 'Wants Ilse', item: 'cap_drowned' }), { error: 'owned' });
});

test('an outfit for a captain not aboard: the shop’s own offer bought by the account (doubloons_buy shop:web:<order>), owned after', async () => {
  const g = makeGame();
  const acc = cap(g, 'Away Annie');
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Away Annie', item: 'cos_starter', lang: 'ru' });
  assert.ok('orderId' in r);
  await shop.settleTest(r.orderId, true);
  forgetCos(g.game, acc);
  assert.ok(cosState(g.game, acc).own.includes('title:storm'));
  assert.ok(cosState(g.game, acc).own.includes('frame:wheel'));
  assert.deepEqual(rows(g, acc, 'doubloons_buy').map((x) => [x.amount, x.detail]), [[-1990, `shop:web:${r.orderId}`]]);
  assert.equal(g.db.doubloons(acc), 0);
  const l = shop.lookup('Away Annie');
  assert.ok(l && l !== 'bad_name');
  assert.equal(l.unavailable.cos_starter, 'owned');
  assert.deepEqual(await shop.order({ name: 'Away Annie', item: 'cos_starter' }), { error: 'owned' });
  // the starter chest: once ever — bought, then owned
  const s2 = await shop.order({ name: 'Away Annie', item: 'starter' });
  assert.ok('orderId' in s2);
  await shop.settleTest(s2.orderId, true);
  const l2 = shop.lookup('Away Annie');
  assert.ok(l2 && l2 !== 'bad_name' && l2.unavailable.starter === 'owned');
});

test('aboard: the purchase arrives live with the toast «Покупка с сайта: …»', async () => {
  const g = makeGame();
  const c = join(g.game, 'Sails Now');
  const s = [...g.game.sessions].find((x) => x.name === 'Sails Now')!;
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Sails Now', item: 'cos_starter', lang: 'ru' });
  assert.ok('orderId' in r);
  c.inbox.length = 0;
  await shop.settleTest(r.orderId, true);
  assert.ok(cosState(g.game, s.accountId).own.includes('plate:silver'));
  const toasts = c.all('toast').map((m) => m.msg);
  // (no «credited» and «bought» besides it; a first payment of real money also lays the first top-up's double in the
  // shop, as a first Stars payment does — the game's own rule, docs/32 §1)
  assert.deepEqual(toasts, ['Your first top-up comes double: 1990 doubloons wait for you in the shop.', 'Web shop purchase: Captain’s Finery.']);
  assert.equal(serverText(toasts[1]).replace(/\u00a0/g, ' '), 'Покупка с сайта: Наряд капитана.');
  assert.ok(c.last('doubloons'), 'the balance pushed');
  assert.ok(c.last('cos'), 'the wardrobe pushed');
  assert.equal(serverText('Web shop purchase: 2390 doubloons.').replace(/\u00a0/g, ' '), 'Покупка с сайта: 2390 дубл.');
});

test('a payment of the wrong amount or a declined one delivers nothing', async () => {
  const g = makeGame();
  const acc = cap(g, 'Short Change');
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Short Change', item: 'd4990' });
  assert.ok('orderId' in r);
  const o = shop.get(r.orderId)!;
  shop.apply({ pid: o.pid!, status: 'succeeded', paid: true, amountRub: 1, currency: 'RUB', orderId: o.id });
  assert.equal(shop.get(o.id)!.status, 'failed');
  assert.equal(g.db.doubloons(acc), 0);
  const r2 = await shop.order({ name: 'Short Change', item: 'd290' });
  assert.ok('orderId' in r2);
  await shop.settleTest(r2.orderId, false);
  assert.equal(shop.get(r2.orderId)!.status, 'canceled');
  assert.equal(g.db.doubloons(acc), 0);
  // a payment that is not the order's own
  const r3 = await shop.order({ name: 'Short Change', item: 'd590' });
  assert.ok('orderId' in r3);
  shop.apply({ pid: 'someone-elses-payment', status: 'succeeded', paid: true, amountRub: 590, currency: 'RUB', orderId: r3.orderId });
  assert.equal(shop.get(r3.orderId)!.status, 'pending');
  assert.equal(g.db.doubloons(acc), 0);
});

// ------------------------------------------------------------------------------------------------ over HTTP

async function serve(shop: WebShop, rating: SiteRating): Promise<{ srv: Server; port: number }> {
  const handle = siteRoutes({ rating, shop, publicUrl: 'https://gravetidegame.com' });
  const srv = createServer((req, res) => void handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, port: (srv.address() as { port: number }).port };
}

function call(port: number, method: string, path: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((ok, bad) => {
    const rq = request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...headers } }, (rs) => {
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

test('the test mode end to end over HTTP: the name, the order, the fake checkout, the return page’s status', async () => {
  const g = makeGame();
  const acc = cap(g, 'Web Wanda', { captain: 'smuggler', level: 31 });
  const rating = new SiteRating(g.game);
  const shop = new WebShop(g.game, { provider: null, returnUrl: '/site/shop/', payTest: true, hidden: (a, n) => rating.hidden(a, n), log: () => {} });
  const { srv, port } = await serve(shop, rating);
  const origin = `http://127.0.0.1:${port}`;
  try {
    const st = JSON.parse((await call(port, 'GET', '/api/site/shop')).body);
    assert.equal(st.mode, 'test');
    assert.ok(st.items.some((x: { id: string }) => x.id === 'd290'));
    const who = await call(port, 'GET', '/api/site/captain?name=web%20wanda');
    assert.equal(who.status, 200);
    assert.equal(JSON.parse(who.body).captain, 'smuggler');
    // a POST without this site's Origin, or not JSON: refused
    const order = JSON.stringify({ name: 'Web Wanda', item: 'd590', lang: 'ru' });
    assert.equal((await call(port, 'POST', '/api/site/order', order, { 'Content-Type': 'application/json' })).status, 403);
    assert.equal((await call(port, 'POST', '/api/site/order', order, { 'Content-Type': 'application/json', Origin: 'https://evil.example' })).status, 403);
    assert.equal((await call(port, 'POST', '/api/site/order', order, { 'Content-Type': 'text/plain', Origin: origin })).status, 415);
    const made = await call(port, 'POST', '/api/site/order', order, { 'Content-Type': 'application/json', Origin: origin });
    assert.equal(made.status, 200);
    const { orderId, url } = JSON.parse(made.body);
    assert.equal(JSON.parse((await call(port, 'GET', `/api/site/order?id=${orderId}`)).body).status, 'pending');
    const page = await call(port, 'GET', url);
    assert.equal(page.status, 200);
    assert.match(page.body, /ТЕСТОВЫЙ РЕЖИМ/);
    assert.match(page.body, /Web Wanda/);
    assert.match(page.body, /590/);
    assert.equal((await call(port, 'POST', '/api/site/pay/test', `order=${orderId}&act=pay`, { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 403, 'the fake checkout checks the Origin too');
    const paid = await call(port, 'POST', '/api/site/pay/test', `order=${orderId}&act=pay`, { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin });
    assert.equal(paid.status, 303);
    assert.equal(paid.headers.location, `/site/shop/?order=${orderId}`);
    const done = JSON.parse((await call(port, 'GET', `/api/site/order?id=${orderId}`)).body);
    assert.deepEqual(done, { status: 'done', item: 'd590', name: 'Web Wanda', rub: 590, provider: 'test' });
    assert.equal(g.db.doubloons(acc), 620);
    // and paid again by a replay of the form: nothing more
    await call(port, 'POST', '/api/site/pay/test', `order=${orderId}&act=pay`, { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin });
    assert.equal(g.db.doubloons(acc), 620);
    // the board and the YooKassa webhook (none in the test mode)
    assert.equal((await call(port, 'GET', '/api/site/rating?board=level')).status, 200);
    assert.equal((await call(port, 'GET', '/api/site/rating?board=__proto__')).status, 400);
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', '{}', { 'Content-Type': 'application/json' })).status, 404);
  } finally {
    srv.close();
  }
});

test('the captain lookup is limited per address (against walking the list of names)', async () => {
  const g = makeGame();
  cap(g, 'Some Body');
  const rating = new SiteRating(g.game);
  const shop = shopOf(g);
  const { srv, port } = await serve(shop, rating);
  try {
    const [max] = SITE_LIMITS.captain[0];
    const codes: number[] = [];
    for (let i = 0; i < max + 2; i++) codes.push((await call(port, 'GET', `/api/site/captain?name=Guess${i}`)).status);
    assert.deepEqual(codes.slice(0, max), Array(max).fill(404));
    assert.deepEqual(codes.slice(max), [429, 429]);
    assert.equal((await call(port, 'GET', '/api/site/captain?name=Some%20Body')).status, 429, 'even a right name, once over the limit');
  } finally {
    srv.close();
  }
});

// ------------------------------------------------------------------------------------------------ YooKassa

test('YooKassa: made only from the environment; a payment with a redirect, the order in its metadata, the idempotence key', async () => {
  assert.equal(yookassaFromEnv({}), null, 'no keys: the test mode');
  assert.equal(yookassaFromEnv({ YOOKASSA_SHOP_ID: '123' }), null);
  const calls: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[] = [];
  const http = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ id: '2e6c1a2b-000f-5000-9000-1b2c3d4e5f60', status: 'pending', confirmation: { confirmation_url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=x' } }), text: async () => '' };
  };
  const y = yookassaFromEnv({ YOOKASSA_SHOP_ID: '123456', YOOKASSA_SECRET_KEY: 'test_secret' }, http)!;
  assert.ok(y instanceof YooKassa);
  const p = await y.create({ orderId: 'a'.repeat(24), rub: 990, description: 'GRAVETIDE: 1 090 дублонов', returnUrl: 'https://gravetidegame.com/site/shop/?order=x' });
  assert.deepEqual(p, { pid: '2e6c1a2b-000f-5000-9000-1b2c3d4e5f60', url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=x' });
  const c = calls[0];
  assert.equal(c.url, 'https://api.yookassa.ru/v3/payments');
  assert.equal(c.init?.headers?.Authorization, `Basic ${Buffer.from('123456:test_secret').toString('base64')}`);
  assert.equal(c.init?.headers?.['Idempotence-Key'], 'a'.repeat(24));
  const body = JSON.parse(c.init!.body!);
  assert.deepEqual(body.amount, { value: '990.00', currency: 'RUB' });
  assert.deepEqual(body.confirmation, { type: 'redirect', return_url: 'https://gravetidegame.com/site/shop/?order=x' });
  assert.deepEqual(body.metadata, { orderId: 'a'.repeat(24) });
  assert.equal(body.capture, true);
  // with receipts on, no e-mail: no payment
  const yr = yookassaFromEnv({ YOOKASSA_SHOP_ID: '1', YOOKASSA_SECRET_KEY: 's', YOOKASSA_RECEIPT: '1' }, http)!;
  assert.equal(yr.needsEmail, true);
  assert.equal(await yr.create({ orderId: 'b'.repeat(24), rub: 290, description: 'x', returnUrl: 'https://x/' }), null);
  // the readers
  assert.equal(noticePid({ type: 'notification', event: 'payment.succeeded', object: { id: '2e6c1a2b-000f-5000-9000-1b2c3d4e5f60' } }), '2e6c1a2b-000f-5000-9000-1b2c3d4e5f60');
  assert.equal(noticePid({ type: 'notification', event: 'refund.succeeded', object: { id: 'x'.repeat(20) } }), null);
  assert.equal(readPayment({ id: '2e6c1a2b-000f-5000-9000-1b2c3d4e5f60', status: 'succeeded', paid: true, amount: { value: '990.00', currency: 'RUB' }, metadata: { orderId: 'c'.repeat(24) } })?.paid, true);
  assert.equal(readPayment({ id: 'short', status: 'succeeded' }), null);
  assert.ok(yooAddress('185.71.76.5') && yooAddress('77.75.156.11') && yooAddress('::ffff:77.75.153.10') && !yooAddress('8.8.8.8'));
});

test('YooKassa live: the webhook is not believed — the payment is fetched again; a forged notice delivers nothing', async () => {
  const g = makeGame();
  const acc = cap(g, 'Live Larry');
  const pays = new Map<string, Record<string, unknown>>();
  let n = 0;
  const http = async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body!);
      const id = `2e6c1a2b-000f-5000-9000-${String(++n).padStart(12, '0')}`;
      pays.set(id, { id, status: 'pending', paid: false, amount: b.amount, metadata: b.metadata });
      return { ok: true, status: 200, json: async () => ({ id, confirmation: { confirmation_url: `https://yoomoney.ru/checkout?id=${id}` } }), text: async () => '' };
    }
    const p = pays.get(url.split('/').pop()!);
    return p ? { ok: true, status: 200, json: async () => p, text: async () => '' } : { ok: false, status: 404, json: async () => ({}), text: async () => 'not found' };
  };
  const yoo = new YooKassa({ shopId: '1', secret: 's', receipt: false, vatCode: 1, checkIp: false }, http, () => {});
  const rating = new SiteRating(g.game);
  const shop = new WebShop(g.game, { provider: yoo, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {} });
  assert.equal(shop.mode, 'live');
  const { srv, port } = await serve(shop, rating);
  try {
    const r = await shop.order({ name: 'Live Larry', item: 'd590', lang: 'en' });
    assert.ok('orderId' in r);
    assert.match(r.url, /^https:\/\/yoomoney\.ru\//);
    const pid = shop.get(r.orderId)!.pid!;
    const notice = (id: string) => JSON.stringify({ type: 'notification', event: 'payment.succeeded', object: { id, status: 'succeeded', paid: true, amount: { value: '590.00', currency: 'RUB' }, metadata: { orderId: r.orderId } } });
    // forged: the payment is still pending at YooKassa
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice(pid), { 'Content-Type': 'application/json' })).status, 200);
    assert.equal(g.db.doubloons(acc), 0, 'a notice alone is not a payment');
    // forged with an id YooKassa never made: refused, nothing
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice('2e6c1a2b-000f-5000-9000-999999999999'), { 'Content-Type': 'application/json' })).status, 503);
    // paid for real, then the notice (twice)
    Object.assign(pays.get(pid)!, { status: 'succeeded', paid: true });
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice(pid), { 'Content-Type': 'application/json' })).status, 200);
    assert.equal((await call(port, 'POST', '/api/site/pay/yookassa', notice(pid), { 'Content-Type': 'application/json' })).status, 200);
    assert.equal(g.db.doubloons(acc), 620);
    assert.equal(shop.view(r.orderId)!.status, 'done');
    assert.equal(shop.test, null, 'no fake checkout when live');
    assert.equal((await call(port, 'GET', `/api/site/pay/test?order=${r.orderId}`)).status, 404);
  } finally {
    srv.close();
  }
  assert.ok(new TestPay().needsEmail === false);
});

// ------------------------------------------------------------------------------------------------ the pages

test('the pages in both languages: the rating, the shop, the terms and the refunds; «Рейтинг» and «Магазин» in the menu', () => {
  for (const p of ['rating', 'shop', 'terms', 'refunds']) {
    assert.ok(existsSync(pjoin(SITE, p, 'index.html')), `ru ${p}`);
    assert.ok(existsSync(pjoin(SITE, 'en', p, 'index.html')), `en ${p}`);
  }
  for (const page of ['index.html', 'creatures/index.html', 'forum/index.html']) {
    const ru = readFileSync(pjoin(SITE, page), 'utf8'), en = readFileSync(pjoin(SITE, 'en', page), 'utf8');
    assert.match(ru, /href="\/site\/rating\/"[^>]*>.*?Рейтинг/s);
    assert.match(ru, /href="\/site\/shop\/"[^>]*>.*?Магазин/s);
    assert.match(en, /href="\/site\/en\/rating\/"[^>]*>.*?Rating/s);
    assert.match(en, /href="\/site\/en\/shop\/"[^>]*>.*?Shop/s);
    assert.match(ru, /href="\/site\/terms\/"/);
    assert.match(en, /href="\/site\/en\/refunds\/"/);
  }
  // the scripts' strings: the same keys in both, the Russian ones Russian
  for (const [page, id] of [['shop', 'shop-data'], ['rating', 'rt-data']] as const) {
    const read = (lang: string) => {
      const html = readFileSync(pjoin(SITE, lang === 'ru' ? '' : 'en', page, 'index.html'), 'utf8');
      const m = new RegExp(`<script type="application/json" id="${id}">(.*?)</script>`, 's').exec(html);
      return JSON.parse(m![1]) as { t: Record<string, string> };
    };
    const ru = read('ru').t, en = read('en').t;
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort(), page);
    for (const [k, v] of Object.entries(ru)) {
      assert.ok(v, `${page}.${k}`);
      assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/ЮKassa|YooKassa|СБП|mail@example\.com/g, '')), `${page}.${k} is Russian: ${v}`);
    }
  }
  // the legal pages mark every place the owner must fill in
  const terms = readFileSync(pjoin(SITE, 'terms', 'index.html'), 'utf8');
  assert.ok((terms.match(/class="todo"/g) ?? []).length >= 5);
  assert.match(readFileSync(pjoin(SITE, 'shop', 'index.html'), 'utf8'), /публичной оферты/);
  assert.match(readFileSync(pjoin(SITE, 'en', 'shop', 'index.html'), 'utf8'), /terms of sale/);
});
