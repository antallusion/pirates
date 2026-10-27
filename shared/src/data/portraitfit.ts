// A portrait in a round frame, one way everywhere — the game's HUD, chat, cards, tables and the captain's choice, the
// site's captains, rating, forum and shop (owner, 2026-10-26: «все лица должны находиться четко во фрейме … в чате
// иконка сильно сжимается, а рамка нет, и рамка прям наезжает на лицо … все выглядеть должно идеально на всех
// версиях сайта»).
//
// The avatar is a square box (its side the stock ring's outer side). Everything in it is a share of that side, so the
// ring and the portrait grow and shrink together and nothing can be squeezed apart:
//   the hole  a circle in the box's middle, its diameter the ring's measured hole (portraitfaces.ts RING_HOLES); the
//             portrait is the hole's background, the face (PORTRAIT_FACES) `FACE_AIM` of the hole's height and on its
//             middle line; a face painted near its picture's side is shown a little closer, so the picture still
//             covers the whole hole and the face stays in the middle (never a bare edge, never off-centre);
//   the ring  its picture laid so that its own hole is the box's hole. A cosmetic frame (`frame.*`) is drawn so its
//             hole is the stock ring's, at most FRAME_GROW_MAX times the box (a bulky frame's portrait is a little
//             smaller rather than the frame spreading over its neighbours).
// The tables are measured and drawn by tools/art/portrait_fit.py (its sheets use this arithmetic too).

import { PORTRAIT_FACES, RING_HOLES } from './portraitfaces.ts';

/** The share of the hole's height the face takes, and the most it may ever take (a face painted near its picture's side
 *  is shown a little closer so that it still stands on the hole's middle line). */
// (owner, 2026-10-26: «лица обрезаются рамкой, нужно брать вид более общий, чтобы часть тела залезала тоже … чтобы
// голова на рамку не лезла» — head and shoulders: the face a third of the hole, a little above its middle, so the hat
// and the hair stay inside the ring and the shoulders show below)
export const FACE_AIM = 0.32;
export const FACE_AIM_MAX = 0.6;
/** Where the face's middle stands, as a share of the hole's height from its top. */
export const FACE_Y = 0.44;
/** A face painted at its picture's very top rises above FACE_Y rather than the picture being blown up (owner,
 *  2026-10-27: the reaver's bald head filled the whole card), but its top keeps this share of the hole's height clear. */
export const FACE_TOP_MIN = 0.06;
/** How much wider than the ring's measured hole the portrait is laid (under the ring's inner lip). */
export const HOLE_BLEED = 1.12;
/** The most a cosmetic frame is drawn wider than the avatar's box. */
export const FRAME_GROW_MAX = 1.35;

/** A portrait's key (its file's name in assets/portraits) from a captain's portrait id (`portrait.reaver`), a bare key
 *  or the picture's address (`/assets/portraits/reaver.webp?v=1`). */
export function portraitKey(idOrUrl: string): string {
  const m = /portraits\/([\w-]+)\.\w+/.exec(idOrUrl);
  return m ? m[1] : idOrUrl.replace(/^portrait\./, '');
}

/** A portrait's face box [x, y, height] and the picture's height over its width; a picture not in the table is taken
 *  for a standing figure's (the face high in the middle). */
export function faceBox(key: string): readonly [number, number, number, number] {
  return PORTRAIT_FACES[portraitKey(key)] ?? [0.5, 0.18, 0.12, 1.3];
}

export interface FaceFit {
  /** The picture's width and height and its offset, in hole widths (the hole 1 wide, `hole` high). */
  iw: number; ih: number; ox: number; oy: number;
  /** The same as CSS: background-size and background-position. */
  size: string; pos: string;
}

const pct = (v: number) => `${(Math.round(v * 10000) / 100).toString()}%`;

/** The portrait set in a hole 1 wide and `hole` high (1: a circle; 4/3: the captain's choice's cards): the face `aim`
 *  of the hole's height, its middle always on the hole's vertical middle line (owner, 2026-10-27: «главное чтобы оно
 *  отцентровано к картинке было» — a face painted near its picture's side is shown a little closer rather than off
 *  the middle), at FACE_Y of the height unless the picture's top would show (then it rises, its top FACE_TOP_MIN clear);
 *  the picture always over the whole hole. */
export function faceFit(key: string, hole = 1, aim = FACE_AIM): FaceFit {
  const [cx, cy, fh, aspect] = faceBox(key);
  let ih = (aim * hole) / fh;
  let iw = ih / aspect;
  // cover the hole, and leave room on either side of the face's middle for half the hole
  let k = Math.max(1, 1 / iw, hole / ih, 0.5 / (cx * iw), 0.5 / ((1 - cx) * iw));
  // the face's top (when the picture's top edge holds it up) at least FACE_TOP_MIN below the hole's top
  const top = cy - fh / 2;
  if (top > 0) k = Math.max(k, (FACE_TOP_MIN * hole) / (top * ih));
  iw *= k;
  ih *= k;
  const x = Math.min(0, Math.max(1 - iw, 0.5 - cx * iw));
  const y = Math.min(0, Math.max(hole - ih, hole * FACE_Y - cy * ih));
  // background-position: the offset as a share of (box − picture)
  const px = iw - 1 > 1e-9 ? x / (1 - iw) : 0.5, py = ih - hole > 1e-9 ? y / (hole - ih) : 0.5;
  return { iw, ih, ox: x, oy: y, size: `${pct(iw)} auto`, pos: `${pct(px)} ${pct(py)}` };
}

/** The stock rings: the game's (`ui.ring`), the HUD's unit frame (`ui.portrait_ring`), the site's brass porthole. */
export type StockRing = 'ui' | 'portrait' | 'site';

export interface RingFit {
  /** The hole's diameter, the ring picture's width and height, its left and top — all shares of the box's side. */
  hole: number; w: number; h: number; left: number; top: number;
}

/** Where a ring's picture and its hole lie in a box whose stock ring is `stock`. `ring` is a stock ring, a cosmetic
 *  frame (`frame.gold` or `gold`) or null (no ring: the portrait fills the box). */
export function ringFit(ring: string | null, stock: StockRing = 'ui'): RingFit {
  if (!ring) return { hole: 1, w: 0, h: 0, left: 0, top: 0 };
  const id = RING_HOLES[ring] ? ring : `frame.${ring}`;
  const r = RING_HOLES[id] ?? RING_HOLES[stock];
  const base = RING_HOLES[stock];
  const s = r === base ? 1 : Math.min(FRAME_GROW_MAX, base.d / r.d);
  return { hole: r.d * s, w: s, h: s * r.aspect, left: 0.5 - r.x * s, top: 0.5 - r.y * r.aspect * s };
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '%27').replace(/</g, '&lt;');

export interface AvatarOpts {
  /** The portrait: a captain's portrait id, a key, or the picture's address (the key is read from it). */
  face: string;
  /** The picture's address (null: the ring and the dark hole only). */
  url: string | null;
  /** The box's side, a CSS length (`48px`, `var(--chat-face)`); the default leaves it to the stylesheet's `--pav`. */
  size?: string;
  /** The ring: a stock ring or a cosmetic frame's id; null: no ring (the portrait the whole box, a thin rim). */
  ring?: string | null;
  /** The ring's picture (the caller's asset lookup). A ring with no picture is drawn as a thin brass rim. */
  ringUrl?: string | null;
  /** The stock ring of the place (sets the hole a cosmetic frame is fitted to). */
  stock?: StockRing;
  /** More classes, attributes (already escaped) and inner markup (badges over the ring). */
  cls?: string; attrs?: string; inner?: string;
  /** The element: a span (default), a button, an anchor. */
  tag?: 'span' | 'button' | 'a';
  /** Pictures lazily (the site's long lists). */
  lazy?: boolean;
}

/** The avatar's markup: `.pav` (the box) › `.pav-face` (the hole, the portrait its background) + `img.pav-ring`. */
export function avatarHtml(o: AvatarOpts): string {
  const stock = o.stock ?? 'ui';
  const ring = o.ring === undefined ? stock : o.ring;
  const g = ringFit(ring, stock);
  const f = faceFit(o.face);
  const key = portraitKey(o.face);
  // (owner, 2026-10-26: a dark band showed between the face and the brass — the ring's inner lip is dark and
  // half-clear) the portrait runs a little under the ring's inner edge, so the brass covers the seam
  const hb = Math.min(0.98, g.hole * HOLE_BLEED);
  const inset = pct((1 - hb) / 2), side = pct(hb);
  const bg = o.url ? `;background-image:url('${escAttr(o.url)}');background-size:${f.size};background-position:${f.pos}` : '';
  const face = `<span class="pav-face" style="left:${inset};top:${inset};width:${side};height:${side}${bg}"></span>`;
  const ringEl = ring && o.ringUrl
    ? `<img class="pav-ring" src="${escAttr(o.ringUrl)}" alt="" draggable="false"${o.lazy ? ' loading="lazy" decoding="async"' : ''} style="left:${pct(g.left)};top:${pct(g.top)};width:${pct(g.w)};height:${pct(g.h)}">`
    : '';
  const tag = o.tag ?? 'span';
  const cls = `pav${ring ? (o.ringUrl ? '' : ' pav-rim') : ' pav-bare'}${ring && ring !== stock ? ' pav-framed' : ''}${o.cls ? ` ${o.cls}` : ''}`;
  const style = o.size ? ` style="--pav:${escAttr(o.size)}"` : '';
  return `<${tag} class="${cls}"${style} data-pav="${escAttr(key)}"${tag === 'button' ? ' type="button"' : ''}${o.attrs ? ` ${o.attrs}` : ''}>${face}${ringEl}${o.inner ?? ''}</${tag}>`;
}

/** A portrait as the background of a rectangle `hole` times as high as it is wide (a card, a sheet's portrait): the
 *  face `aim` of the height, in the middle — the inline style's background-size and -position. */
export function faceBgStyle(face: string, hole: number, aim: number): string {
  const f = faceFit(face, hole, aim);
  return `background-size:${f.size};background-position:${f.pos}`;
}
