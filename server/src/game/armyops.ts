// The captain's own hand on her army aboard (owner, 2026-10-28: «дай возможность разделять пачку армии на маленькие
// пачки прям на корабле»): HoMM3's split (a stack's men into a new stack of their own, in a free slot), merge (a
// stack dropped on one of its kind) and dismiss (a stack paid off over the side, to make room). The server weighs it
// all: the slots her class carries, the same kind only, a gift stack (shared/src/data/army.ts `g`) never with hired
// men — its split parts stay gifts.

import { UNITS, armyMerge, armySplit, stackKey } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { reconcile } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { landFightOn } from './beastlairs.ts';
import { tameOf } from './tame.ts';

export type ArmyMsg = Extract<ClientMsg, { t: 'army' }>;

/** Not in a fight: the army is on deck. */
function armyBusy(game: Game, s: PlayerSession): string | null {
  const ship = s.ship;
  if (!s.profile || !ship || !ship.alive) return 'Not now';
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  if (landFightOn(game, s)) return 'Your party is ashore already.';
  return null;
}

/** Her army set anew by her own hand (the gun's last wound kept: a split is no surgeon). */
function setOwn(game: Game, s: PlayerSession, army: ArmyStack[]): void {
  const ship = s.ship!;
  const wound = ship.shotWound;
  ship.setArmy(army);
  ship.shotWound = wound;
  ship.companyKey = '';
  game.pushSelf(s, true);
}

export function armySplitOp(game: Game, s: PlayerSession, key: string, n: number): string | null {
  const busy = armyBusy(game, s);
  if (busy) return busy;
  const ship = s.ship!;
  const out = armySplit(ship.army, String(key ?? ''), n, ship.armySlots);
  if (typeof out === 'string') return out;
  setOwn(game, s, out);
  return null;
}

export function armyMergeOp(game: Game, s: PlayerSession, from: string, to: string): string | null {
  const busy = armyBusy(game, s);
  if (busy) return busy;
  const ship = s.ship!;
  const out = armyMerge(ship.army, String(from ?? ''), String(to ?? ''));
  if (typeof out === 'string') return out;
  setOwn(game, s, out);
  return null;
}

/** A whole stack paid off (split the few off first to keep the rest). One stack at least stays aboard. */
export function armyDismissOp(game: Game, s: PlayerSession, key: string): string | null {
  const busy = armyBusy(game, s);
  if (busy) return busy;
  const ship = s.ship!;
  const st = ship.army.find((x) => stackKey(x) === String(key ?? ''));
  if (!st) return 'No such stack aboard';
  if (ship.army.length <= 1) return 'Keep at least one stack aboard';
  const u = st.u, n = st.n;
  ship.loseFrom(u, n, stackKey(st));
  reconcile(game, s.profile!.company, ship.crew);
  if (UNITS[u]?.beast && !ship.army.some((x) => x.u === u)) delete tameOf(s.profile!).k[u];
  ship.companyKey = '';
  game.toastShip(ship, `${n} of your men are paid off and go over the side: a slot is free.`, 'info');
  game.pushSelf(s, true);
  return null;
}

export function armyMessage(game: Game, s: PlayerSession, msg: ArmyMsg): void {
  const why = msg.op === 'split' ? armySplitOp(game, s, msg.k, Math.trunc(Number(msg.n))) : msg.op === 'merge' ? armyMergeOp(game, s, msg.k, msg.to) : msg.op === 'dismiss' ? armyDismissOp(game, s, msg.k) : 'Not now';
  if (why) game.sendTo(s, { t: 'err', msg: why });
}
