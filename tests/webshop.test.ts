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
import { WEB_EXCLUDED, WEB_ITEMS, WEB_SECS, WEB_TABS, cleanCaptainName, gameShopIds, webItem } from '../shared/src/data/webshop.ts';
import { UNITS } from '../shared/src/data/army.ts';
import { DOUBLOON_PACKS, premiumShips, premiumUnits } from '../shared/src/data/premium.ts';
import { OFFERS, dayOf, dealOf, unitPacks } from '../shared/src/data/shop.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { ownsCaptain } from '../server/src/game/captainshop.ts';
import { cosState, forgetCos } from '../server/src/game/cosmetics.ts';
import { SiteRating } from '../server/src/game/siterating.ts';
import { WebShop } from '../server/src/game/webshop.ts';
import { SITE_LIMITS, siteRoutes } from '../server/src/http/site-routes.ts';
import { TestPay, YooKassa, noticePid, readPayment, yooAddress, yookassaFromEnv } from '../server/src/pay/yookassa.ts';
import { serverText } from '../client/src/lang/server.ts';
import { FakeConn, join, makeGame, onHull, steps } from './helpers.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { shopState } from '../server/src/game/shop.ts';

type G = ReturnType<typeof makeGame>;
const SITE = pjoin(import.meta.dirname, '..', 'site');

function cap(g: G, name: string, p: Record<string, unknown> = {}): number {
  const id = g.db.createAccount(name, `h-${name}`);
  g.db.saveCaptain(id, { captain: 'corsair', level: 12, xp: 0, stats: { boarded: 0 }, ...p }, 0, 0, 0);
  return id;
}

function shopOf(g: G, o: Partial<ConstructorParameters<typeof WebShop>[1]> = {}): WebShop {
  const rating = new SiteRating(g.game);
  return new WebShop(g.game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', payTest: true, hidden: (a, n) => rating.hidden(a, n), log: () => {}, pumpMs: 0, ...o });
}

/** The ledger's rows of an account (the purchase's proof). */
const rows = (g: G, acc: number, kind: string) =>
  (g.db as unknown as { db: { prepare(s: string): { all(...a: unknown[]): { kind: string; amount: number; detail: string }[] } } }).db.prepare('SELECT kind, amount, detail FROM ledger WHERE account_id = ? AND kind = ?').all(acc, kind);

test('the catalogue: the top-up’s ladder 290–9 900 ₽ with its bonus, premium captains at 2 490, every hull, creature and good of the game’s shop', () => {
  const packs = WEB_ITEMS.filter((x) => x.kind === 'pack');
  assert.deepEqual(packs.map((x) => x.rub), [290, 590, 990, 1990, 4990, 9900]);
  for (const p of DOUBLOON_PACKS) assert.equal(webItem(p.id)?.doubloons, p.n + p.bonus);
  assert.deepEqual(WEB_ITEMS.filter((x) => x.kind === 'captain').map((x) => [x.id, x.rub]), [['cap_drowned', CAPTAIN_PRICE], ['cap_admiral', CAPTAIN_PRICE]]);
  for (const b of BUNDLES) assert.equal(webItem(b.id)?.tab, 'cos', b.id);
  for (const x of WEB_ITEMS) assert.ok(x.name[1] && x.text[1] && !/[A-Za-z]{3,}/.test(x.name[1].replace(/GRAVETIDE/g, '')), `${x.id}: a Russian name`);
  for (const x of WEB_ITEMS) assert.ok(WEB_TABS.includes(x.tab) && (x.sec === '' || WEB_SECS[x.sec]), `${x.id}: a tab and a shelf`);
  assert.equal(webItem('__proto__'), undefined);
  assert.equal(webItem('constructor'), undefined);
  assert.equal(cleanCaptainName('  Red   Hook '), 'Red Hook');
  assert.equal(cleanCaptainName('a'), null);
  assert.equal(cleanCaptainName('<b>x</b>'), null);
});

test('every id of the game’s premium shop is on the site or on the documented exclusions; the site’s prices are the game’s', () => {
  const missing = gameShopIds().filter((id) => !webItem(id) && !WEB_EXCLUDED[id]);
  assert.deepEqual(missing, [], 'every in-game item on the site or explained');
  for (const [id, why] of Object.entries(WEB_EXCLUDED)) assert.ok(why[0] && why[1], `${id}: a reason in both languages`);
  for (const id of Object.keys(WEB_EXCLUDED)) assert.equal(webItem(id), undefined, `${id}: excluded, so not sold`);
  // the doubloon price of each, a rouble a doubloon
  for (const c of premiumShips()) assert.equal(webItem(`ship_${c}`)?.rub, SHIP_CLASSES[c].premium!.price, c);
  for (const u of premiumUnits()) for (const p of unitPacks(UNITS[u].premium!.price)) {
    const x = webItem(`unit_${u}_${p.k}`)!;
    assert.equal(x.rub, p.price, `${u}×${p.k}`);
    assert.equal(x.n, UNITS[u].premium!.n * p.k);
  }
  for (const [id, { offer }] of OFFERS) if (!WEB_EXCLUDED[id]) assert.equal(webItem(id)?.rub, offer.price, id);
  // the tabs: every one of them stocked
  for (const t of WEB_TABS) assert.ok(WEB_ITEMS.some((x) => x.tab === t), t);
  // the ship's own creatures are never sold apart from her (as in the game)
  assert.ok(!WEB_ITEMS.some((x) => x.kind === 'unit' && x.unit === 'cormorant'));
  // the deal of the day: today's offer at the game's price
  const g = makeGame();
  const shop = shopOf(g);
  const d = dealOf(dayOf(g.game.wallNow()));
  const deal = shop.catalog().find((x) => x.id === 'deal')!;
  assert.equal(deal.offer, d.offer.id);
  assert.equal(deal.rub, d.price);
});

test('the seasonal bundles are sold only between their dates, and shown out of them as «not the season»', () => {
  const g = makeGame();
  const shop = shopOf(g);
  const acc = cap(g, 'Season Sal');
  const hw = BUNDLES.find((b) => b.id === 'cos_halloween')!;
  g.game.wallNow = () => hw.from! + 1000;
  assert.equal(shop.catalog().find((x) => x.id === 'cos_halloween')?.off, undefined);
  assert.equal(shop.why(acc, webItem('cos_halloween')!), null);
  g.game.wallNow = () => hw.until! + 1000;
  assert.equal(shop.catalog().find((x) => x.id === 'cos_halloween')?.off, 'season');
  assert.equal(shop.unavailable(acc).cos_halloween, 'season');
  assert.ok(shop.catalog().some((x) => x.id === 'cos_starter' && !x.off), 'the starter outfit is always there');
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
  assert.deepEqual(Object.keys(r).sort(), ['captain', 'level', 'name', 'online', 'port', 'unavailable'], 'nothing more: no account id, no e-mail');
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

test('a ship from the site: paid at sea she waits for the port, then comes by the game’s own buyShip — once', async () => {
  const g = makeGame();
  const c = join(g.game, 'Hull Hanna');
  const s = g.game.sessionByName('Hull Hanna')!;
  const ship = s.ship!;
  const port = ship.docked!;
  const was = ship.loadout.classId;
  c.push({ t: 'undock' });
  assert.equal(ship.docked, null);
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Hull Hanna', item: 'ship_lantern_sampan', lang: 'ru' });
  assert.ok('orderId' in r, JSON.stringify(r));
  assert.equal(shop.get(r.orderId)!.rub, SHIP_CLASSES.lantern_sampan.premium!.price);
  c.inbox.length = 0;
  await shop.settleTest(r.orderId, true);
  assert.equal(shop.view(r.orderId)!.status, 'paid');
  assert.equal(shop.view(r.orderId)!.wait, 'port');
  assert.equal(ship.loadout.classId, was, 'not at sea');
  assert.equal(g.db.doubloons(s.accountId), 0, 'nothing credited while she waits');
  assert.match(c.all('toast').map((m) => m.msg).join('|'), /waits for you in port: Lantern Sampan/);
  shop.pump();
  assert.equal(shop.get(r.orderId)!.status, 'paid');
  // she makes port: delivered by the game's own purchase of a hull, her old ship berthed there
  const back = g.game.portById(port)!;
  ship.state = { ...ship.state, x: back.x, y: back.y, speed: 0 };
  ship.docked = port;
  shop.pump();
  assert.equal(shop.get(r.orderId)!.status, 'done');
  assert.equal(ship.loadout.classId, 'lantern_sampan');
  assert.equal(s.profile!.berths.at(-1)!.loadout.classId, was);
  assert.ok(ship.army.some((x) => x.u === 'cormorant'), 'her own creatures aboard');
  assert.deepEqual(rows(g, s.accountId, 'doubloons_buy').map((x) => [x.amount, x.detail]), [[-990, 'ship:lantern_sampan']]);
  assert.deepEqual(rows(g, s.accountId, 'doubloons_pay').map((x) => [x.amount, x.detail]), [[990, `web:${r.orderId}`]]);
  shop.pump();
  await shop.refresh(r.orderId);
  assert.equal(rows(g, s.accountId, 'doubloons_buy').length, 1, 'once');
  const l = shop.lookup('Hull Hanna');
  assert.ok(l && l !== 'bad_name' && l.unavailable.ship_lantern_sampan === 'yours');
  assert.ok(l.online && l.port);
});

test('a creature pack from the site: in a fight it waits, then joins by the game’s own buyUnit (unit:<kind>:<n>:<order>)', async () => {
  const g = makeGame();
  const c = join(g.game, 'Beast Bella');
  const s = g.game.sessionByName('Beast Bella')!;
  const ship = s.ship!;
  onHull(g.game, ship, 'brig', 5);
  const u = premiumUnits()[0];
  const k = unitPacks(UNITS[u].premium!.price)[1].k;
  const id = `unit_${u}_${k}`;
  const n = UNITS[u].premium!.n * k;
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Beast Bella', item: id, lang: 'ru' });
  assert.ok('orderId' in r, JSON.stringify(r));
  ship.lastHitAt = g.game.now;
  await shop.settleTest(r.orderId, true);
  assert.equal(shop.view(r.orderId)!.wait, 'fight');
  assert.ok(!ship.army.some((x) => x.u === u));
  ship.lastHitAt = -999;
  shop.pump();
  assert.equal(shop.get(r.orderId)!.status, 'done');
  assert.equal(ship.army.find((x) => x.u === u)?.n, n, 'the whole pack aboard');
  const price = webItem(id)!.rub;
  assert.deepEqual(rows(g, s.accountId, 'doubloons_buy').map((x) => [x.amount, x.detail]), [[-price, `unit:${u}:${n}:${r.orderId}`]]);
  assert.equal(g.db.doubloons(s.accountId), 0);
  assert.match(c.all('toast').map((m) => m.msg).join('|'), new RegExp(`Web shop purchase: .*×${n}`));
});

test('a thing for her ship while she is ashore waits for her login; the account’s goods come at once', async () => {
  const g = makeGame();
  const c = join(g.game, 'Shore Sam');
  const s = g.game.sessionByName('Shore Sam')!;
  const acc = s.accountId;
  const token = s.token!;
  c.close();
  steps(g.game, 3);
  assert.equal(g.game.sessionByAccount(acc), null, 'ashore: her session retired');
  const shop = shopOf(g);
  const r = await shop.order({ name: 'Shore Sam', item: 'ammo_290', lang: 'ru' });
  assert.ok('orderId' in r, JSON.stringify(r));
  await shop.settleTest(r.orderId, true);
  assert.equal(shop.view(r.orderId)!.wait, 'login');
  shop.pump();
  assert.equal(shop.get(r.orderId)!.status, 'paid', 'still waiting for her');
  // she logs in again (her token, as a reload does)
  const again = new FakeConn();
  g.game.attach(again as unknown as WsConnection);
  again.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  const back = g.game.sessionByAccount(acc)!;
  assert.ok(back?.ship, 'she is back aboard');
  const round = back.ship!.ammo.round ?? 0;
  shop.pump();
  assert.equal(shop.get(r.orderId)!.status, 'done');
  assert.equal(back.ship!.ammo.round, round + (OFFERS.get('ammo_290')!.offer.grants[0] as { n: number }).n, 'the shot in her magazine');
  assert.deepEqual(rows(g, acc, 'doubloons_buy').map((x) => x.detail), [`shop:web:${r.orderId}`]);
  // the account's goods: an elixir for an account not aboard, at once
  const off = cap(g, 'Ashore Ann');
  const r2 = await shop.order({ name: 'Ashore Ann', item: 'xp_290', lang: 'ru' });
  assert.ok('orderId' in r2);
  await shop.settleTest(r2.orderId, true);
  assert.equal(shop.get(r2.orderId)!.status, 'done');
  assert.ok(shopState(g.game, off).xp > g.game.wallNow());
});

test('level gifts and the deal of the day: shut until her level, bought once, the deal once a day at its price', async () => {
  const g = makeGame();
  const acc = cap(g, 'Gift Gwen');
  const shop = shopOf(g);
  assert.equal(shop.unavailable(acc).lv20, 'level');
  assert.deepEqual(await shop.order({ name: 'Gift Gwen', item: 'lv20' }), { error: 'level' });
  shopState(g.game, acc).gifts[20] = g.game.wallNow();
  assert.equal(shop.unavailable(acc).lv20, undefined);
  const r = await shop.order({ name: 'Gift Gwen', item: 'lv20', lang: 'ru' });
  assert.ok('orderId' in r);
  await shop.settleTest(r.orderId, true);
  assert.equal(shop.get(r.orderId)!.status, 'done');
  assert.equal(shop.get(r.orderId)!.note, undefined);
  assert.equal(shop.unavailable(acc).lv20, 'claimed');
  // a hull above her level: shut, with the reason
  assert.equal(shop.unavailable(acc).ship_crimson_tide, 'level');
  // the deal of the day for a captain aboard (its goods may be her ship's)
  join(g.game, 'Deal Dora');
  const dora = g.game.sessionByName('Deal Dora')!.accountId;
  const d = dealOf(dayOf(g.game.wallNow()));
  const why = shop.unavailable(dora).deal;
  if (why) return assert.ok(['island', 'room', 'tier', 'none', 'slot', 'hold'].includes(why), why); // (today's deal is not for a new captain)
  const r2 = await shop.order({ name: 'Deal Dora', item: 'deal', lang: 'ru' });
  assert.ok('orderId' in r2, JSON.stringify(r2));
  const o = shop.get(r2.orderId)!;
  assert.equal(o.offer, d.offer.id);
  assert.equal(o.rub, d.price);
  await shop.settleTest(r2.orderId, true);
  assert.equal(shop.get(r2.orderId)!.status, 'done');
  assert.deepEqual(rows(g, dora, 'doubloons_buy').map((x) => [x.amount, x.detail]), [[-d.price, `shop:web:${r2.orderId}`]]);
  assert.equal(shop.unavailable(dora).deal, 'limit', 'once a day');
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
  const shop = new WebShop(g.game, { provider: null, returnUrl: '/site/shop/', payTest: true, hidden: (a, n) => rating.hidden(a, n), log: () => {}, pumpMs: 0 });
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
  const shop = new WebShop(g.game, { provider: yoo, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {}, pumpMs: 0 });
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
  for (const p of ['rating', 'shop', 'offer', 'terms', 'privacy', 'consent', 'cookies', 'refunds', 'contacts']) {
    assert.ok(existsSync(pjoin(SITE, p, 'index.html')), `ru ${p}`);
    assert.ok(existsSync(pjoin(SITE, 'en', p, 'index.html')), `en ${p}`);
  }
  for (const page of ['index.html', 'creatures/index.html', 'forum/index.html']) {
    const ru = readFileSync(pjoin(SITE, page), 'utf8'), en = readFileSync(pjoin(SITE, 'en', page), 'utf8');
    assert.match(ru, /href="\/site\/rating\/"[^>]*>.*?Рейтинг/s);
    assert.match(ru, /href="\/site\/shop\/"[^>]*>.*?Магазин/s);
    assert.match(en, /href="\/site\/en\/rating\/"[^>]*>.*?Rating/s);
    assert.match(en, /href="\/site\/en\/shop\/"[^>]*>.*?Shop/s);
    // every legal document in the footer, and the seller's details with the game's addresses
    for (const doc of ['offer', 'terms', 'privacy', 'consent', 'cookies', 'refunds', 'contacts']) {
      assert.match(ru, new RegExp(`href="/site/${doc}/"`));
      assert.match(en, new RegExp(`href="/site/en/${doc}/"`));
    }
    assert.match(ru, /ИП Спиридонов Дмитрий Вадимович · ИНН 760806658219 · ОГРНИП 324762700012347/);
    assert.match(ru, /info@gravetidegame\.com/);
    assert.match(en, /support@gravetidegame\.com/);
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
      assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/ЮKassa|YooKassa|СБП|mail@example\.com|[a-z]+@gravetidegame\.com/g, '')), `${page}.${k} is Russian: ${v}`);
    }
  }
  // the legal pages: the seller's details filled in, nothing left for the owner to fill
  const terms = readFileSync(pjoin(SITE, 'terms', 'index.html'), 'utf8');
  assert.equal((terms.match(/class="todo"/g) ?? []).length, 0);
  assert.match(terms, /760806658219/);
  assert.match(terms, /324762700012347/);
  for (const doc of ['offer', 'terms', 'privacy', 'consent', 'cookies', 'refunds', 'contacts']) for (const lang of ['', 'en']) {
    const html = readFileSync(pjoin(SITE, lang, doc, 'index.html'), 'utf8');
    assert.match(html, lang ? /Version of 20 October 2026/ : /Редакция от 20 октября 2026 года/, `${lang}/${doc}: dated`);
    assert.match(html, /support@gravetidegame\.com/, `${lang}/${doc}: the support address`);
    assert.ok(!/class="todo"|ВЛАДЕЛЕЦ|OWNER:/.test(html), `${lang}/${doc}: nothing left to fill in`);
  }
  assert.match(readFileSync(pjoin(SITE, 'shop', 'index.html'), 'utf8'), /Нажимая «Оплатить», вы принимаете <a href="\/site\/offer\/"/);
  assert.match(readFileSync(pjoin(SITE, 'en', 'shop', 'index.html'), 'utf8'), /By pressing «Pay» you accept the <a href="\/site\/en\/offer\/"/);
});
