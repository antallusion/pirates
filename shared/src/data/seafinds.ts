// docs/19 D5 (owner, 2026-10-02: «пока скучновато… придумай»): the sea's small things between a captain's goals, each
// a button on her action bar when she is at it — a message in a bottle (a hint or a piece of a map), flying fish
// landing on her deck (provisions), a dead calm with a bank of fog (a chance at a cache in it), gulls wheeling over a
// shoal (the fishing marked), a sinking boat with her sailors (taken aboard: deckhands for nothing), a chest afloat
// with sharks round it (a small fight on the battle at sea, the chest the prize). Each is her own (sighted for her),
// for a few minutes; each kind rolls on dice of its own; what each gives is modest.

import { armyPower } from './army.ts';
import { guardBaseMight } from './advmap.ts';
import type { GoodId } from './goods.ts';

export type FindKind = 'bottle' | 'flyfish' | 'calm' | 'gulls' | 'boat' | 'chest';
export const FIND_KINDS: FindKind[] = ['bottle', 'flyfish', 'calm', 'gulls', 'boat', 'chest'];
export const isFindKind = (k: unknown): k is FindKind => typeof k === 'string' && (FIND_KINDS as string[]).includes(k);

/** Seconds of quiet sailing between two of them for a captain, and how often each kind is the one. */
export const FIND_EVERY: [number, number] = [150, 260];
export const FIND_WEIGHT: Record<FindKind, number> = { bottle: 3, flyfish: 3, calm: 1.5, gulls: 3, boat: 2, chest: 1.5 };
/** How long one stays (seconds), and where it shows (metres off her, ahead or abeam; the fish land aboard). */
export const FIND_TTL: [number, number] = [150, 240];
export const FIND_AT: [number, number] = [650, 1200];
/** Within this of it (metres) she is at it; the fog bank is as wide as its reach. */
export const FIND_REACH: Record<FindKind, number> = { bottle: 140, flyfish: 0, calm: 360, gulls: 300, boat: 200, chest: 240 };
/** Slower than this (m/s) for the boats' work; the gulls and the fish want no stop. */
export const FIND_SLOW: Record<FindKind, number> = { bottle: 3, flyfish: 99, calm: 3, gulls: 99, boat: 3, chest: 3 };
/** Seconds of the work (the chest's is the fight). */
export const FIND_WORK: Record<FindKind, number> = { bottle: 2, flyfish: 0, calm: 6, gulls: 0, boat: 3, chest: 0 };
/** The icon of each on the bar, the toast and the minimap. */
export const FIND_ICON: Record<FindKind, string> = {
  bottle: 'tattoo_bottle', flyfish: 'good_fish', calm: 'weather_fog', gulls: 'creature.gull', boat: 'talent_srv_lifeboats', chest: 'tattoo_shark_tooth',
};

/** The bottle: a hint (an island near put on her chart, or a hidden one shown) most of the time; now and then a piece
 *  of a treasure map; else a few coins in it. */
export const BOTTLE_MAP = 0.15;
export const BOTTLE_COIN = 0.15;
/** The fog bank's cache: the chance, and its worth in hours at sea of her level. */
export const CALM_CACHE = 0.4;
export const CALM_WORTH = 0.06;
/** The flying fish: provisions by her crew (a seventh of them, two at least), and as many fish again as half that. */
export const FISH_SHARE = 1 / 7;
/** The sinking boat's sailors: two, and one more for every two levels of her waters. */
export function boatHands(level: number): number {
  return 2 + Math.floor(Math.max(1, Math.min(10, level)) / 2);
}
/** The chest's worth, in hours at sea of her level (silver, and a share of it in goods). */
export const CHEST_WORTH = 0.08;
export const CHEST_GOODS: GoodId[] = ['rum', 'cloth', 'spices', 'tobacco', 'sugar'];
/** A bottle's coins and the gulls' lesson, in hours at sea of her level and in a captain's level. */
export const BOTTLE_WORTH = 0.02;

/** The shark stack round the chest: sharks of the shallows worth a fifth of the might of a captain of her waters'
 *  level (a fight of a minute or two that costs her a few men). */
export const CHEST_MIGHT = 0.2;
export function chestSharks(level: number): number {
  const L = Math.max(1, Math.min(10, level));
  return Math.max(2, Math.round(((guardBaseMight(L) / 0.75) * CHEST_MIGHT) / armyPower([{ u: 'reef_shark', n: 1 }])));
}
