// ux2 · the Telegram Mini App's fullscreen (owner, 2026-10-11: «не понятно как на весь экран сделать, там прям большая
// шапка сверху»). A fake window.Telegram.WebApp (initData signed with the test token, as tools/tg/qa.mjs) whose
// requestFullscreen answers as the case says, on a server started with the fake Bot API:
//   PORT=58994 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-ux2-tg.db TELEGRAM_BOT_TOKEN=test:qa-local-token TELEGRAM_FAKE=1 node server/src/main.ts
//   PORT=58994 node tools/mobile/ux2/tg.mjs [--shots docs/img/ux2]
// Cases: «late» — the first ask is not answered, the second (0.7 s) goes fullscreen; «tap» — only the first tap's ask is
// taken; «unsupported» — fullscreenFailed UNSUPPORTED, no more asks. Each: the asks, the console's lines, the safe area
// (the HUD below Telegram's floating buttons).
import * as L from '../m0/lib.mjs';
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(process.env.PORT ?? arg('port', 58994));
const TOKEN = process.env.TOKEN ?? 'test:qa-local-token';
const SHOTS = arg('shots', 'docs/img/ux2');
mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what) => { L.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
function initData(user) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAux2' + Date.now(), user: JSON.stringify(user) };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  return new URLSearchParams({ ...fields, hash: hmac(hmac('WebAppData', TOKEN), dcs).toString('hex') }).toString();
}
// the fake WebApp: `answer(n)` says what the n-th requestFullscreen does — 'ok', 'none' or a failure's error
const fake = (o) => {
  const handlers = {};
  const fire = (ev, data) => (handlers[ev] ?? []).forEach((cb) => cb.call(globalThis.Telegram.WebApp, data));
  globalThis.__asks = [];
  globalThis.Telegram = { WebApp: {
    initData: o.initData, version: '8.0', platform: o.platform, isFullscreen: false,
    themeParams: { bg_color: '#17212b', text_color: '#f5f5f5' },
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 46, bottom: 0, left: 0, right: 0 },
    isVersionAtLeast: (v) => parseFloat(v) <= 8.0,
    ready() {}, expand() {}, lockOrientation() {}, disableVerticalSwipes() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
    requestFullscreen() {
      const n = globalThis.__asks.push(performance.now());
      const a = o.answers[n - 1] ?? o.answers.at(-1);
      setTimeout(() => {
        if (a === 'ok') { this.isFullscreen = true; fire('fullscreenChanged'); }
        else if (a !== 'none') fire('fullscreenFailed', { error: a });
      }, 30);
    },
    onEvent: (ev, cb) => { (handlers[ev] ??= []).push(cb); },
    BackButton: { show() {}, hide() {}, onClick() {} },
  } };
};

const CASES = [
  { id: 'late', answers: ['none', 'ok'], want: { asks: 2, on: true } },
  { id: 'tap', answers: ['none', 'none', 'ok'], tap: true, want: { asks: 3, on: true } },
  { id: 'unsupported', answers: ['UNSUPPORTED'], tap: true, want: { asks: 1, on: false } },
];
const b = await L.browser();
try {
  for (const c of CASES) {
    const p = await L.page(b, [844, 390], { lang: 'ru', touch: true });
    const logs = [];
    p.on('console', (m) => { if (m.text().startsWith('[tg]')) logs.push(m.text()); });
    const user = { id: 800000 + Math.floor(Math.random() * 99999), first_name: 'Аня', language_code: 'ru' };
    await p.ctx.addInitScript(fake, { initData: initData(user), platform: 'ios', answers: c.answers });
    await p.goto(`http://localhost:${PORT}/?tg`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 60000 });
    await L.sleep(1500);
    if (c.tap) {
      const cdp = await p.ctx.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 200, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await L.sleep(600);
    }
    const st = await p.evaluate(() => ({ asks: globalThis.__asks.length, on: !!globalThis.Telegram.WebApp.isFullscreen, fs: globalThis.__tgFullscreen }));
    check(st.asks === c.want.asks && st.on === c.want.on, `${c.id}: ${st.asks} asks, fullscreen ${st.on} ${JSON.stringify(st.fs)}`);
    check(logs.some((l) => l.includes(c.want.on ? 'fullscreenChanged: fullscreen' : 'fullscreenFailed: UNSUPPORTED')), `${c.id}: the console says so — ${logs.join(' / ')}`);
    if (c.id === 'late') {
      // into the sea: the HUD below Telegram's floating buttons (the content safe area, 46 px)
      await p.click('.captain-card[data-id="corsair"]');
      await p.check('#know-sea').catch(() => {});
      await p.click('#pick-captain');
      for (let i = 0; i < 40 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await L.sleep(500); }
      await L.sleep(2500);
      await L.closeAll(p);
      const top = await p.evaluate(() => Math.min(...['#hud-captain', '#hud-map', '#mm-wrap', '#hud-minimap'].map((q) => document.querySelector(q)?.getBoundingClientRect()).filter((r) => r && r.width).map((r) => r.top)));
      check(top >= 46, `the HUD keeps below Telegram's buttons (top ${Math.round(top)} ≥ 46)`);
      // the action pills: no focus ring on touch even when focused by the code
      const ring = await p.evaluate(() => { const bt = document.querySelector('#touch .tc-actrow .k-btn, #touch button'); if (!bt) return 'none'; bt.focus(); return getComputedStyle(bt).outlineStyle; });
      check(ring === 'none', `a focused button on touch has no ring (${ring})`);
      await p.screenshot({ path: `${SHOTS}/tg-fullscreen-sea__844x390.png` });
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
L.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
