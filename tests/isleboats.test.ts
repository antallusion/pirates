// «Шлюпы с острова» (owner, 2026-11-02; server/src/game/isleboats.ts, shared/src/data/islandboats.ts): her island's men
// hired from afar, brought by the island's boats. The town hall's level drives their way, their load and the wait; the
// room aboard is asked for all the men together; the price is paid once, at the sending; the men come aboard alongside
// her; the trip is kept in her save and carried on by the time gone after a restart; and the boats never cross land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../shared/src/data/army.ts';
import { SPEED_SCALE } from '../shared/src/constants.ts';
import { BOAT_COOLDOWN_MIN, BOAT_MUL, BOAT_STACKS, boatCooldown, boatFee, boatMen, boatSpeed, boatStacks, boatsAt } from '../shared/src/data/islandboats.ts';
import { recruitPrice } from '../shared/src/data/town.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { thisWeek } from '../server/src/game/calendar.ts';
import { townState } from '../server/src/game/town.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { boatsDwellView, boatsHooks, boatsInfo, boatsReady, boatsView, boatsWhy, forgetBoats, launchPoint, sendBoats, shipTop, stepIsleBoats } from '../server/src/game/isleboats.ts';
import { recruit, roomFor } from '../server/src/game/dwell.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { extract } from '../tools/i18n-server.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

/** A captain with her island (town hall at `hall`, three dwellings full), lying off it. */
function islander(game: Game, hall = 1, name = 'Boat Caller'): { s: PlayerSession; home: Island } {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const used = new Set(game.world.islands.filter((i) => game.holdings.get(game, i.id)).map((i) => i.id));
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !used.has(i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(offCoast(game, ship, home), 'water off its coast');
  ship.state.speed = 0;
  ship.region = home.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  const t = townState(y);
  t.b = { hall, keep: 1, dw1: 1, dw2: 1, dw3: 1, dw4: 1 };
  t.w = thisWeek(game);
  t.pool = [0, 200, 100, 60, 30, 0, 0, 0];
  y.res.gunpowder = 500;
  y.res.iron = 500;
  return { s, home };
}

/** Open water `d` metres from the island, on a bearing (the first clear one round). */
function waterAway(game: Game, home: Island, d: number, from = 0): [number, number] {
  for (let k = 0; k < 64; k++) {
    const a = from + (k * Math.PI) / 32;
    const x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
    let clear = true;
    for (let r = -120; r <= 120 && clear; r += 30) for (let q = -120; q <= 120 && clear; q += 30) if (isLand(game.world, x + r, y + q)) clear = false;
    if (clear && x > 3000 && y > 3000 && x < 93000 && y < 93000) return [x, y];
  }
  throw new Error('no open water');
}

function sailTo(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.docked = null;
  s.profile!.docked = null;
  game.grid.upsert(ship.id, x, y);
}

/** The boats stepped on in ticks of `dt` until they come alongside (or `max` ticks). */
function run(game: Game, s: PlayerSession, max = 20_000, dt = 0.05): number {
  for (let i = 0; i < max; i++) {
    if (!s.profile!.isleBoats) return i;
    clock += dt * 1000;
    stepIsleBoats(game, dt);
  }
  return max;
}

const menOf = (s: PlayerSession, u: string) => s.ship!.army.filter((x) => x.u === u).reduce((a, x) => a + x.n, 0);

test('the numbers: the town hall\'s level drives the boats\' way, their load and the wait', () => {
  assert.deepEqual([...BOAT_MUL], [10, 11, 12, 13, 14], '×10 at the first level, ×14 at the fifth');
  for (let L = 1; L < 5; L++) {
    assert.ok(boatSpeed(L + 1, 30) > boatSpeed(L, 30), `faster at ${L + 1}`);
    assert.ok(boatStacks(L + 1) >= boatStacks(L) && boatMen(L + 1, 100) > boatMen(L, 100), `more aboard at ${L + 1}`);
    assert.ok(boatCooldown(L + 1) < boatCooldown(L), `a shorter wait at ${L + 1}`);
  }
  assert.equal(boatSpeed(1, 30), 300);
  assert.equal(boatStacks(1), 1);
  assert.equal(boatStacks(5), 3);
  assert.equal(boatCooldown(1), 600, '10 minutes at the first level');
  assert.equal(boatCooldown(5), 180, '3 minutes at the fifth');
  assert.equal(BOAT_STACKS.length, BOAT_COOLDOWN_MIN.length);
  assert.ok(boatFee(5, 10, 1000) < boatFee(1, 10, 1000), 'a greater hall delivers cheaper');
  assert.ok(boatFee(1, 30, 1000) > boatFee(1, 2, 1000), 'a longer run costs more');

  const game = world();
  const { s, home } = islander(game, 1);
  const [x, y] = waterAway(game, home, 8000);
  sailTo(game, s, x, y);
  const one = boatsInfo(game, s)!;
  assert.equal(one.mul, 10);
  assert.equal(one.v, Math.round(10 * s.ship!.stats.maxSpeed * SPEED_SCALE), '×10 her hull\'s top speed');
  assert.equal(one.stacks, 1);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.hall = 5;
  const five = boatsInfo(game, s)!;
  assert.equal(five.mul, 14);
  assert.equal(five.stacks, 3);
  assert.ok(five.men > one.men && five.cooldown < one.cooldown);
  assert.ok(five.eta < one.eta, 'they reach her sooner');
});

test('who may send them: an island with its hall, at sea, away from it; the load and the room for all the men together', () => {
  const game = world();
  const { s, home } = islander(game, 1);
  // lying off the island: hired there
  assert.match(boatsWhy(game, s) ?? '', /lie off your island/);
  const [x, y] = waterAway(game, home, 6000);
  sailTo(game, s, x, y);
  assert.equal(boatsWhy(game, s), null);
  // no hall
  const t = townState(yardOf(game, ownIsland(game, s.accountId)!));
  t.b.hall = 0;
  assert.match(boatsWhy(game, s) ?? '', /town hall/);
  t.b.hall = 1;
  // in port: the tavern
  s.ship!.docked = game.world.ports[0].id;
  assert.match(boatsWhy(game, s) ?? '', /In port/);
  s.ship!.docked = null;
  // the hall's load: one kind, its men
  s.ship!.setArmy([{ u: 'deckhand', n: 5 }]);
  const cap = boatMen(1, s.ship!.stats.crewMax);
  assert.match(sendBoats(game, s, [{ u: 'marine', n: 2 }, { u: 'musketeer', n: 2 }]) ?? '', /1 kinds/);
  assert.match(sendBoats(game, s, [{ u: 'marine', n: cap + 1 }]) ?? '', new RegExp(`${cap} men`));
  assert.match(sendBoats(game, s, []) ?? '', /Pick the men/);
  assert.match(sendBoats(game, s, [{ u: 'drowned', n: 1 }]) ?? '', /No dwelling/);
  // room aboard: the hammocks full of men who cannot go ashore (no hands to row back)
  t.b.hall = 5;
  s.ship!.setArmy([{ u: 'marine', n: s.ship!.stats.crewMax }]);
  assert.equal(roomFor(s, 'musketeer') <= 0 || roomFor(s, 'musketeer') < 3, true);
  assert.match(sendBoats(game, s, [{ u: 'musketeer', n: 20 }]) ?? '', /No room aboard/);
  // the men of two kinds counted together: each fits alone, not both
  s.ship!.setArmy([{ u: 'marine', n: 10 }]);
  t.pool[3] = 5000;
  const one = roomFor(s, 'musketeer');
  assert.ok(one > 0 && roomFor(s, 'gunner') > 0, `room alone ${one}`);
  assert.match(sendBoats(game, s, [{ u: 'musketeer', n: one }, { u: 'gunner', n: 1 }]) ?? '', /No room aboard/);
  t.pool[3] = 60;
  // the window in its boats' mode: the dwellings only, nothing trained, its terms
  const v = boatsDwellView(game, s)!;
  assert.equal(v.src, 'boat');
  assert.ok(v.rows.length >= 3 && v.rows.every((r) => /^dw\d$/.test(r.name)));
  assert.equal(v.ups.length, 0);
  assert.equal(v.boat!.hall, 5);
  // the island's own prices (no port's markup)
  assert.equal(v.rows.find((r) => r.tier === 2)!.units[0].per, UNITS.marine.cost);
});

test('paid once at the sending; the boats run her down and the men come aboard as a hire; the wait follows', () => {
  const game = world();
  const { s, home } = islander(game, 2);
  const [x, y] = waterAway(game, home, 7000);
  sailTo(game, s, x, y);
  s.ship!.setArmy([{ u: 'deckhand', n: 20 }, { u: 'marine', n: 4, g: 1 }]);
  const y0 = yardOf(game, ownIsland(game, s.accountId)!);
  const pool0 = townState(y0).pool[2];
  const gold0 = s.profile!.gold;
  const price = recruitPrice('marine', 12, false).silver;
  const info = boatsInfo(game, s)!;
  assert.equal(sendBoats(game, s, [{ u: 'marine', n: 12 }]), null);
  const rec = s.profile!.isleBoats!;
  assert.equal(rec.fee, boatFee(2, info.km, price), 'the fee by the run and the hall');
  assert.equal(s.profile!.gold, gold0 - price - rec.fee, 'the men\'s price and the fee, once');
  assert.equal(townState(y0).pool[2], pool0 - 12, 'the men leave the dwelling at once');
  assert.equal(menOf(s, 'marine'), 4, 'not aboard yet');
  // put out from the island's shore, on her side
  assert.ok(!isLand(game.world, rec.x, rec.y));
  assert.ok(Math.hypot(rec.x - home.x, rec.y - home.y) < home.radius + 600);
  // a second trip waits
  assert.match(sendBoats(game, s, [{ u: 'marine', n: 1 }]) ?? '', /already on their way/);
  // the HUD's view
  const bv = boatsView(game, s)!;
  assert.ok(bv.left > 5000 && bv.men === 12 && bv.boats === 2);
  const at = boatsAt(bv, bv.at + 1);
  assert.ok(Math.hypot(at.x - bv.x, at.y - bv.y) > bv.v * 0.9, 'carried along at their way');
  // she sails on meanwhile: they follow her
  const [x2, y2] = waterAway(game, home, 9000, 1.2);
  let ticks = 0;
  for (; ticks < 40; ticks++) {
    clock += 50;
    stepIsleBoats(game, 0.05);
  }
  sailTo(game, s, x2, y2);
  ticks += run(game, s);
  assert.equal(s.profile!.isleBoats, null, 'alongside');
  const secs = ticks * 0.05;
  assert.ok(secs < 120, `fast: ${secs.toFixed(1)} s at ${Math.round(rec.v)} m/s`);
  // the men aboard: a new stack of their own, the gift stack untouched
  assert.equal(menOf(s, 'marine'), 16);
  assert.ok(s.ship!.army.some((st) => st.u === 'marine' && st.g && st.n === 4), 'the gift stack stays as it was');
  assert.ok(s.ship!.army.some((st) => st.u === 'marine' && !st.g && st.n === 12));
  assert.equal(s.profile!.gold, gold0 - price - rec.fee, 'nothing more paid on arrival');
  const conn = game.sessionByName('Boat Caller');
  void conn;
  // the hall's wait since the sending
  assert.match(boatsWhy(game, s) ?? '', /put out again in/);
  clock += boatCooldown(2) * 1000;
  assert.equal(boatsWhy(game, s), null);
});

test('more men than her hammocks then: the rest row back, their silver returned', () => {
  const game = world();
  const { s, home } = islander(game, 5);
  const [x, y] = waterAway(game, home, 5000);
  sailTo(game, s, x, y);
  const max = s.ship!.stats.crewMax;
  s.ship!.setArmy([{ u: 'marine', n: 10 }]);
  assert.equal(sendBoats(game, s, [{ u: 'musketeer', n: 15 }]), null);
  const gold1 = s.profile!.gold;
  // meanwhile she signs on men elsewhere: the hammocks all but full
  s.ship!.setArmy([{ u: 'marine', n: max - 5 }]);
  const room = roomFor(s, 'musketeer');
  assert.ok(room < 15, `room ${room}`);
  run(game, s);
  assert.equal(menOf(s, 'musketeer'), room);
  const back = Math.floor(recruitPrice('musketeer', 15, false).silver * ((15 - room) / 15));
  assert.equal(s.profile!.gold, gold1 + back, 'the silver of the men who rowed back');
  const y0 = yardOf(game, ownIsland(game, s.accountId)!);
  assert.equal(townState(y0).pool[3], 60 - room, 'they are back in the dwelling');
});

test('kept in her save: after a restart the boats are carried on by the time gone', () => {
  const game = world();
  const { s, home } = islander(game, 1);
  const [x, y] = waterAway(game, home, 9000);
  sailTo(game, s, x, y);
  s.ship!.setArmy([{ u: 'deckhand', n: 10 }]);
  assert.equal(sendBoats(game, s, [{ u: 'marine', n: 5 }]), null);
  for (let i = 0; i < 20; i++) {
    clock += 50;
    stepIsleBoats(game, 0.05);
  }
  // the save as it stands (JSON), the live reckoning gone: a restart
  const saved = JSON.parse(JSON.stringify(s.profile!.isleBoats));
  s.profile!.isleBoats = saved;
  forgetBoats(game);
  const d0 = Math.hypot(saved.x - x, saved.y - y);
  // two seconds gone: carried on by about 2 s of their way, not there yet
  clock += 2000;
  stepIsleBoats(game, 0.05);
  const r1 = s.profile!.isleBoats!;
  assert.ok(r1, 'still under way');
  const d1 = Math.hypot(r1.x - x, r1.y - y);
  assert.ok(d0 - d1 > r1.v * 1.5, `carried on by the time gone (${Math.round(d0 - d1)} m)`);
  assert.ok(!isLand(game.world, r1.x, r1.y));
  // logged off for a minute: alongside at her return
  forgetBoats(game);
  clock += 60_000;
  stepIsleBoats(game, 0.05);
  stepIsleBoats(game, 0.05);
  assert.equal(s.profile!.isleBoats, null);
  assert.equal(menOf(s, 'marine'), 5);
  boatsReady(s);
  assert.equal(boatsWhy(game, s), null);
});

test('the boats never cross land: many runs from the island round the sea', () => {
  const game = world();
  const { s, home } = islander(game, 5);
  let steps = 0;
  boatsHooks.trace = (x, y) => {
    steps++;
    assert.ok(!isLand(game.world, x, y), `a step onto land at ${Math.round(x)}, ${Math.round(y)}`);
  };
  try {
    for (let k = 0; k < 8; k++) {
      const [x, y] = waterAway(game, home, 4000 + k * 2500, k * 0.8);
      sailTo(game, s, x, y);
      s.ship!.setArmy([{ u: 'deckhand', n: 10 }]);
      boatsReady(s);
      assert.equal(sendBoats(game, s, [{ u: 'deckhand', n: 3 }]), null, `run ${k}`);
      const from = launchPoint(game, home, x, y);
      assert.ok(!isLand(game.world, from[0], from[1]));
      const n = run(game, s);
      assert.ok(n < 20_000, `run ${k} came alongside`);
      assert.equal(s.profile!.isleBoats, null);
    }
  } finally {
    boatsHooks.trace = null;
  }
  assert.ok(steps > 1000, `steps sounded: ${steps}`);
  // ×14 her top speed: a tick's way cut into steps of no more than 8 m
  assert.ok(boatSpeed(5, shipTop(s.ship!)) * 0.05 > 8);
});

test('every word of the boats in Russian', () => {
  const table = serverTable();
  const mine = extract().filter((p) => /island's boats|The boats carry|boats first|No dwelling of theirs on your island|wait in the dwelling this week|No room aboard|no boats needed|lie off your island: take|town hall on your island first/.test(p));
  assert.ok(mine.length >= 12, `found ${mine.length}`);
  for (const p of mine) assert.ok(table[p] && !/[A-Za-z]{3}/.test(table[p].replace(/\{\d\}/g, '')), `RU: ${p}`);
  void recruit;
});
