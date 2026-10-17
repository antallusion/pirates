// The far view and the free look (client/src/render/freecam.ts; owner 2026-10-17: «дай возможность отдалить море
// сильно и просто возить пальцем и просматривать где что»): the zoom's range, the chart's fade, the camera's clamp, and
// the sea's fingers told apart — a tap stays a tap, a drag pans, two fingers pinch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHART_FROM, CHART_FULL, LOOK_MAX, SeaGesture, TAP_SLOP, ZOOM_MAX, ZOOM_MIN, ZOOM_NEAR_MIN, chartMix, clampLook, clampZoom, panLook } from '../client/src/render/freecam.ts';
import { WORLD_SIZE } from '../shared/src/constants.ts';
import { EN, RU } from '../client/src/lang/ui/freecam.ts';

test('the zoom reaches far further out than before, and no further in', () => {
  assert.ok(ZOOM_MIN <= ZOOM_NEAR_MIN / 8, 'at least eight times further out than the old 0.35 px/m');
  assert.equal(clampZoom(0.001), ZOOM_MIN);
  assert.equal(clampZoom(99), ZOOM_MAX);
  assert.equal(clampZoom(1.3), 1.3);
  assert.equal(clampZoom(Number.NaN), ZOOM_NEAR_MIN);
  // an 844 px phone at the farthest spans more than 15 km — several times the lookouts' 2.2 km reach either way
  assert.ok(844 / ZOOM_MIN > 15_000);
});

test('the chart fades in between CHART_FROM and CHART_FULL, below the old farthest', () => {
  assert.ok(CHART_FROM < ZOOM_NEAR_MIN && CHART_FULL < CHART_FROM && CHART_FULL > ZOOM_MIN);
  assert.equal(chartMix(ZOOM_NEAR_MIN), 0, 'the old views keep the painted sea');
  assert.equal(chartMix(CHART_FROM), 0);
  assert.equal(chartMix(CHART_FULL), 1);
  assert.equal(chartMix(ZOOM_MIN), 1);
  const mid = chartMix((CHART_FROM + CHART_FULL) / 2);
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
  let prev = -1;
  for (let z = ZOOM_MAX; z >= ZOOM_MIN; z *= 0.9) {
    const m = chartMix(z);
    assert.ok(m >= prev, 'more chart the further out');
    prev = m;
  }
});

test('the free look keeps within LOOK_MAX of her and inside the world', () => {
  const own = { x: 50_000, y: 50_000 };
  assert.deepEqual(clampLook({ x: 51_000, y: 49_000 }, own), { x: 51_000, y: 49_000 });
  const far = clampLook({ x: own.x + LOOK_MAX * 3, y: own.y }, own);
  assert.ok(Math.abs(far.x - (own.x + LOOK_MAX)) < 1e-6 && far.y === own.y);
  const diag = clampLook({ x: own.x + 30_000, y: own.y + 30_000 }, own);
  assert.ok(Math.abs(Math.hypot(diag.x - own.x, diag.y - own.y) - LOOK_MAX) < 1e-6);
  // at the world's edge: not past it
  const edge = clampLook({ x: -500, y: WORLD_SIZE + 800 }, { x: 300, y: WORLD_SIZE - 200 });
  assert.deepEqual(edge, { x: 0, y: WORLD_SIZE });
  // no ship (a respawn): the world's bounds alone
  assert.deepEqual(clampLook({ x: -1, y: 5 }, null), { x: 0, y: 5 });
});

test('a drag moves the sea with the finger, by its pixels at the zoom', () => {
  const own = { x: 10_000, y: 10_000 };
  const look = panLook({ x: 10_000, y: 10_000 }, 100, -50, 0.5, own);
  assert.deepEqual(look, { x: 9800, y: 10_100 });
  // far out a short drag goes a long way, still held to her reach
  const far = panLook({ x: 10_000, y: 10_000 }, -800, 0, ZOOM_MIN, own);
  assert.ok(Math.abs(far.x - (own.x + LOOK_MAX)) < 1e-6);
});

test('the sea\'s fingers: a still press is a tap however long; a drag pans and never taps', () => {
  const g = new SeaGesture();
  // a quick tap
  g.down(1, 100, 100);
  assert.deepEqual(g.up(1, 102, 101), { tap: [102, 101] });
  // a long still press (its old meaning: the aim where it went down) — still a tap
  g.down(2, 200, 200);
  assert.deepEqual(g.move(2, 203, 198), {});
  assert.deepEqual(g.up(2, 203, 198), { tap: [203, 198] });
  // a drag: nothing until the slop, then the whole way from the start, then each step; no tap at the end
  g.down(3, 300, 300);
  assert.deepEqual(g.move(3, 300 + TAP_SLOP - 2, 300), {});
  assert.deepEqual(g.move(3, 300 + TAP_SLOP + 5, 300), { pan: [TAP_SLOP + 5, 0] });
  assert.ok(g.dragging);
  assert.deepEqual(g.move(3, 340, 320), { pan: [340 - 300 - TAP_SLOP - 5, 20] });
  assert.deepEqual(g.up(3, 340, 320), {});
  // a finger that slid past the slop and came back: still no tap
  g.down(4, 50, 50);
  g.move(4, 80, 50);
  g.move(4, 50, 50);
  assert.deepEqual(g.up(4, 50, 50), {});
  // a cancelled press taps nothing
  g.down(5, 10, 10);
  assert.deepEqual(g.up(5, 10, 10, true), {});
  assert.equal(g.count, 0);
});

test('two fingers pinch the zoom and drag by their midpoint; neither taps after', () => {
  const g = new SeaGesture();
  g.down(1, 100, 100);
  g.down(2, 200, 100);
  // apart: the zoom grows by the spread's ratio, the midpoint drifts with them
  const o = g.move(2, 300, 100);
  assert.ok(Math.abs((o.zoom ?? 0) - 2) < 1e-9);
  assert.deepEqual(o.pan, [50, 0]);
  // together again: zoom out
  const o2 = g.move(1, 200, 100);
  assert.ok(Math.abs((o2.zoom ?? 0) - 0.5) < 1e-9);
  // the first finger up: no tap; the one left drags from where it is, past the slop
  assert.deepEqual(g.up(1, 200, 100), {});
  assert.deepEqual(g.move(2, 304, 100), {});
  assert.deepEqual(g.move(2, 300 + TAP_SLOP + 1, 100), { pan: [TAP_SLOP + 1, 0] });
  assert.deepEqual(g.up(2, 300 + TAP_SLOP + 1, 100), {});
  // and a still second finger lifted after a pinch taps nothing either
  g.down(7, 0, 0);
  g.down(8, 50, 0);
  g.up(7, 0, 0);
  assert.deepEqual(g.up(8, 50, 0), {});
});

test('the far view is wired: the gestures in touch.ts, the recentre and the fog layer\'s slot in the renderer', () => {
  const touch = readFileSync(new URL('../client/src/touch.ts', import.meta.url), 'utf8');
  assert.ok(touch.includes('new SeaGesture()') && touch.includes('this.hooks.pan?.('), 'the canvas fingers go through SeaGesture');
  assert.ok(!/pointerdown[^]*?this\.hooks\.aim\(e\.clientX/.test(touch), 'a press no longer aims on the way down');
  const r = readFileSync(new URL('../client/src/render/renderer.ts', import.meta.url), 'utf8');
  assert.ok(r.includes('readonly farLayers: FarLayer[]'), 'the fog of war has its slot');
  assert.ok(r.includes('if (this.looking) this.recentre()'), 'a fight beginning brings the view home');
  assert.ok(!r.includes(', 0.35, 4)'), 'no zoom clamp of the old range left');
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(!main.includes(', 0.35, 4)'), 'no zoom clamp of the old range left in main.ts');
  assert.ok(main.includes("id: 'tc-home'"), 'the «К кораблю» button');
});

test('the far view\'s words in both languages, Russian without Latin', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const v of Object.values(RU)) assert.ok(!/[A-Za-z]/.test(v), v);
});
