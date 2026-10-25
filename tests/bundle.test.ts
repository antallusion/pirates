// The client's production bundle and its loader (prod 2026-10-25: phones on mobile data — «Failed to fetch dynamically
// imported module: …/src/main.ts» — could not start the game: some 560 modules asked for one by one, one lost on the
// way failed them all). tools/build-client.ts builds a few hashed files for the browsers' floor (iOS 15 / Safari 15,
// Chrome 80); the server points the page at them (server/src/net/static.ts); the page's loader fetches them, tries
// again, and shows a screen if they never come (client/index.html); the start's end is told to /boot-report.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildClient, TARGET } from '../tools/build-client.ts';
import type { BundleInfo } from '../tools/build-client.ts';
import { hasLookbehind, ROOT } from '../tools/compat-scan.ts';
import { createStaticHandler } from '../server/src/net/static.ts';
import { isBot, reportLine } from '../server/src/http/boot-report.ts';

const dist = mkdtempSync(join(tmpdir(), 'gt-dist-'));
let info: BundleInfo;

test.before(async () => {
  info = await buildClient(ROOT, { out: dist, quiet: true });
});
test.after(() => rmSync(dist, { recursive: true, force: true }));

async function serve(distDir = dist) {
  const h = createStaticHandler(ROOT, { dist: distDir });
  const server = createServer(async (req, res) => {
    if (!(await h(req, res))) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

test('the bundle: the game and the forum in a few hashed files, for the floor, compressed, without a lookbehind', () => {
  assert.deepEqual(TARGET.slice(0, 3), ['safari15', 'ios15', 'chrome80']);
  const main = info.entries.main;
  assert.match(main.file, /^main-[A-Z0-9]{8}\.js$/);
  assert.equal(main.boot[0], main.file, 'the entry first');
  assert.ok(main.boot.length <= 6, `${main.boot.length} files to start (was ~560 modules)`);
  assert.ok(main.lazy.length >= 1, 'the campaign\'s words stay lazy');
  assert.match(info.entries.forum.file, /^forum-[A-Z0-9]{8}\.js$/);
  for (const f of Object.keys(info.sizes)) {
    const js = readFileSync(join(dist, f), 'utf8');
    assert.ok(!hasLookbehind(js), `${f}: no regex lookbehind`);
    assert.ok(!js.includes('??='), `${f}: logical assignment brought down (Chrome 80)`);
    assert.ok(existsSync(join(dist, `${f}.br`)) && existsSync(join(dist, `${f}.gz`)), `${f}: precompressed`);
    if (info.sizes[f].raw > 1024) assert.ok(info.sizes[f].br < info.sizes[f].raw / 2, `${f}: brotli`);
  }
  assert.ok(info.inputs['client/src/main.ts'] > 0 && info.inputs['client/src/compat.ts'] > 0, 'its sources listed (for the staleness check)');
  // the polyfills come first: compat.ts's code before the game's own
  const mainJs = readFileSync(join(dist, main.file), 'utf8');
  assert.ok(mainJs.includes('structuredClone'), 'compat.ts is in');
});

test('the page points at the bundle: the loader starts in the head, before the stylesheets; ?src takes the modules', async () => {
  const s = await serve();
  try {
    const html = await (await fetch(`${s.base}/`)).text();
    const m = /<script>window\.__gtLoad\((\{.*?\})\)<\/script>/.exec(html);
    assert.ok(m, 'the start line is there');
    const cfg = JSON.parse(m[1]) as { mode: string; entry: string; files: { u: string; n: number }[]; lazy: string[]; kb: number };
    assert.equal(cfg.mode, 'bundle');
    assert.equal(cfg.entry, `/dist/${info.entries.main.file}`);
    assert.deepEqual(cfg.files.map((f) => f.u), info.entries.main.boot.map((f) => `/dist/${f}`));
    assert.ok(cfg.files.every((f) => f.n > 0) && cfg.kb > 0);
    assert.ok(html.indexOf('window.__gtLoad({') < html.indexOf('<link rel="stylesheet"'), 'before the stylesheets (a script waits for them)');
    assert.ok(html.indexOf('window.__gtLoad = function') < html.indexOf('window.__gtLoad({'), 'after the loader is defined');
    assert.ok(!html.includes('rel="modulepreload" href="/src/'), 'no module of the sources named');
    const src = await (await fetch(`${s.base}/?src`)).text();
    assert.match(src, /window\.__gtLoad\(\{"mode":"src","build":"[a-z0-9]+","entry":"\/src\/main\.ts\?b=[a-z0-9]+","files":\[\]\}\)/);
    assert.ok((src.match(/rel="modulepreload" href="\/src\//g) ?? []).length > 300, 'the modules named up front, as before');
    const kit = await (await fetch(`${s.base}/?kit`)).text();
    assert.ok(!kit.includes('window.__gtLoad({"'), 'the kit\'s page loads its own modules');
  } finally {
    s.close();
  }
});

test('the bundle\'s files: kept for good, brotli at its best (the .br made at build), the forum\'s page on its bundle', async () => {
  const s = await serve();
  try {
    const f = info.entries.main.file;
    const r = await fetch(`${s.base}/dist/${f}`, { headers: { 'Accept-Encoding': 'br' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(r.headers.get('content-encoding'), 'br');
    assert.equal(Number(r.headers.get('content-length')), info.sizes[f].br);
    assert.match(r.headers.get('content-type') ?? '', /text\/javascript/);
    const forum = await (await fetch(`${s.base}/site/forum/`)).text();
    assert.ok(forum.includes(`<script type="module" src="/dist/${info.entries.forum.file}"></script>`));
    assert.ok(!forum.includes('/src/forum/main.ts'));
    const forumSrc = await (await fetch(`${s.base}/site/forum/?src`)).text();
    assert.ok(forumSrc.includes('<script type="module" src="/src/forum/main.ts"></script>'));
  } finally {
    s.close();
  }
});

test('a bundle older than its sources is not served (the local game being edited): the modules then', async () => {
  const stale = mkdtempSync(join(tmpdir(), 'gt-dist-stale-'));
  try {
    const b = JSON.parse(readFileSync(join(dist, 'bundle.json'), 'utf8')) as BundleInfo;
    b.inputs['client/src/main.ts'] += 1; // as if main.ts had changed since
    writeFileSync(join(stale, 'bundle.json'), JSON.stringify(b));
    const s = await serve(stale);
    try {
      const html = await (await fetch(`${s.base}/`)).text();
      assert.match(html, /window\.__gtLoad\(\{"mode":"src"/);
    } finally {
      s.close();
    }
  } finally {
    rmSync(stale, { recursive: true, force: true });
  }
});

test('the loader: retries with a pause, a stalled fetch given up, the RU/EN screen with «Повторить», ok told with its time', () => {
  const html = readFileSync(join(ROOT, 'client/index.html'), 'utf8');
  assert.ok(html.includes("var WAIT = [1000, 3000, 7000];"), 'three more tries, 1 s, 3 s, 7 s apart');
  assert.ok(html.includes("end(new Error('stalled 25s'))"), 'a fetch that brings nothing for 25 s');
  assert.ok(html.includes("net: 'Не удалось загрузить игру — проверьте интернет', retry: 'Повторить'"));
  assert.ok(html.includes("net: 'Could not load the game — check your connection', retry: 'Retry'"));
  assert.ok(html.includes("send('ok', !debug);"), 'every start that came up is told');
  assert.ok(html.includes("window.__gtImporter((u) => import(u));"), 'the module script hands over its import()');
  assert.ok(html.includes('<script nomodule>'), 'a browser without modules gets the screen, not a dead page');
  assert.ok(html.includes('<!--gt:start-->'));
  const sw = readFileSync(join(ROOT, 'client/sw.js'), 'utf8');
  assert.ok(sw.includes("const CODE = 'gt-code-v1';") && sw.includes('BUNDLE.test(url.pathname)'), 'the service worker keeps the bundle');
});

test('/boot-report: «ok» in one short line with time, mode and size; robots apart, never among the failures', () => {
  const phone = 'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const ok = reportLine({ why: 'ok', ms: 4210.4, mode: 'bundle', kb: 1056, w: 360, h: 676, dpr: 2, ua: phone, path: '/play', log: ['1ms page'] });
  assert.equal(ok, `[boot-report] ok 4210ms bundle 1056KB 360x676@2 /play ua=${phone}`);
  const fail = reportLine({ why: 'fail', ms: 11500, mode: 'bundle', kb: 1056, w: 360, h: 676, dpr: 2, ua: phone, path: '/play', log: ['1ms page', '11452ms FAILED Failed to fetch'] });
  assert.match(fail, /^\[boot-report\] fail 11500ms bundle 1056KB .* :: 1ms page \| 11452ms FAILED Failed to fetch$/);
  for (const ua of ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; YandexRenderResourcesBot/1.0)', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36', 'Mozilla/5.0 (compatible; YandexDirect/3.0)']) {
    assert.ok(isBot(ua), ua);
    assert.match(reportLine({ why: 'fail', ua, log: ['x'] }), /^\[boot-bot\] fail /);
  }
  for (const ua of [phone, 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1'])
    assert.ok(!isBot(ua), ua);
});
