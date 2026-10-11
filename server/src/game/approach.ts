// Sail-to on tap (seaux, owner 2026-10-11: «Случайные события … я могу нажать и они сразу срабатывают не подплывая к
// конкретной цели. Это тупо. Я должен нажать и плыть к цели … я должен плыть туда куда нажал»).
//
// An order at a thing out of its reach is neither done from afar nor refused: the handler that finds her too far hands
// it here; the helmsman takes her to the thing (autosail.ts — her screen draws the course and the ring at its end);
// and the very same order is given again the moment she is within the thing's reach. The handler measures the reach
// again then, so nothing is ever done at a distance — the server's own rule, whatever a client sends. One order waits
// at a time; it is dropped by the stop on the helmsman's pill, a mark of her own on the chart, «Атаковать», her ship
// sunk, grappled or in port, the thing gone, or its time out.

import { AUTOSAIL_ARRIVE } from '../../../shared/src/data/autosail.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { autosailOf, startAutosail, stopAutosail } from './autosail.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { pursuitOf } from './pursuit.ts';

/** What she is sent to: where it lies (or a reader of where it is now, for a thing that moves or goes), and the reach
 *  within which its order may be done (or the handler's own test of it, for a reach measured from a shore). */
export interface ApproachTarget {
  x: number;
  y: number;
  reach: number;
  where?: () => { x: number; y: number } | null;
  near?: () => boolean;
}

interface Approach extends ApproachTarget {
  msg: ClientMsg;
  until: number;
}

/** An order waits this long at most (seconds of the sea's clock): past it, the moment is gone. */
export const APPROACH_SEC = 240;
/** What she is told (the info line, not a refusal), when the helmsman takes her there and when he cannot. */
export const APPROACH_SET = 'Course set: it is done as soon as she is alongside.';
export const APPROACH_OWN = 'Sail up to it: it is done as soon as she is alongside.';
export const APPROACH_GONE = 'It is gone before she came up with it.';
export const APPROACH_LATE = 'She did not come up with it in time: the order is dropped.';

const orders = new WeakMap<Game, Map<PlayerSession, Approach>>();
/** The captains whose order is being given again on arrival (a second «too far» then is a refusal, never a loop). */
const redoing = new WeakSet<PlayerSession>();

function book(game: Game): Map<PlayerSession, Approach> {
  let m = orders.get(game);
  if (!m) orders.set(game, (m = new Map()));
  return m;
}

/** The order waiting for her arrival, if any (tests, the HUD's line). */
export function approachOf(game: Game, s: PlayerSession): { x: number; y: number; reach: number; msg: ClientMsg } | null {
  const a = orders.get(game)?.get(s);
  return a ? { x: a.x, y: a.y, reach: a.reach, msg: a.msg } : null;
}

/** Where the helmsman's own mark ends for a thing of this reach: well inside it (the reach is measured to the thing,
 *  the route ends on the water by it). */
function arriveFor(reach: number): number {
  return Math.max(30, Math.min(AUTOSAIL_ARRIVE, reach * 0.55));
}

/** A handler found her out of reach of `t` for the order being handled: the helmsman takes her there and the order
 *  is given again when she is within reach. Null when it waits so (no refusal); `far` back when it cannot (the order
 *  was already the one given on arrival, or there is no order being handled) — the handler refuses with it. */
export function approach(game: Game, s: PlayerSession, t: ApproachTarget, far: string): string | null {
  const ship = s.ship;
  const msg = game.orderOf(s);
  if (!ship || !msg || redoing.has(s) || ship.docked || !ship.alive) return far;
  const m = book(game);
  m.set(s, { ...t, msg, until: game.now + APPROACH_SEC });
  const p = t.where?.() ?? t;
  const run = autosailOf(ship);
  // Already on her way there (a second tap on the same thing): the course stands, nothing more is said.
  if (run && Math.hypot(run.x - p.x, run.y - p.y) < 60) return null;
  const e = startAutosail(game, s, p.x, p.y, undefined, arriveFor(t.reach));
  game.sendTo(s, { t: 'toast', msg: e ? APPROACH_OWN : APPROACH_SET, kind: 'info' });
  return null;
}

/** The order dropped (the pill's stop, a mark of her own, a new order of another kind). */
export function cancelApproach(game: Game, s: PlayerSession): void {
  orders.get(game)?.delete(s);
}

/** Every tick, before the helmsmen steer: each waiting order — given again within reach, its course kept on a moving
 *  thing, or dropped. Costs nothing with no order waiting (only the captains with one are looked at). */
export function stepApproach(game: Game): void {
  const m = orders.get(game);
  if (!m || !m.size) return;
  for (const [s, a] of m) {
    const ship = s.ship;
    if (!ship || !ship.alive || ship.docked || ship.boarding || ship.grappled || s.disconnectedAt !== null || pursuitOf(ship)) {
      m.delete(s);
      continue;
    }
    if (game.now > a.until) {
      m.delete(s);
      game.sendTo(s, { t: 'toast', msg: APPROACH_LATE, kind: 'info' });
      continue;
    }
    const p = a.where ? a.where() : a;
    if (!p) {
      m.delete(s);
      if (autosailOf(ship)) stopAutosail(game, s, 'off');
      game.sendTo(s, { t: 'toast', msg: APPROACH_GONE, kind: 'info' });
      continue;
    }
    // (a little inside the handler's own reach: its test then never says «too far» by a metre)
    const at = a.near ? a.near() : Math.hypot(p.x - ship.state.x, p.y - ship.state.y) <= Math.max(10, a.reach - 8);
    if (at) {
      m.delete(s);
      if (autosailOf(ship)) stopAutosail(game, s, 'arrived');
      redoing.add(s);
      try {
        game.redo(s, a.msg);
      } finally {
        redoing.delete(s);
      }
      continue;
    }
    // A thing that moves (a drift, a raft on the current): the course follows it.
    const run = autosailOf(ship);
    if (run && Math.hypot(run.x - p.x, run.y - p.y) > 120) startAutosail(game, s, p.x, p.y, run.sail, arriveFor(a.reach));
  }
}
