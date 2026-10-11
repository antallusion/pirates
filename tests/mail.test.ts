// Outgoing mail through Sendersy and the guard on the letter-sending forms (owner, 2026-10-11): the request's shape,
// a 422 told to the captain and never retried, a 429 waited out twice then given up, nothing secret in the log, the
// honeypot and the time trap, 3 letters an hour an address and 10 an IP, and an address the service refuses making no
// account at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthService, CHECK_EMAIL } from '../server/src/auth.ts';
import { handleAuth, MAIL_LIMIT, resetMailGuard } from '../server/src/http/auth-routes.ts';
import type { Mail, Mailer } from '../server/src/mail.ts';
import { MailRejected, OutboxMailer, SendersyMailer } from '../server/src/mail.ts';
import { FORM_MIN_MS, formTrapped, MailGuard, MAIL_PER_ADDRESS, MAIL_PER_IP } from '../server/src/mailguard.ts';
import { OAuthFlow } from '../server/src/oauth.ts';
import { Database } from '../server/src/persistence/db.ts';

const KEY = 'sk_live_test_SECRET_KEY';

/** A fake Sendersy: answers the statuses given in turn, keeps every request. */
function fakeApi(statuses: number[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(status === 200 ? '{"id":"em_1"}' : '{"error":"x"}', { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

test('Sendersy: the request carries the template, her tongue and the reply-to; the log holds no key and no whole address', async () => {
  const api = fakeApi([200]);
  const logs: string[] = [];
  const m = new SendersyMailer(KEY, { fetchImpl: api.impl, log: (s) => logs.push(s) });
  await m.send({ to: 'rook@sea.org', subject: 'S', text: 'T', template: 'sendersy/email-verify--gaming', locale: 'ru', variables: { verify_url: 'https://x/v' } });
  assert.equal(api.calls.length, 1);
  const c = api.calls[0];
  assert.equal(c.url, 'https://api.sendersy.com/v1/emails');
  assert.equal((c.init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
  assert.equal(c.body.from, 'Gravetide <noreply@gravetidegame.com>');
  assert.equal(c.body.reply_to, 'support@gravetidegame.com');
  assert.equal(c.body.template, 'sendersy/email-verify--gaming');
  assert.equal(c.body.locale, 'ru');
  assert.deepEqual(c.body.variables, { verify_url: 'https://x/v' });
  assert.equal(c.body.text, undefined, 'a template letter sends no words of ours');
  const all = logs.join('\n');
  assert.ok(!all.includes(KEY) && !all.includes('rook@sea.org'), 'neither the key nor the whole address is logged');
  assert.match(all, /r\*\*\*@sea\.org/);
});

test('Sendersy: a 422 is the address\'s fault, told at once and never retried', async () => {
  const api = fakeApi([422]);
  const m = new SendersyMailer(KEY, { fetchImpl: api.impl, log: () => {} });
  await assert.rejects(m.send({ to: 'nobody@nowhere.zz', subject: 'S', text: 'T' }), (e) => e instanceof MailRejected && e.kind === 'invalid');
  assert.equal(api.calls.length, 1);
});

test('Sendersy: a 429 is waited out twice with a pause, then given up — never a loop', async () => {
  const waits: number[] = [];
  const ok = fakeApi([429, 429, 200]);
  await new SendersyMailer(KEY, { fetchImpl: ok.impl, wait: async (ms) => void waits.push(ms), log: () => {} }).send({ to: 'a@b.cc', subject: 'S', text: 'T' });
  assert.equal(ok.calls.length, 3);
  assert.deepEqual(waits, [2000, 5000]);
  const no = fakeApi([429]);
  await assert.rejects(new SendersyMailer(KEY, { fetchImpl: no.impl, wait: async () => {}, log: () => {} }).send({ to: 'a@b.cc', subject: 'S', text: 'T' }), (e) => e instanceof MailRejected && e.kind === 'limited');
  assert.equal(no.calls.length, 3, 'three tries in all');
});

test('the guard: the honeypot and the time trap; 3 letters an hour an address, 10 an IP, the hour passing frees them', () => {
  assert.ok(formTrapped({ website: 'http://spam' }));
  assert.ok(formTrapped({ t: String(FORM_MIN_MS - 1) }));
  assert.ok(!formTrapped({ t: String(FORM_MIN_MS + 500), website: '' }));
  let now = 1_000_000;
  const g = new MailGuard(() => now);
  for (let i = 0; i < MAIL_PER_ADDRESS; i++) assert.ok(g.take('1.1.1.1', 'Rook@Sea.org'));
  assert.ok(!g.take('2.2.2.2', 'rook@sea.org'), 'the fourth to one address, from anywhere, is refused');
  for (let i = 0; i < MAIL_PER_IP - MAIL_PER_ADDRESS; i++) assert.ok(g.take('1.1.1.1', `c${i}@sea.org`));
  assert.ok(!g.take('1.1.1.1', 'fresh@sea.org'), 'the eleventh from one IP is refused');
  now += 3_600_001;
  assert.ok(g.take('1.1.1.1', 'rook@sea.org'), 'an hour on, free again');
});

/** A mailer that refuses one address as Sendersy would (422). */
class Refusing implements Mailer {
  readonly sent: Mail[] = [];
  async send(m: Mail): Promise<void> {
    if (m.to.startsWith('bad')) throw new MailRejected('invalid');
    this.sent.push(m);
  }
}

test('an address the mail service refuses: no account is made, a guest keeps no unconfirmable address', async () => {
  const db = new Database(':memory:');
  const mail = new Refusing();
  const auth = new AuthService(db, mail, 'https://gravetidegame.com');
  const r = await auth.registerEmail('bad@typo.cm', 'crow-nest-1', 'Rook Salt', 'ru');
  assert.deepEqual(r, { error: CHECK_EMAIL });
  assert.equal(db.accountByName('Rook Salt'), undefined, 'no account');
  const ok = await auth.registerEmail('rook@sea.org', 'crow-nest-1', 'Rook Salt', 'ru');
  assert.ok('token' in ok);
  assert.equal(mail.sent[0].template, 'sendersy/email-verify--gaming');
  assert.equal(mail.sent[0].locale, 'ru');
  assert.match(mail.sent[0].variables!.verify_url, /^https:\/\/gravetidegame\.com\/auth\/verify\?token=/);
  const guest = auth.register('Gull Wing');
  assert.ok('token' in guest);
  assert.deepEqual(await auth.claim(guest.token, 'bad@typo.cm', 'crow-nest-1'), { error: CHECK_EMAIL });
  assert.equal(db.accountById(guest.accountId)!.email ?? null, null, 'the guest keeps no address');
});

test('HTTP: a 422 answer, the honeypot, the hour\'s limit, the support form with her reply-to', async () => {
  resetMailGuard();
  const db = new Database(':memory:');
  const mail = new OutboxMailer(() => {});
  const auth = new AuthService(db, mail, 'https://gravetidegame.com');
  const refusing = new AuthService(new Database(':memory:'), new Refusing(), 'https://gravetidegame.com');
  const flow = new OAuthFlow([], 'http://localhost');
  const mk = (a: AuthService) => createServer(async (req, res) => {
    if (!(await handleAuth(req, res, a, flow))) res.writeHead(404).end();
  });
  const s1 = mk(auth), s2 = mk(refusing);
  await Promise.all([s1, s2].map((s) => new Promise<void>((r) => s.listen(0, '127.0.0.1', r))));
  const base = (s: typeof s1) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const post = (s: typeof s1, p: string, b: unknown) => fetch(base(s) + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  try {
    const bad = await post(s2, '/auth/register', { email: 'bad@typo.cm', password: 'crow-nest-1', name: 'Rook Salt', t: '5000' });
    assert.equal(bad.status, 422);
    assert.deepEqual(await bad.json(), { error: CHECK_EMAIL });
    // The honeypot: a bot's register is refused, its forgot answers the same and sends nothing.
    assert.equal((await post(s1, '/auth/register', { email: 'bot@sea.org', password: 'crow-nest-1', name: 'Bot Boat', website: 'x' })).status, 400);
    const before = mail.sent.length;
    assert.equal((await post(s1, '/auth/forgot', { email: 'bot@sea.org', website: 'x' })).status, 200);
    assert.equal(mail.sent.length, before);
    // Three letters an hour to one address: the fourth ask is refused.
    for (let i = 0; i < 3; i++) await post(s1, '/auth/support', { email: 'gull@sea.org', message: `Ahoy, ship number ${i} lost`, t: '5000' });
    const fourth = await post(s1, '/auth/support', { email: 'gull@sea.org', message: 'Ahoy, one more time', t: '5000' });
    assert.equal(fourth.status, 429);
    assert.deepEqual(await fourth.json(), { error: MAIL_LIMIT });
    const desk = mail.sent.filter((m) => m.to === 'support@gravetidegame.com');
    assert.equal(desk.length, 3);
    assert.equal(desk[0].replyTo, 'gull@sea.org', 'the reply goes to her');
    assert.match(desk[0].subject, /^GRAVETIDE · Ahoy/);
    assert.equal((await post(s1, '/auth/support', { email: 'gull2@sea.org', message: 'short', t: '5000' })).status, 400, 'too short');
  } finally {
    s1.close();
    s2.close();
    resetMailGuard();
  }
});
