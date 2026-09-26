// Silver faucets and sinks, money supply and price level, computed from the ledger.
// The report answers "is silver being printed faster than it is destroyed?" and drives one
// automatic stabiliser: the reward multiplier on NPC contracts (the largest tunable faucet).

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { midPrice } from './economy.ts';
import type { Game } from './Game.ts';

export interface Flow {
  kind: string;
  inflow: number;
  outflow: number;
  n: number;
}

export interface EconomyReport {
  windowSec: number;
  supply: { purse: number; bank: number; escrow: number; total: number; captains: number; perCaptain: number };
  faucets: number;
  sinks: number;
  net: number;
  netPerHour: number;
  inflationPerHour: number; // net silver created per hour as a share of the money supply
  sinkRatio: number; // sinks / faucets (1 = balanced)
  priceIndex: number; // mean of mid price / base price over every market and good (1 = base)
  priceTrend: number; // change of the index over the recorded history
  topFaucets: Flow[];
  topSinks: Flow[];
  status: 'inflating' | 'deflating' | 'stable';
  rewardMul: number;
}

export interface IndexPoint {
  t: number; // epoch ms
  supply: number;
  priceIndex: number;
}

const INFLATING = 0.05;
const MAX_HISTORY = 168;

export function priceIndex(game: Game): number {
  let sum = 0;
  let n = 0;
  for (const m of game.markets.values()) {
    for (const id in m.goods) {
      sum += midPrice(id as GoodId, m.goods[id as GoodId]!) / GOODS[id as GoodId].basePrice;
      n++;
    }
  }
  return n ? sum / n : 1;
}

export function moneySupply(game: Game): EconomyReport['supply'] {
  const online = new Map<number, { gold: number; bank: number }>();
  for (const s of game.sessions) if (s.profile) online.set(s.accountId, { gold: s.profile.gold, bank: s.profile.bank });
  let purse = 0, bank = 0, captains = 0;
  for (const row of game.db.silverHoldings()) {
    const live = online.get(row.account_id);
    purse += live ? live.gold : Number(row.gold) || 0;
    bank += live ? live.bank : Number(row.bank) || 0;
    online.delete(row.account_id);
    captains++;
  }
  for (const live of online.values()) {
    purse += live.gold;
    bank += live.bank;
    captains++;
  }
  let escrow = 0;
  for (const o of game.orders) escrow += o.escrow + o.pendingRefund;
  const total = purse + bank + escrow;
  return { purse: Math.round(purse), bank: Math.round(bank), escrow, total: Math.round(total), captains, perCaptain: captains ? Math.round(total / captains) : 0 };
}

export function economyReport(game: Game, windowSec = 3600, nowMs = Date.now()): EconomyReport {
  const flows = game.db.ledgerFlows(nowMs - windowSec * 1000).map((f) => ({ kind: f.kind, inflow: Number(f.inflow), outflow: Number(f.outflow), n: Number(f.n) }));
  let faucets = 0, sinks = 0;
  for (const f of flows) {
    faucets += f.inflow;
    sinks += f.outflow;
  }
  const supply = moneySupply(game);
  const net = faucets - sinks;
  const netPerHour = net * (3600 / windowSec);
  const inflationPerHour = netPerHour / Math.max(1000, supply.total);
  const idx = priceIndex(game);
  const hist = game.econHistory;
  const priceTrend = hist.length ? idx - hist[0].priceIndex : 0;
  const status = inflationPerHour > INFLATING ? 'inflating' : inflationPerHour < -INFLATING ? 'deflating' : 'stable';
  return {
    windowSec,
    supply,
    faucets,
    sinks,
    net,
    netPerHour: Math.round(netPerHour),
    inflationPerHour: Math.round(inflationPerHour * 10000) / 10000,
    sinkRatio: faucets ? Math.round((sinks / faucets) * 1000) / 1000 : 0,
    priceIndex: Math.round(idx * 1000) / 1000,
    priceTrend: Math.round(priceTrend * 1000) / 1000,
    topFaucets: flows.filter((f) => f.inflow > 0).sort((a, b) => b.inflow - a.inflow).slice(0, 8),
    topSinks: flows.filter((f) => f.outflow > 0).sort((a, b) => b.outflow - a.outflow).slice(0, 8),
    status,
    rewardMul: game.econRewardMul,
  };
}

/** Hourly: record the index and nudge the contract-reward faucet against sustained inflation. */
export function econCheckpoint(game: Game, nowMs = Date.now()): EconomyReport {
  const r = economyReport(game, 3600, nowMs);
  game.econHistory.push({ t: nowMs, supply: r.supply.total, priceIndex: r.priceIndex });
  if (game.econHistory.length > MAX_HISTORY) game.econHistory.shift();
  // Only react when there is a real economy to measure (a handful of captains, some flow).
  if (r.supply.captains >= 3 && r.faucets > 0) {
    if (r.status === 'inflating') game.econRewardMul = Math.max(0.7, game.econRewardMul - 0.05);
    else if (r.status === 'deflating') game.econRewardMul = Math.min(1.15, game.econRewardMul + 0.05);
    else game.econRewardMul += (1 - game.econRewardMul) * 0.2;
    game.econRewardMul = Math.round(game.econRewardMul * 1000) / 1000;
  }
  r.rewardMul = game.econRewardMul;
  return r;
}
