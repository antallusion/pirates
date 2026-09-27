// Friends and whispers (docs/11 P6): a list kept with the profile — who is at sea, at what level and where, a word
// when a friend comes aboard or goes ashore; whispers by name (names with spaces too) and a reply to the last one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS_MAX } from '../shared/src/protocol.ts';
import { whisperCommand } from '../server/src/game/friends.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

const bad = (c: ReturnType<typeof join>) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);

test('a friend on the list: at sea and where, a word when they go ashore and come aboard again', () => {
  const { game } = makeGame();
  const a = join(game, 'Ada Friend');
  const b = join(game, 'Bo Friend');
  a.push({ t: 'friend', action: 'add', name: 'bo friend' }); // any case, while at sea
  const list = a.last('friends')!.list;
  assert.deepEqual(list.map((f) => [f.name, f.online]), [['Bo Friend', true]]);
  assert.ok(list[0].level! >= 1 && (list[0].region || list[0].docked));
  assert.ok(a.all('toast').some((t) => t.msg === 'Bo Friend is now on your list of friends.'));
  a.push({ t: 'friend', action: 'add', name: 'Bo Friend' });
  a.push({ t: 'friend', action: 'add', name: 'Ada Friend' });
  a.push({ t: 'friend', action: 'add', name: 'Nobody At All' });
  assert.deepEqual(bad(a), ['Bo Friend is already on your list of friends', 'You cannot befriend yourself', 'No captain goes by that name']);
  // Bo goes ashore: Ada hears it and sees it.
  const token = b.last('welcome')!.token;
  b.close();
  for (let i = 0; i < 800 && !a.all('toast').some((t) => t.msg === 'Friend ashore: Bo Friend.'); i++) steps(game, 1);
  assert.ok(a.all('toast').some((t) => t.msg === 'Friend ashore: Bo Friend.'));
  assert.deepEqual(a.last('friends')!.list.map((f) => [f.name, f.online]), [['Bo Friend', false]]);
  // Kept with the profile, ashore too: a captain ashore is added by name (as written, each word capitalised).
  const c = join(game, 'Cy Friend');
  c.push({ t: 'friend', action: 'add', name: 'bo friend' }); // ashore: the name as mostly written
  assert.deepEqual(c.last('friends')!.list.map((f) => [f.name, f.online]), [['Bo Friend', false]]);
  // Bo comes aboard again: both hear it.
  const b2 = new FakeConn();
  game.attach(b2 as unknown as WsConnection);
  b2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.ok(b2.last('init'), 'Bo is back aboard');
  assert.ok(a.all('toast').some((t) => t.msg === 'Friend at sea: Bo Friend.'));
  assert.ok(c.all('toast').some((t) => t.msg === 'Friend at sea: Bo Friend.'));
  assert.equal(a.last('friends')!.list[0].online, true);
  // Off the list.
  a.push({ t: 'friend', action: 'remove', name: 'BO FRIEND' });
  assert.deepEqual(a.last('friends')!.list, []);
  a.push({ t: 'friend', action: 'remove', name: 'Bo Friend' });
  assert.equal(bad(a).at(-1), 'Not on your list of friends');
});

test('the list is capped', () => {
  const { game } = makeGame();
  const a = join(game, 'Many Friends');
  const A = game.sessionByName('Many Friends')!;
  A.profile!.friends = Array.from({ length: FRIENDS_MAX }, (_, i) => ({ id: 10_000 + i, name: `Ghost ${i}` }));
  join(game, 'One Too Many');
  a.push({ t: 'friend', action: 'add', name: 'One Too Many' });
  assert.equal(bad(a).at(-1), `Your list of friends is full (${FRIENDS_MAX})`);
});

test('whispers go to one captain by name (spaces and all), echo back, and "/r" answers the last', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Whisper');
  const b = join(game, 'Bob Whisper');
  const c = join(game, 'Cat Whisper');
  a.push({ t: 'chat', text: '/w bob whisper meet me at the Hook' });
  const got = b.all('chat').filter((m) => m.ch === 'whisper');
  assert.deepEqual(got.map((m) => [m.from, m.text, m.to]), [['Ann Whisper', 'meet me at the Hook', undefined]]);
  assert.deepEqual(a.all('chat').filter((m) => m.ch === 'whisper').map((m) => [m.to, m.text]), [['Bob Whisper', 'meet me at the Hook']], 'echoed to the sender');
  assert.equal(c.all('chat').filter((m) => m.text.includes('Hook')).length, 0, 'no one else hears it');
  // Bob answers without naming her; the Russian commands work too.
  b.push({ t: 'chat', text: '/о aye, at dusk' });
  assert.deepEqual(a.all('chat').filter((m) => m.ch === 'whisper' && !m.to).map((m) => [m.from, m.text]), [['Bob Whisper', 'aye, at dusk']]);
  c.push({ t: 'chat', text: '/ш Ann Whisper hello' });
  assert.ok(a.all('chat').some((m) => m.from === 'Cat Whisper' && m.text === 'hello'));
  // The errors.
  c.push({ t: 'chat', text: '/r no one yet' });
  a.push({ t: 'chat', text: '/w Nobody Here hello' });
  a.push({ t: 'chat', text: '/w Bob Whisper' });
  a.push({ t: 'chat', text: '/w Ann Whisper talking to myself' });
  assert.deepEqual(bad(c), ['No one has whispered to you yet']);
  assert.deepEqual(bad(a), ['No captain of that name is at sea', 'Whisper to whom? /w Name words', 'You mutter to yourself']);
  // Not a whisper: "/where" is not "/w".
  assert.equal(whisperCommand('/where'), null);
  assert.deepEqual(whisperCommand('/W Ann hi'), { rest: 'Ann hi', reply: false });
});

test('friends and whispers read in Russian', () => {
  setLang('ru');
  const lines = [
    'Bo Friend is now on your list of friends.', 'Bo Friend is off your list of friends.', 'Bo Friend is already on your list of friends',
    'You cannot befriend yourself', `Your list of friends is full (${FRIENDS_MAX})`, 'Not on your list of friends', 'Friend at sea: Bo Friend.',
    'Friend ashore: Bo Friend.', 'No one has whispered to you yet', 'Bo Friend is not at sea', 'Whisper to whom? /w Name words', 'You mutter to yourself',
    'No captain goes by that name', 'No captain of that name is at sea', 'Name a captain',
  ];
  const out = lines.map((l) => serverText(l));
  setLang('en');
  const english = out.filter((r) => /[A-Za-z]{3,}/.test(r.replace(/Bo Friend|Name/g, '')));
  assert.deepEqual(english, []);
});
