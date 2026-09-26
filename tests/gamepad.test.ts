import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, dead, HOLD, padAimPoint, PadInput, radialSector } from '../client/src/gamepad.ts';
import type { PadSnapshot } from '../client/src/gamepad.ts';

function snap(down: number[], axes = [0, 0, 0, 0]): PadSnapshot {
  return { buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })), axes };
}

test('pad input: presses, releases with their length, holds past the threshold, and the LB+RB chord', () => {
  const p = new PadInput();
  assert.deepEqual(p.poll(snap([BTN.A]), 0.016), [{ k: 'press', b: BTN.A }]);
  assert.deepEqual(p.poll(snap([BTN.A]), 0.016), []);
  const rel = p.poll(snap([]), 0.1);
  assert.equal(rel[0].k, 'release');
  // A d-pad held long enough opens a radial; a tap does not.
  p.poll(snap([BTN.LEFT]), 0.016);
  const held = p.poll(snap([BTN.LEFT]), HOLD + 0.01);
  assert.ok(held.some((e) => e.k === 'hold' && e.b === BTN.LEFT));
  const r = p.poll(snap([]), 0.016).find((e) => e.k === 'release')!;
  assert.ok(r.k === 'release' && r.held >= HOLD);
  // LB then RB: a chord, and both releases keep the chord flag (no sail step).
  p.poll(snap([BTN.LB]), 0.016);
  assert.equal(p.chord, false);
  const c = p.poll(snap([BTN.LB, BTN.RB]), 0.016);
  assert.ok(c.some((e) => e.k === 'chord'));
  p.poll(snap([BTN.RB]), 0.016);
  assert.equal(p.chord, true);
  p.poll(snap([]), 0.016);
  assert.equal(p.chord, true, 'still the chord when the second is let go');
  p.poll(snap([BTN.RB]), 0.016);
  assert.equal(p.chord, false, 'a fresh press alone is a sail step again');
  // Triggers count as pressed past half-way.
  const trig = { buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: false, value: i === BTN.RT ? 0.7 : 0 })), axes: [0, 0, 0, 0] };
  assert.ok(p.poll(trig, 0.016).some((e) => e.k === 'press' && e.b === BTN.RT));
});

test('dead zones, radial sectors and the broadside aim point', () => {
  assert.equal(dead(0.1), 0);
  assert.ok(Math.abs(dead(1) - 1) < 1e-9);
  assert.ok(dead(-0.6) < 0);
  assert.equal(radialSector(0, -1, 8), 0, 'up');
  assert.equal(radialSector(1, 0, 8), 2, 'right');
  assert.equal(radialSector(0, 1, 4), 2, 'down');
  assert.equal(radialSector(0.1, 0.1, 8), -1, 'dead centre');
  // Heading north (0): starboard is east, port west; lead pushes along the keel.
  const s = padAimPoint(0, 0, 0, 'starboard', 300, 0);
  assert.ok(Math.abs(s.x - 300) < 1e-9 && Math.abs(s.y) < 1e-9);
  const p = padAimPoint(0, 0, 0, 'port', 300, 100);
  assert.ok(Math.abs(p.x + 300) < 1e-9 && Math.abs(p.y + 100) < 1e-9);
});
