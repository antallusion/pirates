// Physical economy: every port has stocks that are produced and consumed over time. Prices derive
// from stock vs target. Goods only move when a ship (NPC or player) physically carries them, so a sunk
// convoy literally creates a shortage at its destination. See docs/01_GDD_WORLD_ECONOMY.md §6.

import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { MarketRow } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';

export const ECON_HOUR = 900; // production/consumption rates are "per 15 real minutes"
const ELASTICITY = 0.6;
const SPREAD = 0.055;

export interface GoodMarket {
  stock: number;
  target: number;
  prod: number; // units per ECON_HOUR
  cons: number;
  history: number[]; // recent mid prices, newest last
  shock: number; // temporary multiplier from world events (1 = none)
}

export interface Market {
  portId: string;
  goods: Partial<Record<GoodId, GoodMarket>>;
}

const ALWAYS_TRADED: GoodId[] = ['provisions', 'rum', 'planks', 'sailcloth', 'salt'];

export function createMarket(port: Port): Market {
  const goods: Partial<Record<GoodId, GoodMarket>> = {};
  const allowContraband = port.blackMarket;
  for (const id of GOOD_IDS) {
    const def = GOODS[id];
    const prod = port.profile.produces[id] ?? 0;
    const cons = port.profile.consumes[id] ?? 0;
    const traded = prod > 0 || cons > 0 || ALWAYS_TRADED.includes(id) || (def.contraband && allowContraband) || port.size >= 3;
    if (!traded) continue;
    if (def.contraband && !allowContraband) continue;
    const size = port.size;
    let target: number;
    if (prod > cons) target = 6 * prod + 20 * size;
    else if (cons > prod) target = 5 * cons + 10 * size;
    else target = 18 * size;
    // Producers sit above target (cheap), consumers below (expensive).
    const stock = prod > cons ? target * 1.5 : cons > prod ? target * 0.55 : target;
    goods[id] = { stock, target, prod, cons, history: [], shock: 1 };
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
  honest: boolean;
}

/** Price the player pays per unit when buying `qty` units (walks the curve so bulk buys push the price). */
export function quoteBuy(good: GoodId, gm: GoodMarket, qty: number, mods: PriceMods): number {
  let total = 0;
  const sim = { ...gm };
  for (let i = 0; i < qty; i++) {
    total += midPrice(good, sim) * (1 + SPREAD) * mods.buyMul;
    sim.stock = Math.max(0, sim.stock - 1);
  }
  return Math.ceil(total);
}

export function quoteSell(good: GoodId, gm: GoodMarket, qty: number, mods: PriceMods): number {
  let total = 0;
  const sim = { ...gm };
  // Honest Merchant's bonus is already inside sellMul but only applies to legal goods.
  const mul = mods.honest && GOODS[good].contraband ? mods.sellMul - 0.12 : mods.sellMul;
  for (let i = 0; i < qty; i++) {
    total += midPrice(good, sim) * (1 - SPREAD) * mul;
    sim.stock += 1;
  }
  const tax = mods.lawfulPort ? 0.03 : 0;
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
      buy: Math.ceil(mid * (1 + SPREAD) * mods.buyMul),
      sell: Math.floor(mid * (1 - SPREAD) * mods.sellMul * (mods.lawfulPort ? 0.97 : 1)),
      stock: Math.floor(gm.stock),
      trend: Math.max(-1, Math.min(1, (mid - old) / Math.max(1, old))),
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
  const neutral: PriceMods = { buyMul: 1, sellMul: 1, lawfulPort: false, honest: false };
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
