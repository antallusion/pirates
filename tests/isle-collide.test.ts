// Ships and islands (owner, 2026-10-08): «корабли не чувствуют границ островов и некоторых других объектов»,
// «врезаясь в объекты корабль должен получать урон». Her hull as drawn keeps off the coast as drawn — the rounded
// outline and its 20 m band of shore stones — and off the sea's solid things (a wreck, a buoy, a skerry, a pier, a
// graveyard's hulks), on the server and in the client's prediction alike; she slides along a coast she grazes; a blow
// costs her hull by her knots into it, once in a while; the sea's own captains and the helmsmen steer round it all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { buildAdv } from '../shared/src/data/advmap.ts';
import { headingOf, headingVec, pointInPolygon } from '../shared/src/math.ts';
import type { IslandData, SeaMarkData } from '../shared/src/protocol.ts';
import {
  COAST_REACH, KNOTS_PER_SPEED, SHORE_PAD, STRIKE_COOLDOWN, STRIKE_MAX, blockerProbe, coastOf, coastProbe, hullClearance, inCoast, newHit,
  resolveHull, roundedOutline, strikeDamage,
} from '../shared/src/sim/hull.ts';
import type { Blocker } from '../shared/src/sim/hull.ts';
import { isleType } from '../shared/src/world/archipelago.ts';
import { blockersNear, islandBlockers, markBlockers, quayBlockers, skerryBlockers } from '../shared/src/world/solids.ts';
import { generateWorld, legacyIslands } from '../shared/src/world/worldgen.ts';
import { placeWonders } from '../shared/src/data/wonders.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { clientBlockers } from '../client/src/collide.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import type { Game } from '../server/src/game/Game.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { STRIKE_WORDS, touches } from '../server/src/game/strike.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const world = generateWorld(WORLD_SEED);

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 20;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  return { c, s, ship };
}

function fair(game: Game): void {
  if (!Object.getOwnPropertyDescriptor(game, 'fronts')?.get) Object.defineProperty(game, 'fronts', { get: () => [], set: () => {}, configurable: true });
  for (const w of Object.values(game.weather)) {
    w.kind = 'breeze';
    w.until = game.now + 1e6;
  }
}

/** Her at (x, y) with her head on `h`, at `speed` with her canvas set to `sail`, the sea about her emptied. */
function put(game: Game, ship: ShipEntity, x: number, y: number, h: number, speed: number, sail = 1): void {
  for (const id of [...game.npcs.keys()]) {
    const o = game.ships.get(id);
    if (o && Math.hypot(o.state.x - x, o.state.y - y) < 4000) game.removeShip(id);
  }
  ship.state = { ...ship.state, x, y, heading: h, speed, sail, rudder: 0 };
  ship.input = { rudder: 0, sailTarget: sail };
  ship.lastCombat = -1e9;
  game.grid.upsert(ship.id, x, y);
}

const blows = (ship: ShipEntity) => touches.get(ship)?.blow ?? 0;

/** The least water her hull kept off what is about her over `ticks` (her helm held, her canvas as set). */
function sailOn(game: Game, ship: ShipEntity, ticks: number, input?: { rudder: number; sailTarget: number }): number {
  let least = Infinity;
  const near: Blocker[] = [];
  for (let i = 0; i < ticks; i++) {
    if (input) ship.input = { ...input };
    game.step();
    blockersNear(game.world, ship.state.x, ship.state.y, ship.stats.length, near);
    least = Math.min(least, hullClearance(ship.state, ship.stats.length, ship.stats.beam, near));
  }
  return least;
}

// ------------------------------------------------------------------ the coast as drawn

test('the coast is the drawn line: the rounded outline of the polygon, its inside and its distances exact', () => {
  const is = world.islands.find((i) => !i.slot && !i.minor && !i.raft && i.radius > 600)!;
  const c = coastOf(is.poly);
  // Every point of the outline on one of the renderer's curves (renderer.ts path(): through the edges' midpoints with
  // the vertices as control points), from the polygon in whole metres as the client has it.
  const p = is.poly.map((v) => Math.round(v)), n = p.length / 2;
  const mid = (i: number) => [(p[(i % n) * 2] + p[((i + 1) % n) * 2]) / 2, (p[(i % n) * 2 + 1] + p[((i + 1) % n) * 2 + 1]) / 2];
  const [m0x, m0y] = mid(0);
  assert.ok(Math.hypot(c.pts[0] - m0x, c.pts[1] - m0y) < 1e-9, 'the outline starts at the first edge\'s midpoint, as the drawing does');
  assert.equal(roundedOutline(is.poly).length, c.n * 2);
  // Ashore and afloat as the outline says, and the signed distance as a sweep of every edge has it.
  const P = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 3000; k++) {
    const x = c.cx + (rnd() * 2 - 1) * (c.r + 80), y = c.cy + (rnd() * 2 - 1) * (c.r + 80);
    const inside = pointInPolygon(x, y, c.pts);
    assert.equal(inCoast(c, x, y), inside, `ashore at ${x.toFixed(1)},${y.toFixed(1)}`);
    let best = Infinity;
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      const ax = c.pts[i * 2], ay = c.pts[i * 2 + 1], dx = c.pts[j * 2] - ax, dy = c.pts[j * 2 + 1] - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    }
    coastProbe(c, x, y, P);
    if (best < COAST_REACH) assert.ok(Math.abs(Math.abs(P.d) - best) < 1e-6 && (P.d < 0) === inside, `distance at ${x.toFixed(1)},${y.toFixed(1)}: ${P.d} vs ${best}`);
    else if (!inside) assert.equal(P.d, COAST_REACH);
    else assert.ok(P.d < 0, 'deep ashore is ashore');
  }
});

// ------------------------------------------------------------------ no land under her

/** One island of each kind the sea has: a great one, a small old one, a sea stack, a floating town, the small islands,
 *  atolls and ridges of docs/18 III, a new town's island (step 8), a graveyard with hulks on her shore. */
function kinds(game: Game): [string, Island][] {
  const w = game.world;
  const ok = (i: Island) => !i.slot && !i.hidden && i.poly.length > 0;
  const pick = (f: (i: Island) => boolean) => w.islands.find((i) => ok(i) && f(i))!;
  return [
    ['great', pick((i) => !i.minor && !i.raft && !i.isle && !i.portId && i.radius > 900)],
    ['small', pick((i) => !i.minor && !i.raft && !i.isle && !i.portId && i.radius < 300)],
    ['stack', pick((i) => !!i.minor)],
    ['raft', pick((i) => !!i.raft)],
    ['isle', pick((i) => i.isle === 'small')],
    ['atoll', pick((i) => i.isle === 'atoll')],
    ['ridge', pick((i) => i.isle === 'ridge')],
    ['new town', pick((i) => i.id >= (w.portIslesFrom ?? Infinity))],
    ['graveyard', pick((i) => !i.portId && !i.raft && !i.minor && isleType(i) === 'graveyard')],
  ];
}

test('she cannot enter land: every kind of island, from eight sides, bow on and glancing, at full sail — her hull never on the shore band', () => {
  const { game } = makeGame();
  fair(game);
  const { ship } = captain(game, 'Rock Hopper');
  onHull(game, ship, 'brig');
  for (const [what, is] of kinds(game)) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      const R = is.radius + 120;
      const x = is.x + Math.sin(a) * R, y = is.y - Math.cos(a) * R;
      for (const glance of [0, 0.85]) {
        ship.hull = ship.stats.hullMax;
        put(game, ship, x, y, headingOf(is.x - x, is.y - y) + glance, ship.stats.maxSpeed);
        const least = sailOn(game, ship, 20 * 9, { rudder: 0, sailTarget: 1 });
        assert.ok(least > -0.05, `${what} #${is.id} from ${k * 45}°${glance ? ' glancing' : ''}: her hull ${(-least).toFixed(2)} m into its clearance`);
        assert.equal(pointInPolygon(ship.state.x, ship.state.y, is.poly), false, `${what}: never ashore`);
      }
    }
  }
});

test('a coast she grazes is slid along, not stuck to: her way along it kept, her bow swung to it', () => {
  const { game } = makeGame();
  fair(game);
  const { ship } = captain(game, 'Long Shore');
  onHull(game, ship, 'brig');
  const is = game.world.islands.find((i) => !i.slot && !i.minor && !i.raft && !i.isle && !i.portId && i.radius > 900)!;
  const c = coastOf(is.poly);
  // A point of her coast and its outward normal: she comes in 35° off the shore line.
  const i = Math.floor(c.n * 0.3);
  const px = c.pts[i * 2], py = c.pts[i * 2 + 1], nx = c.nrm[i * 2], ny = c.nrm[i * 2 + 1];
  const along = headingOf(-ny, nx);
  const h = along + 0.6;
  const v = headingVec(h);
  const x = px + nx * 40 - v.x * 30, y = py + ny * 40 - v.y * 30;
  put(game, ship, x, y, h, ship.stats.maxSpeed * 0.8);
  const before = blows(ship);
  const least = sailOn(game, ship, 20 * 12, { rudder: 0, sailTarget: 1 });
  assert.ok(least > -0.05, 'never into the shore band');
  const moved = (ship.state.x - x) * -ny + (ship.state.y - y) * nx;
  assert.ok(Math.abs(moved) > 120, `she ran on along the coast (${moved.toFixed(0)} m)`);
  assert.ok(ship.state.speed > ship.stats.maxSpeed * 0.3, `with way on her (${ship.state.speed.toFixed(1)})`);
  assert.ok(blows(ship) - before <= 1, 'a graze is one blow at most');
});

// ------------------------------------------------------------------ the blow

test('a blow costs her hull by her knots into it: nothing for a touch, a quarter at most, never the last of a sound hull', () => {
  const max = 3000;
  assert.equal(strikeDamage(1.5 / KNOTS_PER_SPEED - 0.01, 1, max, max), 0, 'a touch under 1.5 kn costs nothing');
  const at = (kn: number) => strikeDamage(kn / KNOTS_PER_SPEED, 1, max, max) / max;
  assert.ok(at(4) > 0.04 && at(4) < 0.07, `4 kn: ${at(4)}`);
  assert.ok(at(10) > 0.13 && at(10) < 0.17, `10 kn: ${at(10)} (1–2% a knot)`);
  for (let kn = 2; kn < 30; kn++) assert.ok(at(kn + 1) >= at(kn), 'the harder, the more');
  assert.equal(at(60), STRIKE_MAX, 'a quarter of her at most');
  // A sound hull (30% and more) is never sunk by one: she keeps 5% at least.
  for (const h of [0.3, 0.31, 0.5, 1]) assert.ok(max * h - strikeDamage(40, 1, max, max * h) >= max * 0.05 - 1e-6, `from ${h}`);
  // A buoy bites less than a rock.
  assert.ok(strikeDamage(10, 0.3, max, max) < strikeDamage(10, 1, max, max) * 0.5);
});

test('ramming a coast at full sail: one blow in the band, a short line «Удар о скалы −N», splinters where she struck; grinding on costs nothing more', () => {
  const { game } = makeGame();
  fair(game);
  const { c, ship } = captain(game, 'Hard Aport');
  onHull(game, ship, 'frigate');
  const is = game.world.islands.find((i) => !i.slot && !i.minor && !i.raft && !i.isle && !i.portId && i.radius > 900)!;
  const coast = coastOf(is.poly);
  const i = Math.floor(coast.n * 0.6);
  const px = coast.pts[i * 2], py = coast.pts[i * 2 + 1], nx = coast.nrm[i * 2], ny = coast.nrm[i * 2 + 1];
  const x = px + nx * 70, y = py + ny * 70;
  put(game, ship, x + nx * 400, y + ny * 400, 0, 0, 0);
  steps(game, 40); // (a ship the sea has just put out is eased clear, not struck: strike.ts SETTLE_SEC)
  put(game, ship, x, y, headingOf(-nx, -ny), ship.stats.maxSpeed);
  const hull0 = ship.hull, from = c.inbox.length;
  let lost = 0;
  for (let k = 0; k < 40 && !lost; k++) {
    ship.input = { rudder: 0, sailTarget: 1 };
    game.step();
    lost = hull0 - ship.hull;
  }
  const kn = ship.stats.maxSpeed * KNOTS_PER_SPEED;
  assert.ok(lost > ship.stats.hullMax * 0.016 * (kn * 0.5) && lost <= ship.stats.hullMax * STRIKE_MAX + 1e-6, `a full-sail blow (${kn.toFixed(1)} kn): ${(lost / ship.stats.hullMax * 100).toFixed(1)}%`);
  assert.ok(ship.alive && !ship.sinkingUntil);
  const said = c.inbox.slice(from).filter((m) => m.t === 'toast').map((m) => (m as { msg: string }).msg);
  const line = said.find((m) => m.startsWith(STRIKE_WORDS.rock));
  assert.equal(line, `${STRIKE_WORDS.rock} −${Math.round(lost)}`, JSON.stringify(said));
  setLang('ru');
  assert.equal(serverText(line!).replace(/ /g, ' '), `Удар о скалы −${Math.round(lost)}`); // (typeset: a short word keeps to the next)
  setLang('en');
  // Pressed on, canvas set, for three seconds more: she lies on the band and takes nothing for it.
  const after = ship.hull;
  const least = sailOn(game, ship, 20 * 3, { rudder: 0, sailTarget: 1 });
  const fx = c.inbox.slice(from).flatMap((m) => (m.t === 'ev' ? m.list : [])).find((e) => e.k === 'fx' && e.fx === 'strike');
  assert.ok(fx && fx.k === 'fx' && fx.ship === ship.id && (fx.r ?? 0) > 5, 'the splinters and the white water where she struck (an fx for the screen, her knots in it)');
  assert.ok(least > -0.05);
  assert.equal(ship.hull, after, 'grinding on costs nothing');
  assert.equal(c.inbox.slice(from).filter((m) => m.t === 'toast' && (m as { msg: string }).msg.startsWith('Struck')).length, 1, 'one line, once');
  // Off and back at her after the cooldown: a second blow.
  put(game, ship, x, y, headingOf(-nx, -ny), ship.stats.maxSpeed);
  steps(game, Math.round(STRIKE_COOLDOWN * 20));
  assert.ok(ship.hull < after, 'a fresh run in is a fresh blow');
});

test('a gentle touch costs nothing; and a sound hull is never sunk by the rocks', () => {
  const { game } = makeGame();
  fair(game);
  const { ship } = captain(game, 'Soft Landing');
  onHull(game, ship, 'brig');
  const is = game.world.islands.find((i) => !i.slot && !i.minor && !i.raft && !i.isle && !i.portId && i.radius > 900)!;
  const coast = coastOf(is.poly);
  const i = Math.floor(coast.n * 0.1);
  const px = coast.pts[i * 2], py = coast.pts[i * 2 + 1], nx = coast.nrm[i * 2], ny = coast.nrm[i * 2 + 1];
  put(game, ship, px + nx * 40, py + ny * 40, headingOf(-nx, -ny), 1.2, 0);
  const h0 = ship.hull;
  sailOn(game, ship, 20 * 8, { rudder: 0, sailTarget: 0 });
  assert.equal(ship.hull, h0, 'a touch at a knot costs nothing');
  // At a third of her hull, rammed as hard as she can: she is badly hurt and afloat.
  ship.hull = ship.stats.hullMax * 0.31;
  put(game, ship, px + nx * 70, py + ny * 70, headingOf(-nx, -ny), ship.stats.maxSpeed * 1.6);
  steps(game, 20 * 4);
  assert.ok(ship.alive && !ship.sinkingUntil && ship.hull >= ship.stats.hullMax * 0.05 - 1e-6, `afloat (${(ship.hull / ship.stats.hullMax).toFixed(3)})`);
});

// ------------------------------------------------------------------ the sea's solid things

test('a wreck, a buoy, a skerry and a pier are solid: she never sails through them', () => {
  const { game } = makeGame();
  fair(game);
  const { ship } = captain(game, 'Flotsam Fan');
  onHull(game, ship, 'sloop');
  const w = game.world;
  const wreck = w.marks.find((m) => m.kind === 'wreck' && m.r > 90)!;
  const buoy = w.marks.find((m) => m.kind === 'buoy')!;
  const obj = buildAdv(w).objs[0];
  const port = w.ports.find((p) => !p.raft && p.size === 3)!;
  const pis = w.islands[port.islandId];
  const quay = quayBlockers(port, { x: Math.round(pis.x), y: Math.round(pis.y), r: Math.round(pis.radius), poly: pis.poly.map((v) => Math.round(v)) })[0];
  const targets: [string, Blocker[]][] = [['wreck', markBlockers(wreck)], ['buoy', markBlockers(buoy)], ['skerry', skerryBlockers(obj)], ['pier', [quay]]];
  for (const [what, list] of targets) {
    assert.ok(list.length > 0, what);
    const b = list[Math.floor(list.length / 2)];
    for (const a of [0, 1.3, 2.6, 3.9, 5.2]) {
      const x = b.x + Math.sin(a) * (b.reach + 70), y = b.y - Math.cos(a) * (b.reach + 70);
      const near: Blocker[] = [];
      blockersNear(w, x, y, 20, near);
      if (near.some((q) => q.shape === 'coast' && hullClearance({ x, y, heading: 0 }, 40, 12, [q]) < 0)) continue; // (a start on the shore band: another side)
      put(game, ship, x, y, headingOf(b.x - x, b.y - y), ship.stats.maxSpeed);
      ship.hull = ship.stats.hullMax;
      let least = Infinity;
      for (let t = 0; t < 20 * 5; t++) {
        ship.input = { rudder: 0, sailTarget: 1 };
        game.step();
        least = Math.min(least, hullClearance(ship.state, ship.stats.length, ship.stats.beam, list));
      }
      assert.ok(least > -0.05, `${what} from ${a}: ${(-least).toFixed(2)} m into it`);
    }
  }
});

// ------------------------------------------------------------------ the client's prediction

test('the client reckons the same coast and things as the server: one push for one overlap', () => {
  const { game } = makeGame();
  const w = game.world;
  const P = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };
  // What a client in these waters has been sent: the islands as islandData, the marks, the ports, the skerries.
  const islands = new Map<number, IslandData>();
  for (const is of w.islands) if (!is.slot && !is.hidden) islands.set(is.id, game.islandData(is));
  const seaMarks = new Map<number, SeaMarkData>(w.marks.map((m) => [m.id, { id: m.id, kind: m.kind, x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r), rot: Math.round(m.rot * 100) / 100, seed: m.seed }]));
  const src = { islands, seaMarks, ports: w.ports.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })), adv: { objs: buildAdv(w).objs }, wonders: { near: placeWonders(w.seed, legacyIslands(w)) } };
  const spots: [number, number][] = [];
  const great = w.islands.find((i) => !i.slot && !i.minor && !i.raft && !i.isle && i.radius > 900)!;
  const c = coastOf(great.poly);
  for (let k = 0; k < 12; k++) {
    const i = Math.floor((k / 12) * c.n);
    spots.push([c.pts[i * 2] + c.nrm[i * 2] * 14, c.pts[i * 2 + 1] + c.nrm[i * 2 + 1] * 14]);
  }
  const wreck = w.marks.find((m) => m.kind === 'wreck')!;
  spots.push([wreck.x, wreck.y]);
  for (const [x, y] of spots) {
    const sv: Blocker[] = [], cl: Blocker[] = [];
    blockersNear(w, x, y, 40, sv);
    clientBlockers(src, x, y, 40, cl);
    const a = { x, y, heading: 0.7 }, b = { x, y, heading: 0.7 };
    const ha = newHit(), hb = newHit();
    const ta = resolveHull(a, 30, 9, sv, ha), tb = resolveHull(b, 30, 9, cl, hb);
    assert.equal(tb, ta, `touch at ${x.toFixed(0)},${y.toFixed(0)}`);
    assert.ok(Math.abs(a.x - b.x) < 0.25 && Math.abs(a.y - b.y) < 0.25, `the same push (server ${a.x.toFixed(2)},${a.y.toFixed(2)}, client ${b.x.toFixed(2)},${b.y.toFixed(2)})`);
    for (const q of cl) blockerProbe(q, a.x, a.y, P);
  }
  // A hidden island's mist is not her coast on the client (the server keeps her off the island itself).
  const hid = w.islands.find((i) => i.hidden)!;
  const fog: IslandData = { ...game.islandData(hid), mist: true };
  const only = clientBlockers({ islands: new Map([[hid.id, fog]]), seaMarks: new Map(), ports: [], adv: null, wonders: null }, hid.x, hid.y, 40, []);
  assert.equal(only.length, 0);
  assert.equal(islandBlockers(fog).length, 1, '(the mist\'s ring is never built into a coast she strikes)');
});

// ------------------------------------------------------------------ the sea's own captains and the helmsmen

test('the sea\'s own captains never run aground: every ship of the sea at full physics for two minutes, not one blow', () => {
  const { game } = makeGame();
  class Near extends Map<number, number> {
    override get(): number {
      return 0;
    }
  }
  (game as unknown as { nearestPlayer: Map<number, number> }).nearestPlayer = new Near();
  steps(game, 20 * 120);
  let n = 0, struck = 0;
  for (const s of game.ships.values()) {
    if (!game.npcs.has(s.id)) continue;
    n++;
    struck += blows(s);
  }
  assert.ok(n > 200, `the sea's ships (${n})`);
  assert.equal(struck, 0, 'no blows');
});

test('the helmsman takes her round an island with a graveyard\'s hulks on her shore, and past a wreck on her line, without a blow', () => {
  const { game } = makeGame();
  fair(game);
  const { c, s, ship } = captain(game, 'Ada Helm');
  onHull(game, ship, 'frigate');
  const grave = game.world.islands.find((i) => !i.slot && !i.hidden && !i.portId && !i.raft && !i.minor && isleType(i) === 'graveyard' && i.radius > 300)!;
  const wreck = game.world.marks.find((m) => m.kind === 'wreck' && m.r > 80 && blockersNear(game.world, m.x, m.y, 1500, []).every((b) => b.shape !== 'coast'))!;
  for (const [x0, y0, x1, y1] of [
    [grave.x - grave.radius - 700, grave.y, grave.x + grave.radius + 700, grave.y],
    [wreck.x - 900, wreck.y, wreck.x + 900, wreck.y],
  ]) {
    put(game, ship, x0, y0, headingOf(x1 - x0, y1 - y0), 0, 0);
    s.profile!.docked = null;
    const before = blows(ship);
    c.push({ t: 'autosail', x: x1, y: y1, sail: 4 });
    assert.equal(c.last('autosail')?.on, true, JSON.stringify(c.all('toast').slice(-3)));
    let least = Infinity;
    const near: Blocker[] = [];
    for (let i = 0; i < 20 * 400 && autosailOf(ship); i++) {
      if (i % 20 === 0) fair(game);
      game.step();
      blockersNear(game.world, ship.state.x, ship.state.y, ship.stats.length, near);
      least = Math.min(least, hullClearance(ship.state, ship.stats.length, ship.stats.beam, near));
    }
    assert.equal(c.last('autosail')?.on, false);
    assert.equal(blows(ship), before, 'not one blow');
    assert.ok(least > -0.05, `her hull kept off (${least.toFixed(2)})`);
    assert.ok(Math.hypot(ship.state.x - x1, ship.state.y - y1) < 400, 'and she got there');
  }
});

test('the shore band she keeps off is the one drawn: 20 m of stones over the coast, half over the water, and a margin', () => {
  assert.equal(SHORE_PAD, 13);
});
