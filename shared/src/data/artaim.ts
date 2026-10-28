// A banner painting framed on its subject in a box of any size (owner, 2026-10-28: «большинство картинок в таких окошках
// отрезаны поверху, надо все выставить правильно и четко чтобы лица попадали в окошки и на мобиле и на десктопе и
// везде»). The pictures fill their boxes (`cover`); the centre crop of a wide box cut the heads of the standing figures.
// Now the subject's middle (artfocus.ts, measured by tools/art/art_focus.py) stands at FACE_AT of the window's height,
// the top that must stay in (a hat's crown) is never cut, and the subject never falls off the window's bottom; sideways
// its middle is as near the window's middle as the picture allows. The same arithmetic as the script's sheets.

import { ART_FOCUS } from './artfocus.ts';

export const FACE_AT = 0.42;
/** The top keeps this share of the window's height clear above it. */
export const TOP_PAD = 0.04;
/** The subject's middle at most this low in the window. */
export const LOW_MAX = 0.9;
/** A picture with no focus: a little above the middle, where the heads of a scene usually are. */
export const ART_POS_FALLBACK = 'center 25%';

/** A painting's key (its file's name) from its address (`/assets/cards/mg_star_bearing.webp?v=…`) or asset id. */
export function artKey(urlOrId: string): string {
  const m = /\/([\w-]+)\.(?:webp|avif|png|jpe?g)\b/.exec(urlOrId);
  return m ? m[1] : urlOrId.replace(/^(card|bg)\./, '');
}

/** The window [left, top, width, height] (shares of the picture) a box `bw`×`bh` shows of a cover-fitted picture of
 *  aspect `ar` (width over height) framed on focus [x, y, top]. */
export function aimWindow(f: readonly [number, number, number, ...unknown[]], ar: number, bw: number, bh: number): [number, number, number, number] {
  const [x, y, top] = f;
  const s = Math.max(bw / ar, bh); // the picture's height in box units
  const v = Math.min(1, bh / s), u = Math.min(1, bw / (s * ar));
  let t = Math.min(y - FACE_AT * v, top - TOP_PAD * v);
  t = Math.max(t, y - LOW_MAX * v);
  t = Math.min(Math.max(t, 0), 1 - v);
  const l = Math.min(Math.max(x - u / 2, 0), 1 - u);
  return [l, t, u, v];
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** The CSS `background-position` / `object-position` that frames the painting at `urlOrId` in a box `bw`×`bh`
 *  (`cover`); null for a picture with no focus or a box with no size. */
export function artAim(urlOrId: string, bw: number, bh: number): string | null {
  const f = ART_FOCUS[artKey(urlOrId)];
  if (!f || !(bw > 0) || !(bh > 0)) return null;
  const [l, t, u, v] = aimWindow(f, f[3], bw, bh);
  // a position p% lays the picture's p% on the box's p%: the window's offset over the room it has to move in
  const px = u < 1 - 1e-6 ? l / (1 - u) : 0.5, py = v < 1 - 1e-6 ? t / (1 - v) : 0.5;
  return `${pct(px)} ${pct(py)}`;
}
