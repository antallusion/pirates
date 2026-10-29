// Proof shots (owner, 2026-10-29: «в чате если кто-то написал сделай в значке чата вверху справа циферку типа новое
// сообщение до 99»): the chat button's badge with a count, with «99+», and gone after opening, at 1366×768 and 844×390.
// Real lines come from a second captain through the server (the world channel); the 99+ case adds lines on the client.
// Usage: node tools/mobile/ux/chatbadge.mjs [1366|844]   (QA server: PORT=58810 GRAVETIDE_ADMIN=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/chatbadge';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58810';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--qa-tag=pc58810'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc58810*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
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
/** The whole screen and a close-up of the chat button (3× the box round it). */
async function shot(p, name) {
  await p.evaluate(() => globalThis.gravetide.open?.(null));
  await sleep(300);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const r = await p.evaluate(() => { const e = document.getElementById('chat-toggle').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; });
  const pad = 40;
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + 2 * pad, height: r.h + 2 * pad };
  await p.screenshot({ path: `${OUT}/${name}_zoom.png`, clip, scale: 'device' });
}
const badge = (p) => p.evaluate(() => { const e = document.getElementById('chat-unread'); const r = e.getBoundingClientRect(); return { text: e.textContent, hidden: e.classList.contains('hidden'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth }; });

// the speaker: a second captain (desk size, lowest cost)
const sp = await pg(800, 600);
await toSea(sp, 'Ann');
const say = async (t) => { await sp.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t, ch: 'world' }), t); await sleep(2100); };

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p, 'Bo');
  await p.evaluate(() => globalThis.gravetide.hud.chatPanel.close());
  await sleep(500);
  for (const t of [`Попутного ветра, ${W}!`, 'Кто идёт к Чёрному берегу?', 'Ищу команду на кракена :kraken:']) await say(t);
  await sleep(800);
  log.push(`${W} three lines: ${JSON.stringify(await badge(p))}`);
  await shot(p, `${W}_count`);
  // past 99 (lines straight into the panel, as the server would hand them)
  await p.evaluate(() => {
    const c = globalThis.gravetide.hud.chatPanel;
    for (let i = 0; i < 110; i++) c.add({ from: 'Ann Шквал', text: `строка ${i}`, id: `qa${i}`, at: Date.now() });
  });
  await sleep(400);
  log.push(`${W} 113 lines: ${JSON.stringify(await badge(p))}`);
  await shot(p, `${W}_99plus`);
  // opened: the count goes
  await p.evaluate(() => document.getElementById('chat-toggle').click());
  await sleep(700);
  log.push(`${W} opened: ${JSON.stringify(await badge(p))} lines shown ${await p.evaluate(() => document.querySelectorAll('#chat-log .cl').length)}`);
  await shot(p, `${W}_opened`);
  await p.evaluate(() => globalThis.gravetide.hud.chatPanel.close());
  await sleep(500);
  log.push(`${W} closed again: ${JSON.stringify(await badge(p))}`);
  await shot(p, `${W}_after`);
  // a reload: the history comes again, nothing counted twice
  await p.reload({ waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) await sleep(1000);
  await sleep(3000);
  log.push(`${W} after reload: ${JSON.stringify(await badge(p))}`);
  await p.context().close();
}
await sp.context().close();
await b.close();
console.log(log.join('\n'));
