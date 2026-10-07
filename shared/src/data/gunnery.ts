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
export const SEA_RELOAD = 0.3;
/** Every ball's damage (hull, canvas and men), × — fewer balls than the old fights threw, each one seen. */
export const SEA_DAMAGE = 5;
/** …and by the level of the ship struck (docs/23 item 47, measured by tools/mobile/fight-time.ts): the great hulls of
 *  ⚓7 and up grow tougher a level than their guns grow, so a ball into one strikes a little harder and her fight with
 *  an equal keeps to the same 30 s. */
export function seaLevelPace(level: number): number {
  return level >= 7 ? 1.3 : 1;
}

/** The grapples fly this much farther than they did (docs/23 item 36: «сближение быстрое, крючья летят дальше»). */
export const GRAPPLE_REACH = 1.8;
/** The boarding run (docs/23 item 36): running in on her mark for the grapples, every hand on the braces — her way and
 *  her pick-up, × over her own, until the grapples bite. And her stem to the guns (item 47): bow-on she shows her mark
 *  the narrowest target she has, so the quick fight's broadsides do not sink her on the way in (the point of the game is
 *  to close and board). */
export const BOARD_RUN = { maxSpeed: 0.7, accel: 4, turnRate: 0.8, incomingDamageMul: -0.4 } as const;

/** A laid broadside (auto-aim, docs/23 item 34): her gun captains train each gun on the mark within this many degrees
 *  of her beam, and every ball flies from its own port to the mark — they converge on her instead of flying parallel. */
export const LAY_ARC_DEG = 40;
/** Auto-fire lets a side go once the mark's lead is within this many degrees of her beam. */
export const AUTO_ARC_DEG = 36;
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

/** No endless chases (docs/23 item 44): this long after her prey with no hit either way and a bot gives it up (or, the
 *  prey of a captain's «Атаковать», strikes or slips away). */
export const CHASE_GIVE_UP = 40;

// ---------------------------------------------------------------------------------------------------------------
// The close fight (owner, 2026-10-07: «авто преследование работает не так как положено, я должен быть рядом с целью
// очень близко, чтобы попадать, а плаваю я очень далеко»). Under «Атаковать» with the guns her helmsman held 70–92% of
// her guns' reach — 320–420 m for a long 9-pounder: past the edge of the screen (the default view spans 260 m across its
// short side, ±130 m about her on a 1500×600 window and on a phone held sideways), where her laid balls strike a ship
// under way one time in two (tools/mobile/hit-range.ts) and a turning one less, and where a ship running from her gained
// on her before she steered straight for it (past 1.5 × her reach). Now she closes to under a third of her reach (140 m
// at most: on the screen, nine balls in ten and better) and lies broadside on there; her gun captains let a side go
// inside her effective reach only — the distance where three balls in four and more strike («в дальности»).

/** The share of her guns' reach she fights at, and its bounds in metres. */
export const CLOSE_SHARE = 0.3;
export const CLOSE_MIN = 90;
export const CLOSE_MAX = 140;
/** Her effective reach, as a share of her guns' whole: three balls in four and more strike inside it, a ship's under way
 *  (tools/mobile/hit-range.ts: 285 m of a long 9-pounder's 460 — 78–90% by her level). */
export const EFFECTIVE_SHARE = 0.62;

/** The close fight's band for guns of `reach` metres: `best` the distance her helmsman holds, `near` the inside edge (she
 *  opens out below it), `far` her effective reach — «в дальности» inside it, and her gun captains' fire waits for it. */
export function closeRange(reach: number): { best: number; near: number; far: number } {
  const best = Math.min(reach * 0.8, Math.max(CLOSE_MIN, Math.min(CLOSE_MAX, reach * CLOSE_SHARE)));
  return { best, near: best * 0.65, far: Math.min(reach, Math.max(best * 1.35, reach * EFFECTIVE_SHARE)) };
}
