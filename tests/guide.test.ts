// «Лоцманская книга» (2026-11-02): shared/src/data/guide/ (the format, the search, the counts), server/src/game/guide.ts
// (read, seen, a section's silver once), client/src/ui/guide*.ts (the windows it opens, the «?», the tips' triggers).
// The first block holds every article the content's hands write to the format: unique ids, both languages, known
// windows and triggers, related articles that exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE, GUIDE_SECTIONS, GUIDE_SECTION_REWARD, guideArticle, guideSectionIds } from '../shared/src/data/guide/index.ts';
import type { GuideArticle } from '../shared/src/data/guide/types.ts';
import { GUIDE_TRIGGERS, GUIDE_WINDOWS } from '../shared/src/data/guide/triggers.ts';
import { guideCounts, guideSectionsDone } from '../shared/src/data/guide/book.ts';
import { guideMarks, guideNorm, guideSearch, guideStem, wordMatch } from '../shared/src/data/guide/search.ts';
import { guideRead, guideSeen, guideStore } from '../server/src/game/guide.ts';
import { guideRoute, helpTarget, modalWindowId } from '../client/src/ui/guidewin.ts';
import { guideMsgTrigger, guideStateTriggers } from '../client/src/ui/guidetip.ts';
import { helpBtn, litHtml, slideSrc } from '../client/src/ui/guide.ts';
import { CAP_ITEMS } from '../client/src/ui/capmenu.ts';
import { MORE_ITEMS } from '../client/src/ui/hudmore.ts';
import { EN as G_EN, RU as G_RU } from '../client/src/lang/ui/guide.ts';
import type { ServerMsg } from '../shared/src/protocol.ts';
import { join, makeGame } from './helpers.ts';

const CYR = /[а-яё]/i;

test('every article keeps the format: unique ids, a known section, both languages, at least one picture', () => {
  const ids = new Set<string>();
  for (const a of GUIDE) {
    assert.match(a.id, /^[a-z0-9][a-z0-9-]*$/, `id ${a.id}`);
    assert.ok(!ids.has(a.id), `id ${a.id} twice`);
    ids.add(a.id);
    assert.ok(GUIDE_SECTIONS.includes(a.section), `${a.id}: section ${a.section}`);
    for (const [k, v] of [['title', a.title], ['summary', a.summary]] as const) {
      assert.ok(v[0].trim() && v[1].trim(), `${a.id}: ${k} in both languages`);
      assert.ok(CYR.test(v[1]), `${a.id}: ${k} in Russian`);
    }
    assert.ok(a.tags.length > 0, `${a.id}: search words`);
    assert.ok(a.slides.length > 0, `${a.id}: a picture at least`);
    a.slides.forEach((s, i) => {
      assert.ok(s.text[0].trim() && s.text[1].trim() && CYR.test(s.text[1]), `${a.id} #${i}: the caption in both languages`);
      if (s.img) assert.match(s.img, /^(guide\.[\w-]+|[\w.-]+|[\w./-]+\.(webp|png|jpg|avif))$/, `${a.id} #${i}: picture ${s.img}`);
      if (s.show) assert.ok((GUIDE_WINDOWS as readonly string[]).includes(s.show.open), `${a.id} #${i}: «Показать в игре» opens ${s.show.open}`);
    });
  }
});

test('related articles exist, windows and first-time triggers are ones the engine knows', () => {
  for (const a of GUIDE) {
    for (const r of a.related ?? []) {
      assert.ok(guideArticle(r), `${a.id}: related ${r}`);
      assert.notEqual(r, a.id, `${a.id}: related to itself`);
    }
    if (a.window) assert.ok((GUIDE_WINDOWS as readonly string[]).includes(a.window), `${a.id}: window ${a.window}`);
    if (a.firstTime) assert.ok((GUIDE_TRIGGERS as readonly string[]).includes(a.firstTime), `${a.id}: trigger ${a.firstTime}`);
  }
  // each trigger opens one article at most (the tip names it)
  const by = new Map<string, string>();
  for (const a of GUIDE) if (a.firstTime) {
    assert.ok(!by.has(a.firstTime), `trigger ${a.firstTime}: ${by.get(a.firstTime)} and ${a.id}`);
    by.set(a.firstTime, a.id);
  }
});

test('the book has articles; ten sections in the book order', () => {
  assert.deepEqual(GUIDE_SECTIONS, ['sea', 'combat', 'flags', 'trade', 'island', 'army', 'explore', 'travel', 'progress', 'faq']);
  assert.ok(GUIDE.length >= 2);
  assert.ok(guideSectionIds('sea').length > 0, 'the section of the sea (the server test reads it through)');
  assert.equal(GUIDE_SECTION_REWARD, 300);
});

test('every window id the book may name is opened by a route', () => {
  for (const id of GUIDE_WINDOWS) assert.ok(guideRoute(id), id);
  assert.deepEqual(guideRoute('port:flag'), { k: 'port', tab: 'colours' });
  assert.deepEqual(guideRoute('shipyard'), { k: 'port', tab: 'shipyard' });
  assert.deepEqual(guideRoute('settings:promo'), { k: 'settings', promo: true });
  assert.deepEqual(guideRoute('pvp'), { k: 'hero', tab: 'pvp' });
  assert.equal(guideRoute('port:nowhere'), null);
  assert.equal(guideRoute('nonsense'), null);
});

// ---------------------------------------------------------------------------------------------- the search

const A = (id: string, title: [string, string], tags: string[], summary: [string, string], slides: [string, string][], section: GuideArticle['section'] = 'sea'): GuideArticle =>
  ({ id, section, title, tags, summary, slides: slides.map((text) => ({ text })) });
const LIST: GuideArticle[] = [
  A('ports', ['Ports', 'Порты'], ['harbour', 'гавань'], ['Repair and trade.', 'Ремонт и торговля.'], [['Sail into a port.', 'Зайдите в порт.']]),
  A('boarding', ['Boarding', 'Абордаж'], ['board', 'абордаж'], ['Take a ship by storm.', 'Возьмите корабль штурмом.'], [['Your crew fights on her deck.', 'Ваша команда бьётся на её палубе.']], 'combat'),
  A('hedgehog', ['Ice floes', 'Льдины'], ['ice'], ['The north freezes.', 'Север замерзает.'], [['A hull with ёлка painted on it gets through.', 'Корпус с ёлкой пройдёт сквозь лёд.']], 'travel'),
  A('flags', ['Flags', 'Флаги'], ['colours', 'флаг'], ['Your colours and the law.', 'Ваш флаг и закон.'], [['A port of the Crown checks the papers.', 'Порт Короны проверяет бумаги.']], 'flags'),
];

test('the search: lowercase, ё as е, word forms by their stem, one slip in a long word, every word must be found', () => {
  assert.equal(guideNorm('Ёлка, ПОРТ!'), 'елка порт');
  assert.equal(guideStem('порту'), 'порт');
  assert.equal(guideStem('абордажа'), 'аборда');
  assert.equal(wordMatch('порт', 'порт'), 3);
  assert.equal(wordMatch('порту', 'порты'), 2);
  assert.equal(wordMatch('абордаж', 'обордаж'), 0, 'the first letters kept');
  assert.equal(wordMatch('карабль', 'корабль'), 1, 'one slip forgiven');
  assert.equal(wordMatch('абордж', 'абордаж'), 2, 'a letter short: still its stem');
  const ids = (q: string, ru = true) => guideSearch(LIST, q, ru).map((h) => h.article.id);
  assert.equal(ids('порту')[0], 'ports', 'a word form');
  assert.deepEqual(ids('ПОРТ').slice(0, 1), ['ports'], 'the title first, then the slides that name it');
  assert.ok(ids('порт').includes('flags'), 'a slide that names it');
  assert.deepEqual(ids('елка'), ['hedgehog'], 'ё read as е');
  assert.deepEqual(ids('boarding', false), ['boarding'], 'English');
  assert.deepEqual(ids('абордаж палуба'), ['boarding'], 'two words, both found');
  assert.deepEqual(ids('абордаж льдины'), [], 'every word must be found');
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('а'), [], 'one letter is no query');
  // the snippet: the summary, or the slide that alone says it
  const h = guideSearch(LIST, 'палуба', true)[0];
  assert.equal(h.slide, 0);
  assert.match(h.snippet, /палубе/);
});

test('the highlight marks the words found', () => {
  const t = 'Порт Короны проверяет бумаги.';
  assert.deepEqual(guideMarks(t, 'порт'), [[0, 4]]);
  assert.deepEqual(guideMarks('В порту чинят', 'порты'), [[2, 7]]);
  assert.equal(litHtml('Порт <b>', 'порт'), '<mark>Порт</mark> &lt;b&gt;');
  assert.equal(litHtml('Nothing here', 'порт'), 'Nothing here');
});

test('«Изучено N / M»: counts by section; a section is done when all of it is read, an empty one never', () => {
  const c = guideCounts(LIST, ['ports', 'boarding']);
  assert.deepEqual(c.all, { n: 2, m: 4 });
  assert.deepEqual(c.by.sea, { n: 1, m: 1 });
  assert.deepEqual(guideSectionsDone(LIST, ['ports', 'boarding']).sort(), ['combat', 'sea']);
  assert.deepEqual(guideSectionsDone(LIST, []), []);
  assert.ok(!guideSectionsDone(LIST, ['ports']).includes('faq'));
});

// ---------------------------------------------------------------------------------------------- the server

/** One sea for the server's tests (a world is slow to make). */
let world: ReturnType<typeof makeGame> | null = null;
const aWorld = () => (world ??= makeGame());

test('the server records what is read and pays a section read through once, server-side', () => {
  const { game } = aWorld();
  const paid: [number, string][] = [];
  const ledger = game.db.ledger.bind(game.db);
  game.db.ledger = (acc: number, kind: string, n: number, detail: string) => {
    if (kind === 'guide') paid.push([n, detail]);
    ledger(acc, kind, n, detail);
  };
  const conn = join(game, 'Guide Reader');
  const s = game.sessionByName('Guide Reader')!;
  // the view comes on coming aboard
  assert.ok(conn.inbox.some((m) => m.t === 'guide'), 'the view on login');
  const sea = guideSectionIds('sea');
  const g0 = s.profile!.gold;
  // an unknown id, a non-string: nothing
  assert.equal(guideRead(game, s, 'no-such-article'), 0);
  assert.equal(guideRead(game, s, 42), 0);
  assert.deepEqual(guideStore(game, s.accountId).r, []);
  // all but the last: recorded, nothing paid
  for (const id of sea.slice(0, -1)) {
    conn.push({ t: 'guide_read', id });
    assert.equal(s.profile!.gold, g0);
  }
  // the last one: the section's silver once
  conn.inbox.length = 0;
  conn.push({ t: 'guide_read', id: sea.at(-1)! });
  assert.equal(s.profile!.gold, g0 + GUIDE_SECTION_REWARD);
  const got = conn.inbox.find((m): m is Extract<ServerMsg, { t: 'guide' }> => m.t === 'guide');
  assert.deepEqual(got?.got, { section: 'sea', silver: GUIDE_SECTION_REWARD });
  assert.deepEqual(got?.view.paid, ['sea']);
  assert.deepEqual([...got!.view.read].sort(), [...sea].sort());
  // read again (another tab, a replayed message): never paid twice
  conn.push({ t: 'guide_read', id: sea.at(-1)! });
  assert.equal(guideRead(game, s, sea[0]), 0);
  assert.equal(s.profile!.gold, g0 + GUIDE_SECTION_REWARD);
  // the silver is in the ledger, once
  assert.deepEqual(paid, [[GUIDE_SECTION_REWARD, 'guide:sea']]);
});

test('a first-time tip is kept once an account; unknown keys are refused; it survives a new login', () => {
  const { game } = aWorld();
  const conn = join(game, 'Guide Tipper');
  const s = game.sessionByName('Guide Tipper')!;
  assert.equal(guideSeen(game, s, 'wreck-near'), true);
  assert.equal(guideSeen(game, s, 'wreck-near'), false, 'once');
  assert.equal(guideSeen(game, s, 'made-up-key'), false);
  assert.equal(guideSeen(game, s, { k: 1 }), false);
  conn.push({ t: 'guide_seen', key: 'first-port' });
  assert.deepEqual(guideStore(game, s.accountId).s, ['wreck-near', 'first-port']);
  // the view sent at the next coming aboard carries them (the store is the account's)
  assert.deepEqual(guideStore(game, s.accountId).p, []);
});

// ---------------------------------------------------------------------------------------------- the client

test('«?» of a window: its own article, else its parent window\'s, else the section about it', () => {
  const list: GuideArticle[] = [
    { ...LIST[0], window: 'port' },
    { ...LIST[3], window: 'port:flag' },
    { ...LIST[1], window: 'hire' },
  ];
  assert.deepEqual(helpTarget(list, 'port'), { article: 'ports' });
  assert.deepEqual(helpTarget(list, 'port:tavern'), { article: 'ports' }, 'the harbour\'s article for a tab of its own without one');
  assert.deepEqual(helpTarget(list, 'port:flag'), { article: 'flags' });
  assert.deepEqual(helpTarget(list, 'flag'), { article: 'flags' });
  assert.deepEqual(helpTarget(list, 'hire'), { article: 'boarding' });
  assert.deepEqual(helpTarget(list, 'isle'), { section: 'island' });
  assert.deepEqual(helpTarget(list, 'pvp'), { section: 'combat' });
  assert.deepEqual(helpTarget([], 'whatever'), { section: 'faq' });
});

test('the window shown names its «?»: the port\'s tab, the hire, the PvP page, none for an answer', () => {
  assert.equal(modalWindowId('port', { portTab: 'tavern' }), 'port:tavern');
  assert.equal(modalWindowId('port', { portTab: 'colours' }), 'port:flag');
  assert.equal(modalWindowId('recruit'), 'hire');
  assert.equal(modalWindowId('hero', { heroTab: 'hero', heroPage: 'pvp' }), 'pvp');
  assert.equal(modalWindowId('hero', { heroTab: 'skills' }), 'skills');
  assert.equal(modalWindowId('options'), 'settings');
  assert.equal(modalWindowId('base'), 'isle');
  assert.equal(modalWindowId('map'), 'map');
  assert.equal(modalWindowId('boarding'), null);
  assert.equal(modalWindowId(null), null);
  for (const w of ['port:tavern', 'port:flag', 'hire', 'pvp', 'skills', 'settings', 'isle', 'map', 'journal', 'crew', 'pass']) assert.ok((GUIDE_WINDOWS as readonly string[]).includes(w), w);
  assert.match(helpBtn('port:flag'), /data-ghelp="port:flag"/);
});

test('the first-time triggers: from the server\'s messages and from the sea about her; none in a lesson', () => {
  assert.equal(guideMsgTrigger({ t: 'surrender_offer', offer: {} } as unknown as ServerMsg), 'struck-pirate');
  assert.equal(guideMsgTrigger({ t: 'surrender_offer', offer: null } as unknown as ServerMsg), null);
  assert.equal(guideMsgTrigger({ t: 'board_tac', view: {} } as unknown as ServerMsg), 'first-boarding');
  assert.equal(guideMsgTrigger({ t: 'port', view: {} } as unknown as ServerMsg), 'first-port');
  const base = { atSea: true, lesson: false, homeIsle: false, maps: 0, overload: false, skulls: 0, storm: false, lighthouse: false, wreck: false, level: 1, quests: 0 };
  assert.deepEqual(guideStateTriggers(base), ['first-sea']);
  assert.deepEqual(guideStateTriggers({ ...base, wreck: true, homeIsle: true, maps: 1, overload: true, skulls: 1 }).sort(), ['first-isle', 'first-sea', 'overload', 'skull', 'treasure-map', 'wreck-near']);
  assert.deepEqual(guideStateTriggers({ ...base, atSea: false, wreck: true, storm: true }), [], 'the sea\'s own only at sea');
  assert.deepEqual(guideStateTriggers({ ...base, lesson: true, homeIsle: true }), [], 'not over the First Watch');
  for (const k of [...guideStateTriggers({ ...base, wreck: true, homeIsle: true, maps: 1, overload: true, skulls: 1, storm: true, lighthouse: true, level: 2, quests: 1 }), 'struck-pirate', 'first-boarding', 'first-port', 'first-trade', 'dive', 'fishing', 'first-hire', 'season-pass'])
    assert.ok((GUIDE_TRIGGERS as readonly string[]).includes(k), k);
});

test('the entry points: «Книга» in the «⋯» tray before «Выход», a tile in the captain\'s menu; pictures by key or path', () => {
  assert.ok(MORE_ITEMS.includes('#touch > #tc-book' as never));
  assert.ok(MORE_ITEMS.indexOf('#touch > #tc-book' as never) < MORE_ITEMS.indexOf('#touch > #tc-exit' as never));
  assert.ok(CAP_ITEMS.some((x) => x.id === 'book'));
  assert.equal(slideSrc(undefined), null);
  assert.equal(slideSrc('guide.port-enter'), '/assets/guide/port-enter.webp');
  assert.equal(slideSrc('assets/ui/x.webp'), '/assets/ui/x.webp');
  assert.equal(G_RU.title, 'Лоцманская книга');
  assert.ok(!/[a-z]/i.test(Object.values(G_RU).join(' ').replace(/\{\w+\}/g, '')), 'no Latin in the Russian words');
  assert.deepEqual(Object.keys(G_RU).sort(), Object.keys(G_EN).sort());
});
