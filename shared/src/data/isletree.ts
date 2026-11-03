// The island's tech tree (owner, 2026-10-11; docs/29_ISLANDS.md): «у построек давай сделаем максимум 5 уровней, и чтобы
// ратушу качать надо другие открыть и чтобы другие открыть здания надо другие тоже качать, надо баланс связать так, чтобы
// надо было все качать постепенно». A captain's island is a mobile city-builder's plot of land: the town hall stands on
// it from the claim, and every building of the town and the base rises through five levels at most, each for silver,
// the yard's resources and real time. One tree ties them together:
//
//  - no building stands above the hall (its level L asks the hall at L), and each asks a neighbour in the chain — the
//    marines' barracks the deckhands' bunkhouse, the shooting range the barracks and the market (powder is bought), the
//    gun foundry the range and the shipyard (guns are cast there), and so on up to the drowned shrine;
//  - the hall's next level asks the town round it: hall 2 the first ring at level 1, hall 3 the next at 2, hall 4 more at
//    3, hall 5 every building of the core at level 2 or more — so nothing can be skipped (tests/isletree.test.ts walks it);
//  - the island's level (plots, outposts, caravans, residents, builders' crews — estate.ts ISLE_LEVELS) follows the
//    hall: ISLE_OF_HALL; the outposts hang on it (outpostLimit), so they are the tree's outer links;
//  - the single-level buildings of the base open at a hall level (BASE_UNLOCK); the producers rise no higher than the hall.
//
// Costs and times grow with every level (TREE_SILVER, TREE_TIME, TREE_GOODS) — a steady captain reaches hall 5 in about
// three and a half weeks (tests/balance/isletree.ts, `node tools/balance-isles.ts`).
//
// Levels 6–10 (owner, 2026-11-03, docs/38): «надо улучшения делать до 10 … стройка всего до 10 уровня занимала 3 года без
// ускорений … после 5 уровня должна быть супердорогой». Every building of the tree (and the producers and the base's
// buildings that rise with the hall) goes on to 10: the time of a level ×1.94 a level (TREE_TIME 140 … 1 979 of the first
// level's), the silver of level 5 ×3 / 6 / 11 / 20 / 36, the goods ×12 … 55 of the first and the sea's rare goods as a
// second lock (RARE_KIT: pearls, rum and powder from 6, whalebone, scales, sulphur iron and ambergris from 8, the bosses'
// trophies at 10). With the two free crews the whole tree to 10 takes about three years (tests/balance/isletree.ts
// treePace). The island's level stays as the hall 1..5 made it (ISLE_OF_HALL: 10 from hall 5 on); the hall 6..10 gives
// its own (hallBonus: outposts, crews, a caravan, the title «Пиратская столица»).

import { cheapStart } from './startcost.ts';
import type { GoodId } from './goods.ts';
import type { BuildingId } from './holdings.ts';
import type { Tr } from './estate.ts';

export type TreeId = 'hall' | 'keep' | 'market' | 'guild' | 'dw1' | 'dw2' | 'dw3' | 'dw4' | 'dw5' | 'dw6' | 'dw7' | 'warehouse' | 'shipyard' | 'battery' | 'fort';

/** The town's buildings of the tree (TownId) and the base's (BuildingId, raised on a plot). */
export const TREE_TOWN: TreeId[] = ['hall', 'keep', 'market', 'guild', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7'];
export const TREE_BASE: TreeId[] = ['warehouse', 'shipyard', 'battery', 'fort'];
export const TREE_IDS: TreeId[] = [...TREE_TOWN, ...TREE_BASE];
/** Every building's greatest level (owner, 2026-11-03: 5 → 10, docs/38). */
export const TREE_MAX = 10;
/** The tree's greatest level before docs/38 (the island's level is full at the hall of this level: ISLE_OF_HALL). */
export const TREE_OLD_MAX = 5;
/** The guns are not built on the Crown's own coast (holdings.ts notSafe): the hall never asks them. */
export const TREE_OPTIONAL: TreeId[] = ['battery', 'fort'];
/** The core: every building the hall's last level asks (the whole tree but the optional guns). */
export const TREE_CORE: TreeId[] = TREE_IDS.filter((id) => !TREE_OPTIONAL.includes(id));

export const isTreeTown = (id: string): boolean => (TREE_TOWN as string[]).includes(id);
export const isTreeBase = (id: string): boolean => (TREE_BASE as string[]).includes(id);
export const isTree = (id: string): id is TreeId => (TREE_IDS as string[]).includes(id);

// ------------------------------------------------------------------------------------------------ the island's level

/** The island's level (1..10, estate.ts ISLE_LEVELS) at each hall level: the hall carries the island (docs/38: the hall
 *  6..10 keeps it at 10 and gives hallBonus instead — nobody's island level moves). */
export const ISLE_OF_HALL = [0, 1, 3, 5, 7, 10, 10, 10, 10, 10, 10];

/** What the hall 6..10 adds over the island's level (docs/38 §2.4): an outpost at 6 and 9, a builders' crew at 7 and 10,
 *  a caravan at 8; the hall 10 is the pirates' capital. */
export function hallBonus(hall: number): { outposts: number; crews: number; caravans: number } {
  const h = Math.max(0, Math.floor(hall));
  return { outposts: (h >= 6 ? 1 : 0) + (h >= 9 ? 1 : 0), crews: (h >= 7 ? 1 : 0) + (h >= 10 ? 1 : 0), caravans: h >= 8 ? 1 : 0 };
}

/** The hall an island of a level stands for (the migration of the islands raised before the tree). */
export function hallOfIsle(level: number): number {
  const l = Math.max(1, Math.round(level));
  return l >= 10 ? 5 : l >= 7 ? 4 : l >= 5 ? 3 : l >= 3 ? 2 : 1;
}

// ------------------------------------------------------------------------------------------------ requirements

export type Need = [TreeId, number];

/** What level L of a building asks of the others (the hall's own chain apart: the hall at L for every other one). */
const HALL_NEEDS: Need[][] = [
  [],
  [],
  [['warehouse', 1], ['keep', 1], ['market', 1], ['dw1', 1], ['dw2', 1]],
  [['warehouse', 2], ['keep', 2], ['market', 2], ['shipyard', 1], ['guild', 1], ['dw1', 2], ['dw2', 2], ['dw3', 1]],
  [['warehouse', 3], ['keep', 3], ['market', 3], ['shipyard', 2], ['guild', 2], ['dw1', 3], ['dw2', 3], ['dw3', 2], ['dw4', 1], ['dw5', 1]],
  [['warehouse', 4], ['keep', 4], ['market', 4], ['shipyard', 3], ['guild', 3], ['dw1', 4], ['dw2', 4], ['dw3', 3], ['dw4', 3], ['dw5', 2], ['dw6', 2], ['dw7', 2]],
  // docs/38: the hall 6..10 asks the whole core at its own level less one (nothing is left behind at the top)
  ...[6, 7, 8, 9, 10].map((L) => (['warehouse', 'keep', 'market', 'shipyard', 'guild', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7'] as TreeId[]).map((k) => [k, L - 1] as Need)),
];

const cap = (n: number) => Math.max(0, Math.min(TREE_MAX, n));
/** The keep a level above the building's own, as the tree asked it to level 5 (that level asked the keep at 5: no building
 *  stands above the hall); from level 5 on the keep at the same level. */
const above = (L: number) => (L < TREE_OLD_MAX ? L + 1 : L);

/** Level L of a building: what it asks first (the hall's level among the rest). */
export function treeNeeds(id: TreeId, level: number): Need[] {
  const L = Math.max(1, Math.min(TREE_MAX, Math.round(level)));
  if (id === 'hall') return HALL_NEEDS[L].map(([k, n]) => [k, n] as Need);
  const out: Need[] = [];
  const hall = (n: number) => out.push(['hall', cap(Math.max(L, n))]);
  const add = (k: TreeId, n: number) => {
    if (cap(n) > 0) out.push([k, cap(n)]);
  };
  switch (id) {
    case 'warehouse': hall(1); break;
    case 'dw1': hall(1); break;
    case 'keep': hall(1); add('dw1', L - 1); break;
    case 'market': hall(1); add('warehouse', L - 1); break;
    case 'dw2': hall(1); add('dw1', L); add('keep', L - 1); break;
    case 'shipyard': hall(2); add('warehouse', L); break;
    case 'guild': hall(2); add('market', L); break;
    // Owner, 2026-10-28 («ключ — это остров»): the musketeers and the gunners open from the first hall — the top
    // captains of level 11–14 sailed with deckhands alone: the shooting range asked hall 2 (~6 000 silver) and the gun
    // foundry hall 3 and the shipyard (~25 000). Now a stack of tier 3 is ~3 000 silver of the island away, tier 4 ~5 000.
    case 'dw3': hall(1); add('dw2', L); add('market', L - 1); break;
    case 'dw4': hall(1); add('dw3', L); add('keep', L); break;
    case 'dw5': hall(3); add('dw4', L); add('keep', above(L)); break;
    case 'dw6': hall(4); add('dw5', L); add('keep', above(L)); break;
    case 'dw7': hall(4); add('dw6', L); add('guild', L); break;
    case 'battery': hall(1); add('keep', L); break;
    case 'fort': hall(3); add('keep', above(L)); add('battery', 1); break;
  }
  return out;
}

/** The hall level each single-level building of the base opens at (the tree's own buildings and the producers apart). */
export const BASE_UNLOCK: Partial<Record<BuildingId, number>> = {
  pier: 1, tavern: 1, farm: 1, fishing_village: 1, residents_house: 1,
  workshop: 2, sawmill: 2, smokehouse: 2, chapel: 2, lighthouse: 2, caravan_office: 2, signal_tower: 2,
  forge: 3, distillery: 3, chart_house: 3, trophy_hall: 3, barracks: 3, mine: 3, try_works: 3, hidden_cove: 3, smuggler_store: 3,
  plantation: 4, powder_mill: 4, dry_dock: 4,
};

/** The hall a producer of a level asks (a producer rises no higher than the hall). */
export const producerHall = (level: number): number => cap(level);

// ------------------------------------------------------------------------------------------------ costs and times

export interface TreeCost {
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  secs: number;
}

/** Each level's silver, resources and time against the first level's (docs/38 §2.2–2.3: from level 6 the silver is
 *  level 5's ×3 / 6 / 11 / 20 / 36 — 20 × those — and the time ×1.94 a level: docs/38 had ×2.1, 151 … 2 941, but its
 *  table stopped the clock at the hall 10, and the town still rises 9 → 10 after it — with ×2.1 the whole tree took 4.2
 *  years of the two free crews; ×1.94 makes it the owner's three, tests/balance/isletree.test.ts treePace). */
export const TREE_SILVER = [0, 1, 2.5, 5.5, 11, 20, 60, 120, 220, 400, 720];
export const TREE_GOODS = [0, 1, 2, 3.5, 5.5, 8, 12, 18, 26, 38, 55];
export const TREE_TIME = [0, 1, 5, 15, 36, 72, 140, 271, 526, 1020, 1979];
/** Level 6..10's silver against level 5's (the hall's, the producers' and the base buildings' too). */
export const TOP_SILVER = [0, 0, 0, 0, 0, 1, 3, 6, 11, 20, 36];

/** The sea's rare goods a level 6..10 asks besides (docs/38 §2.3, the second lock): two of pearls, rum and powder from
 *  level 6, two of whalebone, serpent scales, sulphur iron and ambergris from level 8, a boss's trophy or two at level
 *  10 — leviathan bone (the Leviathan, the reach's bosses), kraken ink (the Kraken), drowned silk and abyssal ore (the
 *  Drowned Crown's bosses, the Abyss). Each building its own kit, by what it is. */
export interface RareKit {
  a: GoodId[];
  b: GoodId[];
  c: GoodId[];
}
export const RARE_KIT: Record<TreeId, RareKit> = {
  hall: { a: ['pearls', 'rum'], b: ['ambergris', 'serpent_scale'], c: ['leviathan_bone', 'drowned_silk'] },
  keep: { a: ['gunpowder', 'rum'], b: ['sulfur_iron', 'whalebone'], c: ['abyssal_ore'] },
  market: { a: ['pearls', 'rum'], b: ['ambergris', 'whalebone'], c: ['kraken_ink'] },
  guild: { a: ['pearls', 'gunpowder'], b: ['serpent_scale', 'ambergris'], c: ['kraken_ink'] },
  dw1: { a: ['rum', 'gunpowder'], b: ['whalebone', 'sulfur_iron'], c: ['leviathan_bone'] },
  dw2: { a: ['rum', 'gunpowder'], b: ['whalebone', 'sulfur_iron'], c: ['abyssal_ore'] },
  dw3: { a: ['gunpowder', 'rum'], b: ['sulfur_iron', 'serpent_scale'], c: ['kraken_ink'] },
  dw4: { a: ['gunpowder', 'rum'], b: ['sulfur_iron', 'whalebone'], c: ['abyssal_ore'] },
  dw5: { a: ['rum', 'pearls'], b: ['serpent_scale', 'whalebone'], c: ['leviathan_bone'] },
  dw6: { a: ['pearls', 'gunpowder'], b: ['ambergris', 'serpent_scale'], c: ['drowned_silk'] },
  dw7: { a: ['pearls', 'rum'], b: ['ambergris', 'serpent_scale'], c: ['drowned_silk', 'abyssal_ore'] },
  warehouse: { a: ['rum', 'gunpowder'], b: ['whalebone', 'sulfur_iron'], c: ['leviathan_bone'] },
  shipyard: { a: ['rum', 'gunpowder'], b: ['whalebone', 'serpent_scale'], c: ['leviathan_bone', 'kraken_ink'] },
  battery: { a: ['gunpowder', 'rum'], b: ['sulfur_iron', 'whalebone'], c: ['abyssal_ore'] },
  fort: { a: ['gunpowder', 'pearls'], b: ['sulfur_iron', 'serpent_scale'], c: ['abyssal_ore', 'leviathan_bone'] },
};
/** Every rare good a level 6..10 may ask (the town's window counts them among its resources once she holds any). */
export const RARE_GOODS: GoodId[] = [...new Set(Object.values(RARE_KIT).flatMap((k) => [...k.a, ...k.b, ...k.c]))];
/** Units of a rare good for each thousand of the building's first-level silver, by level (index: the level). */
const RARE_PER: Partial<Record<GoodId, number[]>> = {
  rum: [0, 0, 0, 0, 0, 0, 20, 40, 70, 110, 160],
  gunpowder: [0, 0, 0, 0, 0, 0, 20, 40, 70, 110, 160],
  whalebone: [0, 0, 0, 0, 0, 0, 0, 0, 40, 70, 110],
  pearls: [0, 0, 0, 0, 0, 0, 3, 6, 10, 15, 22],
  serpent_scale: [0, 0, 0, 0, 0, 0, 0, 0, 4, 8, 12],
  sulfur_iron: [0, 0, 0, 0, 0, 0, 0, 0, 4, 8, 12],
  ambergris: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3],
};
/** A boss's trophy at level 10, for each thousand of the first level's silver. */
const TROPHY_PER = 3;

/** The rare goods level L of a building asks (none below 6). `k`: its weight (a thousand of its first-level silver). */
export function rareGoods(id: TreeId, level: number, k: number): Partial<Record<GoodId, number>> {
  const L = Math.max(1, Math.min(TREE_MAX, Math.round(level)));
  const out: Partial<Record<GoodId, number>> = {};
  if (L < 6) return out;
  const w = Math.max(0.5, Math.min(6, k));
  const kit = RARE_KIT[id];
  for (const g of [...kit.a, ...(L >= 8 ? kit.b : [])]) out[g] = (out[g] ?? 0) + Math.ceil((RARE_PER[g]?.[L] ?? 0) * w);
  if (L >= 10) for (const g of kit.c) out[g] = (out[g] ?? 0) + Math.ceil(TROPHY_PER * w);
  return out;
}

interface Base {
  silver: number;
  /** Minutes the first level takes. */
  mins: number;
  goods: Partial<Record<GoodId, number>>;
  /** What only the first level asks (the guns' weapons, brought in the hold). */
  once?: Partial<Record<GoodId, number>>;
}

/** Each building's first level (the hall's levels are its own: HALL_COST). */
const BASE: Record<Exclude<TreeId, 'hall'>, Base> = {
  warehouse: { silver: 600, mins: 20, goods: { timber: 40, coal: 20 } },
  dw1: { silver: 450, mins: 15, goods: { timber: 30, coal: 15 } },
  keep: { silver: 1_200, mins: 30, goods: { timber: 40, coal: 45, iron: 10 } },
  market: { silver: 800, mins: 25, goods: { timber: 40, coal: 20 } },
  dw2: { silver: 750, mins: 25, goods: { timber: 40, coal: 25 } },
  shipyard: { silver: 2_000, mins: 45, goods: { timber: 60, coal: 30, tar: 20, iron: 20 } },
  guild: { silver: 1_600, mins: 45, goods: { timber: 40, coal: 30, tar: 20, pearls: 2 } },
  dw3: { silver: 800, mins: 25, goods: { timber: 45, coal: 30, iron: 10, gunpowder: 8 } },
  dw4: { silver: 1_100, mins: 30, goods: { timber: 50, coal: 40, iron: 20, gunpowder: 12 } },
  dw5: { silver: 2_100, mins: 50, goods: { timber: 60, coal: 50, iron: 25, rum: 20 } },
  dw6: { silver: 3_000, mins: 60, goods: { timber: 70, coal: 60, iron: 30, pearls: 4 } },
  dw7: { silver: 3_750, mins: 70, goods: { timber: 80, coal: 70, tar: 30, pearls: 6 } },
  battery: { silver: 1_200, mins: 30, goods: { timber: 30, coal: 20, iron: 10 }, once: { weapons: 8 } },
  fort: { silver: 3_500, mins: 60, goods: { timber: 80, coal: 50, iron: 40 }, once: { weapons: 24 } },
};

/** The hall's fifth level's goods; its goods of level 6..10 against them; its rare goods' weight (rareGoods `k`). */
const HALL5_GOODS: Partial<Record<GoodId, number>> = { timber: 800, coal: 640, iron: 260, tar: 160, pearls: 14, rum: 40 };
const HALL_GOODS = [0, 0, 0, 0, 0, 1, 1.5, 2.25, 3, 4, 5];
const HALL_RARE_K = 6;

/** The hall's levels (its first stands from the claim, free). Balance pass 2026-10-13 (docs/31): hall 2 8 000 → 6 000
 *  and hall 3 22 000 → 15 000 (their goods a quarter less): with a third of her sea income to the island (what the
 *  army, the ship and the food leave a good captain) hall 2 stood at day 3.4 and hall 3 at day 9.5 of a steady player —
 *  levels ~20 and ~33, past the ⚓4 and ⚓6 bands they are for (docs/30 B: the bot of 26–40 never raised hall 3). Now
 *  hall 2 day 2.9 (~18), hall 3 8.2 (~31), hall 4 18 (~44), hall 5 32 (~52) — each in its band. */
const HALL_COST: TreeCost[] = [
  { silver: 0, goods: {}, secs: 0 },
  { silver: 0, goods: {}, secs: 0 },
  { silver: 6_000, goods: { timber: 100, coal: 60, iron: 15 }, secs: 2 * 3600 },
  { silver: 15_000, goods: { timber: 200, coal: 150, iron: 45, tar: 30 }, secs: 8 * 3600 },
  { silver: 48_000, goods: { timber: 480, coal: 380, iron: 140, tar: 90, pearls: 6 }, secs: 20 * 3600 },
  { silver: 95_000, goods: HALL5_GOODS, secs: 40 * 3600 },
  // docs/38: the hall 6..10 — level 5's silver ×3 / 6 / 11 / 20 / 36, its time ×1.94 a level (TREE_TIME against level 5's),
  // its goods ×1.5 … ×5 of level 5's (slower than the town's ×12 … ×55 of the first: the hall's timber stays within the
  // yard of a warehouse a level below it, yardCap), and the rare goods of its kit (rareGoods)
  ...[6, 7, 8, 9, 10].map((L): TreeCost => {
    const goods: Partial<Record<GoodId, number>> = {};
    for (const [g, n] of Object.entries(HALL5_GOODS) as [GoodId, number][]) goods[g] = Math.ceil(n * HALL_GOODS[L]);
    for (const [g, n] of Object.entries(rareGoods('hall', L, HALL_RARE_K)) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + n;
    return { silver: 95_000 * TOP_SILVER[L], goods, secs: Math.round((40 * 3600 * TREE_TIME[L]) / TREE_TIME[5]) };
  }),
];

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);

/** What raising a building of the tree to level L costs (level 1: founding it) — the cheap start over its first
 *  three levels (owner, 2026-10-28: startcost.ts). */
export function treeCost(id: TreeId, level: number): TreeCost {
  return cheapStart((l) => treeCostOld(id, l), Math.max(1, Math.min(TREE_MAX, Math.round(level))));
}

/** The tree's costs as they stood before the cheap start (its levels 4 and 5 still). */
export function treeCostOld(id: TreeId, level: number): TreeCost {
  const L = Math.max(1, Math.min(TREE_MAX, Math.round(level)));
  if (id === 'hall') return { silver: HALL_COST[L].silver, goods: { ...HALL_COST[L].goods }, secs: HALL_COST[L].secs };
  const b = BASE[id];
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [g, n] of Object.entries(b.goods) as [GoodId, number][]) goods[g] = Math.ceil(n * TREE_GOODS[L]);
  if (L === 1) for (const [g, n] of Object.entries(b.once ?? {}) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + n;
  for (const [g, n] of Object.entries(rareGoods(id, L, b.silver / 1000)) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + n;
  return { silver: round50(b.silver * TREE_SILVER[L]), goods, secs: Math.round(b.mins * 60 * TREE_TIME[L]) };
}

// ------------------------------------------------------------------------------------------------ walking the tree

/** Every level the tree asks before `id` may stand at `level` (itself included), as the greatest level of each. */
export function treeClosure(id: TreeId, level: number): Map<TreeId, number> {
  // (pure on the data: kept once worked out — the planner asks it for every step, docs/38's ten levels made it dear)
  const key = `${id}:${level}`;
  const was = CLOSURES.get(key);
  if (was) return new Map(was);
  const out = closure(id, level);
  CLOSURES.set(key, out);
  return new Map(out);
}
const CLOSURES = new Map<string, Map<TreeId, number>>();

function closure(id: TreeId, level: number): Map<TreeId, number> {
  const out = new Map<TreeId, number>();
  const visit = (k: TreeId, n: number, path: string[]) => {
    if (n <= 0) return;
    const key = `${k}:${n}`;
    if (path.includes(key)) throw new Error(`a cycle in the island's tree: ${[...path, key].join(' → ')}`);
    if ((out.get(k) ?? 0) >= n) return;
    out.set(k, n);
    for (let l = 1; l <= n; l++) for (const [d, m] of treeNeeds(k, l)) visit(d, m, [...path, key]);
  };
  visit(id, level, []);
  return out;
}

/** The order a captain may raise the tree up to the hall at `hall`: every step after all it asks (a level at a time). */
export function treePlan(hall = TREE_MAX): Need[] {
  const want = treeClosure('hall', hall);
  const have = new Map<TreeId, number>([['hall', 1]]);
  const steps: Need[] = [];
  const ok = (k: TreeId, n: number) => treeNeeds(k, n).every(([d, m]) => (have.get(d) ?? 0) >= m);
  for (let guard = 0; guard < 500; guard++) {
    let moved = false;
    // The cheapest step that may be taken next (the hall last of all at its level, so the ring round it comes first).
    const next = [...want].filter(([k, n]) => (have.get(k) ?? 0) < n).map(([k]) => [k, (have.get(k) ?? 0) + 1] as Need).filter(([k, n]) => ok(k, n))
      .sort((a, b) => (a[0] === 'hall' ? 1 : 0) - (b[0] === 'hall' ? 1 : 0) || a[1] - b[1] || treeCost(a[0], a[1]).silver - treeCost(b[0], b[1]).silver);
    if (next.length) {
      const [k, n] = next[0];
      have.set(k, n);
      steps.push([k, n]);
      moved = true;
    }
    if (!moved) break;
  }
  return steps;
}

// ------------------------------------------------------------------------------------------------ what each level gives

/** The town hall's silver a day (a day of the sea's calendar) by its level. */
export const HALL_DAY = [0, 60, 100, 160, 250, 400, 600, 900, 1_300, 1_800, 2_500];
/** Each dwelling's growth by its level (the upgraded kind from DWELL_UP_LEVEL). */
export const DWELL_GROWTH = [0, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8, 2, 2.2, 2.5];
export const DWELL_UP_LEVEL = 3;
/** docs/38 §2.4 variant B (owner, 2026-11-03): from this dwelling level each tier opens a third, elite kind (army.ts
 *  TIER_ELITE), hired at the island only from a pool of its own (server town.ts isleElitePools, dwell.ts). */
export const DWELL_ELITE_LEVEL = 8;
export const dwellElite = (level: number): boolean => Math.floor(level) >= DWELL_ELITE_LEVEL;
/** The share off a man's silver hired from a dwelling of her island, by its level (docs/38 §2.4: −5 % at 6, −10 % at 7
 *  and 8, −15 % at 9, −20 % at 10). */
export const DWELL_HIRE_OFF = [0, 0, 0, 0, 0, 0, 0.05, 0.1, 0.1, 0.15, 0.2];
/** The island's own ships' greatest level by the shipyard's (baseships.ts yardLevelFor reads it), and the share off the
 *  repairs of one's ship lying off the island. */
export const SHIPYARD_REPAIR = [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.5];
/** The yard's room grows ×1.25 a warehouse level above 5 (docs/38 §2.4; base.ts yardCap). */
export const WAREHOUSE_TOP = 1.25;

// ------------------------------------------------------------------------------------------------ the board

/** The island's board (client/src/ui/base.ts): a diamond of 6 × 6 cells. The town stands on its two back edges (the
 *  hall at the back corner, the keep and the market at its sides, the guild, then the dwellings tier by tier); the
 *  base's plots fill the 5 × 5 in front of them (shared/src/data/base.ts PLOT_CELLS, one cell in); the pen and the
 *  Grail take two corners of the plots that never open. */
export const BOARD = 6;
export const TOWN_CELLS: Record<string, [number, number]> = {
  hall: [0, 0], keep: [1, 0], market: [0, 1], guild: [2, 0], dw1: [0, 2], dw2: [3, 0], dw3: [0, 3], dw4: [4, 0], dw5: [0, 4], dw6: [5, 0], dw7: [0, 5],
};

// ------------------------------------------------------------------------------------------------ moving house

/** A captain's island: the first is claimed free, and so is the first move; every move after that costs a fortune
 *  (owner: «далее только за дублоны и очень много, в рублях типа 3000», «потом платно и очень сильно платно, я бы цену
 *  сделал типа лям») — a million silver, or 2 600 doubloons: the 2 600 pack exactly (2 000 + 600 bonus; 1 500 Telegram
 *  Stars at ¾ a star a doubloon — about 3 000 roubles at a star's two roubles). */
export const MOVE_SILVER = 1_000_000;
export const MOVE_DOUBLOONS = 2_600;
export const FREE_MOVES = 1;

export function treePatterns(): Tr[] {
  return [
    ['The island grows with its town hall.', 'Остров растёт вместе с ратушей.'],
    ['{0} on {1}: level {2}.', '{0} на острове {1}: уровень {2}.'],
    ['{0} on {1}: level {2} of 5.', '{0} на острове {1}: уровень {2} из 5.'],
    [`{0} on {1}: level {2} of ${TREE_MAX}.`, `{0} на острове {1}: уровень {2} из ${TREE_MAX}.`],
    ['First raise {0} to level {1}.', 'Сначала поднимите: {0} до уровня {1}.'],
    ['Raise the town hall to level {0} first.', 'Сначала поднимите ратушу до уровня {0}.'],
    ['It is at its greatest: level 5.', 'Это уже наибольший уровень: 5.'],
    [`It is at its greatest: level ${TREE_MAX}.`, `Это уже наибольший уровень: ${TREE_MAX}.`],
    ['{0} is yours: the town hall stands on it.', '{0} теперь ваш: на нём стоит ратуша.'],
    ['You hold {0} already. Moving there demolishes every building on {1}.', 'Ваш остров — {0}. Перенос туда снесёт все постройки на острове {1}.'],
    ['You hold {0} already.', 'Ваш остров уже {0}.'],
    ['Moving costs {0} silver.', 'Перенос стоит {0} серебра.'],
    ['Moving costs {0} doubloons.', 'Перенос стоит {0} дублонов.'],
    ['Your island moves to {0}: everything on {1} is pulled down.', 'Ваш остров переезжает на {0}: всё на острове {1} снесено.'],
    ['Port islands are not for claiming.', 'Острова с портом занять нельзя.'],
    ['A pirate fortress holds this island: choose another.', 'Этот остров держит пиратская крепость: выберите другой.'],
    ['Sail to {0} to claim it.', 'Чтобы занять остров {0}, подплывите к нему.'],
    ['That is your island already.', 'Это уже ваш остров.'],
    ['Not while raiders lie off your island.', 'Не пока у вашего острова стоят налётчики.'],
    ['{0} captains hold their own island here.', 'Здесь свои острова держат капитаны: {0}.'],
    ['The island’s free: {0}.', 'Остров освобождён: {0}.'],
    ['Builders done: {0}.', 'Стройка завершена: {0}.'],
    ['No work under way.', 'Сейчас ничего не строится.'],
    ['Island: {0}, hall {1}; claims {2}; the next move: free.', 'Остров: {0}, ратуша {1}; занято островов: {2}; следующий перенос: бесплатно.'],
    ['Island: {0}, hall {1}; claims {2}; the next move: {3} silver or {4} doubloons.', 'Остров: {0}, ратуша {1}; занято островов: {2}; следующий перенос: {3} серебра или {4} дублонов.'],
    ['The tree stands at level {0}: {1} buildings.', 'Всё дерево построек — на уровне {0}: зданий {1}.'],
    ['Bring your own ships home to the island first.', 'Сначала верните свои корабли к острову.'],
    ['{0} silver or {1} doubloons', '{0} серебра или {1} дублонов'],
    // pulling a building down (owner, 2026-10-28: server/src/game/raze.ts)
    ['The town hall carries the island: it cannot be pulled down.', 'Ратуша держит весь остров: её снести нельзя.'],
    ['The Grail stays with the town for good.', 'Грааль остаётся с городом навсегда.'],
    ['The shipwrights are at work on your ship: wait for them.', 'Корабелы работают над вашим кораблём: дождитесь их.'],
    ['Other buildings stand on it: {0}.', 'Снести нельзя — на нём держатся: {0}.'],
    ['{0} on {1} is pulled down: {2} silver to the treasury, the rest to the yard.', '{0} (остров {1}) снесено: {2} серебра в казну, остальное на склад.'],
    ['Nothing stands there.', 'Здесь ничего не стоит.'],
  ];
}
