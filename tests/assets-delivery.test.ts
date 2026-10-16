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
