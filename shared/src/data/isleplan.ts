// The island's build order (owner, 2026-10-17: «на острове надо показывать что первым построить надо, то есть
// рекомендации. идеальный порядок постройки (не место, а именно последовательность) с учетом прокачек всех»). Not where
// to build — what next: a deterministic planner over the tree (isletree.ts) and the producers (base.ts), from the
// island as it stands now to every building at level 5. docs/29 §8 has the canonical order and the reasons.
//
// Greedy by value with the tree's own dependencies: at every step the planner looks at each level that may be raised
// next (all it asks stands, the hall high enough), weighs what it gives against what it costs, takes the best and goes
// on as if it stood. The weights:
//  - the producers first: their timber, coal, tar and iron pay for every later step (the richer the land in their good,
//    the more they are worth);
//  - the hall when the town round it is ready: it opens the next ring, the island's level, plots and the second
//    builders' crew (hall 2); a hall far above the captain's level band waits behind the cheap levels within reach;
//  - the warehouse when the next hall's goods press on the yard's room (storage before the big halls);
//  - what the next hall asks before what it does not;
//  - the army's dwellings by the captain's path (each path its own tiers), the rest of the town by its use;
//  - the guns only off the Crown's coast.
// Pure: the server builds the view (server/src/game/isleplan.ts), the tests walk it (tests/isleplan.test.ts).

import type { GoodId } from './goods.ts';
import type { IslandBiome } from '../world/regions.ts';
import type { CaptainId } from './captains.ts';
import { BIOME_YIELD, PRODUCERS, PRODUCER_KINDS, baseCost, yardCap } from './base.ts';
import type { ProducerKind } from './base.ts';
import { ISLE_OF_HALL, TREE_IDS, TREE_MAX, TREE_OPTIONAL, treeClosure, treeCost, treeNeeds } from './isletree.ts';
import type { TreeId } from './isletree.ts';

/** A step's subject: a building of the tree, or a producer ('p:lumber'). */
export type PlanWhat = TreeId | `p:${ProducerKind}`;

/** Why a step stands where it does (the card's one line). */
export type PlanWhy = 'prod' | 'hall' | 'crew' | 'store' | 'gate' | 'army' | 'path' | 'town' | 'guns';

export interface PlanState {
  /** Each tree building's level standing now (0 or missing: not raised). */
  levels: Partial<Record<TreeId, number>>;
  /** Each producer kind's greatest level on the island (0 or missing: none). */
  producers: Partial<Record<ProducerKind, number>>;
  /** Work under way (`t:hall`, `warehouse`, `p:lumber`) and the level it raises to: counted as done for the order. */
  busy?: { what: string; level: number }[];
  biome: IslandBiome;
  /** The Crown's own coast: no guns there. */
  safe: boolean;
  playerLevel: number;
  path: CaptainId;
}

export interface PlanStep {
  what: PlanWhat;
  level: number;
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  secs: number;
  value: number;
  why: PlanWhy;
}

/** The player level each hall level is for (docs/29 balance: hall 2 ~18, hall 3 ~31, hall 4 ~44, hall 5 ~52). */
export const HALL_BAND = [0, 1, 16, 28, 40, 50];
/** How far under the band the hall still comes first (levels). */
export const BAND_SLACK = 6;

/** Each path's own dwellings (the tiers its battle book leans on). */
export const PATH_TIERS: Record<CaptainId, TreeId[]> = {
  corsair: ['dw3', 'dw4'],
  reaver: ['dw2', 'dw5'],
  admiral: ['dw2', 'dw6'],
  navigator: ['dw1', 'dw4'],
  smuggler: ['dw1', 'dw5'],
  drowned: ['dw6', 'dw7'],
};
/** Each path's town building it uses most (the ships for the navigator, the market for the smuggler…). */
export const PATH_TOWN: Record<CaptainId, TreeId> = {
  corsair: 'keep', reaver: 'keep', admiral: 'keep', navigator: 'shipyard', smuggler: 'market', drowned: 'guild',
};

const BASE_VALUE: Record<TreeId, number> = {
  hall: 10, warehouse: 7, keep: 5, market: 5, guild: 4, shipyard: 5,
  dw1: 4, dw2: 4, dw3: 4, dw4: 4, dw5: 4, dw6: 4, dw7: 4, battery: 2, fort: 2,
};

/** How much the tree asks of each producer's good (timber and coal most, provisions only for the speed-ups). */
export const PROD_USE: Record<ProducerKind, number> = { lumber: 1.2, quarry: 1.2, mine: 1, tar: 0.8, fishery: 0.4 };

const isP = (w: string): w is `p:${ProducerKind}` => w.startsWith('p:');

/** What a step costs. */
export function stepCost(what: PlanWhat, level: number): { silver: number; goods: Partial<Record<GoodId, number>>; secs: number } {
  return isP(what) ? baseCost(what, level) : treeCost(what, level);
}

/** A step's weight: silver, goods and the builders' hours on one scale (a thousand silver ≈ 80 goods ≈ an hour). */
export function stepWeight(c: { silver: number; goods: Partial<Record<GoodId, number>>; secs: number }): number {
  const goods = Object.values(c.goods).reduce((a, n) => a + (n ?? 0), 0);
  return 0.2 + c.silver / 1000 + goods / 80 + c.secs / 3600;
}

interface Sim {
  lv: Map<TreeId, number>;
  pr: Map<ProducerKind, number>;
}

function simOf(st: PlanState): Sim {
  const lv = new Map<TreeId, number>();
  for (const id of TREE_IDS) lv.set(id, Math.max(0, Math.min(TREE_MAX, Math.floor(st.levels[id] ?? 0))));
  lv.set('hall', Math.max(1, lv.get('hall') ?? 1));
  const pr = new Map<ProducerKind, number>();
  for (const k of PRODUCER_KINDS) pr.set(k, Math.max(0, Math.min(TREE_MAX, Math.floor(st.producers[k] ?? 0))));
  for (const b of st.busy ?? []) {
    if (b.what.startsWith('t:')) {
      const id = b.what.slice(2) as TreeId;
      if (lv.has(id)) lv.set(id, Math.max(lv.get(id)!, b.level));
    } else if (isP(b.what)) {
      const k = b.what.slice(2) as ProducerKind;
      if (pr.has(k)) pr.set(k, Math.max(pr.get(k)!, b.level));
    } else if (lv.has(b.what as TreeId)) lv.set(b.what as TreeId, Math.max(lv.get(b.what as TreeId)!, b.level));
  }
  return { lv, pr };
}

/** Whether a step's every requirement stands in `sim`. */
function open(sim: Sim, what: PlanWhat, level: number): boolean {
  if (isP(what)) return level <= (sim.lv.get('hall') ?? 1);
  return treeNeeds(what, level).every(([d, m]) => (sim.lv.get(d) ?? 0) >= m);
}

/** What the planner would reach: the whole tree (the guns off the Crown's coast) and every producer the land bears. */
function targets(st: PlanState): PlanWhat[] {
  const tree = TREE_IDS.filter((id) => !(st.safe && TREE_OPTIONAL.includes(id)));
  const prods = PRODUCER_KINDS.filter((k) => BIOME_YIELD[st.biome][PRODUCERS[k].good] > 0).map((k) => `p:${k}` as PlanWhat);
  return [...prods, ...tree];
}

/** What a step is worth now, and the reason it carries. */
function valueOf(st: PlanState, sim: Sim, what: PlanWhat, level: number): { value: number; why: PlanWhy } {
  const hall = sim.lv.get('hall') ?? 1;
  if (isP(what)) {
    const k = what.slice(2) as ProducerKind;
    const rich = BIOME_YIELD[st.biome][PRODUCERS[k].good];
    // a producer pays for everything after it: founding it most of all
    return { value: (level === 1 ? 14 : 7) * PROD_USE[k] * (0.6 + 0.4 * Math.min(1.4, rich)), why: 'prod' };
  }
  const id = what;
  let value = BASE_VALUE[id];
  let why: PlanWhy = 'town';
  if (id === 'hall') {
    value = 30 + (level === 2 ? 8 : 0); // hall 2: the island's level 3 and the second builders' crew
    why = level === 2 ? 'crew' : 'hall';
    // a hall far above her band waits behind the cheap levels within reach
    if (st.playerLevel + BAND_SLACK < HALL_BAND[level]) value *= 0.25;
    return { value, why };
  }
  const nextHall = Math.min(TREE_MAX, hall + 1);
  const gate = hall < TREE_MAX ? treeClosure('hall', nextHall) : new Map<TreeId, number>();
  if ((gate.get(id) ?? 0) >= level) {
    value += 6;
    why = 'gate';
  }
  if (id === 'warehouse') {
    // the next hall's goods against the yard's room: storage before the big halls
    const need = Math.max(...Object.values(treeCost('hall', nextHall).goods).map((n) => n ?? 0), 0);
    const room = yardCap(ISLE_OF_HALL[hall], sim.lv.get('warehouse') ?? 0);
    if (need > room * 0.7) {
      value += 8;
      why = 'store';
    }
  }
  if (PATH_TIERS[st.path].includes(id)) {
    value += 3;
    if (why === 'town') why = 'path';
  } else if (/^dw\d$/.test(id) && why === 'town') why = 'army';
  if (PATH_TOWN[st.path] === id) {
    value += 2;
    if (why === 'town') why = 'path';
  }
  if (id === 'battery' || id === 'fort') {
    why = 'guns';
    if (st.path === 'corsair') value += 1;
  }
  // a level above the first is worth a little less than founding (the first opens the kind, the rest add to it)
  if (level > 1) value *= 0.85;
  return { value, why };
}

/** The whole order from the island as it stands to every building at level 5 (the work under way left out). */
export function isleOrder(st: PlanState, limit = 400): PlanStep[] {
  const sim = simOf(st);
  const all = targets(st);
  const steps: PlanStep[] = [];
  const cur = (w: PlanWhat) => (isP(w) ? sim.pr.get(w.slice(2) as ProducerKind) ?? 0 : sim.lv.get(w) ?? 0);
  for (let guard = 0; guard < limit; guard++) {
    let best: PlanStep | null = null;
    let bestScore = -1;
    for (const w of all) {
      const L = cur(w) + 1;
      if (L > TREE_MAX || !open(sim, w, L)) continue;
      const c = stepCost(w, L);
      const { value, why } = valueOf(st, sim, w, L);
      const score = value / Math.sqrt(stepWeight(c));
      // ties broken by the list's order (producers, then the tree's own order): deterministic
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = { what: w, level: L, silver: c.silver, goods: c.goods, secs: c.secs, value: Math.round(value * 10) / 10, why };
      }
    }
    if (!best) break;
    steps.push(best);
    if (isP(best.what)) sim.pr.set(best.what.slice(2) as ProducerKind, best.level);
    else sim.lv.set(best.what, best.level);
  }
  return steps;
}

/** The canonical order of a fresh island (hall 1, nothing else) for a path on ordinary land — docs/29 §8. */
export function canonicalOrder(path: CaptainId = 'corsair', playerLevel = 60, biome: IslandBiome = 'temperate'): PlanStep[] {
  return isleOrder({ levels: { hall: 1 }, producers: {}, biome, safe: false, playerLevel, path });
}
