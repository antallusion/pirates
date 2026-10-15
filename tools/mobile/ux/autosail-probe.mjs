// The autosail's line with a card on top: it stays in sight, under the card (2026-10-15).
import * as L from '../m0/lib.mjs';
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
await L.login(p, { port: 58994, know: true });
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
await L.sleep(2500);
await L.say(p, '/god');
await L.say(p, '/lair crab_beach go');
await L.sleep(2000);
for (let i = 0; i < 3; i++) { await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelector('#promo-over [data-polater]')?.click(); for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click(); }); await L.sleep(300); }
for (let i = 0; i < 10 && !(await p.$('#advcard:not(.hidden) .ac-card')); i++) { await p.evaluate(() => { for (const x of document.querySelectorAll('#touch button')) if (/Осмотреть/.test(x.textContent) && x.getBoundingClientRect().width) { x.click(); break; } }); await L.sleep(400); }
await p.evaluate(() => { const o = globalThis.gravetide.state.ownDisplay; globalThis.gravetide.net.send({ t: 'autosail', x: o.x + 4000, y: o.y + 3000 }); });
await L.sleep(1500);
await p.evaluate(() => document.querySelector('#promo-over [data-polater]')?.click());
await L.sleep(600);
const r = await p.evaluate(() => {
  const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { vis: getComputedStyle(e).visibility, cls: e.className, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const a = document.getElementById('hud-autosail'); const st = document.getElementById('hud-stack'); return { html: a.innerHTML.slice(0, 160), op: [getComputedStyle(a).opacity, getComputedStyle(st).opacity, getComputedStyle(st).overflow, getComputedStyle(st).clipPath, getComputedStyle(a).display], top: (() => { const e = document.elementFromPoint(400, 105); return e ? e.tagName + '#' + e.id + '.' + e.className + ' < ' + e.parentElement?.id : null; })(), chain: (() => { const out = []; for (let q = document.getElementById('hud-autosail'); q; q = q.parentElement) { const c = getComputedStyle(q); out.push(q.id + ':' + c.visibility + ':' + c.display + ':' + c.opacity + ':' + c.zIndex); } return out.join(' > '); })(), var: a.style.getPropertyValue('--as-shift'), tf: getComputedStyle(a).transform, as: R('#hud-autosail'), card: R('#advcard'), enc: R('#encounter'), toasts: R('#toasts') };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: `assets/raw/audit/promo/autosail_${W}x${H}.png` });

console.log(await p.evaluate(() => [...document.querySelectorAll('.k-scrim')].map((e) => getComputedStyle(e).opacity + ' ' + e.parentElement?.className).join('|')));
await b.close();
