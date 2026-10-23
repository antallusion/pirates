// Owner, 2026-10-23, the browser check of two fixes in the Telegram layout on a phone on its side:
//  1) tattoos in ANY port: the Rose (earned, waiting for Old Needle) set in a harbour that is not the Brethren's — by
//     a tap on a «+» place and the picker, then (moved) by holding the card and dragging it onto another place;
//  2) «Колокольчик на ручке»: the campaign's «ask along the quays» come while she lies in that very port — the harbour
//     opens on «Задания» with its «Расспросить», the finger on it; pressed, the step is done; the journal shows the
//     verb, not «Плыть».
// Screenshots at each moment; exit code 1 on any problem.
//   GPORT=58611 SIZE=1093x481 TG=46 LANG2=ru OUT=assets/raw/audit/boardfix node tools/mobile/ux/boardfix.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '1093x481').split('x').map(Number);
const port = Number(process.env.GPORT ?? 58611);
const tg = Number(process.env.TG ?? 46);
const lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/boardfix';
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/${W}x${H}_${lang}${tg ? '_tg' : ''}_${n}.png` });

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
/** The campaign's prologue and other sheets put away (they lie over the window with their scrim). */
const sheets = async (p) => { for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelectorAll('.k-sheet-root [data-lore-go], .k-sheet-root .k-sheet-x, #promo-over [data-polater]').forEach((b) => b.click())); await L.sleep(300); } };
const tat = (p) => p.evaluate(() => globalThis.gravetide.state.tattoos);
const self = (p) => p.evaluate(() => { const s = globalThis.gravetide.state.self; return { docked: s.dockedAt, at: s.campaign?.at, quests: s.quests.map((q) => ({ id: q.id, name: q.name, kind: q.kind, step: q.step, act: q.act ?? null })) }; });
try {
  const p = await L.page(b, [W, H], { lang, touch: true });
  if (tg) await p.ctx.addInitScript((t) => {
    addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('tg-app');
      document.documentElement.style.setProperty('--sa-t', `${t}px`);
      document.documentElement.style.setProperty('--tg-top', `${t}px`);
    });
  }, tg);
  await L.login(p, { port, know: true });
  await L.closeAll(p);
  // ---- 2) the Bell: the campaign set at it, its port found, then the quest come anew while she lies there
  await L.say(p, '/camp ch 1');
  await L.sleep(1200);
  let bell = null;
  for (let i = 0; i < 25 && !bell; i++) {
    const v = await self(p);
    bell = v.quests.find((q) => q.kind === 'campaign' && q.name === 'A Bell on the Handle') ?? null;
    if (!bell) { await L.say(p, '/camp done'); await L.sleep(700); }
  }
  if (!bell?.act?.port) throw new Error('the Bell never came: ' + JSON.stringify(await self(p)));
  const at = (await self(p)).at;
  L.log('bell', JSON.stringify(bell), 'slot', at);
  await L.closeAll(p);
  await L.say(p, `/tp ${bell.act.port}`);
  await L.sleep(2000);
  await L.send(p, { t: 'dock' });
  for (let i = 0; i < 20 && !(await self(p)).docked; i++) await L.sleep(500);
  await L.closeAll(p);
  // the owner's case: the quest comes while she lies in its port (the arrival is behind her)
  await L.say(p, `/camp slot ${at}`);
  await L.sleep(1500);
  await sheets(p);
  const b1 = (await self(p)).quests.find((q) => q.name === 'A Bell on the Handle');
  L.log('bell now', JSON.stringify(b1));
  if (!b1 || b1.step !== 1) fail('the Bell not at its first step in port');
  await L.open(p, 'port');
  await L.sleep(1500);
  // (the window was open on another page when the quest came: the finger on «Задания», then its button)
  const portTab = await p.evaluate(() => document.querySelector('#modal-panel .port-body')?.dataset.page);
  if (portTab !== 'quests') {
    const tab = await p.evaluate(() => { const e = document.querySelector('#modal-panel [data-ptab="quests"]'); return { ring: !!e?.classList.contains('tut-target'), badge: e?.querySelector('.k-badge')?.textContent ?? '' }; });
    L.log('on', portTab, '— «Задания»', JSON.stringify(tab));
    await shot(p, '0_bell_tab');
    if (!tab.ring) fail('the finger is not on «Задания»');
    await p.evaluate(() => document.querySelector('#modal-panel [data-ptab="quests"]')?.click());
    await L.sleep(900);
  }
  const btn = await p.evaluate(() => {
    const e = document.querySelector('#modal-panel [data-act="quest_here"]');
    const r = e?.getBoundingClientRect();
    return e ? { text: e.textContent.trim(), ring: e.classList.contains('tut-target'), finger: !document.getElementById('tut-finger')?.classList.contains('hidden'), x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight } : null;
  });
  L.log('ask button', JSON.stringify(btn));
  await shot(p, '1_bell_port');
  if (!btn) fail('no «Расспросить» in the port');
  else {
    if (lang === 'ru' && btn.text !== 'Расспросить') fail(`the button reads «${btn.text}»`);
    if (!btn.ring || !btn.finger) fail('the finger is not on it');
    if (btn.x < 0 || btn.y < 0 || btn.x + btn.w > btn.vw || btn.y + btn.h > btn.vh) fail('the button is off the screen');
  }
  // the journal: the verb instead of «Плыть»
  await L.open(p, 'journal');
  await L.sleep(800);
  const jr = await p.evaluate(() => ({ verb: document.querySelector('.jr-acts [data-act="quest_here"]')?.textContent.trim() ?? null, sail: !!document.querySelector('.jr-acts [data-jsail]') }));
  L.log('journal', JSON.stringify(jr));
  await shot(p, '2_bell_journal');
  if (!jr.verb || jr.sail) fail('the journal shows «Плыть», not the verb');
  // pressed (in the port window, as she would)
  await L.open(p, null);
  await L.sleep(300);
  await L.open(p, 'port');
  await L.sleep(800);
  await p.evaluate(() => document.querySelector('#modal-panel [data-ptab="quests"]')?.click());
  await L.sleep(600);
  await p.evaluate(() => document.querySelector('#modal-panel [data-act="quest_here"]')?.click());
  await L.sleep(1500);
  const b2 = (await self(p)).quests.find((q) => q.name === 'A Bell on the Handle');
  L.log('bell after', JSON.stringify(b2));
  await shot(p, '3_bell_done');
  if (!b2 || b2.step !== 2) fail('«Расспросить» did not do the step');
  await L.closeAll(p);

  // ---- 1) the Rose in a harbour that is not the Brethren's (the Bell's port, or another)
  const faction = await p.evaluate(() => { const s = globalThis.gravetide.state; return s.ports.find((x) => x.id === s.self.dockedAt)?.faction; });
  L.log('harbour of', faction);
  if (faction === 'confederacy') {
    const other = await p.evaluate(() => globalThis.gravetide.state.ports.find((x) => x.faction !== 'confederacy').id);
    await L.send(p, { t: 'undock' });
    await L.sleep(2000);
    await L.say(p, `/tp ${other}`);
    await L.sleep(2000);
    await L.send(p, { t: 'dock' });
    await L.sleep(2500);
    await L.closeAll(p);
  }
  await L.say(p, '/tattoo rose');
  await L.sleep(800);
  await L.say(p, '/tattoo swallow');
  await L.sleep(800);
  await sheets(p);
  await L.open(p, 'tattoos');
  await L.sleep(1000);
  await shot(p, '4_tattoos');
  // (a) a tap on the first «+» place, the picker, the Rose
  await p.evaluate(() => document.querySelector('#modal-panel .doll-slot[data-place="0"]')?.click());
  await L.sleep(500);
  const pick = await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-pick]')].map((e) => e.dataset.pick));
  await shot(p, '5_picker');
  if (!pick.includes('rose')) fail('the picker has no Rose: ' + pick.join(','));
  await p.evaluate(() => document.querySelector('#modal-panel [data-pick="rose"]')?.click());
  await L.sleep(1500);
  let t = await tat(p);
  L.log('after the picker', JSON.stringify(t));
  await shot(p, '6_rose_inked');
  if (t?.active?.[0] !== 'rose' || !t.owned.includes('rose')) fail('the Rose not set by the picker');
  // (b) hold the Swallow's card and drag it onto place 2 (touch: the finger held still, then moved)
  {
    // pointer events as a phone's webview sends them (a touch pointer): held still 0.45 s, then moved onto place 2
    const r = await p.evaluate(async () => {
      const card = document.querySelector('#modal-panel .tt-tile[data-tt="swallow"]');
      const slot = document.querySelector('#modal-panel .doll-slot[data-place="1"]');
      if (!card || !slot) return null;
      const a = card.getBoundingClientRect(), s = slot.getBoundingClientRect();
      const from = { x: a.x + 22, y: a.y + a.height / 2 }, to = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
      const opt = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y });
      card.dispatchEvent(new PointerEvent('pointerdown', opt(from.x, from.y)));
      await new Promise((r) => setTimeout(r, 450));
      const lifted = !!document.querySelector('.tt-ghost');
      for (let i = 1; i <= 8; i++) {
        window.dispatchEvent(new PointerEvent('pointermove', opt(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)));
        await new Promise((r) => setTimeout(r, 30));
      }
      const over = document.querySelector('.tt-over')?.dataset.place ?? null;
      window.dispatchEvent(new PointerEvent('pointerup', opt(to.x, to.y)));
      return { from, to, lifted, over };
    });
    L.log('drag', JSON.stringify(r));
    if (!r) fail('no card or place to drag between');
    await L.sleep(1500);
    t = await tat(p);
    L.log('after the drag', JSON.stringify(t));
    await shot(p, '7_swallow_dragged');
    if (t?.active?.[1] !== 'swallow') fail('the Swallow not set by the drag');
  }
  if (p.errors.length) L.log('errors', p.errors.slice(0, 5).join(' | '));
} catch (e) {
  fail(String(e?.stack ?? e));
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
