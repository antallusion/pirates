// The local traffic: the sea keeps a few of its own ships about every captain at sea, and lets them go when she is gone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_R, TRAFFIC_WANT, localTraffic, stepTraffic } from '../server/src/game/traffic.ts';
import { join, makeGame } from './helpers.ts';

function atSea(name: string, x: number, y: number, region: string) {
  const { game } = makeGame();
  game.directorOn = true;
  join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.region = region as never;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
  return { game, s, ship };
}

test('ships are put out about a captain at sea, up to her waters’ number, and go when she has gone', () => {
  const { game, ship } = atSea('Traffic Tam', 56000, 74000, 'gravewater');
  for (let t = 0; t < 60; t++) {
    stepTraffic(game);
    game.now += 1;
  }
  let near = 0;
  game.forShipsNear(ship.state.x, ship.state.y, TRAFFIC_R, (o) => {
    if (o.npcRole && o.npcRole !== 'beast') near++;
  });
  assert.ok(near >= TRAFFIC_WANT.contested - 1, `only ${near} about her`);
  const mine = [...localTraffic(game)];
  assert.ok(mine.length > 0);
  for (const id of mine) assert.ok(['merchant', 'fisher', 'patrol', 'pirate', 'hunter'].includes(game.ships.get(id)!.npcRole!)); // the Harpoon's whalers too (docs/16 P1)
  // She sails far away: they are gone.
  ship.state.x = 15000;
  ship.state.y = 15000;
  game.grid.upsert(ship.id, 15000, 15000);
  stepTraffic(game);
  for (const id of mine) assert.equal(game.ships.has(id), false);
});

test('no rovers in the Crown’s safe water', () => {
  const { game } = atSea('Safe Sam', 20000, 20000, 'black_coast');
  for (let t = 0; t < 90; t++) {
    stepTraffic(game);
    game.now += 1;
  }
  for (const id of localTraffic(game)) assert.notEqual(game.ships.get(id)!.npcRole, 'pirate');
});
