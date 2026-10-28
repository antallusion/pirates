// Proof shots (owner, 2026-10-28): a stack split aboard and merged back, the thank-you letter in port, «нет места»
// with its way to the Crew window, the letter taken with room, and the gift stack after a fight that cost it men — its
// «подарок» mark, and nothing to refill it with. 1366×768 and 844×390, RU.
// Usage: node tools/mobile/ux/pc28gift.mjs [1366|844]   (QA server: PORT=58780 GRAVETIDE_ADMIN=1 GIFT28=off, a fresh
// database for each size: the letter goes once, to the captains there were when it went)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc28gift';
mkdirSync(OUT, { recursive: true });
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
    await p.fill('#login-name', 'Gift' + Math.random().toString(36).slice(2, 7));
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
const open = async (p, m) => { await p.evaluate(() => globalThis.gravetide.open(null)); await sleep(300); await p.evaluate((m) => globalThis.gravetide.open(m), m); await sleep(1200); };
const clearToasts = (p) => p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
const army = (p) => p.evaluate(() => (globalThis.gravetide.state.self?.company.army ?? []).map((x) => `${x.u}${x.g ? '!' : ''}${x.p ? '#' + x.p : ''}×${x.n}`).join(' '));
const into = (p, sel) => p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), sel);
const tap = async (p, sel) => { const ok = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel); if (!ok) log.push(`no ${sel}`); await sleep(500); };
const shot = async (p, W, name) => { await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click()); await sleep(500); await p.screenshot({ path: `${OUT}/${W}_${name}.png` }); log.push(`${W} ${name}: ${await army(p)}`); };
const dockNear = async (p, at) => {
  const port = at ?? await p.evaluate(() => { const s = globalThis.gravetide.state; const me = s.you; return [...s.ports].sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]?.id; });
  await cmd(p, `/tp ${port}`, 1500);
  for (let i = 0; i < 12; i++) {
    await send(p, { t: 'dock' });
    await sleep(2500);
    if (await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt)) break;
  }
  log.push(`docked: ${await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt)}`);
  return port;
};

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  for (const c of ['/level 10', '/ship brig', '/army clear', '/army marine 30', '/army sailor 24']) await cmd(p, c);
  const port = await dockNear(p);
  await clearToasts(p);
  // 1. split: the marines picked, the empty slot tapped, 12 of them to the new stack
  await open(p, 'crew');
  await tap(p, '[data-army-edit] [data-sk="marine"]');
  await tap(p, '[data-army-edit] [data-empty]');
  await p.evaluate(() => { const r = document.querySelector('[data-split-n]'); if (r) { r.value = '12'; r.dispatchEvent(new Event('input', { bubbles: true })); } });
  await into(p, '[data-army-edit]');
  await shot(p, W, '1_split');
  await tap(p, '[data-split-go]');
  await sleep(1500);
  await into(p, '[data-army-edit]');
  await shot(p, W, '2_split_done');
  // 2. merge: the part picked (its kin outlined), then dropped on its kin
  await tap(p, '[data-army-edit] [data-sk="marine#1"]');
  await into(p, '[data-army-edit]');
  await shot(p, W, '3_merge_pick');
  await tap(p, '[data-army-edit] [data-sk="marine"]');
  await sleep(1500);
  await into(p, '[data-army-edit]');
  await shot(p, W, '4_merged');
  // 3. the slots filled (the sailors split four ways), the letter sent
  for (let i = 0; i < 6; i++) { await send(p, { t: 'army', op: 'split', k: 'sailor', n: 2 }); await sleep(300); }
  await cmd(p, '/gift28 send', 1500);
  await clearToasts(p);
  await open(p, 'journal');
  await tap(p, '[data-jtab="letters"], [data-tab="letters"]');
  await sleep(800);
  await shot(p, W, '5_letter');
  // 4. «нет места»
  await tap(p, '[data-take]');
  await sleep(1200);
  await into(p, '.let-noroom');
  await shot(p, W, '6_noroom');
  // 5. the Crew window from the letter, a stack dismissed, the letter taken
  await tap(p, '[data-let-crew]');
  await sleep(1000);
  await tap(p, '[data-army-edit] [data-sk="sailor#1"]');
  await tap(p, '[data-op-dismiss]');
  await sleep(500);
  await tap(p, '[data-yes]');
  await sleep(1500);
  await clearToasts(p);
  await open(p, 'journal');
  await tap(p, '[data-jtab="letters"], [data-tab="letters"]');
  await tap(p, '[data-take]');
  await sleep(1200);
  await open(p, 'crew');
  await p.evaluate(() => document.querySelector('[data-army-edit] .army-row')?.scrollIntoView({ block: 'start' }));
  await shot(p, W, '7_taken');
  // 6. a fight at sea: the guns thin the musketeers first (the fewest hit points a man), then home
  await open(p, null);
  await cmd(p, '/army marine 60');
  await cmd(p, '/army deckhand 0');
  await cmd(p, '/army sailor 0');
  await cmd(p, '/scrolls 10');
  await cmd(p, '/tp gravewater', 2500);
  // a boarding fought out at once (the battle's «Быстрый бой»): the gift's musketeers stand in the line and lose men
  const gift = () => p.evaluate(() => (globalThis.gravetide.state.self?.company.army ?? []).find((x) => x.g)?.n ?? 0);
  for (let round = 0; round < 9 && (await gift()) >= 10; round++) {
    await cmd(p, '/army marine 50');
    await cmd(p, `/board pirate brig ${5 + round * 3}`, 2500);
    for (let i = 0; i < 12; i++) {
      await send(p, { t: 'tac', act: { a: 'quick' } });
      await sleep(1500);
      if (await p.evaluate(() => !!globalThis.gravetide.state.boardTac?.result)) break;
    }
    await sleep(2500);
    log.push(`boarding ${round}: ${await army(p)}`);
    if ((await gift()) < 10) break;
    await cmd(p, '/morale 90');
    await p.evaluate(() => globalThis.gravetide.open(null));
    await sleep(1500);
  }
  await sleep(2500);
  await shot(p, W, '8a_battle_result');
  await tap(p, '[data-endbtn]');
  await sleep(2500);
  await shot(p, W, '8b_after_battle');
  await send(p, { t: 'loot_take', take: {}, fate: 'sink' });
  await sleep(1500);
  log.push(`after the boarding: ${await army(p)}`);
  await cmd(p, '/morale 90');
  await sleep(1000);
  await dockNear(p, port);
  await clearToasts(p);
  await open(p, 'crew');
  await into(p, '[data-army-edit]');
  await shot(p, W, '8_gift_after_fight');
  await open(p, 'port');
  await tap(p, '[data-ptab="army"]');
  await sleep(800);
  await tap(p, '[data-surgeon]');
  await sleep(1200);
  await shot(p, W, '9_no_refill');
  log.push(`fallen: ${JSON.stringify(await p.evaluate(() => globalThis.gravetide.state.fallen?.rows ?? null))}`);
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
