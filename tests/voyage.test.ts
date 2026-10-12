// Readiness for a voyage (owner, 2026-09-30): what a ship eats and what is short before she leaves port — the port
// screen's pre-departure list and the server's eating go by the same rate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_HOLD_SHARE, FOOD_PER_40, VOYAGE_MINUTES, foodMinutes, provisionsPerMinute, voyageCrew, voyageFood, voyageNeeds } from '../shared/src/data/voyage.ts';
import type { VoyageShip } from '../shared/src/data/voyage.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { join, makeGame } from './helpers.ts';

const ready = (o: Partial<VoyageShip> = {}): VoyageShip => ({
  crew: 20, crewMin: 8, crewMax: 28, provisions: 40, provisionUse: 1, holdVolume: 80, holdFree: 30, provisionVolume: 1,
  roundShot: 60, gunsPerSide: 3, hull: 100, hullMax: 100, sails: 100, sailsMax: 100, ...o,
});

test('a ship eats FOOD_PER_40 units a minute for every forty hands; a voyage wants ten minutes of it, never more than half the hold', () => {
  assert.equal(provisionsPerMinute(40), FOOD_PER_40);
  assert.equal(provisionsPerMinute(20, 0.5), FOOD_PER_40 / 4);
  assert.equal(Math.round(foodMinutes(30, 20)), Math.round(30 / (FOOD_PER_40 / 2)));
  assert.equal(voyageFood(ready()), Math.ceil((FOOD_PER_40 / 2) * VOYAGE_MINUTES));
  assert.equal(voyageFood(ready({ crew: 400, holdVolume: 30 })), Math.floor(30 * FOOD_HOLD_SHARE), 'held to half a small hold');
  // docs/30: a starter sloop (28 hands, a hold of 30) takes ten minutes of food in a third of her hold
  assert.ok(voyageFood({ crew: 28, provisionUse: 1, holdVolume: 30, provisionVolume: 1 }) <= 10);
  assert.equal(voyageCrew({ crewMin: 8, crewMax: 28 }), 16, 'enough hands to sail at her best');
  assert.equal(voyageCrew({ crewMin: 20, crewMax: 22 }), 20);
});

test('what is short before setting sail: food, hands, shot and repairs, each with what to buy', () => {
  assert.deepEqual(voyageNeeds(ready()), [], 'a ready ship is not stopped');
  const needs = voyageNeeds(ready({ provisions: 0, crew: 10, roundShot: 5, hull: 60 }));
  assert.deepEqual(needs.map((n) => n.kind), ['food', 'crew', 'ammo', 'repair']);
  const food = needs[0];
  assert.ok(food.kind === 'food' && food.want === Math.ceil((10 / 40) * FOOD_PER_40 * VOYAGE_MINUTES) && food.buy === food.want, JSON.stringify(food));
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
