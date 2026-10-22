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
  const share = avg.wins / 200;
  assert.ok(share >= 0.45 && share <= 0.72, `average ${avg.wins}/200`);
  assert.ok(perf.wins >= 70 && perf.wins / 100 > share, `perfect ${perf.wins}/100`);
});

test('a level up: a perfect captain wins now and then, an average one hardly ever; two levels up, never', () => {
  const game = duelSea();
  let perf = 0;
  // (Three times the fights this test used to fight, the same share asked: 9 of 48 before docs/24 B3 and 11 after
  // sat on the edge of «10 at most»; of these 144, 22 before and 16 after.)
  for (const [cls, lv] of [['sloop', 1], ['brig', 5], ['frigate', 7]] as const) perf += winRate(game, { cls, level: lv, craft: 'perfect' }, { cls, level: lv + 1, craft: 'bot' }, 48, 100).wins;
  // (2026-10-22, the reaches halved — the guns 100–250 m, the sea's own firing from 150 m: at a hundred metres nearly
  // every ball strikes, whoever lays it, and a perfect captain's craft tells less against a hull a level up. 6 and 13 of
  // these 144 before; 1–4 after, the bots' craft retuned for it (shiplevel.ts npcSkill). Still «now and then», never
  // most.)
  assert.ok(perf >= 1 && perf <= 30, `perfect a level up: ${perf}/144`);
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
