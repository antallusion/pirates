// The personal island's balance (docs/15 item 8): the targets of a captain's weeks with her island, asserted on the
// simulation of island.ts (the full report: node tools/balance-island.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NORMAL, NO_GUARD, bestYield, daysTo, raidDays, seaHour, simulate } from './island.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../../shared/src/data/estate.ts';
import { LOSS_DAY_CAP, isleTax } from '../../shared/src/data/baseclaim.ts';
import { ISLE_POWER, OWN_PARITY, combatWorth, hiredWorth, hullFor, ownParity, roleLevels } from '../../shared/src/data/baseships.ts';
import type { IslandBiome } from '../../shared/src/world/regions.ts';

const BIOMES: IslandBiome[] = ['temperate', 'mossy', 'volcanic', 'ice', 'ruins', 'bone', 'barren', 'jungle', 'mangrove', 'atoll', 'saltflat', 'blacksand', 'fungal', 'crystal'];

test('island levels come at the pace of the plan: level 3 in a day or two, level 5 in about a week, level 10 in weeks', () => {
  const r = simulate(NORMAL);
  const d = (l: number) => daysTo(r, l);
  assert.ok(d(3) >= 0.5 && d(3) <= 2, `level 3 on day ${d(3).toFixed(1)}`);
  assert.ok(d(5) >= 5 && d(5) <= 9, `level 5 on day ${d(5).toFixed(1)}`);
  assert.ok(d(10) >= 28 && d(10) <= 70, `level 10 on day ${d(10).toFixed(1)}`);
  for (let l = 3; l <= ISLE_MAX; l++) assert.ok(d(l) > d(l - 1), `level ${l} after ${l - 1}`);
  // Each level asks more than the last: silver, power and planks.
  for (let l = 3; l <= ISLE_MAX; l++) {
    assert.ok(ISLE_LEVELS[l].silver > ISLE_LEVELS[l - 1].silver, `silver of level ${l}`);
    assert.ok((ISLE_LEVELS[l].goods.planks ?? 0) >= (ISLE_LEVELS[l - 1].goods.planks ?? 0), `planks of level ${l}`);
    assert.ok(ISLE_POWER[l] > ISLE_POWER[l - 1]);
  }
  // A poor land and a rich one keep near the same pace (within three days to level 5); light play is slower,
  // heavy play faster, but neither reaches level 10 inside three weeks.
  for (const biome of ['bone', 'jungle'] as IslandBiome[]) assert.ok(Math.abs(daysTo(simulate({ ...NORMAL, biome, days: 12 }), 5) - d(5)) <= 3, biome);
  const light = simulate({ ...NORMAL, hours: 1.5, days: 20 }), heavy = simulate({ ...NORMAL, hours: 5 });
  assert.ok(daysTo(light, 5) > d(5) && daysTo(heavy, 5) < d(5));
  assert.ok(daysTo(heavy, 10) >= 21, `heavy play: level 10 on day ${daysTo(heavy, 10).toFixed(1)}`);
});

test('speed-ups save hours, not weeks: the island is paced by silver and goods', () => {
  const rushed = simulate({ ...NORMAL, rush: true }), plain = simulate(NORMAL);
  for (let l = 2; l <= ISLE_MAX; l++) assert.ok(Math.abs(daysTo(rushed, l) - daysTo(plain, l)) <= 1.5, `level ${l}: ${daysTo(rushed, l).toFixed(1)} rushed, ${daysTo(plain, l).toFixed(1)} not`);
  assert.ok(rushed.spent.speedup > 0 && rushed.spent.speedup < rushed.earned * 0.05, `speed-ups ${Math.round(rushed.spent.speedup)} of ${Math.round(rushed.earned)}`);
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

test('docs/17 H3: the town hall\'s daily silver keeps the island\'s pace — level 5 in about a week, level 10 in weeks', () => {
  const r = simulate({ ...NORMAL, town: true });
  assert.ok(daysTo(r, 5) >= 5 && daysTo(r, 5) <= 9, `level 5 on day ${daysTo(r, 5).toFixed(1)}`);
  assert.ok(daysTo(r, 10) >= 28 && daysTo(r, 10) <= 70, `level 10 on day ${daysTo(r, 10).toFixed(1)}`);
  assert.ok((r.townIncome ?? 0) > 0 && (r.townIncome ?? 0) < r.earned * 0.15, `the hall brought ${Math.round(r.townIncome ?? 0)} of ${Math.round(r.earned)}`);
  const heavy = simulate({ ...NORMAL, hours: 5, town: true });
  assert.ok(daysTo(heavy, 10) >= 21, `heavy play with the hall: level 10 on day ${daysTo(heavy, 10).toFixed(1)}`);
});
