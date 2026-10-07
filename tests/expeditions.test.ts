import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dist } from '../shared/src/math.ts';
import { regionAt, isLand } from '../shared/src/world/worldgen.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { MAZE_W, buildMaze } from '../server/src/game/expeditions.ts';
import type { DiveRun, PveSite, Room } from '../server/src/game/expeditions.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const SEC = 20;

function captainAt(game: Game, name: string, x: number, y: number, cls?: ShipClassId): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  if (cls) {
    ship.loadout.classId = cls;
    ship.recompute(game.now);
    ship.hull = ship.stats.hullMax;
    ship.crew = ship.stats.crewMax;
  }
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
  return { c, s };
}

/** Door-by-door route through the maze (breadth first). */
/** The shortest way through the maze's doors; `avoid` is a room not to pass through (a sealed vault). */
function route(rooms: Room[], from: number, to: number, avoid = -1): ('n' | 'e' | 's' | 'w')[] {
  const dirs = [['n', 1, 0, -1], ['e', 2, 1, 0], ['s', 4, 0, 1], ['w', 8, -1, 0]] as const;
  const prev = new Map<number, [number, 'n' | 'e' | 's' | 'w']>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const c = q.shift()!;
    if (c === to) break;
    for (const [d, bit, dx, dy] of dirs) {
      if (!(rooms[c].doors & bit)) continue;
      const n = c + dy * MAZE_W + dx;
      if (seen.has(n) || (n === avoid && n !== to)) continue;
      seen.add(n);
      prev.set(n, [c, d]);
      q.push(n);
    }
  }
  const out: ('n' | 'e' | 's' | 'w')[] = [];
  for (let c = to; c !== from; ) {
    const [p, d] = prev.get(c)!;
    out.unshift(d);
    c = p;
  }
  return out;
}

function walk(game: Game, c: FakeConn, run: DiveRun, to: number, avoid = -1): void {
  for (const d of route(run.rooms, run.pos, to, avoid)) {
    run.air = run.airMax; // the test is about the maze, not the air
    // The test sends far faster than a hand could: keep under the server's flood guard (90 messages a real
    // second), or a fast machine drops the moves and the walk stalls.
    for (const x of game.sessions) x.msgCount = 0;
    c.push({ t: 'dive_move', dir: d });
    steps(game, 30);
  }
}

test('the sites: four sunken cities and two graveyards, in open water of their regions', () => {
  const { game } = makeGame();
  const sites = game.expeditions.sites;
  assert.equal(sites.filter((s) => s.kind === 'city').length, 4);
  assert.equal(sites.filter((s) => s.kind === 'graveyard').length, 2);
  for (const s of sites) {
    assert.equal(regionAt(game.world, s.x, s.y), s.region);
    assert.equal(isLand(game.world, s.x, s.y), null);
    assert.ok(s.kind === 'graveyard' ? s.region === 'dead_mans_expanse' : ['drowned_crown', 'the_abyss'].includes(s.region));
  }
});

test('a drowned maze: every room reachable from the entry, one vault, one key, one shrine', () => {
  const rooms = buildMaze(1234);
  const entry = rooms.findIndex((r) => r.kind === 'entry');
  for (let i = 0; i < rooms.length; i++) assert.ok(i === entry || route(rooms, entry, i).length > 0, `room ${i} reachable`);
  assert.equal(rooms.filter((r) => r.kind === 'vault').length, 1);
  assert.equal(rooms.filter((r) => r.kind === 'key').length, 1);
  assert.equal(rooms.filter((r) => r.kind === 'shrine').length, 1);
});

test('a sunken city: anchored over the buoy, the bell goes down, the key opens the vault, and the haul comes up at the entry', () => {
  const { game } = makeGame();
  // The maze is new every hour (expeditions.ts: the wall clock's hour in its seed): one fixed hour, so the test does not
  // hang on the real clock (CLAUDE.md §5; on 2026-10-07 at 20:00 the walk to the vault failed whatever the code).
  const wall = Date.UTC(2026, 9, 7, 12, 30);
  game.wallNow = () => wall;
  const site = game.expeditions.sites.find((s) => s.kind === 'city')!;
  const { c, s } = captainAt(game, 'Dora Diver', site.x + 40, site.y, 'brig');
  steps(game, SEC + 1);
  assert.equal(s.landable?.action, 'expedition');
  // Not while under way.
  s.ship!.state.speed = 4;
  c.push({ t: 'land' });
  assert.match(c.last('toast')!.msg, /Heave to/);
  s.ship!.state.speed = 0;
  const crew = s.ship!.crew;
  c.push({ t: 'land' });
  const run = game.expeditions.runOf(s.accountId)!;
  assert.ok(run, 'the bell is down');
  assert.ok(s.ship!.crew < crew, 'divers went with it');
  assert.ok(c.last('dive')?.view);
  // The vault is sealed without the key.
  const vault = run.rooms.findIndex((r) => r.kind === 'vault');
  const key = run.rooms.findIndex((r) => r.kind === 'key');
  const entry = run.pos;
  // Walk to the vault door (the room before it) and knock, unless the key lay on the way.
  const toVault = route(run.rooms, entry, vault);
  const knock = toVault.pop()!;
  const step = { n: -MAZE_W, e: 1, s: MAZE_W, w: -1 } as const;
  const door = toVault.reduce((at, d) => at + step[d], entry);
  walk(game, c, run, door);
  if (run.keys === 0) {
    c.push({ t: 'dive_move', dir: knock });
    assert.match(c.last('toast')!.msg, /sealed/);
    assert.equal(run.pos, door);
  }
  // The maze is new every hour: in some the shortest way from the vault door to the key runs through the sealed vault.
  walk(game, c, run, key, run.keys === 0 ? vault : -1);
  assert.equal(run.keys >= 1 || run.rooms[vault].done, true, 'the key');
  walk(game, c, run, vault);
  assert.ok(run.rooms[vault].done && run.plan, 'the vault opened');
  // Not from here.
  c.push({ t: 'dive_surface' });
  assert.match(c.last('toast')!.msg, /entry shaft/);
  walk(game, c, run, entry);
  const gold = s.profile!.gold;
  const plans = s.profile!.plans.length;
  c.push({ t: 'dive_surface' });
  assert.equal(game.expeditions.runOf(s.accountId), undefined);
  assert.ok(s.profile!.gold > gold, 'silver');
  assert.ok(s.profile!.plans.length > plans, 'the vault plans');
  assert.ok([...game.loot.values()].some((l) => l.ownerOnly === s.accountId), 'the haul floats by her side');
  assert.equal(c.last('dive')?.view, null);
  // Not again at once.
  steps(game, SEC + 1);
  c.push({ t: 'land' });
  assert.match(c.last('toast')!.msg, /rest/);
});

test('a sunken city: the dead come for the anchored ship, and a dragged anchor loses the bell', () => {
  const { game } = makeGame();
  const site = game.expeditions.sites.find((s) => s.kind === 'city')!;
  const { c, s } = captainAt(game, 'Ned Anchor', site.x, site.y + 30, 'brig');
  c.push({ t: 'land' });
  const run = game.expeditions.runOf(s.accountId)!;
  assert.ok(run);
  steps(game, SEC * 47);
  assert.ok(run.adds.size >= 2, 'the drowned rise');
  const add = game.ships.get([...run.adds][0])!;
  assert.equal(game.npcs.get(add.id)?.target, s.ship!.id);
  // Drag the anchor.
  const crew = s.ship!.crew;
  s.ship!.state.x += 1000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  steps(game, SEC + 1);
  assert.equal(game.expeditions.runOf(s.accountId), undefined, 'the line parted');
  assert.ok(c.all('toast').some((t) => /parted/.test(t.msg)));
  assert.ok(s.ship!.crew <= crew, 'the divers are lost');
  assert.equal(run.adds.size > 0 && [...run.adds].every((id) => !game.ships.get(id)?.alive), true, 'the drowned sink back');
});

test('a ship graveyard: the wall holds but at broken gates; deep keels scrape; the Graveyard Captain rises at the heart and leaves a chest', () => {
  const { game } = makeGame();
  steps(game, 2);
  const site = game.expeditions.sites.find((x) => x.kind === 'graveyard') as PveSite;
  const yard = game.expeditions.yards.get(site.id)!;
  assert.ok(yard, 'the graveyard is filled');
  assert.equal(yard.gates.length, 3);
  assert.equal(yard.hulks.size, 9);
  // Sail at the wall away from any gate: thrown back.
  const g0 = yard.gates[0];
  const a = g0.a + Math.PI / 3;
  const { c, s } = captainAt(game, 'Wren Wall', site.x + Math.sin(a) * 380, site.y - Math.cos(a) * 380, 'cutter');
  const ship = s.ship!;
  const charge = (ang: number) => {
    ship.state.x = site.x + Math.sin(ang) * 420;
    ship.state.y = site.y - Math.cos(ang) * 420;
    ship.state.heading = ang + Math.PI; // straight at the heart
    for (let i = 0; i < SEC * 12; i++) {
      ship.state.speed = 8;
      ship.state.heading = Math.atan2(site.x - ship.state.x, -(site.y - ship.state.y));
      game.step();
    }
  };
  charge(a);
  assert.ok(dist(ship.state.x, ship.state.y, site.x, site.y) >= 360, 'the wall holds');
  // Break the gate hulk (a mortar's work) and the gate opens.
  const [hulkId] = [...yard.hulks.entries()].find(([, h]) => h.gate === 0)!;
  const hulk = game.ships.get(hulkId)!;
  assert.equal(hulk.cls.monster, true);
  const rep = { ...s.profile!.reputation };
  applyDamage(game, hulk, { hull: hulk.hull + 10 }, ship);
  steps(game, 2);
  assert.equal(yard.gates[0].open, true);
  assert.deepEqual(s.profile!.reputation, rep, 'a hulk is nobody’s ship');
  charge(g0.a);
  assert.ok(dist(ship.state.x, ship.state.y, site.x, site.y) < 360, 'through the gate');
  // A deep keel scrapes in the field.
  const deep = captainAt(game, 'Gus Galleon', site.x + Math.sin(a) * 600, site.y - Math.cos(a) * 600, 'galleon');
  const hull = deep.s.ship!.hull;
  steps(game, SEC * 4);
  assert.ok(deep.s.ship!.hull < hull);
  // The heart: the Captain rises.
  ship.state.x = site.x + 50;
  ship.state.y = site.y;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  steps(game, SEC + 1);
  assert.ok(yard.captain);
  const cap = game.ships.get(yard.captain)!;
  assert.equal(cap.name, 'The Graveyard Captain');
  assert.ok(c.all('toast').some((t) => /Graveyard Captain rises/.test(t.msg)));
  applyDamage(game, cap, { hull: cap.hull + 10 }, ship);
  assert.ok(yard.resetAt > game.now, 'the graveyard rests');
  assert.ok([...game.loot.values()].some((l) => l.ownerOnly === s.accountId && (l.cargo.planks ?? 0) > 0), 'the chest');
  assert.ok((s.profile!.bossLocks[`yard:${site.id}`] ?? 0) > game.wallNow(), 'rares once a day');
  // After the rest (and with nobody at the heart), new wrecks drift in.
  ship.state.x = site.x + 5000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  game.now += 1801;
  steps(game, SEC + 1);
  assert.equal(yard.gates[0].open, false);
  assert.equal(yard.captain, 0);
});
