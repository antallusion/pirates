// The web game's top-up through YooKassa in the browser (owner, 2026-10-21: «подключай кассу на сайт и в игре»), on a QA
// server in its test mode (GRAVETIDE_PAY_TEST=1: the fake checkout, no money): the top-up's packs «Оплатить» in roubles,
// a pack paid in the checkout's own tab (it comes back and closes), the doubloons in; then a Buy short of doubloons — the
// question, the checkout, the purchase going by itself once paid. And the same page as Telegram's and VK's: no YooKassa.
//   GPORT=58640 SIZE=844x390 LANG2=ru,en OUT=assets/raw/audit/checkout node tools/mobile/ux/checkout.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58640);
const OUT = process.env.OUT ?? 'assets/raw/audit/checkout';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
const dbl = (p) => p.evaluate(() => globalThis.gravetide.state.doubloons ?? null);
try {
  for (const lang of langs) {
    const p = await L.page(b, [W, H], { lang });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    // 1. the top-up: «Оплатить» on every pack, no Stars
    await p.evaluate(() => globalThis.gravetide.shop(true));
    await L.sleep(1500);
    const top = await p.evaluate(() => ({ yk: document.querySelectorAll('#modal-panel [data-pmyk]').length, stars: document.querySelectorAll('#modal-panel [data-pmpack], #modal-panel .tg-star').length, note: document.querySelector('#modal-panel .pm-paynote')?.textContent ?? '' }));
    L.log(`${lang} top-up: ${JSON.stringify(top)}`);
    if (top.yk !== 6 || top.stars) fail(`${lang}: the top-up's buttons`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_topup.png` });
    // 2. a pack paid in the checkout's own tab
    const b0 = await dbl(p);
    const tabP = p.ctx.waitForEvent('page', { timeout: 30000 });
    await p.evaluate(() => document.querySelector('#modal-panel [data-pmyk="d290"]')?.click());
    const tab = await tabP;
    await tab.waitForLoadState('domcontentloaded');
    await L.sleep(800);
    await tab.screenshot({ path: `${OUT}/${W}x${H}_${lang}_checkout.png` });
    L.log(`${lang} checkout tab: ${tab.url()}`);
    if (!/\/api\/site\/pay\/test\?order=[0-9a-f]{24}$/.test(tab.url())) fail(`${lang}: the checkout's page`);
    const closed = tab.waitForEvent('close', { timeout: 20000 }).then(() => true, () => false);
    await tab.evaluate(() => document.querySelector('button[value="pay"]')?.click());
    await tab.waitForURL(/\/api\/site\/pay\/back\?order=/, { timeout: 20000 }).catch(() => {});
    if (!tab.isClosed()) await tab.screenshot({ path: `${OUT}/${W}x${H}_${lang}_back.png` }).catch(() => {});
    L.log(`${lang} the back page closed itself: ${await closed}`);
    if (!(await closed)) fail(`${lang}: the back page did not close`);
    await L.sleep(2500);
    const b1 = await dbl(p);
    L.log(`${lang} doubloons ${b0} → ${b1}`);
    if (!(b1 >= (b0 ?? 0) + 290)) fail(`${lang}: no doubloons`);
    // 3. a Buy short of doubloons: the question, the checkout, the purchase by itself
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.shop(false));
    await L.sleep(1500);
    const pick = await p.evaluate((have) => {
      for (const e of document.querySelectorAll('#modal-panel [data-shbuy]:not([disabled])')) {
        const n = Number((e.closest('[data-price]')?.getAttribute('data-price')) ?? NaN);
        if (!Number.isFinite(n) || n > have) { e.setAttribute('data-qa-pick', '1'); return e.outerHTML.slice(0, 160); }
      }
      const any = document.querySelector('#modal-panel [data-shbuy]:not([disabled])');
      any?.setAttribute('data-qa-pick', '1');
      return any ? any.outerHTML.slice(0, 160) : null;
    }, b1 ?? 0);
    L.log(`${lang} buy: ${pick}`);
    if (pick) {
      // spend the doubloons first so the Buy is short of them
      if (b1 > 0) await L.say(p, `/doubloons -${b1}`);
      await L.sleep(1500);
      // (the window drawn again with the balance: the Buy found anew)
      await p.evaluate(() => document.querySelector('#modal-panel [data-shbuy="starter"], #modal-panel [data-shbuy]:not([disabled])')?.click());
      await L.sleep(1000);
      const q = await p.evaluate(() => document.querySelector('.confirm-panel, .k-sheet-root.k-open')?.textContent?.slice(0, 200) ?? null);
      L.log(`${lang} the question: ${q}`);
      await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_short.png` });
      const tab2P = p.ctx.waitForEvent('page', { timeout: 30000 }).catch(() => null);
      await p.evaluate(() => document.querySelector('[data-yes]')?.click());
      const tab2 = await tab2P;
      if (!tab2) fail(`${lang}: no checkout for the short Buy`);
      else {
        await tab2.waitForLoadState('domcontentloaded');
        await tab2.evaluate(() => document.querySelector('button[value="pay"]')?.click());
        await tab2.waitForEvent('close', { timeout: 20000 }).catch(() => {});
        await L.sleep(3000);
        const toasts = await p.evaluate(() => [...document.querySelectorAll('#toasts > .toast')].map((t) => t.textContent));
        L.log(`${lang} toasts: ${JSON.stringify(toasts)}`);
        await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_bought.png` });
        // (the starter kit is sold once: bought, its card is gone, and the balance spent again)
        const after = await p.evaluate(() => ({ starter: !!document.querySelector('#modal-panel [data-shbuy="starter"]'), dbl: globalThis.gravetide.state.doubloons }));
        L.log(`${lang} after: ${JSON.stringify(after)}`);
        if (after.starter || after.dbl !== 0) fail(`${lang}: the waiting purchase did not go`);
      }
    }
    if (p.errors.length) L.log(`${lang} page errors: ${p.errors.slice(0, 5).join(' | ')}`);
    await p.ctx.close();
  }
  // 4. Telegram's and VK's pages: no YooKassa (their own payments)
  for (const cls of ['tg-app', 'vk-app']) {
    const p = await L.page(b, [W, H], { lang: 'ru' });
    await p.ctx.addInitScript((c) => addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(c)), cls);
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.shop(true));
    await L.sleep(1500);
    const v = await p.evaluate(() => ({ yk: document.querySelectorAll('[data-pmyk]').length, text: /ЮKassa|YooKassa/.test(document.body.textContent ?? ''), stars: document.querySelectorAll('#modal-panel [data-pmpack]').length, vk: document.querySelectorAll('#modal-panel [data-pmvk]').length }));
    L.log(`${cls}: ${JSON.stringify(v)}`);
    if (v.yk || v.text) fail(`${cls}: YooKassa shown`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_ru_${cls}_topup.png` });
    await p.ctx.close();
  }
} finally {
  await b.close();
}
L.log(`${bad} failed`);
process.exit(bad ? 1 : 0);
