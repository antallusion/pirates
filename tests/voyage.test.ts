// Readiness for a voyage (owner, 2026-09-30): what a ship eats and what is short before she leaves port — the port
// screen's pre-departure list and the server's eating go by the same rate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_HOLD_SHARE, FOOD_MESS, FOOD_PER_40, VOYAGE_MINUTES, breadRoom, foodMinutes, provisionsPerMinute, voyageCrew, voyageFood, voyageNeeds } from '../shared/src/data/voyage.ts';
import type { VoyageShip } from '../shared/src/data/voyage.ts';
import { SHIP_CLASSES, defaultGunFor } from '../shared/src/data/ships.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { join, makeGame } from './helpers.ts';

const ready = (o: Partial<VoyageShip> = {}): VoyageShip => ({
  crew: 20, crewMin: 8, crewMax: 28, provisions: 40, provisionUse: 1, holdVolume: 80, holdFree: 30, provisionVolume: 1,
  roundShot: 60, gunsPerSide: 3, hull: 100, hullMax: 100, sails: 100, sailsMax: 100, ...o,
});

test('a ship eats FOOD_PER_40 units a minute for forty hands, a great crew less a head (FOOD_MESS); a voyage wants VOYAGE_MINUTES of it, never more than half the hold', () => {
  assert.equal(provisionsPerMinute(40), FOOD_PER_40);
  assert.ok(Math.abs(provisionsPerMinute(20, 0.5) - FOOD_PER_40 * 0.5 ** FOOD_MESS * 0.5) < 1e-9);
  // docs/31: a great crew's mess — 600 hands eat less than fifteen times forty's.
  assert.ok(provisionsPerMinute(600) < 15 * FOOD_PER_40 * 0.7);
  assert.ok(Math.abs(foodMinutes(30, 20) - 30 / provisionsPerMinute(20)) < 1e-9);
  assert.equal(voyageFood(ready()), Math.ceil(provisionsPerMinute(20) * VOYAGE_MINUTES));
  assert.equal(voyageFood(ready({ crew: 400, holdVolume: 30 })), Math.floor(30 * FOOD_HOLD_SHARE), 'held to half a small hold');
  // docs/30: a starter sloop (28 hands, a hold of 30) takes her voyage's food in half her hold
  assert.ok(voyageFood({ crew: 28, provisionUse: 1, holdVolume: 30, provisionVolume: 1 }) <= 15);
  // docs/31: a voyage is a quest's leg (20–40 minutes), and every warship's half hold feeds her full crew one — the
  // small and middling by the rate itself (the frigate fed 11 minutes before), the great ones by their bread room.
  assert.ok(VOYAGE_MINUTES >= 20);
  for (const id of ['sloop', 'brig', 'corvette', 'frigate', 'galleon'] as const) {
    const c = SHIP_CLASSES[id];
    assert.ok(foodMinutes(c.holdVolume * FOOD_HOLD_SHARE, c.crewMax) >= 20, `${id}: ${foodMinutes(c.holdVolume * FOOD_HOLD_SHARE, c.crewMax).toFixed(1)} min`);
  }
  for (const [id, c] of Object.entries(SHIP_CLASSES)) {
    if (c.crewMax < 100 || c.holdVolume <= 0) continue;
    const gun = defaultGunFor(c);
    const st = computeShipStats({ classId: id as ShipClassId, name: 'Trial', guns: { port: gun, starboard: gun }, modules: {} }, 'corsair', {});
    const food = (st.holdVolume * FOOD_HOLD_SHARE) / st.provisionVolumeMul;
    assert.ok(foodMinutes(food, st.crewMax) >= VOYAGE_MINUTES - 1e-6, `${id}: ${foodMinutes(food, st.crewMax).toFixed(1)} min`);
  }
  // docs/31: and an hour at sea feeds the crew of her waters for a sixth to a quarter of its income (seaHour; a
  // provision 12): it was a quarter on a sloop and four fifths on a man-of-war of 900 hands.
  const seaHour = (a: number) => 6 * 320 * 1.3 ** (a - 1);
  for (const [a, crew] of [[1, 28], [6, 220], [10, 600], [10, 911]] as const) {
    const share = (provisionsPerMinute(crew) * 60 * 12) / seaHour(a);
    assert.ok(share >= 0.1 && share <= 0.27, `⚓${a}, ${crew} hands: food ${Math.round(share * 100)}% of the hour`);
  }
  assert.equal(breadRoom(28, 30), 1, 'a sloop keeps her cubic metre');
  assert.ok(Math.abs(breadRoom(600, 130) - 65 / (provisionsPerMinute(600) * VOYAGE_MINUTES)) < 1e-9, 'a man-of-war: half her hold is a voyage');
  assert.equal(voyageCrew({ crewMin: 8, crewMax: 28 }), 16, 'enough hands to sail at her best');
  assert.equal(voyageCrew({ crewMin: 20, crewMax: 22 }), 20);
});

test('what is short before setting sail: food, hands, shot and repairs, each with what to buy', () => {
  assert.deepEqual(voyageNeeds(ready()), [], 'a ready ship is not stopped');
  const needs = voyageNeeds(ready({ provisions: 0, crew: 10, roundShot: 5, hull: 60 }));
  assert.deepEqual(needs.map((n) => n.kind), ['food', 'crew', 'ammo', 'repair']);
  const food = needs[0];
  assert.ok(food.kind === 'food' && food.want === Math.ceil(provisionsPerMinute(10) * VOYAGE_MINUTES) && food.buy === food.want, JSON.stringify(food));
  const crew = needs[1];
  assert.ok(crew.kind === 'crew' && crew.buy === 6);
  const ammo = needs[2];
  assert.ok(ammo.kind === 'ammo' && ammo.want === 30 && ammo.buy === 30, 'ten broadsides, in tens');
  // No room in the hold: food is short but nothing can be bought.
  const full = voyageNeeds(ready({ provisions: 2, holdFree: 0 }))[0];
  assert.ok(full.kind === 'food' && full.buy === 0);
  // A ship without guns wants no shot.
  assert.ok(!voyageNeeds(ready({ gunsPerSide: 0, roundShot: 0 })).some((n) => n.kind === 'ammo'));
});

test('the server eats by the same rate', () => {
  const { game } = makeGame();
  join(game, 'Hungry Hal');
  const s = game.sessionByName('Hungry Hal')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.crew = Math.min(ship.stats.crewMax, 20);
  ship.cargo = { provisions: 100 };
  const upkeep = (game as unknown as { shipUpkeep(x: typeof ship): void }).shipUpkeep.bind(game);
  (game as unknown as { tick: number }).tick = 200;
  upkeep(ship);
  const eaten = 100 - (ship.cargo.provisions ?? 0);
  assert.ok(Math.abs(eaten - provisionsPerMinute(ship.crew, ship.stats.provisionUse) / 6) < 0.02, `ten seconds of eating: ${eaten}`);
  assert.ok(SHIP_CLASSES.sloop.crewMax > 0);
});
