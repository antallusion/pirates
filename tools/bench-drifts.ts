// docs/18 IV, the tick with the drifts (VI #48's measure): forty captains under way across the sea, each with
// creatures in her army (their food eaten with the crew's, their hunger looked at), the sea director awake, a drift
// sighted for every captain and the season's legend on the water; blocks of ticks with the drifts awake and kept still
// in turn (A/B mixed, so the machine's own drift falls on both alike). Prints the mean ms a tick of each.
//   node tools/bench-drifts.ts [ticks]

import { armyForLevel } from '../shared/src/data/army.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietDrifts, sightNow } from '../server/src/game/drifts.ts';
import { quietLairs } from '../server/src/game/beastlairs.ts';
import { join, makeGame, onHull } from '../tests/helpers.ts';

const TICKS = Math.max(200, Number(process.argv[2] ?? 1200));
const { game } = makeGame();
quietAdv(game, false);
quietLairs(game, true);
game.directorOn = true;
const regions = ['gravewater', 'whispering', 'black_coast', 'ashen_isles', 'leviathan_reach'];
for (let i = 0; i < 40; i++) {
  const name = `Bench ${i}`;
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 4 + (i % 4));
  s.ship!.setArmy(armyForLevel(5, Math.round(s.ship!.stats.crewMax * 0.6), s.ship!.armySlots - 2, 'player'));
  runAdmin(game, s, `/tp ${regions[i % regions.length]}`);
  s.ship!.state.x += (i % 8) * 900;
  s.ship!.state.y += Math.floor(i / 8) * 900;
  runAdmin(game, s, '/creature seal 12');
  runAdmin(game, s, '/creature mermaid 4');
  s.ship!.cargo.fish = 400;
  s.ship!.input = { rudder: 0.05, sailTarget: 0.6 };
  sightNow(game, s);
}
runAdmin(game, game.sessionByName('Bench 0')!, '/drift whale go');

const block = 100;
const t: Record<'on' | 'off', number[]> = { on: [], off: [] };
for (let i = 0; i < 100; i++) game.step(); // warm
for (let k = 0; k < TICKS / block; k++) {
  const on = k % 2 === 0;
  quietDrifts(game, !on);
  const t0 = performance.now();
  for (let i = 0; i < block; i++) game.step();
  t[on ? 'on' : 'off'].push((performance.now() - t0) / block);
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const range = (a: number[]) => `${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)}`;
console.log(`ticks ${TICKS}, drifts on: ${mean(t.on).toFixed(2)} ms (${range(t.on)}), off: ${mean(t.off).toFixed(2)} ms (${range(t.off)})`);
