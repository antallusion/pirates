// Forum post 69 (the tester Эдуард): «Раздел Новости и Списки изменений закрыть от обсуждений игроков. В конце новости —
// ссылка на тему в обсуждениях, где игроки обсуждают. Хорошие идеи Администрация дописывает в новость». The news and the
// patch notes are the staff's to write and answer in; every topic there has its discussion in the general section,
// linked under the news and in place of the reply box; the players' replies already in the news are carried there at
// boot, keeping their authors, dates, quotes and reactions, and the boot may run it again and again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForumStore } from '../server/src/forum/store.ts';
import { ForumError, ForumService } from '../server/src/forum/service.ts';
import type { GameLink } from '../server/src/forum/service.ts';
import { SYSTEM_ID } from '../server/src/forum/seed.ts';
import { discussTitle, migrateNewsTalk, TALK_SECTION } from '../server/src/forum/discuss.ts';

const DAY = 86_400_000;
const link: GameLink = { accountName: (id) => `Captain ${id}`, character: () => null, guildOf: () => null, guild: () => null, online: () => false, inGame: () => 0 };
const form = { website: '', t: 9000 };
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ForumError) return e.code;
    throw e;
  }
  return 'ok';
};

function forum(store = new ForumStore(':memory:')) {
  const clock = { t: Date.UTC(2026, 10, 1) };
  const svc = new ForumService({ store, link, now: () => clock.t, admins: [100], mods: [50] });
  const vet = (id: number) => {
    const u = svc.touch(id, `Captain ${id}`);
    clock.t += 2 * DAY;
    return svc.touch(id, `Captain ${id}`) ?? u;
  };
  return { svc, clock, vet };
}

test('the news and the patch notes: no topics and no replies from the players, the staff write and answer', () => {
  const { svc, clock, vet } = forum();
  const player = vet(1);
  const admin = vet(100);
  const mod = vet(50);
  for (const slug of ['news', 'patches']) {
    assert.equal(svc.section(player, slug, 1, 'ru').canPost, false, slug);
    assert.equal(code(() => svc.createTopic(player, { section: slug, title: 'Моя новость', body: 'Текст новости', ...form })), 'forbidden', slug);
  }
  const news = svc.section(null, 'news', 1, 'ru').topics[0];
  assert.equal(code(() => svc.reply(player, { topic: news.id, body: 'Хочу обсудить', ...form })), 'forbidden');
  assert.equal(svc.topic(player, news.id, 1, 'ru', 'k').can.reply, false);
  clock.t += 60_000;
  assert.equal(code(() => svc.reply(mod, { topic: news.id, body: 'Дополнение от модератора', ...form })), 'ok', 'the staff may add to it');
  assert.equal(svc.topic(admin, news.id, 1, 'ru', 'k').can.reply, true);
  // the rest of the forum is open
  const general = svc.section(null, TALK_SECTION, 1, 'ru').topics[0];
  assert.equal(code(() => svc.reply(player, { topic: general.id, body: 'А тут можно', ...form })), 'ok');
});

test('every news topic has its discussion: «Обсуждение: <title>» in the general section, linked under the news', () => {
  const { svc, clock, vet } = forum();
  const admin = vet(100);
  const player = vet(1);
  clock.t += 10 * 60_000;
  const made = svc.createTopic(admin, { section: 'patches', title: 'Обновление 4 ноября', body: 'Что нового: многое.', ...form });
  const page = svc.topic(player, made.topicId, 1, 'ru', 'k') as ReturnType<ForumService['topic']> & { discuss?: { id: number; title: string } };
  assert.ok(page.discuss, 'the news page carries its discussion');
  assert.equal(page.discuss!.title, discussTitle('Обновление 4 ноября'));
  assert.equal(page.discuss!.title, 'Обсуждение: Обновление 4 ноября');
  assert.match(page.posts[0].html, new RegExp(`<a href="/site/forum/t/${page.discuss!.id}">Обсудить на форуме →</a>`), 'the news ends with the link');
  const talk = svc.topic(player, page.discuss!.id, 1, 'ru', 'k') as ReturnType<ForumService['topic']> & { news?: { id: number } };
  assert.equal(talk.section.slug, TALK_SECTION);
  assert.equal(talk.news?.id, made.topicId, 'the discussion knows its news');
  assert.equal(talk.can.reply, true);
  assert.match(talk.posts[0].html, new RegExp(`/site/forum/t/${made.topicId}`), 'and links back to it');
  clock.t += 60_000;
  assert.equal(code(() => svc.reply(player, { topic: page.discuss!.id, body: 'Отличное обновление!', ...form })), 'ok');
  // the English reader's link
  assert.match(svc.topic(null, made.topicId, 1, 'en', 'e').posts[0].html, /\/site\/en\/forum\/t\/\d+">Discuss on the forum →/);
  // the official news of the game itself (the PvP season, postOfficial) too
  const all = svc.section(null, 'news', 1, 'ru').topics.concat(svc.section(null, 'patches', 1, 'ru').topics);
  for (const t of all) assert.ok(svc.store.discussOf(t.id), t.title);
});

test('the boot carries the players\' replies already in a news topic into its discussion, once, keeping who, when and the quotes', () => {
  // a forum as it was before: players answering in the news
  const store = new ForumStore(':memory:');
  const t0 = Date.UTC(2026, 10, 5);
  const { svc } = forum(store);
  const news = svc.section(null, 'news', 1, 'ru').topics[0];
  // (as the old forum had it: no companion yet, the replies in the news itself)
  store.db.exec('DELETE FROM forum_discuss');
  store.db.exec(`DELETE FROM forum_posts WHERE topic_id IN (SELECT id FROM forum_topics WHERE title LIKE 'Обсуждение:%')`);
  store.db.exec(`DELETE FROM forum_topics WHERE title LIKE 'Обсуждение:%'`);
  for (const id of [1, 2]) store.addUser(id, `Captain ${id}`, 'user', t0);
  const say = (author: number, body: string, at: number, replyTo: number | null = null) => {
    const p = store.addPost(news.id, author, body, replyTo, at);
    store.touchTopic(news.id, p.id, author, at, false);
    return p.id;
  };
  const a = say(1, 'Первый ответ игрока', t0 + 1000);
  const b = say(2, `[quote=Captain 1 #${a}]Первый ответ игрока[/quote] Согласен`, t0 + 2000, a);
  const answer = say(SYSTEM_ID, 'Ответ администрации игроку', t0 + 3000, b);
  const appendix = say(SYSTEM_ID, 'Дополнение к новости: список изменений', t0 + 4000);
  store.toggleReaction(a, 2, '👍', t0 + 5000);
  store.notify(1, 'quote', 2, news.id, b, t0 + 2000);
  const before = store.countTopicPosts(news.id);

  const r = migrateNewsTalk(store, t0 + 10_000);
  assert.ok(r.made >= 1);
  assert.equal(r.moved, 3, 'the two players and the answer to them');
  const talkId = store.discussOf(news.id)!;
  const talk = store.topic(talkId)!;
  assert.equal(talk.title, discussTitle(news.title));
  // the news keeps its own post and the administration's appendix
  const left = store.topicPosts(news.id, 0, 100);
  assert.deepEqual(left.map((p) => p.id), [store.topic(news.id)!.first_post_id, appendix]);
  assert.equal(store.topic(news.id)!.replies, 1);
  // the discussion: its opening, then the carried posts in their order, unchanged
  const moved = store.topicPosts(talkId, 0, 100);
  assert.deepEqual(moved.slice(1).map((p) => p.id), [a, b, answer]);
  assert.deepEqual(moved.map((p) => p.num), [1, 2, 3, 4]);
  assert.deepEqual(moved.slice(1).map((p) => p.author_id), [1, 2, SYSTEM_ID]);
  assert.deepEqual(moved.slice(1).map((p) => p.created_at), [t0 + 1000, t0 + 2000, t0 + 3000]);
  assert.equal(store.post(b)!.reply_to, a);
  assert.match(store.post(b)!.body_md, new RegExp(`#${a}\\]`), 'the quote still points at its post');
  assert.equal(store.reactions([a]).length, 1, 'the reaction stays on its post');
  assert.equal(store.notifications(1, 10).find((x) => x.post_id === b)?.topic_id, talkId, 'the bell leads to the discussion');
  assert.equal(talk.replies, 3);
  assert.equal(talk.last_post_id, answer);
  assert.equal(store.countTopicPosts(news.id) + store.countTopicPosts(talkId) - 1, before, 'nothing lost, nothing doubled');
  // where a carried post is found now
  assert.equal(svc.where(null, b).topicId, talkId);

  // again and again: nothing more to do
  const topics = store.countTopics(true);
  assert.deepEqual(migrateNewsTalk(store, t0 + 20_000), { made: 0, moved: 0 });
  const again = new ForumService({ store, link, now: () => t0 + 30_000 });
  void again;
  assert.equal(store.countTopics(true), topics, 'no second discussion');
  assert.deepEqual(store.topicPosts(talkId, 0, 100).map((p) => p.id), moved.map((p) => p.id));
  assert.deepEqual(store.topicPosts(news.id, 0, 100).map((p) => p.id), left.map((p) => p.id));
});
