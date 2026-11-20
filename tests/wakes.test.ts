// Forum 118 (Эдуард): the sea lagged worse the longer the session ran, the island screen eased it. The wakes of ships
// gone from sight were never aged out (client/src/render/wakes.ts): the list grew all session and filled the sea
// shader's 48 slots with dead points. These pin the pruning and the shader's list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WAKE_AGE_END, WAKE_PER_SHIP, pruneWakes, shaderWakes, type WakePt } from '../client/src/render/wakes.ts';

const pt = (x: number, y: number, t: number, life = 4, w = 6): WakePt => ({ x, y, t, w, life });
const VIEW = { x0: -500, y0: -500, x1: 500, y1: 500 };

test('a ship gone from sight: her wake ages out and is forgotten', () => {
  const wakes = new Map<number, WakePt[]>([
    [1, [pt(0, 0, 0), pt(4, 0, 9)]],
    [2, [pt(0, 0, 0)]],
  ]);
  // at t=10 the ship 1 is still drawn (her own update ages her wake); ship 2 is gone and her point long dead
  assert.equal(pruneWakes(wakes, new Set([1]), 10), 1);
  assert.equal(wakes.get(1)!.length, 2, 'a drawn ship\'s wake is hers to age');
  assert.equal(wakes.has(2), false);
  // ship 1 gone too: the dead point goes, the live one stays until its life ends
  pruneWakes(wakes, new Set(), 10);
  assert.deepEqual(wakes.get(1)!.map((p) => p.t), [9]);
  pruneWakes(wakes, new Set(), 14);
  assert.equal(wakes.size, 0);
});

test('a long session does not grow the wakes: a thousand ships passing leave nothing behind', () => {
  const wakes = new Map<number, WakePt[]>();
  for (let id = 0; id < 1000; id++) {
    const t = id * 0.5;
    wakes.set(id, [pt(id, 0, t), pt(id + 4, 0, t + 0.1)]);
    pruneWakes(wakes, new Set([id]), t + 0.2);
  }
  assert.ok(wakes.size <= 20, `wakes left: ${wakes.size}`);
});

test('the shader is given only live points that can reach the screen, the youngest first kept', () => {
  const now = 100;
  const wakes = new Map<number, WakePt[]>([
    [1, [pt(0, 0, 0)]], // dead (age far past 7)
    [2, [pt(5000, 0, now - 0.5)]], // live but far off screen
    [3, [pt(10, 10, now - 1), pt(14, 10, now - 0.2)]], // live, in sight
  ]);
  const list = shaderWakes(wakes, now, VIEW, 48);
  assert.equal(list.length, 2);
  for (const w of list) assert.ok(w.age < WAKE_AGE_END);
  assert.ok(list[0].age > list[1].age, 'oldest first, as the shader adds them');
});

test('the shader list keeps the youngest within its slots and each ship\'s newest points', () => {
  const now = 50;
  const pts: WakePt[] = [];
  for (let i = 0; i < 30; i++) pts.push(pt(i, 0, now - 3 + i * 0.1, 8));
  const wakes = new Map([[1, pts]]);
  const list = shaderWakes(wakes, now, VIEW, 48);
  assert.equal(list.length, WAKE_PER_SHIP);
  const few = shaderWakes(wakes, now, VIEW, 5);
  assert.equal(few.length, 5);
  const youngest = list.map((w) => w.age).sort((a, b) => a - b).slice(0, 5);
  assert.deepEqual(few.map((w) => w.age).sort((a, b) => a - b), youngest);
  assert.ok(few[few.length - 1].age <= few[0].age);
});

test('the renderer prunes the wakes of ships not drawn, every frame', () => {
  const src = readFileSync(new URL('../client/src/render/renderer.ts', import.meta.url), 'utf8');
  assert.match(src, /pruneWakes\(this\.wakes, drawn, this\.time\)/);
  assert.match(src, /shaderWakes\(this\.wakes, this\.time,/);
});
