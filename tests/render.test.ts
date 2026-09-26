import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE, SAIL_TINT, ShelfPacker, tintSails } from '../client/src/render/atlas.ts';
import { Fx, PARTICLE_CAP } from '../client/src/render/fx.ts';

test('atlas packing: no overlaps, rows wrap, a full page opens the next', () => {
  const p = new ShelfPacker(PAGE);
  const slots = Array.from({ length: 120 }, (_, i) => p.place(120 + (i % 5) * 20, 200 + (i % 3) * 25));
  for (const s of slots) assert.ok(s.x + s.w <= PAGE && s.y + s.h <= PAGE);
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      if (a.page !== b.page) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      assert.ok(apart, `${i} and ${j} overlap`);
    }
  }
  assert.ok(p.pages >= 2, 'more than one page of ships');
  assert.throws(() => p.place(PAGE + 1, 10));
});

test('faction sails: pale cloth takes the dye, dark wood and paint do not', () => {
  const px = new Uint8ClampedArray([
    230, 228, 220, 255, // sailcloth
    70, 50, 30, 255, // planking
    200, 40, 40, 255, // red paint
    230, 228, 220, 0, // transparent
  ]);
  tintSails(px, SAIL_TINT.confederacy!);
  assert.ok(px[0] > px[1] + 40 && px[0] > px[2] + 40, 'the Confederacy dyes her sails red');
  assert.deepEqual([...px.slice(4, 8)], [70, 50, 30, 255]);
  assert.deepEqual([...px.slice(8, 12)], [200, 40, 40, 255]);
  assert.deepEqual([...px.slice(12, 16)], [230, 228, 220, 0]);
  const black = new Uint8ClampedArray([230, 228, 220, 255]);
  tintSails(black, SAIL_TINT.black!);
  assert.ok(black[0] < 120, 'tarred black under the Black Flag');
});

test('particle LOD: long frames thin decoration, never the flashes; nothing decorative off screen; recovery lowers it', () => {
  const fx = new Fx();
  fx.view = { x0: -100, y0: -100, x1: 100, y1: 100 };
  fx.smoke(5000, 5000, 20);
  assert.equal(fx.particles.length, 0, 'off screen');
  for (let i = 0; i < 200; i++) fx.frame(40);
  assert.equal(fx.lod, 2);
  for (let i = 0; i < 2000; i++) fx.smoke(0, 0, 1);
  assert.ok(fx.particles.length <= PARTICLE_CAP[2], 'capped');
  assert.ok(fx.particles.length < 2000 * 0.5, 'thinned');
  const n = fx.particles.length;
  fx.explosion(0, 0, 40);
  assert.ok(fx.particles.some((p) => p.kind === 'flash'), 'the flash still shows');
  assert.ok(fx.particles.length > n);
  for (let i = 0; i < 400; i++) fx.frame(10);
  assert.equal(fx.lod, 0);
  fx.forceLod = 2;
  fx.frame(10);
  assert.equal(fx.lod, 2, 'pinned low by the options');
});
