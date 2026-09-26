import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { cargoVolume, computeShipStats } from '../shared/src/sim/shipstats.ts';
import { DIG_RANGE, stepExplorer, canDive, diveDepth, forecast, makeMap, mapCircle, recordTrails, regionCharted, soundings, trailsFor } from '../server/src/game/explorefx.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks) {
  const c = join(game, name, 'navigator');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e5;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function toSea(game: Game, s: PlayerSession, x = 30000, y = 80000): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function dockAt(game: Game, s: PlayerSession) {
  const port = game.world.ports[0];
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  return port;
}

test('exploration tree data: 24 talents, 36 ranks, two exclusive keystones', () => {
  const list = TALENTS.filter((t) => t.tree === 'exploration');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 36);
  const ks = list.filter((t) => t.keystone);
  assert.deepEqual(ks.map((t) => t.excludes).sort(), ['exp_beyond_the_edge', 'exp_gold_fever']);
});

test('Expedition Stores: provisions take less hold', () => {
  const lo = { classId: 'brig' as const, name: 'x', guns: { port: 'long_9' as const, starboard: 'long_9' as const }, modules: {} };
  const st = computeShipStats(lo, 'navigator', { exp_expedition_stores: 2 });
  assert.ok(st.provisionVolumeMul < 1);
  const cargo = { provisions: 40, rum: 10 };
  assert.ok(cargoVolume(cargo, 1, 1, st.provisionVolumeMul) < cargoVolume(cargo, 1, 1, 1));
});

test('treasure maps: circle shrinks with Treasure Hunter; Legend Seeker pins a legendary map', () => {
  const { game } = makeGame();
  const plain = captain(game, 'Plain', {});
  const hunter = captain(game, 'Hunter', { exp_treasure_hunter: 2 });
  const seeker = captain(game, 'Seeker', { exp_legend_seeker: 1 });
  const m = makeMap(game, 2);
  const a = mapCircle(m, plain.ship), b = mapCircle(m, hunter.ship);
  assert.ok(b.r < a.r * 0.7);
  // The true spot is always inside the drawn circle.
  assert.ok(Math.hypot(a.x - m.sx, a.y - m.sy) <= a.r);
  assert.ok(Math.hypot(b.x - m.sx, b.y - m.sy) <= b.r);
  const leg = makeMap(game, 3, { legendary: true });
  const c = mapCircle(leg, seeker.ship);
  assert.equal(c.r, 0);
  assert.equal(c.x, leg.sx);
});

test('digging: the boats go ashore in the circle, a miss points onward, the spot yields the hoard', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Digger', { exp_treasure_hunter: 2 });
  const m = makeMap(game, 1);
  p.explore.maps.push(m);
  // First inside the circle but far from the spot.
  const circ = mapCircle(m, ship);
  const miss = { x: circ.x + (circ.x - m.sx), y: circ.y + (circ.y - m.sy) };
  if (Math.hypot(miss.x - m.sx, miss.y - m.sy) > DIG_RANGE + 10) {
    toSea(game, s, miss.x, miss.y);
    c.push({ t: 'land' });
    assert.equal(ship.landing?.feature, 'dig');
    steps(game, 20 * 30);
    assert.equal(ship.landing, null);
    assert.equal(p.explore.maps.length, 1, 'still holding the map after a miss');
    assert.ok(c.all('toast').some((t) => /landmarks on the map point further/.test(t.msg)));
  }
  toSea(game, s, m.sx, m.sy);
  const g0 = p.gold;
  c.push({ t: 'land' });
  assert.equal(ship.landing?.feature, 'dig');
  assert.ok(ship.landing!.until - game.now < 30, 'Treasure Hunter digs faster');
  steps(game, 20 * 30);
  assert.equal(p.explore.maps.length, 0, 'the map is spent');
  assert.ok(p.gold > g0 + 100, `silver from the hoard: ${p.gold - g0}`);
});

test('tavern maps: one per port per day, Rumor Hound gets the first free; fragments assemble; Map of the Dead merges', () => {
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'Rumour', { exp_rumor_hound: 1, exp_treasure_hunter: 1, exp_map_of_the_dead: 1 });
  dockAt(game, s);
  const g0 = p.gold;
  c.push({ t: 'treasure', action: 'buy' });
  assert.equal(p.explore.maps.length, 1);
  assert.equal(p.gold, g0, 'free rumour');
  c.push({ t: 'treasure', action: 'buy' });
  assert.equal(p.explore.maps.length, 1, 'one a day in this port');
  const other = game.world.ports[1];
  s.ship!.docked = other.id;
  p.docked = other.id;
  c.push({ t: 'treasure', action: 'buy' });
  assert.equal(p.explore.maps.length, 2);
  assert.equal(p.gold, g0 - 350, 'the rumour was already used today');
  // Fragments.
  p.explore.fragments = 3;
  c.push({ t: 'treasure', action: 'assemble' });
  assert.equal(p.explore.fragments, 0);
  assert.ok(p.explore.maps.some((m) => m.legendary && m.tier === 3));
  // Merge three stained maps into a captain's map.
  p.explore.maps = [makeMap(game, 1), makeMap(game, 1), makeMap(game, 1)];
  c.push({ t: 'treasure', action: 'merge', tier: 1 });
  assert.equal(p.explore.maps.length, 1);
  assert.equal(p.explore.maps[0].tier, 2);
});

test('merging needs Map of the Dead', () => {
  const { game } = makeGame();
  const { c, s, p } = captain(game, 'NoMerge', {});
  dockAt(game, s);
  p.explore.maps = [makeMap(game, 1), makeMap(game, 1), makeMap(game, 1)];
  c.push({ t: 'treasure', action: 'merge', tier: 1 });
  assert.equal(p.explore.maps.length, 3);
});

test('diving: depth limited by Pearl Diver; a wreck gives up cargo once per two hours', () => {
  const { game } = makeGame();
  const plain = captain(game, 'Shallow', {});
  const deep = captain(game, 'Deep', { exp_pearl_diver: 2 });
  assert.equal(diveDepth(plain.ship), 8);
  assert.equal(diveDepth(deep.ship), 40);
  const w = game.wrecks.find((x) => x.depth > 8 && x.depth <= 40)!;
  assert.ok(w, 'some wreck lies deeper than 8 m');
  assert.match(canDive(game, plain.s, w)!, /too deep/);
  assert.equal(canDive(game, deep.s, w), null);
  toSea(game, deep.s, w.x, w.y);
  deep.ship.cargo = {};
  const g0 = deep.p.gold;
  deep.c.push({ t: 'land' });
  assert.equal(deep.ship.landing?.feature, 'dive');
  steps(game, 20 * 27);
  assert.ok(deep.p.gold > g0, 'silver from the wreck');
  assert.ok(Object.keys(deep.ship.cargo).length > 0, 'cargo raised');
  assert.match(canDive(game, deep.s, w)!, /already stripped/);
  // The wreck is now on the chart even far away.
  toSea(game, deep.s, 30000, 80000);
  steps(game, 20);
  const self = deep.c.all('self').at(-1);
  assert.ok(self?.self.wrecks.some((x) => x.name === w.name));
});

test('trackers see wakes; a Ghost Wake fades after 20 s', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Tracker', { exp_trackers: 2 });
  toSea(game, s);
  const a = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 300, ship.state.y, 0);
  const b = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x - 300, ship.state.y, 0);
  b.addEffect({ id: 'test', until: 1e9, mods: { ghostWake: 1 } }, game.now);
  const brains = [game.npcs.get(a.id)!, game.npcs.get(b.id)!];
  for (let i = 0; i < 12; i++) {
    for (const br of brains) br.active = true;
    a.state.y -= 40;
    b.state.y -= 40;
    game.now += 5;
    recordTrails(game);
  }
  const tr = trailsFor(game, ship);
  const ta = tr.find((t) => t.pts.length > 6);
  assert.ok(ta, 'a long wake');
  assert.ok(tr.some((t) => t.pts.length <= 5), 'the ghost wake is short');
  const blind = captain(game, 'Blind', {});
  assert.deepEqual(trailsFor(game, blind.ship), []);
});

test('Sounding Line marks shallows; Weather Eye forecasts', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Sounder', { exp_sounding_line: 1, exp_weather_eye: 2 });
  // Park on a reef shallower than the cutter's keel.
  const rf = game.world.reefs.find((r) => r.depth < ship.cls.draft)!;
  toSea(game, s, rf.x, rf.y);
  assert.ok(soundings(game, ship).length > 0, 'shallows near the shore');
  const w = game.weather[ship.region];
  w.next = 'storm';
  w.until = game.now + 200;
  assert.deepEqual(forecast(game, ship), { kind: 'storm', in: 200 });
  w.until = game.now + 1000;
  assert.equal(forecast(game, ship), null, 'too far off for 6 minutes');
});

test('Charted Waters, Beyond the Edge and Gold Fever', () => {
  const { game } = makeGame();
  const nav = captain(game, 'Charted', { exp_charted_waters: 2 });
  toSea(game, nav.s);
  const region = nav.ship.region;
  for (const is of game.world.islands) if (is.region === region) nav.s.discovered.add(is.id);
  assert.ok(regionCharted(game, nav.s, region));
  steps(game, 21);
  assert.ok(nav.ship.hasEffect('charted_waters'));
  // Beyond the Edge in safe water: slower and the crew pines.
  const edge = captain(game, 'Edge', { exp_beyond_the_edge: 1 });
  const safePort = game.world.ports.find((p) => p.faction === 'league')!;
  toSea(game, edge.s, safePort.x + 600, safePort.y + 600);
  steps(game, 21);
  const e = edge.ship.effects.find((x) => x.id === 'beyond_edge');
  assert.notEqual(REGIONS[edge.ship.region].safety, 'lawless');
  assert.ok((e?.mods?.maxSpeed ?? 0) < 0, 'home waters weigh on the edge-runner');
  // Gold Fever: a hoard aboard sets pirates on your trail.
  const gold = captain(game, 'Fever', { exp_gold_fever: 1 });
  nav.ship.state.x = edge.ship.state.x = 90000;
  game.grid.upsert(nav.ship.id, 90000, nav.ship.state.y);
  toSea(game, gold.s, 30000, 80000);
  gold.p.explore.hoardAboard = true;
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', gold.ship.state.x + 3000, gold.ship.state.y, 0);
  const brain = game.npcs.get(pirate.id)!;
  brain.target = null;
  brain.chase = null;
  stepExplorer(game, gold.s);
  const chase = brain.chase as { id: number } | null;
  assert.equal(chase?.id, gold.ship.id, 'a pirate picks up the gold trail');
  assert.ok(npcHostileTo(game, pirate, gold.ship), 'gold draws pirates into safe water');
  gold.p.explore.hoardAboard = false;
  assert.ok(!npcHostileTo(game, pirate, gold.ship));
});
