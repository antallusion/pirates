// docs/19 D7: the tick with the roaming stacks about forty bot captains, A/B in one process: the doubled sea of
// tools/bench-19d.ts (the world's ships booted, the director, the sea's small life and traffic, the adventure map),
// blocks of ticks with the stacks awake and kept still, interleaved; the median of each.
//   node tools/bench-19d7.ts [blocks] [captains]

import { armyForLevel } from '../shared/src/data/army.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietRoamers } from '../server/src/game/roamers.ts';
import { join, makeGame, onHull } from '../tests/helpers.ts';

const BLOCKS = Math.max(2, Number(process.argv[2] ?? 8));
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
  if (s.profile?.tutorial) s.profile.tutorial.on = false;
}
for (let i = 0; i < 600; i++) game.step();
const on: number[] = [], off: number[] = [];
for (let b = 0; b < BLOCKS * 2; b++) {
  const awake = b % 2 === 0;
  quietRoamers(game, !awake);
  for (let i = 0; i < 200; i++) {
    const a = performance.now();
    game.step();
    (awake ? on : off).push(performance.now() - a);
  }
}
const med = (x: number[]) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
const mean = (x: number[]) => x.reduce((p, q) => p + q, 0) / x.length;
console.log(`captains ${N}, ships ${game.ships.size}`);
console.log(`stacks awake: median ${med(on).toFixed(2)} ms, mean ${mean(on).toFixed(2)} ms · kept still: median ${med(off).toFixed(2)} ms, mean ${mean(off).toFixed(2)} ms`);
