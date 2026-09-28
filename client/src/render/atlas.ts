// Sprite atlas (Phase 10): every ship image the sea needs — class × curse stage × sail colours — is packed
// into a few 2048² pages, so a busy sea draws from one or two textures instead of a canvas per ship. Cells are
// capped at CELL px on the long side; a ship drawn larger than its cell (close zoom) uses the full image.
// The packer and the sail tint are pure so they can be tested without a DOM.

import type { FactionId } from '../../../shared/src/data/factions.ts';

export const PAGE = 2048;
export const CELL = 256;
const PAD = 2;

export interface Slot {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shelf packing: rows of the height of their first item, a new page when one fills up. */
export class ShelfPacker {
  pages = 0;
  private x = 0;
  private y = 0;
  private row = 0;
  readonly size: number;

  constructor(size = PAGE) {
    this.size = size;
  }

  place(w: number, h: number): Slot {
    if (w + PAD > this.size || h + PAD > this.size) throw new Error(`sprite ${w}×${h} exceeds the page`);
    if (this.pages === 0) this.pages = 1;
    if (this.x + w + PAD > this.size) {
      this.x = 0;
      this.y += this.row;
      this.row = 0;
    }
    if (this.y + h + PAD > this.size) {
      this.pages++;
      this.x = this.y = this.row = 0;
    }
    const slot = { page: this.pages - 1, x: this.x, y: this.y, w, h };
    this.x += w + PAD;
    this.row = Math.max(this.row, h + PAD);
    return slot;
  }
}

/** Sail canvas by colours flown: lawful navies bleach theirs, the Confederacy dyes blood-red, pirates tar them black. */
export const SAIL_TINT: Record<FactionId | 'black' | 'none', [number, number, number] | null> = {
  none: null,
  free: null,
  crown: [236, 238, 244],
  league: [214, 170, 96],
  confederacy: [168, 52, 44],
  harpoon: [196, 180, 132],
  brokers: [120, 132, 124],
  choir: [52, 110, 104],
  black: [46, 44, 42],
};
export type SailKey = keyof typeof SAIL_TINT;

/**
 * Re-dyes the canvas: pale, unsaturated pixels (sailcloth) take the tint in proportion to how much they look
 * like cloth; dark wood and coloured paint stay as they are. In place, RGBA.
 */
export function tintSails(d: Uint8ClampedArray, tint: [number, number, number], strength = 0.75): void {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = (mx + mn) / 510;
    const sat = mx ? (mx - mn) / mx : 0;
    // Cloth: bright and grey-ish. Smooth edges so seams do not band.
    const w = clamp01((lum - 0.45) / 0.2) * clamp01((0.35 - sat) / 0.15) * strength;
    if (w <= 0) continue;
    const shade = lum * 1.15; // keep the folds: the tint is multiplied by the cloth's own light
    d[i] = r + (Math.min(255, tint[0] * shade) - r) * w;
    d[i + 1] = g + (Math.min(255, tint[1] * shade) - g) * w;
    d[i + 2] = b + (Math.min(255, tint[2] * shade) - b) * w;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface AtlasEntry {
  page: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** The full-resolution source for close zoom. */
  full: HTMLCanvasElement;
}

export class SpriteAtlas {
  private packer = new ShelfPacker(PAGE);
  private canvases: HTMLCanvasElement[] = [];
  private entries = new Map<string, AtlasEntry>();

  get pageCount(): number {
    return this.canvases.length;
  }

  get size(): number {
    return this.entries.size;
  }

  /** The entry for `key`, packing `build()` (and its sail-dyed copy) on first use. A captain's look (docs/12 P10
   *  #12) paints her hull and patterns her sails. */
  get(key: string, build: () => HTMLCanvasElement, sails: SailKey, look?: { hull: [number, number, number] | null; sail: number; c1: [number, number, number]; c2: [number, number, number] }): AtlasEntry {
    const k = `${key}|${sails}|${look ? `${look.hull?.join(',')}/${look.sail}/${look.c1.join(',')}/${look.c2.join(',')}` : ''}`;
    const hit = this.entries.get(k);
    if (hit) return hit;
    let full = build();
    const tint = SAIL_TINT[sails];
    if (tint) full = dyed(full, tint);
    else if (look) full = painted(full, look);
    const s = Math.min(1, CELL / Math.max(full.width, full.height));
    const w = Math.max(1, Math.round(full.width * s)), h = Math.max(1, Math.round(full.height * s));
    const slot = this.packer.place(w, h);
    while (this.canvases.length < this.packer.pages) {
      const c = document.createElement('canvas');
      c.width = c.height = PAGE;
      this.canvases.push(c);
    }
    const page = this.canvases[slot.page];
    const g = page.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, slot.x, slot.y, w, h);
    const e = { page, sx: slot.x, sy: slot.y, sw: w, sh: h, full };
    this.entries.set(k, e);
    return e;
  }
}

/** Her hull's paint on the dark wood, her sails' pattern on the cloth (in her flag's first two colours). */
function painted(src: HTMLCanvasElement, look: { hull: [number, number, number] | null; sail: number; c1: [number, number, number]; c2: [number, number, number] }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  try {
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data, W = c.width, H = c.height;
    const TAR: [number, number, number] = [46, 44, 42], RED: [number, number, number] = [150, 44, 38], BONE: [number, number, number] = [236, 232, 220];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const lum = (mx + mn) / 510, sat = mx ? (mx - mn) / mx : 0;
      const px = (i / 4) % W, py = Math.floor(i / 4 / W);
      const cloth = clamp01((lum - 0.45) / 0.2) * clamp01((0.35 - sat) / 0.15);
      if (cloth > 0 && look.sail > 0) {
        // The pattern: which colour this bit of cloth takes.
        const u = px / W, v = py / H;
        let t: [number, number, number] = BONE;
        switch (look.sail) {
          case 1: t = TAR; break;
          case 2: t = RED; break;
          case 3: t = Math.floor(v * 14) % 2 ? look.c1 : look.c2; break;
          case 4: t = Math.abs(u - 0.5) < 0.06 || Math.abs(v - 0.45) < 0.035 ? look.c2 : look.c1; break;
          case 5: t = (Math.floor(u * 8) + Math.floor(v * 16)) % 2 ? look.c1 : look.c2; break;
          case 6: t = u < 0.5 ? look.c1 : look.c2; break;
          case 7: t = Math.floor(v * 10) % 2 ? [47, 134, 176] : BONE; break;
          case 8: t = Math.floor((u + v) * 11) % 2 ? look.c1 : look.c2; break;
          case 9: t = [206, 190, 150]; break;
          case 10: t = Math.abs(v - 0.42) < 0.045 ? look.c1 : TAR; break;
          case 11: {
            // Patches of four cloths, sewn where they fell.
            const k = (Math.floor(u * 6) * 7 + Math.floor(v * 9) * 13) % 4;
            t = k === 0 ? look.c1 : k === 1 ? look.c2 : k === 2 ? BONE : [120, 104, 82];
            break;
          }
        }
        const w = cloth * 0.7, shade = lum * 1.15;
        d[i] = r + (Math.min(255, t[0] * shade) - r) * w;
        d[i + 1] = gg + (Math.min(255, t[1] * shade) - gg) * w;
        d[i + 2] = b + (Math.min(255, t[2] * shade) - b) * w;
      } else if (look.hull && lum > 0.06 && lum < 0.42 && cloth <= 0) {
        // The hull's paint: dark wood takes the colour, its grain kept.
        const w = 0.45, shade = 0.55 + lum * 1.3;
        d[i] = r + (look.hull[0] * shade - r) * w;
        d[i + 1] = gg + (look.hull[1] * shade - gg) * w;
        d[i + 2] = b + (look.hull[2] * shade - b) * w;
      }
    }
    g.putImageData(img, 0, 0);
  } catch {
    /* a tainted image cannot be painted */
  }
  return c;
}

function dyed(src: HTMLCanvasElement, tint: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  try {
    const img = g.getImageData(0, 0, c.width, c.height);
    tintSails(img.data, tint);
    g.putImageData(img, 0, 0);
  } catch {
    /* a tainted image cannot be re-dyed: fly it as it came */
  }
  return c;
}
