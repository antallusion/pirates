// The ladder of strength on the server (canon D12, docs/12 §3): what a shot from one ship does to another across a
// gap of levels. Between two captains a lone junior never beats a senior; against the sea's ships a perfect captain
// wins one level up now and then. Juniors together may beat a senior when their budgets reach 1.2 of hers.

import { GROUP_OUTWEIGHS, ladder, levelPower } from '../../../shared/src/data/shiplevel.ts';
import type { LadderMods } from '../../../shared/src/data/shiplevel.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

const NONE: LadderMods = { dealt: 1, crits: 1, board: true, floorHull: 0, floorCrew: 0 };

/** Juniors who struck her within this many seconds count together. */
const GROUP_WINDOW = 30;

/** Is this ship on the ladder at all (bosses, their parts and wreck hulks are raids of their own)? */
export function laddered(s: ShipEntity): boolean {
  return s.onLadder;
}

/** Everyone attacking her lately, with the shooter: do their budgets outweigh hers? */
function outweighed(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  let sum = levelPower(a.combatLevel);
  for (const [id, t] of b.attackers) {
    if (id === a.id || game.now - t > GROUP_WINDOW) continue;
    const x = game.ships.get(id);
    if (x?.alive && x.isPlayer && laddered(x)) sum += levelPower(x.combatLevel);
  }
  return sum >= GROUP_OUTWEIGHS * levelPower(b.combatLevel);
}

/** The ladder between shooter `a` and target `b`. */
export function ladderBetween(game: Game, a: ShipEntity | null, b: ShipEntity): LadderMods {
  if (!a || a === b || !laddered(a) || !laddered(b)) return NONE;
  const pvp = a.isPlayer && b.isPlayer;
  const junior = b.combatLevel > a.combatLevel;
  return ladder(a.combatLevel, b.combatLevel, pvp, pvp && junior && outweighed(game, a, b));
}
