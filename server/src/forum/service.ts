// The forum's rules (docs/32_FORUM.md): who may do what (every check here, on the server), the rate limits and the
// traps against bots, the notifications, and the link to the game (a member's captain, level, guild and deeds).
// The HTTP side is server/src/http/forum-routes.ts; the rows are in store.ts.

import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEEDS } from '../../../shared/src/data/deeds.ts';
import { DATA_RU_CORE } from '../../../client/src/lang/data.ru.ts';
import { foreignHosts, mentionsOf, plainText, quotesOf, renderMd } from '../../../shared/src/forum/markdown.ts';
import {
  DEED_MEDAL, FORUM_MEDALS, HOT_REPLIES, HOT_VIEWS, IMAGE_MAX, isStaff, LIST_PER_PAGE, MESSAGE_MAX, POST_MAX, POSTS_PER_PAGE, rankOf, REACTIONS,
  REPORT_MAX, ROLES, TITLE_MAX, TITLE_MIN, TOPICS_PER_PAGE, VIDEO_MAX,
} from '../../../shared/src/forum/meta.ts';
import type { ForumErrorCode, Role } from '../../../shared/src/forum/meta.ts';
import { maskBadWords } from '../../../shared/src/chat.ts';
import { formTrapped } from '../mailguard.ts';
import { seed, SYSTEM_ID } from './seed.ts';
import { postReplies29, postThreads28 } from './posts28.ts';
import type { ForumStore, PostRow, SectionRow, TopicRow, UserRow } from './store.ts';

export type Lang = 'ru' | 'en';

export class ForumError extends Error {
  code: ForumErrorCode;
  status: number;
  constructor(code: ForumErrorCode, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
function fail(code: ForumErrorCode, status = 400): never {
  throw new ForumError(code, status);
}

// ------------------------------------------------------------------------------------------------ the game's side

export interface CharInfo { captain: string; level: number; ship: string; deeds: string[] }
export interface GuildInfo { id: number; name: string; tag: string; rank: string }
/** What the forum asks of the game (main.ts wires it to the running Game; tests give a fake). */
export interface GameLink {
  accountName(id: number): string | null;
  character(id: number): CharInfo | null;
  guildOf(id: number): GuildInfo | null;
  guild(tag: string): { id: number; name: string; tag: string; members: { account: number; name: string; rank: string }[] } | null;
  online(id: number): boolean;
  inGame(): number;
}
export const NO_GAME: GameLink = { accountName: () => null, character: () => null, guildOf: () => null, guild: () => null, online: () => false, inGame: () => 0 };

// ------------------------------------------------------------------------------------------------ limits

/** Sliding-window counters in memory (a restart forgets them: the windows are short). */
export class Limiter {
  private hits = new Map<string, number[]>();
  private now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  /** May one more happen under `max` in `windowMs`? If so it is counted. */
  take(key: string, max: number, windowMs: number): boolean {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (list.length >= max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) for (const [k, v] of this.hits) if (!v.some((x) => t - x < 3_600_000)) this.hits.delete(k);
    return true;
  }
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** [max, window] pairs per action; a new member's are tighter. */
const LIMITS: Record<string, { all: [number, number][]; fresh: [number, number][] }> = {
  post: { all: [[1, 15_000], [30, HOUR]], fresh: [[1, 45_000], [10, HOUR]] },
  topic: { all: [[1, 2 * MIN], [8, HOUR]], fresh: [[1, 5 * MIN], [2, HOUR]] },
  message: { all: [[1, 5_000], [30, HOUR]], fresh: [[1, 20_000], [10, HOUR]] },
  react: { all: [[60, MIN]], fresh: [[30, MIN]] },
  rep: { all: [[30, HOUR]], fresh: [[10, HOUR]] },
  report: { all: [[10, HOUR]], fresh: [[3, HOUR]] },
  upload: { all: [[1, 3_000], [20, HOUR]], fresh: [[1, 10_000], [5, HOUR]] },
  edit: { all: [[30, HOUR]], fresh: [[10, HOUR]] },
};
const UPLOAD_DAY_BYTES = 120 * 1024 * 1024;
/** A new member: fewer than three posts and less than a day on the forum. */
export const FRESH_POSTS = 3;
/** The least time a new member's topic form is open (ms), above the honeypot's 1.5 s. */
export const FRESH_TOPIC_MS = 4000;
const ONLINE_MS = 10 * MIN;
const CHAR_TTL = 5 * MIN;

// ------------------------------------------------------------------------------------------------ views

export interface UserLite { id: number; name: string; role: Role; avatar: string; rank: number; captain: string | null; level: number | null; online: boolean }
export interface Medal { icon: string; id?: string; en?: string; ru?: string }
export interface AuthorView extends UserLite {
  posts: number; rep: number; joined: number; ship: string | null; guild: { tag: string; name: string; rank: string } | null; medals: Medal[]; medalsMore: number;
}

interface Stored { captain: string; level: number; ship: string; deeds: string[]; guild: GuildInfo | null }

export interface ForumOptions {
  store: ForumStore;
  link?: GameLink;
  now?: () => number;
  /** Account ids made admins / moderators at start (FORUM_ADMINS, FORUM_MODS). */
  admins?: number[];
  mods?: number[];
  /** Where uploads are written (null: kept in memory — the tests'). */
  uploadsDir?: string | null;
  /** The portraits a member may take for an avatar (ids under /assets/portraits/). */
  avatars?: string[];
}

const CLASS_IDS = new Set(['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral']);
const DEED_INDEX = new Map(DEEDS.map((d, i) => [d.id, i]));

export class ForumService {
  readonly store: ForumStore;
  readonly link: GameLink;
  readonly limiter: Limiter;
  readonly now: () => number;
  private admins: Set<number>;
  private mods: Set<number>;
  private uploadsDir: string | null;
  readonly memFiles = new Map<string, Buffer>();
  readonly avatars: string[];
  private viewed = new Map<string, number>();
  private html = new Map<string, string>();

  constructor(o: ForumOptions) {
    this.store = o.store;
    this.link = o.link ?? NO_GAME;
    this.now = o.now ?? Date.now;
    this.limiter = new Limiter(this.now);
    this.admins = new Set(o.admins ?? []);
    this.mods = new Set(o.mods ?? []);
    this.uploadsDir = o.uploadsDir ?? null;
    if (this.uploadsDir) mkdirSync(this.uploadsDir, { recursive: true });
    this.avatars = o.avatars ?? ['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'];
    seed(this.store, this.now());
    postThreads28(this.store, this.now());
    postReplies29(this.store, this.now());
    for (const id of this.admins) if (this.store.user(id)) this.store.setRole(id, 'admin');
    for (const id of this.mods) if (this.store.user(id) && !this.admins.has(id)) this.store.setRole(id, 'moderator');
  }

  // ---------------------------------------------------------------------------------------------- members

  /** The member behind a game account, made on her first visit; her name, last visit and captain kept fresh. */
  touch(accountId: number, name: string): UserRow {
    const now = this.now();
    let u = this.store.user(accountId);
    if (!u) {
      const role: Role = this.admins.has(accountId) ? 'admin' : this.mods.has(accountId) ? 'moderator' : 'user';
      this.store.addUser(accountId, name, role, now);
      u = this.store.user(accountId)!;
    } else {
      if (u.name !== name) this.store.setUserName(accountId, name);
      if (now - u.last_seen > 30_000) this.store.seen(accountId, now);
    }
    if (now - u.char_at > CHAR_TTL) this.refreshChar(accountId);
    return this.store.user(accountId)!;
  }

  private refreshChar(id: number): void {
    const c = this.link.character(id);
    const g = this.link.guildOf(id);
    const s: Stored | null = c ? { captain: c.captain, level: c.level, ship: c.ship, deeds: c.deeds.slice(0, 64), guild: g } : null;
    this.store.setChar(id, JSON.stringify(s), this.now());
  }

  private stored(u: UserRow): Stored | null {
    try {
      return u.char_json ? (JSON.parse(u.char_json) as Stored | null) : null;
    } catch {
      return null;
    }
  }

  isFresh(u: UserRow): boolean {
    return u.posts < FRESH_POSTS && this.now() - u.joined < DAY && !isStaff(u.role);
  }

  avatarUrl(u: UserRow, s = this.stored(u)): string {
    if (u.id === SYSTEM_ID) return '/site/img/brand/icon.webp';
    const a = u.avatar && this.avatars.includes(u.avatar) ? u.avatar : s && CLASS_IDS.has(s.captain) ? s.captain : 'pirate_00';
    return `/assets/portraits/${a}.webp`;
  }

  lite(u: UserRow | undefined): UserLite | null {
    if (!u) return null;
    const s = this.stored(u);
    return {
      id: u.id, name: u.name, role: u.role, avatar: this.avatarUrl(u, s), rank: rankOf(u.posts, u.rep), captain: s?.captain ?? null, level: s?.level ?? null,
      online: u.id !== SYSTEM_ID && (this.now() - u.last_seen < ONLINE_MS || this.link.online(u.id)),
    };
  }

  medals(u: UserRow, s = this.stored(u)): Medal[] {
    const out: Medal[] = [];
    for (const m of FORUM_MEDALS) if (m.ok(u)) out.push({ icon: m.icon, id: m.id });
    for (const d of s?.deeds ?? []) {
      const i = DEED_INDEX.get(d);
      if (i === undefined) continue;
      const def = DEEDS[i];
      out.push({ icon: DEED_MEDAL[def.path] ?? 'chest', en: def.name, ru: DATA_RU_CORE[`deeds.DEEDS.${i}.name`] ?? def.name });
    }
    return out;
  }

  author(u: UserRow | undefined, shown = 5): AuthorView | null {
    if (!u) return null;
    const s = this.stored(u);
    const base = this.lite(u)!;
    // the row shows each picture once (several deeds of one path share a medal); the profile lists them all
    const all = this.medals(u, s);
    const seen = new Set<string>();
    const medals = shown >= 99 ? all : all.filter((m) => !seen.has(m.icon) && !!seen.add(m.icon));
    return {
      ...base, posts: u.posts, rep: u.rep, joined: u.joined, ship: s?.ship ?? null, guild: s?.guild ? { tag: s.guild.tag, name: s.guild.name, rank: s.guild.rank } : null,
      medals: medals.slice(0, shown), medalsMore: Math.max(0, all.length - Math.min(shown, medals.length)),
    };
  }

  private viewer(me: UserRow | null): { staff: boolean; admin: boolean } {
    return { staff: !!me && isStaff(me.role), admin: me?.role === 'admin' };
  }

  private canWrite(me: UserRow | null): UserRow {
    if (!me) return fail('auth', 401);
    if (me.role === 'banned') fail('banned', 403);
    return me;
  }

  private limit(me: UserRow, action: keyof typeof LIMITS): void {
    const l = LIMITS[action];
    const rules = this.isFresh(me) ? l.fresh : l.all;
    for (const [max, win] of rules) if (!this.limiter.take(`${action}:${me.id}:${win}`, max, win)) fail('rate', 429);
  }

  /** The traps: the honeypot, the time since the form was shown, and the links of a new member. */
  private guard(me: UserRow, b: Record<string, unknown>, body: string, minMs = 0): void {
    if (formTrapped(b)) fail('trap');
    if (minMs && this.isFresh(me)) {
      const t = Number(b.t);
      if (!Number.isFinite(t) || t < minMs) fail('trap');
    }
    if (this.isFresh(me) && foreignHosts(body).length) fail('links');
  }

  // ---------------------------------------------------------------------------------------------- reading

  private sectionView(s: SectionRow, lang: Lang) {
    return { id: s.id, slug: s.slug, title: lang === 'ru' ? s.title_ru : s.title_en, desc: lang === 'ru' ? s.desc_ru : s.desc_en, icon: s.icon, staffOnly: !!s.staff_only };
  }

  topicView(t: TopicRow, users: Map<number, UserRow>, sections?: Map<number, SectionRow>, lang: Lang = 'ru') {
    const sec = sections?.get(t.section_id);
    return {
      id: t.id, title: maskBadWords(t.title), pinned: !!t.pinned, official: !!t.official, locked: !!t.locked, hidden: !!t.hidden,
      hot: t.replies >= HOT_REPLIES || t.views >= HOT_VIEWS, views: t.views, replies: t.replies, createdAt: t.created_at, lastAt: t.last_post_at,
      lastPostId: t.last_post_id, author: this.lite(users.get(t.author_id)), lastAuthor: this.lite(users.get(t.last_author_id ?? -1)),
      pages: Math.max(1, Math.ceil((t.replies + 1) / POSTS_PER_PAGE)),
      section: sec ? { slug: sec.slug, title: lang === 'ru' ? sec.title_ru : sec.title_en, icon: sec.icon } : null,
    };
  }

  private topicViews(rows: TopicRow[], lang: Lang, withSection = true) {
    const users = this.store.users(rows.flatMap((t) => [t.author_id, t.last_author_id ?? -1]));
    const sections = withSection ? new Map(this.store.sections().map((s) => [s.id, s])) : undefined;
    return rows.map((t) => this.topicView(t, users, sections, lang));
  }

  stats() {
    const now = this.now();
    return {
      topics: this.store.countTopics(false), posts: this.store.countPosts(false), members: this.store.countMembers(),
      today: this.store.countPosts(false, now - DAY), online: this.store.countOnline(now - ONLINE_MS), inGame: this.link.inGame(),
    };
  }

  home(me: UserRow | null, lang: Lang) {
    const { staff } = this.viewer(me);
    const st = this.store.sectionStats(staff);
    const sections = this.store.sections();
    const lastIds = [...st.values()].map((x) => x.last).filter((x): x is TopicRow => !!x);
    const users = this.store.users(lastIds.map((t) => t.last_author_id ?? t.author_id));
    const categories = this.store.categories().map((c) => ({
      slug: c.slug, title: lang === 'ru' ? c.title_ru : c.title_en,
      sections: sections.filter((s) => s.category_id === c.id).map((s) => {
        const x = st.get(s.id);
        const last = x?.last;
        return {
          ...this.sectionView(s, lang), topics: x?.topics ?? 0, posts: x?.posts ?? 0,
          last: last ? { topicId: last.id, title: maskBadWords(last.title), postId: last.last_post_id, at: last.last_post_at, author: this.lite(users.get(last.last_author_id ?? last.author_id)) } : null,
        };
      }),
    }));
    return { stats: this.stats(), categories, fresh: this.fresh(me, lang) };
  }

  fresh(me: UserRow | null, lang: Lang, n = 10) {
    return this.topicViews(this.store.freshTopics(this.viewer(me).staff, n), lang);
  }

  section(me: UserRow | null, slug: string, page: number, lang: Lang) {
    const s = this.store.sectionBySlug(slug) ?? fail('not_found', 404);
    const { staff } = this.viewer(me);
    const total = this.store.countSectionTopics(s.id, staff);
    const pages = Math.max(1, Math.ceil(total / TOPICS_PER_PAGE));
    const p = clampPage(page, pages);
    const rows = this.store.sectionTopics(s.id, staff, (p - 1) * TOPICS_PER_PAGE, TOPICS_PER_PAGE);
    return {
      section: this.sectionView(s, lang), topics: this.topicViews(rows, lang, false), page: p, pages, total,
      canPost: !!me && me.role !== 'banned' && (!s.staff_only || staff), fresh: this.fresh(me, lang, 8),
    };
  }

  /** The page of a post in its topic (for `p/<id>` addresses and the quote links). */
  where(me: UserRow | null, postId: number) {
    const p = this.store.post(postId) ?? fail('not_found', 404);
    const t = this.store.topic(p.topic_id) ?? fail('not_found', 404);
    if (t.hidden && !this.viewer(me).staff) fail('not_found', 404);
    return { topicId: t.id, page: Math.floor(this.store.postIndex(p) / POSTS_PER_PAGE) + 1, postId: p.id };
  }

  topic(me: UserRow | null, id: number, page: number, lang: Lang, viewerKey: string) {
    const t = this.store.topic(id) ?? fail('not_found', 404);
    const { staff, admin } = this.viewer(me);
    if (t.hidden && !staff) fail('not_found', 404);
    const s = this.store.section(t.section_id)!;
    const total = this.store.countTopicPosts(t.id);
    const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
    const p = clampPage(page, pages);
    // a view counted once an hour per reader
    const vk = `${viewerKey}:${t.id}`;
    const now = this.now();
    if ((this.viewed.get(vk) ?? 0) < now - HOUR) {
      this.viewed.set(vk, now);
      this.store.view(t.id);
      t.views++;
      if (this.viewed.size > 100_000) for (const [k, v] of this.viewed) if (v < now - HOUR) this.viewed.delete(k);
    }
    const rows = this.store.topicPosts(t.id, (p - 1) * POSTS_PER_PAGE, POSTS_PER_PAGE);
    const users = this.store.users([t.author_id, ...rows.map((r) => r.author_id)]);
    return {
      topic: this.topicView(t, users, undefined, lang), section: this.sectionView(s, lang), page: p, pages, total,
      posts: this.postViews(me, rows, lang, users),
      can: { reply: !!me && me.role !== 'banned' && (!t.locked || staff), mod: staff, admin },
    };
  }

  /** Rendered once per version and reader's language. */
  private render(p: PostRow, lang: Lang): string {
    const key = `${p.id}:${p.edited_at ?? 0}:${lang}`;
    let h = this.html.get(key);
    if (h === undefined) {
      const base = lang === 'ru' ? '/site/forum/' : '/site/en/forum/';
      h = renderMd(p.body_md, { lang, userBase: `${base}u/`, postBase: `${base}p/` });
      if (this.html.size > 5000) this.html.clear();
      this.html.set(key, h);
    }
    return h;
  }

  postViews(me: UserRow | null, rows: PostRow[], lang: Lang, users = this.store.users(rows.map((r) => r.author_id))) {
    const { staff, admin } = this.viewer(me);
    const ids = rows.map((r) => r.id);
    const reacts = this.store.reactions(ids);
    const mine = me ? this.store.repsOn(me.id, ids) : new Map<number, number>();
    const replyPosts = this.store.postsOf(rows.map((r) => r.reply_to ?? -1).filter((x) => x > 0));
    const replyUsers = this.store.users([...replyPosts.values()].map((r) => r.author_id));
    const editors = this.store.users(rows.map((r) => r.edited_by ?? -1));
    return rows.map((r) => {
      const counts: Record<string, number> = {};
      const my: string[] = [];
      for (const x of reacts) {
        if (x.post_id !== r.id) continue;
        counts[x.emoji] = (counts[x.emoji] ?? 0) + 1;
        if (me && x.user_id === me.id) my.push(x.emoji);
      }
      const rp = r.reply_to ? replyPosts.get(r.reply_to) : undefined;
      const hiddenToMe = !!r.hidden && !staff;
      const canEdit = !!me && me.role !== 'banned' && (staff || me.id === r.author_id);
      return {
        id: r.id, num: r.num, topicId: r.topic_id, html: hiddenToMe ? '' : this.render(r, lang), md: canEdit ? r.body_md : undefined,
        at: r.created_at, editedAt: r.edited_at, editedBy: r.edited_by && r.edited_by !== r.author_id ? editors.get(r.edited_by)?.name ?? null : null,
        replyTo: rp ? { id: rp.id, name: replyUsers.get(rp.author_id)?.name ?? '?' } : null,
        hidden: !!r.hidden, official: !!r.official, reactions: counts, mine: my, myRep: mine.get(r.id) ?? 0,
        canEdit, canMod: staff, canOfficial: admin, author: this.author(users.get(r.author_id)),
      };
    });
  }

  // ---------------------------------------------------------------------------------------------- writing

  createTopic(me0: UserRow | null, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    const s = this.store.sectionBySlug(String(b.section ?? '')) ?? fail('not_found', 404);
    if (s.staff_only && !isStaff(me.role)) fail('forbidden', 403);
    const title = cleanTitle(b.title);
    const body = cleanBody(b.body, POST_MAX);
    this.guard(me, b, `${title}\n${body}`, FRESH_TOPIC_MS);
    this.limit(me, 'topic');
    const now = this.now();
    const out = this.store.tx(() => {
      const tid = this.store.addTopic(s.id, me.id, title, now);
      const p = this.store.addPost(tid, me.id, body, null, now);
      this.store.touchTopic(tid, p.id, me.id, now, true);
      this.store.bump(me.id, 'posts', 1);
      this.store.bump(me.id, 'topics', 1);
      this.store.index('t', tid, title);
      this.store.index('p', p.id, plainText(body));
      return { topicId: tid, postId: p.id };
    });
    this.notifyBody(me, out.topicId, out.postId, body, new Set([me.id]));
    return out;
  }

  reply(me0: UserRow | null, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    const t = this.store.topic(Number(b.topic)) ?? fail('not_found', 404);
    const staff = isStaff(me.role);
    if (t.hidden && !staff) fail('not_found', 404);
    if (t.locked && !staff) fail('locked', 403);
    const body = cleanBody(b.body, POST_MAX);
    let replyTo: number | null = Number(b.replyTo) || null;
    const rp = replyTo ? this.store.post(replyTo) : undefined;
    if (!rp || rp.topic_id !== t.id) replyTo = null;
    this.guard(me, b, body);
    this.limit(me, 'post');
    const now = this.now();
    const p = this.store.tx(() => {
      const p = this.store.addPost(t.id, me.id, body, replyTo, now);
      this.store.touchTopic(t.id, p.id, me.id, now, false);
      this.store.bump(me.id, 'posts', 1);
      this.store.index('p', p.id, plainText(body));
      return p;
    });
    // who hears of it: the quoted and the mentioned first, then the one answered, then the topic's author
    const told = new Set([me.id]);
    this.notifyBody(me, t.id, p.id, body, told);
    if (rp && !told.has(rp.author_id)) {
      told.add(rp.author_id);
      this.store.notify(rp.author_id, 'reply', me.id, t.id, p.id, now);
    }
    if (!told.has(t.author_id) && t.author_id !== SYSTEM_ID) this.store.notify(t.author_id, 'reply', me.id, t.id, p.id, now);
    const index = this.store.postIndex(this.store.post(p.id)!);
    return { postId: p.id, topicId: t.id, page: Math.floor(index / POSTS_PER_PAGE) + 1 };
  }

  /** Quotes and @mentions in a new post. */
  private notifyBody(me: UserRow, topic: number, post: number, body: string, told: Set<number>): void {
    const now = this.now();
    const quoted = this.store.postsOf(quotesOf(body));
    for (const q of quoted.values()) {
      if (told.has(q.author_id) || q.author_id === SYSTEM_ID) continue;
      told.add(q.author_id);
      this.store.notify(q.author_id, 'quote', me.id, topic, post, now);
    }
    for (const name of mentionsOf(body)) {
      const u = this.store.userByName(name);
      if (!u || told.has(u.id) || u.id === SYSTEM_ID) continue;
      told.add(u.id);
      this.store.notify(u.id, 'mention', me.id, topic, post, now);
    }
  }

  edit(me0: UserRow | null, postId: number, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    const p = this.store.post(postId) ?? fail('not_found', 404);
    const t = this.store.topic(p.topic_id)!;
    const staff = isStaff(me.role);
    if (p.author_id !== me.id && !staff) fail('forbidden', 403);
    if (t.locked && !staff) fail('locked', 403);
    const body = cleanBody(b.body, POST_MAX);
    this.guard(me, b, body);
    this.limit(me, 'edit');
    const now = this.now();
    this.store.tx(() => {
      this.store.editPost(p.id, body, me.id, now);
      this.store.index('p', p.id, plainText(body));
      if (b.title !== undefined && t.first_post_id === p.id) {
        const title = cleanTitle(b.title);
        this.store.setTopic(t.id, { title });
        this.store.index('t', t.id, title);
      }
    });
    return { postId: p.id, topicId: t.id, page: Math.floor(this.store.postIndex(p) / POSTS_PER_PAGE) + 1 };
  }

  react(me0: UserRow | null, postId: number, emoji: string) {
    const me = this.canWrite(me0);
    if (!(REACTIONS as readonly string[]).includes(emoji)) fail('bad_request');
    const p = this.store.post(postId) ?? fail('not_found', 404);
    const t = this.store.topic(p.topic_id)!;
    if ((t.hidden || p.hidden) && !isStaff(me.role)) fail('not_found', 404);
    this.limit(me, 'react');
    const now = this.now();
    const on = this.store.toggleReaction(p.id, me.id, emoji, now);
    if (on && p.author_id !== me.id && p.author_id !== SYSTEM_ID && !this.store.hasNotification(p.author_id, 'reaction', me.id, p.id)) {
      this.store.notify(p.author_id, 'reaction', me.id, t.id, p.id, now, emoji);
    }
    const counts: Record<string, number> = {};
    const mine: string[] = [];
    for (const x of this.store.reactions([p.id])) {
      counts[x.emoji] = (counts[x.emoji] ?? 0) + 1;
      if (x.user_id === me.id) mine.push(x.emoji);
    }
    return { reactions: counts, mine };
  }

  rep(me0: UserRow | null, postId: number, value: number) {
    const me = this.canWrite(me0);
    const v = Math.sign(Number(value) || 0);
    const p = this.store.post(postId) ?? fail('not_found', 404);
    if (p.author_id === me.id) fail('self');
    if (p.author_id === SYSTEM_ID) fail('forbidden', 403);
    this.limit(me, 'rep');
    const now = this.now();
    const delta = this.store.tx(() => {
      const d = this.store.setRep(me.id, p.author_id, p.id, v, now);
      if (d) this.store.bump(p.author_id, 'rep', d);
      return d;
    });
    if (delta > 0 && v > 0 && !this.store.hasNotification(p.author_id, 'rep', me.id, p.id)) this.store.notify(p.author_id, 'rep', me.id, p.topic_id, p.id, now);
    return { myRep: v, rep: this.store.user(p.author_id)?.rep ?? 0 };
  }

  report(me0: UserRow | null, postId: number, reason: unknown) {
    const me = this.canWrite(me0);
    const p = this.store.post(postId) ?? fail('not_found', 404);
    const r = String(reason ?? '').trim().slice(0, REPORT_MAX);
    if (r.length < 3) fail('body');
    this.limit(me, 'report');
    return { id: this.store.addReport(p.id, me.id, r, this.now()) };
  }

  // ---------------------------------------------------------------------------------------------- moderation

  modPost(me0: UserRow | null, postId: number, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    if (!isStaff(me.role)) fail('forbidden', 403);
    const p = this.store.post(postId) ?? fail('not_found', 404);
    const f: { hidden?: number; official?: number } = {};
    if (b.hidden !== undefined) f.hidden = b.hidden ? 1 : 0;
    if (b.official !== undefined) {
      if (me.role !== 'admin') fail('forbidden', 403);
      f.official = b.official ? 1 : 0;
    }
    this.store.tx(() => {
      this.store.setPost(p.id, f);
      if (f.official !== undefined && f.official !== p.official) {
        this.store.bump(p.author_id, 'official', f.official ? 1 : -1);
        if (f.official) this.store.setTopic(p.topic_id, { official: 1 });
      }
    });
    return { ok: true };
  }

  modTopic(me0: UserRow | null, topicId: number, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    if (!isStaff(me.role)) fail('forbidden', 403);
    const t = this.store.topic(topicId) ?? fail('not_found', 404);
    const f: Partial<Pick<TopicRow, 'pinned' | 'official' | 'locked' | 'hidden' | 'section_id' | 'title'>> = {};
    for (const k of ['pinned', 'locked', 'hidden'] as const) if (b[k] !== undefined) f[k] = b[k] ? 1 : 0;
    if (b.official !== undefined) {
      if (me.role !== 'admin') fail('forbidden', 403);
      f.official = b.official ? 1 : 0;
    }
    if (b.section !== undefined) {
      const s = this.store.sectionBySlug(String(b.section)) ?? fail('not_found', 404);
      f.section_id = s.id;
    }
    if (b.title !== undefined) f.title = cleanTitle(b.title);
    this.store.setTopic(t.id, f);
    if (f.title) this.store.index('t', t.id, f.title);
    return { ok: true };
  }

  setRole(me0: UserRow | null, userId: number, role: unknown) {
    const me = this.canWrite(me0);
    if (me.role !== 'admin') fail('forbidden', 403);
    if (!(ROLES as unknown[]).includes(role)) fail('bad_request');
    if (userId === me.id || userId === SYSTEM_ID) fail('self');
    if (!this.store.user(userId)) fail('not_found', 404);
    this.store.setRole(userId, role as Role);
    return { ok: true };
  }

  reports(me: UserRow | null) {
    if (!me || !isStaff(me.role)) fail('forbidden', 403);
    const rows = this.store.reports(true, 100);
    const posts = this.store.postsOf(rows.map((r) => r.post_id));
    const topics = this.store.topicsOf([...posts.values()].map((p) => p.topic_id));
    const users = this.store.users([...rows.map((r) => r.reporter_id), ...[...posts.values()].map((p) => p.author_id)]);
    return {
      reports: rows.map((r) => {
        const p = posts.get(r.post_id);
        const t = p ? topics.get(p.topic_id) : undefined;
        return {
          id: r.id, reason: r.reason, at: r.created_at, by: this.lite(users.get(r.reporter_id)), postId: r.post_id,
          topic: t ? { id: t.id, title: t.title } : null, author: p ? this.lite(users.get(p.author_id)) : null, excerpt: p ? plainText(p.body_md).slice(0, 240) : '', hidden: !!p?.hidden,
        };
      }),
    };
  }

  resolveReport(me: UserRow | null, id: number) {
    if (!me || !isStaff(me.role)) fail('forbidden', 403);
    if (!this.store.resolveReport(id, me.id, this.now())) fail('not_found', 404);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------------------------- people

  me(me: UserRow | null) {
    if (!me) return { user: null };
    const s = this.stored(me);
    return {
      user: { ...this.author(me, 99)!, avatarId: me.avatar, mainChar: me.main_char, fresh: this.isFresh(me) },
      unread: { notifications: this.store.unreadNotifications(me.id), messages: this.store.unreadMessages(me.id), reports: isStaff(me.role) ? this.store.countOpenReports() : 0 },
      avatars: this.avatars, chars: s ? [{ id: s.captain, captain: s.captain, level: s.level, ship: s.ship }] : [],
    };
  }

  saveMe(me0: UserRow | null, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    const avatar = b.avatar === null || b.avatar === '' ? null : String(b.avatar ?? me.avatar ?? '');
    if (avatar && !this.avatars.includes(avatar)) fail('bad_request');
    const main = b.mainChar === undefined ? me.main_char : b.mainChar ? String(b.mainChar).slice(0, 32) : null;
    this.store.setProfile(me.id, avatar || null, main);
    this.refreshChar(me.id);
    return this.me(this.store.user(me.id)!);
  }

  profile(me: UserRow | null, ref: string, lang: Lang) {
    const u = (/^\d+$/.test(ref) ? this.store.user(Number(ref)) : this.store.userByName(ref.replace(/^@/, ''))) ?? fail('not_found', 404);
    const { staff } = this.viewer(me);
    const posts = this.store.recentPosts(staff, 0, 8, u.id);
    const topics = this.store.topicsOf(posts.map((p) => p.topic_id));
    return {
      user: this.author(u, 99), role: u.role, lastSeen: u.last_seen, topics: u.topics, official: u.official,
      recent: posts.map((p) => ({ id: p.id, at: p.created_at, topic: topics.has(p.topic_id) ? { id: p.topic_id, title: maskBadWords(topics.get(p.topic_id)!.title) } : null, excerpt: maskBadWords(plainText(p.body_md).slice(0, 220)) })),
      canMessage: !!me && me.id !== u.id && u.id !== SYSTEM_ID && me.role !== 'banned', canRole: me?.role === 'admin' && me.id !== u.id && u.id !== SYSTEM_ID,
      lang,
    };
  }

  guild(tag: string) {
    const g = this.link.guild(tag.toUpperCase()) ?? fail('not_found', 404);
    const users = this.store.users(g.members.map((m) => m.account));
    return {
      guild: { id: g.id, name: g.name, tag: g.tag },
      members: g.members.map((m) => {
        const u = users.get(m.account);
        const s = u ? this.stored(u) : null;
        const c = s ?? this.link.character(m.account);
        return {
          account: m.account, name: m.name, rank: m.rank, captain: c?.captain ?? null, level: c?.level ?? null, forum: !!u, online: this.link.online(m.account),
          avatar: u ? this.avatarUrl(u, s) : c && CLASS_IDS.has(c.captain) ? `/assets/portraits/${c.captain}.webp` : '/assets/portraits/pirate_00.webp',
          medals: u ? this.medals(u, s).slice(0, 4) : [],
        };
      }),
    };
  }

  list(me: UserRow | null, kind: string, page: number, lang: Lang) {
    const { staff } = this.viewer(me);
    const now = this.now();
    const per = LIST_PER_PAGE;
    if (kind === 'topics' || kind === 'today') {
      const since = kind === 'today' ? now - DAY : 0;
      const total = this.store.countTopics(staff, since);
      const pages = Math.max(1, Math.ceil(total / per));
      const p = clampPage(page, pages);
      return { kind, page: p, pages, total, topics: this.topicViews(this.store.freshTopics(staff, per, (p - 1) * per, since), lang) };
    }
    if (kind === 'posts') {
      const total = this.store.countPosts(staff);
      const pages = Math.max(1, Math.ceil(total / per));
      const p = clampPage(page, pages);
      const rows = this.store.recentPosts(staff, (p - 1) * per, per);
      return { kind, page: p, pages, total, posts: this.postBriefs(rows) };
    }
    if (kind === 'members') {
      const total = this.store.countMembers();
      const pages = Math.max(1, Math.ceil(total / per));
      const p = clampPage(page, pages);
      return { kind, page: p, pages, total, members: this.store.members((p - 1) * per, per).map((u) => this.author(u, 4)) };
    }
    if (kind === 'online') {
      const rows = this.store.online(now - ONLINE_MS);
      return { kind, page: 1, pages: 1, total: rows.length, members: rows.map((u) => this.author(u, 4)), inGame: this.link.inGame() };
    }
    return fail('not_found', 404);
  }

  private postBriefs(rows: PostRow[]) {
    const topics = this.store.topicsOf(rows.map((r) => r.topic_id));
    const users = this.store.users(rows.map((r) => r.author_id));
    return rows.map((r) => ({
      id: r.id, at: r.created_at, author: this.lite(users.get(r.author_id)), topic: topics.has(r.topic_id) ? { id: r.topic_id, title: maskBadWords(topics.get(r.topic_id)!.title) } : null,
      excerpt: maskBadWords(plainText(r.body_md).slice(0, 220)),
    }));
  }

  search(me: UserRow | null, q: string, where: string, page: number, lang: Lang) {
    const words = (String(q ?? '').match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 2).slice(0, 6);
    if (!words.length) return { q, in: where, results: [], page: 1, more: false };
    const fts = words.map((w) => `"${w.replace(/"/g, '')}"*`).join(' ');
    const { staff } = this.viewer(me);
    const per = 20;
    const p = Math.max(1, Math.min(50, Math.floor(page) || 1));
    if (where === 'topics') {
      const hits = this.store.search('t', fts, per + 1, (p - 1) * per);
      const topics = this.store.topicsOf(hits.map((h) => h.ref));
      const rows = hits.slice(0, per).map((h) => topics.get(h.ref)).filter((t): t is TopicRow => !!t && (staff || !t.hidden));
      return { q, in: where, page: p, more: hits.length > per, topics: this.topicViews(rows, lang) };
    }
    const hits = this.store.search('p', fts, per + 1, (p - 1) * per);
    const posts = this.store.postsOf(hits.map((h) => h.ref));
    const topics = this.store.topicsOf([...posts.values()].map((x) => x.topic_id));
    const users = this.store.users([...posts.values()].map((x) => x.author_id));
    const out = [];
    for (const h of hits.slice(0, per)) {
      const r = posts.get(h.ref);
      const t = r ? topics.get(r.topic_id) : undefined;
      if (!r || !t || (!staff && (r.hidden || t.hidden))) continue;
      out.push({ id: r.id, at: r.created_at, author: this.lite(users.get(r.author_id)), topic: { id: t.id, title: maskBadWords(t.title) }, snippet: maskBadWords(h.snip) });
    }
    return { q, in: where, page: p, more: hits.length > per, posts: out };
  }

  // ---------------------------------------------------------------------------------------------- messages and notifications

  dialogs(me: UserRow | null) {
    if (!me) return fail('auth', 401);
    const rows = this.store.dialogs(me.id);
    const users = this.store.users(rows.map((r) => r.other));
    return { dialogs: rows.map((r) => ({ with: this.lite(users.get(r.other)), last: { at: r.last.created_at, mine: r.last.from_id === me.id, text: maskBadWords(plainText(r.last.body).slice(0, 140)) }, unread: r.unread })) };
  }

  dialog(me: UserRow | null, other: number, lang: Lang) {
    if (!me) return fail('auth', 401);
    const u = this.store.user(other) ?? this.ensureUser(other) ?? fail('not_found', 404);
    this.store.readDialog(me.id, u.id);
    const rows = this.store.dialog(me.id, u.id, 200);
    const base = lang === 'ru' ? '/site/forum/' : '/site/en/forum/';
    return {
      with: this.author(u, 4), canWrite: me.role !== 'banned' && u.id !== me.id && u.id !== SYSTEM_ID,
      messages: rows.map((m) => ({ id: m.id, at: m.created_at, mine: m.from_id === me.id, html: renderMd(m.body, { lang, userBase: `${base}u/`, postBase: `${base}p/` }) })),
    };
  }

  /** A game account not yet on the forum gets her row when written to. */
  private ensureUser(id: number): UserRow | undefined {
    const name = this.link.accountName(id);
    if (!name) return undefined;
    this.store.addUser(id, name, this.admins.has(id) ? 'admin' : 'user', this.now());
    const u = this.store.user(id)!;
    this.store.setChar(id, 'null', 0);
    return u;
  }

  send(me0: UserRow | null, other: number, b: Record<string, unknown>) {
    const me = this.canWrite(me0);
    if (other === me.id || other === SYSTEM_ID) fail('self');
    const u = this.store.user(other) ?? this.ensureUser(other) ?? fail('not_found', 404);
    const body = cleanBody(b.body, MESSAGE_MAX);
    this.guard(me, b, body);
    this.limit(me, 'message');
    return { id: this.store.addMessage(me.id, u.id, body, this.now()) };
  }

  notifications(me: UserRow | null, lang: Lang) {
    if (!me) return fail('auth', 401);
    const rows = this.store.notifications(me.id, 60);
    const users = this.store.users(rows.map((r) => r.actor_id ?? -1));
    const topics = this.store.topicsOf(rows.map((r) => r.topic_id ?? -1));
    return {
      lang,
      items: rows.map((r) => ({
        id: r.id, kind: r.kind, at: r.created_at, read: !!r.read, actor: this.lite(users.get(r.actor_id ?? -1)), postId: r.post_id, extra: r.extra,
        topic: r.topic_id && topics.has(r.topic_id) ? { id: r.topic_id, title: maskBadWords(topics.get(r.topic_id)!.title) } : null,
      })),
    };
  }

  readNotifications(me: UserRow | null, upTo?: number) {
    if (!me) return fail('auth', 401);
    this.store.readNotifications(me.id, upTo);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------------------------- uploads

  /** A picture or a film: its kind from its first bytes (never from what the browser says), its size within the
   *  limits; written under a random name. */
  upload(me0: UserRow | null, data: Buffer): { url: string; kind: 'image' | 'video'; mime: string } {
    const me = this.canWrite(me0);
    const t = sniff(data);
    if (!t) fail('bad_file', 415);
    const kind = t!.mime === 'video/mp4' ? 'video' : 'image';
    if (data.length > (kind === 'video' ? VIDEO_MAX : IMAGE_MAX)) fail('too_large', 413);
    const day = this.store.uploadedSince(me.id, this.now() - DAY);
    if (day.bytes + data.length > UPLOAD_DAY_BYTES) fail('rate', 429);
    this.limit(me, 'upload');
    const file = `${randomBytes(12).toString('hex')}.${t!.ext}`;
    if (this.uploadsDir) writeFileSync(join(this.uploadsDir, file), data);
    else this.memFiles.set(file, data);
    this.store.addUpload(me.id, file, t!.mime, data.length, this.now());
    return { url: `/api/forum/file/${file}`, kind, mime: t!.mime };
  }

  uploadPath(file: string): { path: string | null; mime: string; size: number } | null {
    if (!/^[0-9a-f]{24}\.(?:png|jpg|webp|mp4)$/.test(file)) return null;
    const r = this.store.upload(file);
    if (!r) return null;
    return { path: this.uploadsDir ? join(this.uploadsDir, file) : null, mime: r.mime, size: r.size };
  }
}

// ------------------------------------------------------------------------------------------------ helpers

export function clampPage(page: number, pages: number): number {
  const p = Math.floor(Number(page) || 1);
  return Math.min(Math.max(1, p), Math.max(1, pages));
}

export function cleanTitle(v: unknown): string {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < TITLE_MIN || t.length > TITLE_MAX) fail('title');
  return t;
}

export function cleanBody(v: unknown, max: number): string {
  const b = String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{4,}/g, '\n\n\n').trim();
  if (b.length < 2 || b.length > max) fail('body');
  return b;
}

/** The kind of a file by its first bytes: PNG, JPEG, WebP or MP4; anything else is refused. */
export function sniff(b: Buffer): { mime: string; ext: string } | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b.toString('latin1', 4, 8) === 'ftyp') return { mime: 'video/mp4', ext: 'mp4' };
  return null;
}
