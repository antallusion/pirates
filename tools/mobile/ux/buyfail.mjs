// The honest refusals of a purchase and the «sell before you buy» advisor in the browser (owner, 2026-10-21), on a QA
// server with admin commands and the test checkout asking the receipt's e-mail:
//   PORT=58660 GRAVETIDE_ADMIN=1 GRAVETIDE_PAY_TEST=1 GRAVETIDE_PAY_TEST_RECEIPT=1 DB_PATH=data/qa-buyfail.db node server/src/main.ts
//   GPORT=58660 SIZE=844x390 LANG2=ru,en OUT=assets/raw/audit/buyfail node tools/mobile/ux/buyfail.mjs
// 1. a full hold buying rum: «Нет места в трюме: нужно 5 м³, свободно 0», the plan, «Продать и купить» (pressed: bought);
// 2. a good not sold here: the nearest ports and «Проложить курс»;
// 3. the top-up without an e-mail: the inline prompt (a bad address refused, a good one opens the payment).
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58660);
const OUT = process.env.OUT ?? 'assets/raw/audit/buyfail';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
const sheet = (p) => p.evaluate(() => {
  const r = document.querySelector('#buy-advice');
  if (!r) return null;
  const box = r.querySelector('.k-sheet')?.getBoundingClientRect();
  const over = [...r.querySelectorAll('button:not(.k-sheet-x), .w-row, p, h2')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || e.scrollWidth > e.clientWidth + 1); }).map((e) => `${e.className}:${e.textContent.trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().right)}x${Math.round(e.getBoundingClientRect().bottom)}/${e.scrollWidth}>${e.clientWidth}`);
  return { title: (r.querySelector('.k-sheet-title')?.textContent ?? '').replace(/\s+/g, ' '), text: r.querySelector('.k-sheet-body')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? '', btns: [...r.querySelectorAll('.k-sheet-foot button, .ba-row button')].map((x) => x.textContent.trim()), h: Math.round(box?.height ?? 0), over };
});
const view = (p) => p.evaluate(() => ({ market: globalThis.gravetide.state.portView?.market.map((r) => [r.good, r.stock]) ?? [], cargo: globalThis.gravetide.state.self?.cargo ?? {}, docked: globalThis.gravetide.state.self?.dockedAt }));
try {
  for (const lang of langs) {
    const p = await L.page(b, [W, H], { lang });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.say(p, '/silver 200000');
    await L.sleep(800);
    await L.open(p, 'port');
    await L.sleep(1500);
    let v = await view(p);
    L.log(`${lang} docked ${v.docked}, market ${v.market.length}`);
    // 1. fill the hold with a bulky good of the market (not rum), then buy rum
    const goods = v.market.map((r) => r[0]);
    const filler = ['tobacco', 'spices', 'cloth', 'salt', 'iron'].find((g) => goods.includes(g)) ?? 'tobacco'; // (a m³ a unit)
    // (the hold filled to its last m³, not past it)
    const room = await p.evaluate(() => { const s = globalThis.gravetide.state; const st = s.ownStats; let used = 0; for (const [g, n] of Object.entries(s.self.cargo)) used += n * (g === 'provisions' ? st.provisionVolumeMul : g === 'planks' || g === 'sailcloth' ? st.materialVolumeMul : 1) * ({ planks: 1.5, timber: 2 }[g] ?? 1); return Math.floor(st.holdVolume - used); });
    L.log(`${lang} filling ${room} m³ with ${filler}`);
    await L.say(p, `/give ${filler} ${room}`);
    await L.sleep(1200);
    await L.closeAll(p);
    await L.open(p, 'port');
    await L.sleep(1200);
    await L.send(p, { t: 'trade', good: 'rum', qty: 5 });
    await L.sleep(1500);
    let s = await sheet(p);
    L.log(`${lang} rum, full hold: ${JSON.stringify(s)}`);
    if (!s || !/(Нет места в трюме|No room in the hold)/.test(s.title)) fail(`${lang}: the full hold's advisor`);
    if (s && /(склад|stock)/i.test(s.text)) fail(`${lang}: «stock» said for a full hold`);
    if (s?.over.length) fail(`${lang}: overflow ${s.over}`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_rum_advisor.png` });
    // the one tap: sold and bought
    const rum0 = (await view(p)).cargo.rum ?? 0;
    await p.evaluate(() => document.querySelector('#buy-advice #ba-go')?.click());
    await L.sleep(1800);
    const rum1 = (await view(p)).cargo.rum ?? 0;
    L.log(`${lang} «Продать и купить»: rum ${rum0} → ${rum1}`);
    if (rum1 !== rum0 + 5) fail(`${lang}: sell-and-buy did not buy`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_rum_bought.png` });
    // 2. a good not sold here
    v = await view(p);
    const ALL = ['rum', 'sugar', 'tobacco', 'timber', 'iron', 'coal', 'gunpowder', 'cloth', 'spices', 'medicine', 'weapons', 'whale_oil', 'salt', 'pearls', 'tar', 'smoked_fish', 'scrimshaw', 'baleen', 'ambergris', 'whalebone', 'shark_skin', 'salted_fish', 'prime_fish', 'abyssal_ore', 'leviathan_bone'];
    const here = new Set(v.market.map((r) => r[0]));
    const missing = ALL.find((g) => !here.has(g));
    L.log(`${lang} not sold here: ${missing}`);
    if (missing) {
      await L.send(p, { t: 'trade', good: missing, qty: 5 });
      await L.sleep(1500);
      s = await sheet(p);
      L.log(`${lang} not sold: ${JSON.stringify(s)}`);
      if (!s || !s.btns.some((x) => /(Проложить курс|Set course)/.test(x))) fail(`${lang}: no course button`);
      if (s?.over.length) fail(`${lang}: overflow ${s.over}`);
      await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_notsold.png` });
      await p.evaluate(() => document.querySelector('#buy-advice [data-ba="close"]')?.click());
      await L.sleep(500);
    }
    // 3. the top-up without an e-mail: the inline prompt
    await L.closeAll(p);
    await p.evaluate(() => globalThis.gravetide.shop(true));
    await L.sleep(1500);
    await p.evaluate(() => document.querySelector('#modal-panel [data-pmyk="d290"]')?.click());
    await L.sleep(1500);
    const mail = await p.evaluate(() => ({ up: !!document.querySelector('#yk-mail [data-ykmail]'), text: document.querySelector('#yk-mail')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? '' }));
    L.log(`${lang} e-mail prompt: ${JSON.stringify(mail)}`);
    if (!mail.up) fail(`${lang}: no e-mail prompt`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_email.png` });
    await p.fill('#yk-mail [data-ykmail]', 'not-a-mail');
    await p.evaluate(() => document.querySelector('#yk-mail [data-ykgo]')?.click());
    await L.sleep(500);
    const badShown = await p.evaluate(() => !document.querySelector('#yk-mail .yk-mail-bad')?.classList.contains('hidden'));
    if (!badShown) fail(`${lang}: a bad e-mail not refused`);
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_email_bad.png` });
    await p.fill('#yk-mail [data-ykmail]', 'qa@example.com');
    const tabP = p.ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null);
    await p.evaluate(() => document.querySelector('#yk-mail [data-ykgo]')?.click());
    const tab = await tabP;
    L.log(`${lang} payment page: ${tab ? tab.url() : 'none'}`);
    if (!tab || !/\/api\/site\/pay\/test\?order=/.test(tab.url())) fail(`${lang}: the payment did not open with the e-mail`);
    if (tab) await tab.close();
    const words = lang === 'ru' ? await L.latin(p, '#yk-mail') : [];
    if (words.length) L.log(`${lang} latin: ${words}`);
    L.log(`${lang} errors: ${p.errors.slice(0, 5).join(' | ') || 'none'}`);
    await p.ctx.close();
  }
} finally {
  await b.close();
}
L.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exit(bad ? 1 : 0);
