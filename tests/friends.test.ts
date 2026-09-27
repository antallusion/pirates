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

test('the unheard: their chat, whispers and invitations do not reach one; hearing them again', () => {
  const { game } = makeGame();
  const a = join(game, 'Deaf Ear');
  const b = join(game, 'Loud Mouth');
  const c = join(game, 'Third Party');
  a.push({ t: 'friend', action: 'add', name: 'Loud Mouth' });
  a.push({ t: 'chat', text: '/игнор loud mouth' });
  assert.deepEqual(a.last('friends')!.ignored, ['Loud Mouth']);
  assert.deepEqual(a.last('friends')!.list, [], 'off the friends too');
  const heard = () => a.all('chat').filter((m) => m.from === 'Loud Mouth').length;
  b.push({ t: 'chat', text: 'buy my rum' });
  b.push({ t: 'chat', text: '/w Deaf Ear buy my rum' });
  assert.equal(heard(), 0, 'neither the open chat nor a whisper');
  assert.ok(c.all('chat').some((m) => m.from === 'Loud Mouth'), 'the others still hear him');
  b.push({ t: 'group', action: 'invite', name: 'Deaf Ear' });
  assert.equal(a.all('party').at(-1)?.invites.length ?? 0, 0, 'no invitation arrives');
  assert.deepEqual(bad(b), ['Deaf Ear is not listening to you', 'Deaf Ear is not listening to you']);
  // In a group together (she invites him), his group lines stay unheard too.
  a.push({ t: 'group', action: 'invite', name: 'Loud Mouth' });
  const inv = b.last('party')!.invites[0];
  b.push({ t: 'group', action: 'accept', id: inv.id });
  b.push({ t: 'group', action: 'say', text: 'ahoy group' });
  assert.equal(heard(), 0);
  assert.ok(c.all('chat').every((m) => m.text !== 'ahoy group'));
  // Heard again.
  a.push({ t: 'friend', action: 'unignore', name: 'LOUD MOUTH' });
  assert.deepEqual(a.last('friends')!.ignored, []);
  b.push({ t: 'chat', text: 'buy my rum' });
  assert.equal(heard(), 1);
  a.push({ t: 'chat', text: '/ignore Deaf Ear' });
  assert.equal(bad(a).at(-1), 'You cannot stop hearing yourself');
});

test('friends and whispers read in Russian', () => {
  setLang('ru');
  const lines = [
    'Bo Friend is now on your list of friends.', 'Bo Friend is off your list of friends.', 'Bo Friend is already on your list of friends',
    'You cannot befriend yourself', `Your list of friends is full (${FRIENDS_MAX})`, 'Not on your list of friends', 'Friend at sea: Bo Friend.',
    'Friend ashore: Bo Friend.', 'No one has whispered to you yet', 'Bo Friend is not at sea', 'Whisper to whom? /w Name words', 'You mutter to yourself',
    'No captain goes by that name', 'No captain of that name is at sea', 'Name a captain',
    'You cannot stop hearing yourself', 'You already do not hear Bo Friend', `The list of the unheard is full (${FRIENDS_MAX})`,
    'You no longer hear Bo Friend: not their words, whispers or invitations.', 'Not on your list of the unheard', 'You hear Bo Friend again.',
    'Bo Friend is not listening to you',
  ];
  const out = lines.map((l) => serverText(l));
  setLang('en');
  const english = out.filter((r) => /[A-Za-z]{3,}/.test(r.replace(/Bo Friend|Name/g, '')));
  assert.deepEqual(english, []);
});

test('who is at sea: everyone aboard but oneself, by a part of the name or a guild tag, one’s own waters first', () => {
  const { game } = makeGame();
  const a = join(game, 'Who Asks');
  const nell = join(game, 'Near Nell');
  join(game, 'Far Fergus');
  const F = game.sessionByName('Far Fergus')!;
  F.ship!.region = F.ship!.region === 'gravewater' ? 'black_coast' : 'gravewater';
  a.push({ t: 'who', q: '', here: false });
  let w = a.last('who')!;
  assert.equal(w.total, 2);
  assert.deepEqual(w.list.map((e) => e.name), ['Near Nell', 'Far Fergus'], 'one’s own waters first');
  a.push({ t: 'who', q: 'fer', here: false });
  assert.deepEqual(a.last('who')!.list.map((e) => e.name), ['Far Fergus']);
  a.push({ t: 'who', q: '', here: true });
  w = a.last('who')!;
  assert.deepEqual(w.list.map((e) => e.name), ['Near Nell'], 'these waters only');
  // By a guild's tag.
  const N = game.sessionByName('Near Nell')!;
  N.profile!.gold = 50_000;
  nell.push({ t: 'guild', action: 'found', name: 'Salt Owls', tag: 'OWL' });
  assert.ok(game.guilds.of(game, N.accountId), 'the guild is founded');
  a.push({ t: 'who', q: '[owl]', here: false });
  assert.deepEqual(a.last('who')!.list.map((e) => [e.name, e.guild]), [['Near Nell', 'OWL']]);
});

test('inspecting a captain at sea: level, path, ship and deeds — never the purse or the hold', () => {
  const { game } = makeGame();
  const a = join(game, 'Curious Cai');
  join(game, 'Seen Sal');
  const S = game.sessionByName('Seen Sal')!;
  S.profile!.title = 'Hand for Hire';
  S.profile!.quests.done = ['x', 'elite_saltmarrow_1', 'elite_saltmarrow_2'];
  a.push({ t: 'inspect', name: 'seen sal' });
  const v = a.last('inspect')!.view;
  assert.equal(v.name, 'Seen Sal');
  assert.equal(v.level, S.profile!.level);
  assert.equal(v.title, 'Hand for Hire');
  assert.equal(v.ship.classId, S.ship!.cls.id);
  assert.equal(v.questsDone, 3);
  assert.equal(v.contracts, 2);
  assert.ok(!('gold' in v) && !('cargo' in v), 'nothing private');
  a.push({ t: 'inspect', name: 'Nobody Here' });
  assert.equal(bad(a).at(-1), 'No captain of that name is at sea');
});
