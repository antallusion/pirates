// The first hour as a newcomer plays it (owner, 2026-10-23: «все должно играться идеально и просто для человека»): a
// fresh account in the Telegram layout (html.tg-app, its header 46 px), the captain chosen (a free one; the premium
// ones locked), the First Watch, the prologue, the campaign's opening and on. The robot does what a person does:
// it taps where the finger points, the gold «Да» of a question, the lit button of a card; in a battle the lit
// «Быстрый бой»; and when there is nothing to tap it waits — and a wait with nothing to tap and nothing said is logged
// as STUCK with a screenshot and the buttons on the screen. Every tap counted per quest step, every step timed.
//   GPORT=58705 SIZE=1093x481 LANG2=ru TG=46 MAXMIN=40 OUT=assets/raw/audit/firsthour node tools/mobile/ux/firsthour.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '1093x481').split('x').map(Number);
const port = Number(process.env.GPORT ?? 58705);
const tg = Number(process.env.TG ?? 46);
const lang = process.env.LANG2 ?? 'ru';
const maxMin = Number(process.env.MAXMIN ?? 40);
const know = process.env.KNOW === '1';
const stopAt = process.env.STOPAT ?? ''; // a quest id to stop at (e.g. the second chapter's end)
const OUT = process.env.OUT ?? 'assets/raw/audit/firsthour';
mkdirSync(OUT, { recursive: true });
const tag = `${W}x${H}_${lang}`;
const LOG = `${OUT}/${tag}.jsonl`;
writeFileSync(LOG, '');
const rec = (o) => appendFileSync(LOG, JSON.stringify({ t: Math.round((Date.now() - T0) / 1000), ...o }) + '\n');
let T0 = Date.now();
let shotN = 0;
const shot = (p, n) => p.screenshot({ path: `${OUT}/${tag}_${String(++shotN).padStart(3, '0')}_${n}.png` }).catch(() => {});

/** What a person sees: the step, the finger and its button, a question, a card, a battle, the ship's way. */
const look = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, s = g?.state;
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return false; if (e.closest('.hidden')) return false; const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h) || !!h.closest('#tut-finger')); };
  const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; };
  const txt = (e) => (e?.innerText ?? e?.getAttribute?.('aria-label') ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const fin = document.getElementById('tut-finger');
  const tgt = document.querySelector('.tut-target');
  const q = s?.self?.quests?.find((x) => x.op) ?? s?.self?.quests?.find((x) => x.kind === 'campaign' || /^c\d/.test(x.id)) ?? null;
  const conf = [...document.querySelectorAll('.confirm-panel, #confirm')].find((e) => e.getBoundingClientRect().width > 0 && !e.closest('.hidden'));
  const modalP = document.querySelector('#modal-panel');
  const modalOn = !!modalP && modalP.getBoundingClientRect().width > 0 && !modalP.closest('.hidden');
  const film = !!document.querySelector('.film');
  const tac = document.body.classList.contains('tac');
  const endBtn = document.querySelector('#board-tac [data-endbtn]');
  const quick = [...document.querySelectorAll('#board-tac [data-quicknow], #board-tac .tb-qn, #board-tac [data-a="quick"]')].find(vis);
  const cards = [...document.querySelectorAll('[data-sur], [data-fate], #promo-over [data-polater], .enc-card button, [data-lupick], [data-lore-go], [data-gfclaim], [data-gfdone], [data-endbtn], .depart-panel [data-dp="all"], .depart-panel [data-dp="sail"]')].filter(vis).map((e) => ({ sel: e.dataset.sur ? `[data-sur="${e.dataset.sur}"]` : e.dataset.fate ? `[data-fate="${e.dataset.fate}"]` : null, kind: Object.keys(e.dataset).join(','), txt: txt(e), at: box(e), gold: e.classList.contains('btn-primary') || e.classList.contains('k-btn--primary') || e.classList.contains('gold') }));
  const camp = s?.self?.campaign ?? null;
  return {
    stage: s?.onboarding?.stage ?? null,
    q: q ? { id: q.id, name: q.name, step: q.step, steps: q.steps, op: q.op ?? null, act: q.act ? (q.act.verb ?? q.act.kind ?? JSON.stringify(q.act).slice(0, 40)) : null, text: (q.text ?? '').slice(0, 90), prog: `${q.progress}/${q.need}` } : null,
    nq: s?.self?.quests?.length ?? 0,
    camp: camp ? JSON.stringify(camp).slice(0, 120) : null,
    finger: fin && !fin.classList.contains('hidden') && tgt ? { sel: tgt.id ? '#' + tgt.id : (tgt.dataset.act ? `[data-act="${tgt.dataset.act}"]` : tgt.dataset.ptab ? `[data-ptab="${tgt.dataset.ptab}"]` : tgt.className.toString().slice(0, 40)), txt: txt(tgt), at: box(tgt), shown: vis(tgt) } : null,
    conf: conf ? { txt: txt(conf).slice(0, 140), yes: !!conf.querySelector('[data-yes]') } : null,
    modal: modalOn ? (txt(modalP.querySelector('h2, .w-title, .modal-title')) || 'modal') : null,
    film, tac, end: !!endBtn && vis(endBtn), quick: quick ? box(quick) : null,
    cards,
    tbCard: (() => { const x = [...document.querySelectorAll('.k-sheet-x')].find(vis); return x ? box(x) : null; })(),
    hull: Math.round(s?.you?.hull ?? 0),
    near: (() => { const o = s?.ownDisplay; if (!o) return []; return [...s.ships.values()].filter((x) => x.id !== s.entityId && x.cur && Math.hypot(x.cur.x - o.x, x.cur.y - o.y) < 700).map((x) => `${x.info?.name}|${x.info?.npcRole ?? (x.info?.isPlayer ? 'player' : '?')}|${x.info?.faction ?? ''}|${x.cur.flags & 64 ? 'HOSTILE' : ''}|${Math.round(Math.hypot(x.cur.x - o.x, x.cur.y - o.y))}m|hull${Math.round(x.cur.hull ?? -1)}`); })(),
    sunk: (() => { const x = [...document.querySelectorAll('button.btn-primary, button.k-btn--primary')].find((e) => /(Вернуться|Back)\s+(в|to)\s+(порт|port)/i.test(e.textContent ?? '') && vis(e)); return x ? box(x) : null; })(),
    // a foe on the hexes, as her finger finds it: the red one nearest her own acting stack (her turn only)
    foe: (() => {
      const tb = g?.tactical, tv = tb?.view;
      if (!tac || !tv || !tb.canvas || tv.over) return null;
      const r = tb.canvas.getBoundingClientRect();
      const mine = tv.stacks.find((x) => x.id === tv.active) ?? tv.stacks.find((x) => x.side === tv.you);
      if (!tv.mine) return null;
      const foes = tv.stacks.filter((x) => x.side !== tv.you && x.count > 0);
      if (!foes.length) return null;
      const c0 = mine ? tb.center(mine.hex) : { x: 0, y: 0 };
      const f = foes.map((x) => ({ x, c: tb.center(x.hex) })).sort((a, b) => Math.hypot(a.c.x - c0.x, a.c.y - c0.y) - Math.hypot(b.c.x - c0.x, b.c.y - c0.y))[0];
      return [Math.round(r.left + f.c.x), Math.round(r.top + f.c.y)];
    })(),
    docked: s?.self?.dockedAt ?? null,
    spd: Math.round((s?.you?.spd ?? s?.ownDisplay?.speed ?? 0) * 10) / 10,
    auto: !!s?.autosail, sail: s?.input?.sail ?? null,
    x: Math.round(s?.ownDisplay?.x ?? 0), y: Math.round(s?.ownDisplay?.y ?? 0),
    lvl: s?.self?.level, silver: s?.self?.silver ?? s?.self?.gold,
    toasts: [...document.querySelectorAll('#toasts > .toast')].map((t) => t.innerText.replace(/\s+/g, ' ').trim().slice(0, 100)),
    hud: !document.getElementById('hud')?.classList.contains('hidden'),
  };
});

/** Every button a person could press now (for the STUCK log). */
const buttons = (p) => p.evaluate(() => [...document.querySelectorAll('button, [role="button"], .tc-act2, #tc-act')].filter((e) => { const r = e.getBoundingClientRect(); if (r.width < 6 || e.closest('.hidden') || r.top > innerHeight || r.bottom < 0) return false; const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h === e || e.contains(h); }).map((e) => `${e.id ? '#' + e.id : ''}${e.dataset.act ? `[${e.dataset.act}]` : ''}${e.dataset.ptab ? `{${e.dataset.ptab}}` : ''} ${(e.innerText || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 24)}`).slice(0, 40));

const tap = async (p, [x, y]) => { await p.touchscreen.tap(x, y); };
/** The wheel, as a thumb: pressed, pulled ahead, held a moment, let go. */
const stick = async (p, [x, y]) => {
  await p.mouse.move(x, y); await p.mouse.down();
  await p.mouse.move(x, y - 40, { steps: 4 }); await L.sleep(1200);
  await p.mouse.up();
};

const b = await L.browser();
const steps = new Map(); // key → { first, last, taps, stuck, waits }
let stepKey = '', taps = 0, stuckSecs = 0, idleSince = Date.now();
const problems = [];
let bad = 0;
const prob = (m) => { if (!problems.includes(m)) { problems.push(m); L.log('PROBLEM ' + m); rec({ problem: m }); } };
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
  // the login and the captain's screen as she meets them
  await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  T0 = Date.now();
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
  await shot(p, 'login');
  const name = 'Nov' + Math.random().toString(36).slice(2, 6);
  await p.fill('#login-name', name);
  await p.evaluate(() => document.querySelector('#login-form button[type=submit], #login-form button')?.click());
  await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 90000 });
  await L.sleep(2500);
  await shot(p, 'captain');
  const caps = await p.evaluate(() => [...document.querySelectorAll('.captain-card')].map((c) => ({ id: c.dataset.id, shut: c.classList.contains('cc-shut'), price: c.querySelector('.cpx-price')?.textContent?.trim() ?? '' })));
  const pick = await p.evaluate(() => { const b = document.getElementById('pick-captain'); const r = b?.getBoundingClientRect(); return b ? { txt: b.innerText.trim(), vis: !!r && r.bottom <= innerHeight && r.width > 0, at: [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] } : null; });
  rec({ caps, pick });
  L.log('captains', JSON.stringify(caps), 'pick', JSON.stringify(pick));
  if (!pick?.vis) prob('the captain screen: «Выбрать» below the fold');
  // a premium one tapped: what does she see?
  const prem = caps.find((c) => c.shut);
  if (prem) {
    await p.evaluate((id) => document.querySelector(`.captain-card[data-id="${id}"]`)?.click(), prem.id);
    await L.sleep(800);
    const st = await p.evaluate(() => { const b = document.getElementById('pick-captain'); return { txt: b?.innerText.trim(), dis: b?.disabled, why: document.getElementById('captain-why')?.textContent }; });
    rec({ premium: prem.id, st });
    await shot(p, 'captain_premium');
    L.log('premium tapped', JSON.stringify(st));
    await p.evaluate(() => document.querySelector('.captain-card[data-id="corsair"]')?.click());
    await L.sleep(600);
  }
  if (know) await p.evaluate(() => { const k = document.getElementById('know-sea'); if (k && !k.checked) k.click(); });
  const pk = await p.evaluate(() => { const r = document.getElementById('pick-captain').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
  await tap(p, pk);
  taps++;
  // the prologue (a film or pages): a person taps through it
  const tStart = Date.now();
  for (let i = 0; i < 120; i++) {
    if (await p.$('#hud:not(.hidden)')) break;
    if (i % 6 === 0) await shot(p, 'prologue');
    await tap(p, [W / 2, H / 2]); taps++;
    await L.sleep(1000);
  }
  rec({ prologue: Math.round((Date.now() - tStart) / 1000), taps });
  L.log(`in the game after ${Math.round((Date.now() - T0) / 1000)} s, ${taps} taps`);
  await L.sleep(2000);
  await shot(p, 'first_screen');
  // JUMP="/camp slot 13;/silver 3000": the rest of the hour from a later quest (admin commands, the QA server only)
  for (const c of (process.env.JUMP ?? '').split(';').filter(Boolean)) { await L.say(p, c); await L.sleep(1500); }
  if (process.env.JUMP) { await L.closeAll(p); await L.sleep(1500); }
  stepKey = 'start'; steps.set(stepKey, { first: Date.now(), taps: 0, stuck: 0 });

  let lastKey = '', lastAct = '', sameAct = 0, lastShotKey = '';
  const hist = [];
  let foeRest = 0, lastHull = -1; // a foe out of reach opened its card: the turn's clock plays her men (as it says it will)
  const deadline = T0 + maxMin * 60000;
  while (Date.now() < deadline) {
    const v = await look(p).catch((e) => ({ err: e.message }));
    if (v.err) { L.log('look', v.err); await L.sleep(1000); continue; }
    const key = v.stage ? `fw:${v.stage}` : v.q ? `${v.q.id}:${v.q.step}${v.q.op ? ':' + v.q.op : ''}` : 'none';
    if (key !== stepKey) {
      const s0 = steps.get(stepKey); if (s0) s0.last = Date.now();
      L.log(`STEP ${stepKey} → ${key}  (${s0 ? Math.round((Date.now() - s0.first) / 1000) : '?'} s, ${s0?.taps ?? 0} taps)  ${v.q?.name ?? ''} «${v.q?.text ?? ''}»`);
      rec({ step: key, from: stepKey, name: v.q?.name, text: v.q?.text, act: v.q?.act });
      hist.length = 0;
      stepKey = key; steps.set(key, steps.get(key) ?? { first: Date.now(), taps: 0, stuck: 0 });
      await shot(p, `step_${key.replace(/[:]/g, '-')}`);
      if (stopAt && v.q?.id === stopAt) break;
    }
    const st = steps.get(stepKey);
    if (lastHull >= 0 && v.hull < lastHull - 5) rec({ hurt: lastHull - v.hull, hull: v.hull, near: v.near, toasts: v.toasts, auto: v.auto });
    lastHull = v.hull;
    let act = null;
    if (v.film) act = null; // the kit taps films away
    else if (v.conf?.yes) act = ['conf', async () => p.evaluate(() => { const b = [...document.querySelectorAll('.confirm-panel [data-yes], #confirm [data-yes]')].find((e) => e.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }).then((xy) => tap(p, xy))];
    else if (v.finger?.shown) act = [`finger ${v.finger.sel} «${v.finger.txt}»`, async () => (v.finger.sel === '#tc-stick' ? stick(p, v.finger.at) : tap(p, v.finger.at))];
    else if (v.tac && v.end) act = ['battle end', async () => p.evaluate(() => { const r = document.querySelector('#board-tac [data-endbtn]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }).then((xy) => tap(p, xy))];
    else if (v.tac && v.quick) act = ['battle quick', async () => tap(p, v.quick)];
    else if (v.tac && v.tbCard) { foeRest = Date.now() + 15000; act = ['battle: close the card', async () => tap(p, v.tbCard)]; }
    else if (v.sunk) act = ['«Вернуться в порт»', async () => tap(p, v.sunk)];
    else if (v.tac && v.foe && Date.now() > foeRest) act = ['battle: tap a foe', async () => tap(p, v.foe)];
    else if (!v.tac && v.cards.length) { const c = v.cards.find((x) => /lupick/.test(x.kind ?? '')) ?? v.cards.find((x) => x.gold) ?? v.cards[0]; act = [`card «${c.txt}»`, async () => tap(p, c.at)]; }
    if (act) {
      const label = act[0];
      if (label === lastAct) sameAct++; else sameAct = 0;
      lastAct = label;
      // a ring of two or three taps going round with nothing changing
      hist.push(label); if (hist.length > 14) hist.shift();
      if (hist.length >= 14 && new Set(hist).size <= 3 && (st.loops = (st.loops ?? 0) + 1) === 1) {
        prob(`a ring of taps at ${key}: ${[...new Set(hist)].join(' → ')}`);
        await shot(p, `ring_${key.replace(/[:]/g, '-')}`);
      }
      if (sameAct >= 6) {
        prob(`the same tap ×${sameAct} with no change at ${key}: ${label}`);
        await shot(p, `repeat_${key.replace(/[:]/g, '-')}`);
        rec({ repeat: label, v, btns: await buttons(p) });
        sameAct = 0;
        await L.sleep(4000);
      }
      rec({ key, act: label, docked: v.docked, spd: v.spd, auto: v.auto, toasts: v.toasts });
      await act[1]().catch((e) => rec({ tapErr: e.message.slice(0, 80) }));
      taps++; st.taps++;
      idleSince = Date.now();
      await L.sleep(1100);
      continue;
    }
    // nothing to tap: she waits. A wait under the helmsman, in a battle's animation or a film is fine for a while.
    const idle = (Date.now() - idleSince) / 1000;
    // the waits seen as she sees them: a shot every 8 s of a wait, four a step at most
    if (idle > 6 && Date.now() - (st.lastIdleShot ?? 0) > 8000 && (st.idleShots ?? 0) < 4) {
      st.lastIdleShot = Date.now(); st.idleShots = (st.idleShots ?? 0) + 1;
      rec({ wait: key, idle: Math.round(idle), v });
      await shot(p, `wait_${key.replace(/[:]/g, '-')}`);
    }
    const moving = v.auto || v.spd > 0.5;
    const limit = v.tac ? 30 : moving ? 120 : 12;
    if (idle > limit) {
      st.stuck++;
      const why = `${key}: ${Math.round(idle)} s with nothing to tap (tac ${v.tac}, auto ${v.auto}, spd ${v.spd}, docked ${v.docked}, modal ${v.modal})`;
      prob(`STUCK ${key}${v.tac ? ' in a battle' : moving ? ' under way' : ''}`);
      const btns = await buttons(p);
      rec({ stuck: why, v, btns });
      L.log('STUCK', why, '\n   buttons:', btns.join(' | '));
      if (lastShotKey !== key) { await shot(p, `stuck_${key.replace(/[:]/g, '-')}`); lastShotKey = key; }
      // what a person would try: the gold «Плыть», the quest's own button, «В море», the journal's goal
      const tried = await p.evaluate(() => {
        for (const q of ['#tc-act[data-act="goal_sail"]', '.tc-act2[data-act="goal_sail"]', '[data-act="quest_here"]', '#modal-panel [data-ptab="sea"]', '#tc-cast']) {
          const e = document.querySelector(q); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width < 4 || e.closest('.hidden')) continue;
          return { q, at: [r.left + r.width / 2, r.top + r.height / 2], txt: e.innerText?.trim().slice(0, 30) };
        }
        return null;
      });
      if (tried) { rec({ fallback: tried }); L.log('  tries', JSON.stringify(tried)); await tap(p, tried.at); taps++; st.taps++; }
      else if (v.tac) { await L.send(p, { t: 'tac', act: { a: 'quick' } }); rec({ fallback: 'tac quick by hand' }); }
      else if (v.modal) { await L.closeAll(p, 1); rec({ fallback: 'closed the window' }); }
      idleSince = Date.now();
    }
    if (key !== lastKey) lastKey = key;
    await L.sleep(1000);
  }
  const s0 = steps.get(stepKey); if (s0) s0.last = Date.now();
  await shot(p, 'end');
  if (p.errors.length) prob(`page errors: ${p.errors.slice(0, 3).join(' / ')}`);
  await p.ctx.close();
} catch (e) {
  bad++;
  L.log('ERROR', e.stack);
} finally {
  await b.close();
}
const table = [...steps.entries()].map(([k, s]) => ({ step: k, secs: Math.round(((s.last ?? Date.now()) - s.first) / 1000), taps: s.taps, stuck: s.stuck }));
writeFileSync(`${OUT}/${tag}_summary.json`, JSON.stringify({ total: Math.round((Date.now() - T0) / 1000), taps, table, problems }, null, 1));
for (const r of table) L.log(`${r.step.padEnd(40)} ${String(r.secs).padStart(5)} s ${String(r.taps).padStart(4)} taps${r.stuck ? '  stuck ×' + r.stuck : ''}`);
L.log(`total ${Math.round((Date.now() - T0) / 1000)} s, ${taps} taps, ${problems.length} problems`);
process.exit(bad ? 1 : 0);
