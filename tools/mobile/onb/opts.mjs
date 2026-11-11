// owner, 2026-11-11: the options' mixer (a slider a kind of sound) and the graphics tab, at each size.
import { browser, page, login, sleep, closeAll } from '../m0/lib.mjs';
const OUT = 'assets/raw/audit/opt';
const b = await browser();
for (const sz of (process.env.SIZES ?? '844x390,1440x900').split(',')) {
  const [W, H] = sz.split('x').map(Number);
  const p = await page(b, [W, H]);
  await login(p, { port: Number(process.env.GPORT), know: true });
  await sleep(1500);
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.open('options'));
  await sleep(800);
  await p.screenshot({ path: `${OUT}/${sz}-0-main.png` });
  await p.evaluate(() => document.querySelector('[data-omore]')?.click());
  await sleep(400);
  for (const tab of ['sound', 'gfx']) {
    await p.evaluate((x) => document.querySelector(`[data-otab="${x}"]`)?.click(), tab);
    await sleep(500);
    await p.screenshot({ path: `${OUT}/${sz}-${tab}.png` });
  }
  // the ultra preset, the counter on
  await p.evaluate(() => { document.querySelector('[data-oquality="ultra"]')?.click(); });
  await sleep(300);
  await p.evaluate(() => { const c = document.querySelector('input[data-bool="showFps"]'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await sleep(300);
  await closeAll(p);
  await sleep(1500);
  const st = await p.evaluate(() => ({ dpr: globalThis.gravetide.renderer.dpr, fps: document.getElementById('fps-meter')?.textContent, s: JSON.parse(localStorage.getItem('gravetide.settings') || '{}') }));
  console.log(sz, 'dpr', st.dpr, 'fps', st.fps, 'q', st.s.renderScale, st.s.sharpness, st.s.effects, st.s.fpsCap, 'vol', JSON.stringify(st.s.volume));
  await p.screenshot({ path: `${OUT}/${sz}-ultra-sea.png` });
  console.log('errors', p.errors.slice(0, 4));
  await p.close();
}
await b.close();
