// The ladder of strength in real fights (docs/12 §3.6): duels on open water between the sea's fighting mind under
// scripted captains' craft and bots of their level or above. Kept small enough for every run; `npm run balance`
// fights the full tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelSea, winRate } from './duel.ts';

test('even levels: an average captain holds her own against a bot of her level, a perfect one wins most fights', () => {
  const game = duelSea();
  const avg = winRate(game, { cls: 'brig', level: 5, craft: 'average' }, { cls: 'brig', level: 5, craft: 'bot' }, 100, 200);
  const perf = winRate(game, { cls: 'brig', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, 100, 200);
  // At the pace of the sea the average captain's even fight is an even fight (CLAUDE.md §5: «равный бой — около 50 %»):
  // 46 of these hundred before docs/24 B3, 49 after. The twenty fights this test used to fight sat on their edge (ten
  // won where ten were asked, before B3; nine after) — a hundred tell the share, not the dice.
  assert.ok(avg.wins >= 40 && avg.wins <= 60, `average ${avg.wins}/100`);
  assert.ok(perf.wins >= 70, `perfect ${perf.wins}/100`);
});

test('a level up: a perfect captain wins now and then, an average one hardly ever; two levels up, never', () => {
  const game = duelSea();
  let perf = 0;
  // (Three times the fights this test used to fight, the same share asked: 9 of 48 before docs/24 B3 and 11 after
  // sat on the edge of «10 at most»; of these 144, 22 before and 16 after.)
  for (const [cls, lv] of [['sloop', 1], ['brig', 5], ['frigate', 7]] as const) perf += winRate(game, { cls, level: lv, craft: 'perfect' }, { cls, level: lv + 1, craft: 'bot' }, 48, 100).wins;
  assert.ok(perf >= 3 && perf <= 30, `perfect a level up: ${perf}/144`);
  const avg = winRate(game, { cls: 'brig', level: 5, craft: 'average' }, { cls: 'brig', level: 6, craft: 'bot' }, 16, 100);
  assert.ok(avg.wins <= 2, `average a level up: ${avg.wins}/16`);
  const two = winRate(game, { cls: 'brig', level: 5, craft: 'perfect' }, { cls: 'brig', level: 7, craft: 'bot' }, 16, 100);
  assert.equal(two.wins, 0, 'two levels up');
});

test('a merchant never beats a warship of her own level, however well she is fought', () => {
  const game = duelSea();
  const r = winRate(game, { cls: 'fluyt', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, 16, 300);
  assert.equal(r.wins, 0, `${r.wins}/16`);
});
