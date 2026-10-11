// A close look (seaux QA): a castaway and a piece of her wreckage in view, the course and ring after a tap on each.
// Run: GPORT=58994 node tools/mobile/seaux/look.mjs 844x390
import * as L from '../m0/lib.mjs';
const [W, H] = (process.argv[2] ?? '844x390').split('x').map(Number);
const touch = W < 1000;
const sleep = L.sleep;
const b = await L.browser();
const p = await L.page(b, [W, H], { touch });
await L.login(p, { port: Number(process.env.GPORT ?? 58994), know: true, name: `Lk${Math.random().toString(36).slice(2, 6)}` });
const film = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(3000); await film(); }
await L.say(p, '/tp 21000 70000'); await sleep(2500); await film();
await p.evaluate(() => globalThis.gravetide.open(null));
await L.say(p, '/army deckhand 5'); await sleep(800);
await L.say(p, '/castaway 3'); await sleep(1500);
const c = await p.evaluate(() => globalThis.gravetide.state.castaways[0]);
if (c) { await L.say(p, `/tp ${c.x - 160} ${c.y + 40}`); await sleep(2500); }
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-castaway-close.png` });
const s = await p.evaluate(() => { const st = globalThis.gravetide.state, r = globalThis.gravetide.renderer, k = st.castaways[0]; return k ? { sx: r.sx(k.x), sy: r.sy(k.y) } : null; });
if (s) { if (touch) await p.touchscreen.tap(s.sx, s.sy); else await p.mouse.click(s.sx, s.sy); }
await sleep(700);
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-castaway-tap.png` });
await sleep(9000);
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-castaway-hauled.png` });
const w = await p.evaluate(() => { const st = globalThis.gravetide.state, o = st.ownDisplay; return st.wrecks.map((x) => ({ ...x, d: Math.hypot(x.x - o.x, x.y - o.y) })).sort((a, b) => a.d - b.d)[0]; });
if (w) { await L.say(p, `/tp ${w.x - 200} ${w.y + 60}`); await sleep(2500); }
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-wreck-close.png` });
const ws = await p.evaluate(() => { const st = globalThis.gravetide.state, r = globalThis.gravetide.renderer, o = st.ownDisplay; const k = st.wrecks.map((x) => ({ ...x, d: Math.hypot(x.x - o.x, x.y - o.y) })).sort((a, b) => a.d - b.d)[0]; return k ? { sx: r.sx(k.x), sy: r.sy(k.y), id: k.id } : null; });
if (ws) { if (touch) await p.touchscreen.tap(ws.sx, ws.sy); else await p.mouse.click(ws.sx, ws.sy); }
await sleep(700);
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-wreck-tap.png` });
await sleep(10000);
console.log(JSON.stringify({ c, s, w: w && { id: w.id, value: w.value }, ws, taken: await p.evaluate((id) => !globalThis.gravetide.state.wrecks.some((x) => x.id === id), ws?.id), toasts: await L.toasts(p), errors: p.errors }));
await p.screenshot({ path: `docs/img/seaux/${W}x${H}-wreck-taken-close.png` });
await b.close();
