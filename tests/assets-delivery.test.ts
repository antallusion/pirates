import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

async function serve(origin?: string) {
  if (origin) process.env.ASSET_ORIGIN = origin;
  else delete process.env.ASSET_ORIGIN;
  // (a fresh copy of the module: ASSET_ORIGIN is read as it loads)
  const { createStaticHandler } = (await import(`../server/src/net/static.ts?o=${origin ?? ''}`)) as typeof import('../server/src/net/static.ts');
  const h = createStaticHandler(resolve(import.meta.dirname, '..'));
  const server = createServer(async (req, res) => {
    if (!(await h(req, res))) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

test('docs/33: the versioned manifest names the AVIF twins and the sheets; an AVIF is served immutable, with CORS', async () => {
  const s = await serve();
  try {
    const m = (await (await fetch(`${s.base}/assets/manifest.v.json`)).json()) as { origin?: string; assets: Record<string, { a?: string; s?: [string, number, number, number, number] }>; sheets: Record<string, { file: string; v: string; a?: string }> };
    assert.equal(m.origin, undefined, 'no ASSET_ORIGIN: the page\'s own host');
    const u = m.assets['unit.marine'];
    assert.ok(u.a && u.s && u.s[0] === 'unit-marine', 'a figure: its AVIF and its place in its sheet');
    const sh = m.sheets['unit-marine'];
    assert.ok(sh.v && sh.a);
    const r = await fetch(`${s.base}/assets/${sh.file.replace('.webp', '.avif')}?v=${sh.a}`);
    assert.equal(r.headers.get('content-type'), 'image/avif');
    assert.match(r.headers.get('cache-control') ?? '', /immutable/);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  } finally {
    s.close();
  }
  const c = await serve('https://cdn.example.com/');
  try {
    const m = (await (await fetch(`${c.base}/assets/manifest.v.json`)).json()) as { origin?: string };
    assert.equal(m.origin, 'https://cdn.example.com');
  } finally {
    c.close();
    delete process.env.ASSET_ORIGIN;
  }
});

test("the owner's UI pack (2026-10-17): the page asks for its title paintings, logo and first loading screen by version", async () => {
  const s = await serve();
  try {
    const html = await (await fetch(`${s.base}/`)).text();
    const m = (await (await fetch(`${s.base}/assets/manifest.v.json`)).json()) as { assets: Record<string, { v?: string; a?: string; m?: string; ma?: string }> };
    // the wide painting on a desk, the captain at the wheel on a phone on its side: AVIF preloaded, the WebP behind it
    for (const k of ['wide', 'mobile']) {
      const e = m.assets[`art.title_${k}`];
      assert.ok(e?.v && e.a, k);
      assert.ok(html.includes(`/assets/art/title_${k}.avif?v=${e.a}`) && html.includes(`/assets/art/title_${k}.webp?v=${e.v}`), k);
    }
    for (const px of [256, 512, 1024]) assert.ok(html.includes(`/assets/ui/logo_${px}.webp?v=`) && html.includes(`/assets/ui/logo_${px}.avif?v=`), `logo ${px}`);
    // each loading screen has its phone copy; the first start's is preloaded at the very address the game asks for
    for (const k of ['start', 'isle', 'battle', 'sea']) assert.ok(m.assets[`art.load_${k}`]?.m && m.assets[`art.load_${k}`].ma, k);
    assert.ok(html.includes(`/assets/art/load_start.m.avif?v=${m.assets['art.load_start'].ma}`));
    assert.ok(html.includes(`/assets/art/load_start.avif?v=${m.assets['art.load_start'].a}`));
    for (const f of ['/favicon-32.png', '/icon-192.png', '/apple-touch-icon.png', '/assets/brand/og_image.jpg']) assert.equal((await fetch(`${s.base}${f}`)).status, 200, f);
  } finally {
    s.close();
  }
});
