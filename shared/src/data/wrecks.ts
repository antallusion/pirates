// Wreckage and castaways of her own (seaux, owner 2026-10-11):
//  «Обломки разные на карте должны привязываться к игроку, и генерироваться к игроку, чтобы у каждого были свои обломки
//   и респаун у них должен быть 48 часов. И я всегда должен их подбирать»;
//  «в море должны быть сгенерированы плавающие матросы, проплывая мимо них их можно на борт поднимать, это решит вопрос
//   нехватки постоянной людей на корабле».
// The sea is cut into square cells; in each, a captain's own dice (her account and the cell) lay none, one or two spots of
// wreckage, the same for her every time she passes — and no one else's. She takes one by sailing through it (or one tap
// sails her there); it is gone for her for 48 hours. Castaways are men clinging to a spar: a few turn up for her along her
// way (more often when her crew is thin), they come aboard as she passes, a cap an hour keeps the tavern the place for men.

import type { GoodId } from './goods.ts';
import { GOODS } from './goods.ts';

/** The side of a cell of wreckage (metres); the cells round her (3 × 3) are what she sees. */
export const WRECK_CELL = 2400;
/** The cells across the sea (96 km / 2.4 km). */
export const WRECK_CELLS = 40;
/** Spots of wreckage a cell lays for a captain: none, one or two, by these chances. */
export const WRECK_PER_CELL: readonly [number, number, number] = [0.35, 0.45, 0.2];
/** Gone for her this long after she took it (real milliseconds). */
export const WRECK_AGAIN_MS = 48 * 3_600_000;
/** Within this of a spot (metres, from her hull's middle, beyond half her length) she takes it as she passes. */
export const WRECK_PICK = 45;
/** The water clear of anything solid this far round a spot (a hulk, a skerry, a floe: her hull would never come). */
export const WRECK_CLEAR = 70;

/** What floats: a good, how many (at level 1), how often. */
export const WRECK_GOODS: readonly [GoodId, [number, number], number][] = [
  ['provisions', [3, 8], 5], ['rum', [2, 5], 3], ['timber', [2, 6], 3], ['planks', [2, 4], 2], ['sailcloth', [1, 3], 2],
  ['tar', [2, 4], 2], ['salt', [2, 5], 2], ['cloth', [1, 3], 1],
];

/** How many of a good a spot of a sea's level holds (a little more in harder waters). */
export function wreckCount(lo: number, hi: number, u: number, level: number): number {
  const n = lo + Math.floor(u * (hi - lo + 1));
  return Math.max(1, Math.round(n * (1 + 0.15 * (Math.max(1, Math.min(10, level)) - 1))));
}

/** What it is worth, as the plate says («обломки · ≈N серебра»): the goods at their base price. */
export function wreckValue(good: GoodId, n: number): number {
  return Math.round(GOODS[good].basePrice * n);
}

/** The spot's id for her (unique among her cells): the cell's number and its place in it. */
export const wreckId = (cx: number, cy: number, k: number): number => (cy * WRECK_CELLS + cx) * 4 + k;

// ------------------------------------------------------------------------------------------------ castaways

/** Seconds of sailing between two castaways for her: a full crew waits the long end, a thin one the short. */
export const CAST_EVERY: readonly [number, number] = [150, 330];
/** Where one turns up: ahead of her, off her course (metres). */
export const CAST_AT: readonly [number, number] = [450, 900];
/** How long one clings to his spar (seconds) before the sea takes him. */
export const CAST_TTL = 240;
/** Within this of him (metres, from her hull's middle) he is hauled aboard as she passes. */
export const CAST_PICK = 60;
/** Men a castaway brings: one to three. */
export const CAST_MEN: readonly [number, number] = [1, 3];
/** Men an hour at most from the sea (the tavern stays the place to hire a crew). */
export const CAST_HOURLY = 12;

/** The wait before the next castaway, by how full her crew is (0..1) and a roll in [0, 1): the thinner, the sooner. */
export function castWait(full: number, u: number): number {
  const [lo, hi] = CAST_EVERY;
  const f = Math.max(0, Math.min(1, full));
  // half the crew or less: the short end; a full one: the long end
  const mid = lo + (hi - lo) * Math.max(0, (f - 0.5) * 2);
  return Math.round(mid * (0.8 + 0.4 * Math.max(0, Math.min(1, u))));
}

/** The view of a spot of wreckage and of a castaway on the wire (her own only). */
export interface WreckView {
  id: number;
  x: number;
  y: number;
  /** ≈ silver it is worth (the plate). */
  value: number;
}
export interface CastawayView {
  id: number;
  x: number;
  y: number;
  /** Men clinging to the spar. */
  n: number;
  /** Seconds left. */
  left: number;
}
