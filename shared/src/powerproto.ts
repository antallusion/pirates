// The wire of «Мощь» (shared/src/data/power.ts, server/src/game/power.ts): the Captain window's page — her four parts and
// the total, her places, the top ten by the total. Kept apart from protocol.ts, which only takes these unions in.

import type { PowerScore } from './data/power.ts';

export type PowerBoard = 'power' | 'army' | 'ship' | 'isle' | 'gear';

/** A captain on the power board (public fields only). */
export interface PowerRow {
  rank: number;
  name: string;
  captain: string;
  level: number;
  pw: PowerScore;
}

export interface PowerRankView {
  /** Her power now (her live state). */
  me: PowerScore;
  /** Her places on the site's boards (a minute's snapshot; null: not on it — hidden, or none of that part). */
  ranks: Record<PowerBoard, number | null>;
  /** How many captains are on the power board. */
  ranked: number;
  top: PowerRow[];
}

export type PowerClientMsg = { t: 'power'; action: 'view' };
export type PowerServerMsg = { t: 'power'; view: PowerRankView };
