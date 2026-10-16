// The living sea and the ships alive on it (2026-10-16): the grades, the light, the sway and the damage looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, duskOf, gradeOf, lightDir, liveness } from '../client/src/render/grade.ts';
import { damageLook, sway } from '../client/src/render/shipfx.ts';
import { REGIONS } from '../shared/src/world/regions.ts';

test('every sea has a gentle grade: frost in the ice, ember in the ash, murk in the Abyss', () => {
  for (const id of Object.keys(REGIONS) as (keyof typeof REGIONS)[]) {
    const g = gradeOf(id);
    for (const m of g.mul) assert.ok(m > 0.8 && m < 1.2, `${id} multiply ${m}`);
    assert.ok(g.a >= 0 && g.a <= 0.12, `${id} wash ${g.a}`);
  }
  assert.ok(GRADES.leviathan_reach.mul[2] > GRADES.leviathan_reach.mul[0], 'the ice is blue');
  assert.ok(GRADES.ashen_isles.mul[0] > GRADES.ashen_isles.mul[2], 'the ash is warm');
  assert.ok(GRADES.the_abyss.mul[1] > GRADES.the_abyss.mul[0], 'the Abyss is green');
  assert.deepEqual(gradeOf(undefined).mul, [1, 1, 1]);
});

test('the warm hour is at dawn and dusk only; the light is the sun by day and the moon by night', () => {
  assert.ok(duskOf(0.25) > 0.99 && duskOf(0.75) > 0.99);
  assert.ok(duskOf(0.5) < 0.01 && duskOf(0) < 0.01);
  const noon = lightDir(0.5, 0), midnight = lightDir(0, 1);
  assert.ok(noon[2] > 0.9, 'the sun high at noon');
  assert.deepEqual(midnight, [0.35, -0.55, 0.75]);
});

test('less motion stills the sea and the ships; a weak device keeps a calmer sea', () => {
  assert.equal(liveness(true, 0, false), 0);
  assert.equal(liveness(false, 0, false), 1);
  assert.ok(liveness(false, 2, false) < 1 && liveness(false, 0, true) < 1);
  assert.deepEqual(sway(7, 12.3, 0, 1, 1, 1), { turn: 0, sx: 1, sy: 1 });
  for (let t = 0; t < 20; t += 0.37) {
    const s = sway(5, t, 1, 1, 1.4, 1);
    assert.ok(Math.abs(s.turn) < 0.02 && Math.abs(s.sx - 1) < 0.05 && Math.abs(s.sy - 1) < 0.03, JSON.stringify(s));
  }
  // each ship her own phase
  assert.notEqual(sway(1, 3, 1, 1, 1, 1).turn, sway(2, 3, 1, 1, 1, 1).turn);
});

test('the damage shows: smoke below half the hull, fire below a quarter, torn sails below 60 %', () => {
  assert.deepEqual(damageLook(1, 1), { smoke: 0, fire: 0, torn: 0 });
  assert.ok(damageLook(0.4, 1).smoke > 0 && damageLook(0.4, 1).fire === 0);
  assert.ok(damageLook(0.2, 1).fire > 0);
  assert.ok(damageLook(1, 0.3).torn > 0 && damageLook(1, 0.7).torn === 0);
});
