// docs/29 step 9 (owner, 2026-10-11: «Каждый 4 остров должен держать какой-то порт куда можно заплыть починиться
// что-то докупить особенно людей»): a harbour town on about every fourth island — deterministic by the seed, spread over
// every sea but the Abyss, the ports before keeping their ids and places, the islands keeping theirs (no `portId`), each
// town with a market, a tavern's hands and a yard; a captain docks, mends and hires there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { generateWorld, portOfIsland, legacyWorld, beforePorts, nearHarbour, TOWN_GAP } from '../shared/src/world/worldgen.ts';
import type { World } from '../shared/src/world/worldgen.ts';
import { ISLES_PER_PORT, NO_TOWNS, countedIsles, townNameRu } from '../shared/src/world/towns.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { portDwellings } from '../shared/src/data/town.ts';
import { buildAdv } from '../shared/src/data/advmap.ts';
import { buildMines } from '../shared/src/data/mines.ts';
import { findPath } from '../server/src/game/nav.ts';
import { setLang } from '../client/src/i18n.ts';
import { placeName } from '../client/src/ui/maps.ts';
import { join, makeGame, steps } from './helpers.ts';

const world = generateWorld(WORLD_SEED);
const towns = (w: World) => w.ports.slice(w.townsFrom);

test('a port for about every fourth island in every sea but the Abyss; before → after counted', () => {
  for (const w of [world, generateWorld(1337)]) {
    assert.ok(w.townsFrom !== undefined && w.townsFrom > 0);
    const before = w.townsFrom!;
    assert.ok(w.ports.length - before >= 200, `${w.ports.length - before} towns (${before} → ${w.ports.length})`);
    for (const rid of REGION_IDS) {
      const isles = countedIsles(w, rid).length;
      const ports = w.ports.filter((p) => p.region === rid).length;
      if (NO_TOWNS.includes(rid)) {
        assert.equal(towns(w).filter((p) => p.region === rid).length, 0, 'none in the Abyss');
        continue;
      }
      // About one in four (a dense archipelago may fall a little short of clear coasts for its towns).
      assert.ok(ports <= Math.round(isles / ISLES_PER_PORT) && ports >= Math.round(isles / ISLES_PER_PORT) * 0.85, `${rid}: ${ports} ports for ${isles} islands`);
    }
  }
});

test('deterministic by the seed; the ports, islands and placements before stand where they stood', () => {
  const again = generateWorld(WORLD_SEED);
  assert.deepEqual(again.ports.map((p) => [p.id, p.x, p.y, p.islandId, p.name]), world.ports.map((p) => [p.id, p.x, p.y, p.islandId, p.name]));
  // The ports before keep their ids and places, in their order; the islands are the same objects, none with a new portId.
  const old = beforePorts(world);
  world.ports.slice(0, old.ports.length).forEach((p, i) => assert.equal(p, old.ports[i]));
  assert.equal(world.islands.length, (world.portIslesFrom ?? 0) + 20 + (world.islands.length - (world.portIslesFrom ?? 0) - 20), 'no new island');
  for (const p of towns(world)) {
    assert.match(p.id, /^[a-z_]+_t\d+$/);
    const is = world.islands[p.islandId];
    assert.ok(is && !is.portId && !is.minor && !is.raft, `${p.id}: her island stays an island`);
    assert.equal(portOfIsland(world, is.id), p.id);
    assert.equal(is.region, p.region);
  }
  assert.equal(new Set(world.ports.map((p) => p.id)).size, world.ports.length, 'unique ids');
  assert.equal(new Set(towns(world).map((p) => p.islandId)).size, towns(world).length, 'a town an island');
  // What is placed from the islands stays: the mines, the adventure map (which no harbour has under its guns).
  assert.equal(legacyWorld(world), legacyWorld(old));
  const mines = new Set(buildMines(world).map((m) => m.islandId));
  const adv = buildAdv(world);
  for (const p of towns(world)) {
    assert.ok(!mines.has(p.islandId), `${p.id}: not on a mine's island`);
    for (const o of [...adv.objs, ...adv.guards]) assert.ok(Math.hypot(o.x - p.x, o.y - p.y) >= 1600, `${o.id} under ${p.name}'s guns`);
    for (const r of world.ports.filter((q) => q.raft)) assert.ok(Math.hypot(r.x - p.x, r.y - p.y) >= 5500, `${r.name} still far out at sea`);
  }
  // A town keeps a hamlet's harbour: the sea's happenings stand TOWN_GAP off it, the old harbours their own gaps.
  const t = towns(world)[0];
  assert.ok(nearHarbour(world, t.x + TOWN_GAP - 50, t.y, 3000), 'inside a town harbour');
});

test('spread evenly: the farthest any island lies from a harbour falls, every sea\'s towns over its whole water', () => {
  const far = (ports: { x: number; y: number }[], rid: string) => Math.max(...countedIsles(world, rid as never).map((is) => Math.min(...ports.map((p) => Math.hypot(p.x - is.x, p.y - is.y)))));
  for (const rid of REGION_IDS.filter((r) => !NO_TOWNS.includes(r))) {
    const before = far(world.ports.slice(0, world.townsFrom), rid), after = far(world.ports, rid);
    assert.ok(after < before * 0.75, `${rid}: the farthest island ${Math.round(before)} m → ${Math.round(after)} m from a harbour`);
  }
});

test('each town: a market, a tavern, a yard; named in both tongues; a course from her neighbours', () => {
  setLang('ru');
  try {
    for (const p of towns(world)) {
      assert.ok(Object.keys(p.profile.produces).length >= 1 && (p.profile.consumes.provisions ?? 0) > 0, `${p.id}: a market`);
      assert.ok(portDwellings(p).some((d) => d.tier === 1), `${p.id}: a tavern's hands`);
      assert.ok(p.shipyardTier >= 1, `${p.id}: a yard`);
      assert.ok(p.size === 1 || p.size === 2);
      assert.ok(townNameRu(p.name.replace(/ \d+$/, '')), `${p.name}: a composed name`);
      assert.match(placeName(p.name), /[а-яё]/i, `${p.name} in Russian`);
    }
  } finally {
    setLang('en');
  }
  assert.equal(new Set(world.ports.map((p) => p.name)).size, world.ports.length, 'no two ports share a name');
  // A course to every tenth town from her nearest harbour of before (the helmsman's grid knows her anchorage).
  const old = world.ports.slice(0, world.townsFrom).filter((p) => !p.raft);
  let tried = 0, found = 0;
  towns(world).forEach((p, i) => {
    if (i % 10) return;
    const q = old.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    tried++;
    if (findPath(world, q.x, q.y, p.x, p.y, 80000)) found++;
  });
  assert.ok(found / tried >= 0.95, `${found}/${tried} courses`);
});

test('a captain docks at a town, mends her hull and hires hands; her island may still be claimed', () => {
  const { game } = makeGame();
  const c = join(game, 'Town Caller');
  c.push({ t: 'undock' });
  const s = game.sessionByName('Town Caller')!;
  const ship = s.ship!;
  s.profile!.gold = 50_000;
  const p = towns(game.world).find((x) => x.region === 'black_coast')!;
  ship.state.x = p.x;
  ship.state.y = p.y;
  ship.state.speed = 0;
  ship.lastCombat = -999;
  s.profile!.infamy = 0;
  game.grid.upsert(ship.id, p.x, p.y);
  c.push({ t: 'dock', bribe: false });
  steps(game, 2);
  assert.equal(ship.docked, p.id, `docked at ${p.name}`);
  const view = c.last('port')?.view;
  assert.ok(view && view.portId === p.id);
  assert.ok(view!.market.length > 0, 'her market');
  assert.ok(view!.tavern, 'her tavern');
  ship.hull = ship.stats.hullMax * 0.5;
  const g0 = s.profile!.gold;
  c.push({ t: 'repair', on: true } as never);
  steps(game, 1);
  assert.ok(ship.hull >= ship.stats.hullMax - 1e-6 && s.profile!.gold < g0, 'mended for silver');
  const crew0 = ship.crew;
  game.tavernCrew.set(p.id, 20);
  c.push({ t: 'hire_crew', qty: 3 });
  steps(game, 1);
  assert.ok(ship.crew > crew0, `hands hired (${crew0} → ${ship.crew})`);
  // Her island is still an island: the town on its coast leaves it free to claim (docs/29).
  assert.equal(game.world.islands[p.islandId].portId, undefined);
});
