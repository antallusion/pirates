// The Heroes' economy against the sea's income (docs/17 H3): what the dwellings' men are worth a week and a real day,
// held against the hour at sea (seaHour of island.ts) and the ships' hammocks; and a captain's month with her island's
// castle, refilling a frigate's losses from her dwellings with half her income — how strong her army grows against the
// ladder's own army of her level (canon D12), and what it costs her.
//
// The full report: node tools/balance-recruit.ts

import { UNITS, armyFit, armyForLevel, armyMen, armyPower, armyTidy } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { DAY_LENGTH_SEC } from '../../shared/src/constants.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import { GROWTH, KEEP_GROWTH, PICKED_TIER, POOL_WEEKS, PORT_GROWTH, TIER_SHIP_LEVEL, TIER_UNIT, UNIT_GOODS, pickedShare, portDwellings } from '../../shared/src/data/town.ts';
import type { Port } from '../../shared/src/world/worldgen.ts';
import { WEEK_DAYS } from '../../shared/src/data/week.ts';
import { seaHour } from './island.ts';
import { Rng } from '../../shared/src/rng.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';

/** Real hours a week of the sea's calendar lasts. */
export const WEEK_HOURS = (WEEK_DAYS * DAY_LENGTH_SEC) / 3600;
export const WEEKS_A_DAY = 24 / WEEK_HOURS;

/** Silver a man is worth with his resources at their base price. */
export function manWorth(u: UnitId): number {
  let w = UNITS[u].cost;
  for (const [g, n] of Object.entries(UNIT_GOODS[u] ?? {})) w += GOODS[g as keyof typeof GOODS].basePrice * (n ?? 0);
  return w;
}

/** A week of an island's dwellings: the men and their worth (tiers 1..`top`, the keep at a level, upgraded or not). */
export function isleWeek(keep: number, top = 7, up = false): { men: number; worth: number; high: number } {
  let men = 0, worth = 0, high = 0;
  for (let t = 1; t <= top; t++) {
    const n = GROWTH[t] * KEEP_GROWTH[keep];
    const u = up ? UNITS[TIER_UNIT[t]].upgrade! : TIER_UNIT[t];
    men += n;
    worth += n * manWorth(u);
    if (t >= 4) high += n;
  }
  return { men, worth, high };
}

/** A port's week (its tavern apart: its waterfront is the old hiring's). */
export function portWeek(port: Pick<Port, 'size' | 'faction' | 'region' | 'shipyardTier' | 'blackMarket' | 'key' | 'raft'>): { men: number; worth: number } {
  let men = 0, worth = 0;
  for (const d of portDwellings(port)) {
    if (d.tier === 1) continue;
    const n = GROWTH[d.tier] * PORT_GROWTH[port.size];
    men += n;
    worth += n * manWorth(TIER_UNIT[d.tier]) * 1.25;
  }
  return { men, worth };
}

export interface MonthPlan {
  /** The ship's level and its hammocks. */
  level: number;
  crewMax: number;
  /** The keep's level on the island, and how many of the seven dwellings stand (the drowned apart for the living). */
  keep: number;
  top: number;
  /** A day's share of her men lost in fights. */
  loss: number;
  /** Hours at sea a day, and the share of their income she spends on men. */
  hours: number;
  share: number;
  /** Weeks of growth she finds waiting each day (two: she looks in once a day and the pools keep two weeks). */
  weeksFound: number;
  days: number;
}

export const MONTH: MonthPlan = { level: 7, crewMax: 220, keep: 3, top: 6, loss: 0.25, hours: 3, share: 0.5, weeksFound: POOL_WEEKS, days: 30 };

export interface MonthResult {
  /** Her army's might against the ladder's own army of her level and hammocks, each day. */
  ratio: number[];
  spent: number;
  earned: number;
  army: ArmyStack[];
  /** Men of tier 4 and up aboard at the end, as a share. */
  highShare: number;
}

/** A captain's month: each day she loses a share of her men, finds her dwellings' men waiting, and signs on the best
 *  she can afford with her share of the day's income (the stronger tiers first) until the hammocks are full; what
 *  the island cannot give she fills with the tavern's deckhands at their worth. */
export function month(plan: MonthPlan): MonthResult {
  const ladder = armyForLevel(plan.level, plan.crewMax, 7, 'player');
  const might = (a: readonly ArmyStack[]) => armyPower(a);
  const base = might(ladder);
  let army: ArmyStack[] = ladder.map((x) => ({ ...x }));
  const ratio: number[] = [];
  let spent = 0, earned = 0;
  for (let d = 0; d < plan.days; d++) {
    // The day's fights: every stack loses its share.
    army = armyTidy(army.map((x) => ({ u: x.u, n: Math.floor(x.n * (1 - plan.loss)) })));
    const income = plan.hours * seaHour(plan.level);
    earned += income;
    let room = plan.crewMax - armyMen(army);
    // The empty hammocks are filled first (deckhands at their worth); what is left of her share buys better men in
    // their place, the stronger first.
    let purse = income * plan.share - room * UNITS.deckhand.cost;
    let picked = Math.floor(plan.crewMax * pickedShare(plan.level)) - army.filter((x) => UNITS[x.u].tier >= PICKED_TIER).reduce((a, x) => a + x.n, 0);
    for (let t = plan.top; t >= 1 && room > 0; t--) {
      if (plan.level < TIER_SHIP_LEVEL[t]) continue;
      const u = UNITS[TIER_UNIT[t]].upgrade!;
      const have = Math.floor(GROWTH[t] * KEEP_GROWTH[plan.keep] * plan.weeksFound);
      const n = Math.min(have, room, Math.floor(Math.max(0, purse) / (manWorth(u) - UNITS.deckhand.cost)), t >= PICKED_TIER ? Math.max(0, picked) : Infinity);
      if (t >= PICKED_TIER) picked -= Math.max(0, n);
      if (n <= 0) continue;
      purse -= n * (manWorth(u) - UNITS.deckhand.cost);
      spent += n * manWorth(u);
      room -= n;
      const s = army.find((x) => x.u === u);
      if (s) s.n += n;
      else army.push({ u, n });
    }
    if (room > 0) {
      const n = Math.min(room, Math.floor(Math.max(0, purse + room * UNITS.deckhand.cost) / UNITS.deckhand.cost));
      spent += n * UNITS.deckhand.cost;
      const s = army.find((x) => x.u === 'deckhand');
      if (s) s.n += n;
      else army.push({ u: 'deckhand', n });
    }
    army = armyTidy(army);
    armyFit(army, 7);
    ratio.push(might(army) / base);
  }
  const high = army.filter((x) => UNITS[x.u].tier >= 4).reduce((a, x) => a + x.n, 0);
  return { ratio, spent, earned, army, highShare: high / Math.max(1, armyMen(army)) };
}

/** The boarding battle fought out (quick battle, both sides the same captain, `dealt` the ladder's weight on each
 *  side's blows): how often the first army wins. */
export function winRate(a: ArmyStack[], b: ArmyStack[], n = 40, dealtA = 1, dealtB = 1): number {
  const side = (army: ArmyStack[], dealt: number): TacSideInput => ({
    name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt, power: 1, melee: 1,
    extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
  });
  let w = 0;
  for (let k = 0; k < n; k++) {
    const rng = new Rng(k * 31 + 7);
    const bt = newBattle(side(a, dealtA), side(b, dealtB), k * 31 + 7, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w / n;
}
