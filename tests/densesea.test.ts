// Owner, 2026-10-16 (in the Telegram Mini App, off Tar Wharf — «Смоляной причал»): «вокруг ваще ниче нет, ни кораблей, ни
// мобов которые должны быть для прокачки, ничего. ты насели прям густо все море всем, чтобы оно живое и крутое было.»
// Within her chart's near reach (2.5 km) the sea keeps, every minute of her sailing: the sea's ships of her waters' roles
// (NEAR_WANT), the beasts of her level (CLOSE_WANT), the stacks of her band, a small thing on the water now and then —
// in the safe water of the start and in the wild alike, and the more captains the more of it (per captain).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEAR_R, NEAR_WANT, localTraffic, stepTraffic } from '../server/src/game/traffic.ts';
import { CLOSE_R, CLOSE_WANT, beastSecond, isBeast } from '../server/src/game/beasts.ts';
import { roamersAbout } from '../server/src/game/roamers.ts';
import { FIND_EVERY, FIND_HARBOUR, FIND_MAX } from '../shared/src/data/seafinds.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame } from './helpers.ts';

/** A captain past the First Watch at sea `off` metres out of a port, her ship at `lv`. */
function offPort(game: Game, name: string, portId: string, off = 1200): ShipEntity {
  const port = game.world.ports.find((p) => p.id === portId)!;
  const is = game.world.islands[port.islandId];
  const d = Math.hypot(port.x - is.x, port.y - is.y) || 1;
  const x = port.x + ((port.x - is.x) / d) * off, y = port.y + ((port.y - is.y) / d) * off;
  assert.ok(!isLand(game.world, x, y), `${portId}: water`);
  join(game, name);
  const s = game.sessionByName(name)!;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  const ship = s.ship!;
  if (ship.docked) game.undock(s);
  ship.state = { ...ship.state, x, y, speed: 6, sail: 1 };
  ship.region = port.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
  return ship;
}

const near = (game: Game, ship: ShipEntity, r: number, f: (o: ShipEntity) => boolean): number => {
  let n = 0;
  game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
    if (o !== ship && o.alive && f(o) && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < r) n++;
  });
  return n;
};

test('within 2.5 km of a captain off Tar Wharf (safe, ⚓1), a start port and a wild one: the sea\'s ships, beasts of her level and the stacks of her band', () => {
  const { game } = makeGame();
  game.directorOn = true;
  const spots: [string, string][] = [['tar', 'black_coast_t27'], ['start', 'gravesend'], ['wild', 'wrecktide'], ['late', 'cinderhold']];
  const ships = spots.map(([n, p]) => offPort(game, `Dense ${n}`, p));
  for (let t = 0; t < 45; t++) {
    stepTraffic(game);
    beastSecond(game);
    game.now += 1;
  }
  ships.forEach((ship, i) => {
    const tag = spots[i][1];
    const safety = REGIONS[ship.region].safety;
    const sea = near(game, ship, NEAR_R, (o) => !!o.npcRole && localTraffic(game).has(o.id));
    assert.ok(sea >= NEAR_WANT[safety] - 2, `${tag}: ${sea} of the sea's ships within 2.5 km`);
    const beasts = near(game, ship, CLOSE_R, isBeast);
    assert.ok(beasts >= CLOSE_WANT - 1, `${tag}: ${beasts} beasts within 2.5 km`);
    const [lo, hi] = sectorAt(game.world, ship.state.x, ship.state.y).band;
    const stacks = roamersAbout(game, ship.state.x, ship.state.y, 2500).filter((sp) => sp.level >= lo - 1 && sp.level <= hi + 1);
    assert.ok(stacks.length >= 3, `${tag}: ${stacks.length} stacks of her band within 2.5 km`);
  });
  // No pirate in the Crown's safe water.
  for (const id of localTraffic(game)) {
    const o = game.ships.get(id)!;
    if (REGIONS[o.region].safety === 'safe') assert.notEqual(o.npcRole, 'pirate');
  }
});

test('a captain in the First Watch is not crowded with beasts at her bow (the near guarantee is past the lessons)', () => {
  const { game } = makeGame();
  game.directorOn = true;
  join(game, 'Novice Nell');
  const s = game.sessionByName('Novice Nell')!;
  const ship = s.ship!;
  if (ship.docked) game.undock(s);
  s.profile!.tutorial = { ...(s.profile!.tutorial ?? {}), on: true, stage: 0 } as never;
  const x = 14000, y = 84000;
  ship.state = { ...ship.state, x, y, speed: 6 };
  game.grid.upsert(ship.id, x, y);
  let risen = 0;
  for (let t = 0; t < 20; t++) {
    beastSecond(game);
    game.now += 1;
    risen = Math.max(risen, near(game, ship, CLOSE_R, isBeast));
  }
  assert.ok(risen <= 3, `${risen}`);
});

test('the small things on the water: twice as often as before, two at once, from the harbour\'s mouth', () => {
  assert.deepEqual(FIND_EVERY, [75, 130]);
  assert.equal(FIND_MAX, 2);
  assert.ok(FIND_HARBOUR < 1500);
});
