// The Heroes' economy against the sea's income (docs/17 H3): the dwellings' weeks against the hour at sea and the
// hammocks, and a captain's month refilling her losses from her island (the numbers of tests/balance/recruit.ts; the
// full report: node tools/balance-recruit.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, armyForLevel, armyMen } from '../../shared/src/data/army.ts';
import { PICKED_TIER, POOL_WEEKS, TIER_UNIT, pickedShare, recruitPrice } from '../../shared/src/data/town.ts';
import { PVE_JUNIOR, PVE_SENIOR, ladder } from '../../shared/src/data/shiplevel.ts';
import { generateWorld } from '../../shared/src/world/worldgen.ts';
import { seaHour } from './island.ts';
import { MONTH, WEEK_HOURS, isleWeek, month, portWeek, winRate } from './recruit.ts';

test('a man costs what the sea reckons him worth; the week is an evening\'s play and a pool keeps two weeks', () => {
  for (const u of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
    assert.equal(recruitPrice(u, 1, false).silver, UNITS[u].cost, u);
    assert.equal(recruitPrice(u, 4, true).silver, Math.round(4 * UNITS[u].cost * 1.25), u);
  }
  assert.ok(Math.abs(WEEK_HOURS - 5.6) < 1e-9, `a week of ${WEEK_HOURS} real hours`);
  assert.equal(POOL_WEEKS, 2);
});

test('a week of the island\'s dwellings is worth half an hour at sea at ⚓6 (a castle an hour); it stays a real expense to ⚓9', () => {
  const keep = isleWeek(1, 6), castle = isleWeek(3, 6);
  assert.ok(keep.worth / seaHour(6) >= 0.35 && keep.worth / seaHour(6) <= 0.7, `keep: ${Math.round(keep.worth)} a week, ${(keep.worth / seaHour(6)).toFixed(2)} sea hours`);
  assert.ok(castle.worth / seaHour(6) >= 0.7 && castle.worth / seaHour(6) <= 1.4, `castle: ${(castle.worth / seaHour(6)).toFixed(2)} sea hours`);
  assert.ok(castle.worth / seaHour(9) >= 0.3, 'still worth buying at ⚓9');
  // Gold is not made trivial: a captain who looks in once a day and takes her two weeks of a castle spends about
  // three hours' income at ⚓6 on them — the day's whole session.
  assert.ok((POOL_WEEKS * castle.worth) / (3 * seaHour(6)) >= 0.5, 'the castle\'s men take a good share of a day\'s income');
});

test('the army does not balloon: a week\'s men are a third of a brig\'s hammocks; the picked men are held by the ship\'s level', () => {
  const w = isleWeek(1, 7);
  assert.ok(w.men >= 0.25 * 110 && w.men <= 0.4 * 110, `${w.men} men a week`);
  assert.ok(w.high <= 12, `${w.high} of tier 4 and up a week`);
  const world = generateWorld(1);
  for (const p of world.ports) {
    const r = portWeek(p);
    assert.ok(r.worth <= 1.3 * seaHour(6), `${p.id}: ${Math.round(r.worth)} a week`);
  }
  assert.ok(pickedShare(1) < 0.2 && pickedShare(7) > 0.3 && pickedShare(10) <= 0.45);
  assert.equal(PICKED_TIER, 4);
  void TIER_UNIT;
});

test('a month refilling a frigate from a castle: a real share of the income, the hammocks full, better men than the sea\'s — and the ladder still holds', () => {
  const r = month(MONTH);
  const L = MONTH.level, M = MONTH.crewMax;
  assert.equal(armyMen(r.army), M, 'the hammocks full');
  assert.ok(r.spent / r.earned >= 0.25 && r.spent / r.earned <= 0.55, `spent ${Math.round((r.spent / r.earned) * 100)}% of the income`);
  assert.ok(r.highShare <= pickedShare(L) + 0.01, `picked men ${Math.round(r.highShare * 100)}%`);
  const end = r.ratio[r.ratio.length - 1];
  assert.ok(end >= 1.5 && end <= 5, `might ×${end.toFixed(2)} of the ladder's army`);
  // Her town is worth having: her crew takes a pirate of her level; the ladder's own crew is an even fight.
  const lad = armyForLevel(L, M, 7, 'player');
  const even = winRate(lad, armyForLevel(L, M, 7, 'pirate'));
  assert.ok(even >= 0.3 && even <= 0.7, `the ladder's crew against a pirate of her level: ${even}`);
  assert.ok(winRate(r.army, armyForLevel(L, M, 7, 'pirate')) >= 0.9, 'the town-bred crew wins');
  // Canon D12: two levels up is not boarded at all; one level up under the ladder is hard for a keep's crew.
  assert.equal(ladder(L, L + 2, false).board, false);
  const keep = month({ ...MONTH, keep: 1 });
  assert.ok(winRate(keep.army, armyForLevel(L + 1, M, 7, 'pirate'), 40, PVE_JUNIOR[1], PVE_SENIOR[1]) <= 0.7, 'a keep\'s crew against ⚓+1 under the ladder');
});
