// The newcomer's first screens (VK moderation 4.2.4, 2026-11-05): what she sees from the login on.
import { browser, page, login, sleep } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const b = await browser();
for (const [tag, size] of [['land', [812, 375]], ['port', [375, 812]], ['desk', [1280, 720]]]) {
  const p = await page(b, size);
  await p.goto(`http://localhost:${process.env.GPORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await p.screenshot({ path: `${OUT}/${tag}-0-login.png` });
  await login(p, { port: Number(process.env.GPORT), prologue: 'skip' });
  for (let i = 0; i < 4; i++) { await p.screenshot({ path: `${OUT}/${tag}-${i + 1}-hud.png` }); await sleep(6000); }
  const vis = await p.evaluate(() => [...document.querySelectorAll('button, [role=button], .chip')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; }).map((e) => (e.id || e.className.toString().split(' ')[0]) + ':' + (e.getAttribute('aria-label') || e.title || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)));
  console.log(tag, vis.length, JSON.stringify(vis));
  console.log('errors', p.errors.slice(0, 5));
  await p.ctx.close();
}
await b.close();
