// The painted pieces the things on the sea are made of (owner, 2026-10-07: «какие-то недоделанные иконки, типа знаки…
// у нас всё должно быть из ассетов сделано»): the brass ring of the UI (ui.ring) round a creature's token and a clock,
// the painted props and parts cut out and dyed for the small things afloat (the bottle of the missiles' sheet, the
// cannonball made an iron buoy, the chest and the lantern of the buried cache, the boat, the gull, the shark), the
// engraved rings of a mark, and the level's little plate as the ships' names wear it. Each is cut and dyed once into a
// small canvas and stamped after (the phone's frames); where the art has not loaded the caller draws its old hand-made
// shape. Strictly from above, at their own proportions: nothing is stretched (CLAUDE.md §3).

import { sprite } from '../assets.ts';

type G = CanvasRenderingContext2D;

/** A cut-out of a painting: the source rectangle (natural pixels), an outline to keep (a circle, or a polygon in the
 *  rectangle's own pixels), and a dye (the 'color' blend keeps the paint's light and shade). */
interface Piece {
  id: string;
  crop?: [number, number, number, number];
  clip?: 'circle' | [number, number][];
  dye?: string;
  dyeA?: number;
  /** The longest side of the cached canvas (px): enough for the biggest it is drawn. */
  px?: number;
}

/** The pieces, by name. The crops are in the paintings' own pixels (assets/manifest.json's files). */
export const PIECES = {
  /** A corked green bottle (the missiles' sheet's flask, the arrow beside it cut away). */
  bottle: { id: 'part.ms_flask', crop: [0, 0, 112, 95] },
  /** An iron ball afloat, rusted copper: a lane buoy from above (the cannonball, its smoke cut away). */
  buoy: { id: 'part.ms_cannonball', crop: [76, 0, 84, 83], clip: 'circle', dye: '#6e4126', dyeA: 0.5 },
  /** The same ball dull red: a captain's pot buoy, a regatta's mark. */
  redBuoy: { id: 'part.ms_cannonball', crop: [76, 0, 84, 83], clip: 'circle', dye: '#7a1f1a', dyeA: 0.62 },
  /** The iron-bound chest of the buried cache, lifted out of its pit. */
  chest: { id: 'prop.cache', crop: [200, 140, 380, 340], clip: [[58, 8], [372, 92], [330, 334], [8, 242]], px: 200 },
  /** The cache's ship's lantern, cut out of the soil. */
  lantern: { id: 'prop.cache', crop: [500, 425, 175, 225], clip: [[98, 4], [140, 20], [170, 70], [120, 222], [62, 214], [10, 168], [60, 36]], px: 160 },
  /** The ship's boat (the islands' life sheet), the swamped one dyed dark. */
  boat: { id: 'prop.life_boat', px: 220 },
  drownedBoat: { id: 'prop.life_boat', dye: '#20382e', dyeA: 0.55, px: 220 },
  /** The fisherman's net with its iron weights. */
  net: { id: 'part.ms_net', px: 160 },
  /** A length of chain between two shot. */
  chain: { id: 'part.ms_chain', crop: [56, 0, 104, 42] },
  /** Weed and moss in a mat (the mossy isles' clump), dyed to the sea's olive. */
  weed: { id: 'prop.decor_mossy', dye: '#3a4a26', dyeA: 0.35, px: 240 },
  /** Gun smoke over a fight under way. */
  smoke: { id: 'part.smoke', px: 160 },
  /** White water: spray about anything that breaks the swell. */
  splash: { id: 'part.splash', px: 200 },
  /** A pennant (dyed on use). */
  pennant: { id: 'part.pennant', px: 256 },
} satisfies Record<string, Piece>;
export type PieceName = keyof typeof PIECES;

const cache = new Map<string, HTMLCanvasElement>();

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** A piece cut (and dyed, when `dye` is given or the piece has its own) into its own canvas, or null while the art
 *  has not loaded. */
export function piece(name: PieceName, dye?: string, dyeA = 0.6): HTMLCanvasElement | null {
  const p: Piece = PIECES[name];
  const tone = dye ?? p.dye;
  const key = `${name}|${tone ?? ''}|${dye ? dyeA : p.dyeA ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spr = sprite(p.id);
  if (!spr) return null;
  const img = spr.img;
  const [sx, sy, sw, sh] = p.crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  const k = Math.min(1, (p.px ?? 256) / Math.max(sw, sh));
  const c = canvas(sw * k, sh * k);
  if (!c) return null;
  const x = c.getContext('2d')!;
  x.scale(k, k);
  if (p.clip) {
    x.beginPath();
    if (p.clip === 'circle') x.arc(sw / 2, sh / 2, Math.min(sw, sh) / 2 - 0.5, 0, Math.PI * 2);
    else p.clip.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
    x.clip();
  }
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (tone) {
    // The 'color' blend takes the dye's hue and keeps the paint's light; then the cut-out's own outline again.
    const shade = canvas(c.width, c.height)!;
    const s = shade.getContext('2d')!;
    s.drawImage(c, 0, 0);
    s.globalCompositeOperation = 'color';
    s.fillStyle = tone;
    s.fillRect(0, 0, c.width, c.height);
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(c, 0, 0);
    x.globalAlpha = dye ? dyeA : p.dyeA ?? 0.6;
    x.drawImage(shade, 0, 0);
    x.globalAlpha = 1;
  }
  cache.set(key, c);
  return c;
}

/** A piece at (x, y), its longest side `size` px, turned `rot`; false while the art has not loaded. */
export function drawPiece(g: G, name: PieceName, x: number, y: number, size: number, rot = 0, alpha = 1, dye?: string): boolean {
  const c = piece(name, dye);
  if (!c) return false;
  const k = size / Math.max(c.width, c.height);
  const w = c.width * k, h = c.height * k;
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  if (rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.drawImage(c, -w / 2, -h / 2, w, h);
    g.restore();
  } else g.drawImage(c, x - w / 2, y - h / 2, w, h);
  g.globalAlpha = a0;
  return true;
}

/** A whole sprite at (x, y), its longest side `size`, turned `rot` (the art faces up its image); false while missing. */
export function drawArt(g: G, id: string, x: number, y: number, size: number, rot = 0, alpha = 1): boolean {
  const spr = sprite(id);
  if (!spr) return false;
  const iw = spr.img.naturalWidth, ih = spr.img.naturalHeight;
  const k = size / Math.max(iw, ih);
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(spr.img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k);
  g.restore();
  g.globalAlpha = a0;
  return true;
}

// ------------------------------------------------------------------------------------------------ the brass ring

/** ui.ring's opening: its diameter as a share of the painting's side (measured: 160 of 256 px). */
const RING_OPEN = 0.63;
/** Its outer edge's radius as a share of the opening's radius. */
export const RING_OUTER = 0.93 / RING_OPEN;

/** The UI's brass ring round a circle of radius `r` at (x, y) (its opening on the circle's edge); false while missing. */
export function brassRing(g: G, x: number, y: number, r: number, alpha = 1): boolean {
  const spr = sprite('ui.ring');
  if (!spr) return false;
  const S = (2 * r) / RING_OPEN;
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  g.drawImage(spr.img, x - S / 2, y - S / 2, S, S);
  g.globalAlpha = a0;
  return true;
}

// ------------------------------------------------------------------------------------------------ stamps

const stamps = new Map<string, HTMLCanvasElement>();
/** A stamp's size in CSS px. */
const cssSize = new WeakMap<HTMLCanvasElement, [number, number]>();
/** A stamp drawn centred on (x, y) at its own size. */
export function put(g: G, c: HTMLCanvasElement, x: number, y: number): void {
  const [w, h] = cssSize.get(c) ?? [c.width, c.height];
  g.drawImage(c, x - w / 2, y - h / 2, w, h);
}
/** What does not change from frame to frame drawn once into a small canvas (in CSS px, at the screen's density) and
 *  stamped after. `draw` returns false when its art is still loading: nothing is kept then. */
export function stamp(key: string, w: number, h: number, draw: (g: G) => boolean): HTMLCanvasElement | null {
  const hit = stamps.get(key);
  if (hit) return hit;
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  const c = canvas(w * dpr, h * dpr);
  if (!c) return null;
  const x = c.getContext('2d')!;
  x.scale(dpr, dpr);
  if (!draw(x)) return null;
  cssSize.set(c, [w, h]);
  if (stamps.size > 500) stamps.clear();
  stamps.set(key, c);
  return c;
}

// ------------------------------------------------------------------------------------------------ tokens

/** A creature's token, strictly from above: its shadow on the water, its picture in a dark disc of radius `R * TOKEN_IN`
 *  and the brass ring round it; grey and wreathed in gun smoke while a fight is on. `face` paints the picture (the
 *  caller clips nothing). Stamped per key; null while the art loads. */
export const TOKEN_IN = 0.82;
export function tokenStamp(key: string, R: number, face: (g: G, cx: number, cy: number, r: number) => boolean, fight: boolean): HTMLCanvasElement | null {
  const S = Math.ceil(R * 3.2);
  return stamp(`tok|${key}|${Math.round(R)}|${fight ? 1 : 0}`, S, S, (g) => {
    const c = S / 2, r = R * TOKEN_IN;
    // The shadow it casts on the water, down and to the right (the moon's side, docs/06 §5.2).
    const sh = g.createRadialGradient(c + R * 0.14, c + R * 0.24, R * 0.6, c + R * 0.14, c + R * 0.24, R * 1.45);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(c + R * 0.14, c + R * 0.24, R * 1.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0e1418';
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.clip();
    if (!face(g, c, c, r)) {
      g.restore();
      return false;
    }
    // A soft vignette inside the ring: the picture sits in the brass rather than on it.
    const v = g.createRadialGradient(c, c, r * 0.55, c, c, r);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v;
    g.fillRect(c - r, c - r, r * 2, r * 2);
    if (fight) {
      const sm = piece('smoke');
      if (sm) {
        g.globalAlpha = 0.62;
        g.drawImage(sm, c - r * 1.15, c - r * 1.05, r * 2.3, r * 2.3);
        g.globalAlpha = 1;
      }
    }
    g.restore();
    if (!brassRing(g, c, c, r, fight ? 0.75 : 1)) return false;
    return true;
  });
}

/** The thin enamel bezel inside a token's brass in the ladder's colour (its danger to her ship), breathing. */
export function bezel(g: G, x: number, y: number, R: number, col: string, a: number): void {
  const r = R * TOKEN_IN;
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = col;
  g.lineWidth = Math.max(1.2, R * 0.06);
  g.beginPath();
  g.arc(x, y, r - g.lineWidth / 2, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------------------------------------ marks and rings

/** An engraved ring (a mark, a target, a reach): a dark groove under a line of colour, and four short gunsight ticks
 *  at the compass points — whole and bright when `strong`, a fainter ring when not. Never dashed. */
export function markRing(g: G, x: number, y: number, r: number, col: string, strong: boolean, a = 1): void {
  g.save();
  const w = strong ? 2 : 1.4;
  g.lineCap = 'round';
  g.globalAlpha = a * (strong ? 0.55 : 0.4);
  g.strokeStyle = '#05080a';
  g.lineWidth = w + 2.4;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = a * (strong ? 0.95 : 0.55);
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  const t = Math.max(4, Math.min(9, r * 0.14));
  for (let i = 0; i < 4; i++) {
    const c = Math.cos((i * Math.PI) / 2), s = Math.sin((i * Math.PI) / 2);
    g.moveTo(x + c * (r - t * 0.55), y + s * (r - t * 0.55));
    g.lineTo(x + c * (r + t * 0.75), y + s * (r + t * 0.75));
  }
  g.stroke();
  g.restore();
}

/** A clock in a brass bezel (a small thing's time left): an enamel wedge for what is left. */
export function clockBadge(g: G, x: number, y: number, r: number, share: number, col: string): void {
  g.save();
  g.fillStyle = 'rgba(8,10,12,0.85)';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const s = Math.max(0, Math.min(1, share));
  if (s > 0) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r * 0.86, -Math.PI / 2, -Math.PI / 2 + s * Math.PI * 2);
    g.closePath();
    g.fill();
  }
  g.restore();
  if (!brassRing(g, x, y, r * 0.92)) {
    g.strokeStyle = '#8c6b3a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
  }
}

// ------------------------------------------------------------------------------------------------ the level's plate

const tagW = new Map<string, number>();
/** HoMM3's word and the level as the ships' names wear it: the level in a small frame in the ladder's colour, the word
 *  in pale bone beside it — centred on (x, y), stamped. `clock` puts a small clock before it (a drift's, a find's).
 *  Returns the plate's half width. */
export function levelTag(g: G, word: string, level: number | string | null, col: string, x: number, y: number, size = 11, wordCol = '#e9dfc6'): number {
  const key = `tag|${word}|${level}|${col}|${size}|${wordCol}`;
  const fBadge = `700 ${size - 1}px Inter, sans-serif`, fWord = `600 ${size}px Inter, sans-serif`;
  let w = tagW.get(key);
  let pill = 0;
  if (w === undefined) {
    g.save();
    g.font = fBadge;
    pill = level === null ? 0 : Math.ceil(g.measureText(String(level)).width) + 8;
    g.font = fWord;
    w = pill + (pill ? 4 : 0) + Math.ceil(g.measureText(word).width) + 6;
    g.restore();
    if (tagW.size > 600) tagW.clear();
    tagW.set(key, w);
  }
  const W = w, H = size + 8;
  const c = stamp(key, W, H, (s) => {
    s.font = fBadge;
    const pw = level === null ? 0 : Math.ceil(s.measureText(String(level)).width) + 8;
    const top = (H - (size + 3)) / 2;
    if (pw) {
      s.fillStyle = 'rgba(8,10,14,0.82)';
      s.beginPath();
      s.roundRect(1, top, pw, size + 3, 3);
      s.fill();
      s.strokeStyle = col;
      s.lineWidth = 1;
      s.stroke();
      s.fillStyle = col;
      s.textAlign = 'center';
      s.textBaseline = 'middle';
      s.fillText(String(level), 1 + pw / 2, H / 2 + 0.5);
    }
    s.font = fWord;
    s.textAlign = 'left';
    s.textBaseline = 'middle';
    const tx = pw ? pw + 5 : 3;
    s.lineWidth = 3;
    s.lineJoin = 'round';
    s.strokeStyle = 'rgba(0,0,0,0.8)';
    s.strokeText(word, tx, H / 2 + 0.5);
    s.fillStyle = wordCol;
    s.fillText(word, tx, H / 2 + 0.5);
    return true;
  });
  if (c) g.drawImage(c, x - W / 2, y - H / 2, W, H);
  return W / 2;
}

/** A plain word under a thing (its kind's name), outlined, stamped. */
export function word(g: G, text: string, x: number, y: number, col: string, size = 10.5): void {
  const key = `w|${text}|${col}|${size}`;
  const font = `600 ${size}px Inter, sans-serif`;
  let w = tagW.get(key);
  if (w === undefined) {
    g.save();
    g.font = font;
    w = Math.ceil(g.measureText(text).width) + 8;
    g.restore();
    tagW.set(key, w);
  }
  const W = w, H = size + 8;
  const c = stamp(key, W, H, (s) => {
    s.font = font;
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.lineWidth = 3;
    s.lineJoin = 'round';
    s.strokeStyle = 'rgba(0,0,0,0.8)';
    s.strokeText(text, W / 2, H / 2);
    s.fillStyle = col;
    s.fillText(text, W / 2, H / 2);
    return true;
  });
  if (c) g.drawImage(c, x - W / 2, y - H / 2, W, H);
}

// ------------------------------------------------------------------------------------------------ the water

/** White water about anything afloat: the painted spray, faint and turning slowly, instead of a drawn ring. */
export function foam(g: G, x: number, y: number, R: number, t: number, seed: number, a = 0.2): void {
  const c = piece('splash');
  if (!c) return;
  const s = R * 2.7 * (1 + 0.04 * Math.sin(t * 1.3 + seed));
  g.save();
  g.globalAlpha = a * (0.85 + 0.15 * Math.sin(t * 1.1 + seed));
  g.translate(x, y);
  g.rotate(seed * 0.7 + t * 0.04);
  g.scale(1, 0.86);
  g.drawImage(c, -s / 2, -s / 2, s, s);
  g.restore();
}

/** Creatures circling a thing (gulls overhead, fins in the water): `n` of the painted kind, nose along the circle. */
export function circlers(g: G, id: string, x: number, y: number, radius: number, size: number, n: number, t: number, seed: number, speed = 0.4, alpha = 1): boolean {
  const spr = sprite(id);
  if (!spr) return false;
  const iw = spr.img.naturalWidth, ih = spr.img.naturalHeight;
  const k = size / Math.max(iw, ih);
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * alpha;
  for (let i = 0; i < n; i++) {
    const a = t * speed + seed + (i * Math.PI * 2) / n;
    const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * 0.85;
    g.save();
    g.translate(px, py);
    g.rotate(a + Math.PI); // its nose along its way round (the art faces up)
    g.drawImage(spr.img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k);
    g.restore();
  }
  g.globalAlpha = a0;
  return true;
}

// ------------------------------------------------------------------------------------------------ what the aim keeps off

/** The tokens on the screen this frame (their centre and radius): the hover aim is not drawn over one (a click there
 *  marks it, it fires nothing), and the aim's dots keep off them. The renderer clears it each frame. */
export const hot: { x: number; y: number; r: number }[] = [];
export function addHot(x: number, y: number, r: number): void {
  if (hot.length < 64) hot.push({ x, y, r });
}
export function inHot(x: number, y: number, pad = 0): boolean {
  for (const h of hot) if ((x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + pad) ** 2) return true;
  return false;
}
