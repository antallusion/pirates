// The ladder of strength on the server (canon D12, docs/12 §3): what a shot from one ship does to another across a
// gap of levels. Between two captains a lone junior never beats a senior; against the sea's ships a perfect captain
// wins one level up now and then. Juniors together may beat a senior when their budgets reach 1.2 of hers; against
// the sea's ships they are then cut less.

import { CAPTAIN_LEVEL_FOR_SHIP, GROUP_OUTWEIGHS, SHIP_LEVEL_MAX, ladder, levelPower } from '../../../shared/src/data/shiplevel.ts';
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

/** Everyone attacking her lately, with the shooter: do their budgets outweigh hers? Between captains only captains
 *  count; against the sea's ships every hull on the ladder does (a captain's escorts, a squadron). */
function outweighed(game: Game, a: ShipEntity, b: ShipEntity, pvp: boolean): boolean {
  let sum = levelPower(a.combatLevel);
  for (const [id, t] of b.attackers) {
    if (id === a.id || game.now - t > GROUP_WINDOW) continue;
    const x = game.ships.get(id);
    if (x?.alive && (x.isPlayer || !pvp) && laddered(x)) sum += levelPower(x.combatLevel);
  }
  return sum >= GROUP_OUTWEIGHS * levelPower(b.combatLevel);
}

/** The ladder between shooter `a` and target `b`. */
export function ladderBetween(game: Game, a: ShipEntity | null, b: ShipEntity): LadderMods {
  if (!a || a === b || !laddered(a) || !laddered(b)) return NONE;
  const pvp = a.isPlayer && b.isPlayer;
  const junior = b.combatLevel > a.combatLevel;
  // Two ships of the broadside table (no beast between them) by its own measure (docs/25 §1.1).
  const ships = a.npcRole !== 'beast' && b.npcRole !== 'beast' && !a.cls.monster && !b.cls.monster;
  return ladder(a.combatLevel, b.combatLevel, pvp, junior && outweighed(game, a, b, pvp), ships);
}

/** The ⚓ a captain's own level has earned (canon D12: CAPTAIN_LEVEL_FOR_SHIP — the 4th the ⚓2, the 8th the ⚓3 …). */
export function earnedShipLevel(captainLevel: number): number {
  let L = 1;
  while (L < SHIP_LEVEL_MAX && CAPTAIN_LEVEL_FOR_SHIP[L + 1] <= captainLevel) L++;
  return L;
}

/** Owner, 2026-10-16 («у нпс корабля противника 15 юнг убили моих 21 … где баланс-то?»): on a deck it is the men and
 *  their captain who fight, not the hull. Against a ship of the sea a captain's side stands at the ⚓ her own level has
 *  earned when her hull is below it — a captain of the 5th on her first sloop is not a ⚓ junior to a ⚓2 pirate's crew
 *  (the hull's ladder cut her blows to 0.7 and his men felled three in four of hers). Her guns keep her hull's ladder
 *  (ladderBetween), and between two captains nothing changes. */
export function deckLadder(game: Game, ship: ShipEntity, enemy: ShipEntity): number {
  const base = ladderBetween(game, ship, enemy).dealt || 0.1;
  if ((ship.isPlayer && enemy.isPlayer) || !laddered(ship) || !laddered(enemy)) return base;
  // (up to the other's ⚓ only: it takes the junior's cut off her, it gives no senior's lift over a hull she does not sail)
  const deck = (x: ShipEntity, o: ShipEntity) => {
    const p = x.isPlayer ? game.sessionOf(x)?.profile : null;
    return p ? Math.max(x.combatLevel, Math.min(o.combatLevel, earnedShipLevel(p.level))) : x.combatLevel;
  };
  const a = deck(ship, enemy), b = deck(enemy, ship);
  if (a === ship.combatLevel && b === enemy.combatLevel) return base;
  const beast = ship.npcRole === 'beast' || enemy.npcRole === 'beast' || ship.cls.monster || enemy.cls.monster;
  const d = ladder(a, b, false, false, !beast).dealt || 0.1;
  // Her side's blows no softer than her hull's ladder makes them; the sea's on her no harder.
  return ship.isPlayer ? Math.max(base, d) : Math.min(base, d);
}
