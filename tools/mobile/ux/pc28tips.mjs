// Proof shots of the captain card's hover cards on the site (owner, 2026-10-28: «при наведении на снаряжение капитана
// корабля и еще где-то вся инфа выпрыгивала как в игре»): a gear piece, a ship's piece, a skill and a creature hovered
// at 1366×768, and a tap card at 390×844. Needs a local server (a copy of the prod base) on :58810.
// Usage: node tools/mobile/ux/pc28tips.mjs [captain name]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc28tips';
const B = 'http://127.0.0.1:58810';
const NAME = process.argv[2] || 'Happy Evil';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--qa-tag=pc58810'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pc58810*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = [];
const url = `${B}/site/rating/?captain=${encodeURIComponent(NAME)}`;
async function open(W, H) {
  const touch = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cp-tabs [data-tab]', { timeout: 20000 });
  return { ctx, p };
}
const tab = async (p, id) => { await p.click(`.cp-tabs [data-tab="${id}"]`); await sleep(300); };
const tipShown = async (p) => p.evaluate(() => { const t = document.querySelector('.gt-tip'); if (!t || t.hidden) return null; const r = t.getBoundingClientRect(); return { text: t.innerText.slice(0, 160).replace(/\n/g, ' | '), x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
async function hover(p, sel, shot) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.hover();
  await sleep(250);
  const t = await tipShown(p);
  log.push(`${shot}: ${JSON.stringify(t)}`);
  await p.screenshot({ path: `${OUT}/${shot}.png` });
}
{
  const { ctx, p } = await open(1366, 768);
  await tab(p, 'hero');
  await hover(p, '.cp-doll .cp-slot[data-tip]', 'd1-gear');
  await hover(p, '.cp-chips.big [data-tip]', 'd3-skill');
  await tab(p, 'ship');
  await hover(p, '.cp-items [data-tip]', 'd2-ship-item');
  await hover(p, '.cp-ship .cp-chip[data-tip]', 'd2b-gun');
  await tab(p, 'army');
  await hover(p, '.cp-army .cp-unit[data-tip]', 'd4-creature');
  const left = await p.evaluate(() => document.querySelectorAll('.cp [title]').length);
  log.push(`title= left in the card: ${left}`);
  await ctx.close();
}
{
  const { ctx, p } = await open(390, 844);
  await tab(p, 'hero');
  const el = p.locator('.cp-doll .cp-slot[data-tip]').first();
  await el.scrollIntoViewIfNeeded();
  await el.tap();
  await sleep(300);
  log.push(`m1-tap: ${JSON.stringify(await tipShown(p))}`);
  await p.screenshot({ path: `${OUT}/m1-tap.png` });
  await p.touchscreen.tap(195, 120);
  await sleep(200);
  log.push(`m1-tap-outside closes: ${(await tipShown(p)) === null}`);
  await ctx.close();
}
await b.close();
console.log(log.join('\n'));
