// A guard hired at sea makes a fight of her level noticeably easier, but not a walk-over (owner, 2026-10-25;
// tests/balance/seahire.ts has the table: node tests/balance/seahire.ts 8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardTable } from './seahire.ts';

test('⚓5: a hired guard of her ⚓ — less of her hull lost to a rover; an elite beaten more often, at a heavy cost', () => {
  const rows = guardTable([5], 6, [{ gear: 'full', elite: false }, { gear: 'level', elite: true }]);
  const row = (elite: boolean, guard: boolean) => rows.find((r) => r.elite === elite && r.guard === guard)!;
  assert.equal(row(false, true).wins, 6, 'a full build still wins with her guard');
  assert.ok(row(false, true).lost < row(false, false).lost, `her hull lost: ${row(false, true).lost} with the guard, ${row(false, false).lost} alone`);
  assert.ok(row(true, true).wins >= row(true, false).wins + 2, `an elite: ${row(true, true).wins}/6 with, ${row(true, false).wins}/6 alone`);
  assert.ok(row(true, true).lost >= 0.5, `not a walk-over: ${row(true, true).lost} of her hull lost`);
});
