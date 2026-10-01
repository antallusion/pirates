// The lairs of the land's creatures against the sea's income (docs/18 II item 24; the numbers of tests/balance/lairs.ts,
// the full report: node tools/balance-lairs.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyMen } from '../../shared/src/data/army.ts';
import { LAIRS, LAIR_KINDS, LAIR_LOSS, LAIR_REFILL, LAIR_SIZES, lairArmy } from '../../shared/src/data/lairs.ts';
import type { LairKind, LairSize } from '../../shared/src/data/lairs.ts';
import { calibrateRefill, lairFight, lairOdds, lairWorth, levelsOf } from './lairs.ts';

/** The sizes a kind of lair is ever stood at: a shore lair any, a grotto and a guardian strong. */
const stood = (k: LairKind): LairSize[] => (LAIRS[k].role === 'shore' ? LAIR_SIZES : ['strong']);

test('a lair costs a captain of its level what its size says: 12 / 30 / 60% of the men she lands', () => {
  for (const kind of LAIR_KINDS) {
    for (const L of levelsOf(kind)) {
      if (LAIRS[kind].role === 'guardian' && L < 6) continue; // a guardian stands a level over its island (⚓5 and up)
      for (const size of stood(kind)) {
        const f = lairFight(kind, L, size);
        assert.ok(Math.abs(f.loss - LAIR_LOSS[size]) <= (size === 'strong' ? 0.23 : 0.13), `${kind} ${size} ⚓${L}: loses ${Math.round(f.loss * 100)}% (target ${LAIR_LOSS[size] * 100}%)`);
        if (size === 'weak') assert.ok(f.win >= 0.95, `${kind} weak ⚓${L}: wins ${f.win}`);
        if (size === 'avg') assert.ok(f.win >= 0.85, `${kind} avg ⚓${L}: wins ${f.win}`);
        if (size === 'strong') assert.ok(f.win >= 0.45, `${kind} strong ⚓${L}: wins ${f.win}`);
      }
    }
  }
});

test('a lair pays a fifth to three tenths of an hour at sea over the men it costs, at every level', () => {
  const all: number[] = [];
  for (let L = 1; L <= 10; L++) {
    const kinds = LAIR_KINDS.filter((k) => LAIRS[k].role === 'shore' && L >= LAIRS[k].lv[0] && L <= LAIRS[k].lv[1]);
    const hours = kinds.map((k) => lairWorth(k, L, 'avg').hours);
    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    all.push(mean);
    assert.ok(mean >= 0.18 && mean <= 0.34, `⚓${L}: an average shore lair nets ${mean.toFixed(2)} sea hours`);
    for (const [i, h] of hours.entries()) assert.ok(h >= 0.12 && h <= 0.45, `${kinds[i]} ⚓${L}: ${h.toFixed(2)} sea hours`);
  }
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  assert.ok(m >= 0.2 && m <= 0.3, `the sea over: ${m.toFixed(2)} sea hours`);
});

test('LAIR_REFILL is what the battle ashore measures; the lairs grow with their waters', () => {
  const r = calibrateRefill();
  for (let L = 1; L <= 10; L++) assert.ok(Math.abs(LAIR_REFILL[L] - r[L]) <= Math.max(120, 0.25 * LAIR_REFILL[L]), `⚓${L}: ${LAIR_REFILL[L]} against ${r[L]} measured`);
  for (const kind of LAIR_KINDS) {
    const lv = levelsOf(kind);
    assert.ok(armyMen(lairArmy(kind, lv[lv.length - 1], 'avg')) >= armyMen(lairArmy(kind, lv[0], 'avg')), `${kind} grows`);
  }
});

test('HoMM3\'s offer (×3) takes a party well above the level\'s usual: the reference captain fights the average lairs', () => {
  for (const kind of LAIR_KINDS) for (const L of levelsOf(kind)) assert.ok(lairOdds(kind, L, 'avg') < 3, `${kind} ⚓${L}: ×${lairOdds(kind, L, 'avg').toFixed(2)}`);
});
