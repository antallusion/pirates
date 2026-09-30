// The players' chat (owner, 2026-09-30): what a line may be, how fast a captain may speak, and the face each line
// carries (her captain's portrait and her flag) so the chat can show who speaks.

import type { PlayerSession } from './player.ts';

/** The longest line, in characters. */
export const CHAT_MAX = 200;
/** A captain may say this many lines at once, and one more every CHAT_REFILL seconds (world time). */
export const CHAT_BURST = 6;
export const CHAT_REFILL = 2;

/** One line cleaned: control characters out, runs of spaces made one, cut to the longest line. */
export function cleanChat(raw: unknown): string {
  return String(raw ?? '').replace(/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX).trim();
}

const buckets = new WeakMap<PlayerSession, { n: number; t: number }>();

/** Whether she may speak now (a line is spent if so). World time, so a still world in tests keeps the count. */
export function chatAllowed(s: PlayerSession, now: number): boolean {
  const b = buckets.get(s) ?? { n: CHAT_BURST, t: now };
  b.n = Math.min(CHAT_BURST, b.n + Math.max(0, now - b.t) / CHAT_REFILL);
  b.t = now;
  buckets.set(s, b);
  if (b.n < 1) return false;
  b.n -= 1;
  return true;
}

export const CHAT_TOO_FAST = 'You speak too fast: wait a moment';

/** Who speaks: the captain's portrait id and, when sworn, her flag (the Code's free men or the Crown's marque). */
export function chatFace(s: PlayerSession): { face?: string; fac?: 'free' | 'crown'; lv?: number } {
  const p = s.profile;
  if (!p) return {};
  return { face: p.captain, lv: p.level, ...(p.oath === 'code' ? { fac: 'free' as const } : p.oath === 'marque' ? { fac: 'crown' as const } : {}) };
}
