// docs/18 III — more islands, islands by their levels: step 6 of the generation (small islands, atolls, ridges) appended
// after every island before, each of them where she was, and everything the world alone places where it stood; the
// lanes and harbours open; every island's level and kind; the danger of a landing above one's level; the zones of one
// level and the hint to the nearest; the hidden islands (mist until a lookout, a map or an obelisk shows them, a richer
// cache); the turtle islands and the sandbars of the low tide; the supply routes from a claimed lair island; the admin's
// commands, and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { buildAdv } from '../shared/src/data/advmap.ts';
import { buildMines } from '../shared/src/data/mines.ts';
import { dist } from '../shared/src/math.ts';
import { ISLE_TYPES, ISLE_TYPE_DEFS, SUPPLY_MAX, isleDanger, isleLevel, isleType, isleZones, nearestZone, supplyWeek } from '../shared/src/world/archipelago.ts';
import { TURTLE_CYCLE, TURTLE_DOWN, TURTLE_UP, turtlePos, turtleRise, turtleTurn, turtleUp, turtles } from '../shared/src/world/drift.ts';
import { MORE_ISLES_SHARE, RAISED_ROOM } from '../shared/src/world/moreisles.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { SANDBAR_COUNT, TIDAL_COUNT, tidalIsles, tideLevel } from '../shared/src/world/tidal.ts';
import { generateWorld, isLand, legacyIslands, legacyWorld, portLanes, raiseIsland, segDist } from '../shared/src/world/worldgen.ts';
import { findPath } from '../server/src/game/nav.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { yardOf } from '../server/src/game/base.ts';
import { ownIsland } from '../server/src/game/estate.ts';
import { claimLair, islandFor, linkRoute, obeliskReveals, supplyView, supplyWeekly, turtleCollide, turtleUpNow } from '../server/src/game/isles18.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, steps } from './helpers.ts';

const world = generateWorld(WORLD_SEED);
const h = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);

function captain(game: Game, name: string): PlayerSession {
  const c = join(game, name);
  c.push({ t: 'undock' });
  steps(game, 2);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 100_000;
  return s;
}

// ------------------------------------------------------------------------------------------------ 25. more islands

test('#25 half as many islands again — small islands, atolls and ridges — appended after every island before', () => {
  for (const w of [world, generateWorld(1)]) {
    const before = legacyWorld(w).islands.length;
    const added = w.islands.length - w.isleFrom;
    assert.ok(added >= before * 0.4 && added <= before * 0.6, `${added} new to ${before}`);
    const fresh = w.islands.slice(w.isleFrom);
    for (const k of ['small', 'atoll', 'ridge'] as const) assert.ok(fresh.filter((i) => i.isle === k).length >= 10, `${k}s`);
    assert.ok(fresh.every((i, n) => i.id === w.isleFrom + n && !i.portId && !i.raft), 'appended, with ids of their own');
    // The islands before are the very islands of the world before step 6, then the room kept for raised islands.
    assert.equal(h(legacyIslands(w).slice(0, before)), h(legacyWorld(w).islands));
    assert.equal(w.isleFrom, before + RAISED_ROOM);
    assert.ok(w.islands.slice(before, w.isleFrom).every((i) => i.slot && i.minor && i.x < 0 && i.y < 0), 'empty places, off the chart');
  }
  assert.equal(MORE_ISLES_SHARE, 0.5);
  // The same seed, the same new islands.
  assert.equal(h(generateWorld(WORLD_SEED).islands.slice(world.isleFrom)), h(world.islands.slice(world.isleFrom)));
});

test('#25 an island the sea raises takes the id she had before step 6, in the world before it too', () => {
  const w = generateWorld(WORLD_SEED);
  const before = legacyWorld(w).islands.length;
  const r = { x: 40000, y: 60000, radius: 300, seed: 77, name: 'Newfire', region: 'gravewater' as const, biome: 'volcanic' as const, features: [] };
  const is = raiseIsland(w, r);
  assert.equal(is.id, before, 'the next after the islands of steps 1–5, as before step 6');
  assert.equal(w.islands[before], is);
  assert.equal(legacyWorld(w).islands[before]?.name, 'Newfire', 'and in the world the mines and the map are placed on');
  assert.ok(isLand(w, 40000, 60000) && isLand(legacyWorld(w), 40000, 60000));
  assert.equal(raiseIsland(w, { ...r, x: 41000, name: 'Second' }).id, before + 1);
  assert.equal(raiseIsland(w, r), is, 'raised once');
});

test('#25 the mines, the adventure map and the quests stand where they stood; the new land keeps off all of it', () => {
  const old = legacyWorld(world);
  assert.equal(buildAdv(world), buildAdv(old), 'the adventure map is the old world\'s');
  assert.equal(h(buildMines(world)), h(buildMines(old)));
  const adv = buildAdv(world);
  const fresh = world.islands.slice(world.isleFrom);
  const lanes = [...portLanes(world.ports), ...portLanes(world.ports.filter((p) => !p.raft))];
  for (const is of fresh) {
    for (const p of world.ports) assert.ok(dist(p.x, p.y, is.x, is.y) > 2400, `${is.name} off the harbour of ${p.name}`);
    for (const [ax, ay, bx, by] of lanes) assert.ok(segDist(is.x, is.y, ax, ay, bx, by) > is.radius + 500, `${is.name} off a lane`);
    for (const o of [...adv.objs, ...adv.guards]) assert.ok(dist(o.x, o.y, is.x, is.y) > is.radius + 300, `${is.name} off ${o.id}`);
    for (const q of world.reefs) assert.ok(dist(q.x, q.y, is.x, is.y) > q.radius + is.radius + 200, `${is.name} off reef ${q.id}`);
  }
  for (const is of fresh.filter((i) => i.isle !== 'ridge')) {
    for (const o of legacyIslands(world)) assert.ok(dist(o.x, o.y, is.x, is.y) > o.radius + is.radius + 500, `${is.name}: a channel to ${o.name}`);
  }
  // Every port still reaches her neighbours.
  let found = 0, tried = 0;
  for (const p of world.ports.filter((q) => !q.raft)) {
    const near = world.ports.filter((q) => q !== p && !q.raft).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y)).slice(0, 2);
    for (const q of near) {
      tried++;
      if (findPath(world, p.x, p.y, q.x, q.y, 60000)) found++;
    }
  }
  assert.equal(found, tried, `${found}/${tried} routes`);
});

// ------------------------------------------------------------------------------------------------ 26–27. levels and kinds

test('#26 #27 every island has her square\'s level ⚓1–10 and a kind; all six kinds on the chart, sent to the client', () => {
  const count = new Map<string, number>();
  for (const is of world.islands) {
    const lv = isleLevel(world, is);
    assert.ok(lv >= 1 && lv <= 10);
    assert.equal(lv, sectorAt(world, is.x, is.y).level);
    if (is.portId || is.minor) continue;
    count.set(isleType(is), (count.get(isleType(is)) ?? 0) + 1);
  }
  for (const t of ISLE_TYPES) assert.ok((count.get(t) ?? 0) >= 40, `${t}: ${count.get(t)}`);
  assert.equal(isleType({ id: 1, region: 'drowned_crown', biome: 'ruins', features: [], x: 0, y: 0 }), 'dead');
  assert.equal(isleType({ id: 1, region: 'ashen_isles', biome: 'volcanic', features: [], x: 0, y: 0 }), 'volcanic');
  assert.equal(isleType({ id: 1, region: 'dead_mans_expanse', biome: 'barren', features: [], x: 0, y: 0 }), 'graveyard');
  assert.equal(isleType({ id: 1, region: 'whispering', biome: 'mangrove', features: [], x: 0, y: 0 }), 'swamp');
  assert.equal(isleType({ id: 1, region: 'gravewater', biome: 'jungle', features: [], x: 0, y: 0 }), 'tropical');
  assert.equal(isleType({ id: 1, region: 'leviathan_reach', biome: 'ice', features: [], x: 0, y: 0 }), 'rocky');
  for (const t of ISLE_TYPES) {
    const d = ISLE_TYPE_DEFS[t];
    assert.ok(d.bestiary.length >= 2 && /[а-я]/.test(d.name[1]) && !/[a-z]/i.test(d.name[1]), t);
  }
  const { game } = makeGame();
  const s = captain(game, 'Chart Reader');
  const is = game.world.islands.find((i) => !i.portId && !i.hidden && i.isle === 'atoll')!;
  const d = islandFor(game, s, is);
  assert.equal(d.lv, isleLevel(game.world, is));
  assert.equal(d.ty, isleType(is));
  assert.equal(d.isle, 'atoll');
});

// ------------------------------------------------------------------------------------------------ 28. the danger

test('#28 the ladder at a landing: two levels above, a warning; three or more, deadly — on the prompt and in the log', () => {
  assert.equal(isleDanger(3, 4), null);
  assert.equal(isleDanger(3, 5), 'warn');
  assert.equal(isleDanger(3, 6), 'deadly');
  assert.equal(isleDanger(5, 1), null);
  const { game } = makeGame();
  const s = captain(game, 'Bold Lander');
  const out = runAdmin(game, s, '/isle danger deadly')!;
  assert.match(out, /⚓\d+/);
  steps(game, 25);
  assert.equal(s.landable?.danger, 'deadly', JSON.stringify(s.landable));
  assert.ok((s.landable?.lv ?? 0) - s.ship!.shipLevel >= 3);
});

// ------------------------------------------------------------------------------------------------ 29. the zones

test('#29 zones: archipelagos of one level all along the ladder, and the nearest of hers', () => {
  const zones = isleZones(world);
  const levels = new Set(zones.map((z) => z.level));
  for (let L = 1; L <= 9; L++) assert.ok(levels.has(L), `a zone of ⚓${L}`);
  for (const z of zones) {
    assert.ok(z.n >= 6);
    assert.equal(isleLevel(world, world.islands[z.island]), z.level);
    assert.ok(!world.islands[z.island].hidden);
  }
  const z = nearestZone(zones, 4, 20000, 80000)!;
  assert.equal(z.level, 4);
  const { game } = makeGame();
  const c = join(game, 'Zone Seeker');
  steps(game, 25);
  assert.equal(c.last('zones')?.list.length, zones.length, 'the zones go to the chart');
});

// ------------------------------------------------------------------------------------------------ 30. hidden islands

test('#30 a hidden island is mist on the chart until an obelisk, a lookout or a map shows her; sailing past does not', () => {
  const hidden = world.islands.filter((i) => i.hidden);
  assert.ok(hidden.length >= 25, `${hidden.length} hidden`);
  assert.ok(hidden.every((i) => i.id >= world.isleFrom && i.features.includes('cache')));
  assert.ok(isleZones(world).every((z) => !world.islands[z.island].hidden));
  const { game } = makeGame();
  const s = captain(game, 'Mist Walker');
  const is = game.world.islands.find((i) => i.hidden)!;
  const mist = islandFor(game, s, is);
  assert.ok(mist.mist && mist.name === '' && mist.features.length === 0, 'mist: no name, no coast, no features');
  runAdmin(game, s, '/isle hidden');
  const near = game.world.islands.filter((i) => i.hidden).sort((a, b) => dist(a.x, a.y, s.ship!.state.x, s.ship!.state.y) - dist(b.x, b.y, s.ship!.state.x, s.ship!.state.y))[0];
  assert.ok(dist(near.x, near.y, s.ship!.state.x, s.ship!.state.y) < near.radius + 400, 'lying off her');
  steps(game, 60);
  assert.ok(!s.discovered.has(near.id), 'not charted by sight');
  steps(game, 25);
  assert.ok(s.landable?.island !== near.name, 'no landing on what the mist hides');
  obeliskReveals(game, s, near.x + 2000, near.y);
  assert.ok(s.discovered.has(near.id), 'the obelisk shows her');
  const real = islandFor(game, s, near);
  assert.ok(!real.mist && real.name === near.name && real.secret);
});

// ------------------------------------------------------------------------------------------------ 31. temporary islands

test('#31 the turtle islands drift round open water, half an hour up and a quarter under; land to strike while up', () => {
  const list = turtles(world);
  assert.equal(list.length, 2);
  for (const d of list) {
    const a = turtlePos(d, 0), b = turtlePos(d, 600);
    assert.ok(dist(a.x, a.y, b.x, b.y) > 100 && dist(a.x, a.y, b.x, b.y) < 1500, 'she drifts, slowly');
    let up = 0;
    for (let t = 0; t < TURTLE_CYCLE; t += 30) if (turtleUp(d, t)) up++;
    assert.ok(Math.abs(up * 30 - TURTLE_UP) <= 60, `${up * 30} s up`);
    const t0 = 1000, turn = turtleTurn(d, t0);
    assert.ok(turn > t0 && turn - t0 <= Math.max(TURTLE_UP, TURTLE_DOWN) + 1);
    assert.notEqual(turtleUp(d, turn + 1), turtleUp(d, t0));
    assert.equal(turtleRise(d, t0), turtleRise(d, t0 + 1));
  }
  const { game } = makeGame();
  const s = captain(game, 'Shell Comber');
  assert.match(runAdmin(game, s, '/turtle go')!, /Off/);
  steps(game, 25);
  assert.equal(s.landable?.feature, 'the back of the great turtle');
  // A ship driven into her shell is put off it.
  const d = turtles(game.world)[0];
  const p = turtlePos(d, game.now);
  if (turtleUpNow(game, d)) {
    s.ship!.state.x = p.x + 20;
    s.ship!.state.y = p.y;
    assert.ok(turtleCollide(game, s.ship!, [[s.ship!.state.x, s.ship!.state.y]]));
    assert.ok(dist(s.ship!.state.x, s.ship!.state.y, p.x, p.y) >= d.r * 0.9);
  }
});

test('#31 the landing party combs a turtle\'s back once a rise; she sounds under them and they swim', () => {
  const { game } = makeGame();
  const c = join(game, 'Back Comber');
  c.push({ t: 'undock' });
  steps(game, 2);
  const s = game.sessionByName('Back Comber')!;
  runAdmin(game, s, '/turtle go');
  steps(game, 25);
  const g0 = s.profile!.gold;
  c.push({ t: 'land' });
  assert.equal(s.ship!.landing?.feature, 'turtle');
  steps(game, 20 * 20);
  assert.equal(s.ship!.landing, null);
  assert.ok(s.profile!.gold > g0, 'silver from her back');
  assert.ok(c.all('toast').some((t) => /combs the back of/.test(t.msg)));
  steps(game, 25);
  assert.notEqual(s.landable?.feature, 'the back of the great turtle', 'once a rise');
  // Again, and she dives under them.
  delete s.profile!.isle18!.turtles[0];
  delete s.profile!.isle18!.turtles[1];
  steps(game, 25);
  c.push({ t: 'land' });
  assert.equal((s.ship!.landing as { feature: string } | null)?.feature, 'turtle');
  runAdmin(game, s, '/turtle down');
  steps(game, 25);
  assert.equal(s.ship!.landing, null);
  assert.ok(c.all('toast').some((t) => /sounds under the party/.test(t.msg)));
});

test('#31 a dozen sandbars after the twenty banks, bared at every low tide; the banks before as they were', () => {
  const all = tidalIsles(world);
  assert.equal(all.length, TIDAL_COUNT + SANDBAR_COUNT);
  const bars = all.slice(TIDAL_COUNT);
  assert.ok(bars.every((b) => b.kind === 'tide' && world.reefs[b.reef].id >= world.reefsFrom));
  for (const b of bars) {
    let low = false, high = false;
    for (let t = 0; t < 4 * 3600; t += 60) (tideLevel(t, b.phase) < -0.5 ? (low = true) : (high = true));
    assert.ok(low && high);
  }
  assert.ok(new Set(all.map((b) => b.reef)).size === all.length, 'each on a reef of its own');
  assert.ok(new Set(all.map((b) => b.name)).size === all.length, 'each named apart');
});

// ------------------------------------------------------------------------------------------------ 32. supply routes

test('#32 a claimed lair island linked to her own island delivers its resource into the yard every week', () => {
  const { game } = makeGame();
  const s = captain(game, 'Route Keeper');
  runAdmin(game, s, '/tp gravewater');
  runAdmin(game, s, '/isle'); // an island of her own
  const h = ownIsland(game, s.accountId)!;
  assert.ok(h);
  const home = game.world.islands[h.island];
  const lair = game.world.islands.filter((i) => !i.portId && !i.minor && !i.hidden && i.id !== home.id && dist(i.x, i.y, home.x, home.y) < 20000).sort((a, b) => dist(a.x, a.y, home.x, home.y) - dist(b.x, b.y, home.x, home.y))[0];
  assert.equal(linkRoute(game, s, lair.id, true), 'That island is not yours');
  claimLair(game, s.accountId, lair.id, 'pirate');
  let v = supplyView(game, s);
  assert.equal(v.isles.length, 1);
  assert.equal(v.isles[0].linked, false);
  assert.equal(v.home?.island, home.id);
  assert.equal(linkRoute(game, s, lair.id, true), null);
  v = supplyView(game, s);
  assert.ok(v.isles[0].linked && v.nextIn > 0);
  const w = supplyWeek(isleType(lair), lair.region, isleLevel(game.world, lair));
  assert.equal(v.isles[0].good, w.good);
  const y0 = yardOf(game, h).res[w.good] ?? 0;
  supplyWeekly(game, 9999);
  assert.equal((yardOf(game, h).res[w.good] ?? 0) - y0, w.n, 'the week\'s delivery in the yard');
  supplyWeekly(game, 9999);
  assert.equal((yardOf(game, h).res[w.good] ?? 0) - y0, w.n, 'once a week');
  // No more than three, and none of her own island.
  assert.equal(SUPPLY_MAX, 3);
  claimLair(game, s.accountId, home.id, 'admin');
  assert.equal(linkRoute(game, s, home.id, true), 'This is your own island');
  // Unlinked: it delivers no more.
  assert.equal(linkRoute(game, s, lair.id, false), null);
  const y1 = yardOf(game, h).res[w.good] ?? 0;
  supplyWeekly(game, 10000);
  assert.equal(yardOf(game, h).res[w.good] ?? 0, y1);
  // A week's delivery is the lesser of a mine's: three days of a mine of the same good, by waters and level.
  assert.ok(supplyWeek('rocky', 'black_coast', 1).n < supplyWeek('rocky', 'ashen_isles', 9).n);
});

// ------------------------------------------------------------------------------------------------ the console and the words

test('the admin\'s commands of docs/18 III, in HELP in both languages, and every answer in Russian', () => {
  const { game } = makeGame();
  const s = captain(game, 'Isle Tester');
  const help = runAdmin(game, s, '/help')!;
  for (const c of ['/isle level', '/zone', '/turtle', '/sandbar', '/supply']) assert.ok(help.includes(c), c);
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  setLang('ru');
  try {
    for (const line of ['/isle level', '/isle type volcanic', '/isle atoll', '/isle ridge', '/isle hidden', '/zone', '/zone go', '/turtle go', '/turtle up', '/turtle down', '/turtle off', '/sandbar', '/supply claim', '/supply week', '/isle type nope', '/isle nope']) {
      const out = runAdmin(game, s, line)!;
      const t = serverText(out);
      assert.ok(!/\b(the|is|and|your|No|Off)\b/.test(t), `${line}: ${t}`);
    }
  } finally {
    setLang('en');
  }
});
