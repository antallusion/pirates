// Browser QA of Telegram (docs/27) on one's own admin server started with a test token and the fake Bot API:
//   PORT=58998 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-tg.db TELEGRAM_BOT_TOKEN=test:qa-local-token TELEGRAM_FAKE=1 \
//     node --disable-warning=ExperimentalWarning server/src/main.ts
//   PORT=58998 TOKEN=test:qa-local-token node tools/tg/qa.mjs
// The website's «Войти через Телеграм» (the bot is played by posting its webhook with the secret), settings'
// «Привязать Телеграм», the shop's Stars and a payment, then the Mini App: a fake window.Telegram.WebApp whose
// initData is signed with the test token — the sign-in, fullscreen, the safe areas, the BackButton, openInvoice,
// a phone held upright. Screenshots to docs/img/tg/; every check printed, the count of failures last.
import * as L from '../mobile/m0/lib.mjs';
import { createHash, createHmac } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 58998);
const TOKEN = process.env.TOKEN ?? 'test:qa-local-token';
const BASE = `http://localhost:${PORT}`;
const IMG = 'docs/img/tg';
const SECRET = createHash('sha256').update(TOKEN).digest('hex');
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };
const shot = (p, name) => p.screenshot({ path: `${IMG}/${name}.jpg`, type: 'jpeg', quality: 72 });
const hook = (update) => fetch(`${BASE}/tg/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': SECRET }, body: JSON.stringify(update) });
const botStart = (from, nonce) => hook({ update_id: Date.now(), message: { message_id: 1, from, chat: { id: from.id, type: 'private' }, text: `/start login_${nonce}` } });
const until = async (p, fn, arg, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await L.sleep(200); } return false; };
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
function initData(user) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAqa' + Date.now(), user: JSON.stringify(user) };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  return new URLSearchParams({ ...fields, hash: hmac(hmac('WebAppData', TOKEN), dcs).toString('hex') }).toString();
}
/** Every window.open recorded instead of opened (the deep link and the invoice). */
const stubOpen = (ctx) => ctx.addInitScript(() => { globalThis.__opened = []; window.open = (u) => { globalThis.__opened.push(String(u)); return { opener: null }; }; });
async function pickCaptain(p) {
  await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 45000 });
  await L.sleep(600);
  await p.click('.captain-card[data-id="corsair"]');
  await p.check('#know-sea').catch(() => {});
  await p.click('#pick-captain');
  for (let i = 0; i < 40 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await L.sleep(500); }
  await p.waitForSelector('#hud:not(.hidden)', { timeout: 60000 });
  await L.sleep(1500);
  await L.closeAll(p);
}
const fitOf = (p, sel) => p.evaluate((q) => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect();
  const out = r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5;
  const scroll = [...e.querySelectorAll('*'), e].some((x) => x.scrollHeight > x.clientHeight + 2 && getComputedStyle(x).overflowY !== 'visible');
  const small = [...e.querySelectorAll('button, a.btn')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((b) => b.height < 36 || b.width < 36).length;
  return { out, scroll, small, w: Math.round(r.width), h: Math.round(r.height) };
}, sel);

const b = await L.browser();
try {
  // ---------------------------------------------------------------- 1. the website: «Войти через Телеграм»
  // (ONLY_MINI=1: the Mini App's part alone)
  for (const [w, h] of process.env.ONLY_MINI ? [] : [[480, 270], [812, 375], [1440, 900]]) {
    for (const lang of ['ru', 'en']) {
      const p = await L.page(b, [w, h], { lang });
      await stubOpen(p.ctx);
      await p.goto(BASE, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('#login-tg:not(.hidden)', { timeout: 60000 });
      const t0 = Date.now();
      await p.click('#login-tg');
      // (the local server speaks HTTP/1.1: the start's POST waits behind the title screen's assets — six at a time)
      await p.waitForSelector('#tg-wait', { timeout: 90000 });
      console.log(`     the card in ${Date.now() - t0} ms`);
      await L.sleep(400);
      const link = await p.evaluate(() => document.querySelector('#tg-wait .tgw-open')?.getAttribute('href'));
      check(/^https:\/\/t\.me\/gravetide_bot\?start=login_[\w-]+$/.test(link ?? ''), `${w}x${h} ${lang}: the bot's link ${link}`);
      check((await p.evaluate(() => globalThis.__opened)).includes(link), `${w}x${h} ${lang}: the link opened at once`);
      const f = await fitOf(p, '#tg-wait .tgw-card');
      check(f && !f.out && !f.scroll && f.small === 0, `${w}x${h} ${lang}: the wait card fits ${JSON.stringify(f)}`);
      await shot(p, `wait__${w}x${h}_${lang}`);
      if (w === 812) {
        // the bot answers: the captain's choice comes up by itself
        const nonce = link.split('login_')[1];
        const r = await botStart({ id: 700000 + Math.floor(Math.random() * 99999), first_name: lang === 'ru' ? 'Мэри' : 'Mary', language_code: lang }, nonce);
        check(r.status === 200, `${lang}: the webhook took the bot's /start (${r.status})`);
        check(await until(p, () => !document.querySelector('#screen-captain')?.classList.contains('hidden'), null, 60000), `${lang}: signed in by Telegram — the captain's choice`);
        check(!(await p.$('#tg-wait')), `${lang}: the wait card closed`);
        await shot(p, `deeplink-done__${w}x${h}_${lang}`);
      }
      if (w === 480 && lang === 'ru') {
        await p.click('#tg-wait .tgw-cancel');
        check(!(await p.$('#tg-wait')), 'cancel closes the card');
      }
      await p.ctx.close();
    }
  }
  // a wrong secret is refused
  const bad = await fetch(`${BASE}/tg/webhook`, { method: 'POST', body: '{}', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'nope' } });
  check(bad.status === 401, `the webhook without the secret: ${bad.status}`);

  // ---------------------------------------------------------------- 2. a guest: settings' «Привязать Телеграм», the shop's Stars
  if (!process.env.ONLY_MINI) {
    const p = await L.page(b, [812, 375], { lang: 'ru' });
    await stubOpen(p.ctx);
    await L.login(p, { port: PORT, name: 'Тг ' + Math.random().toString(36).slice(2, 6), know: true });
    await L.closeAll(p);
    await L.open(p, 'options');
    await p.waitForSelector('[data-otg]', { timeout: 10000 });
    await L.sleep(300);
    check(/Привязать Телеграм/.test(await p.textContent('[data-otg]')), 'settings: «Привязать Телеграм»');
    for (const [w, h] of [[480, 270], [812, 375], [1440, 900]]) {
      await p.setViewportSize({ width: w, height: h });
      await L.sleep(500);
      const f = await fitOf(p, '#modal-panel');
      const btn = await p.evaluate(() => { const r = document.querySelector('[data-otg]').getBoundingClientRect(); return { b: r.bottom, h: r.height, vh: innerHeight }; });
      // (the audit's floor for a tap: 36 px when the short side is 360 or more, 32 below — tools/mobile/fit/measure.js)
      check(f && !f.out && !f.scroll && btn.b <= btn.vh && btn.h >= (Math.min(w, h) >= 360 ? 36 : 32), `${w}x${h}: settings fit with the button ${JSON.stringify({ ...f, btn })}`);
      await shot(p, `settings__${w}x${h}_ru`);
    }
    await p.setViewportSize({ width: 812, height: 375 });
    await p.click('[data-otg]');
    await p.waitForSelector('#tg-wait');
    const link = await p.evaluate(() => document.querySelector('#tg-wait .tgw-open')?.getAttribute('href'));
    await shot(p, 'link-wait__812x375_ru');
    await botStart({ id: 800000 + Math.floor(Math.random() * 99999), first_name: 'Линк', language_code: 'ru' }, link.split('login_')[1]);
    check(await until(p, () => /привязан/.test(document.querySelector('#tg-wait .tgw-left')?.textContent ?? ''), null, 10000), 'the card says the Telegram is linked');
    await shot(p, 'link-done__812x375_ru');
    check(await until(p, () => !document.querySelector('#tg-wait') && /Телеграм привязан/.test(document.querySelector('[data-otg]')?.textContent ?? ''), null, 8000), 'settings: «Телеграм привязан»');
    // the shop's top-up: the packs in Stars
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.shop(true));
    await p.waitForSelector('[data-pmpack]', { timeout: 10000 });
    await L.sleep(500);
    const prices = await p.$$eval('[data-pmpack]', (bs) => bs.map((x) => x.textContent.replace(/[\s,]/g, '')));
    check(prices.join(',') === '75,375,750,1500,3750', `the packs' prices in Stars: ${prices}`);
    for (const [w, h] of [[480, 270], [640, 360], [812, 375], [915, 412], [1440, 900]]) {
      await p.setViewportSize({ width: w, height: h });
      await L.sleep(500);
      const vis = await p.evaluate(() => [...document.querySelectorAll('[data-pmpack]')].map((x) => { const r = x.getBoundingClientRect(); return { b: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; }));
      const body = await p.evaluate(() => { const e = document.querySelector('#modal-panel .modal-body'); return e ? { sh: e.scrollHeight, ch: e.clientHeight } : null; });
      // (a mouse's desk keeps the shop's small buttons; a finger's screen has them a finger high)
      check(w >= 1000 || vis.every((v) => v.h >= 32 && v.w >= 40), `${w}x${h}: the Stars buttons a finger wide ${JSON.stringify(vis.map((v) => `${v.w}x${v.h}`))} (body ${JSON.stringify(body)})`);
      await shot(p, `shop-stars__${w}x${h}_ru`);
    }
    await p.setViewportSize({ width: 812, height: 375 });
    await L.sleep(300);
    await p.click('[data-pmpack="d100"]');
    check(await until(p, () => globalThis.__opened.some((u) => u.includes('fake-invoice')), null, 8000), 'Buy: the Stars invoice opened as a link');
    const inv = (await p.evaluate(() => globalThis.__opened)).find((u) => u.includes('fake-invoice'));
    const m = /fake-invoice-(\d+)_(d\d+)_([\w-]+)$/.exec(inv);
    check(!!m, `the invoice's payload ${inv}`);
    const before = await p.evaluate(() => globalThis.gravetide.state.doubloons);
    const pay = { message: { message_id: 2, from: { id: 1, first_name: 'Payer', language_code: 'ru' }, chat: { id: 1, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: 75, invoice_payload: `${m[1]}:${m[2]}:${m[3]}`, telegram_payment_charge_id: 'qa-charge-' + Date.now() } } };
    await hook(pay);
    await hook(pay); // Telegram repeating itself
    check(await until(p, (n) => globalThis.gravetide.state.doubloons === n + 100, before, 8000), `the payment pushed: ${before} → ${before + 100}, once`);
    await L.sleep(1500);
    check((await p.evaluate(() => globalThis.gravetide.state.doubloons)) === before + 100, 'the repeated payment credited nothing more');
    await shot(p, 'shop-paid__812x375_ru');
    await p.ctx.close();
  }

  // ---------------------------------------------------------------- 3. the Mini App
  const fake = (o) => {
    const calls = [];
    const handlers = {};
    let back = null;
    globalThis.__tgCalls = calls;
    globalThis.__tgBack = () => back?.();
    globalThis.Telegram = { WebApp: {
      initData: o.initData, version: '8.0', platform: o.platform, colorScheme: 'dark',
      themeParams: { bg_color: '#17212b', text_color: '#f5f5f5', button_color: '#5288c1', button_text_color: '#ffffff' },
      safeAreaInset: { top: 0, bottom: 0, left: o.left, right: 0 }, contentSafeAreaInset: { top: o.top, bottom: 0, left: 0, right: 0 },
      isVersionAtLeast: (v) => parseFloat(v) <= 8.0,
      ready: () => calls.push('ready'), expand: () => calls.push('expand'), requestFullscreen: () => calls.push('requestFullscreen'),
      lockOrientation: () => calls.push('lockOrientation'), disableVerticalSwipes: () => calls.push('disableVerticalSwipes'),
      setHeaderColor: (c) => calls.push('header ' + c), setBackgroundColor: (c) => calls.push('bg ' + c), setBottomBarColor: (c) => calls.push('bottom ' + c),
      onEvent: (ev, cb) => { (handlers[ev] ??= []).push(cb); },
      BackButton: { isVisible: false, show() { this.isVisible = true; calls.push('back show'); }, hide() { this.isVisible = false; calls.push('back hide'); }, onClick: (cb) => { back = cb; } },
      openInvoice: (url, cb) => { calls.push('openInvoice ' + url); setTimeout(() => cb?.('paid'), 50); },
    } };
  };
  for (const [w, h, lang] of [[812, 375, 'ru'], [480, 270, 'en']]) {
    const p = await L.page(b, [w, h], { lang });
    const user = { id: 900000 + Math.floor(Math.random() * 99999), first_name: lang === 'ru' ? 'Аня' : 'Anne', last_name: 'Bonny', language_code: lang };
    await p.ctx.addInitScript(fake, { initData: initData(user), platform: 'android', top: 46, left: 0 });
    // the sign-in held a moment, so the loading screen can be seen
    await p.route('**/auth/tg/webapp', async (r) => { await L.sleep(1200); await r.continue(); });
    await p.goto(`${BASE}/?tg`, { waitUntil: 'domcontentloaded' });
    check(await until(p, () => !!document.querySelector('#tg-boot'), null, 15000), `${w}x${h}: the Mini App's loading screen`);
    await shot(p, `miniapp-boot__${w}x${h}_${lang}`);
    const bootBg = await p.evaluate(() => getComputedStyle(document.querySelector('#tg-boot')).backgroundColor);
    check(bootBg === 'rgb(23, 33, 43)', `the loading screen in the theme's colour (${bootBg})`);
    await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 45000 });
    const calls = await p.evaluate(() => globalThis.__tgCalls);
    for (const c of ['ready', 'expand', 'requestFullscreen', 'disableVerticalSwipes', 'lockOrientation']) check(calls.includes(c), `${w}x${h}: WebApp.${c}`);
    check(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sa-t').includes('46px')), 'the content safe area into --sa-t');
    check(await p.evaluate(() => document.querySelector('#login-tg').classList.contains('hidden')), 'no «Войти через Телеграм» inside Telegram');
    await shot(p, `miniapp-captain__${w}x${h}_${lang}`);
    await pickCaptain(p);
    const name = await p.evaluate(() => globalThis.gravetide.state.self?.name ?? localStorage.getItem('gravetide.captain'));
    console.log('     the captain:', name);
    const top = await p.evaluate(() => Math.min(...['#hud-captain', '#hud-map'].map((q) => document.querySelector(q)?.getBoundingClientRect().top ?? 999)));
    check(top >= 46, `the HUD keeps clear of Telegram's controls (top ${Math.round(top)} ≥ 46)`);
    await shot(p, `miniapp-sea__${w}x${h}_${lang}`);
    // the BackButton: shown with a window, closes it
    await L.open(p, 'options');
    await L.sleep(500);
    check(await p.evaluate(() => globalThis.Telegram.WebApp.BackButton.isVisible), 'the BackButton shows with a window up');
    await p.evaluate(() => globalThis.__tgBack());
    await L.sleep(500);
    check(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden') || document.querySelector('#modal-panel').dataset.modal !== 'options'), 'the BackButton closed the settings (in port: back to the harbour, as Esc)');
    for (let i = 0; i < 3 && !(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden'))); i++) { await p.evaluate(() => globalThis.__tgBack()); await L.sleep(500); }
    check(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden')), 'the BackButton closed every window');
    check(await p.evaluate(() => !globalThis.Telegram.WebApp.BackButton.isVisible), 'the BackButton hides again');
    // settings inside Telegram: «Телеграм привязан»
    await L.open(p, 'options');
    check(await until(p, () => document.querySelector('[data-otg]')?.disabled === true, null, 6000), 'settings in the Mini App: Telegram linked');
    await L.closeAll(p);
    // the shop: openInvoice in place
    await p.evaluate(() => globalThis.gravetide.shop(true));
    await p.waitForSelector('[data-pmpack]');
    await L.sleep(400);
    await p.click('[data-pmpack="d550"]');
    check(await until(p, () => globalThis.__tgCalls.some((c) => c.startsWith('openInvoice https://t.me/$fake-invoice')), null, 8000), 'Buy in the Mini App: WebApp.openInvoice');
    await L.sleep(400);
    await shot(p, `miniapp-shop__${w}x${h}_${lang}`);
    // upright: the veil asks to turn the phone, with the word on auto-rotate
    await p.setViewportSize({ width: h, height: w });
    await L.sleep(600);
    const veil = await p.evaluate(() => { const e = document.querySelector('#rotate-lock'); const s = e.querySelector('.tg-rot'); return { shown: getComputedStyle(e).display !== 'none', tg: !!s && getComputedStyle(s).display !== 'none', text: s?.textContent }; });
    check(veil.shown && veil.tg, `upright in Telegram: the veil and its auto-rotate line ${JSON.stringify(veil)}`);
    await shot(p, `miniapp-portrait__${h}x${w}_${lang}`);
    check(p.errors.length === 0, `no page errors ${JSON.stringify(p.errors.slice(0, 3))}`);
    await p.ctx.close();
  }
} finally {
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
