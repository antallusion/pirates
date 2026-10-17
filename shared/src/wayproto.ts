// The wire of the floating waystations and the resurrection (docs/35): the waystations streamed with the chunks, her
// fallen and what raising them costs where she stands, the waystation's window, her orders. Kept apart from
// protocol.ts, which only takes these unions into its own.

import type { UnitId } from './data/army.ts';
import type { ResPlace } from './data/resurrect.ts';
import type { WayKind } from './world/waystations.ts';

/** A waystation as the chunk brings it. */
export interface WayData {
  id: number;
  kind: WayKind;
  x: number;
  y: number;
  rot: number;
}

/** One kind of her fallen: how many, how many may come back now (the hammocks, the slots, the might), and the price of
 *  those (silver for the line kinds and the creatures of the sea, doubloons for the shop's creatures). */
export interface ResRow {
  u: UnitId;
  n: number;
  room: number;
  prem: boolean;
  silver: number;
  doubloons: number;
  /** Why none of them may come back now (server words), or absent. */
  why?: string;
}

export interface ResView {
  /** Where she stands: moored at a waystation, in port, at sea within reach of either (the fee), or neither. */
  place: ResPlace;
  rows: ResRow[];
  /** All that may come back now: the silver, the doubloons, the heads. */
  silver: number;
  doubloons: number;
  n: number;
  /** All the fallen kept, and the room for them. */
  fallen: number;
  gold: number;
  balance: number;
  /** Scrolls of resurrection in her store. */
  scrolls: number;
  /** The infirmary's price for the line kinds at once, anywhere (0: nothing for it), and its offer's id. */
  instant: number;
  /** When the oldest of the record is forgotten (wall ms; 0: none). */
  until: number;
  /** The pile is large: the window offers the scrolls. */
  offer: boolean;
  /** Not now (a fight, the boarding), or null. */
  why: string | null;
}

/** The waystation's window while she is moored there. */
export interface WayView {
  id: number;
  kind: WayKind;
  res: ResView;
  /** The quick repair: silver, and the hull share it mends to (null: she is sound enough). */
  repair: { cost: number; to: number } | null;
  /** Kinds for hire here today (the recruit window's src 'way'). */
  hire: number;
}

export type WayClientMsg =
  | { t: 'way'; action: 'moor'; id: number }
  | { t: 'way'; action: 'leave' }
  | { t: 'way'; action: 'view' }
  | { t: 'way'; action: 'repair' }
  /** Raise one kind (`u`) or all (`u` absent): with silver (the doubloons for the shop's creatures), a scroll (one
   *  kind, the line kinds only), or the infirmary at once anywhere; `rid` — her request's own id: twice, raised once. */
  | { t: 'way'; action: 'res'; u?: UnitId; via: 'silver' | 'scroll' | 'instant'; rid: string };

export type WayServerMsg =
  | { t: 'way'; view: WayView | null }
  | { t: 'fallen'; view: ResView };
