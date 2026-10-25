// The ladder of strength in real fights (docs/12 §3.6): duels on open water between the sea's fighting mind under
// scripted captains' craft and bots of their level or above. Kept small enough for every run; `npm run balance`
// fights the full tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelSea, winRate } from './duel.ts';

test('even levels: an average captain holds her own against a bot of her level, a perfect one wins most fights', () => {
  const game = duelSea();
  const avg = winRate(game, { cls: 'brig', level: 5, craft: 'average' }, { cls: 'brig', level: 5, craft: 'bot' }, 200, 200);
  const perf = winRate(game, { cls: 'brig', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, 100, 200);
  // The sea's rule (docs/12 §3.6, the bots' craft tuned on it): «бот чуть слабее обычного капитана своего уровня» — an
  // average captain wins a little more than half of her even fights, never most of them by far (docs/23 item 47: her gun
  // captains' wider arc, about seven in ten at the most); a perfect one wins most.
  // (2026-10-22: this asked 40–60 of one hundred, and that hundred sat on its edge — 46 before docs/24 B3, 49 after,
  // 55 under the torn sails' first line, 61 under its fix 62e1b6f9. The share was never 50: over 400 fights it was 66 % on
  // the commit before the torn sails (385d9137~1) and 65 % now, the same within the dice — no rule of the fight changed.
  // Two hundred fights tell it; the window is docs/12's.)
  // (owner 2026-10-26: NPC HP ×0.5 — «режь всем нпс прям на 50% хп»: the sea's ship of her level is no match now; an
  // average captain wins nearly every even fight, 200/200 on the commit of the cut.)
  const share = avg.wins / 200;
  assert.ok(share >= 0.9, `average ${avg.wins}/200`);
  assert.ok(perf.wins >= 90, `perfect ${perf.wins}/100`);
});

test('a level up: a perfect captain wins most fights now (owner 2026-10-26: NPC HP ×0.5); two levels up, now and then at most', () => {
  const game = duelSea();
  let perf = 0;
  // (Three times the fights this test used to fight, the same share asked: 9 of 48 before docs/24 B3 and 11 after
  // sat on the edge of «10 at most»; of these 144, 22 before and 16 after.)
  for (const [cls, lv] of [['sloop', 1], ['brig', 5], ['frigate', 7]] as const) perf += winRate(game, { cls, level: lv, craft: 'perfect' }, { cls, level: lv + 1, craft: 'bot' }, 48, 100).wins;
  // (owner 2026-10-26: NPC HP ×0.5 — a level up is a fight a perfect captain wins most of the time: 118/144 on the cut's
  // commit; was 3–30. An average one wins some, two levels up stays the bot's.)
  assert.ok(perf >= 72, `perfect a level up: ${perf}/144`);
  const avg = winRate(game, { cls: 'brig', level: 5, craft: 'average' }, { cls: 'brig', level: 6, craft: 'bot' }, 16, 100);
  assert.ok(avg.wins <= 13, `average a level up: ${avg.wins}/16`);
  const two = winRate(game, { cls: 'brig', level: 5, craft: 'perfect' }, { cls: 'brig', level: 7, craft: 'bot' }, 16, 100);
  assert.ok(two.wins <= 8, `two levels up: ${two.wins}/16`);
});

test('a merchant never beats a warship of her own level, however well she is fought', () => {
  const game = duelSea();
  const r = winRate(game, { cls: 'fluyt', level: 5, craft: 'perfect' }, { cls: 'brig', level: 5, craft: 'bot' }, 16, 300);
  assert.equal(r.wins, 0, `${r.wins}/16`);
});
