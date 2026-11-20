// Forum 118 (Эдуард): the sea's safety net (client/src/render/seaguard.ts) — the costly extras eased only after the
// frames at sea stay slow ~10 s, given back once they stay quick, never see-sawing, never while she is not at sea.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUARD_FAST_FOR, GUARD_MAX, GUARD_SLOW_FOR, SeaGuard, median } from '../client/src/render/seaguard.ts';
import { EN, RU } from '../client/src/lang/ui/seaguard.ts';

/** Frames of `ms` each for `forMs`, from `t0`; returns the time after and every level change. */
function run(g: SeaGuard, ms: number, forMs: number, t0: number, active = true): { t: number; changes: number[] } {
  const changes: number[] = [];
  let t = t0;
  while (t < t0 + forMs) {
    t += ms;
    if (g.frame(ms, t, active)) changes.push(g.level);
  }
  return { t, changes };
}

test('quick frames never ease anything', () => {
  const g = new SeaGuard();
  assert.deepEqual(run(g, 16.7, 120_000, 0).changes, []);
  assert.equal(g.level, 0);
});

test('a short hitch does not ease; sustained slow frames do, one step at a time', () => {
  const g = new SeaGuard();
  let r = run(g, 60, GUARD_SLOW_FOR / 2, 0);
  assert.equal(g.level, 0, 'five slow seconds are not enough');
  r = run(g, 16.7, 5_000, r.t);
  r = run(g, 60, GUARD_SLOW_FOR + 3_000, r.t);
  assert.equal(g.level, 1);
  r = run(g, 60, GUARD_SLOW_FOR + 3_000, r.t);
  assert.equal(g.level, 2);
  r = run(g, 60, 60_000, r.t);
  assert.equal(g.level, GUARD_MAX, 'no deeper than the last step');
});

test('quick again: the steps come back, after a while', () => {
  const g = new SeaGuard();
  let r = run(g, 60, 2 * GUARD_SLOW_FOR + 6_000, 0);
  assert.equal(g.level, 2);
  r = run(g, 16.7, GUARD_FAST_FOR / 2, r.t);
  assert.equal(g.level, 2, 'not at the first quick seconds');
  r = run(g, 16.7, 2 * GUARD_FAST_FOR + 6_000, r.t);
  assert.equal(g.level, 0);
});

test('no see-saw: eased again soon after a step back, it waits longer before the next one', () => {
  const g = new SeaGuard();
  let r = run(g, 60, GUARD_SLOW_FOR + 3_000, 0);
  assert.equal(g.level, 1);
  r = run(g, 16.7, GUARD_FAST_FOR + 12_000, r.t);
  assert.equal(g.level, 0);
  r = run(g, 60, GUARD_SLOW_FOR + 3_000, r.t);
  assert.equal(g.level, 1);
  r = run(g, 16.7, GUARD_FAST_FOR + 12_000, r.t);
  assert.equal(g.level, 1, 'the second time it holds on longer');
  run(g, 16.7, GUARD_FAST_FOR * 3, r.t);
  assert.equal(g.level, 0);
});

test('not at sea (port, island, battle, effects of her own choosing): nothing counts', () => {
  const g = new SeaGuard();
  run(g, 80, 60_000, 0, false);
  assert.equal(g.level, 0);
  // a background tab's gap is no frame time
  let t = 0;
  for (let i = 0; i < 100; i++) g.frame(5_000, (t += 5_000), true);
  assert.equal(g.level, 0);
});

test('reset gives everything back', () => {
  const g = new SeaGuard();
  run(g, 60, GUARD_SLOW_FOR + 3_000, 0);
  assert.equal(g.level, 1);
  assert.equal(g.reset(), true);
  assert.equal(g.level, 0);
  assert.equal(g.reset(), false);
});

test('median', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5, 1, 9]), 5);
});

test('the line she sees is in both languages, the Russian one in Cyrillic', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  assert.doesNotMatch(RU.eased, /[A-Za-z]/);
});

test('the guard follows only «Эффекты: авто» and never writes her settings', () => {
  const src = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(src, /seaGuard\.frame\(gap, t, atSea && settings\(\)\.effects === 'auto'\)/);
  const guard = readFileSync(new URL('../client/src/render/seaguard.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(guard, /update\(|localStorage/);
});
