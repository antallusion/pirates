// The yard's tree of hulls (owner, 2026-10-04: «прокачку кораблей можно сделать как в игре world of tanks. типа
// начинаешь с малого, зарабатываешь у малого опыт и дальше качаешься и качаешься»; docs/20). Every experience the
// captain earns is also earned by the hull she sails; a hull's experience researches the hulls of the next tier of its
// list, and a hull researched is sold at any yard that builds her (for silver, as ever). The first tier of every list
// is known from the start; a twentieth of all a hull earns goes into a free pool that researches anything.
//
// Hulls sold for doubloons are never researched (the premium shop sells them as it did), and they stand in the tree:
// what a captain earns on one researches the next tier of her list like any hull of her tier. Faction yards, the
// yard's own tier and the captain's level still gate the buying; the tree only adds what must be learned first.

import { CAPTAIN_LEVEL_FOR_SHIP, levelRange } from './shiplevel.ts';
import { FLEET_LISTS, SHIP_CLASSES, SHIP_CLASS_IDS } from './ships.ts';
import type { FleetList, ShipClassId } from './ships.ts';

/** The experience a hull of each tier costs to research (tier 1: known from the start). About two fifths of what a
 *  captain earns between the levels that open the tier below and this one, so the tree is a road of its own beside
 *  the captain's levels, not a wall in front of them (tools: tests/research.test.ts). */
export const RESEARCH_COST: Record<number, number> = { 1: 0, 2: 3000, 3: 28000, 4: 100000, 5: 240000 };

/** The share of a hull's experience that also goes into the free pool. */
export const FREE_XP_SHARE = 0.05;

/** Where a list's own silver hulls end, the line goes on in another's: the runners' last (a clipper) leads to the
 *  razee, the traders' last (the East Indiaman) to the great galleon. */
export const CROSS_LINES: Partial<Record<ShipClassId, ShipClassId[]>> = { razee: ['baltimore_clipper'], great_galleon: ['east_indiaman'] };

/** What a captain has researched and the experience she holds: per hull, and free. */
export interface ResearchView {
  xp: Partial<Record<ShipClassId, number>>;
  free: number;
  done: ShipClassId[];
}

/** The hulls of the tree: those of the four lists, not the deep's creatures. */
export function inTree(id: ShipClassId): boolean {
  const c = SHIP_CLASSES[id];
  return !!c && !!c.list && !c.monster;
}

/** A hull that must be researched before a yard sells her: a silver hull of the tree above the first tier. */
export function needsResearch(id: ShipClassId): boolean {
  const c = SHIP_CLASSES[id];
  return inTree(id) && !c.premium && c.purchasable && c.tier >= 2;
}

/** A list's hulls by tier, then by price (the tree's columns). */
export function treeOf(list: FleetList): ShipClassId[] {
  return SHIP_CLASS_IDS.filter((c) => SHIP_CLASSES[c].list === list && !SHIP_CLASSES[c].monster).sort((a, b) => SHIP_CLASSES[a].tier - SHIP_CLASSES[b].tier || SHIP_CLASSES[a].price - SHIP_CLASSES[b].price);
}

/** The hulls whose experience researches this one: her list's hulls of the nearest tier below that has any (a gap in
 *  the tiers is stepped over), and the other lists' hulls that lead to her (CROSS_LINES). */
export function researchParents(id: ShipClassId): ShipClassId[] {
  const c = SHIP_CLASSES[id];
  if (!inTree(id) || c.tier <= 1) return [];
  const list = treeOf(c.list!);
  let below: ShipClassId[] = [];
  for (let t = c.tier - 1; t >= 1 && !below.length; t--) below = list.filter((x) => SHIP_CLASSES[x].tier === t);
  return [...below, ...(CROSS_LINES[id] ?? [])];
}

/** The hulls a captain knows when the tree first reaches her: every first-tier hull, the hulls she owns, and — for a
 *  captain who sailed before the tree — every silver hull her level already let her buy, so nothing she could buy
 *  yesterday is taken from her today. */
export function initialResearch(level: number, owned: ShipClassId[]): ShipClassId[] {
  const out = new Set<ShipClassId>(owned.filter(inTree));
  for (const id of SHIP_CLASS_IDS) {
    if (!inTree(id) || SHIP_CLASSES[id].premium || !SHIP_CLASSES[id].purchasable) continue;
    if (SHIP_CLASSES[id].tier <= 1 || (level > 1 && CAPTAIN_LEVEL_FOR_SHIP[levelRange(id)[0]] <= level)) out.add(id);
  }
  return [...out];
}

/** Is she known (or not to be researched at all)? Owned hulls count as known. */
export function isResearched(r: ResearchView, id: ShipClassId, owned: ShipClassId[] = []): boolean {
  return !needsResearch(id) || r.done.includes(id) || owned.includes(id);
}

/** Whether she can be researched now, and with what: the parents known or owned, their experience and the free pool. */
export function researchQuote(r: ResearchView, id: ShipClassId, owned: ShipClassId[] = []): { cost: number; parents: ShipClassId[]; known: ShipClassId[]; pool: number; ready: boolean } {
  const cost = RESEARCH_COST[SHIP_CLASSES[id]?.tier ?? 1] ?? 0;
  const parents = researchParents(id);
  // A premium parent counts once owned; a silver one once researched (or owned).
  const known = parents.filter((p) => (SHIP_CLASSES[p].premium ? owned.includes(p) : isResearched(r, p, owned)));
  const pool = known.reduce((a, p) => a + Math.floor(r.xp[p] ?? 0), 0) + Math.floor(r.free);
  return { cost, parents, known, pool, ready: needsResearch(id) && !isResearched(r, id, owned) && known.length > 0 && pool >= cost };
}

/** Spends a research's cost: from the known parents, the richest first, then from the free pool. */
export function spendResearch(r: ResearchView, id: ShipClassId, owned: ShipClassId[] = []): boolean {
  const q = researchQuote(r, id, owned);
  if (!q.ready) return false;
  let left = q.cost;
  for (const p of [...q.known].sort((a, b) => (r.xp[b] ?? 0) - (r.xp[a] ?? 0))) {
    const take = Math.min(left, Math.floor(r.xp[p] ?? 0));
    r.xp[p] = (r.xp[p] ?? 0) - take;
    left -= take;
    if (left <= 0) break;
  }
  if (left > 0) r.free = Math.max(0, r.free - left);
  r.done.push(id);
  return true;
}

/** Every list's tree, for the yard's window. */
export const TREE: Record<FleetList, ShipClassId[]> = Object.fromEntries(FLEET_LISTS.map((l) => [l, treeOf(l)])) as Record<FleetList, ShipClassId[]>;
