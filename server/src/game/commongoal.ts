// The common cause on the server (docs/11 P6): one goal a day (UTC) for the whole sea, sized by the captains at sea
// when it is set. Every deed of its kind by any captain counts; when the bar is full, every captain who put a hand
// to it is paid (now if at sea, else when they next come aboard). An unfinished cause lapses at midnight.

import { COMMON_DEFS, commonGoalFor, commonReward } from '../../../shared/src/data/commongoal.ts';
import type { CommonKind } from '../../../shared/src/data/commongoal.ts';
import { dayOf } from '../../../shared/src/data/dailies.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { QuestEvent } from './quests.ts';

export interface CommonState {
  day: number;
  kind: CommonKind;
  target: number;
  progress: number;
  /** Deeds by account. */
  hands: Record<string, number>;
  /** The captains' names, for the day's leaders. */
  names?: Record<string, string>;
  done: boolean;
  /** Pay not yet collected by captains who were ashore when the cause was done: account → silver, xp. */
  owed: Record<string, { silver: number; xp: number }>;
}

const KEY = 'common_goal';
let cache: CommonState | null = null;
let cacheGame: Game | null = null;

function load(game: Game): CommonState {
  if (cache && cacheGame === game) return cache;
  cacheGame = game;
  cache = game.db.getKv<CommonState>(KEY) ?? null;
  if (!cache) cache = fresh(game, dayOf(game.wallNow()));
  return cache;
}

function save(game: Game): void {
  if (cache) game.db.setKv(KEY, cache);
}

function fresh(game: Game, day: number): CommonState {
  const captains = [...game.sessions].filter((s) => s.profile).length;
  const g = commonGoalFor(day, captains);
  return { day, kind: g.kind, target: g.target, progress: 0, hands: {}, done: false, owed: {} };
}

/** A new day: a new cause (what was owed from the old one stays owed). */
export function stepCommon(game: Game): void {
  const st = load(game);
  const today = dayOf(game.wallNow());
  if (st.day === today) return;
  const owed = st.owed;
  cache = { ...fresh(game, today), owed };
  save(game);
}

function counts(kind: CommonKind, ev: QuestEvent): number {
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
  }
}

/** A captain's deed: into the common cause if it is of the day's kind. */
export function commonEvent(game: Game, s: PlayerSession, ev: QuestEvent): void {
  if (ev.k === 'tick' || !s.profile) return;
  const st = load(game);
  if (st.done || st.day !== dayOf(game.wallNow())) return;
  const n = counts(st.kind, ev);
  if (n <= 0) return;
  const acc = String(s.accountId);
  st.hands[acc] = (st.hands[acc] ?? 0) + n;
  (st.names ??= {})[acc] = s.name;
  st.progress = Math.min(st.target, st.progress + n);
  if (st.progress >= st.target) finish(game, st);
  save(game);
}

function finish(game: Game, st: CommonState): void {
  st.done = true;
  const text = COMMON_DEFS[st.kind].text[0].replace('{n}', String(st.target));
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: The common cause is done: ${text} Every hand in it is paid.`, kind: 'gold' });
  for (const [acc, mine] of Object.entries(st.hands)) {
    const s = game.sessionByAccount(Number(acc));
    if (s?.profile) pay(game, s, commonReward(s.profile.level, mine));
    else st.owed[acc] = commonReward(40, mine); // paid at a middling level to one not aboard
  }
}

function pay(game: Game, s: PlayerSession, r: { silver: number; xp: number }): void {
  const p = s.profile!;
  p.gold += r.silver;
  game.db.ledger(s.accountId, 'common', r.silver, 'common cause');
  game.grantXp(s, r.xp, null);
  game.sendTo(s, { t: 'toast', msg: `Your share of the common cause: ${r.silver} silver.`, kind: 'gold' });
}

/** A captain comes aboard: their share of a cause done while they were ashore. */
export function commonCollect(game: Game, s: PlayerSession): void {
  const st = load(game);
  const acc = String(s.accountId);
  const r = st.owed[acc];
  if (!r || !s.profile) return;
  delete st.owed[acc];
  pay(game, s, r);
  save(game);
}

/** What a captain sees: the cause, the bar, their own part, and the time left. */
export function commonView(game: Game, accountId: number): { kind: CommonKind; target: number; progress: number; mine: number; done: boolean; endsIn: number; leaders: { name: string; n: number }[] } {
  const st = load(game);
  const end = (st.day + 1) * 86_400_000;
  // The day's three busiest hands, by name.
  const leaders = Object.entries(st.hands).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([acc, n]) => ({ name: st.names?.[acc] ?? '?', n }));
  return { kind: st.kind, target: st.target, progress: st.progress, mine: st.hands[String(accountId)] ?? 0, done: st.done, endsIn: Math.max(0, Math.round((end - game.wallNow()) / 1000)), leaders };
}

/** For tests: forget the cached state (a new game in the same process). */
export function resetCommonCache(): void {
  cache = null;
  cacheGame = null;
}
