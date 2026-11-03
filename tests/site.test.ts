// The website (tools/site/build.ts): built from the game's tables, every page there in both tongues, every picture of the
// site kit it names on disk, the typography's non-breaking spaces where the owner's brief asks for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS } from '../shared/src/data/army.ts';
import { typo } from '../tools/site/typo.ts';

const SITE = join(import.meta.dirname, '..', 'site');

test('every creature has its page in Russian and in English', () => {
  for (const id of Object.keys(UNITS)) {
    assert.ok(existsSync(join(SITE, 'creatures', `${id}.html`)), `ru ${id}`);
    assert.ok(existsSync(join(SITE, 'en', 'creatures', `${id}.html`)), `en ${id}`);
  }
});

test('every site picture and font a page or the stylesheet names is on disk', () => {
  const pages = ['index.html', 'creatures/index.html', 'captains/index.html', 'ships/index.html', 'creatures/crab.html'];
  const texts = [...pages.map((p) => readFileSync(join(SITE, p), 'utf8')), readFileSync(join(SITE, 'css', 'site.css'), 'utf8'), readFileSync(join(SITE, 'css', 'fonts.css'), 'utf8')];
  const refs = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\/site\/((?:img|fonts|css|js)\/[\w./-]+?\.(?:webp|woff2|css|js))/g)) refs.add(m[1]);
  assert.ok(refs.size > 30);
  for (const r of refs) assert.ok(existsSync(join(SITE, r)), r);
});

test('the Russian pages carry the creature names of the game, the English ones theirs', () => {
  const html = readFileSync(join(SITE, 'creatures', 'index.html'), 'utf8');
  assert.match(html, /Береговые крабы/);
  assert.match(html, /lang="ru"/);
  const en = readFileSync(join(SITE, 'en', 'creatures', 'index.html'), 'utf8');
  assert.match(en, /Shore crabs/);
});

test('typography: no lone last word, no dash starting a line, short words held to the next', () => {
  const t = typo('Корабль — это армия и капитан у штурвала в бурю', 'ru');
  assert.ok(t.includes(' —'), 'a dash is held to the word before it');
  assert.ok(/в бурю$/.test(t), 'the last words are held together');
  assert.ok(t.includes('и капитан'), 'a short word is held to the next');
});

test('the site kit is there', () => {
  assert.ok(readdirSync(join(SITE, 'img', 'ico')).length >= 40);
  assert.ok(existsSync(join(SITE, 'img', 'brand', 'logo.webp')));
});

test('the root of the public domain is the website, /play and the Telegram host are the game', async () => {
  const { createServer } = await import('node:http');
  const { createStaticHandler } = await import('../server/src/net/static.ts');
  const handle = createStaticHandler(join(import.meta.dirname, '..'));
  const srv = createServer((req, res) => { handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  const get = async (path: string, host: string) => {
    const { request } = await import('node:http');
    return new Promise<string>((ok, bad) => {
      const rq = request({ host: '127.0.0.1', port, path, headers: { host } }, (rs) => { let b = ''; rs.setEncoding('utf8'); rs.on('data', (c) => (b += c)); rs.on('end', () => ok(b)); });
      rq.on('error', bad);
      rq.end();
    });
  };
  try {
    const site = /class="pg-home"/;
    assert.match(await get('/', 'gravetidegame.com'), site);
    assert.doesNotMatch(await get('/play', 'gravetidegame.com'), site);
    assert.doesNotMatch(await get('/', 'tg.gravetidegame.com'), site);
    assert.doesNotMatch(await get('/?battle', 'gravetidegame.com'), site);
    assert.doesNotMatch(await get('/', 'localhost'), site);
  } finally {
    srv.close();
  }
});

test('search engines: robots and the sitemap at the root, every page with canonical, hreflang pairs and valid JSON-LD', async () => {
  const sm = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
  assert.match(sm, /<loc>https:\/\/gravetidegame\.com\/<\/loc>/);
  assert.ok((sm.match(/<url>/g) ?? []).length > 500);
  const rb = readFileSync(join(SITE, 'robots.txt'), 'utf8');
  assert.match(rb, /Sitemap: https:\/\/gravetidegame\.com\/sitemap\.xml/);
  assert.match(rb, /Disallow: \/api\//);
  for (const p of ['index.html', 'creatures/crab.html', 'en/ships/index.html', 'captains/index.html']) {
    const h = readFileSync(join(SITE, p), 'utf8');
    assert.match(h, /<link rel="canonical" href="https:\/\/gravetidegame\.com\//, p);
    assert.match(h, /hreflang="en"/, p);
    assert.match(h, /hreflang="x-default"/, p);
    assert.match(h, /og:image" content="https:\/\//, p);
    for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(m[1]), p);
  }
  assert.match(readFileSync(join(SITE, 'index.html'), 'utf8'), /"@type":"VideoGame"/);
  const { createServer, request } = await import('node:http');
  const { createStaticHandler } = await import('../server/src/net/static.ts');
  const handle = createStaticHandler(join(import.meta.dirname, '..'));
  const srv = createServer((req, res) => { handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  const get = (path: string) => new Promise<[number, string]>((ok, bad) => { const rq = request({ host: '127.0.0.1', port, path, headers: { host: 'gravetidegame.com' } }, (rs) => { let b = ''; rs.setEncoding('utf8'); rs.on('data', (c) => (b += c)); rs.on('end', () => ok([rs.statusCode ?? 0, `${rs.headers['content-type']}|${b.slice(0, 60)}`])); }); rq.on('error', bad); rq.end(); });
  try {
    const [s1, b1] = await get('/robots.txt');
    assert.equal(s1, 200); assert.match(b1, /text\/plain/);
    const [s2, b2] = await get('/sitemap.xml');
    assert.equal(s2, 200); assert.match(b2, /application\/xml/);
  } finally {
    srv.close();
  }
});
