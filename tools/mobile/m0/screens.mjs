// docs/23 phase 0, items 3 and 6 (and phase 9's «after»): every main screen on a phone on its side — how many tap
// targets it has (and how many under 44 px), and what share of the screen still shows the sea (measure.js) — and the
// frame rate at sea (requestAnimationFrame over 6 s, as is and with the CPU slowed 4× like a mid phone).
//
//   GPORT=58791 SIZE=phone LANG2=ru OUT=assets/raw/audit/m0 node assets/raw/audit/m0/screens.mjs
import * as L from './lib.mjs';
import { writeFileSync } from 'node:fs';

const size = process.env.SIZE ?? 'phone', lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/m0';
const b = await L.browser();
const p = await L.page(b, L.SIZES[size], { lang, films: true });
const rows = [];
const kit = () => p.evaluate(async () => { if (typeof globalThis.__sea !== 'function') await (0, eval)(await (await fetch('/assets/raw/audit/m0/measure.js?' + Date.now())).text()); });
async function measure(name, extra = {}) {
  await kit();
  await L.sleep(500);
  const r = await p.evaluate(() => ({ t: globalThis.__targets(), sea: globalThis.__sea() }));
  await p.screenshot({ path: `${OUT}/screen_${size}_${lang}_${name}.png` });
  rows.push({ screen: name, targets: r.t.n, small: r.t.small, sea: r.sea, ...extra, list: r.t.list });
  L.log(name, r.t.n, 'targets', r.t.small, 'small', r.sea + '% sea');
}
const admin = async (line, ms = 1500) => { await L.say(p, line); await L.sleep(ms); };
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
async function fps(label, throttle = 1) {
  const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await L.sleep(800);
  const r = await p.evaluate(() => new Promise((done) => {
    const ts = [];
    const t0 = performance.now();
    const f = (t) => { ts.push(t); if (t - t0 < 6000) requestAnimationFrame(f); else {
      const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
      done({ fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), long: d.filter((x) => x > 50).length });
    } };
    requestAnimationFrame(f);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  rows.push({ screen: `fps ${label}`, cpu: `${throttle}×`, ...r });
  L.log('fps', label, throttle + '×', JSON.stringify(r));
}

await L.login(p, { name: (lang === 'ru' ? 'Экран' : 'Screen') + Math.random().toString(36).slice(2, 5), know: true });
await skip();
// Layout is measured, not motion: windows stand still (a software-rendered frame slid them in late).
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await admin('/level 12');
await admin('/silver 20000');
await L.closeAll(p);
await measure('port_quay');
await p.evaluate(() => globalThis.gravetide.open('port'));
await L.sleep(900);
// docs/23 phase 6: the port's five places down the rail and the second row's chips.
for (const tab of ['market', 'shipyard', 'tavern', 'quests', 'harbour', 'holdings', 'exchange']) {
  await p.evaluate((t) => document.querySelector(`#modal-panel [data-ptab="${t}"]`)?.click(), tab);
  await L.sleep(700);
  await measure(`port_${tab}`);
}
await L.closeAll(p);
await L.send(p, { t: 'undock' }); await L.sleep(2500); await skip(); await L.closeAll(p);
await admin('/tp 21000 70000', 3000); await skip(); await L.closeAll(p);
await measure('sea');
await fps('sea', 1);
await fps('sea', 4);
await admin('/foe pirate sloop 260', 2500);
await measure('sea_combat');
await fps('sea_combat', 4);
for (const m of ['menu', 'hero', 'gear', 'ship', 'crew', 'map', 'journal', 'company', 'talents', 'options']) {
  await p.evaluate((x) => { globalThis.gravetide.open(null); globalThis.gravetide.open(x); }, m);
  await L.sleep(900);
  await measure(`win_${m}`);
}
await L.closeAll(p);
await admin('/board pirate sloop 12', 4000); await skip(); await L.sleep(1500); await skip();
await measure('battle');
await fps('battle', 4);
await p.evaluate(() => document.querySelector('[data-book]')?.click()); await L.sleep(800);
await measure('battle_book');

const out = { at: new Date().toISOString(), size, lang, rows, errors: p.errors.slice(-10) };
writeFileSync(`${OUT}/screens_${size}_${lang}.json`, JSON.stringify(out, null, 1));
console.log(rows.map((r) => r.targets !== undefined ? `${r.screen.padEnd(16)} ${String(r.targets).padStart(3)} targets (${r.small} <44px)  sea ${r.sea}%` : `${r.screen.padEnd(16)} ${r.cpu} ${r.fps} fps p50 ${r.p50} ms p95 ${r.p95} ms long ${r.long}`).join('\n'));
await b.close();
