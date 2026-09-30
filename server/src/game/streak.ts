// Win streaks (docs/16 #4). Ships sunk or taken one after another without making port: from the third, every one
// brings more plunder and more experience — ×1.1, ×1.2 … up to ×1.5. Making port ends the streak, and so does
// going down. A ship far below her (grey: no experience) does not count, nor the deep's creatures, nor a ship counted
// once already (boarded, then scuttled).

import { xpForGap } from '../../../shared/src/data/shiplevel.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export const STREAK_FROM = 3;
export const STREAK_STEP = 0.1;
export const STREAK_CAP = 1.5;

/** The bonus of the n-th ship in a row. */
export function streakMul(n: number): number {
  return n >= STREAK_FROM ? Math.min(STREAK_CAP, Math.round((1 + STREAK_STEP * (n - STREAK_FROM + 1)) * 100) / 100) : 1;
}

const counted = new WeakSet<ShipEntity>();

/** The captain's session behind a ship (her own, or the owner of an escort or prize). */
function captainOf(game: Game, ship: ShipEntity | null): PlayerSession | null {
  if (!ship) return null;
  const owner = ship.ownerId !== null ? game.ships.get(ship.ownerId) : null;
  const s = game.sessionOf(owner ?? ship);
  return s?.profile ? s : null;
}

/** Whether this victim adds to a streak at all. */
export function streakCounts(game: Game, killer: ShipEntity, victim: ShipEntity): boolean {
  if (counted.has(victim) || victim.cls.monster || victim.npcRole === 'beast' || victim.npcRole === 'boss' || victim.bossOf) return false;
  const cap = killer.ownerId !== null ? game.ships.get(killer.ownerId) ?? killer : killer;
  const gap = victim.onLadder && cap.onLadder ? victim.combatLevel - cap.combatLevel : 0;
  return xpForGap(gap) > 0;
}

/** The bonus the kill of `victim` brings to her captain (before it is counted): the next in the streak, or the
 *  streak as it stands for a ship already counted. */
export function streakAhead(game: Game, killer: ShipEntity | null, victim: ShipEntity): number {
  const s = captainOf(game, killer);
  if (!s || !killer) return 1;
  const n = s.profile!.streak ?? 0;
  return streakMul(streakCounts(game, killer, victim) ? n + 1 : n);
}

/** A ship sunk or taken: the streak grows; the bonus of this one is returned. */
export function onStreakKill(game: Game, s: PlayerSession, killer: ShipEntity, victim: ShipEntity): number {
  const p = s.profile!;
  if (!streakCounts(game, killer, victim)) return streakMul(p.streak ?? 0);
  counted.add(victim);
  const n = (p.streak = (p.streak ?? 0) + 1);
  const mul = streakMul(n);
  if (n >= STREAK_FROM) game.sendTo(s, { t: 'toast', msg: `${n} ships in a row without making port: plunder and experience ×${mul}.`, kind: 'gold' });
  return mul;
}

/** Making port or going down ends the streak. */
export function endStreak(game: Game, s: PlayerSession, why: 'port' | 'sunk'): void {
  const p = s.profile;
  if (!p || !p.streak) return;
  const n = p.streak;
  p.streak = 0;
  if (n < STREAK_FROM) return;
  game.sendTo(s, { t: 'toast', msg: why === 'port' ? `In port: your streak of ${n} ships ends.` : `Your streak of ${n} ships ends with your ship.`, kind: 'info' });
}

/** What the HUD shows of it. */
export function streakView(p: { streak?: number }): { n: number; mul: number } | null {
  return p.streak ? { n: p.streak, mul: streakMul(p.streak) } : null; // null, not absent: a patch must clear it
}
