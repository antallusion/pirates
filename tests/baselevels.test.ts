// docs/29 (owner, 2026-10-15: «все здания в 5 вариациях, так как у нас есть улучшения»): the base's 24 single-level
// buildings rise to five levels — their costs by the founding's and never above the hall's, each level asking the hall
// at it; their work by level for every kind (made, mended, counted, shared); level 1 exactly as before; the old saves
// on level 1; the steps end to end on the server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_RES, baseCost, maxLevel } from '../shared/src/data/base.ts';
import { BUILDING_IDS } from '../shared/src/data/holdings.ts';
import type { BuildingId } from '../shared/src/data/holdings.ts';
import { BASE_UNLOCK, isTreeBase, treeCost } from '../shared/src/data/isletree.ts';
import { TROPHY_MAX } from '../shared/src/data/estate.ts';
import {
  LEVEL_MUL, caravanExtra, chartCopy, coveHide, dockDiscount, forgeReach, levelMul, residentRooms, signalMins, signalRisk, singleHall, smugglerRoom, trophyCap, workshopYield,
} from '../shared/src/data/baselevels.ts';
import { levelOf, migrateHoldings, storeCapacity, strength, work } from '../server/src/game/holdings.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import { residentCap } from '../server/src/game/estate.ts';
import { ownIsland, buyIsland, clearOutposts } from '../server/src/game/estate.ts';
import { baseView, reckonBase, startBuild, upgradeAt, yardOf } from '../server/src/game/base.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import { join, makeGame, onHull } from './helpers.ts';
import { offCoast } from './helpers.ts';

const SINGLE = BUILDING_IDS.filter((id) => !isTreeBase(id));

function holding(buildings: Holding['buildings']): Holding {
  return { island: 1, owner: { kind: 'player', id: 7, name: 'Q' }, owned: true, buildings, store: {}, treasury: 0, since: 0, until: 0, lastWork: 0, lastUpkeep: 0, toll: { day: 0, paid: 0 } } as unknown as Holding;
}

test('the 24 buildings rise to five; each level dearer, never above the hall\'s silver nor its time, and asks the hall at it', () => {
  assert.equal(SINGLE.length, 24);
  for (const id of SINGLE) {
    assert.equal(maxLevel(id), 5, `${id} has five levels`);
    let last = 0;
    const found = baseCost(id, 1);
    for (let l = 2; l <= 5; l++) {
      const c = baseCost(id, l);
      const hall = treeCost('hall', l);
      assert.ok(c.silver >= last && c.silver >= found.silver, `${id} ${l}: no cheaper than the one before`);
      assert.ok(c.silver <= Math.max(found.silver, hall.silver), `${id} ${l}: ${c.silver} silver not above the hall's ${hall.silver}`);
      assert.ok(c.secs > found.secs && c.secs <= Math.max(found.secs, hall.secs), `${id} ${l}: its time`);
      for (const g of Object.keys(c.goods)) assert.ok((BASE_RES as string[]).includes(g), `${id} ${l}: the yard's own ${g} (what is brought only founds it)`);
      assert.equal(singleHall(id, l), Math.max(BASE_UNLOCK[id] ?? 1, l));
      last = c.silver;
    }
  }
});

test('level 1 is what the buildings did before; level 5 is the most', () => {
  assert.equal(levelMul(1), 1);
  assert.equal(levelMul(undefined), 1, 'an old building with no level');
  assert.equal(signalMins(1), 5);
  assert.equal(signalRisk(1), 0.67);
  assert.equal(caravanExtra(1), 1);
  assert.equal(residentRooms(1), 4);
  assert.equal(dockDiscount(1), 0.25);
  assert.equal(chartCopy(1), 500);
  assert.equal(forgeReach(1), 400);
  assert.equal(trophyCap(1), TROPHY_MAX);
  assert.equal(workshopYield(1), 3);
  assert.equal(smugglerRoom(1), 0);
  assert.equal(coveHide(1), 0);
  for (let l = 2; l <= 5; l++) {
    assert.ok(LEVEL_MUL[l] > LEVEL_MUL[l - 1]);
    assert.ok(signalMins(l) >= signalMins(l - 1) && signalRisk(l) < signalRisk(l - 1) && residentRooms(l) > residentRooms(l - 1));
    assert.ok(dockDiscount(l) > dockDiscount(l - 1) && chartCopy(l) < chartCopy(l - 1) && forgeReach(l) > forgeReach(l - 1));
    assert.ok(trophyCap(l) > trophyCap(l - 1) && workshopYield(l) > workshopYield(l - 1) && smugglerRoom(l) > smugglerRoom(l - 1) && coveHide(l) > coveHide(l - 1));
  }
  // tight (docs/31): at most ×1.6, the dry dock's repairs at most a third off, the cove's notice at most a third less
  assert.equal(levelMul(5), 1.6);
  assert.ok(dockDiscount(5) < 0.4 && coveHide(5) < 0.35 && signalRisk(5) > 0.45 && caravanExtra(5) === 2);
});

test('what a building makes, earns and holds grows with its level; the tree\'s own reckon apart', () => {
  const h = holding([
    { id: 'farm', condition: 1, unpaid: false, level: 3 },
    { id: 'tavern', condition: 1, unpaid: true, level: 5 },
    { id: 'warehouse', condition: 1, unpaid: false, level: 4 },
    { id: 'barracks', condition: 0.5, unpaid: false, level: 5 },
  ]);
  assert.equal(strength(h, 'farm'), 1.3);
  assert.equal(strength(h, 'tavern'), 0.8, 'unpaid halves, the level lifts');
  assert.equal(strength(h, 'warehouse'), 1, 'the tree\'s warehouse counts its levels itself');
  assert.equal(strength(h, 'barracks'), 0.8);
  assert.equal(levelOf(h, 'farm'), 3);
  assert.equal(levelOf(h, 'pier'), 0);
});

test('what was whole at one (the pier, the chapel, the lighthouse) goes past it by level, not by doubling the building', () => {
  const h = holding([{ id: 'pier', condition: 1, unpaid: false, level: 5 }, { id: 'chapel', condition: 0.5, unpaid: false, level: 2 }, { id: 'lighthouse', condition: 1, unpaid: false }]);
  assert.equal(work(h, 'pier'), 1.6);
  assert.equal(work(h, 'chapel'), 0.575);
  assert.equal(work(h, 'lighthouse'), 1, 'an old lighthouse with no level: as before');
  assert.equal(work(h, 'tavern'), 0);
});

test('counted things: the residents\' rooms, the smugglers\' room', () => {
  const h = holding([{ id: 'residents_house', condition: 1, unpaid: false, level: 4 }, { id: 'smuggler_store', condition: 1, unpaid: false, level: 3 }]);
  (h as { level?: number }).level = 1;
  const bare = holding([]);
  (bare as { level?: number }).level = 1;
  assert.equal(residentCap(h) - residentCap(bare), 10);
  assert.equal(storeCapacity(h) - storeCapacity(bare), 30);
});

test('an old save: the buildings stand at level 1 and work as they did', () => {
  const h = holding([{ id: 'farm', condition: 1, unpaid: false }, { id: 'pier', condition: 0.8, unpaid: false, level: 9 }]);
  (h as { tv?: number }).tv = 99;
  const before = strength(h, 'farm');
  const all: Record<string, Holding> = { 'own:7': h };
  const r = migrateHoldings(all, 0);
  assert.ok(r.changed);
  assert.equal(h.buildings[0].level, 1);
  assert.equal(h.buildings[1].level, 5, 'a level out of range is brought in');
  assert.equal(strength(h, 'farm'), before);
  assert.equal(migrateHoldings(all, 0).changed, false, 'once only');
});

test('on the server: a farm raised to 2 with the hall at 2, refused with the hall at 1, the view shows what it asks', () => {
  const { game } = makeGame();
  let clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  const c = join(game, 'Level Raiser');
  void c;
  const s = game.sessionByName('Level Raiser')!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  assert.ok(offCoast(game, ship, home), 'water off its coast'); // (owner, 2026-10-22: her hull within thirty metres of its coast — reach.ts)
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 5_000;
  assert.equal(startBuild(game, s, 0, 'farm'), null);
  clock += 3 * 3_600_000;
  reckonBase(game, h);
  const farm = h.buildings.find((b) => b.id === 'farm')!;
  assert.equal(farm.level ?? 1, 1);
  const v = baseView(game, s)!;
  const cell = v.cells.find((x) => x.what === 'farm')!;
  assert.equal(cell.up?.level, 2);
  assert.deepEqual(cell.up?.needs, [{ id: 'hall', level: 2, have: 1 }]);
  assert.match(upgradeAt(game, s, cell.plot) ?? '', /town hall to level 2/);
  y.town!.b.hall = 2;
  const gold = s.profile!.gold;
  assert.equal(upgradeAt(game, s, cell.plot), null);
  assert.equal(gold - s.profile!.gold, baseCost('farm', 2).silver);
  clock += 2 * 3_600_000;
  reckonBase(game, h);
  assert.equal(farm.level, 2);
  assert.equal(strength(h, 'farm'), levelMul(2));
  const id: BuildingId = 'farm';
  assert.equal(levelOf(h, id), 2);
});
