// A creature's face on a card, an army slot or a mark on the charts: its own painted figure (unit.<kind>, the
// battle's four poses) where it has one, from the head down; else the picture that stands in for it, tinted and
// framed (docs/18 II, BEAST_TINT).

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_TINT } from '../../../shared/src/data/bestiary.ts';
import { isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import { assetUrl } from '../assets.ts';
import { BOSS_UNIT_STAND_IN, isBossUnit } from '../../../shared/src/data/bossunits.ts'; // the great ones ashore (2026-10-03)
import { TITAN_STAND_IN, isTitan } from '../../../shared/src/data/titans.ts'; // docs/19 E10

export interface BeastFace {
  id: string;
  /** A stand-in's tint (none on its own figure). */
  tint?: string;
  /** Its own figure: shown from the head down rather than whole. */
  fig: boolean;
}

/** The face a kind shows: a creature's own figure once painted (a premium hull's own kind's, or the figure that stands
 *  in for it, shared/src/data/fleet.ts); anything else its own art. */
export function beastFace(u: string): BeastFace {
  const def = UNITS[u as UnitId];
  if ((def?.beast || isShipBeast(u)) && assetUrl(`unit.${u}`)) return { id: `unit.${u}`, fig: true };
  return { id: def?.art ?? 'icon.prof_sailor', tint: BEAST_TINT[u as keyof typeof BEAST_TINT] ?? (isBossUnit(u) ? BOSS_UNIT_STAND_IN[u].tint : isTitan(u) ? TITAN_STAND_IN[u].tint : undefined), fig: false };
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
