// A creature's face on a card, an army slot or a mark on the charts: its own painted figure (unit.<kind>, the
// battle's four poses) where it has one, from the head down; else the picture that stands in for it, tinted and
// framed (docs/18 II, BEAST_TINT).

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_TINT } from '../../../shared/src/data/bestiary.ts';
import { assetUrl } from '../assets.ts';

export interface BeastFace {
  id: string;
  /** A stand-in's tint (none on its own figure). */
  tint?: string;
  /** Its own figure: shown from the head down rather than whole. */
  fig: boolean;
}

/** The face a kind shows: a creature's own figure once painted; anything else its own art. */
export function beastFace(u: string): BeastFace {
  const def = UNITS[u as UnitId];
  if (def?.beast && assetUrl(`unit.${u}`)) return { id: `unit.${u}`, fig: true };
  return { id: def?.art ?? 'icon.prof_sailor', tint: BEAST_TINT[u as keyof typeof BEAST_TINT], fig: false };
}

/** Draws a face over a circle of radius R at (x, y) (the caller clips it): a figure's top square (its head and
 *  shoulders; a long beast its middle), a picture filling the circle. */
export function drawFace(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, R: number, fig: boolean, over = 2.2): void {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (fig) {
    const side = Math.min(iw, ih);
    const sx = (iw - side) / 2, sy = Math.max(0, (ih - side) * 0.08);
    const d = R * over;
    g.drawImage(img, sx, sy, side, side, x - d / 2, y - d / 2, d, d);
    return;
  }
  const k = (R * over) / Math.min(iw, ih);
  g.drawImage(img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
}
