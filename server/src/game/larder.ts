// The crew's larder beyond the provisions bought (forum post 109, Эдуард, 2026-11-19): lying by her own island her crew
// is fed from the island's stores, not left to starve beside a full warehouse; and with the biscuit gone at sea they eat
// the fish in the hold (salted and smoked first, then the fresh) before they turn to mutiny.

import type { GoodId } from '../../../shared/src/data/goods.ts';
import { yardOf } from './base.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { islandNear } from './holdings.ts';
import type { ShipEntity } from './ship.ts';

/** The fish a crew eats in place of provisions, a unit for a unit, the keeping kinds first. */
export const FISH_FOOD: readonly GoodId[] = ['salted_fish', 'smoked_fish', 'fish', 'prime_fish'];

/** Minutes of food she takes aboard from her island at a time. */
const ISLE_TAKE_MIN = 30;

/** By her own island (moored at its yard or lying off it) with less than `low` provisions aboard: up to ISLE_TAKE_MIN
 *  minutes' worth taken from the island's yard, then its warehouse. What came aboard. */
export function isleLarder(game: Game, ship: ShipEntity, perMin: number, low: number): number {
  if (!ship.isPlayer || ship.accountId === undefined || ship.accountId === null) return 0;
  if ((ship.cargo.provisions ?? 0) >= low) return 0;
  const h = ownIsland(game, ship.accountId);
  if (!h) return 0;
  const by = ship.docked ? ship.docked === `isle:${h.island}` : islandNear(game, ship)?.id === h.island;
  if (!by) return 0;
  let want = Math.ceil(perMin * ISLE_TAKE_MIN) - Math.floor(ship.cargo.provisions ?? 0);
  if (want <= 0) return 0;
  let got = 0;
  const y = yardOf(game, h);
  for (const box of [y.res, h.store] as Partial<Record<GoodId, number>>[]) {
    const k = Math.min(want, Math.floor(box.provisions ?? 0));
    if (k <= 0) continue;
    box.provisions = (box.provisions ?? 0) - k;
    if (!box.provisions) delete box.provisions;
    got += k;
    want -= k;
  }
  if (got > 0) {
    ship.cargo.provisions = (ship.cargo.provisions ?? 0) + got;
    game.holdings.touch();
    game.toastShip(ship, `${got} provisions come aboard from your island's stores: the crew is fed.`, 'info');
  }
  return got;
}

/** The crew's `need` units eaten from the fish in the hold (the provisions gone); what they found. */
export function eatFish(ship: ShipEntity, need: number): number {
  let ate = 0;
  for (const g of FISH_FOOD) {
    if (need - ate <= 0) break;
    const have = ship.cargo[g] ?? 0;
    if (have <= 0) continue;
    const k = Math.min(have, need - ate);
    const left = Math.round((have - k) * 100) / 100;
    if (left <= 0) delete ship.cargo[g];
    else ship.cargo[g] = left;
    ate += k;
  }
  return ate;
}

/** Is there food aboard for the crew: provisions, or fish to eat in their place. */
export function foodAboard(ship: ShipEntity): boolean {
  return (ship.cargo.provisions ?? 0) > 0 || FISH_FOOD.some((g) => (ship.cargo[g] ?? 0) > 0);
}
