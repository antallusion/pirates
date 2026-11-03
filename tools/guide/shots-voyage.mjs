// «Лоцманская книга»: the slide pictures for the sections sea (sea2.ts), combat, flags, travel, trade — real screens of
// the game, the spot in question outlined by a thin gold frame, cropped to 16:9 and saved as WEBP (640×360, q≈70,
// ≤60 KB) in assets/guide/<article>-<n>.webp. No art is made: only the game as it stands, set up by the admin commands.
//   PORT=58810 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-guide.db node --disable-warning=ExperimentalWarning server/src/main.ts
//   GPORT=58810 node tools/guide/shots-voyage.mjs            (all)   ONLY=sea,combat,flags,travel,trade   KEEP=1 (the PNGs)
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import { mkdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import * as L from '../mobile/m0/lib.mjs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');

const port = Number(process.env.GPORT ?? 58810);
const OUT = 'assets/guide';
const TMP = process.env.TMP_SHOTS ?? 'C:/tmp/gshots/png';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PICK = process.env.PICK ? new RegExp(process.env.PICK) : null;
const W = 1024, H = 576;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const made = [];

const b = await chromium.launch({ executablePath: L.EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--qa-tag=guide${port}`] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=guide${port}*' }; foreach ($p in $m) { (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}

// ---------- helpers ----------
const sleep = L.sleep;
const say = async (p, t, ms = 700) => { await L.say(p, t); await sleep(ms); };
const dismiss = (p) => p.evaluate(() => {
  document.querySelectorAll('.center-card .btn-primary').forEach((x) => x.click());
  document.querySelectorAll('button').forEach((x) => { if (/^(Позже|Later)$/.test(x.textContent.trim()) && x.offsetParent && !x.closest('#surrender')) x.click(); });
}).catch(() => {});
const clean = async (p) => { await dismiss(p); await L.closeAll(p, 2); await p.evaluate(() => { document.querySelectorAll('#detail .dc-x').forEach((x) => x.click()); document.querySelectorAll('.k-toast, #toasts > .toast').forEach((t) => t.remove()); globalThis.gravetide.aim?.menu?.hide?.(); }); };
/** The one-time hints (the advice toasts, the first-time tips) kept off the pictures. */
const prep = (p) => p.addStyleTag({ content: '.toast.advice, #hud-tip, *:has(> .mg-card) { display: none !important; }' }).catch(() => {});
const wait = async (p, f, ms = 20000, arg) => { for (let t = 0; t < ms; t += 300) { if (await p.evaluate(f, arg).catch(() => false)) return true; await sleep(300); } return false; };
const click = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const clickText = (p, re, scope = 'body') => p.evaluate(([r, s]) => { const x = new RegExp(r); const e = [...document.querySelectorAll(`${s} button, ${s} [role=button], ${s} .chip`)].find((b) => b.offsetParent && x.test(b.textContent.trim())); e?.click(); return !!e; }, [re.source, scope]);
const open = async (p, m, ms = 1200) => { await p.evaluate(() => globalThis.gravetide.open(null)); await sleep(200); await L.open(p, m); await sleep(ms); };
const tab = async (p, t, ms = 1000) => { const ok = await click(p, `[data-ptab="${t}"]`); await sleep(ms); return ok; };
const self = (p) => p.evaluate(() => globalThis.gravetide.state.self);
async function dock(p, id) {
  await say(p, `/tp ${id}`, 1500);
  await L.send(p, { t: 'dock' });
  const ok = await wait(p, (i) => globalThis.gravetide.state.self?.dockedAt === i, 30000, id);
  await sleep(1500); await dismiss(p);
  if (!ok) L.log('NOT DOCKED at', id);
  return ok;
}
async function toSea(p, where = 'gravesend', ms = 2500) {
  await say(p, `/tp ${where}`, ms);
  await wait(p, () => !globalThis.gravetide.state.self?.dockedAt, 15000);
  await clean(p);
}
const nearest = (p, pred) => p.evaluate((src) => {
  const f = new Function('s', `return (${src})(s)`);
  const st = globalThis.gravetide.state, o = st.ownDisplay;
  let best = null, bd = Infinity;
  for (const s of st.ships.values()) {
    if (!s.info || s.id === st.entityId || !s.cur || !f(s)) continue;
    const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y);
    if (d < bd) [best, bd] = [s.id, d];
  }
  return best;
}, pred.toString());
const ring = (p, id) => p.evaluate((i) => {
  const g = globalThis.gravetide;
  const t = g.aim.choices(`ship:${i}`);
  if (!t) return null;
  g.aim.menu.show(`ship:${i}`, t.choices, t.name, !!t.info);
  g.aim.menu.place(t.x, t.y, t.r, []);
  return t.choices.map((c) => c.label);
}, id);
/** A finger held on a button that opens a wheel (kit/radial.ts): the press, the wheel up; `release` lets it go. */
const hold = (p, sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); const o = { bubbles: true, pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 }; e.dispatchEvent(new PointerEvent('pointerdown', o)); globalThis.__held = [e, o]; return true; }, sel);
const release = (p) => p.evaluate(() => { const h = globalThis.__held; if (h) h[0].dispatchEvent(new PointerEvent('pointercancel', { ...h[1] })); globalThis.__held = null; });
const zoom = (p, k) => p.evaluate((z) => { const r = globalThis.gravetide.renderer; r.userZoomed = true; r.targetZoom = r.seenZoom = z; }, k);

/** The boxes of what to outline (a selector, a list of them, or a box [x,y,w,h]); the union of what is on screen. */
const boxOf = (p, what) => p.evaluate((w) => {
  const list = Array.isArray(w) && typeof w[0] === 'number' ? [w] : (Array.isArray(w) ? w : [w]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of list) {
    let rs = [];
    if (Array.isArray(q)) rs = [{ left: q[0], top: q[1], right: q[0] + q[2], bottom: q[1] + q[3] }];
    else for (const e of document.querySelectorAll(q)) { const r = e.getBoundingClientRect(); if (r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) rs.push(r); }
    for (const r of rs) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  }
  return x0 === Infinity ? null : [x0, y0, x1 - x0, y1 - y0];
}, what);

/**
 * One slide picture: the gold frame round `mark`, the crop a 16:9 box round `focus` (default: the mark) at least `min`
 * wide (whole screen: full), then 640×360 WEBP.
 */
async function shot(p, name, o = {}) {
  if (PICK && !PICK.test(name)) return;
  try { await shot1(p, name, o); } catch (e) { L.log('  FAILED shot', name, String(e.message).slice(0, 160)); await p.evaluate(() => document.getElementById('__guide-mark')?.remove()).catch(() => {}); }
}
async function shot1(p, name, { mark, focus, min = 560, pad = 4, full = false } = {}) {
  const m = mark ? await boxOf(p, mark) : null;
  if (mark && !m) L.log('  (no mark on screen)', name, JSON.stringify(mark));
  if (m) await p.evaluate(([x, y, w, h, d]) => {
    const e = document.createElement('div');
    e.id = '__guide-mark';
    e.style.cssText = `position:fixed;left:${x - d}px;top:${y - d}px;width:${w + 2 * d}px;height:${h + 2 * d}px;border:2px solid #e2b84a;border-radius:5px;box-shadow:0 0 0 1px rgba(0,0,0,.65),0 0 8px rgba(226,184,74,.55);pointer-events:none;z-index:2147483647;box-sizing:border-box`;
    document.body.appendChild(e);
  }, [...m, pad]);
  let clip = { x: 0, y: 0, width: W, height: H };
  if (!full) {
    const f = (focus ? await boxOf(p, focus) : null) ?? m;
    if (f) {
      let cw = Math.max(min, f[2] + 80, (f[3] + 60) * 16 / 9);
      cw = Math.min(W, cw);
      const ch = cw * 9 / 16;
      let cx = f[0] + f[2] / 2 - cw / 2, cy = f[1] + f[3] / 2 - ch / 2;
      cx = Math.max(0, Math.min(W - cw, cx)); cy = Math.max(0, Math.min(H - ch, cy));
      clip = { x: Math.round(cx), y: Math.round(cy), width: Math.round(cw), height: Math.round(ch) };
    }
  }
  const png = `${TMP}/${name}.png`;
  await p.screenshot({ path: png, clip, timeout: 180000 });
  await p.evaluate(() => document.getElementById('__guide-mark')?.remove());
  const out = `${OUT}/${name}.webp`;
  for (const q of [70, 62, 54, 46]) {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=640:360:flags=lanczos', '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', out]);
    if (statSync(out).size <= 60 * 1024) break;
  }
  if (!process.env.KEEP) unlinkSync(png);
  made.push([name, statSync(out).size]);
  L.log('  shot', name, Math.round(statSync(out).size / 1024) + ' KB', m ? '' : '(no mark)');
}

/** L.login with the patience of a busy machine (its 90 s were not always enough to load the page). */
async function login1(p) {
  const T = 300000;
  await p.goto(`http://localhost:${port}`, { waitUntil: 'commit', timeout: T });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: T });
  const name = 'Guide ' + Math.random().toString(36).slice(2, 6);
  for (let i = 0; ; i++) {
    const on = await p.waitForSelector('#screen-captain:not(.hidden), #screen-login:not(.hidden) #login-name', { timeout: T });
    if (await on.evaluate((e) => e.id === 'screen-captain')) break;
    await p.fill('#login-name', name);
    await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
    try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: T }); break; } catch (e) { if (i >= 3) throw e; }
  }
  await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
  await p.evaluate(() => document.getElementById('pick-captain')?.click());
  for (let i = 0; i < 80; i++) { if (await p.$('#hud:not(.hidden)')) break; await p.mouse.click(10, 10).catch(() => {}); await sleep(500); }
  await p.waitForSelector('#hud:not(.hidden)', { timeout: T });
  await sleep(2000);
  p.name = name;
  return name;
}
/** A login that tries again: the machine is often busy (a slow software GPU, other helpers' browsers). */
async function login(p) {
  for (let i = 0; ; i++) {
    try { return await login1(p); } catch (e) { if (i >= 2) throw e; L.log('  login again:', String(e.message).slice(0, 80)); await sleep(5000); }
  }
}
async function captain(lang = 'ru', level = 20, safe = true) {
  const p = await L.page(b, [W, H], { lang, touch: true });
  p.setDefaultTimeout(180000);
  await login(p);
  await prep(p);
  await say(p, `/level ${level}`);
  await say(p, '/silver 300000');
  // no harm while the pictures are taken: the sea's pirates neither sink nor board her
  await say(p, '/god on', 300);
  if (safe) await say(p, '/noboard on', 300);
  await clean(p);
  return p;
}
const want = (k) => !ONLY || ONLY.includes(k);

// ---------- the sections ----------
import { SEA } from './scenes-sea.mjs';
import { COMBAT } from './scenes-combat.mjs';
import { FLAGS } from './scenes-flags.mjs';
import { TRAVEL } from './scenes-travel.mjs';
import { TRADE } from './scenes-trade.mjs';
const K = { hold, release, login, prep, L, sleep, say, dismiss, clean, wait, click, clickText, open, tab, self, dock, toSea, nearest, ring, zoom, shot, boxOf, W, H };
try {
  for (const [key, run] of [['sea', SEA], ['combat', COMBAT], ['flags', FLAGS], ['travel', TRAVEL], ['trade', TRADE]]) {
    if (!want(key)) continue;
    L.log('section', key);
    const p = await captain('ru', 20, key !== 'flags' && key !== 'combat');
    try { await run(p, K, { captain, b }); } catch (e) { L.log('FAIL', key, e.stack); }
    if (p.errors?.length) L.log('page errors', JSON.stringify(p.errors.slice(0, 5)));
    await p.ctx.close().catch(() => {});
  }
} finally {
  await b.close();
  const tot = made.reduce((s, [, n]) => s + n, 0);
  L.log(`made ${made.length} pictures, ${Math.round(tot / 1024)} KB; largest ${Math.round(Math.max(0, ...made.map(([, n]) => n)) / 1024)} KB`);
}
