// The site header's «Мир игры» drop-down (owner 2026-11-03): shots at three widths, closed and open, plus the phone drawer.
import * as L from '../m0/lib.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:58840';
const OUT = 'assets/raw/audit/hdr';
const b = await L.browser();
for (const [W, H] of [[1366, 380], [1100, 380], [390, 700]]) {
  const p = await L.page(b, [W, H], { touch: W < 900 });
  await p.goto(`${BASE}/site/creatures/`, { waitUntil: 'load' });
  await L.sleep(600);
  await p.screenshot({ path: `${OUT}/hdr-${W}.png` });
  if (W >= 900) {
    await p.click('.hdr-dd-btn');
    await L.sleep(300);
    await p.screenshot({ path: `${OUT}/hdr-${W}-open.png` });
    const info = await p.evaluate(() => ({ bar: [...document.querySelectorAll('#nav > *')].map((e) => (e.classList.contains('off') ? '-' : '') + e.textContent.trim()), drawer: [...document.querySelectorAll('.hdr-drawer nav a.more')].map((a) => a.textContent.trim()) }));
    console.log(W, JSON.stringify(info));
  } else {
    await p.click('.hdr-burger');
    await L.sleep(300);
    await p.screenshot({ path: `${OUT}/hdr-${W}-drawer.png` });
  }
  console.log(W, 'errors', p.errors);
  await p.ctx.close();
}
await b.close();
