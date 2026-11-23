// Owner, 2026-11-23: a hull's research asks, beside the experience, silver (the second tier) and the yard's goods
// (the third tier on), paid at a shipyard — «до 5 не обязательно ресурсы, будет достаточно просто серебра».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH_PRICE, researchParents, researchPrice } from '../shared/src/data/research.ts';
import { refitCost } from '../shared/src/data/shiplevel.ts';
import { research } from '../server/src/game/research.ts';
import { join, makeGame } from './helpers.ts';

test('research prices: silver only for the second tier and refits to ⚓5, goods from the third tier and ⚓6', () => {
  assert.deepEqual(RESEARCH_PRICE[2].goods, []);
  assert.ok(RESEARCH_PRICE[2].silver > 0);
  for (const t of [3, 4, 5]) assert.ok(RESEARCH_PRICE[t].goods.length && RESEARCH_PRICE[t].silver > RESEARCH_PRICE[t - 1].silver);
  for (const l of [2, 3, 4, 5]) assert.deepEqual(refitCost(l)!.goods, [], `⚓${l} silver only`);
  for (const l of [6, 7, 8, 9, 10]) assert.ok(refitCost(l)!.goods.length, `⚓${l} asks goods`);
});

test('a research of the third tier: refused at sea, then for silver, then for goods; paid at a yard', () => {
  const { game } = makeGame();
  join(game, 'Draught Dora');
  const s = game.sessionByName('Draught Dora')!;
  const p = s.profile!;
  const r = (p as unknown as { research: { xp: Record<string, number>; free: number; done: string[] } }).research;
  r.done.push(...researchParents('brig'));
  r.free = 10_000_000;
  const dock = s.ship!.docked!;
  s.ship!.docked = null;
  assert.match(research(game, s, 'brig') ?? '', /at a shipyard/);
  s.ship!.docked = dock;
  const pr = researchPrice('brig');
  p.gold = pr.silver - 1;
  assert.match(research(game, s, 'brig') ?? '', /silver/);
  p.gold = pr.silver + 100;
  assert.match(research(game, s, 'brig') ?? '', /in the hold or your warehouse/);
  for (const g of pr.goods) s.ship!.cargo[g.good] = g.qty;
  assert.equal(research(game, s, 'brig'), null);
  assert.equal(p.gold, 100);
  for (const g of pr.goods) assert.equal(s.ship!.cargo[g.good] ?? 0, 0);
  assert.ok(r.done.includes('brig'));
});
