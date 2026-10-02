// docs/19 D1–D4: the doubled sea's income an hour from the sources it doubled, before and after, with the caps that
// keep it (tests/balance/density.ts; the full table: node tools/balance-density.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seaHourIncome } from './density.ts';

test('an hour at sea from the doubled sources: within a quarter (or so) of before, with the caps; never below it', () => {
  for (const way of ['all', 'gleaner'] as const) {
    for (const L of [2, 5, 8]) {
      for (const H of [1, 2, 4]) {
        const before = seaHourIncome(L, H, 'before', 12, way).total;
        const after = seaHourIncome(L, H, 'after', 12, way).total;
        const capped = seaHourIncome(L, H, 'capped', 12, way).total;
        const r = capped / before;
        assert.ok(r >= 0.95 && r <= 1.3, `${way} ⚓${L} ${H} h: ${before} → ${capped} (×${r.toFixed(2)}; uncapped ×${(after / before).toFixed(2)})`);
        if (way === 'gleaner') assert.ok(after / before > 1.25, `the caps are what keeps the gleaner's: uncapped ×${(after / before).toFixed(2)}`);
      }
    }
  }
});
