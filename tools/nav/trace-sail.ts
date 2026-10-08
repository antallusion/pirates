// One of the helmsman's runs traced (tools/nav/harness.ts sailScenes): her route and every few seconds where she is.
//   node --disable-warning=ExperimentalWarning tools/nav/trace-sail.ts <kind> <n> [--per 7] [--every 5]
import { makeGame } from '../../tests/helpers.ts';
import { autosailOf } from '../../server/src/game/autosail.ts';
import { sailRun, sailScenes } from './harness.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const { game } = makeGame();
const list = sailScenes(game.world, Number(arg('per', '7'))).filter((s) => s.kind === process.argv[2]);
const sc = list[Number(process.argv[3] ?? 0)];
console.log(sc.kind, sc.of, 'from', sc.from.x | 0, sc.from.y | 0, 'to', sc.to.x | 0, sc.to.y | 0);
const every = Number(arg('every', '5'));
let next = 0, shown = false;
const step = game.step.bind(game);
game.step = (...a: Parameters<typeof game.step>) => {
  const r = step(...a);
  for (const s of game.sessions) {
    const ship = s.ship;
    const run = autosailOf(ship);
    if (!ship || !run) continue;
    if (!shown) {
      shown = true;
      console.log('route', JSON.stringify(run.path.map(([x, y]) => [x | 0, y | 0])));
    }
    if (game.now >= next) {
      next = game.now + every;
      console.log(`t ${game.now.toFixed(0)} at ${ship.state.x | 0},${ship.state.y | 0} h ${(ship.state.heading * 57.3) | 0} v ${ship.state.speed.toFixed(1)} wp ${run.i} → ${run.path[run.i].map((v) => v | 0)} left ${Math.hypot(sc.to.x - ship.state.x, sc.to.y - ship.state.y) | 0}`);
    }
  }
  return r;
};
console.log(JSON.stringify(sailRun(game, sc)));
