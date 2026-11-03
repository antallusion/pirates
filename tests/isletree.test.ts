// The island's tech tree (owner, 2026-10-11; docs/29_ISLANDS.md): five levels at most — ten since docs/38 (owner,
// 2026-11-03) — the hall asks the town round it, every building asks its neighbours — walked here: every building
// reachable, no cycles, hall 5 asks the whole core, hall 10 all of it at 9; every level dearer and longer than the last.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_UNLOCK, DWELL_ELITE_LEVEL, DWELL_GROWTH, DWELL_HIRE_OFF, HALL_DAY, ISLE_OF_HALL, RARE_GOODS, SHIPYARD_REPAIR, TREE_CORE, TREE_OLD_MAX, dwellElite, hallBonus, producerHall, TREE_IDS, TREE_MAX, TREE_OPTIONAL, TOWN_CELLS, BOARD, hallOfIsle, treeClosure, treeCost, treeNeeds, treePlan,
} from '../shared/src/data/isletree.ts';
import type { TreeId } from '../shared/src/data/isletree.ts';
import { BUILDINGS } from '../shared/src/data/holdings.ts';
import type { BuildingId } from '../shared/src/data/holdings.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../shared/src/data/estate.ts';
import { PLOT_CELLS, GRID, PRODUCER_KINDS, PRODUCER_MAX, baseCost, yardCap } from '../shared/src/data/base.ts';
import { KEEP_GROWTH, MARKET_BUY, MARKET_SELL } from '../shared/src/data/town.ts';
import { GOODS } from '../shared/src/data/goods.ts';

test('every building has ten levels at most (docs/38), and every level of every building is reachable without a cycle', () => {
  for (const id of TREE_IDS) {
    for (let L = 1; L <= TREE_MAX; L++) {
      const c = treeClosure(id, L); // throws on a cycle
      for (const [k, n] of c) assert.ok(n >= 1 && n <= TREE_MAX, `${id} ${L} asks ${k} ${n}`);
      for (const [k, n] of treeNeeds(id, L)) assert.ok(n <= TREE_MAX && (k !== id || n < L), `${id} ${L} asks ${k} ${n}`);
    }
  }
  // The plan walks the whole tree up to hall 5 a level at a time, each step after what it asks.
  const plan = treePlan(5);
  const have = new Map<TreeId, number>([['hall', 1]]);
  for (const [k, n] of plan) {
    assert.equal(n, (have.get(k) ?? 0) + 1, `${k} ${n} one level at a time`);
    for (const [d, m] of treeNeeds(k, n)) assert.ok((have.get(d) ?? 0) >= m, `${k} ${n} before ${d} ${m}`);
    have.set(k, n);
  }
  assert.equal(have.get('hall'), 5, 'the plan reaches hall 5');
  // docs/38: and on to the hall 10
  const all = treePlan(TREE_MAX);
  const top = new Map<TreeId, number>([['hall', 1]]);
  for (const [k, n] of all) {
    for (const [d, m] of treeNeeds(k, n)) assert.ok((top.get(d) ?? 0) >= m, `${k} ${n} before ${d} ${m}`);
    top.set(k, n);
  }
  assert.equal(top.get('hall'), 10, 'the plan reaches hall 10');
  assert.equal(TREE_MAX, 10);
});

test('docs/38: the hall 6..10 asks the whole core at its level less one; the island stays at 10, the hall gives its own', () => {
  for (let L = 6; L <= TREE_MAX; L++) {
    const c = treeClosure('hall', L);
    for (const id of TREE_CORE) if (id !== 'hall') assert.ok((c.get(id) ?? 0) >= L - 1, `hall ${L} asks ${id} at ${L - 1}`);
    for (const id of TREE_OPTIONAL) assert.ok(!c.has(id), `hall ${L} never asks ${id}`);
    assert.equal(ISLE_OF_HALL[L], ISLE_MAX, 'the island level stays at 10');
  }
  assert.deepEqual([1, 2, 3, 4, 5].map((h) => ISLE_OF_HALL[h]), [1, 3, 5, 7, 10], 'the hall 1..5 carries the island as it did');
  assert.deepEqual([5, 6, 7, 8, 9, 10].map((h) => hallBonus(h)), [
    { outposts: 0, crews: 0, caravans: 0 }, { outposts: 1, crews: 0, caravans: 0 }, { outposts: 1, crews: 1, caravans: 0 },
    { outposts: 1, crews: 1, caravans: 1 }, { outposts: 2, crews: 1, caravans: 1 }, { outposts: 2, crews: 2, caravans: 1 },
  ]);
  // what each level gives grows to 10
  for (let L = 2; L <= TREE_MAX; L++) {
    assert.ok(HALL_DAY[L] > HALL_DAY[L - 1] && KEEP_GROWTH[L] > KEEP_GROWTH[L - 1] && DWELL_GROWTH[L] > DWELL_GROWTH[L - 1], `level ${L} gives more`);
    assert.ok(MARKET_SELL[L] > MARKET_SELL[L - 1] && MARKET_BUY[L] < MARKET_BUY[L - 1] && MARKET_BUY[L] > MARKET_SELL[L], `the market ${L}`);
    assert.ok(SHIPYARD_REPAIR[L] >= SHIPYARD_REPAIR[L - 1] && DWELL_HIRE_OFF[L] >= DWELL_HIRE_OFF[L - 1]);
  }
  assert.deepEqual(HALL_DAY.slice(6), [600, 900, 1300, 1800, 2500]);
  assert.equal(KEEP_GROWTH[10], 3);
  assert.equal(DWELL_GROWTH[10], 2.5);
  assert.ok(DWELL_HIRE_OFF.slice(0, 6).every((x) => x === 0), 'no share off below 6');
  // the elite kind's hook (a later task): from the dwelling's eighth level
  assert.equal(DWELL_ELITE_LEVEL, 8);
  assert.ok(!dwellElite(7) && dwellElite(8) && dwellElite(10));
  // the yard: ×1.25 a warehouse level above 5
  assert.equal(yardCap(10, 6), Math.round((yardCap(10, 5) * 1.25) / 10) * 10);
  for (let w = 1; w <= TREE_MAX; w++) assert.ok(yardCap(10, w) > yardCap(10, w - 1));
});

test('docs/38 (owner: «с каждым уровнем всё дольше и дороже»): every tree building and every producer, levels 1..10 — more silver, more time, more goods each level', () => {
  const sum = (c: { goods: Partial<Record<string, number>> }) => Object.values(c.goods).reduce((x: number, y) => x + (y ?? 0), 0);
  const things: [string, (l: number) => { silver: number; secs: number; goods: Partial<Record<string, number>> }][] = [
    ...TREE_IDS.map((id) => [id, (l: number) => treeCost(id, l)] as [string, (l: number) => ReturnType<typeof treeCost>]),
    ...PRODUCER_KINDS.map((k) => [`p:${k}`, (l: number) => baseCost(`p:${k}`, l)] as [string, (l: number) => ReturnType<typeof treeCost>]),
  ];
  assert.equal(PRODUCER_MAX, 10);
  for (const [id, cost] of things) {
    for (let L = 2; L <= TREE_MAX; L++) {
      const a = cost(L), b = cost(L - 1);
      assert.ok(a.silver > b.silver, `${id} ${L}: silver ${a.silver} > ${b.silver}`);
      assert.ok(a.secs > b.secs, `${id} ${L}: time ${a.secs} > ${b.secs}`);
      // (the guns' first level brings their weapons once: their second may ask fewer goods in all, as it did)
      if (!((id === 'battery' || id === 'fort') && L === 2)) assert.ok(sum(a) > sum(b), `${id} ${L}: goods ${sum(a)} > ${sum(b)}`);
      if (L > TREE_OLD_MAX) {
        // the silver of level 5 ×3 / 6 / 11 / 20 / 36 (rounded to fifty)
        const five = cost(TREE_OLD_MAX).silver;
        assert.ok(Math.abs(a.silver - five * [0, 0, 0, 0, 0, 0, 3, 6, 11, 20, 36][L]) <= 50, `${id} ${L}: ${a.silver} from level 5's ${five}`);
      }
    }
    if (!id.startsWith('p:')) {
      // the rare goods: none to 5, from the sea at 6, the hunt's at 8, a boss's trophy at 10
      const rare = (l: number) => Object.keys(cost(l).goods).filter((g) => RARE_GOODS.includes(g as never) && !['pearls', 'rum', 'gunpowder'].includes(g));
      assert.equal(rare(7).length, 0, `${id}: no hunt's goods at 7`);
      assert.ok(rare(8).length >= 2 && rare(10).length > rare(9).length, `${id}: the hunt's at 8, a trophy at 10`);
      for (const g of rare(10)) assert.ok(GOODS[g as keyof typeof GOODS], g);
    }
  }
  assert.equal(producerHall(10), 10, 'a producer rises with the hall to 10');
});

test('the hall asks the town: no building is skipped on the way to hall 5, every core building at level 2 or more', () => {
  const c = treeClosure('hall', 5);
  for (const id of TREE_CORE) assert.ok((c.get(id) ?? 0) >= 2, `hall 5 asks ${id} at ${c.get(id) ?? 0}`);
  for (const id of TREE_OPTIONAL) assert.ok(!c.has(id), `hall 5 never asks ${id} (not on the Crown's coast)`);
  // Each hall level asks more of the town than the last, and no building stands above the hall.
  for (let L = 3; L <= 5; L++) {
    const a = treeClosure('hall', L), b = treeClosure('hall', L - 1);
    assert.ok([...a.values()].reduce((x, y) => x + y, 0) > [...b.values()].reduce((x, y) => x + y, 0), `hall ${L} asks more than hall ${L - 1}`);
  }
  for (const id of TREE_IDS) {
    if (id === 'hall') continue;
    for (let L = 1; L <= TREE_MAX; L++) assert.ok((treeClosure(id, L).get('hall') ?? 0) >= L, `${id} ${L} asks the hall at ${L}`);
  }
});

test('costs and times grow with every level; the island\'s level follows the hall', () => {
  for (const id of TREE_IDS) {
    for (let L = 2; L <= TREE_MAX; L++) {
      const a = treeCost(id, L), b = treeCost(id, L - 1);
      if (id === 'hall' && L === 2) continue; // the first hall is the claim's own
      assert.ok(a.silver > b.silver && a.secs > b.secs, `${id} ${L}: ${a.silver} > ${b.silver}, ${a.secs} > ${b.secs}`);
      const sum = (c: typeof a) => Object.values(c.goods).reduce((x, y) => x + (y ?? 0), 0);
      if (!(id === 'battery' || id === 'fort') || L > 2) assert.ok(sum(a) >= sum(b), `${id} ${L} goods`);
    }
  }
  assert.equal(treeCost('hall', 1).silver, 0, 'the claim raises the hall free');
  for (let h = 1; h <= 5; h++) assert.equal(hallOfIsle(ISLE_OF_HALL[h]), h);
  assert.equal(ISLE_OF_HALL[5], ISLE_MAX);
  for (let l = 1; l <= ISLE_MAX; l++) assert.ok(ISLE_OF_HALL[hallOfIsle(l)] <= Math.max(l, 1) || hallOfIsle(l) === 1, `isle ${l}`);
  for (let h = 2; h <= 5; h++) assert.ok(ISLE_LEVELS[ISLE_OF_HALL[h]].outposts > ISLE_LEVELS[ISLE_OF_HALL[h - 1]].outposts, `hall ${h} opens more outposts`);
});

test('every single-level building of the base opens at a hall level; the board holds the town on its back edges', () => {
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (TREE_IDS.includes(id as TreeId)) continue;
    const at = BASE_UNLOCK[id];
    assert.ok(at !== undefined && at >= 1 && at <= 5, `${id} opens at hall ${at}`);
  }
  const used = new Set<string>();
  for (const [id, [i, j]] of Object.entries(TOWN_CELLS)) {
    assert.ok(i === 0 || j === 0, `${id} on a back edge`);
    assert.ok(i < BOARD && j < BOARD && !used.has(`${i},${j}`), id);
    used.add(`${i},${j}`);
  }
  // The plots lie one cell in from the town (no plot under a town building).
  for (const [i, j] of PLOT_CELLS) assert.ok(!used.has(`${i + 1},${j + 1}`) && i + 1 < BOARD && j + 1 < BOARD && GRID + 1 === BOARD);
});
