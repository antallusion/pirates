// A captain's face in a round frame (owner, 2026-10-07: «аватарки обрезаются у всех»). The portraits are whole figures
// (422×560); a round frame shows the head and shoulders, the head whole and a little above the middle, and the frame's
// ring lies outside the picture, never over it. The head of each portrait, read off the paintings: its middle as shares
// of the width and the height, its radius (with the hat or the hood) as a share of the width. tools/mobile/ux/crop.js
// checks that the head stands whole inside the circle (data-face).

export type Face = readonly [x: number, y: number, r: number];

export const FACES: Readonly<Record<string, Face>> = {
  corsair: [0.47, 0.13, 0.17],
  smuggler: [0.5, 0.15, 0.16],
  reaver: [0.48, 0.085, 0.095],
  navigator: [0.53, 0.13, 0.15],
  drowned: [0.62, 0.21, 0.19],
  admiral: [0.42, 0.11, 0.13],
};

/** The stand-in faces (`pirate_00`…`pirate_23`, a sheet of busts 448×560): the head a third of the way down. */
export const PIRATE_FACE: Face = [0.5, 0.33, 0.23];

/** A portrait not in the list: the head where a standing figure's usually is. */
export const FACE_DEFAULT: Face = [0.5, 0.15, 0.16];

/** How much of the circle's width the head takes. */
export const HEAD_SHARE = 0.5;

/** The background-size and -position that set a portrait's head in a round frame, and the data-face for the check.
 *  `aspect` is the picture's height over its width. The picture always covers the circle (no bare edge). */
export function faceCrop(id: string, aspect = 560 / 422): { size: string; pos: string; face: string } {
  const [fx, fy, fr] = FACES[id.replace(/^portrait\./, '')] ?? FACE_DEFAULT;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  // The head HEAD_SHARE of the circle; a head painted near the picture's edge (the Reaver's at its very top) cannot be
  // brought to the middle without a bare edge, so it is shown smaller until it stands whole inside the circle.
  let out = { size: '100% auto', pos: '50% 50%', face: `${fx} ${fy} ${fr}` };
  for (let share = HEAD_SHARE; share >= 0.24; share -= 0.02) {
    // the picture's width in circles, never narrower than the circle
    const s = Math.max(1, share / (2 * fr));
    const px = s > 1 ? clamp(((0.5 - fx * s) / (1 - s)) * 100) : 50;
    const sh = s * aspect;
    const py = sh > 1 ? clamp(((0.46 - fy * sh) / (1 - sh)) * 100) : 50;
    out = { size: `${(s * 100).toFixed(1)}% auto`, pos: `${px.toFixed(1)}% ${py.toFixed(1)}%`, face: `${fx} ${fy} ${fr}` };
    // where the head stands, in circle units (the circle 1 wide, its middle at 0.5, 0.5)
    const hx = (px / 100) * (1 - s) + fx * s, hy = (py / 100) * (1 - sh) + fy * sh;
    if (Math.hypot(hx - 0.5, hy - 0.5) + fr * s <= 0.49) break;
  }
  return out;
}

/** A face set in the very middle of a small round frame (owner, 2026-10-19: «аватарка в чате — там лицо капитана не
 *  отцентровано»): the head `share` of the circle's width, its middle at (0.5, `cy`) — the picture moved as far as that
 *  takes, the frame's dark ground showing at an edge where the head is painted near the picture's own (faceCrop keeps
 *  the picture over the whole circle instead, and a head at the very top of its painting stayed at the circle's top).
 *  The picture is never narrower than the circle. */
export function faceCentred(id: string, aspect = 560 / 422, share = 0.6, cy = 0.47): { size: string; pos: string; face: string } {
  const key = id.replace(/^portrait\./, '');
  const [fx, fy, fr] = FACES[key] ?? (/^pirate_\d+$/.test(key) ? PIRATE_FACE : FACE_DEFAULT);
  const s = Math.max(1.05, share / (2 * fr));
  const sh = s * aspect;
  // background-position's share of (circle − picture): the head's middle onto the circle's (0.5, cy)
  const px = ((0.5 - fx * s) / (1 - s)) * 100, py = ((cy - fy * sh) / (1 - sh)) * 100;
  return { size: `${(s * 100).toFixed(1)}% auto`, pos: `${px.toFixed(1)}% ${py.toFixed(1)}%`, face: `${fx} ${fy} ${fr}` };
}

/** The same as an inline style and attributes for an element whose background is the portrait. */
export function faceAttrs(id: string, url: string | null): string {
  if (!url) return '';
  const c = faceCrop(id);
  return `data-crop="face" data-face="${c.face}" style="background-image:url('${url}');background-size:${c.size};background-position:${c.pos}"`;
}
