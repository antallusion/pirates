import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profiler } from '../server/src/game/metrics.ts';
import { makeGame, steps } from './helpers.ts';

test('the profiler splits the step by subsystem: mean, worst and share, over a rolling window', () => {
  const p = new Profiler();
  const spin = (ms: number) => {
    const until = performance.now() + ms;
    while (performance.now() < until);
  };
  for (let i = 0; i < 20; i++) {
    p.begin();
    spin(0.1);
    p.lap('light');
    spin(3); // a wide gap, so a pause of the collector in the light lap cannot turn the order
    p.lap('heavy');
    p.end();
  }
  const r = p.report();
  assert.ok(r.heavy.avgMs >= 0.9, 'a millisecond a step');
  assert.ok(r.heavy.share > r.light.share);
  assert.ok(r.heavy.maxMs >= r.heavy.avgMs);
  assert.equal(Object.keys(r)[0], 'heavy', 'heaviest first');
  // A partial report does not disturb the window.
  assert.deepEqual(Object.keys(p.report()).sort(), ['heavy', 'light']);
});

test('the game step reports every subsystem it runs', () => {
  const { game } = makeGame();
  steps(game, 40);
  const r = game.prof.report();
  for (const k of ['second', 'buckets', 'npcAi', 'physics', 'collisions', 'projectiles', 'boarding', 'pve', 'snapshots', 'save']) assert.ok(k in r, k);
  const total = Object.values(r).reduce((a, v) => a + v.share, 0);
  assert.ok(Math.abs(total - 1) < 0.02);
});
