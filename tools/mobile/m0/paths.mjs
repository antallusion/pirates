// docs/23 phase 0, items 2 and 7 (and phase 9's «after»): taps to the goal on the ten main paths, on a phone on its
// side (812×375, touch), with a frame saved at every touch («before» captures, not generated). A touch is a tap on a
// control, a drag of the helm stick, a swipe that scrolls a list to the control, or a tap that skips a film; each is
// counted. The admin server sets the scene (/foe, /hurt, /tp) — those lines are not the player's and are not counted.
//
//   GPORT=58791 SIZE=phone LANG2=ru OUT=assets/raw/audit/m0 node assets/raw/audit/m0/paths.mjs [path …]
// Paths: depart map attack fire board hire repair quest buy sell (all by default).
// The selectors are the current interface's; phase 9 updates them for the new one and keeps the goals.
import * as L from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const size = process.env.SIZE ?? 'phone', lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/m0';
const FR = `${OUT}/frames`;
mkdirSync(FR, { recursive: true });
const want = process.argv.slice(2);
const ALL = ['depart', 'map', 'buy', 'sell', 'hire', 'repair', 'quest', 'fire', 'attack', 'board'];
const PATHS = want.length ? want : ALL;

const b = await L.browser();
const p = await L.page(b, L.SIZES[size], { lang, films: true });
const touch = L.SIZES[size][0] < 1000;
let path = '', taps = 0, frame = 0, kinds = {};
const log = [];
const snap = async (what) => { frame++; await p.screenshot({ path: `${FR}/${size}_${lang}_${path}_${String(frame).padStart(2, '0')}.png` }); log.push(`${path} #${taps} ${what}`); };
const count = async (kind, what) => { taps++; kinds[kind] = (kinds[kind] ?? 0) + 1; await snap(`${kind}: ${what}`); };

/** A finger on the first visible match: scrolled to first (a swipe per screenful), then tapped if nothing covers it. */
async function tap(sel, what = sel) {
  const r = await p.evaluate((q) => {
    const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0 && !x.disabled);
    if (!e) return { st: 'none' };
    let b = e.getBoundingClientRect();
    let swipes = 0;
    if (b.bottom > innerHeight || b.top < 0) {
      // The list it is in scrolls: a finger drags it, a screenful a swipe.
      let box = e.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) {
        const before = box.scrollTop;
        e.scrollIntoView({ block: 'center' });
        swipes = Math.max(1, Math.ceil(Math.abs(box.scrollTop - before) / (box.clientHeight * 0.8)));
        b = e.getBoundingClientRect();
      }
    }
    if (b.bottom > innerHeight || b.top < 0 || b.right > innerWidth || b.left < 0) return { st: 'offscreen', swipes };
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const t = document.elementFromPoint(x, y);
    if (t && t !== e && !e.contains(t)) return { st: 'covered by ' + (t.id || t.className), swipes };
    return { st: 'ok', x, y, swipes };
  }, sel);
  for (let i = 0; i < (r.swipes ?? 0); i++) await count('swipe', `scroll to ${what}`);
  if (r.st !== 'ok') { log.push(`${path} ✗ ${what}: ${r.st}`); return false; }
  if (touch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y);
  await count('tap', what);
  await L.sleep(700);
  return true;
}
/** A film up: one tap ends it (counted). */
async function film() {
  for (let i = 0; i < 8 && !(await p.$('.film')); i++) await L.sleep(250);
  if (!(await p.$('.film'))) return;
  await L.sleep(300);
  if (touch) await p.touchscreen.tap(400, 180); else await p.mouse.click(400, 180);
  await count('film', 'skip the film');
  await L.sleep(900);
}
async function stick(course, what) { await L.steer(p, course); await count('drag', what); }
const st = () => p.evaluate(() => ({
  modal: !document.querySelector('#modal')?.classList.contains('hidden') ? document.querySelector('#modal-panel')?.dataset.modal ?? document.querySelector('#modal-panel .tab.active')?.dataset.tab ?? '?' : null,
  docked: globalThis.gravetide.state.self?.dockedAt ?? null,
  tac: !!globalThis.gravetide.state.boardTac || !!globalThis.gravetide.state.boardFight,
  silver: globalThis.gravetide.state.self?.silver ?? globalThis.gravetide.state.self?.gold,
  crew: globalThis.gravetide.state.you?.crew, hull: globalThis.gravetide.state.you?.hull,
  cargo: JSON.stringify(globalThis.gravetide.state.you?.cargo ?? globalThis.gravetide.state.self?.cargo ?? {}),
  contracts: (globalThis.gravetide.state.self?.contracts ?? []).length,
  reload: globalThis.gravetide.state.you?.reload,
}));
const admin = async (line, ms = 1500) => { await L.say(p, line); await L.sleep(ms); };
const quiet = async () => { await L.closeAll(p); await p.evaluate(() => document.querySelectorAll('#confirm [data-no]').forEach((e) => e.click())); await L.sleep(400); };
async function toSea() { await quiet(); if ((await st()).docked) { await L.send(p, { t: 'undock' }); await L.sleep(2500); await film(); await quiet(); } }
async function toPort() { await quiet(); if (!(await st()).docked) { await admin('/tp saltmarrow', 2500); await L.send(p, { t: 'dock' }); await L.sleep(2500); await film(); await quiet(); } }

const results = [];
async function run(name, setup, steps, goal) {
  path = name; taps = 0; frame = 0; kinds = {};
  const t0 = Date.now();
  try {
    await setup();
    await snap('start');
    taps = 0; kinds = {};
    const t1 = Date.now();
    await steps();
    const ok = await goal();
    results.push({ path: name, ok: !!ok, taps, kinds, sec: Math.round((Date.now() - t1) / 1000) });
  } catch (e) {
    results.push({ path: name, ok: false, taps, kinds, error: String(e.message ?? e).slice(0, 160) });
  }
  L.log(JSON.stringify(results.at(-1)), `(${Math.round((Date.now() - t0) / 1000)} s)`);
}

await L.login(p, { name: (lang === 'ru' ? 'Замер' : 'Probe') + Math.random().toString(36).slice(2, 5), know: true });
await film();
await admin('/silver 50000');
await quiet();

const openPort = async () => { if ((await st()).modal !== 'port') await tap('.act-btn.act-harbour, #tc-context:not(.hidden)', 'the harbour button'); };
const portTab = (t) => tap(`#modal-panel .tab[data-tab="${t}"]`, `the «${t}» tab`);

for (const name of PATHS) {
  if (name === 'depart') await run('depart', toPort, async () => {
    await openPort();
    await tap('#modal-panel .ph-sail', '«set sail»');
    if (await p.$('[data-dp="sail"]')) await tap('[data-dp="sail"]', 'the departure check «sail»');
    await film();
    await L.sleep(1500);
  }, async () => !(await st()).docked);

  if (name === 'map') await run('map', toSea, async () => { await tap('#hud-map', 'the minimap'); await L.sleep(600); }, async () => (await st()).modal !== null && (await p.evaluate(() => !!document.querySelector('#modal-panel .wm-canvas, #modal-panel canvas, #worldmap'))));

  if (name === 'buy') {
    let before;
    await run('buy', async () => { await toPort(); before = await st(); }, async () => { await openPort(); await portTab('market'); await tap('#modal-panel [data-act="buyn"][data-good="provisions"], #modal-panel [data-act="buy"][data-good="provisions"]', '«buy 5 provisions»'); await L.sleep(800); }, async () => (await st()).silver < before.silver);
  }
  if (name === 'sell') {
    let before;
    await run('sell', async () => { await toPort(); await admin('/give rum 10'); before = await st(); }, async () => { await openPort(); await portTab('market'); await tap('#modal-panel [data-act="sellall"][data-good="rum"], #modal-panel [data-act="sell"][data-good="rum"]', '«sell the rum»'); await L.sleep(800); }, async () => (await st()).silver > before.silver);
  }
  if (name === 'hire') {
    let before;
    await run('hire', async () => { await toPort(); await admin('/wounded 0'); before = await st(); }, async () => { await openPort(); await portTab('tavern'); await tap('#modal-panel [data-act="crew"][data-n="5"]', '«+5 men»'); await L.sleep(800); }, async () => (await st()).crew > before.crew || (await st()).silver < before.silver);
  }
  if (name === 'repair') {
    let before;
    await run('repair', async () => { await toSea(); await admin('/hurt 50'); await toPort(); before = await st(); }, async () => { await openPort(); await portTab('shipyard'); await tap('#modal-panel [data-act="repair"]', '«repair»'); if (await p.$('#confirm [data-yes]')) await tap('#confirm [data-yes]', 'confirm'); await L.sleep(800); }, async () => (await st()).hull > before.hull);
  }
  if (name === 'quest') {
    let before, to;
    await run('quest', async () => {
      // A port with a courier's letters on its board (the offers are random): the scene, not the player's taps.
      for (const port of ['saltmarrow', 'gallowsmouth', 'bellhaven', 'fogmouth', 'saltmouth', 'slagport']) {
        await toSea(); await admin(`/tp ${port}`, 2500); await L.send(p, { t: 'dock' }); await L.sleep(2500);
        await p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
        await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.open('port'); }); await L.sleep(1200);
        const ok = await p.evaluate(() => (globalThis.gravetide.state.portView?.contracts ?? []).some((c) => c.kind === 'courier'));
        await quiet();
        if (ok) break;
      }
      before = await st();
    }, async () => {
      await openPort(); await portTab('contracts');
      // A courier's letters (no cargo to load): the first contract whose goal is another port.
      const id = await p.evaluate(() => (globalThis.gravetide.state.portView?.contracts ?? []).find((c) => c.kind === 'courier')?.id ?? (globalThis.gravetide.state.portView?.contracts ?? []).find((c) => c.toPort)?.id);
      await tap(`#modal-panel [data-act="contract"][data-mode="accept"]${id ? `[data-id="${id}"]` : ''}`, '«accept» a courier contract');
      await L.sleep(800);
      to = await p.evaluate(() => (globalThis.gravetide.state.self?.contracts ?? []).map((c) => c.toPort).find(Boolean));
      log.push(`quest: to ${to}`);
      await quiet();
      // The voyage itself is not the interface's: its films are skipped without counting.
      const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
      if (to) { await L.send(p, { t: 'undock' }); await L.sleep(2000); await skip(); await quiet(); await admin(`/tp ${to}`, 3000); await skip(); await quiet(); }
      await tap('.act-btn.act-dock, #tc-context:not(.hidden)', '«to port» at the destination');
      await film();
      await L.sleep(1500);
    }, async () => !!to && (await st()).silver > before.silver);
  }
  if (name === 'fire') {
    let before;
    await run('fire', async () => { await toSea(); await admin('/ammo'); await admin('/foe pirate sloop 260', 2500); before = await st(); }, async () => {
      // Her on the starboard beam within range: a finger on the starboard battery.
      await tap('#tc-starboard', 'the starboard battery');
      await L.sleep(1500);
    }, async () => { const s = await st(); return JSON.stringify(s.reload) !== JSON.stringify(before.reload) || (await L.toasts(p)).length > 0; });
  }
  if (name === 'attack' || name === 'board') {
    const boarding = name === 'board';
    let fired = false;
    await run(name, async () => { await toSea(); await admin('/heal'); await admin('/ammo'); await admin(`/foe pirate sloop ${boarding ? 420 : 800}`, 2500); }, async () => {
      // A human at the helm: the stick toward her (again when she is 25° off), full sail, and at range the guns
      // (attack) or the grapples (board). Gives up after 120 s.
      const t0 = Date.now();
      let boarded = false, lastSteer = 0;
      fired = false;
      for (let i = 0; i < 3; i++) await tap('#tc-sail-up', 'sail up');
      while (Date.now() - t0 < 120000) {
        const s = await st();
        if (s.tac) { boarded = true; break; }
        const o = await L.me(p);
        const tg = (await L.ships(p, 3000)).find((x) => x.hostile && !x.sinking) ?? (await L.ships(p, 3000))[0];
        if (!tg) break;
        if (boarding) {
          if (await p.$('#hud-prompt .act-board:not(.hidden), .act-btn.act-board')) { if (await tap('#hud-prompt .act-board, .act-btn.act-board', '«board»')) { await L.sleep(2500); continue; } }
          const sail = await p.evaluate(() => globalThis.gravetide.state.input.sail);
          if (tg.d < 140 && sail > 2) await tap('#tc-sail-down', 'sail down (match her speed)');
          else if (tg.d >= 200 && sail < 3) await tap('#tc-sail-up', 'sail up (close in)');
        } else if (tg.d < 420 && Math.abs(Math.abs(tg.off) - Math.PI / 2) < 0.35) {
          const side = tg.off > 0 ? 'starboard' : 'port';
          if ((s.reload?.[side] ?? 0) >= 1) { await tap(`#tc-${side}`, `the ${side} battery`); fired = true; break; }
        }
        if (Date.now() - lastSteer > 1500) {
          const ang = Math.atan2(tg.x - o.x, -(tg.y - o.y));
          const err = Math.abs(((ang - o.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const course = boarding || tg.d > 420 ? ang : ang + (tg.off > 0 ? -Math.PI / 2 : Math.PI / 2);
          const cerr = Math.abs(((course - o.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (cerr > (boarding ? 0.3 : 0.44) || (!boarding && tg.d <= 420 && cerr > 0.3)) { await stick(course, `helm to ${Math.round((course * 180) / Math.PI)}° (${tg.d} m)`); lastSteer = Date.now(); }
          void err;
        }
        await L.sleep(400);
      }
      log.push(`${name}: fired ${fired} boarded ${boarded} in ${Math.round((Date.now() - t0) / 1000)} s`);
    }, async () => (boarding ? (await st()).tac : fired));
    await quiet();
    if ((await st()).tac) { await p.evaluate(() => document.querySelector('[data-a="quick"]')?.click()); await L.sleep(4000); await film(); await quiet(); }
  }
}

const out = { at: new Date().toISOString(), size, lang, results, log, errors: p.errors.slice(-10) };
writeFileSync(`${OUT}/paths_${size}_${lang}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(results, null, 1));
await b.close();
