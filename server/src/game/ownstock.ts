// Her own stock in every harbour (owner, 2026-10-22: «в гаванях всегда должны продаваться парусины, провизии и доски в
// бесконечном количестве. и для каждого игрока своя цифра в гавани должна быть остального, но не менее 100 единиц на
// складе для каждого игрока»; docs/31 §13, docs/01 §6.3a).
//
// The port's market (economy.ts) stays the world's: its production and consumption, the NPC merchants, the events. A
// captain trades against her own copy of it:
//   • the ship's stores (SUPPLY_GOODS: provisions, sailcloth, planks) — without end, at the port's normal price (its
//     price at the stock it was made with, the events' shock on it), flat; taken back at SUPPLY_BUYBACK of the base;
//   • every other good — her own stock, in «her units»: the port's market magnified so its normal stock is at least
//     STOCK_FLOOR (×k, k = max(1, 100 / base); the price — target/stock — is the port's own at the same share). Never
//     below STOCK_FLOOR: bought down to it, it is topped up at once (and the price walks no further). Above it, it goes
//     back to the port's own level at the port's rate (its production, consumption or a tenth of its mark an hour).
// Kept lazily on her profile: an entry only for a good she traded in a port, dropped once back at the port's level.

import { GOODS, INF_STOCK, STOCK_FLOOR, isSupply } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { ECON_HOUR } from './economy.ts';
import type { GoodMarket, Market } from './economy.ts';
import type { Game } from './Game.ts';
import type { Profile } from './player.ts';

/** The most entries kept on a profile (the oldest go first: they are the nearest back to the port's own). */
export const OWN_STOCK_MAX = 240;
/** Her stock goes back to the port's at least this share of the port's mark an hour of the market (ECON_HOUR). */
export const OWN_RESTOCK = 0.1;

const key = (port: string, good: GoodId) => `${port}|${good}`;

/** How much bigger her stock of a good is than the port's (her units): its normal stock no less than STOCK_FLOOR. */
export function stockScale(gm: GoodMarket): number {
  return Math.max(1, STOCK_FLOOR / Math.max(1, gm.base ?? gm.target));
}

/** Her stock of a good in a port at world time `now` (her units, before the floor). */
function ownLevel(p: Profile, portId: string, good: GoodId, gm: GoodMarket, now: number): number {
  const k = stockScale(gm);
  const port = gm.stock * k;
  const e = p.ownStock?.[key(portId, good)];
  if (!e) return port;
  const r = Math.max(gm.prod, gm.cons, OWN_RESTOCK * gm.target) * k * (Math.max(0, now - e[1]) / ECON_HOUR);
  const d = port - e[0];
  return Math.abs(d) <= r ? port : e[0] + Math.sign(d) * r;
}

/** Her view of one good of a port's market (undefined: the port does not trade it). */
export function ownGood(game: Game, p: Profile, port: Port, good: GoodId): GoodMarket | undefined {
  const gm = game.markets.get(port.id)?.goods[good];
  if (!gm) return undefined;
  if (isSupply(good)) return { ...gm, stock: gm.base ?? gm.target, flat: true };
  const k = stockScale(gm);
  return {
    stock: Math.max(STOCK_FLOOR, ownLevel(p, port.id, good, gm, game.now)),
    target: gm.target * k, prod: gm.prod * k, cons: gm.cons * k,
    history: gm.history, shock: gm.shock, base: (gm.base ?? gm.target) * k, floor: STOCK_FLOOR,
  };
}

/** Her view of a port's whole market. */
export function ownMarket(game: Game, p: Profile, port: Port): Market | undefined {
  const m = game.markets.get(port.id);
  if (!m) return undefined;
  const goods: Market['goods'] = {};
  for (const g in m.goods) goods[g as GoodId] = ownGood(game, p, port, g as GoodId);
  return { portId: port.id, goods };
}

/** How many of a good she can buy in a port: INF_STOCK for the stores, her stock (≥ STOCK_FLOOR) for the rest, 0 where
 *  it is not traded (contraband outside a black market too). */
export function ownStockOf(game: Game, p: Profile, port: Port, good: GoodId): number {
  if (GOODS[good]?.contraband && !port.blackMarket) return 0;
  const gm = ownGood(game, p, port, good);
  if (!gm) return 0;
  return gm.flat ? INF_STOCK : Math.floor(gm.stock);
}

/** Her trade moves her own stock: −n bought, +n sold (her units). The stores do not move. Bought below the floor, it is
 *  topped up to it at once. */
export function ownTrade(game: Game, p: Profile, port: Port, good: GoodId, delta: number): void {
  const gm = game.markets.get(port.id)?.goods[good];
  if (!gm || isSupply(good) || !delta) return;
  const now = game.now;
  const level = Math.max(STOCK_FLOOR, Math.max(STOCK_FLOOR, ownLevel(p, port.id, good, gm, now)) + delta);
  const book = (p.ownStock ??= {});
  const k = key(port.id, good);
  if (Math.abs(level - gm.stock * stockScale(gm)) < 0.5) delete book[k]; // back at the port's own
  else book[k] = [Math.round(level * 10) / 10, now];
  gcOwnStock(game, p);
}

/** Drops the entries back at their port's level; past OWN_STOCK_MAX, the oldest. */
export function gcOwnStock(game: Game, p: Profile): void {
  const book = p.ownStock;
  if (!book) return;
  const keys = Object.keys(book);
  for (const k of keys) {
    const [portId, good] = k.split('|') as [string, GoodId];
    const gm = game.markets.get(portId)?.goods[good];
    if (!gm || isSupply(good)) {
      delete book[k];
      continue;
    }
    if (Math.abs(ownLevel(p, portId, good, gm, game.now) - gm.stock * stockScale(gm)) < 0.5) delete book[k];
  }
  const left = Object.keys(book);
  if (left.length > OWN_STOCK_MAX) for (const k of left.sort((a, b) => book[a][1] - book[b][1]).slice(0, left.length - OWN_STOCK_MAX)) delete book[k];
  if (!Object.keys(book).length) delete p.ownStock;
}
