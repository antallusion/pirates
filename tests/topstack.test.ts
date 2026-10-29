// The top-centre column (owner, 2026-10-29: «одно на другое накладывается, текст не видно»): her mark, the autopilot's
// pill and the island's step in ONE column's flow, the toasts under it one at a time, the step giving its slot to a toast
// when the top 30 % has no room. The live layout is measured by tools/mobile/declutter/topstack.mjs (no two HUD boxes
// intersect at 844×390, 740×360, 1093×481, 1128×554, 1366×768); this pins the pieces it rests on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ToastQueue } from '../client/src/ui/kit/toast.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('top stack: one toast at a time on the simple HUD — the next waits its turn or replaces one already read', () => {
  const q = new ToastQueue();
  q.setMax(1);
  q.push('a', 'bad', 0);
  const b = q.push('b', 'info', 150);
  assert.deepEqual(q.visible.map((t) => t.key), ['a']);
  assert.deepEqual(b.show, [], 'the second waits: the first not read yet');
  assert.deepEqual(q.waiting.map((t) => t.key), ['b']);
  const c = q.push('c', 'info', 1200);
  assert.deepEqual(c.hide?.map((t) => t.key), ['a'], 'one read a moment gives way');
  assert.equal(q.visible.length, 1);
  // back to two (the detailed HUD)
  q.setMax(2);
  q.tick(1300);
  assert.equal(q.visible.length, 2);
});

test('top stack: the island step is in the column, last, never fixed on its own; the toasts small and single', () => {
  const hud = read('client/src/ui/hud.ts');
  assert.match(hud, /if \(el\.parentElement !== stack\) stack\.appendChild\(el\)/, 'the step joins #hud-stack on the simple HUD');
  assert.match(hud, /i1\.classList\.toggle\('i1-yield', yieldIsle\)/, 'a toast with no room takes the step\'s slot');
  assert.match(hud, /limit: \(\) => \(simpleHud\(\) \? 1 : TOAST\.visible\)/, 'one toast at a time');
  assert.doesNotMatch(read('client/styles.css'), /\.hud-isle1\.i1-top/, 'no fixed pill under the autopilot (477e3472)');
  const fit = read('client/fit.css');
  assert.match(fit, /body\.simple #hud-stack > #hud-isle1 \{ order: 20;/);
  assert.match(fit, /body\.simple #hud-stack > #hud-isle1\.i1-yield \{ visibility: hidden !important;/);
  assert.match(fit, /body\.simple:not\(\.tac\) #toasts > \.toast:nth-child\(n\+2\) \{ display: none; \}/);
  assert.match(fit, /max-width: min\(400px, 46vw, 100%\)/);
});
