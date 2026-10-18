// The forum's store (docs/32_FORUM.md §5): its own SQLite file beside the game's database (as telemetry and live ops
// keep theirs), node:sqlite, no ORM. Only rows in and out here; the rules are in service.ts.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Role } from '../../../shared/src/forum/meta.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS forum_users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE, role TEXT NOT NULL DEFAULT 'user', avatar TEXT, main_char TEXT,
  posts INTEGER NOT NULL DEFAULT 0, topics INTEGER NOT NULL DEFAULT 0, rep INTEGER NOT NULL DEFAULT 0, official INTEGER NOT NULL DEFAULT 0,
  joined INTEGER NOT NULL, last_seen INTEGER NOT NULL, char_json TEXT, char_at INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS forum_users_name ON forum_users(name);
CREATE INDEX IF NOT EXISTS forum_users_seen ON forum_users(last_seen);
CREATE TABLE IF NOT EXISTS forum_categories (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title_ru TEXT NOT NULL, title_en TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS forum_sections (
  id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE, title_ru TEXT NOT NULL, title_en TEXT NOT NULL,
  desc_ru TEXT NOT NULL, desc_en TEXT NOT NULL, icon TEXT NOT NULL, sort INTEGER NOT NULL, staff_only INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL, author_id INTEGER NOT NULL, title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0, official INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_post_at INTEGER NOT NULL,
  last_post_id INTEGER, last_author_id INTEGER, first_post_id INTEGER);
CREATE INDEX IF NOT EXISTS forum_topics_section ON forum_topics(section_id, pinned DESC, last_post_at DESC);
CREATE INDEX IF NOT EXISTS forum_topics_last ON forum_topics(last_post_at DESC);
CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY, topic_id INTEGER NOT NULL, author_id INTEGER NOT NULL, num INTEGER NOT NULL, body_md TEXT NOT NULL,
  reply_to INTEGER, created_at INTEGER NOT NULL, edited_at INTEGER, edited_by INTEGER, hidden INTEGER NOT NULL DEFAULT 0, official INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS forum_posts_topic ON forum_posts(topic_id, num);
CREATE INDEX IF NOT EXISTS forum_posts_author ON forum_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_posts_at ON forum_posts(created_at DESC);
CREATE TABLE IF NOT EXISTS forum_reactions (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, emoji TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (post_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS forum_reputation (from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, post_id INTEGER NOT NULL, value INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (from_id, post_id));
CREATE TABLE IF NOT EXISTS forum_messages (id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS forum_messages_to ON forum_messages(to_id, read);
CREATE INDEX IF NOT EXISTS forum_messages_pair ON forum_messages(from_id, to_id, created_at);
CREATE TABLE IF NOT EXISTS forum_notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, actor_id INTEGER, topic_id INTEGER, post_id INTEGER,
  created_at INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0, extra TEXT);
CREATE INDEX IF NOT EXISTS forum_notifications_user ON forum_notifications(user_id, read, id DESC);
CREATE TABLE IF NOT EXISTS forum_reports (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_by INTEGER, resolved_at INTEGER);
CREATE TABLE IF NOT EXISTS forum_uploads (id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, file TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS forum_uploads_owner ON forum_uploads(owner_id, created_at);
CREATE VIRTUAL TABLE IF NOT EXISTS forum_fts USING fts5(kind UNINDEXED, ref UNINDEXED, text, tokenize = 'unicode61 remove_diacritics 2');
`;

export interface UserRow {
  id: number; name: string; role: Role; avatar: string | null; main_char: string | null; posts: number; topics: number; rep: number; official: number;
  joined: number; last_seen: number; char_json: string | null; char_at: number;
}
export interface CategoryRow { id: number; slug: string; title_ru: string; title_en: string; sort: number }
export interface SectionRow { id: number; category_id: number; slug: string; title_ru: string; title_en: string; desc_ru: string; desc_en: string; icon: string; sort: number; staff_only: number }
export interface TopicRow {
  id: number; section_id: number; author_id: number; title: string; pinned: number; official: number; locked: number; hidden: number;
  views: number; replies: number; created_at: number; last_post_at: number; last_post_id: number | null; last_author_id: number | null; first_post_id: number | null;
}
export interface PostRow {
  id: number; topic_id: number; author_id: number; num: number; body_md: string; reply_to: number | null; created_at: number;
  edited_at: number | null; edited_by: number | null; hidden: number; official: number;
}
export interface MessageRow { id: number; from_id: number; to_id: number; body: string; created_at: number; read: number }
export interface NotificationRow { id: number; user_id: number; kind: string; actor_id: number | null; topic_id: number | null; post_id: number | null; created_at: number; read: number; extra: string | null }
export interface ReportRow { id: number; post_id: number; reporter_id: number; reason: string; created_at: number; resolved_by: number | null; resolved_at: number | null }

type R = Record<string, unknown>;
const n = (v: unknown): number => Number(v ?? 0);

export class ForumStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 3000;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  private get<T>(sql: string, ...a: (string | number | null)[]): T | undefined {
    return this.db.prepare(sql).get(...a) as T | undefined;
  }
  private all<T>(sql: string, ...a: (string | number | null)[]): T[] {
    return this.db.prepare(sql).all(...a) as T[];
  }
  private run(sql: string, ...a: (string | number | null)[]): { id: number; changes: number } {
    const r = this.db.prepare(sql).run(...a);
    return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
  }
  private count(sql: string, ...a: (string | number | null)[]): number {
    return n((this.db.prepare(sql).get(...a) as R | undefined)?.c);
  }

  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const v = fn();
      this.db.exec('COMMIT');
      return v;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ------------------------------------------------------------------------------------------ users
  user(id: number): UserRow | undefined {
    return this.get<UserRow>('SELECT * FROM forum_users WHERE id = ?', id);
  }
  userByName(name: string): UserRow | undefined {
    return this.get<UserRow>('SELECT * FROM forum_users WHERE name = ? COLLATE NOCASE', name);
  }
  users(ids: number[]): Map<number, UserRow> {
    const out = new Map<number, UserRow>();
    const uniq = [...new Set(ids.filter((x) => Number.isFinite(x)))];
    for (let i = 0; i < uniq.length; i += 200) {
      const part = uniq.slice(i, i + 200);
      for (const r of this.all<UserRow>(`SELECT * FROM forum_users WHERE id IN (${part.map(() => '?').join(',')})`, ...part)) out.set(r.id, r);
    }
    return out;
  }
  addUser(id: number, name: string, role: Role, now: number): void {
    this.run('INSERT OR IGNORE INTO forum_users (id, name, role, joined, last_seen) VALUES (?, ?, ?, ?, ?)', id, name, role, now, now);
  }
  setUserName(id: number, name: string): void {
    this.run('UPDATE forum_users SET name = ? WHERE id = ?', name, id);
  }
  setRole(id: number, role: Role): void {
    this.run('UPDATE forum_users SET role = ? WHERE id = ?', role, id);
  }
  seen(id: number, now: number): void {
    this.run('UPDATE forum_users SET last_seen = ? WHERE id = ?', now, id);
  }
  setChar(id: number, json: string, now: number): void {
    this.run('UPDATE forum_users SET char_json = ?, char_at = ? WHERE id = ?', json, now, id);
  }
  setProfile(id: number, avatar: string | null, mainChar: string | null): void {
    this.run('UPDATE forum_users SET avatar = ?, main_char = ? WHERE id = ?', avatar, mainChar, id);
  }
  bump(id: number, field: 'posts' | 'topics' | 'rep' | 'official', by: number): void {
    this.run(`UPDATE forum_users SET ${field} = ${field} + ? WHERE id = ?`, by, id);
  }
  members(offset: number, limit: number): UserRow[] {
    return this.all<UserRow>('SELECT * FROM forum_users WHERE id > 0 ORDER BY posts DESC, rep DESC, id LIMIT ? OFFSET ?', limit, offset);
  }
  online(since: number): UserRow[] {
    return this.all<UserRow>('SELECT * FROM forum_users WHERE last_seen >= ? AND id > 0 ORDER BY last_seen DESC LIMIT 200', since);
  }
  countMembers(): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_users WHERE id > 0');
  }
  countOnline(since: number): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_users WHERE last_seen >= ? AND id > 0', since);
  }

  // ------------------------------------------------------------------------------------------ categories and sections
  categories(): CategoryRow[] {
    return this.all<CategoryRow>('SELECT * FROM forum_categories ORDER BY sort, id');
  }
  sections(): SectionRow[] {
    return this.all<SectionRow>('SELECT * FROM forum_sections ORDER BY sort, id');
  }
  section(id: number): SectionRow | undefined {
    return this.get<SectionRow>('SELECT * FROM forum_sections WHERE id = ?', id);
  }
  sectionBySlug(slug: string): SectionRow | undefined {
    return this.get<SectionRow>('SELECT * FROM forum_sections WHERE slug = ?', slug);
  }
  addCategory(slug: string, ru: string, en: string, sort: number): number {
    return this.run('INSERT INTO forum_categories (slug, title_ru, title_en, sort) VALUES (?, ?, ?, ?)', slug, ru, en, sort).id;
  }
  addSection(cat: number, slug: string, t: [string, string], d: [string, string], icon: string, sort: number, staffOnly: boolean): number {
    return this.run('INSERT INTO forum_sections (category_id, slug, title_ru, title_en, desc_ru, desc_en, icon, sort, staff_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', cat, slug, t[0], t[1], d[0], d[1], icon, sort, staffOnly ? 1 : 0).id;
  }
  /** Topics and posts of each section (the hidden left out unless `staff`), and its newest topic. */
  sectionStats(staff: boolean): Map<number, { topics: number; posts: number; last: TopicRow | null }> {
    const h = staff ? '' : 'AND t.hidden = 0';
    const out = new Map<number, { topics: number; posts: number; last: TopicRow | null }>();
    for (const r of this.all<R>(`SELECT t.section_id AS s, COUNT(*) AS topics, SUM(t.replies + 1) AS posts FROM forum_topics t WHERE 1 ${h} GROUP BY t.section_id`)) {
      out.set(n(r.s), { topics: n(r.topics), posts: n(r.posts), last: null });
    }
    for (const r of this.all<TopicRow>(`SELECT t.* FROM forum_topics t WHERE t.id IN (SELECT (SELECT id FROM forum_topics x WHERE x.section_id = s.id ${staff ? '' : 'AND x.hidden = 0'} ORDER BY x.last_post_at DESC LIMIT 1) FROM forum_sections s)`)) {
      const e = out.get(r.section_id);
      if (e) e.last = r;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------ topics
  topic(id: number): TopicRow | undefined {
    return this.get<TopicRow>('SELECT * FROM forum_topics WHERE id = ?', id);
  }
  topicsOf(ids: number[]): Map<number, TopicRow> {
    const out = new Map<number, TopicRow>();
    const uniq = [...new Set(ids)];
    if (!uniq.length) return out;
    for (const r of this.all<TopicRow>(`SELECT * FROM forum_topics WHERE id IN (${uniq.map(() => '?').join(',')})`, ...uniq)) out.set(r.id, r);
    return out;
  }
  sectionTopics(section: number, staff: boolean, offset: number, limit: number): TopicRow[] {
    return this.all<TopicRow>(`SELECT * FROM forum_topics WHERE section_id = ? ${staff ? '' : 'AND hidden = 0'} ORDER BY pinned DESC, last_post_at DESC LIMIT ? OFFSET ?`, section, limit, offset);
  }
  countSectionTopics(section: number, staff: boolean): number {
    return this.count(`SELECT COUNT(*) AS c FROM forum_topics WHERE section_id = ? ${staff ? '' : 'AND hidden = 0'}`, section);
  }
  freshTopics(staff: boolean, limit: number, offset = 0, since = 0): TopicRow[] {
    return this.all<TopicRow>(`SELECT * FROM forum_topics WHERE last_post_at >= ? ${staff ? '' : 'AND hidden = 0'} ORDER BY last_post_at DESC LIMIT ? OFFSET ?`, since, limit, offset);
  }
  countTopics(staff: boolean, since = 0): number {
    return this.count(`SELECT COUNT(*) AS c FROM forum_topics WHERE last_post_at >= ? ${staff ? '' : 'AND hidden = 0'}`, since);
  }
  addTopic(section: number, author: number, title: string, now: number): number {
    return this.run('INSERT INTO forum_topics (section_id, author_id, title, created_at, last_post_at, last_author_id) VALUES (?, ?, ?, ?, ?, ?)', section, author, title, now, now, author).id;
  }
  setTopic(id: number, f: Partial<Pick<TopicRow, 'pinned' | 'official' | 'locked' | 'hidden' | 'section_id' | 'title'>>): void {
    const keys = Object.keys(f) as (keyof typeof f)[];
    if (!keys.length) return;
    this.run(`UPDATE forum_topics SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k] as string | number), id);
  }
  touchTopic(id: number, postId: number, author: number, at: number, firstPost: boolean): void {
    if (firstPost) this.run('UPDATE forum_topics SET first_post_id = ?, last_post_id = ?, last_author_id = ?, last_post_at = ? WHERE id = ?', postId, postId, author, at, id);
    else this.run('UPDATE forum_topics SET replies = replies + 1, last_post_id = ?, last_author_id = ?, last_post_at = ? WHERE id = ?', postId, author, at, id);
  }
  view(id: number): void {
    this.run('UPDATE forum_topics SET views = views + 1 WHERE id = ?', id);
  }

  // ------------------------------------------------------------------------------------------ posts
  post(id: number): PostRow | undefined {
    return this.get<PostRow>('SELECT * FROM forum_posts WHERE id = ?', id);
  }
  postsOf(ids: number[]): Map<number, PostRow> {
    const out = new Map<number, PostRow>();
    const uniq = [...new Set(ids)];
    if (!uniq.length) return out;
    for (const r of this.all<PostRow>(`SELECT * FROM forum_posts WHERE id IN (${uniq.map(() => '?').join(',')})`, ...uniq)) out.set(r.id, r);
    return out;
  }
  topicPosts(topic: number, offset: number, limit: number): PostRow[] {
    return this.all<PostRow>('SELECT * FROM forum_posts WHERE topic_id = ? ORDER BY num LIMIT ? OFFSET ?', topic, limit, offset);
  }
  countTopicPosts(topic: number): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_posts WHERE topic_id = ?', topic);
  }
  addPost(topic: number, author: number, body: string, replyTo: number | null, now: number): { id: number; num: number } {
    const num = this.count('SELECT COALESCE(MAX(num), 0) AS c FROM forum_posts WHERE topic_id = ?', topic) + 1;
    const id = this.run('INSERT INTO forum_posts (topic_id, author_id, num, body_md, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?)', topic, author, num, body, replyTo, now).id;
    return { id, num };
  }
  editPost(id: number, body: string, by: number, now: number): void {
    this.run('UPDATE forum_posts SET body_md = ?, edited_at = ?, edited_by = ? WHERE id = ?', body, now, by, id);
  }
  setPost(id: number, f: Partial<Pick<PostRow, 'hidden' | 'official'>>): void {
    const keys = Object.keys(f) as (keyof typeof f)[];
    if (!keys.length) return;
    this.run(`UPDATE forum_posts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k] as number), id);
  }
  recentPosts(staff: boolean, offset: number, limit: number, author?: number, since = 0): PostRow[] {
    const hide = staff ? '' : 'AND p.hidden = 0 AND t.hidden = 0';
    const by = author !== undefined ? 'AND p.author_id = ?' : '';
    const args: number[] = [since];
    if (author !== undefined) args.push(author);
    return this.all<PostRow>(`SELECT p.* FROM forum_posts p JOIN forum_topics t ON t.id = p.topic_id WHERE p.created_at >= ? ${hide} ${by} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  }
  countPosts(staff: boolean, since = 0, author?: number): number {
    const hide = staff ? '' : 'AND p.hidden = 0 AND t.hidden = 0';
    const by = author !== undefined ? 'AND p.author_id = ?' : '';
    const args: number[] = [since];
    if (author !== undefined) args.push(author);
    return this.count(`SELECT COUNT(*) AS c FROM forum_posts p JOIN forum_topics t ON t.id = p.topic_id WHERE p.created_at >= ? ${hide} ${by}`, ...args);
  }
  /** Where a post stands in its topic (its 0-based place). */
  postIndex(post: PostRow): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_posts WHERE topic_id = ? AND num < ?', post.topic_id, post.num);
  }

  // ------------------------------------------------------------------------------------------ reactions and reputation
  reactions(postIds: number[]): { post_id: number; user_id: number; emoji: string }[] {
    if (!postIds.length) return [];
    return this.all(`SELECT post_id, user_id, emoji FROM forum_reactions WHERE post_id IN (${postIds.map(() => '?').join(',')})`, ...postIds);
  }
  toggleReaction(post: number, user: number, emoji: string, now: number): boolean {
    const had = this.run('DELETE FROM forum_reactions WHERE post_id = ? AND user_id = ? AND emoji = ?', post, user, emoji).changes > 0;
    if (!had) this.run('INSERT INTO forum_reactions (post_id, user_id, emoji, at) VALUES (?, ?, ?, ?)', post, user, emoji, now);
    return !had;
  }
  repOf(from: number, post: number): number {
    return n(this.get<R>('SELECT value FROM forum_reputation WHERE from_id = ? AND post_id = ?', from, post)?.value);
  }
  repsOn(from: number, postIds: number[]): Map<number, number> {
    const out = new Map<number, number>();
    if (!postIds.length) return out;
    for (const r of this.all<R>(`SELECT post_id, value FROM forum_reputation WHERE from_id = ? AND post_id IN (${postIds.map(() => '?').join(',')})`, from, ...postIds)) out.set(n(r.post_id), n(r.value));
    return out;
  }
  setRep(from: number, to: number, post: number, value: number, now: number): number {
    const old = this.repOf(from, post);
    if (value === 0) this.run('DELETE FROM forum_reputation WHERE from_id = ? AND post_id = ?', from, post);
    else this.run('INSERT INTO forum_reputation (from_id, to_id, post_id, value, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(from_id, post_id) DO UPDATE SET value = excluded.value, at = excluded.at', from, to, post, value, now);
    return value - old;
  }

  // ------------------------------------------------------------------------------------------ messages
  addMessage(from: number, to: number, body: string, now: number): number {
    return this.run('INSERT INTO forum_messages (from_id, to_id, body, created_at) VALUES (?, ?, ?, ?)', from, to, body, now).id;
  }
  dialog(a: number, b: number, limit: number): MessageRow[] {
    return this.all<MessageRow>('SELECT * FROM (SELECT * FROM forum_messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id DESC LIMIT ?) ORDER BY id', a, b, b, a, limit);
  }
  readDialog(me: number, other: number): void {
    this.run('UPDATE forum_messages SET read = 1 WHERE to_id = ? AND from_id = ? AND read = 0', me, other);
  }
  /** Each partner of `me`'s dialogs with the last message and the unread count. */
  dialogs(me: number): { other: number; last: MessageRow; unread: number }[] {
    const rows = this.all<MessageRow & { other: number }>(
      `SELECT m.*, CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END AS other FROM forum_messages m
       WHERE m.id IN (SELECT MAX(id) FROM forum_messages WHERE from_id = ? OR to_id = ? GROUP BY CASE WHEN from_id = ? THEN to_id ELSE from_id END)
       ORDER BY m.id DESC LIMIT 100`, me, me, me, me);
    const unread = new Map<number, number>();
    for (const r of this.all<R>('SELECT from_id, COUNT(*) AS c FROM forum_messages WHERE to_id = ? AND read = 0 GROUP BY from_id', me)) unread.set(n(r.from_id), n(r.c));
    return rows.map((r) => ({ other: n(r.other), last: r, unread: unread.get(n(r.other)) ?? 0 }));
  }
  unreadMessages(me: number): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_messages WHERE to_id = ? AND read = 0', me);
  }

  // ------------------------------------------------------------------------------------------ notifications
  notify(user: number, kind: string, actor: number | null, topic: number | null, post: number | null, now: number, extra: string | null = null): void {
    this.run('INSERT INTO forum_notifications (user_id, kind, actor_id, topic_id, post_id, created_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?)', user, kind, actor, topic, post, now, extra);
  }
  hasNotification(user: number, kind: string, actor: number, post: number): boolean {
    return !!this.get('SELECT 1 FROM forum_notifications WHERE user_id = ? AND kind = ? AND actor_id = ? AND post_id = ?', user, kind, actor, post);
  }
  notifications(user: number, limit: number): NotificationRow[] {
    return this.all<NotificationRow>('SELECT * FROM forum_notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?', user, limit);
  }
  unreadNotifications(user: number): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_notifications WHERE user_id = ? AND read = 0', user);
  }
  readNotifications(user: number, upTo?: number): void {
    if (upTo) this.run('UPDATE forum_notifications SET read = 1 WHERE user_id = ? AND id <= ?', user, upTo);
    else this.run('UPDATE forum_notifications SET read = 1 WHERE user_id = ?', user);
  }

  // ------------------------------------------------------------------------------------------ reports
  addReport(post: number, by: number, reason: string, now: number): number {
    return this.run('INSERT INTO forum_reports (post_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)', post, by, reason, now).id;
  }
  reports(open: boolean, limit: number): ReportRow[] {
    return this.all<ReportRow>(`SELECT * FROM forum_reports WHERE ${open ? 'resolved_at IS NULL' : '1'} ORDER BY id DESC LIMIT ?`, limit);
  }
  countOpenReports(): number {
    return this.count('SELECT COUNT(*) AS c FROM forum_reports WHERE resolved_at IS NULL');
  }
  resolveReport(id: number, by: number, now: number): boolean {
    return this.run('UPDATE forum_reports SET resolved_by = ?, resolved_at = ? WHERE id = ? AND resolved_at IS NULL', by, now, id).changes > 0;
  }

  // ------------------------------------------------------------------------------------------ uploads
  addUpload(owner: number, file: string, mime: string, size: number, now: number): void {
    this.run('INSERT INTO forum_uploads (owner_id, file, mime, size, created_at) VALUES (?, ?, ?, ?, ?)', owner, file, mime, size, now);
  }
  upload(file: string): { file: string; mime: string; size: number } | undefined {
    return this.get('SELECT file, mime, size FROM forum_uploads WHERE file = ?', file);
  }
  uploadedSince(owner: number, since: number): { n: number; bytes: number } {
    const r = this.get<R>('SELECT COUNT(*) AS c, COALESCE(SUM(size), 0) AS b FROM forum_uploads WHERE owner_id = ? AND created_at >= ?', owner, since);
    return { n: n(r?.c), bytes: n(r?.b) };
  }

  // ------------------------------------------------------------------------------------------ search
  index(kind: 't' | 'p', ref: number, text: string): void {
    this.run('DELETE FROM forum_fts WHERE kind = ? AND ref = ?', kind, ref);
    this.run('INSERT INTO forum_fts (kind, ref, text) VALUES (?, ?, ?)', kind, ref, text);
  }
  /** Refs of the kind matching an FTS5 query, best first, with a snippet (the hit between \u0001 and \u0002). */
  search(kind: 't' | 'p', query: string, limit: number, offset: number): { ref: number; snip: string }[] {
    return this.all<R>(`SELECT ref, snippet(forum_fts, 2, char(1), char(2), '…', 24) AS snip FROM forum_fts WHERE forum_fts MATCH ? AND kind = ? ORDER BY rank LIMIT ? OFFSET ?`, query, kind, limit, offset).map((r) => ({ ref: n(r.ref), snip: String(r.snip ?? '') }));
  }
}
