// A ship with her sails shot away and no sailcloth aboard (owner, 2026-10-20: «без парусины корабль ваще не плывет,
// надо что-то с этим сделать. может какое-то самоуничтожение. кстати в обломках которые раскиданы по морю надо сделать
// так чтобы помимо бабок всегда было чутка парусины и дерева»). Three answers, the numbers here:
//  - the speed floor (shared/src/sim/sailing.ts): torn sails keep 40 % of her way, never less than 35 % with her crew
//    and her hold counted in — a fight on chain shot still pays, a ship is never left lying dead;
//  - the jury rig: under a fifth of her sails and no sailcloth, her crew rigs a sail of spars and hammocks — up to a
//    quarter of her sails in a minute, for nothing, again each time they are shot away; never above a quarter;
//  - «Затопить и вернуться в порт»: her own scuttling, by the sinking's rules (Game.playerDeath), out of the fight only,
//    once in ten minutes; she wakes at the nearest harbour that will have her.
// And every spot of the sea's wreckage carries a little sailcloth and planks besides its goods (wreckExtras).

/** Torn sails: the share of her way she keeps at no sails at all (0.25 before 2026-10-20). */
export const SAIL_TORN_MUL = 0.4;
/** Her sails, her crew and her hold together never hold her below this share of her way… */
export const SAIL_FLOOR = 0.35;
/** …nor above this share of what the crew and the hold alone allow (so torn sails always cost something). */
export const SAIL_FLOOR_OF_FIT = 0.85;

/** The jury rig is rigged under this share of her sails, with no sailcloth aboard. */
export const JURY_BELOW = 0.2;
/** It brings her sails up to this share, and no higher. */
export const JURY_TO = 0.25;
/** Seconds from no sails at all to a quarter (the pace: JURY_TO / JURY_SEC of her sails a second). */
export const JURY_SEC = 60;
/** Sailcloth under this (a scrap) is none. */
export const CLOTH_SCRAP = 0.2;

/** Stranded: slower than this (knots) for STRANDED_SEC… */
export const STRANDED_KN = 1;
export const STRANDED_SEC = 20;
/** …or this far from any harbour (metres), with her sails under a fifth and no sailcloth. */
export const STRANDED_FAR = 3000;

/** Her own scuttling: once in this long (real milliseconds). */
export const SCUTTLE_CD_MS = 10 * 60_000;

/** The share of her way torn sails leave her (0..1 health), before the crew and the hold. */
export function sailHealthMul(health: number): number {
  return SAIL_TORN_MUL + (1 - SAIL_TORN_MUL) * Math.max(0, Math.min(1, health));
}

/** Sails, crew and hold together (`fit` = crew × hold, 0..1): the floor keeps her moving, never faster than sound sails. */
export function sailShape(health: number, fit: number): number {
  return Math.max(sailHealthMul(health) * fit, Math.min(fit * SAIL_FLOOR_OF_FIT, SAIL_FLOOR));
}

/** The crew rigs (or keeps rigging) a jury sail: her sails under the mark, no sailcloth aboard. Once rigging, they go on
 *  to a quarter (the mark is where they start, a quarter where they stop). */
export function juryWanted(sails: number, cloth: number, rigging: boolean): boolean {
  if (cloth >= CLOTH_SCRAP) return false;
  return rigging ? sails < JURY_TO : sails < JURY_BELOW;
}

/** Her sails (0..1) after `dt` seconds of the jury rig: up at the rig's pace, never past a quarter, never down. */
export function juryStep(sails: number, dt: number): number {
  if (sails >= JURY_TO) return sails;
  return Math.min(JURY_TO, sails + (JURY_TO / JURY_SEC) * Math.max(0, dt));
}

/** Seconds the rig still needs from these sails (0..1). */
export function juryLeft(sails: number): number {
  return Math.max(0, Math.ceil(((JURY_TO - sails) / JURY_TO) * JURY_SEC));
}

/** Stranded: sails under a fifth and no sailcloth, and either lying still for STRANDED_SEC or far from any harbour. */
export function isStranded(o: { sails: number; cloth: number; slowFor: number; portDist: number }): boolean {
  if (o.sails >= JURY_BELOW || o.cloth >= CLOTH_SCRAP) return false;
  return o.slowFor >= STRANDED_SEC || o.portDist > STRANDED_FAR;
}

/** Why she may not scuttle now (null: she may). The fight first, then the cooldown. */
export function scuttleWhy(o: { docked: boolean; sinking: boolean; boarding: boolean; combat: boolean; landing?: boolean; sinceMs: number }): string | null {
  if (o.docked) return 'You are in port';
  if (o.sinking) return 'She is going down already';
  if (o.boarding || o.combat) return 'Not in a fight: scuttling under fire is a defeat, not a way home';
  if (o.landing) return 'Recall the party ashore first';
  if (o.sinceMs < SCUTTLE_CD_MS) return `You scuttled a ship not long ago: again in ${Math.ceil((SCUTTLE_CD_MS - o.sinceMs) / 60_000)} min`;
  return null;
}

/** What scuttling costs, as the sinking reckons it (Game.beginSinking, Game.playerDeath): a twentieth of the purse into
 *  her wreck on the water, the yard's fee (a tenth of her class's price, as far as the purse goes), a tenth of the rest, the hold (two-fifths of it left on the water, the rest gone;
 *  the lifeboats save a fifth a rank of the lawful goods), about a third of the crew (less with lifeboats), half the
 *  shot, a tenth off every worn item. */
export function scuttleQuote(o: { gold: number; classPrice: number; crew: number; cargoValue: number; lifeboats: number }): { fee: number; purse: number; crew: number; cargo: number } {
  const wreck = Math.floor(Math.max(0, o.gold) * 0.05);
  const fee = Math.min(Math.floor(o.gold - wreck), Math.round(o.classPrice * 0.1));
  const purse = wreck + Math.floor((o.gold - wreck - fee) * 0.1);
  const crew = Math.max(0, Math.round(o.crew * 0.35 * Math.max(0, 1 - 0.3 * o.lifeboats)));
  return { fee, purse, crew, cargo: Math.round(o.cargoValue) };
}

/** The little sailcloth and planks every spot of wreckage carries besides its goods, by the sea's level (1..10): 1–3
 *  bolts and 2–5 planks — about a quarter of a small hull's sails and some of her hull. */
export function wreckExtras(level: number): { sailcloth: number; planks: number } {
  const l = Math.max(1, Math.min(10, Math.round(level)));
  return { sailcloth: 1 + Math.round(((l - 1) * 2) / 9), planks: 2 + Math.round((l - 1) / 3) };
}

/** The adrift state on the wire (`adrift`): the rig's progress (0..1 of the way to a quarter; null: none), stranded,
 *  and the seconds until she may scuttle again (0: now). */
export interface AdriftView {
  jury: number | null;
  /** Seconds the rig still needs (with `jury`). */
  left: number;
  stranded: boolean;
  /** Paused: under fire the crew leaves the rig. */
  paused: boolean;
  cd: number;
  /** The nearest harbour that will have her (where scuttling wakes her). */
  port: string | null;
}
