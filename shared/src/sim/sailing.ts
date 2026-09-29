// Sailing model shared by the authoritative server and client-side prediction.
// Pure functions over plain data: no allocation in the hot path beyond the returned state.

import { angleDiff, approach, clamp, DEG, headingVec, wrapAngle } from '../math.ts';
import type { Rig } from '../data/ships.ts';
import type { WindSample } from './wind.ts';
import { SPEED_SCALE, TURN_SCALE, WIND_PUSH } from '../constants.ts';

export interface SailState {
  x: number;
  y: number;
  heading: number;
  speed: number; // forward speed through water, m/s
  sail: number; // actual sail level 0..1
  rudder: number; // actual rudder -1..1
}

export interface SailInput {
  rudder: number; // desired -1..1 (A/D)
  sailTarget: number; // desired 0..1 (W/S steps)
}

export interface SailParams {
  rig: Rig;
  maxSpeed: number;
  accel: number;
  turnRate: number; // rad/s
  noGoDeg: number; // effective no-go half-angle
  sailChangeRate: number; // sail fraction per second
  currentMul: number;
  sailHealth: number; // 0..1
  rudderHealth: number; // 0..1
  crewFactor: number; // 0..1, handling efficiency
  loadFactor: number; // 0..1 speed multiplier from cargo weight
  speedMul: number; // misc multiplier (night runner, abilities, status)
  personalWind: boolean; // Storm Chaser: always best angle
  weatherly: boolean; // schooner passive
  sweeps?: boolean; // xebec: oars and lateen rig for light airs
  /** Talent-driven handling (03 §4.1); all optional so NPCs and tools can omit them. */
  talent?: SailTalents;
}

export interface SailTalents {
  turnDrag: number; // −0.1/rank: less speed bled in hard turns
  runningFree: number; // +accel with the wind on the quarter
  seaPenalty: number; // −0.2/rank: heavy-sea speed penalty reduction
  tackDrill: number; // ranks of Tacking Drill
  polarBoost: number; // share of point-of-sail loss recovered
  rowSpeed: number; // m/s under oars (0 = cannot row)
  stormRider: boolean;
  silentRunning: number; // ranks: +5% speed per rank under half sail
}

/** Oars: the xebec rows by design; Sweeps teach schooners and brigantines to row, and the xebec to row harder. */
export function rowSpeed(classId: string, sweepsDrill: boolean, stormRider: boolean): number {
  if (stormRider) return 0;
  if (classId === 'xebec') return sweepsDrill ? 3.6 : 3;
  if (sweepsDrill && (classId === 'schooner' || classId === 'brigantine')) return 2.2;
  return 0;
}

/** Heavy seas slow every ship: nothing below a fresh breeze, up to −12% in a full storm. */
export function seaSpeedPenalty(windStrength: number, seaPenalty = 0): number {
  return Math.max(0, windStrength - 0.75) * 0.3 * Math.max(0, 1 + seaPenalty);
}

const BASE_NOGO: Record<Rig, number> = { square: 65, fore_aft: 42, mixed: 52 };

// Polar curves: [angle from wind source (deg), efficiency]. First point is the no-go edge.
const POLARS: Record<Rig, [number, number][]> = {
  square: [[65, 0.35], [90, 0.75], [120, 0.95], [145, 1.0], [180, 0.88]],
  fore_aft: [[42, 0.45], [60, 0.75], [90, 0.95], [110, 1.0], [150, 0.85], [180, 0.72]],
  mixed: [[52, 0.4], [90, 0.88], [125, 1.0], [180, 0.82]],
};

export function baseNoGo(rig: Rig): number {
  return BASE_NOGO[rig];
}

/**
 * Sailing efficiency for an angle off the wind source (0 = head to wind, 180 = dead downwind).
 * A reduced no-go angle compresses the curve toward the wind.
 */
export function polarEfficiency(rig: Rig, relDeg: number, noGoDeg: number, weatherly = false): number {
  const base = BASE_NOGO[rig];
  const noGo = clamp(noGoDeg, 25, 80);
  if (relDeg < noGo) {
    // In irons: a trickle of drift so a ship is never fully dead.
    return 0.04 * (relDeg / noGo);
  }
  // Map [noGo, 180] onto the base curve's [base, 180].
  const mapped = base + ((relDeg - noGo) * (180 - base)) / (180 - noGo);
  const curve = POLARS[rig];
  let eff = curve[curve.length - 1][1];
  for (let i = 1; i < curve.length; i++) {
    if (mapped <= curve[i][0]) {
      const [a0, e0] = curve[i - 1];
      const [a1, e1] = curve[i];
      eff = e0 + ((mapped - a0) / (a1 - a0)) * (e1 - e0);
      break;
    }
  }
  if (weatherly && mapped < 90) eff = eff + (1 - eff) * 0.4;
  return eff;
}

/** The least share of her way a ship makes head to wind; the floor rises to SAIL_BEAM on a beam reach. */
export const SAIL_BASE = 0.5;
export const SAIL_BEAM = 0.8;

/** The floor under the polar: no heading is dead (owner, 2026-09-28: "without a following wind it crawls"). Abaft
 *  the beam it falls away again, so a schooner still runs worse than a square-rigger. */
export function sailFloor(relDeg: number): number {
  if (relDeg <= 90) return SAIL_BASE + (SAIL_BEAM - SAIL_BASE) * (relDeg / 90);
  return SAIL_BEAM - 0.2 * ((relDeg - 90) / 90);
}

/** A following wind drives a ship on, a head wind holds her back (owner, 2026-09-28): 1 + WIND_PUSH at a run before a
 * full breeze, 1 − WIND_PUSH head to it, nothing on the beam. `relDeg` is from windward (0 = head to wind). */
export function windPush(relDeg: number, strength: number): number {
  return 1 - WIND_PUSH * Math.min(1.15, strength) * Math.cos(relDeg * DEG);
}

/** Angle between heading and the direction the wind comes FROM, in degrees 0..180. */
export function relWindDeg(heading: number, wind: WindSample): number {
  const from = wrapAngle(wind.dir + Math.PI);
  return Math.abs(angleDiff(heading, from)) / DEG;
}

export function targetSpeed(state: SailState, p: SailParams, wind: WindSample): number {
  const rel = p.personalWind ? 135 : relWindDeg(state.heading, wind);
  const windS = p.personalWind ? Math.max(0.8, wind.strength) : wind.strength;
  let eff = polarEfficiency(p.rig, rel, p.noGoDeg, p.weatherly);
  const tal = p.talent;
  if (tal && tal.polarBoost > 0 && rel >= p.noGoDeg) eff += (1 - eff) * Math.min(0.6, tal.polarBoost);
  // A ship never lies dead: against the wind she is slower, not stopped, and a light air slows her rather than
  // stopping her. The polar still pays for a well-trimmed reach and a run before the wind.
  eff = Math.max(sailFloor(rel), eff);
  let windFactor = 0.6 + 0.4 * Math.min(1.15, windS);
  if (p.sweeps && windS < 0.5) windFactor *= 1.25;
  windFactor *= 1 - seaSpeedPenalty(wind.strength, tal?.seaPenalty ?? 0);
  if (tal?.stormRider) windFactor *= wind.strength >= 0.75 ? 1.2 : wind.strength < 0.35 ? 0.7 : 1;
  const sailFactor = Math.pow(state.sail, 0.85) * (tal && tal.silentRunning > 0 && state.sail <= 0.51 ? 1 + 0.05 * tal.silentRunning : 1);
  const sailHealth = 0.25 + 0.75 * p.sailHealth;
  const crew = 0.45 + 0.55 * p.crewFactor;
  return p.maxSpeed * eff * windFactor * windPush(rel, windS) * sailFactor * sailHealth * crew * p.loadFactor * p.speedMul;
}

export function stepSailing(s: SailState, input: SailInput, p: SailParams, wind: WindSample, current: { x: number; y: number }, dt: number): SailState {
  const sailRate = p.sailChangeRate * (0.5 + 0.5 * p.crewFactor);
  const sail = approach(s.sail, clamp(input.sailTarget, 0, 1), sailRate * dt);
  const rudder = approach(s.rudder, clamp(input.rudder, -1, 1), 2.8 * dt);

  const tal = p.talent;
  let tgt = targetSpeed({ ...s, sail }, p, wind);
  const rel = relWindDeg(s.heading, wind);
  // Sweeps: the crew rows when the wind is against her or fails — the oars add their way, most of it head to wind.
  const row = tal ? tal.rowSpeed : p.sweeps ? 3 : 0;
  if (row > 0 && input.sailTarget > 0) tgt += row * (0.45 + 0.55 * p.crewFactor) * (rel < 90 || wind.strength < 0.35 ? 1 : 0.4);
  const inIrons = !p.personalWind && rel < p.noGoDeg;
  let accel = p.accel;
  if (tal && tal.runningFree > 0 && rel > 150) accel *= 1 + tal.runningFree;
  let decel = p.accel * 0.7 + 0.25 + s.speed * 0.04;
  // Tacking Drill: the ship carries her way through the eye of the wind.
  if (tal && tal.tackDrill > 0 && inIrons && Math.abs(rudder) > 0.3) decel *= 1 - 0.35 * tal.tackDrill;
  let speed: number;
  if (s.speed < tgt) speed = Math.min(tgt, s.speed + accel * dt);
  else speed = Math.max(tgt, s.speed - decel * dt);
  // A hard-over rudder bleeds way.
  speed = Math.max(0, speed - Math.abs(rudder) * speed * 0.05 * Math.max(0, 1 + (tal?.turnDrag ?? 0)) * dt);

  // Even a stopped ship can come about slowly (boats, sweeps, backed sails), so nobody is stuck in irons.
  const steerage = clamp(0.5 + speed / Math.max(1, p.maxSpeed * 0.6), 0.5, 1);
  const rudderEff = 0.3 + 0.7 * p.rudderHealth;
  let turn = p.turnRate;
  if (tal?.stormRider) turn *= wind.strength >= 0.75 ? 1.25 : wind.strength < 0.35 ? 0.85 : 1;
  if (tal && tal.tackDrill > 0 && inIrons) turn *= 1 + 0.2 * tal.tackDrill;
  const heading = wrapAngle(s.heading + rudder * turn * TURN_SCALE * steerage * rudderEff * dt);

  // Her way carries her across the world at the pace of the sea (SPEED_SCALE); the currents drift as they did.
  const fwd = headingVec(heading);
  const cm = 1 + p.currentMul;
  const x = s.x + (fwd.x * speed * SPEED_SCALE + current.x * cm) * dt;
  const y = s.y + (fwd.y * speed * SPEED_SCALE + current.y * cm) * dt;
  return { x, y, heading, speed, sail, rudder };
}
