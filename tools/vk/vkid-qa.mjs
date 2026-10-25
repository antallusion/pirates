// Browser QA of «Войти через VK ID» on the website (docs/36_VK.md §8). Never calls the real id.vk.com: it serves a
// mock VK ID itself (MOCK port) — /authorize sends the browser straight back with a code, /oauth2/auth checks the PKCE
// verifier against the challenge, /oauth2/user_info names the user. The game server runs apart, pointed at the mock:
//   PORT=58610 DB_PATH=data/vkid-qa.db VKID_APP_ID=54851873 VKID_API_BASE=http://127.0.0.1:58611 \
//     VKID_REDIRECT_URL=http://127.0.0.1:58610/auth/vkid/callback node --disable-warning=ExperimentalWarning server/src/main.ts
//   node tools/vk/vkid-qa.mjs http://127.0.0.1:58610          # MOCK=58611 OUT=assets/raw/vkid_shots
// Checks: the button on the start screen (RU and EN, a desk and a phone), its redirect (state, S256 challenge, the
// redirect URL, the scope), the sign-in back at /play with the game connected, the one-time notices' hint, a guest's
// «Привязать VK» in the settings → linked, and the same VK user signing in again landing on that captain. One headless
// Chromium, its own profile.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.argv[2] ?? process.env.BASE ?? 'http://127.0.0.1:58610').replace(/\/$/, '');
const MOCK = Number(process.env.MOCK ?? 58611);
const OUT = resolve(process.env.OUT ?? 'assets/raw/vkid_shots');
const require = createRequire(process.env.PLAYWRIGHT ?? 'C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = process.env.EXE ?? 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok: !!ok, info });
  log(ok ? 'PASS' : 'FAIL', name, info);
};

// ------------------------------------------------------------------------------------------------ the mock VK ID
// (VK user ids fresh each run: the QA database keeps the earlier runs' captains)
const RUN = 100_000 + Math.floor(Math.random() * 800_000) * 10;
let nextUser = RUN + 5;
const codes = new Map();
const authorizes = [];
const mock = createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${MOCK}`);
  let body = '';
  for await (const c of req) body += c;
  if (req.method === 'GET' && u.pathname === '/authorize') {
    const q = Object.fromEntries(u.searchParams);
    authorizes.push(q);
    const user = Number(process.env.VKUSER ?? 0) || globalThis.__vkUser || nextUser++;
    const code = `c${Math.random().toString(36).slice(2)}`;
    codes.set(code, { user, challenge: q.code_challenge, redirect: q.redirect_uri });
    const back = new URL(q.redirect_uri);
    back.search = new URLSearchParams({ code, state: q.state, device_id: 'qa-device', type: 'code_v2', expires_in: '600' }).toString();
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  const f = new URLSearchParams(body);
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST' && u.pathname === '/oauth2/auth') {
    const c = codes.get(f.get('code'));
    codes.delete(f.get('code'));
    const ok = c && createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url') === c.challenge && f.get('redirect_uri') === c.redirect && f.get('device_id');
    res.end(JSON.stringify(ok ? { access_token: `at${c.user}`, user_id: c.user, state: f.get('state'), expires_in: 3600 } : { error: 'invalid_grant' }));
    return;
  }
  if (req.method === 'POST' && u.pathname === '/oauth2/user_info') {
    const id = Number((f.get('access_token') ?? '').slice(2));
    res.end(JSON.stringify({ user: { user_id: String(id), first_name: 'Вера', last_name: 'QA' } }));
    return;
  }
  res.writeHead(404).end('{}');
});
await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));
log('mock VK ID on', MOCK);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
try {
  // ---------------------------------------------------------------------------------------------- 1. the button
  for (const [w, h, lng] of [[1366, 768, 'ru'], [375, 812, 'ru'], [812, 375, 'en']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript((l) => localStorage.setItem('gravetide.lang', l), lng);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/play`);
    await p.waitForSelector('#login-vkid:not(.hidden)', { timeout: 20_000 }).catch(() => null);
    const vis = await p.$eval('#login-vkid', (b) => ({ shown: b.getClientRects().length > 0, text: b.textContent, bg: getComputedStyle(b).backgroundColor, r: b.getBoundingClientRect().toJSON(), vw: innerWidth })).catch(() => null);
    check(`button shown ${w}x${h} ${lng}`, vis?.shown && vis.text.includes(lng === 'ru' ? 'Войти через VK ID' : 'Sign in with VK ID'), JSON.stringify(vis?.text));
    check(`button VK blue, inside the screen ${w}x${h}`, vis?.bg === 'rgb(0, 119, 255)' && vis.r.left >= 0 && vis.r.right <= vis.vw, `${vis?.bg} ${Math.round(vis?.r.left)}–${Math.round(vis?.r.right)}`);
    await p.screenshot({ path: `${OUT}/login_${w}x${h}_${lng}.png` });
    await ctx.close();
  }
  // inside the VK Mini App and on Telegram's host: never
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/play?vk`);
    await sleep(2500);
    check('no button inside VK (?vk)', !(await p.$eval('#login-vkid', (b) => b.getClientRects().length > 0)));
    await p.goto(`${BASE}/play?tg`);
    await sleep(2500);
    check('no button on the Telegram host (?tg)', !(await p.$eval('#login-vkid', (b) => b.getClientRects().length > 0)));
    await ctx.close();
  }

  // ---------------------------------------------------------------------------------------------- 2. the sign-in
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => localStorage.setItem('gravetide.lang', 'ru'));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/play`);
  await p.waitForSelector('#login-vkid:not(.hidden)', { timeout: 20_000 });
  globalThis.__vkUser = RUN + 1;
  await p.click('#login-vkid');
  await p.waitForFunction(() => localStorage.getItem('gravetide.token'), null, { timeout: 20_000 }).catch(() => null);
  const a = authorizes.at(-1) ?? {};
  check('redirect: id.vk.com authorize shape', a.response_type === 'code' && a.client_id === '54851873' && a.scope === 'vkid.personal_info' && /callback$/.test(a.redirect_uri ?? '') && a.code_challenge_method?.toUpperCase() === 'S256' && /^[\w-]{43}$/.test(a.code_challenge ?? '') && (a.state ?? '').length >= 32, JSON.stringify(a));
  const tok = await p.evaluate(() => localStorage.getItem('gravetide.token'));
  check('signed in: a game token kept', !!tok);
  const hint = await p.waitForSelector('[role="alertdialog"] #confirm-text', { timeout: 25_000 }).catch(() => null);
  const hintText = hint ? (await hint.textContent()).replace(/\s+/g, ' ') : '';
  check('notices hint shown', hintText.includes('откройте игру в VK и разрешите уведомления'), hintText);
  await p.screenshot({ path: `${OUT}/hint_1366x768.png` });
  if (hint) await p.click('[role="alertdialog"] [data-no]');
  const live = await p.waitForFunction(() => document.querySelector('#screen-login')?.getClientRects().length === 0, null, { timeout: 20_000 }).then(() => true).catch(() => false);
  check('in the game after the sign-in', live);
  // the hint is once
  await p.goto(`${BASE}/play#token=${encodeURIComponent(tok)}&vkid=1&vknote=1`);
  await sleep(6000);
  check('hint only once', !(await p.$('[role="alertdialog"] #confirm-text')));
  const st = await p.evaluate(async (t) => (await fetch('/auth/vkid/status', { method: 'POST', body: JSON.stringify({ token: t }) })).json(), tok);
  check('status: linked, notices not pretended', st.linked === true && st.notify === false, JSON.stringify(st));
  await ctx.close();

  // ---------------------------------------------------------------------------------------------- 3. a guest links VK
  const g = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await g.addInitScript(() => localStorage.setItem('gravetide.lang', 'ru'));
  const q = await g.newPage();
  await q.goto(`${BASE}/play`);
  await q.fill('#login-name', `Гостья ${Math.floor(Math.random() * 900 + 100)}`);
  await q.click('#login-form button[type=submit]');
  await q.waitForFunction(() => document.querySelector('#screen-login')?.getClientRects().length === 0, null, { timeout: 30_000 });
  await sleep(3000);
  // a new captain: her pick first, then the sea; the settings by Escape (a film or a window closed first)
  await q.getByText('Принять командование', { exact: false }).first().click({ timeout: 5000 }).catch(() => null);
  await sleep(5000);
  for (let i = 0; i < 4 && !(await q.$('[data-omore]')); i++) {
    await q.keyboard.press('Escape');
    await sleep(1200);
  }
  const btn = await q.waitForSelector('[data-ovkid]', { timeout: 10_000 }).catch(() => null);
  check('settings: «Привязать VK»', btn && (await btn.textContent()).includes('Привязать VK'), btn ? await btn.textContent() : 'none');
  await q.screenshot({ path: `${OUT}/settings_1366x768.png` });
  const guestTok = await q.evaluate(() => localStorage.getItem('gravetide.token'));
  globalThis.__vkUser = RUN + 2;
  if (btn) await Promise.all([q.waitForURL((u) => u.pathname === '/play' && !u.hash, { timeout: 20_000 }).catch(() => null), btn.click()]);
  const told = await q.waitForSelector('[role="alertdialog"] #confirm-text', { timeout: 25_000 }).catch(() => null);
  const toldText = told ? (await told.textContent()).replace(/\s+/g, ' ') : '';
  check('linked: told', toldText.includes('VK привязан'), toldText);
  await q.screenshot({ path: `${OUT}/linked_1366x768.png` });
  check('linked: her token kept', (await q.evaluate(() => localStorage.getItem('gravetide.token'))) === guestTok);
  const st2 = await q.evaluate(async (t) => (await fetch('/auth/vkid/status', { method: 'POST', body: JSON.stringify({ token: t }) })).json(), guestTok);
  check('linked: status', st2.linked === true, JSON.stringify(st2));
  // the same VK user signs in elsewhere: the same captain
  await g.close();
  const h = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const s = await h.newPage();
  await s.goto(`${BASE}/play`);
  await s.waitForSelector('#login-vkid:not(.hidden)', { timeout: 20_000 });
  await s.click('#login-vkid');
  await s.waitForFunction(() => localStorage.getItem('gravetide.token'), null, { timeout: 20_000 }).catch(() => null);
  await s.waitForFunction(() => document.querySelector('#screen-login')?.getClientRects().length === 0, null, { timeout: 30_000 }).catch(() => null);
  const name2 = await s.evaluate(() => localStorage.getItem('gravetide.captain'));
  check('the linked VK signs in as the guest\'s captain', !!name2 && name2.startsWith('Гостья'), name2 ?? '');
  await h.close();
} finally {
  await browser.close();
  mock.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.ok);
log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
