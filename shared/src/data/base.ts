// A captain's own island as a base (docs/15_PERSONAL_ISLAND.md, items 1–3). The island bought outright (estate.ts)
// is laid out as a grid of plots that grows with its level; every plot takes one building of the island (the
// holdings' BUILDINGS) or one producer that works the land by the island's biome. Building and raising take real
// time by one builders' crew (a second at a set island level); speed-ups are paid in silver, in provisions, or with
// the free tokens of the daily welcome and the daily orders. Producers yield by the hour, also while their owner is
// away, into the island's yard, whose caps grow with the island and its warehouse; the yard pays for the building.
//
// The five resources of the yard are goods of the sea: timber, tar, iron, provisions — and "stone", which is the
// rock of the quarry and sold as coal (there is no stone good, and the quarry's pit gives what the rock holds).

import type { GoodId } from './goods.ts';
import type { IslandBiome } from '../world/regions.ts';
import { BUILDINGS } from './holdings.ts';
import type { BuildingId, IslandSize } from './holdings.ts';
import type { Tr } from './estate.ts';

/** The yard's resources, in the order the window shows them. */
export type BaseRes = 'timber' | 'coal' | 'tar' | 'iron' | 'provisions';
export const BASE_RES: BaseRes[] = ['timber', 'coal', 'tar', 'iron', 'provisions'];
/** The quarry's stone is the good coal (docs/15 item 3: no new good without its art). */
export const STONE: GoodId = 'coal';

/** How rich each biome is in each resource (0: not to be had there; 1: the ordinary yield). */
export const BIOME_YIELD: Record<IslandBiome, Record<BaseRes, number>> = {
  temperate: { timber: 1, coal: 0.6, tar: 0.8, iron: 0.3, provisions: 1.2 },
  mossy: { timber: 1, coal: 0.5, tar: 0.8, iron: 0.3, provisions: 1 },
  volcanic: { timber: 0.4, coal: 1.2, tar: 0.5, iron: 1.3, provisions: 0.6 },
  ice: { timber: 0.5, coal: 0.8, tar: 1, iron: 0.4, provisions: 0.5 },
  ruins: { timber: 0.5, coal: 1.3, tar: 0.4, iron: 0.5, provisions: 0.6 },
  bone: { timber: 0.3, coal: 0.8, tar: 0.2, iron: 0.5, provisions: 0.4 },
  barren: { timber: 0.3, coal: 1, tar: 0.2, iron: 0.6, provisions: 0.4 },
  jungle: { timber: 1.3, coal: 0.4, tar: 0.7, iron: 0.2, provisions: 1.1 },
  mangrove: { timber: 1.1, coal: 0.3, tar: 1.3, iron: 0, provisions: 1 },
  atoll: { timber: 0.4, coal: 0.3, tar: 0.3, iron: 0, provisions: 1.2 },
  saltflat: { timber: 0.2, coal: 0.7, tar: 0, iron: 0.3, provisions: 0.8 },
  blacksand: { timber: 0.4, coal: 1, tar: 0.4, iron: 1.2, provisions: 0.6 },
  fungal: { timber: 0.6, coal: 0.5, tar: 0.6, iron: 0.2, provisions: 0.9 },
  crystal: { timber: 0.3, coal: 1.2, tar: 0.2, iron: 1, provisions: 0.5 },
};

// ------------------------------------------------------------------------------------------------ producers

export type ProducerKind = 'lumber' | 'quarry' | 'tar' | 'mine' | 'fishery';
export const PRODUCER_KINDS: ProducerKind[] = ['lumber', 'quarry', 'tar', 'mine', 'fishery'];

export interface ProducerDef {
  id: ProducerKind;
  name: Tr;
  text: Tr;
  good: BaseRes;
  /** By the hour at level 1 on ordinary land (×1.5 a level more: ×3 at level 5). */
  rate: number;
  /** Its picture (an existing icon id) and how the picture ages: as an outpost grows, or as a building wears. */
  art: string;
  stages: 'growth' | 'condition';
  /** Its first level: silver and resources, and minutes' work. */
  silver: number;
  goods: Partial<Record<BaseRes, number>>;
  secs: number;
}

export const PRODUCERS: Record<ProducerKind, ProducerDef> = {
  lumber: { id: 'lumber', name: ['Logging Camp', 'Лесоповал'], text: ['Fells the island’s trees: timber by the hour.', 'Валит лес острова: брёвна каждый час.'], good: 'timber', rate: 8, art: 'outpost_lumber', stages: 'growth', silver: 500, goods: {}, secs: 180 },
  quarry: { id: 'quarry', name: ['Quarry', 'Каменоломня'], text: ['Breaks the island’s rock: stone and coal by the hour.', 'Ломает камень острова: камень и уголь каждый час.'], good: 'coal', rate: 6, art: 'build_mine', stages: 'condition', silver: 700, goods: { timber: 20 }, secs: 300 },
  tar: { id: 'tar', name: ['Tar Kiln', 'Смолокурня'], text: ['Boils pine tar from the island’s wood.', 'Гонит смолу из леса острова.'], good: 'tar', rate: 4, art: 'outpost_tar', stages: 'growth', silver: 700, goods: { timber: 25 }, secs: 300 },
  mine: { id: 'mine', name: ['Iron Mine', 'Железный рудник'], text: ['Digs iron ore where the rock holds it.', 'Добывает железную руду там, где она есть в скале.'], good: 'iron', rate: 3, art: 'outpost_mine', stages: 'growth', silver: 1100, goods: { timber: 25, coal: 20 }, secs: 480 },
  fishery: { id: 'fishery', name: ['Fishing Crew', 'Рыбная артель'], text: ['Nets and smokes the catch: provisions by the hour.', 'Ловит и коптит рыбу: провизия каждый час.'], good: 'provisions', rate: 8, art: 'outpost_fishery', stages: 'growth', silver: 500, goods: { timber: 15 }, secs: 240 },
};

export const PRODUCER_MAX = 5;

/** A producer's yield by the hour at a level on a biome. */
export function producerRate(kind: ProducerKind, level: number, biome: IslandBiome): number {
  const d = PRODUCERS[kind];
  const lvl = Math.max(1, Math.min(PRODUCER_MAX, level));
  return d.rate * (1 + 0.5 * (lvl - 1)) * BIOME_YIELD[biome][d.good];
}

/** Whether the island's land bears this producer at all. */
export function producerFits(kind: ProducerKind, biome: IslandBiome): boolean {
  return BIOME_YIELD[biome][PRODUCERS[kind].good] > 0;
}

/** How many of one kind of producer the island may keep: one, and one more every third level. */
export function producerLimit(isleLevel: number): number {
  return 1 + Math.floor(Math.max(1, isleLevel) / 3);
}

// ------------------------------------------------------------------------------------------------ what can be raised

/** A thing on a plot: a building of the island (its BuildingId) or a producer ('p:lumber'). */
export type BaseWhat = BuildingId | `p:${ProducerKind}`;

export function isProducer(what: string): what is `p:${ProducerKind}` {
  return what.startsWith('p:') && (what.slice(2) as ProducerKind) in PRODUCERS;
}

export function producerOf(what: string): ProducerKind | null {
  return isProducer(what) ? (what.slice(2) as ProducerKind) : null;
}

/** Buildings that grow a level after the first (the warehouse widens the yard; the shipyard builds her own ships
 *  to higher levels, docs/15 item 4; the shore battery and the fort defend the island harder against raids, item 7). */
export const UPGRADABLE: BuildingId[] = ['warehouse', 'shipyard', 'battery', 'fort'];
export const BUILDING_MAX = 5;

export function maxLevel(what: string): number {
  if (isProducer(what)) return PRODUCER_MAX;
  return UPGRADABLE.includes(what as BuildingId) ? BUILDING_MAX : 1;
}

/** A level above the first asks the island to be at least that level. */
export function levelGate(level: number): number {
  return level;
}

export interface BaseCost {
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  secs: number;
}

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
/** Each level dearer than the last (level 2 ×2.8, level 5 ×11). */
const levelMul = (level: number) => (level <= 1 ? 1 : level ** 1.5);
/** Each level takes 2.2 times longer than the last, to four hours at most. */
export const BUILD_MAX_SECS = 4 * 3600;
const levelTime = (secs: number, level: number) => Math.min(BUILD_MAX_SECS, Math.round(secs * 2.2 ** (Math.max(1, level) - 1)));

/** A producer's silver grows by its level to this power (level 5: ×8; docs/15 item 8, was 1.6: ×13). */
export const PRODUCER_SILVER_EXP = 1.3;
/** Founding the island's shipyard (a leased island's pays half its 60 000). */
export const SHIPYARD_FOUND = 20_000;

/** What raising a thing to a level costs (level 1: founding it). */
export function baseCost(what: string, level: number): BaseCost {
  const kind = producerOf(what);
  const k = levelMul(level);
  if (kind) {
    const d = PRODUCERS[kind];
    const goods: Partial<Record<GoodId, number>> = {};
    for (const [g, n] of Object.entries(d.goods) as [BaseRes, number][]) goods[g] = Math.ceil(n * k);
    if (level >= 2) {
      goods.timber = (goods.timber ?? 0) + 15 * (level - 1);
      goods.coal = (goods.coal ?? 0) + 10 * (level - 1);
    }
    if (level >= 3) goods.iron = (goods.iron ?? 0) + 6 * (level - 2);
    return { silver: round50(d.silver * level ** PRODUCER_SILVER_EXP), goods, secs: levelTime(d.secs, level) };
  }
  const d = BUILDINGS[what as BuildingId];
  if (!d) return { silver: 0, goods: {}, secs: 0 };
  // The island's shipyard is founded for a third of a leased island's (docs/15 item 8: 20 000, not 30 000); its later
  // levels are paid mostly in the island's own timber, tar and iron (docs/15 item 4).
  if (what === 'shipyard' && level <= 1) {
    const w = d.cost / 10_000;
    return { silver: SHIPYARD_FOUND, goods: { timber: Math.ceil(15 + 20 * w), coal: Math.ceil(8 + 10 * w), tar: Math.ceil(2 + 4 * w), iron: d.materials.iron ?? 20 }, secs: levelTime(Math.round(600 * Math.sqrt(w)), 1) };
  }
  if (what === 'shipyard' && level >= 2) {
    const n = level - 1;
    return {
      silver: round50(10_000 * n ** 1.3),
      goods: { timber: 40 + 40 * n, coal: 20 * n, tar: 20 + 15 * n, iron: 15 * n + 10 },
      secs: levelTime(Math.round(600 * Math.sqrt(d.cost / 10_000)), level),
    };
  }
  // The guns' later levels (docs/15 item 7): the island's own timber, stone, iron and tar, and silver for the guns.
  if ((what === 'battery' || what === 'fort') && level >= 2) {
    const n = level - 1;
    const fort = what === 'fort';
    return {
      silver: round50((fort ? 20_000 : 6_000) * n ** 1.3),
      goods: fort ? { timber: 80 + 50 * n, coal: 40 * n, tar: 20 + 10 * n, iron: 30 + 20 * n } : { timber: 30 + 25 * n, coal: 20 * n, tar: 10 * n, iron: 10 + 10 * n },
      secs: levelTime(Math.round(600 * Math.sqrt(d.cost / 10_000)), level),
    };
  }
  // Half the silver of a leased island's building: the rest is paid in the island's own timber, stone and tar.
  const w = d.cost / 10_000;
  const goods: Partial<Record<GoodId, number>> = {
    timber: Math.ceil((15 + 20 * w) * k),
    coal: Math.ceil((8 + 10 * w) * k),
    tar: Math.ceil((2 + 4 * w) * k),
  };
  const iron = Math.ceil((d.materials.iron ?? 2 * w) * k);
  if (iron > 0) goods.iron = iron;
  // What the island cannot make (rum for the tavern, weapons for the guns, cloth for the charts) is brought.
  if (level <= 1) for (const [g, n] of Object.entries(d.materials) as [GoodId, number][]) if (g !== 'planks' && g !== 'iron' && g !== 'timber') goods[g] = n;
  return { silver: round50(d.cost * 0.5 * k), goods, secs: levelTime(Math.round(600 * Math.max(1, Math.sqrt(w))), level) };
}

// ------------------------------------------------------------------------------------------------ the yard

/** The yard's cap for each resource: by the island's level, and a warehouse widens it a level at a time. */
export function yardCap(isleLevel: number, warehouseLevel: number): number {
  return 150 + 50 * Math.max(1, isleLevel) + 250 * Math.max(0, warehouseLevel);
}

// ------------------------------------------------------------------------------------------------ plots and crews

/** Plots on the island by its level (a middling island one more, a large two more). */
export const BASE_PLOTS = [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16];
/** The grid the plots are laid on (5 × 5): the first plots in the middle, the later ones outwards. */
export const GRID = 5;

export function plotsOf(isleLevel: number, size: IslandSize): number {
  const lvl = Math.max(1, Math.min(BASE_PLOTS.length - 1, isleLevel));
  return Math.min(GRID * GRID, BASE_PLOTS[lvl] + (size === 'large' ? 2 : size === 'medium' ? 1 : 0));
}

/** Plot index → grid cell [column, row], the middle first and then ring by ring. */
export const PLOT_CELLS: [number, number][] = (() => {
  const c = (GRID - 1) / 2;
  const cells: [number, number][] = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) cells.push([i, j]);
  const ring = ([i, j]: [number, number]) => Math.max(Math.abs(i - c), Math.abs(j - c));
  const man = ([i, j]: [number, number]) => Math.abs(i - c) + Math.abs(j - c);
  return cells.sort((a, b) => ring(a) - ring(b) || man(a) - man(b) || a[1] + a[0] - (b[1] + b[0]) || a[1] - b[1]);
})();

/** The island levels at which each builders' crew is had (item 5: the island's power adds one more, POWER_CREW). */
export const CREW_LEVELS = [1, 3];

export function crewsAt(isleLevel: number, extra = 0): number {
  return CREW_LEVELS.filter((l) => isleLevel >= l).length + Math.max(0, extra);
}

/** The level at which the next crew comes, if any. */
export function nextCrewAt(isleLevel: number): number | null {
  return CREW_LEVELS.find((l) => l > isleLevel) ?? null;
}

// ------------------------------------------------------------------------------------------------ speed-ups

/** Silver to finish now: 12 a minute of work left (25 at the least). */
export const SPEEDUP_SILVER_MIN = 12;
export function speedupSilver(secsLeft: number): number {
  return Math.max(25, Math.ceil(Math.max(0, secsLeft) / 60) * SPEEDUP_SILVER_MIN);
}

/** Provisions to finish now (extra hands fed): one for every three minutes left. */
export function speedupGoods(secsLeft: number): Partial<Record<GoodId, number>> {
  return { provisions: Math.max(2, Math.ceil(Math.max(0, secsLeft) / 180)) };
}

/** A free speed-up token takes a quarter of an hour off the work; a captain keeps twenty at most. */
export const TOKEN_SECS = 900;
export const TOKEN_MAX = 20;
export const TOKENS_LOGIN = 2;
export const TOKENS_ORDER = 1;
