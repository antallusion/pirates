// Proof shots of the PvP points (owner, 2026-10-30): the Captain window's «ПвП» page (1366×768, 844×390, 390×844) and
// the site's «ПвП» board, its «Прошлые сезоны» and a captain's card (1366×768, 390×844). One headless Chrome at
// BelowNormal. The server and its data: tools/mobile/ux/pvp30-seed.ts. Usage: GPORT=58820 node tools/mobile/ux/pvp30.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const OUT = process.env.OUT ?? 'assets/raw/audit/pvp30';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58820);
const B = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=pv${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=pv${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const report = {};
const RUN = String(Date.now() % 1000);
const NAME = (w) => `Анна ${w} ${RUN}`;
let keep = null; // (the first captain stays aboard: the site's «В сети» and the forum's list show her)
try {
  // ---- the game: a captain with points, her «ПвП» page
  for (const [W, H] of [[1366, 768], [844, 390], [390, 844]]) {
    const tag = `${W}x${H}`;
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await L.login(p, { port, know: true, name: NAME(W) });
    await L.closeAll(p);
    await L.say(p, '/pvprank add 340 21');
    await L.sleep(800);
    await L.open(p, 'hero');
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('[data-cchip="pvp"]')?.click());
    for (let i = 0; i < 30 && !(await p.$('.pv-head')); i++) await L.sleep(300);
    await L.sleep(1200);
    await p.screenshot({ path: `${OUT}/game-${tag}-1-top.png` });
    const m = await p.evaluate(() => {
      const body = document.querySelector('.cap-body');
      const over = [...document.querySelectorAll('.pv *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && !e.classList.contains('pv-nm')).length;
      return { rows: document.querySelectorAll('.pv-row').length, me: document.querySelector('.pv-row.me')?.textContent?.replace(/\s+/g, ' ').trim(), head: document.querySelector('.pv-head')?.textContent?.replace(/\s+/g, ' ').trim(), scroll: body ? [body.scrollHeight, body.clientHeight] : null, over };
    });
    report[`game ${tag}`] = { ...m, latin: await L.latin(p, '.pv'), errors: p.errors.slice(0, 3) };
    await p.evaluate(() => { const s = document.querySelector('.cap-body'); if (s) s.scrollTop = s.scrollHeight; });
    await L.sleep(600);
    await p.screenshot({ path: `${OUT}/game-${tag}-2-rewards.png` });
    if (keep) await p.ctx.close();
    else keep = p;
  }
  // ---- the site: the board, the past seasons, a captain's card
  for (const [W, H, dev] of [[1366, 768, 'desk'], [390, 844, 'phone']]) {
    const touch = W < 1000;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU', deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${B}/site/rating/?board=pvp`, { waitUntil: 'load', timeout: 120000 });
    await L.sleep(2500);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.rt-tabs').getBoundingClientRect().top + scrollY - 90));
    await L.sleep(700);
    await p.screenshot({ path: `${OUT}/site-${dev}-1-board.png` });
    const board = await p.evaluate(() => [...document.querySelectorAll('.rt-row')].slice(0, 3).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    await p.evaluate(() => document.querySelector('.rt-onl')?.click());
    await L.sleep(1800);
    await p.screenshot({ path: `${OUT}/site-${dev}-2-online.png` });
    const online = await p.evaluate(() => [...document.querySelectorAll('.rt-row')].map((r) => r.querySelector('.rt-name')?.textContent?.trim()));
    await p.evaluate(() => document.querySelector('.rt-onl')?.click());
    await L.sleep(800);
    await p.evaluate(() => document.querySelector('.rt-past')?.click());
    await L.sleep(1800);
    await p.screenshot({ path: `${OUT}/site-${dev}-3-past.png` });
    const past = await p.evaluate(() => ({ head: document.querySelector('.rt-season h3')?.textContent, rows: document.querySelectorAll('.rt-row').length, url: location.search }));
    await p.goto(`${B}/site/rating/?board=pvp&captain=${encodeURIComponent(NAME(1366))}`, { waitUntil: 'load', timeout: 120000 });
    for (let i = 0; i < 30 && !(await p.$('.cp:not([hidden]) .cp-tile')); i++) await L.sleep(300);
    await L.sleep(1500);
    await p.screenshot({ path: `${OUT}/site-${dev}-4-card.png` });
    const card = await p.evaluate(() => [...document.querySelectorAll('.cp-tile')].slice(0, 6).map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
    report[`site ${dev}`] = { board, online, past, card, errs };
    await ctx.close();
  }
  // ---- the forum: «Кто в сети» (the game's)
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ru-RU' });
    const p = await ctx.newPage();
    await p.goto(`${B}/site/forum/l/online`, { waitUntil: 'load', timeout: 120000 });
    await L.sleep(3000);
    await p.screenshot({ path: `${OUT}/forum-online-desk.png` });
    report.forum = await p.evaluate(() => ({ lead: document.querySelector('.hero p, .lead, .hero-lead')?.textContent?.trim(), members: [...document.querySelectorAll('.f-member .f-nick')].map((e) => e.textContent) }));
    await ctx.close();
  }
} finally {
  await b.close();
}
console.log(JSON.stringify(report, null, 1));
console.log('shots in', OUT);
