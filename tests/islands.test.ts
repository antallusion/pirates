// Living islands (docs/11 P3): every region a mix of biomes (seven new ones among them), and islands peopled
// from their own seed — hamlets, camps, forts, beasts — that landing parties can row ashore to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_MIX, REGIONS, REGION_IDS } from '../shared/src/world/regions.ts';
import type { IslandBiome } from '../shared/src/world/regions.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import { rollLife } from '../shared/src/world/islandlife.ts';
import type { LifeKind } from '../shared/src/world/islandlife.ts';
import { lifeOf } from '../server/src/game/exploration.ts';
import { join, makeGame, steps } from './helpers.ts';

const world = generateWorld(1337);

test('every region is a mix of biomes, and all seven new ones are on the chart', () => {
  const seen = new Set<IslandBiome>();
  for (const rid of REGION_IDS) {
    const islands = world.islands.filter((i) => i.region === rid && !i.portId);
    const biomes = new Set(islands.map((i) => i.biome));
    for (const b of biomes) assert.ok(BIOME_MIX[rid].some(([m]) => m === b), `${rid}: ${b} is of its mix`);
    if (islands.length >= 20) assert.ok(biomes.size >= 2, `${rid} is mixed (${[...biomes].join(', ')})`);
    for (const b of biomes) seen.add(b);
  }
  for (const b of ['jungle', 'mangrove', 'atoll', 'saltflat', 'blacksand', 'fungal', 'crystal'] as const) assert.ok(seen.has(b), `${b} on the chart`);
  // A key port's island keeps her region's own biome.
  for (const is of world.islands.filter((i) => i.portId && !i.portId.includes('_v'))) assert.equal(is.biome, REGIONS[is.region].biome, is.name);
});

test('the same seed lays the same biomes (and the islands stay where they were)', () => {
  const again = generateWorld(1337);
  assert.equal(again.islands.length, world.islands.length);
  for (let i = 0; i < world.islands.length; i++) {
    assert.equal(again.islands[i].biome, world.islands[i].biome);
    assert.equal(again.islands[i].x, world.islands[i].x);
  }
});

test('island life: the same for server and client, and where it belongs', () => {
  const count = new Map<LifeKind, number>();
  for (const is of world.islands) {
    const server = lifeOf(is).map((x) => x.kind).join(',');
    // What the client receives: rounded metres.
    const client = rollLife({ id: is.id, region: is.region, biome: is.biome, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly: is.poly.map((v) => Math.round(v)), features: is.features, portId: is.portId })
      .map((x) => x.kind).join(',');
    assert.equal(client, server, `island ${is.id}`);
    for (const site of lifeOf(is)) {
      count.set(site.kind, (count.get(site.kind) ?? 0) + 1);
      const safety = REGIONS[is.region].safety;
      if (site.kind === 'pirate_camp' || site.kind === 'smugglers') assert.notEqual(safety, 'safe', 'no camps in safe water');
      if (site.kind === 'fishers' || site.kind === 'garrison') assert.notEqual(safety, 'lawless', 'no hamlets or garrisons in lawless water');
      if (site.kind === 'seals') assert.ok(['ice', 'barren', 'blacksand', 'saltflat'].includes(is.biome));
      if (site.kind === 'turtles') assert.ok(['atoll', 'jungle'].includes(is.biome));
      if (site.kind !== 'gulls') assert.ok(!is.portId || !['fishers', 'smugglers', 'pirate_camp', 'garrison'].includes(site.kind), 'a port island is her town\'s');
    }
  }
  for (const k of ['fishers', 'smugglers', 'pirate_camp', 'garrison', 'seals', 'crabs', 'turtles', 'gulls'] as const) assert.ok((count.get(k) ?? 0) > 3, `${k}: ${count.get(k) ?? 0} on the chart`);
});

test('a landing party rows ashore to a pirate camp: a fight on the sand, plunder or losses', () => {
  const { game } = makeGame();
  const is = game.world.islands.find((i) => lifeOf(i).some((x) => x.kind === 'pirate_camp') && !i.features.some((f) => f !== 'port'))
    ?? game.world.islands.find((i) => lifeOf(i).some((x) => x.kind === 'pirate_camp'))!;
  const c = join(game, 'Raider');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === 'Raider')!;
  const ship = s.ship!;
  s.profile!.level = 30;
  // Just off her coast.
  const site = lifeOf(is).find((x) => x.kind === 'pirate_camp')!;
  const px = is.poly[site.v * 2], py = is.poly[site.v * 2 + 1];
  const dx = px - is.x, dy = py - is.y, l = Math.hypot(dx, dy);
  ship.state.x = px + (dx / l) * 120;
  ship.state.y = py + (dy / l) * 120;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  // Everything else on the island already worked, so the camp is what the boats go for.
  for (const f of [...is.features, ...lifeOf(is).map((x) => x.kind)]) if (f !== 'pirate_camp') s.profile!.explored[`${is.id}:${f}`] = game.now;
  const gold0 = s.profile!.gold, crew0 = ship.crew;
  c.push({ t: 'land' });
  assert.ok(ship.landing && ship.landing.feature === 'pirate_camp', `boats away to ${ship.landing?.feature}`);
  steps(game, 20 * 45);
  assert.equal(ship.landing, null, 'back aboard');
  assert.ok(ship.crew < crew0, 'men lost in the fight');
  assert.ok(c.all('toast').some((t) => /pirate camp/.test(t.msg)), 'the report');
  assert.ok(s.profile!.gold >= gold0, 'plunder, or at worst nothing');
});
