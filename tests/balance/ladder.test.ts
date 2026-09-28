// The ladder of strength in real fights (docs/12 §3.6): duels on open water between the sea's fighting mind under
// scripted captains' craft and bots of their level or above. Kept small enough for every run; `npm run balance`
// fights the full tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelSea, winRate } from './duel.ts';

test('even levels: an average captain wins a good share against a bot of her level, a perfect one most', () => {
  const game = duelSea();
  const avg = winRate(game, { cls: 'brig', level: 5, craft: 'average' }, { cls: 'brig', level: 5, craft: 'bot' }, 20, 200);
  const perf = winRate(game, { cls: 'brig', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, 20, 200);
  assert.ok(avg.wins >= 8, `average ${avg.wins}/20`);
  assert.ok(perf.wins >= 13 && perf.wins >= avg.wins, `perfect ${perf.wins}/20`);
});

test('a level up: a perfect captain wins now and then, an average one hardly ever; two levels up, never', () => {
  const game = duelSea();
  let perf = 0;
  for (const [cls, lv] of [['sloop', 1], ['brig', 5], ['frigate', 7]] as const) perf += winRate(game, { cls, level: lv, craft: 'perfect' }, { cls, level: lv + 1, craft: 'bot' }, 16, 100).wins;
  assert.ok(perf >= 1 && perf <= 10, `perfect a level up: ${perf}/48`);
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
