// Guests on a captain's island (docs/12 P10 #13): her friends, her guild and those she invites may call. They see her
// trophy hall, her records and her people, drink in her tavern (the silver goes to her treasury), and sign her
// guestbook. The week's visits, drinks and signatures rank the islands.

import type { HallView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import { trophies } from './estate.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';

export const DRINK_COST = 20;
const WEEK_MS = 7 * 86_400_000;
const NEAR_M = 800;

interface GuestHolding extends Holding {
  invited?: string[];
  guestbook?: { name: string; text: string; at: number }[];
  week?: { id: number; visits: number; drinks: number; signs: number };
}

function week(game: Game, h: GuestHolding): { id: number; visits: number; drinks: number; signs: number } {
  const id = Math.floor(game.wallNow() / WEEK_MS);
  if (!h.week || h.week.id !== id) h.week = { id, visits: 0, drinks: 0, signs: 0 };
  return h.week;
}

function score(game: Game, h: GuestHolding): number {
  const w = week(game, h);
  return w.visits + w.drinks + w.signs * 2;
}

function has(h: Holding, b: string): boolean {
  return h.buildings.some((x) => x.id === b && !x.unpaid);
}

/** May she call? Her own, her friends', her guild's, or where she is invited. */
export function welcome(game: Game, s: PlayerSession, h: GuestHolding): boolean {
  if (h.owner.kind !== 'player') return false;
  if (h.owner.id === s.accountId) return true;
  if ((h.invited ?? []).includes(s.name.toLowerCase())) return true;
  const owner = game.sessionByAccount(h.owner.id);
  if (owner?.profile?.friends?.some((f) => f.id === s.accountId)) return true;
  const g1 = game.guilds.of(game, h.owner.id), g2 = game.guilds.of(game, s.accountId);
  return !!g1 && !!g2 && g1.id === g2.id;
}

function near(game: Game, s: PlayerSession, islandId: number): boolean {
  const ship = s.ship;
  const is = game.world.islands[islandId];
  return !!ship && !!is && !ship.docked && Math.hypot(is.x - ship.state.x, is.y - ship.state.y) - is.radius <= NEAR_M;
}

function holding(game: Game, islandId: number): GuestHolding | null {
  const h = game.holdings.get(game, islandId) as GuestHolding | undefined;
  return h && h.owned && h.owner.kind === 'player' ? h : null;
}

/** She calls: the hall's view (and a visit counted, once a game hour for each guest). */
export function callOn(game: Game, s: PlayerSession, islandId: number): HallView | string {
  const h = holding(game, islandId);
  if (!h) return 'No trophy hall there';
  if (!welcome(game, s, h)) return 'You are not invited to that island.';
  if (h.owner.id !== s.accountId && !near(game, s, islandId)) return `Sail to ${game.world.islands[islandId]?.name ?? '?'} first.`;
  if (h.owner.id !== s.accountId) {
    const key = `${s.accountId}:${Math.floor(game.now / 3600)}`;
    const seen = (lastCall.get(islandId) ?? new Set<string>());
    if (!seen.has(key)) {
      seen.add(key);
      lastCall.set(islandId, seen);
      h.visitors = (h.visitors ?? 0) + 1;
      week(game, h).visits++;
      game.holdings.touch();
      const owner = game.sessionByAccount(h.owner.id);
      if (owner) game.sendTo(owner, { t: 'toast', msg: `${s.name} calls on your island.`, kind: 'info' });
    }
  }
  return hallView(game, s, h);
}
const lastCall = new Map<number, Set<string>>();

export function hallView(game: Game, s: PlayerSession, h: GuestHolding): HallView {
  const owner = game.sessionByAccount(h.owner.id);
  const t = owner?.profile ? trophies(game, owner.profile, owner.name) : { flag: 0, skull: 0, fish: 0 };
  const records = Object.entries(game.db.getKv<Record<string, { name: string; kg: number }>>('fish_records') ?? {}).filter(([, r]) => r.name === h.owner.name).map(([fish, r]) => ({ fish, kg: r.kg }));
  const people: Record<string, number> = {};
  for (const r of h.residents ?? []) people[r.prof] = (people[r.prof] ?? 0) + 1;
  const is = game.world.islands[h.island];
  return {
    island: h.island, name: is?.name ?? '?', owner: h.owner.name, mine: h.owner.id === s.accountId,
    trophies: { ...t, heads: owner?.profile?.nemesisHeads ?? 0 },
    records, people, tavern: has(h, 'tavern'),
    guestbook: (h.guestbook ?? []).slice(-12).reverse(),
    invited: h.owner.id === s.accountId ? [...(h.invited ?? [])] : [],
    week: islandBoard(game),
  };
}

/** A drink in her tavern: the silver to her treasury, a cheer for the guest's crew. */
export function drink(game: Game, s: PlayerSession, islandId: number): string | null {
  const h = holding(game, islandId);
  if (!h || !welcome(game, s, h) || !near(game, s, islandId)) return 'You are not invited to that island.';
  if (!has(h, 'tavern')) return 'There is no tavern on that island.';
  const p = s.profile!;
  if (p.gold < DRINK_COST) return 'Not enough silver';
  p.gold -= DRINK_COST;
  if (h.owner.id !== s.accountId) {
    h.treasury += DRINK_COST;
    week(game, h).drinks++;
  }
  if (s.ship) s.ship.morale = Math.min(100, s.ship.morale + 5);
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `A round in ${h.owner.name}'s tavern: your crew is merrier.`, kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** A line in her guestbook (one a game day for each guest). */
export function sign(game: Game, s: PlayerSession, islandId: number, textRaw: string): string | null {
  const h = holding(game, islandId);
  if (!h || !welcome(game, s, h) || !near(game, s, islandId)) return 'You are not invited to that island.';
  const text = String(textRaw ?? '').replace(/[<>{}`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (text.length < 2) return 'Write something first.';
  h.guestbook ??= [];
  const last = [...h.guestbook].reverse().find((e) => e.name === s.name);
  if (last && game.wallNow() - last.at < 86_400_000 / 24) return 'You have signed already.';
  h.guestbook.push({ name: s.name, text, at: game.wallNow() });
  h.guestbook = h.guestbook.slice(-60);
  if (h.owner.id !== s.accountId) week(game, h).signs++;
  game.holdings.touch();
  const owner = game.sessionByAccount(h.owner.id);
  if (owner && owner !== s) game.sendTo(owner, { t: 'toast', msg: `${s.name} signs your guestbook.`, kind: 'info' });
  return null;
}

/** The owner invites (or un-invites) a captain by name. */
export function invite(game: Game, s: PlayerSession, name: string, on: boolean): string | null {
  const own = Object.values(game.holdings.map(game)).find((h) => h.owned && h.owner.kind === 'player' && h.owner.id === s.accountId) as GuestHolding | undefined;
  if (!own) return 'You have no island of your own.';
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return 'No such captain';
  own.invited ??= [];
  if (on && !own.invited.includes(n)) own.invited.push(n);
  if (!on) own.invited = own.invited.filter((x) => x !== n);
  own.invited = own.invited.slice(-40);
  game.holdings.touch();
  const o = game.sessionByName(name);
  if (on && o) game.sendTo(o, { t: 'toast', msg: `${s.name} invites you to their island, ${game.world.islands[own.island]?.name ?? '?'}.`, kind: 'info' });
  return null;
}

/** The week's islands, by their guests. */
export function islandBoard(game: Game): { owner: string; island: string; score: number }[] {
  return Object.values(game.holdings.map(game)).filter((h) => h.owned && h.owner.kind === 'player').map((h) => ({ owner: h.owner.name, island: game.world.islands[h.island]?.name ?? '?', score: score(game, h as GuestHolding) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

