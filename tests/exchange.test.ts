// The exchange of doubloons into silver (owner, 2026-10-30: «реализуй обмен дублонов на серебро»;
// server/src/game/exchange.ts): the rate, the balance checked, the ledger's rows, the purchase id spent once, the
// refusals (a forged number, more than the balance, more than the cap, mid-fight), the message's answer, both
// languages, and no way back from silver to doubloons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join as pjoin } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { EXCHANGE_MAX, EXCHANGE_PRESETS, EXCHANGE_SILVER_PER_DOUBLOON, exchangeSilver } from '../shared/src/data/premium.ts';
import { TG_TEXTS } from '../shared/src/data/telegram.ts';
import { exchangeDoubloons, exchangeRef } from '../server/src/game/exchange.ts';
import { creditPremium, premiumMessage } from '../server/src/game/premium.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { Database } from '../server/src/persistence/db.ts';
import { serverText } from '../client/src/lang/server.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/premium.ts';
import { setLang } from '../client/src/i18n.ts';
import { extract } from '../tools/i18n-server.ts';
import { join, makeGame } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

let k = 0;
const pid = () => `ex${++k}abcdef`;

function captain(dbl: number): { game: Game; db: Database; s: PlayerSession; conn: FakeConn } {
  const { game, db } = makeGame();
  const conn = join(game, `Ex${++k}`);
  const s = game.sessionByName(`Ex${k}`)!;
  s.profile!.gold = 1000;
  if (dbl) assert.ok(creditPremium(game, s.accountId, dbl, 'admin', 'test') !== null);
  return { game, db, s, conn };
}

function rows(db: Database, account: number, kind: string): { amount: number; detail: string }[] {
  const raw = (db as unknown as { db: DatabaseSync }).db.prepare(`SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = ? ORDER BY id`).all(account, kind) as { amount: number; detail: string }[];
  return raw.map((r) => ({ amount: Number(r.amount), detail: String(r.detail) }));
}

test('the rate: 1 doubloon = 200 silver, whole numbers from 1 to the cap', () => {
  assert.equal(EXCHANGE_SILVER_PER_DOUBLOON, 200);
  assert.equal(exchangeSilver(1), 200);
  assert.equal(exchangeSilver(50), 10_000);
  assert.equal(exchangeSilver(EXCHANGE_MAX), EXCHANGE_MAX * 200);
  for (const bad of [0, -1, 1.5, NaN, Infinity, EXCHANGE_MAX + 1]) assert.equal(exchangeSilver(bad), 0, String(bad));
  assert.deepEqual([...EXCHANGE_PRESETS], [10, 50, 100, 500]);
});

test('an exchange: the doubloons off with their doubloons_buy row, the silver on with its own row, the save', () => {
  const { game, db, s } = captain(120);
  const id = pid();
  assert.equal(exchangeDoubloons(game, s, 50, id), null);
  assert.equal(db.doubloons(s.accountId), 70);
  assert.equal(s.profile!.gold, 1000 + 50 * 200);
  assert.deepEqual(rows(db, s.accountId, 'doubloons_buy'), [{ amount: -50, detail: `exchange:silver:50:${id}` }]);
  assert.equal(exchangeRef(50, id), `exchange:silver:50:${id}`);
  assert.deepEqual(rows(db, s.accountId, 'exchange'), [{ amount: 10_000, detail: `doubloons:50:${id}` }]);
  // the whole balance at once
  assert.equal(exchangeDoubloons(game, s, 70, pid()), null);
  assert.equal(db.doubloons(s.accountId), 0);
  assert.equal(s.profile!.gold, 1000 + 120 * 200);
});

test('the purchase id buys once: the same message twice moves nothing more', () => {
  const { game, db, s } = captain(100);
  const id = pid();
  assert.equal(exchangeDoubloons(game, s, 10, id), null);
  assert.equal(exchangeDoubloons(game, s, 10, id), null);
  assert.equal(db.doubloons(s.accountId), 90);
  assert.equal(s.profile!.gold, 1000 + 2000);
  assert.equal(rows(db, s.accountId, 'doubloons_buy').length, 1);
  assert.equal(rows(db, s.accountId, 'exchange').length, 1);
  // a purchase id is required, and of the shape the shop takes
  assert.ok(exchangeDoubloons(game, s, 10, ''));
  assert.ok(exchangeDoubloons(game, s, 10, 'bad id!'));
  assert.equal(db.doubloons(s.accountId), 90);
});

test('the refusals: a forged number, more than the balance, more than the cap, mid-fight — nothing moves', () => {
  const { game, db, s } = captain(EXCHANGE_MAX + 50);
  const before = () => ({ d: db.doubloons(s.accountId), g: s.profile!.gold, r: rows(db, s.accountId, 'doubloons_buy').length });
  const was = before();
  for (const bad of [0, -5, 2.5, NaN, Infinity]) assert.match(exchangeDoubloons(game, s, bad, pid())!, /whole number/);
  assert.match(exchangeDoubloons(game, s, EXCHANGE_MAX + 1, pid())!, /No more than 100000 doubloons/);
  assert.deepEqual(before(), was);
  // more than the balance
  const poor = captain(30);
  assert.match(exchangeDoubloons(poor.game, poor.s, 31, pid())!, /Not enough doubloons: 1 more needed/);
  assert.equal(poor.db.doubloons(poor.s.accountId), 30);
  assert.equal(poor.s.profile!.gold, 1000);
  // in a boarding: refused as the shop's goods are
  (s.ship as unknown as { boarding: unknown }).boarding = { id: 1 };
  assert.equal(exchangeDoubloons(game, s, 10, pid()), 'Not in the middle of a fight.');
  (s.ship as unknown as { boarding: unknown }).boarding = null;
  assert.deepEqual(before(), was);
  // the cap itself is allowed
  assert.equal(exchangeDoubloons(game, s, EXCHANGE_MAX, pid()), null);
  assert.equal(db.doubloons(s.accountId), 50);
});

test('the message: the answer with the doubloons and silver, or the refusal; the balance and the view sent after', () => {
  const { game, db, s, conn } = captain(40);
  const id = pid();
  conn.inbox.length = 0;
  premiumMessage(game, s, { t: 'premium', action: 'exchange', doubloons: 25, pid: id });
  const ans = conn.inbox.find((m) => m.t === 'premium_exchange');
  assert.deepEqual(ans, { t: 'premium_exchange', pid: id, doubloons: 25, silver: 5000 });
  assert.ok(conn.inbox.some((m) => m.t === 'doubloons' && m.n === 15));
  assert.ok(conn.inbox.some((m) => m.t === 'premium'));
  assert.equal(db.doubloons(s.accountId), 15);
  conn.inbox.length = 0;
  premiumMessage(game, s, { t: 'premium', action: 'exchange', doubloons: 99, pid: pid() });
  const no = conn.inbox.find((m) => m.t === 'premium_exchange') as { why?: string; doubloons: number } | undefined;
  assert.ok(no?.why && no.doubloons === 0);
  assert.equal(db.doubloons(s.accountId), 15);
});

test('both languages: the server lines and the window words', () => {
  setLang('ru');
  try {
    assert.equal(serverText('Exchanged 50 doubloons for 10000 silver.'), 'Обменяно 50 дубл. на 10000 серебра.');
    assert.equal(serverText('Name a whole number of doubloons.'), 'Укажите целое число дублонов.');
    assert.match(serverText(`No more than ${EXCHANGE_MAX} doubloons at one exchange.`), /^За один обмен\s— не больше 100\s?000 дубл\.$/u);
  } finally {
    setLang('en');
  }
  const mine = extract('server/src/game').filter((x) => /exchange|whole number of doubloons/i.test(x));
  assert.ok(mine.length >= 3);
  for (const key of Object.keys(P_EN).filter((x) => x.startsWith('ex.'))) {
    assert.ok(/[а-яё]/i.test(P_RU[key as keyof typeof P_EN]), key);
  }
});

test('no loop: nothing turns silver into doubloons, and the terms say what doubloons buy', () => {
  // every credit of doubloons is one of the premium sources (a payment, the admin, a refund, the subscription, the
  // first top-up's bonus, the daily gift) — none of them is paid for in silver
  const files = readdirSync('server/src/game').filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const src = readFileSync(pjoin('server/src/game', f), 'utf8');
    for (const m of src.matchAll(/addDoubloons\([^,]+,\s*([^)]+)\)/g)) assert.match(m[1].trim(), /^-|^delta$/, `${f}: addDoubloons only spends (or moves by creditPremium's delta)`);
  }
  assert.match(TG_TEXTS.terms[0], /premium ships, creatures and silver/);
  assert.match(TG_TEXTS.terms[1], /премиальные корабли, существ и серебро/);
  assert.match(TG_TEXTS.terms[0], /cannot be exchanged back for Stars or money/);
});
