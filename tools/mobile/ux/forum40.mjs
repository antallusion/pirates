// Proof shots (forum post 40): «Журнал» → «Хроника» (the chronicle with its time, icons and filters), the chart's
// layers and «Условные знаки», a beaten lair's «вернётся через …». 844×390 and 1366×768, RU.
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f40.db node server/src/main.ts
//   GPORT=58820 node tools/mobile/ux/forum40.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum40';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58820);
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
async function snap(p, path) {
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) L.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
/** Whether a box spills out of the window, and the lines' overflow (numbers, not eyes). */
const fit = (p, sel) => p.evaluate((q) => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  for (const el of document.querySelectorAll(q)) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (r.left < -1 || r.right > W + 1) out.push(`${el.className}: x ${Math.round(r.left)}..${Math.round(r.right)}`);
    if (el.scrollWidth > el.clientWidth + 2) out.push(`${el.className}: text wider ${el.scrollWidth}>${el.clientWidth}`);
  }
  return out;
}, sel);

try {
  for (const [W, H] of [[844, 390], [1366, 768]].filter(([w]) => !process.env.ONLY || String(w) === process.env.ONLY)) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await dismiss(p);
    await L.say(p, '/level 14');
    await L.say(p, '/god on');
    await L.say(p, '/weather calm');
    await L.sleep(800);
    // Things to write: the sample day log, the sea's small things, a lane buoy, a wreck field, a lair beaten.
    await L.say(p, '/log');
    for (const c of ['/find bottle', '/find bottle done', '/seamark wreck', '/seamark wreck done', '/seamark drift', '/seamark drift done', '/seamark buoy', '/seamark buoy done', '/find calm', '/find calm done', '/find boat', '/find boat done']) {
      await L.say(p, c);
      await L.sleep(900);
    }
    await L.say(p, '/lair go');
    await L.sleep(3000);
    await dismiss(p);
    await L.say(p, '/lair beat');
    await L.sleep(1500);
    await L.say(p, '/sink'); // «кто тебя убил»: the chronicle's line of her going down
    await L.sleep(9000);
    await L.closeAll(p);
    await dismiss(p);
    // 1. «Журнал» → «Хроника»
    await L.closeAll(p);
    await L.open(p, 'journal');
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('[data-jtab="chronicle"]')?.click());
    await L.sleep(1800);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.ch-row')].slice(0, 14).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    L.log(tag, 'chronicle rows', rows.length, JSON.stringify(rows));
    L.log(tag, 'fit', JSON.stringify(await fit(p, '.ch-row, .chron .w-chips, .w-rail, .w-tab')));
    L.log(tag, 'latin', JSON.stringify(await L.latin(p, '.chron')));
    await snap(p, `${OUT}/1-chronicle-${tag}.png`);
    await p.evaluate(() => document.querySelector('[data-chf="loot"]')?.click());
    await L.sleep(700);
    await snap(p, `${OUT}/1b-chronicle-loot-${tag}.png`);
    await p.evaluate(() => document.querySelector('[data-chf="fight"]')?.click());
    await L.sleep(700);
    await snap(p, `${OUT}/1c-chronicle-fights-${tag}.png`);
    await p.evaluate(() => document.querySelector('[data-chf="all"]')?.click());
    // 2. the chart: «Всё» (the yards lit with it), the key open
    await L.closeAll(p);
    await p.evaluate(() => localStorage.setItem('gravetide.mapLegend', '1'));
    await L.open(p, 'map');
    await L.sleep(1500);
    await p.evaluate(() => document.querySelector('[data-mlayer="all"]:not(.on)')?.click());
    await L.sleep(800);
    const lit = await p.evaluate(() => [...document.querySelectorAll('[data-mlayer].on')].map((x) => x.dataset.mlayer));
    L.log(tag, 'layers lit under «Всё»', JSON.stringify(lit));
    await snap(p, `${OUT}/2-chart-all-${tag}.png`);
    await p.evaluate(() => document.querySelector('.map-legend')?.scrollIntoView({ block: 'start' }));
    await L.sleep(500);
    const key = await p.evaluate(() => [...document.querySelectorAll('.map-legend .lg-items > span')].map((x) => x.innerText.trim()));
    L.log(tag, 'legend', key.length, JSON.stringify(key));
    await snap(p, `${OUT}/3-legend-${tag}.png`);
    // 3. «Логова» alone, turned to the beaten lair: «вернётся через …»
    const lair = await p.evaluate(() => (globalThis.gravetide.state.lairs?.list ?? []).find((m) => m.down) ?? null);
    L.log(tag, 'beaten lair', JSON.stringify(lair));
    await p.evaluate((m) => {
      const c = globalThis.gravetide.chart;
      c.layers = new Set(['lairs']);
      document.querySelectorAll('[data-mlayer]').forEach((x) => x.classList.toggle('on', c.layers.has(x.dataset.mlayer)));
      if (m) { c.cx = m.x; c.cy = m.y; c.zoom = Math.max(c.zoom, 8); }
      const lg = document.querySelector('.map-legend'); if (lg) lg.open = false;
      document.querySelector('.map-wrap')?.scrollIntoView({ block: 'start' });
      c.draw(globalThis.gravetide.state);
    }, lair);
    await L.sleep(800);
    await snap(p, `${OUT}/4-chart-lair-back-${tag}.png`);
    L.log(tag, 'errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.ctx.close();
  }
} finally {
  await b.close();
}
