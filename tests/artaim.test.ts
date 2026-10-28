// The banner paintings framed on their subjects (owner, 2026-10-28: «большинство картинок в таких окошках отрезаны
// поверху, надо все выставить правильно и четко чтобы лица попадали в окошки и на мобиле и на десктопе и везде»):
// every card painting has its focus, the subject and the top over it stay in a window of any width the game uses, the
// position is a CSS one, and every banner's stylesheet reads it (shared/src/data/artaim.ts, tools/art/art_focus.py).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ART_FOCUS } from '../shared/src/data/artfocus.ts';
import { ART_POS_FALLBACK, aimWindow, artAim, artKey } from '../shared/src/data/artaim.ts';
import { END_HEADER, WAY_HEADER } from '../shared/src/data/paintart.ts';

const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Record<string, { local: string }> };
const stem = (local: string) => local.replace(/^.*\//, '').replace(/\.\w+$/, '');

test('every card painting and every painted window header has its focus', () => {
  const ids = [...Object.keys(manifest.assets).filter((k) => k.startsWith('card.')), ...Object.values(WAY_HEADER), ...Object.values(END_HEADER)];
  assert.ok(ids.length >= 140);
  for (const id of ids) {
    const e = manifest.assets[id];
    assert.ok(e, `${id}: not in the manifest`);
    assert.ok(ART_FOCUS[stem(e.local)], `${id}: no focus (tools/art/art_focus.py FOCUS)`);
  }
});

test('the subject and the top over it stay in the window at every banner shape, desktop to a phone lying down', () => {
  for (const [k, f] of Object.entries(ART_FOCUS)) {
    const [x, y, top, ar] = f;
    assert.ok(top <= y && x >= 0 && x <= 1 && y <= 1 && ar > 1, `${k}: a bad row`);
    for (const shape of [1, 2.4, 2.6, 3, 3.2, 4, 4.5, 5, 6, 10]) {
      const [l, t, u, v] = aimWindow(f, ar, shape, 1);
      assert.ok(t >= 0 && t + v <= 1 + 1e-9 && l >= 0 && l + u <= 1 + 1e-9, `${k} ${shape}:1 off the picture`);
      assert.ok(y >= t && y <= t + v, `${k} ${shape}:1: the subject out of the window`);
      // the top is cut only when the window cannot hold both it and the subject
      if (y - top < 0.85 * v) assert.ok(top >= t - 1e-9, `${k} ${shape}:1: the top cut (${top} above ${t.toFixed(3)})`);
    }
  }
});

test('«Заблудившийся лоцман»: his head in the frame on the desktop and on a phone either way', () => {
  const f = ART_FOCUS.mg_star_bearing;
  for (const [w, h] of [[424, 162], [358, 136], [424, 94], [424, 83]]) {
    const [, t, , v] = aimWindow(f, f[3], w, h);
    assert.ok(t <= f[2], `${w}×${h}: the hat cut`);
    assert.ok(f[1] - t <= 0.6 * v, `${w}×${h}: the face low in the window`);
  }
  // the old centre crop of a 2.6:1 box began below his hat: the very fault
  assert.ok(0.5 - aimWindow(f, f[3], 2.6, 1)[3] / 2 > f[2]);
  assert.equal(artAim('/assets/cards/mg_star_bearing.webp?v=20261024', 424, 162), '50% 0%');
});

test('keys from addresses and ids; a picture with no focus keeps the fallback', () => {
  assert.equal(artKey('/assets/cards/mg_split_map.avif?v=1'), 'mg_split_map');
  assert.equal(artKey('card.enc_pilot'), 'enc_pilot');
  assert.equal(artKey('bg.way_tavern'), 'way_tavern');
  assert.equal(artAim('/assets/cards/nothing_here.webp', 400, 100), null);
  assert.equal(artAim('card.enc_pilot', 0, 0), null);
  assert.match(artAim('card.enc_pilot', 96, 96)!, /^\d+(\.\d)?% \d+(\.\d)?%$/);
  assert.equal(ART_POS_FALLBACK, 'center 25%');
});

test('every banner\'s stylesheet reads --art-pos, with the fallback, and none is centre-cropped any more', () => {
  const css = ['client/styles.css', 'client/minigame.css', 'client/fit.css'].map((f) => readFileSync(f, 'utf8')).join('\n');
  const src = readFileSync('client/src/ui/artaim.ts', 'utf8');
  const boxes = /ART_BOXES = '([^']+)'/.exec(src)![1].split(',').map((s) => s.trim());
  for (const sel of ['.mg-art', '.enc-art', '.hol-art', '.card-art', '.cn-art', '.cb-art', '.tg-zb', '#hud-boss', '.art-head']) {
    assert.ok(boxes.includes(sel), `${sel}: not framed by client/src/ui/artaim.ts`);
    const rules = css.split('}').filter((r) => r.includes(sel) && /cover/.test(r) && !/@media/.test(r.split('{')[0]));
    assert.ok(rules.length, `${sel}: no cover rule`);
    for (const r of rules) assert.match(r, /var\(--art-pos, center 25%\)/, `${sel}: ${r.trim().slice(0, 120)}`);
  }
});
