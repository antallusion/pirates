// docs/25 §3 (2026-10-09, batch-boardvfx): the boarding's looks — a battle on a size, in a weather and an hour, its
// frame rate measured (her turn standing still, and the auto-battle playing blows), shot mid-effect (the opening, the
// blows, an ultimate, a kill, the end and its finale).
//
//   GPORT=58980 SIZE=812x375 LEVEL=30 WEATHER=rain HOUR=23 OUT=docs/img/boardvfx TAG=after node tools/mobile/fight/boardvfx.mjs
//   FPS=0: no frame rate; SHOTS=0: no pictures; ULT=0: no ultimate; END=0: not to the end; REDUCE=1: «меньше движения».
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/boardvfx';
const TAG = process.env.TAG ?? 'now';
const LEVEL = Number(process.env.LEVEL ?? 30);
const PATH_ID = process.env.PATH_ID ?? 'corsair';
const WEATHER = process.env.WEATHER ?? '';
const HOUR = process.env.HOUR ?? '';
const SHOTS = process.env.SHOTS !== '0';
const FPS = process.env.FPS !== '0';
mkdirSync(OUT, { recursive: true });
const tag = `${TAG}_${W}x${H}${WEATHER ? `_${WEATHER}` : ''}${HOUR ? `_h${HOUR}` : ''}${process.env.REDUCE === '1' ? '_calm' : ''}`;

const b = await L.browser();
const p = await L.page(b, [W, H], { lang, touch });
const sleep = L.sleep;
const skip = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const view = () => p.evaluate(() => { const t = globalThis.gravetide.state.boardTac; if (!t) return null; const me = t.heroes[t.you]; return { round: t.round, over: t.over, mine: !!t.mine, ult: me.ult ?? null, ultFrom: me.ultFrom ?? null, foes: t.stacks.filter((s) => s.side !== t.you).map((s) => s.id), busy: globalThis.gravetide.tactical.busy?.() ?? null }; });
async function waitFor(f, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; }
const stats = () => p.evaluate(() => globalThis.gravetide.tactical.fxStats?.() ?? null);
const shot = async (name) => { if (SHOTS) await p.screenshot({ path: `${OUT}/${tag}_${name}.png` }); };
const order = (a) => p.evaluate((x) => globalThis.gravetide.net.send({ t: 'tac', act: x }), a);

/** The frame rate over `ms` (requestAnimationFrame): frames a second, the middle and the 95th frame's length. */
const fps = (ms = 6000) => p.evaluate((len) => new Promise((done) => {
  const ts = []; const t0 = performance.now();
  const f = (t) => { ts.push(t); if (t - t0 < len) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, c) => a - c); done({ fps: +((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(2), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), frames: ts.length }); } };
  requestAnimationFrame(f);
}), ms);

const abc = lang === 'ru' ? 'абвгдежзиклмнопрстуфхэюя' : 'abcdefghiklmnoprstuvwxyz';
await L.login(p, { port: Number(process.env.GPORT ?? 58980), name: (lang === 'ru' ? 'Вид' : 'Look') + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''), know: true, captain: PATH_ID });
await skip();
if (process.env.REDUCE === '1') await p.evaluate(async () => (await import('/src/settings.ts')).update({ reduceMotion: true }));
await say(`/level ${LEVEL}`);
if (process.env.SHIP !== '0') await say(`/ship ${process.env.SHIP ?? `frigate ${Math.min(10, Math.ceil(LEVEL / 6))}`}`, 1500);
await say(`/army level ${process.env.ARMY ?? Math.min(10, Math.ceil(LEVEL / 6))}`);
for (let i = 0; i < 4; i++) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /^(Позже|Later)$/.test(x.textContent.trim())).forEach((x) => x.click()));
  await sleep(300);
}
await L.closeAll(p, 2);
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); await skip(); }
await say('/tp gravewater', 2500);
await L.closeAll(p, 2);
if (WEATHER) await say(`/weather ${WEATHER}`, 1500);
if (HOUR) await say(`/time ${HOUR}`, 1500);
await sleep(3000);
const sky = await p.evaluate(() => { const s = globalThis.gravetide.state; return { weather: s.weather, fog: s.fog, wind: s.wind }; });
await say(`/board ${process.env.FOE ?? 'pirate frigate'}`, 300);
// The opening: shot as it plays (the grapples, the planks falling, the first over).
const v0 = await waitFor(async () => view(), 30000, 120);
if (!v0) { console.log('no battle'); await b.close(); process.exit(1); }
const intro = [];
for (const at of [150, 600, 1100, 1700]) {
  await sleep(Math.max(0, at - (intro.at(-1)?.at ?? 0)));
  intro.push({ at, st: await stats() });
  await shot(`intro_${at}`);
}
await waitFor(async () => { await skip(); const v = await view(); return v && (v.mine || v.over); }, 30000);
await sleep(1500);
await skip();
const rec = { tag, sky, intro, errors: p.errors };
// Her turn, the field standing still: its frame rate.
if (FPS) rec.idle = await fps(6000);
rec.idleStats = await stats();
await shot('idle');
// Her round 1 spent on guard (her ultimate from round 2), then her ultimate at a foe.
if (process.env.ULT !== '0' && LEVEL >= 20) {
  await waitFor(async () => {
    await skip();
    const v = await view();
    if (!v || v.over || v.round >= 2) return v;
    if (v.mine) await order({ a: 'defend' });
    return null;
  }, 120000, 500);
  const v2 = await waitFor(async () => { await skip(); const v = await view(); return v && ((v.mine && !v.busy) || v.over) ? v : null; }, 40000);
  if (v2 && !v2.over && v2.ult === 'ready') {
    await order({ a: 'ult', target: v2.foes[0] });
    const ult = [];
    for (const at of [250, 700, 1300, 2000]) {
      await sleep(Math.max(0, at - (ult.at(-1)?.at ?? 0)));
      ult.push({ at, st: await stats() });
      await shot(`ult_${at}`);
    }
    rec.ult = ult;
  } else rec.ult = { skipped: v2 };
}
// The auto-battle to the end: the frame rate while blows play, pictures as they land, the end and its finale.
if (process.env.END !== '0') {
  await order({ a: 'auto', on: true });
  await sleep(800);
  if (FPS) rec.fight = await fps(8000);
  rec.fightStats = await stats();
  const blows = [];
  for (let i = 0; i < 14; i++) {
    const v = await view();
    if (!v || v.over) break;
    const st = await stats();
    blows.push(st);
    // A frame worth keeping: the field knocked, held, or a figure falling.
    if (st && (st.shake > 0.5 || st.stop || st.dying || st.overboard)) await shot(`blow_${i}`);
    else if (i % 4 === 0) await shot(`blow_${i}`);
    await sleep(450);
  }
  rec.blows = blows;
  const end = await waitFor(async () => { await skip(); const v = await view(); return v?.over ? v : null; }, 240000, 400);
  rec.over = end?.over ?? null;
  const fin = [];
  for (const at of [200, 900, 1700, 2600]) {
    await sleep(Math.max(0, at - (fin.at(-1)?.at ?? 0)));
    fin.push({ at, st: await stats() });
    await shot(`end_${at}`);
  }
  rec.finale = fin;
}
rec.errors = p.errors;
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rec, null, 1));
console.log(JSON.stringify({ tag, sky, idle: rec.idle, fight: rec.fight, ult: Array.isArray(rec.ult) ? rec.ult.map((u) => u.st) : rec.ult, over: rec.over, finale: rec.finale?.map((f) => f.st), errors: p.errors }));
await b.close();
