// «Войти через VK ID» on the website (owner, 2026-10-25; docs/36_VK.md §8): the start's redirect (state, PKCE S256,
// the registered redirect URL, the scope), the callback against a mocked VK ID (the verifier checked against the
// challenge, the device id passed on), a captain made once and found again, the same VK user through the Mini App's
// launch the same captain, a bad or replayed state refused, the routes off without VKID_APP_ID, the link mode (a link
// made; a VK user of another captain never merged; a captain with another VK refused), the notices' permission never
// pretended, and the words in both tongues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { VkIdService, VKID_ERR, VKID_REDIRECT_DEFAULT, pkceChallenge, vkIdFromEnv } from '../server/src/vkid.ts';
import type { VkIdFetch } from '../server/src/vkid.ts';
import { handleVkId } from '../server/src/http/vkid-routes.ts';
import { VkService, signLaunch } from '../server/src/vk.ts';
import { tgnState } from '../server/src/game/tgnotify.ts';
import { EN, RU } from '../client/src/lang/ui/vkid.ts';
import { SERVER_RU_TG } from '../client/src/lang/server.ru.tg.ts';
import { SERVER_RU_A } from '../client/src/lang/server.ru.a.ts';
import { makeGame } from './helpers.ts';

const APP = '54851873';

/** A VK ID of our own: the authorize page «answers» with a code for a VK user; the exchange checks the PKCE pair. */
function mockVkId() {
  const codes = new Map<string, { user: number; first: string; challenge: string; redirect: string }>();
  const calls: { url: string; form: URLSearchParams }[] = [];
  const f: VkIdFetch = async (url, init) => {
    const form = new URLSearchParams(init.body);
    calls.push({ url, form });
    if (url.endsWith('/oauth2/auth')) {
      const c = codes.get(form.get('code') ?? '');
      if (!c || pkceChallenge(form.get('code_verifier') ?? '') !== c.challenge || form.get('redirect_uri') !== c.redirect || form.get('client_id') !== APP || !form.get('device_id')) {
        return { json: async () => ({ error: 'invalid_grant' }) };
      }
      return { json: async () => ({ access_token: `at-${c.user}`, user_id: c.user, state: form.get('state'), token_type: 'Bearer', expires_in: 3600 }) };
    }
    if (url.endsWith('/oauth2/user_info')) {
      const u = Number((form.get('access_token') ?? '').replace('at-', ''));
      const c = [...codes.values()].find((x) => x.user === u);
      return { json: async () => (c ? { user: { user_id: String(u), first_name: c.first, last_name: 'X' } } : { error: 'invalid_token' }) };
    }
    throw new Error(`unexpected ${url}`);
  };
  /** VK's authorize page: she agrees, VK sends her back with a code (the start's URL in, the callback's query out). */
  const authorize = (startUrl: string, user: number, first = 'Анна'): URLSearchParams => {
    const u = new URL(startUrl);
    const code = `code-${user}-${Math.random().toString(36).slice(2)}`;
    codes.set(code, { user, first, challenge: u.searchParams.get('code_challenge')!, redirect: u.searchParams.get('redirect_uri')! });
    return new URLSearchParams({ code, state: u.searchParams.get('state')!, device_id: 'dev-1', type: 'code_v2' });
  };
  return { f, authorize, calls };
}

function setup() {
  const { game, db } = makeGame();
  const m = mockVkId();
  const vkid = new VkIdService({ db, auth: game.auth, game, appId: APP, miniAppId: 54838627, fetch: m.f, log: () => {} });
  return { game, db, vkid, m };
}

const startUrl = (r: { url: string } | { error: string }): string => {
  assert.ok('url' in r, JSON.stringify(r));
  return r.url;
};

test('start: VK ID authorize with the app id, the registered redirect URL, the scope, a fresh state and a PKCE S256 challenge', () => {
  const { vkid } = setup();
  const a = new URL(startUrl(vkid.start()));
  const b = new URL(startUrl(vkid.start()));
  assert.equal(`${a.origin}${a.pathname}`, 'https://id.vk.com/authorize');
  const q = a.searchParams;
  assert.equal(q.get('response_type'), 'code');
  assert.equal(q.get('client_id'), APP);
  assert.equal(q.get('redirect_uri'), 'https://gravetidegame.com/auth/vkid/callback');
  assert.equal(VKID_REDIRECT_DEFAULT, 'https://gravetidegame.com/auth/vkid/callback');
  assert.equal(q.get('scope'), 'vkid.personal_info');
  assert.equal(q.get('code_challenge_method')!.toUpperCase(), 'S256');
  assert.match(q.get('code_challenge')!, /^[\w-]{43}$/, 'SHA-256 in base64url, no padding');
  assert.match(q.get('state')!, /^[\w-]{32}$/);
  assert.notEqual(q.get('state'), b.searchParams.get('state'));
  assert.notEqual(q.get('code_challenge'), b.searchParams.get('code_challenge'));
});

test('callback: the code exchanged with the verifier and the device id, a captain made from the VK name, found again next time', async () => {
  const { vkid, m, db, game } = setup();
  const r1 = await vkid.finish(m.authorize(startUrl(vkid.start()), 9001, 'Анна'));
  assert.equal(r1.kind, 'login', JSON.stringify(r1));
  if (r1.kind !== 'login') return;
  assert.equal(r1.name, 'Анна');
  assert.equal(r1.vkUser, 9001);
  assert.equal(db.accountByOAuth('vk', '9001')?.id, r1.accountId);
  assert.ok(game.auth.resume(r1.token), 'a working game token');
  const ex = m.calls.find((c) => c.url === 'https://id.vk.com/oauth2/auth')!;
  assert.equal(ex.form.get('grant_type'), 'authorization_code');
  assert.equal(ex.form.get('device_id'), 'dev-1');
  // the notices: her VK user tied, the permission NOT pretended (only the Mini App's «allow» gives it)
  assert.equal(r1.notify, false);
  assert.equal(tgnState(game, r1.accountId)?.vk, 9001);
  assert.equal(tgnState(game, r1.accountId)?.vkOff, true);
  const r2 = await vkid.finish(m.authorize(startUrl(vkid.start()), 9001));
  assert.equal(r2.kind, 'login');
  if (r2.kind === 'login') assert.equal(r2.accountId, r1.accountId, 'the same captain');
  // a short or odd VK name: «Капитан»
  const r3 = await vkid.finish(m.authorize(startUrl(vkid.start()), 9002, 'Ю'));
  assert.equal(r3.kind === 'login' && r3.name, 'Капитан');
});

test('one VK user, one captain: the Mini App launch and the website VK ID land on the same account, both ways round', async () => {
  const { game, db, vkid, m } = setup();
  const SECRET = 'qa-secret';
  const mini = new VkService({ db, auth: game.auth, game, appId: 54838627, secret: SECRET, publicUrl: 'https://gravetidegame.com', log: () => {} });
  const launch = (user: number, notify = '0') => {
    const p: Record<string, string> = { vk_app_id: '54838627', vk_user_id: String(user), vk_ts: String(Math.floor(Date.now() / 1000) - 5), vk_language: 'ru', vk_platform: 'desktop_web', vk_are_notifications_enabled: notify };
    return '?' + new URLSearchParams({ ...p, sign: signLaunch(p, SECRET) }).toString();
  };
  // first the Mini App (with VK's notices allowed), then the website
  const a = mini.launch(launch(7001, '1'), 'Мира');
  assert.ok(!('error' in a));
  const w = await vkid.finish(m.authorize(startUrl(vkid.start()), 7001));
  assert.equal(w.kind === 'login' && w.accountId, (a as { accountId: number }).accountId);
  assert.equal(w.kind === 'login' && w.notify, true, 'the Mini App\'s permission stands: no hint');
  // first the website, then the Mini App
  const w2 = await vkid.finish(m.authorize(startUrl(vkid.start()), 7002));
  const a2 = mini.launch(launch(7002));
  assert.equal(w2.kind === 'login' && w2.accountId, (a2 as { accountId: number }).accountId);
});

test('a bad, replayed, expired or missing state is refused; a refusal at VK or a failed exchange signs nobody in', async () => {
  const { vkid, m, db } = setup();
  const q = m.authorize(startUrl(vkid.start()), 5001);
  const forged = new URLSearchParams(q);
  forged.set('state', 'forged-state-forged-state-forged1');
  assert.deepEqual(await vkid.finish(forged), { kind: 'error', error: VKID_ERR.expired });
  const noState = new URLSearchParams(q);
  noState.delete('state');
  assert.deepEqual(await vkid.finish(noState), { kind: 'error', error: VKID_ERR.expired });
  assert.equal((await vkid.finish(q)).kind, 'login');
  assert.deepEqual(await vkid.finish(q), { kind: 'error', error: VKID_ERR.expired }, 'a state is good once');
  // expired: ten minutes
  const t = { now: Date.now() };
  const { game, db: db2 } = makeGame();
  const v2 = new VkIdService({ db: db2, auth: game.auth, game, appId: APP, fetch: m.f, now: () => t.now, log: () => {} });
  const q2 = m.authorize(startUrl(v2.start()), 5002);
  t.now += 11 * 60_000;
  assert.deepEqual(await v2.finish(q2), { kind: 'error', error: VKID_ERR.expired });
  // she said no at VK: no code
  const s3 = new URL(startUrl(vkid.start())).searchParams.get('state')!;
  assert.deepEqual(await vkid.finish(new URLSearchParams({ state: s3, error: 'access_denied' })), { kind: 'error', error: VKID_ERR.denied });
  // a code VK does not know (or a verifier that does not match): the exchange fails, nobody made
  const s4 = new URL(startUrl(vkid.start())).searchParams.get('state')!;
  assert.deepEqual(await vkid.finish(new URLSearchParams({ state: s4, code: 'nope', device_id: 'd' })), { kind: 'error', error: VKID_ERR.failed });
  assert.equal(db.accountByOAuth('vk', '5003'), undefined);
});

test('link mode: VK tied to the signed-in captain; a VK user with a captain of its own, or a captain with another VK, is never merged', async () => {
  const { game, db, vkid, m } = setup();
  const guest = game.auth.register('Ирина Ворон');
  assert.ok(!('error' in guest));
  if ('error' in guest) return;
  // no token, no ticket
  assert.deepEqual(vkid.linkTicket('bad-token-bad-token-bad-token'), { error: VKID_ERR.signIn });
  assert.equal('error' in vkid.start({ link: 'made-up' }), true);
  const t = vkid.linkTicket(guest.token);
  assert.ok('url' in t);
  if (!('url' in t)) return;
  const ticket = new URL(t.url, 'http://x').searchParams.get('link')!;
  const s = startUrl(vkid.start({ link: ticket }));
  assert.equal('error' in vkid.start({ link: ticket }), true, 'a ticket is good once');
  const r = await vkid.finish(m.authorize(s, 6001));
  assert.equal(r.kind, 'linked');
  assert.equal(db.accountByOAuth('vk', '6001')?.id, guest.accountId);
  assert.ok(game.auth.resume(guest.token), 'her token kept');
  assert.equal(tgnState(game, guest.accountId)?.vk, 6001);
  // a VK sign-in now finds her
  const again = await vkid.finish(m.authorize(startUrl(vkid.start()), 6001));
  assert.equal(again.kind === 'login' && again.accountId, guest.accountId);
  // (a sign-in rotates her token, as every sign-in of the game does)
  const herToken = (again as { token: string }).token;

  // another VK user who already has a captain: refused, both captains untouched
  const other = await vkid.finish(m.authorize(startUrl(vkid.start()), 6002, 'Пётр'));
  assert.equal(other.kind, 'login');
  const second = game.auth.register('Марта Соль');
  if ('error' in second) return assert.fail();
  const t2 = vkid.linkTicket(second.token) as { url: string };
  const r2 = await vkid.finish(m.authorize(startUrl(vkid.start({ link: new URL(t2.url, 'http://x').searchParams.get('link') })), 6002));
  assert.deepEqual(r2, { kind: 'error', error: VKID_ERR.taken });
  assert.equal(db.accountByOAuth('vk', '6002')?.id, (other as { accountId: number }).accountId, 'the VK user keeps its own captain');
  assert.equal(tgnState(game, second.accountId)?.vk ?? null, null);
  // the guest already has VK 6001: another VK user is refused for her
  const t3 = vkid.linkTicket(herToken) as { url: string };
  const r3 = await vkid.finish(m.authorize(startUrl(vkid.start({ link: new URL(t3.url, 'http://x').searchParams.get('link') })), 6003));
  assert.deepEqual(r3, { kind: 'error', error: VKID_ERR.other });
  assert.equal(db.accountByOAuth('vk', '6003'), undefined);
  // linking the VK she already has: fine, nothing changes
  const t4 = vkid.linkTicket(herToken) as { url: string };
  const r4 = await vkid.finish(m.authorize(startUrl(vkid.start({ link: new URL(t4.url, 'http://x').searchParams.get('link') })), 6001));
  assert.equal(r4.kind, 'linked');
  assert.deepEqual(vkid.status(herToken), { linked: true, notify: false });
  assert.deepEqual(vkid.status(second.token), { linked: false, notify: false });
});

// ------------------------------------------------------------------------------------------------ the routes

async function serve(vkid: VkIdService | null): Promise<{ url: string; close: () => void }> {
  const srv = createServer((req, res) => void handleVkId(req, res, vkid).then((h) => h || res.writeHead(418).end()));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, close: () => srv.close() };
}

test('routes: off without VKID_APP_ID (config «off», the rest 404); on: start 302 to VK ID, callback 302 to /play with the token', async () => {
  { const g = makeGame(); assert.equal(vkIdFromEnv({ db: g.db, auth: g.game.auth, game: g.game }, {}), null); }
  { const g = makeGame(); assert.equal(vkIdFromEnv({ db: g.db, auth: g.game.auth, game: g.game }, { VKID_APP_ID: 'abc' }), null); }
  {
    const g = makeGame();
    const v = vkIdFromEnv({ db: g.db, auth: g.game.auth, game: g.game }, { VKID_APP_ID: APP, VK_APP_ID: '54838627' })!;
    assert.equal(v.appId, APP);
    assert.equal(v.redirectUri, 'https://gravetidegame.com/auth/vkid/callback');
    assert.equal(v.apiBase, 'https://id.vk.com');
    assert.equal(v.miniApp, 'https://vk.com/app54838627');
  }
  const none = await serve(null);
  try {
    assert.deepEqual(await (await fetch(`${none.url}/auth/vkid/config`)).json(), { enabled: false });
    assert.equal((await fetch(`${none.url}/auth/vkid/start`, { redirect: 'manual' })).status, 404);
    assert.equal((await fetch(`${none.url}/auth/vkid/callback?code=a&state=b`, { redirect: 'manual' })).status, 404);
    assert.equal((await fetch(`${none.url}/auth/vkid/link`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${none.url}/auth/vk/config`)).status, 418, 'the Mini App\'s routes are not these');
  } finally {
    none.close();
  }
  const { vkid, m, game } = setup();
  const s = await serve(vkid);
  try {
    assert.deepEqual(await (await fetch(`${s.url}/auth/vkid/config`)).json(), { enabled: true, miniApp: 'https://vk.com/app54838627' });
    const st = await fetch(`${s.url}/auth/vkid/start?lang=en`, { redirect: 'manual' });
    assert.equal(st.status, 302);
    const to = st.headers.get('location')!;
    assert.ok(to.startsWith('https://id.vk.com/authorize?'), to);
    const cb = await fetch(`${s.url}/auth/vkid/callback?${m.authorize(to, 8001)}`, { redirect: 'manual' });
    assert.equal(cb.status, 302);
    const back = cb.headers.get('location')!;
    assert.match(back, /^\/play#token=[\w%-]+&vkid=1&vknote=1$/);
    const tok = decodeURIComponent(/token=([^&]+)/.exec(back)![1]);
    assert.ok(game.auth.resume(tok));
    // a forged state: back to the page with the refusal, nobody signed in
    const bad = await fetch(`${s.url}/auth/vkid/callback?code=x&state=forged&device_id=d`, { redirect: 'manual' });
    assert.equal(bad.headers.get('location'), `/play#vkid-error=${encodeURIComponent(VKID_ERR.expired)}`);
    // the link: the ticket by POST (the token never in an address), then the start, then the callback
    const lk = await (await fetch(`${s.url}/auth/vkid/link`, { method: 'POST', body: JSON.stringify({ token: tok }) })).json() as { url: string };
    assert.match(lk.url, /^\/auth\/vkid\/start\?link=[\w-]+$/);
    const st2 = await fetch(`${s.url}${lk.url}`, { redirect: 'manual' });
    const cb2 = await fetch(`${s.url}/auth/vkid/callback?${m.authorize(st2.headers.get('location')!, 8001)}`, { redirect: 'manual' });
    assert.equal(cb2.headers.get('location'), '/play#vkid=linked&vknote=1');
    assert.equal((await fetch(`${s.url}/auth/vkid/link`, { method: 'POST', body: JSON.stringify({ token: 'nope' }) })).status, 401);
    assert.deepEqual(await (await fetch(`${s.url}/auth/vkid/status`, { method: 'POST', body: JSON.stringify({ token: tok }) })).json(), { linked: true, notify: false });
    // `?link=1` without a ticket: refused, never a sign-in
    const l1 = await fetch(`${s.url}/auth/vkid/start?link=1`, { redirect: 'manual' });
    assert.equal(l1.headers.get('location'), `/play#vkid-error=${encodeURIComponent(VKID_ERR.expired)}`);
  } finally {
    s.close();
  }
});

test('rate limit: thirty asks a minute from one address, then a refusal', async () => {
  const { vkid } = setup();
  const s = await serve(vkid);
  try {
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await fetch(`${s.url}/auth/vkid/link`, { method: 'POST', body: '{}' })).status;
    assert.equal(last, 429);
    assert.equal((await fetch(`${s.url}/auth/vkid/config`)).status, 200, 'the config is never held back');
  } finally {
    s.close();
  }
});

test('the words: every English line has its Russian, Cyrillic but for VK\'s own names; the server\'s refusals read in Russian', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) {
    assert.ok(v.trim(), k);
    assert.doesNotMatch(v.replace(/VK ID|VK|\{\w+\}/g, ''), /[A-Za-z]/, `RU ${k}: ${v}`);
  }
  assert.equal(RU.login, 'Войти через VK ID');
  assert.equal(RU.link, 'Привязать VK');
  assert.equal(RU.note, 'Чтобы получать оповещения в VK, откройте игру в VK и разрешите уведомления.');
  for (const e of Object.values(VKID_ERR)) assert.ok(SERVER_RU_TG[e] ?? SERVER_RU_A[e], e);
});
