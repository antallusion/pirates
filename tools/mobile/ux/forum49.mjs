// Proof shots (forum post 49 + the owner's volume table, 2026-11-02): the market (the ship's stores without «Продать»,
// the fractional «м³/шт»), the ferry list (the quest's discount, the pirate flag's price), the quiet harbour on the chart
// and the minimap. RU.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f49.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/forum49.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum49';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const HUB = 'hollowmere', QUEST_HUB = process.env.QHUB ?? 'tidewrack';
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const out = {};
const clean = (p) => p.evaluate(() => {
  globalThis.gravetide.open(null);
  document.getElementById('promo-over')?.querySelector('[data-polater]')?.click();
  for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
}).catch(() => {});
async function snap(p, path) {
  await p.evaluate(() => document.querySelectorAll('.k-hint').forEach((x) => x.remove())).catch(() => {});
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
const tab = (p, id) => p.evaluate((t) => document.querySelector(`[data-ptab="${t}"]`)?.click(), id);
/** The market's rows as measured: per-unit volume in the line, the stores without «Продать». */
const marketCheck = (p) => p.evaluate(() => [...document.querySelectorAll('.mk-row')].map((r) => ({
  good: r.dataset.good, store: r.classList.contains('mk-store'), sell: !!r.querySelector('[data-act="sell"]'), line: r.querySelector('.w-row-t small')?.textContent.replace(/\s+/g, ' ').trim(),
  past: (() => { const R = r.getBoundingClientRect(); return [...r.querySelectorAll('button, .mk-nosell')].some((x) => x.getBoundingClientRect().right > R.right + 1); })(),
})));
const ferryCheck = (p) => p.evaluate(() => ({
  pirate: document.querySelector('.fy-pirate')?.textContent.trim() ?? null,
  rows: [...document.querySelectorAll('.fy-row')].map((r) => ({ text: r.innerText.replace(/\s+/g, ' ').trim(), quest: r.classList.contains('fy-row--quest'), was: r.querySelector('.fy-was')?.textContent ?? null })),
}));

try {
  for (const [W, H] of [[1366, 768], [844, 390]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
    await L.login(p, { port, know: true });
    await L.say(p, '/level 20');
    await L.say(p, '/silver 200000');
    await L.sleep(600);
    await L.say(p, `/tp ${HUB}`);
    await L.sleep(1500);
    await L.send(p, { t: 'dock' });
    await L.sleep(2500);
    for (const [g, n] of [['provisions', 80], ['sailcloth', 12], ['planks', 20], ['rum', 10], ['pearls', 2], ['spices', 4]]) await L.say(p, `/give ${g} ${n}`);
    await L.sleep(1200);
    for (let i = 0; i < 3; i++) { await clean(p); await L.sleep(400); }
    // 1. the market
    await L.open(p, 'port');
    await L.sleep(1200);
    await tab(p, 'market');
    await L.sleep(1000);
    out[`market_${tag}`] = await marketCheck(p);
    await snap(p, `${OUT}/market_${tag}.png`);
    // (the stores' rows into view: provisions first, then sailcloth)
    await p.evaluate(() => document.querySelector('.mk-row[data-good="sailcloth"]')?.scrollIntoView({ block: 'center' }));
    await L.sleep(500);
    await snap(p, `${OUT}/market_stores_${tag}.png`);
    // 2. the ferry list: a quest whose goal lies by another hub, the pirate flag
    await L.say(p, '/fog all');
    await L.say(p, `/fquest ${QUEST_HUB}`);
    await L.say(p, '/flag pirate');
    await L.sleep(1500);
    out[`toasts_${tag}`] = await L.toasts(p);
    await L.open(p, null);
    // (the harbour's view anew: out and in again)
    await L.send(p, { t: 'trade', good: 'provisions', qty: 1 }); // (a purchase sends the harbour's view anew)
    await L.sleep(1500);
    await L.open(p, 'port');
    await L.sleep(1200);
    await tab(p, 'ferry');
    await L.sleep(1000);
    out[`ferry_${tag}`] = await ferryCheck(p);
    await snap(p, `${OUT}/ferry_${tag}.png`);
    // 3. the chart: the quiet harbour about the hub
    await L.open(p, null);
    await L.open(p, 'map');
    await L.sleep(1200);
    await p.evaluate((h) => {
      const g = globalThis.gravetide, pt = g.state.ports.find((x) => x.id === h), m = g.chart;
      if (pt && m) { if (m.layers instanceof Set) { m.layers.clear(); m.layers.add('ports'); } m.zoom = 24; m.focus(g.state, pt.x, pt.y); }
    }, HUB);
    await L.sleep(1500);
    await snap(p, `${OUT}/chart_${tag}.png`);
    // 4. at sea by the hub: the minimap's ring
    await L.open(p, null);
    await L.send(p, { t: 'undock' });
    await L.sleep(5000);
    for (let i = 0; i < 2; i++) { await clean(p); await L.sleep(400); }
    await snap(p, `${OUT}/minimap_${tag}.png`);
    await p.locator('#minimap').screenshot({ path: `${OUT}/minimap_zoom_${tag}.png` }).catch(() => {});
    out[`errors_${tag}`] = p.errors.slice(0, 5);
    await p.ctx.close();
  }
} finally {
  console.log(JSON.stringify(out, null, 1));
  await b.close();
}
