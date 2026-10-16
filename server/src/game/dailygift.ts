// The daily login gift on the server (owner, 2026-10-16; the table and the track: shared/src/data/dailygift.ts). Her
// calendar is kept in the kv table (`gift:<account>`: the UTC day of her last claim, the streak, the claims in all);
// a claim is taken once a UTC day by the server's wall clock (game.wallNow()) — a second one the same day, a repeated
// message, a second tab: nothing more. The state is written before the gift is handed over, and the doubloons carry
// the day in their ledger reference, so nothing is paid twice.

import { GIFT_RES_SILVER, giftOf, giftStreak, giftView } from '../../../shared/src/data/dailygift.ts';
import type { Gift, GiftRes, GiftView } from '../../../shared/src/data/dailygift.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { grantSpeedups, reckonBase, yardOf } from './base.ts';
import { ownIsland } from './estate.ts';
import { creditPremium, sendBalance } from './premium.ts';
import { trackEvent } from './track.ts';

export interface GiftState {
  /** The UTC day of her last claim (-1: never). */
  last: number;
  streak: number;
  total: number;
}

const key = (acc: number) => `gift:${acc}`;

export function giftState(game: Game, acc: number): GiftState {
  const raw = game.db.getKv<GiftState>(key(acc));
  return { last: Number.isInteger(raw?.last) ? raw!.last : -1, streak: Math.max(0, Math.floor(raw?.streak ?? 0)), total: Math.max(0, Math.floor(raw?.total ?? 0)) };
}

/** Whether her gift of today is still to take (the notices ask this too). */
export function giftWaiting(game: Game, acc: number): boolean {
  return giftState(game, acc).last !== dayOf(game.wallNow());
}

export function giftViewFor(game: Game, s: PlayerSession): GiftView {
  const st = giftState(game, s.accountId);
  const now = game.wallNow();
  return giftView(st.last, st.streak, dayOf(now), s.profile?.level ?? 1, now);
}

const sentDay = new WeakMap<PlayerSession, number>();

export function sendGift(game: Game, s: PlayerSession, got?: Gift): void {
  if (!s.authed || !s.profile) return;
  const view = giftViewFor(game, s);
  sentDay.set(s, view.today);
  game.sendTo(s, got ? { t: 'gift', view, got } : { t: 'gift', view });
}

/** Every second for a captain aboard: a new UTC day sends her calendar again (its gift is ready). */
export function stepGift(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile) return;
  const d = sentDay.get(s);
  if (d !== undefined && d !== dayOf(game.wallNow())) sendGift(game, s);
}

/** Today's gift taken: what it handed over, or why not. Once a UTC day. */
export function claimGift(game: Game, s: PlayerSession): { got: Gift } | { why: string } {
  const p = s.profile;
  if (!s.authed || !p) return { why: 'Sign in to take the daily gift.' };
  const st = giftState(game, s.accountId);
  const today = dayOf(game.wallNow());
  if (st.last === today) return { why: 'Today’s gift is taken already. Come back tomorrow.' };
  const streak = giftStreak(st.last, st.streak, today);
  const gift = giftOf(streak, p.level);
  game.db.setKv(key(s.accountId), { last: today, streak, total: st.total + 1 } satisfies GiftState);
  const got = grant(game, s, gift, today);
  trackEvent(game, s.accountId, 'daily_claim', { streak, day: ((streak - 1) % 7) + 1, total: st.total + 1 });
  return { got };
}

/** The gift handed over: silver to her purse, the island's stuff to its yard (silver at its worth with no island), the
 *  builders' speed-ups, scrolls and doubloons to her account. What she really got. */
function grant(game: Game, s: PlayerSession, gift: Gift, today: number): Gift {
  const p = s.profile!;
  const got: Gift = {};
  let silver = gift.silver ?? 0;
  if (gift.res) {
    const h = ownIsland(game, s.accountId);
    if (h) {
      reckonBase(game, h);
      const y = yardOf(game, h);
      for (const [g, n] of Object.entries(gift.res) as [GiftRes, number][]) y.res[g] = (y.res[g] ?? 0) + n;
      game.holdings.touch();
      got.res = { ...gift.res };
    } else for (const [g, n] of Object.entries(gift.res) as [GiftRes, number][]) silver += n * GIFT_RES_SILVER[g];
  }
  if (silver > 0) {
    p.gold += silver;
    game.db.ledger(s.accountId, 'login_gift', silver, `day ${today}`);
    got.silver = silver;
  }
  if (gift.speed) {
    const n = grantSpeedups(p, gift.speed);
    if (n > 0) got.speed = n;
  }
  if (gift.scrolls && game.db.addScrolls(s.accountId, gift.scrolls) !== null) {
    game.db.ledger(s.accountId, 'autoscroll_gift', gift.scrolls, `day ${today}`);
    got.scrolls = gift.scrolls;
  }
  if (gift.doubloons && creditPremium(game, s.accountId, gift.doubloons, 'gift', `gift:${today}`) !== null) got.doubloons = gift.doubloons;
  else if (gift.scrolls) sendBalance(game, s); // (the scrolls' count rides on the balance message)
  game.pushSelf(s, true);
  return got;
}

/** Her client's word on the calendar. */
export function giftMessage(game: Game, s: PlayerSession, action: string): void {
  if (action === 'gift_claim') {
    const r = claimGift(game, s);
    if ('why' in r) {
      game.sendTo(s, { t: 'toast', msg: r.why, kind: 'info' });
      return sendGift(game, s);
    }
    return sendGift(game, s, r.got);
  }
  sendGift(game, s);
}

/** `/gift [reset|day N|claim]`: her calendar forgotten; her streak set to N (as if claimed yesterday); claimed now. */
export function adminGift(game: Game, s: PlayerSession, args: string[]): string {
  const today = dayOf(game.wallNow());
  if (args[0] === 'reset') game.db.setKv(key(s.accountId), { last: -1, streak: 0, total: 0 } satisfies GiftState);
  else if (args[0] === 'day') {
    const n = Math.max(0, Math.min(60, Math.floor(Number(args[1]) || 0)));
    game.db.setKv(key(s.accountId), { last: n > 0 ? today - 1 : -1, streak: n, total: n } satisfies GiftState);
  } else if (args[0] === 'claim') claimGift(game, s);
  sendGift(game, s);
  const v = giftViewFor(game, s);
  return v.can ? `Daily gift: day ${v.day} of week ${v.week + 1}, streak ${v.streak}, ready to take. Usage: /gift [reset|day N|claim]` : `Daily gift: day ${v.day} of week ${v.week + 1}, streak ${v.streak}, taken today. Usage: /gift [reset|day N|claim]`;
}
