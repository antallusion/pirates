import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES } from '../shared/src/data/bosses.ts';
import type { BossId } from '../shared/src/data/bosses.ts';
import { SF } from '../shared/src/protocol.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { dist, headingVec } from '../shared/src/math.ts';
import { bossBoarded, risingPoint, scoreOf, summon } from '../server/src/game/bosses.ts';
import type { Fight } from '../server/src/game/bosses.ts';
import { applyDamage, fireBroadside } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const SEC = 20;

function arena(kind: BossId, n = 2): { game: Game; f: Fight; body: ShipEntity; caps: { c: FakeConn; s: PlayerSession; ship: ShipEntity }[] } {
  const { game } = makeGame();
  const def = BOSSES[kind];
  const spot = risingPoint(game, def, def.regions)!;
  assert.ok(spot, 'there is open water for it');
  const f = summon(game, kind, spot.x, spot.y);
  const body = game.ships.get(f.id)!;
  const caps = [];
  for (let i = 0; i < n; i++) {
    const name = `Hunter ${'ABCDEFGH'[i]}`;
    const c = join(game, name);
    const s = game.sessionByName(name)!;
    const ship = s.ship!;
    ship.docked = null;
    s.profile!.docked = null;
    s.profile!.level = 30;
    ship.level = 30;
    at(game, ship, spot.x + 400 + i * 60, spot.y);
    ship.protectedUntil = 0;
    ship.region = f.region;
    caps.push({ c, s, ship });
  }
  return { game, f, body, caps };
}

function at(game: Game, ship: ShipEntity, x: number, y: number): void {
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.sail = 0;
  game.grid.upsert(ship.id, x, y);
}

function refit(ship: ShipEntity, cls: ShipClassId, now: number): void {
  ship.loadout.classId = cls;
  ship.recompute(now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
}

test('the calendar: taverns hear of a boss half an hour ahead, and it rises at its hour', () => {
  const { game } = makeGame();
  let wall = 1_000_000_000_000;
  game.wallNow = () => wall;
  const c = join(game, 'Rumour Rider');
  const s = game.sessionByName('Rumour Rider')!;
  s.ship!.region = 'whispering';
  const sc = game.bosses.schedule(game);
  for (const id of Object.keys(sc.next) as BossId[]) sc.next[id] = wall + 1e12;
  sc.next.kraken = wall + 20 * 60 * 1000;
  steps(game, SEC * 2);
  assert.ok(sc.pending.kraken, 'announced');
  assert.ok(c.all('toast').some((t) => /Tavern talk: Kraken stirs/.test(t.msg)));
  assert.ok(game.rumors.some((r) => r.text.includes('Kraken stirs')));
  assert.equal(game.bosses.fights.size, 0, 'not yet');
  wall += 21 * 60 * 1000;
  steps(game, SEC * 2);
  const f = [...game.bosses.fights.values()][0];
  assert.equal(f?.kind, 'kraken');
  assert.equal([...f.parts.values()].filter((p) => p === 'arm').length, 8, 'eight arms');
  assert.ok((sc.next.kraken ?? 0) > wall, 'the next rising is booked');
  assert.equal(sc.pending.kraken, undefined);
});

test('a boss that waits for night or storm rises only in its window', () => {
  const { game } = makeGame();
  let wall = 2_000_000_000_000;
  game.wallNow = () => wall;
  const sc = game.bosses.schedule(game);
  for (const id of Object.keys(sc.next) as BossId[]) sc.next[id] = wall + 1e12;
  sc.next.storm_widow = wall + 60_000;
  game.weather.leviathan_reach.kind = 'breeze';
  wall += 120_000;
  steps(game, SEC * 3);
  assert.ok(sc.pending.storm_widow, 'waiting for weather');
  assert.equal(game.bosses.fights.size, 0);
  game.weather.leviathan_reach.kind = 'storm';
  steps(game, SEC * 2);
  assert.equal([...game.bosses.fights.values()][0]?.kind, 'storm_widow');
});

test('Leviathan: it sounds unless harpoon lines hold it; held, its gills open (×2 at the head); the whirlpool bites', () => {
  const { game, f, body, caps } = arena('leviathan', 3);
  const [A, B, C] = caps;
  // Loose: it dives and nothing touches it.
  f.ready.dive = 0;
  steps(game, SEC + 1);
  assert.ok(body.hasEffect('submerged'));
  assert.ok(body.flagsFor(null, true, game.now) & SF.SUBMERGED);
  const hp = body.hull;
  applyDamage(game, body, { hull: 500 }, A.ship);
  assert.equal(body.hull, hp);
  // Held by two lines (half of three captains): the gills open.
  body.effects = body.effects.filter((e) => e.id !== 'submerged');
  for (const x of [A, B]) x.ship.tether = { target: body.id, until: game.now + 60, length: 300, strain: 0 };
  steps(game, SEC + 1);
  assert.ok(body.hasEffect('gills_open'));
  const h = headingVec(body.state.heading);
  const headPt = { x: body.state.x + h.x * body.stats.length * 0.42, y: body.state.y + h.y * body.stats.length * 0.42 };
  const tailPt = { x: body.state.x - h.x * body.stats.length * 0.42, y: body.state.y - h.y * body.stats.length * 0.42 };
  let before = body.hull;
  applyDamage(game, body, { hull: 100 }, C.ship, tailPt);
  assert.ok(Math.abs(before - body.hull - 100) < 1e-6, 'the flank takes plain damage');
  before = body.hull;
  applyDamage(game, body, { hull: 100 }, C.ship, headPt);
  assert.ok(Math.abs(before - body.hull - 200) < 1e-6, 'the gills take double');
  // Contribution: damage, and the lines count as control.
  const cc = f.contrib.get(C.s.accountId)!;
  assert.ok(cc.dmg >= 300);
  assert.ok((f.contrib.get(A.s.accountId)?.control ?? 0) >= 1);
  // Phase 2: the Roar of the Deep.
  body.hull = body.stats.hullMax * 0.6;
  steps(game, SEC + 1);
  assert.equal(f.phase, 1);
  assert.ok(f.whirl, 'a whirlpool');
  for (const x of caps) x.ship.tether = null;
  at(game, C.ship, f.whirl!.x + 40, f.whirl!.y);
  const hull = C.ship.hull;
  steps(game, 5);
  assert.ok(C.ship.hull <= hull - C.ship.stats.hullMax * 0.14, 'bitten at the mouth');
  // Farther out the current drags her round and in.
  at(game, B.ship, f.whirl!.x + 500, f.whirl!.y);
  const d0 = dist(B.ship.state.x, B.ship.state.y, f.whirl!.x, f.whirl!.y);
  steps(game, SEC * 2);
  assert.ok(dist(B.ship.state.x, B.ship.state.y, f.whirl!.x, f.whirl!.y) < d0, 'drawn toward the mouth');
});

test('Kraken: the body is shut until four arms are cut; an arm holds a ship until it is cut away with axes', () => {
  const { game, f, body, caps } = arena('kraken', 2);
  const [A, B] = caps;
  steps(game, SEC + 1);
  const hp = body.hull;
  applyDamage(game, body, { hull: 300 }, A.ship);
  assert.equal(body.hull, hp, 'the arms guard the body');
  // Sail in among the arms: sooner or later one takes her.
  at(game, A.ship, body.state.x + 110, body.state.y);
  for (let i = 0; i < 40 && !f.grabs.has(A.ship.id); i++) {
    at(game, A.ship, body.state.x + 110, body.state.y);
    steps(game, SEC);
  }
  assert.ok(f.grabs.has(A.ship.id), 'grabbed');
  assert.ok(A.ship.flagsFor(null, false, game.now) & SF.GRABBED);
  const held = { x: A.ship.state.x, y: A.ship.state.y };
  A.ship.input = { rudder: 1, sailTarget: 1 };
  steps(game, SEC * 2);
  assert.ok(dist(A.ship.state.x, A.ship.state.y, held.x, held.y) < 1, 'held fast');
  const arm = game.ships.get(f.grabs.get(A.ship.id)!.arm)!;
  // "Axes!" (the board order while held).
  const armHp = arm.hull;
  A.c.push({ t: 'board', target: arm.id, aggression: 'standard' });
  assert.ok(arm.hull < armHp, 'the axes bite');
  // Cut it off: she is free.
  arm.hull = 0;
  game.beginSinking(arm);
  assert.ok(!f.grabs.has(A.ship.id));
  // Four arms gone: the body opens.
  const arms = [...f.parts].filter(([id, p]) => p === 'arm' && game.ships.get(id)!.alive).map(([id]) => game.ships.get(id)!);
  for (const a of arms.slice(0, 3)) {
    applyDamage(game, a, { hull: a.hull + 10 }, B.ship);
  }
  steps(game, SEC + 1);
  assert.equal(f.phase, 1);
  body.effects = body.effects.filter((e) => e.id !== 'kraken_guard');
  const hp2 = body.hull;
  applyDamage(game, body, { hull: 300 }, B.ship);
  assert.ok(body.hull < hp2, 'the body is open');
  assert.ok((f.contrib.get(A.s.accountId)?.control ?? 0) >= 10, 'cutting arms counts');
});

test('The Drowned Whale: the Song is quieted by a Choir Bell; at the last only boarders reach its heart; the spoils are personal', () => {
  const { game, f, body, caps } = arena('drowned_whale', 3);
  const [A, B, C] = caps;
  body.hull = body.stats.hullMax * 0.5;
  // A bell on Bram's ship covers Bram and Anne (within 400 m); Cora is out of its reach.
  B.ship.loadout.modules.choir_bell = 1;
  B.ship.recompute(game.now);
  assert.ok(B.ship.hasFlag('choir_bell'));
  at(game, A.ship, body.state.x + 300, body.state.y);
  at(game, B.ship, body.state.x + 450, body.state.y);
  at(game, C.ship, body.state.x - 900, body.state.y);
  for (const x of caps) x.ship.morale = 80;
  f.ready.song = 0;
  steps(game, SEC + 1);
  assert.equal(f.phase, 1);
  assert.ok(A.ship.morale > 79, 'the bell tolls over the song');
  assert.ok(C.ship.morale <= 77, 'Cora hears it');
  assert.ok((f.contrib.get(B.s.accountId)?.support ?? 0) > 0, 'ringing counts as support');
  applyDamage(game, body, { hull: 1000 }, C.ship);
  // The last hour: a heart to board; cannon cannot kill it.
  body.hull = body.stats.hullMax * 0.29;
  steps(game, SEC + 1);
  assert.equal(f.phase, 2);
  const heart = [...f.parts].find(([, p]) => p === 'heart');
  assert.ok(heart);
  const h = game.ships.get(heart[0])!;
  applyDamage(game, body, { hull: body.stats.hullMax }, A.ship);
  assert.ok(body.hull > 0, 'cannon cannot finish it');
  const hh = h.hull;
  applyDamage(game, h, { hull: 500 }, A.ship);
  assert.equal(h.hull, hh, 'nor reach the heart');
  // Boarders cut it out.
  assert.equal(bossBoarded(game, A.ship, h), true);
  assert.equal(game.bosses.fights.size, 0, 'slain');
  for (const x of caps) {
    const p = x.s.profile!;
    assert.ok(p.trophies.includes('Bell of the Whale'), `${x.s.name} took a trophy`);
    assert.equal(p.bossKills.drowned_whale, 1);
    const mine = [...game.loot.values()].filter((l) => l.ownerOnly === x.s.accountId);
    assert.equal(mine.length, 1, 'one private share each');
    assert.ok((mine[0].cargo.drowned_silk ?? 0) >= 3);
  }
  // The heaviest hand gets more.
  const share = (x: (typeof caps)[number]) => [...game.loot.values()].find((l) => l.ownerOnly === x.s.accountId)!.cargo.drowned_silk ?? 0;
  assert.ok(share(A) >= share(C));
  assert.ok(game.db.getKv<Record<string, unknown>>('boss_firsts')?.drowned_whale, 'the first kill is written down');
});

test('The Lantern Maw: lit ships are swallowed, dark ones slip by; inside, guns hit thrice; too weak, and she is digested', () => {
  const { game, f, body, caps } = arena('lantern_maw', 2);
  const [A, B] = caps;
  f.lures = [];
  const h = headingVec(body.state.heading);
  const mouth = { x: body.state.x + h.x * body.stats.length * 0.35, y: body.state.y + h.y * body.stats.length * 0.35 };
  // A dark ship at the jaws is passed over.
  B.ship.addEffect({ id: 'lights_out', until: game.now + 999, flags: ['dark_running'] }, game.now);
  at(game, B.ship, mouth.x, mouth.y);
  at(game, A.ship, body.state.x + 2000, body.state.y);
  steps(game, 3);
  assert.equal(f.swallowed.has(B.ship.id), false);
  // A lit one is taken.
  at(game, B.ship, body.state.x + 2400, body.state.y + 2400);
  const h2 = headingVec(body.state.heading);
  at(game, A.ship, body.state.x + h2.x * body.stats.length * 0.35, body.state.y + h2.y * body.stats.length * 0.35);
  steps(game, 2);
  assert.ok(f.swallowed.has(A.ship.id), 'swallowed');
  assert.ok(A.ship.flagsFor(null, false, game.now) & SF.SWALLOWED);
  // Outside guns cannot reach her; inside, a broadside hits the gut ×3.
  const hull = A.ship.hull;
  applyDamage(game, A.ship, { hull: 100 }, B.ship);
  assert.equal(A.ship.hull, hull);
  A.ship.ammo.round = 100;
  A.ship.reload.port = 0;
  const hp = body.hull;
  assert.equal(fireBroadside(game, A.ship, 'port', 200), null);
  assert.ok(hp - body.hull > 0);
  const volley = hp - body.hull;
  assert.equal(game.projectiles.filter((p) => p.owner === A.ship.id).length, 0, 'no balls fly: they are inside');
  assert.ok(volley >= A.ship.stats.gunsPerSide * 20, 'three times the weight');
  // Enough damage from inside: spat out.
  f.swallowed.get(A.ship.id)!.dealt = body.stats.hullMax * 0.05;
  A.ship.reload.port = 0;
  fireBroadside(game, A.ship, 'port', 200);
  assert.equal(f.swallowed.has(A.ship.id), false, 'spat out');
  assert.equal(A.ship.hasEffect('swallowed'), false);
  // Swallowed again and does nothing: digested after a minute.
  at(game, A.ship, body.state.x + 3000, body.state.y);
  B.ship.effects = [];
  B.ship.recompute(game.now);
  B.ship.hull = B.ship.stats.hullMax * 10; // she will not die of the acid first
  f.ready.swallow = 0;
  const h3 = headingVec(body.state.heading);
  at(game, B.ship, body.state.x + h3.x * body.stats.length * 0.35, body.state.y + h3.y * body.stats.length * 0.35);
  steps(game, 2);
  assert.ok(f.swallowed.has(B.ship.id));
  steps(game, SEC * 62);
  assert.equal(f.swallowed.has(B.ship.id), false);
  assert.ok(!B.ship.alive || B.ship.sinkingUntil > 0 || B.ship.docked, 'digested');
});

test('The Black Serpent: its coil is a wall, bile rots canvas, and in the chase big guns glance off', () => {
  const { game, f, body, caps } = arena('black_serpent', 2);
  const [A, B] = caps;
  at(game, A.ship, body.state.x + 300, body.state.y);
  at(game, B.ship, body.state.x + 360, body.state.y);
  f.ready.coil = 0;
  steps(game, SEC + 1);
  assert.ok(f.ring, 'coiled');
  const r = f.ring!;
  // Try to sail out through the coil: thrown back inside.
  at(game, A.ship, r.x + r.r - 5, r.y);
  steps(game, 2);
  assert.ok(dist(A.ship.state.x, A.ship.state.y, r.x, r.y) < r.r - 20, 'the wall holds');
  // Bile.
  const sails = B.ship.sails;
  f.ready.bile = 0;
  at(game, B.ship, body.state.x + 200, body.state.y);
  steps(game, SEC);
  assert.ok(B.ship.sails < sails || A.ship.sails < A.ship.stats.sailHpMax, 'canvas rots');
  // The chase: a deep hull does a third of the damage.
  body.hull = body.stats.hullMax * 0.39;
  steps(game, SEC + 1);
  assert.equal(f.phase, 1);
  refit(A.ship, 'galleon', game.now);
  refit(B.ship, 'cutter', game.now);
  let hp = body.hull;
  applyDamage(game, body, { hull: 100 }, A.ship);
  assert.ok(Math.abs(hp - body.hull - 35) < 1e-6);
  hp = body.hull;
  applyDamage(game, body, { hull: 100 }, B.ship);
  assert.ok(Math.abs(hp - body.hull - 100) < 1e-6);
  // Nobody keeps up for a minute: it escapes, and nobody is paid.
  at(game, A.ship, body.state.x + 5000, body.state.y + 5000);
  at(game, B.ship, body.state.x + 5000, body.state.y + 5100);
  steps(game, SEC * 62);
  assert.equal(game.bosses.fights.size, 0, 'escaped');
  assert.equal([...game.loot.values()].filter((l) => l.ownerOnly !== undefined).length, 0);
});

test('The Hollow Admiral: sunk ghosts rise while their lanterns burn; boarders put the lanterns out', () => {
  const { game, f, caps } = arena('hollow_admiral', 2);
  const [A] = caps;
  const ghosts = [...f.lanterns.keys()];
  assert.equal(ghosts.length, 4);
  const g = game.ships.get(ghosts[1])!;
  applyDamage(game, g, { hull: g.hull + 10 }, A.ship);
  assert.ok(g.alive, 'it does not sink');
  assert.ok(g.hasEffect('submerged'), 'it goes under to rise');
  assert.ok(Math.abs(g.hull - g.stats.hullMax * 0.4) < 1);
  // The weather gauge: the wind blows from their line onto the hunters.
  const w = game.windFor(A.ship);
  const flag = game.ships.get(f.id)!;
  const fromLine = Math.atan2(A.ship.state.x - flag.state.x, -(A.ship.state.y - flag.state.y));
  assert.ok(Math.abs(Math.sin(w.dir - fromLine)) < 1e-6 && Math.cos(w.dir - fromLine) > 0);
  // Board each ghost: the lanterns go out, and they sink for good.
  for (const id of ghosts) {
    const s = game.ships.get(id)!;
    assert.equal(bossBoarded(game, A.ship, s), true);
    assert.equal(f.lanterns.get(id), false);
  }
  steps(game, SEC * 8);
  assert.equal(game.bosses.fights.size, 0, 'the line is gone');
  assert.ok(A.s.profile!.trophies.includes("Drey's Lantern"));
});

test('Mother of Wrecks: deep keels are thrown out of the maze; its cores are hit only from inside; the shell regrows while they beat', () => {
  const { game, f, body, caps } = arena('mother_of_wrecks', 2);
  const [A, B] = caps;
  refit(A.ship, 'galleon', game.now);
  refit(B.ship, 'cutter', game.now);
  at(game, A.ship, body.state.x + 50, body.state.y);
  at(game, B.ship, body.state.x + 60, body.state.y + 20);
  steps(game, 2);
  assert.ok(dist(A.ship.state.x, A.ship.state.y, body.state.x, body.state.y) >= 99, 'the galleon is thrown out');
  assert.ok(dist(B.ship.state.x, B.ship.state.y, body.state.x, body.state.y) < 90, 'the cutter threads the maze');
  const cores = [...f.parts].filter(([, p]) => p === 'core').map(([id]) => game.ships.get(id)!);
  const c0 = cores[0];
  at(game, A.ship, body.state.x + 600, body.state.y);
  let hp = c0.hull;
  applyDamage(game, c0, { hull: 100 }, A.ship);
  assert.equal(c0.hull, hp, 'from outside the reef swallows the shot');
  at(game, B.ship, c0.state.x + 30, c0.state.y);
  applyDamage(game, c0, { hull: 100 }, B.ship);
  assert.ok(Math.abs(hp - c0.hull - 35) < 1e-6, 'the shell still stands: cores are armoured');
  // The shell grows back and cannot break while a core beats.
  body.hull = body.stats.hullMax * 0.3;
  steps(game, SEC + 1);
  assert.ok(body.hull > body.stats.hullMax * 0.3);
  applyDamage(game, body, { hull: body.stats.hullMax }, A.ship);
  assert.ok(body.hull >= 1 && body.alive);
  hp = c0.hull;
  applyDamage(game, c0, { hull: 100 }, B.ship);
  assert.ok(Math.abs(hp - c0.hull - 100) < 1e-6, 'with the shell down the cores are bare');
  for (const c of cores) applyDamage(game, c, { hull: c.hull + 1 }, B.ship);
  steps(game, SEC + 1);
  assert.equal(game.bosses.fights.size, 0, 'the reef dies with its cores');
});

test('The Storm Widow: only hits from inside the eye land; the wind is hers; lightning finds the tallest mast', () => {
  const { game, f, body, caps } = arena('storm_widow', 2);
  const [A, B] = caps;
  steps(game, 2);
  at(game, A.ship, f.eye.x + f.eye.r + 200, f.eye.y);
  at(game, B.ship, f.eye.x, f.eye.y);
  const hp = body.hull;
  applyDamage(game, body, { hull: 100 }, A.ship);
  assert.equal(body.hull, hp, 'outside the eye the gale takes the shot');
  applyDamage(game, body, { hull: 100 }, B.ship);
  assert.ok(body.hull < hp);
  assert.ok(Math.abs(game.windFor(A.ship).dir - f.wind.dir) < 1e-9);
  assert.ok(game.windFor(B.ship).strength < 0.5, 'calm in the eye');
  // Lightning: the galleon outside, not the cutter.
  refit(A.ship, 'galleon', game.now);
  at(game, B.ship, f.eye.x + f.eye.r + 260, f.eye.y);
  refit(B.ship, 'cutter', game.now);
  const ha = A.ship.hull, hb = B.ship.hull;
  f.ready.lightning = 0;
  f.ready.waves = game.now + 999;
  steps(game, SEC + 1);
  assert.ok(A.ship.hull < ha);
  assert.equal(B.ship.hull, hb);
  // A lightning rod grounds most of it.
  A.ship.loadout.modules.lightning_rod = 1;
  A.ship.recompute(game.now);
  A.ship.hull = A.ship.stats.hullMax;
  f.ready.lightning = 0;
  steps(game, SEC + 1);
  const lost = A.ship.stats.hullMax - A.ship.hull;
  assert.ok(lost > 0 && lost < A.ship.stats.hullMax * 0.06 * 0.5);
});

test('rare drops: once a week per captain; a second kill in the week brings no rare', () => {
  const orig = BOSSES.kraken.rare.map((r) => r.chance);
  try {
    for (const r of BOSSES.kraken.rare) r.chance = 10;
    for (let round = 0; round < 2; round++) {
      const { game, f, body, caps } = arena('kraken', 1);
      const [A] = caps;
      if (round === 1) A.s.profile!.bossLocks.kraken = game.wallNow() + 3600_000;
      applyDamage(game, game.ships.get([...f.parts].find(([, p]) => p === 'arm')![0])!, { hull: 50 }, A.ship);
      body.hull = 0;
      game.beginSinking(body);
      assert.equal(game.bosses.fights.size, 0);
      const p = A.s.profile!;
      if (round === 0) {
        assert.ok(p.blueprints.includes('kraken_beak'), 'the plans');
        assert.ok(p.bossLocks.kraken > game.wallNow(), 'locked for a week');
      } else assert.ok(!p.blueprints.includes('kraken_beak'), 'locked out');
      assert.ok(scoreOf(f, f.contrib.get(A.s.accountId)!) > 0);
    }
  } finally {
    BOSSES.kraken.rare.forEach((r, i) => (r.chance = orig[i]));
  }
});

test('boss fittings: plans carry their own modifiers; the Choir Bell and the Lightning Rod set their switches', () => {
  const base = computeShipStats({ classId: 'brig', name: 'x', guns: { port: 'long_9', starboard: 'long_9' }, modules: {} }, 'corsair', {}, []);
  const bone = computeShipStats({ classId: 'brig', name: 'x', guns: { port: 'long_9', starboard: 'long_9' }, modules: { bone_culverin: 1, choir_bell: 1, lightning_rod: 1 } }, 'corsair', {}, []);
  assert.ok(bone.gunDamageMul > base.gunDamageMul);
  assert.ok(bone.flags.has('choir_bell') && bone.flags.has('lightning_rod'));
});

test('bosses are hostile to every captain, cost no law, and are not boarded', () => {
  const { game, body, caps } = arena('leviathan', 1);
  const [A] = caps;
  assert.ok(game.isHostile(body, A.ship));
  applyDamage(game, body, { hull: 50 }, A.ship);
  assert.equal(A.s.profile!.infamy, 0);
  A.c.push({ t: 'board', target: body.id, aggression: 'standard' });
  assert.match(A.c.last('toast')?.msg ?? '', /no decks|creature/i);
  // The panel.
  steps(game, SEC + 1);
  const v = A.c.last('boss');
  assert.ok(v && v.list.length === 1 && v.list[0].name === 'Leviathan');
});
