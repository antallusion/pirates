// The chat's window and the button's count (owner, 2026-10-29: «в чате если кто-то написал сделай в значке чата вверху
// справа циферку типа новое сообщение до 99 … показывай только переписку, которая хранится 8 часов и потом удаляется.
// (или сделай ограничение в 50 сообщений и стирай)»): lines older than eight hours go, no more than fifty a channel
// (the stricter wins), on the server (memory and the database's private conversations) and on the screen; the badge
// counts other captains' lines since the last look, «99+» past 99, and goes to nought when the chat is opened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_DM_KEEP, CHAT_HISTORY, CHAT_KEEP_MS, ChatUnread, chatBadgeText, chatLineFresh, chatWindow } from '../shared/src/chat.ts';
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

test('the badge: other captains’ lines held since the last look, «99+» past 99, nought on opening, the look remembered', () => {
  const t0 = 5_000_000;
  const u = new ChatUnread(t0);
  assert.equal(u.text, '');
  assert.equal(chatLineFresh({ from: 'Me', at: t0 + 1 }, t0, 'Me'), false, 'her own: not counted');
  assert.equal(chatLineFresh({ from: '[GLD] Me', at: t0 + 1 }, t0, 'Me'), false, 'her own with a guild tag: not counted');
  assert.equal(chatLineFresh({ from: 'Me', to: 'Ann', ch: 'whisper', at: t0 + 1 }, t0, null), false, 'her own whisper (an echo): not counted');
  assert.equal(chatLineFresh({ from: '', ch: 'sys', at: t0 + 1 }, t0, 'Me'), false, 'the sea’s news: not counted');
  assert.equal(chatLineFresh({ from: 'Hidden', at: t0 + 1 }, t0, 'Me', true), false, 'one she hid: not counted');
  assert.equal(chatLineFresh({ from: 'Ann', at: t0 - 1 }, t0, 'Me'), false, 'seen before the last look (a reload): not counted');
  const world: ChatLineView[] = [{ from: 'Ann', text: 'a', at: t0 + 1 }, { from: 'Me', text: 'b', at: t0 + 2 }];
  const guild: ChatLineView[] = [{ from: 'Bo', text: 'c', ch: 'guild', at: t0 + 3 }, { from: 'Hidden', text: 'd', ch: 'guild', at: t0 + 4 }];
  assert.equal(u.recount([world, guild], 'Me', (l) => l.from === 'Hidden'), 2);
  assert.equal(u.text, '2');
  const many = Array.from({ length: 100 }, (_, i): ChatLineView => ({ from: 'Ann', text: `${i}`, at: t0 + 10 + i }));
  assert.equal(u.recount([many.slice(0, 50), many.slice(50, 99)], 'Me'), 99);
  assert.equal(u.text, '99');
  u.recount([many.slice(0, 50), many.slice(50)], 'Me');
  assert.equal(u.text, '99+');
  // opened: nought, and the look kept for the next visit
  u.seen(t0 + 300);
  assert.equal(u.recount([many], 'Me'), 0);
  assert.equal(u.text, '');
  const reload = new ChatUnread(u.seenAt);
  assert.equal(reload.recount([[...many, { from: 'Ann', text: 'new', at: t0 + 400 }]], 'Me'), 1, 'after a reload only what came after the look');
  assert.deepEqual([0, 1, 9, 10, 99, 100, 5000].map(chatBadgeText), ['', '1', '9', '10', '99', '99+', '99+']);
});

test('regression (2026-10-29, «в чате показано два сообщения, я открываю - а там пусто»): the badge never counts a line the chat no longer holds', () => {
  const now = 50 * HOUR;
  const at = (l: ChatLineView) => l.at;
  // two lines came while the chat was shut, then the phone lay asleep past eight hours
  let world: ChatLineView[] = [{ from: 'Ann', text: 'one', at: now }, { from: 'Bo', text: 'two', at: now + 1000 }];
  const u = new ChatUnread(now - HOUR);
  assert.equal(u.recount([world], 'Me'), 2, 'two counted while held');
  world = chatWindow(world, now + CHAT_KEEP_MS + 2000, at);
  assert.equal(world.length, 0, 'the window let both go');
  assert.equal(u.recount([world], 'Me'), 0, 'and the badge with them: it shows only what the chat can show');
  // a channel past fifty: the badge counts no more than the fifty held
  const flood = chatWindow(Array.from({ length: 70 }, (_, i): ChatLineView => ({ from: 'Ann', text: `${i}`, at: now + i })), now + 100, at);
  assert.equal(new ChatUnread(0).recount([flood], 'Me'), CHAT_HISTORY);
  // a device clock nine hours fast: by the server's clock (the history's stamp) the fresh lines stay, by the device's
  // they would all go — the chat windows by the server's
  const fresh: ChatLineView[] = [{ from: 'Ann', text: 'hi', at: now - 60_000 }];
  const device = now + 9 * HOUR;
  assert.equal(chatWindow(fresh, device, at).length, 0, '(the device’s clock would empty the chat)');
  const skew = now - device; // chat_hist.now − Date.now()
  assert.equal(chatWindow(fresh, device + skew, at).length, 1, 'the server’s clock keeps it');
});

test('the history carries the server’s clock for the client’s window', () => {
  const { game } = makeGame();
  const clock = 3_000 * HOUR;
  game.wallNow = () => clock;
  const b = join(game, 'Bea Clock');
  assert.equal(b.last('chat_hist')!.now, clock);
  b.push({ t: 'chat_hist' });
  assert.equal(b.last('chat_hist')!.now, clock);
});
