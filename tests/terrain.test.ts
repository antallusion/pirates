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

test('island relief: no wedges on a crescent — the height rises with the distance from the coast, whatever its shape', () => {
  // A hooked island whose centre lies out in its bay: a ray from the centre crosses the coast twice.
  const hook: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI * 0.8 + (i / 24) * Math.PI * 1.6;
    hook.push(Math.cos(a) * 600, Math.sin(a) * 600);
  }
  for (let i = 24; i >= 0; i--) {
    const a = -Math.PI * 0.8 + (i / 24) * Math.PI * 1.6;
    hook.push(Math.cos(a) * 380 + 60, Math.sin(a) * 380);
  }
  const r = buildRelief(hook, 0, 0, 77, 'green', 0);
  // Every step between neighbours inland is a gentle one: no cut-off wedge of land.
  let worst = 0;
  for (let j = 1; j < r.h - 1; j++) {
    for (let i = 1; i < r.w - 1; i++) {
      const k = j * r.w + i;
      // Inland only: the cliffs along the coast are meant to be steep.
      let inland = true;
      for (let d = -8; d <= 8 && inland; d++) inland = !!r.height[k + d] && !!r.height[k + d * r.w] && !!r.height[k + 1 + d] && !!r.height[k + (d + 1) * r.w];
      if (!inland) continue;
      worst = Math.max(worst, Math.abs(r.height[k + 1] - r.height[k]), Math.abs(r.height[k + r.w] - r.height[k]));
    }
  }
  assert.ok(worst < 0.08, `the steepest step between neighbours: ${worst.toFixed(3)}`);
  // Both horns of the hook have their hills, and the bay between them is sea.
  const at = (x: number, y: number) => r.height[Math.floor((y - r.y0) / r.res) * r.w + Math.floor((x - r.x0) / r.res)];
  assert.ok(at(0, -490) > 0.05 && at(0, 490) > 0.05, 'land in both horns');
  assert.equal(at(0, 0), 0, 'the bay is water');
});

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
