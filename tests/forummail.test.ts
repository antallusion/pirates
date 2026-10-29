// The forum's answers by post (owner, 2026-10-29: «ответы личные на форуме отсылали письма людям, что мол вам ответили»;
// server/src/game/forummail.ts): a reply, a quote or a mention puts a letter in the member's port mailbox and, away
// from the game with a verified address, an e-mail; never to herself or of the system's posts; one letter per member
// per topic in ten minutes; the words in both tongues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForumStore } from '../server/src/forum/store.ts';
import { ForumService } from '../server/src/forum/service.ts';
import { gameLink } from '../server/src/forum/gamelink.ts';
import { FORUM_MAIL_COALESCE } from '../server/src/game/forummail.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { forumExcerpt, forumLetterPatterns, forumLetterWords } from '../shared/src/data/forumletter.ts';
import { OutboxMailer } from '../server/src/mail.ts';
import { makeGame } from './helpers.ts';

const DAY = 86_400_000;
const form = { website: '', t: 9000 };

function setup() {
  const g = makeGame();
  const clock = { t: Date.now() };
  const svc = new ForumService({ store: new ForumStore(':memory:'), link: gameLink(g.game, g.db), now: () => clock.t });
  const member = (name: string) => {
    const id = g.db.createAccount(name, `h-${name}`);
    const u = svc.touch(id, name);
    return { id, u };
  };
  const a = member('Anne Bonny'), b = member('Jack Rackham'), c = member('Mary Read');
  clock.t += 2 * DAY; // no longer new on the forum
  const letters = (id: number) => lettersSince(g.game, id, 0).filter((l) => l.from === 'The Forum');
  return { ...g, svc, clock, a, b, c, letters };
}

test('a reply, a quote and a mention each put a letter in the port mailbox, never to the author', () => {
  const { svc, clock, a, b, c, letters } = setup();
  const t = svc.createTopic(a.u, { section: 'general', title: 'Где лучший ром?', body: 'Спрашиваю всех', ...form });
  assert.equal(letters(a.id).length, 0, 'her own topic: nothing');
  clock.t += 60_000;
  svc.reply(b.u, { topic: t.topicId, body: `Ром на Тортуге лучше всех, ${'и это правда '.repeat(20)} @[Mary Read]`, replyTo: t.postId, ...form });
  const la = letters(a.id);
  assert.equal(la.length, 1);
  assert.equal(la[0].subject, 'You have a reply on the forum');
  assert.match(la[0].body, /^Jack Rackham replied to you on the forum, in the topic “Где лучший ром\?”:/);
  assert.match(la[0].body, /\/site\/forum\/p\/\d+$/);
  const quoted = /“(.*)”\n/.exec(la[0].body.split('\n').slice(1).join('\n') + '\n')?.[1] ?? '';
  assert.ok(quoted.length <= 120, 'the first ~120 characters');
  assert.equal(letters(c.id).length, 1, 'the mentioned one too');
  assert.match(letters(c.id)[0].body, /mentioned you/);
  assert.equal(letters(b.id).length, 0, 'never to the one who wrote');
  // she answers herself in her own topic: nothing to her
  svc.reply(a.u, { topic: t.topicId, body: 'Спасибо!', ...form });
  assert.equal(letters(a.id).length, 1);
});

test('coalesced: one letter per member per topic in ten minutes; another topic is another letter', () => {
  const { game, svc, clock, a, b, letters } = setup();
  const t = svc.createTopic(a.u, { section: 'general', title: 'Тема', body: 'Текст', ...form });
  for (let i = 0; i < 4; i++) {
    clock.t += 60_000;
    svc.reply(b.u, { topic: t.topicId, body: `ответ ${i}`, ...form });
  }
  assert.equal(letters(a.id).length, 1, 'a busy thread: one letter');
  clock.t += 180_000;
  const t2 = svc.createTopic(a.u, { section: 'general', title: 'Вторая', body: 'Текст', ...form });
  clock.t += 60_000;
  svc.reply(b.u, { topic: t2.topicId, body: 'ответ', ...form });
  assert.equal(letters(a.id).length, 2, 'another topic');
  game.wallSkew += FORUM_MAIL_COALESCE + 1000;
  clock.t += 60_000;
  svc.reply(b.u, { topic: t.topicId, body: 'ещё ответ', ...form });
  assert.equal(letters(a.id).length, 3, 'ten minutes on: a letter again');
});

test('the e-mail goes to a verified address away from the game, once a day, not when unsubscribed', async () => {
  const { game, db, svc, clock, a, b, letters } = setup();
  const t = svc.createTopic(a.u, { section: 'general', title: 'Тема', body: 'Текст', ...form });
  const mailer = game.auth.mailer as OutboxMailer;
  // no address: the letter only
  clock.t += 60_000;
  svc.reply(b.u, { topic: t.topicId, body: 'ответ', ...form });
  assert.equal(letters(a.id).length, 1);
  assert.equal(mailer.sent.length, 0);
  // a verified address: the e-mail, in her language, with the one-click unsubscribe
  db.setEmail(a.id, 'anne@example.com', 'x');
  db.setEmailVerified(a.id);
  clock.t += 180_000;
  const t2 = svc.createTopic(a.u, { section: 'general', title: 'Вторая', body: 'Текст', ...form });
  clock.t += 60_000;
  svc.reply(b.u, { topic: t2.topicId, body: 'ответ на вторую', ...form });
  await new Promise((r) => setImmediate(r));
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'anne@example.com');
  assert.match(mailer.sent[0].subject, /Вам ответили на форуме/);
  assert.match(mailer.sent[0].text, /\/auth\/unsub\?a=\d+&t=/);
  // a day's limit
  clock.t += 180_000;
  const t3 = svc.createTopic(a.u, { section: 'general', title: 'Третья', body: 'Текст', ...form });
  clock.t += 60_000;
  svc.reply(b.u, { topic: t3.topicId, body: 'ответ', ...form });
  assert.equal(letters(a.id).length, 3);
  assert.equal(mailer.sent.length, 1, 'one e-mail a day');
  // unsubscribed: no more e-mails, the letters still come
  const unsub = /t=([\w-]+)/.exec(mailer.sent[0].text)![1];
  assert.ok(game.auth.unsubscribeAdvice(a.id, unsub));
  game.wallSkew += 2 * DAY;
  clock.t += 60_000;
  svc.reply(b.u, { topic: t.topicId, body: 'через два дня', ...form });
  assert.equal(letters(a.id).length, 4);
  assert.equal(mailer.sent.length, 1, 'unsubscribed');
});

test('the words: excerpt cut, both tongues, and the client’s table turns the letter Russian', () => {
  assert.equal(forumExcerpt('a  b\n\nc'), 'a b c');
  const long = forumExcerpt('x'.repeat(300));
  assert.equal(long.length, 120);
  assert.ok(long.endsWith('…'));
  const n = { kind: 'quote' as const, from: 'Jack', topic: 1, title: 'Ром', post: 7, excerpt: 'Йо-хо-хо' };
  const en = forumLetterWords(n, 'en', 'https://x/site/forum/p/7');
  const ru = forumLetterWords(n, 'ru', 'https://x/site/forum/p/7');
  assert.equal(ru.subject, 'Вам ответили на форуме');
  assert.match(ru.body, /^Jack процитировал\(а\) вас на форуме, в теме «Ром»:\n«Йо-хо-хо»\nЧитать на форуме: https:\/\/x\/site\/forum\/p\/7$/);
  // the client's template (client/src/lang/server.ts): «{0}…» matched against the English letter
  const pat = forumLetterPatterns().find(([e]) => e.includes('quoted you'))!;
  const re = new RegExp(`^${pat[0].split(/(\{\d\})/).map((p) => (/^\{\d\}$/.test(p) ? '(.*?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`, 's');
  const m = re.exec(en.body);
  assert.ok(m, 'the English letter matches its pattern');
  assert.equal(pat[1].replace(/\{(\d)\}/g, (_, i) => m![Number(i) + 1]), ru.body);
});
