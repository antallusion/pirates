// The name filter (forum post 66, the tester Эдуард: «Сделайте хоть какую-то проверку того, как игроки называют своих
// пиратов»): the coarse words, slurs and their disguises refused in every name a player types, the innocent words that
// hold a root let through, the chat masked word by word, and the names given before the filter listed and fixed by
// /names with a free rename left to her.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badName, badWord, NAME_BAD } from '../shared/src/namefilter.ts';
import { maskBadWords } from '../shared/src/chat.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { capMenuHtml, renameHtml } from '../client/src/ui/capmenu.ts';
import { AuthService } from '../server/src/auth.ts';
import { Database } from '../server/src/persistence/db.ts';
import { foundGuild } from '../server/src/game/guilds.ts';
import { namesAdmin, namesStaff, scanNames } from '../server/src/game/names.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, makeGame, join } from './helpers.ts';

const COARSE = [
  'ПИДОРАС', 'пидор', 'Пидр', 'п.и.д.о.р', 'П И Д О Р', 'ПИД ОР', 'пииидор', 'pidor', 'PIDORAS', 'xуй', 'Хуйло', 'huy', 'нахуй', 'Охуенный',
  'Пизда', 'pizda', 'пиzда', 'ебан', 'Заебал', 'ебло', 'уебок', 'Долбоёб', 'бля', 'блять', 'blyat', '6ля', 'сука', 'suka', 'cyka', 'Сучка',
  'мудак', 'гандон', 'шлюха', 'залупа', '3алупа', 'дрочила', 'говно', 'Говнюк', 'Педик', 'жид', 'мразь', 'Гитлер', 'Hitler', 'nazi',
  'Адольф 1488', 'Sieg Heil', 'Fuck', 'FuckYou', 'shit', 'cunt', 'nigger', 'n1gger', 'faggot', 'fag', 'whore', 'bitch', 'Капитан Хуй',
];
const FINE = [
  'Команда', 'гребля', 'рубля', 'корабля', 'скипидар', 'оскорблять', 'застрахуй', 'страхую', 'употреблять', 'Потреблять', 'Ослаблять',
  'сукно', 'сук', 'Сукре', 'мебель', 'хлеб', 'небо', 'Ребекка', 'Педро', 'Хуан', 'Чихуахуа', 'Мандарин', 'Гондурас', 'Мудрый', 'Жидкий',
  'Хачапури', 'Говорун', 'Хулиган', 'Шкипер', 'Блин', 'Себастьян', 'Небесный', 'Гребень', 'Чёрная Борода', 'Морской Волк', 'Анна Тестова',
  'Летучий Голландец', 'Dickens', 'Scunthorpe', 'Yamashita', 'Nazim', 'Hue', 'Huey', 'Ebony', 'Ebenezer', 'Hughes', 'Cocktail', 'Cockpit',
  'Assassin', 'Pizarro', 'Pussycat', 'Hancock', 'Peacock', 'Blackbeard', 'Salty Dog', 'Captain Hook', 'Barbossa', 'Test Wake', 'Ann Salty',
];

test('the filter refuses the coarse words, the slurs and their disguises (look-alikes, by sound, dots, spaces, repeats)', () => {
  for (const n of COARSE) assert.equal(badName(n), true, n);
});

test('the filter lets the innocent words through, though they hold a root (команда, гребля, скипидар, Педро, Scunthorpe…)', () => {
  for (const n of FINE) assert.equal(badName(n), false, n);
  assert.equal(badWord('ок'), false, 'two letters are never coarse');
});

test('the chat is masked word by word, never refused: the filter\'s wider list too, the innocent words untouched', () => {
  assert.equal(maskBadWords('ты п.и.д.о.р'), 'ты п********');
  assert.equal(maskBadWords('привет pidor'), 'привет p****');
  assert.equal(maskBadWords('«Гитлер»'), '«Г*****»');
  assert.equal(maskBadWords('дрочила, иди сюда'), 'д******, иди сюда');
  for (const fine of ['наша команда гребёт', 'у корабля нет рубля', 'скипидар и застрахуй', 'Педро и Хуан', 'Dickens in Scunthorpe']) assert.equal(maskBadWords(fine), fine, fine);
});

test('a refused name is told so, in Russian: «Имя не подходит: выберите другое»', () => {
  setLang('ru');
  try {
    assert.equal(serverText(NAME_BAD), 'Имя не подходит: выберите другое.');
  } finally {
    setLang('en');
  }
});

test('every name a player types: the guest\'s and the provider\'s captain, the ship at the start, the guild and its tag', () => {
  const db = new Database(':memory:');
  const auth = new AuthService(db);
  assert.deepEqual(auth.register('ПИДОРАС'), { error: NAME_BAD });
  assert.deepEqual(auth.register('П.И.Д.О.Р'), { error: 'Name must be 3–20 letters, digits, spaces, apostrophes or dashes.' }, 'the dots are refused before');
  assert.ok('token' in auth.register('Морской Волк'));
  assert.equal(auth.oauthLogin('vk', '1', null, 'Хуйло Иваныч').name, 'Captain', 'a provider\'s coarse name is not taken');

  const { game } = makeGame();
  join(game, 'Ann Namer');
  // a fresh account names her ship
  const fresh = new FakeConn();
  const s = game.attach(fresh as unknown as WsConnection);
  fresh.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Cid Fresh' });
  fresh.push({ t: 'create_captain', captain: 'corsair', shipName: 'Залупа' });
  assert.equal(s.profile === null, true,'no captain under a coarse ship\'s name');
  assert.ok(fresh.all('err').some((m) => m.msg === NAME_BAD));
  fresh.push({ t: 'create_captain', captain: 'corsair', shipName: 'Чёрная Каракатица' });
  assert.equal(s.profile?.shipName, 'Чёрная Каракатица');

  const a = game.sessionByName('Ann Namer')!;
  a.profile!.gold = 1_000_000;
  assert.ok(a.ship!.docked, 'she starts in port');
  assert.equal(foundGuild(game, a, 'Блядская Стая', 'СС'), NAME_BAD);
  assert.equal(foundGuild(game, a, 'Морские Волки', 'ХУЙ'), NAME_BAD, 'the tag too');
});

test('/names scan lists the names given before the filter; /names fix renames them, leaves a free rename and a letter', () => {
  const { game, db } = makeGame();
  const c = join(game, 'Ann Clean');
  const s = game.sessionByName('Ann Clean')!;
  // a name from before the filter
  assert.ok(db.renameAccount(s.accountId, 'ПИДОРАС'));
  s.name = 'ПИДОРАС';
  s.profile!.shipName = 'Хуеплёт';
  const hits = scanNames(game);
  assert.deepEqual(hits.map((h) => h.kind).sort(), ['captain', 'ship']);
  assert.match(namesAdmin(game, ['scan']), /captain #\d+ «ПИДОРАС».*ship #\d+ «Хуеплёт»/);

  const out = namesAdmin(game, ['fix', String(s.accountId)]);
  assert.match(out, /Names fixed \(2\)/);
  const want = `Капитан ${s.accountId}`;
  assert.equal(s.name, want);
  assert.equal(s.ship!.captainName, want);
  assert.equal(db.accountById(s.accountId)?.name, want);
  assert.notEqual(s.profile!.shipName, 'Хуеплёт');
  assert.equal(s.ship!.name, s.profile!.shipName);
  assert.equal(s.profile!.renames, 1, 'a free rename is hers');
  assert.ok(lettersSince(game, s.accountId, 0).some((l) => l.subject === 'Your captain has a new name' && l.body.includes('ПИДОРАС')));
  assert.equal(scanNames(game).length, 0, 'nothing left');
  assert.equal(namesAdmin(game, ['fix', 'all']), 'Names: nothing to fix.');

  // her free rename: a coarse one refused, a fine one taken, then no more
  c.push({ t: 'rename', name: 'Хуй Моржовый' });
  assert.deepEqual(c.last('renamed'), { t: 'renamed', ok: false, error: NAME_BAD });
  assert.equal(s.profile!.renames, 1);
  c.push({ t: 'rename', name: 'Анна Чистая' });
  assert.deepEqual(c.last('renamed'), { t: 'renamed', ok: true, name: 'Анна Чистая' });
  assert.equal(db.accountById(s.accountId)?.name, 'Анна Чистая');
  assert.equal(s.profile!.renames, 0);
  c.push({ t: 'rename', name: 'Анна Вторая' });
  assert.deepEqual(c.last('renamed'), { t: 'renamed', ok: false, error: 'You have no free rename.' });
});

test('/names is the admins\' (FORUM_ADMINS) on a live server', () => {
  assert.equal(namesStaff(7, '3, 7 ,9'), true);
  assert.equal(namesStaff(8, '3,7,9'), false);
  assert.equal(namesStaff(1, undefined), false);
});

test('the captain\'s menu offers the free rename and its page', () => {
  assert.match(capMenuHtml({ name: 'Капитан 5', level: 3, pts: 0, renames: 1 }, { pts: 0, lv: 3 }), /data-cap="rename"/);
  assert.doesNotMatch(capMenuHtml({ name: 'Анна', level: 3, pts: 0 }, { pts: 0, lv: 3 }), /data-cap="rename"/);
  assert.match(renameHtml('Капитан 5'), /name="name"[^>]*value="Капитан 5"/);
});
