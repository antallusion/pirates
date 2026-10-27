// Proof shots of the portraits (owner, 2026-10-27: «капитаны опять какие-то косячные … везде с портретами косяк»):
// the captain's choice (1366×768, 390×844), the HUD's ring, the chat, the site's captains and rating, the forum.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pf27';
const B = 'http://127.0.0.1:58810';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--qa-tag=pf810'] });
// one headless Chrome, at BelowNormal (the owner's CPU): the browser found by its tag, its children by their parent
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pf810*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
async function pg(W, H) {
  const touch = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU' });
  await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); } catch {} setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
  return ctx.newPage();
}
async function toCaptain(p) {
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 120000 });
  for (let i = 0; i < 4; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    await p.fill('#login-name', 'Pf' + Math.random().toString(36).slice(2, 7));
    await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
    try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 }); } catch {}
  }
  await sleep(2500);
}
const only = process.argv[2] ?? 'all';
if (only === 'all' || only === 'cap') {
  for (const [W, H, n] of [[844, 390, 'captain_844x390']]) {
    const p = await pg(W, H);
    await toCaptain(p);
    await p.screenshot({ path: `${OUT}/${n}.png` });
    if (n === 'captain_390') await p.evaluate(() => document.querySelector('.cpx-cap')?.scrollIntoView()), await p.screenshot({ path: `${OUT}/${n}_list.png`, fullPage: true });
    await p.context().close();
  }
}
if (only === 'all' || only === 'hud') {
  const p = await pg(1366, 768);
  await toCaptain(p);
  await p.evaluate(() => document.querySelector('.captain-card[data-id="drowned"]')?.click());
  await sleep(500);
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); document.getElementById('pick-captain')?.click(); });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await sleep(1000); }
  await sleep(4000);
  await p.screenshot({ path: `${OUT}/hud_1366.png` });
  const r = await p.evaluate(() => { const e = [...document.querySelectorAll('#hud .pav, #hud [data-pav]')].find((x) => x.getBoundingClientRect().width > 20); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  if (r) await p.screenshot({ path: `${OUT}/hud_ring.png`, clip: { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 20), width: r.w + 160, height: r.h + 40 } });
  await p.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), 'Проверка портретов');
  await sleep(800);
  await p.evaluate(() => document.getElementById('chat-toggle')?.click());
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/chat_1366.png` });
  await p.context().close();
}
if (only === 'all' || only === 'site') {
  const p = await pg(1366, 900);
  for (const [u, n] of [['/site/captains/', 'site_captains'], ['/site/rating/?board=level', 'site_rating'], ['/forum/', 'forum']]) {
    await p.goto(B + u, { waitUntil: 'load', timeout: 120000 });
    await sleep(3000);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await sleep(1500);
    await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: n !== 'forum' });
  }
  await p.context().close();
}
if (only === 'all' || only === 'rings') {
  // every ring on the site's captains and rating, side by side, at twice the size
  const p = await pg(1366, 900);
  for (const [u, n, sel] of [['/site/captains/', 'site_captains_rings', '.capcard .pav'], ['/site/rating/?board=level', 'site_rating_rings', '.pav']]) {
    await p.goto(B + u, { waitUntil: 'load', timeout: 120000 });
    await sleep(2500);
    const els = await p.$$(sel);
    let i = 0;
    for (const e of els.slice(0, 12)) { await e.scrollIntoViewIfNeeded(); await sleep(300); await e.screenshot({ path: `${OUT}/${n}_${i++}.png` }).catch(() => {}); }
  }
  await p.context().close();
}
await b.close();
console.log('done');
