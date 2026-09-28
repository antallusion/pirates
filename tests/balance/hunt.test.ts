// The balance of the hunt (docs/12 P4) in real fights: a pod of orcas of her level is a fair fight for an average
// captain; a pod a level up she survives only rarely even at her best, two levels up never; a sperm whale two
// levels up sinks her; sharks are a nuisance. `npm run balance` fights the full tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelSea } from './duel.ts';
import { huntRate } from './hunt.ts';

test('the hunt: an even pod is a fair fight, a pod above is death but for the rare best; a whale far above sinks her', () => {
  const game = duelSea();
  const even = huntRate(game, 'schooner', 3, 'average', 'orca', 3, 4, 8, 40);
  assert.ok(even.wins >= 6 && even.hull < 80, `an even pod: ${even.wins}/8, hull ${even.hull}%`);
  const up = huntRate(game, 'schooner', 3, 'perfect', 'orca', 4, 4, 8, 40);
  assert.ok(up.wins <= 2, `a pod a level up: ${up.wins}/8`);
  assert.equal(huntRate(game, 'schooner', 3, 'perfect', 'orca', 5, 4, 6, 40).wins, 0, 'two levels up');
  assert.equal(huntRate(game, 'brig', 6, 'average', 'sperm_whale', 8, 1, 6, 40).wins, 0, 'a sperm whale two levels up');
  const sharks = huntRate(game, 'sloop', 2, 'average', 'shark', 2, 3, 6, 40);
  assert.ok(sharks.wins >= 5, `sharks: ${sharks.wins}/6`);
});
