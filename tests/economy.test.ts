import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, midPrice, quoteBuy, quoteSell, tickMarket, bestRoute } from '../server/src/game/economy.ts';
import type { PriceMods } from '../server/src/game/economy.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { WORLD_SEED } from '../shared/src/constants.ts';

const world = generateWorld(WORLD_SEED);
const neutral: PriceMods = { buyMul: 1, sellMul: 1, lawfulPort: false, honest: false };

test('producers sell cheap, consumers pay dear', () => {
  const blackwater = createMarket(world.ports.find((p) => p.id === 'blackwater')!);
  const gravesend = createMarket(world.ports.find((p) => p.id === 'gravesend')!);
  const cheap = midPrice('sugar', blackwater.goods.sugar!);
  const dear = midPrice('sugar', gravesend.goods.sugar!);
  assert.ok(dear > cheap * 1.5, `sugar ${cheap.toFixed(1)} → ${dear.toFixed(1)}`);
});

test('buying pushes the price up; a round trip in one port always loses money (no infinite money)', () => {
  const m = createMarket(world.ports.find((p) => p.id === 'hollowmere')!);
  const gm = m.goods.spices!;
  const before = midPrice('spices', gm);
  const cost = quoteBuy('spices', gm, 20, neutral);
  gm.stock -= 20;
  assert.ok(midPrice('spices', gm) > before);
  const back = quoteSell('spices', gm, 20, neutral);
  assert.ok(back < cost, `bought ${cost}, sold back ${back}`);
});

test('markets recover over time through production and consumption', () => {
  const m = createMarket(world.ports.find((p) => p.id === 'cinderhold')!);
  const gm = m.goods.gunpowder!;
  gm.stock = 1;
  for (let i = 0; i < 360; i++) tickMarket(m, 10, i % 6 === 0);
  assert.ok(gm.stock > 20, `powder stock recovered to ${gm.stock.toFixed(1)}`);
  assert.ok(gm.history.length > 0);
});

test('NPC merchants find profitable arbitrage routes', () => {
  const markets = new Map(world.ports.map((p) => [p.id, createMarket(p)]));
  const from = world.ports.find((p) => p.id === 'blackwater')!;
  const r = bestRoute(from, markets, world.ports, () => 0.5);
  assert.ok(r, 'a route exists');
  assert.ok(r!.margin > 0);
});
