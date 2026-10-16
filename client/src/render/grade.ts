// Light and atmosphere (2026-10-16, owner «делай»): each sea's colour grade, the sun's (or the moon's) place for the
// water's glints, the warm hour at dawn and dusk, and how alive the sea may be (motion, the device's level of detail).
// Pure: the renderer and the shader sea read these (renderer.ts drawOcean, drawLighting; gl.ts).

import type { RegionId } from '../../../shared/src/world/regions.ts';

export interface Grade {
  /** A multiply on the shader sea's colour (1,1,1 = none). */
  mul: [number, number, number];
  /** A soft-light wash over the whole world, its colour and strength (0 = none). */
  wash: [number, number, number];
  a: number;
}

const NONE: Grade = { mul: [1, 1, 1], wash: [0, 0, 0], a: 0 };

/** Each sea's grade: frost blue in the ice, ember warmth among the volcanoes, a green murk in the Abyss and the fog
 *  seas; the Crown's and the trade seas as painted. Gentle: a few per cent on the water, a light wash on the rest. */
export const GRADES: Record<RegionId, Grade> = {
  black_coast: NONE,
  gravewater: NONE,
  dead_mans_expanse: { mul: [1.0, 0.99, 0.97], wash: [150, 140, 120], a: 0.04 },
  leviathan_reach: { mul: [0.92, 1.0, 1.12], wash: [150, 190, 235], a: 0.1 },
  ashen_isles: { mul: [1.12, 0.96, 0.86], wash: [235, 120, 60], a: 0.1 },
  whispering: { mul: [0.95, 1.04, 0.98], wash: [110, 160, 120], a: 0.07 },
  drowned_crown: { mul: [0.93, 1.03, 1.02], wash: [90, 160, 150], a: 0.07 },
  the_abyss: { mul: [0.86, 1.06, 0.94], wash: [70, 150, 100], a: 0.11 },
};

export function gradeOf(region: RegionId | undefined): Grade {
  return (region && GRADES[region]) || NONE;
}

/** The warm hour: 1 at sunrise (0.25 of the day) and sunset (0.75), 0 an hour or two either side. */
export function duskOf(tod: number): number {
  const d = Math.min(Math.abs(tod - 0.25), Math.abs(tod - 0.75));
  return Math.exp(-((d / 0.045) ** 2));
}

/** The light the water's glints face (x east, y south, z up): the sun across the sky by day, low at dawn and dusk;
 *  the moon high in the south-east by night (the shader's old fixed moon). */
export function lightDir(tod: number, night: number): [number, number, number] {
  const a = (tod - 0.25) * Math.PI * 2; // 0 sunrise, π/2 noon, π sunset
  const up = Math.max(0.12, Math.sin(a));
  const sun: [number, number, number] = [-Math.cos(a) * 0.8, -0.35, up];
  const moon: [number, number, number] = [0.35, -0.55, 0.75];
  const k = Math.min(1, Math.max(0, night));
  return [sun[0] + (moon[0] - sun[0]) * k, sun[1] + (moon[1] - sun[1]) * k, sun[2] + (moon[2] - sun[2]) * k];
}

/** How alive the sea and the ships may be: 0 with «меньше движения», a little less on the lowest level of detail. */
export function liveness(reduceMotion: boolean, lod: number, low: boolean): number {
  if (reduceMotion) return 0;
  if (low || lod >= 2) return 0.6;
  return 1;
}
