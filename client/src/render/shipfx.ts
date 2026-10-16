// The ships alive on the swell (2026-10-16, owner «делай»): each one rolls and pitches with the sea (her own phase,
// by her id), her canvas breathes with the wind and her way, and torn sails darken in patches. No new art: the hull's
// own picture, moved and tinted by code. Pure but for the torn-sail cache (one small canvas per picture).

/** How she sways this frame: a small turn (radians), the deck's squeeze across (the roll seen from above) and along (the
 *  pitch), and the sails' breath — all 0 when the sea is still (`live` 0: «меньше движения»). */
export function sway(id: number, time: number, live: number, sail: number, wind: number, speedK: number): { turn: number; sx: number; sy: number } {
  if (!live) return { turn: 0, sx: 1, sy: 1 };
  const ph = id * 1.37;
  const roll = Math.sin(time * 0.83 + ph) * 0.6 + Math.sin(time * 1.31 + ph * 0.7) * 0.4;
  const pitch = Math.sin(time * 1.07 + ph * 1.9);
  // the canvas fills and eases with the gusts: more with sail set, a fresh wind and her way on
  const fill = Math.min(1, Math.max(0, sail)) * (0.4 + 0.6 * Math.min(1.4, Math.max(0, wind))) * (0.5 + 0.5 * Math.min(1, speedK));
  const breath = Math.sin(time * 1.9 + ph * 0.5) * 0.5 + 0.5;
  return {
    turn: roll * 0.012 * live,
    sx: 1 - Math.abs(roll) * 0.022 * live + fill * breath * 0.018 * live,
    sy: 1 + pitch * 0.012 * live + fill * breath * 0.008 * live,
  };
}

/** The damage she shows: smoke from half her hull down, fire from a quarter, the sails' tint below 60 %. */
export function damageLook(hull: number, sails: number): { smoke: number; fire: number; torn: number } {
  return {
    smoke: hull < 0.5 ? Math.min(1, (0.5 - hull) / 0.5) : 0,
    fire: hull < 0.25 ? Math.min(1, (0.25 - hull) / 0.25 + 0.3) : 0,
    torn: sails < 0.6 ? Math.min(1, (0.6 - sails) / 0.5) : 0,
  };
}

const torn = new Map<HTMLCanvasElement, HTMLCanvasElement | null>();

/** The picture's cloth (its light, low-saturation pixels) scorched and holed: laid over her at the damage's share. */
export function tornSails(src: HTMLCanvasElement): HTMLCanvasElement | null {
  if (torn.has(src)) return torn.get(src)!;
  let out: HTMLCanvasElement | null = null;
  try {
    const W = Math.min(256, src.width), H = Math.round((src.height * W) / Math.max(1, src.width));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(src, 0, 0, W, H);
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    let seed = W * 31 + H;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // a few holes and scorches, in the picture's own space
    const blots: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) blots.push([rnd() * W, rnd() * H, (0.05 + rnd() * 0.08) * W]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const a = d[i + 3];
        if (a < 8) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        const cloth = lum > 0.45 && mx - mn < 70 ? Math.min(1, (lum - 0.45) / 0.2) : 0;
        let blot = 0;
        for (const [bx, by, br] of blots) {
          const q = Math.hypot(x - bx, y - by) / br;
          if (q < 1) blot = Math.max(blot, 1 - q);
        }
        const k = cloth * (0.45 + 0.55 * Math.min(1, blot * 1.6));
        d[i] = 34;
        d[i + 1] = 26;
        d[i + 2] = 18;
        d[i + 3] = Math.round(a * k * 0.85);
      }
    }
    g.putImageData(img, 0, 0);
    out = c;
  } catch {
    out = null; // a tainted picture: no tint
  }
  torn.set(src, out);
  return out;
}
