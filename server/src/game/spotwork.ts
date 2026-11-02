// The work at a spot, as one countdown, and her ship held while it runs (owner, 2026-11-02: «показывай таймер с
// обратным отсчётом и зафиксируй корабль, когда такие квесты делаются»; shared/src/data/spotwork.ts).
//
// What counts: her boats ashore (ship.landing — a landing, the island walked, a lookout, a stockpile hauled, a bared
// bank or a turtle's back combed, a mine's flag, a treasure dug, the divers on a wreck), the Grail dug (grail.ts), the
// boats at a sea mark (seamarks.ts) or a small find (seafinds.ts), a robbery ashore (estate.ts, baseclaim.ts).
//
// The rules, one for all of them:
//  - she rides at anchor the while: no way on her (her speed held at nothing), her sails furled, no wind or current
//    moving her, her heading kept (Game.physics);
//  - her own hand ends it: a sail set, the wheel put over (her hand on it, a half turn and more), or «Прервать» on the
//    countdown — the work broken off and she sails at once. The boats ashore and the divers: called back before half
//    the time is up they bring nothing (and lose nobody: they come back in good order); after it, half the haul. The
//    boats at a mark or a find, the Grail's diggers and a robbery: nothing (their work is short, or all or nothing);
//  - another ship's fire striking her (ShipEntity.underFire) breaks off the landing family and the boats at a mark or
//    a find as before (exploration.ts stepLanding: before half, nothing and up to three in ten of the party lost; after,
//    half); the Grail's diggers and a robbery go on under fire (a robbery is a fight with the island's guns by design).

import type { SpotKind, SpotView } from '../../../shared/src/data/spotwork.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { landingName } from './player.ts';
import { stepLanding } from './exploration.ts';
import { cancelFind, findBusy } from './seafinds.ts';
import { cancelMark, markBusy, markById } from './seamarks.ts';
import { cancelGrailDig, grailDig } from './grail.ts';
import { cancelRobOutpost, robbingOutpost } from './estate.ts';
import { cancelRobIsle, robbingIsle } from './baseclaim.ts';
import { GRAIL_DIG_SECS } from '../../../shared/src/data/advmap.ts';
import { ROB_SEC } from '../../../shared/src/data/estate.ts';
import { ROB_ISLE_SEC } from '../../../shared/src/data/baseclaim.ts';

/** The wheel put over this far by her own hand ends the work (a brush of the stick does not). */
export const SPOT_HELM = 0.5;

/** What the boats at a mark or a find, and a robbery, are told when her hand breaks them off. */
export const SPOT_BOATS_BACK = 'The boats are called back: she made sail.';
export const SPOT_ROB_BACK = 'Your party is called back to the boats: the robbery is off.';

function landingKind(feature: string): SpotKind {
  switch (feature) {
    case 'dive':
      return 'dive';
    case 'dig':
      return 'dig';
    case 'haul':
      return 'haul';
    case 'tidal':
    case 'turtle':
      return 'tidal';
    case 'flag':
      return 'flag';
    case 'scene':
      return 'trek';
    case 'lookout':
      return 'lookout';
  }
  return 'land';
}

/** The work at a spot she has under way now, or null. */
export function spotOf(game: Game, s: PlayerSession): SpotView | null {
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked) return null;
  const l = ship.landing;
  if (l) {
    const kind = landingKind(l.feature);
    const name = kind === 'dive' ? game.wrecks[l.wreckId ?? -1]?.name
      : kind === 'dig' ? s.profile?.explore.maps.find((m) => m.id === l.mapId)?.name
      : kind === 'tidal' ? undefined
      : landingName(l.feature, l.islandId);
    return { kind, ...(name ? { name } : {}), started: l.started, until: l.until, fireBreaks: true };
  }
  const f = findBusy(game, s);
  if (f) return { kind: 'find', name: f.kind, started: f.until - f.total, until: f.until, fireBreaks: true };
  const m = markBusy(game, s);
  if (m) return { kind: 'mark', ...(markById(game, m.id) ? { name: markById(game, m.id)!.kind } : {}), started: m.until - m.total, until: m.until, fireBreaks: true };
  const g = grailDig(game, s.accountId);
  if (g) return { kind: 'grail', started: g.until - GRAIL_DIG_SECS, until: g.until, fireBreaks: false };
  const r = robbingOutpost(game, s.accountId);
  if (r) return { kind: 'rob', started: r.until - ROB_SEC, until: r.until, fireBreaks: false };
  const ri = robbingIsle(game, s.accountId);
  if (ri) return { kind: 'rob', started: ri.until - ROB_ISLE_SEC, until: ri.until, fireBreaks: false };
  return null;
}

/** Her ship held (or let go) by the work at hand: brought up at once when it begins. True when it changed. */
export function holdForSpot(game: Game, s: PlayerSession): boolean {
  const ship = s.ship;
  if (!ship) return false;
  const on = !!spotOf(game, s);
  if (on && !ship.spotHold) {
    ship.state.speed = 0;
    ship.input = { rudder: 0, sailTarget: 0 };
  }
  const changed = on !== ship.spotHold;
  ship.spotHold = on;
  return changed;
}

/** The work broken off by her own hand (a sail set, the wheel, «Прервать»): see the rules above. True if there was
 *  any. */
export function abortSpot(game: Game, s: PlayerSession): boolean {
  const ship = s.ship;
  const v = spotOf(game, s);
  if (!ship || !v) return false;
  if (ship.landing) stepLanding(game, ship, true);
  else if (v.kind === 'find') cancelFind(game, s, SPOT_BOATS_BACK);
  else if (v.kind === 'mark') cancelMark(game, s, SPOT_BOATS_BACK);
  else if (v.kind === 'grail') cancelGrailDig(game, s);
  else if (v.kind === 'rob') {
    if (cancelRobOutpost(game, s.accountId) || cancelRobIsle(game, s.accountId)) game.toastShip(ship, SPOT_ROB_BACK, 'bad');
  }
  ship.spotHold = !!spotOf(game, s);
  game.pushSelf(s, true);
  return true;
}

/** Her helm as it comes (Game 'input', after her sail and wheel are read): a sail set or the wheel put over by her hand
 *  breaks the work off. */
export function spotInput(game: Game, s: PlayerSession, rudder: number, helm: boolean): void {
  const ship = s.ship;
  if (!ship || !ship.spotHold) return;
  if (ship.input.sailTarget > 0 || (helm && Math.abs(rudder) >= SPOT_HELM)) abortSpot(game, s);
}

/** Once a second (Game.sessionSecond): the hold kept in step with the work, and a sail set some other way (the
 *  helmsman's course) breaks it off. */
export function spotSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship) return;
  if (ship.spotHold && ship.input.sailTarget > 0 && spotOf(game, s)) abortSpot(game, s);
  holdForSpot(game, s);
}
