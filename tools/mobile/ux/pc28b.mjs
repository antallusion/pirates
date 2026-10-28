// Proof shots of the island from anywhere and its first build, guided (owner, 2026-10-28: 23 of 28 islands with the
// hall alone): the HUD's island line far out at sea, the island opened from there, the bunkhouse and the marine barracks
// ordered remotely (the treasury and the yard pay), the finger on each button, marines hired in a port after.
// Usage: node tools/mobile/ux/pc28b.mjs [1366|844]
// (based on pc28.mjs:) Proof shots of the island → hire loop (owner, 2026-10-28: «качаешь остров — открываются новые бойцы рангом выше,
// нанимать можно в портах или плавучих портах. ключ — это остров»): the HUD's weak-army hint for a level 12 captain
// with 90 deckhands, the island's «next upgrade opens», the island's musketeers hired in a village port (no range of
// its own) and at a floating waystation. 1366×768 and 844×390. Usage: node tools/mobile/ux/pc28.mjs [1366|844]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc28b';
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
const finger = (p) => p.evaluate(() => { const f = document.getElementById('tut-finger'); const t = document.querySelector('.tut-target'); const r = t?.getBoundingClientRect(); return { finger: !!f && !f.classList.contains('hidden'), target: t ? (t.getAttribute('data-i1go') ?? t.getAttribute('data-tbuild') ?? t.getAttribute('data-rcu') ?? t.className) : null, at: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width)] : null, conn: t?.isConnected, f: f?.style.transform }; });
const view = (p) => p.evaluate(() => globalThis.gravetide.state.self?.isleFirst);
const toastText = (p) => p.evaluate(() => document.getElementById('toasts')?.textContent ?? '');
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  for (const c of ['/level 4', '/ship galiot 3']) await cmd(p, c);
  await clearToasts(p);
  await shut(p);
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  // 1. an island, its yard empty, the purse small: the governor's help comes with the first step
  await cmd(p, '/isle');
  await sleep(6500);
  log.push(`${W} after claim: ${JSON.stringify(await view(p))} toasts: ${(await toastText(p)).slice(-200)}`);
  // far out at sea
  await cmd(p, '/tp 68675 57220', 2500);
  await clearToasts(p);
  await shut(p);
  await sleep(1500);
  const far = await p.evaluate(() => { const s = globalThis.gravetide.state; const me = s.you; const isl = s.self?.homeIsle; return { me: me ? [Math.round(me.x), Math.round(me.y)] : null, isle: isl }; });
  log.push(`${W} far: ${JSON.stringify(far)}`);
  await p.screenshot({ path: `${OUT}/1_far_hud_${W}.png` });
  log.push(`${W} finger at sea: ${JSON.stringify(await finger(p))}`);
  // 2. the island opened from there: the bunkhouse's card first
  await p.evaluate(() => document.querySelector('#hud-isle1 [data-i1go]')?.click());
  await sleep(7000);
  await p.screenshot({ path: `${OUT}/2_isle_dw1_${W}.png` });
  log.push(`${W} finger dw1: ${JSON.stringify(await finger(p))} near=${await p.evaluate(() => globalThis.gravetide.state.base?.near)}`);
  await p.evaluate(() => document.querySelector('#isle .is-card [data-tbuild="dw1"]')?.click());
  await sleep(1200);
  log.push(`${W} dw1 ordered: ${(await toastText(p)).slice(-160)}`);
  await cmd(p, '/build finish', 2000);
  await clearToasts(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/3_isle_dw2_${W}.png` });
  log.push(`${W} finger dw2: ${JSON.stringify(await finger(p))} view ${JSON.stringify(await view(p))}`);
  const before = await p.evaluate(() => ({ gold: globalThis.gravetide.state.self?.gold, tre: globalThis.gravetide.state.base?.claim?.treasury }));
  await p.evaluate(() => document.querySelector('#isle .is-card [data-tbuild="dw2"]')?.click());
  await sleep(1800);
  const after = await p.evaluate(() => ({ gold: globalThis.gravetide.state.self?.gold, tre: globalThis.gravetide.state.base?.claim?.treasury }));
  log.push(`${W} dw2 ordered remotely: before ${JSON.stringify(before)} after ${JSON.stringify(after)} toasts ${(await toastText(p)).slice(-220)}`);
  await p.screenshot({ path: `${OUT}/4_isle_dw2_ordered_${W}.png` });
  await cmd(p, '/build finish', 2000);
  await p.evaluate(() => globalThis.gravetide.isle.exit());
  await shut(p);
  await clearToasts(p);
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/5_hud_hire_${W}.png` });
  log.push(`${W} hire step: ${JSON.stringify(await view(p))} finger ${JSON.stringify(await finger(p))}`);
  // 3. marines hired in a port
  await cmd(p, '/silver 1500');
  await cmd(p, '/tp saltmarrow');
  await send(p, { t: 'dock' });
  await sleep(4000);
  await cmd(p, '/dwell fill');
  await shut(p);
  await send(p, { t: 'h3', action: 'dwell', src: 'port' });
  await p.evaluate(() => globalThis.gravetide.open('recruit'));
  await sleep(2000);
  await clearToasts(p);
  await p.screenshot({ path: `${OUT}/6_port_recruit_${W}.png` });
  log.push(`${W} port finger: ${JSON.stringify(await finger(p))}`);
  await p.evaluate(() => document.querySelector('.rc-unit[data-rcu="marine"]:not(.off)')?.click());
  await sleep(500);
  await p.screenshot({ path: `${OUT}/7_port_marine_${W}.png` });
  log.push(`${W} port finger 2: ${JSON.stringify(await finger(p))}`);
  await p.evaluate(() => document.querySelector('[data-rcgo]')?.click());
  await sleep(1800);
  await p.screenshot({ path: `${OUT}/8_port_hired_${W}.png` });
  log.push(`${W} hired: ${JSON.stringify(await view(p))} toasts ${(await toastText(p)).slice(-220)}`);
  await shut(p);
  await sleep(800);
  await p.screenshot({ path: `${OUT}/9_hud_dw3_${W}.png` });
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
