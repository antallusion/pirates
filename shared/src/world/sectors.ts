// Level sectors (owner, 2026-09-30, docs/16 P2): the whole sea is cut into squares of eight kilometres, and each has
// the ship level ⚓1–⚓10 of the ships that sail it. The level rises with the danger and strangeness of the waters and
// with the distance from the Black Coast, where every captain starts; now and then a square breaks the rule — a
// quiet pocket under a friendly port in the wild waters, a dangerous one in the calm. The sea's own ships (traffic,
// merchants, pirates, patrols, beasts) take their levels from the square they put out in.
//
// Every captain can sail every square. The ports, their goods and jobs, the home islands and guilds, the rare fish
// and resources of each region, the day's orders and world events are everywhere, whatever the square's level.

import { WORLD_SIZE } from '../constants.ts';
import { hash2 } from '../rng.ts';
import { CAPTAIN_LEVEL_FOR_SHIP, SHIP_LEVEL_MAX } from '../data/shiplevel.ts';
import { REGIONS, REGION_IDS } from './regions.ts';
import type { RegionId } from './regions.ts';

export const SECTOR_SIZE = 8000;
export const SECTORS_PER_SIDE = WORLD_SIZE / SECTOR_SIZE;

/** Where every captain starts: the Black Coast between Saltmarrow and Gravesend. */
export const HOME_WATERS: [number, number] = [15000, 82000];

export type SectorPocket = 'calm' | 'wild' | null;

export interface Sector {
  sx: number;
  sy: number;
  /** The ship level of the square. */
  level: number;
  /** The levels the sea's ships of the square sail at. */
  band: [number, number];
  /** The square's own waters (the region most of it lies in). */
  region: RegionId;
  /** A quiet pocket in the wild or a dangerous one in the calm. */
  pocket: SectorPocket;
}

/** What the sectors are made from: the region grid (1 km cells) and the ports. */
export interface SectorSource {
  seed: number;
  regionGrid: Uint8Array;
  ports: { x: number; y: number; faction: string; key: boolean; raft?: boolean }[];
}

/** How dangerous a region's waters are, 1 (the Crown's own) to about 10 (the Abyss). */
export function regionDanger(region: RegionId): number {
  const r = REGIONS[region];
  const base = r.safety === 'safe' ? 1 : r.safety === 'contested' ? 4 : 6.5;
  return base + r.strangeness * 4;
}

/** A friendly harbour keeps the water about her quiet: not a pirates' den, not the Choir's. */
function friendly(faction: string): boolean {
  return faction !== 'confederacy' && faction !== 'choir';
}

const cache = new WeakMap<Uint8Array, Sector[]>();

/** The ship level band of a square of level `level`. */
export function bandOf(level: number): [number, number] {
  return [Math.max(1, level - 1), Math.min(SHIP_LEVEL_MAX, level + 1)];
}

/** Every square of the sea, row by row (index = sy * SECTORS_PER_SIDE + sx). */
export function sectorGrid(src: SectorSource): Sector[] {
  const hit = cache.get(src.regionGrid);
  if (hit) return hit;
  const cells = WORLD_SIZE / 1000;
  const out: Sector[] = [];
  const maxD = Math.hypot(WORLD_SIZE - HOME_WATERS[0], HOME_WATERS[1]);
  for (let sy = 0; sy < SECTORS_PER_SIDE; sy++) {
    for (let sx = 0; sx < SECTORS_PER_SIDE; sx++) {
      // The square's waters: the average danger of its 64 cells, and the region most of them are.
      const count = new Map<RegionId, number>();
      let danger = 0, n = 0;
      const per = SECTOR_SIZE / 1000;
      for (let gy = sy * per; gy < (sy + 1) * per; gy++) {
        for (let gx = sx * per; gx < (sx + 1) * per; gx++) {
          const id = REGION_IDS[src.regionGrid[gy * cells + gx]];
          count.set(id, (count.get(id) ?? 0) + 1);
          danger += regionDanger(id);
          n++;
        }
      }
      danger /= n;
      let region: RegionId = 'black_coast', most = -1;
      for (const [id, c] of count) if (c > most) {
        most = c;
        region = id;
      }
      const cx = (sx + 0.5) * SECTOR_SIZE, cy = (sy + 0.5) * SECTOR_SIZE;
      const far = 1 + 9 * Math.min(1, Math.hypot(cx - HOME_WATERS[0], cy - HOME_WATERS[1]) / maxD);
      let raw = 0.6 * danger + 0.4 * far;
      // A little variety: one square in seven a level lower, one in seven a level higher.
      const u = hash2(sx, sy, src.seed ^ 0x5ec7) / 4294967296;
      if (u < 0.14) raw -= 1;
      else if (u > 0.86) raw += 1;
      let level = Math.max(1, Math.min(SHIP_LEVEL_MAX, Math.round(raw)));
      let pocket: SectorPocket = null;
      const x0 = sx * SECTOR_SIZE, y0 = sy * SECTOR_SIZE;
      const ports = src.ports.filter((p) => !p.raft && p.x >= x0 && p.x < x0 + SECTOR_SIZE && p.y >= y0 && p.y < y0 + SECTOR_SIZE);
      const home = Math.hypot(cx - HOME_WATERS[0], cy - HOME_WATERS[1]) < 22000;
      if (level >= 6 && ports.some((p) => friendly(p.faction))) {
        // A friendly harbour in wild waters: the water under her guns is quiet.
        level = Math.max(3, level - 3);
        pocket = 'calm';
      } else if (level <= 4 && !ports.length && !home && hash2(sx, sy, src.seed ^ 0xd4) / 4294967296 < 0.12) {
        // Something lives here that the calm around it does not know.
        level = Math.min(SHIP_LEVEL_MAX, level + 3);
        pocket = 'wild';
      }
      if (home) level = Math.min(level, 2);
      out.push({ sx, sy, level, band: bandOf(level), region, pocket });
    }
  }
  cache.set(src.regionGrid, out);
  return out;
}

export function sectorIndex(x: number, y: number): number {
  const sx = Math.max(0, Math.min(SECTORS_PER_SIDE - 1, Math.floor(x / SECTOR_SIZE)));
  const sy = Math.max(0, Math.min(SECTORS_PER_SIDE - 1, Math.floor(y / SECTOR_SIZE)));
  return sy * SECTORS_PER_SIDE + sx;
}

/** The square a point lies in. */
export function sectorAt(src: SectorSource, x: number, y: number): Sector {
  return sectorGrid(src)[sectorIndex(x, y)];
}

/** The captain levels a square is for: from the level that commands its lowest ships to the one before its highest's
 *  next (a square ⚓3–5 is for captains of about 8 to 32). */
export function captainBand(band: [number, number]): [number, number] {
  const lo = CAPTAIN_LEVEL_FOR_SHIP[band[0]];
  const hi = band[1] >= SHIP_LEVEL_MAX ? 60 : CAPTAIN_LEVEL_FOR_SHIP[band[1] + 1] - 1;
  return [lo, hi];
}
