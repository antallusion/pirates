// The wire of docs/19 D5 (the sea's small things): the ones a captain has about her now, the one her boats are at, and
// her orders. Kept apart from protocol.ts, which only takes these unions into its own.

import type { FindKind } from './data/seafinds.ts';

/** A small thing on the sea as her minimap, her sea and her action bar show it. */
export interface FindView {
  id: number;
  kind: FindKind;
  x: number;
  y: number;
  /** World seconds left, and in all. */
  left: number;
  ttl: number;
  level: number;
  /** The sharks round the chest. */
  n?: number;
}

export type FindClientMsg =
  | { t: 'seafind'; action: 'work'; id: number }
  | { t: 'seafind'; action: 'cancel' };

export type FindServerMsg =
  /** Her small things now (and the time the list was made), and the one her boats are at (world seconds). */
  | { t: 'seafinds'; list: FindView[]; busy: { id: number; until: number; total: number } | null };
