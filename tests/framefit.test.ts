// Owner, 2026-10-21: «при атаке моделька была такой же по высоте как фактическая фигурка». Every battle figure's poses
// are fitted to its idle pose by tools/art/frame_fit.py (shared/src/data/framefit.ts); the renderers apply the table
// at draw time. The numbers checked here are the analyser's own re-measure of each fitted frame (resampled and placed
// as the renderer draws it, measured again from scratch: tools/art/framefit/report.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FRAME_FIT, fitBox, fitStage, frameFit } from '../shared/src/data/framefit.ts';
import { webDetail } from '../shared/src/data/webdetail.ts';

const ROOT = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, { local: string }> };
type Frame = { scale: number; dx: number; dy: number; basis: 'height' | 'mass'; flags: string[]; after: { core_ratio: number; area_ratio: number; ground_px: number; cy_px: number } };
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'art', 'framefit', 'report.json'), 'utf8')) as {
  summary: { flagged: Record<string, Record<string, string[]>> };
  kinds: Record<string, { fly: boolean; frames: Record<string, Frame> }>;
};
const POSES = ['_b', '_atk', '_hit'];
const unstable = (f: Frame) => f.flags.some((x) => x.startsWith('unstable'));
const frames = Object.entries(report.kinds).flatMap(([k, r]) => Object.entries(r.frames).map(([p, f]) => ({ id: `unit.${k}${p}`, k, fly: r.fly, f })));

test('every animated creature frame in the manifest has a fit entry (and every idle pose its own)', () => {
  const ids = Object.keys(manifest.assets).filter((i) => i.startsWith('unit.'));
  const kinds = new Set(ids.map((i) => i.replace(/_(b|atk|hit)$/, '')).filter((k) => POSES.some((p) => manifest.assets[k + p])));
  assert.ok(kinds.size >= 270, `only ${kinds.size} animated kinds`);
  for (const k of kinds) {
    assert.ok(manifest.assets[k], k);
    const idle = FRAME_FIT[k];
    assert.ok(idle, `${k}: no fit`);
    assert.deepEqual(idle.slice(0, 4), [1, 0, 0, 1], k);
    for (const p of POSES) if (manifest.assets[k + p]) assert.ok(FRAME_FIT[k + p], `${k + p}: no fit`);
  }
});

test('the table is the analysed one', () => {
  for (const { id, f } of frames) {
    const r = FRAME_FIT[id];
    assert.ok(r, id);
    assert.ok(Math.abs(r[0] - f.scale) < 1e-3 && Math.abs(r[1] - f.dx) < 1e-3 && Math.abs(r[2] - f.dy) < 1e-3, id);
    assert.ok(r[0] >= 0.55 && r[0] <= 1.8, `${id}: scale ${r[0]}`);
  }
});

test('after the fit the core body height of idle_b / atk / hit is within ±4 % of the idle (pose frames: the mass)', () => {
  const bad: string[] = [];
  for (const { id, f } of frames) {
    if (unstable(f)) continue;
    const off = (f.basis === 'height' ? f.after.core_ratio : f.after.area_ratio) - 1;
    if (Math.abs(off) > 0.04) bad.push(`${id} ${f.basis} ${(off * 100).toFixed(1)}%`);
    // A frame fitted by its mass is one whose pose changed its height (a crouch, wings up): it is on the review list.
    if (f.basis === 'mass') assert.ok(f.flags.length, `${id}: a mass fit not flagged`);
  }
  assert.deepEqual(bad, []);
  // Only a handful are left to a human (the measure itself at a threshold's edge).
  assert.ok(frames.filter((x) => unstable(x.f)).length <= 4);
});

test('after the fit the ground line is within ±3 px at the render size (fliers: their middle)', () => {
  const bad = frames.filter(({ f, fly }) => !unstable(f) && Math.abs(fly ? f.after.cy_px : f.after.ground_px) > 3).map(({ id, f }) => `${id} ${f.after.ground_px}`);
  assert.deepEqual(bad, []);
});

test('the flagged creatures are listed in the report', () => {
  for (const { k, f } of frames) if (f.flags.length) assert.ok(report.summary.flagged[k], k);
});

test('the fit helpers: no entry, as before; a fitted box; the stage round two poses', () => {
  assert.equal(frameFit('unit.nobody_atk'), null);
  assert.equal(fitBox('unit.nobody_atk'), null);
  assert.equal(fitStage('unit.nobody', 'unit.nobody_atk'), null);
  const idle = fitBox('unit.merrow_warden')!;
  assert.deepEqual([idle.y, idle.h], [-1, 1]);
  const st = fitStage('unit.merrow_warden', 'unit.merrow_warden_atk')!;
  assert.ok(st.ar > 0);
  for (const q of [st.a, st.b]) {
    assert.ok(q[0] >= 0 && q[1] >= 0 && q[0] + q[2] <= 100.01 && q[1] + q[3] <= 100.01, JSON.stringify(q));
  }
  // The blow's box at its fitted height beside the idle's: scale x its native height.
  const r = FRAME_FIT['unit.merrow_warden_atk'];
  assert.ok(Math.abs(st.b[3] / st.a[3] - r[0] * r[3]) < 0.01);
});

test('the site shop window: unit_merrow_warden_2 carries the fit of its figure and its blow', () => {
  const art = (id: string) => (id.startsWith('/') ? id : manifest.assets[id] ? `/assets/${manifest.assets[id].local}` : null);
  const d = webDetail('unit_merrow_warden_2', art)!;
  assert.ok(d, 'no detail');
  assert.ok(d.hero.alt);
  assert.deepEqual(d.hero.fit, fitStage('unit.merrow_warden', 'unit.merrow_warden_atk'));
  // JSON-safe (it goes over the wire).
  assert.deepEqual(JSON.parse(JSON.stringify(d.hero.fit)), d.hero.fit);
});
