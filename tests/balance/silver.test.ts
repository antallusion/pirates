// docs/31 §9 (owner, 2026-10-17: «золота очень много за все дается, слишком легко фармить, надо урезать»): the silver of
// an hour's play by level band (the model tests/balance/silver.ts; node tools/balance-silver.ts). Farming is a good deal
// harder — the mixed hour's net a third of what it was or less — yet every band still gains, the refits ask hours, not
// minutes, and no loop of the sea's ordinary work pays more than two hours at sea in one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SILVER, LEGACY_SILVER, SILVER_BANDS, bandLevel, boardSilver, hoursFor, lairSilver, mixedSilver, nextRefit, styleSilver } from './silver.ts';
import { hourSilver, shipBandOf } from '../../shared/src/data/xpcurve.ts';

test('the mixed hour: its net a third of the old or less at every band, yet never nothing (no dead end)', () => {
  for (const b of SILVER_BANDS) {
    const L = bandLevel(b);
    const before = mixedSilver(LEGACY_SILVER, L), after = mixedSilver(CURRENT_SILVER, L);
    assert.ok(after.net <= 0.4 * before.net, `${b[0]}–${b[1]}: net ${Math.round(after.net)} against ${Math.round(before.net)} before`);
    assert.ok(after.hours >= 0.1 && after.hours <= 1.6, `${b[0]}–${b[1]}: net ${after.hours.toFixed(2)} hours at sea an hour`);
    assert.ok(after.income > after.costs, `${b[0]}–${b[1]}: she pays her way`);
  }
});

test('the loops that were cheapest to repeat pay least: a boarding hour at most two hours at sea, the lairs about half of one', () => {
  for (const b of SILVER_BANDS) {
    const L = bandLevel(b), sea = hourSilver(shipBandOf(L));
    const board = boardSilver(CURRENT_SILVER, L), old = boardSilver(LEGACY_SILVER, L);
    assert.ok(board.income - board.costs <= 2 * sea, `${b[0]}–${b[1]}: boarding nets ${((board.income - board.costs) / sea).toFixed(2)} sea hours`);
    assert.ok(board.income <= 0.5 * old.income, `${b[0]}–${b[1]}: boarding brings in ${Math.round(board.income)} against ${Math.round(old.income)}`);
    const lairs = lairSilver(CURRENT_SILVER, L);
    assert.ok(lairs.income <= 0.6 * sea, // (six lairs an hour within the haul: 0.54, was 0.9)
      `${b[0]}–${b[1]}: the lairs bring ${(lairs.income / sea).toFixed(2)} sea hours`);
    // The stacks back to back about pay for their men (and her wages): never a fortune.
    const st = styleSilver(CURRENT_SILVER, 'stacks', L);
    assert.ok(st.income - st.costs <= 0.1 * sea, `${b[0]}–${b[1]}: the stacks net ${((st.income - st.costs) / sea).toFixed(2)}`);
  }
});

test('the refit to the next ⚓ asks real time — from most of an hour at the first band to a long evening and more at the top — and stays within reach', () => {
  for (const b of SILVER_BANDS) {
    const L = bandLevel(b), refit = nextRefit(L);
    if (!refit) continue;
    const h = hoursFor(CURRENT_SILVER, L, refit), was = hoursFor(LEGACY_SILVER, L, refit);
    assert.ok(h >= 2.5 * was, `${b[0]}–${b[1]}: ${h.toFixed(1)} h (was ${was.toFixed(1)})`);
    assert.ok(h >= 0.5 && h <= 20, `${b[0]}–${b[1]}: the refit of ${refit} in ${h.toFixed(1)} h`);
  }
});
