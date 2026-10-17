// The resurrection of the fallen (owner, 2026-10-17: «реснуть убитых существ с моего коробля … премиум существ ресать
// можно только за дублоны, но они должны идти с 50% скидкой … я просто хочу чтобы можно было нонстоп фармить типа и
// ресать существ после абордажа … но ествественно за деньги»; docs/35_RESURRECTION.md). The numbers, pure, for the
// server that judges and the windows that show them.
//
// - The fallen record: every battle's dead past the wounded and First Aid who stood again, by kind; kept FALLEN_KEEP_H
//   hours and FALLEN_BATTLES battles at most (no hoarding a month of dead for a quiet day).
// - The line kinds, the land's and the sea's creatures, the world's armies: silver, RES_SHARE of the man's worth by his
//   tier (a half of a deckhand's, seven tenths of the seventh tier's) — under the dwelling's price, never under a coin.
// - The shop's creatures: doubloons only, half their price a head (PREMIUM_RES_OFF), rounded up to a whole doubloon.
// - Where: moored at a floating waystation, or in port (the tavern's surgeon): the price as it stands; at sea within
//   FIELD_RANGE of either (the quick «Воскресить» on the boarding's result): FIELD_MUL of it; anywhere out of a fight
//   for doubloons (the infirmary, shop.ts `refill`), or with a scroll of resurrection (one stack free).

import { UNITS } from './army.ts';
import type { UnitId } from './army.ts';
import { isShipBeast } from './shipbeasts.ts';

/** The record keeps a battle's dead this long, and no more than so many battles. */
export const FALLEN_KEEP_H = 24;
export const FALLEN_BATTLES = 20;
/** Silver a head as a share of the man's worth (UNITS[].cost) by his tier: index the tier (the eighth: the titans). */
export const RES_SHARE = [0, 0.5, 0.55, 0.55, 0.6, 0.6, 0.65, 0.7, 0.8];
/** The shop's creatures: this share off their price a head (owner: «с 50% скидкой»). */
export const PREMIUM_RES_OFF = 0.5;
/** The quick resurrection at sea (the result screen's «Воскресить»): within this of a waystation or a port, at this
 *  much of the price (the field surgeon's fee). */
export const FIELD_RANGE = 2000;
export const FIELD_MUL = 1.25;
/** The pile the window offers the scrolls for: a regular resurrection worth this many of the captain's silver
 *  (or more than RES_OFFER_SILVER), or this many stacks. */
export const RES_OFFER_SILVER = 6000;
export const RES_OFFER_STACKS = 4;
/** The scroll's single price in doubloons (the ladder's base, shop.ts UNIT_PRICE.rscroll). */
export const RSCROLL_PRICE = 95;
/** Scrolls she may keep. */
export const RSCROLL_MAX = 999;

/** Where a resurrection is made: moored at a waystation, docked in port, at sea near either, or with doubloons
 *  anywhere (the infirmary). */
export type ResPlace = 'way' | 'port' | 'field' | 'none';

/** A kind the record keeps: every man and creature of the army but the premium hulls' own (they muster again in port
 *  by themselves, shipgifts.ts), the legends and the great ones ashore (never had for silver). */
export function resKeeps(u: UnitId): boolean {
  const d = UNITS[u];
  if (!d) return false;
  if (isShipBeast(u) || d.legend) return false;
  return Number.isFinite(d.cost) && d.cost > 0;
}

/** Whether a kind is raised for doubloons (the shop's creatures). */
export const resPremium = (u: UnitId): boolean => !!UNITS[u]?.premium && !isShipBeast(u);

/** Silver a head of a kind at a waystation or in port. */
export function resSilverPer(u: UnitId): number {
  const d = UNITS[u];
  if (!d) return 0;
  const tier = Math.max(1, Math.min(RES_SHARE.length - 1, d.titan ? 8 : d.tier));
  return Math.max(1, Math.round(d.cost * RES_SHARE[tier]));
}

/** Doubloons a head of a shop's creature: half its price a head. */
export function resDoubloonsPer(u: UnitId): number {
  const p = UNITS[u]?.premium;
  return p ? (p.price / Math.max(1, p.n)) * (1 - PREMIUM_RES_OFF) : 0;
}

/** What `n` of a kind cost to raise: silver (with the place's fee) or doubloons (rounded up to a whole doubloon). */
export function resPrice(u: UnitId, n: number, place: ResPlace = 'way'): { silver: number; doubloons: number } {
  n = Math.max(0, Math.floor(n));
  if (!n) return { silver: 0, doubloons: 0 };
  if (resPremium(u)) return { silver: 0, doubloons: Math.ceil(n * resDoubloonsPer(u) - 1e-9) };
  const fee = place === 'field' ? FIELD_MUL : 1;
  return { silver: Math.ceil(n * resSilverPer(u) * fee - 1e-9), doubloons: 0 };
}

/** One battle's dead in the record. */
export interface FallenEntry {
  u: UnitId;
  n: number;
  /** When (wall ms). */
  at: number;
}

/** The record as kept on her profile. */
export interface FallenRec {
  list: FallenEntry[];
  /** The battles counted (the record trimmed to the last FALLEN_BATTLES). */
  battles: number[];
  /** Requests already answered (a resurrection's id twice raises once). */
  done: string[];
}

/** The record cut to its window: the last FALLEN_KEEP_H hours and FALLEN_BATTLES battles. */
export function fallenTrim(rec: FallenRec, now: number): void {
  const from = now - FALLEN_KEEP_H * 3_600_000;
  rec.battles = rec.battles.filter((t) => t >= from).sort((a, b) => a - b).slice(-FALLEN_BATTLES);
  const first = rec.battles[0] ?? Infinity;
  rec.list = rec.list.filter((e) => e.n > 0 && e.at >= from && e.at >= first);
  rec.done = rec.done.slice(-40);
}

/** The record by kind (the oldest first in each), as the window lists it. */
export function fallenByKind(rec: FallenRec): { u: UnitId; n: number; at: number }[] {
  const m = new Map<UnitId, { u: UnitId; n: number; at: number }>();
  for (const e of rec.list) {
    const x = m.get(e.u);
    if (x) {
      x.n += e.n;
      x.at = Math.max(x.at, e.at);
    } else m.set(e.u, { u: e.u, n: e.n, at: e.at });
  }
  return [...m.values()].sort((a, b) => b.at - a.at || (UNITS[b.u]?.tier ?? 0) - (UNITS[a.u]?.tier ?? 0));
}
