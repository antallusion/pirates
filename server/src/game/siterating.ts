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
import type { Game } from './Game.ts';

export type Board = 'level' | 'glory' | 'boarded' | 'arena' | 'campaign' | 'guilds';
export const BOARDS: Board[] = ['level', 'glory', 'boarded', 'arena', 'campaign', 'guilds'];
export const TOP = 100;
export const RATING_TTL = 60_000;

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
  guild: string | null;
  title: string | null;
  plate: string | null;
  frame: string | null;
}

interface ProfileLike {
  captain?: string;
  level?: number;
  xp?: number;
  throne?: { rank?: number; xp?: number };
  stats?: { boarded?: number };
  campaign?: { at?: number };
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
      case 'level': return by((c) => [c.level, c.glory, c.gloryXp, c.xp]);
      case 'glory': return by((c) => [c.glory, c.gloryXp, c.level]).filter((c) => c.level >= MAX_LEVEL);
      case 'boarded': return by((c) => [c.boarded, c.level]).filter((c) => c.boarded > 0);
      case 'arena': return by((c) => [c.arena, c.arenaW, c.level]).filter((c) => c.arenaN > 0);
      case 'campaign': return by((c) => [c.campaign, c.level]).filter((c) => c.campaign > 0);
    }
  }

  private row(b: Exclude<Board, 'guilds'>, c: Cap, rank: number): RatingRow {
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

  /** A board's top (cached a minute). */
  board(b: Board): BoardView {
    return this.read().boards.get(b)!;
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
    return { captain: this.row('level', c, ranks.level ?? 0), ranks };
  }
}
