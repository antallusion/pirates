// The personal island's balance (docs/15 item 8): the targets of a captain's weeks with her island, asserted on the
// simulation of island.ts (the full report: node tools/balance-island.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NORMAL, NO_GUARD, bestYield, daysTo, raidDays, seaHour, simulate } from './island.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../../shared/src/data/estate.ts';
import { LOSS_DAY_CAP, isleTax } from '../../shared/src/data/baseclaim.ts';
import { ISLE_POWER, OWN_PARITY, combatWorth, hiredWorth, hullFor, ownParity, roleLevels } from '../../shared/src/data/baseships.ts';
import type { IslandBiome } from '../../shared/src/world/regions.ts';
import { STEADY, daysToHall, simulateTree } from './isletree.ts';

const BIOMES: IslandBiome[] = ['temperate', 'mossy', 'volcanic', 'ice', 'ruins', 'bone', 'barren', 'jungle', 'mangrove', 'atoll', 'saltflat', 'blacksand', 'fungal', 'crystal'];

// docs/29 (owner, 2026-10-11): the island's level follows its town hall now, and the hall is raised along the tree —
// the old pace of the island's ten levels on their own silver and goods (ISLE_LEVELS' steps) is the tree's pace to the
// hall's five (tests/balance/isletree.ts; the tree's own walk: tests/isletree.test.ts).
test('the hall comes at the pace of the plan: hall 2 in a few days, hall 3 in about a week, hall 5 in three to four weeks', () => {
  const r = simulateTree(STEADY);
  const d = (l: number) => daysToHall(r, l);
  // (owner, 2026-10-28: the first two levels of everything next to free, the third smoothed — startcost.ts: hall 2 on
  // the first day, hall 3 in a few, hall 5 in under three weeks of steady play)
  assert.ok(d(2) >= 0.5 && d(2) <= 4, `hall 2 on day ${d(2).toFixed(1)}`);
  assert.ok(d(3) >= 2 && d(3) <= 10, `hall 3 on day ${d(3).toFixed(1)}`);
  assert.ok(d(5) >= 15 && d(5) <= 30, `hall 5 on day ${d(5).toFixed(1)}`);
  for (let l = 3; l <= 5; l++) assert.ok(d(l) > d(l - 1), `hall ${l} after ${l - 1}`);
  // Light play is slower, heavy play faster, but even unlimited silver waits on the builders: no hall 5 in a week.
  const light = simulateTree({ ...STEADY, hours: 1.5, days: 90 }), heavy = simulateTree({ ...STEADY, hours: 5 });
  assert.ok(daysToHall(light, 5) > d(5) && daysToHall(heavy, 5) < d(5));
  const rich = simulateTree({ ...STEADY, hours: 12, share: 1, shipLevel: 10 });
  assert.ok(daysToHall(rich, 5) >= 9, `rich: hall 5 on day ${daysToHall(rich, 5).toFixed(1)}`);
  // A poor land keeps near the same pace (its timber bought in port).
  assert.ok(Math.abs(daysToHall(simulateTree({ ...STEADY, biome: 'bone' }), 5) - d(5)) <= 4);
});

test('speed-ups save hours, not weeks: the tree is paced by silver, goods and the builders', () => {
  const rushed = simulateTree({ ...STEADY, rush: true }), plain = simulateTree(STEADY);
  for (let l = 2; l <= 5; l++) assert.ok(Math.abs(daysToHall(rushed, l) - daysToHall(plain, l)) <= 2, `hall ${l}: ${daysToHall(rushed, l).toFixed(1)} rushed, ${daysToHall(plain, l).toFixed(1)} not`);
  assert.ok(rushed.spent.speedup > 0 && rushed.spent.speedup < rushed.earned * 0.08, `speed-ups ${Math.round(rushed.spent.speedup)} of ${Math.round(rushed.earned)}`);
});

test('the island is a long-term base, not the best money: its best yield by the hour never beats an hour at sea', () => {
  for (let l = 1; l <= ISLE_MAX; l++) {
    for (const biome of BIOMES) {
      const y = bestYield(l, biome, 'large');
      assert.ok(y < seaHour(l) * 0.6, `level ${l} on ${biome}: ${Math.round(y)} an hour against ${seaHour(l)} at sea`);
    }
  }
});

test('tax in safe water stays under 30% of what the island itself yields at that level', () => {
  const r = simulate(NORMAL);
  for (let l = 2; l <= ISLE_MAX; l++) {
    if (!Number.isFinite(r.at[l])) continue;
    const week = r.yieldAt[l] * 24 * 7;
    assert.ok(isleTax('safe', l) <= 0.3 * week, `level ${l}: tax ${isleTax('safe', l)} against a week's yield of ${Math.round(week)}`);
  }
});

test('raids: an undefended lawless island loses no more than the daily cap, and guns and ships cut the losses', () => {
  for (const l of [1, 3, 5, 10]) {
    const bare = raidDays('lawless', l, NO_GUARD, 600);
    assert.ok(bare.max <= LOSS_DAY_CAP + 1e-9, `level ${l}: the worst day took ${(bare.max * 100).toFixed(1)}%`);
    assert.ok(bare.mean > 0.05, 'a fat lawless island is worth the raiders’ while');
    for (const w of ['contested', 'lawless'] as const) {
      if (l < 3) continue; // a fort before the third level is not to be had
      const none = raidDays(w, l, NO_GUARD, 600);
      const guns = raidDays(w, l, { battery: Math.min(5, l), fort: 0, ship: 0 }, 600);
      const all = raidDays(w, l, { battery: Math.min(5, l), fort: Math.max(1, Math.min(5, l - 3)), ship: Math.max(1, l) }, 600);
      assert.ok(guns.mean < none.mean && all.mean < guns.mean, `${w} ⚓${l}: ${none.mean.toFixed(3)} > ${guns.mean.toFixed(3)} > ${all.mean.toFixed(3)}`);
      // A full defence (a battery at the island's level, a fort, her own ship at home) halves the losses in
      // contested water, and near enough in lawless, where the raiders come half again as strong.
      assert.ok(all.mean <= none.mean * (w === 'lawless' ? 0.55 : 0.5), `${w} ⚓${l}: ${all.mean.toFixed(3)} of ${none.mean.toFixed(3)}`);
    }
    // Contested water is kinder than lawless.
    assert.ok(raidDays('contested', l, NO_GUARD, 600).mean < bare.mean);
  }
});

test('a warship of her own is worth about one hired escort of her level, never more than 1.3', () => {
  for (const l of roleLevels('war')) {
    const c = hullFor('war', l);
    const p = ownParity(c, l);
    const ratio = (combatWorth(c, l) * p * p) / hiredWorth(l);
    assert.ok(ratio >= 0.9 && ratio <= OWN_PARITY + 0.01, `⚓${l} ${c}: ${ratio.toFixed(2)} hired escorts`);
  }
  assert.equal(hullFor('war', 6), 'brig', 'the frigate only from ⚓8');
  assert.equal(hullFor('war', 8), 'frigate');
  assert.ok(ownParity('frigate', 8) < 1 && ownParity('brig', 6) === 1);
});

test('docs/17 H3 on the tree (docs/29): the town hall\'s daily silver is a real but small part of the island\'s money', () => {
  const r = simulateTree(STEADY);
  // (the cheap start, owner 2026-10-28: the sea's share asked of her is smaller, the hall's part of it larger)
  assert.ok(r.hallIncome > 0 && r.hallIncome < (r.earned * STEADY.share) * 0.75, `the hall brought ${Math.round(r.hallIncome)} of ${Math.round(r.earned * STEADY.share)}`);
  const heavy = simulateTree({ ...STEADY, hours: 5 });
  assert.ok(daysToHall(heavy, 5) >= 14, `heavy play: hall 5 on day ${daysToHall(heavy, 5).toFixed(1)}`);
});
