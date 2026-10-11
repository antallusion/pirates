// The players' chat (docs/28; owner, 2026-10-11: «реализация реалтайм чата … все должны кто в мире общаться, у капитанов
// ники и иконки должны быть … и приватные сообщения тоже»): who speaks on each line and the server's stamp; the world
// heard in every zone; private words online and offline, kept and handed over on coming aboard; the gate (the gap, the
// burst, the silence, the same words twice); the unheard; escaping and the emotes (only known codes); coarse words
// masked; links that may be followed; the harbour master's /mute.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { parseLayout } from '../shared/src/world/zones.ts';
import { CHAT_BREACH_MUTE, CHAT_BURST, CHAT_DM_KEEP, CHAT_GAP, CHAT_MAX, CHAT_WINDOW, EMOTES, EMOTE_GROUPS, chatParts, emoteOf, emoteSuggest, maskBadWords, ownLink } from '../shared/src/chat.ts';
import type { ChatLineView, ServerMsg } from '../shared/src/protocol.ts';
import { CHAT_TOO_FAST, chatFace, cleanChat } from '../server/src/game/chat.ts';
import { chatBody, chatRel } from '../client/src/ui/chat.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { Database } from '../server/src/persistence/db.ts';
import { ZoneRuntime } from '../server/src/zones/zone.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

type Chat = Extract<ServerMsg, { t: 'chat' }>;
const said = (c: FakeConn, text: string) => c.all('chat').filter((m) => m.text === text);
const bad = (c: FakeConn) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);
/** A breath between lines (the gap is CHAT_GAP seconds of world time; a step is 0.05 s). */
const breathe = (game: Game, s = CHAT_GAP + 0.1) => steps(game, Math.ceil(s / 0.05));

test('a line says who speaks (portrait, level, flag, guild tag) and carries the server\'s id and time', () => {
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
  assert.match(got.id ?? '', /^[0-9a-f]{6}[0-9a-z]+$/, 'an id for dedupe');
  assert.ok(Math.abs((got.at ?? 0) - game.wallNow()) < 5000, 'stamped by the server');
  assert.equal(said(a, 'Fair winds')[0]?.id, got.id, 'the same line to everyone');
  const A = game.sessionByName('Ann Speaker')!;
  A.profile!.oath = 'marque';
  assert.equal(chatFace(A).fac, 'crown');
  A.profile!.oath = 'code';
  assert.equal(chatFace(A).fac, 'free');
  // ids differ line by line
  breathe(game);
  a.push({ t: 'chat', text: 'and following seas' });
  assert.notEqual(said(b, 'and following seas')[0]?.id, got.id);
});

test('lines are cleaned and cut at the longest line; an empty one is not sent', () => {
  assert.equal(cleanChat('  a\u0000b\tc\n\nd  '), 'a b c d');
  assert.equal(cleanChat('x\u202ey\u200bz'), 'x y z', 'no text-direction tricks, no hidden spaces');
  assert.equal(CHAT_MAX, 300);
  assert.equal(cleanChat('w'.repeat(900)).length, CHAT_MAX);
  assert.equal(cleanChat(undefined), '');
  const { game } = makeGame();
  const a = join(game, 'Ann Blank');
  const b = join(game, 'Bo Blank');
  a.push({ t: 'chat', text: ' \u0007 ' });
  assert.equal(b.all('chat').filter((m) => m.from === 'Ann Blank').length, 0);
  a.push({ t: 'chat', text: 'y'.repeat(900) });
  assert.equal(b.all('chat').find((m) => m.from === 'Ann Blank')?.text.length, CHAT_MAX);
});

test('the gate: one line per gap, the burst in the window, a short silence for breaking it, the same words refused', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Loud');
  const b = join(game, 'Bo Ears');
  const heard = () => b.all('chat').filter((m) => m.from === 'Ann Loud').length;
  a.push({ t: 'chat', text: 'one' });
  a.push({ t: 'chat', text: 'two' });
  assert.equal(heard(), 1, 'the second, too soon, is not heard');
  assert.equal(bad(a).at(-1), CHAT_TOO_FAST);
  breathe(game);
  a.push({ t: 'chat', text: 'two' });
  assert.equal(heard(), 2, 'after the gap she is heard');
  // the same words again within the window
  breathe(game);
  a.push({ t: 'chat', text: 'Two!' });
  assert.equal(heard(), 2);
  assert.equal(bad(a).at(-1), 'You have said that already');
  // the burst: CHAT_BURST lines in the window, then a silence
  for (let i = heard(); i < CHAT_BURST; i++) {
    breathe(game);
    a.push({ t: 'chat', text: `line ${i}` });
  }
  assert.equal(heard(), CHAT_BURST);
  breathe(game);
  a.push({ t: 'chat', text: 'one too many' });
  assert.equal(heard(), CHAT_BURST, 'past the burst: not heard');
  assert.equal(bad(a).at(-1), `Too many lines: you are silenced for ${CHAT_BREACH_MUTE} s`);
  breathe(game, 5);
  a.push({ t: 'chat', text: 'still silenced' });
  assert.match(bad(a).at(-1)!, /^You are silenced for \d+ s$/);
  breathe(game, CHAT_BREACH_MUTE);
  a.push({ t: 'chat', text: 'heard again' });
  assert.equal(said(b, 'heard again').length, 1, 'after the silence she speaks again');
  // three refusals for speed in the window silence her too; whispers and the local channel count against the same breath
  const c = join(game, 'Cat Quick');
  c.push({ t: 'chat', text: 'a' });
  c.push({ t: 'chat', text: 'b' });
  c.push({ t: 'chat', text: '/w Bo Ears c' });
  c.push({ t: 'chat', text: 'd', ch: 'local' });
  assert.equal(bad(c).at(-1), `Too many lines: you are silenced for ${CHAT_BREACH_MUTE} s`);
  // commands are not chat: /ignore answers however fast she spoke
  c.push({ t: 'chat', text: '/ignore Bo Ears' });
  assert.ok(c.all('toast').at(-1)?.msg.startsWith('You no longer hear Bo Ears'));
});

test('private words online: to her alone, echoed to the sender, kept; "/r" answers; names with spaces', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Whisper');
  const b = join(game, 'Bob Whisper');
  const c = join(game, 'Cat Whisper');
  a.push({ t: 'chat', text: 'meet me at the Hook', ch: 'dm', to: 'bob whisper' });
  const got = b.all('chat').filter((m) => m.ch === 'whisper');
  assert.deepEqual(got.map((m) => [m.from, m.text, m.to]), [['Ann Whisper', 'meet me at the Hook', undefined]]);
  assert.deepEqual(a.all('chat').filter((m) => m.ch === 'whisper').map((m) => [m.to, m.text]), [['Bob Whisper', 'meet me at the Hook']]);
  assert.equal(c.all('chat').length, 0, 'no one else hears it');
  b.push({ t: 'chat', text: '/о aye, at dusk' });
  assert.deepEqual(a.all('chat').filter((m) => m.ch === 'whisper' && !m.to).map((m) => [m.from, m.text]), [['Bob Whisper', 'aye, at dusk']]);
  // the history of the conversation from the database
  a.push({ t: 'chat_hist', peer: 'Bob Whisper' });
  const h = a.last('chat_hist')!;
  assert.equal(h.peer, 'Bob Whisper');
  assert.deepEqual(h.dms[0].lines.map((l) => [l.from, l.text, l.to]), [['Ann Whisper', 'meet me at the Hook', 'Bob Whisper'], ['Bob Whisper', 'aye, at dusk', undefined]]);
  // refusals
  breathe(game);
  a.push({ t: 'chat', text: 'hello', ch: 'dm', to: 'Nobody Here' });
  a.push({ t: 'chat', text: 'talking to myself', ch: 'dm', to: 'Ann Whisper' });
  c.push({ t: 'chat', text: '/r no one yet' });
  assert.deepEqual(bad(a), ['No captain goes by that name', 'You mutter to yourself']);
  assert.deepEqual(bad(c), ['No one has whispered to you yet']);
});

test('private words offline: kept, handed over on coming aboard with the unread, the last hundred of a conversation', () => {
  const { game } = makeGame();
  const b = join(game, 'Bea Away');
  const token = b.last('welcome')!.token;
  b.close();
  steps(game, 3);
  assert.equal(game.sessionByName('Bea Away'), undefined, 'she has gone ashore');
  const a = join(game, 'Ann Writer');
  a.push({ t: 'chat', text: 'are you there?', ch: 'dm', to: 'Bea Away' });
  assert.deepEqual(bad(a), [], 'a captain ashore may be written to');
  assert.equal(a.all('chat').filter((m) => m.ch === 'whisper' && m.to === 'Bea Away').length, 1, 'echoed');
  for (let i = 0; i < CHAT_DM_KEEP + 5; i++) {
    breathe(game, CHAT_WINDOW / CHAT_BURST + 0.1); // a steady hand: the burst never runs out
    game.sessionByName('Ann Writer')!.msgCount = 0; // (the wire's own flood guard counts real seconds: the test runs faster)
    a.push({ t: 'chat', text: `letter ${i}`, ch: 'dm', to: 'Bea Away' });
  }
  // she comes aboard again: the conversation comes with the history, its unread counted
  const b2 = new FakeConn();
  game.attach(b2 as unknown as WsConnection);
  b2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  const h = b2.last('chat_hist')!;
  assert.ok(h, 'the history on coming aboard');
  const th = h.dms.find((d) => d.peer === 'Ann Writer')!;
  assert.ok(th, 'the conversation with Ann');
  assert.equal(th.unread, CHAT_DM_KEEP + 6);
  assert.equal(th.face, 'corsair');
  b2.push({ t: 'chat_hist', peer: 'Ann Writer' });
  const whole = b2.last('chat_hist')!.dms[0].lines;
  assert.equal(whole.length, CHAT_DM_KEEP, 'the last hundred kept');
  assert.equal(whole.at(-1)!.text, `letter ${CHAT_DM_KEEP + 4}`);
  assert.equal(whole[0].text, 'letter 5');
  // read: the unread go
  b2.push({ t: 'chat_read', peer: 'Ann Writer' });
  b2.push({ t: 'chat_hist' });
  assert.equal(b2.last('chat_hist')!.dms.find((d) => d.peer === 'Ann Writer')!.unread, 0);
  // live now: the next line comes at once
  breathe(game, CHAT_WINDOW / CHAT_BURST + 0.1);
  a.push({ t: 'chat', text: 'welcome back', ch: 'dm', to: 'Bea Away' });
  assert.equal(said(b2, 'welcome back').length, 1);
});

test('the channels\' history on coming aboard: the world\'s last lines (and none the reader blocked)', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Early');
  const m = join(game, 'Mo Rude');
  for (let i = 0; i < 3; i++) {
    a.push({ t: 'chat', text: `early ${i}` });
    m.push({ t: 'chat', text: `rude ${i}` });
    breathe(game);
  }
  const c = join(game, 'Cy Late');
  const h = c.last('chat_hist')!;
  assert.deepEqual(h.lines.filter((l) => !l.ch).map((l) => l.text), ['early 0', 'rude 0', 'early 1', 'rude 1', 'early 2', 'rude 2']);
  c.push({ t: 'friend', action: 'ignore', name: 'Mo Rude' });
  c.push({ t: 'chat_hist' });
  assert.deepEqual(c.last('chat_hist')!.lines.map((l) => l.text), ['early 0', 'early 1', 'early 2']);
});

test('the unheard: their world, local and private words do not reach her; a private word to her is refused', () => {
  const { game } = makeGame();
  const a = join(game, 'Deaf Ear');
  const b = join(game, 'Loud Mouth');
  const c = join(game, 'Third Party');
  a.push({ t: 'chat', text: '/игнор loud mouth' });
  assert.deepEqual(a.last('friends')!.ignored, ['Loud Mouth']);
  const heard = () => a.all('chat').filter((m) => m.from === 'Loud Mouth').length;
  b.push({ t: 'chat', text: 'buy my rum' });
  breathe(game);
  b.push({ t: 'chat', text: 'cheap rum here', ch: 'local' });
  breathe(game);
  b.push({ t: 'chat', text: 'psst', ch: 'dm', to: 'Deaf Ear' });
  assert.equal(heard(), 0);
  assert.equal(bad(b).at(-1), 'Deaf Ear is not listening to you');
  assert.ok(c.all('chat').some((m) => m.from === 'Loud Mouth' && m.text === 'buy my rum'), 'the others still hear him');
  // ashore too: her saved list is read
  a.close();
  steps(game, 3);
  breathe(game);
  b.push({ t: 'chat', text: 'are you there', ch: 'dm', to: 'Deaf Ear' });
  assert.equal(bad(b).at(-1), 'Deaf Ear is not listening to you');
});

test('the ships in sight hear the local channel; the far ones do not', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Near');
  const b = join(game, 'Bo Near');
  const c = join(game, 'Cy Far');
  for (const n of ['Ann Near', 'Bo Near', 'Cy Far']) game.sessionByName(n)!.ship!.docked = null;
  const A = game.sessionByName('Ann Near')!.ship!, B = game.sessionByName('Bo Near')!.ship!, C = game.sessionByName('Cy Far')!.ship!;
  B.state.x = A.state.x + 500;
  B.state.y = A.state.y;
  C.state.x = A.state.x + 9000;
  C.state.y = A.state.y;
  a.push({ t: 'chat', text: 'ahoy neighbours', ch: 'local' });
  assert.equal(said(b, 'ahoy neighbours')[0]?.ch, 'local');
  assert.equal(said(c, 'ahoy neighbours').length, 0);
  assert.equal(said(a, 'ahoy neighbours').length, 1, 'she sees her own line');
});

test('escaping and the emotes: markup is words, only known codes become pictures, links only of our own domain', () => {
  const art = (id: string) => `<img class="emo" src="/${id}.webp" alt="" />`;
  assert.ok(EMOTES.length >= 30 && EMOTES.length <= 48, `${EMOTES.length} emotes, thirty to forty-eight`);
  assert.deepEqual([...new Set(EMOTES.map((e) => e.group))], [...EMOTE_GROUPS], 'four groups, each used');
  assert.equal(new Set(EMOTES.map((e) => e.code)).size, EMOTES.length, 'codes are unique');
  for (const e of EMOTES) {
    assert.match(e.art, /^icon\./, 'the game\'s own icons');
    assert.doesNotMatch(e.art, /skull|bone|blood|wanted|black_flag/, 'no skulls, bones or blood');
    assert.match(e.code, /^[a-z0-9_]{2,12}$/);
    assert.ok(/^[а-яё ]+$/.test(e.ru), `${e.code}: a Russian name`);
  }
  const html = chatBody('<b>hi</b> :rum: & :nope: :KRAKEN: :gold:', art);
  assert.ok(html.startsWith('&lt;b&gt;hi&lt;/b&gt; '), 'markup is escaped');
  assert.ok(html.includes('src="/icon.good_rum.webp"') && html.includes('title=":rum:"'));
  assert.ok(html.includes('src="/icon.map_monster.webp"'), 'codes are read in any case');
  assert.ok(html.includes('src="/icon.doubloon.webp"'), 'an alias');
  assert.ok(html.includes(':nope:'), 'an unknown code is left as words');
  assert.ok(html.includes('&amp;'));
  assert.ok(!chatBody(':"><script>:', art).includes('<script>'), 'a code cannot smuggle markup');
  assert.ok(!chatBody('<img src=x onerror=alert(1)>', art).includes('<img'));
  assert.equal(chatBody(':rum:', () => ''), ':rum:', 'no picture yet: the code stays as words');
  assert.equal(emoteOf('nope'), undefined);
  assert.deepEqual(chatParts('a :rum: b').map((p) => p.k), ['text', 'emote', 'text']);
  assert.deepEqual(chatParts('a :zzz: b').map((p) => p.k), ['text']);
  assert.equal(emoteSuggest('ru')[0].code, 'rum', 'the autocomplete after «:»');
  assert.equal(emoteSuggest('ром')[0].code, 'rum', 'by the Russian name too');
  // links: words, but our own domain's
  assert.ok(!chatBody('see evil.example.com/x now').includes('<a'), 'another domain stays words');
  assert.ok(!chatBody('https://gravetidegame.com.evil.io').includes('<a'));
  const own = chatBody('join gravetidegame.com/guild?x=1');
  assert.ok(own.includes('<a class="cl-link" href="https://gravetidegame.com/guild?x=1"') && own.includes('rel="noopener noreferrer"'));
  assert.equal(ownLink('javascript:alert(1)'), null);
});

test('coarse words are masked (first letter kept), the ship\'s words left alone; the server masks before anyone hears', () => {
  assert.equal(maskBadWords('ну ты сука'), 'ну ты с***');
  assert.equal(maskBadWords('ПИЗДЕЦ'), 'П*****');
  assert.equal(maskBadWords('заебал'), 'з*****');
  assert.equal(maskBadWords('xуйня'), 'x****', 'a Latin look-alike does not hide it');
  assert.equal(maskBadWords('fuck this, shit'), 'f*** this, s***');
  assert.equal(maskBadWords('у корабля бля'), 'у корабля б**', 'the ship\'s «корабля» is not touched');
  for (const fine of ['страхуй небо', 'хлеб и побег', 'Dickens cockpit shell Scunthorpe', 'сук на мачте', 'обед']) assert.equal(maskBadWords(fine), fine, fine);
  const { game } = makeGame();
  const a = join(game, 'Ann Salty');
  const b = join(game, 'Bo Prim');
  a.push({ t: 'chat', text: 'what the fuck' });
  assert.equal(b.all('chat').at(-1)?.text, 'what the f***');
});

test('the harbour master\'s /mute (minutes; 0 lets her speak), its HELP pair; every chat refusal reads in Russian', () => {
  const was = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const { game } = makeGame();
    const boss = join(game, 'Harbour Master');
    const a = join(game, 'Ann Noisy');
    const b = join(game, 'Bo Quiet');
    boss.push({ t: 'chat', text: '/mute Ann Noisy 5' });
    assert.equal(boss.all('toast').at(-1)?.msg, 'Ann Noisy is silenced for 5 min.');
    assert.equal(a.all('toast').at(-1)?.msg, 'The harbour master silences you for 5 min.');
    a.push({ t: 'chat', text: 'let me speak' });
    assert.equal(said(b, 'let me speak').length, 0);
    assert.equal(bad(a).at(-1), 'You are silenced for 5 min');
    a.push({ t: 'chat', text: 'not even this', ch: 'dm', to: 'Bo Quiet' });
    assert.equal(b.all('chat').length, 0);
    boss.push({ t: 'chat', text: '/mute Ann Noisy 0' });
    assert.equal(boss.all('toast').at(-1)?.msg, 'Ann Noisy may speak again.');
    a.push({ t: 'chat', text: 'thank you' });
    assert.equal(said(b, 'thank you').length, 1);
    boss.push({ t: 'chat', text: '/mute nobody' });
    assert.equal(boss.all('toast').at(-1)?.msg, 'Usage: /mute name minutes');
    boss.push({ t: 'chat', text: '/help' });
    const help = boss.all('toast').at(-1)!.msg;
    assert.ok(help.includes('/mute name minutes'), 'in HELP');
    assert.ok(SERVER_RU_ADMIN[help]?.includes('/mute имя минуты'), 'and in its Russian pair');
  } finally {
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
  setLang('ru');
  try {
    const lines = ['You are silenced for 5 min', 'You are silenced for 12 s', `Too many lines: you are silenced for ${CHAT_BREACH_MUTE} s`, 'You have said that already', 'You are in no guild', 'You have no ship',
      'Report sent: the harbour master will look into it.', 'Ann Noisy is silenced for 5 min.', 'Ann Noisy may speak again.', 'The harbour master silences you for 5 min.', CHAT_TOO_FAST,
      'No captain goes by that name', 'You mutter to yourself', 'Whisper to whom? /w Name words', 'No one has whispered to you yet', 'You sail alone', 'Name a captain'];
    const english = lines.map((l) => serverText(l)).filter((r) => /[A-Za-z]{3,}/.test(r.replace(/Ann Noisy|Name/g, '')));
    assert.deepEqual(english, []);
  } finally {
    setLang('en');
  }
});

test('a report on a line is kept for the harbour master', () => {
  const { game, db } = makeGame();
  const a = join(game, 'Ann Reporter');
  join(game, 'Bo Spammer');
  a.push({ t: 'chat_report', name: 'Bo Spammer', text: 'buy gold at evil.com' });
  assert.equal(a.all('toast').at(-1)?.msg, 'Report sent: the harbour master will look into it.');
  const kept = db.getKv<{ byName: string; onName: string; text: string }[]>('chat_reports')!;
  assert.deepEqual(kept.map((r) => [r.byName, r.onName, r.text]), [['Ann Reporter', 'Bo Spammer', 'buy gold at evil.com']]);
});

test('the group and the guild: their own lines, their own history', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Mate');
  const b = join(game, 'Bo Mate');
  const c = join(game, 'Cy Outside');
  a.push({ t: 'chat', text: 'no group', ch: 'group' });
  assert.equal(bad(a).at(-1), 'You sail alone');
  a.push({ t: 'group', action: 'invite', name: 'Bo Mate' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  a.push({ t: 'chat', text: 'wind backing west', ch: 'group' });
  assert.equal(said(b, 'wind backing west')[0]?.ch, 'group');
  assert.equal(said(c, 'wind backing west').length, 0);
  breathe(game);
  a.push({ t: 'group', action: 'say', text: 'the old way too' });
  assert.equal(said(b, 'the old way too').length, 1);
  b.push({ t: 'chat_hist' });
  assert.deepEqual(b.last('chat_hist')!.lines.filter((l) => l.ch === 'group').map((l) => l.text), ['wind backing west', 'the old way too']);
  breathe(game);
  a.push({ t: 'chat', text: 'no guild', ch: 'guild' });
  assert.equal(bad(a).at(-1), 'You are in no guild');
});

test('the colour of a name follows what the speaker is to the reader', () => {
  const ctx = { self: 'Me', group: ['Mate'], guild: ['Brother'], friends: ['Pal'] };
  assert.equal(chatRel({ from: 'Me', text: '' }, ctx), 'self');
  assert.equal(chatRel({ from: 'Mate', text: '' }, ctx), 'group');
  assert.equal(chatRel({ from: 'Brother', text: '', ch: 'guild', g: 'TAG' }, ctx), 'guild');
  assert.equal(chatRel({ from: 'Pal', text: '' }, ctx), 'friend');
  assert.equal(chatRel({ from: 'Stranger', text: '', ch: 'whisper' }, ctx), 'whisper');
  assert.equal(chatRel({ from: 'Stranger', text: '', fac: 'crown' }, ctx), 'crown');
  assert.equal(chatRel({ from: 'Stranger', text: '' }, ctx), 'other');
});

// ------------------------------------------------------------------------------------------ two zones

const SECRET = 'chat-zones-secret-0123456789';
const LAYOUT = parseLayout(`west=black_coast;east=${REGION_IDS.filter((r) => r !== 'black_coast').join(',')}`);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('two zones: the world is heard across the line, private words reach a captain sailing in the other zone, each line once', async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), 'chatzones-'));
  const file = pathJoin(dir, 'world.db');
  const mk = () => {
    const db = new Database(file);
    const game = new Game({ db, auth: new AuthService(db), log: () => {} });
    game.directorOn = false;
    return { db, game };
  };
  const W = mk(), E = mk();
  const ze = new ZoneRuntime(E.game, { id: 'east', layout: LAYOUT, secret: SECRET, peers: [{ id: 'west', host: '127.0.0.1', port: 0 }], log: () => {} });
  const ePort = await ze.listen(0);
  const zw = new ZoneRuntime(W.game, { id: 'west', layout: LAYOUT, secret: SECRET, peers: [{ id: 'east', host: '127.0.0.1', port: ePort }], log: () => {} });
  await zw.listen(0);
  try {
    for (let i = 0; i < 100 && !(zw.up('east') && ze.up('west')); i++) await wait(20);
    assert.ok(zw.up('east') && ze.up('west'), 'the zones are linked');
    const west = join(W.game, 'Wren West');
    const east = join(E.game, 'Esme East');
    const east2 = join(E.game, 'Eli East');
    // the world, from the west
    west.push({ t: 'chat', text: 'ahoy the east' });
    for (let i = 0; i < 50 && !said(east, 'ahoy the east').length; i++) await wait(10);
    const got = said(east, 'ahoy the east');
    assert.equal(got.length, 1, 'heard once in the east');
    assert.equal(got[0].from, 'Wren West');
    assert.equal(got[0].id, said(west, 'ahoy the east')[0].id, 'the same id on both sides');
    assert.equal(said(east2, 'ahoy the east').length, 1);
    // and into the east's history for those who come aboard there later
    const late = join(E.game, 'Lou Late');
    assert.ok(late.last('chat_hist')!.lines.some((l: ChatLineView) => l.text === 'ahoy the east'));
    // a line arriving twice (the mesh and the bus) is taken once
    E.game.zone!.relayChat({ kind: 'world', line: got[0], from: 1 });
    await wait(50);
    assert.equal(said(west, 'ahoy the east').length, 1, 'an echo of a known id is dropped');
    // private words to a captain in the other zone
    east.push({ t: 'chat', text: 'meet at the line', ch: 'dm', to: 'Wren West' });
    for (let i = 0; i < 50 && !said(west, 'meet at the line').length; i++) await wait(10);
    const dm = said(west, 'meet at the line') as Chat[];
    assert.equal(dm.length, 1);
    assert.equal(dm[0].ch, 'whisper');
    assert.equal(dm[0].from, 'Esme East');
    // the answer back: "/r" knows who whispered, across the line too
    breathe(W.game);
    west.push({ t: 'chat', text: '/r aye' });
    for (let i = 0; i < 50 && !said(east, 'aye').length; i++) await wait(10);
    assert.equal(said(east, 'aye').length, 1);
    assert.equal(said(east2, 'aye').length, 0, 'to her alone');
    // and kept in the shared database: the east reads the conversation the west wrote
    east.push({ t: 'chat_hist', peer: 'Wren West' });
    assert.deepEqual(east.last('chat_hist')!.dms[0].lines.map((l) => l.text), ['meet at the line', 'aye']);
  } finally {
    zw.stop();
    ze.stop();
    W.db.close();
    E.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
