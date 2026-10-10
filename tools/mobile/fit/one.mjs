// One PRE screen at given sizes on my server, with the fit numbers:  node tools/mobile/fit/one.mjs captain 640x360,812x375 ru [card]
import * as L from '../m0/lib.mjs';
import { readFileSync } from 'node:fs';
import { PRE } from './screens.mjs';
const FIT = readFileSync(new URL('./measure.js', import.meta.url), 'utf8');
const [id, sizes = '640x360', lang = 'ru', card] = process.argv.slice(2);
const s = PRE.find((x) => x.id === id);
const b = await L.browser();
const dims = sizes.split(',').map((z) => z.split('x').map(Number));
const p = await L.page(b, dims[0], { lang, touch: dims[0][0] < 1000 });
await s.go(p, { port: Number(process.env.PORT ?? 58997), lang });
if (card) { await p.click(`.captain-card[data-id="${card}"]`); await L.sleep(300); }
for (const [w, h] of dims) {
  await p.setViewportSize({ width: w, height: h });
  if (s.resize) await s.resize(p);
  await L.sleep(500);
  await p.evaluate(FIT);
  const r = await p.evaluate((q) => globalThis.__fit(q), s.root);
  console.log(`${w}x${h}`, JSON.stringify({ scroll: r.scroll, out: r.out, cut: r.cut, small: r.small, tiny: r.tiny, page: r.page }));
  await p.screenshot({ path: `assets/raw/audit/fit/one_${id}_${card ?? ''}_${w}x${h}_${lang}.png` });
}
await b.close();
