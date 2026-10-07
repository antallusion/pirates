// docs/24 B3: the cannon's dead the fewest hit points a man first keep the boarding after a cannonade where it was —
// the same hit points of men fall to a ball (the old reckoning's), so the strength left and the captain's chance in the
// boarding move only within the dice. (The sea fight's own pace, docs/23 «≤ 30 s», is tools/mobile/fight-time.ts; the
// ladder's duels are tests/balance/ladder.test.ts; the battle without a cannonade is untouched by the rule.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyForLevel, armyPower } from '../../shared/src/data/army.ts';
import { cannonade } from './b3.ts';
import type { LossRule } from './b3.ts';
import { winRate } from './recruit.ts';

test('B3: after the same cannonade the strength left and the boarding chance stay where the old rule had them', () => {
  for (const L of [3, 5, 7]) {
    const by = (rule: LossRule) => {
      let w = 0, pc = 0, pp = 0;
      for (let r = 0; r < 3; r++) {
        const c = cannonade(L, 'player', rule, 11 + r), p = cannonade(L, 'pirate', rule, 101 + r);
        w += winRate(c, p, 60) / 3;
        pc += armyPower(c) / armyPower(armyForLevel(L, 120, 7, 'player')) / 3;
        pp += armyPower(p) / armyPower(armyForLevel(L, 120, 7, 'pirate')) / 3;
      }
      return { w, pc, pp };
    };
    const old = by('old'), hp = by('hp');
    assert.ok(Math.abs(hp.pc - old.pc) < 0.06 && Math.abs(hp.pp - old.pp) < 0.06, `⚓${L}: strength left ${(old.pc * 100).toFixed(0)}/${(old.pp * 100).toFixed(0)}% → ${(hp.pc * 100).toFixed(0)}/${(hp.pp * 100).toFixed(0)}%`);
    assert.ok(Math.abs(hp.w - old.w) <= 0.12, `⚓${L}: the captain's boarding chance ${(old.w * 100).toFixed(0)}% → ${(hp.w * 100).toFixed(0)}%`);
  }
});
