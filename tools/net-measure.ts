// Snapshot bandwidth per player at sea (docs/33 §Сеть): one observer and N other captains sailing around her within
// a few hundred metres to ~2 km, everyone steering, the odd broadside. Counts what the observer's socket receives —
// binary snapshots and JSON text separately — over a steady minute of game time (no sockets: the in-memory game of
// the tests, so the numbers are the protocol's own, not the network's).
//
//   node tools/net-measure.ts [--ships 20] [--seconds 60] [--fire] [--types]

import { join, makeGame, steps, FakeConn } from '../tests/helpers.ts';
import { TICK_RATE } from '../shared/src/constants.ts';
import type { RegionId } from '../shared/src/world/regions.ts';

const arg = (k: string, d: number) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg('ships', 20), SECONDS = arg('seconds', 60), FIRE = process.argv.includes('--fire');

const { game } = makeGame();
const conns: FakeConn[] = [];
for (let i = 0; i <= N; i++) conns.push(join(game, `Wake ${i}`));
const sessions = conns.map((_, i) => game.sessionByName(`Wake ${i}`)!);
const me = sessions[0].ship!;
const cx = me.state.x + 3000, cy = me.state.y + 3000; // open water off the start
const region = me.region as RegionId;
let rng = 7;
const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
sessions.forEach((s, i) => {
  const sh = s.ship!;
  sh.docked = null; s.profile!.docked = null;
  const a = rnd() * Math.PI * 2, r = i === 0 ? 0 : 150 + rnd() * 1800;
  sh.state.x = cx + Math.cos(a) * r; sh.state.y = cy + Math.sin(a) * r; sh.state.heading = rnd() * 6.28; sh.region = region;
  sh.protectedUntil = 0;
});
steps(game, TICK_RATE * 2);
const bytes = () => { const c = conns[0] as FakeConn & { textBytes?: number }; return { bin: c.bytesOut, text: c.textBytes ?? 0 }; };
// Count the text the observer gets too.
const c0 = conns[0] as FakeConn & { textBytes: number };
c0.textBytes = 0;
const send0 = c0.send.bind(c0);
const byType: Record<string, number> = {};
c0.send = (t: string) => { const n = Buffer.byteLength(t); c0.textBytes += n; const k = (/"t":"([a-z_]+)"/.exec(t) ?? [])[1] ?? "?"; byType[k] = (byType[k] ?? 0) + n; send0(t); };
let nSnaps = 0, nRows = 0;
const bin0 = c0.sendBinary.bind(c0);
c0.sendBinary = (b: Uint8Array) => { bin0(b); const m = c0.inbox[c0.inbox.length - 1]; if (m.t === 'snap') { nSnaps++; nRows += m.ships.length; } };
const before = bytes();
let seq = 0;
const t0 = performance.now();
for (let t = 0; t < SECONDS * TICK_RATE; t++) {
  if (t % 2 === 0) {
    seq++;
    conns.forEach((c, i) => {
      c.push({ t: 'input', seq, rudder: Math.round(Math.sin((seq + i * 13) / 25) * 100) / 100, sail: 3 });
      if (FIRE && (seq + i * 7) % 120 === 0) c.push({ t: 'fire', side: i % 2 ? 'port' : 'starboard', dist: 300 });
    });
    for (const c of conns) if (c.inbox.length > 400) c.inbox.splice(0, c.inbox.length - 100); // keep memory flat
  }
  game.step();
}
const ms = performance.now() - t0;
const after = bytes();
const out = {
  ships: N, seconds: SECONDS,
  binBytesPerSec: Math.round((after.bin - before.bin) / SECONDS),
  textBytesPerSec: Math.round((after.text - before.text) / SECONDS),
  totalBytesPerSec: Math.round((after.bin - before.bin + after.text - before.text) / SECONDS),
  snapsPerSec: Math.round((nSnaps / SECONDS) * 10) / 10,
  avgRowsPerSnap: Math.round((nRows / Math.max(1, nSnaps)) * 10) / 10,
  tickMs: Math.round((ms / (SECONDS * TICK_RATE)) * 100) / 100,
};
console.log(JSON.stringify({ ...out, binPerSnap: Math.round((after.bin - before.bin) / Math.max(1, nSnaps)), observer: { docked: sessions[0].ship?.docked ?? null, hull: Math.round(sessions[0].ship?.hull ?? 0), x: Math.round(sessions[0].ship?.state.x ?? 0) - Math.round(cx), y: Math.round(sessions[0].ship?.state.y ?? 0) - Math.round(cy), snapEvery: sessions[0].snapEvery } }));
if (process.argv.includes("--types")) console.log(Object.fromEntries(Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / SECONDS)])));
