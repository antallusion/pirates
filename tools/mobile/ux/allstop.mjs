// Owner, 2026-10-22 (server allstop.ts): «я могу доплыть до сражения с нпс, начать битву … победить и мой корабль после
// того как окно закроется победное — продолжает плыть». In the Telegram layout (TG=46) on a phone on its side, RU: she
// sails under canvas to a creature stack half a kilometre off, «Атаковать», the battle on the hexes won at once, its
// card closed — and the ship stands: her sail control at nothing, no way on her for 20 s, no helmsman's course. Then her
// own hand sets sail and she goes. Screenshots at each moment; exit code 1 on any problem.
//   GPORT=58617 SIZE=844x390 TG=46 OUT=assets/raw/audit/allstop node tools/mobile/ux/allstop.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const port = Number(process.env.GPORT ?? 58617);
const tg = Number(process.env.TG ?? 46);
const lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/allstop';
mkdirSync(OUT, { recursive: true });
// (the offers' card that may come up over the sea — promo.ts — put away first: the shot is of the sea)
const shot = async (p, n) => {
  await p.evaluate(() => document.querySelectorAll('#promo-over [data-polater]').forEach((b) => b.click()));
  await L.sleep(300);
  return p.screenshot({ path: `${OUT}/${W}x${H}_${lang}${tg ? '_tg' : ''}_${n}.png` });
};
const look = (p) => p.evaluate(() => {
  const s = globalThis.gravetide.state;
  return { spd: Math.round((s.you?.spd ?? 0) * 100) / 100, sail: s.input.sail, auto: !!s.autosail, x: Math.round(s.ownDisplay?.x ?? 0), y: Math.round(s.ownDisplay?.y ?? 0), tac: !!s.boardTac };
});

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
try {
  const p = await L.page(b, [W, H], { lang, touch: true });
  if (tg) await p.ctx.addInitScript((t) => {
    addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('tg-app');
      const r = document.documentElement.style;
      r.setProperty('--sa-t', `${t}px`);
      r.setProperty('--tg-top', `${t}px`);
    });
  }, tg);
  await L.login(p, { port, know: true });
  await L.closeAll(p);
  await L.send(p, { t: 'undock' });
  await L.sleep(3000);
  await L.closeAll(p);
  for (const c of ['/level 30', '/god', '/heal', '/army clear', '/army marine 40', '/army musketeer 20', '/noboard on', '/scrolls 20']) { await L.say(p, c); await L.sleep(400); }
  await L.say(p, '/tp 21000 70000');
  await L.sleep(2500);
  await L.closeAll(p);
  await L.say(p, '/stack go');
  await L.sleep(2000);
  const st = await p.evaluate(() => { const s = globalThis.gravetide.state; const o = s.ownDisplay; return s.roams.map((r) => ({ id: r.id, x: r.x, y: r.y, d: Math.hypot(r.x - o.x, r.y - o.y) })).sort((a, b) => a.d - b.d)[0]; });
  if (!st) throw new Error('no stack');
  // half a kilometre off it, then under sail (the phone's own sail control, three steps up)
  await L.say(p, `/tp ${Math.round(st.x)} ${Math.round(st.y + 520)}`);
  await L.sleep(2500);
  await L.closeAll(p);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 3; });
  await L.sleep(5000);
  const sailing = await look(p);
  L.log('sailing', JSON.stringify(sailing));
  await shot(p, '1_sailing');
  if (sailing.spd < 1) fail(`not under way before the stack (${sailing.spd})`);
  // «Атаковать» on the stack: the helmsman sails her in, the boats go a cable off it
  await L.send(p, { t: 'attack', roam: st.id });
  for (let i = 0; i < 120 && !(await p.evaluate(() => document.body.classList.contains('tac'))); i++) await L.sleep(500);
  await L.sleep(2500);
  await shot(p, '2_battle');
  if (!(await p.evaluate(() => document.body.classList.contains('tac')))) fail('no battle');
  await L.send(p, { t: 'tac', act: { a: 'quick' } });
  let ok = false;
  for (let i = 0; i < 40 && !(ok = await p.evaluate(() => !!document.querySelector('#board-tac .tb-end [data-endbtn]')?.getBoundingClientRect().width)); i++) await L.sleep(500);
  await L.sleep(1500);
  await p.evaluate(() => document.querySelector('#promo-over:not(.hidden) [data-polater]')?.click());
  await shot(p, '3_won');
  if (!ok) fail('no reckoning card');
  // the card closed, as her finger does
  await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click());
  await L.sleep(1500);
  await L.closeAll(p, 2);
  const at0 = await look(p);
  await shot(p, '4_closed');
  L.log('closed', JSON.stringify(at0));
  if (at0.sail !== 0) fail(`her sail control not down (${at0.sail})`);
  let maxSpd = 0;
  for (let i = 0; i < 20; i++) {
    await L.sleep(1000);
    const v = await look(p);
    if (i >= 8) maxSpd = Math.max(maxSpd, v.spd);
    if (v.auto) fail('a helmsman\'s course after the battle');
  }
  const at1 = await look(p);
  await shot(p, '5_still_20s');
  const moved = Math.hypot(at1.x - at0.x, at1.y - at0.y);
  L.log('20 s on', JSON.stringify(at1), `moved ${Math.round(moved)} m, way after 8 s at most ${maxSpd}`);
  if (maxSpd > 0.15) fail(`way on her after the card closed (${maxSpd})`);
  if (at1.sail !== 0) fail(`her sail control raised by itself (${at1.sail})`);
  // her own hand: sail up, she goes
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 2; });
  await L.sleep(6000);
  const go = await look(p);
  await shot(p, '6_her_sail');
  L.log('her sail', JSON.stringify(go));
  if (go.spd < 0.5) fail(`her own sail did not take her on (${go.spd})`);
  if (p.errors.length) L.log('page errors:', p.errors.slice(0, 5).join(' | '));
  await p.ctx.close();
} finally {
  await b.close();
}
L.log(bad ? `${bad} problem(s)` : 'all well');
process.exit(bad ? 1 : 0);
