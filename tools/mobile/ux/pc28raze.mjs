// Proof shots of pulling a building down (owner, 2026-10-28: «дай возможность сноса здания (удаления) на острове»): the
// «Снести» on a producer's card and on a dwelling's, the confirm (what is lost, what comes back), the result (the plot
// free, the treasury fuller), and the blocked case (the bunkhouse under the marines' barracks; the hall). 1366×768 and
// 844×390, RU. Usage: node tools/mobile/ux/pc28raze.mjs [1366|844]   (QA server: PORT=58780 GRAVETIDE_ADMIN=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc28raze';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58780';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--qa-tag=pc58780'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc58780*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
async function pg(W, H) {
  const touch = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU' });
  await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); } catch {} setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
  return p;
}
async function toSea(p) {
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 120000 });
  for (let i = 0; i < 4; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    await p.fill('#login-name', 'Raze' + Math.random().toString(36).slice(2, 7));
    await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
    try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 }); } catch {}
  }
  await sleep(1500);
  await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
  await sleep(400);
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); document.getElementById('pick-captain')?.click(); });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await sleep(1000); }
  await sleep(3000);
}
const toasts = () => '';
const cmd = async (p, t, wait = 700) => {
  await p.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), t);
  await sleep(wait);
  const msg = await p.evaluate(() => document.getElementById('toasts')?.textContent ?? '');
  log.push(`${t} → ${msg.slice(-160)}`);
  return msg;
};
const send = (p, m) => p.evaluate((m) => globalThis.gravetide.net.send(m), m);
const clearToasts = (p) => p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
const shot = async (p, W, name) => { await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click()); await sleep(600); await p.screenshot({ path: `${OUT}/${W}_${name}.png` }); log.push(`${W} ${name}`); };
const into = (p, sel) => p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), sel);
void toasts;

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  for (const c of ['/level 10', '/isle', '/build finish', '/res 400', '/silver 20000']) await cmd(p, c);
  for (const id of ['dw1', 'dw2']) {
    await send(p, { t: 'h3', action: 'build', id });
    await sleep(700);
    await cmd(p, '/build finish');
  }
  // a producer on a plot: the first the land bears
  for (const k of ['lumber', 'quarry', 'tar', 'mine', 'fishery']) {
    await send(p, { t: 'base', action: 'build', plot: 0, what: `p:${k}` });
    await sleep(700);
    const ok = await p.evaluate(() => !!globalThis.gravetide.state.base?.cells[0]?.what);
    if (ok) break;
  }
  await cmd(p, '/build finish', 1200);
  await clearToasts(p);
  await p.evaluate(() => globalThis.gravetide.open('base'));
  await sleep(6000);
  const isle = () => p.evaluate(() => globalThis.gravetide.isle);
  void isle;
  // 1. the producer's card: «Снести»
  await p.evaluate(() => globalThis.gravetide.isle.select({ plot: 0 }, true));
  await sleep(1500);
  await into(p, '[data-braze]');
  await shot(p, W, '1_producer_button');
  const treBefore = await p.evaluate(() => globalThis.gravetide.state.base?.claim?.treasury);
  // 2. the confirm
  await p.evaluate(() => document.querySelector('[data-braze]')?.click());
  await sleep(1000);
  await shot(p, W, '2_producer_confirm');
  log.push(`confirm: ${await p.evaluate(() => document.querySelector('.confirm-body')?.textContent ?? '—')}`);
  // 3. pulled down: the plot free, the treasury fuller
  await p.evaluate(() => document.querySelector('[data-yes]')?.click());
  await sleep(2000);
  await p.evaluate(() => globalThis.gravetide.isle.select({ plot: 0 }, true));
  await sleep(1500);
  await shot(p, W, '3_producer_razed');
  log.push(`treasury ${treBefore} → ${await p.evaluate(() => globalThis.gravetide.state.base?.claim?.treasury)}; plot 0: ${await p.evaluate(() => globalThis.gravetide.state.base?.cells[0]?.what)}`);
  // 4. blocked: the bunkhouse carries the barracks
  await clearToasts(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw1'));
  await sleep(1500);
  await into(p, '.braze-why');
  await shot(p, W, '4_blocked_dw1');
  log.push(`blocked: ${await p.evaluate(() => document.querySelector('.braze-why')?.textContent ?? '—')}`);
  // 5. the barracks: «Снести», the confirm with the hire lost, then the result
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await into(p, '[data-braze]');
  await shot(p, W, '5_dw2_button');
  await p.evaluate(() => document.querySelector('[data-braze]')?.click());
  await sleep(1000);
  await shot(p, W, '6_dw2_confirm');
  log.push(`confirm: ${await p.evaluate(() => document.querySelector('.confirm-body')?.textContent ?? '—')}`);
  await p.evaluate(() => document.querySelector('[data-yes]')?.click());
  await sleep(2000);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await shot(p, W, '7_dw2_razed');
  log.push(`dw2 now: ${await p.evaluate(() => globalThis.gravetide.state.base?.town?.things.find((t) => t.id === 'dw2')?.level)}; dw1 raze why: ${await p.evaluate(() => globalThis.gravetide.state.base?.town?.things.find((t) => t.id === 'dw1')?.raze?.why ?? null)}`);
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
