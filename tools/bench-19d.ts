// docs/19 D6: the server's tick at the doubled sea — the world's own ships booted (QUOTA), forty bot captains under
// way across the waters with the sea director, the sea's small life and the local traffic about each of them awake, the
// adventure map's guards in the water, the boats at the dense sea's marks. Warmed until the traffic about them has
// filled, then the median, the mean and the 95th percentile ms a tick (and the ships the sea keeps).
//   node tools/bench-19d.ts [ticks] [captains]

import { armyForLevel } from '../shared/src/data/army.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { localTraffic } from '../server/src/game/traffic.ts';
import { join, makeGame, onHull } from '../tests/helpers.ts';

const TICKS = Math.max(200, Number(process.argv[2] ?? 1200));
const N = Math.max(1, Number(process.argv[3] ?? 40));
const { game } = makeGame();
quietAdv(game, false);
game.bootPopulation();
game.directorOn = true;
const regions = ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown'];
for (let i = 0; i < N; i++) {
  const name = `Bench ${i}`;
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 3 + (i % 6));
  s.ship!.setArmy(armyForLevel(5, Math.round(s.ship!.stats.crewMax * 0.6), s.ship!.armySlots - 2, 'player'));
  runAdmin(game, s, `/tp ${regions[i % regions.length]}`);
  s.ship!.state.x += (i % 6) * 2500;
  s.ship!.state.y += Math.floor(i / 6) * 1800;
  s.ship!.input = { rudder: 0.04, sailTarget: 0.7 };
  if (s.profile?.tutorial) s.profile.tutorial.on = false; // past the First Watch: the whole sea's traffic
}
const t0 = performance.now();
for (let i = 0; i < 600; i++) game.step(); // warm: a minute of the sea, the traffic about them filled
const warm = performance.now() - t0;
const ms: number[] = [];
for (let i = 0; i < TICKS; i++) {
  const a = performance.now();
  game.step();
  ms.push(performance.now() - a);
}
const sorted = [...ms].sort((x, y) => x - y);
const mean = ms.reduce((x, y) => x + y, 0) / ms.length;
const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
let active = 0;
for (const b of game.npcs.values()) if (b.active) active++;
console.log(`captains ${game.sessions.size}, ships ${game.ships.size} (NPC ${game.npcs.size}, awake ${active}, local traffic ${localTraffic(game).size}), marks ${game.world.marks.length}, warm ${(warm / 600).toFixed(2)} ms/tick`);
console.log(`tick: median ${q(0.5).toFixed(2)} ms, mean ${mean.toFixed(2)} ms, p95 ${q(0.95).toFixed(2)} ms, max ${sorted[sorted.length - 1].toFixed(2)} ms over ${TICKS} ticks`);
const rep = game.prof.report();
console.log(Object.entries(rep).slice(0, 8).map(([k, v]) => `${k} ${v.avgMs.toFixed(2)}`).join(' · '));
