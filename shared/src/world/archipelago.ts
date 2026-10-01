// The islands by their levels and kinds (docs/18 III, items 26–32): every island's level ⚓1–10 is the level of the
// square of the sea she stands in (sectors.ts), her kind — tropical, rocky, volcanic, swamp, a ship graveyard, dead
// (the Choir's) — comes from her sea and her biome; the archipelagos of one level are "zones" a captain comes back to;
// the danger of landing on an island above one's level follows the ladder of levels (D12); a hidden island holds the
// better finds; a claimed lair island sends its resource to the captain's own island once a week. Pure functions of the
// world, the same for the server and every test. Section II of docs/18 hangs the land's creatures and resources on the
// kind and the level (ISLE_TYPES[t].bestiary, isleLoot), and its lairs claim an island through `claimLair` (server).

import { MINE_WATERS, type Res7 } from '../data/mines.ts';
import type { Tr } from '../data/estate.ts';
import { threatOf, type Threat } from '../data/shiplevel.ts';
import { hashString } from '../rng.ts';
import { REGIONS } from './regions.ts';
import type { IslandBiome, RegionId } from './regions.ts';
import { sectorAt } from './sectors.ts';
import type { SectorSource } from './sectors.ts';

export type IsleType = 'tropical' | 'rocky' | 'volcanic' | 'swamp' | 'graveyard' | 'dead';
export const ISLE_TYPES: IsleType[] = ['tropical', 'rocky', 'volcanic', 'swamp', 'graveyard', 'dead'];

export interface IsleTypeDef {
  name: Tr;
  /** The land's own word for the label and the tooltip. */
  adj: Tr;
  /** The resource the island's people (or what lives there) send down a supply route (docs/18 #32). */
  supply: Exclude<Res7, 'silver'>;
  /** What the land's creatures will be (docs/18 II #14 hangs its bestiary here): the ids of `creatures/*` and
   *  `monsters/*` art the kind's lairs draw from. */
  bestiary: string[];
  /** Its colour on the charts (the minimap, the world map). */
  chart: string;
}

export const ISLE_TYPE_DEFS: Record<IsleType, IsleTypeDef> = {
  tropical: { name: ['Tropical island', 'Тропический остров'], adj: ['tropical', 'тропический'], supply: 'rum', bestiary: ['creature.crab', 'creature.turtle', 'creature.gull'], chart: '#4f7a4a' },
  rocky: { name: ['Rocky island', 'Скалистый остров'], adj: ['rocky', 'скалистый'], supply: 'iron', bestiary: ['creature.seal', 'creature.gull', 'creature.crab'], chart: '#5d5a52' },
  volcanic: { name: ['Volcanic island', 'Вулканический остров'], adj: ['volcanic', 'вулканический'], supply: 'gunpowder', bestiary: ['creature.crab', 'monster.young_serpent'], chart: '#5a3a30' },
  swamp: { name: ['Swamp island', 'Болотный остров'], adj: ['swampy', 'болотный'], supply: 'tar', bestiary: ['monster.young_serpent', 'creature.crab', 'creature.turtle'], chart: '#3e4a33' },
  graveyard: { name: ['Ship graveyard', 'Кладбище кораблей'], adj: ['a ship graveyard', 'кладбище кораблей'], supply: 'timber', bestiary: ['monster.hulk', 'monster.wreck_core', 'creature.crab'], chart: '#5a4c3a' },
  dead: { name: ['Dead island of the Choir', 'Мёртвый остров Хора'], adj: ['dead (the Choir’s)', 'мёртвый (Хор)'], supply: 'pearls', bestiary: ['monster.lantern_maw', 'monster.drowned_whale', 'monster.abyss_eye'], chart: '#3a4450' },
};

/** What isleType reads of an island (the server's Island and the client's IslandData both fit). */
export interface IsleLike {
  id: number;
  region: RegionId;
  biome: IslandBiome;
  features: readonly string[];
  x: number;
  y: number;
  isle?: string;
}

/** An island's kind, by her sea and her biome. */
export function isleType(is: IsleLike): IsleType {
  const b = is.biome;
  if (b === 'volcanic' || b === 'blacksand') return 'volcanic';
  // The Drowned Crown and the Abyss are the Choir's: every island there is dead (but a fire mountain).
  if (is.region === 'drowned_crown' || is.region === 'the_abyss' || b === 'ruins' || b === 'bone') return 'dead';
  if (is.region === 'dead_mans_expanse' && (b === 'barren' || b === 'saltflat')) return 'graveyard';
  // A beached wreck makes a graveyard of one island in three anywhere else.
  if (is.features.includes('wreck') && hashString(`grave:${is.id}`) % 3 === 0) return 'graveyard';
  if (b === 'mossy' || b === 'mangrove' || b === 'fungal') return 'swamp';
  if (b === 'jungle' || b === 'atoll') return 'tropical';
  if (b === 'temperate') return is.region === 'gravewater' ? 'tropical' : 'rocky';
  return 'rocky';
}

/** An island's level: her square's. */
export function isleLevel(src: SectorSource, is: { x: number; y: number }): number {
  return sectorAt(src, is.x, is.y).level;
}

// ------------------------------------------------------------------------------------------------ 28. the danger

/** The ladder (D12) at a landing: two levels over hers a warning, three or more no chance at all ("Тьма"). */
export type IsleDanger = 'warn' | 'deadly' | null;

export function isleDanger(mine: number, isle: number): IsleDanger {
  const d = isle - mine;
  return d >= 3 ? 'deadly' : d >= 2 ? 'warn' : null;
}

/** The ladder's colour and word for an island's level against hers (the same as a ship's). */
export function isleThreat(mine: number, isle: number): Threat {
  return threatOf(mine, isle);
}

// ------------------------------------------------------------------------------------------------ 29. the zones

export interface IsleZone {
  id: number;
  level: number;
  x: number;
  y: number;
  /** Its reach about the middle (metres). */
  r: number;
  /** Its islands. */
  n: number;
  /** Named for its largest island (its id and her name). */
  island: number;
  name: string;
  region: RegionId;
}

/** The fewest islands an archipelago of one level needs to be a zone, and how close they lie. */
export const ZONE_MIN = 6;
const ZONE_LINK = 2600;

interface ZoneWorld extends SectorSource {
  islands: { id: number; x: number; y: number; radius: number; name: string; region: RegionId; portId?: string; minor?: boolean; raft?: boolean; hidden?: boolean }[];
}

const zoneCache = new WeakMap<object, IsleZone[]>();

/** The world's zones: islands of one level near one another (an island in reach of another of her level by a short
 *  sail), six or more together. Hidden islands, ports, rafts and the sea's stacks are no part of any. */
export function isleZones(world: ZoneWorld): IsleZone[] {
  const hit = zoneCache.get(world.islands);
  if (hit) return hit;
  const list = world.islands.filter((is) => !is.portId && !is.minor && !is.raft && !is.hidden);
  const lv = list.map((is) => isleLevel(world, is));
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const G = 4000, cells = new Map<number, number[]>();
  list.forEach((is, i) => {
    const k = Math.floor(is.y / G) * 1000 + Math.floor(is.x / G);
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(i);
  });
  list.forEach((a, i) => {
    const cx = Math.floor(a.x / G), cy = Math.floor(a.y / G);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const j of cells.get((cy + dy) * 1000 + cx + dx) ?? []) {
        if (j <= i || lv[j] !== lv[i]) continue;
        const b = list[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius > ZONE_LINK) continue;
        parent[find(i)] = find(j);
      }
    }
  });
  const groups = new Map<number, number[]>();
  list.forEach((_, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(i);
  });
  const out: IsleZone[] = [];
  for (const g of groups.values()) {
    if (g.length < ZONE_MIN) continue;
    const isl = g.map((i) => list[i]);
    const x = isl.reduce((a, is) => a + is.x, 0) / isl.length, y = isl.reduce((a, is) => a + is.y, 0) / isl.length;
    const big = isl.reduce((a, b) => (b.radius > a.radius || (b.radius === a.radius && b.id < a.id) ? b : a));
    const r = Math.max(...isl.map((is) => Math.hypot(is.x - x, is.y - y) + is.radius)) + 300;
    out.push({ id: 0, level: lv[g[0]], x: Math.round(x), y: Math.round(y), r: Math.round(r), n: isl.length, island: big.id, name: big.name, region: big.region });
  }
  out.sort((a, b) => a.level - b.level || a.x - b.x || a.y - b.y);
  out.forEach((z, i) => (z.id = i));
  zoneCache.set(world.islands, out);
  return out;
}

/** "Where is my level": the nearest zone of her level (else the nearest a level either side). */
export function nearestZone(zones: IsleZone[], level: number, x: number, y: number): IsleZone | null {
  for (const d of [0, 1, -1, 2, -2]) {
    let best: IsleZone | null = null, bd = Infinity;
    for (const z of zones) {
      if (z.level !== level + d) continue;
      const k = Math.hypot(z.x - x, z.y - y);
      if (k < bd) {
        bd = k;
        best = z;
      }
    }
    if (best) return best;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ 30. the finds

export interface IsleLoot {
  /** How many things a landing party may find ashore (section II fills them with the land's creatures' loot). */
  slots: number;
  /** Their tier over the island's level (a hidden island's are a tier better). */
  tier: number;
  /** The multiplier on what a cache ashore pays. */
  mul: number;
}

/** A hidden island's finds: more of them, a tier better, the cache half as rich again. */
export const HIDDEN_LOOT = { slots: 2, tier: 1, mul: 1.6 };

/** What an island holds for a landing party (the hook section II fills; the caches pay by `mul` now). */
export function isleLoot(is: { radius: number; hidden?: boolean; isle?: string }): IsleLoot {
  const base = is.radius > 600 ? 3 : is.radius > 250 ? 2 : 1;
  return is.hidden ? { slots: base + HIDDEN_LOOT.slots, tier: HIDDEN_LOOT.tier, mul: HIDDEN_LOOT.mul } : { slots: base, tier: 0, mul: 1 };
}

// ------------------------------------------------------------------------------------------------ 32. supply routes

/** Supply routes a captain may keep at once, and how far a lair island may lie from her own island. */
export const SUPPLY_MAX = 3;
export const SUPPLY_RANGE = 40000;
/** A week's delivery: so many days of a mine of the same resource (a route is the lesser of the two). */
export const SUPPLY_DAYS = 3;
const MINE_DAY: Record<Exclude<Res7, 'silver'>, number> = { timber: 14, iron: 7, tar: 10, gunpowder: 5, pearls: 1, rum: 8 };

/** What a lair island's route brings in a week: its kind's resource, by its waters and its level. */
export function supplyWeek(type: IsleType, region: RegionId, level: number): { good: Exclude<Res7, 'silver'>; n: number } {
  const good = ISLE_TYPE_DEFS[type].supply;
  const n = Math.max(1, Math.round(MINE_DAY[good] * SUPPLY_DAYS * MINE_WATERS[REGIONS[region].safety] * (0.8 + 0.06 * level)));
  return { good, n };
}
