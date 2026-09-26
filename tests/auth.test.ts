import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthService, hashPassword, verifyPassword } from '../server/src/auth.ts';
import { handleAuth } from '../server/src/http/auth-routes.ts';
import { OutboxMailer } from '../server/src/mail.ts';
import { OAuthFlow } from '../server/src/oauth.ts';
import type { OAuthProvider } from '../server/src/oauth.ts';
import { Database } from '../server/src/persistence/db.ts';

function setup() {
  const db = new Database(':memory:');
  const mail = new OutboxMailer(() => {});
  const auth = new AuthService(db, mail, 'https://gravetide.example');
  return { db, mail, auth };
}

const linkToken = (text: string, re: RegExp) => decodeURIComponent(re.exec(text)![1]);

test('passwords are salted scrypt, checked in constant time', () => {
  const h = hashPassword('correct horse');
  assert.notEqual(h, hashPassword('correct horse'), 'salted');
  assert.ok(verifyPassword('correct horse', h));
  assert.ok(!verifyPassword('wrong horse', h));
  assert.ok(!verifyPassword('x', null));
});

test('e-mail accounts: register, confirm, sign in, wrong password, token rotation', async () => {
  const { db, mail, auth } = setup();
  const r = await auth.registerEmail('Anne@Example.com', 'sturdy-plank', 'Anne Blackwood');
  assert.ok(!('error' in r));
  const reg = r as { accountId: number; token: string };
  assert.equal(db.accountById(reg.accountId)?.email, 'anne@example.com');
  assert.equal(db.accountById(reg.accountId)?.email_verified, false);
  assert.equal(mail.sent.length, 1);
  const verify = linkToken(mail.sent[0].text, /verify\?token=([\w-]+)/);
  assert.ok(auth.verifyEmail(verify));
  assert.ok(!auth.verifyEmail(verify), 'one use');
  assert.equal(db.accountById(reg.accountId)?.email_verified, true);
  assert.deepEqual(await auth.loginEmail('anne@example.com', 'nope-nope'), { error: 'Wrong e-mail or password.' });
  const again = await auth.loginEmail('ANNE@example.com', 'sturdy-plank');
  assert.ok(!('error' in again));
  assert.equal(auth.resume(reg.token), null, 'signing in rotates the token');
  assert.equal(auth.resume((again as { token: string }).token)?.name, 'Anne Blackwood');
  assert.match(((await auth.registerEmail('anne@example.com', 'another-pw', 'Other Name')) as { error: string }).error, /already exists/);
  assert.match(((await auth.registerEmail('bad', 'another-pw', 'Other Name')) as { error: string }).error, /e-mail/);
  assert.match(((await auth.registerEmail('b@c.de', 'short', 'Other Name')) as { error: string }).error, /8 characters/);
});

test('a guest claims the captain with an e-mail; a forgotten password is reset by letter', async () => {
  const { db, mail, auth } = setup();
  const g = auth.register('Guest Gale') as { accountId: number; token: string };
  const c = await auth.claim(g.token, 'gale@sea.org', 'windward-9');
  assert.ok(!('error' in c));
  assert.equal(db.accountById(g.accountId)?.email, 'gale@sea.org');
  await auth.forgot('nobody@sea.org');
  assert.equal(mail.sent.length, 1, 'no letter for an unknown address (and no way to tell)');
  await auth.forgot('gale@sea.org');
  const reset = linkToken(mail.sent[1].text, /#reset=([\w-]+)/);
  const r = auth.reset(reset, 'leeward-10');
  assert.ok(!('error' in r));
  assert.ok(!('error' in (await auth.loginEmail('gale@sea.org', 'leeward-10'))));
  assert.match((auth.reset(reset, 'again-again') as { error: string }).error, /expired/);
});

test('OAuth: state is checked, the code exchanged, the account created then reused', async () => {
  const { db, auth } = setup();
  const fake: OAuthProvider = {
    id: 'github', name: 'GitHub', clientId: 'cid', clientSecret: 'sec', authorizeUrl: 'https://gh.example/authorize', tokenUrl: 'https://gh.example/token', scope: 'read:user',
    async profile(token) {
      assert.equal(token, 'at-123');
      return { subject: '4242', email: 'octo@example.com', name: 'The Octocat!' };
    },
  };
  const calls: string[] = [];
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url));
    assert.match(String(init?.body), /code=the-code/);
    return new Response(JSON.stringify({ access_token: 'at-123' }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const flow = new OAuthFlow([fake], 'https://gravetide.example', fakeFetch);
  assert.deepEqual(flow.list(), [{ id: 'github', name: 'GitHub' }]);
  const to = new URL(flow.start('github')!);
  const state = to.searchParams.get('state')!;
  assert.equal(to.searchParams.get('redirect_uri'), 'https://gravetide.example/auth/oauth/github/callback');
  await assert.rejects(flow.finish('github', 'the-code', 'forged'), /expired/);
  const prof = await flow.finish('github', 'the-code', state);
  await assert.rejects(flow.finish('github', 'the-code', state), /expired/, 'a state is good once');
  const r1 = auth.oauthLogin('github', prof.subject, prof.email, prof.name);
  assert.equal(r1.name, 'The Octocat');
  assert.equal(db.accountById(r1.accountId)?.email_verified, true);
  const r2 = auth.oauthLogin('github', prof.subject, prof.email, prof.name);
  assert.equal(r2.accountId, r1.accountId, 'the same captain next time');
  assert.equal(calls.length, 1);
});

test('HTTP: register, sign in, verify link, providers and the rate limit', async () => {
  const { mail, auth } = setup();
  const flow = new OAuthFlow([], 'http://localhost');
  const server = createServer(async (req, res) => {
    if (!(await handleAuth(req, res, auth, flow))) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const post = (p: string, b: unknown) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const reg = await (await post('/auth/register', { email: 'rook@sea.org', password: 'crow-nest-1', name: 'Rook Salt' })).json() as { token: string };
    assert.ok(reg.token);
    const bad = await post('/auth/login', { email: 'rook@sea.org', password: 'wrong-wrong' });
    assert.equal(bad.status, 400);
    const ok = await (await post('/auth/login', { email: 'rook@sea.org', password: 'crow-nest-1' })).json() as { token: string };
    assert.ok(ok.token && ok.token !== reg.token);
    const v = linkToken(mail.sent[0].text, /verify\?token=([\w-]+)/);
    const vr = await fetch(`${base}/auth/verify?token=${v}`, { redirect: 'manual' });
    assert.equal(vr.status, 302);
    assert.equal(vr.headers.get('location'), '/#verified');
    assert.deepEqual(await (await fetch(base + '/auth/providers')).json(), { providers: [] });
    let limited = false;
    for (let i = 0; i < 25 && !limited; i++) limited = (await post('/auth/login', { email: 'x@y.zz', password: 'nnnnnnnn' })).status === 429;
    assert.ok(limited, 'too many attempts are refused');
  } finally {
    server.close();
  }
});

test('SMTP: a letter goes out through a plain SMTP server with AUTH PLAIN', async () => {
  const { createServer: createTcp } = await import('node:net');
  const { SmtpMailer } = await import('../server/src/mail.ts');
  const got: string[] = [];
  const srv = createTcp((sock) => {
    let data = false;
    let buf = '';
    sock.write('220 test ESMTP\r\n');
    sock.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') {
            data = false;
            sock.write('250 queued\r\n');
          } else got.push(line);
          continue;
        }
        got.push(`> ${line}`);
        if (line.startsWith('EHLO')) sock.write('250-test\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH PLAIN')) sock.write('235 ok\r\n');
        else if (line.startsWith('MAIL') || line.startsWith('RCPT')) sock.write('250 ok\r\n');
        else if (line === 'DATA') {
          data = true;
          sock.write('354 go\r\n');
        } else if (line === 'QUIT') {
          sock.write('221 bye\r\n');
          sock.end();
        }
      }
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  try {
    await new SmtpMailer(`smtp://harbour:secret@127.0.0.1:${port}`, 'hm@gravetide.example').send({ to: 'anne@example.com', subject: 'Ahoy', text: 'Line one\n.dot line' });
    assert.ok(got.includes(`> AUTH PLAIN ${Buffer.from('\0harbour\0secret').toString('base64')}`));
    assert.ok(got.includes('> RCPT TO:<anne@example.com>'));
    assert.ok(got.includes('Subject: Ahoy'));
    assert.ok(got.includes('..dot line'), 'dot-stuffing');
  } finally {
    srv.close();
  }
});
