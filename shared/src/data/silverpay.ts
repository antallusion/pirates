// The silver of the sea's ordinary work, by her waters (owner, 2026-10-17: «золота очень много за все дается, слишком
// легко фармить, надо урезать»; docs/31 §9). Before, a ship's purse, her ransom, a port's bounty and a job's silver were
// written in flat numbers or by the hull's tier: at ⚓1 a boarding paid ~400 silver, a fifth of an hour at sea, and two
// dozen of them an hour came to five hours' silver in one. Now each is a share of the hour at sea of her waters
// (hourSilver, xpcurve.ts: 1 920 at ⚓1 … 20 361 at ⚓10), so the same work pays the same share of the road at every
// level, and the loops that were cheapest to repeat pay least: the boarding's purse and ransom, the prize sold, the
// port's bounties, the jobs of the quest boards, the lairs, the roaming stacks, the drifts.
//
// The model of an hour's play by level band, before and after: tests/balance/silver.ts (node tools/balance-silver.ts).

import { hourSilver } from './xpcurve.ts';

/** The mean purse of an ordinary ship of the sea at ⚓v, a share of an hour at sea of her waters, by her trade (a
 *  merchant carries most, a fisher least). The named, the elite, the ghosts and the happenings keep their own. */
export const PURSE_SHARE = { merchant: 0.02, pirate: 0.015, patrol: 0.012, hunter: 0.012, fisher: 0.005 } as const;
export type PurseRole = keyof typeof PURSE_SHARE;

/** A purse of the sea at ⚓v: the mean by her trade, from half of it to half as much again (`roll` 0..1). */
export function seaPurse(role: PurseRole, v: number, roll: number): number {
  const mean = hourSilver(v) * PURSE_SHARE[role];
  return Math.max(10, Math.round(mean * (0.5 + Math.max(0, Math.min(1, roll)))));
}

/** The least silver a ship of the sea sunk leaves in the water, a share of the hour at sea of her waters (was 25 a hull's
 *  tier; the rest is SINK_PURSE of her purse). */
export const WRECK_SHARE = 0.005;

/** The ransom of a ship of the sea taken at ⚓v: a share of an hour at sea of her waters and a little of her hold
 *  (before: 150 + 120 a hull's tier + 8% of the hold — ~290 at ⚓1, a seventh of the hour). */
export const RANSOM_SHARE = 0.012;
export const RANSOM_CARGO = 0.03;
export function seaRansom(v: number, cargoValue: number): number {
  return Math.round(hourSilver(v) * RANSOM_SHARE + Math.max(0, cargoValue) * RANSOM_CARGO);
}

/** What a prize court pays of a prize's class price by her condition (was a quarter), and a trophy sold out of her
 *  berth the same (was 40% of the price and no crew's share: a frigate taken and sold paid 0.8 of an hour at sea). */
export const PRIZE_COURT = 0.06;

/** A port's bounty for each pirate ship, a share of an hour at sea of the port's waters (was 320 a ship anywhere); an
 *  urgent one (ten minutes) half as much again. */
export const BOUNTY_SHARE = 0.025;
export const URGENT_BOUNTY_SHARE = 0.04;
export function bountyPay(v: number, kills: number, roll: number): number {
  return Math.round(hourSilver(v) * BOUNTY_SHARE * (kills + 0.4 * Math.max(0, Math.min(1, roll))));
}

/** The silver found ashore at a landing (exploration.ts: flat 20–450 by the feature, the same at every level — at the
 *  first levels twenty islands an hour paid an hour at sea) is paid at this share. */
export const LANDING_SILVER = 0.6;

/** A generated job's silver (the quest boards, questgen.ts): its plot's weight (pay / QUEST_PAY_MEAN, the old flat
 *  numbers' proportions kept) of QUEST_SILVER_SHARE of an hour at sea of the job's waters (was pay × (1 + level/10):
 *  at the first levels ten jobs an hour paid three hours at sea; at ⚓10 it is ~0.55 of the old). The campaign (docs/36) is asked to pay the same. */
export const QUEST_SILVER_SHARE = 0.12;
export const QUEST_PAY_MEAN = 550;
export function jobSilver(pay: number, v: number): number {
  return Math.max(20, Math.round((hourSilver(v) * QUEST_SILVER_SHARE * (pay / QUEST_PAY_MEAN)) / 10) * 10);
}
