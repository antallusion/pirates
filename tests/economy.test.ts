import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, midPrice, quoteBuy, quoteSell, tickMarket, bestRoute } from '../server/src/game/economy.ts';
import type { PriceMods } from '../server/src/game/economy.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { WORLD_SEED } from '../shared/src/constants.ts';

const world = generateWorld(WORLD_SEED);
const neutral: PriceMods = { buyMul: 1, sellMul: 1, lawfulPort: false, honest: false, duty: 0 };

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

test('every harbour has food to sell after a week of its own trade, the hungry ones too (playB: 218 of 318 had none)', () => {
  const empty: string[] = [];
  for (const p of world.ports) {
    const m = createMarket(p);
    const gm = m.goods.provisions;
    assert.ok(gm, `${p.id} trades provisions`);
    for (let i = 0; i < 24 * 4 * 7; i++) tickMarket(m, 900, false); // a week of «hours» of the market
    if (gm.stock < 10) empty.push(`${p.id} ${Math.round(gm.stock)}`);
  }
  assert.deepEqual(empty, [], 'no port without a barrel of provisions');
  const h = createMarket(world.ports.find((p) => p.id === 'hollowmere')!);
  for (let i = 0; i < 24 * 4 * 7; i++) tickMarket(h, 900, false);
  assert.ok(midPrice('provisions', h.goods.provisions!) > 12, 'a hungry harbour still asks more than the base price');
});

test('a harbour keeps food for the warships of its waters: a voyage and a half of the square\'s warship, at the price it had (playC: 31–54 whatever the waters)', async () => {
  const { sectorAt } = await import('../shared/src/world/sectors.ts');
  const { VICTUAL_CREW } = await import('../server/src/game/economy.ts');
  const { voyageFood } = await import('../shared/src/data/voyage.ts');
  const short: string[] = [];
  for (const p of world.ports) {
    const L = sectorAt(world, p.x, p.y).level;
    const m = createMarket(p, L), was = createMarket(p);
    for (let i = 0; i < 24 * 4 * 7; i++) {
      tickMarket(m, 900, false);
      tickMarket(was, 900, false);
    }
    const voyage = voyageFood({ crew: VICTUAL_CREW[L], provisionUse: 1, holdVolume: 1e9, provisionVolume: 1 });
    if (m.goods.provisions!.stock < voyage * 1.4) short.push(`${p.id} ⚓${L}: ${Math.round(m.goods.provisions!.stock)} for a voyage of ${voyage}`);
    // the price where the town's own trade put it (the same balance, a bigger store)
    const a = midPrice('provisions', m.goods.provisions!), b = midPrice('provisions', was.goods.provisions!);
    assert.ok(Math.abs(a - b) / b < 0.15, `${p.id}: ${b.toFixed(1)} → ${a.toFixed(1)}`);
  }
  assert.deepEqual(short, []);
});
