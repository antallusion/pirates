// «Свиток автобоя» (docs/25 §5): the premium shop's «Свитки» tab on a size — its header row (the tabs beside the purse),
// the packs' cards — measured (what overlaps, what runs out) and shot.
//
//   GPORT=58991 SIZE=844x390 LANG2=ru OUT=docs/img/autoscroll node tools/mobile/fight/autoscroll-shop.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'docs/img/autoscroll';
mkdirSync(OUT, { recursive: true });
const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch: W < 1000 });
await L.login(p, { port: Number(process.env.GPORT ?? 58991), name: 'Shop' + Math.random().toString(36).slice(2, 6), know: true });
await L.closeAll(p, 2);
await L.say(p, '/doubloons 120');
await L.sleep(800);
await p.evaluate(() => dispatchEvent(new CustomEvent('gravetide:shop', { detail: 'scrolls' })));
await L.sleep(1500);
const m = await p.evaluate(() => {
  const R = (e) => { const r = e.getBoundingClientRect(); return { cls: e.className, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), text: e.textContent.trim().slice(0, 40) }; };
  const q = (s) => [...document.querySelectorAll(s)].map(R);
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const tabs = q('#modal-panel .tabs .tab'), purse = q('#modal-panel .pm-purse > *'), close = q('#modal-panel .modal-x, #modal-panel [data-close], #modal-close');
  return { tabs, purse, close, overlaps: tabs.filter((t) => [...purse, ...close].some((x) => hit(t, x))).map((t) => t.text), cards: q('.pm-scroll').length, outside: [...tabs, ...purse].filter((r) => r.r > innerWidth || r.l < 0).map((r) => r.text) };
});
console.log(JSON.stringify(m));
await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_shop_tab.png` });
// The locker (the gear's third place): her scrolls on top, «Купить» to the shop.
await L.say(p, '/scrolls 3');
await L.sleep(800);
await p.evaluate(() => globalThis.gravetide.open(null));
await L.sleep(400);
await p.evaluate(() => globalThis.gravetide.open('hero'));
await L.sleep(800);
await p.evaluate(() => document.querySelector('[data-ctab="gear"]')?.click());
await L.sleep(500);
await p.evaluate(() => document.querySelector('[data-cchip="locker"]')?.click());
await L.sleep(800);
const row = await p.evaluate(() => { const e = document.querySelector('.gr-scroll'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
console.log(JSON.stringify({ locker: row }));
await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_locker.png` });
await b.close();
