// The island from anywhere and its first build, guided (owner, 2026-10-28: 23 of 28 live islands had only the hall):
// works paid from the treasury first, then the purse, ordered far from the island; the cheap start (startcost.ts); the
// three steps (the barracks, marines hired, the range) with their rewards; the governor's help once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lairIsland } from '../server/src/game/wanted.ts';
import type { Game } from '../server/src/game/Game.ts';
import { reckonBase, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { buildTown, townLevel } from '../server/src/game/town.ts';
import { ISLE_FIRST, isleFirstCheck, isleFirstHire, isleFirstView } from '../server/src/game/islefirst.ts';
import { lyingOff } from '../server/src/game/base.ts';
import { treeCost, treeCostOld, TREE_IDS } from '../shared/src/data/isletree.ts';
import { townCost } from '../shared/src/data/town.ts';
import { baseCost } from '../shared/src/data/base.ts';
import { PRODUCER_KINDS } from '../shared/src/data/base.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function owner(game: Game, name: string) {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 4);
  s.profile!.gold = 100_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  s.ship!.docked = null;
  assert.ok(offCoast(game, s.ship!, home));
  s.ship!.state.speed = 0;
  s.ship!.region = home.region;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  // far away: the island is run from anywhere
  s.ship!.state.x += 20_000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  const h = ownIsland(game, s.accountId)!;
  return { s, h, y: yardOf(game, h) };
}

test('the cheap start: every building’s first two levels next to free, the third with no cliff, the fourth as before', () => {
  for (const id of TREE_IDS) {
    const [a, b, c, d] = [1, 2, 3, 4].map((l) => treeCost(id, l));
    if (id !== 'hall') assert.ok(a.silver <= 300 && (a.goods.timber ?? 0) <= 8, `${id} 1: ${a.silver}`);
    assert.ok(b.silver <= 600 && (b.goods.timber ?? 0) <= 25, `${id} 2: ${b.silver}`);
    assert.ok(c.silver > b.silver && c.silver < d.silver && c.silver / b.silver < d.silver / b.silver, `${id} 3 between`);
    assert.deepEqual(d, treeCostOld(id, 4), `${id} 4 as before`);
    for (const l of [1, 2, 3]) assert.equal(treeCost(id, l).secs, treeCostOld(id, l).secs, `${id} ${l}: its time kept`);
  }
  // the whole first-level set of a hall-1 island: town and producers under 1 000 silver and 60 timber
  let silver = 0, timber = 0;
  for (const id of ['dw1', 'dw2', 'keep', 'market', 'warehouse'] as const) [silver, timber] = [silver + treeCost(id, 1).silver, timber + (treeCost(id, 1).goods.timber ?? 0)];
  for (const k of PRODUCER_KINDS) [silver, timber] = [silver + baseCost(`p:${k}`, 1).silver, timber + (baseCost(`p:${k}`, 1).goods.timber ?? 0)];
  assert.ok(silver < 1_000 && timber < 60, `${silver} silver, ${timber} timber`);
  assert.ok(townCost('pen', 2).silver <= 800);
});

test('ordered from far away: the treasury pays first, then the purse; the hold only lying off the island', () => {
  const game = world();
  const { s, h, y } = owner(game, 'Far Builder');
  assert.equal(lyingOff(game, s, h), false);
  y.res = { timber: 100, coal: 100 };
  h.treasury = 30;
  const gold = s.profile!.gold;
  const cost = townCost('dw1', 1);
  assert.equal(buildTown(game, s, 'dw1'), null);
  assert.equal(h.treasury, 0, 'the treasury first');
  assert.equal(gold - s.profile!.gold, cost.silver - 30, 'the rest from the purse');
  // a purse and a treasury short together: refused with both named
  clock += 3600_000;
  reckonBase(game, h);
  s.profile!.gold = 0;
  h.treasury = 10;
  assert.match(buildTown(game, s, 'dw2')!, /treasury and purse/);
  setLang('ru');
  assert.match(serverText(buildTown(game, s, 'dw2')!), /казна/);
  setLang('en');
});

test('the island’s first steps: the barracks, marines hired, the range — rewards, and the governor’s help once', () => {
  const game = world();
  const { s, h, y } = owner(game, 'First Steps');
  y.res = {};
  h.treasury = 0;
  s.profile!.gold = 0;
  isleFirstCheck(game, s);
  assert.equal(s.profile!.isleFirst?.step, 0);
  assert.equal(s.profile!.isleFirst?.help, true);
  // the governor's help: the bunkhouse and the barracks paid by the yard and the treasury
  assert.ok((y.res.timber ?? 0) >= townCost('dw1', 1).goods.timber! + townCost('dw2', 1).goods.timber!, 'timber for both');
  assert.ok(h.treasury >= townCost('dw1', 1).silver + townCost('dw2', 1).silver, 'silver for both');
  const v0 = isleFirstView(game, s)!;
  assert.equal(v0.id, 'dw2');
  assert.equal(v0.open, 'dw1', 'the bunkhouse first');
  assert.equal(v0.ready, true, 'paid by the governor’s help');
  assert.equal(buildTown(game, s, 'dw1'), null);
  clock += 3 * 3600_000;
  reckonBase(game, h);
  assert.equal(townLevel(y, 'dw1'), 1);
  assert.equal(isleFirstView(game, s)!.open, 'dw2');
  assert.equal(isleFirstView(game, s)!.ready, true);
  assert.equal(buildTown(game, s, 'dw2'), null);
  // ordered: the step is done at once, its reward the range's iron and powder
  assert.equal(s.profile!.isleFirst!.step, 1);
  assert.equal(s.profile!.gold, ISLE_FIRST[0].silver);
  assert.equal(y.res.gunpowder, ISLE_FIRST[0].goods.gunpowder);
  const v1 = isleFirstView(game, s)!;
  assert.equal(v1.id, 'hire');
  assert.ok(v1.wait > 0, 'the barracks still rising');
  isleFirstHire(game, s, 3);
  assert.equal(s.profile!.isleFirst!.step, 1, 'only marines count');
  isleFirstHire(game, s, 2);
  assert.equal(s.profile!.isleFirst!.step, 2);
  clock += 3 * 3600_000;
  reckonBase(game, h);
  y.res.timber = 200;
  y.res.coal = 200;
  y.res.iron = 50;
  s.profile!.gold += 5_000;
  assert.equal(buildTown(game, s, 'dw3'), null);
  assert.equal(s.profile!.isleFirst!.step, 3);
  assert.equal(isleFirstView(game, s), null, 'done: the line is gone');
  // the help is once: a second check gives nothing
  const tre = h.treasury;
  isleFirstCheck(game, s);
  assert.equal(h.treasury, tre);
});

test('a captain past the claim before the steps gets them at her next check, the barracks already standing counted', () => {
  const game = world();
  const { s, y } = owner(game, 'Old Owner');
  y.town = { b: { hall: 1, dw1: 1, dw2: 1 }, pool: [0, 0, 0, 0, 0, 0, 0, 0], w: -1 };
  delete s.profile!.isleFirst;
  isleFirstCheck(game, s);
  assert.equal(s.profile!.isleFirst!.step, 1, 'straight to «hire marines»');
});
