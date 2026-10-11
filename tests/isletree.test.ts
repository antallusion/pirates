// The island's tech tree (owner, 2026-10-11; docs/29_ISLANDS.md): five levels at most, the hall asks the town round it,
// every building asks its neighbours — walked here: every building reachable, no cycles, hall 5 asks the whole core.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_UNLOCK, ISLE_OF_HALL, TREE_CORE, TREE_IDS, TREE_MAX, TREE_OPTIONAL, TOWN_CELLS, BOARD, hallOfIsle, treeClosure, treeCost, treeNeeds, treePlan,
} from '../shared/src/data/isletree.ts';
import type { TreeId } from '../shared/src/data/isletree.ts';
import { BUILDINGS } from '../shared/src/data/holdings.ts';
import type { BuildingId } from '../shared/src/data/holdings.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../shared/src/data/estate.ts';
import { PLOT_CELLS, GRID } from '../shared/src/data/base.ts';

test('every building has five levels at most, and every level of every building is reachable without a cycle', () => {
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
