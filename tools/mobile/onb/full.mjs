// The whole HUD after the watch, the menu open: the inventory of what the ladder hides.
import { browser, page, login, sleep, closeAll } from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/onb';
const b = await browser();
const p = await page(b, [1280, 720]);
await login(p, { port: Number(process.env.GPORT), know: true });
await closeAll(p);
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
await sleep(5000);
await closeAll(p);
await p.screenshot({ path: `${OUT}/full-sea.png` });
const vis = () => p.evaluate(() => [...document.querySelectorAll('button, [role=button], a')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; }).map((e) => (e.id || e.className.toString().split(' ')[0]) + '|' + (e.dataset.act || e.dataset.menu || e.dataset.k || '') + '|' + (e.getAttribute('aria-label') || e.title || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)));
console.log('SEA', JSON.stringify(await vis(), null, 0));
await p.evaluate(() => document.getElementById('tc-menu')?.click());
await sleep(1500);
await p.screenshot({ path: `${OUT}/full-menu.png` });
console.log('MENU', JSON.stringify(await vis(), null, 0));
await b.close();
