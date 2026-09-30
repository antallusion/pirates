// docs/16 Batch A — battle and boarding: aim with the wind, critical hits on her parts, a ship that strikes her
// colours, the win streak, the named trophy ship.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec, wrapAngle } from '../shared/src/math.ts';
import { WIND_DRIFT, windDrift, windDriftAngle } from '../shared/src/data/gunnery.ts';
import { AMMO } from '../shared/src/data/ships.ts';
import type { GameEvent } from '../shared/src/protocol.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { fireBroadside, shotDrift, stepProjectiles } from '../server/src/game/combat.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

function events(game: Game): GameEvent[] {
  const list: GameEvent[] = [];
  const emit = game.emit.bind(game);
  game.emit = (e: GameEvent, x: number, y: number) => {
    list.push(e);
    emit(e, x, y);
  };
  return list;
}

/** A steady wind for the test, blowing toward `dir` at `strength`. */
function wind(game: Game, dir: number, strength: number): void {
  game.windFor = () => ({ dir, strength });
}

// ------------------------------------------------------------------ 1. aim with the wind

test('the cross wind carries a ball a few metres downwind at long range, nothing along the wind, more in a storm', () => {
  const speed = AMMO.round.speed;
  const long = windDrift(Math.PI / 2, 1, 0, 460, speed); // wind to the east, ball laid north, a long gun's reach
  assert.ok(long > 4 && long < 12, `a few metres at long range (${long.toFixed(1)})`);
  assert.ok(Math.abs(windDrift(0, 1, 0, 460, speed)) < 1e-9, 'a head or following wind does not push her sideways');
  assert.ok(windDrift(-Math.PI / 2, 1, 0, 460, speed) < 0, 'a wind from the other side, the other way');
  assert.ok(Math.abs(windDrift(Math.PI / 2, 1, 0, 150, speed)) < long / 5, 'short range: next to nothing (the square of the flight)');
  assert.ok(windDrift(Math.PI / 2, 1.3, 0, 460, speed) > long * 1.25, 'a storm pushes more');
  assert.equal(windDrift(Math.PI / 2, 1, 0, 460, speed), WIND_DRIFT * (460 / speed) ** 2);
});

test('a broadside flies downwind of where it is laid by the same reckoning the aim mark shows; the sea\'s gunners allow for it', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Windward');
  ship.reload.starboard = 0;
  ship.reload.port = 0;
  wind(game, 0, 1.2); // the wind blows north; the starboard battery fires east: a full cross wind from the south
  game.rng.gauss = () => 0; // no scatter: the line is the line she laid
  const evs = events(game);
  assert.equal(fireBroadside(game, ship, 'starboard', 400), null);
  const v = evs.find((e) => e.k === 'volley') as Extract<GameEvent, { k: 'volley' }>;
  const laid = wrapAngle(ship.state.heading + Math.PI / 2);
  const want = windDriftAngle(0, 1.2, laid, 400, AMMO[ship.ammoSel].speed);
  assert.ok(want < 0, 'blown north, to the left of an eastward ball');
  for (const b of v.balls) assert.ok(Math.abs(wrapAngle(b[2] - laid) - want) < 0.002, 'every ball turned by the drift');
  // Where the ball falls: as far off her line as the aim mark says.
  const p = game.projectiles[game.projectiles.length - 1];
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 200 && game.projectiles.includes(p); i++) stepProjectiles(game, 0.05);
  const along = headingVec(laid), side = headingVec(laid + Math.PI / 2); // side: to the right of her line
  const off = (p.x - x0) * side.x + (p.y - y0) * side.y;
  const drift = windDrift(0, 1.2, laid, 400, AMMO[ship.ammoSel].speed);
  assert.ok(Math.abs(off - drift) < 3.5, `falls ${off.toFixed(1)} m off her line; the mark said ${drift.toFixed(1)} m`);
  assert.ok((p.x - x0) * along.x + (p.y - y0) * along.y > 350, 'at the range she laid');
  // Her gunners who allow for all of it lay straight on.
  assert.ok(Math.abs(shotDrift(game, ship, laid, 400, 'round', 1)) < 1e-12);
  assert.ok(Math.abs(shotDrift(game, ship, laid, 400, 'round', 0.5) - want / 2) < 1e-9);
});

// ------------------------------------------------------------------ 2. critical hits on her parts

/** A merchant lying off her starboard beam at `d` metres, on even terms. */
function mark(game: Game, ship: ShipEntity, d: number): ShipEntity {
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + v.x * d, ship.state.y + v.y * d, ship.state.heading);
  onHull(game, ship, 'brig', npc.shipLevel);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

/** One ball from her side square into the target's waist. */
function ballInto(game: Game, ship: ShipEntity, target: ShipEntity, ammo: 'chain' | 'heavy' | 'round'): Extract<GameEvent, { k: 'hit' }> | undefined {
  const evs = events(game);
  const h = Math.atan2(target.state.x - ship.state.x, -(target.state.y - ship.state.y));
  const d = Math.hypot(target.state.x - ship.state.x, target.state.y - ship.state.y);
  game.projectiles.push({ owner: ship.id, x: ship.state.x, y: ship.state.y, heading: h, speed: 500, dist: d + 40, traveled: 0, ammo, damage: 60, maxRange: 400, delay: 0 });
  for (let i = 0; i < 40 && game.projectiles.length; i++) stepProjectiles(game, 0.02);
  return evs.find((e) => e.k === 'hit') as Extract<GameEvent, { k: 'hit' }> | undefined;
}

test('chain shot into torn rigging brings the topmast down: a MAST critical, the canvas with it, and she is slower for a while', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Mastbreaker');
  const t = mark(game, ship, 150);
  t.sails = t.stats.sailHpMax * 0.4;
  const speed = t.stats.maxSpeed;
  game.rng.chance = (p: number) => p > 0; // every chance that exists at all comes up
  const hit = ballInto(game, ship, t, 'chain');
  assert.equal(hit?.crit, 'mast');
  assert.ok(t.hasEffect('topmast_down'));
  assert.ok(t.stats.maxSpeed < speed * 0.95, 'she loses way');
  // Whole rigging is not shot away that way.
  const t2 = mark(game, ship, 150);
  t2.state.y -= 400;
  game.grid.upsert(t2.id, t2.state.x, t2.state.y);
  const hit2 = ballInto(game, ship, t2, 'chain');
  assert.notEqual(hit2?.crit, 'mast', 'rigging still whole: no mast');
});

test('a forged ball amidships may find the powder room: a MAGAZINE critical with its blast; a sealed magazine is safer', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Deepshot');
  const t = mark(game, ship, 150);
  t.cargo = {};
  t.ammo.incendiary = 0;
  const hull = t.hull;
  game.rng.chance = (p: number) => p > 0;
  const hit = ballInto(game, ship, t, 'heavy');
  assert.equal(hit?.crit, 'powder');
  assert.ok(t.hull < hull - t.stats.hullMax * 0.1, 'the blast tears her');
  assert.ok(t.hasEffect('fire'));
  // Round shot does not reach it (only her hold's powder can go up).
  const t2 = mark(game, ship, 150);
  t2.state.y -= 400;
  t2.cargo = {};
  t2.ammo.incendiary = 0;
  game.grid.upsert(t2.id, t2.state.x, t2.state.y);
  let seen = 0;
  game.rng.chance = (p: number) => p > 0 && p < 0.02 && p > 0.005; // only the smallest odds come up: the magazine's
  const r = ballInto(game, ship, t2, 'round');
  if (r?.crit === 'powder') seen++;
  assert.equal(seen, 0);
});

test('a critical on one of her parts goes up over the target as a plate with its word; lesser ones stay a number', async () => {
  const { Fx } = await import('../client/src/render/fx.ts');
  const fx = new Fx();
  fx.onEvent({ k: 'hit', x: 100, y: 100, ship: 7, dmg: 42, ammo: 'chain', crit: 'mast' }, 1);
  const plate = fx.particles.find((p) => p.badge === 'mast');
  assert.ok(plate, 'a plate for the mast');
  assert.ok(plate!.text === 'Mast!' || plate!.text === 'Мачта!', plate!.text);
  assert.ok(plate!.y < 100 - 20, 'over the ship, above the damage');
  assert.ok(fx.particles.some((p) => p.kind === 'text' && p.text === '42'), 'the damage still reads');
  // The same part on the same ship does not stack plates in one moment.
  fx.onEvent({ k: 'hit', x: 102, y: 100, ship: 7, dmg: 30, ammo: 'chain', crit: 'mast' }, 1);
  assert.equal(fx.particles.filter((p) => p.badge === 'mast').length, 1);
  for (const part of ['rudder', 'powder'] as const) {
    fx.onEvent({ k: 'hit', x: 300, y: 300, ship: 8, dmg: 10, ammo: 'round', crit: part }, 1);
    assert.ok(fx.particles.some((p) => p.badge === part), part);
  }
  fx.onEvent({ k: 'hit', x: 500, y: 500, ship: 9, dmg: 10, ammo: 'round', crit: 'raked' }, 1);
  assert.ok(!fx.particles.some((p) => p.ship === 9 && p.badge), 'a raking shot is no part');
});
