// Playthrough kit: a browser, a captain, the QA kit, and helpers to sail, fight and measure.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
export const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
export const OUT = process.env.OUT ?? 'assets/raw/audit/m0';
mkdirSync(OUT, { recursive: true });
export const SIZES = { phone: [812, 375], small: [640, 360], mid: [800, 450], desk: [1280, 720], big: [1440, 900] };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function browser() {
  return chromium.launch({ executablePath: EXE, headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

/** A page at a size; touch below 1000 px wide. */
export async function page(b, [W, H] = SIZES.phone, opts = {}) {
  const touch = opts.touch ?? W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, locale: opts.lang === 'en' ? 'en-US' : 'ru-RU' });
  await ctx.addInitScript((l) => { try { if (!localStorage.getItem('gravetide.lang')) localStorage.setItem('gravetide.lang', l); } catch {} }, opts.lang ?? 'ru');
  // Films are another helper's: skipped as they come, so the screens under them can be measured.
  if (opts.films !== true) await ctx.addInitScript(() => { setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|net::/.test(m.text())) p.errors.push('console: ' + m.text().slice(0, 200)); });
  p.ctx = ctx;
  return p;
}

/** Log in a new captain. know: tick «I know the sea» (skips the First Watch). */
export async function login(p, { port = Number(process.env.GPORT ?? 58791), name, captain = 'corsair', know = false, prologue = 'skip' } = {}) {
  await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  name ??= 'Play ' + Math.random().toString(36).slice(2, 6);
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
  // A slow machine: the click may land late; wait for either screen before trying again.
  for (let i = 0; ; i++) {
    const on = await p.waitForSelector('#screen-captain:not(.hidden), #screen-login:not(.hidden) #login-name', { timeout: 90000 });
    if (await on.evaluate((e) => e.id === 'screen-captain')) break;
    await p.fill('#login-name', name);
    // (a press from the page itself: a busy software GPU kept Playwright's actionability wait past its timeout)
    await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
    try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 90000 }); break; } catch (e) { if (i >= 3) throw e; }
  }
  await p.evaluate((c) => document.querySelector(`.captain-card[data-id="${c}"]`)?.click(), captain);
  if (know) await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
  await p.evaluate(() => document.getElementById('pick-captain')?.click());
  if (prologue === 'skip') {
    for (let i = 0; i < 40; i++) {
      if (await p.$('#hud:not(.hidden)')) break;
      await p.mouse.click(10, 10).catch(() => {});
      await sleep(500);
    }
  }
  await p.waitForSelector('#hud:not(.hidden)', { timeout: 60000 });
  await sleep(2000);
  p.name = name;
  return name;
}

export const say = (p, text) => p.evaluate((x) => globalThis.gravetide.net.send({ t: 'chat', text: x }), text);
export const send = (p, msg) => p.evaluate((m) => globalThis.gravetide.net.send(m), msg);
export const open = (p, m) => p.evaluate((x) => globalThis.gravetide.open(x), m);
export async function closeAll(p, n = 3) {
  for (let i = 0; i < n; i++) {
    await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); });
    await sleep(250);
  }
}
export async function qa(p) {
  await p.evaluate(async () => {
    if (typeof globalThis.audit !== 'function') await (0, eval)(await (await fetch('/assets/raw/qa.js?' + Date.now())).text());
    for (let i = 0; i < 50 && typeof globalThis.audit !== 'function'; i++) await new Promise((r) => setTimeout(r, 100));
  });
}
export const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });

/** Where she is. */
export const me = (p) => p.evaluate(() => { const s = globalThis.gravetide.state; const o = s.ownDisplay; return { x: o?.x, y: o?.y, h: o?.heading, docked: s.self?.dockedAt ?? null, lvl: s.self?.level, xp: s.self?.xp, silver: s.self?.silver ?? s.self?.gold, region: s.region, board: !!s.boardTac, onb: s.onboarding?.stage ?? null }; });

/** The helmsman to (x,y). */
export const sailTo = (p, x, y) => p.evaluate(([a, b]) => globalThis.gravetide.chart.onAutosail({ x: a, y: b }), [Math.round(x), Math.round(y)]);

/** Sail toward (x,y) until within r, or until the time runs out. */
export async function sailUntil(p, x, y, r = 120, ms = 90000) {
  const t0 = Date.now();
  await sailTo(p, x, y);
  let last = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(1000);
    const m = await me(p);
    if (m.board) return 'board';
    if (m.docked) return 'docked';
    if (Math.hypot(m.x - x, m.y - y) < r) return 'there';
    const auto = await p.evaluate(() => !!globalThis.gravetide.state.autosail);
    if (!auto) {
      // the helmsman would not take her (hostile sails, combat): the wheel by hand, full sail
      await steer(p, Math.atan2(x - m.x, -(y - m.y)));
      await p.evaluate(() => { const s = globalThis.gravetide.state; if (s.input.sail < 3) s.input.sail = 3; });
      if (Date.now() - last > 10000) { last = Date.now(); await sailTo(p, x, y); }
    }
  }
  return 'timeout';
}

/** The text of every toast on screen. */
export const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('#toasts > .toast')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()));

/** Latin words on a Russian screen (players' and ships' names and keys apart). */
export const latin = (p, root = 'body') => p.evaluate((r) => {
  const out = new Set();
  const w = document.createTreeWalker(document.querySelector(r) ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement; if (!el) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
    let hidden = false; for (let q = el; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden') { hidden = true; break; } } if (hidden) continue;
    if (el.closest('script,style,#chat,.chat-log,.kbd,kbd,.no-tr,[data-name]')) continue;
    const m = n.textContent.match(/[A-Za-z][A-Za-z'’-]{2,}/g); if (m) for (const x of m) out.add(x + ' @' + (el.id || el.className || el.tagName).toString().slice(0, 30));
  }
  return [...out];
}, root);

/** Cyrillic on an English screen. */
export const cyr = (p, root = 'body') => p.evaluate((r) => {
  const out = new Set();
  const w = document.createTreeWalker(document.querySelector(r) ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement; if (!el || !el.getClientRects().length) continue;
    let hidden = false; for (let q = el; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden') { hidden = true; break; } } if (hidden) continue;
    if (el.closest('script,style,#chat,.chat-log,.no-tr,[data-name]')) continue;
    const m = n.textContent.match(/[А-Яа-яЁё]{2,}[А-Яа-яЁё ]*/g); if (m) for (const x of m) out.add(x.trim() + ' @' + (el.id || el.className || el.tagName).toString().slice(0, 30));
  }
  return [...out];
}, root);

/** The whole HUD check: overlaps, the popup budget, the window audit. */
export async function hudCheck(p) {
  await qa(p);
  return p.evaluate(() => ({ overlap: globalThis.hudOverlap(), pop: globalThis.__popAudit() }));
}

export function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

/** A window's every tab: a screenshot, the layout audit, the foreign words, what lies below the fold unscrollably. */
export async function tour(p, modal, tag, { shots = true, lang = 'ru' } = {}) {
  await qa(p);
  if (modal) { await p.evaluate((m) => { globalThis.gravetide.open(null); globalThis.gravetide.open(m); }, modal); await sleep(800); }
  const SEL = '#modal-panel .w-tab:not(.w-tab--go), #modal-panel .tab, #modal-panel .rose-node[data-view], #modal-panel button[data-view]';
  const names = await p.evaluate((s) => [...document.querySelectorAll(s)].map((t) => t.dataset.tab || t.dataset.ptab || t.dataset.jtab || t.dataset.ctab || t.dataset.view || t.title || t.textContent.trim()), SEL);
  const res = {};
  const n = Math.max(1, names.length);
  for (let i = 0; i < n; i++) {
    if (names.length) { await p.evaluate(([s, k]) => [...document.querySelectorAll(s)][k]?.click(), [SEL, i]); await sleep(600); }
    const nm = (names[i] ?? '-').toString().slice(0, 20);
    const r = await p.evaluate(async () => {
      const c = [], a = [];
      const body = [...document.querySelectorAll('#modal-panel .modal-body, #modal-panel #company-body')].find((b) => b.scrollHeight > b.clientHeight + 4) ?? null;
      const steps = body ? Math.min(12, Math.ceil(body.scrollHeight / (body.clientHeight * 0.8))) : 1;
      for (let k = 0; k < steps; k++) {
        if (body) { body.scrollTop = k * body.clientHeight * 0.8; await new Promise((r) => setTimeout(r, 120)); }
        for (const x of globalThis.center()) if (!/hud-|uf-|slot|tc-|ab-/.test(x) && !c.includes(x)) c.push(x);
        for (const x of globalThis.audit()) if (!a.includes(x)) a.push(x);
      }
      if (body) body.scrollTop = 0;
      // The panel itself past the screen.
      const pr = document.querySelector('#modal-panel')?.getBoundingClientRect();
      const off = pr && (pr.bottom > innerHeight + 1 || pr.top < -1 || pr.right > innerWidth + 1 || pr.left < -1) ? `PANEL ${[pr.left, pr.top, pr.right, pr.bottom].map(Math.round)}` : null;
      return { c, a, head: globalThis.headAlign(), off };
    });
    if (shots) await shot(p, `${tag}_${modal ?? 'cur'}_${i}`);
    const words = lang === 'ru' ? await latin(p, '#modal-panel') : await cyr(p, '#modal-panel');
    if (r.c.length || r.a.length || (r.head !== null && Math.abs(r.head) > 1.5) || r.off || words.length) res[nm] = { ...r, words };
  }
  return { tabs: names.length, res };
}

/** Ships around her, nearest first: id, distance, bearing off her bow (rad, + = starboard), name, role, crew. */
export const ships = (p, max = 4000) => p.evaluate((mx) => {
  const s = globalThis.gravetide.state, o = s.ownDisplay; if (!o) return [];
  const out = [];
  for (const sh of s.ships.values()) {
    if (sh.id === s.entityId || !sh.cur) continue;
    const d = Math.hypot(sh.cur.x - o.x, sh.cur.y - o.y); if (d > mx) continue;
    const ang = Math.atan2(sh.cur.x - o.x, -(sh.cur.y - o.y));
    const off = ((ang - o.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    out.push({ id: sh.id, d: Math.round(d), off: +off.toFixed(2), x: Math.round(sh.cur.x), y: Math.round(sh.cur.y), name: sh.info?.name, role: sh.info?.npcRole ?? sh.info?.role, faction: sh.info?.faction, crew: sh.cur.crew, hull: sh.cur.hull, hostile: !!(sh.cur.flags & 64), sinking: !!(sh.cur.flags & 1) });
  }
  return out.sort((a, b) => a.d - b.d);
}, max);

/** Tap a HUD button by selector without Playwright's actionability wait (it is a game: things move). */
export const tapEl = (p, sel) => p.evaluate((q) => {
  const e = document.querySelector(q); if (!e) return 'none';
  const r = e.getBoundingClientRect(); if (!r.width) return 'hidden';
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  if (top && top !== e && !e.contains(top)) return 'covered by ' + (top.id || top.className);
  return 'ok';
}, sel).then(async (st) => { if (st !== 'ok') return st; const b = await p.$(sel); await b.tap({ timeout: 3000 }).catch((e) => (st = 'tap ' + e.message.slice(0, 60))); return st; });

/** Steer her: the helmsman to a point that puts the ship off her chosen beam (side: 'port'|'starboard'). */
export async function beamOn(p, target, side = 'starboard', r = 250) {
  const o = await me(p);
  const ang = Math.atan2(target.x - o.x, -(target.y - o.y));
  // course 90° off the bearing so she lies on the beam
  const course = ang + (side === 'starboard' ? -Math.PI / 2 : Math.PI / 2);
  return sailTo(p, o.x + Math.sin(course) * 600, o.y - Math.cos(course) * 600);
}

/** The helm stick to a course (rad, 0 = north, clockwise), as a finger would: press, pull that way, let go. */
export async function steer(p, course) {
  const r = await p.evaluate(() => { const e = document.querySelector('#tc-stick'); const b = e?.getBoundingClientRect(); return b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width } : null; });
  if (!r) return 'no stick';
  const k = r.w * 0.3;
  await p.mouse.move(r.x, r.y); await p.mouse.down();
  await p.mouse.move(r.x + Math.sin(course) * k, r.y - Math.cos(course) * k, { steps: 3 });
  await p.mouse.up();
  return 'ok';
}
