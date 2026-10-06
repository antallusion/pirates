// The first three fights (docs/23 item 81): short and winnable. A new captain's (one who took the First Watch; «I know
// the sea» is an old hand's word) first FIRST_FIGHTS fights with one of the
// sea's ships of about her level are softened the moment they begin — «Атаковать», the grapples, or the first ball
// either way: her hull is cut to a share (the guns finish her in a few broadsides, or she strikes), her men thinned
// (the hex battle is won in a few rounds), and what she fires at the novice hurts less. The fight counts as one of the
// three when she is gone — sunk, struck, taken. No dice of its own: the same fight softens the same way.

import type { ArmyStack } from '../../../shared/src/data/army.ts';
import type { Game } from './Game.ts';
import { FIRST_FIGHTS } from './onboarding.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** Her hull is cut to this share of its most when a first fight begins. */
export const SOFT_HULL = 0.5;
/** Her men: this share of each stack stays. */
export const SOFT_MEN = 0.55;
/** What she deals to the novice: this share of it. */
export const SOFT_DEALT = 0.4;
/** A first fight is with a ship at most this many levels above the captain's. */
export const SOFT_LEVELS = 1;

/** The ship of the sea each novice is fighting her easy fight with (entity id), per session. */
const foes = new WeakMap<PlayerSession, number>();

/** Whether this ship of the sea may be a novice's easy fight: one on the ladder near her level, no boss, no legend. */
function softenable(ship: ShipEntity, foe: ShipEntity): boolean {
  if (!foe.npcRole || foe.isPlayer || !foe.alive || foe.sinkingUntil || foe.surrendered || foe.prize) return false;
  if (!foe.onLadder || foe.npcRole === 'beast' || foe.cls.monster || foe.zoneBoss || foe.bossOf || foe.bossPart || foe.named || foe.namedMate || foe.dutchman || foe.caravanId) return false;
  return foe.combatLevel <= ship.combatLevel + SOFT_LEVELS;
}

/** How many easy fights she has left (0 for an old hand). */
export function easyLeft(s: PlayerSession | null | undefined): number {
  const t = s?.profile?.tutorial;
  return t ? Math.max(0, FIRST_FIGHTS - (t.easy ?? FIRST_FIGHTS)) : 0;
}

/** A fight begins between a captain's ship and one of the sea's (either order): within her first three, the foe is
 *  softened. `army: false` leaves her men as they are (the First Watch's raider has her own). */
export function softenFoe(game: Game, a: ShipEntity, b: ShipEntity, opts: { army?: boolean } = {}): void {
  const [me, foe] = a.isPlayer && !b.isPlayer ? [a, b] : b.isPlayer && !a.isPlayer ? [b, a] : [null, null];
  if (!me || !foe) return;
  const s = game.sessionOf(me);
  if (!s || easyLeft(s) <= 0 || !softenable(me, foe)) return;
  if (foe.softFor !== undefined) return;
  // One at a time: a second ship that joins in fights as she is.
  const cur = foes.get(s);
  if (cur !== undefined && cur !== foe.id && game.ships.get(cur)?.alive) return;
  foe.softFor = me.id;
  foes.set(s, foe.id);
  foe.hull = Math.min(foe.hull, foe.stats.hullMax * SOFT_HULL);
  if (opts.army !== false && game.npcs.get(foe.id)?.practice === undefined) {
    const thin: ArmyStack[] = foe.army.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * SOFT_MEN)) }));
    foe.setArmy(thin);
  }
}

/** What a softened foe deals to her novice: `dmg` scaled. Any other pair: 1. */
export function softDealt(game: Game, source: ShipEntity | null, target: ShipEntity): number {
  if (!source?.npcRole || !target.isPlayer) return 1;
  return source.softFor === target.id ? SOFT_DEALT : 1;
}

/** Once a second for each captain: her easy foe gone (sunk, struck, taken) is one of the three behind her; lost far
 *  astern, she is let go and does not count. */
export function firstFightsSecond(game: Game, s: PlayerSession): void {
  const id = foes.get(s);
  const p = s.profile, ship = s.ship;
  if (id === undefined || !p || !ship) return;
  const foe = game.ships.get(id);
  const over = !foe || !foe.alive || !!foe.sinkingUntil || foe.surrendered || foe.prize;
  if (over) {
    foes.delete(s);
    p.tutorial.easy = Math.min(FIRST_FIGHTS, (p.tutorial.easy ?? FIRST_FIGHTS) + 1);
    return;
  }
  if (!ship.boarding && Math.hypot(foe.state.x - ship.state.x, foe.state.y - ship.state.y) > 3500) {
    foes.delete(s);
    foe.softFor = undefined;
  }
}
