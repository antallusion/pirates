// Proof shots of the island → hire loop (owner, 2026-10-28: «качаешь остров — открываются новые бойцы рангом выше,
// нанимать можно в портах или плавучих портах. ключ — это остров»): the HUD's weak-army hint for a level 12 captain
// with 90 deckhands, the island's «next upgrade opens», the island's musketeers hired in a village port (no range of
// its own) and at a floating waystation. 1366×768 and 844×390. Usage: node tools/mobile/ux/pc28.mjs [1366|844]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc28';
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
    await p.fill('#login-name', 'Pc' + Math.random().toString(36).slice(2, 7));
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
const cmd = async (p, t, wait = 700) => {
  await p.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), t);
  await sleep(wait);
  const msg = await p.evaluate(() => document.getElementById('toasts')?.textContent ?? '');
  log.push(`${t} → ${msg.slice(-160)}`);
  return msg;
};
const send = (p, m) => p.evaluate((m) => globalThis.gravetide.net.send(m), m);
const shut = async (p) => { await p.evaluate(() => globalThis.gravetide.open(null)); await sleep(500); };
const clearToasts = (p) => p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  for (const c of ['/level 12', '/ship galiot 3', '/army deckhand 90', '/silver 2500']) await cmd(p, c);
  await clearToasts(p);
  await shut(p);
  await sleep(800);
  await p.screenshot({ path: `${OUT}/levelup_${W}.png` });
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  await sleep(2500);
  // 1. the HUD's hint: the badge, then its card (no island yet: claim one)
  await p.screenshot({ path: `${OUT}/hud_${W}.png` });
  await p.evaluate(() => document.querySelector('.adv-badge')?.click());
  await sleep(600);
  await p.screenshot({ path: `${OUT}/hud_open_${W}.png` });
  log.push(`advice: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.self?.advice))}`);
  // 2. the island: given, its first dwellings raised (the bunkhouse, the barracks, the market) — the next opens musketeers
  for (const c of ['/isle', '/build finish', '/res 400', '/island go']) await cmd(p, c);
  for (const id of ['dw1', 'dw2', 'market']) {
    await send(p, { t: 'h3', action: 'build', id });
    await sleep(700);
    log.push(`build ${id}: ${(await p.evaluate(() => document.getElementById('toasts')?.textContent ?? '')).slice(-120)}`);
    await cmd(p, '/build finish');
  }
  await clearToasts(p);
  await sleep(1500);
  await p.evaluate(() => document.querySelector('.adv-badge[aria-expanded="false"]')?.click());
  await sleep(500);
  await p.screenshot({ path: `${OUT}/hud_isle_${W}.png` });
  await p.evaluate(() => globalThis.gravetide.open('base'));
  await sleep(6000);
  await p.screenshot({ path: `${OUT}/isle_${W}.png` });
  await p.evaluate(() => document.querySelector('#isle .is-army')?.click());
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/isle_card_${W}.png` });
  log.push(`isle ribbon: ${await p.evaluate(() => document.querySelector('#isle .is-army')?.textContent ?? '—')}`);
  await send(p, { t: 'h3', action: 'build', id: 'dw3' });
  await sleep(600);
  await cmd(p, '/build finish', 1500);
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/isle_built_${W}.png` });
  await p.evaluate(() => globalThis.gravetide.isle.exit());
  await shut(p);
  await cmd(p, '/silver 3000');
  // 3. a village port with no shooting range: the island's musketeers in its hire window
  await cmd(p, '/tp saltmarrow');
  await send(p, { t: 'dock' });
  await sleep(4000);
  await cmd(p, '/dwell fill');
  await shut(p);
  await send(p, { t: 'h3', action: 'dwell', src: 'port' });
  await p.evaluate(() => globalThis.gravetide.open('recruit'));
  await sleep(2000);
  await p.screenshot({ path: `${OUT}/port_${W}.png` });
  log.push(`port rows: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.dwell?.rows.map((r) => [r.tier, r.isle ?? false, r.pool, r.units.map((u) => u.u)])))}`);
  await p.evaluate(() => document.querySelector('[data-rcmax]')?.click());
  await sleep(300);
  await p.screenshot({ path: `${OUT}/port_max_${W}.png` });
  await p.evaluate(() => document.querySelector('[data-rcgo]')?.click());
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/port_hired_${W}.png` });
  log.push(`army after port: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.dwell?.army))}`);
  await shut(p);
  // 4. a floating waystation: moored, the island's men in its hire (the army back to deckhands: the musketeers had
  // filled the might cap of a ⚓3 hull)
  await cmd(p, '/army clear');
  await cmd(p, '/silver 3000');
  await cmd(p, '/tp 68675 57220', 1500);
  const id = 14403;
  await send(p, { t: 'way', action: 'moor', id });
  await sleep(2500);
  await shut(p);
  await send(p, { t: 'h3', action: 'dwell', src: 'way' });
  await p.evaluate(() => globalThis.gravetide.open('recruit'));
  await sleep(2000);
  await p.screenshot({ path: `${OUT}/way_${W}.png` });
  log.push(`way rows: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.dwell?.rows.map((r) => [r.tier, r.isle ?? false, r.pool, r.units.map((u) => u.u)])))}`);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.rc-unit')].find((x) => x.closest('.rc-dwell')?.querySelector('.rc-isle') && !x.classList.contains('off')); b?.click(); });
  await sleep(500);
  await p.evaluate(() => document.querySelector('[data-rcmax]')?.click());
  await sleep(300);
  await p.evaluate(() => document.querySelector('[data-rcgo]')?.click());
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/way_hired_${W}.png` });
  log.push(`army after way: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.dwell?.army))}`);
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
