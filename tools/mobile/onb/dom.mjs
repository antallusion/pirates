// What the sea HUD shows in the First Watch (each visible block with an id, its box): the map of what to reveal.
import { browser, page, login, sleep } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const b = await browser();
for (const [W, H] of [[812, 375], [1280, 720]]) {
  const p = await page(b, [W, H]);
  await login(p, { port: Number(process.env.GPORT) });
  await sleep(2000);
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
  await sleep(5000);
  await p.screenshot({ path: `${OUT}/D-${W}-sea.png` });
  const list = await p.evaluate(() => [...document.querySelectorAll('[id]')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 6 && r.height > 6 && r.width < innerWidth * 0.9 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && !e.closest('#modal-panel'); }).map((e) => { const r = e.getBoundingClientRect(); return `${e.id}@${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
  console.log(W, 'stage', await p.evaluate(() => globalThis.gravetide.state.onboarding?.stage), list.join(' | '));
  await p.ctx.close();
}
await b.close();
