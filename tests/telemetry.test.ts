import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Telemetry, deviceClass, setTelemetry } from '../server/src/http/telemetry.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { join, makeGame } from './helpers.ts';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';

test('telemetry: reports fold into daily aggregates — frame-rate percentiles, load bins, errors deduplicated, devices counted', () => {
  const t = new Telemetry(':memory:');
  const bins = (at: number, n: number) => Object.assign(new Array<number>(13).fill(0), { [at]: n });
  t.ingest({ id: 'device-one-xyz', tg: true, mem: 4, heap: 120, fps: { sea: bins(11, 90), battle: bins(5, 10) }, loads: [{ k: 'boot', ms: 3200 }, { k: 'isle', ms: 700, to: true }], errs: [{ m: 'TypeError: x is undefined', s: 'at a (client/src/main.ts:10:5)', n: 2 }] }, ANDROID);
  t.ingest({ id: 'device-one-xyz', fps: { sea: bins(2, 10) }, errs: [{ m: 'TypeError: x is undefined', s: 'at a (client/src/main.ts:10:5)' }] }, ANDROID);
  t.ingest({ id: 'device-two-abc', plat: 'Windows', fps: { sea: bins(12, 100), bogus: bins(1, 5) } }, 'Mozilla/5.0 (Windows NT 10.0)');
  const s = t.summary(1);
  assert.equal(s.reports, 3);
  assert.equal(s.devices, 2);
  const sea = s.fps.find((f) => f.scene === 'sea' && f.dev === 'all')!;
  assert.equal(sea.n, 200);
  assert.equal(sea.p50, 55, 'half the seconds at 55–60 fps or better');
  assert.equal(sea.p95, 10, 'the worst 5 %: the 10–15 fps seconds');
  assert.ok(!s.fps.some((f) => f.scene === 'bogus'), 'unknown scenes are dropped');
  assert.equal(s.loads.find((l) => l.kind === 'isle' && l.dev === 'all')!.timeouts, 1);
  assert.equal(s.loads.find((l) => l.kind === 'boot' && l.dev === 'all')!.p50, 4000);
  assert.deepEqual(s.errors.map((e) => e.n), [3], 'one error, counted three times');
  assert.equal(s.devs.find((d) => d.dev === 'android-tg')!.mem, 4);
  assert.ok(!JSON.stringify(s).includes('device-one-xyz'), 'the install id is kept only as a hash');
  assert.equal(deviceClass({ mob: true }, 'Mozilla/5.0 (Windows NT 10.0)'), 'windows-mobile');
  assert.equal(t.line(1).boot, 4);
  t.close();
});

test('telemetry over HTTP: posts accepted and rate-limited; the admin page only behind its token (an HttpOnly cookie), 404 without one', async () => {
  const t = new Telemetry(':memory:');
  let token = 'a-test-token-of-32-characters-xx';
  const server = createServer(async (req, res) => {
    if (!(await t.handle(req, res, token))) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await fetch(`${base}/telemetry`, { method: 'POST', body: JSON.stringify({ fps: { sea: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] } }) })).status);
    assert.deepEqual(codes, [204, 204, 204, 204, 204, 204, 429, 429]);
    assert.equal(t.summary(1).reports, 6);
    const login = await (await fetch(`${base}/telemetry/admin`)).text();
    assert.match(login, /name="token"/);
    assert.doesNotMatch(login, /Кадры/);
    const bad = await fetch(`${base}/telemetry/admin`, { method: 'POST', body: 'token=wrong', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    assert.equal(bad.status, 403);
    const ok = await fetch(`${base}/telemetry/admin`, { method: 'POST', body: `token=${token}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
    assert.equal(ok.status, 303);
    const cookie = ok.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/);
    assert.ok(!cookie.includes(token), 'the cookie is not the token');
    const page = await (await fetch(`${base}/telemetry/admin`, { headers: { cookie: cookie.split(';')[0] } })).text();
    assert.match(page, /Кадры в секунду/);
    token = '';
    assert.equal((await fetch(`${base}/telemetry/admin`)).status, 404, 'no token in the env: no page');
  } finally {
    server.close();
    t.close();
  }
});

test('the admin console\'s /telemetry: the summary line, in Russian too; off without telemetry', () => {
  const was = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const { game } = makeGame();
    const c = join(game, 'Tel Tester');
    setTelemetry(null);
    c.push({ t: 'chat', text: '/telemetry' });
    assert.equal(c.all('toast').at(-1)!.msg, 'Telemetry is off on this server.');
    const t = new Telemetry(':memory:');
    setTelemetry(t);
    t.ingest({ id: 'device-one-xyz', fps: { sea: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0] } }, ANDROID);
    c.push({ t: 'chat', text: '/telemetry 7' });
    const msg = c.all('toast').at(-1)!.msg;
    assert.match(msg, /^Telemetry for 7 d: 1 reports from 1 devices; at sea 55 fps typical/);
    assert.ok(SERVER_RU_ADMIN['Telemetry is off on this server.']);
    c.push({ t: 'chat', text: '/help' });
    const help = c.all('toast').at(-1)!.msg;
    assert.ok(help.includes('/telemetry [days]') && SERVER_RU_ADMIN[help]?.includes('/telemetry [дни]'), 'in HELP and its Russian pair');
    setTelemetry(null);
    t.close();
  } finally {
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
});
