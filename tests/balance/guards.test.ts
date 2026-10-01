// The adventure map against the sea's income (docs/17 H4; the numbers of tests/balance/guards.ts, the full report:
// node tools/balance-guards.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARD_LOSS, GUARD_REFILL, GUARD_SIZES, chestPay, guardArmy, guardPay } from '../../shared/src/data/advmap.ts';
import { armyMen } from '../../shared/src/data/army.ts';
import { seaHour } from './island.ts';
import { guardFight, guardedChest, kindsAt, offerArmy } from './guards.ts';

test('a guard costs a captain of its level what its size says: weak an easy win, average a real price, strong an even fight', () => {
  for (let L = 1; L <= 10; L++) {
    for (const kind of kindsAt(L)) {
      for (const size of GUARD_SIZES) {
        const f = guardFight(kind, L, size);
        // (A strong pack of a few great beasts moves in whole beasts: its fight is the coarsest.)
        assert.ok(Math.abs(f.loss - GUARD_LOSS[size]) <= (size === 'strong' ? 0.22 : 0.12), `${kind} ${size} ⚓${L}: loses ${Math.round(f.loss * 100)}% (target ${GUARD_LOSS[size] * 100}%)`);
        if (size === 'weak') assert.ok(f.win >= 0.95, `${kind} weak ⚓${L}: wins ${f.win}`);
        if (size === 'avg') assert.ok(f.win >= 0.85, `${kind} avg ⚓${L}: wins ${f.win}`);
        if (size === 'strong') assert.ok(f.win >= 0.45 && f.lostWin >= 0.35, `${kind} strong ⚓${L}: wins ${f.win}, loses ${f.lostWin}`);
      }
    }
  }
});

test('the guards grow with their waters; their word «стая / толпа / орда» follows their number', () => {
  for (let L = 2; L <= 10; L++) assert.ok(armyMen(guardArmy('holdout', L, 'avg')) >= armyMen(guardArmy('holdout', L - 1, 'avg')), `⚓${L}`);
  assert.ok(armyMen(guardArmy('holdout', 1, 'avg')) < 20 && armyMen(guardArmy('holdout', 10, 'avg')) > 100, 'a pack in the home waters, a throng in the deep ones');
  assert.ok(armyMen(guardArmy('beasts', 8, 'avg')) < armyMen(guardArmy('holdout', 8, 'avg')) / 4, 'a few beasts weigh as much as a crowd');
});

test('a guarded chest pays a quarter of an hour at sea over the men its guard costs, at every level; an unguarded one less', () => {
  for (let L = 1; L <= 10; L++) {
    const c = guardedChest(L);
    assert.ok(c.hours >= 0.12 && c.hours <= 0.45, `⚓${L}: net ${c.net} = ${c.hours.toFixed(2)} sea hours`);
    assert.ok(chestPay(L, false).silver <= seaHour(L) * 0.2, `⚓${L}: an open chest ${chestPay(L, false).silver}`);
    assert.ok(guardPay(L, 'avg').silver < c.refill, `⚓${L}: a guard alone is not a profit`);
    assert.ok(Math.abs(GUARD_REFILL[L] - c.refill) <= Math.max(120, 0.25 * GUARD_REFILL[L]), `⚓${L}: GUARD_REFILL ${GUARD_REFILL[L]} against ${c.refill} measured`);
  }
});

test('HoMM3\'s offer takes an army well above her level\'s usual: the reference captain fights the average guards', () => {
  for (const L of [1, 3, 5, 7, 9]) for (const kind of kindsAt(L)) assert.ok(offerArmy(L, kind, 'avg') > 1, `${kind} ⚓${L}: ×${offerArmy(L, kind, 'avg').toFixed(2)}`);
});
