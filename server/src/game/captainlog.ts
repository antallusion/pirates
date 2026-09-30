// The captain's log on the server (docs/16 #20): a line noted when something of the day happens to her — a ship sunk
// or taken, a storm, a new sea or harbour, a great beast seen or fought, a death aboard, a level — kept with her for the
// last few days. The saga's chapters (saga.ts) are written into it as well.

import { DAY_LENGTH_SEC, timeOfDay } from '../../../shared/src/constants.ts';
import { LOG_DAYS, LOG_MAX } from '../../../shared/src/data/captainlog.ts';
import type { LogEntry, LogKind } from '../../../shared/src/data/captainlog.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** The day of her voyages: game days since she first sailed (the saga's count). A captain is made at a world time
 *  (seconds); a very old record may hold the wall clock (ms) instead. */
export function voyageDay(game: Game, createdAt: number | undefined): number {
  if (createdAt === undefined || !Number.isFinite(createdAt)) return 1;
  if (createdAt > 1e11) return Math.max(1, Math.floor((game.wallNow() - createdAt) / (DAY_LENGTH_SEC * 1000)) + 1);
  return Math.max(1, Math.floor((game.now - createdAt) / DAY_LENGTH_SEC) + 1);
}

/** A line of the day in her log. */
export function logNote(game: Game, s: PlayerSession, kind: LogKind, a: string[] = [], n?: number): void {
  const p = s.profile;
  if (!p) return;
  const day = voyageDay(game, p.createdAt);
  const e: LogEntry = { at: game.wallNow(), day, tod: Math.round(timeOfDay(game.now) * 1000) / 1000, kind, a, ...(n !== undefined ? { n } : {}) };
  const log = (p.log ??= []);
  // The same thing twice in a row within the hour (a second storm cell, the same beast): one line, counted.
  const last = log.at(-1);
  if (last && last.kind === kind && last.day === day && kind !== 'saga' && kind !== 'level' && last.a.join('|') === a.join('|') && e.at - last.at < 3_600_000 && (kind === 'storm' || kind === 'boss_seen' || kind === 'crew_lost' || kind === 'wounded_died')) {
    if (kind === 'crew_lost' || kind === 'wounded_died') last.n = (last.n ?? 0) + (n ?? 0);
    last.at = e.at;
  } else log.push(e);
  pruneLog(log, day);
}

/** Keeps the last few days, and no more than the cap. */
export function pruneLog(log: LogEntry[], today: number): void {
  const from = today - LOG_DAYS + 1;
  let cut = 0;
  while (cut < log.length && log[cut].day < from) cut++;
  if (cut) log.splice(0, cut);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
}
