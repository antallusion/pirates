// The forum (docs/32_FORUM.md): the store and its seed, who may do what, the traps and the limits, notifications,
// uploads, the HTTP side, and the page's words in both tongues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ForumStore } from '../server/src/forum/store.ts';
import { ForumError, ForumService, FRESH_TOPIC_MS, sniff } from '../server/src/forum/service.ts';
import type { GameLink } from '../server/src/forum/service.ts';
import { SEED, SYSTEM_ID, WELCOME } from '../server/src/forum/seed.ts';
import { forumRoutes } from '../server/src/http/forum-routes.ts';
import { FORUM_EN, FORUM_RU, RU_PLURAL } from '../client/src/lang/forum.ts';
import { POSTS_PER_PAGE, rankOf } from '../shared/src/forum/meta.ts';

const DAY = 86_400_000;
const link: GameLink = {
  accountName: (id) => `Captain ${id}`,
  character: (id) => ({ captain: ['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'][id % 6], level: 10 + id, ship: `Ship ${id}`, deeds: id === 1 ? ['deed_first_prize', 'deed_hundred_wrecks'] : [] }),
  guildOf: (id) => (id === 1 ? { id: 1, name: 'Black Tide', tag: 'BT', rank: 'admiral' } : null),
  guild: (tag) => (tag === 'BT' ? { id: 1, name: 'Black Tide', tag: 'BT', members: [{ account: 1, name: 'Captain 1', rank: 'admiral' }, { account: 9, name: 'Captain 9', rank: 'sailor' }] } : null),
  online: (id) => id === 1,
  inGame: () => 3,
};

function forum(admins = [100], mods = [50]) {
  const clock = { t: Date.UTC(2026, 9, 1) };
  const svc = new ForumService({ store: new ForumStore(':memory:'), link, now: () => clock.t, admins, mods });
  const veteran = (id: number) => {
    const u = svc.touch(id, `Captain ${id}`);
    clock.t += 2 * DAY; // a day on the forum: no longer new
    return u;
  };
  return { svc, clock, veteran, me: (id: number) => svc.touch(id, `Captain ${id}`) };
}
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

test('the seed: every category and section in both tongues, the two pinned official welcomes', () => {
  const { svc } = forum();
  const h = svc.home(null, 'ru');
  assert.equal(h.categories.length, SEED.length);
  assert.equal(h.categories.flatMap((c) => c.sections).length, SEED.flatMap((c) => c.sections).length);
  assert.equal(svc.home(null, 'en').categories[0].title, SEED[0].title[1]);
  const news = svc.section(null, 'news', 1, 'ru');
  assert.equal(news.topics.length, 2);
  assert.ok(news.topics.every((t) => t.pinned && t.official));
  assert.equal(news.topics[0].author?.id, SYSTEM_ID);
  assert.ok(news.topics.some((t) => t.title === WELCOME.title[0]));
  // the seed runs once
  const again = new ForumService({ store: svc.store, link, now: () => Date.now() });
  assert.equal(again.home(null, 'ru').stats.topics, 2);
});

test('a member is made from her game account, with her captain, guild, deeds and rank', () => {
  const { svc, veteran } = forum();
  veteran(1);
  const a = svc.author(svc.store.user(1)!)!;
  assert.equal(a.captain, 'reaver');
  assert.equal(a.level, 11);
  assert.equal(a.guild?.tag, 'BT');
  assert.ok(a.medals.some((m) => m.ru === 'Первый приз'));
  assert.equal(a.online, true);
  assert.equal(rankOf(0, 0), 0);
  assert.equal(rankOf(100, 0), 3);
  assert.equal(rankOf(0, 5000), 7);
});

test('writing: topics, replies, pages, quotes, mentions and replies notify', () => {
  const { svc, clock, veteran } = forum();
  const a = veteran(1), b = veteran(2), c = veteran(3);
  const t = svc.createTopic(a, { section: 'general', title: 'Первая тема', body: 'Привет, мир', ...form });
  clock.t += 60_000;
  const r = svc.reply(b, { topic: t.topicId, body: `[quote=Captain 1#${t.postId}]\nПривет\n[/quote]\nИ тебе! @[Captain 3]`, replyTo: t.postId, ...form });
  const n1 = svc.notifications(svc.store.user(1)!, 'ru').items;
  assert.deepEqual(n1.map((n) => n.kind), ['quote'], 'quoted once, not also «replied»');
  assert.deepEqual(svc.notifications(svc.store.user(3)!, 'ru').items.map((n) => n.kind), ['mention']);
  for (let i = 0; i < POSTS_PER_PAGE + 2; i++) {
    clock.t += 60_000;
    svc.reply(i % 2 ? b : c, { topic: t.topicId, body: `ответ ${i}`, ...form });
  }
  const p2 = svc.topic(null, t.topicId, 2, 'ru', 'x');
  assert.equal(p2.pages, 2);
  assert.equal(p2.posts.length, 4);
  assert.equal(svc.where(null, r.postId).page, 1);
  assert.equal(svc.store.user(2)!.posts, 1 + Math.floor((POSTS_PER_PAGE + 2) / 2), 'her first reply and every odd one');
  // views once an hour per reader
  const v0 = svc.topic(null, t.topicId, 1, 'ru', 'reader').topic.views;
  assert.equal(svc.topic(null, t.topicId, 1, 'ru', 'reader').topic.views, v0);
  // search finds both
  assert.equal(svc.search(null, 'перва', 'topics', 1, 'ru').topics?.[0].id, t.topicId);
  assert.ok((svc.search(null, 'ответ', 'posts', 1, 'ru').posts ?? []).length > 0);
});

test('permissions: staff-only sections, locks, other people’s posts, official answers, roles, bans', () => {
  const { svc, veteran } = forum([100], [50]);
  const user = veteran(1), other = veteran(2), mod = veteran(50), admin = veteran(100);
  assert.equal(code(() => svc.createTopic(null, { section: 'general', title: 'abcd', body: 'xx', ...form })), 'auth');
  assert.equal(code(() => svc.createTopic(user, { section: 'news', title: 'Новость', body: 'текст', ...form })), 'forbidden');
  assert.equal(code(() => svc.createTopic(mod, { section: 'news', title: 'Новость', body: 'текст', ...form })), 'ok');
  const t = svc.createTopic(user, { section: 'general', title: 'Тема', body: 'текст', ...form });
  assert.equal(code(() => svc.edit(other, t.postId, { body: 'чужое', ...form })), 'forbidden');
  assert.equal(code(() => svc.edit(mod, t.postId, { body: 'правка модератора', ...form })), 'ok');
  assert.equal(code(() => svc.modTopic(user, t.topicId, { locked: true })), 'forbidden');
  svc.modTopic(mod, t.topicId, { locked: true });
  assert.equal(code(() => svc.reply(other, { topic: t.topicId, body: 'нельзя', ...form })), 'locked');
  assert.equal(code(() => svc.modPost(mod, t.postId, { official: true })), 'forbidden', 'only the administration marks official answers');
  svc.modPost(admin, t.postId, { official: true });
  assert.equal(svc.store.topic(t.topicId)!.official, 1);
  svc.modTopic(mod, t.topicId, { hidden: true });
  assert.equal(code(() => svc.topic(other, t.topicId, 1, 'ru', 'o')), 'not_found');
  assert.equal(code(() => svc.topic(mod, t.topicId, 1, 'ru', 'm')), 'ok');
  assert.equal(code(() => svc.setRole(mod, 2, 'banned')), 'forbidden');
  svc.setRole(admin, 2, 'banned');
  assert.equal(code(() => svc.createTopic(svc.store.user(2)!, { section: 'general', title: 'Спам', body: 'спам', ...form })), 'banned');
  assert.equal(code(() => svc.setRole(admin, 100, 'user')), 'self');
  assert.equal(code(() => svc.reports(user)), 'forbidden');
  // hidden posts keep their place but not their words for readers
  svc.modTopic(mod, t.topicId, { hidden: false, locked: false });
  const r = svc.reply(veteran(3), { topic: t.topicId, body: 'плохое', ...form });
  svc.modPost(mod, r.postId, { hidden: true });
  const seen = svc.topic(user, t.topicId, 1, 'ru', 'u').posts.find((p) => p.id === r.postId)!;
  assert.equal(seen.html, '');
  assert.equal(seen.hidden, true);
});

test('anti-spam: the honeypot, the time trap, a new member’s links and the rate limits', () => {
  const { svc, clock, me, veteran } = forum();
  const fresh = me(7);
  assert.equal(code(() => svc.createTopic(fresh, { section: 'general', title: 'Тема', body: 'текст', website: 'http://bot', t: 9000 })), 'trap');
  assert.equal(code(() => svc.createTopic(fresh, { section: 'general', title: 'Тема', body: 'текст', website: '', t: 300 })), 'trap');
  assert.equal(code(() => svc.createTopic(fresh, { section: 'general', title: 'Тема', body: 'текст', website: '', t: FRESH_TOPIC_MS - 100 })), 'trap', 'a new member takes longer');
  assert.equal(code(() => svc.createTopic(fresh, { section: 'general', title: 'Тема', body: 'купи https://spam.example/x', ...form })), 'links');
  assert.equal(code(() => svc.createTopic(fresh, { section: 'general', title: 'Тема', body: 'смотри https://gravetidegame.com/site/', ...form })), 'ok', 'our own links are fine');
  const t = svc.store.freshTopics(false, 1)[0];
  assert.equal(code(() => svc.reply(fresh, { topic: t.id, body: 'раз', ...form })), 'ok');
  assert.equal(code(() => svc.reply(fresh, { topic: t.id, body: 'два', ...form })), 'rate');
  clock.t += 50_000;
  assert.equal(code(() => svc.reply(fresh, { topic: t.id, body: 'два', ...form })), 'ok');
  const vet = veteran(8);
  assert.equal(code(() => svc.reply(vet, { topic: t.id, body: 'https://other.example/ можно', ...form })), 'ok', 'a member of a day may link');
  assert.equal(code(() => svc.reply(vet, { topic: t.id, body: 'сразу', ...form })), 'rate');
  assert.equal(code(() => svc.createTopic(vet, { section: 'general', title: 'а', body: 'текст', ...form })), 'title');
  assert.equal(code(() => svc.reply(vet, { topic: t.id, body: 'x'.repeat(20_001), ...form })), 'body');
});

test('reactions and reputation: toggled, counted, never on oneself, a notification each once', () => {
  const { svc, veteran } = forum();
  const a = veteran(1), b = veteran(2);
  const t = svc.createTopic(a, { section: 'general', title: 'Тема', body: 'текст', ...form });
  assert.deepEqual(svc.react(b, t.postId, 'fire'), { reactions: { fire: 1 }, mine: ['fire'] });
  assert.deepEqual(svc.react(b, t.postId, 'fire'), { reactions: {}, mine: [] });
  svc.react(b, t.postId, 'fire');
  assert.equal(code(() => svc.react(b, t.postId, 'skull')), 'bad_request');
  assert.equal(svc.notifications(svc.store.user(1)!, 'ru').items.filter((n) => n.kind === 'reaction').length, 1);
  assert.equal(code(() => svc.rep(a, t.postId, 1)), 'self');
  assert.equal(svc.rep(b, t.postId, 1).rep, 1);
  assert.equal(svc.rep(b, t.postId, 1).rep, 1, 'one vote a post');
  assert.equal(svc.rep(b, t.postId, -1).rep, -1);
  assert.equal(svc.rep(b, t.postId, 0).rep, 0);
});

test('messages, reports and the guild page', () => {
  const { svc, veteran } = forum([100], [50]);
  const a = veteran(1), mod = veteran(50);
  svc.send(a, 9, { body: 'Привет!', ...form }); // a game account not yet on the forum
  assert.equal(svc.store.user(9)?.name, 'Captain 9');
  assert.equal(svc.me(svc.store.user(9)!).unread?.messages, 1);
  assert.equal(svc.dialog(svc.store.user(9)!, 1, 'ru').messages.length, 1);
  assert.equal(svc.me(svc.store.user(9)!).unread?.messages, 0);
  assert.equal(code(() => svc.send(a, 1, { body: 'себе', ...form })), 'self');
  const t = svc.createTopic(a, { section: 'general', title: 'Тема', body: 'текст', ...form });
  svc.report(svc.store.user(9)!, t.postId, 'спам');
  assert.equal(svc.reports(mod).reports.length, 1);
  svc.resolveReport(mod, svc.reports(mod).reports[0].id);
  assert.equal(svc.reports(mod).reports.length, 0);
  const g = svc.guild('bt');
  assert.equal(g.members.length, 2);
  assert.equal(g.members[0].captain, 'reaver');
  assert.equal(code(() => svc.guild('XX')), 'not_found');
});

test('uploads: the kind from the first bytes, the size limits', () => {
  const { svc, veteran } = forum();
  const a = veteran(1);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  assert.equal(sniff(png)?.mime, 'image/png');
  assert.equal(sniff(Buffer.from('<html><script>alert(1)</script></html>'))?.mime, undefined);
  const r = svc.upload(a, png);
  assert.match(r.url, /^\/api\/forum\/file\/[0-9a-f]{24}\.png$/);
  assert.equal(svc.uploadPath(r.url.split('/').pop()!)?.mime, 'image/png');
  assert.equal(svc.uploadPath('../../etc/passwd'), null);
  assert.equal(code(() => svc.upload(a, Buffer.from('GIF89a-not-allowed-here'))), 'bad_file');
  const big = Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]);
  assert.equal(code(() => svc.upload(a, big)), 'too_large');
  assert.equal(code(() => svc.upload(null, png)), 'auth');
});

test('HTTP: the bearer token is the member, JSON errors by code, uploads served safe', async () => {
  const { svc } = forum();
  const handle = forumRoutes(svc, { resume: (tok) => (tok === 'a-token-of-twenty-chars-x' ? { accountId: 1, name: 'Captain 1' } : null) });
  const server = createServer((req, res) => void handle(req, res).then((h) => h || res.writeHead(404).end()));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/forum/`;
  const auth = { Authorization: 'Bearer a-token-of-twenty-chars-x', 'Content-Type': 'application/json' };
  try {
    assert.equal((await (await fetch(`${base}me`)).json()).user, null);
    assert.equal((await (await fetch(`${base}me`, { headers: auth })).json()).user.name, 'Captain 1');
    const noAuth = await fetch(`${base}topic`, { method: 'POST', body: JSON.stringify({ section: 'general', title: 'Тема', body: 'текст', ...form }) });
    assert.equal(noAuth.status, 401);
    assert.equal((await noAuth.json()).error, 'auth');
    svc.store.db.exec('UPDATE forum_users SET joined = 0'); // a member of long standing
    const ok = await fetch(`${base}topic`, { method: 'POST', headers: auth, body: JSON.stringify({ section: 'general', title: 'Тема', body: 'текст', ...form }) });
    assert.equal(ok.status, 200);
    const { topicId } = await ok.json();
    const tp = await (await fetch(`${base}topic/${topicId}?lang=en`)).json();
    assert.equal(tp.posts[0].html, '<p>текст</p>');
    assert.equal((await fetch(`${base}topic/99999`)).status, 404);
    assert.equal((await fetch(`${base}nothing`)).status, 404);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const up = await (await fetch(`${base}upload`, { method: 'POST', headers: { Authorization: auth.Authorization, 'Content-Type': 'image/png' }, body: png })).json();
    const f = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${up.url}`);
    assert.equal(f.headers.get('content-type'), 'image/png');
    assert.equal(f.headers.get('x-content-type-options'), 'nosniff');
    assert.match(f.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.equal((await f.arrayBuffer()).byteLength, png.length);
  } finally {
    server.close();
  }
});

test('the page’s words: English and Russian key for key, the Russian without Latin but the names', () => {
  assert.deepEqual(Object.keys(FORUM_RU).sort(), Object.keys(FORUM_EN).sort());
  const NAMES = /GRAVETIDE|Telegram|Ctrl|Enter|YouTube|MP4|PNG|JPG|WebP/g;
  for (const [k, v] of Object.entries(FORUM_RU)) {
    assert.ok(v.trim().length > 0, k);
    assert.doesNotMatch(v.replace(NAMES, '').replace(/\{\w+\}/g, ''), /[A-Za-z]/, `${k}: ${v}`);
  }
  for (const v of Object.values(RU_PLURAL).flat()) assert.doesNotMatch(v, /[A-Za-z]/);
  // the seed's Russian, too (its markup and addresses aside)
  const ru = [...SEED.flatMap((c) => [c.title[0], ...c.sections.flatMap((s) => [s.title[0], s.desc[0]])]), WELCOME.title[0], WELCOME.body[0]];
  for (const s of ru) assert.doesNotMatch(s.replace(NAMES, ''), /[A-Za-z]/, s);
});
