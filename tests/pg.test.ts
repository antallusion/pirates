// PostgreSQL persistence. Needs a server: PG_TEST_URL=postgres://user:pass@host:port/db (skipped without one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { PgClient } from '../server/src/persistence/pg.ts';
import { PgDatabase } from '../server/src/persistence/pgdb.ts';
import { FakeConn } from './helpers.ts';

const URL_ = process.env.PG_TEST_URL;
const skip = URL_ ? false : 'set PG_TEST_URL to run against PostgreSQL';

async function fresh(): Promise<void> {
  const c = await PgClient.connect(URL_!);
  await c.query('DROP TABLE IF EXISTS ledger, captains, kv, oauth_links, auth_tokens, accounts CASCADE');
  await c.end();
}

test('pg client: SCRAM login, parameters, JSON, errors', { skip }, async () => {
  const c = await PgClient.connect(URL_!);
  const r = await c.query('SELECT $1::int + 1 AS n, $2::jsonb AS j, NULL::text AS z', [41, { a: [1, 2] }]);
  assert.deepEqual(r.rows[0], { n: 42, j: { a: [1, 2] }, z: null });
  await assert.rejects(c.query('SELECT * FROM no_such_table'), /does not exist/);
  assert.equal((await c.query('SELECT 7 AS s')).rows[0].s, 7, 'the connection survives an error');
  await c.end();
});

test('write-behind store: accounts, captains, world state and ledger survive a restart', { skip }, async () => {
  await fresh();
  const db = await PgDatabase.open(URL_!);
  const id = db.createAccount('Harbour Rat', 'hash-1');
  assert.equal(db.accountByName('harbour rat')?.id, id, 'names are case-insensitive');
  db.saveCaptain(id, { gold: 1234, bank: 50, name: 'x' }, 10, 20, 0.5);
  db.setKv('world', { time: 99 });
  db.ledger(id, 'trade', 300, 'sugar');
  db.ledger(id, 'wages', -40, '');
  db.transaction(() => db.setKv('orders', [1, 2, 3]));
  db.setEmail(id, 'rat@harbour.org', 'scrypt$x$y');
  db.setEmailVerified(id);
  db.linkOAuth('github', '77', id);
  db.putAuthToken('t-hash', id, 'reset', Date.now() + 60_000);
  await db.close();
  const again = await PgDatabase.open(URL_!);
  assert.equal(again.accountByToken('hash-1')?.name, 'Harbour Rat');
  assert.equal(JSON.parse(again.loadCaptain(id)!.data).gold, 1234);
  assert.deepEqual(again.getKv('world'), { time: 99 });
  assert.deepEqual(again.getKv('orders'), [1, 2, 3]);
  const flows = again.ledgerFlows(Date.now() - 60_000);
  assert.equal(flows.find((f) => f.kind === 'trade')?.inflow, 300);
  assert.equal(flows.find((f) => f.kind === 'wages')?.outflow, 40);
  assert.deepEqual(again.silverHoldings(), [{ account_id: id, gold: 1234, bank: 50 }]);
  assert.equal(again.accountByEmail('RAT@harbour.org')?.email_verified, true);
  assert.equal(again.accountByOAuth('github', '77')?.id, id);
  assert.equal(again.takeAuthToken('t-hash', 'reset'), id);
  assert.equal(again.takeAuthToken('t-hash', 'reset'), undefined, 'one use');
  assert.equal(again.createAccount('Second', 'hash-2'), id + 1, 'ids continue');
  await again.close();
});

test('the premium shop\'s doubloons on the write-behind store: the balance, never below nought, and a payment\'s reference survive a restart', { skip }, async () => {
  await fresh();
  const db = await PgDatabase.open(URL_!);
  const id = db.createAccount('Gold Purse', 'hash-g');
  assert.equal(db.doubloons(id), 0);
  assert.equal(db.addDoubloons(id, 550), 550);
  assert.equal(db.addDoubloons(id, -600), null, 'never below nought');
  assert.equal(db.addDoubloons(id, -50), 500);
  db.ledger(id, 'doubloons_pay', 550, 'pay_9');
  await db.close();
  const again = await PgDatabase.open(URL_!);
  assert.equal(again.doubloons(id), 500);
  assert.equal(again.doubloonRef(id, 'doubloons_pay', 'pay_9'), true, 'a payment is credited once, across a restart too');
  assert.equal(again.doubloonRef(id, 'doubloons_pay', 'pay_10'), false);
  await again.close();
});

test('the game runs on PostgreSQL: a captain is created, saved and restored', { skip }, async () => {
  await fresh();
  const db = await PgDatabase.open(URL_!);
  let token = '';
  try {
    const game = new Game({ db, auth: new AuthService(db), log: () => {} });
    const conn = new FakeConn();
    game.attach(conn as unknown as WsConnection);
    conn.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Postgres Pete' });
    conn.push({ t: 'create_captain', captain: 'navigator', shipName: 'Row Lock' });
    token = conn.last('welcome')!.token;
    const s = [...game.sessions][0];
    s.profile!.gold = 4321;
    game.saveAll();
  } finally {
    await db.close();
  }
  const db2 = await PgDatabase.open(URL_!);
  try {
    const game2 = new Game({ db: db2, auth: new AuthService(db2), log: () => {} });
    const c2 = new FakeConn();
    game2.attach(c2 as unknown as WsConnection);
    c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
    assert.equal(c2.last('init')?.self.gold, 4321);
    assert.equal(c2.last('init')?.self.captain, 'navigator');
  } finally {
    await db2.close();
  }
});
