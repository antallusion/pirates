// Pulling a building of one's own island down (owner, 2026-10-28: «дай возможность сноса здания (удаления) на
// острове»). Every building she may raise may be razed — the town's (the hall and the Grail apart), a producer on its
// plot, a building of the base — from anywhere, as she builds. The rule:
//  - half of the silver and the resources of every level that stands comes back (silver to the island's treasury, the
//    resources to its yard); work under way on it is cancelled and its cost comes back whole (nothing of it stood);
//  - blocked (never cascaded) while anything standing — or being raised — asks it: the tree's chain (isletree.ts
//    treeNeeds, the hall's rings among them), a building's `needs`; the answer names them;
//  - the town hall carries the island and is never pulled down; the Grail neither (it was dug up, not built);
//  - a dwelling's men waiting in it are gone with it, and its tier no longer opens for hire on the island nor in the
//    ports (dwell.ts reads the town's levels live); the men already aboard stay;
//  - the plot is free at once for anything else; residents working there go idle.

import { PRODUCERS, baseCost, producerOf } from '../../../shared/src/data/base.ts';
import { BUILDINGS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { TREE_BASE, TREE_TOWN, isTree, treeNeeds } from '../../../shared/src/data/isletree.ts';
import type { TreeId } from '../../../shared/src/data/isletree.ts';
import { TOWN, TOWN_IDS, townCost, townOf } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { RazeView } from '../../../shared/src/h3proto.ts';
import { mine as ownBase } from './base.ts';
import type { BaseJob, Yard } from './base.ts';
import type { Game } from './Game.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import { townLevel, townName, townState } from './town.ts';

/** The share of what the standing levels cost that comes back. */
export const RAZE_BACK = 0.5;

export type RazeTarget = { town: TownId } | { plot: number };

type Cost = { silver: number; goods: Partial<Record<GoodId, number>> };

function add(to: Cost, c: Cost, k: number): void {
  to.silver += c.silver * k;
  for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) to.goods[g] = (to.goods[g] ?? 0) + n * k;
}

function floorCost(c: Cost): Cost {
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) if (Math.floor(n) > 0) goods[g] = Math.floor(n);
  return { silver: Math.floor(c.silver), goods };
}

/** What is razed: its name for the server's words, what it is, its standing level, the work on it. */
interface Found {
  what: string;
  level: number;
  jobs: BaseJob[];
  kind: 'town' | 'producer' | 'building';
  cost: (level: number) => Cost;
}

function find(h: Holding, y: Yard, t: RazeTarget): Found | string {
  if ('town' in t) {
    const id = t.town;
    if (!TOWN_IDS.includes(id)) return 'Unknown building';
    const jobs = y.jobs.filter((j) => j.what === `t:${id}`);
    const level = townLevel(y, id);
    if (level <= 0 && !jobs.length) return 'Nothing stands there.';
    return { what: id, level, jobs, kind: 'town', cost: (l) => townCost(id, l) };
  }
  const plot = Math.trunc(t.plot);
  const b = h.buildings.find((x) => x.plot === plot);
  const p = y.producers.find((x) => x.plot === plot);
  const jobs = y.jobs.filter((j) => j.plot === plot && !j.ship);
  const what = b ? b.id : p ? `p:${p.kind}` : jobs.find((j) => j.level <= 1)?.what;
  if (!what) return 'Nothing stands there.';
  const level = b ? Math.max(1, b.level ?? 1) : p ? p.level : 0;
  return { what, level, jobs, kind: producerOf(what) ? 'producer' : 'building', cost: (l) => baseCost(what, l) };
}

/** The tree's levels with one thing gone (a battery's: the greatest of the others). */
function levelsWithout(h: Holding, y: Yard, f: Found, plot: number | null): Map<TreeId, number> {
  const out = new Map<TreeId, number>();
  for (const id of TREE_TOWN) out.set(id, f.kind === 'town' && f.what === id ? 0 : townLevel(y, id as TownId));
  for (const id of TREE_BASE) out.set(id, Math.max(0, ...h.buildings.filter((b) => b.id === id && b.plot !== plot).map((b) => Math.max(1, b.level ?? 1))));
  return out;
}

/** What stands (or is being raised) that asks this thing — each with the level that asks it. */
export function razeBlockers(h: Holding, y: Yard, f: Found, plot: number | null): { id: string; level: number }[] {
  const out = new Map<string, number>();
  const note = (id: string, level: number) => out.set(id, Math.max(out.get(id) ?? 0, level));
  const own = (id: string) => (f.kind === 'town' ? id === f.what : false);
  if (isTree(f.what) && f.level > 0) {
    const lv = levelsWithout(h, y, f, plot);
    const asks = (k: TreeId, upTo: number) => {
      for (let l = 1; l <= upTo; l++) for (const [d, n] of treeNeeds(k, l)) if ((lv.get(d) ?? 0) < n && d === f.what) return l;
      return 0;
    };
    for (const k of [...TREE_TOWN, ...TREE_BASE]) {
      if (own(k)) continue;
      const L = lv.get(k) ?? 0;
      const l = L > 0 ? asks(k, L) : 0;
      if (l) note(k, L);
    }
    // work under way that would rise on it
    for (const j of y.jobs) {
      const k = (townOf(j.what) ?? j.what) as TreeId;
      if (!isTree(k) || own(k) || (f.kind !== 'town' && j.plot === plot)) continue;
      if (treeNeeds(k, j.level).some(([d, n]) => d === f.what && (lv.get(d) ?? 0) < n)) note(k, j.level);
    }
  }
  // a building of the base another stands on (the old `needs`), the last of its kind
  if (f.kind === 'building' && f.level > 0) {
    const id = f.what as BuildingId;
    const others = h.buildings.filter((b) => b.id === id && b.plot !== plot).length;
    if (!others) {
      for (const b of h.buildings) if (BUILDINGS[b.id]?.needs === id) note(b.id, Math.max(1, b.level ?? 1));
      for (const j of y.jobs) if (j.plot !== plot && BUILDINGS[j.what as BuildingId]?.needs === id) note(j.what, j.level);
    }
  }
  return [...out].map(([id, level]) => ({ id, level }));
}

/** Why it may not be pulled down (null: it may), the blockers for the card. */
function why(h: Holding, y: Yard, f: Found, plot: number | null): { why: string | null; need: { id: string; level: number }[] } {
  if (f.kind === 'town' && f.what === 'hall') return { why: 'The town hall carries the island: it cannot be pulled down.', need: [] };
  if (f.kind === 'town' && f.what === 'grail') return { why: 'The Grail stays with the town for good.', need: [] };
  if (f.what === 'shipyard' && f.level > 0 && y.jobs.some((j) => j.ship)) return { why: 'The shipwrights are at work on your ship: wait for them.', need: [] };
  const need = razeBlockers(h, y, f, plot);
  if (need.length) return { why: `Other buildings stand on it: ${need.map((n) => `${nameOf(n.id, n.level)} ${n.level}`).join(', ')}.`, need };
  return { why: null, need: [] };
}

function nameOf(id: string, level: number): string {
  if ((TOWN_IDS as string[]).includes(id)) return townName(id as TownId, Math.max(1, level));
  const k = producerOf(id);
  if (k) return PRODUCERS[k].name[0];
  return BUILDINGS[id as BuildingId]?.name ?? id;
}

/** What comes back: half of every standing level, the work under way whole. */
function refundOf(f: Found): Cost {
  const out: Cost = { silver: 0, goods: {} };
  for (let l = 1; l <= f.level; l++) add(out, f.cost(l), RAZE_BACK);
  for (const j of f.jobs) add(out, f.cost(j.level), 1);
  return floorCost(out);
}

/** The card's line: what comes back, what is lost, why not. */
export function razeView(h: Holding, y: Yard, t: RazeTarget): RazeView | null {
  const f = find(h, y, t);
  if (typeof f === 'string') return null;
  const plot = 'plot' in t ? Math.trunc(t.plot) : null;
  const w = why(h, y, f, plot);
  const back = refundOf(f);
  const tier = f.kind === 'town' ? TOWN[f.what as TownId].tier ?? 0 : 0;
  return { silver: back.silver, goods: back.goods, why: w.why, need: w.need, cancel: f.jobs.length > 0, ...(tier ? { tier } : {}) };
}

/** Pull it down (null: done). */
export function raze(game: Game, s: PlayerSession, t: RazeTarget): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y, isl } = m;
  const f = find(h, y, t);
  if (typeof f === 'string') return f;
  const plot = 'plot' in t ? Math.trunc(t.plot) : null;
  const w = why(h, y, f, plot);
  if (w.why) return w.why;
  const back = refundOf(f);
  const name = nameOf(f.what, f.level);
  // the work under way: cancelled, the builders freed
  const ids = new Set(f.jobs.map((j) => j.id));
  y.jobs = y.jobs.filter((j) => !ids.has(j.id));
  if (f.kind === 'town') {
    const ts = townState(y);
    delete ts.b[f.what as TownId];
    const tier = TOWN[f.what as TownId].tier;
    if (tier) ts.pool[tier] = 0; // the men waiting in it go with it
  } else if (f.kind === 'producer') {
    y.producers = y.producers.filter((p) => p.plot !== plot);
  } else {
    const i = h.buildings.findIndex((b) => b.plot === plot);
    if (i >= 0) {
      const id = h.buildings[i].id;
      h.buildings.splice(i, 1);
      if (!h.buildings.some((b) => b.id === id)) for (const r of h.residents ?? []) if (r.at && 'b' in r.at && r.at.b === id) r.at = null;
    }
  }
  h.treasury = (h.treasury ?? 0) + back.silver;
  for (const [g, n] of Object.entries(back.goods) as [GoodId, number][]) y.res[g] = (y.res[g] ?? 0) + n;
  game.db.ledger(s.accountId, 'isle_raze', 0, `${h.island}:${f.what}:${f.level}:${back.silver}`);
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${name} on ${isl.name} is pulled down: ${back.silver} silver to the treasury, the rest to the yard.`, kind: 'info' });
  return null;
}
