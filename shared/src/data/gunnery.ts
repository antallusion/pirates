// Dynamic combat (docs/11 P2): the held broadside and the dash. Shared so the client draws what the server rules.

/** Seconds a broadside's order is held for a full charge; a shorter press fires as before. */
export const AIM_CHARGE = 1.2;
/** A press shorter than this is a plain shot (no focus, no penalty). */
export const AIM_TAP = 0.25;
/** The perfect window, as a share of the full charge: released here the balls fly tight and hit harder. */
export const AIM_PERFECT: readonly [number, number] = [0.7, 0.95];
/** Held past this share of the charge the gun crews grow jittery. */
export const AIM_WAVER = 1.3;
export const AIM_PERFECT_SPREAD = 0.55;
export const AIM_PERFECT_DAMAGE = 1.12;
export const AIM_WAVER_SPREAD = 1.15;

/** How a held broadside flies: spread and damage multipliers and whether it was perfect. */
export function aimFocus(held: number): { spread: number; damage: number; perfect: boolean } {
  if (held < AIM_TAP) return { spread: 1, damage: 1, perfect: false };
  const c = held / AIM_CHARGE;
  if (c >= AIM_PERFECT[0] && c <= AIM_PERFECT[1]) return { spread: AIM_PERFECT_SPREAD, damage: AIM_PERFECT_DAMAGE, perfect: true };
  if (c > AIM_WAVER) return { spread: AIM_WAVER_SPREAD, damage: 1, perfect: false };
  return { spread: 1 - 0.3 * Math.min(1, c), damage: 1, perfect: false };
}

/** The dash: a hard turn with every hand on the braces. */
export const DASH_COOLDOWN = 14;
export const DASH_TIME = 1.6;
/** For this long after the dash starts, half the balls aimed at her miss. */
export const DASH_EVADE = 0.9;
export const DASH_EVADE_CHANCE = 0.5;
