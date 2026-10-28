// Proof shots (owner, 2026-10-28): «дальний переход» — a far harbour set as her mark, 15 s of sailing, then ×10: the
// small toast, the tiny pill by the chart (time · way left), the helm dimmed and its hint, the ghost wake, and the
// arrival. 1366×768 and 844×390, RU. Also the popup budget measured (the toasts and the pill ÷ the screen).
// Usage: node tools/mobile/ux/passage28.mjs [1366|844]   (QA server: PORT=58810 GRAVETIDE_ADMIN=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'assets/raw/audit/passage28';
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
  await ctx.addInitScript(() => {
    try { localStorage.setItem('gravetide.lang', 'ru'); } catch {}
    setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300);
    // every toast that comes up, wherever (the HUD's band or a window's strip), with its kind
    globalThis.__toasts = [];
    new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes) if (n.classList?.contains('toast')) globalThis.__toasts.push(`${n.className}: ${n.textContent}`); for (const n of m.removedNodes) if (n.classList?.contains('toast') && / voyage/.test(n.className)) globalThis.__toasts.push(`GONE ${Math.round(performance.now())} ${n.className}: ${n.textContent} from ${m.target.id}`); } }).observe(document, { childList: true, subtree: true });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
  return p;
}
async function toSea(p) {
  await p.goto(B, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 120000 });
  for (let i = 0; i < 4; i++) {
    if (await p.$('#screen-captain:not(.hidden)')) break;
    await p.fill('#login-name', 'Pass' + Math.random().toString(36).slice(2, 7));
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
};
const send = (p, m) => p.evaluate((m) => globalThis.gravetide.net.send(m), m);
const clearToasts = (p) => p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
/** The popup budget: the toasts, the stack's temporary plates and the pill, their area ÷ the screen's, and whether any
 *  covers the screen's middle. */
const budget = (p) => p.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const els = [...document.querySelectorAll('#toasts > .toast, #hud-voyage:not(.hidden)')];
  let area = 0, centre = false;
  const cx0 = W * 0.3, cx1 = W * 0.7, cy0 = H * 0.3, cy1 = H * 0.7;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    area += r.width * r.height;
    if (r.right > cx0 && r.left < cx1 && r.bottom > cy0 && r.top < cy1) centre = true;
  }
  const pill = document.getElementById('hud-voyage')?.getBoundingClientRect();
  const map = document.getElementById('hud-map')?.getBoundingClientRect();
  const over = pill && pill.width ? [...document.querySelectorAll('#touch > *:not(.hidden), #hud-captain, #hud-autosail:not(.hidden)')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width && r.height && e.id !== 'hud-voyage' && r.right > pill.left && r.left < pill.right && r.bottom > pill.top && r.top < pill.bottom;
  }).map((e) => e.id) : [];
  return { share: Math.round((area / (W * H)) * 1000) / 10, centre, pill: pill && pill.width ? [Math.round(pill.left), Math.round(pill.top), Math.round(pill.width), Math.round(pill.height)] : null, map: map ? [Math.round(map.left), Math.round(map.top), Math.round(map.width), Math.round(map.height)] : null, over, toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => t.textContent) };
});
const info = (p) => p.evaluate(() => {
  const s = globalThis.gravetide.state;
  return { voyage: s.voyage, pill: document.getElementById('hud-voyage')?.textContent ?? '', you: s.you ? [Math.round(s.you.x), Math.round(s.you.y), Math.round(s.you.spd * 10) / 10, Math.round(s.you.hull)] : null, as: !!s.autosail, body: document.body.classList.contains('voyage') };
});
const shot = async (p, W, name) => {
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  const pre = `${JSON.stringify(await info(p))} budget ${JSON.stringify(await budget(p))}`; // (measured first: a screenshot under swiftshader takes seconds)
  await p.screenshot({ path: `${OUT}/${W}_${name}.png` });
  log.push(`${W} ${name}: ${pre}`);
};

const only = process.argv[2];
for (const [W, H] of [[1366, 768], [844, 390]]) {
  if (only && String(W) !== only) continue;
  const p = await pg(W, H);
  await toSea(p);
  for (const c of ['/level 12', '/ship brig', '/god', '/weather breeze']) await cmd(p, c);
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await send(p, { t: 'undock' }); await sleep(6000); }
  await p.evaluate(() => document.querySelector('.lu-sheet [data-lulater]')?.click());
  await sleep(400);
  await p.evaluate(() => globalThis.gravetide.open(null));
  await sleep(400);
  // a harbour 10–18 km off by the straight line
  const to = await p.evaluate(() => {
    const s = globalThis.gravetide.state, me = s.you;
    const list = [...s.ports].map((pt) => ({ pt, d: Math.hypot(pt.x - me.x, pt.y - me.y) })).filter((x) => x.d > 10000 && x.d < 18000).sort((a, b) => a.d - b.d);
    return list[0] ? { x: list[0].pt.x, y: list[0].pt.y, name: list[0].pt.name, d: Math.round(list[0].d) } : null;
  });
  log.push(`${W} target ${JSON.stringify(to)}`);
  if (!to) continue;
  await clearToasts(p);
  await send(p, { t: 'autosail', x: Math.round(to.x), y: Math.round(to.y), sail: 4 });
  await sleep(6000);
  await shot(p, W, '1_before');
  // the spin-up: 15 s of her sailing, then ×10
  try { await p.waitForFunction(() => !!document.querySelector('.toast.voyage'), null, { timeout: 60000, polling: 50 }); } catch { log.push(`${W} no voyage toast in the DOM`); }
  log.push(`${W} toast up at ${await p.evaluate(() => Math.round(performance.now()))} in ${await p.evaluate(() => document.querySelector('.toast.voyage')?.parentElement?.id)}`);
  await sleep(250);
  await shot(p, W, '2_toast');
  // a pirate put by her side: he never engages (her hull logged before and after)
  await cmd(p, '/spawn pirate brig pirate', 300);
  await sleep(4000);
  await clearToasts(p);
  // a tap on the dimmed helm: why, said small
  const stick = await p.evaluate(() => { const r = document.getElementById('tc-stick')?.getBoundingClientRect(); return r && r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
  if (stick) { if (W < 1000) await p.touchscreen.tap(stick[0], stick[1]); else await p.mouse.click(stick[0], stick[1]); }
  await sleep(600);
  await shot(p, W, '3_mid');
  // the arrival
  for (let i = 0; i < 240 && (await p.evaluate(() => !!globalThis.gravetide.state.voyage)); i++) await sleep(500);
  await sleep(1200);
  await shot(p, W, '4_arrival');
  for (let i = 0; i < 60 && (await p.evaluate(() => !!globalThis.gravetide.state.autosail)); i++) await sleep(500);
  await sleep(800);
  await shot(p, W, '5_at_mark');
  log.push(`${W} toasts seen: ${JSON.stringify(await p.evaluate(() => globalThis.__toasts.filter((t) => / voyage|GONE/.test(t))))}`);
  log.push(`${W} modal at the end: ${await p.evaluate(() => document.body.className)}`);
  await p.context().close();
}
await b.close();
writeFileSync(`${OUT}/log.txt`, log.join('\n'));
console.log(log.join('\n'));
