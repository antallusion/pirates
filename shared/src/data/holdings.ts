// Islands for rent and what can be built on them (docs/01 §9). Prices in silver; upkeep per real day, paid
// from the island's treasury, plus physical materials someone has to bring (powder, oil, provisions).

import type { GoodId } from './goods.ts';
import type { IslandBiome, RegionId } from '../world/regions.ts';

export type IslandSize = 'small' | 'medium' | 'large';
export const RENT_DAYS = [7, 14, 30] as const;
export type RentDays = (typeof RENT_DAYS)[number];

export const RENT: Record<IslandSize, Record<RentDays, number>> = {
  small: { 7: 12_000, 14: 21_000, 30: 40_000 },
  medium: { 7: 36_000, 14: 63_000, 30: 120_000 },
  large: { 7: 90_000, 14: 160_000, 30: 300_000 },
};

/** The region's price: dearer on the Crown's safe coast, cheap where nobody keeps the law. */
export function rentZoneMul(region: RegionId): number | null {
  switch (region) {
    case 'black_coast':
      return 1.4;
    case 'ashen_isles':
      return 0.6;
    case 'dead_mans_expanse':
    case 'drowned_crown':
      return 0.5;
    case 'the_abyss':
      return null; // not for rent
    default:
      return 1;
  }
}

/** Island size from its radius (the world is drawn at a compressed scale). */
export function islandSize(radius: number): IslandSize {
  return radius < 300 ? 'small' : radius < 700 ? 'medium' : 'large';
}

/** Building slots: small 1–3, medium 4–7, large 8–12 by radius; the safe coast allows at most 3. */
export function islandSlots(radius: number, region: RegionId): number {
  const size = islandSize(radius);
  let n = size === 'small' ? 1 + Math.min(2, Math.floor(radius / 100)) : size === 'medium' ? 4 + Math.min(3, Math.floor((radius - 300) / 100)) : 8 + Math.min(4, Math.floor((radius - 700) / 150));
  if (region === 'black_coast') n = Math.min(3, n);
  return n;
}

export type BuildingId =
  | 'warehouse' | 'pier' | 'shipyard' | 'dry_dock' | 'tavern' | 'workshop' | 'hidden_cove' | 'smuggler_store' | 'battery' | 'fort'
  | 'lighthouse' | 'farm' | 'sawmill' | 'mine' | 'fishing_village' | 'plantation' | 'distillery' | 'powder_mill' | 'chapel'
  | 'chart_house' | 'barracks';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  slots: number;
  cost: number;
  materials: Partial<Record<GoodId, number>>;
  upkeep: number; // silver a day
  upkeepGoods: Partial<Record<GoodId, number>>; // a day, from the island's store
  description: string;
  needs?: BuildingId;
  notSafe?: boolean; // not on the Crown's coast
  feature?: 'mine';
  biomes?: IslandBiome[];
  once?: boolean; // one per island (all are, except batteries)
}

const b = (d: BuildingDef): BuildingDef => d;

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  warehouse: b({ id: 'warehouse', name: 'Warehouse', slots: 1, cost: 8_000, materials: { planks: 40 }, upkeep: 300, upkeepGoods: {}, description: 'Stores 150 t on the island (the bare island keeps a small cache).' }),
  pier: b({ id: 'pier', name: 'Pier', slots: 1, cost: 5_000, materials: { planks: 30 }, upkeep: 150, upkeepGoods: {}, description: 'Moorings for four: ships lying here mend 5% of their hull every ten minutes.' }),
  shipyard: b({ id: 'shipyard', name: 'Shipyard', slots: 3, cost: 60_000, materials: { planks: 80, iron: 20 }, upkeep: 1_500, upkeepGoods: { planks: 10 }, description: 'Builds hulls up to tier III (common timber) and repairs them fully.' }),
  dry_dock: b({ id: 'dry_dock', name: 'Dry Dock', slots: 2, cost: 80_000, materials: { planks: 60, iron: 30 }, upkeep: 2_000, upkeepGoods: {}, needs: 'shipyard', description: 'Tier IV hulls, and repairs a quarter cheaper.' }),
  tavern: b({ id: 'tavern', name: 'Tavern', slots: 1, cost: 12_000, materials: { planks: 20, rum: 10 }, upkeep: 400, upkeepGoods: {}, description: 'Hire hands here; the crew’s spirits rise while moored (+10 morale); 200–600 silver a day to the treasury.' }),
  workshop: b({ id: 'workshop', name: 'Workshop', slots: 1, cost: 15_000, materials: { planks: 20, iron: 10 }, upkeep: 500, upkeepGoods: {}, description: 'Turns timber into planks and cloth into sailcloth (3 for 2).' }),
  hidden_cove: b({ id: 'hidden_cove', name: 'Hidden Cove', slots: 1, cost: 20_000, materials: { planks: 10 }, upkeep: 600, upkeepGoods: {}, description: 'Your ships moored here cannot be seen by others, and the island never appears on charts sold in ports.' }),
  smuggler_store: b({ id: 'smuggler_store', name: 'Smugglers’ Store', slots: 1, cost: 25_000, materials: { planks: 20 }, upkeep: 800, upkeepGoods: {}, notSafe: true, description: 'The store takes contraband too.' }),
  battery: b({ id: 'battery', name: 'Shore Battery', slots: 1, cost: 18_000, materials: { weapons: 8, planks: 10 }, upkeep: 700, upkeepGoods: { gunpowder: 2 }, notSafe: true, description: 'Eight guns: they fire on pirates and on anyone who fires on you within 1.2 km.' }),
  fort: b({ id: 'fort', name: 'Fort', slots: 3, cost: 90_000, materials: { planks: 60, iron: 40, weapons: 24 }, upkeep: 2_500, upkeepGoods: { gunpowder: 5 }, notSafe: true, description: 'Twenty-four guns and the heart of any defence in a siege.' }),
  lighthouse: b({ id: 'lighthouse', name: 'Lighthouse', slots: 1, cost: 10_000, materials: { planks: 10 }, upkeep: 300, upkeepGoods: { whale_oil: 2 }, description: 'Your ships see 50% farther within 6 km; a witness to crimes; merchants passing within 3 km pay 2% toll (to 3,000 a day).' }),
  farm: b({ id: 'farm', name: 'Farm', slots: 1, cost: 6_000, materials: { planks: 10 }, upkeep: 150, upkeepGoods: {}, biomes: ['temperate', 'mossy', 'volcanic', 'ruins', 'jungle', 'mangrove', 'blacksand'], description: '20 provisions a day into the store.' }),
  sawmill: b({ id: 'sawmill', name: 'Sawmill', slots: 1, cost: 9_000, materials: { iron: 10 }, upkeep: 250, upkeepGoods: {}, description: 'Saws the store’s timber into planks, 13 for every 10.' }),
  mine: b({ id: 'mine', name: 'Mine', slots: 2, cost: 30_000, materials: { planks: 30, iron: 10 }, upkeep: 900, upkeepGoods: {}, feature: 'mine', description: 'Six tons of ore an hour into the store (coal or iron, as the rock gives).' }),
  fishing_village: b({ id: 'fishing_village', name: 'Fishing Village', slots: 1, cost: 7_000, materials: { planks: 15 }, upkeep: 100, upkeepGoods: {}, description: '10 provisions a day, and 300 silver of taxes; the villagers see everything.' }),
  plantation: b({ id: 'plantation', name: 'Plantation', slots: 2, cost: 22_000, materials: { planks: 20 }, upkeep: 500, upkeepGoods: {}, biomes: ['temperate', 'mossy', 'jungle'], description: 'A ton and a half of sugar or tobacco an hour.' }),
  distillery: b({ id: 'distillery', name: 'Distillery', slots: 1, cost: 18_000, materials: { iron: 10, planks: 10 }, upkeep: 400, upkeepGoods: {}, description: 'Two sacks of sugar in the store make a cask of rum.' }),
  powder_mill: b({ id: 'powder_mill', name: 'Powder Mill', slots: 2, cost: 40_000, materials: { iron: 20, planks: 20 }, upkeep: 1_000, upkeepGoods: {}, notSafe: true, description: 'Saltpetre boiled from salt, charcoal from coal: 2 salt and 1 coal make 2 barrels of powder.' }),
  chapel: b({ id: 'chapel', name: 'Chapel', slots: 1, cost: 14_000, materials: { planks: 15 }, upkeep: 300, upkeepGoods: {}, description: 'Crews lying here recover 30 sanity every ten minutes, and the curse loosens.' }),
  chart_house: b({ id: 'chart_house', name: 'Chart House', slots: 1, cost: 12_000, materials: { planks: 10, cloth: 5 }, upkeep: 300, upkeepGoods: {}, description: 'Copies treasure maps without losing a line (500 silver a copy).' }),
  barracks: b({ id: 'barracks', name: 'Barracks', slots: 2, cost: 25_000, materials: { planks: 30, weapons: 10 }, upkeep: 800, upkeepGoods: { provisions: 5 }, description: 'A garrison of 60 against landing parties.' }),
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Store capacity (m³): a small cache on any island, the warehouse's 150 t on top. */
export const ISLAND_CACHE_VOLUME = 30;
export const WAREHOUSE_ISLAND_VOLUME = 300;
export const LIMIT_PERSONAL = 1;
export const LIMIT_GUILD = 6;
