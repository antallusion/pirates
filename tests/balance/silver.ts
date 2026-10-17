// The hour of a captain's play in silver (docs/31 §9; owner, 2026-10-17: «золота очень много за все дается, слишком
// легко фармить, надо урезать»). What an hour of each way of playing brings in and what it costs, by the level band, and
// the mixed captain's net — before the cut (LEGACY: the flat purses, ransoms and bounties, the jobs' pay × (1 + L/10),
// the prize court's quarter, the trophy's 40%, the old lairs, stacks and drifts) and after (CURRENT: the live
// reckonings, shared/src/data/silverpay.ts and the sources' own).
//
// A model, not the world: the seconds of each loop are the XP model's (tests/balance/xp.ts PACE: a fight, a boarding,
// a quest's legs), the stacks' hour is the battle sim's (tests/balance/roamers.ts), every other figure the expected
// value of the game's own formula. Its sinks are the running costs of her ship of the band: wages, provisions, the
// repairs and the shot of her fights, the men a boarding costs (the stacks' refill per fight, measured).
//
//   node tools/balance-silver.ts          the table, before and after
//   tests/balance/silver.test.ts          holds the targets

import { CAPTAIN_LEVEL_FOR_SHIP, hullsFor, refitCost } from '../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { PLOTS } from '../../shared/src/data/questgen.ts';
import { DAILY_COUNT, DAILY_DEFS, DAILY_KINDS, chestReward, dailyReward } from '../../shared/src/data/dailies.ts';
import { giftUnit } from '../../shared/src/data/dailygift.ts';
import { LAIR_HOURS } from '../../shared/src/data/lairs.ts';
import { DRIFTS, driftFightPay, driftWorth } from '../../shared/src/data/drifts.ts';
import type { DriftKind } from '../../shared/src/data/drifts.ts';
import { ROAM_SILVER } from '../../shared/src/data/roamers.ts';
import { BOUNTY_SHARE, LANDING_SILVER, PRIZE_COURT, PURSE_SHARE, RANSOM_CARGO, RANSOM_SHARE, WRECK_SHARE, jobSilver } from '../../shared/src/data/silverpay.ts';
import { hourSilver, shipBandOf } from '../../shared/src/data/xpcurve.ts';
import { HAUL, HAUL_THIN } from '../../shared/src/data/seahaul.ts';
import { MIX, PACE, boardFor, cycleBoard, cycleSink, pirateTier, stepCost, streakAvg, CURRENT as XP_NOW } from './xp.ts';
import { xpHour as stackHour } from './roamers.ts';

// ------------------------------------------------------------------------------------------------ the bands

/** The level bands of the report and the captain who stands for each (its middle) and her ⚓. */
export const SILVER_BANDS: [number, number][] = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60]];
export const bandLevel = (b: [number, number]): number => Math.round((b[0] + b[1]) / 2);

/** The crew's share of a purse, a ransom, a prize sold (the Codex's default, crew.ts). */
const CREW_SHARE = 0.25;
/** The goods of a pirate's hold (npc.ts): the mean of their base prices, sold at the black market's 85%. */
const LOOT_GOODS: GoodId[] = ['rum', 'gunpowder', 'weapons', 'tobacco', 'spices'];
const lootPrice = (): number => (LOOT_GOODS.reduce((a, g) => a + GOODS[g].basePrice, 0) / LOOT_GOODS.length) * 0.85;
/** A pirate's hold at ⚓v: one good, 2 … 3 + 2 a tier units (3 … 8 + 4 a tier before docs/31 §9). */
const holdValue = (v: number, R?: SilverRules): number => (R?.name === 'before' ? (3 + 8 + 4 * pirateTier(v)) / 2 : (2 + 3 + 2 * pirateTier(v)) / 2) * lootPrice();
/** The mean class price of the sea's pirates at ⚓v (the prize). */
const prizePrice = (v: number): number => {
  const hs = hullsFor('pirate', v);
  return hs.reduce((a, c) => a + SHIP_CLASSES[c].price, 0) / hs.length;
};
/** A prize's hull when she is taken (the boarding's broadsides first). */
const PRIZE_HULL = 0.6;

// ------------------------------------------------------------------------------------------------ the rules

export interface SilverRules {
  name: string;
  /** A ship of the sea at ⚓v: the mean purse of a pirate, the gold in her wreck, the ransom, the prize court's pay. */
  purse(v: number): number;
  wreck(v: number): number;
  ransom(v: number): number;
  prize(v: number): number;
  /** A port's bounty for one pirate ship (beside the prize). */
  bounty(v: number): number;
  /** A generated job's silver at its level. */
  job(pay: number, qL: number): number;
  /** The net of a lair beaten (its pay less the men it cost), in hours at sea. */
  lairHours: number;
  /** A drift saved / beaten. */
  drift(v: number): number;
  /** The stacks' purses, ROAM_SILVER. */
  roam: number[];
  /** The share of a landing's silver paid. */
  landing: number;
}

/** A drift that is no legend (its pay is every plain drift's). */
const PLAIN_DRIFT = (Object.keys(DRIFTS) as DriftKind[]).find((k) => !DRIFTS[k].legend)!;

const OLD_ROAM = [0, 0.025, 0.019, 0.026, 0.028, 0.03, 0.028, 0.028, 0.022, 0.024, 0.027];

export const LEGACY_SILVER: SilverRules = {
  name: 'before',
  purse: (v) => 100 + 200 * pirateTier(v),
  wreck: (v) => Math.max(0.3 * (100 + 200 * pirateTier(v)), 25 * pirateTier(v) + 9.5),
  ransom: (v) => 150 + 0.08 * holdValue(v, { name: 'before' } as SilverRules) + 120 * pirateTier(v),
  prize: (v) => prizePrice(v) * 0.25 * PRIZE_HULL,
  bounty: () => (320 * 2 + 75) / 2,
  job: (pay, qL) => pay * (1 + qL / 10),
  lairHours: 0.25,
  drift: (v) => hourSilver(v) * (0.12 + 0.1) / 2,
  roam: OLD_ROAM,
  landing: 1,
};

export const CURRENT_SILVER: SilverRules = {
  name: 'after',
  purse: (v) => hourSilver(v) * PURSE_SHARE.pirate,
  wreck: (v) => Math.max(0.3 * hourSilver(v) * PURSE_SHARE.pirate, WRECK_SHARE * hourSilver(v) + 9.5),
  ransom: (v) => hourSilver(v) * RANSOM_SHARE + holdValue(v) * RANSOM_CARGO,
  prize: (v) => prizePrice(v) * PRIZE_COURT * PRIZE_HULL,
  bounty: (v) => hourSilver(v) * BOUNTY_SHARE * (2 + 0.2) / 2,
  job: (pay, qL) => jobSilver(pay, shipBandOf(qL)),
  lairHours: LAIR_HOURS.avg,
  drift: (v) => (driftWorth(PLAIN_DRIFT, v).silver + driftFightPay(PLAIN_DRIFT, v).silver) / 2,
  roam: ROAM_SILVER,
  landing: LANDING_SILVER,
};

// ------------------------------------------------------------------------------------------------ the loops

export interface SilverHour {
  /** Silver (and goods at their sale) an hour, and what the hour costs her. */
  income: number;
  costs: number;
}

/** Her ship of the band: the crew she pays and feeds, her hull's tier, her hull's hit points. */
function herShip(v: number): { crew: number; tier: number; hull: number; guns: number } {
  const hs = hullsFor('pirate', v);
  const avg = (f: (c: (typeof SHIP_CLASSES)[keyof typeof SHIP_CLASSES]) => number) => hs.reduce((a, c) => a + f(SHIP_CLASSES[c]), 0) / hs.length;
  return { crew: avg((c) => c.crewMax), tier: avg((c) => c.tier), hull: avg((c) => c.hull), guns: avg((c) => c.gunPortsPerSide) };
}

/** What sailing an hour costs her whatever she does: wages (a mean of 1.4 a man, three officers) and provisions. */
export function upkeepHour(v: number, L: number): number {
  const s = herShip(v);
  const wages = s.crew * 1.4 + 3 * (20 + L);
  const food = Math.pow(s.crew / 40, 0.85) * 0.5 * 60 * GOODS.provisions.basePrice;
  return wages + food;
}

/** The salvage of a wreck (wrightfx.ts wreckSalvage: planks, sailcloth, iron, powder by the hull's tier), sold in bulk
 *  (three dozen wrecks an hour into one market: at half their base price). */
const salvage = (v: number): number => {
  const t = pirateTier(v);
  return (2 * t * GOODS.planks.basePrice + t * GOODS.sailcloth.basePrice + t * GOODS.iron.basePrice + Math.max(1, Math.floor(t / 2)) * GOODS.gunpowder.basePrice) * 0.5;
};

/** A fight's running cost: an eighth of her hull mended at the yard's rate after a duel of broadsides (a twelfth after a
 *  boarding: her guns open it, the men end it), her shot (fewer for a boarding). */
function fightCost(v: number, boarding: boolean): number {
  const s = herShip(v);
  const mend = s.hull * (boarding ? 0.08 : 0.12) * (0.45 + 0.1 * s.tier) * Math.min(1, 0.5 + 0.1 * v);
  const shot = s.guns * (boarding ? 1.5 : 4) * 2.2; // four broadsides of a side in a duel, one or two before the grapples
  return mend + shot;
}

/** The men a won boarding costs, as the stacks' battles measure it (their refill a fight), a share of the hour. */
const lossCache = new Map<number, number>();
function boardLoss(v: number): number {
  let x = lossCache.get(v);
  if (x === undefined) {
    const h = stackHour(v);
    lossCache.set(v, (x = (h.refill / Math.max(1, h.fights)) * hourSilver(v)));
  }
  return x;
}
const stackCache = new Map<number, ReturnType<typeof stackHour>>();
const stacksOf = (v: number) => {
  let h = stackCache.get(v);
  if (!h) stackCache.set(v, (h = stackHour(v)));
  return h;
};

export function huntSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L), n = 3600 / cycleSink(v);
  const per = R.wreck(v) + 0.25 * holdValue(v, R) + salvage(v) + PACE.bountyShare * R.bounty(v);
  return { income: n * per, costs: n * fightCost(v, false) + upkeepHour(v, L) };
}

export function boardSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L), n = 3600 / cycleBoard(v);
  const keep = 1 - CREW_SHARE, st = streakAvg();
  // Her purse and the hold always; then half the prizes ransomed on the spot, half sailed to the court.
  const per = R.purse(v) * keep * st + holdValue(v, R) + 0.5 * R.ransom(v) * keep * st + 0.5 * R.prize(v) * keep + PACE.bountyShare * R.bounty(v);
  return { income: n * per, costs: n * (fightCost(v, true) + boardLoss(v)) + upkeepHour(v, L) };
}

export function questSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L);
  const board = boardFor(XP_NOW, L);
  if (!board.length) return { income: 0, costs: upkeepHour(v, L) };
  let sec = 0, pay = 0, sinks = 0, boards = 0;
  for (const { plot, qL } of board) {
    let s = 0, legs = 0;
    for (const k of plot.steps) {
      const c = stepCost(k, v);
      s += c.sec;
      legs += c.leg;
      sinks += c.sink;
      boards += c.board;
    }
    sec += s + (legs * PACE.leg(v)) / PACE.bundle + 20;
    pay += R.job(plot.pay, qL);
  }
  const k = 3600 / sec;
  const fights = sinks * (R.wreck(v) + 0.25 * holdValue(v, R) + salvage(v)) + boards * (R.purse(v) * (1 - CREW_SHARE) + holdValue(v, R) + 0.5 * R.ransom(v) * (1 - CREW_SHARE));
  return { income: k * (pay + fights), costs: k * (sinks * fightCost(v, false) + boards * (fightCost(v, true) + boardLoss(v))) + upkeepHour(v, L) };
}

/** The roaming stacks back to back (their purses by R.roam; the spoils and the men lost as the sim measures). */
export function stackSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L), h = stacksOf(v), sea = hourSilver(v);
  const purse = h.purse * (R.roam[v] / ROAM_SILVER[v]);
  return { income: (h.silver - h.purse + purse) * sea, costs: h.refill * sea + upkeepHour(v, L) };
}

/** The lairs of her waters one after another (each once a week): a fight and the sail to the next, ten minutes; the
 *  first 1.2 an hour at full value, the rest at the haul's half (seahaul.ts). Its net over the men is lairHours. */
export function lairSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L), n = 6;
  const full = Math.min(n, HAUL.lairs), thin = n - full;
  return { income: (full + thin * HAUL_THIN) * R.lairHours * hourSilver(v), costs: upkeepHour(v, L) };
}

/** Exploring: islands charted and landed at, the sea's finds and marks within the haul,
 *  four drifts an hour. (A landing's silver is flat, 20–450 by the feature and often none: ~80 a feature.) */
export function exploreSilver(R: SilverRules, L: number): SilverHour {
  const v = shipBandOf(L), sea = hourSilver(v);
  const islands = (3600 / PACE.island) * 1.5 * 80 * R.landing;
  const finds = HAUL.finds * 0.05 * sea + HAUL.marks * 0.035 * sea;
  return { income: islands + finds + 4 * R.drift(v), costs: upkeepHour(v, L) };
}

/** The day's orders, their chest (a streak of three) and the login gift, spread over two hours of play a day. */
export function dailySilver(L: number): number {
  const kinds = DAILY_KINDS.filter((k) => DAILY_DEFS[k].minLevel <= L);
  const order = kinds.reduce((a, k) => a + dailyReward(k, L).silver, 0) / kinds.length;
  const gift = (12 * giftUnit(L) * 1.375) / 7;
  return (order * DAILY_COUNT + chestReward(L, 3).silver + gift) / 2;
}

export type SilverStyle = 'hunt' | 'board' | 'quests' | 'stacks' | 'lairs' | 'explore';
export const SILVER_STYLES: SilverStyle[] = ['hunt', 'board', 'quests', 'stacks', 'lairs', 'explore'];

export function styleSilver(R: SilverRules, style: SilverStyle, L: number): SilverHour {
  switch (style) {
    case 'hunt': return huntSilver(R, L);
    case 'board': return boardSilver(R, L);
    case 'quests': return questSilver(R, L);
    case 'stacks': return stackSilver(R, L);
    case 'lairs': return lairSilver(R, L);
    default: return exploreSilver(R, L);
  }
}

/** The mixed captain (the XP model's shares; the stacks' tenth half lairs), the day's silver on top: income, costs and
 *  the net, in silver and in hours at sea of her waters. */
export function mixedSilver(R: SilverRules, L: number): { income: number; costs: number; net: number; hours: number } {
  const parts: [number, SilverHour][] = [
    [MIX.quests, questSilver(R, L)], [MIX.hunt, huntSilver(R, L)], [MIX.board, boardSilver(R, L)],
    [MIX.stacks / 2, stackSilver(R, L)], [MIX.stacks / 2, lairSilver(R, L)], [MIX.explore, exploreSilver(R, L)],
  ];
  let income = dailySilver(L), costs = 0;
  for (const [w, h] of parts) {
    income += w * h.income;
    costs += w * h.costs;
  }
  const net = income - costs;
  return { income, costs, net, hours: net / hourSilver(shipBandOf(L)) };
}

/** Hours of mixed play for a purchase of `silver` at level L (its net an hour). */
export const hoursFor = (R: SilverRules, L: number, silver: number): number => silver / Math.max(1, mixedSilver(R, L).net);

/** The big purchase of a band: the refit to the next ⚓ (shiplevel.ts refitCost; none past ⚓10). */
export const nextRefit = (L: number): number => refitCost(Math.min(10, shipBandOf(L) + 1))?.silver ?? 0;
export { CAPTAIN_LEVEL_FOR_SHIP };
void PLOTS;
