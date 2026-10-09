// docs/23 (owner, 2026-10-09: «Отдалять камеру в бою на ПК? — да, можно тряску при попадании небольшую добавить»): the
// sea fight's camera measured — a pirate laid 140 m off her beam (below her on the screen, the short way), marked;
// where she stands from the screen's edge before the fight's view and after it eased out; the zoom over the fight and
// back after it; the wheel in a fight; a ball on her hull (the knock's pixels and length, and none with «меньше
// движения»).
//
//   GPORT=58925 SIZE=1500x600 LANG2=ru OUT=docs/img/fight TAG=after node tools/mobile/fight/cam.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '1500x600').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/fight';
const TAG = process.env.TAG ?? 'now';
const SHOTS = process.env.SHOTS !== '0';
const BEAM = Number(process.env.BEAM ?? 140);
mkdirSync(OUT, { recursive: true });
const tag = `${TAG}_cam_${W}x${H}_${lang}`;
const sleep = L.sleep;

const b = await L.browser();
let p = await L.page(b, [W, H], { lang, touch });
const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
for (let i = 0; ; i++) {
  try {
    await L.login(p, { port: Number(process.env.GPORT ?? 58925), name: (lang === 'ru' ? 'Камера' : 'Camera') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true });
    break;
  } catch (e) {
    if (i >= 2) throw e;
    L.log(tag, 'login again', e.message.split('\n')[0]);
    await p.ctx.close();
    p = await L.page(b, [W, H], { lang, touch });
  }
}
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
await say('/level 20');
await say('/god');
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); }
await say('/tp gravewater', 2500);
await L.closeAll(p, 2);
// A spot of open water of her own (the last run's pirates stay where they were laid): no island within 500 m of its
// shore, no ship within 900 m.
const spot = await p.evaluate(() => {
  const s = globalThis.gravetide.state, o = s.ownDisplay;
  const isl = [...(s.islands?.values?.() ?? s.islands ?? [])];
  for (let k = 0; k < 400; k++) {
    const a = Math.random() * Math.PI * 2, d = 1500 + Math.random() * 2500;
    const x = o.x + Math.sin(a) * d, y = o.y - Math.cos(a) * d;
    if (isl.some((i) => Math.hypot(i.x - x, i.y - y) < (i.r ?? 200) + 500)) continue;
    if ([...s.ships.values()].some((sh) => sh.cur && Math.hypot(sh.cur.x - x, sh.cur.y - y) < 900)) continue;
    return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
});
if (spot) await say(`/tp ${spot.x} ${spot.y}`, 2500);
// NOFIGHT=1: the view as it was (the fight's step-back held off: the same build, her own zoom and look ahead).
if (process.env.NOFIGHT === '1') await p.evaluate(() => { const r = globalThis.gravetide.renderer; setInterval(() => { r.fight.user = true; r.fight.w = 0; r.fight.quiet = 0; }, 20); });
// Adrift and heading east: her starboard beam is south, down the screen — the short way on a desk's wide window.
await p.evaluate(() => { const s = globalThis.gravetide.state; if (s.input) { s.input.sail = 0; s.input.rudder = 0; } globalThis.gravetide.net.send({ t: 'input', seq: ++s.input.seq, rudder: 0, sail: 0 }); });
await say('/heading 90', 1200);
await sleep(2500);

/** The camera now: her zoom, where she and her mark stand on the screen, how far the mark is from its nearest edge. */
const cam = (id) => p.evaluate((tid) => {
  const g = globalThis.gravetide, r = g.renderer, s = g.state, o = s.ownDisplay;
  const t = tid !== null ? s.ships.get(tid) : null;
  const pt = (x, y) => ({ x: Math.round(r.sx(x)), y: Math.round(r.sy(y)) });
  const me = o ? pt(o.x, o.y) : null, mk = t ? pt(t.cur.x, t.cur.y) : null;
  const edge = (q) => (q ? Math.min(q.x, r.w - q.x, q.y, r.h - q.y) : null);
  return { zoom: +r.zoom.toFixed(3), target: +r.targetZoom.toFixed(3), fw: r.fight ? +r.fight.w.toFixed(2) : null, me, mark: mk, edge: edge(mk), dist: t && o ? Math.round(Math.hypot(t.cur.x - o.x, t.cur.y - o.y)) : null, range: r.markRange, cam: [r.camX, r.camY] };
}, id);

const base = await cam(null);
L.log(tag, 'peace', JSON.stringify({ zoom: base.zoom, target: base.target }));
// The fight's view settled first (a shot of hers is a sign of a fight), so the mark is read where it lies at once.
if (process.env.NOFIGHT !== '1') {
  for (let i = 0; i < 60; i++) {
    const w = await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.fx.fought = true; return r.fight.w; });
    if (w >= 0.995 && Math.abs((await cam(null)).zoom - (await p.evaluate(() => globalThis.gravetide.renderer.fight.zoom(globalThis.gravetide.renderer.targetZoom, globalThis.gravetide.renderer.fightShare)))) < 0.005) break;
    await sleep(200);
  }
}
await say(`/foe pirate sloop ${BEAM}`, 1500);
/** The pirate just laid: the ship nearest the point `m` metres off her starboard beam. */
const laid = (m) => p.evaluate((d) => { const s = globalThis.gravetide.state, o = s.ownDisplay; const bx = o.x + Math.sin(o.heading + Math.PI / 2) * d, by = o.y - Math.cos(o.heading + Math.PI / 2) * d; let best = null, bd = 1e9; for (const sh of s.ships.values()) { if (sh.id === s.entityId || !sh.cur) continue; const q = Math.hypot(sh.cur.x - bx, sh.cur.y - by); if (q < bd) { bd = q; best = sh.id; } } return best; }, m);
const id = await laid(BEAM);
await p.evaluate((x) => globalThis.gravetide.target(x), id);
await sleep(300);
const first = await cam(id);
L.log(tag, 'marked', JSON.stringify(first));
if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_marked.png` });
// The fight's view eased out (or not, before): the mark from the edge over 5 s, its least.
const run = [];
// (headless draws 4–6 frames a second and the game's clock steps 0.1 s a frame at most: ~2.5× slower than life)
for (let i = 0; i < 40; i++) { run.push(await cam(id)); await sleep(250); }
const eased = run.at(-1);
const least = Math.min(...run.map((x) => x.edge ?? 1e9));
L.log(tag, 'fight', JSON.stringify({ zoom: eased.zoom, target: eased.target, fw: eased.fw, edge: eased.edge, least, dist: eased.dist, range: eased.range, me: eased.me, mark: eased.mark }));
L.log(tag, 'zoom over the fight', run.map((x) => x.zoom).join(' '));
if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_fight.png` });

// After the fight: she slips away 1.4 km (the mark left behind, no more shots), the view back in.
const o = await p.evaluate(() => { const d = globalThis.gravetide.state.ownDisplay; return { x: Math.round(d.x), y: Math.round(d.y) }; });
await say(`/tp ${o.x} ${o.y - 1400}`, 400);
const back = [];
for (let i = 0; i < 64; i++) { back.push((await cam(null)).zoom); await sleep(250); }
L.log(tag, 'after the fight', back.join(' '));
await sleep(1500);

// A ball on her hull: the camera's knock (its pixels and length), then the same with «меньше движения».
async function knock(dmg) {
  return p.evaluate(async (d) => {
    const g = globalThis.gravetide, r = g.renderer, s = g.state, o = s.ownDisplay;
    const rm = (await import('/src/settings.ts')).settings().reduceMotion;
    const samples = [];
    const t0 = performance.now();
    const c0 = [r.camX, r.camY];
    r.fx.onEvent({ k: 'hit', x: o.x + 6, y: o.y + 4, ship: s.entityId, dmg: d, ammo: 'round' }, s.entityId);
    let busy = 0;
    await new Promise((res) => {
      const tick = () => {
        const off = Math.hypot((r.camX - c0[0]) * r.zoom, (r.camY - c0[1]) * r.zoom);
        samples.push([Math.round(performance.now() - t0), +off.toFixed(2)]);
        if (r.knock.busy) busy++;
        if (performance.now() - t0 < 1200) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    const moved = samples.filter(([, v]) => v > 0.5);
    return { rm, hullMax: s.you?.hullMax, max: Math.max(...samples.map(([, v]) => v)), lastMs: moved.length ? moved.at(-1)[0] : 0, frames: samples.length, busy, samples: samples.slice(0, 6) };
  }, dmg);
}
// (adrift and still, far from the fight: what moves the camera is the knock alone)
const hm = await p.evaluate(() => globalThis.gravetide.state.you?.hullMax ?? 1000);
for (const share of [0.01, 0.05, 0.12]) { L.log(tag, `hit ${Math.round(share * 100)}%`, JSON.stringify(await knock(Math.round(hm * share)))); await sleep(800); }
await p.evaluate(async () => (await import('/src/settings.ts')).update({ reduceMotion: true }));
await sleep(500);
L.log(tag, 'hit 12% reduce', JSON.stringify(await knock(Math.round(hm * 0.12))));
await p.evaluate(async () => (await import('/src/settings.ts')).update({ reduceMotion: false }));

// The wheel in a fight: a pirate off the beam again, the view out, then one notch out and one in — the zoom the way
// the wheel goes at once, and hers after the fight.
if (!touch) {
  await say(`/foe pirate sloop ${BEAM}`, 1500);
  const id2 = await laid(BEAM);
  await p.evaluate((x) => globalThis.gravetide.target(x), id2);
  await sleep(6000);
  // (the open sea left of her, under no window or card: the wheel is the game canvas's)
  const cv = await p.evaluate(() => { const r = globalThis.gravetide.renderer; for (const [fx, fy] of [[0.3, 0.5], [0.3, 0.3], [0.6, 0.3], [0.5, 0.7]]) { const x = innerWidth * fx, y = innerHeight * fy; if (document.elementFromPoint(x, y) === r.canvas) return { x, y }; } return { x: innerWidth * 0.3, y: innerHeight * 0.5 }; });
  await p.mouse.move(cv.x, cv.y);
  const z0 = (await cam(id2)).zoom;
  await p.mouse.wheel(0, 120);
  await sleep(500);
  const z1 = (await cam(id2)).zoom;
  await p.mouse.wheel(0, -120);
  await sleep(500);
  const z2 = (await cam(id2)).zoom;
  L.log(tag, 'wheel', `zoom ${z0} → out ${z1} → in ${z2}`, JSON.stringify(await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const r = globalThis.gravetide.renderer; return { at: `${e?.tagName}#${e?.id}.${e?.className}`, isCanvas: e === r.canvas, target: r.targetZoom, user: r.fight.user, fw: r.fight.w, modal: !!document.querySelector('#modal:not(.hidden)'), sheet: !!document.querySelector('.k-sheet-root') }; }, [cv.x, cv.y])));
}
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify({ at: new Date().toISOString(), size: [W, H], lang, touch, base, first, run, back }, null, 1));
await b.close();
