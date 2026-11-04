// The news' discussions (forum post 69, the tester Эдуард: «Раздел Новости и Списки изменений закрыть от обсуждений
// игроков. В конце новости — ссылка на тему в обсуждениях, где игроки обсуждают. Хорошие идеи Администрация дописывает
// в новость»). The sections only the staff open topics in (news, patches: staff_only) are the staff's to answer in too
// (service.ts reply); every topic there has a companion topic in the general discussion, «Обсуждение: <title>», made
// with the news (service.ts createTopic, posts28.ts postOfficial) or at boot; the news' page links it under its first
// post and in place of the reply box. At boot the players' replies already in a news topic — and the staff's answers to
// them — are carried over into its companion, with their ids, authors, dates, quotes and reactions: once done, nothing
// is left to carry, so the boot may run it every time.

import { isStaff, TITLE_MAX } from '../../../shared/src/forum/meta.ts';
import { plainText } from '../../../shared/src/forum/markdown.ts';
import { SYSTEM_ID } from './seed.ts';
import type { ForumStore, PostRow, SectionRow, TopicRow } from './store.ts';

/** Where the companions are opened: the general discussion. */
export const TALK_SECTION = 'general';
/** Its stand-in when a forum has no general discussion. */
export const TALK_FALLBACK = { slug: 'news-talk', title: ['Обсуждение новостей', 'News discussion'] as [string, string], desc: ['Здесь игроки обсуждают новости и списки изменений.', 'Where the players talk over the news and the patch notes.'] as [string, string] };

/** A section the players read and do not write in: the news and the patch notes. */
export const isNewsSection = (s: SectionRow | undefined): boolean => !!s?.staff_only;

export function discussTitle(title: string): string {
  const t = `Обсуждение: ${title}`;
  return t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1)}…`;
}

export function discussBody(news: TopicRow): string {
  return `Здесь обсуждают новость «[${news.title.replace(/[[\]]/g, '')}](/site/forum/t/${news.id})». Пишите, что думаете, — хорошие идеи Администрация допишет в саму новость.`;
}

function talkSection(store: ForumStore): SectionRow {
  const s = store.sectionBySlug(TALK_SECTION) ?? store.sectionBySlug(TALK_FALLBACK.slug);
  if (s) return s;
  const cat = store.categories().find((c) => c.slug === 'talk') ?? store.categories().find((c) => !store.sections().some((x) => x.category_id === c.id && x.staff_only)) ?? store.categories()[0];
  const id = store.addSection(cat.id, TALK_FALLBACK.slug, TALK_FALLBACK.title, TALK_FALLBACK.desc, 'forum', 1000, false);
  return store.section(id)!;
}

/** The news topic's companion, made if it has none (or its companion is gone). Its id; null for a topic outside the news. */
export function ensureDiscussion(store: ForumStore, news: TopicRow, now: number): number | null {
  if (!isNewsSection(store.section(news.section_id))) return null;
  const was = store.discussOf(news.id);
  if (was !== undefined && store.topic(was)) return was;
  const sec = talkSection(store);
  const title = discussTitle(news.title);
  const body = discussBody(news);
  const at = Math.min(now, news.created_at);
  const tid = store.addTopic(sec.id, SYSTEM_ID, title, at);
  const p = store.addPost(tid, SYSTEM_ID, body, null, at);
  store.touchTopic(tid, p.id, SYSTEM_ID, at, true);
  store.setPost(p.id, { official: 1 });
  store.index('t', tid, title);
  store.index('p', p.id, plainText(body));
  store.bump(SYSTEM_ID, 'posts', 1);
  store.bump(SYSTEM_ID, 'topics', 1);
  store.setDiscuss(news.id, tid);
  return tid;
}

/** The posts of a news topic that belong in its discussion: the players' replies, and the staff's answers to those. */
export function postsToCarry(store: ForumStore, news: TopicRow): PostRow[] {
  const rows = store.topicPosts(news.id, 0, 100_000);
  const users = store.users(rows.map((r) => r.author_id));
  const out: PostRow[] = [];
  const carried = new Set<number>();
  for (const r of rows) {
    if (r.id === news.first_post_id || r.num === 1) continue;
    const staff = r.author_id === SYSTEM_ID || isStaff(users.get(r.author_id)?.role ?? 'user');
    if (!staff || (r.reply_to !== null && carried.has(r.reply_to))) {
      out.push(r);
      carried.add(r.id);
    }
  }
  return out;
}

/** Every news topic given its discussion and its players' replies carried there. Safe on every boot. */
export function migrateNewsTalk(store: ForumStore, now: number): { made: number; moved: number } {
  let made = 0;
  let moved = 0;
  store.tx(() => {
    for (const s of store.sections()) {
      if (!isNewsSection(s)) continue;
      for (const t of store.sectionTopics(s.id, true, 0, 100_000)) {
        if (t.hidden) continue; // (a hidden news topic gets hers when it is shown again: service.ts topic)
        const had = store.discussOf(t.id);
        const talk = ensureDiscussion(store, t, now);
        if (talk === null) continue;
        if (had === undefined || had !== talk) made++;
        const carry = postsToCarry(store, t);
        if (!carry.length) continue;
        for (const p of carry) store.movePost(p.id, talk);
        store.recountTopic(t.id);
        store.recountTopic(talk);
        moved += carry.length;
      }
    }
  });
  return { made, moved };
}
