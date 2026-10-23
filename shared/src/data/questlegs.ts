// A quest chain's legs on the sea route (owner, 2026-10-23: «все квесты цепочек надо делать так, что они были максимум
// на удалении 3км друг от друга, никто за 6-10 и тем более 20 км никуда не поплывет»). A chain is followed from its
// giver (a job's port, the campaign's previous step) through every step with a place of its own — a harbour, an
// island's waters, a marked spot, a fight's water, a good's nearest seller before a delivery with none aboard — each
// leg the route from where the last one ended to the nearest edge of the next place. Steps with no place (chart islands
// never seen, a catch, a wanted pirate, a region's crossing) leave her where she was.

import type { World, Island, Port } from '../world/worldgen.ts';
import { navLen } from '../world/navlen.ts';
import { portTrades } from './goods.ts';
import type { GoodId } from './goods.ts';
import type { QuestDef, QuestStep } from './quests.ts';

/** The most a chain's leg may run (the sea route, metres). */
export const CHAIN_LEG = 3000;

/** Where she stands: a point. */
export interface At {
  x: number;
  y: number;
}

/** A leg of a chain. */
export interface ChainLeg {
  quest: string;
  step: number;
  /** What it sails to: a port's id, an island's, a fight's water, a seller. */
  to: string;
  /** The sea route's length (Infinity: over the cap, or no route). */
  d: number;
}

/** A place a step sends her to: a point to come to (r = 0), or a ring she need only enter (an island's waters, a
 *  fight's water). */
interface Place {
  x: number;
  y: number;
  r: number;
  name: string;
}

const portPlace = (p: Port): Place => ({ x: p.x, y: p.y, r: 0, name: p.id });
/** An island's waters: its shore, and a little off it (the step's reach). */
const islePlace = (i: Island): Place => ({ x: i.x, y: i.y, r: i.radius + 40, name: `isle ${i.name}` });

/** The place of a step, if it has one. */
export function stepPlace(world: World, st: QuestStep): Place | null {
  const port = (id: string | undefined) => (id ? world.ports.find((p) => p.id === id) : undefined);
  switch (st.type) {
    case 'visit':
    case 'deliver':
    case 'pickup':
    case 'race':
    case 'landres': {
      const p = port(st.port);
      return p ? portPlace(p) : null;
    }
    case 'sell_contraband':
    case 'buy': {
      const p = port(st.port);
      return p ? portPlace(p) : null;
    }
    case 'isle':
    case 'land':
      return world.islands[st.island] ? islePlace(world.islands[st.island]) : null;
    case 'claim':
      return st.island !== undefined && world.islands[st.island] ? islePlace(world.islands[st.island]) : null;
    case 'lair':
      if (st.near) return { ...st.near, name: 'lair water' };
      return st.island !== undefined && world.islands[st.island] ? islePlace(world.islands[st.island]) : null;
    case 'spot':
      return { x: st.x, y: st.y, r: st.r, name: 'spot' };
    case 'sink':
    case 'board':
    case 'dive':
    case 'beast':
    case 'neutral':
    case 'time_in':
      return st.near ? { ...st.near, name: `${st.type} water` } : null;
    default:
      return null;
  }
}

/** The leg from a point into a place: the route to its nearest edge, and where she comes to. */
export function legTo(world: World, from: At, pl: Place, cap = CHAIN_LEG * 2): { d: number; at: At } {
  const dx = from.x - pl.x, dy = from.y - pl.y, k = Math.hypot(dx, dy);
  if (k <= pl.r) return { d: 0, at: from };
  const edge = pl.r > 0 ? { x: pl.x + (dx / k) * pl.r, y: pl.y + (dy / k) * pl.r } : { x: pl.x, y: pl.y };
  return { d: navLen(world, from.x, from.y, edge.x, edge.y, cap), at: edge };
}

/** The nearest harbour that trades a good (not `not`) to a point, by the route. */
export function nearestSellerByRoute(world: World, from: At, good: GoodId, not?: string, cap = CHAIN_LEG * 2): { port: Port; d: number } | null {
  let best: { port: Port; d: number } | null = null;
  for (const p of world.ports) {
    if (p.raft || p.id === not || !portTrades(p, good)) continue;
    if (Math.hypot(p.x - from.x, p.y - from.y) > Math.min(cap, best?.d ?? Infinity)) continue;
    const d = navLen(world, from.x, from.y, p.x, p.y, cap);
    if (d < (best?.d ?? Infinity)) best = { port: p, d };
  }
  return best;
}

/** A quest's legs from a point (its giver's port, or where the chain before it ended), and where it ends. */
export function questLegs(world: World, q: QuestDef, from: At, cap = CHAIN_LEG * 2): { legs: ChainLeg[]; end: At } {
  const legs: ChainLeg[] = [];
  let at = from;
  const held = new Set<GoodId>();
  q.steps.forEach((st, i) => {
    if (st.type === 'pickup') held.add(st.good);
    // a delivery with nothing taken on for it: bought at the nearest seller first
    if (st.type === 'deliver' && !held.has(st.good)) {
      const s = nearestSellerByRoute(world, at, st.good, undefined, cap);
      legs.push({ quest: q.id, step: i, to: s ? `seller ${s.port.id} (${st.good})` : `no seller (${st.good})`, d: s ? s.d : Infinity });
      if (s) at = { x: s.port.x, y: s.port.y };
    }
    const pl = stepPlace(world, st);
    if (!pl) return;
    const l = legTo(world, at, pl, cap);
    legs.push({ quest: q.id, step: i, to: pl.name, d: l.d });
    at = l.at;
  });
  return { legs, end: at };
}
