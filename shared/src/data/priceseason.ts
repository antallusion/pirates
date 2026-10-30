// The ports' price seasons (owner, 2026-10-30: «цены должны кстати динамично меняться на товары продаваемые, чтобы люди
// могли зарабатывать. нужно прям систему сделать нормальную, которая раз в 8 часов меняет цены»).
//
// Every PRICE_PERIOD_MS of the wall clock a new «season» begins: each port's every good gets a factor on its price,
// drawn from the period's index, the port and its sea alone — the same on every server and after every restart, so
// nothing but the admin's run-ahead (`offset`) is ever stored. The factor stays within ±vol of 1, vol 10 % (the ship's
// stores) to 35 % (luxuries, contraband, the deep's goods). Part of it is the sea's (the region's), part the port's own:
// a whole sea runs short of sugar while the next has plenty — the trade routes of the period. A port's trade is kept:
// what it makes is never pushed dear by more than half its vol, what it eats never cheap by more than half.

import { GOODS } from './goods.ts';
import type { GoodCategory, GoodId } from './goods.ts';

/** One price period: eight hours of the wall clock. */
export const PRICE_PERIOD_MS = 8 * 3600_000;

/** How far a season moves a good's price (± of its price), by its kind. */
export const SEASON_VOL: Record<GoodCategory, number> = {
  supply: 0.1, staple: 0.18, industrial: 0.22, military: 0.22, luxury: 0.3, contraband: 0.35, mystic: 0.35, rare: 0.35,
};
export const SEASON_VOL_MIN = 0.1;
export const SEASON_VOL_MAX = 0.35;
/** The sea's share of the swing (the rest is the port's own). */
export const SEASON_REGION_SHARE = 0.45;

export function seasonVol(good: GoodId): number {
  return Math.max(SEASON_VOL_MIN, Math.min(SEASON_VOL_MAX, SEASON_VOL[GOODS[good].category] ?? 0.2));
}

/** The period's index at a wall time (ms), and the admin's run-ahead. */
export function pricePeriod(wallMs: number, offset = 0): number {
  return Math.floor(wallMs / PRICE_PERIOD_MS) + offset;
}

/** Milliseconds till the next period. */
export function periodLeftMs(wallMs: number): number {
  const r = wallMs % PRICE_PERIOD_MS;
  return PRICE_PERIOD_MS - (r < 0 ? r + PRICE_PERIOD_MS : r);
}

/** A number in [0, 1) from a string (FNV-1a, then a finaliser): the same everywhere, every time. */
function unit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A port's trade in a good: −1 it makes more than it eats (cheap here), +1 it eats more (dear), 0 neither. */
export type TradeSide = -1 | 0 | 1;

/** The season's factor on a good's price in a port for a period: within [1 − vol, 1 + vol]. */
export function seasonFactor(period: number, portId: string, region: string, good: GoodId, side: TradeSide): number {
  const vol = seasonVol(good);
  const own = unit(`${period}|p|${portId}|${good}`) * 2 - 1;
  const sea = unit(`${period}|r|${region}|${good}`) * 2 - 1;
  let f = (own * (1 - SEASON_REGION_SHARE) + sea * SEASON_REGION_SHARE) * vol;
  // (the port's trade kept: a producer never dear by more than half the swing, a consumer never cheap by more)
  if ((side < 0 && f > 0) || (side > 0 && f < 0)) f *= 0.5;
  return 1 + f;
}

/** The time till the next period in words («3 ч 12 мин» / «3 h 12 min»). */
export function periodLeftText(ms: number, ru: boolean): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60), r = m % 60;
  if (ru) return h ? `${h} ч ${r} мин` : `${r} мин`;
  return h ? `${h} h ${r} min` : `${r} min`;
}
