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

/** Aim with the wind (docs/16 #1): a ball flies through the cross wind and falls a few metres downwind of the line it
 *  was laid on — the longer the flight, the more (as the square of it). Metres of drift per second² of flight in a
 *  full cross wind of strength 1: at a long gun's reach (2.4 s) about 6 m, half that in an ordinary breeze. */
export const WIND_DRIFT = 1.0;

/** Sideways drift in metres (+ to the right of the ball's heading) of a ball laid `dist` metres along `heading`, at
 *  `speed` (the ball's muzzle velocity, m/s, as AMMO gives it), in a wind blowing toward `windDir` at `strength`. */
export function windDrift(windDir: number, strength: number, heading: number, dist: number, speed: number): number {
  const tof = Math.max(0, dist) / Math.max(1, speed);
  return WIND_DRIFT * Math.max(0, strength) * Math.sin(windDir - heading) * tof * tof;
}

/** The same drift as a turn of the ball's line (radians, + clockwise): the ball flies straight to where it falls. */
export function windDriftAngle(windDir: number, strength: number, heading: number, dist: number, speed: number): number {
  return Math.atan2(windDrift(windDir, strength, heading, dist, speed), Math.max(1, dist));
}
