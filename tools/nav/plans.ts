// The helmsman's plans, sounded (2026-10-09): for each run of tools/nav/harness.ts sailScenes, the route the planner
// made before the solid things were known to it (2026-10-08: the grid's cells, the end on the nearest open cell) and
// the one it makes now (autosail.ts plan, nav.ts soundPath) — how many of their legs run over what her hull or her keel
// would strike (a hulk, a skerry, a pier, a reef, the coast's band), and how far from her mark each ends.
//   node --disable-warning=ExperimentalWarning tools/nav/plans.ts [--per 7]

import { NAV_CELL } from '../../shared/src/constants.ts';
import { navBlocked } from '../../shared/src/world/worldgen.ts';
import { foulWater, plan } from '../../server/src/game/autosail.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { findPath, lineFree, nearestFree } from '../../server/src/game/nav.ts';
import type { Path } from '../../server/src/game/nav.ts';
import { hullWater, runClear, waterAt } from '../../server/src/game/seaway.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { makeGame } from '../../tests/helpers.ts';
import { sailScenes, seaCaptainAt } from './harness.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

/** The plan as it was made before (server/src/game/autosail.ts at 2026-10-08). */
function planBefore(game: Game, ship: ShipEntity, x: number, y: number): Path | null {
  let tx = x, ty = y;
  if (foulWater(game, ship, x, y) || navBlocked(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL))) {
    const c = nearestFree(game.world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL));
    if (!c) return null;
    tx = c[0] * NAV_CELL + NAV_CELL / 2;
    ty = c[1] * NAV_CELL + NAV_CELL / 2;
  }
  const probe = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 60);
    for (let i = 1; i <= n; i++) if (foulWater(game, ship, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return true;
    return false;
  };
  if (lineFree(game.world, ship.state.x, ship.state.y, tx, ty) && !probe(ship.state.x, ship.state.y, tx, ty)) return [[ship.state.x, ship.state.y], [tx, ty]];
  return findPath(game.world, ship.state.x, ship.state.y, tx, ty, 80_000);
}

const { game } = makeGame();
const { ship } = seaCaptainAt(game, 'brig', 20000, 70000, 0);
const hw = hullWater(ship);
const rows: Record<string, { n: number; legs: [number, number]; foul: [number, number]; plans: [number, number]; ends: [number, number]; far: [number, number] }> = {};
for (const sc of sailScenes(game.world, Number(arg('per', '7')))) {
  ship.state.x = sc.from.x;
  ship.state.y = sc.from.y;
  const r = (rows[sc.kind] ??= { n: 0, legs: [0, 0], foul: [0, 0], plans: [0, 0], ends: [0, 0], far: [0, 0] });
  r.n++;
  [planBefore(game, ship, sc.to.x, sc.to.y), plan(game, ship, sc.to.x, sc.to.y)].forEach((p, k) => {
    if (!p) return;
    let foul = 0;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      r.legs[k]++;
      if (!runClear(game.world, ax, ay, bx, by, hw)) foul++;
    }
    r.foul[k] += foul;
    if (foul) r.plans[k]++;
    const [ex, ey] = p[p.length - 1];
    if (!waterAt(game.world, ex, ey, hw)) r.ends[k]++;
    r.far[k] += Math.hypot(ex - sc.to.x, ey - sc.to.y);
  });
}
console.log('kind        runs   legs b/a   legs over something b/a   plans with one b/a   ends on something b/a   end from the mark b/a (m, mean)');
const tot = { n: 0, legs: [0, 0], foul: [0, 0], plans: [0, 0], ends: [0, 0], far: [0, 0] };
for (const [k, r] of Object.entries(rows)) {
  console.log(`${k.padEnd(10)} ${String(r.n).padStart(5)}   ${`${r.legs[0]}/${r.legs[1]}`.padStart(8)}   ${`${r.foul[0]}/${r.foul[1]}`.padStart(23)}   ${`${r.plans[0]}/${r.plans[1]}`.padStart(18)}   ${`${r.ends[0]}/${r.ends[1]}`.padStart(21)}   ${`${Math.round(r.far[0] / r.n)}/${Math.round(r.far[1] / r.n)}`.padStart(10)}`);
  tot.n += r.n;
  for (const f of ['legs', 'foul', 'plans', 'ends', 'far'] as const) for (const i of [0, 1]) tot[f][i] += r[f][i];
}
console.log(`${'all'.padEnd(10)} ${String(tot.n).padStart(5)}   ${`${tot.legs[0]}/${tot.legs[1]}`.padStart(8)}   ${`${tot.foul[0]}/${tot.foul[1]}`.padStart(23)}   ${`${tot.plans[0]}/${tot.plans[1]}`.padStart(18)}   ${`${tot.ends[0]}/${tot.ends[1]}`.padStart(21)}   ${`${Math.round(tot.far[0] / tot.n)}/${Math.round(tot.far[1] / tot.n)}`.padStart(10)}`);
