// Asset loading: local file → Higgsfield CDN → procedural fallback (renderer draws it).
// Images are optional; the game must always render even when every download fails.

import { ICON_STAND_IN } from '../../shared/src/data/armsart.ts';
import { FLEET_STAND_IN } from '../../shared/src/data/fleet.ts';

/** Art id → the painted kindred drawn while it is not painted: the yard's new icons (armsart.ts), the fleet of eighty's
 *  new hulls and decks and the premium hulls' creatures (fleet.ts). Painted art always wins. */
const STAND_IN: Record<string, string> = { ...ICON_STAND_IN, ...FLEET_STAND_IN };

interface ManifestEntry {
  local: string;
  remote: string;
  /** Bumped when the local file is reworked in place (a day's browser cache would keep the old one). */
  rev?: number;
  /** A port painting's slips between its piers: [middle x, width, top y, depth] as shares of the painting. */
  slips?: [number, number, number, number][];
}

interface Manifest {
  cdn: string;
  assets: Record<string, ManifestEntry>;
}

export interface Sprite {
  img: HTMLImageElement;
  /** Fraction of the image height occupied by the subject (for scaling ships to hull length). */
  extentY: number;
  extentX: number;
  cx: number; // subject centre in image fraction
  cy: number;
}

const images = new Map<string, Sprite>();
const patterns = new Map<string, CanvasPattern>();
let manifest: Manifest | null = null;

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.decoding = 'async';
    img.src = src;
  });
}

function measure(img: HTMLImageElement): Pick<Sprite, 'extentX' | 'extentY' | 'cx' | 'cy'> {
  // Alpha bounding box (works for same-origin or CORS-enabled images; otherwise sensible defaults).
  try {
    const w = 128, h = Math.round((128 * img.naturalHeight) / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) throw new Error('empty');
    return { extentX: (x1 - x0 + 1) / w, extentY: (y1 - y0 + 1) / h, cx: (x0 + x1 + 1) / 2 / w, cy: (y0 + y1 + 1) / 2 / h };
  } catch {
    return { extentX: 0.6, extentY: 0.9, cx: 0.5, cy: 0.5 };
  }
}

async function loadEntry(id: string, e: ManifestEntry): Promise<void> {
  const attempts: [string, boolean][] = [
    ['/assets/' + e.local + (e.rev ? `?v=${e.rev}` : ''), false],
    [manifest!.cdn + e.remote, true],
    [manifest!.cdn + e.remote, false],
  ];
  for (const [src, cors] of attempts) {
    try {
      const img = await loadImage(src, cors);
      images.set(id, { img, ...measure(img) });
      return;
    } catch {
      /* try next */
    }
  }
}

export async function loadAssets(ids: string[] | null, onProgress?: (done: number, total: number) => void): Promise<void> {
  try {
    manifest = (await (await fetch('/assets/manifest.json')).json()) as Manifest;
  } catch {
    return;
  }
  // The reference art is for reviews, not for the game.
  const list = (ids ?? Object.keys(manifest.assets).filter((id) => !id.startsWith('art.reference'))).filter((id) => manifest!.assets[id]);
  let done = 0;
  await Promise.all(
    list.map(async (id) => {
      await loadEntry(id, manifest!.assets[id]);
      onProgress?.(++done, list.length);
    }),
  );
}

/** What the manifest says of an asset (its slips, for a port). */
export function assetMeta(id: string): ManifestEntry | null {
  return manifest?.assets[id] ?? null;
}

/** An asset, or — while its sheet is being painted — the painted kindred that stands in for it (shared/src/data/armsart.ts,
 *  shared/src/data/fleet.ts). */
export function sprite(id: string): Sprite | null {
  return images.get(id) ?? (STAND_IN[id] ? images.get(STAND_IN[id]) ?? null : null);
}

export function assetUrl(id: string): string | null {
  const s = sprite(id);
  return s ? s.img.src : null;
}

export function pattern(g: CanvasRenderingContext2D, id: string): CanvasPattern | null {
  let p = patterns.get(id);
  if (p) return p;
  const s = images.get(id);
  if (!s) return null;
  p = g.createPattern(s.img, 'repeat') ?? undefined;
  if (p) patterns.set(id, p);
  return p ?? null;
}
