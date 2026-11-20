// Lying at her own island (forum post 115, Эдуард, 2026-11-20: «новый остров не принимает мой корабль… вышел с меню
// острова и успел поймать свой корабль на подходе к морю Мертвецов; выходя из игры, мне даётся отсчёт 30 секунд, как
// будто я в море»). The island screen still never halts her (forum 57: a ship stopped under the screen was a sitting
// mark), but a ship hove to off her own island's shore, out of a fight, is at home: no helmsman's run or broken-off
// course takes her away by itself (only her own hand does), and «Выход» there is at once, as in a port.

import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { islandNear } from './holdings.ts';
import type { PlayerSession } from './player.ts';

/** Her ship lying still within reach of her own island's shore, not under fire. */
export function atOwnIsle(game: Game, s: PlayerSession): boolean {
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked || ship.boarding || ship.grappled) return false;
  if (Math.abs(ship.state.speed) >= 1.2 || ship.underFire(game.now)) return false;
  const h = ownIsland(game, s.accountId);
  return !!h && islandNear(game, ship)?.id === h.island;
}
