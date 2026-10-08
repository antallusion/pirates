// The beaten who come over (owner, 2026-10-08), against the men a captain loses boarding the ships of her waters
// (tests/balance/join.ts; the report: node tools/balance-join.ts): steady boarding of her waters' trade is about made
// good by them alone, never past her hammocks; warships of her level, an even fight that costs most of a crew, are not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRADE, TRAFFIC, steady } from './join.ts';

test('steady boarding of her waters\' trade: the beaten make good four fifths or more of her losses, never past her hammocks', () => {
  for (const L of [2, 5, 8]) {
    const r = steady(L, TRADE, 6, 0);
    const made = r.joined / Math.max(1e-9, r.lostWon);
    assert.ok(made >= 0.8 && made <= 1.0001, `⚓${L}: ${Math.round(made * 100)}% made good (${r.lostWon.toFixed(1)} lost, ${r.joined.toFixed(1)} came over an hour)`);
    assert.ok(r.crewAfter >= 0.8, `⚓${L}: her crew after two hours ${Math.round(r.crewAfter * 100)}%`);
    assert.equal(r.over, 0, 'never past her hammocks');
  }
});

test('a small share: boarding warships of her level besides, the beaten make good only part of a costly fight', () => {
  const r = steady(5, TRAFFIC, 6, 0);
  const made = r.joined / Math.max(1e-9, r.lostWon);
  assert.ok(made > 0.15 && made < 0.7, `⚓5, the whole traffic: ${Math.round(made * 100)}% made good`);
  assert.equal(r.over, 0);
});
