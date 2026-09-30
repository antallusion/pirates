// The sea's goals of the week on the server (docs/16 #32): two goals for the whole server each UTC week ("Sink 500
// ships of the Choir", "Deliver 20 000 goods to Saint Maw"), drawn with their own dice from the week's number so the
// sea's stream is never touched. Every captain's deed of the kind counts on one common bar; when it is full, every
// hand that brought at least a small share (half a percent, one deed at the least) is paid — now if aboard, else when
// they next come aboard — and a line goes into the sea's chronicle. An unfinished goal lapses with the week.

import { WEEK_MS, weekNumber } from '../../../shared/src/data/renown.ts';
import { WORLD_GOAL_DEFS, worldGoalMin, worldGoalReward, worldGoalsFor } from '../../../shared/src/data/social.ts';
import type { WorldGoalKind } from '../../../shared/src/data/social.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { WorldGoalView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { chronicle } from './renown.ts';
import type { ShipEntity } from './ship.ts';

export interface WorldGoal {
  id: number;
  kind: WorldGoalKind;
  target: number;
  port: string | null;
  progress: number;
  hands: Record<string, number>;
  names: Record<string, string>;
  done: boolean;
}

export interface WorldGoalsState {
  week: number;
  goals: WorldGoal[];
  /** Pay not yet collected by hands who were ashore when a goal was met: account → silver, xp. */
  owed: Record<string, { silver: number; xp: number }>;
}

const KEY = 'world_goals';
const states = new WeakMap<Game, { st: WorldGoalsState; dirty: boolean }>();

function ports(game: Game): Port[] {
  return game.world.ports.filter((p) => p.region !== 'the_abyss' && p.region !== 'drowned_crown' && !!REGIONS[p.region]);
}

function fresh(game: Game, week: number, owed: WorldGoalsState['owed'] = {}): WorldGoalsState {
  const list = worldGoalsFor(week, ports(game).map((p) => p.id));
  return { week, goals: list.map((g, i) => ({ id: week * 10 + i, kind: g.kind, target: g.target, port: g.port ?? null, progress: 0, hands: {}, names: {}, done: false })), owed };
}

function entry(game: Game): { st: WorldGoalsState; dirty: boolean } {
  let e = states.get(game);
  if (!e) {
    const saved = game.db.getKv<WorldGoalsState>(KEY);
    e = { st: saved && Array.isArray(saved.goals) ? saved : fresh(game, weekNumber(game.wallNow())), dirty: true };
    states.set(game, e);
  }
  return e;
}

export function worldGoals(game: Game): WorldGoalsState {
  return entry(game).st;
}

function save(game: Game): void {
  const e = entry(game);
  game.db.setKv(KEY, e.st);
  e.dirty = true;
}

/** The English line of a goal (the client reads it through the patterns). */
export function worldGoalLine(game: Game, g: WorldGoal): string {
  const port = g.port ? game.portById(g.port)?.name ?? g.port : '';
  return WORLD_GOAL_DEFS[g.kind].text[0].replace('{n}', String(g.target)).replace('{port}', port);
}

/** Every few seconds: a new week's goals, and the bar sent to all aboard when it moved. */
export function stepWorldGoals(game: Game): void {
  const e = entry(game);
  const week = weekNumber(game.wallNow());
  if (e.st.week !== week) {
    e.st = fresh(game, week, e.st.owed);
    save(game);
  }
  if (!e.dirty) return;
  e.dirty = false;
  for (const s of game.sessions) if (s.profile && s.disconnectedAt === null) sendWorldGoals(game, s);
}

function add(game: Game, s: PlayerSession, g: WorldGoal, n: number): void {
  if (g.done || !(n > 0) || !s.profile) return;
  const acc = String(s.accountId);
  const k = Math.min(n, g.target - g.progress);
  if (k <= 0) return;
  g.hands[acc] = (g.hands[acc] ?? 0) + k;
  g.names[acc] = s.name;
  g.progress += k;
  if (g.progress >= g.target) finish(game, g);
  save(game);
}

function finish(game: Game, g: WorldGoal): void {
  g.done = true;
  const line = worldGoalLine(game, g);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: The sea’s goal is met: ${line} Every hand in it is paid.`, kind: 'gold' });
  chronicle(game, `The sea’s goal was met: ${line}`);
  const min = worldGoalMin(g.target);
  const st = worldGoals(game);
  for (const [acc, mine] of Object.entries(g.hands)) {
    if (mine < min) continue;
    const s = game.sessionByAccount(Number(acc));
    if (s?.profile && s.disconnectedAt === null) pay(game, s, worldGoalReward(s.profile.level, mine, g.target));
    else {
      const r = worldGoalReward(40, mine, g.target);
      const o = (st.owed[acc] ??= { silver: 0, xp: 0 });
      o.silver += r.silver;
      o.xp += r.xp;
    }
  }
}

function pay(game: Game, s: PlayerSession, r: { silver: number; xp: number }): void {
  s.profile!.gold += r.silver;
  game.db.ledger(s.accountId, 'world_goal', r.silver, 'the sea’s goal');
  game.grantXp(s, r.xp, null);
  game.sendTo(s, { t: 'toast', msg: `Your share of the sea’s goal: ${r.silver} silver.`, kind: 'gold' });
  game.pushSelf(s, true);
}

/** A captain comes aboard: their share of goals met while they were ashore. */
export function worldGoalsCollect(game: Game, s: PlayerSession): void {
  const st = worldGoals(game);
  const r = st.owed[String(s.accountId)];
  if (!r || !s.profile) return;
  delete st.owed[String(s.accountId)];
  pay(game, s, r);
  save(game);
}

function goalsOf(game: Game, kind: WorldGoalKind): WorldGoal[] {
  const st = worldGoals(game);
  if (st.week !== weekNumber(game.wallNow())) return [];
  return st.goals.filter((g) => g.kind === kind && !g.done);
}

/** A ship sunk by a captain (her own kill only, not a groupmate's echo). */
export function worldGoalKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  if (how !== 'sunk' && how !== 'boarded') return;
  if (victim.faction === 'choir') for (const g of goalsOf(game, 'choir')) add(game, s, g, 1);
  if (victim.npcRole === 'pirate') for (const g of goalsOf(game, 'pirates')) add(game, s, g, 1);
}

/** A beast of the sea taken by her. */
export function worldGoalBeast(game: Game, s: PlayerSession): void {
  for (const g of goalsOf(game, 'beasts')) add(game, s, g, 1);
}

/** Fish landed: the units into the hold. */
export function worldGoalCatch(game: Game, s: PlayerSession, units: number): void {
  for (const g of goalsOf(game, 'catch')) add(game, s, g, Math.max(0, Math.floor(units)));
}

/** Goods sold at a port: the goal's port counts them as delivered. */
export function worldGoalSale(game: Game, s: PlayerSession, port: Port, _good: GoodId, n: number): void {
  for (const g of goalsOf(game, 'deliver')) if (g.port === port.id) add(game, s, g, Math.max(0, Math.floor(n)));
}

/** For the admin: n deeds into every goal (or each to one short of its target / met outright). */
export function worldGoalsAdd(game: Game, s: PlayerSession, n: number | 'near' | 'done'): void {
  for (const g of worldGoals(game).goals) {
    if (g.done) continue;
    const k = n === 'near' ? g.target - g.progress - 1 : n === 'done' ? g.target - g.progress : n;
    add(game, s, g, k);
  }
}

export function worldGoalsView(game: Game, accountId: number): WorldGoalView[] {
  const st = worldGoals(game);
  const endsIn = Math.max(0, Math.round(((st.week + 1) * WEEK_MS - game.wallNow()) / 1000));
  return st.goals.map((g) => ({
    id: g.id, kind: g.kind, target: g.target, progress: g.progress,
    port: g.port ? game.portById(g.port)?.name ?? g.port : null,
    mine: g.hands[String(accountId)] ?? 0, min: worldGoalMin(g.target), hands: Object.keys(g.hands).length, done: g.done, endsIn,
    leaders: Object.entries(g.hands).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([acc, n]) => ({ name: g.names[acc] ?? '?', n })),
  }));
}

export function sendWorldGoals(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'wgoals', list: worldGoalsView(game, s.accountId) });
}
