// The tick with the sea's helms at work (2026-10-09): forty captains in two crowds of twenty in the dense sea (reefs,
// stacks and hulks thick about them), a third of them under «Атаковать» on a pirate of the sea a little way off, a third
// on the helmsman's run to a mark two kilometres off past what lies there, a third under way by hand; the sea's own
// ships awake about them. Prints the mean and median ms a tick (blocks of 100 after a warm-up) and the profiler's laps.
//   node --disable-warning=ExperimentalWarning tools/nav/bench.ts [ticks]

import { join, makeGame, onHull } from '../../tests/helpers.ts';
import { spawnPirate } from '../../server/src/game/npc.ts';
import { startPursuit } from '../../server/src/game/pursuit.ts';
import { openAt } from './harness.ts';

const TICKS = Math.max(400, Number(process.argv[2] ?? 1600));
const { game } = makeGame();
game.directorOn = true;
const w = game.world;
// Two crowds of twenty in the dense sea: open water about two reefs, within three kilometres of each.
const spots: { x: number; y: number }[] = [];
for (const c of [w.reefs[40], w.reefs[200]]) {
  for (let i = 0, got = 0; got < 20 && i < 2000; i++) {
    const a = i * 2.399, r = 400 + ((i * 97) % 2600);
    const x = c.x + Math.sin(a) * r, y = c.y - Math.cos(a) * r;
    if (openAt(w, x, y, 80) && spots.every((s) => Math.hypot(s.x - x, s.y - y) > 350)) {
      spots.push({ x, y });
      got++;
    }
  }
}
const sessions = spots.map((p, i) => {
  const name = `Bench Helm ${i}`;
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  s.profile!.level = 30;
  onHull(game, ship, ['brig', 'frigate', 'brigantine', 'schooner'][i % 4], 5);
  ship.state = { ...ship.state, x: p.x, y: p.y, heading: i, speed: ship.stats.maxSpeed * 0.6, sail: 0.75, rudder: 0 };
  ship.input = { rudder: 0.05, sailTarget: 0.75 };
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, p.x, p.y);
  c.send = () => {};
  c.sendBinary = () => {};
  return { s, c, p };
});
for (let i = 0; i < 60; i++) game.step();
for (const [i, { s, c, p }] of sessions.entries()) {
  const ship = s.ship!;
  if (i % 3 === 0) {
    const pir = spawnPirate(game, ship);
    if (pir) {
      pir.state.x = p.x + 700;
      pir.state.y = p.y;
      game.grid.upsert(pir.id, pir.state.x, pir.state.y);
      startPursuit(game, s, pir.id, i % 2 ? 'guns' : 'board');
    }
  } else if (i % 3 === 1) {
    c.push({ t: 'autosail', x: Math.round(p.x + Math.sin(i) * 2200), y: Math.round(p.y - Math.cos(i) * 2200), sail: 4 });
  }
}
for (let i = 0; i < 100; i++) game.step(); // warm
const blocks: number[] = [];
for (let k = 0; k < TICKS / 100; k++) {
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) game.step();
  blocks.push((performance.now() - t0) / 100);
}
const mean = blocks.reduce((a, b) => a + b, 0) / blocks.length;
const sorted = [...blocks].sort((a, b) => a - b);
const rep = game.prof.report();
console.log(Object.entries(rep).slice(0, 8).map(([k, v]) => `${k} ${v.avgMs}`).join(' · '));
console.log(`ticks ${TICKS}, ${sessions.length} captains, ${game.ships.size} ships: ${mean.toFixed(2)} ms a tick (blocks ${sorted[0].toFixed(2)}–${sorted[sorted.length - 1].toFixed(2)}, median ${sorted[sorted.length >> 1].toFixed(2)})`);
