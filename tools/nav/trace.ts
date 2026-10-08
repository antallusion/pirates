// One chase traced (tools/nav/harness.ts): every second her distance, way, heading and the least water her hull keeps.
//   node --disable-warning=ExperimentalWarning tools/nav/trace.ts <scene index> [captain|npc] [--per 7]
import { hullClearance } from '../../shared/src/sim/hull.ts';
import type { Blocker } from '../../shared/src/sim/hull.ts';
import { blockersNear } from '../../shared/src/world/solids.ts';
import { reefDepthAt } from '../../shared/src/world/worldgen.ts';
import { makeGame } from '../../tests/helpers.ts';
import { chaseRun, chaseScenes } from './harness.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const { game } = makeGame();
const scenes = chaseScenes(game.world, Number(arg('per', '7')));
const k = Number(process.argv[2] ?? 0);
const who = (['npc', 'guns'].includes(process.argv[3]) ? process.argv[3] : 'captain') as 'captain' | 'guns' | 'npc';
const sc = scenes[k];
console.log(sc.kind, sc.of, JSON.stringify(sc.me), JSON.stringify(sc.route.map(([x, y]) => [x | 0, y | 0])));
let next = 0;
const near: Blocker[] = [];
const r = chaseRun(game, sc, who, sc.kind === 'reef' ? 'frigate' : 'brig', Number(arg('secs', '60')), (t, me, T, d) => {
  if (t < next) return;
  next = t + 1;
  blockersNear(game.world, me.state.x, me.state.y, me.stats.length, near);
  const cl = hullClearance(me.state, me.stats.length, me.stats.beam, near);
  console.log(`t ${t.toFixed(1)} me ${me.state.x | 0},${me.state.y | 0} h ${(me.state.heading * 57.3) | 0} v ${me.state.speed.toFixed(1)} T ${T.state.x | 0},${T.state.y | 0} v ${T.state.speed.toFixed(1)} d ${d | 0} clear ${Number.isFinite(cl) ? cl.toFixed(0) : '-'} reef ${reefDepthAt(game.world, me.state.x, me.state.y).toFixed(1)}`);
});
console.log(JSON.stringify(r));
