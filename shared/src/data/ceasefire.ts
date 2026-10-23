// A ceasefire bought from the sea's ships attacking a captain (owner, 2026-10-18: «с кораблями нужно дать возможность
// договариваться о прекращении огня, часто меня атакуют сразу несколько. Жертвой прекращения может быть отдать серебро
// или например груз … условно прекращение огня это 15 процентов. И обязательно нужно дать несколько проверок к тому,
// чтобы это же корабль точно прекратил огонь»). The server's rules: server/src/game/ceasefire.ts; docs/31 §11.

/** Each ship's price: this share of what the captain carries (her silver and her hold at the goods' base prices). */
import { REACH_HAIL } from './reach.ts';

export const TRUCE_SHARE = 0.15;
/** …and never less than this (a captain with nothing aboard still pays something, if she has it). */
export const TRUCE_MIN = 10;
/** How long a ship paid keeps her guns quiet and lets the captain be. */
export const TRUCE_SEC = 600;
/** After a talk, how long before the captain may talk again (no spamming the sea's ships). */
export const TALK_COOLDOWN = 20;
/** A ship that refused does not talk with that captain again for this long. */
export const REFUSED_SEC = 180;
/** How near a ship must be to be talked to: hull to hull (reach.ts REACH_HAIL — owner, 2026-10-22: 2.5 km → 500 m → 450 m). */
export const TALK_R = REACH_HAIL;
/** How long a ship paid turns away from the captain before she goes her own way. */
export const TURN_AWAY_SEC = 25;

/** One ship's price on what the captain carries. */
export function trucePrice(carried: number): number {
  return Math.max(TRUCE_MIN, Math.round(Math.max(0, carried) * TRUCE_SHARE));
}

/** The chance a rover in lawless water refuses (and takes nothing), by her fighting power over the captain's: one in
 *  seven at even odds, half when she is twice as strong, never under a tenth nor over three in four. */
export function refuseChance(ratio: number): number {
  const r = Number.isFinite(ratio) ? ratio : 4;
  return Math.max(0.1, Math.min(0.75, 0.15 + 0.35 * (r - 1)));
}

/** A ship in the talk as the captain sees her. */
export interface TruceShip {
  id: number;
  name: string;
  /** Her price, silver (the goods' base value when paid in cargo). */
  price: number;
  /** She may be talked to now; else `why`. */
  ok: boolean;
  why?: string;
  /** The chance she refuses, 0..1 (a rover in lawless water), else 0. */
  risk: number;
  /** A truce with her holds now, until (server time). */
  truce?: number;
}

/** The talk: the ships attacking her, their prices and the total, what she has, and how the last offer went. */
export interface CeasefireView {
  ships: TruceShip[];
  /** Her silver and her hold's base value. */
  silver: number;
  cargo: number;
  /** The total for every ship that may be talked to. */
  total: number;
  /** No new talk before (server time). */
  cooldown: number;
  /** The ship she tapped (first in the list). */
  focus?: number;
  /** The last offer: who agreed and who refused, and what was paid (silver, and goods' value). */
  result?: { id: number; name: string; agreed: boolean; why?: string }[];
  paid?: { silver: number; cargo: number };
}
