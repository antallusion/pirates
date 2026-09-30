// docs/16 Batch H — ease and polish, the server's part: auto-sail to a mark on the chart. The helmsman steers round
// islands and reefs, beats to windward on sensible tacks, and gives the wheel back on danger (a hostile sail in
// range, a shot at her, a storm, foul water he cannot round, a low hull) or the moment the captain touches the helm.
// Also the client's pure parts of the batch: first-time hints, gear comparison, the density scale, the settings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOSAIL_ARRIVE, AUTOSAIL_DANGER_R, AUTOSAIL_LOW_HULL, autosailSail } from '../shared/src/data/autosail.ts';
import { SAIL_STEPS } from '../shared/src/constants.ts';
import { angleDiff, headingOf } from '../shared/src/math.ts';
import { relWindDeg } from '../shared/src/sim/sailing.ts';
import { depthAt, isLand } from '../shared/src/world/worldgen.ts';
import { serverTable } from '../client/src/lang/server.ts';
import type { Game } from '../server/src/game/Game.ts';
import { STOP_WORDS, autosailOf, foulWater } from '../server/src/game/autosail.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

/** Island 120 of the seeded world: a round island in the Gravewater with deep water all about it. */
const ISLE = 120;

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 20;
  return { c, s, ship: s.ship! };
}

function atSea(game: Game, s: PlayerSession, x: number, y: number, heading = 0): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.heading = heading;
  ship.state.speed = 0;
  ship.region = 'gravewater';
  ship.lastCombat = -1e9;
  game.grid.upsert(ship.id, x, y);
}

/** Fair weather in these waters for the whole test. */
function fair(game: Game): void {
  game.fronts = [];
  for (const w of Object.values(game.weather)) {
    w.kind = 'breeze';
    w.until = game.now + 1e6;
  }
}

/** A pirate awake at a spot (as the sea wakes those within a captain's sight, npc.ts promote). */
function pirate(game: Game, x: number, y: number): ShipEntity {
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', x, y, 0);
  game.npcs.get(foe.id)!.active = true;
  game.grid.upsert(foe.id, x, y);
  return foe;
}

/** Runs the sea until the helmsman gives the wheel back (or the time runs out); every tick the keel is checked. */
function sail(game: Game, ship: ShipEntity, secs: number, onTick?: () => void): { t: number; aground: number } {
  let aground = 0;
  const t0 = game.now;
  for (let i = 0; i < secs * 20 && autosailOf(ship); i++) {
    // An empty sea: the sea's own pirates are the danger test's business, not the route's.
    for (const id of [...game.npcs.keys()]) {
      const o = game.ships.get(id);
      if (o && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 3000) game.removeShip(id);
    }
    if (i % 20 === 0) fair(game);
    game.step();
    if (depthAt(game.world, ship.state.x, ship.state.y) < ship.cls.draft) aground++;
    onTick?.();
  }
  return { t: game.now - t0, aground };
}

const lastAuto = (c: FakeConn) => c.last('autosail');

test('the sail he carries: hers when she has way on, three quarters when she was nearly stopped', () => {
  assert.equal(autosailSail(4), 4);
  assert.equal(autosailSail(2), 2);
  assert.equal(autosailSail(0), 3);
  assert.equal(autosailSail(1), 3);
  assert.equal(autosailSail(NaN), 3);
  assert.equal(autosailSail(9), 4);
});

for (const hull of ['sloop', 'brig', 'frigate']) test(`the helmsman takes her (a ${hull}) round an island to the mark on the far side, never touching bottom`, () => {
  const { game } = makeGame();
  fair(game);
  const is = game.world.islands[ISLE];
  const { c, s, ship } = captain(game, 'Ada Helm');
  onHull(game, ship, hull);
  const x0 = is.x - is.radius - 900, x1 = is.x + is.radius + 900;
  atSea(game, s, x0, is.y, headingOf(1, 0));
  // The straight line runs over the island.
  assert.ok(isLand(game.world, is.x, is.y));
  c.push({ t: 'autosail', x: x1, y: is.y, sail: 4 });
  const on = lastAuto(c)!;
  assert.equal(on.on, true, JSON.stringify(c.all('toast')));
  assert.equal(on.sail, 4);
  const run = autosailOf(ship)!;
  assert.ok(run.path.length >= 3, 'a route with a turn in it, round the island');
  const r = sail(game, ship, 900);
  assert.equal(r.aground, 0, 'never in water shallower than her keel');
  const off = lastAuto(c)!;
  assert.equal(off.on, false);
  assert.equal(off.why, 'arrived', `${off.why} after ${Math.round(r.t)} s at ${Math.round(ship.state.x)},${Math.round(ship.state.y)}`);
  assert.ok(Math.hypot(ship.state.x - x1, ship.state.y - is.y) <= AUTOSAIL_ARRIVE + 20);
  assert.equal(ship.input.rudder, 0, 'the wheel is left amidships');
});

test('dead to windward he beats on sensible tacks and still makes the mark', () => {
  const { game } = makeGame();
  fair(game);
  const is = game.world.islands[ISLE];
  const { c, s, ship } = captain(game, 'Bea Beat');
  const x0 = is.x - is.radius - 3200, y0 = is.y;
  atSea(game, s, x0, y0);
  const wind = game.windFor(ship);
  const from = wind.dir + Math.PI; // where it blows from
  const tx = x0 + Math.sin(from) * 1400, ty = y0 - Math.cos(from) * 1400;
  assert.ok(!foulWater(game, ship, tx, ty), 'the mark is in open water');
  ship.state.heading = headingOf(tx - x0, ty - y0) + 1.2;
  c.push({ t: 'autosail', x: tx, y: ty, sail: 4 });
  assert.equal(lastAuto(c)!.on, true);
  let inIrons = 0, ticks = 0;
  const sides = new Set<number>();
  const r = sail(game, ship, 1500, () => {
    ticks++;
    const w = game.windFor(ship);
    if (relWindDeg(ship.state.heading, w) < ship.stats.noGoDeg * 0.5 && ship.state.speed < 0.5) inIrons++;
    const off = angleDiff(w.dir + Math.PI, ship.state.heading);
    if (Math.abs(off) < 1.3) sides.add(Math.sign(off));
  });
  assert.equal(lastAuto(c)!.why, 'arrived', `${lastAuto(c)!.why} after ${Math.round(r.t)} s`);
  assert.equal(r.aground, 0);
  assert.ok(sides.size === 2, 'she went about at least once');
  assert.ok(inIrons < ticks * 0.1, `not stuck head to wind (${inIrons}/${ticks})`);
});

test('a steady idle helm is swallowed; a turn of the wheel or a change of sail takes the wheel back', () => {
  const { game } = makeGame();
  fair(game);
  const is = game.world.islands[ISLE];
  const { c, s, ship } = captain(game, 'Cora Wheel');
  atSea(game, s, is.x - is.radius - 1500, is.y);
  c.push({ t: 'autosail', x: is.x - is.radius - 1500, y: is.y + 3000, sail: 3 });
  assert.equal(lastAuto(c)!.on, true);
  steps(game, 20);
  const rud = ship.input.rudder;
  c.push({ t: 'input', seq: 1, rudder: 0, sail: 3 });
  assert.ok(autosailOf(ship), 'the idle beat of the client leaves the helmsman be');
  assert.equal(ship.input.rudder, rud);
  assert.equal(ship.input.sailTarget, SAIL_STEPS[3]);
  c.push({ t: 'input', seq: 2, rudder: -1, sail: 3 });
  assert.equal(autosailOf(ship), null);
  assert.equal(lastAuto(c)!.why, 'manual');
  assert.equal(ship.input.rudder, -1, 'her own helm goes through at once');
  // The sheets too.
  c.push({ t: 'autosail', x: is.x - is.radius - 1500, y: is.y + 3000, sail: 3 });
  c.push({ t: 'input', seq: 3, rudder: 0, sail: 1 });
  assert.equal(autosailOf(ship), null);
  assert.equal(lastAuto(c)!.why, 'manual');
  // And the pill's stop.
  c.push({ t: 'autosail', x: is.x - is.radius - 1500, y: is.y + 3000, sail: 3 });
  c.push({ t: 'autosail', stop: true });
  assert.equal(autosailOf(ship), null);
  assert.equal(lastAuto(c)!.why, 'manual');
});

test('danger hands the wheel back: a hostile sail in range, a shot, a storm, a low hull', () => {
  const { game } = makeGame();
  fair(game);
  const is = game.world.islands[ISLE];
  const { c, s, ship } = captain(game, 'Dora Watch');
  const x = is.x - is.radius - 1500, y = is.y;
  const go = () => {
    c.push({ t: 'autosail', x, y: y + 4000, sail: 3 });
    assert.equal(lastAuto(c)!.on, true, c.all('toast').map((t) => t.msg).join(' | '));
  };
  atSea(game, s, x, y);
  // A pirate comes within range.
  go();
  const far = pirate(game, ship.state.x + AUTOSAIL_DANGER_R + 400, ship.state.y);
  steps(game, 2);
  assert.ok(autosailOf(ship), 'out of range he sails on');
  game.removeShip(far.id);
  const foe = pirate(game, ship.state.x + AUTOSAIL_DANGER_R - 200, ship.state.y);
  steps(game, 2);
  assert.equal(lastAuto(c)!.why, 'hostile');
  // He will not take it back while the pirate is there.
  c.push({ t: 'autosail', x, y: y + 4000, sail: 3 });
  assert.equal(lastAuto(c)!.on, false);
  assert.ok(c.all('toast').some((t) => t.msg === STOP_WORDS.hostile));
  game.removeShip(foe.id);
  // A shot at her.
  atSea(game, s, x, y);
  go();
  steps(game, 3);
  ship.attackers.set(999_999, game.now);
  steps(game, 1);
  assert.equal(lastAuto(c)!.why, 'attack');
  ship.attackers.clear();
  // A storm comes over.
  atSea(game, s, x, y);
  game.now += 10;
  go();
  game.weather[ship.region].kind = 'storm';
  steps(game, 1);
  assert.equal(lastAuto(c)!.why, 'storm');
  fair(game);
  // The hull is low.
  go();
  ship.hull = ship.stats.hullMax * (AUTOSAIL_LOW_HULL - 0.05);
  steps(game, 1);
  assert.equal(lastAuto(c)!.why, 'hull');
  c.push({ t: 'autosail', x, y: y + 4000, sail: 3 });
  assert.ok(c.all('toast').some((t) => t.msg === STOP_WORDS.hull), 'nor starts on a weak hull');
  ship.hull = ship.stats.hullMax;
  // Docked: he sails from open water only.
  ship.docked = 'x';
  c.push({ t: 'autosail', x, y: y + 4000, sail: 3 });
  assert.ok(c.all('toast').some((t) => t.msg === STOP_WORDS.port));
});

test('foul water he cannot round hands the wheel back; a mark ashore ends on the water nearest it', () => {
  const { game } = makeGame();
  fair(game);
  const { c, s, ship } = captain(game, 'Eve Lead');
  onHull(game, ship, 'brig'); // a keel that feels the bottom (the sloop skates over the shallows)
  assert.notEqual(ship.cls.passive.id, 'shallow_runner');
  // In the middle of a wide reef every heading runs over it.
  const rf = game.world.reefs.filter((r) => r.depth < ship.cls.draft && r.radius > 270).sort((a, b) => b.radius - a.radius)[0];
  assert.ok(rf, 'a wide shallow reef');
  atSea(game, s, rf.x, rf.y);
  ship.region = 'black_coast';
  c.push({ t: 'autosail', x: rf.x + 5000, y: rf.y, sail: 3 });
  assert.notEqual(lastAuto(c)?.on, true);
  assert.ok(c.all('toast').some((t) => t.msg === STOP_WORDS.reef), 'he will not take her off a reef');
  // Under way, she is driven onto one: the wheel comes back.
  atSea(game, s, rf.x - rf.radius - 600, rf.y);
  c.push({ t: 'autosail', x: rf.x + 5000, y: rf.y, sail: 3 });
  assert.equal(lastAuto(c)!.on, true, c.all('toast').map((t) => t.msg).join(' | '));
  ship.state.x = rf.x;
  ship.state.y = rf.y;
  steps(game, 1);
  assert.equal(lastAuto(c)!.why, 'reef');
  // A mark on the island itself: the route ends on open water by it.
  const is = game.world.islands[ISLE];
  atSea(game, s, is.x - is.radius - 1500, is.y);
  c.push({ t: 'autosail', x: is.x, y: is.y, sail: 3 });
  assert.equal(lastAuto(c)!.on, true, c.all('toast').map((t) => t.msg).join(' | '));
  const end = autosailOf(ship)!.path.at(-1)!;
  assert.ok(!foulWater(game, ship, end[0], end[1]), 'the route ends afloat');
  assert.ok(Math.hypot(end[0] - is.x, end[1] - is.y) < is.radius + 900, 'and near the mark');
  // Marks too near or off the chart.
  c.push({ t: 'autosail', x: ship.state.x + 50, y: ship.state.y, sail: 3 });
  assert.ok(c.all('toast').some((t) => t.msg === 'You are at your mark already'));
  c.push({ t: 'autosail', x: -5, y: 1e9, sail: 3 });
  assert.ok(c.all('toast').some((t) => t.msg === 'That mark is off the chart'));
});

test('the helmsman’s words are in Russian too', () => {
  const table = serverTable();
  for (const w of [...Object.values(STOP_WORDS), 'That mark is off the chart', 'That mark is too far for one run: set a nearer one', 'No open water leads to that mark', 'You are at your mark already']) {
    assert.ok(table[w], `RU for "${w}"`);
    assert.ok(!/[A-Za-z]/.test(table[w]), `no Latin in "${table[w]}"`);
  }
});
