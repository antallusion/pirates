// The small life of the sea: something turns up every 16–26 s of quiet sailing (flotsam, a shoal, beasts), and
// nothing in a fight or by a harbour.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIFE_EVERY, stepSeaLife } from '../server/src/game/sealife.ts';
import { shoalsOf } from '../server/src/game/fishing.ts';
import { beastsAlive } from '../server/src/game/beasts.ts';
import { join, makeGame } from './helpers.ts';

function atSea(name: string) {
  const { game } = makeGame();
  game.directorOn = true;
  join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 56000;
  ship.state.y = 74000;
  ship.region = 'gravewater';
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { game, s, ship };
}

/** Everything the small life can leave: her private flotsam, shoals, beasts. */
function count(game: ReturnType<typeof makeGame>['game'], account: number): number {
  const flotsam = [...game.loot.values()].filter((l) => l.ownerOnly === account).length;
  return flotsam + shoalsOf(game).length + beastsAlive(game).length;
}

test('quiet sailing brings a small thing every 16–26 seconds', () => {
  const { game, s, ship } = atSea('Small Sal');
  const before = count(game, s.accountId);
  let things = 0, last = before;
  for (let t = 0; t < 200; t++) {
    ship.state.speed = 8;
    stepSeaLife(game);
    game.now += 1;
    const n = count(game, s.accountId);
    if (n > last) things++;
    last = n;
  }
  // 200 s at one every 16–26 s (the first after one wait): at least seven, at most thirteen.
  assert.ok(things >= Math.floor(200 / LIFE_EVERY[1]) - 1, `only ${things}`);
  assert.ok(things <= Math.ceil(200 / LIFE_EVERY[0]) + 1, `too many: ${things}`);
});

test('a fight keeps the small life still', () => {
  const { game, s, ship } = atSea('Fighting Fen');
  const before = count(game, s.accountId);
  for (let t = 0; t < 120; t++) {
    ship.state.speed = 8;
    ship.lastCombat = game.now;
    stepSeaLife(game);
    game.now += 1;
  }
  assert.equal(count(game, s.accountId), before);
});
