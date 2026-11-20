// Lying at her own island (forum post 115, Эдуард, 2026-11-20): «Выход» there at once as in a port; under way or far
// from it, the safe exit's thirty seconds as at sea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyIsland, clearOutposts } from '../server/src/game/estate.ts';
import { askExit } from '../server/src/game/exit.ts';
import { atOwnIsle } from '../server/src/game/isleberth.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

test('hove to off her own island she is at home: «Выход» at once; under way, the thirty seconds', () => {
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
  assert.ok(!atOwnIsle(game, s), 'no island of hers yet');
  assert.equal(buyIsland(game, s, home.id), null);
  assert.ok(atOwnIsle(game, s));
  // under way: the safe exit as at sea
  ship.state.speed = 5;
  assert.ok(!atOwnIsle(game, s));
  askExit(game, s);
  assert.ok(s.exitAt > 0, 'thirty seconds under way');
  askExit(game, s, true);
  s.exitAt = 0;
  // hove to: at once
  ship.state.speed = 0;
  let left = false;
  const leave = game.leaveWorld.bind(game);
  game.leaveWorld = (x) => { left = true; return leave(x); };
  askExit(game, s);
  assert.ok(left, 'left at once');
});
