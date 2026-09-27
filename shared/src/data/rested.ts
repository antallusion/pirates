// Rest ashore (docs/11 P6), as WoW's rested experience: time away from the game after putting in at a port fills a
// pool — a twentieth of the level's experience for every eight hours, up to one and a half levels; at sea when the
// captain left, a quarter of that. The next experience earned in battle comes double until the pool is spent.

import { xpForLevel } from '../constants.ts';

export const REST_HOURS = 8;
export const REST_SHARE = 0.05;
export const REST_CAP = 1.5;
export const REST_AT_SEA = 0.25;

/** The pool after time away: hours away, in port or at sea, for a captain of this level. */
export function restAfter(pool: number, level: number, hours: number, inPort: boolean): number {
  const per = xpForLevel(level) * REST_SHARE * (inPort ? 1 : REST_AT_SEA);
  return Math.min(xpForLevel(level) * REST_CAP, pool + Math.max(0, hours) / REST_HOURS * per);
}
