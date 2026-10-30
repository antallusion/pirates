// Proof shots (owner, 2026-10-30): «Серебро за дублоны» — the exchange page of the shop before (50 picked) and after an
// exchange, and the HUD's silver «+». RU, 844×390 and 1366×768.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-exchange.db node server/src/main.ts
//   GPORT=58810 node tools/mobile/ux/exchange30.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/exchange30';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58810);
const sizes = (process.env.SIZES ?? '844x390,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
const wait = async (p, f, ms = 30000) => { for (let t = 0; t < ms; t += 400) { if (await p.evaluate(f)) return true; await L.sleep(400); } return false; };
try {
  for (const [W, H] of sizes) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/doubloons 730');
    await L.say(p, '/silver 1500');
    await L.sleep(1200);
    await L.closeAll(p);
    // the HUD: the silver's «+»
    const plus = await p.evaluate(() => { const e = document.querySelector('[data-hudexch]'); const r = e?.getBoundingClientRect(); return r ? { w: r.width, h: r.height, x: r.x, y: r.y } : null; });
    say(tag, 'hud plus', JSON.stringify(plus));
    await p.screenshot({ path: `${OUT}/${tag}-0-hud.png` });
    await p.evaluate(() => document.querySelector('[data-hudexch]')?.click());
    if (!(await wait(p, () => !!document.querySelector('[data-exn]')))) say(tag, 'FAIL no exchange page');
    await L.sleep(800);
    await p.evaluate(() => document.querySelector('[data-expick="50"]')?.click());
    await L.sleep(400);
    const before = await p.evaluate(() => ({ get: document.querySelector('[data-exget]')?.textContent, gold: globalThis.gravetide.state.self.gold, dbl: globalThis.gravetide.state.doubloons }));
    say(tag, 'before', JSON.stringify(before));
    await p.screenshot({ path: `${OUT}/${tag}-1-before.png` });
    await p.evaluate(() => document.querySelector('[data-exgo]')?.click());
    await L.sleep(700);
    await p.screenshot({ path: `${OUT}/${tag}-2-confirm.png` });
    // the confirm: its «yes»
    await p.evaluate(() => { document.querySelector('[data-yes]')?.click(); });
    if (!(await wait(p, () => !!document.querySelector('.ex-done'), 15000))) say(tag, 'FAIL no result');
    await L.sleep(800);
    const after = await p.evaluate(() => ({ done: document.querySelector('.ex-done')?.textContent, gold: globalThis.gravetide.state.self.gold, dbl: globalThis.gravetide.state.doubloons }));
    say(tag, 'after', JSON.stringify(after), 'silver +', after.gold - before.gold, 'dbl -', before.dbl - after.dbl);
    await p.screenshot({ path: `${OUT}/${tag}-3-after.png` });
    await p.close();
  }
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
