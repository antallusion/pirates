// Is the sea's offer chip there for a fresh captain, and if not, why (the view, the cards for the sea, its place).
import * as L from '../m0/lib.mjs';
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const b = await L.browser();
const lang = process.env.LANG2 ?? 'ru', tg = Number(process.env.TG ?? 0);
const p = await L.page(b, [W, H], { lang, touch: W < 1000 });
if (tg) await p.ctx.addInitScript((t) => addEventListener('DOMContentLoaded', () => { document.documentElement.classList.add('tg-app'); document.documentElement.style.setProperty('--sa-t', `${t}px`); }), tg);
if (process.env.URL) {
  // the live site: a fresh guest captain (its own name), «I know the sea» ticked
  await p.goto(process.env.URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
  await p.fill('#login-name', 'Qa ' + Math.random().toString(36).slice(2, 7));
  await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
  await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 90000 });
  await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
  await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); document.getElementById('pick-captain')?.click(); });
  for (let i = 0; i < 40 && !(await p.$('#hud:not(.hidden)')); i++) { await p.mouse.click(10, 10).catch(() => {}); await L.sleep(500); }
  await L.sleep(2000);
} else { await L.login(p, { port: Number(process.env.GPORT ?? 58994), know: true }); if (process.env.ISLE) await L.say(p, '/isle'); }
await p.evaluate(() => globalThis.gravetide.net.send({ t: 'undock' }));
await L.sleep(3000);
for (let i = 0; i < 3; i++) { await p.evaluate(() => { globalThis.gravetide.open(null); document.getElementById('promo-over')?.querySelector('[data-polater]')?.click(); for (const x of document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x')) x.click(); }); await L.sleep(400); }
await L.sleep(2000);
const r = await p.evaluate(() => {
  const g = globalThis.gravetide, pr = g.promos;
  const el = document.getElementById('promo-sea');
  const R = (e) => { const r = e?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; };
  return { rect: R(el), row: ['tc-menu', 'tc-news', 'tc-isle', 'chat-toggle'].map((i) => R(document.getElementById(i))), cards: pr.view?.cards.map((c) => `${c.id}:${c.ctx}:${c.offer}:${c.price}/${c.was} -${c.off}% why=${c.why} closed=${c.closed}`), sea: pr.cardsFor('sea').map((c) => c.id), chip: el ? { cls: el.className, top: el.style.top, h: el.offsetHeight, html: el.innerHTML.slice(0, 120) } : null, modal: g.modal(), docked: g.state.self?.dockedAt ?? null, onb: g.state.onboarding?.stage ?? null };
});
console.log(JSON.stringify(r, null, 1));
const tag = `${W}x${H}_${lang}${tg ? '_tg' + tg : ''}`;
await p.screenshot({ path: `${process.env.OUT ?? 'assets/raw/audit/promo'}/chip_${tag}.png` });
await p.evaluate(() => document.querySelector('#promo-sea [data-poopen]')?.click());
await L.sleep(800);
await p.screenshot({ path: `${process.env.OUT ?? 'assets/raw/audit/promo'}/card_${tag}.png` });
await b.close();
