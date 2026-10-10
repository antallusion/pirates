// Quick look at the port window at one size.
import * as L from '../m0/lib.mjs';
import { readFileSync } from 'node:fs';
const FIT = readFileSync(new URL('./measure.js', import.meta.url), 'utf8');
const [W, H, lang] = [Number(process.argv[2] ?? 640), Number(process.argv[3] ?? 360), process.argv[4] ?? 'ru'];
const OUT = 'assets/raw/audit/fit';
const b = await L.browser();
const p = await L.page(b, [W, H], { lang });
await L.login(p, { port: 58997, know: true });
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await L.say(p, '/level 30'); await L.sleep(800); await L.say(p, '/silver 50000'); await L.sleep(800);
await L.closeAll(p);
await p.screenshot({ path: `${OUT}/peek2_quay.png` });
await L.open(p, 'port'); await L.sleep(1200);
await p.evaluate(FIT);
const tabs = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-ptab]')].map((t) => t.dataset.ptab));
console.log(tabs);
for (const t of tabs) {
  await p.evaluate((t) => document.querySelector(`#modal-panel [data-ptab="${t}"]`)?.click(), t); await L.sleep(700);
  const r = await p.evaluate(() => globalThis.__fit('#modal-panel'));
  console.log(t, 'scroll', r.scroll.join(' | '), 'cut', r.cut.length, 'small', r.small.length, 'tiny', r.tiny.length, 'out', r.out.length);
  await p.screenshot({ path: `${OUT}/peek2_${t}.png` });
}
await b.close();
