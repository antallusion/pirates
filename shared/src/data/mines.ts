// The seven resources and the mines of the Heroes (docs/17 H3 item 12). HoMM3's resources are the sea's own goods:
// gold is silver, wood is timber, ore is iron, mercury is tar (pitch), sulphur is gunpowder, crystal and gems are
// pearls, and the seventh is rum (every crew's pay besides its silver). The island's stone (coal) stays what the base
// builds with (docs/15). Mines are sites on wild islands — a silver working in old ruins, a timber stand, an ore pit, a
// tar pit, a sulphur vent, a pearl bed, a cane still — taken by planting one's flag ashore (a short landing); each pays
// every day of the sea's calendar into its holder's island yard and treasury, or piles up at the mine for a captain
// without an island to haul. Other captains plant their own flag over it; the sea's raiders take the unwatched ones.

import type { Tr } from './estate.ts';
import type { GoodId } from './goods.ts';
import { hashString } from '../rng.ts';
import type { Island, World } from '../world/worldgen.ts';
import { legacyIslands } from '../world/worldgen.ts';
import { REGIONS } from '../world/regions.ts';
import type { IslandBiome, RegionId } from '../world/regions.ts';

export type Res7 = 'silver' | 'timber' | 'iron' | 'tar' | 'gunpowder' | 'pearls' | 'rum';
export const RES7: Res7[] = ['silver', 'timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum'];
/** The six resources that are goods (silver is the purse). */
export const RES_GOODS: GoodId[] = ['timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum'];
/** HoMM3's name of each (for the tooltips and the docs). */
export const HOMM_NAME: Record<Res7, string> = { silver: 'gold', timber: 'wood', iron: 'ore', tar: 'mercury', gunpowder: 'sulphur', pearls: 'crystal & gems', rum: 'gems' };

export type MineKind = Res7;

export interface MineDef {
  kind: MineKind;
  name: Tr;
  /** A day's yield on contested waters (silver for the silver mine). */
  daily: number;
  /** Its mark: an outpost picture already in the art. */
  art: string;
}

/** A day's yield is worth ~220–250 silver on contested waters — a producer of the third level's hour on the island
 *  (docs/15: an island producer's hour stays under half an hour at sea), thirty days in a real day. */
export const MINES: Record<MineKind, MineDef> = {
  silver: { kind: 'silver', name: ['silver mine', 'серебряный рудник'], daily: 250, art: 'outpost_deep_shaft' },
  timber: { kind: 'timber', name: ['timber stand', 'лесная делянка'], daily: 14, art: 'outpost_lumber' },
  iron: { kind: 'iron', name: ['ore pit', 'рудная яма'], daily: 7, art: 'outpost_mine' },
  tar: { kind: 'tar', name: ['tar pit', 'смоляная яма'], daily: 10, art: 'outpost_tar' },
  gunpowder: { kind: 'gunpowder', name: ['sulphur vent', 'серный источник'], daily: 5, art: 'outpost_sulfur' },
  pearls: { kind: 'pearls', name: ['pearl bed', 'жемчужная отмель'], daily: 1, art: 'outpost_pearls' },
  rum: { kind: 'rum', name: ['cane still', 'тростниковая винокурня'], daily: 8, art: 'outpost_plantation' },
};

/** Riskier waters pay more: the Crown's coast three quarters, the lawless half as much again. */
export const MINE_WATERS = { safe: 0.75, contested: 1, lawless: 1.5 } as const;

export function mineDaily(kind: MineKind, region: RegionId, weekMul = 1): number {
  return MINES[kind].daily * MINE_WATERS[REGIONS[region].safety] * weekMul;
}

/** Mines a region keeps (the Abyss none): six of docs/17 H3, and six more of docs/19 D4 (twice as many). */
export const MINES_PER_REGION = 12;
/** The first six of a region's mines (where they always stood); the rest are docs/19 D4's. */
export const MINES_LEGACY = 6;
/** A captain holds this many at most. */
export const MINES_MAX = 7;
/** Days of yield that pile up at a mine whose holder has no island. */
export const MINE_STOCK_DAYS = 7;
/** The landing party's time ashore to plant the flag (world seconds). */
export const FLAG_SECS = 20;
/** A flag just planted stands this long before another may be planted over it (world seconds). */
export const FLAG_HOLD_SECS = 600;
/** A day's chance the sea's raiders take a held mine, by its waters (≈ once a real day in lawless waters). */
export const RAID_DAY = { safe: 0.005, contested: 0.015, lawless: 0.033 } as const;
/** The raiders' garrison a landing party must beat: men by the region's danger. */
export function raidersGarrison(region: RegionId): number {
  const s = REGIONS[region].safety;
  return s === 'safe' ? 4 : s === 'contested' ? 8 : 14;
}

/** What an island's mine digs: by what lies ashore first, then by its land. */
export function mineKindOf(is: Pick<Island, 'features' | 'biome'>): MineKind {
  const f = is.features;
  if (f.includes('mine')) return 'iron';
  if (f.includes('volcano')) return 'gunpowder';
  if (f.includes('pearl_bank')) return 'pearls';
  if (f.includes('grove')) return 'timber';
  if (f.includes('cache') || f.includes('ruins')) return 'silver';
  if (f.includes('wreck')) return 'rum';
  const by: Record<IslandBiome, MineKind> = {
    temperate: 'timber', mossy: 'tar', volcanic: 'gunpowder', ice: 'timber', ruins: 'silver', bone: 'pearls', barren: 'iron',
    jungle: 'rum', mangrove: 'tar', atoll: 'rum', saltflat: 'silver', blacksand: 'iron', fungal: 'tar', crystal: 'pearls',
  };
  return by[is.biome] ?? 'timber';
}

export interface MineSite {
  id: string;
  islandId: number;
  kind: MineKind;
  region: RegionId;
  x: number;
  y: number;
  name: string;
  /** docs/19 D4: one of the second six of its region (placed after the first, which stand where they stood). */
  extra?: boolean;
}

/** The world's mines: fixed by the world alone. Each region's wild islands in an order of their own, the kinds not
 *  yet found there first, so a region has a spread of resources. */
export function buildMines(world: World): MineSite[] {
  const out: MineSite[] = [];
  const by = new Map<RegionId, Island[]>();
  for (const is of legacyIslands(world)) { // docs/18 III: the islands before step 6 (the mines stand where they stood)
    if (is.portId || is.minor || is.raft || is.region === 'the_abyss' || is.radius < 140) continue;
    const list = by.get(is.region) ?? [];
    list.push(is);
    by.set(is.region, list);
  }
  for (const [region, list] of by) {
    const order = [...list].sort((a, b) => hashString(`mine:${a.id}`) - hashString(`mine:${b.id}`) || a.id - b.id);
    const taken: Island[] = [];
    // The first six as they always were, then (docs/19 D4) six more the same way from the islands left: the kinds
    // not yet among them first, so the second six are a spread of their own.
    for (const [from, upto] of [[0, MINES_LEGACY], [MINES_LEGACY, MINES_PER_REGION]] as const) {
      const kinds = new Set<MineKind>();
      for (const is of order) {
        if (taken.length >= upto) break;
        if (taken.includes(is) || kinds.has(mineKindOf(is))) continue;
        kinds.add(mineKindOf(is));
        taken.push(is);
      }
      for (const is of order) {
        if (taken.length >= upto) break;
        if (!taken.includes(is)) taken.push(is);
      }
      for (const is of taken.slice(from, upto)) out.push({ id: `m${is.id}`, islandId: is.id, kind: mineKindOf(is), region, x: Math.round(is.x), y: Math.round(is.y), name: is.name, ...(from ? { extra: true } : {}) });
    }
  }
  return out.sort((a, b) => a.islandId - b.islandId);
}
