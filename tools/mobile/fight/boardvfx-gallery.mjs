// docs/25 §3: the boarding's looks one by one on a live field (the panel's own effect methods called in the page, the
// battle itself untouched): the six paths' ultimates, the six schools of orders, a fall inland and two over the side,
// steel's sparks, a blast, and the water between the hulls close up — each shot mid-effect.
//
//   GPORT=58980 SIZE=1500x600 WEATHER=breeze HOUR=12 OUT=docs/img/boardvfx TAG=gal node tools/mobile/fight/boardvfx-gallery.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '1500x600').split('x').map(Number);
const touch = process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000;
const OUT = process.env.OUT ?? 'assets/raw/boardvfx';
const TAG = `${process.env.TAG ?? 'gal'}_${W}x${H}${process.env.WEATHER ? `_${process.env.WEATHER}` : ''}${process.env.HOUR ? `_h${process.env.HOUR}` : ''}`;
mkdirSync(OUT, { recursive: true });
const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru', touch });
const sleep = L.sleep;
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
await L.login(p, { port: Number(process.env.GPORT ?? 58980), name: 'Галерея' + Math.random().toString(36).slice(2, 6), know: true });
if (process.env.REDUCE === '1') await p.evaluate(async () => (await import('/src/settings.ts')).update({ reduceMotion: true }));
await say('/level 30');
await say('/ship frigate 5', 1500);
await say('/army level 5');
await L.closeAll(p, 3);
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); }
await say('/tp gravewater', 2500);
if (process.env.WEATHER) await say(`/weather ${process.env.WEATHER}`);
if (process.env.HOUR) await say(`/time ${process.env.HOUR}`);
await L.closeAll(p, 2);
await sleep(2000);
await say('/board pirate frigate', 3000);
for (let i = 0; i < 80; i++) { if (await p.evaluate(() => !!globalThis.gravetide.state.boardTac?.mine)) break; await sleep(500); }
await sleep(2000);
// Hold the battle's clock still for the gallery: her turn's clock is long, and nothing is sent.
const shot = (name) => p.screenshot({ path: `${OUT}/${TAG}_${name}.png` });
const run = (fn, arg) => p.evaluate(fn, arg);

// The water between the hulls, close up.
const gap = await run(() => { const t = globalThis.gravetide.tactical; const g = t.gap; if (!g) return null; const [A, B, C, D, E, F] = t.xf(); const pts = [[g.x0, g.y0], [g.x1, g.y1]].map(([x, y]) => [A * x + C * y + E, B * x + D * y + F]); const r = t.canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(pts[0][0], pts[1][0]) - 60 + r.left), y: Math.max(0, Math.min(pts[0][1], pts[1][1]) + r.top), w: Math.abs(pts[1][0] - pts[0][0]) + 120, h: Math.min(260, Math.abs(pts[1][1] - pts[0][1])) }; });
if (gap) await p.screenshot({ path: `${OUT}/${TAG}_water.png`, clip: { x: Math.round(gap.x), y: Math.round(gap.y), width: Math.round(gap.w), height: Math.round(gap.h) } });

// The six ultimates, each at its height.
for (const path of ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral']) {
  await run((pa) => {
    const t = globalThis.gravetide.tactical, v = globalThis.gravetide.state.boardTac;
    const foes = v.stacks.filter((s) => s.side !== v.you).map((s) => t.center(s.hex));
    const now = performance.now();
    t.pathFx.push({ path: pa, ult: true, mine: true, t0: now, at: foes });
    t.ultBurst(pa, v.you, now, foes, v);
  }, path);
  await sleep(700);
  await shot(`ult_${path}`);
  await sleep(1900);
}
// The six schools, each on her foes.
for (const school of ['fire', 'wind', 'water', 'steel', 'board', 'fog']) {
  await run((sc) => {
    const t = globalThis.gravetide.tactical, v = globalThis.gravetide.state.boardTac;
    const foes = v.stacks.filter((s) => s.side !== v.you).slice(0, 4).map((s) => t.center(s.hex));
    const now = performance.now();
    t.charges.push({ side: v.you, t0: now, rgb: '255,200,120' });
    t.heroStep(v.you, now);
    t.schoolLook(sc, foes, now + 300, t.size.w);
  }, school);
  await sleep(550);
  await shot(`school_${school}`);
  await sleep(1200);
}
// Steel's sparks and a parry, a blast with its soot, then the falls: one inland, the rest at the deck's edges.
await run(() => {
  const t = globalThis.gravetide.tactical, v = globalThis.gravetide.state.boardTac;
  const [a, f] = [v.stacks.find((s) => s.side === v.you), v.stacks.find((s) => s.side !== v.you)];
  const now = performance.now(), w = t.size.w;
  t.steel(t.center(f.hex), t.center(a.hex), now + 100, now, w);
  t.shake.kick(now + 100, 0.08, 1, 0);
  t.clock.stop(now + 100, 80);
  const b = v.stacks.filter((s) => s.side !== v.you)[1] ?? f;
  t.bursts.push({ id: 'part.explosion', x: t.center(b.hex).x, y: t.center(b.hex).y, t0: now + 200, size: w * 1.4 });
  t.blast(t.center(b.hex), now + 200, w, b.hex, 99);
});
await sleep(250);
await shot('steel');
await sleep(1500);
const falls = await run(() => {
  const t = globalThis.gravetide.tactical, v = globalThis.gravetide.state.boardTac;
  const edge = v.stacks.filter((s) => t.overboardTo(s, v));
  const inland = v.stacks.filter((s) => !t.overboardTo(s, v));
  const now = performance.now();
  const out = [];
  for (const s of [...edge.slice(0, 2), ...inland.slice(0, 1)]) {
    t.fallen.set(100000 + s.id, { s: { ...s, id: 100000 + s.id }, at: now });
    out.push({ id: s.id, hex: s.hex, over: !!t.overboardTo(s, v) });
  }
  return out;
});
for (const at of [250, 600]) {
  await sleep(at === 250 ? 250 : 350);
  await shot(`fall_${at}`);
}
await sleep(1500);
await shot('after');
const st = await run(() => globalThis.gravetide.tactical.fxStats());
console.log(JSON.stringify({ tag: TAG, falls, decals: st.decals, tally: st.tally, still: st.still, errors: p.errors }));
await b.close();
