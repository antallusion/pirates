// The masts of a mastless hull (2026-11-16, tools/art/ships_nomast.py): one yard with its sail on each of her steps,
// braced to the wind, the cloth set, reefed, furled or bare as her sails are. Every rig carries the square yards that
// open and close across her (the owner, 2026-11-21: the starting sloop's fore-and-aft sail along her side was small and
// hid; «все паруса должны быть горизонтальные, раскрываться полностью»). Drawn by the renderer and by the ships' look
// page (client/shipview.html), so the page shows what the sea shows.

import { MAST_PIVOT } from '../../../shared/src/data/maststeps.ts';

/** A mast picture by its id (`mast.square_full`…), dyed if she has a colour; null while it loads. */
export type MastLook = (id: string) => { img: CanvasImageSource; w: number; h: number } | null;

export const MAST_STATES = ['bare', 'furl', 'reef', 'full'] as const;

/** The yards on her steps. The context stands at her picture's middle, her bow up; `steps` are fractions of her
 *  picture's height from the top (MAST_STEPS), `cy` her picture's middle as a fraction (0.5 for most); `sail` 0..1
 *  (bare … full, crossfaded), `brace` the yards' turn in radians (to the wind), `breathe` a small sway. */
export function drawMastSet(g: CanvasRenderingContext2D, look: MastLook, steps: readonly number[], imgW: number, imgH: number, cy: number, sail: number, brace: number, breathe: number): void {
  const pos = Math.max(0, Math.min(1, sail)) * 3;
  const i = Math.min(2, Math.floor(pos));
  const f = pos - i;
  const yard = imgW * 0.92;
  steps.forEach((fy, k) => {
    g.save();
    g.translate(0, -imgH * cy + fy * imgH);
    g.rotate(brace * (1 - k * 0.06) + breathe);
    for (const [st, al] of [[MAST_STATES[i], 1 - f], [MAST_STATES[i + 1], f]] as const) {
      if (al < 0.02) continue;
      const m = look(`mast.square_${st}`);
      if (!m) continue;
      const w = yard, h = (m.h / m.w) * w;
      const py = (MAST_PIVOT[`square_${st}`] ?? 0.3) * h;
      const ga = g.globalAlpha;
      g.globalAlpha = ga * al;
      g.drawImage(m.img, -w / 2, -py, w, h);
      g.globalAlpha = ga;
    }
    g.restore();
  });
}

/** A mast picture with its canvas dyed (MAST_TINT: the colour her old painting's sails had): the light grey cloth
 *  multiplied up to the dye, the dark wood only a little warmed. */
export function dyeMast(img: HTMLImageElement, tint: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  const n = parseInt(tint.slice(1), 16);
  const up = (v: number) => Math.min(255, Math.round(v / 0.72));
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = `rgb(${up(n >> 16)},${up((n >> 8) & 255)},${up(n & 255)})`;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  return c;
}
