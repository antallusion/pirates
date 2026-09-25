// Region and key-port definitions. Positions are world meters (96 km square, +y = south).

import type { FactionId } from '../data/factions.ts';
import type { GoodId } from '../data/goods.ts';

export type RegionId =
  | 'black_coast' | 'gravewater' | 'whispering' | 'ashen_isles'
  | 'leviathan_reach' | 'dead_mans_expanse' | 'drowned_crown' | 'the_abyss';

export type Safety = 'safe' | 'contested' | 'lawless';
export type IslandBiome = 'temperate' | 'mossy' | 'volcanic' | 'ice' | 'ruins' | 'bone' | 'barren';

export interface RegionDef {
  id: RegionId;
  name: string;
  safety: Safety;
  center: [number, number];
  strangeness: number; // 0..1, drives the 80/20 mysticism budget
  islandCount: number;
  islandScale: number; // multiplier on island radius
  biome: IslandBiome;
  waterTint: string; // subtle per-region ocean tint
  fogBase: number; // 0..1 base fog density
  stormChance: number; // relative chance of storms
  mood: string;
}

export const REGIONS: Record<RegionId, RegionDef> = {
  black_coast: { id: 'black_coast', name: 'The Black Coast', safety: 'safe', center: [22000, 78000], strangeness: 0.02, islandCount: 70, islandScale: 1.0, biome: 'temperate', waterTint: '#0c141c', fogBase: 0.25, stormChance: 0.4, mood: 'Crown waters. Lighthouses, patrols, fog over the harbours.' },
  gravewater: { id: 'gravewater', name: 'Gravewater Sea', safety: 'contested', center: [56000, 74000], strangeness: 0.06, islandCount: 70, islandScale: 1.0, biome: 'temperate', waterTint: '#0b1319', fogBase: 0.2, stormChance: 0.7, mood: 'The great trade artery. Rich convoys and the wolves that follow them.' },
  whispering: { id: 'whispering', name: 'Whispering Archipelago', safety: 'contested', center: [20000, 46000], strangeness: 0.12, islandCount: 170, islandScale: 0.55, biome: 'mossy', waterTint: '#0b1517', fogBase: 0.65, stormChance: 0.5, mood: 'Hundreds of islets in endless fog. Smugglers\' paradise.' },
  ashen_isles: { id: 'ashen_isles', name: 'The Ashen Isles', safety: 'lawless', center: [84000, 70000], strangeness: 0.1, islandCount: 60, islandScale: 1.1, biome: 'volcanic', waterTint: '#120f10', fogBase: 0.35, stormChance: 0.8, mood: 'Volcanoes, sulphur and powder mills. The Confederacy\'s home.' },
  leviathan_reach: { id: 'leviathan_reach', name: "Leviathan Reach", safety: 'contested', center: [32000, 14000], strangeness: 0.2, islandCount: 70, islandScale: 1.0, biome: 'ice', waterTint: '#0d1720', fogBase: 0.45, stormChance: 1.0, mood: 'Ice, whalers and things larger than whales.' },
  dead_mans_expanse: { id: 'dead_mans_expanse', name: "Dead Man's Expanse", safety: 'lawless', center: [54000, 44000], strangeness: 0.25, islandCount: 45, islandScale: 0.8, biome: 'barren', waterTint: '#0a1116', fogBase: 0.3, stormChance: 0.9, mood: 'Open ocean, strong currents, ship graveyards and dead calms.' },
  drowned_crown: { id: 'drowned_crown', name: 'The Drowned Crown', safety: 'lawless', center: [74000, 28000], strangeness: 0.5, islandCount: 65, islandScale: 0.9, biome: 'ruins', waterTint: '#08141a', fogBase: 0.55, stormChance: 1.1, mood: 'The drowned empire. Spires under the surface, cults above it.' },
  the_abyss: { id: 'the_abyss', name: 'The Abyss', safety: 'lawless', center: [89000, 8000], strangeness: 0.9, islandCount: 25, islandScale: 0.7, biome: 'bone', waterTint: '#040a0d', fogBase: 0.7, stormChance: 1.5, mood: 'Black storms, dead wind, and a light far below.' },
};

export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export interface PortProfile {
  produces: Partial<Record<GoodId, number>>; // units per in-game hour at full capacity
  consumes: Partial<Record<GoodId, number>>;
}

export interface KeyPortDef {
  id: string;
  name: string;
  region: RegionId;
  faction: FactionId;
  pos: [number, number]; // docking anchor (in water)
  coastDir: number; // heading from anchor toward the island's center
  islandRadius: number;
  size: 1 | 2 | 3; // 3 = capital
  shipyardTier: number;
  blackMarket: boolean;
  profile: PortProfile;
  description: string;
}

export const KEY_PORTS: KeyPortDef[] = [
  {
    id: 'gravesend', name: 'Port Gravesend', region: 'black_coast', faction: 'crown', pos: [18000, 78000], coastDir: Math.PI * 1.5, islandRadius: 1500, size: 3, shipyardTier: 4, blackMarket: false,
    profile: { produces: { weapons: 14, gunpowder: 10, cloth: 20, planks: 24, sailcloth: 18, medicine: 6 }, consumes: { sugar: 24, rum: 22, tobacco: 16, timber: 30, iron: 24, spices: 8, provisions: 30, whale_oil: 10 } },
    description: 'Capital of the Crown in the west. Grey stone, black water, a thousand bells.',
  },
  {
    id: 'blackwater', name: 'Porto Blackwater', region: 'black_coast', faction: 'league', pos: [31000, 70000], coastDir: Math.PI * 0.5, islandRadius: 1100, size: 2, shipyardTier: 2, blackMarket: false,
    profile: { produces: { sugar: 30, rum: 26, cloth: 12, provisions: 20 }, consumes: { iron: 12, weapons: 8, spices: 10, medicine: 6, timber: 10, salt: 12 } },
    description: 'League sugar and rum. Distilleries steam in the rain.',
  },
  {
    id: 'saltmarrow', name: 'Saltmarrow', region: 'black_coast', faction: 'crown', pos: [11500, 87000], coastDir: Math.PI, islandRadius: 1000, size: 1, shipyardTier: 1, blackMarket: false,
    profile: { produces: { provisions: 36, salt: 24, timber: 18 }, consumes: { rum: 12, cloth: 10, tobacco: 6, medicine: 4, planks: 6 } },
    description: 'Fishing town at the end of the world where every young captain starts.',
  },
  {
    id: 'hollowmere', name: 'Hollowmere', region: 'gravewater', faction: 'league', pos: [57000, 77500], coastDir: Math.PI * 0.5, islandRadius: 1300, size: 3, shipyardTier: 3, blackMarket: false,
    profile: { produces: { spices: 16, medicine: 12, cloth: 14, tobacco: 14 }, consumes: { sugar: 16, rum: 14, iron: 14, gunpowder: 8, provisions: 24, pearls: 3, timber: 12 } },
    description: 'The League\'s banking house. Brass counting rooms above a flooded market.',
  },
  {
    id: 'tidewrack', name: 'Tidewrack', region: 'gravewater', faction: 'free', pos: [65500, 63000], coastDir: 0, islandRadius: 900, size: 2, shipyardTier: 2, blackMarket: true,
    profile: { produces: { tobacco: 16, timber: 20, provisions: 14 }, consumes: { weapons: 10, gunpowder: 8, rum: 16, cloth: 8, dreamleaf: 3 } },
    description: 'Free port and trophy auction. Everything has a price here, including you.',
  },
  {
    id: 'fogmouth', name: 'Fogmouth', region: 'whispering', faction: 'brokers', pos: [21000, 45000], coastDir: Math.PI * 1.5, islandRadius: 1000, size: 2, shipyardTier: 2, blackMarket: true,
    profile: { produces: { dreamleaf: 8, pearls: 4, provisions: 12 }, consumes: { rum: 18, weapons: 10, medicine: 8, cloth: 10, tobacco: 10, sugar: 8 } },
    description: 'Stilt-town of the Fog Brokers. Lanterns off, voices low.',
  },
  {
    id: 'cinderhold', name: 'Cinderhold', region: 'ashen_isles', faction: 'confederacy', pos: [82500, 71000], coastDir: Math.PI * 0.5, islandRadius: 1500, size: 3, shipyardTier: 3, blackMarket: true,
    profile: { produces: { gunpowder: 22, iron: 26, coal: 24, weapons: 10 }, consumes: { provisions: 36, rum: 30, timber: 22, sugar: 10, medicine: 8, cloth: 10, sailcloth: 8 } },
    description: 'Pirate capital in a volcanic caldera. The Code is law, the law is the Code.',
  },
  {
    id: 'harpoon_rest', name: "Harpoon's Rest", region: 'leviathan_reach', faction: 'harpoon', pos: [30500, 13500], coastDir: Math.PI, islandRadius: 1100, size: 2, shipyardTier: 2, blackMarket: false,
    profile: { produces: { whale_oil: 26, provisions: 10, timber: 12 }, consumes: { salt: 20, rum: 16, weapons: 10, gunpowder: 10, medicine: 6, iron: 8 } },
    description: 'Whalers and monster hunters. Bone arches over the harbour mouth.',
  },
  {
    id: 'wrecktide', name: 'Wrecktide', region: 'dead_mans_expanse', faction: 'free', pos: [53500, 42500], coastDir: Math.PI * 0.5, islandRadius: 800, size: 1, shipyardTier: 1, blackMarket: true,
    profile: { produces: { planks: 14, sailcloth: 10, iron: 8 }, consumes: { provisions: 24, rum: 16, medicine: 6, gunpowder: 6 } },
    description: 'A town built from wrecks on the edge of a ship graveyard.',
  },
  {
    id: 'saint_maw', name: 'Saint Maw', region: 'drowned_crown', faction: 'choir', pos: [73500, 27000], coastDir: 0, islandRadius: 1000, size: 2, shipyardTier: 2, blackMarket: true,
    profile: { produces: { cursed_relics: 5, abyssal_ore: 5, pearls: 4 }, consumes: { provisions: 26, medicine: 10, cloth: 8, whale_oil: 10, rum: 10 } },
    description: 'City of the Choir. The bells ring underwater.',
  },
];

export const WORLD_EDGE_MARGIN = 2500; // the Maelstrom Wall: impassable storm band at the map edge
