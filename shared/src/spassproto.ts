// The wire of «Сезонная карта» (owner, 2026-10-30; shared/src/data/seasonpass.ts, server/src/game/seasonpass.ts). Kept
// apart from protocol.ts, which only takes these unions in. The season's table itself is shared data: the client draws
// the tiers from passSeason(view.season) — only her card travels.

import type { PassKind } from './data/seasonpass.ts';

/** A challenge as she sees it: its id (CHALLENGES), its count, whether it is done, its season experience. */
export interface PassChallengeView {
  id: string;
  need: number;
  prog: number;
  done: boolean;
  xp: number;
}

export interface PassView {
  /** The season (1, 2, …) and its bounds (wall ms), the server's wall clock when sent. */
  season: number;
  from: number;
  until: number;
  now: number;
  /** Her season experience, her tier, the experience into the next and what it asks (0 at the top). */
  xp: number;
  tier: number;
  into: number;
  need: number;
  /** The pass she holds this season (null: the free track only). */
  has: PassKind | null;
  /** The tiers taken, by track. */
  free: number[];
  prem: number[];
  /** Today's challenges and this week's; when the day and the week end (wall ms). */
  daily: PassChallengeView[];
  weekly: PassChallengeView[];
  dayEnds: number;
  weekEnds: number;
  /** Silver a minute at her ship's level (a reward's silver is minutes of it: seasonpass.ts silverOf). */
  silverMin: number;
  /** Rewards waiting to be taken (tier and track): the HUD's badge. */
  claim: number;
  /** The payment desks open to her: Telegram's Stars (or VK's votes) and the web checkout (YooKassa). */
  pay: boolean;
  web: boolean;
}

export type PassClientMsg =
  | { t: 'spass'; action: 'view' }
  /** A tier's reward of a track taken. */
  | { t: 'spass'; action: 'claim'; tier: number; track: 'free' | 'premium' }
  /** Every reward that waits, taken. */
  | { t: 'spass'; action: 'claim_all' };

export type PassServerMsg = { t: 'spass'; view: PassView };
