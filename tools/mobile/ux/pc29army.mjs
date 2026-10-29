import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/pc29army';
import { mkdirSync } from 'node:fs';
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
    await p.fill('#login-name', 'Pc' + Math.random().toString(36).slice(2, 7));
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
const shut = async (p) => { await p.evaluate(() => globalThis.gravetide.open(null)); await sleep(500); };
// (pc29army) owner, 2026-10-29: the port with a full army (no finger on «Нанять армию»), the hire window with marines
// picked and «Юнги сойдут на берег», split / merge / dismiss in «Найм», the crew window from the sea's «⋯».
const finger = (p) => p.evaluate(() => { const f = document.getElementById('tut-finger'); const t = document.querySelector('.tut-target'); return { finger: !!f && !f.classList.contains('hidden'), target: t ? (t.getAttribute('data-ptab') ?? t.getAttribute('data-rcu') ?? (t.hasAttribute('data-dwell') ? 'data-dwell' : t.className)) : null }; });
const view = (p) => p.evaluate(() => ({ i1: globalThis.gravetide.state.self?.isleFirst, noHire: globalThis.gravetide.state.self?.noHire }));
const army = (p) => p.evaluate(() => (globalThis.gravetide.state.self?.company.army ?? []).map((x) => `${x.u}${x.g ? '!' : ''}${x.p ? '#' + x.p : ''}×${x.n}`).join(' '));
const tap = async (p, sel, wait = 600) => { const ok = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); if (!ok) log.push(`no ${sel}`); await sleep(wait); return ok; };
const shot = async (p, W, name) => { await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click()); await sleep(400); await p.screenshot({ path: `${OUT}/${W}_${name}.png` }); log.push(`${W} ${name}: army ${await army(p)} finger ${JSON.stringify(await finger(p))}`); };
const recruit = async (p) => { await shut(p); await send(p, { t: 'h3', action: 'dwell', src: 'port' }); await p.evaluate(() => globalThis.gravetide.open('recruit')); await sleep(2000); };
const only = process.argv[2];
for (const [W, H] of [[844, 390], [1093, 481]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  for (const c of ['/level 6', '/ship galiot 3', '/silver 20000']) await cmd(p, c);
  await cmd(p, '/isle');
  await sleep(6500);
  await cmd(p, '/town 1', 1500);
  await sleep(6000);
  log.push(`${W} step: ${JSON.stringify(await view(p))}`);
  await cmd(p, '/tp saltmarrow', 1500);
  for (let i = 0; i < 8 && !(await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt)); i++) { await send(p, { t: 'dock' }); await sleep(2500); }
  await cmd(p, '/dwell fill');
  const max = await p.evaluate(() => globalThis.gravetide.state.you?.crewMax ?? 28);
  // 1. the hammocks full of deckhands, the island's step «наймите морпехов»: marines picked, the hands going ashore
  await cmd(p, '/army clear');
  await cmd(p, `/army deckhand ${max}`, 1500);
  await recruit(p);
  log.push(`${W} sel: ${await p.evaluate(() => document.querySelector('.rc-unit.sel')?.getAttribute('data-rcu'))} swap: ${await p.evaluate(() => document.querySelector('[data-rcswap]')?.textContent)} view ${JSON.stringify(await view(p))}`);
  await shot(p, W, '2_hire_marines');
  // 2. the screenshot's army: tier VII ×half and tier I ×half — the might far over the cap, the step completes itself
  await shut(p);
  await cmd(p, `/army drowned ${Math.floor(max / 2)}`, 1500);
  await sleep(7000);
  log.push(`${W} full army: ${JSON.stringify(await view(p))}`);
  await p.evaluate(() => globalThis.gravetide.open('port'));
  await sleep(1500);
  await tap(p, '#modal-panel [data-ptab="army"]', 1500);
  await shot(p, W, '1_port_full_army');
  // 3. «Найм»: the stuck word, then split / merge / dismiss
  await recruit(p);
  await shot(p, W, '3_hire_full');
  await tap(p, '.rc-army [data-sk^="drowned"]');
  await tap(p, '.rc-army [data-op-split]');
  await p.evaluate(() => { const r = document.querySelector('.rc-army [data-split-n]'); if (r) { r.value = '4'; r.dispatchEvent(new Event('input')); } });
  await sleep(300);
  await shot(p, W, '4_split_slider');
  await tap(p, '.rc-army [data-split-go]', 2500);
  await shot(p, W, '5_split_done');
  const keys = await p.evaluate(() => [...document.querySelectorAll('.rc-army [data-sk^="drowned"]')].map((x) => x.getAttribute('data-sk')));
  log.push(`${W} drowned stacks: ${keys}`);
  if (keys.length >= 2) {
    await tap(p, `.rc-army [data-sk="${keys[1]}"]`);
    await shot(p, W, '6_merge_pick');
    await tap(p, `.rc-army [data-sk="${keys[0]}"]`, 2500);
    await shot(p, W, '7_merge_done');
  }
  await tap(p, '.rc-army [data-sk="deckhand"]');
  await tap(p, '.rc-army [data-op-dismiss]', 800);
  await shot(p, W, '8_dismiss_ask');
  await tap(p, '.confirm-panel [data-yes]', 2500);
  await shot(p, W, '9_dismiss_done');
  // 4. at sea: «⋯» → «Армия»
  await shut(p);
  await send(p, { t: 'undock' });
  await sleep(4000);
  await p.evaluate(() => document.querySelector('.depart-panel [data-dp="sail"]')?.click());
  await sleep(3000);
  await shut(p);
  await tap(p, '#tc-more', 800);
  await shot(p, W, '10_sea_tray');
  await tap(p, '#tc-crew', 1500);
  await shot(p, W, '11_sea_crew');
  log.push(`${W} modal at sea: ${await p.evaluate(() => !document.getElementById('modal')?.classList.contains('hidden'))} docked ${await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt)}`);
  await p.context().close();
}
await b.close();
console.log(log.join('\n'));
