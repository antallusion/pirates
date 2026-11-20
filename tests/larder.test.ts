// The crew's larder (forum post 109, Эдуард, 2026-11-19): fed from her own island's stores lying by it; fish eaten when
// the biscuit is gone; the plan of a hull a yard sells her by her career rank sold to her too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { yardOf } from '../server/src/game/base.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { eatFish, foodAboard, isleLarder } from '../server/src/game/larder.ts';
import { provisionsPerMinute } from '../shared/src/data/voyage.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

test('by her own island a crew short of food is fed from the island\'s stores', () => {
  const { game } = makeGame();
  clearOutposts(game);
  join(game, 'Eduard');
  const s = game.sessionByName('Eduard')!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  s.profile!.level = 30;
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(offCoast(game, ship, home));
  ship.state.speed = 0;
  ship.region = home.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  yardOf(game, h).res.provisions = 2000;
  delete ship.cargo.provisions;
  const per = provisionsPerMinute(ship.crew);
  const got = isleLarder(game, ship, per, per * 5);
  assert.ok(got >= per * 29, `half an hour of food came aboard: ${got} (${per}/min)`);
  assert.equal(ship.cargo.provisions, got);
  assert.equal(yardOf(game, h).res.provisions, 2000 - got);
  assert.equal(isleLarder(game, ship, per, per * 5), 0, 'not again while she has enough');
  // far from her island: nothing
  ship.state.x += 50_000;
  delete ship.cargo.provisions;
  assert.equal(isleLarder(game, ship, per, per * 5), 0);
});

test('the biscuit gone, the crew eats the fish in the hold, the salted first; hungry only when that is gone too', () => {
  const { game } = makeGame();
  join(game, 'Cook');
  const ship = game.sessionByName('Cook')!.ship!;
  delete ship.cargo.provisions;
  ship.cargo.salted_fish = 3;
  ship.cargo.fish = 10;
  assert.ok(foodAboard(ship));
  assert.equal(eatFish(ship, 5), 5);
  assert.equal(ship.cargo.salted_fish, undefined);
  assert.equal(ship.cargo.fish, 8);
  assert.equal(eatFish(ship, 20), 8);
  assert.ok(!foodAboard(ship));
});
