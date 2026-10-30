// The port card (owner, 2026-10-30: «нажимая на порт я хочу видеть подробную информацию о том что там продается и
// другую важную информацию»): a harbour seen from afar. Its market as far as she knows it — the game's rule of price
// knowledge kept (player.ts `intel`: «Only Market Sense turns a remembered visit into usable price knowledge»):
//   • she lies in it: its board now, exact;
//   • she has been there (or a Price Memory letter came): what she saw, with its age — exact with Market Sense, else
//     only how dear each good stood (cheap / usual / dear);
//   • never: the goods it trades (its trade is no secret: what it makes, what it eats), no prices.
// And its services, the waters' level, the time till the prices change.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS } from '../../../shared/src/data/ships.ts';
import { hasAuction } from '../../../shared/src/data/dealings.ts';
import type { PortInfoGood, PortInfoView } from '../../../shared/src/protocol.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { marketRows } from './economy.ts';
import { ferryView } from './ferry.ts';
import { hasExchange } from './finance.ts';
import type { Game } from './Game.ts';
import { ownMarket } from './ownstock.ts';
import type { PlayerSession } from './player.ts';
import { priceMods } from './ports.ts';
import { periodLeftSec, periodNow, priceLevel } from './priceseason.ts';
import { careerYardBonus } from './renown.ts';

export function portInfoView(game: Game, s: PlayerSession, portId: string): PortInfoView | null {
  const port = game.portById(portId);
  const ship = s.ship, p = s.profile;
  const market = game.markets.get(portId);
  if (!port || !ship || !p || !market) return null;
  const sideOf = (g: GoodId): -1 | 0 | 1 => {
    const gm = market.goods[g]!;
    return gm.prod > gm.cons ? -1 : gm.cons > gm.prod ? 1 : 0;
  };
  const legal = (g: GoodId) => !GOODS[g].contraband;
  const traded = (Object.keys(market.goods) as GoodId[]).filter((g) => legal(g) || port.blackMarket);
  let goods: PortInfoGood[];
  let source: PortInfoView['source'] = 'none';
  let exact = false;
  let ageSec: number | undefined, stale: boolean | undefined;
  if (ship.docked === port.id) {
    source = 'live';
    exact = true;
    const own = ownMarket(game, p, port)!;
    goods = marketRows(own, priceMods(ship, port, p, game.now, game))
      .filter((r) => r.legal || port.blackMarket)
      .map((r) => ({ good: r.good, side: sideOf(r.good), buy: r.buy, sell: r.sell, stock: r.stock, ...(r.trend ? { trend: Math.round(r.trend * 1000) / 1000 } : {}), legal: r.legal }));
  } else {
    const rec = p.priceIntel[port.id];
    exact = !!rec && ship.hasFlag('market_sense');
    if (rec && !rec.heard) {
      source = 'seen';
      ageSec = Math.max(0, Math.round(game.now - rec.t));
      if (game.prices.on && rec.period !== undefined && rec.period !== periodNow(game)) stale = true;
    }
    goods = traded.map((g) => {
      const row: PortInfoGood = { good: g, side: sideOf(g), legal: legal(g) };
      if (rec?.heard) {
        // (a whisper of the tavern, demand.ts: only what is dear and what is cheap there)
        if (rec.dear?.includes(g)) row.level = 1;
        else if (rec.cheap?.includes(g)) row.level = -1;
        return row;
      }
      if (source !== 'seen' || !rec) return row;
      const buy = rec.buy?.[g], sell = rec.sell[g];
      if (exact) {
        if (buy !== undefined) row.buy = buy;
        if (sell !== undefined) row.sell = sell;
        if (rec.stock?.[g] !== undefined) row.stock = rec.stock[g];
        if (rec.trend?.[g]) row.trend = rec.trend[g];
      }
      // how dear it stood (every captain: the chart's dear and cheap, docs/16 #11), by her buying price, else her selling
      const ask = buy ?? (sell !== undefined ? sell / 0.9 : undefined);
      if (ask !== undefined) row.level = priceLevel(g, ask);
      return row;
    });
  }
  const tier = port.shipyardTier;
  const hulls = tier > 0
    ? SHIP_CLASS_IDS.filter((id) => SHIP_CLASSES[id].purchasable && SHIP_CLASSES[id].tier <= tier + careerYardBonus(p, port.faction) && (!SHIP_CLASSES[id].factions || SHIP_CLASSES[id].factions!.includes(port.faction)))
    : [];
  return {
    portId: port.id,
    source,
    exact,
    ...(ageSec !== undefined ? { ageSec } : {}),
    ...(stale ? { stale } : {}),
    goods,
    priceLeft: game.prices.on ? periodLeftSec(game) : 0,
    crew: Math.floor(game.tavernCrew.get(port.id) ?? 0),
    level: sectorAt(game.world, port.x, port.y).level,
    hulls,
    auction: hasAuction(port),
    exchange: hasExchange(port),
    ...(() => {
      const f = ferryView(game, s, port.id); // owner, 2026-10-30: a hub port's «Переход» (ferry.ts)
      return f ? { ferry: f } : {};
    })(),
  };
}

export function sendPortInfo(game: Game, s: PlayerSession, portId: string): void {
  const view = portInfoView(game, s, String(portId ?? ''));
  if (view) game.sendTo(s, { t: 'portInfo', view });
}
