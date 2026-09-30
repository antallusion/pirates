// Readiness for a voyage (owner, 2026-09-30: «before going out to sea there should be hints saying what is missing
// for a full normal voyage»): what a ship eats, how many hands she needs to sail and fight well, the shot for a
// fight, and the state of her hull and canvas — and so what is short before she leaves port. Pure: the port screen
// asks it (client/src/ui/depart.ts), the server eats by the same rate (Game.ts shipUpkeep).

/** Provisions eaten a minute at sea: 6 units for every 40 hands, times the ship's appetite (cooks, talents). */
export function provisionsPerMinute(crew: number, provisionUse = 1): number {
  return (Math.max(0, crew) / 40) * 6 * Math.max(0.1, provisionUse);
}

/** A normal voyage, port to port with a fight on the way, in real minutes at sea. */
export const VOYAGE_MINUTES = 10;
/** Food never asks for more than this share of the hold (the rest is for cargo). */
export const FOOD_HOLD_SHARE = 0.5;
/** Shot for a fight: this many broadsides. */
export const VOYAGE_BROADSIDES = 10;
/** Below this share of hull or canvas she should see the yard. */
export const REPAIR_BELOW = 0.9;

export interface VoyageShip {
  crew: number;
  crewMin: number;
  crewMax: number;
  provisions: number;
  provisionUse: number;
  /** The whole hold (m³) and what is free of it; a provision takes one m³ times its volume multiplier. */
  holdVolume: number;
  holdFree: number;
  provisionVolume: number;
  roundShot: number;
  gunsPerSide: number;
  hull: number;
  hullMax: number;
  sails: number;
  sailsMax: number;
}

export type VoyageNeed =
  | { kind: 'food'; have: number; want: number; buy: number; minutes: number }
  | { kind: 'crew'; have: number; want: number; buy: number }
  | { kind: 'ammo'; have: number; want: number; buy: number }
  | { kind: 'repair'; hull: number; sails: number };

/** The provisions a voyage wants: ten minutes of eating, held to half the hold. */
export function voyageFood(s: Pick<VoyageShip, 'crew' | 'provisionUse' | 'holdVolume' | 'provisionVolume'>): number {
  const want = Math.ceil(provisionsPerMinute(s.crew, s.provisionUse) * VOYAGE_MINUTES);
  return Math.max(1, Math.min(want, Math.floor((s.holdVolume * FOOD_HOLD_SHARE) / Math.max(0.05, s.provisionVolume))));
}

/** The hands she wants: enough to sail at her best (crewFactor 1), never past her berths. */
export function voyageCrew(s: Pick<VoyageShip, 'crewMin' | 'crewMax'>): number {
  return Math.min(s.crewMax, Math.ceil(Math.max(s.crewMin, s.crewMax * 0.55)));
}

/** What is short for a normal voyage, most pressing first; empty when she is ready. */
export function voyageNeeds(s: VoyageShip): VoyageNeed[] {
  const out: VoyageNeed[] = [];
  const food = voyageFood(s);
  const have = Math.floor(s.provisions);
  if (have < food) {
    const room = Math.floor(Math.max(0, s.holdFree) / Math.max(0.05, s.provisionVolume));
    out.push({ kind: 'food', have, want: food, buy: Math.max(0, Math.min(food - have, room)), minutes: VOYAGE_MINUTES });
  }
  const hands = voyageCrew(s);
  if (s.crew < hands) out.push({ kind: 'crew', have: s.crew, want: hands, buy: hands - s.crew });
  if (s.gunsPerSide > 0) {
    const shot = Math.ceil((s.gunsPerSide * VOYAGE_BROADSIDES) / 10) * 10;
    if (s.roundShot < shot) out.push({ kind: 'ammo', have: s.roundShot, want: shot, buy: Math.ceil((shot - s.roundShot) / 10) * 10 });
  }
  const hull = s.hull / Math.max(1, s.hullMax), sails = s.sails / Math.max(1, s.sailsMax);
  if (hull < REPAIR_BELOW || sails < REPAIR_BELOW) out.push({ kind: 'repair', hull, sails });
  return out;
}

/** How long the provisions aboard last at sea, in minutes. */
export function foodMinutes(provisions: number, crew: number, provisionUse = 1): number {
  const r = provisionsPerMinute(crew, provisionUse);
  return r > 0 ? provisions / r : Infinity;
}
