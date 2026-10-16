// The funnel's events — a STUB with the signature of the real API, `trackEvent(game, accountId, kind, data?)` of
// server/src/game/liveops.ts (on main since 2026-10-16, merged by the coordinator: kind [a-z0-9_:.-]{1,40}, data
// { amount?, product? }, never throws). AT THE MERGE: point the two imports (dailygift.ts, tgnotify.ts) at
// './liveops.ts' and delete this file — the calls need no other change. Meanwhile it does nothing.

import type { Game } from './Game.ts';

export function trackEvent(game: Game, accountId: number, kind: string, data?: { amount?: number; product?: string }): void {
  void game;
  void accountId;
  void kind;
  void data;
}
