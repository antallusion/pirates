// A ship of the sea hired at sea as a guard for a while (owner, 2026-10-25: «сделай чтобы я мог нанять в море корабль
// любого нпс на время, типа от 10 до 20 минут, за плату золотом. он бы плыл рядом и охранял меня. обязательно нпс должен
// быть такого же уровня что и я. плата должна соответствовать уровню корабля и его мощности, дешевым эту услугу не
// делай»). The numbers and the card's shape; the server's rules: server/src/game/seahire.ts.
//
//  - who: a peaceful ship of the sea (a merchant, a fisher, a patrol, a hunter, a rover who is no foe of hers) of HER ⚓ —
//    the ⚓ of her own ships (shipBandOf, canon D12);
//  - where: within the hail (reach.ts REACH_HAIL, 450 m hull to hull) — a hire is a word across the water, as the
//    ceasefire's talks are (owner, 2026-10-22: «переговоры тоже 450»); a merchant under way is not caught at the boats'
//    30 m without the pursuit's helm, and the pursuit is an attack order;
//  - for how long: 10, 15 or 20 minutes of the server's clock, running in port too;
//  - the price: silver, by her ⚓'s hour at sea (hourSilver) and by the ship's own fight against the usual warship of
//    that ⚓ — 20 minutes of an even warship cost half an hour at sea of her waters, 10 minutes about 19 minutes' worth;
//    nothing back when she is dismissed or sunk.

import { hourSilver } from './xpcurve.ts';
import { REACH_HAIL } from './reach.ts';
import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { hullsFor } from './shiplevel.ts';

/** The contracts on offer, minutes. */
export const HIRE_MINUTES = [10, 15, 20] as const;
export type HireMinutes = (typeof HIRE_MINUTES)[number];
/** How near she must be to be hailed: hull to hull (metres). */
export const HIRE_REACH = REACH_HAIL;
/** The trades that sign on (the dead, the beasts, the great ones and the escorts of others never do). */
export const HIRE_ROLES = ['merchant', 'fisher', 'patrol', 'hunter', 'pirate'] as const;
/** The price, in hours at sea of her ⚓: a fixed part (the master's signing on, the course given up) and a share a minute. */
export const HIRE_FIXED_H = 0.12;
export const HIRE_MINUTE_H = 0.019;
/** The hull's own worth against the usual warship of her ⚓, held within these. */
export const HIRE_POWER_MIN = 0.75;
export const HIRE_POWER_MAX = 1.5;
/** A battered ship is cheaper, but never below this share. */
export const HIRE_CONDITION_MIN = 0.6;
/** The same captain cannot hire the same ship again this soon after a contract ends (seconds). */
export const REHIRE_SEC = 300;
/** Escorts at once: one; two from this ⚓ on (a senior captain's squadron of the line). */
export const HIRE_TWO_FROM = 8;

export function hireSlots(band: number): number {
  return band >= HIRE_TWO_FROM ? 2 : 1;
}

/** A hull's fight by its class (her hull, her broadside, her men): the level's growth is the same for every hull of a ⚓. */
export function classFight(c: ShipClassId): number {
  const d = SHIP_CLASSES[c];
  return d.hull * (1 + 2 * d.gunPortsPerSide) * Math.sqrt(Math.max(1, d.crewMax));
}

/** The usual warship of ⚓v (the rovers' hulls of her waters, the mean). */
export function refFight(v: number): number {
  const hs = hullsFor('pirate', Math.max(1, Math.min(10, Math.round(v))));
  return hs.reduce((a, c) => a + classFight(c), 0) / Math.max(1, hs.length);
}

/** Her hull's worth against the usual warship of her ⚓ (the square root: a first-rate is not worth four sloops). */
export function powerMul(c: ShipClassId, v: number, elite = false): number {
  const k = Math.sqrt(classFight(c) / Math.max(1, refFight(v))) * (elite ? 1.3 : 1);
  return Math.max(HIRE_POWER_MIN, Math.min(HIRE_POWER_MAX, k));
}

/** The price of `minutes` of a ship of ⚓v whose worth is `power` (powerMul) and whose fight left is `condition` (0..1). */
export function hirePrice(v: number, minutes: number, power: number, condition = 1): number {
  const h = HIRE_FIXED_H + HIRE_MINUTE_H * minutes;
  const c = Math.max(HIRE_CONDITION_MIN, Math.min(1, condition));
  return Math.max(10, Math.round((hourSilver(v) * h * power * c) / 10) * 10);
}

/** What the price is in minutes at sea of her ⚓'s silver. */
export function priceMinutes(v: number, price: number): number {
  return Math.round((price / hourSilver(v)) * 60);
}

/** A contract kept with the captain's profile across a restart, a relog or a crossing (owner's coordinator, 2026-10-25:
 *  paid silver is never lost to a deploy): the guard's hull and trade, and the real seconds left of it. */
export interface SavedHire {
  classId: ShipClassId;
  level: number;
  role: string;
  faction: string;
  name: string;
  captain: string;
  minutes: number;
  paid: number;
  left: number;
}

/** What is given back of a contract that cannot be restored: the unused share of its price. */
export function hireRefund(h: Pick<SavedHire, 'paid' | 'minutes' | 'left'>): number {
  return Math.max(0, Math.floor((h.paid * Math.max(0, h.left)) / Math.max(1, h.minutes * 60)));
}

/** The hire as the captain sees her: the ship, the offers, her silver, and why not if not. */
export interface HireOffer {
  id: number;
  name: string;
  classId: ShipClassId;
  shipLevel: number;
  /** Her guns a side, her men, her hull (whole, for the card). */
  guns: number;
  crew: number;
  crewMax: number;
  hull: number;
  hullMax: number;
  /** The captain's own ⚓ (the one that may be hired). */
  band: number;
  /** The prices of 10 / 15 / 20 minutes. */
  prices: number[];
  silver: number;
  /** She may be hired now; else `why`. */
  ok: boolean;
  why?: string;
}

/** A hired escort as the HUD's chip shows her. */
export interface HireEscort {
  id: number;
  name: string;
  classId: ShipClassId;
  shipLevel: number;
  /** Her contract ends (server time). */
  until: number;
  hull: number;
  hullMax: number;
  x: number;
  y: number;
  /** Lying off the harbour while her captain is in port. */
  waiting?: boolean;
}

export interface HireView {
  escorts: HireEscort[];
  slots: number;
}
