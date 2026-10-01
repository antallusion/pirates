// docs/18 VI item 48: the server's tick with everything of docs/18 awake — the islands of section III (+45% on the
// game's seed), forty bot captains under way across five waters, each with creatures in her army (fed, their hunger
// looked at), their lairs seen and their cards reckoned, a drift sighted for each and the season's legend on the water,
// four battles ashore going on, the sea director awake. Blocks of ticks with the lairs and the drifts awake and kept
// still in turn (A/B mixed, so the machine's own drift falls on both alike); the median and the mean ms a tick.
//   node tools/bench-h7.ts [ticks]

import { armyForLevel } from '../shared/src/data/army.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietDrifts, sightNow } from '../server/src/game/drifts.ts';
import { quietLairs } from '../server/src/game/beastlairs.ts';
import { join, makeGame, onHull } from '../tests/helpers.ts';

const TICKS = Math.max(400, Number(process.argv[2] ?? 2400));
const { game } = makeGame();
quietAdv(game, false);
game.directorOn = true;
const regions = ['gravewater', 'whispering', 'black_coast', 'ashen_isles', 'leviathan_reach'];
const sessions = [];
for (let i = 0; i < 40; i++) {
  const name = `Bench ${i}`;
  join(game, name);
  const s = game.sessionByName(name)!;
  sessions.push(s);
  onHull(game, s.ship!, 'brig', 4 + (i % 4));
  s.ship!.setArmy(armyForLevel(5, Math.round(s.ship!.stats.crewMax * 0.6), s.ship!.armySlots - 2, 'player'));
  if (i < 12) {
    // A dozen off the lairs of the islands (their cards reckoned every second), four of them ashore in battle.
    runAdmin(game, s, '/lair crab_beach go');
    if (i < 4) runAdmin(game, s, '/lair crab_beach fight');
  } else {
    runAdmin(game, s, `/tp ${regions[i % regions.length]}`);
    s.ship!.state.x += (i % 8) * 900;
    s.ship!.state.y += Math.floor(i / 8) * 900;
    s.ship!.input = { rudder: 0.05, sailTarget: 0.6 };
  }
  runAdmin(game, s, '/creature seal 12');
  runAdmin(game, s, '/creature mermaid 4');
  s.ship!.cargo.fish = 400;
  if (i >= 12) sightNow(game, s);
}
runAdmin(game, sessions[20], '/drift whale go');

const block = 100;
const t: Record<'on' | 'off', number[]> = { on: [], off: [] };
for (let i = 0; i < 200; i++) game.step(); // warm
for (let k = 0; k < TICKS / block; k++) {
  const on = k % 2 === 0;
  quietDrifts(game, !on);
  quietLairs(game, !on);
  const t0 = performance.now();
  for (let i = 0; i < block; i++) game.step();
  t[on ? 'on' : 'off'].push((performance.now() - t0) / block);
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const range = (a: number[]) => `${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)}`;
console.log(`islands ${game.world.islands.length}, captains ${game.sessions.size}, ticks ${TICKS} (blocks of ${block})`);
console.log(`docs/18 awake (lairs, drifts, battles ashore): median ${median(t.on).toFixed(2)} ms, mean ${mean(t.on).toFixed(2)} ms (${range(t.on)})`);
console.log(`docs/18 kept still:                          median ${median(t.off).toFixed(2)} ms, mean ${mean(t.off).toFixed(2)} ms (${range(t.off)})`);
