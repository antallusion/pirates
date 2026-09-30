// The players' chat (owner, 2026-09-30): each line carries who speaks (her captain's portrait, her flag, her level),
// lines are cleaned and cut, a captain who speaks too fast is held back for a moment, and the emblems (`:coin:`) are
// shown as pictures only after the words are escaped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_BURST, CHAT_MAX, CHAT_REFILL, CHAT_TOO_FAST, chatFace, cleanChat } from '../server/src/game/chat.ts';
import { chatBody, chatRel, EMOTES } from '../client/src/ui/chat.ts';
import { join, makeGame, steps } from './helpers.ts';

const said = (c: ReturnType<typeof join>, text: string) => c.all('chat').filter((m) => m.text === text);

test('a line in the chat says who speaks: the captain for the portrait, the level, and the flag once sworn', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Speaker', 'drowned');
  const b = join(game, 'Bo Listener');
  a.push({ t: 'chat', text: 'Fair winds' });
  const got = said(b, 'Fair winds')[0];
  assert.ok(got, 'Bo hears it');
  assert.equal(got.from, 'Ann Speaker');
  assert.equal(got.face, 'drowned');
  assert.equal(got.lv, 1);
  assert.equal(got.fac, undefined, 'not sworn: no flag');
  const A = game.sessionByName('Ann Speaker')!;
  A.profile!.oath = 'marque';
  assert.equal(chatFace(A).fac, 'crown');
  A.profile!.oath = 'code';
  assert.equal(chatFace(A).fac, 'free');
  // Whispers carry the face too, to both ends.
  a.push({ t: 'chat', text: '/w Bo Listener meet at dusk' });
  assert.equal(b.all('chat').find((m) => m.ch === 'whisper')?.face, 'drowned');
  assert.equal(a.all('chat').find((m) => m.ch === 'whisper' && m.to === 'Bo Listener')?.face, 'drowned');
});

test('lines are cleaned: control characters out, spaces folded, cut to the longest line; an empty one is not sent', () => {
  assert.equal(cleanChat('  a\u0000b\tc\n\nd  '), 'a b c d');
  assert.equal(cleanChat('x‮y'), 'x y', 'no text-direction tricks');
  assert.equal(cleanChat('w'.repeat(500)).length, CHAT_MAX);
  assert.equal(cleanChat(undefined), '');
  const { game } = makeGame();
  const a = join(game, 'Ann Blank');
  const b = join(game, 'Bo Blank');
  a.push({ t: 'chat', text: ' \u0007 ' });
  assert.equal(b.all('chat').filter((m) => m.from === 'Ann Blank').length, 0);
  a.push({ t: 'chat', text: 'y'.repeat(900) });
  assert.equal(b.all('chat').find((m) => m.from === 'Ann Blank')?.text.length, CHAT_MAX);
});

test('a captain who speaks too fast is held back, and may speak again after a moment', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Loud');
  const b = join(game, 'Bo Ears');
  for (let i = 0; i < CHAT_BURST + 3; i++) a.push({ t: 'chat', text: `line ${i}` });
  const heard = () => b.all('chat').filter((m) => m.from === 'Ann Loud').length;
  assert.equal(heard(), CHAT_BURST, 'the burst passes, the rest do not');
  assert.ok(a.all('toast').some((t) => t.kind === 'bad' && t.msg === CHAT_TOO_FAST), 'she is told why');
  // Whispers and the group's words count against the same breath.
  a.push({ t: 'chat', text: '/w Bo Ears psst' });
  assert.equal(b.all('chat').filter((m) => m.ch === 'whisper').length, 0);
  steps(game, Math.ceil((CHAT_REFILL * 1.5) / 0.05) + 2);
  a.push({ t: 'chat', text: 'after a breath' });
  assert.equal(said(b, 'after a breath').length, 1, 'a moment later she is heard again');
  // Commands are not chat: /ignore works however fast she has spoken.
  for (let i = 0; i < CHAT_BURST + 2; i++) a.push({ t: 'chat', text: `more ${i}` });
  const before = a.all('toast').length;
  a.push({ t: 'chat', text: '/ignore Bo Ears' });
  assert.ok(a.all('toast').slice(before).some((t) => t.msg !== CHAT_TOO_FAST), 'the command answers');
});

test('the emblems: escaped words first, then each known :token: a picture; unknown tokens stay words', () => {
  const art = (id: string) => `<img class="emo" src="/${id}.webp" alt="" />`;
  assert.ok(EMOTES.length >= 8 && EMOTES.length <= 12, 'eight to twelve emblems');
  for (const [, id] of EMOTES) assert.match(id, /^icon\./, 'the game\'s own icons');
  const html = chatBody('<b>hi</b> :coin: & :nope: :skull:', art);
  assert.ok(html.startsWith('&lt;b&gt;hi&lt;/b&gt; '), 'markup is escaped');
  assert.ok(html.includes('src="/icon.coin.webp"') && html.includes('title=":coin:"'));
  assert.ok(html.includes('src="/icon.danger.webp"'));
  assert.ok(html.includes(':nope:'), 'an unknown token is left as it was');
  assert.ok(html.includes('&amp;'));
  // A token cannot smuggle markup: only [a-z] names are looked up.
  assert.ok(!chatBody(':"><script>:', art).includes('<script>'));
  // No picture (art not loaded): the token stays as words.
  assert.equal(chatBody(':coin:', () => ''), ':coin:');
});

test('the colour of a name follows what the speaker is to the reader', () => {
  const ctx = { self: 'Me', group: ['Mate'], guild: ['Brother'], friends: ['Pal'] };
  assert.equal(chatRel({ from: 'Me', text: '' }, ctx), 'self');
  assert.equal(chatRel({ from: 'Mate', text: '' }, ctx), 'group');
  assert.equal(chatRel({ from: '[TAG] Brother', text: '', ch: 'guild' }, ctx), 'guild');
  assert.equal(chatRel({ from: 'Pal', text: '' }, ctx), 'friend');
  assert.equal(chatRel({ from: 'Stranger', text: '', ch: 'whisper' }, ctx), 'whisper');
  assert.equal(chatRel({ from: 'Stranger', text: '', fac: 'crown' }, ctx), 'crown');
  assert.equal(chatRel({ from: 'Stranger', text: '' }, ctx), 'other');
});
