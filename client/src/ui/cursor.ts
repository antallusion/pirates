// The attack cursor (owner, 2026-10-07: «при абордаже именно когда вот есть атака надо при наведении на цель
// показывать иконку атаки»). Over something she may fight, the mouse becomes a painted mark of how the fight would go:
//   board   a ship the grapples reach now — the grappling hook          (icon.tattoo_hook)
//   guns    a ship no grapple takes (a beast, a zone boss, «Абордаж: выкл»), a fort's battery still firing — the gun
//                                                                         (icon.tattoo_cannon)
//   attack  any other foe: a ship to run down and board, a creature stack, a lair, a stack in the hex battle — the
//           crossed sabres                                               (icon.tattoo_sabres)
// The three are the tattoo set's own drawings (assets/icons/tattoo_*.webp, one hand, one ink): the skin they are
// inked on is cleared here, in a canvas, and each stands on the sea with a dark halo and a faint gold edge. Nothing is
// painted anew (CLAUDE.md §2). A touch screen has no hover: the same mark stands over the target she marked (main.ts).

import { sprite } from '../assets.ts';

export type AttackKind = 'attack' | 'board' | 'guns';

export const CURSOR_ART: Readonly<Record<AttackKind, string>> = {
  attack: 'icon.tattoo_sabres',
  board: 'icon.tattoo_hook',
  guns: 'icon.tattoo_cannon',
};

/** The cursor's side in CSS pixels (Chrome draws cursors up to 128; the arrow is 32). */
export const CURSOR_PX = 48;

/** What lies under the pointer, as the attack cursor needs it. */
export interface HoverFacts {
  ship?: { attackable: boolean; boardable: boolean; inReach: boolean };
  /** A creature stack that is no one else's fight. */
  stack?: boolean;
  /** A lair of the land's creatures, standing (not hers, not beaten); a pirate fort, `battery` while its guns fire. */
  lair?: { battery: boolean };
}

/** The mark for what is under the pointer, or none. Pure. */
export function attackKind(f: HoverFacts): AttackKind | null {
  if (f.ship) {
    if (!f.ship.attackable) return null;
    if (!f.ship.boardable) return 'guns';
    return f.ship.inReach ? 'board' : 'attack';
  }
  if (f.stack) return 'attack';
  if (f.lair) return f.lair.battery ? 'guns' : 'attack';
  return null;
}

/** The tattoo's skin: a warm, fairly saturated, not dark tone (the ink is grey steel, black lines, dark wood). */
function skinTone(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 72) return false;
  const s = (mx - mn) / mx;
  if (s < 0.22) return false;
  // the hue: red to orange (the skin), never the steel's blue-grey
  let h = 0;
  if (mx === r) h = ((g - b) / (mx - mn)) / 6;
  else if (mx === g) h = (2 + (b - r) / (mx - mn)) / 6;
  else h = (4 + (r - g) / (mx - mn)) / 6;
  if (h < 0) h += 1;
  return h < 0.12 || h > 0.95;
}

/**
 * Clears the skin a tattoo is inked on, in place (RGBA, `w`×`h`): the skin is grown from the picture's edge through
 * skin-toned neighbours that differ little from each other (the ink's strong lines stop it), then the ink's own edge
 * is pulled in a pixel and softened. Returns how many pixels stay. Pure (no DOM): tests run it on made-up pictures.
 */
export function keySkin(px: Uint8ClampedArray, w: number, h: number): number {
  const n = w * h;
  const bg = new Uint8Array(n);
  const q = new Int32Array(n);
  let qh = 0, qt = 0;
  const at = (i: number) => skinTone(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const seed = (i: number) => {
    if (!bg[i] && at(i)) {
      bg[i] = 1;
      q[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || bg[j] || !at(j)) continue;
      const d = Math.max(Math.abs(px[j * 4] - px[i * 4]), Math.abs(px[j * 4 + 1] - px[i * 4 + 1]), Math.abs(px[j * 4 + 2] - px[i * 4 + 2]));
      if (d >= 26) continue;
      bg[j] = 1;
      q[qt++] = j;
    }
  }
  // The ink pulled in a pixel (the skin's glow round every line goes), its edge softened by the neighbours.
  const a = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let keep = 1;
    for (let dy = -1; dy <= 1 && keep; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || bg[yy * w + xx]) { keep = 0; break; }
    }
    a[y * w + x] = keep ? 255 : 0;
  }
  let kept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      s += a[yy * w + xx] * (dx === 0 && dy === 0 ? 4 : 1);
      c += dx === 0 && dy === 0 ? 4 : 1;
    }
    const v = Math.round(s / c);
    px[(y * w + x) * 4 + 3] = v;
    if (v > 128) kept++;
  }
  return kept;
}

const urls = new Map<AttackKind, string>();

/** The mark of a kind as a picture's address (the touch screen's mark over her target), once the art is in. */
export function cursorUrl(kind: AttackKind): string | null {
  return urls.get(kind) ?? null;
}

/** Each mark drawn once the art has loaded: its address kept, and the page's cursors (`--cur-attack`, `--cur-board`,
 *  `--cur-guns`, used by seahud.css) set. A picture that cannot be read (a CDN's without CORS) leaves the arrow. */
export function buildCursors(): void {
  for (const kind of Object.keys(CURSOR_ART) as AttackKind[]) {
    const s = sprite(CURSOR_ART[kind]);
    if (!s || !s.img.naturalWidth) continue;
    try {
      const W = 112;
      const src = document.createElement('canvas');
      src.width = src.height = W;
      const g = src.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(s.img, 0, 0, W, W);
      const d = g.getImageData(0, 0, W, W);
      keySkin(d.data, W, W);
      g.putImageData(d, 0, 0);
      // the mark on the sea: a dark halo round the ink, a faint gold edge outside it
      const P = CURSOR_PX * 2; // drawn at twice the size, then scaled (a sharper edge)
      const out = document.createElement('canvas');
      out.width = out.height = P;
      const o = out.getContext('2d')!;
      const m = P * 0.07;
      // a warm gold glow round the whole mark (it reads on the dark sea and on a busy deck alike)
      o.shadowColor = 'rgba(240, 196, 104, 0.95)';
      o.shadowBlur = P * 0.08;
      for (let i = 0; i < 2; i++) o.drawImage(src, m, m, P - 2 * m, P - 2 * m);
      // then a firm black edge hugging the ink
      o.shadowColor = 'rgba(0, 0, 0, 1)';
      o.shadowBlur = P * 0.035;
      for (let i = 0; i < 3; i++) o.drawImage(src, m, m, P - 2 * m, P - 2 * m);
      // the ink itself, a little brighter than on the skin
      o.shadowBlur = 0;
      o.filter = 'brightness(1.25) contrast(1.15)';
      o.drawImage(src, m, m, P - 2 * m, P - 2 * m);
      o.filter = 'none';
      const fin = document.createElement('canvas');
      fin.width = fin.height = CURSOR_PX;
      const f = fin.getContext('2d')!;
      f.imageSmoothingQuality = 'high';
      f.drawImage(out, 0, 0, CURSOR_PX, CURSOR_PX);
      const url = fin.toDataURL('image/png');
      urls.set(kind, url);
      const hot = CURSOR_PX / 2;
      document.documentElement.style.setProperty(`--cur-${kind}`, `url('${url}') ${hot} ${hot}`);
    } catch {
      /* a picture from another origin: the plain arrow */
    }
  }
}
