// Proof shots (owner, 2026-10-30): «Переход» between hub ports — the hub's list in port, the trip ×10 with the pill,
// the arrival in the other hub, the hub badges on the chart. RU, 844×390 and 1366×768.
//   PORT=58780 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-ferry.db node server/src/main.ts
//   GPORT=58780 node tools/mobile/ux/ferry30.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/ferry30';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58780);
const sizes = (process.env.SIZES ?? '844x390,1366x768').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pc${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const say = (...a) => { const t = a.join(' '); log.push(t); L.log(t); };
// (the one-time «Вы покидаете безопасные воды» screen put away as it comes)
const dismiss = (p) => p.evaluate(() => document.querySelectorAll('.center-card .btn-primary').forEach((b) => b.click())).catch(() => {});
const wait = async (p, f, ms = 30000, arg) => { for (let t = 0; t < ms; t += 400) { await dismiss(p); if (await p.evaluate(f, arg)) return true; await L.sleep(400); } return false; };
try {
  for (const [W, H] of sizes) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await p.addInitScript(() => {
      globalThis.__toasts = [];
      new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) globalThis.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true });
    });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/silver 600');
    await L.sleep(500);
    await L.say(p, '/tp gravesend');
    await L.sleep(1200);
    await L.send(p, { t: 'dock' });
    if (!(await wait(p, () => globalThis.gravetide.state.self?.dockedAt === 'gravesend'))) say(tag, 'FAIL not docked');
    await wait(p, () => !!globalThis.gravetide.state.portView?.ferry);
    await L.sleep(800);
    await p.evaluate(() => document.querySelector('[data-ptab="ferry"]')?.click());
    await wait(p, () => !!document.querySelector('[data-ferry]'));
    await L.sleep(1500);
    await p.screenshot({ path: `${OUT}/${tag}-1-hub-list.png` });
    const list = await p.evaluate(() => [...document.querySelectorAll('.fy-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    say(tag, 'list', JSON.stringify(list));
    const silver0 = await p.evaluate(() => globalThis.gravetide.state.self.gold);
    await p.evaluate(() => document.querySelector('[data-ferry="hollowmere"]')?.click());
    if (!(await wait(p, () => !!globalThis.gravetide.state.voyage, 20000))) say(tag, 'FAIL no voyage');
    await L.sleep(1300);
    await p.screenshot({ path: `${OUT}/${tag}-2a-start.png` });
    await L.sleep(1200);
    await dismiss(p);
    const mid = await p.evaluate(() => ({ pill: document.getElementById('hud-voyage')?.textContent, title: document.getElementById('hud-voyage')?.title, toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => t.textContent), gold: globalThis.gravetide.state.self.gold }));
    say(tag, 'mid', JSON.stringify(mid), 'paid', silver0 - mid.gold);
    await p.screenshot({ path: `${OUT}/${tag}-2b-midtrip.png` });
    // the arrival: the voyage over (the toast), then in port
    await wait(p, () => !globalThis.gravetide.state.voyage, 600000);
    await L.sleep(600);
    await dismiss(p);
    await p.screenshot({ path: `${OUT}/${tag}-3a-arrival.png` });
    say(tag, 'arrival toasts', JSON.stringify(await L.toasts(p)));
    const docked = await wait(p, () => globalThis.gravetide.state.self?.dockedAt === 'hollowmere', 120000);
    say(tag, 'docked at hollowmere', docked);
    await L.sleep(2000);
    await dismiss(p);
    await L.sleep(500);
    await p.evaluate(() => document.querySelector('[data-ptab="ferry"]')?.click());
    await L.sleep(1500);
    await p.screenshot({ path: `${OUT}/${tag}-3b-arrived-in-port.png` });
    say(tag, 'status', await p.evaluate(() => document.querySelector('.fy-st')?.textContent));
    // the chart with the hub badges
    await L.closeAll(p);
    say(tag, 'all toasts', JSON.stringify(await p.evaluate(() => globalThis.__toasts.filter((t) => /Переход|Прибыли/.test(t)))));
    await L.open(p, 'map');
    await L.sleep(2000);
    // the whole sea: zoomed out
    for (let i = 0; i < 8; i++) { await p.mouse.move(W / 2, H / 2 + 20); await p.mouse.wheel(0, 400); await L.sleep(250); }
    await L.sleep(2500);
    await p.screenshot({ path: `${OUT}/${tag}-4-chart.png` });
    say(tag, 'errors', JSON.stringify(p.errors));
    await p.ctx.close();
  }
} finally {
  writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  await b.close();
}
