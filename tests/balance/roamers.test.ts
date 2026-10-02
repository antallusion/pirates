// docs/19 D7: the roaming stacks against a captain of their level (tests/balance/roamers.ts; the full report:
// node tools/balance-roamers.ts). A road to the levels, not a toll: light losses, a fight she wins.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROAM_KINDS, ROAM_LOSS, ROAM_SIZES, roamCount } from '../../shared/src/data/roamers.ts';
import { roamLevels, stackFight, xpHour } from './roamers.ts';

test('a stack costs a captain of its level what its size says (4 / 8 / 16% of the men she lands), and she wins', () => {
  for (const kind of ROAM_KINDS) {
    for (const L of roamLevels(kind)) {
      for (const size of ROAM_SIZES) {
        const f = stackFight(kind, L, size);
        assert.ok(Math.abs(f.loss - ROAM_LOSS[size]) <= 0.09, `${kind} ${size} ⚓${L} (${roamCount(kind, L, size)}): loses ${Math.round(f.loss * 100)}%`);
        assert.ok(f.win >= 0.95, `${kind} ${size} ⚓${L}: wins ${f.win}`);
      }
    }
  }
});

test('the stacks grow with their waters; the hour by quick combat and played out stays near the target', () => {
  for (const kind of ROAM_KINDS) {
    const lv = roamLevels(kind);
    assert.ok(roamCount(kind, lv[lv.length - 1], 'avg') >= roamCount(kind, lv[0], 'avg'), `${kind} grows`);
  }
  for (let L = 1; L <= 10; L++) {
    const q = xpHour(L, undefined, 12, 'quick'), p = xpHour(L, undefined, 12, 'played');
    assert.ok(q.share >= 0.6 && q.share <= 0.9, `⚓${L} quick: ${Math.round(q.share * 100)}%`);
    assert.ok(p.share >= 0.55 && p.share <= 0.8, `⚓${L} played: ${Math.round(p.share * 100)}%`);
  }
});
