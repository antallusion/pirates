// owner, 2026-11-07 («тут иконки наложились»): the right column under the chart with «К кораблю» out, a level-3 captain.
import { browser, page, login, sleep, say, closeAll } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const sizes = (process.env.SIZES ?? '844x390,932x430,812x375').split(',');
const b = await browser();
for (const sz of sizes) {
  const [W, H] = sz.split('x').map(Number);
  const p = await page(b, [W, H]);
  await login(p, { port: Number(process.env.GPORT), know: true });
  await say(p, '/level ' + (process.env.LVL ?? '3'));
  await sleep(2500);
  await closeAll(p);
  await p.evaluate(() => document.getElementById('tc-cast')?.click());
  await sleep(4000);
  await closeAll(p);
  if (process.env.HURT) { await say(p, '/hurt 50'); await sleep(2500); }
  await p.evaluate(() => { const g = globalThis.gravetide; g.renderer.panBy(260, 120, g.state.ownDisplay); });
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/H-${sz}.png` });
  const rects = await p.evaluate(() => [...document.querySelectorAll('#touch > *, #hud-top-right > *, #hud > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left > innerWidth * 0.6 && r.top < innerHeight * 0.75 && getComputedStyle(e).display !== 'none'; }).map((e) => { const r = e.getBoundingClientRect(); return `${e.id || e.className}@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
  console.log(sz, rects.join(' | '));
  console.log('body', await p.evaluate(() => document.body.className));
  await p.close();
}
await b.close();
