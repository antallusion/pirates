// Physical economy: every port has stocks that are produced and consumed over time. Prices derive
// from stock vs target. Goods only move when a ship (NPC or player) physically carries them, so a sunk
// convoy literally creates a shortage at its destination. See docs/01_GDD_WORLD_ECONOMY.md §6.

import { GOODS, GOOD_IDS, INF_STOCK, MARKET_ELASTICITY, SUPPLY_BUYBACK, portTrades } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { MarketRow } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { VOYAGE_MINUTES, provisionsPerMinute } from '../../../shared/src/data/voyage.ts';

export const ECON_HOUR = 900; // production/consumption rates are "per 15 real minutes"
const ELASTICITY = MARKET_ELASTICITY;
const SPREAD = 0.055;

export interface GoodMarket {
  stock: number;
  target: number;
  prod: number; // units per ECON_HOUR
  cons: number;
  history: number[]; // recent mid prices, newest last
  shock: number; // temporary multiplier from world events (1 = none)
  /** The stock the port was made with (createMarket): its normal level, its normal price. */
  base?: number;
  /** A captain's view of one of the ship's stores (ownstock.ts): stock without end, the port's normal price flat, taken
   *  back at SUPPLY_BUYBACK of the base price. */
  flat?: boolean;
  /** A captain's own stock (ownstock.ts): never below this — bought down to it, the harbour tops it up, the price stands. */
  floor?: number;
}

export interface Market {
  portId: string;
  goods: Partial<Record<GoodId, GoodMarket>>;
}

/** The share of a port's own provisions it grows itself, whatever its trade (createMarket). */
export const PROVISIONS_LOCAL = 0.75;


/** Playthrough C: a harbour victuals the ships of its waters — the hands a warship of each ⚓ carries (the balance tools'
 *  hammocks), and the voyages of her food its stores keep (VICTUAL_VOYAGES at the stock a port holds, about half its
 *  mark). The ports' provisions stood at 31–54 whatever the waters: a frigate of ⚓7 (220–320 hands) bought four
 *  minutes of food, a man-of-war (600) two and a half. */
export const VICTUAL_CREW = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];
export const VICTUAL_VOYAGES = 1.5;
/** The provisions mark a port of a square of `level` keeps for the ships of its waters. */
export function victualTarget(level: number): number {
  const crew = VICTUAL_CREW[Math.max(0, Math.min(10, Math.round(level)))];
  return (VICTUAL_VOYAGES * provisionsPerMinute(crew) * VOYAGE_MINUTES) / 0.56;
}

/** A port's market; `level`: the ⚓ of the square it stands in (its provisions are kept for the ships of its waters). */
export function createMarket(port: Port, level = 0): Market {
  const goods: Partial<Record<GoodId, GoodMarket>> = {};
  for (const id of GOOD_IDS) {
    const def = GOODS[id];
    const cons = port.profile.consumes[id] ?? 0;
    // Every harbour's own farms and fishers put up some food (QA playthrough B, 2026-10-12): a port that only ate
    // provisions sold its last barrel and stayed at nothing — 218 of 318 ports, Hollowmere among them, had no food to
    // sell a captain. Three quarters of what it eats keeps a stock about half its mark, the price above the base.
    const prod = id === 'provisions' ? Math.max(port.profile.produces[id] ?? 0, cons * PROVISIONS_LOCAL) : port.profile.produces[id] ?? 0;
    if (!portTrades(port, id)) continue; // (rare materials only where they come from, contraband at a black market)
    const size = port.size;
    let target: number;
    if (prod > cons) target = 6 * prod + 20 * size;
    else if (cons > prod) target = 5 * cons + 10 * size;
    else target = 18 * size;
    // Producers sit above target (cheap), consumers below (expensive).
    const stock = prod > cons ? target * 1.5 : cons > prod ? target * 0.55 : target;
    // (provisions: the town's own trade and the ships' victualling in one — a port of big ships' waters makes and sells
    // as much more, at the same balance, so its stock stands at the same share of its mark and its price where it was)
    const k = id === 'provisions' ? Math.max(1, victualTarget(level) / Math.max(1, target)) : 1;
    goods[id] = { stock: stock * k, target: target * k, prod: prod * k, cons: cons * k, history: [], shock: 1, base: stock * k };
  }
  return { portId: port.id, goods };
}

export function midPrice(good: GoodId, gm: GoodMarket): number {
  const base = GOODS[good].basePrice;
  const ratio = gm.target / Math.max(1, gm.stock);
  const f = Math.max(0.35, Math.min(3.2, Math.pow(ratio, ELASTICITY)));
  return base * f * gm.shock;
}

export interface PriceMods {
  buyMul: number;
  sellMul: number;
  lawfulPort: boolean;
  duty: number; // import duty on sales, 0..1
  honest: boolean;
  /** Bulk Buyer: how far each unit moves the price (−0.15 per rank). */
  slippage?: number;
  /** Per-good price factors: deal of the day, established routes, monopolist bonuses. */
  goodBuy?: Partial<Record<GoodId, number>>;
  goodSell?: Partial<Record<GoodId, number>>;
  goodSlip?: Partial<Record<GoodId, number>>;
}

function step(good: GoodId, mods: PriceMods): number {
  return Math.max(0.2, 1 + (mods.slippage ?? 0) + (mods.goodSlip?.[good] ?? 0));
}

/** Price the player pays per unit when buying `qty` units (walks the curve so bulk buys push the price). */
export function quoteBuy(good: GoodId, gm: GoodMarket, qty: number, mods: PriceMods): number {
  let total = 0;
  const sim = { ...gm };
  const k = step(good, mods), g = mods.goodBuy?.[good] ?? 1;
  if (gm.flat) return Math.ceil(midPrice(good, gm) * (1 + SPREAD) * mods.buyMul * g * qty); // a store without end: flat
  const floor = gm.floor ?? 0;
  for (let i = 0; i < qty; i++) {
    total += midPrice(good, sim) * (1 + SPREAD) * mods.buyMul * g;
    sim.stock = Math.max(floor, sim.stock - k);
  }
  return Math.ceil(total);
}

/** What a harbour gives for one of its endless stores: SUPPLY_BUYBACK of the base price (the duty off), and never more
 *  than four fifths of what she pays for it here — under any harbour's price, so no round trip pays (docs/31 §13). */
export function supplyBuyback(good: GoodId, gm: GoodMarket, mods: PriceMods): number {
  const buy = midPrice(good, gm) * (1 + SPREAD) * mods.buyMul * (mods.goodBuy?.[good] ?? 1);
  return Math.min(GOODS[good].basePrice * SUPPLY_BUYBACK, buy * 0.8) * (1 - mods.duty);
}

export function quoteSell(good: GoodId, gm: GoodMarket, qty: number, mods: PriceMods): number {
  if (gm.flat) return Math.floor(supplyBuyback(good, gm, mods) * qty);
  let total = 0;
  const sim = { ...gm };
  // Honest Merchant's bonus is already inside sellMul but only applies to legal goods.
  const mul = (mods.honest && GOODS[good].contraband ? mods.sellMul - 0.12 : mods.sellMul) * (mods.goodSell?.[good] ?? 1);
  const k = step(good, mods);
  for (let i = 0; i < qty; i++) {
    total += midPrice(good, sim) * (1 - SPREAD) * mul;
    sim.stock += k;
  }
  const tax = mods.duty;
  return Math.floor(total * (1 - tax));
}

export function marketRows(market: Market, mods: PriceMods): MarketRow[] {
  const rows: MarketRow[] = [];
  for (const id in market.goods) {
    const good = id as GoodId;
    const gm = market.goods[good]!;
    const hist = gm.history;
    const mid = midPrice(good, gm);
    const old = hist.length ? hist[0] : mid;
    rows.push({
      good,
      buy: Math.ceil(mid * (1 + SPREAD) * mods.buyMul * (mods.goodBuy?.[good] ?? 1)),
      sell: gm.flat ? Math.floor(supplyBuyback(good, gm, mods)) : Math.floor(mid * (1 - SPREAD) * mods.sellMul * (mods.goodSell?.[good] ?? 1) * (1 - mods.duty)),
      stock: gm.flat ? INF_STOCK : Math.floor(gm.stock),
      trend: gm.flat ? 0 : Math.max(-1, Math.min(1, (mid - old) / Math.max(1, old))),
      legal: !GOODS[good].contraband,
    });
  }
  rows.sort((a, b) => GOOD_IDS.indexOf(a.good) - GOOD_IDS.indexOf(b.good));
  return rows;
}

/** Advance production and consumption by dt seconds; record price history once per call. */
export function tickMarket(market: Market, dt: number, recordHistory: boolean): void {
  const h = dt / ECON_HOUR;
  for (const id in market.goods) {
    const good = id as GoodId;
    const gm = market.goods[good]!;
    // Production slows as warehouses fill; consumption slows as stock runs out (people go without).
    const fill = gm.stock / Math.max(1, gm.target);
    const prod = gm.prod * h * Math.max(0, 1.6 - fill * 0.6);
    const cons = gm.cons * h * Math.min(1, fill * 1.5 + 0.1);
    // Baseline drift toward target for goods the port neither makes nor uses (local traders).
    const drift = gm.prod === 0 && gm.cons === 0 ? (gm.target - gm.stock) * 0.02 * h * 4 : 0;
    gm.stock = Math.max(0, gm.stock + prod - cons + drift);
    // Perishables rot in the warehouse too.
    const spoil = GOODS[good].spoilPerHour;
    if (spoil > 0 && gm.stock > gm.target * 2) gm.stock -= gm.stock * spoil * h * 0.25;
    // World-event shocks decay back to 1.
    gm.shock += (1 - gm.shock) * Math.min(1, 0.05 * h * 4);
    if (recordHistory) {
      gm.history.push(Math.round(midPrice(good, gm) * 10) / 10);
      if (gm.history.length > 24) gm.history.shift();
    }
  }
}

export function portIsLawful(port: Port): boolean {
  return FACTIONS[port.faction].lawful;
}

export interface TradeRoute {
  from: string;
  to: string;
  good: GoodId;
  margin: number; // per unit
}

/** Best NPC arbitrage from `from` to any other market, weighted by distance. Used by merchant AI. */
export function bestRoute(
  from: Port, markets: Map<string, Market>, ports: Port[], rand: () => number, maxDist = 40000,
): TradeRoute | null {
  const src = markets.get(from.id);
  if (!src) return null;
  const neutral: PriceMods = { buyMul: 1, sellMul: 1, lawfulPort: false, honest: false, duty: 0 };
  let best: TradeRoute | null = null;
  let bestScore = 0;
  for (const to of ports) {
    if (to.id === from.id) continue;
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    if (d > maxDist) continue;
    const dst = markets.get(to.id);
    if (!dst) continue;
    for (const id in src.goods) {
      const good = id as GoodId;
      if (GOODS[good].contraband && !to.blackMarket) continue;
      const a = src.goods[good]!;
      const b = dst.goods[good];
      if (!b || a.stock < 10) continue;
      const margin = midPrice(good, b) * (1 - SPREAD) - midPrice(good, a) * (1 + SPREAD);
      if (margin <= 0) continue;
      const score = (margin / GOODS[good].volume) / (1 + d / 15000) * (0.7 + rand() * 0.6);
      if (score > bestScore) {
        bestScore = score;
        best = { from: from.id, to: to.id, good, margin };
      }
    }
  }
  return best;
}

export function applyTrade(market: Market, good: GoodId, deltaStock: number): void {
  const gm = market.goods[good];
  if (gm) gm.stock = Math.max(0, gm.stock + deltaStock);
}

export function serializeMarkets(markets: Map<string, Market>): Record<string, Record<string, [number, number]>> {
  const out: Record<string, Record<string, [number, number]>> = {};
  for (const [pid, m] of markets) {
    out[pid] = {};
    for (const id in m.goods) {
      const gm = m.goods[id as GoodId]!;
      out[pid][id] = [Math.round(gm.stock * 10) / 10, gm.shock];
    }
  }
  return out;
}

export function restoreMarkets(markets: Map<string, Market>, data: Record<string, Record<string, [number, number]>>): void {
  for (const pid in data) {
    const m = markets.get(pid);
    if (!m) continue;
    for (const id in data[pid]) {
      const gm = m.goods[id as GoodId];
      if (gm) {
        gm.stock = data[pid][id][0];
        gm.shock = data[pid][id][1] ?? 1;
      }
    }
  }
}

/** Import duty charged on sales in each faction's ports; a trade licence waives it. */
export const FACTION_DUTY: Partial<Record<string, number>> = { crown: 0.08, league: 0.05, harpoon: 0.03 };
export const LICENCE_SEC = 2 * 3600;
export function licenceCost(level: number): number {
  return 500 + level * 25;
}
