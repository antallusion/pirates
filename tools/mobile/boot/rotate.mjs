// The start on a phone that is turned (owner, 2026-10-16: «при развороте телефона в горизонталку вначале игры ничего
// не происходит»). One browser; for the website and for Telegram's view (html.tg-app, its safe areas and viewport
// events): ten starts each, every one opened upright and turned a few times at random moments of the start (before the
// code is in, at the title, while the captain comes in), ending sideways — then the HUD must be up, the renderer at
// the screen's size and the ship answering the helm.
//   node tools/mobile/boot/rotate.mjs [url] [--n=10] [--mode=web,tg]
// Every other start plays an iPhone that tells its turn late or not at all: the browser's own `resize` and
// `orientationchange` are swallowed, only the page's own watch (client/src/viewport.ts) can see the new size.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const args = process.argv.slice(2);
const URL0 = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:58990/';
const N = Number(args.find((a) => a.startsWith('--n='))?.slice(4) ?? 10);
const MODES = (args.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'web,tg').split(',');
const OUT = process.env.OUT ?? 'assets/raw/audit/boot';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHONES = [[375, 812], [390, 844], [360, 740], [414, 896]];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

/** Telegram's WebApp as an iPhone's Telegram gives it (Bot API 8.0): events kept so the test can fire them. */
function tgStub() {
  const subs = {};
  const land = () => innerWidth > innerHeight;
  const w = {
    initData: 'query_id=QA&user=%7B%22id%22%3A1%7D&hash=qa', version: '8.0', platform: 'ios', themeParams: { bg_color: '#17212b', text_color: '#f5f5f5', button_color: '#5288c1' },
    isFullscreen: false,
    isVersionAtLeast: (v) => parseFloat(v) <= 8.0,
    ready() {}, expand() {}, disableVerticalSwipes() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {}, lockOrientation() { w.locked = true; },
    requestFullscreen() { setTimeout(() => { w.isFullscreen = true; (subs.fullscreenChanged ?? []).forEach((f) => f.call(w)); }, 80); },
    get safeAreaInset() { return land() ? { top: 0, bottom: 21, left: 47, right: 47 } : { top: 47, bottom: 34, left: 0, right: 0 }; },
    get contentSafeAreaInset() { return land() ? { top: 36, bottom: 0, left: 0, right: 0 } : { top: 46, bottom: 0, left: 0, right: 0 }; },
    onEvent(ev, cb) { (subs[ev] ??= []).push(cb); },
    BackButton: { show() {}, hide() {}, onClick() {} },
  };
  globalThis.Telegram = { WebApp: w };
  globalThis.__tgFire = (ev) => (subs[ev] ?? []).forEach((f) => f.call(w, {}));
}

/** An iPhone that tells its turn late: the browser's own resize and orientationchange swallowed while on. */
function eater() {
  globalThis.__eat = false;
  for (const ev of ['resize', 'orientationchange']) addEventListener(ev, (e) => { if (globalThis.__eat && e.isTrusted) e.stopImmediatePropagation(); }, true);
}

async function turn(p, cdp, [W, H], land, eat) {
  const [w, h] = land ? [H, W] : [W, H];
  await p.evaluate((e) => (globalThis.__eat = e), eat).catch(() => {});
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true, screenOrientation: land ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
  await p.evaluate(() => globalThis.__tgFire?.('viewportChanged')).catch(() => {});
  await sleep(150);
  await p.evaluate(() => { globalThis.__tgFire?.('safeAreaChanged'); globalThis.__tgFire?.('contentSafeAreaChanged'); }).catch(() => {});
}

async function check(p) {
  return p.evaluate(() => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    const g = globalThis.gravetide;
    const r = g?.renderer;
    const stick = document.getElementById('tc-stick')?.getBoundingClientRect();
    const sea = document.getElementById('world-sea');
    const world = document.getElementById('world');
    const dpr = r?.dpr ?? 1;
    return {
      w: innerWidth, h: innerHeight,
      hud: vis(document.getElementById('hud')) && !document.getElementById('hud').classList.contains('hidden'),
      lock: vis(document.getElementById('rotate-lock')),
      shell: vis(document.getElementById('boot')),
      tgboot: !!document.getElementById('tg-boot'),
      loader: vis(document.getElementById('gt-load')),
      login: !document.getElementById('screen-login').classList.contains('hidden'),
      captain: !document.getElementById('screen-captain').classList.contains('hidden'),
      rsize: r ? `${r.w}x${r.h}` : null,
      sizeOk: !!r && r.w === innerWidth && r.h === innerHeight && world.width === Math.round(innerWidth * dpr) && (!sea || Math.abs(sea.width - Math.round(innerWidth * Math.min(dpr, 1.5))) <= 1),
      stickOk: !!stick && stick.width > 0 && stick.left >= -1 && stick.right <= innerWidth + 1 && stick.bottom <= innerHeight + 1 && stick.top >= 0,
      tgApp: document.documentElement.classList.contains('tg-app'),
      docked: !!g?.state?.self?.dockedAt, modal: g?.modal?.() ?? null,
      boot: (globalThis.__boot?.log ?? []).slice(-6),
    };
  });
}

/** The ship answers: frames run, and at sea she moves under sail (in port the harbour's window is up and works). */
async function playable(p) {
  // in a harbour: «В море» first, as she would
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) {
    await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.net.send({ t: 'undock' }); });
    for (let k = 0; k < 20 && (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)); k++) await sleep(300);
    await sleep(1200);
  }
  const t0 = await p.evaluate(() => globalThis.gravetide.renderer.time);
  const s0 = await p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; return o ? { x: o.x, y: o.y } : null; });
  await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.state.input.sail = 3; });
  await sleep(3500);
  const t1 = await p.evaluate(() => globalThis.gravetide.renderer.time);
  const s1 = await p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; return o ? { x: o.x, y: o.y, docked: !!globalThis.gravetide.state.self?.dockedAt } : null; });
  const moved = s0 && s1 ? Math.hypot(s1.x - s0.x, s1.y - s0.y) : 0;
  const stickOk = await p.evaluate(() => { const r = document.getElementById('tc-stick')?.getBoundingClientRect(); return !!r && r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; });
  return { frames: t1 > t0 + 1, moved: Math.round(moved), docked: s1?.docked ?? null, stickOk, ok: t1 > t0 + 1 && moved > 2 && stickOk };
}

/** Films and the prologue skipped as a captain would tap them away; «Отчалить» from a harbour. */
async function clearOverlays(p) {
  await p.evaluate(() => {
    document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    const pr = document.getElementById('prologue');
    if (pr && !pr.classList.contains('hidden')) pr.click();
  }).catch(() => {});
}

const results = [];
for (const mode of MODES) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: 'ru-RU',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(eater);
  await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); localStorage.setItem('gravetide.helpSeen', '1'); } catch {} });
  let token = null;
  if (mode === 'tg') {
    await ctx.addInitScript(tgStub);
    // Telegram's sign-in answered with the captain this test made (the QA server has no bot)
    await ctx.route('**/auth/tg/webapp', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(token ? { token } : { error: 'no' }) }));
  }
  for (let i = 0; i < N; i++) {
    const eat = i % 2 === 1;
    const phone = PHONES[i % PHONES.length];
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: phone[0], height: phone[1], deviceScaleFactor: 3, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
    // the start begins upright, and turns: before the code is in, at the title, while she comes in
    const url = URL0 + (mode === 'tg' ? (URL0.includes('?') ? '&' : '?') + 'tg' : '');
    const t0 = Date.now();
    await p.goto(url, { waitUntil: 'commit' });
    const turns = 2 + Math.floor(rnd() * 4);
    if (process.env.V) console.log("  start", mode, i, phone, eat, turns);
    let land = false;
    for (let k = 0; k < turns; k++) {
      await sleep(150 + Math.floor(rnd() * 1400));
      land = !land;
      await turn(p, cdp, phone, land, eat);
    }
    if (!land) { await sleep(300); land = true; await turn(p, cdp, phone, true, eat); }
    // the first start of a mode: a new captain from the title, sideways (as a phone does)
    await p.waitForFunction(() => globalThis.__gtReady, null, { timeout: 90000 });
    if (!token) {
      await p.waitForSelector('#screen-login:not(.hidden) #login-name', { timeout: 30000 });
      await p.fill('#login-name', `Turn ${mode} ${Math.random().toString(36).slice(2, 5)}`);
      await p.evaluate(() => document.querySelector('#login-form button[type=submit]').click());
      await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 30000 });
      // a turn more on the captain's screen
      await turn(p, cdp, phone, false, eat); await sleep(500); await turn(p, cdp, phone, true, eat);
      await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
      await p.evaluate(() => document.getElementById('pick-captain')?.click());
      token = await p.evaluate(() => localStorage.getItem('gravetide.token'));
    }
    if (process.env.V) console.log("  login done");
    // and while the sea comes in
    for (let k = 0; k < 40; k++) {
      await clearOverlays(p);
      if (await p.$('#hud:not(.hidden)')) break;
      await sleep(500);
    }
    if (rnd() < 0.7) { await turn(p, cdp, phone, false, eat); await sleep(400 + rnd() * 800); await turn(p, cdp, phone, true, eat); }
    // a moment for the late iPhone's watch (it looks once a second) and the loading screen
    for (let k = 0; k < 30; k++) { await clearOverlays(p); const c = await check(p); if (c.hud && !c.loader && c.sizeOk) break; await sleep(500); }
    const c = await check(p);
    const play = c.hud ? await playable(p).catch((e) => ({ ok: false, err: e.message.slice(0, 80) })) : { ok: false };
    const ok = c.hud && !c.lock && !c.shell && !c.tgboot && c.sizeOk && play.ok && (mode !== 'tg' || c.tgApp) && !errs.length;
    const row = { mode, i, phone: phone.join('x'), eat, turns, ms: Date.now() - t0, ok, ...c, play, errs };
    results.push(row);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${mode} #${i} ${phone.join('x')}${eat ? ' late-iOS' : ''} turns=${turns} ${row.ms}ms hud=${c.hud} size=${c.rsize}/${c.w}x${c.h} ok=${c.sizeOk} stick=${c.stickOk} lock=${c.lock} shell=${c.shell} tgboot=${c.tgboot} play=${JSON.stringify(play)}${errs.length ? ' ERR ' + errs.join(' / ') : ''}`);
    if (!ok) console.log('   boot:', c.boot.join(' | '), 'login', c.login, 'captain', c.captain, 'loader', c.loader);
    // (the CDP's own capture: Playwright's would put back the context's upright viewport)
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    (await import('node:fs')).writeFileSync(`${OUT}/rot-${mode}-${i}.png`, Buffer.from(shot.data, 'base64'));
    await p.close();
  }
  await ctx.close();
}
await b.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} starts ended with the HUD up, the renderer at the screen's size and the ship under way`);
process.exit(pass === results.length ? 0 : 1);
