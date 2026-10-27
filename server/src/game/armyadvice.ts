// The weak army's next step, read off a live captain (shared/src/data/armyadvice.ts): her level, her ship, her army,
// her silver and her island's buildings. The HUD's hint is sent with her state; the letters (mail, e-mail, VK/TG) call
// `captainAdvice` for any captain whose session is at hand.

import { armyAdvice } from '../../../shared/src/data/armyadvice.ts';
import type { AdviceCaptain, ArmyAdvice } from '../../../shared/src/data/armyadvice.ts';
import { ownIsland } from './estate.ts';
import { yardOf } from './base.ts';
import { keepsDeep, treeLevels } from './town.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** Her island's tree as the advice reads it (null: none of her own). */
export function isleOfAccount(game: Game, account: number): Partial<Record<string, number>> | null {
  const h = ownIsland(game, account);
  if (!h) return null;
  const out: Partial<Record<string, number>> = {};
  for (const [k, n] of treeLevels(h, yardOf(game, h))) out[k] = n;
  return out;
}

/** The captain as plain data (null: no captain or no ship). */
export function adviceCaptain(game: Game, s: PlayerSession): AdviceCaptain | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return null;
  return {
    level: p.level, shipLevel: ship.shipLevel, army: ship.army, crewMax: ship.stats.crewMax, slots: ship.armySlots,
    gold: Math.floor(p.gold), isle: isleOfAccount(game, s.accountId), deep: keepsDeep(s),
  };
}

/** Her army's advice now (null: under the advice's level, or no ship). */
export function captainAdvice(game: Game, s: PlayerSession): ArmyAdvice | null {
  const c = adviceCaptain(game, s);
  return c ? armyAdvice(c) : null;
}
