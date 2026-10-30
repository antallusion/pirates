// The ports' price seasons on the server (shared/src/data/priceseason.ts; owner, 2026-10-30: «раз в 8 часов меняет
// цены»). Every eight hours of the wall clock each market's every good takes its new season factor (economy.ts
// GoodMarket.season, on top of the stock-and-mark price, so a port's trade and her own buying still move it, and the
// stock still drifts back to its mark); the sea is told «Port prices have changed». Nothing of a season is stored —
// the period's index is the wall clock's, the stocks are the markets' own record — but the admin's run-ahead
// (`/prices next`), kept in the db.
//
// No money out of nothing: what she bought in a port fetches there no more than SAME_PORT_BACK of what she paid for
// SAME_PORT_SEC (a buy low, sell high in one port never pays — the trade talents and the period's turn included);
// between ports the profit is the voyage's: its time, its sea.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { PRICE_PERIOD_MS, periodLeftMs, pricePeriod, seasonFactor } from '../../../shared/src/data/priceseason.ts';
import type { TradeSide } from '../../../shared/src/data/priceseason.ts';
import type { Market } from './economy.ts';
import type { Game } from './Game.ts';
import type { Profile } from './player.ts';
import { recordIntel } from './ports.ts';

/** Sold back in the port she bought it in: at most this share of what she paid a unit. */
export const SAME_PORT_BACK = 0.92;
/** …for this long after the purchase (world seconds): two periods, so a period's turn is no way round it. */
export const SAME_PORT_SEC = (2 * PRICE_PERIOD_MS) / 1000;
/** The most purchases kept on a profile (the oldest go first). */
const BOUGHT_MAX = 120;

const KV = 'price_offset';

export class PriceSeasonHub {
  /** The seasons run (tests of other systems keep the prices still: tests/helpers.ts). */
  on = true;
  /** The period the markets carry now (-1: none yet). */
  period = -1;
  /** The admin's run-ahead in periods (db-kept). */
  offset = 0;
  private loaded = false;
  load(game: Game): void {
    if (this.loaded) return;
    this.loaded = true;
    this.offset = game.db.getKv<number>(KV) ?? 0;
  }
}

/** The period by the wall clock now. */
export function periodNow(game: Game): number {
  game.prices.load(game);
  return pricePeriod(game.wallNow(), game.prices.offset);
}

/** Seconds till the next period. */
export function periodLeftSec(game: Game): number {
  return Math.ceil(periodLeftMs(game.wallNow()) / 1000);
}

function sideOf(prod: number, cons: number): TradeSide {
  return prod > cons ? -1 : cons > prod ? 1 : 0;
}

/** Puts a period's seasons on the markets (and the last period's, for the trend). */
export function applySeasons(game: Game, markets: Iterable<Market>, period: number): void {
  for (const m of markets) {
    const port = game.portById(m.portId);
    if (!port) continue;
    for (const id in m.goods) {
      const good = id as GoodId;
      const gm = m.goods[good]!;
      const side = sideOf(gm.prod, gm.cons);
      gm.season = seasonFactor(period, port.id, port.region, good, side);
      gm.seasonPrev = seasonFactor(period - 1, port.id, port.region, good, side);
    }
  }
}

/** Takes the seasons off (the system turned off). */
function clearSeasons(markets: Iterable<Market>): void {
  for (const m of markets) for (const id in m.goods) {
    const gm = m.goods[id as GoodId]!;
    delete gm.season;
    delete gm.seasonPrev;
  }
}

/** Each economy beat (Game.ts): a new period puts its seasons on and tells the sea. The first (a start) says nothing. */
export function stepPriceSeason(game: Game): void {
  const hub = game.prices;
  if (!hub.on) {
    if (hub.period !== -1) {
      clearSeasons(game.markets.values());
      hub.period = -1;
    }
    return;
  }
  const now = periodNow(game);
  if (now === hub.period) return;
  const first = hub.period === -1;
  hub.period = now;
  applySeasons(game, game.markets.values(), now);
  if (first) return;
  for (const s of game.sessions) {
    game.sendTo(s, { t: 'toast', msg: 'Port prices have changed: a new trading period.', kind: 'info' });
    // in port she sees the new board at once: her memory of it and the window
    const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
    if (port && s.profile) {
      recordIntel(game, s, port);
      game.pushPort(s);
    }
  }
}

/** The admin's `/prices next`: the next period at once (kept over a restart); `back` steps one back. */
export function advancePeriod(game: Game, by: number): number {
  const hub = game.prices;
  hub.load(game);
  hub.offset += by;
  game.db.setKv(KV, hub.offset);
  stepPriceSeason(game);
  return hub.period;
}

/** A purchase noted (ports.ts trade): units at a silver price each. */
export function noteBought(game: Game, p: Profile, portId: string, good: GoodId, qty: number, unit: number): void {
  if (qty <= 0) return;
  const book = (p.boughtHere ??= {});
  const k = `${portId}|${good}`;
  const was = book[k];
  const live = was && game.now - was[2] < SAME_PORT_SEC ? was : null;
  const n = (live?.[0] ?? 0) + qty;
  book[k] = [n, ((live ? live[0] * live[1] : 0) + qty * unit) / n, game.now];
  const keys = Object.keys(book);
  for (const key of keys) if (game.now - book[key][2] >= SAME_PORT_SEC) delete book[key];
  const left = Object.keys(book);
  if (left.length > BOUGHT_MAX) for (const key of left.sort((a, b) => book[a][2] - book[b][2]).slice(0, left.length - BOUGHT_MAX)) delete book[key];
}

/** A sale in a port (ports.ts trade): how much of `pay` (all she would get for the `n` units, every bonus in) is
 *  over the cap — the units she bought here lately fetch no more than SAME_PORT_BACK of what she paid. The record is
 *  spent by the units sold. */
export function sameportOver(game: Game, p: Profile, portId: string, good: GoodId, n: number, pay: number): number {
  const book = p.boughtHere;
  const k = `${portId}|${good}`;
  const rec = book?.[k];
  if (!book || !rec || n <= 0) return 0;
  if (game.now - rec[2] >= SAME_PORT_SEC) {
    delete book[k];
    if (!Object.keys(book).length) delete p.boughtHere;
    return 0;
  }
  const mine = Math.min(n, rec[0]);
  if (rec[0] - mine <= 0) delete book[k];
  else rec[0] -= mine;
  if (!Object.keys(book).length) delete p.boughtHere;
  return Math.max(0, Math.ceil((pay / n - rec[1] * SAME_PORT_BACK) * mine));
}

/** The base price's share a good stands at (for the price level of the card): its buying price over the base. */
export function priceLevel(good: GoodId, buy: number): -1 | 0 | 1 {
  const r = buy / GOODS[good].basePrice;
  return r >= 1.18 ? 1 : r <= 0.9 ? -1 : 0;
}
