// The wire of the PvP points (shared/src/data/pvprank.ts, server/src/game/pvprank.ts): her «ПвП» page in the Captain
// window — her season and all-time record, the month's top ten and her place. Kept apart from protocol.ts, which only
// takes these unions into its own.

/** A captain on the month's table (public fields only). */
export interface PvpRow {
  rank: number;
  name: string;
  captain: string;
  level: number;
  pts: number;
  kills: number;
  deaths: number;
}

export interface PvpTally {
  pts: number;
  kills: number;
  sunk: number;
  boarded: number;
  deaths: number;
  duels: number;
  assists: number;
}

export interface PvpRankView {
  /** The season (the month in Moscow, year × 12 + month) and the whole days left in it. */
  month: number;
  daysLeft: number;
  /** This month's and all time. */
  season: PvpTally;
  all: PvpTally;
  /** Her place this month (null: no points yet). */
  rank: number | null;
  /** Her kills in a row without a death to a captain, and her best. */
  streak: number;
  best: number;
  top: PvpRow[];
  /** How many captains have points this month. */
  ranked: number;
  /** The last season closed: its month and its top three. */
  last: { month: number; top: PvpRow[] } | null;
}

export type PvpRankClientMsg = { t: 'pvprank'; action: 'view' };
export type PvpRankServerMsg = { t: 'pvprank'; view: PvpRankView };
