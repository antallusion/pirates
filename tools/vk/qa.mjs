// Browser QA of the VK Mini App (docs/36_VK.md; VK moderation's five points, owner 2026-10-20). Starts nothing itself:
// it takes the base URL of a server already running with the VK test secret and test payments, e.g.
//   PORT=58640 GRAVETIDE_ADMIN=1 DB_PATH=data/vk-qa.db VK_APP_ID=1 VK_APP_SECRET=qa-secret VK_PAY_TEST=1 \
//     node --disable-warning=ExperimentalWarning server/src/main.ts
//   node tools/vk/qa.mjs http://localhost:58640
// The page is opened at /play?vk&<launch parameters signed with the test secret> with a fake VK around it: the four
// bridge channels (Android, iOS, React Native, the web's parent.postMessage) recorded and answered, requestFullscreen
// and window.open stubbed and counted. It checks VKWebAppInit went out by all four before the game's code, signs in,
// fills the captain with the admin's commands, then visits every window (each tab; the shop's every tab and shelf, the
// top-up, the ask dialogs, VK's payment), the HUD and the boarding battle at every size of the brief, measuring each
// screen (tools/vk/measure.js) and taking its picture. Out: <OUT>/results.json, <OUT>/summary.md (screen × size →
// issues), screenshots and one contact sheet per size (<OUT>/sheet_<size>.jpg).
// Env: SECRET (qa-secret), APP (1), OUT (assets/raw/vk_shots), SIZES (comma list of WxH, default all), ONLY (comma
// list of screens), TABS=0 (default views only), LANG (ru), EXE (Chromium), PLAYWRIGHT (its package.json).
import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BASE = (process.argv[2] ?? process.env.BASE ?? 'http://localhost:58640').replace(/\/$/, '');
const SECRET = process.env.SECRET ?? 'qa-secret';
const APP = Number(process.env.APP ?? 1);
const OUT = resolve(process.env.OUT ?? 'assets/raw/vk_shots');
const LANG = process.env.LANG2 ?? process.env.QA_LANG ?? 'ru';
const TABS = process.env.TABS !== '0';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const require = createRequire(process.env.PLAYWRIGHT ?? 'C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = process.env.EXE ?? 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const MEASURE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'measure.js'), 'utf8');
mkdirSync(OUT, { recursive: true });

// The brief's sizes: a phone on its side inside m.vk.com, upright (the «turn the phone» veil), the window inside
// vk.com on a desk, a desk.
const SIDE = [[580, 280], [600, 304], [680, 276], [700, 290], [760, 300], [568, 320], [812, 375]];
const UPRIGHT = [[320, 568], [360, 640], [375, 812]];
const DESK = [[826, 634], [911, 700], [1366, 768]];
const want = process.env.SIZES ? new Set(process.env.SIZES.split(',')) : null;
const pick = (l) => l.filter(([w, h]) => !want || want.has(`${w}x${h}`));

const WINDOWS = ['port', 'way', 'talents', 'map', 'journal', 'ship', 'gear', 'help', 'boarding', 'sunk', 'crew', 'mutiny', 'company', 'barter', 'edge', 'options', 'menu', 'tattoos', 'choice', 'dice', 'look', 'hall', 'descent', 'saga', 'log', 'base', 'away', 'recruit', 'hero', 'puzzle', 'tame', 'throne', 'shop', 'research'];
const CHECKS = ['offscreen', 'cut', 'outside', 'text', 'overlap', 'scroll', 'ellipsis', 'links'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ------------------------------------------------------------------------------------------------ the launch

function signLaunch(p) {
  const line = Object.keys(p).filter((k) => k.startsWith('vk_')).sort().map((k) => `${k}=${encodeURIComponent(p[k])}`).join('&');
  return createHmac('sha256', SECRET).update(line).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function launchQuery(user, platform) {
  const p = { vk_access_token_settings: '', vk_app_id: String(APP), vk_are_notifications_enabled: '0', vk_is_app_user: '1', vk_is_favorite: '0', vk_language: LANG, vk_platform: platform, vk_ref: 'other', vk_ts: String(Math.floor(Date.now() / 1000)), vk_user_id: String(user) };
  return new URLSearchParams({ ...p, sign: signLaunch(p) }).toString();
}

/** The fake VK around the page (runs before the page's first script). */
function fakeVk() {
  const v = (window.__vk = { calls: [], fs: 0, exits: 0, opens: [], fsOn: false });
  const answer = (type, data) => setTimeout(() => window.dispatchEvent(new CustomEvent('VKWebAppEvent', { detail: { type, data } })), 40);
  const rec = (ch) => (method) => (arg) => {
    let params = arg;
    try { params = typeof arg === 'string' ? JSON.parse(arg) : arg; } catch { /* as is */ }
    v.calls.push({ ch, method, params, t: Math.round(performance.now()), main: !!window.__gtReady, fs: !!document.fullscreenElement });
    if (ch !== 'android') return;
    const rid = params && params.request_id;
    if (method === 'VKWebAppGetUserInfo') answer('VKWebAppGetUserInfoResult', { id: 1, first_name: 'Анна', last_name: 'Тест', request_id: rid });
    // (the order box's answer with none of its fields: the game must not mind)
    if (method === 'VKWebAppShowOrderBox') answer('VKWebAppShowOrderBoxResult', { request_id: rid });
    if (method === 'VKWebAppShare') answer('VKWebAppShareResult', { request_id: rid });
  };
  const M = ['VKWebAppInit', 'VKWebAppGetUserInfo', 'VKWebAppShowOrderBox', 'VKWebAppShare', 'VKWebAppGetLaunchParams'];
  window.AndroidBridge = Object.fromEntries(M.map((m) => [m, rec('android')(m)]));
  window.webkit = { messageHandlers: Object.fromEntries(M.map((m) => [m, { postMessage: rec('ios')(m) }])) };
  window.ReactNativeWebView = { postMessage: (s) => { const j = JSON.parse(s); rec('rn')(j.handler)(j.params); } };
  const pm = window.postMessage.bind(window);
  window.postMessage = function (msg, ...rest) { if (msg && msg.type === 'vk-connect' && msg.handler) rec('web')(msg.handler)(msg.params); return pm(msg, ...rest); };
  Element.prototype.requestFullscreen = function () { v.fs++; return Promise.resolve(); };
  Element.prototype.webkitRequestFullscreen = function () { v.fs++; };
  // a fullscreen another script left on, for the payment's check (the QA turns it on before a Buy)
  Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get() { return v.fsOn ? document.documentElement : null; } });
  Document.prototype.exitFullscreen = function () { v.exits++; v.fsOn = false; return Promise.resolve(); };
  window.open = (u) => { v.opens.push(String(u)); return null; };
  // the sleep's check: every sound context kept, every animation frame that runs counted
  v.acs = [];
  v.frames = 0;
  const AC = window.AudioContext;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); v.acs.push(this); } };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { v.frames++; cb(t); });
}

// ------------------------------------------------------------------------------------------------ the page

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const findings = { init: null, payment: null, share: null, sleep: null, errors: [] };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

async function newPage(size, touch) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, locale: LANG === 'en' ? 'en-US' : 'ru-RU' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('gravetide.lang', l); } catch { /* none */ } }, LANG);
  // films skipped as they come (the screens under them are measured)
  await ctx.addInitScript(() => { setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
  await ctx.addInitScript(fakeVk);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|net::|Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text().slice(0, 200)); });
  p.ctx = ctx;
  return p;
}

const say = (p, text) => p.evaluate((x) => globalThis.gravetide.net.send({ t: 'chat', text: x }), text);
// (every window, an ask, the offers' card that comes by itself; the island's scene left)
const closeAll = async (p) => { for (let i = 0; i < 3; i++) { await p.evaluate(() => { globalThis.gravetide?.open(null); document.querySelector('#confirm .k-btn--secondary, #confirm [data-no]')?.click(); document.querySelector('#promo-over [data-poshut]')?.click(); if (globalThis.gravetide?.isle?.isOpen) globalThis.gravetide.isle.exit(); }); await sleep(150); } };
let homePort = null;
/** Docked at her first port (the harbour's window needs it). */
async function dock(p) {
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) return true;
  if (!homePort) return false;
  await say(p, `/tp ${homePort}`);
  await sleep(2500);
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'dock' }));
    await sleep(1500);
    if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) break;
  }
  await sleep(1500);
  await closeAll(p);
  return p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt);
}

async function signIn(p, user, platform) {
  await p.goto(`${BASE}/play?vk&${launchQuery(user, platform)}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const t0 = Date.now();
  // the captain's choice (a new VK user) or the HUD (one who has played)
  const on = await p.waitForSelector('#screen-captain:not(.hidden), #hud:not(.hidden), #board-tac:not(.hidden)', { timeout: 120000 });
  log(`signed in by VK in ${Date.now() - t0} ms`);
  if (await on.evaluate((e) => e.id === 'screen-captain')) {
    await sleep(600);
    await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
    await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
    await p.evaluate(() => document.getElementById('pick-captain')?.click());
    for (let i = 0; i < 60 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await sleep(500); }
  }
  await p.waitForSelector('#hud:not(.hidden), #board-tac:not(.hidden)', { timeout: 60000 });
  await sleep(1500);
  await p.evaluate(MEASURE);
  await p.evaluate(() => document.body.classList.add('reduce-motion'));
}

async function fill(p) {
  homePort ??= await p.evaluate(() => globalThis.gravetide.state.self?.dockedAt ?? null);
  const orders = ['/level 30', '/silver 500000', '/glory 3', '/doubloons 600', '/doubloons sample on', '/army marine 30', '/army mermaid 14', '/army lantern_maw 6', '/creature', '/isle 3', '/relic all', '/art list', '/feats', '/album', '/cos all', '/scrolls 3', '/heal'];
  for (const o of orders) { await say(p, o); await sleep(500); }
  await sleep(1500);
  await closeAll(p);
}

/** One screen measured and pictured. */
async function measure(p, screen, sizeTag, o = {}) {
  await sleep(o.wait ?? 450);
  const m = await p.evaluate((x) => globalThis.__vkMeasure(x), { root: o.root ?? null, shop: !!o.shop });
  const v = await p.evaluate(() => ({ fs: globalThis.__vk.fs, opens: globalThis.__vk.opens.length }));
  const file = `${sizeTag}__${screen.replace(/[^\w.-]+/g, '_')}.jpg`;
  await p.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 55 }).catch(() => {});
  const row = { size: sizeTag, screen, file, fs: v.fs, opens: v.opens, ...m };
  results.push(row);
  const bad = CHECKS.filter((k) => m[k].length).map((k) => `${k} ${m[k].length}`).join(', ');
  if (bad) log(`${sizeTag} ${screen}: ${bad}`);
  return row;
}

const modalOpen = (p) => p.evaluate(() => !document.getElementById('modal')?.classList.contains('hidden') && (document.getElementById('modal-panel')?.textContent ?? '').trim().length > 0);

/** A window's own tabs (the rail's big tabs and the older .tab ones), their attribute names and values. */
const tabsOf = (p) => p.evaluate(() => [...document.querySelectorAll('#modal-panel .w-tab:not(.w-tab--go):not([disabled]), #modal-panel .tab:not([disabled])')].slice(0, 9).map((t, i) => ({ i, label: (t.getAttribute('aria-label') || t.textContent || '').trim().slice(0, 18) })));

async function sweepWindows(p, sizeTag) {
  // the offers' card and the daily gift over the sea (they come by themselves): measured, then put away
  await p.evaluate(() => globalThis.gravetide.open(null));
  await say(p, '/offers carousel');
  await sleep(1500);
  if (await p.$('#promo-over')) {
    await measure(p, 'promo', sizeTag, { root: '#promo-over', shop: true });
    await p.evaluate(() => document.querySelector('#promo-over [data-poshut]')?.click());
    await sleep(400);
  }
  if (await p.$('#gift-over')) await measure(p, 'daily-gift', sizeTag, { root: '#gift-over' });
  for (const w of WINDOWS) {
    if (ONLY && !ONLY.has(w)) continue;
    if (w === 'shop') { await sweepShop(p, sizeTag); continue; }
    if (w === 'port' && !(await dock(p))) { results.push({ size: sizeTag, screen: w, skipped: 'not docked' }); continue; }
    if (w === 'base') {
      // her island's base is a scene of its own (islescene.ts), not a window
      await closeAll(p);
      await p.evaluate(() => globalThis.gravetide.open('base'));
      await sleep(2500);
      if (await p.evaluate(() => !!globalThis.gravetide.isle?.isOpen)) await measure(p, 'base (island scene)', sizeTag, { root: '#isle' });
      else results.push({ size: sizeTag, screen: w, skipped: 'no island of her own' });
      await closeAll(p);
      continue;
    }
    await closeAll(p);
    // (the panel emptied first: a window with nothing to show leaves it so — never the last window's leftovers)
    await p.evaluate((x) => { document.getElementById('modal-panel').innerHTML = ''; globalThis.gravetide.open(x); }, w);
    await sleep(700);
    if (!(await modalOpen(p))) { results.push({ size: sizeTag, screen: w, skipped: 'no state for it (the window closes itself without its moment)' }); continue; }
    await measure(p, w, sizeTag, { root: '#modal-panel' });
    if (!TABS) continue;
    const tabs = await tabsOf(p);
    for (const t of tabs.slice(1)) {
      await p.evaluate((i) => [...document.querySelectorAll('#modal-panel .w-tab:not(.w-tab--go):not([disabled]), #modal-panel .tab:not([disabled])')][i]?.click(), t.i);
      await sleep(500);
      if (!(await modalOpen(p))) break;
      await measure(p, `${w}:${t.i}-${t.label}`, sizeTag, { root: '#modal-panel' });
    }
  }
  // the options' «Подробнее» pages and the menu
  if (!ONLY || ONLY.has('options')) {
    await closeAll(p);
    await p.evaluate(() => globalThis.gravetide.open('options'));
    await sleep(500);
    await p.evaluate(() => document.querySelector('[data-omore]')?.click());
    await sleep(400);
    const chips = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-otab]')].map((b) => b.dataset.otab).filter((x) => x !== 'main'));
    for (const c of chips) {
      await p.evaluate((x) => document.querySelector(`#modal-panel [data-otab="${x}"]`)?.click(), c);
      await sleep(400);
      await measure(p, `options:more-${c}`, sizeTag, { root: '#modal-panel' });
    }
  }
  await closeAll(p);
  await measure(p, 'hud', sizeTag, {});
}

async function sweepShop(p, sizeTag) {
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.shop(false));
  await sleep(900);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-shtab]')].map((b) => b.dataset.shtab));
  for (const t of tabs) {
    await p.evaluate((x) => document.querySelector(`#modal-panel [data-shtab="${x}"]`)?.click(), t);
    await sleep(600);
    const secs = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-shsec]')].map((b) => b.dataset.shsec));
    for (const s of secs) {
      await p.evaluate((x) => document.querySelector(`#modal-panel [data-shsec="${x}"]`)?.click(), s);
      await sleep(450);
      // every screenful of the shelf: its body scrolled down in steps
      const steps = await p.evaluate(() => { const b = document.querySelector('#modal-panel .sh-body'); return b ? Math.min(6, Math.ceil(b.scrollHeight / Math.max(1, b.clientHeight * 0.9))) : 1; });
      for (let k = 0; k < steps; k++) {
        await p.evaluate((i) => { const b = document.querySelector('#modal-panel .sh-body'); if (b) b.scrollTop = i * b.clientHeight * 0.9; }, k);
        await measure(p, `shop:${t}-${s}${steps > 1 ? `#${k + 1}` : ''}`, sizeTag, { root: '#modal-panel', shop: true, wait: 250 });
      }
    }
    if (t === 'cos' && TABS) {
      // the wardrobe (the try-on)
      const ok = await p.evaluate(() => { const b = document.querySelector('#modal-panel [data-coswr], #modal-panel [data-cosward], #modal-panel .cos-wr-open'); b?.click(); return !!b; });
      if (ok) { await sleep(600); await measure(p, 'shop:wardrobe', sizeTag, { root: '#modal-panel', shop: true }); }
    }
  }
  // the top-up: the packs in votes
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.shop(true));
  await sleep(900);
  await measure(p, 'shop:topup', sizeTag, { root: '#modal-panel', shop: true });
  // the ask before a purchase (enough doubloons) and the top-up's ask (short of them)
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.shop(false));
  await sleep(700);
  const asked = await p.evaluate(() => { const b = [...document.querySelectorAll('#modal-panel [data-shbuy]:not([disabled])')].find((x) => !x.classList.contains('short')) ?? null; b?.click(); return !!b; });
  if (asked) {
    await p.waitForSelector('#confirm', { timeout: 4000 }).catch(() => {});
    await measure(p, 'shop:ask-buy', sizeTag, { root: '#confirm', shop: true });
    await p.evaluate(() => document.querySelector('#confirm .k-btn--secondary, #confirm button:last-of-type')?.click());
    await sleep(300);
  }
  const short = await p.evaluate(() => { const b = document.querySelector('#modal-panel [data-shbuy].short, #modal-panel [data-pmship].short, #modal-panel [data-pmunit].short'); b?.click(); return !!b; });
  if (short) {
    await p.waitForSelector('#confirm', { timeout: 4000 }).catch(() => {});
    await measure(p, 'shop:ask-topup', sizeTag, { root: '#confirm', shop: true });
    await p.evaluate(() => document.querySelector('#confirm .k-btn--secondary, #confirm button:last-of-type')?.click());
    await sleep(300);
  }
}

/** VK's payment from the shop's top-up: a fullscreen left on is left first, the order box asked by the bridge, its
 *  answer with no fields taken quietly, the test order's callback credited once. */
async function payment(p) {
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.shop(true));
  await p.waitForSelector('[data-pmvk]', { timeout: 10000 });
  await sleep(400);
  const prices = await p.$$eval('[data-pmvk]', (bs) => bs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  const wantPrices = LANG === 'ru' ? '41 голос | 84 голоса | 141 голос | 284 голоса | 713 голосов | 1 414 голосов' : '41 votes | 84 votes | 141 votes | 284 votes | 713 votes | 1,414 votes';
  check(prices.join(' | ') === wantPrices, `the packs in votes: ${prices.join(' | ')}`);
  const before = await p.evaluate(() => globalThis.gravetide.state.doubloons);
  await p.evaluate(() => { globalThis.__vk.fsOn = true; });
  const errs0 = p.errs.length;
  await p.click('[data-pmvk="d290"]');
  await sleep(800);
  const calls = await p.evaluate(() => globalThis.__vk.calls.filter((c) => c.method === 'VKWebAppShowOrderBox'));
  const v = await p.evaluate(() => ({ exits: globalThis.__vk.exits, fs: globalThis.__vk.fs }));
  check(calls.length === 1 && calls[0].ch === 'android' && calls[0].params.type === 'item' && calls[0].params.item === 'd290', `VKWebAppShowOrderBox {type:'item', item:'d290'} sent: ${JSON.stringify(calls.map((c) => c.params))}`);
  check(v.exits === 1 && calls[0] && calls[0].fs === false, `the fullscreen left before the order box (exitFullscreen ${v.exits}, fullscreen at the call: ${calls[0]?.fs})`);
  check(p.errs.length === errs0, `an order box answer without fields: no error (${p.errs.slice(errs0).join('; ')})`);
  // VK's callback for the test order, signed as VK signs it
  const uid = await p.evaluate(() => Number(new URLSearchParams(sessionStorage.getItem('gt.vkLaunch') ?? '').get('vk_user_id')));
  const order = String(Date.now());
  const form = { app_id: String(APP), date: String(Math.floor(Date.now() / 1000)), item: 'd290', item_id: 'd290', item_price: '41', lang: 'ru_RU', notification_type: 'order_status_change_test', order_id: order, receiver_id: String(uid), status: 'chargeable', user_id: String(uid), version: '3' };
  form.sig = createHash('md5').update(Object.keys(form).sort().map((k) => `${k}=${form[k]}`).join('') + SECRET).digest('hex');
  const post = () => fetch(`${BASE}/vk/pay`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() }).then((r) => r.json());
  const a1 = await post();
  const a2 = await post();
  check(a1.response?.order_id === Number(order) && JSON.stringify(a1) === JSON.stringify(a2), `the callback answered ${JSON.stringify(a1)}, the same twice`);
  let after = before;
  for (let i = 0; i < 30 && after !== before + 290; i++) { await sleep(300); after = await p.evaluate(() => globalThis.gravetide.state.doubloons); }
  check(after === before + 290, `the doubloons came by themselves: ${before} → ${after}`);
  const gi = { item: 'd590', lang: 'ru_RU', notification_type: 'get_item_test', order_id: '1', user_id: String(uid), app_id: String(APP) };
  gi.sig = createHash('md5').update(Object.keys(gi).sort().map((k) => `${k}=${gi[k]}`).join('') + SECRET).digest('hex');
  const g = await fetch(`${BASE}/vk/pay`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(gi).toString() }).then((r) => r.json());
  check(g.response?.price === 84 && /дублон/.test(g.response?.title ?? ''), `get_item: ${JSON.stringify(g)}`);
  const img = await fetch(g.response?.photo_url?.replace(/^https?:\/\/[^/]+/, BASE) ?? `${BASE}/x`);
  check(img.ok && /image\/png/.test(img.headers.get('content-type') ?? ''), `the item's picture ${g.response?.photo_url} (${img.status} ${img.headers.get('content-type')})`);
  findings.payment = { prices, calls: calls.map((c) => c.params), exits: v.exits, before, after, callback: a1 };
  await closeAll(p);
}

/** Minimised (VK moderation: «если свернуть игру, звук продолжает играть»): VKWebAppViewHide — the sound's context
 *  suspended, no <audio>/<video> playing, no animation frame for 2 s; VKWebAppViewRestore — all of it back. */
async function sleepCheck(p) {
  await closeAll(p);
  await p.keyboard.press('Shift'); // (the sound's context is made on the first key or tap)
  await sleep(600);
  const fire = (type) => p.evaluate((t) => dispatchEvent(new CustomEvent('VKWebAppEvent', { detail: { type: t, data: {} } })), type);
  const state = () => p.evaluate(() => ({ frames: globalThis.__vk.frames, ctx: globalThis.__vk.acs.map((c) => c.state), media: [...document.querySelectorAll('audio, video')].filter((m) => !m.paused).length, cls: document.documentElement.classList.contains('app-paused') }));
  const before = await state();
  await fire('VKWebAppViewHide');
  await sleep(400);
  const h0 = await state();
  await sleep(2000);
  const h1 = await state();
  await fire('VKWebAppViewRestore');
  await sleep(1000);
  const r = await state();
  check(before.ctx.length > 0 && before.ctx.every((s) => s === 'running'), `the sound running before: ${JSON.stringify(before.ctx)}`);
  check(h1.ctx.every((s) => s === 'suspended'), `ViewHide: the sound's context suspended ${JSON.stringify(h1.ctx)}`);
  check(h1.media === 0, `ViewHide: no audio/video playing (${h1.media})`);
  check(h1.frames - h0.frames === 0, `ViewHide: no animation frame in 2 s (${h1.frames - h0.frames}; ${h0.frames - before.frames} in the hide's first 0.4 s)`);
  check(h1.cls, 'ViewHide: html.app-paused (CSS animations paused)');
  check(r.ctx.every((s) => s === 'running') && r.frames - h1.frames > 10 && !r.cls, `ViewRestore: the sound ${JSON.stringify(r.ctx)} and ${r.frames - h1.frames} frames in 1 s`);
  findings.sleep = { before, hidden: h1, framesWhileHidden: h1.frames - h0.frames, restored: r, framesAfterRestore: r.frames - h1.frames };
}

async function share(p) {
  await closeAll(p);
  await p.evaluate(() => globalThis.gravetide.open('options'));
  await p.waitForSelector('[data-ovk]', { timeout: 5000 }).catch(() => {});
  const has = !!(await p.$('[data-ovk]'));
  check(has, '«Позвать друзей» in the settings');
  if (has) {
    await p.click('[data-ovk]');
    await sleep(800);
    const c = await p.evaluate(() => globalThis.__vk.calls.filter((x) => x.method === 'VKWebAppShare').map((x) => x.params));
    check(c.length === 1 && c[0].link === `https://vk.com/app${APP}`, `VKWebAppShare with the mini app's own link: ${JSON.stringify(c)}`);
    findings.share = c;
  }
  await closeAll(p);
}

async function battle(p, sizes, touch) {
  // (out of the harbour first: the test battle's orders, /?battle's own — main.ts runTestBattle)
  await closeAll(p);
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) {
    await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
    await sleep(4000);
    await closeAll(p);
  }
  const orders = ['/level 30', '/tp gravewater', '/ship frigate', '/heal', '/army clear', '/army marine 30', '/army mermaid 14', '/army lantern_maw 6', '/army ancient_turtle 3', '/foe patrol frigate', '/board'];
  for (const o of orders) { await say(p, o); await sleep(900); }
  let ok = await p.waitForSelector('#board-tac:not(.hidden)', { timeout: 30000 }).then(() => true, () => false);
  if (!ok) {
    await say(p, '/board');
    ok = await p.waitForSelector('#board-tac:not(.hidden)', { timeout: 30000 }).then(() => true, () => false);
  }
  if (!ok) { results.push({ size: 'all', screen: 'battle', skipped: 'the boarding did not start' }); return; }
  await sleep(3000);
  for (const [w, h] of sizes) {
    const tag = `${w}x${h}`;
    await p.setViewportSize({ width: w, height: h });
    await sleep(900);
    await measure(p, 'battle', tag, { root: '#board-tac' });
    const book = await p.evaluate(() => { const b = document.querySelector('#board-tac [data-book]'); b?.click(); return !!b; });
    if (book) {
      await sleep(700);
      await measure(p, 'battle:book', tag, { root: '#board-tac' });
      await p.evaluate(() => document.querySelector('#board-tac [data-book]')?.click() ?? dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      await sleep(400);
    }
  }
  void touch;
}

// ------------------------------------------------------------------------------------------------ the run

const user = 700000000 + Math.floor(Math.random() * 9999999);
try {
  // 1. a phone on its side: the init, the sign-in, every screen at every phone size
  const side = pick(SIDE), up = pick(UPRIGHT), desk = pick(DESK);
  const p = await newPage(side[side.length - 1] ?? [812, 375], true);
  await signIn(p, user, 'mobile_android');
  const init = await p.evaluate(() => globalThis.__vk.calls.filter((c) => c.method === 'VKWebAppInit'));
  findings.init = init;
  check(['android', 'ios', 'rn', 'web'].every((ch) => init.some((c) => c.ch === ch)), `VKWebAppInit by all four channels: ${init.map((c) => `${c.ch}@${c.t}ms`).join(', ')}`);
  check(init.length >= 4 && init.slice(0, 4).every((c) => !c.main), 'VKWebAppInit went before the game\'s code was in (index.html\'s first script)');
  check(init.length === 4, `VKWebAppInit sent once per channel (${init.length})`);
  const ui = await p.evaluate(() => globalThis.__vk.calls.filter((c) => c.method === 'VKWebAppGetUserInfo').length);
  check(ui === 1, 'VKWebAppGetUserInfo asked once for the new captain\'s name');
  check(await p.evaluate(() => document.documentElement.classList.contains('vk-app')), 'html.vk-app');
  const me = await p.evaluate(() => globalThis.gravetide.state.self?.name);
  check(/^Анна/.test(me ?? ''), `the captain named from VK: ${me}`);
  await fill(p);
  if (!ONLY || ONLY.has('payment')) await payment(p);
  if (!ONLY || ONLY.has('share')) await share(p);
  if (!ONLY || ONLY.has('sleep')) await sleepCheck(p);
  for (const [w, h] of [...side].reverse()) {
    await p.setViewportSize({ width: w, height: h });
    await sleep(900);
    log(`— ${w}x${h}`);
    await sweepWindows(p, `${w}x${h}`);
  }
  for (const [w, h] of up) {
    await p.setViewportSize({ width: w, height: h });
    await sleep(900);
    await closeAll(p);
    await measure(p, 'rotate-veil', `${w}x${h}`, { root: '#rotate-lock' });
    await p.evaluate(() => globalThis.gravetide.shop(false));
    await measure(p, 'rotate-veil:over-shop', `${w}x${h}`, { root: '#rotate-lock' });
    await closeAll(p);
  }
  findings.errors.push(...p.errs.map((e) => `phone: ${e}`));
  const fsPhone = await p.evaluate(() => globalThis.__vk.fs);
  await p.ctx.close();
  // 2. the window inside vk.com on a desk, and a desk: the same captain (the same VK user) with a mouse; then the battle
  let fsDesk = 0, fsBattle = 0;
  if (desk.length) {
    const d = await newPage(desk[0], false);
    await signIn(d, user, 'desktop_web');
    for (const [w, h] of desk) {
      await d.setViewportSize({ width: w, height: h });
      await sleep(900);
      log(`— ${w}x${h}`);
      await sweepWindows(d, `${w}x${h}`);
    }
    if (!ONLY || ONLY.has('battle')) await battle(d, desk, false);
    fsDesk = await d.evaluate(() => globalThis.__vk.fs);
    findings.errors.push(...d.errs.map((e) => `desk: ${e}`));
    await d.ctx.close();
  }
  // 3. the boarding battle on the phones (the same captain again, her battle resumed — or begun)
  if (!ONLY || ONLY.has('battle')) {
    const b = await newPage(side[side.length - 1] ?? [812, 375], true);
    await signIn(b, user, 'mobile_android');
    if (await b.$('#board-tac:not(.hidden)')) {
      await sleep(2500);
      for (const [w, h] of side) {
        await b.setViewportSize({ width: w, height: h });
        await sleep(900);
        await measure(b, 'battle', `${w}x${h}`, { root: '#board-tac' });
        const book = await b.evaluate(() => { const x = document.querySelector('#board-tac [data-book]'); x?.click(); return !!x; });
        if (book) { await sleep(700); await measure(b, 'battle:book', `${w}x${h}`, { root: '#board-tac' }); await b.evaluate(() => document.querySelector('#board-tac [data-book]')?.click()); await sleep(400); }
      }
    } else await battle(b, side, true);
    fsBattle = await b.evaluate(() => globalThis.__vk.fs);
    findings.errors.push(...b.errs.map((e) => `battle: ${e}`));
    await b.ctx.close();
  }
  check(fsPhone === 0 && fsDesk === 0 && fsBattle === 0, `requestFullscreen never called inside VK (phone ${fsPhone}, desk ${fsDesk}, battle ${fsBattle})`);
} catch (e) {
  console.error(e);
  failures++;
}

// ------------------------------------------------------------------------------------------------ the report

const rows = results.filter((r) => !r.skipped);
const sizes = [...new Set(results.map((r) => r.size))];
const totals = Object.fromEntries(CHECKS.map((k) => [k, rows.reduce((n, r) => n + r[k].length, 0)]));
totals.fullscreen = Math.max(0, ...rows.map((r) => r.fs));
totals.windowOpen = Math.max(0, ...rows.map((r) => r.opens));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, lang: LANG, totals, findings, failures, results }, null, 1));
const md = [`# VK QA — ${new Date().toISOString()} (${LANG})`, '', `Checks failed: ${failures}. Screens measured: ${rows.length}; skipped: ${results.length - rows.length}.`, '', '| check | count |', '|---|---|', ...Object.entries(totals).map(([k, v]) => `| ${k} | ${v} |`), '', '## Screen × size → issues', '', `| screen | ${sizes.join(' | ')} |`, `|---|${sizes.map(() => '---').join('|')}|`];
const screens = [...new Set(results.map((r) => r.screen))];
for (const s of screens) {
  const cells = sizes.map((z) => {
    const r = results.find((x) => x.size === z && x.screen === s);
    if (!r) return '';
    if (r.skipped) return 'n/a';
    const bad = CHECKS.filter((k) => r[k].length).map((k) => `${k[0].toUpperCase()}${k.slice(1, 3)}${r[k].length}`);
    return bad.length ? bad.join(' ') : '✓';
  });
  md.push(`| ${s} | ${cells.join(' | ')} |`);
}
md.push('', '## Details', '');
for (const r of rows) {
  const bad = CHECKS.filter((k) => r[k].length);
  if (!bad.length) continue;
  md.push(`### ${r.size} ${r.screen}`);
  for (const k of bad) for (const x of r[k].slice(0, 8)) md.push(`- ${k}: ${x}`);
}
const skipped = results.filter((r) => r.skipped);
if (skipped.length) md.push('', '## Skipped', '', ...[...new Set(skipped.map((r) => `- ${r.screen}: ${r.skipped}`))]);
if (findings.errors.length) md.push('', '## Page errors', '', ...findings.errors.slice(0, 30).map((e) => `- ${e}`));
writeFileSync(`${OUT}/summary.md`, md.join('\n'));

// contact sheets: one per size, every screen's picture with its name and its issues
try {
  const page = await (await browser.newContext({ viewport: { width: 1800, height: 1000 } })).newPage();
  for (const z of sizes) {
    const list = rows.filter((r) => r.size === z);
    if (!list.length) continue;
    const [w, h] = z.split('x').map(Number);
    const cols = w > h ? 5 : 8;
    const tw = Math.floor(1780 / cols) - 8;
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:6px;background:#111;color:#ddd;font:12px system-ui}div.g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:8px}figure{margin:0}img{width:${tw}px;display:block;border:1px solid #444}figcaption{padding:2px 0;white-space:normal;word-break:break-all}b.bad{color:#f77}b.ok{color:#7d7}</style><h3>${z} — ${list.length} screens</h3><div class="g">${list.map((r) => {
      const bad = CHECKS.filter((k) => r[k].length).map((k) => `${k} ${r[k].length}`).join(', ');
      return `<figure><img src="${pathToFileURL(`${OUT}/${r.file}`).href}"><figcaption>${r.screen} ${bad ? `<b class="bad">${bad}</b>` : '<b class="ok">✓</b>'}</figcaption></figure>`;
    }).join('')}</div>`;
    const f = `${OUT}/sheet_${z}.html`;
    writeFileSync(f, html);
    await page.goto(pathToFileURL(f).href);
    await sleep(800);
    await page.screenshot({ path: `${OUT}/sheet_${z}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
  }
} catch (e) {
  console.error('contact sheets:', e.message);
}
await browser.close();
console.log(`\n${rows.length} screens measured, ${results.length - rows.length} skipped; totals ${JSON.stringify(totals)}; ${failures} checks failed. Report: ${OUT}/summary.md`);
process.exit(failures ? 1 : 0);
