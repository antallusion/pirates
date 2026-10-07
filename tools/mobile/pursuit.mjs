// The owner, 2026-10-07, in the browser (a desk window of 1500×600 with a mouse, and a phone held sideways, 812×375
// touch): «Атаковать» on a pirate of her level, and the fight measured as he plays it — the distance the helmsman holds
// over time, the share of balls that strike (auto-fire, and «Огонь» / a click on her), the time to sink her and the
// time to the grapples; every message the page sends, every refusal and every console error, logged. And the creature
// stacks of docs/19 D7 (`stack`): every way to attack one — «Атаковать» in the action button, «Осмотреть» → the card's
// attack, a tap or click on it on the sea — with everything sent and every refusal logged.
//
//   APORT=58833 OUT=assets/raw/audit/gp node tools/mobile/pursuit.mjs [guns|board|stack] [--size desk|phone] [--tag x]
//     [--class sloop] [--secs 60] [--manual] [--hunt]
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from './m0/lib.mjs';
import { Phone, StepError, signIn } from './e2e/pages.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODE = process.argv.slice(2).find((x) => ['guns', 'board', 'stack'].includes(x)) ?? 'guns';
const SIZE = arg('size', 'desk');
const [W, H] = SIZE === 'desk' ? [1500, 600] : [812, 375];
const TOUCH = SIZE !== 'desk';
const APORT = Number(process.env.APORT ?? 58833);
const OUT = process.env.OUT ?? 'assets/raw/audit/gp';
const TAG = arg('tag', `${MODE}_${SIZE}`);
const CLS = arg('class', 'sloop');
const SECS = Number(arg('secs', '60'));
const MANUAL = process.argv.includes('--manual');
const HUNT = process.argv.includes('--hunt');
/** The mark's role (`--role patrol`: a ship that fights with the guns and does not board; a pirate grapples when close). */
const ROLE = arg('role', 'pirate');
mkdirSync(OUT, { recursive: true });

/** Everything the page sends (but the helm's input and the pings), every server message worth a look, the console. */
async function instrument(p) {
  await p.evaluate(() => {
    const g = globalThis.gravetide;
    const W = (globalThis.__gp = { sent: [], toasts: [], volleys: [], hits: [], msgs: [], t0: performance.now() });
    const now = () => Math.round(performance.now() - W.t0) / 1000;
    const send = g.net.send.bind(g.net);
    g.net.send = (m) => {
      if (m.t !== 'input' && m.t !== 'ping' && m.t !== 'appraise') W.sent.push({ t: now(), m: JSON.stringify(m).slice(0, 140) });
      return send(m);
    };
    g.net.on((m) => {
      if (m.t === 'toast' || m.t === 'err') W.toasts.push({ t: now(), kind: m.kind ?? 'err', msg: m.msg });
      else if (m.t === 'ev') {
        for (const e of m.list) {
          if (e.k === 'volley' && e.ship === g.state.entityId) {
            const tg = g.state.pursuit ? g.state.ships.get(g.state.pursuit.target) : null, o = g.state.ownDisplay;
            W.volleys.push({ t: now(), side: e.side, balls: e.balls.length, d: tg && o ? Math.round(Math.hypot(tg.cur.x - o.x, tg.cur.y - o.y)) : null });
          } else if (e.k === 'hit' && !e.evaded) W.hits.push({ t: now(), ship: e.ship, dmg: e.dmg });
        }
      } else if (['pursuit', 'board_risk', 'board_odds', 'roams', 'board_tac'].includes(m.t)) {
        if (m.t === 'roams' || m.t === 'board_tac') return; // (many; their effect is read off the state)
        W.msgs.push({ t: now(), m: JSON.stringify(m).slice(0, 160) });
      }
    });
    // What is on the screen of the toasts' band (the player sees these; the messages above are what came).
    W.seen = [];
    setInterval(() => {
      for (const el of document.querySelectorAll('.toast')) {
        const txt = el.innerText.replace(/\s+/g, ' ').trim();
        const last = W.seen[W.seen.length - 1];
        if (txt && !(last && last.txt === txt && now() - last.t < 1)) W.seen.push({ t: now(), txt, cls: el.className.slice(0, 40) });
      }
    }, 500);
  });
}

/** Out of port: the harbour's gold «В море» (a phone), the HUD's (a desk), or the order itself if neither shows. */
async function castOff(ph) {
  for (let i = 0; i < 30; i++) {
    const s = await ph.state();
    if (!s.docked) break;
    if (!(await ph.tapIf('[data-dp="sail"]', '«Всё равно выйти»')) && !(await ph.tapIf('#modal-panel [data-ptab="sea"]', '«В море»')) && !(await ph.tapIf('#tc-fire.tc-sail', '«В море»')))
      await L.send(ph.p, { t: 'undock' });
    await L.sleep(1000);
  }
  await L.sleep(1500);
  await ph.skipFilm();
  await L.closeAll(ph.p, 1);
}

async function openSea(ph) {
  // A spot of its own each run (the last run's foes, still angry, lie where it was).
  const spot = process.env.SPOT ? process.env.SPOT.split(',').map(Number) : [15000 + Math.floor(Math.random() * 18) * 1000, 63000 + Math.floor(Math.random() * 14) * 1000];
  ph.spot = spot;
  await ph.admin(`/tp ${spot[0]} ${spot[1]}`, 2500);
  await ph.skipFilm();
  await L.closeAll(ph.p, 1);
  for (const x of ['/weather clear', '/heal', '/ammo']) await ph.admin(x, 700);
}

/** Her mark on the screen (the nearest pirate), and the distance. */
const foe = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
  let best = null, bd = 1e9;
  for (const x of s.ships.values()) {
    if (!x.info || (x.info.npcRole ?? x.info.role) !== globalThis.__role || !x.cur || x.id === s.entityId) continue;
    const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y);
    if (d < bd) { bd = d; best = x; }
  }
  if (!best) return null;
  const sx = g.renderer.sx(best.cur.x), sy = g.renderer.sy(best.cur.y);
  return { id: best.id, d: Math.round(bd), x: sx, y: sy, on: sx > 0 && sy > 0 && sx < innerWidth && sy < innerHeight, hull: best.cur.hull, crew: best.cur.crew, flags: best.cur.flags, cls: best.info.classId };
});

/** «Атаковать» as he presses it: a tap/click on her (the mark), then the action button (phone) or the bar's (desk). */
async function attack(ph) {
  const p = ph.p;
  await ph.until(async () => (await foe(p))?.on, 20000, 'the mark on the screen');
  const f = await foe(p);
  ph.markId = f.id;
  // On the sea itself (a finger on the HUD over her opens something else): else the target key's pin, noted.
  const free = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id === 'world', [f.x, f.y]);
  if (free) await ph.tapAt(f.x, f.y);
  else { ph.pinned = true; await p.evaluate((id) => globalThis.gravetide.target(id), f.id); }
  const sel = TOUCH ? '#tc-act[data-act="attack"]' : '#hud-prompt .act-attack';
  await ph.tap(sel, '«Атаковать»', 8000);
}

const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };

async function fight(ph) {
  const p = ph.p;
  await ph.admin('/silver 3000');
  await castOff(ph);
  await openSea(ph);
  if (CLS !== 'sloop') { await ph.admin(`/ship ${CLS}`, 1500); await ph.admin('/heal', 600); await ph.admin('/ammo', 600); }
  await instrument(p);
  // Her bow north, the pirate off her starboard beam, east: on the screen's long side (a desk's 1500×600 shows ±130 m
  // up and down at the default zoom, ±325 m across).
  await ph.admin('/heading 0', 800);
  await p.evaluate((r) => (globalThis.__role = r), ROLE);
  await ph.admin(`/foe ${ROLE} ${CLS} ${arg('from', '260')}${HUNT ? ' hunt' : ''}`, 2000);
  await ph.step('foe', { foe: await foe(p) });
  const tA = Date.now();
  await attack(ph);
  await ph.step('attack');
  // «Бортами»: the guns' fight (the action button's word once she pursues: «Атаковать» itself runs in for the grapples).
  if (MODE === 'guns') {
    if (TOUCH) await ph.tap('#tc-act[data-act="attack_mode"]', '«Бортами»', 5000);
    else await ph.tap('#hud-prompt .act-attack_mode', '«Бортами»', 5000);
  }
  const samples = [];
  let firstVolley = null, end = null, why = 'time', lastFire = 0, fires = 0, grapples = null;
  for (;;) {
    const t = (Date.now() - tA) / 1000;
    const f = await foe(p);
    const st = await p.evaluate(() => { const s = globalThis.gravetide.state; return { pursuit: s.pursuit, tac: !!s.boardTac, spd: s.ownDisplay?.speed ?? 0, ring: document.querySelector('[data-range]')?.dataset.range ?? null }; });
    const vols = await p.evaluate(() => globalThis.__gp.volleys.length);
    if (vols && firstVolley === null) firstVolley = t;
    samples.push({ t: +t.toFixed(2), d: f?.d ?? null, hull: f ? +f.hull.toFixed(3) : null, crew: f ? +f.crew.toFixed(3) : null, mode: st.pursuit?.mode ?? null, spd: +st.spd.toFixed(1), ring: st.ring });
    if (MODE === 'board' && grapples === null && (await ph.visible(TOUCH ? '#tc-act[data-act="board"]' : '#hud-prompt .act-board'))) {
      grapples = t;
      why = 'grapples';
      end = t;
      break;
    }
    if (st.tac) { why = 'battle'; end = t; break; }
    if (!f || f.flags & 1) { why = 'sunk'; end = t; break; }
    if (f.flags & 16) { why = 'struck'; end = t; break; }
    if (t > SECS) break;
    // «Огонь» by hand now and then (a phone's button; a desk's click on her — the side under the cursor fires at her).
    if (MANUAL && t > 2 && Date.now() - lastFire > 2500) {
      lastFire = Date.now();
      fires++;
      if (TOUCH) await ph.tapIf('#tc-fire:not(.tc-sail)', '«Огонь»');
      else if (f.on) await p.mouse.click(f.x, f.y);
    }
    if (samples.length % 20 === 1) await ph.shot(`t${Math.round(t)}`);
    await L.sleep(250);
  }
  await ph.step('end', { why, end });
  const W = await p.evaluate(() => { const w = globalThis.__gp; return { sent: w.sent, toasts: w.toasts, volleys: w.volleys, hits: w.hits, msgs: w.msgs, seen: w.seen }; });
  const fid = (await foe(p))?.id ?? samples.length;
  const broad = W.volleys.filter((v) => v.side === 'port' || v.side === 'starboard');
  const balls = broad.reduce((a, v) => a + v.balls, 0), chBalls = W.volleys.filter((v) => !(v.side === 'port' || v.side === 'starboard')).reduce((a, v) => a + v.balls, 0);
  const hitsOn = W.hits.filter((h) => h.ship === ph.markId).length;
  // The distance held once the fight is on (from the first broadside, or from 8 s in if none).
  const from = firstVolley ?? 8;
  const held = samples.filter((s) => s.t >= from && s.d !== null).map((s) => s.d);
  const res = {
    mode: MODE, size: SIZE, cls: CLS, role: ROLE, manual: MANUAL, hunt: HUNT, why, end, grapples, firstVolley, fires,
    held: { p10: q(held, 0.1), median: q(held, 0.5), p90: q(held, 0.9), n: held.length },
    volleys: broad.length, balls, chaserBalls: chBalls, hits: hitsOn, hitRate: balls + chBalls ? +(hitsOn / (balls + chBalls)).toFixed(2) : null,
    volleyD: broad.map((v) => v.d),
    refusals: W.toasts.filter((x) => x.kind === 'bad' || x.kind === 'err'),
    sent: W.sent, msgs: W.msgs.slice(-40), seen: W.seen.slice(-40), errors: p.errors,
    samples: samples.filter((_, i) => i % 2 === 0).map((s) => `${s.t}:${s.d}${s.mode ? s.mode[0] : '-'}`).join(' '),
  };
  void fid;
  return res;
}

// ------------------------------------------------------------------------------------------- the creature stacks

/** The stack nearest her, where it lies on the screen. */
const stack = (p) => p.evaluate(() => {
  const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
  let best = null, bd = 1e9;
  let bp = null;
  for (const v of s.roams) {
    const q = g.roamNow(v.id) ?? v; // where the renderer draws it (its wander)
    const d = Math.hypot(q.x - o.x, q.y - o.y);
    if (d < bd) { bd = d; best = v; bp = q; }
  }
  if (!best) return null;
  const sx = g.renderer.sx(bp.x), sy = g.renderer.sy(bp.y);
  const free = sx > 0 && sy > 0 && sx < innerWidth && sy < innerHeight && document.elementFromPoint(sx, sy)?.id === 'world';
  return { id: best.id, kind: best.kind, level: best.level, n: best.n, d: Math.round(bd), x: sx, y: sy, on: free, fight: best.fight ?? null };
});

/** The action button's wheel on a phone (a long press): its items' words. */
async function wheelItems(p, open = true) {
  return p.evaluate(async (o) => {
    const el = document.querySelector('#tc-act');
    if (!el || !el.getBoundingClientRect().width) return null;
    const r = el.getBoundingClientRect();
    const at = { pointerId: 7, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', at));
    await new Promise((res) => setTimeout(res, 600));
    const items = [...document.querySelectorAll('.k-wheel:not(.hidden) .k-wheel-item')].map((x) => x.innerText.replace(/\s+/g, ' ').trim());
    if (!o) el.dispatchEvent(new PointerEvent('pointercancel', at));
    return items;
  }, open);
}

/** Picks the wheel's item whose words match `re` (the wheel open from wheelItems). */
async function wheelPick(p, re) {
  return p.evaluate(async (src) => {
    const rx = new RegExp(src);
    const it = [...document.querySelectorAll('.k-wheel:not(.hidden) .k-wheel-item')].find((x) => rx.test(x.innerText));
    const el = document.querySelector('#tc-act');
    const r0 = el.getBoundingClientRect();
    const base = { pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true };
    if (!it) {
      el.dispatchEvent(new PointerEvent('pointercancel', { ...base, clientX: r0.left, clientY: r0.top }));
      return false;
    }
    const r = it.getBoundingClientRect();
    const at = { ...base, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointermove', at));
    document.dispatchEvent(new PointerEvent('pointermove', at));
    await new Promise((res) => setTimeout(res, 120));
    el.dispatchEvent(new PointerEvent('pointerup', at));
    return it.innerText.replace(/\s+/g, ' ').trim();
  }, re.source);
}

async function stacks(ph) {
  const p = ph.p;
  await castOff(ph);
  await openSea(ph);
  await instrument(p);
  const out = {};
  const acts = async () => TOUCH
    ? { button: await p.evaluate(() => { const b = document.querySelector('#tc-act'); return b && b.getBoundingClientRect().width ? `${b.dataset.act}:${b.innerText.replace(/\s+/g, ' ').trim()}` : null; }), wheel: await wheelItems(p, false) }
    : p.evaluate(() => [...document.querySelectorAll('#hud-prompt .act-btn')].filter((b) => b.getBoundingClientRect().width).map((b) => b.className.replace(/act-btn|primary/g, '').trim() + ':' + b.innerText.replace(/\s+/g, ' ').trim()));
  const snap = async (label) => {
    await L.sleep(300);
    const W = await p.evaluate(() => { const w = globalThis.__gp; return { sent: w.sent.splice(0), toasts: w.toasts.splice(0), msgs: w.msgs.splice(0), seen: w.seen.splice(0) }; });
    const s = await ph.state();
    out[label] = { ...W, acts: await acts(), tac: s.tac, pursuit: await p.evaluate(() => globalThis.gravetide.state.pursuit), stack: await stack(p), errors: p.errors.splice(0) };
    L.log(label, JSON.stringify({ sent: W.sent.map((x) => x.m), toasts: W.toasts.map((x) => x.msg), acts: out[label].acts, tac: s.tac, pursuit: out[label].pursuit }).slice(0, 1200));
  };
  const endBattle = async () => {
    if (!(await ph.state()).tac) return;
    await L.send(p, { t: 'tac', act: { a: 'quick' } }).catch(() => {});
    for (let i = 0; i < 40 && (await ph.state()).tac; i++) {
      if (!(await ph.tapIf('.tb-pad.over button, .tb-banner:not(.hidden) button, .tb-end button', "the battle's end button")) && i > 6)
        await p.evaluate(() => document.querySelector('.tb-banner:not(.hidden) button, .tb-end button')?.click()); // (the scene's, not counted)
      await L.sleep(500);
    }
    await L.sleep(1500);
    await ph.skipFilm();
    await L.closeAll(p, 1);
  };
  const reset = async () => {
    await endBattle();
    await L.send(p, { t: 'attack', stop: true });
    await L.closeAll(p, 2);
    await ph.admin('/stack reset', 600);
    await ph.admin('/heal', 600);
    await ph.admin('/stack go', 2500);
    await p.evaluate(() => { const w = globalThis.__gp; w.sent.length = 0; w.toasts.length = 0; w.seen.length = 0; w.msgs.length = 0; });
  };
  // 1. Beside it (the admin's /stack … go puts her 150 m off it): what the action button offers.
  await reset();
  await ph.step('stack_go', { stack: await stack(p) });
  await snap('at_stack');
  // 2. The action button pressed as it stands (its first: the gold one).
  if (TOUCH) await ph.tapIf('#tc-act', 'the action button');
  else await ph.tapIf('#hud-prompt .act-btn.primary', "the bar's first button");
  await L.sleep(5000);
  await ph.step('act_first');
  await snap('act_first');
  // 3. A tap / click on the stack itself, then the action button again.
  await reset();
  const sk = await stack(p);
  if (sk?.on) await ph.tapAt(sk.x, sk.y);
  await L.sleep(1200);
  await ph.step('tap_stack');
  await snap('tap_stack');
  if (TOUCH) await ph.tapIf('#tc-act', 'the action button');
  else await ph.tapIf('#hud-prompt .act-btn.primary', "the bar's first button");
  await L.sleep(5000);
  await ph.step('tap_then_act');
  await snap('tap_then_act');
  // 4. The stack's own «Атаковать» (the wheel's on a phone, the bar's on a desk).
  await reset();
  if (TOUCH) { await wheelItems(p, true); await wheelPick(p, /^Атаковать/); }
  else await ph.tapIf('#hud-prompt .act-roam', '«Атаковать» (the stack)');
  await L.sleep(5000);
  await ph.step('roam_attack');
  await snap('roam_attack');
  // 5. «Осмотреть» → the card's «Атаковать».
  await reset();
  if (TOUCH) { await wheelItems(p, true); await wheelPick(p, /Осмотреть/); }
  else await ph.tapIf('#hud-prompt .act-roam_look', '«Осмотреть»');
  await L.sleep(1500);
  await ph.step('look');
  const ok = await ph.tapIf('#confirm [data-yes]', "the card's «Атаковать»");
  await L.sleep(5000);
  await ph.step('card_attack', { ok });
  await snap('card_attack');
  // 6. From afar (600 m off, the view pinched out to see it): a tap on it marks it, the action button's «Атаковать» —
  // the helmsman sails her in and the boats go; the stopwatch to the battle.
  await reset();
  const s0 = await stack(p);
  const at0 = await p.evaluate((id) => { const g = globalThis.gravetide, v = g.state.roams.find((x) => x.id === id); const q = v && g.state.estServerTime ? v : null; return q ? { x: q.x, y: q.y } : null; }, s0?.id);
  if (at0) {
    await ph.admin('/heading 0', 600);
    await ph.admin(`/tp ${Math.round(at0.x - 600)} ${Math.round(at0.y)}`, 2500);
    await L.closeAll(p, 1);
    await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.userZoomed = true; r.targetZoom = 0.6; });
    await L.sleep(1500);
    const s1 = await stack(p);
    if (s1?.on) await ph.tapAt(s1.x, s1.y);
    await L.sleep(800);
    await ph.step('far_marked', { stack: await stack(p), mark: await p.evaluate(() => globalThis.gravetide.state.roamMark) });
    await snap('far_marked');
    const t0 = Date.now();
    if (TOUCH) await ph.tapIf('#tc-act', 'the action button');
    else await ph.tapIf('#hud-prompt .act-btn.primary', "the bar's first button");
    let battle = null;
    for (let i = 0; i < 80; i++) {
      if ((await ph.state()).tac) { battle = (Date.now() - t0) / 1000; break; }
      if (i === 6) await ph.shot('far_run');
      await L.sleep(250);
    }
    await ph.step('far_battle', { secs: battle });
    await snap('far_attack');
    out.far_attack.secs = battle;
    await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.userZoomed = false; });
  }
  // 7. Twenty seconds beside it doing nothing: is anything sent or refused by itself?
  await reset();
  await L.sleep(20000);
  await snap('idle20');
  await endBattle();
  return out;
}

const b = await L.browser();
const pg = await L.page(b, [W, H], { touch: TOUCH, lang: 'ru' });
const ph = new Phone(pg, { out: OUT, tag: TAG, port: APORT, touch: TOUCH });
let res;
try {
  await signIn(ph, { name: `GP${Math.random().toString(36).slice(2, 6)}`, know: true });
  res = MODE === 'stack' ? await stacks(ph) : await fight(ph);
} catch (e) {
  res = { error: e instanceof StepError ? e.message : String(e?.stack ?? e).slice(0, 800) };
  await ph.shot('error');
}
res.steps = ph.steps;
writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1));
const brief = { ...res };
delete brief.sent; delete brief.steps; delete brief.samples; delete brief.msgs; delete brief.seen;
console.log(JSON.stringify(brief, null, 1).slice(0, 4000));
await b.close();
