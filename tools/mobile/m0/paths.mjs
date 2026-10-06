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
  // The sea fight (docs/23 phases 2–3): «Атаковать» on the action (the bar's gold button, or the touch HUD's
  // «Действие»), «Огонь» for a volley, «Абордаж» when she is in the grapples' reach. A hostile within a mile is the
  // target by itself; a tap on her pins her (counted). A volley is seen by a gun deck's reload dropping.
  const ATTACK = '#tc-act[data-act="attack"], .act-btn.act-attack';
  const BOARD = '#tc-act[data-act="board"], .act-btn.act-board';
  const watchFire = () => p.evaluate(() => {
    globalThis.__fired = false;
    clearInterval(globalThis.__fw);
    let last = null;
    globalThis.__fw = setInterval(() => {
      const r = globalThis.gravetide.state.you?.reload; if (!r) return;
      if (last && (r.port < last.port - 0.3 || r.starboard < last.starboard - 0.3)) globalThis.__fired = true;
      last = { port: r.port, starboard: r.starboard };
    }, 150);
  });
  const fired = () => p.evaluate(() => !!globalThis.__fired);
  /** A finger on the pirate on the sea (counted): she becomes the target. Done only when nothing is targeted yet. */
  const tapFoe = async () => {
    const at = await p.evaluate(() => {
      const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
      let best = null, bd = 1e9;
      for (const x of s.ships.values()) {
        if (!x.info || x.info.npcRole !== 'pirate' || !x.cur) continue;
        const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y);
        if (d < bd) { bd = d; best = x; }
      }
      if (!best) return null;
      const sx = g.renderer.sx(best.cur.x), sy = g.renderer.sy(best.cur.y);
      return sx > 0 && sy > 0 && sx < innerWidth && sy < innerHeight && document.elementFromPoint(sx, sy)?.id === 'world' ? { x: sx, y: sy } : null;
    });
    if (!at) { log.push(`${path} ✗ the pirate is not on the screen`); return false; }
    if (touch) await p.touchscreen.tap(at.x, at.y); else await p.mouse.click(at.x, at.y);
    await count('tap', 'the pirate on the sea (target)');
    await L.sleep(600);
    return true;
  };
  // A clean scene for each fight: no pursuit left over, open water far from the last fight's sharks (not counted).
  let spot = 0;
  const openSea = async () => { await toSea(); await L.send(p, { t: 'attack', stop: true }); await admin(`/tp ${21000 + 3000 * spot} ${70000 + 2500 * (spot++ % 3)}`, 3000); await quiet(); await admin('/heal'); await admin('/ammo'); };
  if (name === 'fire') {
    await run('fire', async () => { await openSea(); await admin('/foe pirate sloop 260', 3500); await watchFire(); }, async () => {
      if (!(await p.$('#tc-target:not(.hidden), .act-btn.act-attack'))) await tapFoe();
      await tap('#tc-fire', '«Огонь»');
      for (let i = 0; i < 10 && !(await fired()); i++) await L.sleep(300);
    }, fired);
  }
  if (name === 'attack' || name === 'board') {
    const boarding = name === 'board';
    await run(name, async () => { await openSea(); await admin(`/foe pirate sloop ${boarding ? 420 : 800}`, 3500); await watchFire(); }, async () => {
      // «Атаковать»: then the ship does the rest — she closes, lays her guns and fires on her own (auto-fire). The
      // board path also takes «Абордаж» when it comes up (and «Рискнуть» if the risk window asks). Gives up after 90 s.
      const t0 = Date.now();
      let attacked = false, foeTapped = false, fireTapped = 0, attackAt = 0;
      while (Date.now() - t0 < 90000) {
        const s = await st();
        if (s.tac) break;
        if (!boarding && (await fired())) break;
        if (await p.$('[data-risk="go"]')) { await tap('[data-risk="go"]', '«Рискнуть»'); await L.sleep(1500); continue; }
        if (boarding && (await p.$(BOARD))) { if (await tap(BOARD, '«Абордаж»')) { await L.sleep(2500); continue; } }
        if (!attacked && !(await p.$(ATTACK)) && !foeTapped) foeTapped = await tapFoe();
        if (!attacked && (await p.$(ATTACK))) { attacked = await tap(ATTACK, '«Атаковать»'); attackAt = Date.now(); }
        // «Напасть и выстрелить»: no broadside 6 s after «Атаковать» — a finger on «Огонь» (twice at most).
        if (!boarding && attacked && fireTapped < 2 && Date.now() - attackAt > 6000 + fireTapped * 15000 && (await p.$('#tc-fire'))) { if (await tap('#tc-fire', '«Огонь»')) fireTapped++; }
        await L.sleep(400);
      }
      log.push(`${name}: fired ${await fired()} boarded ${(await st()).tac} in ${Math.round((Date.now() - t0) / 1000)} s`);
    }, async () => (boarding ? (await st()).tac : await fired()));
    await quiet();
    if ((await st()).tac) { await p.evaluate(() => document.querySelector('[data-a="quick"]')?.click()); await L.sleep(4000); await film(); await quiet(); }
  }
}

const out = { at: new Date().toISOString(), size, lang, results, log, errors: p.errors.slice(-10) };
writeFileSync(`${OUT}/paths_${size}_${lang}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(results, null, 1));
await b.close();
