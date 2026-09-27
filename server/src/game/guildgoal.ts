// The guild's order of the week on the server (docs/11 P6): kept on the guild record, rolled when the UTC week
// turns, filled by the members' deeds; when done the treasury gains, the log says so, and every member who put a
// hand to it is paid (now if aboard, else when they next come aboard).

import { dayOf } from '../../../shared/src/data/dailies.ts';
import { GUILD_GOALS, guildGoalFor, guildMemberReward, guildTreasuryReward, weekOf } from '../../../shared/src/data/guildgoal.ts';
import type { GuildGoalKind } from '../../../shared/src/data/guildgoal.ts';
import type { Game } from './Game.ts';
import type { Guild } from './guilds.ts';
import { log } from './guilds.ts';
import type { PlayerSession } from './player.ts';
import type { QuestEvent } from './quests.ts';

export interface GuildWeekly {
  week: number;
  kind: GuildGoalKind;
  target: number;
  progress: number;
  hands: Record<string, number>;
  done: boolean;
  /** Shares not yet collected by members who were ashore: account → silver, xp. */
  owed: Record<string, { silver: number; xp: number }>;
}

function current(game: Game, g: Guild): GuildWeekly {
  const week = weekOf(dayOf(game.wallNow()));
  if (!g.weekly || g.weekly.week !== week) {
    const goal = guildGoalFor(week, g.id, g.members.length);
    g.weekly = { week, kind: goal.kind, target: goal.target, progress: 0, hands: {}, done: false, owed: g.weekly?.owed ?? {} };
    game.guilds.touch();
  }
  return g.weekly;
}

function counts(kind: GuildGoalKind, ev: QuestEvent | 'quest_done'): number {
  if (ev === 'quest_done') return kind === 'quests' ? 1 : 0;
  switch (kind) {
    case 'pirates':
      return ev.k === 'sink' && ev.victim.npcRole === 'pirate' ? 1 : 0;
    case 'charts':
      return ev.k === 'chart' ? 1 : 0;
    case 'landings':
      return ev.k === 'land' ? 1 : 0;
    case 'prizes':
      return ev.k === 'prize' ? 1 : 0;
    case 'boardings':
      return ev.k === 'board' ? 1 : 0;
    case 'quests':
      return 0;
  }
}

/** A member's deed (or a quest done): into the guild's order if it is of the week's kind. */
export function guildGoalEvent(game: Game, s: PlayerSession, ev: QuestEvent | 'quest_done'): void {
  if (ev !== 'quest_done' && ev.k === 'tick') return;
  const g = game.guilds.of(game, s.accountId);
  if (!g) return;
  const w = current(game, g);
  if (w.done) return;
  const n = counts(w.kind, ev);
  if (n <= 0) return;
  const acc = String(s.accountId);
  w.hands[acc] = (w.hands[acc] ?? 0) + n;
  w.progress = Math.min(w.target, w.progress + n);
  if (w.progress >= w.target) finish(game, g, w);
  game.guilds.touch();
}

function finish(game: Game, g: Guild, w: GuildWeekly): void {
  w.done = true;
  const gain = guildTreasuryReward(w.target);
  g.treasury += gain;
  const text = GUILD_GOALS[w.kind].text[0].replace('{n}', String(w.target));
  const line = `The guild's order of the week is done: ${text} The treasury gains ${gain} silver.`;
  log(game, g, line);
  for (const m of g.members) {
    const s = game.sessionByAccount(m.account);
    if (s) game.sendTo(s, { t: 'toast', msg: line, kind: 'gold' });
  }
  for (const [acc, mine] of Object.entries(w.hands)) {
    const s = game.sessionByAccount(Number(acc));
    if (s?.profile) pay(game, s, guildMemberReward(s.profile.level, mine));
    else w.owed[acc] = guildMemberReward(40, mine);
  }
}

function pay(game: Game, s: PlayerSession, r: { silver: number; xp: number }): void {
  s.profile!.gold += r.silver;
  game.db.ledger(s.accountId, 'guild_order', r.silver, 'guild order');
  game.grantXp(s, r.xp, null);
  game.sendTo(s, { t: 'toast', msg: `Your share of the guild's order: ${r.silver} silver.`, kind: 'gold' });
}

/** A member comes aboard: their share of an order done while they were ashore. */
export function guildGoalCollect(game: Game, s: PlayerSession): void {
  const g = game.guilds.of(game, s.accountId);
  const acc = String(s.accountId);
  const r = g?.weekly?.owed[acc];
  if (!g || !r || !s.profile) return;
  delete g.weekly!.owed[acc];
  pay(game, s, r);
  game.guilds.touch();
}

/** The order as the guild window shows it. */
export function guildGoalView(game: Game, g: Guild, accountId: number): { kind: GuildGoalKind; target: number; progress: number; mine: number; done: boolean; endsIn: number } {
  const w = current(game, g);
  const end = (w.week + 1) * 7 * 86_400_000;
  return { kind: w.kind, target: w.target, progress: w.progress, mine: w.hands[String(accountId)] ?? 0, done: w.done, endsIn: Math.max(0, Math.round((end - game.wallNow()) / 1000)) };
}
