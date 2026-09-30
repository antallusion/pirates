// Port demand on the world chart (docs/16 #11): by each port she knows, the goods dear there (sell there) and cheap
// there (buy there), as they stood when she learned it. She learns it by making port (her own eyes), and from the
// harbour's talk of the ports near (older, and marked as hearsay); the chart fades what is old and says how old.

import { CHEAP_AT, DEAR_AT, DEMAND_MARKS, HEARD_AGE, HEARD_PORTS, HEARD_RANGE } from '../../../shared/src/data/dealings.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { midPrice } from './economy.ts';
import type { Market } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** The goods dearest and cheapest against their base price in a market, past the marks. Contraband only where it is
 *  sold openly (a black market). */
export function demandOf(market: Market, blackMarket: boolean): { dear: GoodId[]; cheap: GoodId[] } {
  const rows: [GoodId, number][] = [];
  for (const id in market.goods) {
    const g = id as GoodId;
    if (GOODS[g].contraband && !blackMarket) continue;
    rows.push([g, midPrice(g, market.goods[g]!) / GOODS[g].basePrice]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  const dear = rows.filter(([, r]) => r >= DEAR_AT).slice(0, DEMAND_MARKS).map(([g]) => g);
  const cheap = rows.filter(([, r]) => r <= CHEAP_AT).reverse().slice(0, DEMAND_MARKS).map(([g]) => g);
  return { dear, cheap };
}

/** In port: the talk on the quay of the ports near that she has no fresher word of (a while old, as hearsay). */
export function hearOfPorts(game: Game, s: PlayerSession, port: Port): number {
  const p = s.profile!;
  const near = game.world.ports
    // A village is talked of only to one who knows where it is (the chart draws no other).
    .filter((q) => q.id !== port.id && dist(q.x, q.y, port.x, port.y) < HEARD_RANGE && (!q.id.includes('_v') || s.discovered.has(q.islandId)))
    .sort((a, b) => dist(a.x, a.y, port.x, port.y) - dist(b.x, b.y, port.x, port.y));
  let told = 0;
  for (const q of near) {
    if (told >= HEARD_PORTS) break;
    const m = game.markets.get(q.id);
    if (!m) continue;
    const age = HEARD_AGE[0] + game.rng.float() * (HEARD_AGE[1] - HEARD_AGE[0]);
    const t = game.now - age;
    const had = p.priceIntel[q.id];
    if (had && had.t >= t) continue;
    const { dear, cheap } = demandOf(m, q.blackMarket);
    // The talk gives no figures, only what is dear there and what is cheap.
    p.priceIntel[q.id] = { t, sell: {}, dear, cheap, heard: true };
    told++;
  }
  return told;
}
