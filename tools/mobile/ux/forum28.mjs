// Proof shots (forum, Нефигугум 2026-10-30, post 28): the site's fleet with the hold and the planning numbers (1366 and
// 390 wide), and the tree of hulls' card of a hull (844×390 and 1366×768). RU.
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-forum28.db node server/src/main.ts
//   GPORT=58820 node tools/mobile/ux/forum28.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/forum28';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58820);
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent) x.click(); });
}).catch(() => {});
try {
  // 1. The site's fleet: sorted by hold, the traders' list.
  for (const [W, H] of [[1366, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 500 ? 2 : 1 });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/site/ships/`, { waitUntil: 'networkidle', timeout: 90000 });
    await p.evaluate(() => document.querySelectorAll('.reveal').forEach((x) => x.classList.add('in')));
    await p.click('[data-fl="trade"]');
    await p.click('[data-sort="hold"]');
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.fleet-tools').getBoundingClientRect().top + window.scrollY - 110));
    await L.sleep(800);
    await p.screenshot({ path: `${OUT}/site-fleet-${W}.png` });
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.fleet-sec:not([hidden]) .ship').getBoundingClientRect().top + window.scrollY - 100));
    await L.sleep(500);
    await p.screenshot({ path: `${OUT}/site-fleet-${W}-card.png` });
    L.log(W, 'site', await p.evaluate(() => document.querySelector('.fleet-sec:not([hidden]) .ship .stats').innerText.replace(/\s+/g, ' ')));
    await ctx.close();
  }
  // 2. The tree's card: a trader of tier 3 not yet researched, against the sloop she sails.
  for (const [W, H] of [[844, 390], [1366, 768]]) {
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/level 12');
    await L.sleep(800);
    await dismiss(p);
    await L.open(p, 'research');
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('[data-rtab="trade"]')?.click());
    await L.sleep(600);
    const id = await p.evaluate(() => { const c = document.querySelector('.rs-card.rs-near[data-rs-hull], .rs-card.rs-locked[data-rs-hull]'); c?.click(); return c?.dataset.rsHull; });
    await L.sleep(800);
    await p.screenshot({ path: `${OUT}/tree-card-${W}x${H}.png` });
    await p.evaluate(() => { const h = document.querySelector('.hc'); if (h) h.scrollTop = h.scrollHeight; });
    await L.sleep(400);
    await p.screenshot({ path: `${OUT}/tree-card-${W}x${H}-end.png` });
    const fit = await p.evaluate(() => { const h = document.querySelector('.hc'); const r = h?.getBoundingClientRect(); return h ? { w: Math.round(r.width), h: Math.round(r.height), sw: h.scrollWidth, cw: h.clientWidth } : null; });
    await p.evaluate(() => document.querySelector('[data-hc-close]')?.click());
    await L.sleep(400);
    const closed = await p.evaluate(() => !document.querySelector('.hc'));
    L.log(`${W}x${H}`, 'tree card', id, JSON.stringify(fit), 'closed', closed);
    await p.context().close();
  }
} finally {
  await b.close();
}
