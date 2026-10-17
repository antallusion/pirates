// The island's build order as she sees it (docs/29 §8, owner 2026-10-17): the planner's next steps from the island as it
// stands (shared/src/data/isleplan.ts), each with whether it may start now and what stands in the way, and her
// speed-ups. Recomputed with every view of the base, so the plan follows the work as it is done.

import { isleOrder } from '../../../shared/src/data/isleplan.ts';
import type { PlanState, PlanStep } from '../../../shared/src/data/isleplan.ts';
import { PRODUCER_KINDS, TOKEN_SECS } from '../../../shared/src/data/base.ts';
import type { ProducerKind } from '../../../shared/src/data/base.ts';
import { TREE_IDS, isTreeTown, treeNeeds } from '../../../shared/src/data/isletree.ts';
import type { TreeId } from '../../../shared/src/data/isletree.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import type { IslePlanStepView, IslePlanView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import type { Yard } from './base.ts';
import { buildersBusy, crewsOf, freePlot, lyingOff, stock } from './base.ts';
import { townHooks, treeLevels } from './town.ts';
import { shopState } from './shop.ts';

/** How many steps the card shows. */
export const PLAN_SHOW = 3;
/** How far down the order the card looks for a step she may start now. */
export const PLAN_LOOK = 6;

/** The planner's view of her island. */
export function planState(s: PlayerSession, h: Holding, y: Yard, isl: Island): PlanState {
  const lv = treeLevels(h, y);
  const levels: PlanState['levels'] = {};
  for (const id of TREE_IDS) levels[id] = lv.get(id) ?? 0;
  const producers: PlanState['producers'] = {};
  for (const k of PRODUCER_KINDS) producers[k] = Math.max(0, ...y.producers.filter((p) => p.kind === k).map((p) => p.level));
  return {
    levels, producers, busy: y.jobs.filter((j) => !j.ship).map((j) => ({ what: j.what, level: j.level })),
    biome: isl.biome, safe: REGIONS[isl.region].safety === 'safe', playerLevel: s.profile?.level ?? 1, path: s.profile?.captain ?? 'corsair',
  };
}

const jobWhat = (w: string) => (isTreeTown(w) ? `t:${w}` : w);

/** One step as she sees it: may it start, and if not, why. */
function stepView(game: Game, s: PlayerSession, h: Holding, y: Yard, st: PlanStep): IslePlanStepView {
  const p = s.profile!;
  const jobs = y.jobs.filter((j) => !j.ship);
  const soonest = jobs.length ? jobs.reduce((a, j) => (j.end < a.end ? j : a)) : null;
  const what = st.what;
  // the plot: where it stands (a level up), or the free one it would take
  let plot: number | null = null;
  if (what.startsWith('p:')) {
    const k = what.slice(2) as ProducerKind;
    const mine = y.producers.filter((x) => x.kind === k).sort((a, b) => b.level - a.level)[0];
    plot = mine ? mine.plot : freePlot(game, h, y);
  } else if (!isTreeTown(what)) {
    const b = h.buildings.filter((x) => x.id === what).sort((a, c) => (c.level ?? 1) - (a.level ?? 1))[0];
    plot = b ? b.plot ?? null : freePlot(game, h, y);
  }
  const near = lyingOff(game, s, h);
  const lack: { good: GoodId; n: number }[] = [];
  for (const [g, n] of Object.entries(st.goods) as [GoodId, number][]) {
    const have = Math.floor(stock(h, y, s, near, g));
    if (have < n) lack.push({ good: g, n: n - have });
  }
  const silverLack = Math.max(0, st.silver - p.gold);
  let state: IslePlanStepView['state'] = 'ready';
  let job: number | null = null;
  // what the tree asks, standing now (the planner counted the work under way as done)
  const lv = treeLevels(h, y);
  const unmet = what.startsWith('p:')
    ? ((lv.get('hall') ?? 1) < st.level ? [['hall', st.level] as [TreeId, number]] : [])
    : treeNeeds(what as TreeId, st.level).filter(([d, m]) => (lv.get(d) ?? 0) < m);
  const own = jobs.find((j) => j.what === jobWhat(what));
  if (own) {
    state = 'wait';
    job = own.id;
  } else if (unmet.length) {
    state = 'wait';
    const w = jobs.find((j) => unmet.some(([d]) => j.what === jobWhat(d)));
    job = w?.id ?? soonest?.id ?? null;
  } else if (!isTreeTown(what) && plot === null) state = 'plot';
  else if (buildersBusy(y) >= crewsOf(h, game)) {
    state = 'busy';
    job = soonest?.id ?? null;
  } else if (lack.length || silverLack > 0) state = 'lack';
  else if (isTreeTown(what) && townHooks.land && townHooks.landLack) {
    const land = townHooks.land(what as TownId, st.level);
    if (Object.keys(land).length && townHooks.landLack(s, land)) state = 'need';
  }
  return { what, level: st.level, silver: st.silver, goods: st.goods, secs: st.secs, why: st.why, plot, state, lack, silverLack, job };
}

/** The card's plan: the first steps of the order, those she may start now first (affordable before the rest), in the
 *  order's own sequence otherwise. */
export function planView(game: Game, s: PlayerSession, h: Holding, y: Yard, isl: Island): IslePlanView {
  const order = isleOrder(planState(s, h, y, isl));
  const head = order.slice(0, PLAN_LOOK).map((st, i) => ({ i, v: stepView(game, s, h, y, st) }));
  const rank = (st: IslePlanStepView['state']) => (st === 'ready' ? 0 : st === 'lack' || st === 'need' ? 1 : 2);
  head.sort((a, b) => rank(a.v.state) - rank(b.v.state) || a.i - b.i);
  // the order's own first step stays first unless a step she can start now is within the look
  const steps = head.slice(0, PLAN_SHOW).map((x) => x.v);
  const st = s.profile ? shopState(game, s.accountId) : null;
  return { steps, left: order.length, speed: { min: Math.max(0, Math.floor(st?.speed ?? 0)), tokens: s.profile?.speedups ?? 0, tokenSecs: TOKEN_SECS } };
}
