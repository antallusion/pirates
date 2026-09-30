// The turn-based boarding battle on real hulls (docs/16 P4, canon D12): the crews and the ladder of levels as the
// ships make them. Two brigs of a level with their full crews are an even fight; a brig a level up carries a brig
// a level below nearly always; a merchant of the warship's own level never holds her deck.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../shared/src/rng.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import type { Game } from '../../server/src/game/Game.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import { sideOf } from '../../server/src/game/tactical.ts';
import { makeGame } from '../helpers.ts';

function hull(game: Game, role: 'pirate' | 'patrol' | 'merchant', cls: ShipClassId, level: number, x: number): ShipEntity {
  const s = game.spawnNpcShip(role, cls, role === 'pirate' ? 'free' : 'league', 30000 + x, 80000, 0);
  s.loadout.level = level;
  s.recompute(game.now);
  s.crew = s.stats.crewMax;
  s.morale = 80;
  return s;
}

/** The boarder's wins in `n` battles, each on its own field and dice. */
function wins(game: Game, a: ShipEntity, b: ShipEntity, n: number): number {
  let w = 0;
  const sa = sideOf(game, a, b, true), sb = sideOf(game, b, a, false);
  for (let k = 0; k < n; k++) {
    const rng = new Rng(1000 + k * 17);
    const bt = newBattle(sa, sb, k + 1, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w;
}

test('tactical boarding on real hulls: even brigs even, a level up clearly stronger, a merchant never beats a warship of her level', () => {
  const { game } = makeGame();
  const n = 60;
  const even = wins(game, hull(game, 'pirate', 'brig', 5, 0), hull(game, 'patrol', 'brig', 5, 100), n);
  assert.ok(even >= n * 0.3 && even <= n * 0.7, `brig ⚓5 against brig ⚓5: ${even}/${n}`);
  const down = wins(game, hull(game, 'pirate', 'brig', 5, 200), hull(game, 'patrol', 'brig', 6, 300), n);
  assert.ok(down <= n * 0.1, `brig ⚓5 boarding brig ⚓6: ${down}/${n}`);
  const up = wins(game, hull(game, 'patrol', 'brig', 6, 400), hull(game, 'pirate', 'brig', 5, 500), n);
  assert.ok(up >= n * 0.9, `brig ⚓6 boarding brig ⚓5: ${up}/${n}`);
  // A fluyt at the brig's own level: a trade hull, a merchant's crew.
  const fl = hull(game, 'merchant', 'fluyt', 5, 600);
  const war = hull(game, 'pirate', 'brig', 5, 700);
  assert.equal(wins(game, fl, war, n), 0, 'the merchant boarding the warship');
  assert.equal(n - wins(game, war, fl, n), 0, 'the merchant holding her deck against the warship');
});
