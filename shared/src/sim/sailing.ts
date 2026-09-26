// Sailing model shared by the authoritative server and client-side prediction.
// Pure functions over plain data: no allocation in the hot path beyond the returned state.

import { angleDiff, approach, clamp, DEG, headingVec, wrapAngle } from '../math.ts';
import type { Rig } from '../data/ships.ts';
import type { WindSample } from './wind.ts';

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

/** Angle between heading and the direction the wind comes FROM, in degrees 0..180. */
export function relWindDeg(heading: number, wind: WindSample): number {
  const from = wrapAngle(wind.dir + Math.PI);
  return Math.abs(angleDiff(heading, from)) / DEG;
}

export function targetSpeed(state: SailState, p: SailParams, wind: WindSample): number {
  const rel = p.personalWind ? 135 : relWindDeg(state.heading, wind);
  const windS = p.personalWind ? Math.max(0.8, wind.strength) : wind.strength;
  const eff = polarEfficiency(p.rig, rel, p.noGoDeg, p.weatherly);
  let windFactor = 0.3 + 0.7 * Math.min(1.15, windS);
  if (p.sweeps && windS < 0.5) windFactor *= 1.25;
  const sailFactor = Math.pow(state.sail, 0.85);
  const sailHealth = 0.25 + 0.75 * p.sailHealth;
  const crew = 0.45 + 0.55 * p.crewFactor;
  return p.maxSpeed * eff * windFactor * sailFactor * sailHealth * crew * p.loadFactor * p.speedMul;
}

export function stepSailing(s: SailState, input: SailInput, p: SailParams, wind: WindSample, current: { x: number; y: number }, dt: number): SailState {
  const sailRate = p.sailChangeRate * (0.5 + 0.5 * p.crewFactor);
  const sail = approach(s.sail, clamp(input.sailTarget, 0, 1), sailRate * dt);
  const rudder = approach(s.rudder, clamp(input.rudder, -1, 1), 2.8 * dt);

  let tgt = targetSpeed({ ...s, sail }, p, wind);
  // Sweeps: the crew rows when the wind fails.
  if (p.sweeps && input.sailTarget > 0) tgt = Math.max(tgt, 3 * (0.45 + 0.55 * p.crewFactor));
  let speed: number;
  if (s.speed < tgt) speed = Math.min(tgt, s.speed + p.accel * dt);
  else speed = Math.max(tgt, s.speed - (p.accel * 0.7 + 0.25 + s.speed * 0.04) * dt);

  // Even a stopped ship can come about slowly (boats, sweeps, backed sails), so nobody is stuck in irons.
  const steerage = clamp(0.5 + speed / Math.max(1, p.maxSpeed * 0.6), 0.5, 1);
  const rudderEff = 0.3 + 0.7 * p.rudderHealth;
  const heading = wrapAngle(s.heading + rudder * p.turnRate * steerage * rudderEff * dt);

  const fwd = headingVec(heading);
  const cm = 1 + p.currentMul;
  const x = s.x + (fwd.x * speed + current.x * cm) * dt;
  const y = s.y + (fwd.y * speed + current.y * cm) * dt;
  return { x, y, heading, speed, sail, rudder };
}
