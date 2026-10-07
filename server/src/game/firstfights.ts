// The first three fights (docs/23 item 81): short and winnable. A new captain's (one who took the First Watch; «I know
// the sea» is an old hand's word) first FIRST_FIGHTS fights with one of the
// sea's ships of about her level are softened the moment they begin — «Атаковать», the grapples, or the first ball
// either way: her hull is cut to a share (the guns finish her in a few broadsides, or she strikes), her men thinned
// (the hex battle is won in a few rounds), and what she fires at the novice hurts less. The fight counts as one of the
// three when she is gone — sunk, struck, taken. No dice of its own: the same fight softens the same way.

import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { closestOnPolygon } from '../../../shared/src/math.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { autosailOf } from './autosail.ts';
import type { Game } from './Game.ts';
import { FIRST_FIGHTS, fresh, onboardingProtected } from './onboarding.ts';
import { pursuitOf } from './pursuit.ts';
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

/** The ship of the sea each novice is fighting her easy fight with (entity id), per captain's ship — her ship, not her
 *  session: a reconnect takes the same ship over in a new session, and a map keyed by the session forgot the fight (it
 *  never counted, so the softening never ran out; docs/23 item 94). */
const foes = new WeakMap<ShipEntity, number>();

/** Whether this ship of the sea may be a novice's easy fight: one on the ladder near her level, no boss, no legend. */
function softenable(ship: ShipEntity, foe: ShipEntity): boolean {
  if (!foe.npcRole || foe.isPlayer || !foe.alive || foe.sinkingUntil || foe.surrendered || foe.prize) return false;
  if (!foe.onLadder || foe.npcRole === 'beast' || foe.cls.monster || foe.zoneBoss || foe.bossOf || foe.bossPart || foe.named || foe.namedMate || foe.dutchman || foe.caravanId) return false;
  // Nor a group contract's elite, nor another captain's own escort (docs/23 item 94).
  if (foe.elite || foe.ownerId !== null) return false;
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
  // Softened for another novice still at sea (one gone from the sea leaves her free).
  if (foe.softFor !== undefined && game.ships.get(foe.softFor)?.alive) return;
  // One at a time: a second ship that joins in fights as she is.
  const cur = foes.get(me);
  if (cur !== undefined && cur !== foe.id && game.ships.get(cur)?.alive) return;
  foe.softFor = me.id;
  foes.set(me, foe.id);
  // The First Watch's raider is a lesson in boarding, kept for it (her own floor of men, round shot only): cut to half
  // her hull, the gun crews and the bump of the run-in sank her before the grapples could bite.
  if (game.npcs.get(foe.id)?.practice !== undefined) return;
  foe.hull = Math.min(foe.hull, foe.stats.hullMax * SOFT_HULL);
  if (opts.army !== false) {
    const thin: ArmyStack[] = foe.army.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * SOFT_MEN)) }));
    foe.setArmy(thin);
  }
}

/** What a softened foe deals to her novice: `dmg` scaled. Any other pair: 1. */
export function softDealt(game: Game, source: ShipEntity | null, target: ShipEntity): number {
  if (!source?.npcRole || !target.isPlayer) return 1;
  return source.softFor === target.id ? SOFT_DEALT : 1;
}

/** A first fight with no shot either way this long (s), and no boarding or pursuit of her, is over. */
export const FIGHT_QUIET = 20;
/** A captain in her first quarter of an hour, at sea with nothing to fight this many seconds: a pirate comes for her
 *  (docs/23 item 82: after the First Watch the newcomer's run sailed about with no mark and no button to press — the
 *  game is to close on a ship and board her, so the first fights come to her). */
export const FOE_IDLE = 25;
/** Seconds idle, and the pirate brought last (entity id), per captain's ship (see `foes`). */
const idle = new WeakMap<ShipEntity, { secs: number; foe: number | null }>();
/** A pirate brought to an idle novice leaves the sea this long after, once no captain is near (npc.ts expiresAt): they
 *  were never struck off, a novice who outsailed them got another every 25 s, each kept for good against the world's
 *  pirate quota (docs/23 item 96). */
export const FOE_BROUGHT_LIFE = 600;

/** Once a second for each captain: her easy foe gone (sunk, struck, taken) is one of the three behind her; lost far
 *  astern, she is let go and does not count. Idle with none, one is brought. */
export function firstFightsSecond(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  const id = foes.get(ship);
  if (id === undefined) return void bringFoe(game, s);
  const foe = game.ships.get(id);
  // Over: sunk, struck, taken — or let go (ransomed, released: she sails on, the fight done). A fight that has gone
  // quiet for FIGHT_QUIET seconds, with no boarding and no «Атаковать» on her, is over too (the 2026-10-06 newcomer's
  // run: the lesson's raider, ransomed, sailed on beside her and kept the next two fights from being softened).
  const quiet = !!foe && game.now - Math.max(foe.lastCombat, ship.lastCombat) > FIGHT_QUIET && !ship.boarding && !s.pendingBoarding && pursuitOf(ship)?.target !== foe.id;
  const over = !foe || !foe.alive || !!foe.sinkingUntil || foe.surrendered || foe.prize || quiet;
  if (over) {
    foes.delete(ship);
    if (foe) foe.softFor = undefined;
    p.tutorial.easy = Math.min(FIRST_FIGHTS, (p.tutorial.easy ?? FIRST_FIGHTS) + 1);
    return;
  }
  if (!ship.boarding && Math.hypot(foe.state.x - ship.state.x, foe.state.y - ship.state.y) > 3500) {
    foes.delete(ship);
    foe.softFor = undefined;
  }
}

function bringFoe(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  if (!ship || !s.profile) return;
  let w = idle.get(ship);
  if (!w) idle.set(ship, (w = { secs: 0, foe: null }));
  // Only in a captain's first quarter of an hour, out at sea, free, and not in the First Watch (its raider is the
  // lesson's). The first three are softened when they begin; after them, one a level below hers.
  if (!fresh(s.profile) || onboardingProtected(s) || ship.docked || ship.boarding || ship.grappled || s.pendingBoarding || autosailOf(ship) || ship.inCombat(game.now) || !ship.alive) {
    w.secs = 0;
    return;
  }
  // The one brought before still about: she is the mark.
  const prev = w.foe !== null ? game.ships.get(w.foe) : undefined;
  if (prev?.alive && Math.hypot(prev.state.x - ship.state.x, prev.state.y - ship.state.y) < 3500) return;
  let near = false;
  game.forShipsNear(ship.state.x, ship.state.y, 2000, (o) => {
    if (!near && o.id !== ship.id && o.alive && o.npcRole && game.isHostile(o, ship)) near = true;
  });
  if (near) {
    w.secs = 0;
    return;
  }
  if (++w.secs < FOE_IDLE) return;
  w.secs = 0;
  for (const off of [0.6, -0.6, 1.4, -1.4, 0]) {
    const a = ship.state.heading + off;
    const x = ship.state.x + Math.sin(a) * 1000, y = ship.state.y - Math.cos(a) * 1000;
    if (coast(game, x, y)) continue;
    const foe = game.spawnNpcShip('pirate', ship.loadout.classId, 'confederacy', x, y, a + Math.PI);
    // Her own level while her easy fights last (softened when it starts), then one below.
    game.setNpcLevel(foe, Math.max(1, ship.shipLevel - (easyLeft(s) > 0 ? 0 : 1)));
    const brain = game.npcs.get(foe.id);
    if (brain) {
      brain.expiresAt = game.now + FOE_BROUGHT_LIFE;
      brain.area = { x: ship.state.x, y: ship.state.y, r: 3000 };
      brain.chase = { id: ship.id, until: game.now + 120 };
      brain.target = ship.id;
    }
    w.foe = foe.id;
    return;
  }
}

function coast(game: Game, x: number, y: number): boolean {
  for (const id of islandsNear(game.world, x, y)) {
    const is = game.world.islands[id];
    if (Math.sqrt(closestOnPolygon(x, y, is.poly).d2) < 250) return true;
  }
  return false;
}
