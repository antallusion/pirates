// Banks the tide raises (docs/16 #25): a few reefs of the dense sea are banks of sand and shell that stand above the
// water at low tide, or through one season of the year, and go under again. Chosen from the world as it is — with
// their own generator, after everything else — so no island, port or reef changes; the reef stays the shoal it was
// when the bank is under. Pure functions of the world and the clock: the server and a test agree on every rise.

import { SEASON_SEC } from './worldgen.ts';
import type { World } from './worldgen.ts';
import type { RegionId } from './regions.ts';
import { Rng } from '../rng.ts';
import { TIDAL_NAMES, TIDE_LOW, TIDE_SEC } from '../data/isles.ts';

export interface TidalIsle {
  id: number;
  /** The reef it stands on (a dense-sea reef, clear of the lanes and harbours). */
  reef: number;
  /** 'tide': bared at every low tide; 'season': stands through one season of the year. */
  kind: 'tide' | 'season';
  /** The season it stands through (0 Thaw, 1 High Tide, 2 Ashfall, 3 Deep Winter). */
  season: number;
  /** Its tide's phase (a share of the tide): the banks of a sea ebb together, a little apart from the next sea's. */
  phase: number;
  name: number;
  region: RegionId;
  x: number;
  y: number;
  r: number;
  /** The bank above water: the reef's outline drawn in toward its middle. */
  poly: number[];
}

/** How many banks, and how far apart at least. */
export const TIDAL_COUNT = 20;
const TIDAL_SPACING = 7000;
/** docs/18 #31: the sandbars of the low tide that follow them. */
export const SANDBAR_COUNT = 12;
const SANDBAR_SPACING = 4500;
/** The season some seas' banks keep (the ice of Leviathan Reach in Deep Winter, the ash banks in Ashfall). */
const SEASON_OF: Partial<Record<RegionId, number>> = { leviathan_reach: 3, ashen_isles: 2, whispering: 1, drowned_crown: 1 };

const cache = new WeakMap<World, TidalIsle[]>();

export function tidalIsles(world: World): TidalIsle[] {
  let list = cache.get(world);
  if (list) return list;
  list = [];
  const rng = new Rng((world.seed * 613 + 90511) >>> 0);
  const pool = world.reefs.filter((rf) => rf.id >= world.reefsFrom && rf.radius >= 85 && rf.region !== 'the_abyss');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.float() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const regionIndex = new Map<RegionId, number>();
  for (const rf of pool) {
    if (list.length >= TIDAL_COUNT) break;
    if (list.some((t) => Math.hypot(t.x - rf.x, t.y - rf.y) < TIDAL_SPACING)) continue;
    const n = list.length;
    const seasonal = n % 3 === 2;
    if (!regionIndex.has(rf.region)) regionIndex.set(rf.region, regionIndex.size);
    const poly: number[] = [];
    for (let k = 0; k < rf.poly.length; k += 2) poly.push(Math.round(rf.x + (rf.poly[k] - rf.x) * 0.72), Math.round(rf.y + (rf.poly[k + 1] - rf.y) * 0.72));
    list.push({
      id: n, reef: rf.id, kind: seasonal ? 'season' : 'tide', season: SEASON_OF[rf.region] ?? rng.int(0, 3), phase: (regionIndex.get(rf.region)! * 0.137) % 1,
      name: n % TIDAL_NAMES.length, region: rf.region, x: Math.round(rf.x), y: Math.round(rf.y), r: Math.round(rf.radius * 0.72), poly,
    });
  }
  // docs/18 #31: a dozen more sandbars bared at every low tide, from their own generator after the banks above (whose
  // ids and places stay as they were), each as far from any bank as the sea allows.
  const rng2 = new Rng((world.seed * 617 + 0x5a4d) >>> 0);
  const rest = pool.filter((rf) => !list.some((t) => t.reef === rf.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng2.float() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const firstCount = list.length;
  for (const rf of rest) {
    if (list.length >= firstCount + SANDBAR_COUNT) break;
    if (list.some((t) => Math.hypot(t.x - rf.x, t.y - rf.y) < SANDBAR_SPACING)) continue;
    if (!regionIndex.has(rf.region)) regionIndex.set(rf.region, regionIndex.size);
    const n = list.length;
    const poly: number[] = [];
    for (let k = 0; k < rf.poly.length; k += 2) poly.push(Math.round(rf.x + (rf.poly[k] - rf.x) * 0.72), Math.round(rf.y + (rf.poly[k + 1] - rf.y) * 0.72));
    list.push({
      id: n, reef: rf.id, kind: 'tide', season: 0, phase: ((regionIndex.get(rf.region)! * 0.137) + 0.5) % 1,
      name: TIDAL_COUNT + ((n - firstCount) % (TIDAL_NAMES.length - TIDAL_COUNT)), region: rf.region, x: Math.round(rf.x), y: Math.round(rf.y), r: Math.round(rf.radius * 0.72), poly,
    });
  }
  cache.set(world, list);
  return list;
}

/** The water's height at a bank: 1 high water, −1 low. */
export function tideLevel(t: number, phase: number): number {
  return Math.cos(2 * Math.PI * (t / TIDE_SEC + phase));
}

/** The year's season at world time t (0 Thaw … 3 Deep Winter), as worldgen.seasonName reads it. */
export function seasonIndex(t: number): number {
  return Math.floor(((t / SEASON_SEC) % 4 + 4) % 4);
}

/** Whether a bank stands above the sea at world time t, and (a forced state for the tester's console aside). */
export function tidalUp(is: TidalIsle, t: number): boolean {
  if (is.kind === 'season') return seasonIndex(t) === is.season;
  return tideLevel(t, is.phase) < TIDE_LOW;
}

/** When it next changes (world seconds), found by stepping the clock (a tide in 20 s steps, a season in 5 min). */
export function tidalTurn(is: TidalIsle, t: number): number {
  const up = tidalUp(is, t);
  const step = is.kind === 'season' ? 300 : 20;
  const limit = is.kind === 'season' ? SEASON_SEC * 4 + step : TIDE_SEC + step;
  for (let d = step; d <= limit; d += step) if (tidalUp(is, t + d) !== up) return t + d;
  return t + limit;
}

/** Which rise of a bank this is (a new one each time it comes up): a landing party finds its loot once a rise. */
export function tidalRise(is: TidalIsle, t: number): number {
  return is.kind === 'season' ? Math.floor(t / (SEASON_SEC * 4)) : Math.floor(t / TIDE_SEC + is.phase);
}
