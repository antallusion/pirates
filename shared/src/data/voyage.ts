// Readiness for a voyage (owner, 2026-09-30: «before going out to sea there should be hints saying what is missing
// for a full normal voyage»): what a ship eats, how many hands she needs to sail and fight well, the shot for a
// fight, and the state of her hull and canvas — and so what is short before she leaves port. Pure: the port screen
// asks it (client/src/ui/depart.ts), the server eats by the same rate (Game.ts shipUpkeep).

import { HULL_PER_PLANK, SAILS_PER_CLOTH } from './dealings.ts';

/** Provisions 40 hands eat in a minute at sea (docs/30: it was 6 — a starter sloop of 28 ate 252 units, 3 000 silver, an
 *  hour, more than her whole income at levels 1–3 (seaHour 1 920), and half her hold lasted 3½ minutes, so every novice
 *  sailed hungry; then 1, so the mid game's warships fed ten minutes from half their hold). Balance pass 2026-10-13
 *  (docs/31): the quests' legs run 20–40 minutes and a voyage asked ten, so half a frigate's hold (11 minutes) never
 *  saw a leg through; and the crews grow with the ⚓ faster than the waters' income (a sloop's 28 hands to a
 *  man-of-war's 600–900), so food ate a quarter of a sloop's hour at sea and four fifths of a man-of-war's (playthrough
 *  C: 19 000 an hour for 911 hands against seaHour 20 400). Now half the rate, and a great crew's mess feeds a head for
 *  less (FOOD_MESS): food is a sixth of the hour at sea on a sloop, a fifth on a frigate, a quarter on a man-of-war of
 *  900 hands. */
export const FOOD_PER_40 = 0.5;
/** A crew's mess: what a crew eats grows as its head count to this power (a big ship's galley and purser). */
export const FOOD_MESS = 0.85;

/** Provisions eaten a minute at sea: FOOD_PER_40 units for forty hands, grown by FOOD_MESS with the crew, times the
 *  ship's appetite (cooks, talents). */
export function provisionsPerMinute(crew: number, provisionUse = 1): number {
  return Math.pow(Math.max(0, crew) / 40, FOOD_MESS) * FOOD_PER_40 * Math.max(0.1, provisionUse);
}

/** A normal voyage, port to port with a fight on the way, in real minutes at sea (docs/31: a quest's leg, 20–40
 *  minutes; it was ten). */
export const VOYAGE_MINUTES = 25;
/** Food never asks for more than this share of the hold (the rest is for cargo). */
export const FOOD_HOLD_SHARE = 0.5;
/** Shot for a fight: this many broadsides. */
export const VOYAGE_BROADSIDES = 10;
/** Below this share of hull or canvas she should see the yard. */
export const REPAIR_BELOW = 0.9;
/** The share of the hold the buying on the way out always leaves free (owner, 2026-10-19: «Выходя из порта должны
 *  оставлять 20 процентов места на корабле после авто покупки рекомендаций»): the cargo after it at most 80 %. */
export const HOLD_KEEP_FREE = 0.2;
/** One repair's sailcloth (owner, 2026-10-19: «всегда надо предлагать провизию и парусину … Примерно на одну починку»):
 *  the bolts to mend this share of her sails at sea. */
export const KIT_SAILS = 0.5;

/** The sailcloth for one repair at sea: KIT_SAILS of her sails, a bolt for SAILS_PER_CLOTH of them (one at least). */
export function repairKitCloth(sailsMax: number): number {
  return Math.max(1, Math.ceil((Math.max(0, sailsMax) * KIT_SAILS) / SAILS_PER_CLOTH));
}

/** The hold's room the buying on the way out may fill (m³): what is free less HOLD_KEEP_FREE of the whole. */
export function buyRoom(s: Pick<VoyageShip, 'holdVolume' | 'holdFree'>): number {
  return Math.max(0, s.holdFree - s.holdVolume * HOLD_KEEP_FREE);
}

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
  /** The sailcloth aboard (bolts); unset: not reckoned (one repair's worth is asked for when it is set). */
  cloth?: number;
  /** A bolt's room in her hold (m³; 0.5 by default). */
  clothVolume?: number;
}

export type VoyageNeed =
  | { kind: 'food'; have: number; want: number; buy: number; minutes: number }
  | { kind: 'crew'; have: number; want: number; buy: number }
  | { kind: 'ammo'; have: number; want: number; buy: number }
  | { kind: 'cloth'; have: number; want: number; buy: number }
  | { kind: 'repair'; hull: number; sails: number };

/** Playthrough C: a warship's bread room — what a big crew eats is stowed in her own storerooms as well as the hold, so a
 *  provision takes this share of a cubic metre in her: half her hold feeds her full crew a voyage. The great warships
 *  carry crews out of all measure with their holds (a man-of-war 600 hands and 130 m³, a ship of the line 680 and 140):
 *  they ate 15–17 units a minute and half the hold fed them four minutes, the whole of it eight — never a voyage. A hull
 *  whose half hold feeds her crew ten minutes already (the sloop, the frigate, the galleon) keeps a whole cubic metre. */
export function breadRoom(crewMax: number, holdVolume: number): number {
  const voyage = provisionsPerMinute(crewMax) * VOYAGE_MINUTES;
  return Math.min(1, (Math.max(0, holdVolume) * FOOD_HOLD_SHARE) / Math.max(1, voyage));
}

/** The provisions a voyage wants: VOYAGE_MINUTES of eating, held to half the hold. */
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
  // (the hold's room less the fifth always left free: owner, 2026-10-19)
  const room = buyRoom(s);
  if (have < food) {
    const n = Math.floor(room / Math.max(0.05, s.provisionVolume));
    out.push({ kind: 'food', have, want: food, buy: Math.max(0, Math.min(food - have, n)), minutes: VOYAGE_MINUTES });
  }
  // one repair's sailcloth, always offered while short of it (owner, 2026-10-19)
  if (s.cloth !== undefined) {
    const want = repairKitCloth(s.sailsMax), got = Math.floor(s.cloth);
    // (the room: the window's plan fills the hold in the order a voyage needs, food first — client/src/ui/depart.ts)
    // (no room for a bolt: not asked — a full hold is not stopped at every harbour for it)
    const buy = Math.max(0, Math.min(want - got, Math.floor(room / Math.max(0.05, s.clothVolume ?? 0.5))));
    if (got < want && buy > 0) out.push({ kind: 'cloth', have: got, want, buy });
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

/** The planks and the sailcloth her carpenters need to mend at sea the harm she has (a plank for HULL_PER_PLANK of hull
 *  and one for a broken rudder, a bolt for SAILS_PER_CLOTH of sail, times her use of them), less what is aboard. The
 *  window before sailing offers them when the yard's whole mending is past her purse (owner, 2026-10-09: no buying at
 *  the way out by itself). */
export function voyageStores(s: { hull: number; hullMax: number; sails: number; sailsMax: number; rudderHp: number; use: number; planks: number; cloth: number }): { planks: number; cloth: number } {
  const use = Math.max(0.3, s.use);
  return {
    planks: Math.max(0, Math.ceil(((s.hullMax - s.hull) / HULL_PER_PLANK) * use + (s.rudderHp < 1 ? 1 : 0) - s.planks)),
    cloth: Math.max(0, Math.ceil(((s.sailsMax - s.sails) / SAILS_PER_CLOTH) * use - s.cloth)),
  };
}

/** How long the provisions aboard last at sea, in minutes. */
export function foodMinutes(provisions: number, crew: number, provisionUse = 1): number {
  const r = provisionsPerMinute(crew, provisionUse);
  return r > 0 ? provisions / r : Infinity;
}
