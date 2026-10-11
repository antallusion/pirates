// The island's tech tree in a captain's weeks (owner, 2026-10-11; docs/29_ISLANDS.md): a deterministic simulation on the
// data alone. She claims her island free (the hall at 1), plays a session at sea every evening and looks in on the island
// in the morning; half of what she earns at sea goes to the island. The builders' crews (the island's level by the hall:
// one, a second at the third island level, a third with the island's power) take the next step of the tree whenever
// she looks in — the cheapest step the next hall asks, the hall itself as soon as it may rise — and her producers rise
// with the hall to feed the yard; what the yard lacks she buys in port at a tenth over the base price. The free tokens
// shorten the longest work. The hall's silver comes in every dawn of the sea's calendar.
//
// `node tools/balance-isles.ts` prints the days and silver to each hall level.

import { PRODUCERS, PRODUCER_KINDS, TOKEN_SECS, baseCost, crewsAt, producerFits, producerRate, yardCap } from '../../shared/src/data/base.ts';
import type { BaseRes, ProducerKind } from '../../shared/src/data/base.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { ISLE_OF_HALL, HALL_DAY, TREE_MAX, treeClosure, treeCost, treeNeeds } from '../../shared/src/data/isletree.ts';
import type { TreeId } from '../../shared/src/data/isletree.ts';
import { POWER_CREW } from '../../shared/src/data/baseships.ts';
import { DAY_LENGTH_SEC } from '../../shared/src/constants.ts';
import type { IslandBiome } from '../../shared/src/world/regions.ts';
import { seaHour } from './island.ts';

export interface TreePlan {
  biome: IslandBiome;
  /** Hours at sea each evening; the share of it that goes to the island. */
  hours: number;
  share: number;
  /** Her ship's level on the first day and the days to each level more. */
  shipLevel: number;
  shipEvery: number;
  /** Free tokens a day. */
  tokens: number;
  /** She finishes the work with silver whenever a quarter of the island's purse pays for it. */
  rush: boolean;
  days: number;
}

export const STEADY: TreePlan = { biome: 'temperate', hours: 3, share: 0.5, shipLevel: 4, shipEvery: 5, tokens: 5, rush: false, days: 60 };

export interface TreeResult {
  /** The hour each hall level was reached (index: the level; NaN: not within the days). */
  at: number[];
  /** Silver spent on the tree and the producers (with the goods bought) by the time each hall level stood. */
  silverAt: number[];
  /** Hours of the builders' work each hall level took (the sum of the steps' times since the last). */
  workAt: number[];
  spent: { build: number; goods: number; speedup: number };
  earned: number;
  hallIncome: number;
  levels: Map<TreeId, number>;
  /** The steps in the order she took them (the hour, the building, the level). */
  log: [number, string, number][];
}

const BUY = 1.1;
const RES: BaseRes[] = ['timber', 'coal', 'tar', 'iron', 'provisions'];

export function simulateTree(plan: TreePlan = STEADY): TreeResult {
  const lv = new Map<TreeId, number>([['hall', 1]]);
  const prod = new Map<ProducerKind, number>();
  const res: Record<BaseRes, number> = { timber: 0, coal: 0, tar: 0, iron: 0, provisions: 0 };
  interface Job { end: number; what: string; level: number; secs: number }
  const jobs: Job[] = [];
  let purse = 0, tokens = 0, earned = 0, hallIncome = 0;
  const spent = { build: 0, goods: 0, speedup: 0 };
  const at = new Array(TREE_MAX + 1).fill(NaN);
  const silverAt = new Array(TREE_MAX + 1).fill(0);
  const workAt = new Array(TREE_MAX + 1).fill(0);
  let work = 0;
  at[1] = 0;
  const log: [number, string, number][] = [];
  const hall = () => lv.get('hall') ?? 1;
  const isle = () => ISLE_OF_HALL[hall()];
  const power = () => [...lv.values()].reduce((a, b) => a + b, 0) + [...prod.values()].reduce((a, b) => a + b, 0);
  const crews = () => crewsAt(isle(), power() >= POWER_CREW ? 1 : 0);
  const cap = () => yardCap(isle(), lv.get('warehouse') ?? 0);
  const rate = (g: BaseRes) => [...prod].filter(([k]) => PRODUCERS[k].good === g).reduce((a, [k, l]) => a + producerRate(k, l, plan.biome), 0);
  const own = (g: GoodId) => ((RES as string[]).includes(g) ? res[g as BaseRes] : 0);
  const bought = (c: { goods: Partial<Record<GoodId, number>> }) => (Object.entries(c.goods) as [GoodId, number][]).reduce((a, [g, n]) => a + Math.ceil(Math.max(0, n - own(g)) * GOODS[g].basePrice * BUY), 0);
  const price = (c: { silver: number; goods: Partial<Record<GoodId, number>> }) => c.silver + bought(c);
  const pay = (c: { silver: number; goods: Partial<Record<GoodId, number>> }) => {
    const k = bought(c);
    purse -= c.silver + k;
    spent.build += c.silver;
    spent.goods += k;
    for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) if ((RES as string[]).includes(g)) res[g as BaseRes] = Math.max(0, res[g as BaseRes] - n);
  };
  const working = (what: string) => jobs.some((j) => j.what === what);
  const lvOf = (k: TreeId) => lv.get(k) ?? 0;

  const options = (): { what: string; level: number; cost: ReturnType<typeof treeCost>; tree: boolean }[] => {
    const out: { what: string; level: number; cost: ReturnType<typeof treeCost>; tree: boolean }[] = [];
    // The tree: the next hall's closure, a level at a time, each step whose needs stand.
    const want = treeClosure('hall', Math.min(TREE_MAX, hall() + 1));
    for (const [k, n] of want) {
      const next = lvOf(k) + 1;
      if (next > n || working(k)) continue;
      if (!treeNeeds(k, next).every(([d, m]) => lvOf(d) >= m)) continue;
      out.push({ what: k, level: next, cost: treeCost(k, next), tree: true });
    }
    // The producers: one of each kind the land bears, raised with the hall.
    for (const k of PRODUCER_KINDS) {
      if (!producerFits(k, plan.biome)) continue;
      const what = `p:${k}`;
      const l = prod.get(k) ?? 0;
      if (l >= hall() || working(what)) continue;
      out.push({ what, level: l + 1, cost: baseCost(what, l + 1), tree: false });
    }
    return out;
  };

  const finish = (t: number) => {
    for (const j of jobs.filter((x) => x.end <= t + 1e-9)) {
      jobs.splice(jobs.indexOf(j), 1);
      if (j.what.startsWith('p:')) prod.set(j.what.slice(2) as ProducerKind, j.level);
      else {
        lv.set(j.what as TreeId, j.level);
        if (j.what === 'hall') {
          at[j.level] = j.end;
          silverAt[j.level] = spent.build + spent.goods + spent.speedup;
          workAt[j.level] = work;
          work = 0;
        }
      }
    }
  };

  const look = (t: number) => {
    finish(t);
    for (const j of [...jobs].sort((a, b) => b.end - a.end)) {
      while (tokens > 0 && j.end > t) {
        tokens--;
        j.end = Math.max(t, j.end - TOKEN_SECS / 3600);
      }
      if (plan.rush && j.end > t) {
        const p = Math.max(25, Math.ceil(((j.end - t) * 3600) / 60) * 12);
        if (purse * 0.25 >= p) {
          purse -= p;
          spent.speedup += p;
          j.end = t;
        }
      }
    }
    finish(t);
    for (let guard = 0; guard < 8 && jobs.length < crews(); guard++) {
      const opts = options().filter((o) => purse >= price(o.cost));
      if (!opts.length) break;
      // The hall first when it may rise; a producer when the yard runs short of its good (or is cheap beside the purse);
      // else the cheapest step of the tree.
      const score = (o: (typeof opts)[number]) => {
        if (o.what === 'hall') return -1e12;
        const p = price(o.cost);
        if (!o.tree) return (prod.has(o.what.slice(2) as ProducerKind) ? p : p * 0.2) * 0.6;
        return p;
      };
      opts.sort((a, b) => score(a) - score(b));
      const o = opts[0];
      pay(o.cost);
      jobs.push({ end: t + o.cost.secs / 3600, what: o.what, level: o.level, secs: o.cost.secs });
      work += o.cost.secs / 3600;
      log.push([t, o.what, o.level]);
    }
  };

  const STEP = 0.25;
  let last = 0;
  for (let t = 0; t < plan.days * 24 && hall() < TREE_MAX; t = Math.round((t + STEP) * 100) / 100) {
    const day = Math.floor(t / 24), hour = t - day * 24;
    const dt = t - last;
    last = t;
    for (const g of RES) res[g] = Math.min(cap(), res[g] + rate(g) * dt);
    if (hour === 0) {
      tokens = Math.min(20, tokens + plan.tokens);
      const inc = HALL_DAY[hall()] * (86_400 / DAY_LENGTH_SEC);
      purse += inc;
      hallIncome += inc;
    }
    const session = hour >= 19 && hour < 19 + plan.hours;
    if (session) {
      const l = Math.min(10, plan.shipLevel + Math.floor(day / plan.shipEvery));
      const inc = seaHour(l) * STEP;
      earned += inc;
      purse += inc * plan.share;
    }
    if (session || hour === 8 || hour === 13) look(t);
  }
  return { at, silverAt, workAt, spent, earned, hallIncome, levels: lv, log };
}

export const daysToHall = (r: TreeResult, level: number): number => r.at[level] / 24;
