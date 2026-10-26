// The portraits in their round frames (owner, 2026-10-26: «все лица должны находиться четко во фрейме … в чате иконка
// сильно сжимается, а рамка нет, и рамка прям наезжает на лицо»): every portrait shown in a ring has its face box, the
// face lands in the hole's middle at the same share at every size, the picture covers the hole, every frame has its
// measured hole, and the avatar's box cannot be squeezed (shared/src/data/portraitfit.ts, tools/art/portrait_fit.py).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CAPTAINS, CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { FRAMES } from '../shared/src/data/cosmetics.ts';
import { PORTRAIT_FACES, RING_HOLES } from '../shared/src/data/portraitfaces.ts';
import { FACE_AIM, FACE_AIM_MAX, FRAME_GROW_MAX, avatarHtml, faceBox, faceFit, portraitKey, ringFit } from '../shared/src/data/portraitfit.ts';

/** A WebP's pixel size from its header (VP8, VP8L or VP8X). */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

const PORTRAITS = readdirSync('assets/portraits').filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));

test('every portrait in assets/portraits has its face box, and its picture\'s aspect as measured', () => {
  assert.ok(PORTRAITS.length >= 90);
  for (const k of PORTRAITS) {
    const e = PORTRAIT_FACES[k];
    assert.ok(e, `${k}: no face box (tools/art/portrait_fit.py FACES)`);
    const [w, h] = webpSize(`assets/portraits/${k}.webp`);
    assert.ok(Math.abs(e[3] - h / w) < 0.002, `${k}: aspect ${e[3]} vs the file's ${(h / w).toFixed(4)}`);
    const [x, y, fh] = e;
    assert.ok(x > 0.2 && x < 0.8 && y > 0.03 && y < 0.6 && fh > 0.05 && fh < 0.45, `${k}: a face box out of reason ${e.join(' ')}`);
  }
  assert.deepEqual(Object.keys(PORTRAIT_FACES).filter((k) => !PORTRAITS.includes(k)), [], 'face boxes of pictures that are gone');
});

test('the portraits used in rings: the six captains, the 24 stand-in faces, the forum\'s avatars, the officers — each has a face', () => {
  const used = [...CAPTAIN_IDS.map((id) => portraitKey(CAPTAINS[id].portrait)), ...Array.from({ length: 24 }, (_, i) => `pirate_${String(i).padStart(2, '0')}`),
    ...PORTRAITS.filter((k) => /^(officer|giver|res|baron|skipper)_/.test(k))];
  for (const k of used) assert.ok(PORTRAIT_FACES[k], `${k}: no face box`);
  assert.equal(portraitKey('portrait.reaver'), 'reaver');
  assert.equal(portraitKey('/assets/portraits/admiral.m.webp?v=3'), 'admiral');
  assert.equal(portraitKey('https://x.y/assets/portraits/pirate_07.avif?v=1'), 'pirate_07');
});

test('the face in the hole\'s middle, the same share of it, the picture over the whole hole (no bare edge)', () => {
  for (const k of PORTRAITS) {
    const f = faceFit(k);
    const [x, y, fh] = faceBox(k);
    assert.ok(f.iw >= 1 - 1e-9 && f.ih >= 1 - 1e-9, `${k}: the picture covers the hole`);
    assert.ok(f.ox <= 1e-9 && f.ox >= 1 - f.iw - 1e-9 && f.oy <= 1e-9 && f.oy >= 1 - f.ih - 1e-9, `${k}: no bare edge`);
    const share = fh * f.ih;
    assert.ok(share >= FACE_AIM - 0.005 && share <= FACE_AIM_MAX + 0.005, `${k}: the face ${share.toFixed(2)} of the hole`);
    const cx = f.ox + x * f.iw, cy = f.oy + y * f.ih;
    assert.ok(Math.abs(cx - 0.5) < 0.02 && Math.abs(cy - 0.5) < 0.02, `${k}: the face's middle at ${cx.toFixed(3)}, ${cy.toFixed(3)}`);
    // the face whole inside the hole (its box, as wide as 0.8 of its height)
    const hw = (fh * f.ih * 0.8) / 2, hh = (fh * f.ih) / 2;
    assert.ok(Math.hypot(Math.max(Math.abs(cx - 0.5) + hw, 0), Math.abs(cy - 0.5) + hh) < 0.62, `${k}: the face's corners near the rim`);
    // the CSS says the same: background-position is the offset over (hole − picture)
    const [px, py] = f.pos.split(' ').map((v) => parseFloat(v) / 100);
    if (f.iw > 1.0001) assert.ok(Math.abs(px * (1 - f.iw) - f.ox) < 0.001, `${k}: position x`);
    if (f.ih > 1.0001) assert.ok(Math.abs(py * (1 - f.ih) - f.oy) < 0.001, `${k}: position y`);
    assert.ok(Math.abs(parseFloat(f.size) / 100 - f.iw) < 0.001 && f.size.endsWith(' auto'), `${k}: the size keeps the picture's aspect`);
  }
});

test('every frame has its measured hole; a frame\'s hole is the avatar\'s, the ring and the face scaled together', () => {
  for (const s of ['ui', 'portrait', 'site']) assert.ok(RING_HOLES[s], `stock ring ${s}`);
  for (const f of FRAMES) {
    const r = RING_HOLES[`frame.${f.id}`];
    assert.ok(r, `frame ${f.id}: no measured hole`);
    assert.ok(r.d > 0.3 && r.d < 0.75 && Math.abs(r.x - 0.5) < 0.05 && Math.abs(r.y - 0.5) < 0.05, `frame ${f.id}: a hole out of reason`);
    for (const stock of ['ui', 'site'] as const) {
      const g = ringFit(f.id, stock);
      assert.ok(g.w <= FRAME_GROW_MAX + 1e-9, `${f.id}: no wider than ${FRAME_GROW_MAX} of the box`);
      // the frame's own hole lands on the box's middle, as wide as the portrait's circle
      assert.ok(Math.abs(g.left + r.x * g.w - 0.5) < 1e-9 && Math.abs(g.top + r.y * r.aspect * g.w - 0.5) < 1e-9, `${f.id}: hole in the middle`);
      assert.ok(Math.abs(g.hole - r.d * g.w) < 1e-9 && g.hole <= RING_HOLES[stock].d + 1e-9, `${f.id}: the portrait the frame's hole`);
    }
  }
  const html = avatarHtml({ face: 'portrait.reaver', url: '/assets/portraits/reaver.webp', ring: 'frame.gold', ringUrl: '/f.webp', size: '24px' });
  assert.match(html, /^<span class="pav pav-framed" style="--pav:24px" data-pav="reaver">/);
  // (every place in the box a share of its side: nothing in pixels but the side itself)
  assert.doesNotMatch(html.replace('--pav:24px', ''), /\d+px/);
});

test('the avatar\'s box cannot be squeezed: its size is --pav alone, held against any flex row', () => {
  for (const file of ['client/cosmetics.css', 'site/css/site.css']) {
    const css = readFileSync(file, 'utf8');
    const rule = /\.pav\.pav \{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const d of ['flex: none !important', 'width: var(--pav, 48px) !important', 'height: var(--pav, 48px) !important', 'min-width: var(--pav, 48px) !important', 'aspect-ratio: 1 !important']) {
      assert.ok(rule.includes(d), `${file}: .pav.pav has ${d}`);
    }
  }
});
