// The chat's window and the button's count (owner, 2026-10-29: «в чате если кто-то написал сделай в значке чата вверху
// справа циферку типа новое сообщение до 99 … показывай только переписку, которая хранится 8 часов и потом удаляется.
// (или сделай ограничение в 50 сообщений и стирай)»): lines older than eight hours go, no more than fifty a channel
// (the stricter wins), on the server (memory and the database's private conversations) and on the screen; the badge
// counts other captains' lines since the last look, «99+» past 99, and goes to nought when the chat is opened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_DM_KEEP, CHAT_HISTORY, CHAT_KEEP_MS, ChatUnread, chatBadgeText, chatWindow } from '../shared/src/chat.ts';
import type { ChatLineView } from '../shared/src/protocol.ts';
import { chatFromAfar, chatPrune } from '../server/src/game/chat.ts';
import { join, makeGame, steps } from './helpers.ts';

const HOUR = 3600_000;

test('the window: eight hours and fifty lines, the stricter wins', () => {
  const now = 100 * HOUR;
  const at = (x: { at: number }) => x.at;
  // by age: of ten lines an hour apart, only those of the last eight hours stay
  const hourly = Array.from({ length: 10 }, (_, i) => ({ at: now - (9 - i) * HOUR, i }));
  assert.deepEqual(chatWindow(hourly, now, at).map((x) => x.i), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(chatWindow(hourly, now + HOUR + 1, at).length, 7, 'an hour on: two more gone (the one just at the edge too)');
  // by count: eighty fresh lines keep the newest fifty
  const many = Array.from({ length: 80 }, (_, i) => ({ at: now - 80 + i, i }));
  const kept = chatWindow(many, now, at);
  assert.equal(kept.length, CHAT_HISTORY);
  assert.equal(kept[0].i, 30);
  assert.equal(kept.at(-1)!.i, 79);
  // both at once: twenty old ones among sixty, the stricter rule decides
  const mixed = [...Array.from({ length: 20 }, (_, i) => ({ at: now - CHAT_KEEP_MS - 1000 + i, i })), ...Array.from({ length: 40 }, (_, i) => ({ at: now - 1000 + i, i: 20 + i }))];
  assert.equal(chatWindow(mixed, now, at).length, 40, 'age is stricter here');
  // nothing to cut: the same array back
  const few = many.slice(-5);
  assert.equal(chatWindow(few, now, at), few);
  assert.equal(CHAT_DM_KEEP, CHAT_HISTORY, 'private words keep the same fifty');
});

let seq = 0;
const afar = (from: string, text: string, at: number): ChatLineView => ({ from, text, id: `zz${(++seq).toString(36)}`, at });

test('the server keeps and sends only the window: by count and by age, on a line and on its minute', () => {
  const { game } = makeGame();
  let clock = 1_000 * HOUR;
  game.wallNow = () => clock;
  const b = join(game, 'Bea Reader');
  for (let i = 0; i < 60; i++) chatFromAfar(game, { kind: 'world', line: afar('Far Voice', `hello ${i}`, clock - 60 + i), from: 9999 });
  const c = join(game, 'Cal Late');
  const h1 = c.last('chat_hist')!.lines.filter((l) => l.from === 'Far Voice');
  assert.equal(h1.length, CHAT_HISTORY, 'fifty sent on coming aboard');
  assert.equal(h1[0].text, 'hello 10');
  assert.equal(h1.at(-1)!.text, 'hello 59');
  // eight hours and a minute on: the minute's prune empties the world
  clock += CHAT_KEEP_MS + 60_000;
  steps(game, 20 * 61);
  b.push({ t: 'chat_hist' });
  assert.equal(b.last('chat_hist')!.lines.filter((l) => l.from === 'Far Voice').length, 0, 'nothing older than eight hours');
  // a line of now and one stamped nine hours ago: only the fresh one is kept
  chatFromAfar(game, { kind: 'world', line: afar('Far Voice', 'stale', clock - 9 * HOUR), from: 9999 });
  chatFromAfar(game, { kind: 'world', line: afar('Far Voice', 'fresh', clock), from: 9999 });
  chatPrune(game);
  b.push({ t: 'chat_hist' });
  assert.deepEqual(b.last('chat_hist')!.lines.filter((l) => l.from === 'Far Voice').map((l) => l.text), ['fresh']);
});

test('private words: a conversation older than eight hours is gone from the database and the list', () => {
  const { game, db } = makeGame();
  let clock = 2_000 * HOUR;
  game.wallNow = () => clock;
  const a = join(game, 'Ann Old');
  const b = join(game, 'Bea Old');
  a.push({ t: 'chat', text: 'a word long ago', ch: 'dm', to: 'Bea Old' });
  b.push({ t: 'chat_hist' });
  assert.equal(b.last('chat_hist')!.dms.find((d) => d.peer === 'Ann Old')?.lines.length, 1);
  clock += CHAT_KEEP_MS + 1000;
  b.push({ t: 'chat_hist' });
  assert.equal(b.last('chat_hist')!.dms.find((d) => d.peer === 'Ann Old'), undefined, 'off the list');
  const A = game.sessionByName('Ann Old')!, B = game.sessionByName('Bea Old')!;
  const key = `dm:${Math.min(A.accountId, B.accountId)}:${Math.max(A.accountId, B.accountId)}`;
  assert.deepEqual(db.getKv(key), [], 'and out of the database');
});

test('the badge: other captains\' lines since the last look, «99+» past 99, nought on opening, the look remembered', () => {
  const t0 = 5_000_000;
  const u = new ChatUnread(t0);
  assert.equal(u.text, '');
  assert.equal(u.take({ from: 'Me', at: t0 + 1 }, 'Me'), false, 'her own: not counted');
  assert.equal(u.take({ from: '[GLD] Me', at: t0 + 1 }, 'Me'), false, 'her own with a guild tag: not counted');
  assert.equal(u.take({ from: '', ch: 'sys', at: t0 + 1 }, 'Me'), false, 'the sea\'s news: not counted');
  assert.equal(u.take({ from: 'Hidden', at: t0 + 1 }, 'Me', true), false, 'one she hid: not counted');
  assert.equal(u.take({ from: 'Ann', at: t0 - 1 }, 'Me'), false, 'seen before the last look (a reload): not counted');
  assert.equal(u.take({ from: 'Ann', at: t0 + 1 }, 'Me'), true);
  assert.equal(u.take({ from: 'Bo', ch: 'guild', at: t0 + 2 }, 'Me'), true);
  assert.equal(u.text, '2');
  for (let i = 0; i < 97; i++) u.take({ from: 'Ann', at: t0 + 10 + i }, 'Me');
  assert.equal(u.count, 99);
  assert.equal(u.text, '99');
  u.take({ from: 'Ann', at: t0 + 200 }, 'Me');
  assert.equal(u.text, '99+');
  // opened: nought, and the look kept for the next visit
  u.seen(t0 + 300);
  assert.equal(u.count, 0);
  assert.equal(u.text, '');
  const reload = new ChatUnread(u.seenAt);
  assert.equal(reload.take({ from: 'Ann', at: t0 + 200 }, 'Me'), false, 'the history after a reload: old lines stay counted out');
  assert.equal(reload.take({ from: 'Ann', at: t0 + 400 }, 'Me'), true);
  assert.deepEqual([0, 1, 9, 10, 99, 100, 5000].map(chatBadgeText), ['', '1', '9', '10', '99', '99+', '99+']);
});
