// Any island for one's own (docs/15_PERSONAL_ISLAND.md, items 6–7). A captain may claim any wild island that is not
// a port, not held or leased by anyone, not worked by an outpost, not a named pirate's lair and not in the Abyss —
// one island of her own at a time. Its waters set the terms:
//  - safe water: dear to claim and taxed a week at a time by the Crown (by the island's level, from its treasury;
//    unpaid, the buildings weather), but the Crown's patrols keep raiders and robbers off it;
//  - contested water: middling in price and tax, and the sea's pirates come for a fat store now and then;
//  - lawless water: cheap and untaxed, pirates come oftener and stronger, and a captain flying the black flag may
//    land and rob the yard (the owner warned, five minutes ashore, the island's guns on him).
// Moving house: an island abandoned returns half of what was paid for it, and another may be claimed after a wait.
//
// Raids (item 7): when the island's yard and store are worth more than its level's mark, the waters' pirates roll
// for it by the hour (rarely while the owner has long been away, never in safe water, never twice within the
// cooldown, and no more than a set share of the island is lost in a day). They give ten minutes' warning (fifteen
// with a signal tower); their ships lie off the island for the owner to come and fight. When the time runs out the
// island defends itself: its shore batteries and fort by their levels, and her own ships lying at the island, against
// the raid's strength by the waters and the island's level — `raidOdds`, after the caravans' `defenceOdds`.

import type { Tr } from './estate.ts';
import { RENT } from './holdings.ts';
import type { IslandSize } from './holdings.ts';

export type Waters = 'safe' | 'contested' | 'lawless';

export interface WatersTerms {
  name: Tr;
  /** The claim's price against a middling sea's. */
  price: number;
  /** Tax a week for each level of the island (to the waters' ruling faction, from the island's treasury). */
  tax: number;
  /** A raid's chance a day on a fat island (before its fatness and its owner's absence). */
  raidDay: number;
  /** The raiders' strength against a middling sea's, and how many ships they sail in. */
  raidMul: number;
  raiders: number;
  /** Other captains may land and rob the yard (flying the black flag). */
  robbable: boolean;
}

export const WATERS: Record<Waters, WatersTerms> = {
  safe: { name: ['Safe water', 'Безопасные воды'], price: 1.4, tax: 600, raidDay: 0, raidMul: 0, raiders: 0, robbable: false },
  contested: { name: ['Contested water', 'Спорные воды'], price: 1, tax: 250, raidDay: 0.3, raidMul: 1, raiders: 2, robbable: false },
  lawless: { name: ['Lawless water', 'Беззаконные воды'], price: 0.4, tax: 0, raidDay: 0.7, raidMul: 1.6, raiders: 3, robbable: true },
};

/** The chance of at least one raid in a day on an island twice as fat as its mark, its owner about (for the terms). */
export function raidDayOdds(waters: Waters): number {
  return 1 - Math.exp(-2 * WATERS[waters].raidDay);
}

/** A claim's price by the island's size before the waters: two and a half months of its lease. */
export const CLAIM_MUL = 2.5;

export function claimPrice(size: IslandSize, waters: Waters): number {
  return Math.round(RENT[size][30] * CLAIM_MUL * WATERS[waters].price);
}

/** The week's tax at an island level. */
export function isleTax(waters: Waters, level: number): number {
  return WATERS[waters].tax * Math.max(1, level);
}

export const TAX_DAYS = 7;
/** An unpaid week's tax weathers each building this much (its condition, 0..1). */
export const TAX_WEATHER = 0.1;

/** Moving house: half of what was paid comes back, and another island may be claimed three days on. */
export const ABANDON_REFUND = 0.5;
export const ABANDON_COOLDOWN_H = 72;

// ------------------------------------------------------------------------------------------------ raids

/** The island is "fat" (worth a raid) when its yard and store are worth more than this at its level. */
export function fatMark(level: number): number {
  return 4000 + 2000 * Math.max(1, level);
}

/** The raiders' strength by the waters and the island's level (0: none come). */
export function raidStrength(waters: Waters, level: number): number {
  return Math.round(WATERS[waters].raidMul * (6 + 2 * Math.max(1, level)) * 10) / 10;
}

/** What the island puts up against them without its owner: each battery and fort by its level and condition, each of
 *  her own ships lying at the island by her level and hull. */
export const DEF_BATTERY = 3;
export const DEF_FORT = 8;
export const DEF_SHIP = 2;

export function isleDefence(o: { batteries: { level: number; condition: number }[]; forts: { level: number; condition: number }[]; ships: { level: number; hull: number }[] }): number {
  const b = o.batteries.reduce((a, x) => a + DEF_BATTERY * x.level * x.condition, 0);
  const f = o.forts.reduce((a, x) => a + DEF_FORT * x.level * x.condition, 0);
  const s = o.ships.reduce((a, x) => a + DEF_SHIP * x.level * Math.max(0.25, x.hull), 0);
  return Math.round((b + f + s) * 10) / 10;
}

/** The odds the island holds without its owner (as the caravans' defenceOdds: its own against theirs, with luck):
 *  nothing at all to put up, it cannot. Raiders the owner sank before the time ran out count no more. */
export function raidOdds(defence: number, strength: number, aliveShare = 1): number {
  if (defence <= 0) return 0;
  const them = strength * Math.max(0, Math.min(1, aliveShare));
  if (them <= 0) return 1;
  return Math.max(0.1, Math.min(0.92, defence / (defence + them)));
}

/** Warning before the raid lands (minutes; the signal tower adds five). */
export const ISLE_RAID_MIN = 10;
/** No new raid within this many hours of the last. */
export const RAID_COOLDOWN_H = 8;
/** The owner away this many hours: raids come a quarter as often. */
export const AWAY_H = 12;
export const AWAY_MUL = 0.25;
/** A lost raid takes this share of the yard and the store; no more than LOSS_DAY_CAP of it is lost in a day (raids
 *  and robbers together), and a building weathers by RAID_WEATHER. */
export const RAID_LOSS: [number, number] = [0.2, 0.35];
export const LOSS_DAY_CAP = 0.4;
export const RAID_WEATHER = 0.3;

/** What beating them off pays: silver (to the purse if she fought, else the treasury), the raiders' iron and tar
 *  into the yard, and seasoning for her own ships that stood at the island. */
export function raidPrize(waters: Waters, level: number): { silver: number; iron: number; tar: number; xp: number } {
  const l = Math.max(1, level);
  const m = waters === 'lawless' ? 1.5 : 1;
  return { silver: Math.round((300 + 150 * l) * m), iron: Math.round((6 + 2 * l) * m), tar: Math.round((6 + 2 * l) * m), xp: 20 + 5 * l };
}

/** A robber in lawless water: five minutes ashore takes a quarter of each resource of the yard (as his hold takes);
 *  an island is robbed no oftener than twice a day. */
export const ROB_ISLE_SEC = 300;
export const ROB_ISLE_SHARE = 0.25;
export const ROB_ISLE_COOLDOWN_H = 12;
