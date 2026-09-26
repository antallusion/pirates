import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRelief, cliffAt, radiusAt } from '../client/src/render/terrain.ts';
import { wantedState, mayChange, bellsAt } from '../client/src/music.ts';
import { shipHeel } from '../client/src/render/renderer.ts';

function blob(r: number, n = 48): number[] {
  const p: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.8 + 0.2 * Math.sin(a * 3));
    p.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return p;
}

test('island relief: height inside the coast only, shaded both ways, stretches of cliff and beach', () => {
  const poly = blob(600);
  const rAt = radiusAt(poly, 0, 0);
  assert.ok(Math.abs(rAt(0) - 600 * 0.8) < 30);
  const r = buildRelief(poly, 0, 0, 1234, 'green', 0.5);
  assert.ok(r.w <= 330 && r.w === r.h);
  // Transparent outside the coast.
  assert.equal(r.rgba[3], 0, 'the corner is sea');
  let lit = 0, dark = 0;
  for (let i = 0; i < r.rgba.length; i += 4) {
    if (!r.rgba[i + 3]) continue;
    if (r.rgba[i] > 100) lit++;
    else dark++;
  }
  assert.ok(lit > 100 && dark > 100, `lit ${lit} dark ${dark}`);
  assert.ok(r.cliffShare > 0.05 && r.cliffShare < 0.95, `cliffs along part of the coast: ${r.cliffShare}`);
  // Rockier islands have more cliff.
  let rocky = 0, soft = 0;
  for (let a = -Math.PI; a < Math.PI; a += 0.05) {
    rocky += cliffAt(a, 99, 1);
    soft += cliffAt(a, 99, 0);
  }
  assert.ok(rocky > soft);
});

test('the score follows the scene with a 20 s hold (battle breaks through); the bells of the watch; the heel', () => {
  const base = { docked: false, combat: false, chased: false, weather: 'clear', region: 'black_coast', anomaly: false };
  assert.equal(wantedState(base), 'calm');
  assert.equal(wantedState({ ...base, weather: 'fog' }), 'fog');
  assert.equal(wantedState({ ...base, combat: true }), 'battle');
  assert.equal(wantedState({ ...base, region: 'the_abyss', combat: true }), 'abyss', 'the Abyss is silence');
  assert.equal(wantedState({ ...base, docked: true }), 'port');
  assert.equal(mayChange('calm', 'fog', 5), false);
  assert.equal(mayChange('calm', 'fog', 21), true);
  assert.equal(mayChange('calm', 'battle', 1), true);
  assert.equal(bellsAt(0), 8, 'midnight: eight bells');
  assert.equal(bellsAt(0.5 / 24), 1, 'half past: one bell');
  assert.equal(bellsAt(4 / 24), 8);
  // Wind on the beam heels her to leeward; head to wind, none; a heavy hull heels less.
  const beam = shipHeel(0, Math.PI / 2, 1, 1, 1, 0, 0);
  assert.ok(beam > 0.3, `${beam}`);
  assert.ok(Math.abs(shipHeel(0, 0, 1, 1, 1, 0, 0)) < 0.05);
  assert.ok(shipHeel(0, Math.PI / 2, 1, 1, 5, 0, 0) < beam);
  assert.ok(shipHeel(0, 0, 0, 0, 1, 0.8, 0) > 0.2, 'a flooded hold lists her');
});
