// The captain's log (docs/16 #20): the chronicle of her days, written by itself — the ships sunk and taken, the storms,
// the seas and harbours found, the great beasts seen and fought, the dead, the levels. Each line is kept as its facts
// (the day, the hour of the sea's clock, what and where); the reader's client tells it in its own tongue. The saga's
// chapters (saga.ts) come into it too, as the day's great moments.
//
// «Хроника» (forum post 40, approved by the owner): «мелкие всплывающие надписи не успеваешь прочитать». The log now
// keeps everything worth reading again, with the wall-clock time: the loot hauled up, the divers' and the landing
// party's finds, a hoard dug, a bottle's note, a boarding and its spoils, who sank her and whom she sank, the quests'
// pay, the trades of note, the season card, the letters, the island's buildings — each important toast mirrored (the
// server's own English sentence, told in the reader's tongue by the client's table). The last LOG_MAX lines are kept.

import type { SagaKind } from './saga.ts';

export type LogKind =
  | 'sank' | 'prize' | 'storm' | 'sea' | 'port' | 'boss_seen' | 'boss' | 'officer_dead' | 'crew_lost' | 'wounded_died' | 'level' | 'saga'
  /** docs/19 E7: a summons — a guild (its tag) declares a siege on her guild's citadel (its name). */
  | 'siege'
  // «Хроника» (forum post 40): the lines written from the server's own sentence (a[0]), by what they are about.
  /** Loot hauled aboard: a wreck salvaged, flotsam, a purse in the waves. */
  | 'loot'
  /** A find: the divers' bell, the landing party's, a hoard dug, a bottle, a chest. */
  | 'find'
  /** A fight's end and its spoils, a bounty paid, a beast flensed. */
  | 'fight'
  /** A quest, a contract, a daily order, a chapter done and its pay. */
  | 'quest'
  /** A sale or a purchase of note (the market board, the auction, a map, a stall). */
  | 'trade'
  /** A reward of the season: the season card, the Colosseum, a title, a pennant, a cosmetic. */
  | 'reward'
  /** Her island: a building finished, a level, the yard, the treasury. */
  | 'build'
  /** Anything else told in gold: the toast as it was. */
  | 'note'
  // Written from their facts:
  /** She went down: a[0] the ship that sank her ('' — the sea itself), a[1] where, a[2] her captain (a captain's). */
  | 'sunk_by'
  /** Her ship taken by boarding: a[0] the victor; n the silver they had of her chest. */
  | 'taken_by'
  /** A boarding won: a[0] the ship taken, a[1] her men lost, a[2] theirs; n the silver in her purse. */
  | 'boarded'
  /** A quest done: a[0] its name, a[1] the experience; n the silver. */
  | 'quest_done'
  /** A letter in: a[0] who from, a[1] the subject; n the silver enclosed. */
  | 'letter'
  /** A sea encounter's end: a[0] its id, a[1] the outcome, a[2] its numbers (JSON). */
  | 'encounter';

export interface LogEntry {
  /** Wall-clock ms. */
  at: number;
  /** The day of her voyages (game days since she first sailed). */
  day: number;
  /** The hour on the sea's clock, 0..1 of the day. */
  tod: number;
  kind: LogKind;
  /** Names as the server says them; for a saga chapter a[0] is its kind. */
  a: string[];
  n?: number;
  /** The same line again within the hour: how many times (a mirrored toast). */
  x?: number;
}

/** Days kept for the day log's pages (the chronicle keeps the last LOG_MAX lines whatever their day). */
export const LOG_DAYS = 30;
/** The lines kept: about 300 (forum post 40) — a save grows by some 40 KB at most. */
export const LOG_MAX = 300;
/** A mirrored sentence is cut to this many characters (the save's size). */
export const LOG_TEXT_MAX = 240;

export const LOG_ICON: Record<LogKind, string> = {
  sank: 'map_wreck', prize: 'tree_boarding', storm: 'weather_storm', sea: 'map_port', port: 'anchor', boss_seen: 'danger', boss: 'danger',
  officer_dead: 'danger', crew_lost: 'stat_crew', wounded_died: 'stat_crew', level: 'xp', saga: 'tab_legends', siege: 'build_fort',
  loot: 'map_wreck', find: 'map_treasure', fight: 'tree_boarding', quest: 'goal', trade: 'tab_market', reward: 'service_crown', build: 'build_shipyard', note: 'ui_quill',
  sunk_by: 'danger', taken_by: 'danger', boarded: 'tree_boarding', quest_done: 'goal', letter: 'tab_letters', encounter: 'map_event',
};

/** The chronicle's filters (forum post 40): all, loot, battles, quests, the island. */
export type LogFilter = 'all' | 'loot' | 'fight' | 'quest' | 'isle';
export const LOG_FILTERS: readonly LogFilter[] = ['all', 'loot', 'fight', 'quest', 'isle'];
const GROUP: Record<LogKind, Exclude<LogFilter, 'all'> | null> = {
  sank: 'fight', prize: 'fight', storm: null, sea: null, port: null, boss_seen: 'fight', boss: 'fight', officer_dead: 'fight', crew_lost: 'fight',
  wounded_died: 'fight', level: 'quest', saga: 'quest', siege: 'fight', loot: 'loot', find: 'loot', fight: 'fight', quest: 'quest', trade: 'loot',
  reward: 'quest', build: 'isle', note: null, sunk_by: 'fight', taken_by: 'fight', boarded: 'fight', quest_done: 'quest', letter: null, encounter: 'loot',
};
/** Whether a line stands under a filter. */
export function logIn(kind: LogKind, f: LogFilter): boolean {
  return f === 'all' || GROUP[kind] === f;
}

/** The kind of a mirrored sentence, by its words (the server's English). Loot first: «a chest buried on an island» is
 *  a find, not the island's. */
export function toastKind(msg: string): LogKind {
  const m = msg.toLowerCase();
  if (/\b(salvaged|flotsam|jetsam|hauled aboard|driftwood|purse in|in your locker|ambergris|wreck field searched|broken up for)\b/.test(m)) return 'loot';
  if (/\b(bottle|bell comes up|divers?|the party returns|landing party|dug up|hoard|chest|cache|the deep gives|treasure|in the captain's chest|map bought|oilskin|oilcloth|scroll)\b/.test(m)) return 'find';
  if (/\b(quest|contract|daily order|daily orders|chapter|campaign|common cause|errand|task|guidance|teaches you)\b/.test(m)) return 'quest';
  if (/\b(season card|super pass|premium pass|colosseum|pantheon|title|pennant|earned:|season challenge|rating)\b/.test(m)) return 'reward';
  if (/\b(sold|bought|buys|your stall|auction|prize court|condemns|ransom|pay .* silver for him)\b/.test(m)) return 'trade';
  if (/\b(island|town hall|treasury|builders|yard of|unloaded into|is finished|: level \d+)\b/.test(m)) return 'build';
  if (/\b(slain|sunk|sank|beaten|boarding|bounty|flensed|takes? the|prize|trophy|won|victory|is dead)\b/.test(m)) return 'fight';
  return 'note';
}

export type { SagaKind };
