// Proof shots (owner, 2026-10-29: «чат пусть отдельно будет вынесено из подменю, надо эту иконку сделать меньше и рядом
// с иконкой штурвала разместить где-то в удачном месте»; «чат все равно показывает 1, я захожу в чат и там ниче нету»):
// the chat's own small round button by the helm on phones (844×390, 740×360, 1093×481 Telegram, an iPhone's notch),
// its badge with a world line, and the «⋯» badge no longer adding the chat; overlap with the helm checked by numbers.
// Usage: node tools/mobile/ux/chatbtn.mjs [probe]   (QA server: PORT=58810 GRAVETIDE_ADMIN=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/chatbtn';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58810';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--qa-tag=pc58810'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc58810*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
async function pg(W, H, notch = false) {
  const touch = W < 1200;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU' });
  await ctx.addInitScript((notch) => {
    try { localStorage.setItem('gravetide.lang', 'ru'); } catch {}
    setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300);
    if (notch) document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#hud, #hud-chat, #hud-toasts, #touch { --sa-l: 22px !important; --sa-r: 22px !important; --sa-b: 21px !important; }'; document.head.append(s); });
  }, notch);
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
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
  await sleep(2500);
  await p.evaluate(() => globalThis.gravetide.open?.(null));
  await sleep(600);
}
const rects = (p) => p.evaluate(() => {
  const out = {};
  for (const sel of ['#chat-toggle', '#chat-unread', '#tc-stick', '#tc-dashchip', '#tc-sail', '#tc-speed', '#tc-more', '.tc-more-b', '#tc-actrow', '#tc-fire', '#hud-captain']) {
    const e = document.querySelector(sel);
    if (!e) continue;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    out[sel] = cs.display === 'none' || !r.width ? 'hidden' : [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(',') + (sel.includes('-b') || sel.includes('unread') ? ` "${e.textContent}"` : '');
  }
  // the chat's button against the helm's parts: any overlap?
  const box = (s) => document.querySelector(s)?.getBoundingClientRect();
  const c = box('#chat-toggle');
  const hits = [];
  // the sail ring/arc is the stick's own circle; the wheel and its chip are boxes
  for (const s of ['#tc-stick', '#tc-dashchip', '#tc-sail', '#tc-speed', '#tc-more', '#tc-actrow']) {
    const r = box(s);
    if (!c || !r || !r.width) continue;
    if (c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top) hits.push(s);
  }
  out.overlaps = hits.join(' ') || 'none';
  return out;
});

const SIZES = [[844, 390, false, '844'], [740, 360, false, '740'], [1093, 481, false, '1093tg'], [844, 390, true, '844notch']];
const sp = await pg(800, 600);
await toSea(sp, 'Ann');
for (const [W, H, notch, tag] of SIZES) {
  if (process.argv[2] === 'probe' && tag !== '844') continue;
  const p = await pg(W, H, notch);
  await toSea(p, 'Bo');
  await p.evaluate(() => globalThis.gravetide.hud.chatPanel.close());
  await sp.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t, ch: 'world' }), `Эй, ${tag}!`);
  await sleep(2200);
  log.push(`${tag} with a line: ${JSON.stringify(await rects(p))}`);
  await p.screenshot({ path: `${OUT}/${tag}_badge.png` });
  await p.evaluate(() => document.getElementById('chat-toggle').click());
  await sleep(700);
  log.push(`${tag} opened: shown ${await p.evaluate(() => document.querySelectorAll('#chat-log .cl').length)}`);
  await p.screenshot({ path: `${OUT}/${tag}_open.png` });
  await p.evaluate(() => globalThis.gravetide.hud.chatPanel.close());
  await sleep(600);
  log.push(`${tag} closed: ${JSON.stringify(await rects(p))}`);
  await p.screenshot({ path: `${OUT}/${tag}_after.png` });
  await p.context().close();
}
await sp.context().close();
await b.close();
console.log(log.join('\n'));
