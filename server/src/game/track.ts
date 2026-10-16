// The funnel's events — a STUB of the analytics another helper builds in ../pirates-isle (`trackEvent(game, accountId,
// kind, data?)`). Not in main yet at 2026-10-16: this keeps the same name and signature so the callers here
// (dailygift.ts: 'daily_claim'; tgnotify.ts: 'tg_notice_sent', 'tg_notice_click', 'tg_notice_blocked') need no change
// at the merge — the coordinator replaces this file with the real one. Meanwhile it only counts: a kv row a day of
// counts by kind (`track:<UTC day>`), the account's number the only thing about her kept, and never throws.

import type { Game } from './Game.ts';

export type TrackData = Record<string, string | number | boolean | null>;

export function trackEvent(game: Game, accountId: number, kind: string, data?: TrackData): void {
  void accountId;
  void data;
  try {
    const key = `track:${Math.floor(game.wallNow() / 86_400_000)}`;
    const day = game.db.getKv<Record<string, number>>(key) ?? {};
    day[kind] = (day[kind] ?? 0) + 1;
    game.db.setKv(key, day);
  } catch {
    // (the funnel never stops the game)
  }
}
