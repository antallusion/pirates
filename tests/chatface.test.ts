// The chat's faces (owner, 2026-10-19: «Аватарка в чате — там лицо капитана не отцентровано»): every captain's head, and
// the stand-ins' of a name, in the middle of the round frame — as the browser lays the background (its size a share of
// the circle's width, its position a share of the circle less the picture), the head's middle at (0.5, 0.47), whole
// inside the circle, the picture never narrower than the circle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { FACES, PIRATE_FACE, faceCentred } from '../client/src/ui/kit/faces.ts';

function placed(id: string, aspect: number, face: readonly [number, number, number]) {
  const c = faceCentred(id, aspect);
  const s = parseFloat(c.size) / 100, sh = s * aspect;
  const [px, py] = c.pos.split(' ').map((v) => parseFloat(v) / 100);
  const [fx, fy, fr] = face;
  // CSS: offset = (circle − picture) × position; the circle 1 wide (and 1 high)
  const hx = (1 - s) * px + fx * s, hy = (1 - sh) * py + fy * sh;
  return { s, hx, hy, hr: fr * s };
}

test('chat faces: every captain’s head in the middle of the circle, whole', () => {
  for (const id of CAPTAIN_IDS) {
    const f = placed(id, 560 / 422, FACES[id]);
    assert.ok(Math.abs(f.hx - 0.5) < 0.005 && Math.abs(f.hy - 0.47) < 0.005, `${id}: the head at ${f.hx.toFixed(3)}, ${f.hy.toFixed(3)}`);
    assert.ok(Math.hypot(f.hx - 0.5, f.hy - 0.5) + f.hr <= 0.5, `${id}: whole inside`);
    assert.ok(f.s >= 1, `${id}: the picture covers the circle's width`);
  }
  for (const id of ['pirate_00', 'pirate_13', 'pirate_23']) {
    const f = placed(id, 560 / 448, PIRATE_FACE);
    assert.ok(Math.abs(f.hx - 0.5) < 0.005 && Math.abs(f.hy - 0.47) < 0.005, `${id}: a stand-in's head in the middle`);
  }
});
