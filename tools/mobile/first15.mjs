// docs/23 item 82: the first quarter of an hour of a new captain on a phone held sideways (812×375, touch), measured.
// A simulated newcomer plays from the login screen: she reads nothing but what is drawn, takes 1.5 s to see and press,
// presses what the First Watch's finger points at, and after the watch does the obvious thing on the screen (the gold
// «Действие», «Огонь» on a mark, «Поднять паруса» in port, the hex battle by tapping her foes). Every touch is counted;
// a «stuck» second is one with no finger, no fight, no mark and no obvious button — a pause of 5 s and more is a place
// where a real newcomer stops and wonders. The click-path-audit method: each step's touch → its state change (the
// stage, the pursuit, the battle, the quay), logged with the time, so a touch that changed nothing shows.
//
//   GPORT=58814 MIN=15 SIZE=phone LANG2=ru OUT=assets/raw/audit/m78 node tools/mobile/first15.mjs
import * as L from './m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const MIN = Number(process.env.MIN ?? 15), size = process.env.SIZE ?? 'phone', lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/m78';
const port = Number(process.env.GPORT ?? 58814);
const REACT = 1500; // a newcomer's moment to see and press
mkdirSync(`${OUT}/first15`, { recursive: true });

const b = await L.browser();
const p = await L.page(b, L.SIZES[size], { lang, films: true });
const t0 = Date.now();
const sec = () => Math.round((Date.now() - t0) / 100) / 10;
const taps = { login: 0, film: 0, finger: 0, battle: 0, act: 0, fire: 0, stick: 0, port: 0, sheet: 0, other: 0 };
const events = [];
const note = (what, extra = {}) => { events.push({ t: sec(), taps: total(), what, ...extra }); L.log(`${sec()} s · ${total()} taps · ${what}`); };
const total = () => Object.values(taps).reduce((a, b) => a + b, 0);
let shotN = 0;
const shot = async (what) => p.screenshot({ path: `${OUT}/first15/${size}_${lang}_${String(++shotN).padStart(2, '0')}_${what}.png` }).catch(() => {});
async function tapAt(x, y, kind) {
  await p.touchscreen.tap(x, y);
  taps[kind]++;
}
/** The middle of the first visible, uncovered match. */
const spot = (sel) => p.evaluate((q) => {
  for (const e of document.querySelectorAll(q)) {
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || e.disabled || e.closest('.hidden')) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const t = document.elementFromPoint(x, y);
    if (t && (t === e || e.contains(t) || t.closest('#tut-finger'))) return { x, y };
  }
  return null;
}, sel);
async function tapSel(sel, kind) {
  const s = await spot(sel);
  if (!s) return false;
  await tapAt(s.x, s.y, kind);
  return true;
}
/** A drag of the helm stick toward a course (radians, north up), held `ms`: one touch. */
async function stick(course, ms = 1600) {
  const r = await p.evaluate(() => { const e = document.querySelector('#tc-stick'); const b = e?.getBoundingClientRect(); return b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width } : null; });
  if (!r) return false;
  const k = r.w * 0.42;
  await p.mouse.move(r.x, r.y); await p.mouse.down();
  await p.mouse.move(r.x + Math.sin(course) * k, r.y - Math.cos(course) * k, { steps: 4 });
  await L.sleep(ms);
  await p.mouse.up();
  taps.stick++;
  return true;
}
const look = () => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, own = s.ownDisplay;
  const vis = (q) => { const e = document.querySelector(q); return !!e && !e.classList.contains('hidden') && e.getClientRects().length > 0; };
  const finger = document.querySelector('#tut-finger:not(.hidden)') ? document.querySelector('.tut-target') : null;
  const fr = finger?.getBoundingClientRect();
  const act = document.querySelector('#tc-act:not(.hidden)');
  let hostile = null;
  if (own) for (const x of s.ships.values()) {
    if (!(x.cur.flags & 1) || !x.info) continue; // SF.HOSTILE = 1
    const d = Math.hypot(x.cur.x - own.x, x.cur.y - own.y);
    if (d < 4000 && (!hostile || d < hostile.d)) hostile = { d, c: Math.atan2(x.cur.x - own.x, -(x.cur.y - own.y)) };
  }
  const bt = s.boardTac;
  return {
    stage: s.onboarding?.stage ?? null, index: s.onboarding?.index ?? null, locked: s.onboarding?.locked?.length ?? 0,
    level: s.self?.level, docked: !!s.self?.dockedAt, film: !!document.querySelector('.film'), prologue: vis('#prologue'),
    finger: finger && fr ? { id: finger.id || finger.dataset.act || finger.className.slice(0, 30), x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 } : null,
    act: act ? act.dataset.act : null, fire: vis('#tc-fire'), target: document.body.classList.contains('sea-target'),
    pursuit: !!s.pursuit, autosail: !!s.autosail, modal: !document.querySelector('#modal')?.classList.contains('hidden') ? (document.querySelector('#modal-panel')?.dataset.modal ?? '?') : null,
    sheet: !!document.querySelector('.k-sheet-root.k-open:not(.k-closing)'),
    tac: bt ? { over: !!bt.over, mine: !!bt.mine, active: bt.active, reach: bt.reach ?? [], you: bt.you, stacks: bt.stacks.map((x) => [x.id, x.hex, x.side, x.count]) } : null,
    boarding: !!s.boardFight, hostile, sea: !s.self?.dockedAt,
  };
});

// ---- the login screen: a name typed, «Играть», a captain, «В море»
await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
note('login screen');
await shot('login');
await p.fill('#login-name', 'New ' + Math.random().toString(36).slice(2, 6));
for (let i = 0; ; i++) {
  await tapSel('#login-form button', 'login');
  try { await p.waitForSelector('#screen-captain:not(.hidden)', { timeout: 20000 }); break; } catch (e) { if (i >= 3) throw e; taps.login--; } // a server still waking: the tap again (not the newcomer's)
}
await L.sleep(REACT);
await tapSel('.captain-card[data-id="corsair"]', 'login');
await L.sleep(REACT);
await tapSel('#pick-captain', 'login');
note('captain chosen');

// ---- the quarter of an hour
let stuck = 0, run = 0, longest = 0;
const pauses = [];
let last = { stage: undefined, level: undefined, locked: undefined, tac: false, docked: undefined };
let lastShotStage = '';
let tick = 0;
while (Date.now() - t0 < MIN * 60_000) {
  await L.sleep(REACT);
  tick++;
  let v;
  try { v = await look(); } catch { continue; }
  // What changed since the last look: the click-path's state.
  if (v.stage !== last.stage) note(`stage ${last.stage ?? '—'} → ${v.stage ?? 'over'}`);
  if (v.level !== last.level && last.level !== undefined) note(`level ${v.level}`);
  if (v.locked !== last.locked && last.locked !== undefined) note(`optional things ${v.locked ? 'shut' : 'open'}`);
  if (!!v.tac !== last.tac) note(v.tac ? 'hex battle' : 'hex battle over');
  if (v.docked !== last.docked && last.docked !== undefined) note(v.docked ? 'in port' : 'at sea');
  last = { stage: v.stage, level: v.level, locked: v.locked, tac: !!v.tac, docked: v.docked };
  if (`${v.stage}` !== lastShotStage) { lastShotStage = `${v.stage}`; await shot(`stage_${v.stage ?? 'free'}`); }
  let did = '', obvious = true;
  if (v.film || v.prologue) {
    // A film or the prologue: a newcomer waits a moment, then taps it away.
    await tapAt(406, 187, 'film');
    did = 'film';
  } else if (v.tac && !v.tac.over) {
    if (v.tac.mine) {
      // Her turn: a foe she can reach is struck, else she walks toward the nearest foe.
      const t = v.tac;
      const meS = t.stacks.find((x) => x[0] === t.active);
      const foes = t.stacks.filter((x) => x[2] !== t.you && x[3] > 0);
      const hexes = await p.evaluate(([reach, foes, from]) => {
        const tp = globalThis.gravetide.tactical, c = tp.canvas.getBoundingClientRect();
        const xy = (h) => { const q = tp.center(h); return { x: c.left + q.x, y: c.top + q.y }; };
        const a = xy(from);
        const foe = foes.map((f) => ({ h: f[1], ...xy(f[1]) })).sort((u, w) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(w.x - a.x, w.y - a.y))[0];
        if (!foe) return null;
        const near = reach.map((h) => ({ h, ...xy(h) })).sort((u, w) => Math.hypot(u.x - foe.x, u.y - foe.y) - Math.hypot(w.x - foe.x, w.y - foe.y))[0];
        return { foe, near };
      }, [t.reach, foes, meS?.[1] ?? 0]);
      if (hexes) {
        const before = JSON.stringify(t.stacks);
        await tapAt(hexes.foe.x, hexes.foe.y, 'battle');
        await L.sleep(900);
        const after = await look();
        if (after.tac && after.tac.mine && after.tac.active === t.active && JSON.stringify(after.tac.stacks) === before && hexes.near) await tapAt(hexes.near.x, hexes.near.y, 'battle');
        did = 'battle';
      }
    } else did = 'battle-wait';
  } else if (v.tac && v.tac.over) {
    // The end: its one button.
    if (await tapSel('.tb-pad.over button, .tb-banner:not(.hidden) button, .tb-end button, [data-done]', 'battle')) did = 'battle-end';
    else did = 'battle-end-wait';
  } else if (v.finger) {
    if (/stick/.test(v.finger.id)) {
      // The wheel: pulled toward the open sea (away from the harbour), the newcomer holds it a moment.
      const course = v.hostile ? v.hostile.c : ((tick * 0.7) % (Math.PI * 2));
      await stick(course);
      did = 'finger:stick';
    } else {
      await tapAt(v.finger.x, v.finger.y, 'finger');
      did = `finger:${v.finger.id}`;
    }
  } else if (v.sheet && (await tapSel('.k-sheet-root.k-open .k-btn--primary, .k-sheet-root.k-open [data-dp="0"], .k-sheet-root.k-open [data-dp="sail"]', 'sheet'))) {
    // A sheet (the risk, a question, the harbour's check): its gold button, else what it offers to buy, else «sail».
    did = 'sheet';
  } else if (v.modal) {
    // A window: its gold button (the spoils, the risk, the harbour's «Поднять паруса»), else it is closed.
    if (v.modal === 'port' && (await tapSel('[data-act="undock"]', 'port'))) did = 'port:undock';
    else if (await tapSel('#modal-panel .btn-primary, #modal-panel .k-btn--primary', 'other')) did = `modal:${v.modal}`;
    else if (await tapSel('#modal-panel [data-close], #modal-panel .modal-x, #modal-close', 'other')) did = `close:${v.modal}`;
    else { obvious = false; did = `modal-stuck:${v.modal}`; }
  } else if (v.act && ['attack', 'board', 'dock', 'homeport', 'harbour', 'look', 'roam'].includes(v.act)) {
    await tapSel('#tc-act', 'act');
    did = `act:${v.act}`;
  } else if (v.target && v.fire && !v.pursuit) {
    await tapSel('#tc-fire', 'fire');
    did = 'fire';
  } else if (v.pursuit || v.autosail || v.boarding) {
    did = 'watching';
  } else if (v.sea && v.hostile) {
    // A pirate on the minimap: she steers for it.
    await stick(v.hostile.c);
    did = 'stick:hostile';
  } else {
    // Nothing to press, nothing to steer for: a newcomer's pause; she pulls the wheel somewhere now and then.
    obvious = false;
    if (v.sea && run >= 6) await stick((tick * 1.3) % (Math.PI * 2));
    did = 'stuck';
  }
  if (!obvious) { stuck += REACT / 1000; run += REACT / 1000; }
  else if (run) { if (run >= 5) pauses.push({ at: Math.round((sec() - run) * 10) / 10, s: Math.round(run * 10) / 10, stage: v.stage }); longest = Math.max(longest, run); run = 0; }
  if (tick % 10 === 0 || !obvious) events.push({ t: sec(), taps: total(), did, stage: v.stage, act: v.act, pursuit: v.pursuit, foe: v.hostile ? Math.round(v.hostile.d) : null, modal: v.modal });
}
if (run >= 5) pauses.push({ at: Math.round((sec() - run) * 10) / 10, s: Math.round(run * 10) / 10 });
longest = Math.max(longest, run);
await shot('end');
const res = { size, lang, minutes: MIN, taps: { total: total(), ...taps }, stuck: Math.round(stuck), pauses, longest: Math.round(longest * 10) / 10, errors: p.errors.slice(0, 10), events: events.filter((e) => e.what) , trace: events.filter((e) => !e.what) };
writeFileSync(`${OUT}/first15_${size}_${lang}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ taps: res.taps, stuck: res.stuck, pauses: res.pauses, longest: res.longest, errors: res.errors }, null, 1));
await b.close();
