// Docking (owner, 2026-10-22: «Взаимодействие с объектами … на расстоянии 30 метров»): a harbour is entered only from its
// approach — her hull within REACH_DOCK of its anchorage (the water off its quays, LANDING_R about the point) or of a
// pier or a stretch of its quay wall, a floating town's moored hulks — and slow (DOCK_SLOW). The server's «Причалить»,
// the client's button and the helmsman's run home all ask this one test (shared/src/data/reach.ts).

import { LANDING_R, REACH_DOCK, gapTo, gapToShore } from '../data/reach.ts';
import type { Hull } from '../data/reach.ts';
import { hullClearance } from '../sim/hull.ts';
import { quayBlockers } from './solids.ts';

export interface DockPort {
  id?: string;
  faction?: string;
  x: number;
  y: number;
  size: number;
  raft?: boolean;
}

/** Metres of water between her hull and a harbour's approach: its anchorage, its quays, a floating town's hulks. */
export function dockGap(h: Hull, port: DockPort, island: { x: number; y: number; r: number; poly: ArrayLike<number> } | null): number {
  let g = gapTo(h, port.x, port.y, LANDING_R);
  if (g <= REACH_DOCK || !island) return g;
  if (Math.hypot(port.x - h.x, port.y - h.y) > 700 + h.length) return g;
  if (port.raft) return Math.min(g, gapToShore(h, island.poly));
  const quays = quayBlockers(port, island);
  if (quays.length) g = Math.min(g, hullClearance(h, h.length, h.beam, quays) + 3);
  return g;
}

/** Within the harbour's approach (`slack`: the server's allowance). */
export function dockWithin(h: Hull, port: DockPort, island: { x: number; y: number; r: number; poly: ArrayLike<number> } | null, slack = 0): boolean {
  return dockGap(h, port, island) <= REACH_DOCK + slack;
}
