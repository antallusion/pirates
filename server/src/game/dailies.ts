// Daily orders on the server (docs/11 P6): today's three are rolled from the account and the UTC day, move on with
// the same events as the quests, and pay as they are done; all three open the chest, and days in a row fill it more.

import { DAILY_DEFS, chestReward, dailyReward, dayOf, rollDailies } from '../../../shared/src/data/dailies.ts';
import type { DailyKind, DailyState } from '../../../shared/src/data/dailies.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { QuestEvent } from './quests.ts';

export function newDaily(): DailyState {
  return { day: -1, orders: [], streak: 0, lastFullDay: -2, chest: false };
}

export function sanitizeDaily(p: Profile): void {
  p.daily ??= newDaily();
  p.daily.orders = (p.daily.orders ?? []).filter((o) => DAILY_DEFS[o.kind]);
  p.daily.streak ??= 0;
  p.daily.lastFullDay ??= -2;
}

/** A new day: new orders, and the streak broken if yesterday's chest was not opened. */
export function dailyRollover(game: Game, s: PlayerSession): boolean {
  const p = s.profile;
  if (!p) return false;
  const today = dayOf(game.wallNow());
  if (p.daily.day === today) return false;
  if (p.daily.lastFullDay < today - 1) p.daily.streak = 0;
  p.daily = { ...p.daily, day: today, orders: rollDailies(String(s.accountId), today, p.level), chest: false };
  return true;
}

/** How far an event moves an order. */
function gain(kind: DailyKind, ev: QuestEvent, seen: string[] | undefined): number {
  switch (kind) {
    case 'sink':
      return ev.k === 'sink' ? 1 : 0;
    case 'sink_pirates':
      return ev.k === 'sink' && ev.victim.npcRole === 'pirate' ? 1 : 0;
    case 'board':
      return ev.k === 'board' ? 1 : 0;
    case 'prize':
      return ev.k === 'prize' ? 1 : 0;
    case 'land':
      return ev.k === 'land' ? 1 : 0;
    case 'chart':
      return ev.k === 'chart' ? 1 : 0;
    case 'ports':
      return ev.k === 'dock' && !(seen ?? []).includes(ev.port.id) ? 1 : 0;
    case 'contraband':
      return ev.k === 'sell_contraband' ? ev.qty : 0;
    case 'fleet':
      return ev.k === 'fleet_win' ? 1 : 0;
    case 'dive':
      return ev.k === 'dive' ? 1 : 0;
  }
}

export function dailyEvent(game: Game, s: PlayerSession, ev: QuestEvent): void {
  const p = s.profile;
  if (!p || ev.k === 'tick') return;
  dailyRollover(game, s);
  let changed = false;
  for (const o of p.daily.orders) {
    if (o.done) continue;
    const g = gain(o.kind, ev, o.seen);
    if (g <= 0) continue;
    if (o.kind === 'ports' && ev.k === 'dock') o.seen = [...(o.seen ?? []), ev.port.id];
    o.progress = Math.min(o.need, o.progress + g);
    changed = true;
    if (o.progress < o.need) continue;
    o.done = true;
    const r = dailyReward(o.kind, p.level);
    p.gold += r.silver;
    game.db.ledger(s.accountId, 'daily', r.silver, o.kind);
    game.grantXp(s, r.xp, 'Daily order');
    game.sendTo(s, { t: 'toast', msg: `Daily order done: ${DAILY_DEFS[o.kind].text[0].replace('{n}', String(o.need))} +${r.silver} silver.`, kind: 'gold' });
  }
  if (changed && !p.daily.chest && p.daily.orders.length && p.daily.orders.every((o) => o.done)) {
    // The chest: days in a row before today fill it more.
    const streak = p.daily.lastFullDay === p.daily.day - 1 ? p.daily.streak + 1 : 1;
    const r = chestReward(p.level, streak - 1);
    p.daily.chest = true;
    p.daily.streak = streak;
    p.daily.lastFullDay = p.daily.day;
    p.gold += r.silver;
    game.db.ledger(s.accountId, 'daily_chest', r.silver, String(p.daily.day));
    game.grantXp(s, r.xp, 'Daily chest');
    game.sendTo(s, { t: 'toast', msg: `All three daily orders done: the chest holds ${r.silver} silver. Days in a row: ${streak}.`, kind: 'gold' });
  }
}

/** What the captain sees of today's orders. */
export function dailyView(p: Profile): { day: number; orders: { kind: DailyKind; need: number; progress: number; done: boolean; silver: number }[]; streak: number; chest: boolean; chestSilver: number } {
  const running = p.daily.lastFullDay >= p.daily.day - 1 ? p.daily.streak : 0;
  return {
    day: p.daily.day,
    orders: p.daily.orders.map((o) => ({ kind: o.kind, need: o.need, progress: Math.floor(o.progress), done: o.done, silver: dailyReward(o.kind, p.level).silver })),
    streak: p.daily.chest ? p.daily.streak : running,
    chest: p.daily.chest,
    chestSilver: chestReward(p.level, p.daily.chest ? p.daily.streak - 1 : running).silver,
  };
}
