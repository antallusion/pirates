// A guard hired at sea makes a fight of her level noticeably easier, but not a walk-over (owner, 2026-10-25;
// tests/balance/seahire.ts has the table: node tests/balance/seahire.ts 8). Against an elite (a ship built for a company)
// the guard does a third of her damage (combat.ts HIRED_VS_ELITE) and breaks off at half her hull (npc.ts
// HIRE_BREAK_OFF): she helps her captain win, the captain still pays for it. 24 fights a side: the six of before swung
// from 24 % to 98 % of her hull lost with the sea's stream.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardTable } from './seahire.ts';

test('⚓5: a hired guard of her ⚓ — an elite beaten far more often, at a heavy cost; a rover with less of her hull lost', () => {
  const elite = guardTable([5], 24, [{ gear: 'level', elite: true }]);
  const solo = elite.find((r) => !r.guard)!, guard = elite.find((r) => r.guard)!;
  // (owner 2026-10-26: NPC HP ×0.5 — the elite is halved too: alone she wins 18/24 now, so «far more often» is every
  // fight or near it; was solo + 8.)
  console.log(`an elite: ${guard.wins}/24 with, ${solo.wins}/24 alone; ${guard.meanLost.toFixed(2)} of her hull lost`);
  assert.ok(guard.wins >= Math.min(23, solo.wins + 4), `an elite: ${guard.wins}/24 with, ${solo.wins}/24 alone`);
  assert.ok(guard.meanLost >= 0.15 && guard.meanLost <= 0.8, // (0.31 on the cut's commit; was ≥ 0.45)
    `not a walk-over: ${guard.meanLost.toFixed(2)} of her hull lost on average`);
  const rover = guardTable([5], 6, [{ gear: 'full', elite: false }]);
  const r0 = rover.find((r) => !r.guard)!, r1 = rover.find((r) => r.guard)!;
  assert.equal(r1.wins, 6, 'a full build still wins with her guard');
  assert.ok(r1.meanLost < r0.meanLost, `her hull lost to a rover: ${r1.meanLost.toFixed(2)} with the guard, ${r0.meanLost.toFixed(2)} alone`);
});
