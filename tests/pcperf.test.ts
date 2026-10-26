// batch-pc (2026-10-26): a sea fight on a weak desk (CPU slowed 4×) ran at ~18 FPS — the popup budget, the toasts'
// clipping and the toasts' band forced a layout every frame, and the minimap's font asked the page's styles at each
// redraw. The measure now runs on a change (a signature of what it depends on, a ResizeObserver's word), after the frame
// is laid; the minimap is drawn off the page from a cached island layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as hud from '../client/src/ui/hud.ts';

const src = readFileSync(new URL('../client/src/ui/hud.ts', import.meta.url), 'utf8');

test('the minimap: its island layer laid again only when needed, drawn off the page, at its own pace', () => {
  const l = { cx: 0, cy: 0, k: 0.02, n: 10, at: 0 };
  assert.equal(hud.miniLayerStale(l, { x: 100, y: -200 }, 4500, 0.02, 10, 1000), false);
  assert.equal(hud.miniLayerStale(l, { x: 2300, y: 0 }, 4500, 0.02, 10, 1000), true, 'a quarter of the dial off');
  assert.equal(hud.miniLayerStale(l, { x: 0, y: 0 }, 9000, 0.01, 10, 1000), true, 'the Star Reader scale');
  assert.equal(hud.miniLayerStale(l, { x: 0, y: 0 }, 4500, 0.02, 11, 1000), true, 'an island came');
  assert.equal(hud.miniLayerStale(l, { x: 0, y: 0 }, 4500, 0.02, 10, 3500), true, 'old');
  assert.ok(src.includes("const c = (this.miniBack ??= document.createElement('canvas'));"), 'drawn off the page');
  assert.ok(src.includes('vg.drawImage(c, 0, 0);'));
  assert.ok(src.includes('if (tnow - this.lastMinimap > 120) {'), '~8 Hz');
  assert.ok(src.includes('const lay = this.miniIsles(state, own, range, k, W, H);'));
});

test('the popup budget and the clipping: on a change, after the frame is laid; their own outputs are not their inputs', () => {
  assert.equal('hud-folded pb-1 pb-2 simple'.replace(hud.PB_CLS, '').replace(/\s+/g, ' '), 'hud-folded simple');
  assert.equal('toast info k-toast-out tq-out'.replace(hud.CLIP_CLS, '').trim(), 'toast info');
  for (const [name, sig] of [['fit', 'layoutSig(BUDGET_SEL, PB_CLS, BUDGET_WORDS)'], ['clip', 'layoutSig(CLIP_SEL, CLIP_CLS)']]) {
    const at = src.indexOf(`const ${name} = (force?: unknown) => {`);
    assert.ok(at > 0, name);
    const body = src.slice(at, at + 700);
    assert.ok(body.includes('afterLayout(() => {'), name);
    assert.ok(body.includes(sig), name);
  }
  assert.match(src, /const sized = new ResizeObserver\(\(\) => \{\s*fit\(true\);\s*clip\(true\);/);
  // the bottom block moving does not move the simple HUD's top band
  assert.ok(src.includes('if (at === placedAt || simpleHud()) return;'));
  // the zoom is asked of the page's styles only when what sets it changed
  assert.match(src, /if \(k !== zoomKey\) \{\s*zoomKey = k;\s*zoomVal = Number\(getComputedStyle/);
});

test('a CSS variable written again with the same value is not written', () => {
  let writes = 0;
  const st = new Map<string, string>();
  const el = { style: { getPropertyValue: (k: string) => st.get(k) ?? '', setProperty: (k: string, v: string) => { writes++; st.set(k, v); }, removeProperty: (k: string) => { writes++; st.delete(k); } } } as unknown as HTMLElement;
  hud.setVar(el, '--a', '1px');
  hud.setVar(el, '--a', '1px');
  hud.dropVar(el, '--b');
  assert.equal(writes, 1);
});

test('the popup budget from the step it stands at: the same steps as from the start, nothing written when nothing changed', () => {
  const run = (start: string[], need: number) => {
    const cls = new Set<string>(start);
    let writes = 0;
    const g = globalThis as unknown as Record<string, unknown>;
    g.innerWidth = 1366;
    g.innerHeight = 768;
    const level = () => ['pb-1', 'pb-2', 'pb-3'].filter((c) => cls.has(c)).length;
    // the news reaches the screen's centre until `need` steps are on
    g.document = {
      body: { classList: { add: (...c: string[]) => { writes++; c.forEach((x) => cls.add(x)); }, remove: (...c: string[]) => { writes++; c.forEach((x) => cls.delete(x)); }, contains: (c: string) => cls.has(c) } },
      querySelectorAll: () => [],
      getElementById: (id: string) => (id === 'hud-feed' ? { classList: { contains: () => false }, getBoundingClientRect: () => (level() >= need ? { left: 480, top: 60, right: 880, bottom: 120, width: 400, height: 60 } : { left: 480, top: 300, right: 880, bottom: 420, width: 400, height: 120 }) } : null),
    };
    hud.fitTransient();
    delete g.document;
    return { steps: [...cls].sort(), writes };
  };
  assert.deepEqual(run([], 0), { steps: [], writes: 0 }, 'nothing over, nothing written');
  assert.deepEqual(run(['pb-1'], 1).steps, ['pb-1'], 'at its step and fitting there (the plainer one tried again, as before)');
  assert.equal(run(['pb-1', 'pb-2', 'pb-3'], 9).writes, 0, 'at the last step and still over: nothing written');
  assert.deepEqual(run(['pb-1'], 2).steps, ['pb-1', 'pb-2'], 'over at pb-1: on to pb-2');
  assert.deepEqual(run(['pb-1', 'pb-2'], 0).steps, [], 'the words went: back to the plain one');
  assert.deepEqual(run([], 3).steps, ['pb-1', 'pb-2', 'pb-3']);
});
