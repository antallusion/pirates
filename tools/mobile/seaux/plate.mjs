// The «Застава» plate (seaux QA): a pirate hold-out as her mark; its name's lines measured. Run: GPORT=58994 node tools/mobile/seaux/plate.mjs 844x390,480x270
import * as L from '../m0/lib.mjs';
const sleep = L.sleep;
const b = await L.browser();
for (const [W, H] of (process.argv[2] ?? '844x390,480x270').split(',').map((s) => s.split('x').map(Number))) {
  const touch = W < 1000;
  const p = await L.page(b, [W, H], { touch });
  await L.login(p, { port: Number(process.env.GPORT ?? 58994), know: true, name: `Pl${Math.random().toString(36).slice(2, 6)}` });
  const film = () => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
  if (await p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt)) { await L.send(p, { t: 'undock' }); await sleep(3000); await film(); }
  await L.say(p, '/god'); await sleep(500);
  await L.say(p, '/guard go holdout'); await sleep(4000); await film();
  await p.evaluate(() => globalThis.gravetide.open(null));
  // her mark: the hold-out's ship
  const id = await p.evaluate(() => { const s = globalThis.gravetide.state, o = s.ownDisplay; let best = null, bd = 1e9; for (const sh of s.ships.values()) { if (sh.id === s.entityId || !sh.info) continue; const d = Math.hypot(sh.cur.x - o.x, sh.cur.y - o.y); if (d < bd) { bd = d; best = sh.id; } } return best; });
  if (id !== null) await p.evaluate((x) => globalThis.gravetide.target(x), id);
  await sleep(1500);
  const r = await p.evaluate(() => { const n = document.querySelector('#tc-target .k-target-name'); if (!n || !n.getBoundingClientRect().width) return null; const cs = getComputedStyle(n); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2; const rr = n.getBoundingClientRect(); return { text: n.textContent, w: Math.round(rr.width), h: Math.round(rr.height), lines: Math.round(rr.height / lh), plate: Math.round(document.querySelector('#tc-target .k-target').getBoundingClientRect().width), col: Math.round(document.getElementById('hud-stack').getBoundingClientRect().width) }; });
  await p.screenshot({ path: `docs/img/seaux/${W}x${H}-plate-holdout.png` });
  console.log(W, H, JSON.stringify(r));
  await p.ctx.close();
}
await b.close();
