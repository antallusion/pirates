// The grapples at a hundred metres (owner, 2026-10-30: «абордаж должен быть доступен на расстоянии 100м, причем надо
// показать после кнопки сближение кораблей если кто-то прожал абордаж, а не прям сразу фигарить. то есть кнопка абордажа
// становится доступна на расстоянии 100м»).
//
// A captain's «На абордаж» is offered once her mark's hull lies within BOARD_OFFER of hers (reach.ts: hull edge to hull
// edge, any bearing, any way). Pressed, the grapples fly and the two ships are hauled together over grappleSecs (2–4 s):
// she to her spot alongside the mark (reach.ts alongsidePoint, on the side she lies), her head brought round to the mark's,
// both ways eased to one — the lighter hull moves the more. While the lines hold the mark cannot sail off: whatever her
// helm, she is drawn to the boarder (and nobody else may board either of them). Alongside, the battle opens
// (boarding.ts startBoarding). The ships at sea (npc.ts) still come alongside under their own helm, as before.

import { BOARD_OFFER, REACH_SLACK, alongsidePoint, grappleSecs, hullOf, hullsGap } from '../../../shared/src/data/reach.ts';
import { angleDiff, wrapAngle } from '../../../shared/src/math.ts';
import type { Aggression } from '../../../shared/src/protocol.ts';
import { BOARD_ABEAM, BOARD_FAR, BOARD_SPEED, canBoard, crewRefuses, startBoarding } from './boarding.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

/** Said beyond the offer's reach: the metres still to close. */
export const GRAPPLE_FAR = 'Come closer: {0} m';
export const GRAPPLE_THROWN = 'Grapples away: hauling her alongside';
export const GRAPPLE_TAKEN = 'Grapples in your side: she is hauling you alongside';
export const GRAPPLE_PARTED = 'The grapples part: the boarding is off';

/** Why `a` may not throw her grapples at `b` now (every rule of canBoard but the lie of the hulls, which the hauling sees
 *  to: within BOARD_OFFER of water instead), or null. */
export function grappleWhy(game: Game, a: ShipEntity, b: ShipEntity): string | null {
  if (a.grapple || b.grapple) return 'Already locked in a boarding action';
  const why = canBoard(game, a, b);
  if (why === null) return null;
  if (why !== BOARD_FAR && why !== BOARD_ABEAM && why !== BOARD_SPEED) return why;
  const gap = hullsGap(hullOf(a), hullOf(b));
  if (gap > BOARD_OFFER + REACH_SLACK) return GRAPPLE_FAR.replace('{0}', String(Math.max(1, Math.ceil(gap - BOARD_OFFER))));
  return crewRefuses(a);
}

/** The grapples fly from `a` to `b`: the hauling starts (the caller has asked grappleWhy). */
export function startGrapple(game: Game, a: ShipEntity, b: ShipEntity, aggression: Aggression): void {
  const now = game.now;
  const gap = Math.max(0, hullsGap(hullOf(a), hullOf(b)));
  const until = now + grappleSecs(gap);
  const side = alongsidePoint(hullOf(a), hullOf(b)).side;
  a.grapple = { with: b.id, attacker: true, from: now, until, side, aggression };
  b.grapple = { with: a.id, attacker: false, from: now, until, side, aggression };
  a.repairing = false;
  b.repairing = false;
  a.lastCombat = now;
  b.lastCombat = now;
  game.emit({ k: 'grapple', a: a.id, b: b.id, until: Math.round(until * 10) / 10 }, a.state.x, a.state.y);
  if (a.isPlayer) game.toastShip(a, GRAPPLE_THROWN, 'info');
  if (b.isPlayer) game.toastShip(b, GRAPPLE_TAKEN, 'bad');
}

/** The lines let go (a ship sunk, docked, gone, or taken into another fight). */
function part(game: Game, a: ShipEntity, b: ShipEntity | undefined, say: boolean): void {
  a.grapple = null;
  if (b && b.grapple?.with === a.id) b.grapple = null;
  if (say) {
    if (a.isPlayer) game.toastShip(a, GRAPPLE_PARTED, 'bad');
    if (b?.isPlayer) game.toastShip(b, GRAPPLE_PARTED, 'info');
  }
}

/** Every tick: the hauling, and the battle once alongside. */
export function stepGrapples(game: Game, dt: number): void {
  const now = game.now;
  for (const a of game.ships.values()) {
    const g = a.grapple;
    if (!g) continue;
    const b = game.ships.get(g.with);
    if (!g.attacker) {
      // (the mark's half of the lines: let go if her boarder is gone)
      if (!b || b.grapple?.with !== a.id) a.grapple = null;
      continue;
    }
    if (!b || !a.alive || !b.alive || a.docked || b.docked || a.boarding || b.boarding || b.grapple?.with !== a.id) {
      part(game, a, b, !!b && !a.boarding && !b.boarding);
      continue;
    }
    const left = g.until - now;
    if (left <= 0) {
      a.grapple = null;
      b.grapple = null;
      // Every rule but the lie of the hulls once more (a truce, a battle elsewhere, her crew): the battle, or the lines part.
      const why = canBoard(game, a, b);
      if (why === null || why === BOARD_FAR || why === BOARD_ABEAM || why === BOARD_SPEED) startBoarding(game, a, b, g.aggression);
      else {
        if (a.isPlayer) game.toastShip(a, why, 'bad');
        part(game, a, b, false);
      }
      continue;
    }
    // The hauling: her spot alongside the mark, closed by this tick's share of what is left; the lighter moves the more.
    const spot = alongsidePoint(hullOf(a), hullOf(b), g.side);
    const k = Math.min(1, dt / Math.max(dt, left));
    const ma = Math.max(1, a.stats.hullMax), mb = Math.max(1, b.stats.hullMax);
    const wa = Math.max(0.35, Math.min(0.85, mb / (ma + mb)));
    const dx = (spot.x - a.state.x) * k, dy = (spot.y - a.state.y) * k;
    a.state.x += dx * wa;
    a.state.y += dy * wa;
    b.state.x -= dx * (1 - wa);
    b.state.y -= dy * (1 - wa);
    a.state.heading = wrapAngle(a.state.heading + angleDiff(a.state.heading, spot.heading) * k);
    // Both ways eased to one, and lower as the lines shorten: alongside they lie still for the grapples.
    const mean = (a.state.speed + b.state.speed) / 2;
    a.state.speed += (mean - a.state.speed) * k;
    b.state.speed += (mean - b.state.speed) * k;
    a.state.speed *= 1 - 0.5 * dt;
    b.state.speed *= 1 - 0.5 * dt;
    game.grid.upsert(a.id, a.state.x, a.state.y);
    game.grid.upsert(b.id, b.state.x, b.state.y);
  }
}

/** The boarder lets go of her lines before they bite (her «Отрезать»). */
export function cutGrappling(game: Game, ship: ShipEntity): boolean {
  const g = ship.grapple;
  if (!g) return false;
  const other = game.ships.get(g.with);
  part(game, g.attacker ? ship : other ?? ship, g.attacker ? other : ship, true);
  ship.grapple = null;
  return true;
}
