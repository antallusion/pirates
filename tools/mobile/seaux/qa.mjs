// The seaux batch's browser check (2026-10-11): at 844×390 touch (an iPhone held sideways), 480×270 touch and 1500×600
// on a desk — the tap-to-sail on a find and on «Занять», a piece of her wreckage, a castaway, the small action row, the
// «Застава» plate, a long window scrolled by a finger (CDP touch events), the captain's menu. Screenshots to
// docs/img/seaux/, numbers to tools/mobile/seaux/out.json.
// Run: GPORT=58994 OUT=docs/img/seaux node tools/mobile/seaux/qa.mjs [844x390,480x270,1500x600]
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import * as L from '../m0/lib.mjs';

const PORT = Number(process.env.GPORT ?? 58994);
const sizes = (process.argv[2] ?? '844x390,480x270,1500x600').split(',').map((s) => s.split('x').map(Number));
const sleep = L.sleep;
const OUTF = 'tools/mobile/seaux/out.json';
const out = existsSync(OUTF) ? JSON.parse(readFileSync(OUTF, 'utf8')) : {};
mkdirSync('docs/img/seaux', { recursive: true });
const shot = (p, name) => p.screenshot({ path: `docs/img/seaux/${name}.png` });
const admin = async (p, line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const film = (p) => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const close = async (p) => { await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelectorAll('.k-sheet-root .k-sheet-x').forEach((x) => x.click()); }); await film(p); await sleep(400); };
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await sleep(200); } return false; };
const rect = (p, sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right } : null; }, sel);
/** A tap where a finger would: touch on a touch screen, a click on a desk. */
async function tapAt(p, x, y, touch) {
  if (touch) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
}
async function tapSel(p, sel, touch) {
  const r = await rect(p, sel);
  if (!r) return false;
  await tapAt(p, r.x + r.w / 2, r.y + r.h / 2, touch);
  return true;
}
/** A finger's swipe up (scrolls a list down) through CDP's own touch events. */
async function swipe(p, x, y0, y1, steps = 8) {
  const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(500);
}
/** The pane under the selector that scrolls (re-found each time: a window may redraw itself). */
const PANE = (q) => { const all = [...document.querySelectorAll(q)].filter((e) => e.getBoundingClientRect().width > 0); return all.find((x) => x.scrollHeight > x.clientHeight + 8) ?? all[0] ?? null; };
/** A long pane scrolled to its end by finger swipes: its scroll before → after, and whether its last child came into view. */
async function scrollByFinger(p, sel, touch) {
  await p.evaluate((src) => { globalThis.__pane = (0, eval)(src); }, `(${PANE.toString()})`);
  const info = await p.evaluate((q) => {
    const e = globalThis.__pane(q);
    if (!e) return null;
    e.scrollTop = 0;
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom, sh: e.scrollHeight, ch: e.clientHeight };
  }, sel);
  if (!info) return { found: false };
  if (info.sh <= info.ch + 8) return { found: true, long: false, sh: info.sh, ch: info.ch };
  const h = info.bottom - info.top;
  for (let k = 0; k < 14; k++) {
    if (touch) await swipe(p, info.x, info.bottom - h * 0.15, info.top + h * 0.15);
    else { await p.mouse.move(info.x, info.top + h / 2); await p.mouse.wheel(0, h * 0.8); await sleep(300); }
    const done = await p.evaluate((q) => { const e = globalThis.__pane(q); return !e || e.scrollTop + e.clientHeight >= e.scrollHeight - 4; }, sel);
    if (done) break;
  }
  return p.evaluate((q) => {
    const e = globalThis.__pane(q);
    if (!e) return { found: false, redrawn: true };
    const last = e.lastElementChild?.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    const res = { found: true, long: true, sh: e.scrollHeight, ch: e.clientHeight, top: Math.round(e.scrollTop), end: e.scrollTop + e.clientHeight >= e.scrollHeight - 4, lastSeen: !!last && last.bottom <= r.bottom + 2 && last.bottom > r.top };
    return res;
  }, sel);
}

const b = await L.browser();
for (const [W, H] of sizes) {
  const tag = `${W}x${H}`;
  const touch = W < 1000;
  const p = await L.page(b, [W, H], { touch });
  const R = (out[tag] = {});
  try {
    await L.login(p, { port: PORT, know: true, name: `Qa${Math.random().toString(36).slice(2, 6)}` });
    await film(p);
    if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(3000); await film(p); }
    await close(p);
    await admin(p, '/tp 21000 70000', 2500);
    await admin(p, '/silver 50000');
    await film(p);
    await close(p);

    // ---- the captain's menu from her portrait
    await tapSel(p, '#hud-captain .cs-face, #hud-captain', touch);
    R.capMenu = await until(p, () => { const e = document.querySelector('#cap-menu .k-sheet'); return !!e && e.getBoundingClientRect().height > 0; }, null, 4000);
    await sleep(600);
    R.capMenuRect = await rect(p, '#cap-menu .k-sheet');
    R.capTiles = await p.evaluate(() => [...document.querySelectorAll('#cap-menu .cap-tile')].map((t) => Math.round(t.getBoundingClientRect().height)));
    await shot(p, `${tag}-captain-menu`);
    // its «Настройки» opens the settings
    await tapSel(p, '#cap-menu [data-cap="options"]', touch);
    R.capOptions = await until(p, () => document.querySelector('#modal-panel')?.dataset.modal === 'options', null, 4000);
    await close(p);

    // ---- the «Застава» plate: her mark's line with a short name
    R.plate = await p.evaluate(() => {
      const hud = globalThis.gravetide.seaHud;
      hud.target.set({ name: 'Застава', level: 4, hull: 0.8, crew: 0.6, threat: 'even', range: 'far' });
      const host = document.getElementById('tc-target');
      host?.classList.remove('hidden');
      const n = document.querySelector('#tc-target .k-target-name');
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(n).lineHeight) || parseFloat(getComputedStyle(n).fontSize) * 1.2;
      return { w: Math.round(r.width), h: Math.round(r.height), lines: Math.round(r.height / lh), plate: Math.round(document.querySelector('#tc-target .k-target').getBoundingClientRect().width) };
    });
    await shot(p, `${tag}-plate-zastava`);
    await p.evaluate(() => globalThis.gravetide.seaHud.target.set(null));

    // ---- tap-to-sail on a find: a bottle off her bow
    await admin(p, '/level 20', 1200);
    await film(p);
    await close(p);
    await admin(p, '/find bottle', 1500);
    // (it comes up alongside: she stands off 700 m first, so the tap has a course to set)
    const f0 = await p.evaluate(() => globalThis.gravetide.state.finds.find((x) => x.kind !== 'flyfish'));
    if (f0) await admin(p, `/tp ${Math.round(f0.x - 700)} ${Math.round(f0.y)}`, 2500);
    const find = await p.evaluate(() => { const s = globalThis.gravetide.state, o = s.ownDisplay; const f = s.finds.find((x) => x.kind !== 'flyfish'); return f && o ? { id: f.id, x: f.x, y: f.y, d: Math.round(Math.hypot(f.x - o.x, f.y - o.y)) } : null; });
    R.find = find;
    if (find) {
      await sleep(600);
      // the act row: its buttons small and in one row
      R.actRow = await p.evaluate(() => [...document.querySelectorAll(document.body.classList.contains('touch') ? '#tc-actrow > .k-btn' : '#hud-prompt .act-row > .act-btn')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act ?? b.className, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; }));
      await shot(p, `${tag}-act-row`);
      const sel = touch ? '#tc-actrow [data-act="find"]' : '#hud-prompt .act-find';
      R.findTapped = await tapSel(p, sel, touch);
      await sleep(1200);
      R.findCourse = await p.evaluate(() => globalThis.gravetide.state.autosail);
      await shot(p, `${tag}-find-course`);
      R.findDone = await until(p, (id) => { const s = globalThis.gravetide.state; return !s.finds.some((f) => f.id === id) || s.findBusy?.id === id; }, find.id, 90000);
      R.findToasts = await L.toasts(p);
      await shot(p, `${tag}-find-arrived`);
    }

    // ---- a castaway: one tap on him sails her there, he comes aboard
    const crew0 = await p.evaluate(() => globalThis.gravetide.state.you?.crew ?? 0);
    await admin(p, '/army deckhand 5', 800);
    await admin(p, '/castaway 3', 1500);
    const cast = await p.evaluate(() => { const s = globalThis.gravetide.state; const c = s.castaways[0]; if (!c) return null; const r = globalThis.gravetide.renderer; return { id: c.id, x: c.x, y: c.y, sx: r.sx(c.x), sy: r.sy(c.y), crew: s.you?.crew }; });
    R.cast = cast;
    if (cast) {
      await shot(p, `${tag}-castaway`);
      if (cast.sx > 0 && cast.sy > 0 && cast.sx < W && cast.sy < H) await tapAt(p, cast.sx, cast.sy, touch);
      else await L.send(p, { t: 'autosail', x: cast.x, y: cast.y, near: 30 }); // (off the screen: what a tap on him sends)
      await sleep(800);
      R.castCourse = await p.evaluate(() => globalThis.gravetide.state.autosail);
      R.castWhy = { toasts: await L.toasts(p), fight: await p.evaluate(() => { const s = globalThis.gravetide.state; return { pursuit: s.pursuit, combat: !!s.you?.combat, hull: s.you?.hull, hullMax: s.you?.hullMax }; }) };
      R.castAboard = await until(p, (id) => !globalThis.gravetide.state.castaways.some((c) => c.id === id), cast.id, 90000);
      R.castCrew = await p.evaluate(() => globalThis.gravetide.state.you?.crew);
      R.castToasts = await L.toasts(p);
      await shot(p, `${tag}-castaway-aboard`);
    }
    void crew0;

    // ---- a piece of her wreckage: a tap sails her through it
    const wr = await p.evaluate(() => { const s = globalThis.gravetide.state, o = s.ownDisplay; const list = s.wrecks.map((w) => ({ ...w, d: Math.hypot(w.x - o.x, w.y - o.y) })).sort((a, b) => a.d - b.d); const w = list[0]; if (!w) return null; const r = globalThis.gravetide.renderer; return { id: w.id, x: w.x, y: w.y, d: Math.round(w.d), value: w.value, sx: r.sx(w.x), sy: r.sy(w.y), n: s.wrecks.length }; });
    R.wreck = wr;
    if (wr) {
      if (wr.sx > 0 && wr.sy > 0 && wr.sx < W && wr.sy < H) await tapAt(p, wr.sx, wr.sy, touch);
      else await L.send(p, { t: 'autosail', x: wr.x, y: wr.y, near: 30 }); // (off the screen: what a tap on it sends)
      await sleep(1000);
      R.wreckCourse = await p.evaluate(() => globalThis.gravetide.state.autosail);
      await shot(p, `${tag}-wreck-course`);
      R.wreckTaken = await until(p, (id) => !globalThis.gravetide.state.wrecks.some((w) => w.id === id), wr.id, 150000);
      R.wreckEnd = await p.evaluate((w) => { const s = globalThis.gravetide.state, o = s.ownDisplay; return { d: Math.round(Math.hypot(w.x - o.x, w.y - o.y)), auto: s.autosail, spd: o.speed }; }, wr);
      R.wreckToasts = await L.toasts(p);
      await shot(p, `${tag}-wreck-taken`);
    }

    // ---- «Занять»: a wild island near, the button sails her in and the terms open there
    // (a wild island: stand off 650 m from its shore, where «Занять» comes up)
    for (let k = 0; k < 8; k++) {
      const isl = await p.evaluate((skip) => { const s = globalThis.gravetide.state, o = s.ownDisplay; const list = [...s.islands.values()].filter((i) => !i.port && !i.portId && i.r > 150).map((i) => ({ i, d: Math.hypot(i.x - o.x, i.y - o.y) })).sort((a, b) => a.d - b.d); const c = list[skip]?.i; return c ? { x: c.x, y: c.y, r: c.r } : null; }, k);
      if (!isl) break;
      await admin(p, `/tp ${Math.round(isl.x - isl.r - 650)} ${Math.round(isl.y)}`, 3000);
      await film(p);
      if (await until(p, () => !!globalThis.gravetide.state.self?.claimIsle, null, 3000)) break;
    }
    await close(p);
    const claim = await p.evaluate(() => { const s = globalThis.gravetide.state; const c = s.self?.claimIsle; if (!c) return null; const i = s.islands.get(c.island); const o = s.ownDisplay; return { name: c.name, d: i && o ? Math.round(Math.hypot(i.x - o.x, i.y - o.y) - i.r) : null }; });
    R.claim = claim;
    if (claim) {
      // back off a little so «Занять» has somewhere to sail
      const sel = touch ? '#tc-actrow [data-act="claim"]' : '#hud-prompt .act-claim';
      // (a desk's simple bar shows two: «⋯ ещё N» opens the rest)
      if (!touch && !(await rect(p, sel))) await tapSel(p, '#hud-prompt [data-act-more]', false);
      // (a phone's row shows three: the rest behind the gold one's long press — pick it from the wheel)
      await until(p, (q) => !!document.querySelector(q)?.getBoundingClientRect().width, sel, 4000);
      R.claimActs = await p.evaluate(() => [...document.querySelectorAll('#tc-actrow > .k-btn, #hud-prompt .act-btn')].filter((b) => b.getBoundingClientRect().width).map((b) => b.dataset.act ?? b.className));
      R.claimTapped = await tapSel(p, sel, touch);
      await sleep(1200);
      R.claimCourse = await p.evaluate(() => globalThis.gravetide.state.autosail);
      await shot(p, `${tag}-claim-course`);
      R.claimOpen = await until(p, () => document.querySelector('#modal-panel')?.dataset.modal === 'company', null, 90000);
      await shot(p, `${tag}-claim-terms`);
      // the islands' page scrolls by finger
      R.scrollIsles = await scrollByFinger(p, '#modal-panel .modal-body, #modal-panel #company-body', touch);
      await shot(p, `${tag}-isles-scrolled`);
      await close(p);
    }

    // ---- long windows scrolled by a finger: the journal, the captain's sheet, the goals and news sheet, the talents
    for (const [name, open, sel] of [
      ['journal', () => globalThis.gravetide.open('journal'), '#modal-panel .modal-body'],
      ['hero', () => globalThis.gravetide.hero('skills'), '#modal-panel .modal-body'],
      ['options', () => globalThis.gravetide.open('options'), '#modal-panel .modal-body'],
      ['news', () => globalThis.gravetide.seaHud.openNews(), '.k-sheet-root .k-sheet-body'],
      ['company', () => globalThis.gravetide.open('company'), '#modal-panel .modal-body, #modal-panel #company-body'],
    ]) {
      await close(p);
      await p.evaluate(open);
      await sleep(1200);
      R[`scroll_${name}`] = await scrollByFinger(p, sel, touch);
      await shot(p, `${tag}-scroll-${name}`);
    }
    await close(p);
    R.errors = p.errors.slice(0, 10);
  } catch (e) {
    R.fail = String(e?.message ?? e).slice(0, 300);
    await shot(p, `${tag}-fail`).catch(() => {});
  }
  await p.ctx.close();
  L.log(tag, JSON.stringify(R));
}
await b.close();
writeFileSync(OUTF, JSON.stringify(out, null, 1));
