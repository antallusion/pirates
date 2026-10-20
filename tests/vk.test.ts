// The VK Mini App on the server (owner, 2026-10-20: «надо сделать версию для вк»; docs/36_VK.md): the launch
// parameters' sign (good, forged, stale, another app's), the sign-in making a captain once and keeping her token, the
// votes' payments callback (its md5 sign, get_item, a chargeable order credited once however often VK repeats it, an
// unknown item, an unknown user, test orders), the routes without the secret, the prices in votes and their words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DOUBLOON_PACKS } from '../shared/src/data/premium.ts';
import { VOTE_RUB, packVotes, votesText, votesWord, vkPack } from '../shared/src/data/vk.ts';
import { VkService, checkLaunch, doubloonsTitle, paySig, signLaunch, vkFromEnv } from '../server/src/vk.ts';
import { handleVk } from '../server/src/http/vk-routes.ts';
import { EN as VK_EN, RU as VK_RU } from '../client/src/lang/ui/vk.ts';
import { makeGame } from './helpers.ts';

const SECRET = 'qa-secret-Zx9';
const APP = 51234567;
const T0 = 1_800_000_000_000;

function setup(o: { payTest?: boolean; admins?: number[] } = {}) {
  const { game, db } = makeGame();
  const now = { t: T0 };
  const logs: string[] = [];
  const vk = new VkService({ db, auth: game.auth, game, appId: APP, secret: SECRET, publicUrl: 'https://gravetidegame.com/', now: () => now.t, log: (l) => logs.push(l), ...o });
  return { game, db, vk, now, logs };
}

/** The launch parameters as VK appends them to the app's address, signed with the secret (or another). */
function launch(user: number, ts = Math.floor(T0 / 1000) - 60, o: { secret?: string; app?: number; extra?: Record<string, string> } = {}): string {
  const p: Record<string, string> = {
    vk_access_token_settings: 'friends,photos', vk_app_id: String(o.app ?? APP), vk_are_notifications_enabled: '0', vk_is_app_user: '1',
    vk_is_favorite: '0', vk_language: 'ru', vk_platform: 'mobile_android', vk_ref: 'other', vk_ts: String(ts), vk_user_id: String(user), ...o.extra,
  };
  return '?' + new URLSearchParams({ ...p, sign: signLaunch(p, o.secret ?? SECRET) }).toString();
}

/** A payments callback's form, signed with the secret. */
function form(p: Record<string, string>, secret = SECRET): Record<string, string> {
  return { ...p, sig: paySig(p, secret) };
}

const order = (user: number, id: string, item = 'd290', extra: Record<string, string> = {}) => form({
  app_id: String(APP), date: '1800000000', item, item_id: item, item_price: String(packVotes(vkPack(item)!)), lang: 'ru_RU', notification_type: 'order_status_change',
  order_id: id, receiver_id: String(user), status: 'chargeable', user_id: String(user), version: '3', ...extra,
});

// ------------------------------------------------------------------------------------------------ the launch

test('launch parameters: a good sign passes; forged, stale, from the future, another app\'s or another secret\'s do not', () => {
  const now = Math.floor(T0 / 1000);
  const good = launch(777);
  const v = checkLaunch(good, SECRET, APP, now);
  assert.ok(v);
  assert.equal(v.userId, 777);
  assert.equal(v.appId, APP);
  assert.equal(v.platform, 'mobile_android');
  // the sign is base64url without the padding, over the vk_* pairs only (our own `vk` and a hash do not count)
  assert.match(new URLSearchParams(good).get('sign')!, /^[\w-]{43}$/);
  assert.ok(checkLaunch(good.slice(1) + '&vk&x=1#ref', SECRET, APP, now), 'a non-vk_ param and a hash change nothing');
  // forged: another user swapped in after signing
  assert.equal(checkLaunch(good.replace('vk_user_id=777', 'vk_user_id=778'), SECRET, APP, now), null);
  assert.equal(checkLaunch(launch(777, now - 60, { secret: 'other' }), SECRET, APP, now), null);
  assert.equal(checkLaunch(good.replace(/sign=[^&]+/, 'sign='), SECRET, APP, now), null);
  // stale: older than three days; from the future
  assert.ok(checkLaunch(launch(777, now - 3 * 86400 + 10), SECRET, APP, now));
  assert.equal(checkLaunch(launch(777, now - 3 * 86400 - 10), SECRET, APP, now), null);
  assert.equal(checkLaunch(launch(777, now + 3600), SECRET, APP, now), null);
  // another app's launch, and a bad user
  assert.equal(checkLaunch(launch(777, now - 60, { app: 999 }), SECRET, APP, now), null);
  assert.equal(checkLaunch(launch(0), SECRET, APP, now), null);
  assert.equal(checkLaunch('', SECRET, APP, now), null);
  assert.equal(checkLaunch(good, '', APP, now), null);
  // a value with characters VK encodes (a comma, a space) signs as VK does: key=encodeURIComponent(value)
  assert.ok(checkLaunch(launch(5, now - 5, { extra: { vk_ref: 'catalog recommendation' } }), SECRET, APP, now));
});

test('the sign-in makes a captain once, named from VK, and keeps her token; a bad launch is refused', () => {
  const { vk, db } = setup();
  const a = vk.launch(launch(1001), 'Аня');
  assert.ok(!('error' in a));
  assert.equal(a.name, 'Аня');
  assert.equal(db.accountByOAuth('vk', '1001')?.id, a.accountId);
  // again: the same captain; with her own token the token is kept
  const b = vk.launch(launch(1001), 'Аня');
  assert.ok(!('error' in b));
  assert.equal(b.accountId, a.accountId);
  const c = vk.launch(launch(1001), 'Аня', b.token); // (b's sign-in issued a new token: the account keeps one)
  assert.ok(!('error' in c));
  assert.equal(c.token, b.token);
  // another VK user with the same first name: a captain of her own, the name made unique
  const d = vk.launch(launch(1002), 'Аня');
  assert.ok(!('error' in d));
  assert.notEqual(d.accountId, a.accountId);
  assert.notEqual(d.name, a.name);
  // no name (or one too short): «Капитан»
  const e = vk.launch(launch(1003));
  assert.ok(!('error' in e));
  assert.match(e.name, /^Капитан/);
  const f = vk.launch(launch(1004), 'Ян');
  assert.ok(!('error' in f));
  assert.match(f.name, /^Капитан/);
  // a token of another account is not kept: the VK user's own captain
  const g = vk.launch(launch(1001), '', d.token);
  assert.ok(!('error' in g));
  assert.equal(g.accountId, a.accountId);
  assert.deepEqual(vk.launch(launch(1001).replace('1001', '1009'), 'X'), { error: 'VK sign-in failed: open the game from VK again.' });
});

// ------------------------------------------------------------------------------------------------ the payments

test('payments: get_item names each pack in votes with its picture; an unknown item is error 20; a bad sig is error 10', () => {
  const { vk } = setup();
  for (const p of DOUBLOON_PACKS) {
    const r = vk.pay(form({ app_id: String(APP), item: p.id, lang: 'ru_RU', notification_type: 'get_item', order_id: '1', receiver_id: '5', user_id: '5' }));
    assert.ok('response' in r, p.id);
    assert.equal(r.response.item_id, p.id);
    assert.equal(r.response.price, packVotes(p));
    assert.equal(r.response.price, Math.round(p.n / VOTE_RUB));
    assert.equal(r.response.photo_url, 'https://gravetidegame.com/vk-doubloon.png');
    assert.equal(r.response.expiration, 0);
    assert.match(String(r.response.title), /^[\d ]+ дублон(а|ов)?$/);
  }
  const t = vk.pay(form({ item: 'd290', lang: 'ru_RU', notification_type: 'get_item_test', order_id: '1', user_id: '5' }));
  assert.ok('response' in t);
  assert.equal(t.response.title, '290 дублонов');
  const en = vk.pay(form({ item: 'd1990', lang: 'en_US', notification_type: 'get_item', order_id: '1', user_id: '5' }));
  assert.ok('response' in en);
  assert.equal(en.response.title, '2 390 doubloons');
  assert.deepEqual(vk.pay(form({ item: 'd1', notification_type: 'get_item', user_id: '5' })), { error: { error_code: 20, error_msg: 'Item not found', critical: true } });
  // the sign: forged, missing, signed by another secret
  const good = form({ item: 'd290', notification_type: 'get_item', user_id: '5' });
  assert.deepEqual(vk.pay({ ...good, item: 'd9900' }), { error: { error_code: 10, error_msg: 'Bad signature', critical: true } });
  assert.equal('error' in vk.pay({ item: 'd290', notification_type: 'get_item' }) && 10, 10);
  assert.ok('error' in vk.pay(form({ item: 'd290', notification_type: 'get_item' }, 'nope')));
  assert.equal(doubloonsTitle(1, 'ru'), '1 дублон');
  assert.equal(doubloonsTitle(2, 'ru'), '2 дублона');
  assert.equal(doubloonsTitle(11, 'ru'), '11 дублонов');
  assert.equal(doubloonsTitle(13900, 'ru'), '13 900 дублонов');
});

test('payments: a chargeable order credits the pack once however often VK repeats it; unknown user is error 22', () => {
  const { vk, game, db, logs } = setup();
  const a = vk.launch(launch(2001), 'Мэри');
  assert.ok(!('error' in a));
  const before = db.doubloons(a.accountId);
  const pack = vkPack('d590')!;
  const r1 = vk.pay(order(2001, '9001', 'd590'));
  assert.ok('response' in r1);
  assert.equal(r1.response.order_id, 9001);
  assert.ok(Number(r1.response.app_order_id) > 0);
  assert.equal(db.doubloons(a.accountId), before + pack.n + pack.bonus);
  // VK repeats itself: the same answer, nothing more credited
  const r2 = vk.pay(order(2001, '9001', 'd590'));
  assert.deepEqual(r2, r1);
  assert.equal(db.doubloons(a.accountId), before + pack.n + pack.bonus);
  // a second order: its own app_order_id
  const r3 = vk.pay(order(2001, '9002', 'd290'));
  assert.ok('response' in r3);
  assert.notEqual(r3.response.app_order_id, r1.response.app_order_id);
  assert.equal(db.doubloons(a.accountId), before + pack.n + pack.bonus + 290);
  assert.ok(logs.some((l) => /\[vk\] paid: account \d+, d590, 84 votes, order 9001/.test(l)));
  // an unknown user, item, a price below the pack's, a status not chargeable, a bad order id
  assert.deepEqual(vk.pay(order(2999, '9003')), { error: { error_code: 22, error_msg: 'User not found', critical: true } });
  assert.equal(db.getKv('vkpay:9003'), undefined);
  assert.equal((vk.pay(order(2001, '9004', 'd290', { item: 'd7' })) as { error: { error_code: number } }).error.error_code, 20);
  assert.equal((vk.pay(order(2001, '9005', 'd290', { item_price: '1' })) as { error: { error_code: number } }).error.error_code, 11);
  assert.equal((vk.pay(order(2001, '9006', 'd290', { status: 'refunded' })) as { error: { error_code: number } }).error.error_code, 100);
  assert.equal((vk.pay(order(2001, 'x', 'd290')) as { error: { error_code: number } }).error.error_code, 11);
  // the ledger's references
  assert.ok(game.db.doubloonRef(a.accountId, 'doubloons_pay', 'vk:9001'));
});

test('payments: test orders are credited only with VK_PAY_TEST or to an admin, under their own keys', () => {
  const off = setup();
  const a = off.vk.launch(launch(3001), 'Тест');
  assert.ok(!('error' in a));
  const t = order(3001, '42', 'd290', { notification_type: 'order_status_change_test' });
  assert.deepEqual(off.vk.pay(t), { error: { error_code: 101, error_msg: 'Test payments are not credited on this server', critical: true } });
  assert.equal(off.db.doubloons(a.accountId), 0);
  const on = setup({ payTest: true });
  const b = on.vk.launch(launch(3001), 'Тест');
  assert.ok(!('error' in b));
  assert.ok('response' in on.vk.pay(t));
  assert.equal(on.db.doubloons(b.accountId), 290);
  assert.ok(on.db.getKv('vkpay:test:42'));
  assert.equal(on.db.getKv('vkpay:42'), undefined);
  assert.ok(on.game.db.doubloonRef(b.accountId, 'doubloons_pay', 'vktest:42'));
  const adm = setup({ admins: [3001] });
  const c = adm.vk.launch(launch(3001), 'Тест');
  assert.ok(!('error' in c));
  assert.ok('response' in adm.vk.pay(t));
  assert.equal(adm.db.doubloons(c.accountId), 290);
});

// ------------------------------------------------------------------------------------------------ the routes

async function serve(vk: VkService | null): Promise<{ url: string; close: () => void }> {
  const srv = createServer((req, res) => void handleVk(req, res, vk).then((h) => h || res.writeHead(418).end()));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, close: () => srv.close() };
}

test('routes: without the secret only the config answers («off»); with it the launch and the form-encoded callback', async () => {
  const none = await serve(null);
  try {
    assert.deepEqual(await (await fetch(`${none.url}/auth/vk/config`)).json(), { enabled: false });
    assert.equal((await fetch(`${none.url}/auth/vk/launch`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${none.url}/vk/pay`, { method: 'POST', body: '' })).status, 404);
    assert.equal((await fetch(`${none.url}/auth/other`)).status, 418, 'not a VK route');
  } finally {
    none.close();
  }
  { const g = makeGame(); assert.equal(vkFromEnv({ db: g.db, auth: g.game.auth, game: g.game, publicUrl: 'x' }, {}), null); }
  const { vk, db } = setup();
  const s = await serve(vk);
  try {
    assert.deepEqual(await (await fetch(`${s.url}/auth/vk/config`)).json(), { enabled: true, appId: APP, pay: true });
    const r = await fetch(`${s.url}/auth/vk/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ launch: launch(4001), name: 'Анна' }) });
    assert.equal(r.status, 200);
    const j = (await r.json()) as { token: string; accountId: number; name: string };
    assert.equal(j.name, 'Анна');
    assert.equal((await fetch(`${s.url}/auth/vk/launch`, { method: 'POST', body: JSON.stringify({ launch: '?vk_user_id=1&sign=x' }) })).status, 401);
    const body = new URLSearchParams(order(4001, '777', 'd990')).toString();
    const p = await fetch(`${s.url}/vk/pay`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    assert.equal(p.status, 200);
    assert.match(String(p.headers.get('content-type')), /application\/json/);
    assert.deepEqual(await p.json(), { response: { order_id: 777, app_order_id: 1 } });
    assert.equal(db.doubloons(j.accountId), 990 + vkPack('d990')!.bonus);
    const bad = await fetch(`${s.url}/vk/pay`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.replace('sig=', 'sig=0') });
    assert.equal(bad.status, 200);
    assert.equal(((await bad.json()) as { error: { error_code: number } }).error.error_code, 10);
  } finally {
    s.close();
  }
});

// ------------------------------------------------------------------------------------------------ the words

test('votes: the packs\' prices and the Russian plurals; the VK screen words in both languages, Russian in Cyrillic', () => {
  assert.deepEqual(DOUBLOON_PACKS.map(packVotes), [41, 84, 141, 284, 713, 1414]);
  assert.equal(votesText(1, 'ru'), '1 голос');
  assert.equal(votesText(2, 'ru'), '2 голоса');
  assert.equal(votesText(5, 'ru'), '5 голосов');
  assert.equal(votesText(11, 'ru'), '11 голосов');
  assert.equal(votesText(21, 'ru'), '21 голос');
  assert.equal(votesText(41, 'ru'), '41 голос');
  assert.equal(votesText(84, 'ru'), '84 голоса');
  assert.equal(votesText(112, 'ru'), '112 голосов');
  assert.equal(votesWord(1, 'en'), 'vote');
  assert.equal(votesText(141, 'en'), '141 votes');
  assert.deepEqual(Object.keys(VK_RU).sort(), Object.keys(VK_EN).sort());
  for (const [k, v] of Object.entries(VK_RU)) assert.doesNotMatch(v, /[A-Za-z]/, `RU ${k}: ${v}`);
});
