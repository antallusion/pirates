// Proof shots for forum posts 66 and 69 (the tester Эдуард): the captain named before the filter fixed by /names, her
// free rename refusing a coarse name («Имя не подходит: выберите другое») and taking a fine one; then the news topic
// read by a player (the link «Обсудить на форуме →» under the news, the discussion's panel instead of the reply box) and
// its discussion with the players' replies carried there at boot. 390 and 1366 wide, RU.
//   node tools/mobile/ux/forum69-seed.ts data/qa-f69
//   PORT=58830 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-f69/gravetide.db node server/src/main.ts
//   GPORT=58830 node tools/mobile/ux/forum69.mjs
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as L from '../m0/lib.mjs';
const OUT = process.env.OUT ?? 'assets/raw/audit/forum69';
mkdirSync(OUT, { recursive: true });
const port = Number(process.env.GPORT ?? 58830);
const B = `http://127.0.0.1:${port}`;
const TOKEN = 'qa-forum69-token-0000000000';
const { createRequire } = await import('node:module');
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=f69${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=f69${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const log = (...a) => console.log(...a);
try {
  // ---- the game: the captain «ПИДОРАС» from before the filter, signed in by her token
  const p = await L.page(b, [1366, 768], { touch: false });
  await p.ctx.addInitScript((t) => { try { localStorage.setItem('gravetide.token', t); localStorage.setItem('gravetide.captain', 'ПИДОРАС'); } catch {} }, TOKEN);
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // her token resumes her; the «Продолжить» button if the title screen asks
  for (let i = 0; i < 60; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    if (await p.$('#hud:not(.hidden)')) break;
    await p.evaluate(() => { const c = document.getElementById('login-continue'); if (c && !c.classList.contains('hidden')) c.click(); });
    await L.sleep(1000);
  }
  if (await p.$('#screen-captain:not(.hidden)')) {
    await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
    await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
    // a coarse ship's name first: refused at the choice
    await p.evaluate(() => { const i = document.getElementById('ship-name'); if (i) { i.value = 'Залупа'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p.evaluate(() => document.getElementById('pick-captain')?.click());
    await L.sleep(2500);
    await p.screenshot({ path: `${OUT}/ship_refused_1366.png`, timeout: 180000 });
    log('ship refused:', await p.evaluate(() => document.getElementById('captain-why')?.textContent ?? ''));
    await p.evaluate(() => { const i = document.getElementById('ship-name'); if (i) { i.value = 'Чёрная Каракатица'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p.evaluate(() => document.getElementById('pick-captain')?.click());
  }
  for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) {
    await p.mouse.click(10, 10).catch(() => {});
    await L.sleep(1000);
  }
  await L.sleep(3000);
  log('aboard as', await p.evaluate(() => globalThis.gravetide.state.self?.name));
  await L.say(p, '/names scan');
  await L.sleep(1500);
  await p.screenshot({ path: `${OUT}/names_scan_1366.png`, timeout: 180000 });
  await L.closeAll(p); // (the First Watch's help: the rename page waits for no window to be open)
  await L.say(p, '/names fix all');
  // the free rename's page opens by itself
  await p.waitForSelector('.cap-rename', { timeout: 30000 });
  await L.sleep(800);
  log('renamed to', await p.evaluate(() => globalThis.gravetide.state.self?.name), 'renames', await p.evaluate(() => globalThis.gravetide.state.self?.renames));
  await p.fill('.cap-rename input[name=name]', 'Хуй Моржовый');
  await p.evaluate(() => document.querySelector('.cap-rename button[type=submit]')?.click());
  await p.waitForSelector('.cap-rename .cap-msg.cap-bad', { timeout: 15000 });
  await L.sleep(400);
  await p.screenshot({ path: `${OUT}/rename_refused_1366.png`, timeout: 180000 });
  log('refusal:', await p.evaluate(() => document.querySelector('.cap-rename .cap-msg')?.textContent));

  // the same page on a phone (390 by 844, held as the game is played), the same refusal
  const q = await L.page(b, [844, 390], { touch: true }); // (a phone plays lying down: 390 high)
  await q.ctx.addInitScript((t) => { try { localStorage.setItem('gravetide.token', t); } catch {} }, TOKEN);
  await p.close(); // (one session per account: the phone takes her over)
  await q.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  for (let i = 0; i < 60 && !(await q.$('#hud:not(.hidden)')); i++) {
    await q.evaluate(() => { const c = document.getElementById('login-continue'); if (c && !c.classList.contains('hidden')) c.click(); });
    await q.mouse.click(5, 5).catch(() => {});
    await L.sleep(1000);
  }
  await L.sleep(2000);
  await L.closeAll(q);
  await q.waitForSelector('.cap-rename', { timeout: 30000 });
  await q.fill('.cap-rename input[name=name]', 'Pid0r Morskoy');
  await q.evaluate(() => document.querySelector('.cap-rename button[type=submit]')?.click());
  await q.waitForSelector('.cap-rename .cap-msg:not(:empty)', { timeout: 15000 }).catch(() => {});
  await L.sleep(400);
  await q.screenshot({ path: `${OUT}/rename_refused_844x390.png`, timeout: 180000 });
  log('phone refusal:', await q.evaluate(() => document.querySelector('.cap-rename .cap-msg')?.textContent));
  await q.fill('.cap-rename input[name=name]', 'Анна Чистая');
  await q.evaluate(() => document.querySelector('.cap-rename button[type=submit]')?.click());
  await q.waitForSelector('.cap-rename .cap-msg:not(.cap-bad):not(:empty)', { timeout: 15000 }).catch(() => {});
  await L.sleep(400);
  await q.screenshot({ path: `${OUT}/rename_done_844x390.png`, timeout: 180000 });
  log('done:', await q.evaluate(() => document.querySelector('.cap-rename .cap-msg')?.textContent), 'name', await q.evaluate(() => globalThis.gravetide.state.self?.name));
  await q.ctx.close();

  // ---- the forum, signed in as that player (the token): the news and its discussion
  for (const [W, H, dev] of [[1366, 900, '1366'], [390, 844, '390']]) {
    const f = await L.page(b, [W, H], { touch: W < 1000, films: true });
    await f.ctx.addInitScript((t) => { try { localStorage.setItem('gravetide.token', t); } catch {} }, TOKEN);
    await f.goto(`${B}/site/forum/t/3`, { waitUntil: 'load', timeout: 120000 });
    await f.waitForSelector('.f-posts', { timeout: 60000 });
    await L.sleep(2500);
    await f.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in', 'is-in', 'shown')));
    log(dev, 'news: reply box', !!(await f.$('#f-reply')), 'discuss panel', !!(await f.$('#f-discuss')), 'link', !!(await f.$('.f-discuss-link a')));
    await f.screenshot({ path: `${OUT}/news_${dev}.png`, fullPage: true, timeout: 180000 });
    await f.$('#f-discuss').then((e) => e?.scrollIntoViewIfNeeded());
    await L.sleep(600);
    await f.screenshot({ path: `${OUT}/news_end_${dev}.png`, timeout: 180000 });
    const talk = await f.evaluate(() => document.querySelector('#f-discuss a.btn-gold')?.getAttribute('href'));
    await f.goto(`${B}${talk}`, { waitUntil: 'load', timeout: 120000 });
    await f.waitForSelector('.f-posts', { timeout: 60000 });
    await L.sleep(2500);
    await f.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in', 'is-in', 'shown')));
    log(dev, 'talk:', await f.evaluate(() => [...document.querySelectorAll('.f-post')].length), 'posts, reply box', !!(await f.$('#f-reply')));
    await f.screenshot({ path: `${OUT}/talk_${dev}.png`, fullPage: true, timeout: 180000 });
    if (f.errors.length) log(dev, 'page errors:', f.errors.slice(0, 5));
    await f.ctx.close();
  }
} finally {
  await b.close();
}
