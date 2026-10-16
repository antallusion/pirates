// The daily login gift (owner, 2026-10-16, «да» to the retention batch): a calendar of seven days that grows day by day —
// silver, the island's stuff, the builders' speed-ups, an auto-battle scroll and a few doubloons on the seventh — four
// weeks in a row on a 28-day track, the fourth week's seventh day the richest. Claimed once a UTC day by the server's
// wall clock (game.wallNow()); one missed day is forgiven (the grace), two in a row start the track again.
// Modest by docs/31–32: the whole 28 days are worth about 55 doubloons, 4 scrolls, a few hours of speed-ups and silver
// of a quarter-hour at sea a day — under one day of the captain's subscription, so the shop keeps its worth.
// Pure: the server (server/src/game/dailygift.ts) and the client's calendar (client/src/ui/dailygift.ts) share it.

export type GiftRes = 'timber' | 'coal' | 'tar' | 'iron';

export interface Gift {
  silver?: number;
  /** Into her island's yard (no island yet: paid in silver at the goods' worth, see GIFT_RES_SILVER). */
  res?: Partial<Record<GiftRes, number>>;
  /** The builders' free speed-ups (TOKEN_SECS each). */
  speed?: number;
  /** Auto-battle scrolls. */
  scrolls?: number;
  doubloons?: number;
}

export const GIFT_WEEK = 7;
export const GIFT_WEEKS = 4;
export const GIFT_TRACK = GIFT_WEEK * GIFT_WEEKS;
/** Days that may be missed between two claims without the track starting again. */
export const GIFT_GRACE = 1;
/** The silver a unit of the island's stuff is paid in when she has no island yet. */
export const GIFT_RES_SILVER: Record<GiftRes, number> = { timber: 4, coal: 5, tar: 6, iron: 10 };

/** The silver unit of a day: 60 at level 1, a twentieth more a level (as the old harbour-master's welcome paid). */
export function giftUnit(level: number): number {
  return Math.round((60 * (1 + Math.max(1, Math.min(60, level)) / 20)) / 10) * 10;
}

/** Where a streak stands on the track: its week (0–3) and its day (1–7). `streak` counts from 1. */
export function giftSlot(streak: number): { week: number; day: number } {
  const pos = (Math.max(1, Math.floor(streak)) - 1) % GIFT_TRACK;
  return { week: Math.floor(pos / GIFT_WEEK), day: (pos % GIFT_WEEK) + 1 };
}

/** The gift of a day on the track for a captain of `level`. */
export function giftOf(streak: number, level: number): Gift {
  const { week, day } = giftSlot(streak);
  const S = giftUnit(level);
  const m = 1 + 0.25 * week;
  const silver = (k: number) => Math.round((k * S * m) / 10) * 10;
  const res = (r: Partial<Record<GiftRes, number>>) => Object.fromEntries(Object.entries(r).map(([g, n]) => [g, Math.round((n * m) / 5) * 5])) as Partial<Record<GiftRes, number>>;
  switch (day) {
    case 1:
      return { silver: silver(2) };
    case 2:
      return { res: res({ timber: 40, iron: 10 }) };
    case 3:
      return { silver: silver(3), speed: 2 };
    case 4:
      return { speed: 4 + week };
    case 5:
      return { scrolls: week >= 2 ? 2 : 1 };
    case 6:
      return { silver: silver(4), res: res({ coal: 30, tar: 20 }) };
    default:
      return { doubloons: week === GIFT_WEEKS - 1 ? 25 : 10, silver: silver(3) };
  }
}

/** The streak a claim on `today` counts: the next after `last` within the grace, else the track starts again. */
export function giftStreak(last: number, streak: number, today: number): number {
  if (last === today) return streak;
  return last >= 0 && streak > 0 && today - last <= 1 + GIFT_GRACE ? streak + 1 : 1;
}

/** Her calendar as the client shows it. */
export interface GiftView {
  /** The server's UTC day. */
  today: number;
  /** Today's gift still to take. */
  can: boolean;
  /** Today's place on the track (claimed or to claim), from 1. */
  streak: number;
  week: number;
  day: number;
  /** The seven gifts of the week shown. */
  cells: Gift[];
  /** One day was missed and forgiven (the grace). */
  kept: boolean;
  /** The track started again (two days or more missed). */
  reset: boolean;
  /** The server's wall clock when sent, and the next UTC midnight (the next gift). */
  now: number;
  next: number;
}

/** The view for a captain whose last claim was on `last` with `streak`, today `today` (UTC day), at `level`. */
export function giftView(last: number, streak: number, today: number, level: number, now: number): GiftView {
  const can = last !== today;
  const s = giftStreak(last, streak, today);
  const { week, day } = giftSlot(s);
  const first = s - day + 1;
  const cells = Array.from({ length: GIFT_WEEK }, (_, i) => giftOf(first + i, level));
  return { today, can, streak: s, week, day, cells, kept: can && s > 1 && today - last === 1 + GIFT_GRACE, reset: can && s === 1 && last >= 0 && streak > 0, now, next: (today + 1) * 86_400_000 };
}
