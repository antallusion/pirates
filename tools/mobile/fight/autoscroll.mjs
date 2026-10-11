// «Свиток автобоя» (owner, 2026-10-11: «автобой в абордаже только специальной премиум свитками, которую можно за дублоны
// купить»; docs/25 §5): a boarding without scrolls — «Авто» locked with the price; «Купить» opens the shop at its scrolls;
// a pack bought with the admin's doubloons; back in the battle «Авто» wears the count, and «Авто» given spends one.
// Each step measured (inside the screen, words whole) and shot.
//
//   GPORT=58991 SIZE=844x390 LANG2=ru OUT=docs/img/autoscroll node tools/mobile/fight/autoscroll.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'docs/img/autoscroll';
mkdirSync(OUT, { recursive: true });
const tag = `${W}x${H}_${lang}`;
const sleep = L.sleep;

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const view = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; return t ? { round: t.round, over: t.over, mine: !!t.mine, scrolls: t.scrolls ?? null, auto: t.heroes[t.you].auto } : null; });
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
const shot = (name) => p.screenshot({ path: `${OUT}/${tag}_${name}.png` });

/** What stands where: the «Авто» button (its badge), the «Купить», the wheel's choices, the shop's cards — inside the
 *  screen, their words whole. */
const measure = () => p.evaluate(() => {
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), text: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 80), cut: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 } };
  const all = (sel) => [...document.querySelectorAll(sel)].filter(shown).map(R);
  const out = { auto: all('[data-autow], .tb-acts [data-a="auto"], .tb-acts .btn.locked'), buy: all('.tb-scbuy'), badge: all('.tb-scn, .tb-lock, .tb-scp'), wheel: all('.k-wheel-item'), cards: all('.pm-scroll'), have: all('.pm-sc-have') };
  const inside = (r) => r.l >= 0 && r.t >= 0 && r.r <= innerWidth && r.b <= innerHeight;
  out.outside = [...out.auto, ...out.buy, ...out.badge, ...out.wheel].filter((r) => !inside(r)).map((r) => r.text);
  out.cut = [...out.buy, ...out.cards.map((c) => c)].filter((r) => r.cut).map((r) => r.text);
  return out;
});

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
await L.login(p, { port: Number(process.env.GPORT ?? 58991), name: (lang === 'ru' ? 'Свиток' : 'Scroll') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true });
await skip();
await p.evaluate(() => document.body.classList.add('reduce-motion'));
await say('/level 30');
await say('/ship brig', 1500);
await say('/army level 6');
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
for (let i = 0; i < 4; i++) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
  await sleep(300);
}
await L.closeAll(p, 2);
await sleep(4000);
await say(`/board ${process.env.FOE ?? 'pirate brig 70'}`, 1500);
const v0 = await waitFor(async () => { await skip(); return view(); });
if (!v0) { console.log('no battle'); await b.close(); process.exit(1); }
await waitFor(async () => { await skip(); const v = await view(); return v && (v.mine || v.over); }, 25000);
await sleep(1200);
await skip();
const rec = { tag, steps: {} };

// 1. No scroll: «Авто» locked with the price.
rec.steps.locked = { view: await view(), m: await measure() };
await shot('1_locked');
// The wheel (a phone) — or the desk's bar — offers «Купить свитки».
if (touch) {
  await p.evaluate(() => document.querySelector('[data-autow]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.evaluate(() => document.querySelector('[data-autow]')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await p.evaluate(() => document.querySelector('[data-autow]')?.click());
  await waitFor(() => p.evaluate(() => document.querySelectorAll('.k-wheel-item').length > 0), 4000, 150);
  await sleep(400);
  rec.steps.wheel = await measure();
  await shot('2_wheel');
}
// A refused «Авто» (the server's word, as a key press would send it).
await L.send(p, { t: 'tac', act: { a: 'auto', on: true } });
await sleep(700);
rec.steps.refused = await view();
// 2. Doubloons from the admin's console, then «Купить»: the shop at its scrolls.
await say('/doubloons 300', 1200);
if (touch) {
  // Choose «Купить свитки» on the wheel.
  const picked = await p.evaluate(() => {
    const it = [...document.querySelectorAll('.k-wheel-item')].find((e) => /Купить|Buy/.test(e.textContent));
    if (!it) return false;
    const r = it.getBoundingClientRect();
    const ev = (t) => new PointerEvent(t, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    window.dispatchEvent(ev('pointerdown'));
    return true;
  });
  rec.steps.wheelBuy = picked;
  await sleep(600);
} else {
  await p.evaluate(() => document.querySelector('.tb-scbuy')?.click());
  await sleep(600);
}
const shopOpen = await waitFor(() => p.evaluate(() => !!document.querySelector('#modal-panel[data-modal="shop"] .pm-scroll')), 6000, 200);
if (!shopOpen) await p.evaluate(() => dispatchEvent(new CustomEvent('gravetide:shop', { detail: 'scrolls' })));
await waitFor(() => p.evaluate(() => !!document.querySelector('#modal-panel .pm-scroll')), 6000, 200);
await sleep(500);
rec.steps.shop = { opened: !!shopOpen, m: await measure() };
await shot('3_shop');
// 3. Buy five: the confirm, then yes.
await p.evaluate(() => document.querySelector('[data-pmscroll="scroll5"]')?.click());
await waitFor(() => p.evaluate(() => !!document.querySelector('#confirm [data-yes]')), 4000, 150);
await sleep(300);
await shot('4_confirm');
await p.evaluate(() => document.querySelector('#confirm [data-yes]')?.click());
await waitFor(async () => (await view())?.scrolls?.n === 5, 6000, 200);
await sleep(600);
rec.steps.bought = { view: await view(), doubloons: await p.evaluate(() => globalThis.gravetide.state.doubloons), m: await measure() };
await shot('5_bought_shop');
// Back to the battle.
await p.evaluate(() => globalThis.gravetide.open(null));
await sleep(800);
await waitFor(async () => { const v = await view(); return v && (v.mine || v.over); }, 15000);
rec.steps.count = { view: await view(), m: await measure() };
await shot('6_count');
// 4. «Авто»: one scroll spent.
if (touch) {
  await p.evaluate(() => document.querySelector('[data-autow]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.evaluate(() => document.querySelector('[data-autow]')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await p.evaluate(() => document.querySelector('[data-autow]')?.click());
  await waitFor(() => p.evaluate(() => document.querySelectorAll('.k-wheel-item').length > 0), 4000, 150);
  await sleep(300);
  await shot('7_wheel_auto');
  await p.evaluate(() => {
    const it = [...document.querySelectorAll('.k-wheel-item')].find((e) => /Авто до конца|Auto to the end/.test(e.textContent));
    if (!it) return;
    const r = it.getBoundingClientRect();
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  });
} else {
  await p.evaluate(() => document.querySelector('.tb-acts [data-a="auto"]')?.click());
}
await waitFor(async () => (await view())?.scrolls?.paid === true, 6000, 200);
await sleep(800);
rec.steps.auto = { view: await view(), scrolls: await p.evaluate(() => globalThis.gravetide.state.scrolls), m: await measure() };
await shot('8_auto');
rec.errors = p.errors;
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rec, null, 1));
const s = rec.steps;
console.log(JSON.stringify({ tag, locked: s.locked.view?.scrolls, refusedAuto: s.refused?.auto, shopOpened: s.shop.opened, bought: s.bought.view?.scrolls, dbl: s.bought.doubloons, autoOn: s.auto.view?.auto, after: s.auto.view?.scrolls, outside: [s.locked.m.outside, s.wheel?.outside, s.count.m.outside], cut: s.shop.m.cut, errors: p.errors.length }));
await b.close();
