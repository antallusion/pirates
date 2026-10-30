// The captains' rating of the website (owner, 2026-10-20: «рейтинг капитанов»; /site/rating/, GET /api/site/rating).
// Read-only and public: every saved captain (her live state if she is aboard) is read at most once a minute, the
// hidden left out — the banned (the forum's ban), the load-test bots, the tester's accounts and any the owner hides —
// and each board keeps its top 100. Only what the game itself shows other captains goes out: the name, the captain's
// kind (her portrait), the level, the board's value, the guild's tag and what she wears that others see (the title on
// its plate, the avatar frame: shared/src/data/cosmetics.ts). No account id, no e-mail.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { CAMPAIGN_SIZE } from '../../../shared/src/data/campaign/plan.ts';
import { chapterOfSlot } from '../../../shared/src/data/campaign/progress.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { cosItem } from '../../../shared/src/data/cosmetics.ts';
import { arenaTable } from './arena.ts';
import { monthOf } from '../../../shared/src/data/pvprank.ts';
import { monthTally, pastSeasons } from './pvprank.ts';
import type { Game } from './Game.ts';
import { powerOfSave } from './power.ts';
import type { PowerSave } from './power.ts';
import type { PowerScore } from '../../../shared/src/data/power.ts';
import type { PowerBoard, PowerRankView } from '../../../shared/src/powerproto.ts';

export type Board = PowerBoard | 'level' | 'glory' | 'boarded' | 'arena' | 'pvp' | 'campaign' | 'guilds';
/** «pvp»: this month's PvP points (owner, 2026-10-30; pvprank.ts), with the month's kills and deaths.
 *  «power» and its parts «army», «ship», «isle», «gear» (owner, 2026-10-31: «рейтинг должен строиться на мощи … выводи в
 *  рейтинг именно по этой мощи»; shared/src/data/power.ts): the total is the main board — the first, the default, and the
 *  place a captain is told everywhere. */
export const BOARDS: Board[] = ['power', 'army', 'ship', 'isle', 'gear', 'level', 'glory', 'boarded', 'arena', 'pvp', 'campaign', 'guilds'];
export const POWER_BOARDS: PowerBoard[] = ['power', 'army', 'ship', 'isle', 'gear'];
/** The board when none is asked for. */
export const DEFAULT_BOARD: Board = 'power';
export const TOP = 100;
export const RATING_TTL = 60_000;
/** Who is in the game now is read afresh at most this often (owner, 2026-10-29: «"в сети" должны показываться люди кто
 *  играют, а не кто на форуме»). */
export const ONLINE_TTL = 12_000;

/** The captains in the game now (connected to the game server, the hidden left out): the site's and the forum's «в сети». */
export interface OnlineView {
  at: number;
  count: number;
  /** Their names (public captains only; the rating's filter and its green dots). */
  names: string[];
}

/** A captain on a board (public fields only). */
export interface RatingRow {
  rank: number;
  name: string;
  /** Her captain's kind (the portrait's id is `portrait.<captain>`). */
  captain: string;
  level: number;
  /** The board's number: level, glory rank, boardings won, the Colosseum's rating, the campaign's chapter. */
  value: number;
  /** A second number where the board has one: glory rank on «level», wins on «arena», the campaign done (1). */
  sub?: number;
  /** «pvp»: the month's captains sunk or taken, and her deaths to captains. */
  kills?: number;
  deaths?: number;
  /** «power» and its parts: her four parts and the total (each row shows the breakdown). */
  pw?: PowerScore;
  guild: string | null;
  title: string | null;
  plate: string | null;
  frame: string | null;
}

export interface GuildRow {
  rank: number;
  tag: string;
  name: string;
  members: number;
  /** The members' levels together. */
  value: number;
  /** Its best captain's level. */
  top: number;
}

export interface BoardView {
  board: Board;
  at: number;
  rows: RatingRow[] | GuildRow[];
}

/** A captain found by name: her card and her place on each board (null: not in its top). */
export interface FoundView {
  captain: RatingRow;
  ranks: Partial<Record<Board, number | null>>;
}

interface Cap {
  acc: number;
  name: string;
  captain: string;
  level: number;
  xp: number;
  glory: number;
  gloryXp: number;
  boarded: number;
  campaign: number;
  arena: number;
  arenaN: number;
  arenaW: number;
  pvp: number;
  pvpK: number;
  pvpD: number;
  pw: PowerScore;
  guild: string | null;
  title: string | null;
  plate: string | null;
  frame: string | null;
}

interface ProfileLike extends PowerSave {
  captain?: string;
  level?: number;
  xp?: number;
  throne?: { rank?: number; xp?: number };
  stats?: { boarded?: number };
  campaign?: { at?: number };
  pvpr?: unknown;
}

/** The accounts the load-test and the testers sail (tools/bot.ts «Bot xxxxxx», «QA …», «Test …»). */
export const TEST_NAME = /^(?:bot|qa|test|tester)(?:[\s_\-.]|\d|$)/i;

export interface RatingOptions {
  /** Hidden for another reason (the forum's ban). */
  banned?: (accountId: number) => boolean;
  now?: () => number;
  ttl?: number;
}

const num = (v: unknown, lo = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.floor(v)) : lo);

export class SiteRating {
  private game: Game;
  private opts: RatingOptions;
  private live: { at: number; accs: Set<number>; names: string[] } | null = null;
  private snap: { at: number; caps: Cap[]; lists: Map<Board, Map<Cap, number>>; boards: Map<Board, BoardView>; byName: Map<string, Cap> } | null = null;

  constructor(game: Game, opts: RatingOptions = {}) {
    this.game = game;
    this.opts = opts;
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  /** Whether an account is kept off the site: banned, a test or bot account, or hidden by the owner (SITE_HIDDEN, the
   *  kv list `site_hidden`: account ids or names). */
  hidden(acc: number, name: string): boolean {
    if (TEST_NAME.test(name.trim())) return true;
    if (this.opts.banned?.(acc)) return true;
    const list = [...(process.env.SITE_HIDDEN ?? '').split(','), ...(this.game.db.getKv<(string | number)[]>('site_hidden') ?? [])].map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    return list.includes(String(acc)) || list.includes(name.trim().toLowerCase());
  }

  private wardrobe(acc: number): { title: string | null; plate: string | null; frame: string | null } {
    const raw = this.game.db.getKv<{ eq?: Record<string, unknown> }>(`cos:${acc}`)?.eq ?? {};
    const pick = (slot: string) => (typeof raw[slot] === 'string' && cosItem(`${slot}:${raw[slot]}`) ? (raw[slot] as string) : null);
    return { title: pick('title'), plate: pick('plate'), frame: pick('frame') };
  }

  /** Everyone read afresh (at most once a TTL). */
  private read(): NonNullable<SiteRating['snap']> {
    const at = this.now();
    if (this.snap && at - this.snap.at < (this.opts.ttl ?? RATING_TTL)) return this.snap;
    const game = this.game;
    const arena = new Map(arenaTable(game).map((r) => [r.acc, r]));
    const month = monthOf(game.wallNow());
    const caps: Cap[] = [];
    for (const row of game.db.allCaptains()) {
      if (!row.name || this.hidden(row.account_id, row.name)) continue;
      let p: ProfileLike | null = (game.sessionByAccount(row.account_id)?.profile as ProfileLike | null | undefined) ?? null;
      if (!p) {
        try {
          p = JSON.parse(row.data) as ProfileLike;
        } catch {
          continue;
        }
      }
      if (!p || typeof p.captain !== 'string' || !Object.hasOwn(CAPTAINS, p.captain)) continue;
      const a = arena.get(row.account_id);
      caps.push({
        acc: row.account_id, name: row.name, captain: p.captain, level: Math.max(1, num(p.level, 1)), xp: num(p.xp),
        glory: num(p.throne?.rank), gloryXp: num(p.throne?.xp), boarded: num(p.stats?.boarded), campaign: Math.min(CAMPAIGN_SIZE, num(p.campaign?.at)),
        arena: a && a.n > 0 ? num(a.r) : 0, arenaN: a ? num(a.n) : 0, arenaW: a ? num(a.w) : 0,
        ...((t) => ({ pvp: t?.pts ?? 0, pvpK: t?.kills ?? 0, pvpD: t?.deaths ?? 0 }))(monthTally(p.pvpr, month)),
        pw: this.power(row.account_id, p),
        guild: game.guilds.of(game, row.account_id)?.tag ?? null, ...this.wardrobe(row.account_id),
      });
    }
    const byName = new Map(caps.map((c) => [c.name.toLowerCase(), c]));
    this.snap = { at, caps, lists: new Map(), boards: new Map(), byName };
    for (const b of BOARDS) {
      if (b === 'guilds') {
        this.snap.boards.set(b, this.guildBoard(caps, at));
        continue;
      }
      // (every place kept, so a captain found by name is told hers even beyond the top 100)
      const list = this.sorted(b, caps);
      this.snap.lists.set(b, new Map(list.map((c, i) => [c, i + 1])));
      this.snap.boards.set(b, { board: b, at, rows: list.slice(0, TOP).map((c, i) => this.row(b, c, i + 1)) });
    }
    return this.snap;
  }

  private sorted(b: Exclude<Board, 'guilds'>, caps: Cap[]): Cap[] {
    const by = (f: (c: Cap) => number[]) => [...caps].sort((x, y) => {
      const a = f(x), c = f(y);
      for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) return c[i] - a[i];
      return x.name.localeCompare(y.name);
    });
    switch (b) {
      case 'power': return by((c) => [c.pw.total, c.level, c.xp]);
      case 'army': return by((c) => [c.pw.army, c.pw.total]).filter((c) => c.pw.army > 0);
      case 'ship': return by((c) => [c.pw.ship, c.pw.total]).filter((c) => c.pw.ship > 0);
      case 'isle': return by((c) => [c.pw.isle, c.pw.total]).filter((c) => c.pw.isle > 0);
      case 'gear': return by((c) => [c.pw.gear, c.pw.total]).filter((c) => c.pw.gear > 0);
      case 'level': return by((c) => [c.level, c.glory, c.gloryXp, c.xp]);
      case 'glory': return by((c) => [c.glory, c.gloryXp, c.level]).filter((c) => c.level >= MAX_LEVEL);
      case 'boarded': return by((c) => [c.boarded, c.level]).filter((c) => c.boarded > 0);
      case 'arena': return by((c) => [c.arena, c.arenaW, c.level]).filter((c) => c.arenaN > 0);
      case 'pvp': return by((c) => [c.pvp, c.pvpK, -c.pvpD]).filter((c) => c.pvp > 0);
      case 'campaign': return by((c) => [c.campaign, c.level]).filter((c) => c.campaign > 0);
    }
  }

  private row(b: Exclude<Board, 'guilds'>, c: Cap, rank: number): RatingRow {
    if (b === 'power' || b === 'army' || b === 'ship' || b === 'isle' || b === 'gear') {
      return { rank, name: c.name, captain: c.captain, level: c.level, value: b === 'power' ? c.pw.total : c.pw[b], pw: c.pw, guild: c.guild, title: c.title, plate: c.plate, frame: c.frame };
    }
    if (b === 'pvp') return { rank, name: c.name, captain: c.captain, level: c.level, value: c.pvp, kills: c.pvpK, deaths: c.pvpD, guild: c.guild, title: c.title, plate: c.plate, frame: c.frame };
    const value = b === 'level' ? c.level : b === 'glory' ? c.glory : b === 'boarded' ? c.boarded : b === 'arena' ? c.arena : chapterOfSlot(c.campaign >= CAMPAIGN_SIZE ? CAMPAIGN_SIZE - 1 : c.campaign).ch;
    const sub = b === 'level' && c.glory > 0 ? c.glory : b === 'arena' ? c.arenaW : b === 'campaign' && c.campaign >= CAMPAIGN_SIZE ? 1 : undefined;
    return { rank, name: c.name, captain: c.captain, level: c.level, value, ...(sub !== undefined ? { sub } : {}), guild: c.guild, title: c.title, plate: c.plate, frame: c.frame };
  }

  private guildBoard(caps: Cap[], at: number): BoardView {
    {
      const lv = new Map(caps.map((c) => [c.acc, c.level]));
      const rows = Object.values(this.game.guilds.store(this.game).guilds)
        .map((g) => {
          const ms = g.members.filter((m) => lv.has(m.account));
          return { tag: g.tag, name: g.name, members: ms.length, value: ms.reduce((s, m) => s + (lv.get(m.account) ?? 0), 0), top: Math.max(0, ...ms.map((m) => lv.get(m.account) ?? 0)) };
        })
        .filter((g) => g.members > 0)
        .sort((x, y) => y.value - x.value || y.members - x.members || x.name.localeCompare(y.name))
        .slice(0, TOP)
        .map((g, i) => ({ rank: i + 1, ...g }));
      return { board: 'guilds', at, rows };
    }
  }

  /** The captains in the game now: every session connected and signed in (a dropped one waiting out its grace is not),
   *  the hidden (bots, testers, the banned, the owner's list) left out. Cached ONLINE_TTL. */
  private present(): { at: number; accs: Set<number>; names: string[] } {
    const at = this.now();
    if (this.live && at - this.live.at < ONLINE_TTL) return this.live;
    const accs = new Set<number>();
    const names: string[] = [];
    for (const s of this.game.sessions) {
      if (!s.authed || s.disconnectedAt !== null || !s.name || accs.has(s.accountId)) continue;
      if (this.hidden(s.accountId, s.name)) continue;
      accs.add(s.accountId);
      names.push(s.name);
    }
    names.sort((a, b) => a.localeCompare(b));
    this.live = { at, accs, names };
    return this.live;
  }

  /** «В сети»: how many captains are in the game now, and who. */
  online(): OnlineView {
    const p = this.present();
    return { at: p.at, count: p.names.length, names: p.names };
  }

  /** Whether an account's captain is in the game now (the forum's online dot). */
  isOnline(acc: number): boolean {
    return this.present().accs.has(acc);
  }

  /** The accounts in the game now (the forum's «кто в сети»). */
  onlineAccounts(): number[] {
    return [...this.present().accs];
  }

  /** A board's top (cached a minute); `onlineOnly`: only the captains in the game now (a guild: with one aboard), each at
   *  her real place on the whole board. */
  board(b: Board, onlineOnly = false): BoardView {
    const snap = this.read();
    const full = snap.boards.get(b)!;
    if (!onlineOnly) return full;
    const on = this.present();
    if (b === 'guilds') {
      const tags = new Set(Object.values(this.game.guilds.store(this.game).guilds).filter((g) => g.members.some((m) => on.accs.has(m.account))).map((g) => g.tag));
      return { board: b, at: on.at, rows: (full.rows as GuildRow[]).filter((r) => tags.has(r.tag)) };
    }
    const rows = [...(snap.lists.get(b) ?? new Map<Cap, number>())].filter(([c]) => on.accs.has(c.acc)).sort((x, y) => x[1] - y[1]).slice(0, TOP).map(([c, rank]) => this.row(b, c, rank));
    return { board: b, at: on.at, rows };
  }

  /** Her power from her save (her live army aboard); an unreadable save counts nought. */
  private power(acc: number, p: ProfileLike): PowerScore {
    try {
      const s = this.game.sessionByAccount(acc);
      return powerOfSave(this.game, acc, p, s?.ship?.army);
    } catch {
      return { total: 0, army: 0, ship: 0, isle: 0, gear: 0 };
    }
  }

  /** The Captain window's «Мощь» page: her places on the five power boards (null: not on one), how many are on the
   *  board, and its top ten (a minute's snapshot, as the site's). */
  powerBoard(acc: number): Pick<PowerRankView, 'ranks' | 'ranked' | 'top'> {
    const snap = this.read();
    const c = snap.caps.find((x) => x.acc === acc);
    const ranks = Object.fromEntries(POWER_BOARDS.map((b) => [b, c ? snap.lists.get(b)?.get(c) ?? null : null])) as PowerRankView['ranks'];
    const top = (snap.boards.get('power')?.rows as RatingRow[] | undefined ?? []).slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, captain: r.captain, level: r.level, pw: r.pw! }));
    return { ranks, ranked: snap.lists.get('power')?.size ?? 0, top };
  }

  /** The PvP seasons closed (newest first): each month's top ten, the hidden left out, no account ids. */
  pvpSeasons(): ReturnType<typeof pastSeasons> {
    return pastSeasons(this.game, (acc, name) => this.hidden(acc, name));
  }

  /** A public captain's PvP tally this month (the site's profile): null for none. */
  pvpOf(acc: number): { pts: number; kills: number; deaths: number } | null {
    const c = this.read().caps.find((x) => x.acc === acc);
    return c && c.pvp > 0 ? { pts: c.pvp, kills: c.pvpK, deaths: c.pvpD } : null;
  }

  /** A captain by her name (case aside): her card and her places; null when there is no such public captain. */
  find(name: string): FoundView | null {
    const snap = this.read();
    const c = snap.byName.get(name.trim().toLowerCase());
    if (!c) return null;
    const ranks: FoundView['ranks'] = {};
    for (const b of BOARDS) {
      if (b === 'guilds') continue;
      ranks[b] = snap.lists.get(b)?.get(c) ?? null;
    }
    // (her card is the power board's: her total and parts, and her place there — the place she is told everywhere)
    return { captain: this.row('power', c, ranks.power ?? 0), ranks };
  }

  /** A public captain's account by her name (case aside), for the site's profile (siteprofile.ts): never a hidden one. */
  account(name: string): { acc: number; name: string; found: FoundView } | null {
    const c = this.read().byName.get(name.trim().toLowerCase());
    const found = c ? this.find(c.name) : null;
    return c && found ? { acc: c.acc, name: c.name, found } : null;
  }
}
