// Proof (owner, 2026-10-30: «чат должен сохраняться 8 часов и его мог увидеть при открытии даже чел который был в
// оффлайне»): `a` — captain Ann writes in the world's chat and leaves; then the server is restarted (outside this
// script); `b` — captain Bo, never aboard before, comes on at 844×390, the badge counts the line, the chat opened shows it.
// Usage: node tools/mobile/ux/chatpersist.mjs a|b   (QA server: PORT=58820)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/chatpersist';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58820';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--qa-tag=pc58820'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc58820*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
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
async function toSea(p, name) {
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 120000 });
  for (let i = 0; i < 4; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    await p.fill('#login-name', name + Math.random().toString(36).slice(2, 5));
    await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
    try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 }); } catch {}
  }
  await sleep(1500);
  await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
  await sleep(400);
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); document.getElementById('pick-captain')?.click(); });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await sleep(1000); }
  await sleep(3000);
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  await p.evaluate(() => globalThis.gravetide.open?.(null));
  await sleep(600);
}
const phase = process.argv[2];
if (phase === 'a') {
  const p = await pg(800, 600);
  await toSea(p, 'Ann');
  const who = await p.evaluate(() => globalThis.gravetide.state?.self?.name ?? document.title);
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'chat', text: 'Кто был в офлайне — это сообщение для вас! Встречаемся у Чёрного берега', ch: 'world' }));
  await sleep(8000); // past the 5 s write
  log.push(`a: said by ${who}`);
  await p.context().close();
} else {
  const p = await pg(844, 390);
  await toSea(p, 'Bo');
  log.push(`b chat open on arrival: ${await p.evaluate(() => document.getElementById('chat')?.classList.contains('open') ?? document.body.classList.contains('chat-open'))}`);
  log.push(`b badge: ${await p.evaluate(() => { const e = document.getElementById('chat-unread'); return (e.classList.contains('hidden') ? 'hidden ' : '') + e.textContent; })}`);
  await p.screenshot({ path: `${OUT}/844_badge.png` });
  await p.evaluate(() => document.getElementById('chat-toggle').click());
  await sleep(900);
  log.push(`b opened: ${await p.evaluate(() => [...document.querySelectorAll('#chat-log .cl')].map((e) => e.textContent.trim().slice(0, 100)).join(' | '))}`);
  await p.screenshot({ path: `${OUT}/844_opened.png` });
  await p.context().close();
}
await b.close();
console.log(log.join(String.fromCharCode(10)));
