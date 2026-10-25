// The newcomers' funnel (retention, 2026-10-25): where a new captain stops — the captain made, each step of the First
// Watch reached, its end or its skip, each step of the campaign's first chapter reached, 5/15/30 minutes aboard. Kept
// in the telemetry's own file (server/src/http/telemetry.ts tel_funnel) as daily counts of distinct accounts, an
// account only as a hash; the captain's screen is the page's own report (client/src/telemetry.ts telemetryFunnel).
// Read by the admin console's /ops, the bot's /ops and the telemetry page.

import { telemetry } from '../http/telemetry.ts';

const seen = new Set<string>();

/** `accountId` reached `kind` (once a day each; never throws into the game; nothing without telemetry). */
export function funnelMark(accountId: number, kind: string, now = Date.now()): void {
  const t = telemetry();
  if (!t || !(Number.isSafeInteger(accountId) && accountId > 0)) return;
  const key = `${new Date(now).toISOString().slice(0, 10)}|${kind}|${accountId}`;
  if (seen.has(key)) return;
  if (seen.size > 50_000) seen.clear();
  seen.add(key);
  try {
    t.mark(kind, `acc:${accountId}`, now);
  } catch {
    /* the funnel is never worth a fault in the game */
  }
}

/** Minutes aboard marked: 5, 15 and 30. */
export const PLAY_MARKS = [5, 15, 30] as const;
