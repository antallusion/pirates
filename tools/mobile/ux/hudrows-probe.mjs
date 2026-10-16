// The sea HUD of 2026-10-16 at work (owner: «справа два и слева два под аватаркой … спецпредложения … иконкой под
// аватаркой с обратным отсчетом. в таверне прям в интерфейсе ниче не надо продавать … на мобиле нужна кнопка сбавить и
// добавить скорость»): the sail's «+» «−» step the sail and send the helm's own input; the offer's icon opens its
// cards (swipe, ✕ one by one); the harbour sells nothing in its window and shows the icon on its HUD; a fight hides it.
//   GPORT=58986 SIZE=844x390 TG=25 OUT=assets/raw/audit/hudrows node tools/mobile/ux/hudrows-probe.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru', tg = Number(process.env.TG ?? 0);
const OUT = process.env.OUT ?? 'assets/raw/audit/hudrows';
mkdirSync(OUT, { recursive: true });
const tag = `${W}x${H}_${lang}${tg ? '_tg' + tg : ''}`;
const b = await L.browser();
let fails = 0;
const check = (ok, what) => { if (!ok) fails++; L.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
try {
  const p = await L.page(b, [W, H], { lang, touch: true });
  if (tg) await p.ctx.addInitScript((t) => addEventListener('DOMContentLoaded', () => { document.documentElement.classList.add('tg-app'); document.documentElement.style.setProperty('--sa-t', `${t}px`); document.documentElement.style.setProperty('--tg-top', `${t}px`); }), tg);
  await L.login(p, { port: Number(process.env.GPORT ?? 58986), know: true });
  await L.say(p, '/god');
  await L.say(p, '/offers roll');
  await L.say(p, '/noboard on');
  // the outgoing messages, to see the helm's input go
  await p.evaluate(() => { const n = globalThis.gravetide.net, send = n.send.bind(n); globalThis.__sent = []; n.send = (m) => { globalThis.__sent.push(m); return send(m); }; });
  const icon = () => p.evaluate(() => { const e = document.getElementById('tc-offer'); const r = e?.getBoundingClientRect(); return e && !e.classList.contains('hidden') && r.width ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), n: Number(e.querySelector('.k-badge')?.textContent ?? 1), clock: e.querySelector('.tc-offer-t')?.textContent ?? '', urgent: !!e.querySelector('.tc-offer-t.urgent') } : null; });
  await p.evaluate(() => document.querySelector('#promo-over [data-polater]')?.click()); // (the day's carousel)
  await L.sleep(400);
  // ---- the harbour: nothing sold in its window, the icon on its HUD
  // (she comes into the game in a harbour)
  check(await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt), 'in a harbour');
  await L.open(p, 'port');
  await L.sleep(2200); // (the offers' places are looked at once a second)
  const port = await p.evaluate(() => { const m = document.querySelector('#modal-panel[data-modal="port"]'); return m && { slot: !!m.querySelector('.promo-port-slot, .po-chip'), shop: !!m.querySelector('[data-ptab="pshop"]'), icon: !document.getElementById('tc-offer')?.classList.contains('hidden') }; });
  check(!!port && !port.slot && !port.shop && !port.icon, `the harbour's window: ${JSON.stringify(port)}`);
  await p.screenshot({ path: `${OUT}/port_${tag}.png` });
  await L.closeAll(p, 2);
  await L.sleep(1200);
  const i3 = await icon();
  const why = i3 ? '' : await p.evaluate(() => { const g = globalThis.gravetide; return JSON.stringify({ modal: g.modal(), docked: g.state.self?.dockedAt, hud: document.getElementById('hud').className, tac: document.body.classList.contains('tac'), isle: document.getElementById('isle')?.className, onb: g.state.onboarding?.stage ?? null, board: !!g.state.boardTac, cards: g.promos.cardsFor('sea').length, over: !!document.getElementById('promo-over') }); });
  check(!!i3, `the harbour's HUD: the icon ${JSON.stringify(i3)} ${why}`);
  await p.screenshot({ path: `${OUT}/port-hud_${tag}.png` });
  await L.send(p, { t: 'undock' });
  await L.sleep(3000);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelector('#promo-over [data-polater]')?.click(); }); await L.sleep(400); }

  // ---- the sail's «+» «−»
  const sail = () => p.evaluate(() => globalThis.gravetide.state.input.sail);
  const s0 = await sail();
  const box = await p.evaluate(() => { const r = document.getElementById('tc-sail')?.getBoundingClientRect(); const st = document.getElementById('tc-stick').getBoundingClientRect(); return r && { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), stickR: Math.round(st.right), stickB: Math.round(st.bottom), btn: Math.round(document.querySelector('#tc-sail button').getBoundingClientRect().width) }; });
  check(!!box && box.w >= 32 && box.btn >= 32, `«−» «+» beside the wheel ${JSON.stringify(box)}`);
  await p.evaluate(() => (globalThis.__sent.length = 0));
  await p.tap('#tc-sail [data-sail="1"]');
  await L.sleep(400);
  const s1 = await sail();
  const sent1 = await p.evaluate(() => globalThis.__sent.filter((m) => m.t === 'input').map((m) => m.sail));
  check(s1 === Math.min(4, s0 + 1) && sent1.includes(s1), `«+»: sail ${s0} → ${s1}, input sent ${JSON.stringify(sent1)}`);
  await p.tap('#tc-sail [data-sail="1"]');
  await L.sleep(300);
  await p.tap('#tc-sail [data-sail="-1"]');
  await L.sleep(400);
  const s2 = await sail();
  check(s2 === s1, `«+» then «−»: back to ${s2}`);
  for (let i = 0; i < 5 && !(await p.evaluate(() => document.querySelector('#tc-sail [data-sail="-1"]').disabled)); i++) { await p.tap('#tc-sail [data-sail="-1"]'); await L.sleep(150); }
  const s3 = await sail();
  const pips = await p.evaluate(() => [document.getElementById('tc-sail').dataset.sail, document.querySelector('#tc-sail [data-sail="-1"]').disabled, document.querySelector('#tc-sail [data-sail="-1"]').getAttribute('aria-label')]);
  check(s3 === 0 && pips[0] === '0' && pips[1] === true, `all the way down: sail ${s3}, pips ${pips[0]}, «−» shut, «${pips[2]}»`);
  for (let i = 0; i < 2; i++) { await p.tap('#tc-sail [data-sail="1"]'); await L.sleep(200); }
  await L.sleep(600);
  await p.screenshot({ path: `${OUT}/sea_${tag}.png` });

  // ---- the offer's icon and its cards
  const i0 = await icon();
  const plate = await p.evaluate(() => Math.round(document.querySelector('#hud-captain .cs').getBoundingClientRect().bottom));
  check(!!i0 && i0.t > plate && i0.l < W / 3 && /^\d+:\d\d(:\d\d)?$|\s/.test(i0.clock), `the icon under the plate (${plate}): ${JSON.stringify(i0)}`);
  const c1 = await p.evaluate(() => globalThis.gravetide.promos.cardsFor('sea').length);
  check(i0 && i0.n === Math.min(9, c1), `its count ${i0?.n} = the offers ${c1}`);
  await p.tap('#tc-offer');
  await L.sleep(700);
  const over = () => p.evaluate(() => { const o = document.getElementById('promo-over'); if (!o) return null; const dots = [...o.querySelectorAll('.po-dots > i')]; return { name: o.querySelector('.po-name')?.textContent, dots: dots.length, on: dots.findIndex((d) => d.classList.contains('on')), was: !!o.querySelector('.po-was'), buy: o.querySelector('[data-pobuy]')?.textContent.trim(), more: !!o.querySelector('[data-pomore]'), x: !!o.querySelector('[data-poshut]'), inside: o.querySelectorAll('.po-in li').length }; });
  const o1 = await over();
  check(!!o1 && o1.x && o1.dots === c1 && o1.on === 0, `the cards open: ${JSON.stringify(o1)}`);
  await p.screenshot({ path: `${OUT}/card_${tag}.png` });
  // a swipe to the next
  await p.evaluate(() => { const o = document.getElementById('promo-over'); const at = (type, x) => o.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 200, pointerType: 'touch' })); at('pointerdown', 600); at('pointerup', 420); });
  await L.sleep(400);
  const o2 = await over();
  check(o2 && o2.on === 1 && o2.name !== o1.name, `swiped: card ${o2?.on + 1} «${o2?.name}»`);
  // ✕ closes this one only; the others stay to swipe through, the icon's count one less
  await p.evaluate(() => document.querySelector('#promo-over [data-poshut]').click());
  await L.sleep(700);
  const o3 = await over();
  check(o3 && o3.dots === c1 - 1, `✕: that one closed, ${o3?.dots} left in the cards`);
  await p.evaluate(() => document.querySelector('#promo-over [data-polater]')?.click());
  await L.sleep(1200);
  const i1 = await icon();
  check(i1 && i1.n === Math.min(9, c1 - 1), `the icon's count ${i1?.n}`);

  // ---- its last hour: the clock in minutes and seconds, red (one card's end moved near, on this page only)
  await p.evaluate(() => { const pr = globalThis.gravetide.promos, v = pr.view; const id = pr.cardsFor('sea').find((x) => x.until)?.id; const c = v.cards.find((x) => x.id === id); if (c) c.until = v.now + 30 * 60_000; });
  await L.sleep(1500);
  const i4 = await icon();
  check(!!i4 && i4.urgent && /^(29|30):\d\d$/.test(i4.clock), `its last hour: ${JSON.stringify(i4)}`);
  await p.screenshot({ path: `${OUT}/urgent_${tag}.png` });

  // ---- a fight: the icon steps out
  await L.say(p, '/foe pirate brig 250 hunt');
  await L.sleep(2500);
  const busy = await p.evaluate(() => document.body.classList.contains('sea-fight'));
  const i2 = await icon();
  check(!i2, `a fight (${busy ? 'sea-fight' : 'no fight class'}): the icon ${i2 ? 'still there' : 'gone'}`);
  await p.screenshot({ path: `${OUT}/fight_${tag}.png` });

  if (p.errors.length) L.log('page errors: ' + p.errors.join(' | '));
  check(!p.errors.length, `no page errors (${p.errors.length})`);
} finally {
  await b.close();
}
L.log(`${fails} failures`);
process.exit(fails ? 1 : 0);
