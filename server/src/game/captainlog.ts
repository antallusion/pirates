// The captain's log on the server (docs/16 #20): a line noted when something of the day happens to her — a ship sunk
// or taken, a storm, a new sea or harbour, a great beast seen or fought, a death aboard, a level — kept with her. The
// saga's chapters (saga.ts) are written into it as well.
//
// «Хроника» (forum post 40): the important toasts are mirrored into it (Game.sendTo → logToast: the gold and good
// ones, by their words' kind), and the moments with no toast of their own are written from their facts (who sank her,
// a boarding won and its purse, a quest's pay, a letter, a sea encounter's end). The log is no longer part of the
// private state (300 lines at every patch): the client asks for it once ({t:'chron'}) and each new line follows by
// itself as it is written.

import { DAY_LENGTH_SEC, timeOfDay } from '../../../shared/src/constants.ts';
import { LOG_DAYS, LOG_MAX, LOG_TEXT_MAX, toastKind } from '../../../shared/src/data/captainlog.ts';
import type { LogEntry, LogKind } from '../../../shared/src/data/captainlog.ts';
import type { ServerMsg } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { scuttledHome } from './adrift.ts';

/** The day of her voyages: game days since she first sailed (the saga's count). A captain is made at a world time
 *  (seconds); a very old record may hold the wall clock (ms) instead. */
export function voyageDay(game: Game, createdAt: number | undefined): number {
  if (createdAt === undefined || !Number.isFinite(createdAt)) return 1;
  if (createdAt > 1e11) return Math.max(1, Math.floor((game.wallNow() - createdAt) / (DAY_LENGTH_SEC * 1000)) + 1);
  return Math.max(1, Math.floor((game.now - createdAt) / DAY_LENGTH_SEC) + 1);
}

/** Kinds whose repeat within the hour is one line, counted. */
const FOLD = new Set<LogKind>(['storm', 'boss_seen', 'crew_lost', 'wounded_died']);
/** Mirrored sentences: the same words again within the hour are one line, counted (a companion striking, a salvage). */
const TEXT = new Set<LogKind>(['loot', 'find', 'fight', 'quest', 'trade', 'reward', 'build', 'note']);

/** A line of the day in her log. */
export function logNote(game: Game, s: PlayerSession, kind: LogKind, a: string[] = [], n?: number): void {
  const p = s.profile;
  if (!p) return;
  const day = voyageDay(game, p.createdAt);
  const e: LogEntry = { at: game.wallNow(), day, tod: Math.round(timeOfDay(game.now) * 1000) / 1000, kind, a, ...(n !== undefined ? { n } : {}) };
  const log = (p.log ??= []);
  // The same thing twice in a row within the hour (a second storm cell, the same beast): one line, counted.
  const last = log.at(-1);
  const same = !!last && last.kind === kind && last.day === day && last.a.join('|') === a.join('|') && e.at - last.at < 3_600_000;
  if (same && FOLD.has(kind)) {
    if (kind === 'crew_lost' || kind === 'wounded_died') last.n = (last.n ?? 0) + (n ?? 0);
    last.at = e.at;
    tell(game, s, last, true);
  } else if (same && TEXT.has(kind)) {
    last.x = (last.x ?? 1) + 1;
    last.at = e.at;
    tell(game, s, last, true);
  } else {
    log.push(e);
    tell(game, s, e, false);
  }
  pruneLog(log, day);
}

/** A new line (or the last one counted again) to her client, if it has the chronicle. */
function tell(game: Game, s: PlayerSession, e: LogEntry, again: boolean): void {
  if (s.conn.closed || s.disconnectedAt !== null) return;
  game.sendTo(s, { t: 'chron', entries: [e], ...(again ? { again: true } : {}) });
}

/** The whole chronicle (the client asks once, on its first look). */
export function sendChronicle(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'chron', entries: s.profile?.log ?? [], full: true });
}

/** A toast mirrored into the chronicle (Game.sendTo): the gold and good ones, by their words' kind. The world's
 *  shouts (WORLD: …) are everyone's, not hers. */
export function logToast(game: Game, s: PlayerSession, msg: string, kind: string): void {
  if (kind !== 'gold' && kind !== 'good') return;
  if (!s.profile || !msg || msg.startsWith('WORLD:') || msg.startsWith('FIRST ON THE SEAS') || /^(Lookout|The lookout|Masthead)/.test(msg)) return; // (a sail sighted is the moment's, not the chronicle's)
  const text = msg.length > LOG_TEXT_MAX ? `${msg.slice(0, LOG_TEXT_MAX - 1)}…` : msg;
  logNote(game, s, toastKind(text), [text]);
}

/** What a message to her leaves in the chronicle (Game.sendTo): a toast in gold mirrored; a quest's pay, a boarding
 *  won, her ship taken, a sea encounter's end written from their facts. */
export function chronicleOf(game: Game, s: PlayerSession, msg: ServerMsg): void {
  if (!s.profile) return;
  switch (msg.t) {
    case 'toast':
      return logToast(game, s, msg.msg, msg.kind);
    case 'quest_done':
      return once(game, s, 'quest_done', [msg.name, String(msg.xp)], msg.silver);
    case 'boarding':
      if (msg.result) once(game, s, 'boarded', [msg.result.targetName, String(msg.result.crewLost), String(msg.result.enemyCrewLost)], msg.result.gold);
      return;
    case 'sunk_self':
      if (msg.boarded && !msg.boarded.repelled) once(game, s, 'taken_by', [msg.boarded.by], msg.boarded.silver);
      return;
    case 'encounter_result': {
      const v: Record<string, unknown> = { ...msg.vars };
      if (msg.vars.item) v.item = { ...msg.vars.item };
      return once(game, s, 'encounter', [msg.def, msg.outcome, JSON.stringify(v)]);
    }
    default:
  }
}

/** She went down (Game.playerDeath): who sank her — the last ship to hit her within two minutes, its captain if a
 *  captain's — or the sea itself (a reef, a storm, her own hand). */
export function sunkByNote(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const where = game.nearestIslandName(ship.state.x, ship.state.y);
  if (scuttledHome.has(ship)) return logNote(game, s, 'sunk_by', ['', where, '', 'scuttled']);
  let by: ShipEntity | null = null, at = -Infinity;
  for (const [id, t] of ship.attackers) {
    const o = game.ships.get(id);
    if (o && o !== ship && t > at && game.now - t < 120) {
      at = t;
      by = o;
    }
  }
  const cap = by?.isPlayer ? (game.sessionOf(by)?.name ?? by.captainName) : '';
  logNote(game, s, 'sunk_by', [by?.name ?? '', where, cap ?? '']);
}

/** A line written once: the same message sent again (the page asking for its spoils anew) leaves no second line. */
function once(game: Game, s: PlayerSession, kind: LogKind, a: string[], n?: number): void {
  const log = s.profile?.log ?? [];
  const now = game.wallNow();
  for (let i = log.length - 1; i >= 0 && i >= log.length - 6; i--) {
    const e = log[i];
    if (now - e.at > 600_000) break;
    if (e.kind === kind && e.a.join('|') === a.join('|')) return;
  }
  logNote(game, s, kind, a, n);
}

/** Keeps the last days of the day log, and no more than the cap. */
export function pruneLog(log: LogEntry[], today: number): void {
  const from = today - LOG_DAYS + 1;
  let cut = 0;
  while (cut < log.length && log[cut].day < from) cut++;
  if (cut) log.splice(0, cut);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
}
