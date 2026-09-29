// The balance of a captain's holdings and hulls at sea (docs/12 P12): outposts earn more than they cost at every
// level and in every water, each level pays for itself within a fortnight of hauling, raids take a small share;
// caravans need escorts in rough water, and escorts, levels and running for it each count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAIM_DAYS, GUARDS, OUTPOSTS, OUTPOST_KINDS, OUTPOST_MAX_LEVEL, RAID_DAY, claimCost, outpostCap, outpostRate, outpostUpgrade } from '../../shared/src/data/estate.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { MAX_ESCORTS, RISK, defenceOdds } from '../../shared/src/data/caravans.ts';

const worth = (goods: Partial<Record<GoodId, number>>) => Object.entries(goods).reduce((a, [g, n]) => a + GOODS[g as GoodId].basePrice * (n ?? 0), 0);
/** What an outpost yields in a day when its store is hauled twice (the store caps what waits). */
const day = (k: (typeof OUTPOST_KINDS)[number], level: number) => Math.min(outpostRate(k, level) * 24, outpostCap(k, level) * 2) * GOODS[OUTPOSTS[k].good].basePrice;

test('every outpost earns more than it costs, at every level, in every water', () => {
  for (const k of OUTPOST_KINDS) {
    for (let lv = 1; lv <= OUTPOST_MAX_LEVEL; lv++) {
      for (const safety of ['safe', 'contested', 'lawless'] as const) {
        const claim = claimCost(safety) / CLAIM_DAYS;
        // A raid a day by the waters, the kind's risk, a militia on guard, half the store full, half of it taken.
        const raids = RAID_DAY[safety] * OUTPOSTS[k].risk * GUARDS.militia.chance * outpostCap(k, lv) * 0.5 * 0.45 * GOODS[OUTPOSTS[k].good].basePrice;
        const net = day(k, lv) - claim - raids;
        assert.ok(net > day(k, lv) * 0.4, `${k} ⚓${lv} in ${safety} water: ${Math.round(net)} a day of ${Math.round(day(k, lv))}`);
      }
    }
  }
});

test('each level of an outpost pays for itself within a fortnight of hauling, and none in under a day and a half', () => {
  for (const k of OUTPOST_KINDS) {
    for (let lv = 1; lv < OUTPOST_MAX_LEVEL; lv++) {
      const up = outpostUpgrade(lv, k);
      const cost = up.silver + worth(up.goods);
      const days = cost / (day(k, lv + 1) - day(k, lv));
      assert.ok(days >= 1.5 && days <= 16, `${k} ⚓${lv}→${lv + 1}: ${days.toFixed(1)} days`);
    }
  }
});

test('caravans against pirates: rough water wants escorts; escorts, levels and running each count', () => {
  const at = (escorts: number, ships: number, gap: number, flee = false) => defenceOdds({ escorts, ships, level: 5 + gap, band: 5, flee });
  // Alone in the pirates' band a caravan is easy meat; with a full escort it beats most of them off.
  assert.ok(at(0, 2, 0) < 0.35, `no escort: ${at(0, 2, 0).toFixed(2)}`);
  assert.ok(at(MAX_ESCORTS, 2, 0) >= 0.6, `a full escort: ${at(MAX_ESCORTS, 2, 0).toFixed(2)}`);
  for (let e = 0; e < MAX_ESCORTS; e++) assert.ok(at(e + 1, 2, 0) - at(e, 2, 0) >= 0.05, `the ${e + 1}th escort counts`);
  assert.ok(at(2, 2, 1) > at(2, 2, 0) && at(2, 2, 0) > at(2, 2, -1), 'a level above the waters counts');
  assert.ok(at(2, 2, 0, true) > at(2, 2, 0), 'running for it counts');
  // Never a sure thing either way.
  assert.ok(at(0, 1, -3) >= 0.1 && at(MAX_ESCORTS, 3, 3, true) <= 0.95);
  // Expected cargo lost in an hour of lawless water, two hulls under two escorts running for it: a small share.
  const flee = at(2, 2, 0, true);
  const lossPerAttack = 0.5 * 0.2 + 0.5 * (1 - 0.5 * 0.7);
  const hour = RISK.lawless * (1 - flee) * lossPerAttack;
  assert.ok(hour < 0.05, `lawless hour: ${(hour * 100).toFixed(1)}% of the cargo`);
});
