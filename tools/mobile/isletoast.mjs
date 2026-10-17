// The island scene's toasts against its open sheets (coordinator, 2026-10-17): every side sheet and the building card at
// each size, a long toast up, the two boxes measured; a shot of each.
//   GPORT=58981 OUT=docs/img/isleplan SIZE=844x390,480x270,1440x900 node tools/mobile/isletoast.mjs
import { browser, page, login, say, open, closeAll, sleep } from './m0/lib.mjs';
import { mkdirSync } from 'node:fs';
const port = Number(process.env.GPORT ?? 58981);
const OUT = process.env.OUT ?? 'docs/img/isleplan';
const sizes = (process.env.SIZE ?? '844x390').split(',').map((s) => s.split('x').map(Number));
mkdirSync(OUT, { recursive: true });
const b = await browser();
let bad = 0;
try {
  for (const [W, H] of sizes) {
    const p = await page(b, [W, H], { lang: 'ru' });
    await p.ctx.addInitScript(() => { try { localStorage.setItem('gravetide.helpSeen', '1'); } catch {} document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#promo-over{display:none!important}'; document.head.append(st); }); });
    await login(p, { port, know: true, name: `Toast ${W}${Math.random().toString(36).slice(2, 4)}` });
    await say(p, '/isle 2');
    await say(p, '/gift claim');
    await sleep(1500);
    await closeAll(p);
    await open(p, 'base');
    for (let t = 0; t < 60 && !(await p.evaluate(() => !!document.querySelector('#isle .is-rec:not(.hidden)'))); t++) await sleep(300);
    await sleep(2000);
    const sheets = {
      advice: () => p.evaluate(() => document.querySelector('#isle .is-rec')?.click()),
      building: () => p.evaluate(() => { const a = globalThis.gravetide.isle.probe('t:hall').at; const v = document.querySelector('#isle .is-view'); for (const t of ['pointerdown', 'pointerup']) v.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: a.x, clientY: a.y, pointerId: 1, button: 0, pointerType: 'mouse' })); v.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: a.x, clientY: a.y })); }),
      ships: () => p.evaluate(() => document.querySelector('#isle [data-iside="yard"]')?.click()),
      town: () => p.evaluate(() => document.querySelector('#isle [data-iside="town"]')?.click()),
      supply: () => p.evaluate(() => document.querySelector('#isle [data-iside="supply"]')?.click()),
    };
    for (const [id, go] of Object.entries(sheets)) {
      await p.evaluate(() => document.querySelector('#isle .is-card:not(.hidden) [data-ix]')?.click());
      await sleep(400);
      await go();
      await sleep(1200);
      await p.evaluate(() => globalThis.gravetide.hud.toast('Логово «Крабовый пляж» разбито: 310 серебра и трофеи суши.', 'gold'));
      await sleep(900);
      const r = await p.evaluate(() => {
        const R = (e) => e.getBoundingClientRect();
        const card = document.querySelector('#isle .is-card:not(.hidden)');
        const ts = [...document.querySelectorAll('#toasts > .toast')].filter((e) => R(e).width > 0);
        if (!card) return { card: false, toasts: ts.length };
        const c = R(card);
        const hit = ts.filter((e) => { const t = R(e); return t.left < c.right && c.left < t.right && t.top < c.bottom && c.top < t.bottom; }).length;
        const side = R(document.querySelector('#isle .is-side'));
        const hitSide = ts.filter((e) => { const t = R(e); return t.left < side.right && t.top < side.bottom && side.top < t.bottom; }).length;
        return { card: true, toasts: ts.length, overCard: hit, overSide: hitSide, toast: ts[0] ? [Math.round(R(ts[0]).left), Math.round(R(ts[0]).right), Math.round(R(ts[0]).height)] : null, cardL: Math.round(c.left) };
      });
      if (!r.card || r.overCard || r.overSide || !r.toasts) bad++;
      console.log(`${W}x${H} ${id}:`, JSON.stringify(r));
      await p.screenshot({ path: `${OUT}/toast-${W}x${H}-${id}.png` });
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
console.log('bad', bad);
