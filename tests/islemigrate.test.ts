// docs/29's migration of the holdings: each captain keeps one island of her own under her own key (an instance per
// captain, so many may hold the same island), the greatest if she had several; leases and guilds' islands stay as they
// were; the town's old levels are put on the tree's five (the citadel and the exchange third, the castle fifth, an
// upgraded dwelling third) and the hall stands for the island's level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREE_VERSION, migrateHoldings, migrateTree, ownKey } from '../server/src/game/holdings.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import { ownIsland } from '../server/src/game/estate.ts';
import { ISLE_OF_HALL } from '../shared/src/data/isletree.ts';
import { makeGame } from './helpers.ts';

const WALL = 20_000 * 86_400_000;

function holding(island: number, owner: { kind: 'player' | 'guild'; id: number; name: string }, extra: Partial<Holding> = {}): Holding {
  return {
    island, owner, since: WALL - 1000, until: WALL + 1e12, lastDays: 30, autoRenew: false, treasury: 100, store: {}, buildings: [], lastUpkeep: WALL, lastWork: WALL,
    toll: { day: 0, paid: 0 }, warned: false, window: 19, windowNext: null, shieldUntil: WALL, lastSiege: 0, ...extra,
  };
}

const yard = (b: Record<string, number>, jobs: { what: string; level: number }[] = []) => ({
  res: { timber: 50 }, carry: {}, fresh: {}, producers: [], seq: 9, lastYield: WALL, ships: [],
  jobs: jobs.map((j, i) => ({ id: i + 1, plot: -1, what: j.what, level: j.level, start: WALL, end: WALL + 60_000 })),
  town: { b, pool: [0, 0, 0, 0, 0, 0, 0, 0], w: -1 },
});

test('an old owner keeps her island under her own key; with several, the greatest; leases and guilds stay put', () => {
  const ann = { kind: 'player' as const, id: 7, name: 'Ann' };
  const bo = { kind: 'player' as const, id: 8, name: 'Bo' };
  const all: Record<string, Holding> = {
    '101': holding(101, ann, { owned: true, level: 6, yard: yard({ hall: 2, keep: 2, market: 3, dw1: 2, dw3: 1, guild: 2, pen: 1 }, [{ what: 't:keep', level: 3 }, { what: 't:dw2', level: 2 }]) }),
    '202': holding(202, bo, { owned: true, level: 3, buildings: [{ id: 'warehouse', condition: 1, unpaid: false, level: 2 }] }),
    '203': holding(203, bo, { owned: true, level: 7, buildings: [{ id: 'pier', condition: 1, unpaid: false }] }),
    '303': holding(303, bo), // Bo's lease of another island
    '404': holding(404, { kind: 'guild', id: 3, name: 'The Brethren' }, { base: 2 }),
  };
  const { changed, dropped } = migrateHoldings(all, WALL);
  assert.ok(changed);
  assert.deepEqual(Object.keys(all).sort(), ['303', '404', ownKey(7), ownKey(8)].sort());
  // Ann: re-keyed, on the tree's levels.
  const a = all[ownKey(7)];
  assert.equal(a.island, 101);
  assert.equal(a.tv, TREE_VERSION);
  const t = a.yard!.town!.b;
  assert.equal(t.hall, 3, 'island level 6 stands for hall 3 (above the old hall 2)');
  assert.equal(t.keep, 3, 'the citadel is the keep\'s third level');
  assert.equal(t.market, 5, 'the merchants\' guild its fifth');
  assert.equal(t.dw1, 3, 'an upgraded dwelling its third');
  assert.equal(t.dw3, 1);
  assert.equal(t.guild, 2, 'the guild had five floors already');
  assert.equal(t.pen, 1, 'the pen keeps its own');
  assert.ok(a.level! >= ISLE_OF_HALL[3]);
  assert.deepEqual(a.yard!.jobs.map((j) => [j.what, j.level]), [['t:keep', 5], ['t:dw2', 3]], 'work under way on the tree\'s levels too');
  assert.equal(a.treasury, 100, 'nothing else touched');
  // Bo: the level-7 island kept (hall 4), the level-3 one given up with its buildings; his lease untouched.
  const b = all[ownKey(8)];
  assert.equal(b.island, 203);
  assert.equal(b.yard!.town!.b.hall, 4);
  assert.deepEqual(dropped.map((h) => h.island), [202]);
  assert.ok(!all['303'].owned && all['303'].owner.id === 8);
  assert.equal(all['404'].owner.kind, 'guild');
  // Idempotent.
  const again = migrateHoldings(all, WALL);
  assert.equal(again.changed, false);
  assert.equal(migrateTree(a, WALL), false);
});

test('the migration runs as the holdings load; the captain finds her island as before', () => {
  const { game } = makeGame();
  game.holdings.drop();
  game.db.setKv('holdings', { '55': holding(55, { kind: 'player', id: 42, name: 'Old Owner' }, { owned: true, level: 10, yard: yard({ hall: 3, keep: 3 }) }) });
  game.holdings.drop();
  const h = ownIsland(game, 42)!;
  assert.ok(h, 'found');
  assert.equal(h.island, 55);
  assert.equal(game.holdings.map(game)[ownKey(42)], h);
  assert.equal(h.yard!.town!.b.hall, 5, 'a level-10 island is a hall-5 island');
  assert.equal(h.yard!.town!.b.keep, 5, 'the castle');
  assert.equal(game.holdings.get(game, 55), undefined, 'no exclusive holding on the island any more');
  assert.equal(game.holdings.get(game, 55, 42), h, 'hers there');
  assert.deepEqual(game.holdings.onIsland(game, 55), [h]);
});
