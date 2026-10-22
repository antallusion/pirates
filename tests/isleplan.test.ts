// The island's build order (docs/29 §8, owner 2026-10-17): the planner walks the tree and the producers in an order
// every step of which stands after all it asks, ends with everything at level 5, puts the producers and the hall's ring
// first, adapts to the island as it stands; the card's steps say what may start now, and the speed-ups from the card
// are the server's own (the store of minutes, the free tokens).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalOrder, isleOrder } from '../shared/src/data/isleplan.ts';
import type { PlanState, PlanWhat } from '../shared/src/data/isleplan.ts';
import { TREE_IDS, TREE_MAX, TREE_OPTIONAL, treeNeeds } from '../shared/src/data/isletree.ts';
import type { TreeId } from '../shared/src/data/isletree.ts';
import { BASE_RES, BIOME_YIELD, PRODUCERS, PRODUCER_KINDS } from '../shared/src/data/base.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, startBuild, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { buildTown } from '../server/src/game/town.ts';
import { shopState, useSpeed } from '../server/src/game/shop.ts';
import { speedup } from '../server/src/game/base.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, onHull } from './helpers.ts';
import { offCoast } from './helpers.ts';

const fresh = (o: Partial<PlanState> = {}): PlanState => ({ levels: { hall: 1 }, producers: {}, biome: 'temperate', safe: false, playerLevel: 60, path: 'corsair', ...o });

function walk(st: PlanState, order: { what: PlanWhat; level: number }[]): Map<string, number> {
  const have = new Map<string, number>();
  for (const id of TREE_IDS) have.set(id, st.levels[id] ?? 0);
  have.set('hall', Math.max(1, have.get('hall') ?? 1));
  for (const k of PRODUCER_KINDS) have.set(`p:${k}`, st.producers[k] ?? 0);
  for (const s of order) {
    assert.equal(s.level, (have.get(s.what) ?? 0) + 1, `${s.what} ${s.level}: a level at a time`);
    if (s.what.startsWith('p:')) assert.ok((have.get('hall') ?? 1) >= s.level, `${s.what} ${s.level} no higher than the hall`);
    else for (const [d, m] of treeNeeds(s.what as TreeId, s.level)) assert.ok((have.get(d) ?? 0) >= m, `${s.what} ${s.level} before ${d} ${m}`);
    have.set(s.what, s.level);
  }
  return have;
}

test('the canonical order is dependency-valid and ends with every building and producer at level 5', () => {
  for (const path of ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'] as const) {
    const st = fresh({ path });
    const order = canonicalOrder(path);
    const have = walk(st, order);
    for (const id of TREE_IDS) assert.equal(have.get(id), TREE_MAX, `${path}: ${id} at 5`);
    for (const k of PRODUCER_KINDS) if (BIOME_YIELD.temperate[PRODUCERS[k].good] > 0) assert.equal(have.get(`p:${k}`), TREE_MAX, `${path}: ${k} at 5`);
  }
  // the same state, the same order (deterministic)
  assert.deepEqual(canonicalOrder('corsair'), canonicalOrder('corsair'));
});

test('the order puts what pays first: the producers and the hall\'s ring before hall 2, hall 2 early, the guns never on the Crown\'s coast', () => {
  const order = canonicalOrder('corsair');
  const at = (w: string, l: number) => order.findIndex((s) => s.what === w && s.level === l);
  assert.ok(at('p:lumber', 1) <= 1 && at('p:quarry', 1) <= 2, 'timber and stone come first');
  assert.ok(at('hall', 2) < 12, `hall 2 (the second crew) within the first dozen steps: ${at('hall', 2)}`);
  for (const id of ['warehouse', 'keep', 'market', 'dw1', 'dw2']) assert.ok(at(id, 1) < at('hall', 2), `${id} before hall 2`);
  assert.ok(at('hall', 3) < at('dw4', 2), 'the hall is pushed before the deeper levels');
  const safe = isleOrder(fresh({ safe: true }));
  for (const id of TREE_OPTIONAL) assert.ok(!safe.some((s) => s.what === id), `${id} not on the Crown's coast`);
  // the land: no iron mine where the rock holds none
  const mangrove = isleOrder(fresh({ biome: 'mangrove' }));
  assert.ok(!mangrove.some((s) => s.what === 'p:mine'), 'no mine on the mangrove (no iron)');
});

test('the path and the level band move the order: a low captain is not pushed to a hall far above her', () => {
  const hi = canonicalOrder('corsair', 60);
  const lo = canonicalOrder('corsair', 10);
  const at = (o: typeof hi, w: string, l: number) => o.findIndex((s) => s.what === w && s.level === l);
  assert.ok(at(lo, 'hall', 3) > at(hi, 'hall', 3), `hall 3 later for a captain of level 10 (${at(lo, 'hall', 3)} vs ${at(hi, 'hall', 3)})`);
  const drowned = canonicalOrder('drowned');
  assert.ok(drowned.some((s) => s.what === 'dw7' && s.why === 'path') || drowned.some((s) => s.what === 'dw6' && s.why !== 'army'), 'the drowned path leans on its own dwellings');
});

test('the order adapts to the island as it stands and leaves out the work under way', () => {
  const st = fresh({ levels: { hall: 2, warehouse: 1, keep: 1, market: 1, dw1: 1, dw2: 1 }, producers: { lumber: 1, quarry: 1, tar: 1, mine: 1 } });
  const o = isleOrder(st);
  walk(st, o);
  assert.ok(!o.some((s) => s.what === 'hall' && s.level === 2), 'hall 2 stands');
  const busy = isleOrder({ ...st, busy: [{ what: 't:dw3', level: 1 }, { what: 'p:lumber', level: 2 }] });
  assert.ok(!busy.some((s) => (s.what === 'dw3' && s.level === 1) || (s.what === 'p:lumber' && s.level === 2)), 'the work under way is not recommended again');
  assert.equal(busy.length, o.length - 2);
});

// ------------------------------------------------------------------------------------------------ the card's view

let clock = 20_000 * 86_400_000;
function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}
function owner(game: Game): PlayerSession {
  join(game, 'Planner');
  const s = game.sessionByName('Planner')!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  s.ship!.docked = null;
  assert.ok(offCoast(game, s.ship!, home), 'water off its coast'); // (her hull within its thirty metres — reach.ts)
  s.ship!.state.speed = 0;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  s.ship!.state.x += 20_000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  return s;
}

test('the card recommends three steps, those she may start now first; «Строить» starts the top one; the plan follows', () => {
  const game = world();
  const s = owner(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 0;
  const v = baseView(game, s)!;
  assert.ok(v.plan && v.plan.steps.length === 3, 'three steps');
  const top = v.plan.steps[0];
  assert.ok(top.state === 'ready' || top.state === 'lack', `the top step is one she may start (${top.state})`);
  // with no goods the producers (silver only, or a little timber) lead: the affordable first
  assert.equal(top.state, 'ready', 'an affordable step leads');
  assert.ok(top.what.startsWith('p:'), `a producer first on a bare yard: ${top.what}`);
  const lackers = v.plan.steps.filter((x) => x.state === 'lack');
  for (const x of lackers) assert.ok(x.lack.length > 0 || x.silverLack > 0, 'a short step says what it lacks');
  // «Строить»: the client sends the build on the step's plot
  assert.ok(top.plot !== null);
  assert.equal(startBuild(game, s, top.plot!, top.what), null);
  const v2 = baseView(game, s)!;
  assert.ok(!v2.plan!.steps.some((x) => x.what === top.what && x.level === top.level), 'the started step leaves the plan');
  // one crew: the rest wait for the builders, and the card points at the work to speed up
  const busy = v2.plan!.steps.find((x) => x.state === 'busy' || x.state === 'wait');
  assert.ok(busy, 'a step waits for the crew');
  assert.equal(busy!.job, y.jobs[0].id, 'it points at the work under way');
  // a fuller yard: the hall's ring is recommended and affordable
  for (const g of BASE_RES) y.res[g] = 5_000;
  clock += 3_600_000;
  const v3 = baseView(game, s)!;
  assert.equal(v2.plan!.left, v.plan!.left - 1, 'the plan shrinks as the work starts');
  assert.equal(v3.plan!.left, v2.plan!.left, 'the work done: counted once');
  assert.ok(v3.plan!.steps.some((x) => x.state === 'ready'), 'the crew free again: a step may start');
});

test('the speed-ups from the card: the store of minutes and the tokens, both checked by the server', () => {
  const game = world();
  const s = owner(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 5_000;
  assert.equal(buildTown(game, s, 'keep'), null);
  const job = y.jobs[0];
  const v = baseView(game, s)!;
  assert.equal(v.plan!.speed.min, 0);
  // no minutes: the server says so
  assert.equal(useSpeed(game, s, job.id), 'No speed-ups in store: buy them in the shop.');
  shopState(game, s.accountId).speed = 10;
  const end0 = job.end;
  assert.equal(useSpeed(game, s, job.id), null);
  assert.equal(end0 - job.end, 10 * 60_000, 'ten minutes off');
  assert.equal(shopState(game, s.accountId).speed, 0);
  assert.equal(baseView(game, s)!.plan!.speed.min, 0);
  s.profile!.speedups = 1;
  assert.equal(speedup(game, s, job.id, 'token'), null);
  assert.equal(s.profile!.speedups, 0);
  assert.equal(useSpeed(game, s, 999), 'No speed-ups in store: buy them in the shop.');
});

