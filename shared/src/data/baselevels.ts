// The base's single-level buildings rise to five levels too (owner, 2026-10-15: «все здания в 5 вариациях, так как у нас
// есть улучшения»; docs/29 §2). Every one of the 24 buildings of holdings.ts that is not of the tree (the warehouse, the
// shipyard and the guns have their own levels) works harder a level at a time, by one measure for each kind of work —
// level 1 is exactly what the building did before, so an old island loses and gains nothing until it is raised:
//
//  - what it makes, turns, earns or holds (the farm, the village, the mine, the plantation, the mills, the smokehouse,
//    the try-works, the tavern's purse and cheer, the barracks' garrison, the pier's mending, the chapel's calm, the
//    lighthouse's sight and tolls) by LEVEL_MUL: ×1.6 at level 5;
//  - a count or a share of its own (the signal tower's minutes and the caravans' losses, the caravan office's caravans,
//    the residents' house's rooms, the dry dock's repairs, the chart house's copies, the forge's reach, the trophy hall's
//    cap, the workshop's yield, the smugglers' room, the hidden cove's cover) by its function below.
//
// A level L asks the town hall at L (and at the building's own opening, BASE_UNLOCK); it costs the founding's silver and
// goods by SINGLE_SILVER, never more silver nor longer than the hall's own level L (treeCost), and its time by the tree's
// TREE_TIME. The steps are optional — the hall never asks them — so the tree's pace (tests/balance/isletree.ts) stands.

import { BASE_UNLOCK, TREE_TIME, treeCost } from './isletree.ts';
import { TROPHY_MAX } from './estate.ts';
import type { BuildingId } from './holdings.ts';

export const SINGLE_MAX = 5;
/** The working buildings' strength by level. */
export const LEVEL_MUL = [0, 1, 1.15, 1.3, 1.45, 1.6];
/** Each level's silver and goods against the founding's. */
export const SINGLE_SILVER = [0, 1, 1.6, 2.5, 3.6, 5];

const lv = (level: number | undefined): number => Math.max(1, Math.min(SINGLE_MAX, Math.round(level ?? 1)));

/** A building's strength at a level (level 1: ×1). */
export const levelMul = (level: number | undefined): number => LEVEL_MUL[lv(level)];

/** The signal tower: minutes more to answer a raid (5 at level 1). */
export const signalMins = (level: number | undefined): number => Math.round(5 * levelMul(level));
/** The signal tower: the share of a caravan's risk left in its sea (0.67 at level 1). */
export const signalRisk = (level: number | undefined): number => Math.round((1 - 0.33 * levelMul(level)) * 1000) / 1000;
/** The caravan office: caravans more at sea (1, two from level 4). */
export const caravanExtra = (level: number | undefined): number => (lv(level) >= 4 ? 2 : 1);
/** The residents' house: rooms (4 at level 1, two more a level). */
export const residentRooms = (level: number | undefined): number => 4 + 2 * (lv(level) - 1);
/** The dry dock: the share off a repair (a quarter at level 1). */
export const dockDiscount = (level: number | undefined): number => Math.round((0.25 + 0.03 * (lv(level) - 1)) * 100) / 100;
/** The chart house: a copy's silver (500 at level 1). */
export const chartCopy = (level: number | undefined): number => 500 - 75 * (lv(level) - 1);
/** The forge: how far off the island it serves (400 at level 1). */
export const forgeReach = (level: number | undefined): number => 400 + 150 * (lv(level) - 1);
/** The trophy hall: its greatest share of a trade (a tenth at level 1). */
export const trophyCap = (level: number | undefined): number => Math.round(TROPHY_MAX * levelMul(level) * 1000) / 1000;
/** The workshop: what a pair of stuff makes (3 at level 1). */
export const workshopYield = (level: number | undefined): number => Math.round(3 * levelMul(level) * 10) / 10;
/** The smugglers' store: room more in the island's store, m³ (none at level 1). */
export const smugglerRoom = (level: number | undefined): number => 15 * (lv(level) - 1);
/** The hidden cove: the share off the raiders' notice (none at level 1). */
export const coveHide = (level: number | undefined): number => Math.round(0.08 * (lv(level) - 1) * 100) / 100;

/** The town hall a level asks. */
export function singleHall(id: BuildingId, level: number): number {
  return Math.max(BASE_UNLOCK[id] ?? 1, lv(level));
}

/** What raising a single-level building to level L ≥ 2 costs, from its founding's cost. */
export function singleCost(found: { silver: number; goods: Partial<Record<string, number>>; secs: number }, level: number, brought: readonly string[] = []): { silver: number; goods: Partial<Record<string, number>>; secs: number } {
  const L = lv(level);
  const hall = treeCost('hall', L);
  const k = SINGLE_SILVER[L];
  const goods: Partial<Record<string, number>> = {};
  for (const [g, n] of Object.entries(found.goods)) if (!brought.includes(g)) goods[g] = Math.ceil((n ?? 0) * k);
  const silver = Math.max(50, Math.round(Math.min(found.silver * k, Math.max(found.silver, hall.silver)) / 50) * 50);
  const secs = Math.round(Math.min(found.secs * TREE_TIME[L], Math.max(found.secs, hall.secs)));
  return { silver, goods, secs };
}
