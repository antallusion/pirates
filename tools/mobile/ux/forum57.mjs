// Proof shots (forum posts 57, 70; 2026-11-04): the talents' words (Gunnery: «перезарядка орудий», «смена зарядов»,
// «Беглый огонь» without its «(K)»; Boarding: «Призовая команда»'s boats; Shipwright: the ★ of the ram's Path on
// «Усиленный нос») and the healer's offer («пало за сутки: N · встанут в строй сейчас: K» and why). RU.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f57.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/forum57.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum57';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const clean = (p) => p.evaluate(() => {
  globalThis.gravetide.open(null);
  document.getElementById('promo-over')?.querySelector('[data-polater]')?.click();
  for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click();
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
}).catch(() => {});
async function snap(p, path) {
  await p.evaluate(() => document.querySelectorAll('.k-hint').forEach((x) => x.remove())).catch(() => {});
  for (let i = 0; i < 3; i++) {
    try { return await p.screenshot({ path, timeout: 90000 }); } catch (e) { if (i === 2) console.log('shot failed', path, e.message.slice(0, 80)); await L.sleep(1500); }
  }
}
const out = {};
try {
  for (const [W, H] of [[844, 390], [1366, 768]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
    await L.login(p, { port, captain: 'reaver', know: true });
    await L.say(p, '/level 30');
    await L.say(p, '/silver 200000');
    await L.sleep(800);
    for (let i = 0; i < 3; i++) { await clean(p); await L.sleep(400); }
    // 1. the talents: Gunnery, Boarding, Shipwright
    await L.open(p, 'talents');
    await L.sleep(1200);
    for (const tree of ['gunnery', 'boarding', 'shipwright']) {
      await p.evaluate((t) => document.querySelector(`[data-view="${t}"]`)?.click(), tree);
      await L.sleep(900);
      const want = { gunnery: ['gun_fast_hands', 'gun_rolling_broadside', 'gun_quick_swap'], boarding: ['brd_prize_crew'], shipwright: ['shp_reinforced_bow'] }[tree];
      out[`${tag}:${tree}`] = await p.evaluate((ids) => ids.map((id) => {
        const el = document.querySelector(`.talent[data-id="${id}"]`);
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : `(${id} not shown)`;
      }), want);
      // the card wanted in view
      await p.evaluate((id) => document.querySelector(`.talent[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), want[want.length - 1]);
      await L.sleep(400);
      await snap(p, `${OUT}/talents_${tree}_${tag}.png`);
    }
    out[`${tag}:rose`] = await p.evaluate(() => [...document.querySelectorAll('.rose-pick')].map((x) => `${x.closest('[data-view]')?.dataset.view}: ${x.title}`));
    await L.open(p, null);
    await L.sleep(500);
    // 2. the healer: in port, 24 free hammocks, 43 deckhands and 12 sailors on the record of the fallen
    await L.say(p, '/tp hollowmere');
    await L.sleep(1500);
    await L.send(p, { t: 'dock' });
    await L.sleep(2500);
    for (let i = 0; i < 3; i++) { await clean(p); await L.sleep(400); }
    const max = await p.evaluate(() => globalThis.gravetide.state.self?.crewMax ?? 40);
    await L.say(p, '/army clear');
    await L.say(p, `/army sailor ${Math.max(20, max - 24)}`);
    await L.sleep(500);
    await L.say(p, '/way clear');
    await L.say(p, '/way fallen deckhand 43');
    await L.say(p, '/way fallen sailor 12');
    await L.sleep(800);
    await L.send(p, { t: 'way', action: 'view' });
    await L.open(p, 'way');
    await L.sleep(1500);
    out[`${tag}:healer`] = await p.evaluate(() => ({
      sub: document.querySelector('.way-head .sub')?.textContent ?? null,
      rows: [...document.querySelectorAll('.way-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      note: document.querySelector('.way-note')?.textContent ?? null,
    }));
    await snap(p, `${OUT}/healer_${tag}.png`);
    out[`${tag}:errors`] = p.errors.slice(0, 5);
    await p.ctx.close();
  }
} finally {
  await b.close();
}
console.log(JSON.stringify(out, null, 1));
