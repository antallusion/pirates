// Proof shots of «в сети» (owner, 2026-10-29: «"в сети" должны показываться люди кто играют, а не кто на форуме … на
// рейтинге … переключатель»): the rating with the switch off (the green dots) and on, the forum's stat tile and its
// online list with the dots — against a local server with two game clients connected (online29-seed.ts), 1366×768 and
// 390×844. Usage: node tools/mobile/ux/online29.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/online29';
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58830';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--qa-tag=on830'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=on830*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
for (const [W, H, dev] of [[1366, 768, 'desk'], [390, 844, 'phone']]) {
  const touch = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU', deviceScaleFactor: touch ? 2 : 1 });
  const p = await ctx.newPage();
  // the rating, the switch off: the list with the green dots by the two in the game (scrolled to them)
  await p.goto(`${B}/site/rating/?board=level`, { waitUntil: 'load', timeout: 120000 });
  await sleep(2500);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.rt-tabs').getBoundingClientRect().top + scrollY - 110));
  await sleep(600);
  await p.screenshot({ path: `${OUT}/rating_off_${dev}.png` });
  await p.evaluate(() => document.querySelector('.rt-name .rt-live')?.closest('li')?.scrollIntoView({ block: 'center' }));
  await sleep(600);
  await p.screenshot({ path: `${OUT}/rating_off_dots_${dev}.png` });
  // the switch on (the link with &online=1)
  await p.goto(`${B}/site/rating/?board=level&online=1`, { waitUntil: 'load', timeout: 120000 });
  await sleep(2500);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.rt-tabs').getBoundingClientRect().top + scrollY - 110));
  await sleep(600);
  await p.screenshot({ path: `${OUT}/rating_on_${dev}.png` });
  // a board with nobody in the game: the empty line
  await p.click('[data-board="arena"]');
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/rating_on_empty_${dev}.png` });
  // the forum: the stat tile, the online list and its dots
  await p.goto(`${B}/site/forum/`, { waitUntil: 'load', timeout: 120000 });
  await sleep(3000);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.f-tiles').getBoundingClientRect().top + scrollY - 110));
  await sleep(600);
  await p.screenshot({ path: `${OUT}/forum_home_${dev}.png` });
  await p.goto(`${B}/site/forum/l/online`, { waitUntil: 'load', timeout: 120000 });
  await sleep(3000);
  await p.screenshot({ path: `${OUT}/forum_online_${dev}.png` });
  console.log(dev, await p.evaluate(() => ({ dots: document.querySelectorAll('.f-dot').length, members: document.querySelectorAll('.f-member').length })));
  await ctx.close();
}
await b.close();
console.log('shots in', OUT);
