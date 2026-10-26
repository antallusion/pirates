// A portrait as the background of a round element that draws its own ring (the battle's faces): the face in the
// middle, FACE_AIM of the circle's height — the same arithmetic as the avatar's (shared/src/data/portraitfit.ts; the
// face boxes are measured by tools/art/portrait_fit.py). tools/mobile/ux/crop.js checks that the head stands whole
// inside the circle (data-face: its middle as shares of the picture's width and height, its half-height of the width).

import { faceBox, faceFit, portraitKey } from '../../../../shared/src/data/portraitfit.ts';

/** The inline style and attributes for an element whose background is the portrait. */
export function faceAttrs(id: string, url: string | null): string {
  if (!url) return '';
  const key = /portraits\//.test(url) ? portraitKey(url) : portraitKey(id);
  const f = faceFit(key);
  const [x, y, h, aspect] = faceBox(key);
  return `data-crop="face" data-pav="${key}" data-face="${x} ${y} ${((h * aspect) / 2).toFixed(3)}" style="background-image:url('${url}');background-size:${f.size};background-position:${f.pos}"`;
}
