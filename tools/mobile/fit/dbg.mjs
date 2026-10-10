// Debug: log in on my server at 640×360, open a window, print its panes' state.  node tools/mobile/fit/dbg.mjs research [js]
import * as L from '../m0/lib.mjs';
const [win = 'research', js] = process.argv.slice(2);
const b = await L.browser();
const p = await L.page(b, [640, 360], { lang: 'ru' });
const t = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 150000);
await L.login(p, { port: 58997, know: true });
await L.say(p, '/level 30'); await L.sleep(800);
await p.evaluate(() => document.querySelectorAll('[data-lulater]').forEach((x) => x.click()));
await p.evaluate((w) => { globalThis.gravetide.open(null); w.startsWith('hero') ? globalThis.gravetide.hero(w.split(':')[1]) : globalThis.gravetide.open(w); }, win); await L.sleep(1200);
if (js) { await p.evaluate(js); await L.sleep(800); }
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#modal-panel .modal-body, .k-sheet-body')].map((e) => { const cs = getComputedStyle(e); return { cls: e.className, sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth, cc: cs.columnCount, h: cs.height, ov: cs.overflowY, disp: cs.display, flex: cs.flex }; })), null, 1));
console.log('bar', await p.evaluate(() => [...document.querySelectorAll('.fit-pager')].map((x) => x.textContent)));
console.log(p.errors.slice(-5));
await p.screenshot({ path: `assets/raw/audit/fit/dbg_${win.replace(':', '_')}.png` });
clearTimeout(t);
await b.close();
