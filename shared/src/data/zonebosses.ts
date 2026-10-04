// The zone bosses (owner, 2026-10-04; docs/21): one great warship for each sea, at the sea's own level. Each rises
// every twelve hours by the server's clock — the seas a region's index × 90 minutes apart, so no two rise together —
// sails her sea for an hour and goes back into the fog. Guns only: her decks cannot be taken. Ten captains of her
// level sink her in a quarter of an hour or so, five in the better part of an hour, one never (the squad sim,
// tests/zonebosses.test.ts). What she drops is ship gear (docs/21 §5); a ship taken by boarding gives the captain's.

import { REGION_IDS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import type { ZoneBossClassId } from './ships.ts';
import { levelPower } from './shiplevel.ts';

/** Every sea's boss rises once in this long (ms). */
export const ZB_PERIOD = 12 * 3_600_000;
/** The seas are this far apart in the calendar, by the region's index (ms): 8 × 90 min = the whole 12 hours. */
export const ZB_STAGGER = 90 * 60_000;
/** She sails for an hour (ms), then leaves into the fog. */
export const ZB_LIFE = 60 * 60_000;
/** The world hears of her this long before she rises (ms). */
export const ZB_WARN = 15 * 60_000;
/** A captain's part of her death that earns a share of the spoils. */
export const ZB_MIN_SHARE = 0.02;
/** She wanders within this of where she rose (m). */
export const ZB_ROAM = 9000;
/** Her guns reach this far (m): past every gun and mortar a captain mounts. */
export const ZB_REACH = 950;
/** She answers whoever fired on her within this long (s). */
export const ZB_GRUDGE = 60;

export interface ZoneBossDef {
  region: RegionId;
  classId: ZoneBossClassId;
  /** Her level (⚓): her sea's own. */
  level: number;
  /** Seconds between her rounds of broadsides. */
  every: number;
  /** The hull a round of her broadsides takes off, all told — spread evenly over every ship under her guns that has
   *  fired on her (docs/21 §4: a crowd lives, one alone does not). Before the target's armour. */
  volley: number;
  /** Experience and silver for her whole death, shared out by each captain's part of it. */
  xp: number;
  silver: number;
}

// The squad sim's numbers (tests/zonebosses.test.ts, docs/21 §4): the round of broadsides is a share of the hull of
// an average ship of her level, so five survive her for the forty minutes they need and one alone sinks inside a
// quarter of an hour.
const def = (region: RegionId, level: number, volley: number): ZoneBossDef => ({
  region, classId: `zb_${region}` as ZoneBossClassId, level, every: 8, volley,
  xp: Math.round(9000 * levelPower(level)), silver: Math.round(5000 * levelPower(level)),
});

export const ZONE_BOSSES: Record<RegionId, ZoneBossDef> = {
  black_coast: def('black_coast', 3, 15),
  gravewater: def('gravewater', 5, 30),
  whispering: def('whispering', 5, 30),
  leviathan_reach: def('leviathan_reach', 6, 34),
  ashen_isles: def('ashen_isles', 7, 52),
  dead_mans_expanse: def('dead_mans_expanse', 8, 59),
  drowned_crown: def('drowned_crown', 9, 116),
  the_abyss: def('the_abyss', 10, 132),
};

/** The region's place in the calendar. */
export function zbOffset(region: RegionId): number {
  return REGION_IDS.indexOf(region) * ZB_STAGGER;
}

/** The slot of the calendar the wall clock is in for a region (she rises at its start). */
export function zbSlot(wall: number, region: RegionId): number {
  return Math.floor((wall - zbOffset(region)) / ZB_PERIOD);
}

/** When a slot begins (ms of the wall clock). */
export function zbSlotStart(slot: number, region: RegionId): number {
  return slot * ZB_PERIOD + zbOffset(region);
}

/** When she next rises at or after `wall` (the start of the current slot if she is still up in it). */
export function zbNextRise(wall: number, region: RegionId): number {
  const slot = zbSlot(wall, region);
  const start = zbSlotStart(slot, region);
  return wall < start + ZB_LIFE ? start : zbSlotStart(slot + 1, region);
}
