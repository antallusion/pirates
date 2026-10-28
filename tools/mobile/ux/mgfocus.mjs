// Proof shots (owner, 2026-10-28: «большинство картинок в таких окошках отрезаны поверху … чтобы лица попадали в окошки
// и на мобиле и на десктопе»): the island games' cards before (the old centre crop, forced back by a stylesheet) and
// after (shared/src/data/artaim.ts) at 1366×768, 390×844 and 844×390, RU.
// Usage: node tools/mobile/ux/mgfocus.mjs [1366|390|844]   (QA server: PORT=58820 GRAVETIDE_ADMIN=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/mgfocus';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58820';
const GAMES = ['star_bearing', 'bosuns_lore', 'split_map', 'castaway_coin', 'drowned_ferryman', 'harpoon_lagoon', 'talking_skull', 'beach_trader'];
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
async function toSea(p) {
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 120000 });
  for (let i = 0; i < 4; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    await p.fill('#login-name', 'Fx' + Math.random().toString(36).slice(2, 7));
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
const cmd = async (p, t, wait = 900) => { await p.evaluate((t) => globalThis.gravetide.net.send({ t: 'chat', text: t }), t); await sleep(wait); };
const OLD = '#minigame .mg-art { --art-pos: center !important; }';

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [390, 844], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  // (a phone upright is asked to turn: the game is played lying; the card under that notice is shot all the same)
  await toSea(p);
  if (W < H) await p.addStyleTag({ content: '#rotate-lock { display: none !important; }' });
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  for (const id of GAMES) {
    await cmd(p, `/minigame ${id}`, 1800);
    const box = await p.evaluate(() => { const a = document.querySelector('#minigame:not(.hidden) .mg-art'); return a ? [a.clientWidth, a.clientHeight, getComputedStyle(a).backgroundPosition, /cards\/(\w+)/.exec(a.style.backgroundImage)?.[1]] : null; });
    if (box && box[3] !== `mg_${id}`) { log.push(`${W} ${id}: shows ${box[3]}`); continue; }
    if (!box) { log.push(`${W} ${id}: no card`); continue; }
    await p.addStyleTag({ content: OLD }).then((h) => h.evaluate((s) => s.setAttribute('id', 'mg-old')));
    await sleep(300);
    await p.locator('#minigame').screenshot({ path: `${OUT}/${W}_${id}_before.png` });
    await p.evaluate(() => document.getElementById('mg-old')?.remove());
    await sleep(300);
    await p.locator('#minigame').screenshot({ path: `${OUT}/${W}_${id}_after.png` });
    log.push(`${W} ${id}: box ${box[0]}×${box[1]} pos ${box[2]}`);
    // walk away and close it, so the next one may begin
    await p.evaluate(() => document.querySelector('#minigame [data-mg="walk"]')?.click());
    await sleep(1200);
    await p.evaluate(() => document.querySelector('#minigame [data-mg-close]')?.click());
    await sleep(600);
  }
  await p.screenshot({ path: `${OUT}/${W}_page.png` });
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
