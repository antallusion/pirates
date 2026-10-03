// Twenty new ports (owner, 2026-10-03: «около 20 городов (портов)»; shared/src/world/newports.ts, step 8 of the
// generation): each in her sea under her flag on an island of her own, appended after everything before — every port,
// island, reef and mark of steps 1–7 where and what it was, and all that the world alone places with them; each new
// harbour reached by sea, her market from her trade at her size, her jobs, a market that starts on a save from before
// her, and her name and line in Russian. The Abyss holds none: the two the art queue gave it stand at its edge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NAV_CELL, WORLD_SEED } from '../shared/src/constants.ts';
import { buildAdv } from '../shared/src/data/advmap.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { generateIslandJobs, generateQuests } from '../shared/src/data/questgen.ts';
import { turtlePos, turtles } from '../shared/src/world/drift.ts';
import { ART_REGION, NEW_PORTS, PORT_ISLE_R, newPortProfile } from '../shared/src/world/newports.ts';
import { BIOME_MIX, KEY_PORTS } from '../shared/src/world/regions.ts';
import { WHIRLPOOLS, beforePorts, distanceToCurrents, generateWorld, isLand, islandsNear, legacyWorld, regionAt } from '../shared/src/world/worldgen.ts';
import type { World } from '../shared/src/world/worldgen.ts';
import { AuthService } from '../server/src/auth.ts';
import { createMarket } from '../server/src/game/economy.ts';
import { buildSites } from '../server/src/game/expeditions.ts';
import { Game } from '../server/src/game/Game.ts';
import { findPath } from '../server/src/game/nav.ts';
import { DATA_RU, NAME_RU, applyDataLocale } from '../client/src/lang/data.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, steps } from './helpers.ts';

const world = generateWorld(WORLD_SEED);
const h = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
const fresh = (w: World) => w.ports.slice(w.portsFrom);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// ------------------------------------------------------------------------------------------------ the twenty

test('twenty new ports, appended after every port before, each in her sea under her flag on an island of her own', () => {
  for (const w of [world, generateWorld(1), generateWorld(1337)]) {
    const ports = fresh(w);
    assert.equal(ports.length, 20, 'twenty, on every seed');
    assert.equal(w.ports.length, (w.portsFrom ?? 0) + 20);
    assert.deepEqual(ports.map((p) => p.id), NEW_PORTS.map((d) => d.id), 'in the art queue\'s order');
    assert.equal(w.islands.length, (w.portIslesFrom ?? 0) + 20);
    ports.forEach((p, i) => {
      const d = NEW_PORTS[i];
      assert.equal(p.region, d.region, p.id);
      assert.equal(p.faction, d.faction, p.id);
      assert.equal(p.size, d.size, p.id);
      assert.equal(p.shipyardTier, d.shipyardTier, p.id);
      assert.equal(p.blackMarket, d.blackMarket, p.id);
      assert.equal(p.name, d.name);
      assert.equal(p.description, d.description, 'her English line');
      assert.equal(p.key, false, 'the key ports are still the ten');
      assert.ok(!p.raft && !p.id.includes('_v') && !p.id.startsWith('raft_'), `${p.id}: not taken for a village or a floating town`);
      // Her island: the next after every island before, hers alone, in her sea, on ground of her sea.
      const is = w.islands[p.islandId];
      assert.equal(is.id, (w.portIslesFrom ?? 0) + i);
      assert.equal(is.portId, p.id);
      assert.ok(is.features.includes('port'));
      assert.equal(is.region, p.region);
      assert.equal(is.name, p.name, 'her island goes by her name, as a village\'s does');
      assert.ok(is.radius >= PORT_ISLE_R[d.size] * 0.6 && is.radius <= PORT_ISLE_R[d.size], `${p.id}: an island of her size (${is.radius})`);
      assert.ok(BIOME_MIX[ART_REGION[p.id] ?? p.region].some(([b]) => b === is.biome), `${p.id}: ${is.biome} of her sea`);
      assert.equal(regionAt(w, p.x, p.y), p.region, `${p.id}: her anchorage in her sea`);
      assert.equal(regionAt(w, is.x, is.y), p.region);
      // On the chart: in her chunk, land under her middle, water at her anchorage.
      assert.ok(islandsNear(w, is.x, is.y).includes(is.id));
      assert.equal(isLand(w, is.x, is.y), is);
      assert.ok(!isLand(w, p.x, p.y), `${p.id}: the anchorage is water`);
      assert.ok(dist(p.x, p.y, is.x, is.y) < is.radius + 200, `${p.id}: the anchorage off her own shore`);
    });
    for (const k of KEY_PORTS) assert.ok(!ports.some((p) => p.id === k.id));
  }
  // The same seed, the same towns where they were.
  assert.equal(h(fresh(generateWorld(WORLD_SEED))), h(fresh(world)));
});

test('the Abyss holds no port: the two the art queue gave it stand at its edge, in the Drowned Crown', () => {
  assert.ok(!world.ports.some((p) => p.region === 'the_abyss'));
  const edge = Object.keys(ART_REGION);
  assert.deepEqual(edge.sort(), ['last_light', 'marrowdeep']);
  for (const id of edge) {
    const p = world.ports.find((q) => q.id === id)!;
    assert.equal(ART_REGION[id], 'the_abyss');
    assert.equal(p.region, 'drowned_crown');
    let near = Infinity;
    for (let y = 0; y < 40000; y += 250) for (let x = 50000; x < 96000; x += 250) if (regionAt(world, x, y) === 'the_abyss') near = Math.min(near, dist(x, y, p.x, p.y));
    assert.ok(near < 3000, `${p.name}: ${Math.round(near)} m from the Abyss`);
  }
});

// ------------------------------------------------------------------------------------------------ nothing moved

test('every port, island, reef and mark before keeps her id and her place (the world before this step, by hash)', () => {
  // The world of steps 1–7 as the commit before this one made it (WORLD_SEED): counts and hashes.
  assert.equal(world.portIslesFrom, 1725);
  assert.equal(world.portsFrom, 58);
  assert.equal(h(world.islands.slice(0, 1725)), 'd716bc3d0dbe');
  assert.equal(h(world.ports.slice(0, 58)), '2ff62e9e6f9d');
  assert.equal(world.reefs.length, 344);
  assert.equal(h(world.reefs), 'eee9ba188080');
  assert.equal(world.marks.length, 3572);
  assert.equal(h(world.marks), '3fc1846ed40b');
  assert.equal(h(Array.from(beforePorts(world).navGrid)), 'bf9f4bf589db', 'the helmsman\'s grid before the new towns');
  // And on any seed: the world before step 8 is the same objects, in the same order.
  for (const w of [world, generateWorld(1)]) {
    const old = beforePorts(w);
    assert.notEqual(old, w);
    assert.equal(old.islands.length, w.portIslesFrom);
    w.islands.slice(0, w.portIslesFrom).forEach((is, i) => assert.equal(is, old.islands[i]));
    w.ports.slice(0, w.portsFrom).forEach((p, i) => assert.equal(p, old.ports[i]));
    assert.equal(w.reefs, old.reefs);
    assert.equal(w.marks, old.marks);
    assert.equal(legacyWorld(w), legacyWorld(old), 'and her world before step 6 is the same');
    // The helmsman's grid only closes under the new islands and opens at their anchorages.
    for (let k = 0; k < w.navGrid.length; k++) {
      if (w.navGrid[k] === old.navGrid[k]) continue;
      const x = (k % w.navSize) * NAV_CELL + NAV_CELL / 2, y = Math.floor(k / w.navSize) * NAV_CELL + NAV_CELL / 2;
      assert.ok(fresh(w).some((p) => {
        const is = w.islands[p.islandId];
        return dist(x, y, is.x, is.y) < is.radius + 200 + NAV_CELL;
      }), `cell ${k} changed away from the new islands`);
    }
  }
});

test('what the world alone places stands where it stood: the map, the turtles, the jobs, the sunken cities', () => {
  const old = beforePorts(world);
  assert.equal(h(buildAdv(world)), 'db750c9dc0f8', 'the adventure map, things and guards, ids and all');
  assert.equal(buildAdv(world), buildAdv(old));
  assert.deepEqual(turtles(world), turtles(old));
  assert.deepEqual(buildSites(world), buildSites(old));
  assert.deepEqual(generateIslandJobs(world, WORLD_SEED), generateIslandJobs(old, WORLD_SEED), 'the islands\' people send where they sent');
  // Every port's jobs before, each with her id and her course; the twenty's after them.
  const before = generateQuests(old, WORLD_SEED), now = generateQuests(world, WORLD_SEED);
  assert.deepEqual(now.slice(0, before.length), before);
  for (const p of fresh(world)) {
    const jobs = now.filter((q) => q.port === p.id);
    assert.ok(jobs.length >= 60, `${p.id}: ${jobs.length} jobs on her board`);
    assert.ok(jobs.every((q) => q.id.startsWith(`g_${p.id}_`)));
  }
});

test('each new island keeps a channel from all that was: islands, reefs, marks, the map\'s things, turtles, currents', () => {
  const old = beforePorts(world);
  const adv = buildAdv(world);
  const loops = turtles(world).flatMap((t) => Array.from({ length: 90 }, (_, k) => turtlePos(t, (k / 90) * t.lap)));
  const sites = buildSites(world);
  const isles = fresh(world).map((p) => world.islands[p.islandId]);
  for (const is of isles) {
    for (const o of old.islands) if (!o.slot) assert.ok(dist(o.x, o.y, is.x, is.y) > o.radius + is.radius + 600, `${is.name}: a channel to ${o.name}`);
    for (const q of old.reefs) assert.ok(dist(q.x, q.y, is.x, is.y) > q.radius + is.radius + 400, `${is.name}: off reef ${q.id}`);
    for (const m of old.marks) assert.ok(dist(m.x, m.y, is.x, is.y) > m.r + is.radius + 80, `${is.name}: off mark ${m.id}`);
    for (const o of [...adv.objs, ...adv.guards]) assert.ok(dist(o.x, o.y, is.x, is.y) > is.radius + 350, `${is.name}: off ${o.id}`);
    for (const t of loops) assert.ok(dist(t.x, t.y, is.x, is.y) > is.radius + 800, `${is.name}: off a turtle's loop`);
    for (const s of sites) assert.ok(dist(s.x, s.y, is.x, is.y) > is.radius + s.r + 400, `${is.name}: off ${s.name}`);
    assert.ok(distanceToCurrents(is.x, is.y) > is.radius + 500, `${is.name}: off the currents`);
    for (const w of WHIRLPOOLS) assert.ok(dist(w.x, w.y, is.x, is.y) > w.radius * 2.2 + is.radius, `${is.name}: off ${w.name}`);
    for (const o of isles) if (o !== is) assert.ok(dist(o.x, o.y, is.x, is.y) > o.radius + is.radius + 600, `${is.name}: a channel to ${o.name}`);
  }
  // Their harbours: out of a port's gunshot for the map's things, a good way from every other harbour, the floating
  // towns still far out at sea, and no sunken city under their guns.
  for (const p of fresh(world)) {
    for (const o of [...adv.objs, ...adv.guards]) assert.ok(dist(o.x, o.y, p.x, p.y) >= 1600, `${o.id} under ${p.name}'s guns`);
    for (const q of world.ports) if (q !== p) assert.ok(dist(q.x, q.y, p.x, p.y) >= (q.raft ? 5500 : 4000), `${p.name} by ${q.name}`);
    for (const s of sites) assert.ok(dist(s.x, s.y, p.x, p.y) >= 4000, `${s.name} by ${p.name}`);
  }
});

// ------------------------------------------------------------------------------------------------ by sea

test('each new harbour is reached by sea from her neighbours, and a captain docks at her', () => {
  let found = 0, tried = 0;
  for (const p of fresh(world)) {
    const near = world.ports.filter((q) => q !== p && !q.raft).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y)).slice(0, 3);
    for (const q of near) {
      tried++;
      if (findPath(world, p.x, p.y, q.x, q.y, 60000) && findPath(world, q.x, q.y, p.x, p.y, 60000)) found++;
      else assert.fail(`${p.name} ↔ ${q.name}: no course`);
    }
  }
  assert.equal(found, tried);
  // A captain at Frostgate's anchorage docks: her market, her tavern, her yard, her board, her group contract.
  const { game } = makeGame();
  const c = join(game, 'Frost Reader');
  c.push({ t: 'undock' });
  const s = game.sessionByName('Frost Reader')!;
  const ship = s.ship!;
  for (const p of fresh(game.world)) {
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
    for (const g of NEW_PORTS.find((d) => d.id === p.id)!.produces) assert.ok(view!.market.some((r) => r.good === g), `${p.name} sells ${g}`);
    assert.ok(view!.tavern, `${p.name}: a tavern`);
    assert.ok(view!.questOffers.length > 0, `${p.name}: her board`);
    c.push({ t: 'undock' });
    steps(game, 2);
  }
});

// ------------------------------------------------------------------------------------------------ markets

test('each has a market from her trade at her size, each good at the key ports\' own rates for it', () => {
  // The band each good runs at in the key ports (made or needed), widened for the towns' sizes.
  const band = new Map<GoodId, [number, number]>();
  for (const k of KEY_PORTS) for (const o of [k.profile.produces, k.profile.consumes]) for (const [g, n] of Object.entries(o)) {
    const b = band.get(g as GoodId) ?? [Infinity, 0];
    band.set(g as GoodId, [Math.min(b[0], n!), Math.max(b[1], n!)]);
  }
  for (const p of fresh(world)) {
    const d = NEW_PORTS.find((x) => x.id === p.id)!;
    assert.deepEqual(p.profile, newPortProfile(d));
    assert.deepEqual(Object.keys(p.profile.produces), d.produces);
    assert.deepEqual(Object.keys(p.profile.consumes), d.consumes);
    const m = createMarket(p);
    for (const g of d.produces) {
      assert.ok(m.goods[g]!.prod > 0 && m.goods[g]!.stock > m.goods[g]!.target, `${p.id} makes ${g}: plenty, cheap`);
    }
    for (const g of d.consumes) assert.ok(m.goods[g]!.cons > 0 && m.goods[g]!.stock < m.goods[g]!.target, `${p.id} needs ${g}: short, dear`);
    for (const [g, n] of [...Object.entries(p.profile.produces), ...Object.entries(p.profile.consumes)] as [GoodId, number][]) {
      const b = band.get(g);
      if (GOODS[g].category === 'rare') assert.ok(n >= 1 && n <= 4, `${p.id}: ${g} by the crate (${n})`);
      else if (b) assert.ok(n >= b[0] * 0.4 && n <= b[1] * 1.4, `${p.id}: ${g} ${n} against the key ports' ${b[0]}–${b[1]}`);
    }
    // A bigger town trades more of a good than a smaller one would.
    for (const g of d.produces) if (d.size > 1 && GOODS[g].category !== 'rare') assert.ok(p.profile.produces[g]! > newPortProfile({ ...d, size: 1 }).produces[g]!);
  }
  // The trades the art queue gave them, all of them goods of the game.
  for (const d of NEW_PORTS) for (const g of [...d.produces, ...d.consumes]) assert.ok(GOODS[g], g);
});

test('a server on a save from before them opens their markets beside the old ones, which keep their stocks', () => {
  const { game, db } = makeGame();
  const gm = game.markets.get('gravesend')!.goods.rum!;
  gm.stock = 777;
  game.saveAll();
  // The save as a server before them wrote it: no market of theirs.
  const saved = db.getKv<{ time: number; markets: Record<string, unknown> }>('world')!;
  for (const d of NEW_PORTS) delete saved.markets[d.id];
  db.setKv('world', saved);
  const again = new Game({ db, auth: new AuthService(db), log: () => {} });
  assert.equal(again.markets.get('gravesend')!.goods.rum!.stock, 777, 'the old market as saved');
  for (const p of fresh(again.world)) {
    const m = again.markets.get(p.id);
    assert.ok(m, `${p.id}: a market`);
    assert.deepEqual(m, createMarket(p), `${p.id}: opened fresh`);
    assert.ok(again.tavernCrew.get(p.id)! > 0, `${p.id}: hands in her tavern`);
    assert.equal(again.portById(p.id), p);
  }
  // And saved with the rest from then on.
  again.markets.get('bellhaven')!.goods.planks!.stock = 4321;
  again.saveAll();
  const third = new Game({ db, auth: new AuthService(db), log: () => {} });
  assert.equal(third.markets.get('bellhaven')!.goods.planks!.stock, 4321);
});

// ------------------------------------------------------------------------------------------------ Russian

test('every new town has her Russian name and line, on the chart and in the server\'s sentences', () => {
  NEW_PORTS.forEach((d, i) => {
    for (const f of ['name', 'description'] as const) {
      const ru = DATA_RU[`newports.NEW_PORTS.${i}.${f}`];
      assert.ok(ru && /[а-яё]/i.test(ru) && !/[a-z]/i.test(ru), `${d.id}.${f}: ${ru}`);
    }
  });
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const p of fresh(world)) {
      const name = NAME_RU.get(p.name);
      assert.ok(name && /[а-яё]/i.test(name), `${p.name} on the chart: ${name}`);
      assert.ok(!/[A-Za-z]/.test(serverText(p.name)), `${p.name}: ${serverText(p.name)}`);
      assert.ok(!/[A-Za-z]/.test(serverText(world.islands[p.islandId].name)), 'her island');
      assert.ok(!/[A-Za-z]/.test(serverText(p.description)), `${p.id}: ${serverText(p.description)}`);
    }
    assert.equal(serverText('Bellhaven'), 'Колокольная Гавань');
    assert.equal(serverText("Widow's Wick"), 'Вдовий Фитиль');
  } finally {
    setLang('en');
    applyDataLocale('en');
  }
  assert.equal(NEW_PORTS[0].name, 'Bellhaven', 'English again');
});
