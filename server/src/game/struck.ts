// Striking the colours (docs/16 #3). A warship battered past bearing — hull or crew or heart all but gone — and
// outgunned by the captain on her strikes her flag rather than go down; a merchant strikes sooner (npc.ts). The
// captain she struck to gets the choice card: let her go for her ransom, open her hold, or put a prize crew aboard
// (for the court, or to keep her as a trophy, docs/16 #5). The terms go through the boarding's own result
// (claimPrize → onBoardingWon → the loot), so a surrender is a ship taken like any other.

import type { SurrenderOffer } from '../../../shared/src/protocol.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Game } from './Game.ts';
import type { NpcBrain } from './npc.ts';
import type { PlayerSession } from './player.ts';
import { MAX_BERTHS } from './shipbuilding.ts';
import { prizeCrewNeeded, prizeValue } from './prizes.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import type { ShipEntity } from './ship.ts';

/** Below these she is battered: a quarter of her hull, three tenths of her men (docs/23 item 41: sooner, so a fight is
 *  shorter and ends oftener in a prize), or her heart all but gone. */
export const STRIKE_HULL = 0.25;
export const STRIKE_CREW = 0.3;
export const STRIKE_MORALE = 15;
/** And she strikes only to a captain whose ship still has half as much fight in her again as her own. */
export const STRIKE_OUTGUNNED = 1.5;
/** Each think (four a second) a battered, outgunned ship may strike: in a second or two, if the fire keeps on. */
export const STRIKE_CHANCE = 0.3;
/** How close the captain must come to take the surrender (the same reach as the plunder's). */
export const SURRENDER_RANGE = 400;
/** How long she lies struck before she thinks better of it (npc.ts). */
export const SURRENDER_WAIT = 75;

const offered = new WeakMap<ShipEntity, number>(); // the struck ship -> the account she struck to

/** The fight left in a ship: her hull, her guns still mounted, her men. */
export function fightingPower(s: ShipEntity): number {
  const guns = Math.max(0, s.stats.gunsPerSide * 2 - s.gunsDisabled.port - s.gunsDisabled.starboard);
  return Math.max(0, s.hull) * (1 + guns) * Math.max(0.15, s.crew / Math.max(1, s.stats.crewMax));
}

/** The captain's own ship behind a foe (her escort or prize fights for her), or null for no captain. */
function captainShip(game: Game, foe: ShipEntity | null): ShipEntity | null {
  if (!foe) return null;
  if (foe.isPlayer) return foe;
  const owner = foe.ownerId !== null ? game.ships.get(foe.ownerId) : undefined;
  return owner?.isPlayer ? owner : null;
}

/** A warship that may strike at all: none of the deep's, the sea's great ones, the dead or the named. */
export function canStrike(ship: ShipEntity): boolean {
  if (ship.isPlayer || !ship.alive || ship.sinkingUntil || ship.surrendered || ship.boarding || ship.prize || ship.ownerId !== null) return false;
  if (ship.npcRole !== 'pirate' && ship.npcRole !== 'patrol' && ship.npcRole !== 'hunter') return false;
  if (ship.cls.monster || ship.bossOf || ship.bossPart || ship.named || ship.namedMate || ship.dutchman || ship.yardOf || ship.caravanId || ship.caravanOf !== null) return false;
  if (ship.cls.passive.id === 'dead_crew' || ship.hasFlag('crew_of_drowned')) return false; // the dead do not surrender
  return true;
}

/** Battered past bearing, and outgunned by a captain who has been firing on her. */
export function wouldStrike(game: Game, ship: ShipEntity, foe: ShipEntity | null): boolean {
  if (!canStrike(ship) || !foe || !foe.alive) return false;
  const captain = captainShip(game, foe);
  if (!captain) return false;
  if (!ship.inCombat(game.now) || (ship.attackers.get(foe.id) ?? -1e9) < game.now - 30) return false;
  const battered = ship.hull < ship.stats.hullMax * STRIKE_HULL || ship.crew < ship.stats.crewMax * STRIKE_CREW || ship.morale < STRIKE_MORALE;
  return battered && fightingPower(foe) >= STRIKE_OUTGUNNED * fightingPower(ship);
}

/** A warship's think: strike now? She strikes but once — having thought better of it, she fights on. */
export function strikeColours(game: Game, ship: ShipEntity, brain: NpcBrain, foe: ShipEntity | null): boolean {
  if (brain.struck || !wouldStrike(game, ship, foe) || !game.rng.chance(STRIKE_CHANCE)) return false;
  brain.struck = true;
  struck(game, ship, brain, foe!);
  return true;
}

/** She strikes her colours to `foe`: she lies still, the sea hears of it, and her captor gets the card. */
export function struck(game: Game, ship: ShipEntity, brain: NpcBrain, foe: ShipEntity | null): void {
  ship.surrendered = true;
  ship.input = { rudder: 0, sailTarget: 0 };
  brain.surrenderedAt = game.now;
  brain.target = null;
  game.toastNear(ship, `${ship.name} strikes her colours!`);
  game.emit({ k: 'fx', fx: 'struck', x: Math.round(ship.state.x), y: Math.round(ship.state.y) }, ship.state.x, ship.state.y);
  const captain = captainShip(game, foe);
  const s = captain ? game.sessionOf(captain) : undefined;
  if (s?.profile && dist(captain!.state.x, captain!.state.y, ship.state.x, ship.state.y) < 2000) {
    offered.set(ship, s.accountId);
    game.sendTo(s, { t: 'surrender_offer', offer: surrenderOffer(game, s, ship) });
  }
}

/** The card: who she is, what her people pay, her hold, a prize crew's size and a berth for a trophy. */
export function surrenderOffer(game: Game, s: PlayerSession, ship: ShipEntity): SurrenderOffer {
  const me = s.ship!;
  const crew = prizeCrewNeeded(me, ship);
  let units = 0;
  for (const id in ship.cargo) units += ship.cargo[id as keyof typeof ship.cargo] ?? 0;
  const brain = game.npcs.get(ship.id);
  return {
    id: ship.id, name: ship.name, classId: ship.loadout.classId, faction: ship.faction, role: ship.npcRole, captain: ship.captainName,
    ransom: Math.round(150 + cargoValue(ship.cargo) * 0.08 + ship.cls.tier * 120), cargo: units, gold: ship.purse,
    prize: crew !== null ? { crew, value: prizeValue(ship, me) } : null,
    trophy: crew !== null && (s.profile?.berths.length ?? MAX_BERTHS) < MAX_BERTHS,
    range: SURRENDER_RANGE, until: (brain?.surrenderedAt || game.now) + SURRENDER_WAIT,
  };
}

/** The offer is gone (taken, lapsed, sunk): the card closes. */
export function surrenderClosed(game: Game, ship: ShipEntity): void {
  const acc = offered.get(ship);
  if (acc === undefined) return;
  offered.delete(ship);
  const s = game.sessionByAccount(acc);
  if (s) game.sendTo(s, { t: 'surrender_offer', offer: null });
}

/** Why this captain may not take her surrender now, or null. */
export function surrenderBlocked(game: Game, s: PlayerSession, target: ShipEntity | undefined): string | null {
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked) return 'Cannot do that now';
  if (!target || !target.alive || target.sinkingUntil || !target.surrendered || target.isPlayer) return 'She has not struck';
  if (target.boarding || target.prize || target.ownerId !== null) return 'She is taken already';
  if (target.lootLockedFor !== null && target.lootLockedFor !== ship.id) return 'She struck to another captain';
  if (offered.get(target) !== s.accountId && !target.attackers.has(ship.id)) return 'She did not strike to you';
  if (ship.boarding || s.pendingBoarding) return 'Settle the ship alongside first';
  const d = dist(ship.state.x, ship.state.y, target.state.x, target.state.y);
  if (d > SURRENDER_RANGE) return `Come within ${SURRENDER_RANGE} m to take her surrender (${Math.round(d)} m)`;
  return null;
}
