// docs/25 §3: what each of the boarding's looks costs a phone's frame (812×375, swiftshader) — her turn standing still,
// the frame rate with all of them, and with each switched off in turn (the panel's own methods stubbed in the page).
//
//   GPORT=58980 SIZE=812x375 node tools/mobile/fight/boardvfx-cost.mjs
import * as L from '../m0/lib.mjs';

const [W, H] = (process.env.SIZE ?? '812x375').split('x').map(Number);
const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
const sleep = L.sleep;
const say = async (line, ms = 900) => { await L.say(p, line); await sleep(ms); };
await L.login(p, { port: Number(process.env.GPORT ?? 58980), name: 'Цена' + Math.random().toString(36).slice(2, 6), know: true });
await say('/level 30');
await say('/ship frigate 5', 1500);
await say('/army level 5');
await L.closeAll(p, 3);
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(2500); }
await say('/tp gravewater', 2500);
await say('/weather breeze');
await say('/time 12');
await L.closeAll(p, 2);
await sleep(2000);
await say('/board pirate frigate', 3000);
for (let i = 0; i < 60; i++) { if (await p.evaluate(() => !!globalThis.gravetide.state.boardTac?.mine)) break; await sleep(500); }
await sleep(2500);
const fps = (ms) => p.evaluate((len) => new Promise((done) => { const ts = []; const t0 = performance.now(); const f = (t) => { ts.push(t); if (t - t0 < len) requestAnimationFrame(f); else done(+((ts.length - 1) / ((ts.at(-1) - ts[0]) / 1000)).toFixed(2)); }; requestAnimationFrame(f); }), ms);
const stub = (names) => p.evaluate((ns) => { const t = globalThis.gravetide.tactical; t.__keep ??= {}; for (const n of ns) { if (n === '@sea') { t.__sea = t.seaLayer; t.seaLayer = null; continue; } if (n === '@parts') { t.__pd = t.parts.draw; t.parts.draw = () => {}; continue; } if (!t.__keep[n]) t.__keep[n] = t[n]; t[n] = () => {}; } }, names);
const restore = () => p.evaluate(() => { const t = globalThis.gravetide.tactical; for (const [n, f] of Object.entries(t.__keep ?? {})) t[n] = f; t.__keep = {}; if (t.__sea) { t.seaLayer = t.__sea; t.__sea = null; } if (t.__pd) { t.parts.draw = t.__pd; t.__pd = null; } });
const rows = [];
for (const [label, names] of [['all', []], ['no water', ['water']], ['no planks', ['livePlanks']], ['no decks blit', ['deckBlit']], ['single painting (no layers)', ['@sea']], ['no particles', ['@parts']], ['all', []]]) {
  await restore();
  if (names.length) await stub(names);
  await sleep(500);
  const a = await fps(5000), c = await fps(5000);
  rows.push([label, a, c]);
  L.log(label, a, c);
}
await restore();
console.log(JSON.stringify(rows));
await b.close();
