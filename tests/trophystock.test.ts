// Forum 147 (2026-11-23): the leviathan's bone was bought by the hundred at Harpoon's Rest (the floor of 100 a captain
// kept for every good): the great beasts' and the deep's goods keep no floor — a harbour's true stock, slowly restocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STOCK_FLOOR, isTrophyGood } from '../shared/src/data/goods.ts';
import { ownStockOf, ownTrade } from '../server/src/game/ownstock.ts';
import { join, makeGame } from './helpers.ts';

test('forum 147: a trophy good runs out at a harbour; an everyday good keeps her floor of 100', () => {
  const { game } = makeGame();
  join(game, 'Bone Buyer');
  const p = game.sessionByName('Bone Buyer')!.profile!;
  assert.ok(isTrophyGood('leviathan_bone') && isTrophyGood('abyssal_ore') && isTrophyGood('narwhal_tusk'));
  assert.ok(!isTrophyGood('iron') && !isTrophyGood('rum'));
  const port = game.portById('harpoon_rest')!;
  const n = ownStockOf(game, p, port, 'leviathan_bone');
  assert.ok(n > 0 && n < STOCK_FLOOR, `the true stock (${n})`);
  ownTrade(game, p, port, 'leviathan_bone', -n);
  assert.equal(ownStockOf(game, p, port, 'leviathan_bone'), 0, 'bought out');
  const iron = game.world.ports.find((x) => ownStockOf(game, p, x, 'iron') > 0)!;
  ownTrade(game, p, iron, 'iron', -ownStockOf(game, p, iron, 'iron'));
  assert.equal(ownStockOf(game, p, iron, 'iron'), STOCK_FLOOR, 'iron keeps the floor');
});
