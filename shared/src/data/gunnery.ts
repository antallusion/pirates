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

// ---------------------------------------------------------------------------------------------------------------
// The quick sea fight (docs/23 phase 3, owner 2026-10-06: «бой должен быть максимум секунд 30, если это корабли одного
// уровня»). Two ships of a level sink each other with broadsides alone in 30 s or less, so the guns load faster and
// every ball that strikes is felt; the point of the game is to close fast and board.

/** Every broadside's (and chaser's) reload, × (the guns' own times in ships.ts stay their relative weights). */
export const SEA_RELOAD = 0.34;
/** Every ball's damage (hull, canvas and men), × — fewer balls than the old fights threw, each one seen. */
export const SEA_DAMAGE = 3.3;

/** The grapples fly this much farther than they did (docs/23 item 36: «сближение быстрое, крючья летят дальше»). */
export const GRAPPLE_REACH = 1.8;
/** The boarding run (docs/23 item 36): running in on her mark for the grapples, every hand on the braces — her way and
 *  her pick-up, × over her own, until the grapples bite. */
export const BOARD_RUN = { maxSpeed: 0.7, accel: 4, turnRate: 0.8 } as const;

/** A laid broadside (auto-aim, docs/23 item 34): her gun captains train each gun on the mark within this many degrees
 *  of her beam, and every ball flies from its own port to the mark — they converge on her instead of flying parallel. */
export const LAY_ARC_DEG = 40;
/** Auto-fire lets a side go once the mark's lead is within this many degrees of her beam. */
export const AUTO_ARC_DEG = 28;
/** A laid ball is sent this far past the mark: one a little long still strikes her on the way, one short falls in the
 *  sea (metres). */
export const LAY_OVER = 22;
/** The «Огонь» button's volley (docs/23 item 35): laid by the captain herself, tighter. */
export const AIMED_SPREAD = 0.55;

/** The lead on a moving mark: where she will be when the ball arrives (two passes, the second with the first's time
 *  of flight). `speed`: the ball's muzzle speed (AMMO × shot speed), on the sea's old scale as the ship's way. */
export function leadPoint(from: { x: number; y: number }, to: { x: number; y: number; heading: number; speed: number }, ballSpeed: number, share = 1): { x: number; y: number; d: number } {
  let px = to.x, py = to.y;
  for (let i = 0; i < 2; i++) {
    const tof = Math.hypot(px - from.x, py - from.y) / Math.max(1, ballSpeed);
    px = to.x + Math.sin(to.heading) * to.speed * tof * share;
    py = to.y - Math.cos(to.heading) * to.speed * tof * share;
  }
  return { x: px, y: py, d: Math.hypot(px - from.x, py - from.y) };
}

/** The best shot for her mark, by its role (docs/23 item 39: round for the hull, chain for the sails, grape for the
 *  men): grape when she means to board and the mark is in grape's reach with men to spare, chain when the mark runs
 *  from her faster, round for everything else. */
export function suggestAmmo(o: { board: boolean; d: number; grapeRange: number; chainRange: number; crewShare: number; sailShare: number; faster: boolean }): 'round' | 'chain' | 'grape' {
  if (o.board && o.d < o.grapeRange * 0.95 && o.crewShare > 0.4) return 'grape';
  if (o.faster && o.d < o.chainRange * 0.95 && o.sailShare > 0.45) return 'chain';
  return 'round';
}
