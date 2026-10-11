// The chat's browser QA (docs/28): three captains on one admin server — a phone held sideways (812×375), the smallest
// phone (480×270) and a desk (1500×600) — chat in the world, write privately, pick emotes, see the unread and the toast
// line, open a captain's card; screenshots to docs/img/chat/, the fit meter on every open state.
//   PORT=58999 node tools/mobile/chat/qa.mjs
import * as L from '../m0/lib.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 58999);
const OUT = 'docs/img/chat';
mkdirSync(OUT, { recursive: true });
const FIT = readFileSync(new URL('../fit/measure.js', import.meta.url), 'utf8');
const sleep = L.sleep;
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await sleep(120); } return false; };
const shown = (q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('hidden'); };
const rect = (p, q) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, q);
const tap = async (p, q) => { const r = await rect(p, q); if (!r) throw new Error('no ' + q); if (p.touch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y); await sleep(250); };
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const results = {};
/** A page frozen (its sea stops drawing) while another logs in: a software GPU draws one sea at a time well. */
async function freeze(p, on) {
  p.cdp ??= await p.ctx.newCDPSession(p);
  await p.cdp.send('Page.setWebLifecycleState', { state: on ? 'frozen' : 'active' }).catch(() => {});
}
/** A guest captain, polled (no actionability waits: the page draws the sea while it loads). */
async function login(p, name, captain) {
  await p.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (!(await until(p, shown, '#login-name', 240000))) throw new Error('no login form');
  await p.evaluate((n) => { const i = document.getElementById('login-name'); i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); }, name);
  await p.evaluate(() => document.querySelector('#login-form button[type=submit]').click());
  if (!(await until(p, shown, '.captain-card', 240000))) { await p.screenshot({ path: 'assets/raw/audit/chat_login_fail.png' }); throw new Error('no captain screen for ' + name + ' ' + JSON.stringify(p.errors.slice(-3))); }
  await p.evaluate((c) => document.querySelector(`.captain-card[data-id="${c}"]`)?.click(), captain);
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
  await p.evaluate(() => document.getElementById('pick-captain')?.click());
  for (let i = 0; i < 120 && !(await p.evaluate(() => !!document.querySelector('#hud:not(.hidden)'))); i++) { await p.mouse.click(10, 10).catch(() => {}); await sleep(500); }
  if (!(await p.evaluate(() => !!document.querySelector('#hud:not(.hidden)')))) throw new Error('no hud');
  await sleep(1500);
}
async function fit(p, tag) {
  await p.evaluate(FIT);
  const r = await p.evaluate(() => globalThis.__fit('#hud-chat'));
  const row = { scroll: r.scroll, out: r.out, cut: r.cut, small: r.small.length, underMin: r.underMin, minTap: r.minTap, tiny: r.tiny, page: r.page };
  results[tag] = row;
  L.log(tag.padEnd(28), `out ${r.out.length}  cut ${r.cut.length}  scroll ${r.scroll.length}  <${r.minTap}px ${r.underMin}  tiny ${r.tiny.length}${r.page ? '  PAGE ' + r.page : ''}`);
  if (r.out.length) L.log('   out', r.out.slice(0, 6));
  if (r.cut.length) L.log('   cut', r.cut.slice(0, 6));
  if (r.tiny.length) L.log('   tiny', r.tiny.slice(0, 6));
  if (r.underMin) L.log('   small', r.small.slice(0, 8));
  return row;
}
/** What stands under the sheet's open area that is a main control (the helm, the fire, the book…). */
const covered = (p) => p.evaluate(() => {
  const ch = document.querySelector('#chat.open')?.getBoundingClientRect();
  if (!ch) return [];
  const out = [];
  for (const id of ['tc-stick', 'tc-fire', 'tc-cast', 'tc-act', 'hud-captain', 'tb-book', 'tac-book']) {
    const e = document.getElementById(id); if (!e) continue;
    const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') continue;
    const ix = Math.min(r.right, ch.right) - Math.max(r.left, ch.left), iy = Math.min(r.bottom, ch.bottom) - Math.max(r.top, ch.top);
    if (ix > 2 && iy > 2) out.push(id);
  }
  return out;
});

const b = await L.browser();
try {
  const tag = Math.random().toString(36).slice(2, 5);
  // one at a time: three sea canvases drawing at once on a software GPU slow every login
  const pages = [];
  const enter = async (size, opts, name, captain) => {
    const p = await L.page(b, size, opts);
    pages.push(p);
    p.touch = opts.touch ?? size[0] < 1000;
    await login(p, name, captain);
    return p;
  };
  const nA = `Анна${tag}`, nC = `Кира${tag}`, nD = `Дан${tag}`;
  const A = await enter([812, 375], { lang: 'ru' }, nA, 'corsair');
  const C = await enter([480, 270], { lang: 'ru' }, nC, 'drowned');
  const D = await enter([1500, 600], { lang: 'ru', touch: false }, nD, 'admiral');
  for (const p of [A, C, D]) await L.closeAll(p);
  await sleep(1500);
  // 1. the button with nothing unread; the world speaks (from the desk) with emotes
  await shot(A, '812x375_closed');
  await L.send(D, { t: 'chat', text: 'Попутного ветра всем! :rum: :anchor: :ship: Сбор на gravetidegame.com/guild, не на evil.example.com', ch: 'world' });
  await sleep(900);
  results.dot = await A.evaluate(() => document.querySelector('#chat-unread')?.className);
  // 2. the phone opens the chat
  await tap(A, '#chat-toggle');
  await until(A, shown, '#chat.open');
  await sleep(500);
  await shot(A, '812x375_world');
  await fit(A, '812x375 world');
  results.covered812 = await covered(A);
  // her own line, an emote picked from the picker
  await tap(A, '#chat-emote-btn');
  await until(A, shown, '#chat-emotes');
  await shot(A, '812x375_emotes');
  await fit(A, '812x375 emotes');
  await tap(A, '#chat-emotes [data-eg="sea"]');
  await tap(A, '#chat-emotes [data-emo="kraken"]');
  await A.evaluate(() => { const i = document.getElementById('chat-input'); i.value += 'Кракен у Солтмарроу!'; });
  await tap(A, '#chat-send');
  await sleep(700);
  // the autocomplete after «:»
  await A.evaluate(() => { const i = document.getElementById('chat-input'); i.focus(); i.value = 'за победу :ро'; i.setSelectionRange(i.value.length, i.value.length); i.dispatchEvent(new Event('input')); });
  await until(A, shown, '#chat-suggest');
  await shot(A, '812x375_autocomplete');
  await fit(A, '812x375 autocomplete');
  results.suggest = await A.evaluate(() => [...document.querySelectorAll('#chat-suggest [data-emo]')].map((x) => x.dataset.emo));
  await tap(A, '#chat-suggest [data-emo="rum"]');
  results.afterSuggest = await A.evaluate(() => document.getElementById('chat-input').value);
  await A.evaluate(() => { document.getElementById('chat-input').value = ''; document.getElementById('chat-input').blur(); });
  // 3. the desk's captain's card on the phone: a tap on his face
  await until(A, (n) => !!document.querySelector(`#chat-log [data-nick="${n}"]`), nD);
  await tap(A, `#chat-log button.cl-face[data-nick="${nD}"]`);
  await until(A, shown, '#chat-card');
  await shot(A, '812x375_card');
  await fit(A, '812x375 card');
  // write privately from the card
  await tap(A, '#chat-card [data-act="dm"]');
  await until(A, shown, '#chat-peers');
  await A.evaluate(() => { const i = document.getElementById('chat-input'); i.value = 'Дан, встретимся у Крюка? :compass:'; });
  await tap(A, '#chat-send');
  await sleep(900);
  await shot(A, '812x375_dm');
  await fit(A, '812x375 dm');
  // the desk: the chat shut — the unread count and the toast line
  results.deskBadge = await D.evaluate(() => document.querySelector('#chat-unread')?.textContent);
  await until(D, shown, '#chat-toast', 3000);
  results.deskToast = await D.evaluate(() => document.querySelector('#chat-toast')?.innerText);
  await shot(D, '1500x600_toast');
  // the desk opens it from the toast line: the conversation, answered
  await D.evaluate(() => document.querySelector('#chat-toast').click());
  await until(D, shown, '#chat-peers');
  await D.evaluate(() => { const i = document.getElementById('chat-input'); i.value = 'Да! В полдень у Крюка :pistols:'; });
  await D.keyboard.press('Enter').catch(() => {});
  await tap(D, '#chat-send');
  await sleep(900);
  await shot(D, '1500x600_dm');
  await fit(D, '1500x600 dm');
  await tap(D, '#chat-tabs [data-ct="world"]');
  await sleep(400);
  await shot(D, '1500x600_world');
  await fit(D, '1500x600 world');
  // the dock to the right
  await tap(D, '#chat-dock');
  await sleep(400);
  await shot(D, '1500x600_dock_right');
  await fit(D, '1500x600 dock right');
  await tap(D, '#chat-dock');
  // 4. the smallest phone: the world, the emotes, the private tab's list, the card
  await sleep(800);
  await tap(C, '#chat-toggle');
  await until(C, shown, '#chat.open');
  await sleep(500);
  await shot(C, '480x270_world');
  await fit(C, '480x270 world');
  results.covered480 = await covered(C);
  await tap(C, '#chat-emote-btn');
  await until(C, shown, '#chat-emotes');
  await shot(C, '480x270_emotes');
  await fit(C, '480x270 emotes');
  await tap(C, '#chat-emote-btn');
  await until(C, (n) => !!document.querySelector(`#chat-log [data-nick="${n}"]`), nA);
  await tap(C, `#chat-log button.cl-face[data-nick="${nA}"]`);
  await until(C, shown, '#chat-card');
  await shot(C, '480x270_card');
  await fit(C, '480x270 card');
  await tap(C, '#chat-card [data-act="dm"]');
  await C.evaluate(() => { const i = document.getElementById('chat-input'); i.value = 'Анна, привет из тумана :fog:'; });
  await tap(C, '#chat-send');
  await sleep(700);
  await shot(C, '480x270_dm');
  await fit(C, '480x270 dm');
  await tap(C, '#chat-peers [data-back]');
  await sleep(300);
  await shot(C, '480x270_threads');
  await fit(C, '480x270 threads');
  // the phone: a private word while she looks at the world: the tab's count
  results.aDmTab = await A.evaluate(() => document.querySelector('#chat-tabs [data-ct="dm"] .ct-n')?.textContent ?? null);
  // 5. a swipe right folds the phone's sheet away; the button again
  const r = await rect(C, '#chat-log');
  const cdp = await C.ctx.newCDPSession(C);
  const t = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: r.y }] });
  await t('touchStart', r.l + 20); for (let k = 1; k <= 6; k++) { await t('touchMove', r.l + 20 + k * 22); await sleep(16); } await t('touchEnd');
  await sleep(500);
  results.swipeClosed = await C.evaluate(() => !document.querySelector('#chat').classList.contains('open'));
  // 6. 640×360 and 812×375 the world again, the sizes the audit names
  for (const [w, h] of [[640, 360], [812, 375]]) {
    await C.setViewportSize({ width: w, height: h });
    await sleep(400);
    await C.evaluate(() => globalThis.gravetide.hud.chatPanel.open(false));
    await sleep(500);
    await fit(C, `${w}x${h} world (C)`);
    await C.evaluate(() => globalThis.gravetide.hud.chatPanel.close());
  }
  await C.setViewportSize({ width: 480, height: 270 });
  // 7. Esc on the desk
  await D.evaluate(() => globalThis.gravetide.hud.chatPanel.open(false));
  await D.keyboard.press('Escape');
  await sleep(300);
  results.escClosed = await D.evaluate(() => !document.querySelector('#chat').classList.contains('open'));
  results.errors = { A: A.errors, C: C.errors, D: D.errors };
} finally {
  writeFileSync(`${OUT}/qa.json`, JSON.stringify(results, null, 1));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).filter(([k]) => !/x\d/.test(k))), null, 1));
  await b.close();
}
