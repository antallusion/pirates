// A captain's colours and «Абордаж: выкл» (docs/24 C1, D1–D3; owner, 2026-10-07). The rules of who may attack whom live
// on the old roads, not beside them: `pvpBlocked` (pvp.ts) asks `coloursBlocked` for every shot, ram and grapple between
// captains (and their escorts and prizes), `canBoard` (boarding.ts) asks `boardingOff`, the sea's pirates ask
// `pirateDares` before they come for a neutral captain (npc.ts), and the hunts put out after her ask `neutralSpared`
// (traffic.ts, director.ts, quests.ts). The law's own rules stand: no fighting between captains in safe water, a group
// and a guild never fire on their own, duels by consent, infamy for an attack on a captain who is no fair game.

import { COLOURS_FIGHT_MS, COLOURS_HOIST_MS, NEUTRAL_MIND_SEC, NEUTRAL_PIRATE_RATE, NEUTRAL_WANTED_MAX, PENNANT_AGGRESSED_MS, PENNANT_LEVEL, PENNANT_SECONDS, citiesHostile, coloursBar } from '../../../shared/src/data/colours.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Colours, ColoursBar } from '../../../shared/src/data/colours.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import { atWar } from './guilds.ts';
import type { NpcBrain } from './npc.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** The colours' own dice (a pirate's mind about a neutral captain, the hunts spared her): the sea's stream is not drawn
 *  on, so the fights and the landings the tests replay stay as they were. */
const rngs = new WeakMap<Game, Rng>();
function cr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0xc010e5)));
  return r;
}

export const COLOURS_SAY: Record<ColoursBar, string> = {
  own_neutral: 'You sail under neutral colours: you fire on no captain and board none. Change them in port.',
  their_neutral: 'She sails under neutral colours: no captain may fire on her or board her.',
  not_enemies: 'Her city is at peace with yours: hoist the pirate flag in port to attack her.',
};
export const PENNANT_SAY = 'Green Pennant: a young captain sails under protection here.';
export const NO_BOARD_OWN = 'Boarding is off on your ship: guns only. Turn it on in port.';
export const NO_BOARD_HER = 'Boarding is off on her ship: guns only, until one of you sinks.';

/** The colours she flies. */
export function coloursOf(p: Profile | null | undefined): Colours {
  return p?.pvp.flag ?? 'faction';
}

/** The city whose colours she flies under the city flag: the port's she hoisted them in. A save from before the colours
 *  takes her oath's (the Code: the Red Tide; a letter of marque: the Crown), else her last port's. */
export function cityOf(game: Game, p: Profile): FactionId {
  if (p.pvp.city) return p.pvp.city;
  const c: FactionId = p.oath === 'code' ? 'confederacy' : p.oath === 'marque' ? 'crown' : game.portById(p.docked ?? p.lastPort)?.faction ?? 'free';
  p.pvp.city = c;
  return c;
}

/** Two captains whose cities are at enmity, or whose guilds are at war. */
export function enemies(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const pa = game.profileOf(a), pb = game.profileOf(b);
  if (pa && pb && citiesHostile(cityOf(game, pa), cityOf(game, pb))) return true;
  return atWar(game, a, b);
}

/** The Green Pennant (docs/02 §10, docs/24): a young captain under her city's flag who has fired on no captain in half
 *  an hour — neutral to other captains in contested water, though she may fire first (and so strike it). */
export function hasPennant(game: Game, p: Profile): boolean {
  return coloursOf(p) === 'faction' && p.level < PENNANT_LEVEL && p.pvp.played < PENNANT_SECONDS && game.wallNow() - p.pvp.aggressedAt > PENNANT_AGGRESSED_MS;
}

/** Why the colours bar captain `a` from captain `b` (their own ships), or null. */
export function coloursBlocked(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  const pa = game.profileOf(a), pb = game.profileOf(b);
  if (!pa || !pb || a.accountId === b.accountId) return null;
  const ca = coloursOf(pa), cb = coloursOf(pb);
  // The pennant shields her one way only: the young captain may still fire first.
  if (ca !== 'neutral' && REGIONS[b.region].safety === 'contested' && hasPennant(game, pb)) return PENNANT_SAY;
  const bar = coloursBar(ca, cb, ca === 'faction' && cb === 'faction' && enemies(game, a, b));
  return bar ? COLOURS_SAY[bar] : null;
}

/** «Абордаж: выкл» (docs/24 C1): a captain's ship that boards nobody and is boarded by nobody. */
export function boardingOff(game: Game, ship: ShipEntity): boolean {
  return ship.accountId !== null && !!game.profileOf(ship)?.noBoard;
}

/** A fight between two captains (or their ships): the last of it, for the colours' wait in port. */
export function markPvp(game: Game, a: ShipEntity | null, b: ShipEntity | null): void {
  const own = (x: ShipEntity | null) => (x?.accountId !== null && x?.accountId !== undefined ? x : x && x.ownerId !== null ? game.ships.get(x.ownerId) ?? null : null);
  const ca = own(a), cb = own(b);
  if (!ca || !cb || ca.accountId === null || cb.accountId === null || ca.accountId === cb.accountId) return;
  const now = game.wallNow();
  for (const c of [ca, cb]) {
    const p = game.profileOf(c);
    if (p) p.pvp.pvpAt = now;
  }
}

/** Neutral colours are refused her: why, or null. */
export function neutralRefused(p: Profile): string | null {
  return wantedLevel(p.infamy) > NEUTRAL_WANTED_MAX ? 'The harbour master will not register neutral colours for a captain the law wants.' : null;
}

/** When colours ordered now would go up (wall ms): a minute, and never within ten of her last fight with a captain. */
export function hoistAt(game: Game, p: Profile): number {
  return Math.max(game.wallNow() + COLOURS_HOIST_MS, (p.pvp.pvpAt ?? 0) + COLOURS_FIGHT_MS);
}

/** «New colours in N min» and «they are up», a whole sentence each (the client's tables read whole sentences). */
function goUp(flag: Colours, mins: number): string {
  return flag === 'neutral' ? `Neutral colours go up in ${mins} min, if you are still in port.` : flag === 'pirate' ? `The pirate flag goes up in ${mins} min, if you are still in port.` : `Your city’s colours go up in ${mins} min, if you are still in port.`;
}
const UP: Record<Colours, string> = { neutral: 'Neutral colours are up.', faction: 'Your city’s colours are up.', pirate: 'The pirate flag is up.' };

/** Order new colours (in port only): they go up when `hoistAt` says, if she is still in port. */
export function setColours(game: Game, s: PlayerSession, flag: Colours): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return 'No ship';
  if (!ship.docked) return 'Colours are changed only in port.';
  const port = game.portById(ship.docked);
  if (flag === 'neutral') {
    const no = neutralRefused(p);
    if (no) return no;
  }
  // The city flag is the city's whose port she is in (or her guild's, which she flies over it).
  if (flag === p.pvp.flag && (flag !== 'faction' || !port || port.faction === cityOf(game, p))) {
    if (p.pvp.next) {
      p.pvp.next = null;
      p.pvp.nextAt = 0;
      p.pvp.nextCity = null;
      game.sendTo(s, { t: 'toast', msg: 'The order for new colours is struck: yours stay.', kind: 'info' });
      game.pushSelf(s, true);
    }
    return null;
  }
  p.pvp.next = flag;
  p.pvp.nextCity = flag === 'faction' && port ? port.faction : null;
  p.pvp.nextAt = hoistAt(game, p);
  const mins = Math.max(1, Math.ceil((p.pvp.nextAt - game.wallNow()) / 60_000));
  game.sendTo(s, { t: 'toast', msg: goUp(flag, mins), kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

/** «Абордаж: выкл» on or off (in port only, at once). */
export function setNoBoard(game: Game, s: PlayerSession, on: boolean): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return 'No ship';
  if (!!p.noBoard === on) return null;
  if (!ship.docked) return 'Boarding is turned on or off only in port.';
  p.noBoard = on;
  game.sendTo(s, { t: 'toast', msg: on ? 'Boarding is off: your ship boards nobody and nobody boards her. Guns only.' : 'Boarding is on again.', kind: 'info' });
  syncColours(game, s);
  game.pushSelf(s, true);
  return null;
}

/** The colours ordered go up (or are struck, if she left port first); her ship carries what the world sees. */
export function coloursSecond(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  cityOf(game, p);
  if (p.pvp.next) {
    if (!ship.docked) coloursOnUndock(game, s);
    else if (game.wallNow() >= p.pvp.nextAt) {
      const flag = p.pvp.next;
      if (flag === 'neutral' && neutralRefused(p)) {
        game.sendTo(s, { t: 'toast', msg: neutralRefused(p)!, kind: 'bad' });
      } else {
        p.pvp.flag = flag;
        if (p.pvp.nextCity) p.pvp.city = p.pvp.nextCity;
        game.sendTo(s, { t: 'toast', msg: UP[flag], kind: flag === 'pirate' ? 'bad' : 'good' });
      }
      p.pvp.next = null;
      p.pvp.nextCity = null;
      p.pvp.nextAt = 0;
      game.pushSelf(s, true);
    }
  }
  syncColours(game, s);
}

/** Her ship carries her colours for the world's eyes (ShipInfo); a change sends her info anew. */
export function syncColours(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  const city = coloursOf(p) === 'faction' ? cityOf(game, p) : null;
  if (ship.city !== city) {
    ship.city = city;
    game.refreshInfo(ship);
  }
}

/** She sailed before her new colours went up: the order is struck. */
export function coloursOnUndock(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p?.pvp.next) return;
  p.pvp.next = null;
  p.pvp.nextCity = null;
  p.pvp.nextAt = 0;
  game.sendTo(s, { t: 'toast', msg: 'You sailed before your new colours went up: the order is struck.', kind: 'bad' });
  game.pushSelf(s, true);
}

/** The law wants her (Wanted «Known Pirate»): neutral colours come down at once, to her city's. */
export function coloursOnWanted(game: Game, ship: ShipEntity, p: Profile): void {
  if (coloursOf(p) !== 'neutral' || !neutralRefused(p)) return;
  p.pvp.flag = 'faction';
  if (p.pvp.next === 'neutral') {
    p.pvp.next = null;
    p.pvp.nextAt = 0;
  }
  game.toastShip(ship, 'The law wants you: your neutral colours are struck, and your city’s go up.', 'bad');
  const s = game.sessionOf(ship);
  if (s) syncColours(game, s);
}

/** One of the sea's pirates and a neutral captain he sees (owner: «только пираты NPC могут нападать иногда, очень
 *  редко»): he dares, a tenth as often as he would come for anyone, and keeps his mind ten minutes. */
export function pirateDares(game: Game, brain: NpcBrain | undefined, prey: ShipEntity): boolean {
  if (!brain) return cr(game).chance(NEUTRAL_PIRATE_RATE);
  brain.dares ??= new Map();
  const now = game.now;
  const v = brain.dares.get(prey.id);
  if (v !== undefined && Math.abs(v) > now) return v > 0;
  const bold = cr(game).chance(NEUTRAL_PIRATE_RATE);
  brain.dares.set(prey.id, bold ? now + NEUTRAL_MIND_SEC : -(now + NEUTRAL_MIND_SEC));
  return bold;
}

/** A pirate put out after her by the sea (a hunt, an ambush, a tavern's tip): spared her under neutral colours nine
 *  times in ten. */
export function neutralSpared(game: Game, prey: ShipEntity): boolean {
  return coloursOf(game.profileOf(prey)) === 'neutral' && !cr(game).chance(NEUTRAL_PIRATE_RATE);
}

/** A pirate put out after her by the sea came for her: his mind is made up (a neutral captain is his prey after all). */
export function pirateSworn(game: Game, brain: NpcBrain | undefined, prey: ShipEntity): void {
  if (!brain || coloursOf(game.profileOf(prey)) !== 'neutral') return;
  brain.dares ??= new Map();
  brain.dares.set(prey.id, game.now + NEUTRAL_MIND_SEC);
}
