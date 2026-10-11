// Telegram (owner, 2026-10-11: «сделай мне еще телеграм версию на поддомене tg … премиум шоп сделай звездами …
// подключаться … через телеграм»; docs/27_TELEGRAM.md) against a fake Bot API: the Mini App's initData (good, tampered,
// stale), the deep-link sign-in (a nonce used once, its expiry, the poll), linking an account, the webhook's secret,
// the pre-checkout's checks, a payment credited once however often Telegram repeats it, the refund — and without the
// bot's token no Telegram at all: every route a 404, the shop's top-up shut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DOUBLOON_PACKS } from '../shared/src/data/premium.ts';
import { TG_TEXTS, tgLang, tgText } from '../shared/src/data/telegram.ts';
import { premiumView } from '../server/src/game/premium.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import type { Game } from '../server/src/game/Game.ts';
import { handleTelegram } from '../server/src/http/tg-routes.ts';
import { TelegramService, checkInitData, fakeBotApi, signInitData, telegramFromEnv, webhookSecret } from '../server/src/telegram.ts';
import type { TgUpdate } from '../server/src/telegram.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { EN as TG_EN, RU as TG_RU } from '../client/src/lang/ui/tg.ts';
import { extract } from '../tools/i18n-server.ts';
import { join, makeGame } from './helpers.ts';

const TOKEN = '123456:TEST-token_for-the-fake-bot';

/** initData as Telegram would hand it to the Mini App, signed with the test token (or another). */
function initData(user: Record<string, unknown>, authDate: number, token = TOKEN, extra: Record<string, string> = {}): string {
  const fields: Record<string, string> = { auth_date: String(authDate), query_id: 'AAHdF6IQAAAAAN0XohDhrOrc', user: JSON.stringify(user), ...extra };
  return new URLSearchParams({ ...fields, hash: signInitData(fields, token) }).toString();
}

function setup(now = { t: 1_800_000_000_000 }) {
  const { game, db } = makeGame();
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const tg = new TelegramService({ db, auth: game.auth, game, token: TOKEN, fetch: fakeBotApi(calls), publicUrl: 'https://gravetidegame.com', webappUrl: 'https://tg.gravetidegame.com', now: () => now.t, log: () => {}, admins: [777] });
  return { game, db, tg, calls, now };
}

const nowS = (now: { t: number }) => Math.floor(now.t / 1000);
const anne = { id: 4242, first_name: 'Anne', last_name: 'Bonny', username: 'anne_b', language_code: 'ru' };
const msg = (from: typeof anne, text: string): TgUpdate => ({ update_id: 1, message: { message_id: 1, from, chat: { id: from.id, type: 'private' }, text } });
const said = (calls: { method: string; params: Record<string, unknown> }[]) => calls.filter((c) => c.method === 'sendMessage').map((c) => String(c.params.text));

function accountOf(game: Game, name: string): number {
  const s = [...game.sessions].find((x) => x.name === name)!;
  return s.accountId;
}

// ------------------------------------------------------------------------------------------------ initData

test('initData: a good one passes, a tampered or stale one or one signed by another token does not', () => {
  const now = 1_800_000_000;
  const good = initData(anne, now - 60);
  const v = checkInitData(good, TOKEN, now);
  assert.ok(v);
  assert.equal(v.user.id, 4242);
  assert.equal(v.user.first_name, 'Anne');
  // tampered: the user swapped after signing
  const p = new URLSearchParams(good);
  p.set('user', JSON.stringify({ ...anne, id: 1 }));
  assert.equal(checkInitData(p.toString(), TOKEN, now), null, 'tampered');
  assert.equal(checkInitData(good.replace(/hash=[0-9a-f]{4}/, 'hash=0000'), TOKEN, now), null, 'a hash changed');
  assert.equal(checkInitData(initData(anne, now - 86_401), TOKEN, now), null, 'older than a day');
  assert.ok(checkInitData(initData(anne, now - 86_000), TOKEN, now), 'within the day');
  assert.equal(checkInitData(initData(anne, now + 3600), TOKEN, now), null, 'from the future');
  assert.equal(checkInitData(initData(anne, now, '999:other'), TOKEN, now), null, 'another bot');
  assert.equal(checkInitData('', TOKEN, now), null);
  assert.equal(checkInitData('user=x&hash=zz', TOKEN, now), null);
  assert.equal(checkInitData(good, '', now), null, 'no token, no sign-in');
  // Bot API 8: a `signature` field in the data, inside the check string or outside it
  assert.ok(checkInitData(initData(anne, now, TOKEN, { signature: 'c2lnbmF0dXJl' }), TOKEN, now));
  const fields = { auth_date: String(now), user: JSON.stringify(anne) };
  const outside = new URLSearchParams({ ...fields, signature: 'c2ln', hash: signInitData(fields, TOKEN) }).toString();
  assert.ok(checkInitData(outside, TOKEN, now));
});

test('the Mini App signs in: a new captain named from the first name (made unique), the same account after, its token kept', () => {
  const { tg, db, game, now } = setup();
  game.auth.register('Anne');
  const r = tg.webappLogin(initData(anne, nowS(now)));
  assert.ok(!('error' in r));
  assert.equal(r.name, 'Anne 2', 'made unique');
  assert.equal(db.accountByOAuth('telegram', '4242')?.id, r.accountId);
  const again = tg.webappLogin(initData(anne, nowS(now)), r.token);
  assert.ok(!('error' in again));
  assert.equal(again.accountId, r.accountId);
  assert.equal(again.token, r.token, 'the page\'s own token is kept (no other tab thrown out)');
  const fresh = tg.webappLogin(initData(anne, nowS(now)));
  assert.ok(!('error' in fresh) && fresh.accountId === r.accountId && fresh.token !== r.token);
  assert.ok('error' in tg.webappLogin(initData(anne, nowS(now) - 90_000)), 'stale');
  // an emoji for a name: a plain captain's name
  const odd = tg.webappLogin(initData({ id: 9, first_name: '🦜🦜' }, nowS(now)));
  assert.ok(!('error' in odd) && /^Captain/.test(odd.name));
});

// ------------------------------------------------------------------------------------------------ the deep link

test('«Войти через Телеграм»: a nonce, the bot binds it, the poll returns the token once; it expires in ten minutes', async () => {
  const { tg, calls, now } = setup();
  const s = tg.start('1.2.3.4');
  assert.ok(!('error' in s));
  assert.match(s.link, /^https:\/\/t\.me\/gravetide_bot\?start=login_[\w-]{20,}$/);
  assert.deepEqual(tg.poll(s.nonce, '1.2.3.4'), { status: 'wait' });
  await tg.handleUpdate(msg(anne, `/start login_${s.nonce}`));
  assert.equal(said(calls).at(-1), tgText('loginDone', 'ru'));
  assert.match(said(calls).at(-1)!, /Готово, вернитесь в игру/);
  const done = tg.poll(s.nonce, '1.2.3.4');
  assert.equal(done.status, 'done');
  assert.ok('token' in done && done.token.length > 20 && done.name === 'Anne');
  assert.deepEqual(tg.poll(s.nonce, '1.2.3.4'), { status: 'expired' }, 'the token is given once');
  // the same link sent again to the bot: refused
  await tg.handleUpdate(msg(anne, `/start login_${s.nonce}`));
  assert.equal(said(calls).at(-1), tgText('loginExpired', 'ru'));
  // expiry: ten minutes
  const late = tg.start('1.2.3.4');
  assert.ok(!('error' in late));
  now.t += 10 * 60_000 + 1;
  assert.deepEqual(tg.poll(late.nonce, '1.2.3.4'), { status: 'expired' });
  await tg.handleUpdate(msg({ ...anne, language_code: 'en' }, `/start login_${late.nonce}`));
  assert.equal(said(calls).at(-1), tgText('loginExpired', 'en'));
  assert.deepEqual(tg.poll('nonsense', '1.2.3.4'), { status: 'expired' });
});

test('the deep link is rate-limited per address: ten nonces in ten minutes, the poll ninety a minute', () => {
  const { tg, now } = setup();
  for (let i = 0; i < 10; i++) assert.ok(!('error' in tg.start('5.5.5.5')));
  const r = tg.start('5.5.5.5');
  assert.ok('error' in r && r.status === 429);
  assert.ok(!('error' in tg.start('6.6.6.6')), 'another address has its own');
  now.t += 10 * 60_000 + 1;
  assert.ok(!('error' in tg.start('5.5.5.5')), 'the window passes');
  let refused = 0;
  for (let i = 0; i < 100; i++) if ('error' in tg.poll('x', '7.7.7.7')) refused++;
  assert.equal(refused, 10);
});

test('«Привязать Телеграм»: an account links its Telegram; a Telegram of another captain is refused; it adds an e-mail later', async () => {
  const { tg, game, db, calls, now } = setup();
  const g = game.auth.register('Mary Read') as { accountId: number; token: string };
  assert.equal(tg.linkedFor(g.token), false);
  assert.ok('error' in tg.start('1.1.1.1', 'not-a-token-of-anyone-here'));
  const s = tg.start('1.1.1.1', g.token);
  assert.ok(!('error' in s));
  await tg.handleUpdate(msg(anne, `/start login_${s.nonce}`));
  assert.match(said(calls).at(-1)!, /Mary Read/);
  assert.deepEqual(tg.poll(s.nonce, '1.1.1.1'), { status: 'linked', name: 'Mary Read' });
  assert.equal(db.accountByOAuth('telegram', '4242')?.id, g.accountId);
  assert.equal(tg.linkedFor(g.token), true);
  // the Mini App now opens that captain
  const w = tg.webappLogin(initData(anne, nowS(now)));
  assert.ok(!('error' in w) && w.accountId === g.accountId);
  // another account tries to take the same Telegram
  const h = game.auth.register('Jack Rackham') as { accountId: number; token: string };
  const s2 = tg.start('1.1.1.1', h.token);
  assert.ok(!('error' in s2));
  await tg.handleUpdate(msg(anne, `/start login_${s2.nonce}`));
  assert.equal(said(calls).at(-1), tgText('linkTaken', 'ru', { name: 'Mary Read' }));
  assert.deepEqual(tg.poll(s2.nonce, '1.1.1.1'), { status: 'taken' });
  assert.equal(db.accountByOAuth('telegram', '4242')?.id, g.accountId, 'still Mary\'s');
  // a Telegram-made captain adds an e-mail by the claim flow
  const fresh = tg.start('2.2.2.2');
  assert.ok(!('error' in fresh));
  const bob = { id: 5151, first_name: 'Bob', language_code: 'en' };
  await tg.handleUpdate(msg(bob as typeof anne, `/start login_${fresh.nonce}`));
  const done = tg.poll(fresh.nonce, '2.2.2.2');
  assert.ok(done.status === 'done' && 'token' in done);
  const c = await game.auth.claim(done.token, 'bob@sea.org', 'windward-9');
  assert.ok(!('error' in c));
  assert.equal(db.accountById(done.accountId)?.email, 'bob@sea.org');
});

test('the bot: /start greets with the «Играть» web_app button, /paysupport and /terms answer in the user\'s language', async () => {
  const { tg, calls } = setup();
  await tg.handleUpdate(msg(anne, '/start'));
  const hello = calls.at(-1)!;
  assert.equal(hello.method, 'sendMessage');
  assert.match(String(hello.params.text), /Привет, Anne/);
  const kb = (hello.params.reply_markup as { inline_keyboard: { text: string; web_app: { url: string } }[][] }).inline_keyboard[0][0];
  assert.deepEqual(kb, { text: 'Играть', web_app: { url: 'https://tg.gravetidegame.com' } });
  await tg.handleUpdate(msg({ ...anne, language_code: 'en' }, '/paysupport'));
  assert.equal(said(calls).at(-1), TG_TEXTS.paysupport[0]);
  await tg.handleUpdate(msg(anne, '/terms'));
  assert.equal(said(calls).at(-1), TG_TEXTS.terms[1]);
  await tg.handleUpdate(msg(anne, '/refund abc'));
  assert.equal(said(calls).at(-1), TG_TEXTS.help[1], 'the refund is the admins\' only');
  // groups are not answered
  const n = calls.length;
  await tg.handleUpdate({ message: { from: anne, chat: { id: -5, type: 'group' }, text: '/start' } });
  assert.equal(calls.length, n);
  assert.equal(tgLang('uk'), 'ru');
  assert.equal(tgLang('de'), 'en');
  assert.equal(tgLang(undefined), 'en');
});

test('setup sets the webhook to <PUBLIC_URL>/tg/webhook with its secret, the menu button «Играть» → the Mini App, the commands', async () => {
  const { tg, calls } = setup();
  await tg.setup();
  const hook = calls.find((c) => c.method === 'setWebhook')!;
  assert.equal(hook.params.url, 'https://gravetidegame.com/tg/webhook');
  assert.deepEqual(hook.params.allowed_updates, ['message', 'pre_checkout_query']);
  assert.equal(hook.params.secret_token, webhookSecret(TOKEN));
  assert.match(String(hook.params.secret_token), /^[0-9a-f]{64}$/);
  assert.equal(webhookSecret(TOKEN, 'my-own_secret'), 'my-own_secret');
  const menu = calls.find((c) => c.method === 'setChatMenuButton')!;
  assert.deepEqual(menu.params.menu_button, { type: 'web_app', text: 'Играть', web_app: { url: 'https://tg.gravetidegame.com' } });
  assert.equal(calls.filter((c) => c.method === 'setMyCommands').length, 2);
});

// ------------------------------------------------------------------------------------------------ Stars

test('every pack has a price in Stars, the dearer the larger; the shop opens with the desk, the invoice is XTR without a provider token', async () => {
  for (const p of DOUBLOON_PACKS) assert.ok(Number.isInteger(p.stars) && p.stars > 0, p.id);
  for (let i = 1; i < DOUBLOON_PACKS.length; i++) assert.ok(DOUBLOON_PACKS[i].stars > DOUBLOON_PACKS[i - 1].stars);
  const { game, calls } = setup();
  const conn = join(game, 'Grace');
  const s = [...game.sessions].find((x) => x.name === 'Grace')!;
  assert.equal(premiumView(game, s).pay, true, 'the desk opens the top-up');
  conn.push({ t: 'premium', action: 'stars', pack: 'd550', lang: 'ru' });
  await new Promise((r) => setTimeout(r, 10));
  const inv = conn.last('premium_invoice')!;
  assert.equal(inv.pack, 'd550');
  assert.match(inv.link!, /^https:\/\/t\.me\/\$fake-invoice/);
  const c = calls.find((x) => x.method === 'createInvoiceLink')!;
  assert.equal(c.params.currency, 'XTR');
  assert.equal(c.params.provider_token, '');
  assert.deepEqual((c.params.prices as { amount: number }[]).map((x) => x.amount), [375]);
  assert.match(String(c.params.payload), new RegExp(`^${s.accountId}:d550:[\\w-]+$`));
  assert.match(String(c.params.title), /550 дублонов/);
  conn.push({ t: 'premium', action: 'stars', pack: 'nope' });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(conn.last('premium_invoice')!.link, null);
  assert.ok(conn.all('toast').some((t) => t.msg === 'The invoice could not be made. Try again in a minute.'));
});

test('pre-checkout: the account, the pack and its price checked — anything else is refused with a reason', async () => {
  const { game, tg, calls } = setup();
  join(game, 'Grace');
  const acc = accountOf(game, 'Grace');
  const ask = async (payload: string, total: number, currency = 'XTR') => {
    await tg.handleUpdate({ pre_checkout_query: { id: `q${calls.length}`, from: anne, currency, total_amount: total, invoice_payload: payload } });
    return calls.at(-1)!;
  };
  const ok = await ask(TelegramService.payload(acc, 'd100'), 75);
  assert.equal(ok.method, 'answerPreCheckoutQuery');
  assert.equal(ok.params.ok, true);
  for (const [payload, total, cur] of [[TelegramService.payload(acc, 'd100'), 74, 'XTR'], [TelegramService.payload(acc, 'd999'), 75, 'XTR'], [TelegramService.payload(99_999, 'd100'), 75, 'XTR'], [TelegramService.payload(acc, 'd100'), 75, 'USD'], ['garbage', 75, 'XTR']] as [string, number, string][]) {
    const r = await ask(payload, total, cur);
    assert.equal(r.params.ok, false, `${payload} ${total} ${cur}`);
    assert.equal(r.params.error_message, tgText('badPayment', 'ru'));
  }
});

test('successful_payment credits the pack once per charge id — the same charge twice credits once — pushed to the captain, written to the ledger', async () => {
  const { game, db, tg, calls } = setup();
  const conn = join(game, 'Grace');
  const acc = accountOf(game, 'Grace');
  const pay = (charge: string, pack = 'd1200', stars = 750): TgUpdate => ({ message: { from: anne, chat: { id: anne.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: stars, invoice_payload: TelegramService.payload(acc, pack), telegram_payment_charge_id: charge } } });
  await tg.handleUpdate(pay('charge-1'));
  assert.equal(db.doubloons(acc), 1200);
  await tg.handleUpdate(pay('charge-1'));
  await tg.handleUpdate(pay('charge-1'));
  assert.equal(db.doubloons(acc), 1200, 'credited once');
  assert.equal(conn.last('doubloons')!.n, 1200, 'the balance pushed');
  assert.equal(conn.last('premium')!.view.balance, 1200, 'the shop refreshed');
  assert.ok(db.doubloonRef(acc, 'doubloons_pay', 'tg:charge-1'), 'the ledger row');
  assert.deepEqual(db.getKv('tgpay:charge-1'), { account: acc, user: 4242, pack: 'd1200', stars: 750, n: 1200, at: 1_800_000_000_000, refunded: false });
  assert.match(said(calls).at(-1)!, /Grace/);
  assert.equal(said(calls).filter((t) => /Grace/.test(t)).length, 1, 'thanked once');
  await tg.handleUpdate(pay('charge-2', 'd100', 75));
  assert.equal(db.doubloons(acc), 1300);
  // a payment in another currency or for a pack no longer there credits nothing
  await tg.handleUpdate(pay('charge-3', 'd404', 75));
  assert.equal(db.doubloons(acc), 1300);
});

test('a refund: refundStarPayment to the payer, the doubloons taken back as far as the balance goes, once; also by the admin\'s /refund', async () => {
  const { game, db, tg, calls } = setup();
  const conn = join(game, 'Grace');
  const acc = accountOf(game, 'Grace');
  await tg.handleUpdate({ message: { from: anne, chat: { id: anne.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: 375, invoice_payload: TelegramService.payload(acc, 'd550'), telegram_payment_charge_id: 'ch-9' } } });
  assert.equal(db.doubloons(acc), 550);
  db.addDoubloons(acc, -200); // some spent
  const r = await tg.refund('ch-9');
  assert.equal(r, 'Refunded 375 stars for payment ch-9; 350 of 550 doubloons taken back.');
  const call = calls.find((c) => c.method === 'refundStarPayment')!;
  assert.deepEqual(call.params, { user_id: 4242, telegram_payment_charge_id: 'ch-9' });
  assert.equal(db.doubloons(acc), 0);
  assert.equal(await tg.refund('ch-9'), 'Payment ch-9 was refunded already.');
  assert.equal(await tg.refund('nope'), 'No Stars payment nope on record.');
  // Telegram's own refunded_payment notice takes back once too
  await tg.handleUpdate({ message: { from: anne, chat: { id: anne.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: 75, invoice_payload: TelegramService.payload(acc, 'd100'), telegram_payment_charge_id: 'ch-10' } } });
  await tg.handleUpdate({ message: { from: anne, chat: { id: anne.id, type: 'private' }, refunded_payment: { currency: 'XTR', total_amount: 75, invoice_payload: '', telegram_payment_charge_id: 'ch-10' } } });
  assert.equal(db.doubloons(acc), 0);
  // the admin's console
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const s = [...game.sessions].find((x) => x.name === 'Grace')!;
    assert.equal(runAdmin(game, s, '/refund'), 'Usage: /refund charge_id');
    await tg.handleUpdate({ message: { from: anne, chat: { id: anne.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: 75, invoice_payload: TelegramService.payload(acc, 'd100'), telegram_payment_charge_id: 'ch-11' } } });
    assert.equal(runAdmin(game, s, '/refund ch-11'), 'Refund asked for payment ch-11.');
    await new Promise((r2) => setTimeout(r2, 10));
    assert.ok(conn.all('toast').some((t) => t.msg === 'Refunded 75 stars for payment ch-11; 100 of 100 doubloons taken back.'));
    // the bot's /refund for the admins of TELEGRAM_ADMIN_IDS
    await tg.handleUpdate({ message: { from: anne, chat: { id: anne.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: 75, invoice_payload: TelegramService.payload(acc, 'd100'), telegram_payment_charge_id: 'ch-12' } } });
    await tg.handleUpdate(msg({ ...anne, id: 777, language_code: 'en' }, '/refund ch-12'));
    assert.match(said(calls).at(-1)!, /^Refunded 75 stars for payment ch-12/);
  } finally {
    delete process.env.GRAVETIDE_ADMIN;
  }
});

// ------------------------------------------------------------------------------------------------ HTTP

async function serve(tg: TelegramService | null) {
  const server = createServer(async (req, res) => {
    if (await handleTelegram(req, res, tg)) return;
    res.writeHead(418).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test('the webhook takes only requests with the secret header; the routes answer over HTTP', async () => {
  const { tg, calls } = setup();
  const { base, close } = await serve(tg);
  try {
    const body = JSON.stringify(msg(anne, '/start'));
    assert.equal((await fetch(`${base}/tg/webhook`, { method: 'POST', body })).status, 401, 'no header');
    assert.equal((await fetch(`${base}/tg/webhook`, { method: 'POST', body, headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' } })).status, 401, 'a wrong one');
    assert.equal(calls.length, 0, 'nothing handled');
    const ok = await fetch(`${base}/tg/webhook`, { method: 'POST', body, headers: { 'X-Telegram-Bot-Api-Secret-Token': webhookSecret(TOKEN) } });
    assert.equal(ok.status, 200);
    assert.equal(calls.at(-1)!.method, 'sendMessage');
    assert.equal((await fetch(`${base}/tg/webhook`)).status, 405);
    const cfg = (await (await fetch(`${base}/auth/tg/config`)).json()) as Record<string, unknown>;
    assert.deepEqual(cfg, { enabled: true, bot: 'gravetide_bot', webapp: 'https://tg.gravetidegame.com' });
    const st = (await (await fetch(`${base}/auth/tg/start`, { method: 'POST', body: '{}' })).json()) as { nonce: string; link: string };
    assert.match(st.link, /start=login_/);
    assert.deepEqual(await (await fetch(`${base}/auth/tg/poll?nonce=${st.nonce}`)).json(), { status: 'wait' });
    const bad = await fetch(`${base}/auth/tg/webapp`, { method: 'POST', body: JSON.stringify({ initData: 'user=1&hash=00' }) });
    assert.equal(bad.status, 401);
    assert.equal((await fetch(`${base}/auth/tg/linked`, { method: 'POST', body: '{"token":"x"}' })).status, 400);
    assert.equal((await fetch(`${base}/auth/tg/nothing`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${base}/elsewhere`)).status, 418, 'other paths are not taken');
  } finally {
    await close();
  }
});

test('no token, no Telegram: every Telegram route is a 404, the service is not made, the top-up stays shut', async () => {
  const { game, db } = makeGame();
  assert.equal(telegramFromEnv({ db, auth: game.auth, game, publicUrl: 'http://localhost' }, {}), null);
  assert.equal(telegramFromEnv({ db, auth: game.auth, game, publicUrl: 'http://localhost' }, { TELEGRAM_BOT_TOKEN: '  ' }), null);
  join(game, 'Plain');
  const s = [...game.sessions].find((x) => x.name === 'Plain')!;
  assert.equal(premiumView(game, s).pay, false);
  const { base, close } = await serve(null);
  try {
    for (const [m, path] of [['GET', '/auth/tg/config'], ['POST', '/auth/tg/start'], ['GET', '/auth/tg/poll?nonce=x'], ['POST', '/auth/tg/webapp'], ['POST', '/tg/webhook']]) {
      const r = await fetch(`${base}${path}`, { method: m, body: m === 'POST' ? '{}' : undefined });
      assert.equal(r.status, 404, path);
    }
  } finally {
    await close();
  }
  // with a token (and the fake Bot API) it is made
  const on = telegramFromEnv({ db, auth: game.auth, game, publicUrl: 'https://gravetidegame.com' }, { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_FAKE: '1' });
  assert.ok(on);
  assert.equal(on.webappUrl, 'https://tg.gravetidegame.com');
  assert.equal(premiumView(game, s).pay, true);
});

test('the token never leaves: a Bot API refusal is reported without it', async () => {
  const leaky = async () => ({ json: async () => ({ ok: false, error_code: 401, description: `Unauthorized for bot${TOKEN}` }) });
  const { game, db } = makeGame();
  const tg = new TelegramService({ db, auth: game.auth, game, token: TOKEN, fetch: leaky, publicUrl: 'https://x', webappUrl: 'https://y', log: () => {} });
  await assert.rejects(tg.api.call('getMe'), (e: Error) => !e.message.includes(TOKEN) && /401/.test(e.message));
  const down = new TelegramService({ db, auth: game.auth, game, token: TOKEN, fetch: async () => { throw new Error(`fetch failed https://api.telegram.org/bot${TOKEN}/getMe`); }, publicUrl: 'https://x', webappUrl: 'https://y', log: () => {} });
  await assert.rejects(down.api.call('getMe'), (e: Error) => !e.message.includes(TOKEN));
  const logs: string[] = [];
  const quiet = new TelegramService({ db, auth: game.auth, game, token: TOKEN, fetch: leaky, publicUrl: 'https://x', webappUrl: 'https://y', log: (l) => logs.push(l) });
  await quiet.setup();
  assert.ok(logs.length >= 4 && logs.every((l) => !l.includes(TOKEN)));
});

// ------------------------------------------------------------------------------------------------ words

test('every word of Telegram in both languages: the screens, the server\'s lines, the bot, the admin\'s HELP pair', () => {
  assert.deepEqual(Object.keys(TG_RU).sort(), Object.keys(TG_EN).sort());
  for (const [k, v] of Object.entries(TG_RU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
  for (const [k, [en, ru]] of Object.entries(TG_TEXTS)) {
    assert.ok(en && ru && (en as string) !== ru, k);
    assert.ok(/[А-Яа-яЁё]/.test(ru), k);
  }
  const table = serverTable();
  const mine = extract('server/src').filter((p) => /Telegram|Stars|stars|nonce|invoice|refund|Refund|payment desk|Payments are not open/.test(p));
  assert.ok(mine.length >= 8, `${mine.length} lines`);
  assert.deepEqual(mine.filter((p) => table[p] === undefined), []);
  const { game } = makeGame();
  join(game, 'Helper');
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const help = runAdmin(game, [...game.sessions][0], '/help')!;
    const ru = SERVER_RU_ADMIN[help];
    assert.ok(ru, 'the HELP has its Russian twin');
    const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
    assert.deepEqual(cmds(ru), cmds(help));
    assert.ok(cmds(help).includes('/refund'));
  } finally {
    delete process.env.GRAVETIDE_ADMIN;
  }
});
