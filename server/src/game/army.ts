// The ship's army at sea (docs/17 H1): what the sea's ships carry by their waters and their trade, the hull as the
// wall the stacks stand behind when the balls come in, the "−N" over a ship that lost men, and when the sea's own
// captains lay alongside (they board when their men are the stronger, as a HoMM3 hero attacks a weaker army).

import { armyForLevel, armyKillFactor, armyPower, armyTidy } from '../../../shared/src/data/army.ts';
import { rosterKind } from '../../../shared/src/data/factionunits.ts';
import type { Roster } from '../../../shared/src/data/factionunits.ts';
import type { ArmyMix, ArmyStack } from '../../../shared/src/data/army.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import { ladderBetween } from './ladder.ts';

/** Whose men a ship of the sea carries. */
export function npcMixOf(ship: ShipEntity): ArmyMix {
  const r = ship.npcRole;
  if (r === 'ghost' || ship.faction === 'choir') return 'deep';
  if (r === 'merchant' || r === 'fisher' || r === 'beast') return 'merchant';
  if (r === 'patrol' || r === 'hunter' || r === 'escort') return 'navy';
  if (r === 'boss') return 'boss';
  return 'pirate';
}

/** Whose army a ship of the sea fields (owner, 2026-10-02: the world's armies): her faction's, the Dutchman's dead on
 *  a ghost; the Confederacy's and the free pirates' are the pirate crew's own kinds. */
export function rosterOf(ship: ShipEntity): Roster | null {
  if (ship.npcRole === 'ghost') return 'dutchman';
  const f = ship.faction;
  return f === 'crown' || f === 'choir' || f === 'harpoon' || f === 'brokers' || f === 'league' || f === 'free' ? f : null;
}

/** The stacks a ship of the sea carries: her head count spread by the level of the waters she sails (canon D12), in
 *  her faction's kinds (each fights as the pirate kind whose place it takes, so the sea's strength is as it was). */
export function npcArmy(ship: ShipEntity): ArmyStack[] {
  const r = rosterOf(ship);
  const army = armyForLevel(ship.shipLevel, ship.crew, ship.armySlots, npcMixOf(ship));
  return r ? armyTidy(army.map((s) => ({ u: rosterKind(r, s.u), n: s.n }))) : army;
}

/** The hull is the wall (docs/17 H1): a round shot through sound timbers kills fewer than one through a wreck, and
 *  grape sweeps the open deck whatever the planking. 0.65 through a whole hull, 1.35 through a shattered one — the
 *  holes shot in her are the gaps in the wall. */
export function wallsOf(ship: ShipEntity, grape: boolean): number {
  if (grape) return 1;
  const f = Math.max(0, Math.min(1, ship.hull / Math.max(1, ship.stats.hullMax)));
  return 0.65 + 0.7 * (1 - f);
}

const BASELINE = new Map<string, number>();

/** How many of her men a ball kills against a crew of her level's usual make (docs/17 H1): an army tougher than her
 *  waters' usual loses fewer, a crew of green deckhands on a senior hull more. Measured against the usual make so the
 *  ladder's gunnery (canon D12) keeps its pace. */
export function killFactor(ship: ShipEntity): number {
  const L = Math.max(1, Math.min(10, ship.shipLevel));
  const mix: ArmyMix = ship.isPlayer ? 'player' : npcMixOf(ship);
  const key = `${mix}${L}`;
  let base = BASELINE.get(key);
  if (base === undefined) BASELINE.set(key, (base = armyKillFactor(armyForLevel(L, 1000, 7, mix))));
  return Math.max(0.2, Math.min(2, armyKillFactor(ship.army) / base));
}

/** Men lost aboard, shown as a rising "−N" over her (a broadside's dead are counted as one number). */
export function menLost(game: Game, ship: ShipEntity, n: number): void {
  if (n <= 0) return;
  game.emit({ k: 'men', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), n }, ship.state.x, ship.state.y);
}

/** The strength of a ship's men against another's, as the boarding battle would reckon it (the ladder of levels on
 *  every blow). */
export function armyEdge(game: Game, a: ShipEntity, b: ShipEntity): number {
  const pa = armyPower(a.army) * Math.max(0.1, ladderBetween(game, a, b).dealt || 0.1) * (0.5 + a.morale / 100);
  const pb = armyPower(b.army) * Math.max(0.1, ladderBetween(game, b, a).dealt || 0.1) * (0.5 + b.morale / 100);
  return pa / Math.max(1, pb);
}

/** A captain of the sea grapples at once when his men are clearly the stronger, or when the guns have done their work
 *  (her hull, her men or her canvas broken, or she struck). Otherwise he keeps the grape on her decks. */
export function npcWouldBoard(game: Game, ship: ShipEntity, target: ShipEntity): boolean {
  if (target.surrendered) return true;
  const broken = target.hull <= target.stats.hullMax * 0.6 || target.crew <= target.stats.crewMax * 0.5 || target.sails <= target.stats.sailHpMax * 0.35;
  return broken || armyEdge(game, ship, target) >= 1.3;
}
