// The task card and the «События» tab (forum 2026-11-07, Эдуард; the owner: «при нажатии на задания надо модалку
// открывать где все написано и может даже автодобраться», «события мира можно выводить в окне чата в какой-нибудь
// вкладке и нажимая на это событие корабль ставит точку и начинает к нему плыть»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHALLENGES, challengeInfo, passPatterns } from '../shared/src/data/seasonpass.ts';
import { guideArticle } from '../shared/src/data/guide/index.ts';
import { setLang } from '../client/src/i18n.ts';
import { taskCardHtml } from '../client/src/ui/taskcard.ts';
import { EN as TK_EN, RU as TK_RU } from '../client/src/lang/ui/taskcard.ts';
import { EN as CH_EN, RU as CH_RU } from '../client/src/lang/ui/chat.ts';
import { CHAT_TABS, EVENTS_KEEP, EVENTS_MS, eventPlace, keepEvents } from '../client/src/ui/chat.ts';
import { goalCard, goalLineOf, goalSheetView } from '../client/src/ui/goalsheet.ts';
import { serverText } from '../client/src/lang/server.ts';

const sp = (s: string | undefined) => (s ?? '').replace(/ /g, ' ');
const latin = (s: string) => /[A-Za-z]{2,}/.test(s.replace(/\{[a-z]+\}/g, ''));

test('every season challenge has its card: how and where in both tongues, no Latin in the Russian, its book\'s article there', () => {
  for (const c of CHALLENGES) {
    const i = challengeInfo(c.id);
    assert.ok(i, c.id);
    for (const t of [i.how, i.where]) {
      assert.ok(t[0].length > 10 && t[1].length > 10, `${c.id}: words`);
      assert.ok(!latin(t[1]), `${c.id}: Latin in «${t[1]}»`);
      assert.ok(!/[А-Яа-яЁё]/.test(t[0]), `${c.id}: Cyrillic in the English`);
    }
    if (i.guide) assert.ok(guideArticle(i.guide), `${c.id}: guide ${i.guide}`);
  }
  // the creatures' and the hunts' challenges say what a lair, a stack, a drift and a hunt are, and link the new articles
  const lair = challengeInfo('d_lair')!, boss = challengeInfo('w_boss')!, board = challengeInfo('d_board')!;
  assert.match(lair.how[1], /Логово/);
  assert.match(lair.how[1], /Отряд тварей/);
  assert.match(lair.how[1], /Дрейф/);
  assert.equal(lair.guide, 'prog-creatures');
  assert.match(boss.how[1], /Охота/);
  assert.match(boss.where[1], /«События»/);
  assert.equal(boss.guide, 'prog-hunts');
  assert.match(board.how[1], /каждый выигранный абордаж/);
  assert.ok(lair.sail && boss.sail && board.sail);
  assert.equal(challengeInfo('d_orders')!.sail, false);
  assert.equal(challengeInfo('nope'), null);
});

test('a challenge done says so in Russian (the server\'s toast carries the challenge\'s English words)', () => {
  setLang('ru');
  const pats = passPatterns();
  for (const c of CHALLENGES) assert.ok(pats.some(([en]) => en === c.text[0].replace('{n}', String(c.need))), c.id);
  const line = serverText(`Season challenge done: ${CHALLENGES.find((c) => c.id === 'd_board')!.text[0].replace('{n}', '4')} (+150 season XP).`);
  assert.equal(sp(line), 'Испытание сезона выполнено: Победите в 4 абордажах (+150 опыта сезона).');
  setLang('en');
});

test('the task card: the name, the bar, the rows, the book\'s link only for an article that exists, «not at sea» without a run', () => {
  setLang('ru');
  const html = taskCardHtml({ kind: 'trial', name: 'Победите в 3 боях с тварями', progress: { n: 1, need: 3 }, where: 'Логова', how: 'Как', reward: '+150', guide: 'prog-creatures', sail: () => {} });
  assert.match(html, /Победите в 3 боях с тварями/);
  assert.match(html, /1 \/ 3/);
  assert.match(html, /width:33%/);
  assert.match(html, /data-tkguide="prog-creatures"/);
  assert.match(html, /Бои с тварями/);
  assert.doesNotMatch(html, /tk-nosea/);
  const none = taskCardHtml({ kind: 'trial', name: 'X', guide: 'no-such-article' });
  assert.doesNotMatch(none, /data-tkguide/);
  assert.match(none, /tk-nosea/);
  const done = taskCardHtml({ kind: 'trial', name: 'X', progress: { n: 4, need: 4 }, done: true });
  assert.match(done, /✓ Выполнено!/);
  assert.doesNotMatch(done, /tk-nosea/);
  setLang('en');
});

test('a goal\'s card from the sheet\'s line: an order, a contract, a quest — each with how its kind works and «Плыть»', () => {
  setLang('ru');
  const v = goalSheetView({
    quests: [{ id: 'job_a', name: 'Quest job_a', kind: 'job', step: 1, steps: 2, text: 'Sink pirates', progress: 1, need: 3 }],
    contracts: [{ id: 'c1', kind: 'delivery', title: 'Deliver rum', toPort: 'gravesend', good: 'rum', reward: 200, expiresAt: 500 }],
    daily: { orders: [{ kind: 'sink', need: 3, progress: 1, done: false, silver: 100 }], streak: 0, chest: false, chestSilver: 0 },
  });
  const sail = () => {};
  const d = goalCard(goalLineOf(v, 'd:sink')!, (x) => x, sail);
  assert.deepEqual(d.progress, { n: 1, need: 3 });
  assert.equal(sp(d.how), TK_RU['how.daily']);
  assert.equal(d.sail, sail);
  const c = goalCard(goalLineOf(v, 'c:c1')!, () => 'Грейвсенд', sail);
  assert.match(c.where!, /Грейвсенд/);
  assert.equal(sp(c.how), TK_RU['how.contract']);
  assert.match(c.reward!, /200/);
  const q = goalCard(goalLineOf(v, 'q:job_a')!, (x) => x, sail);
  assert.equal(sp(q.how), TK_RU['how.job']);
  assert.equal(sp(q.sub), 'Поручение · Шаг 1 из 2');
  assert.equal(goalLineOf(v, 'q:none'), null);
  setLang('en');
});

test('«События»: a tab of the chat; the lines kept forty and eight hours, the same words within a minute once; a place to sail to', () => {
  assert.ok(CHAT_TABS.includes('events'));
  assert.equal(CHAT_TABS[1], 'events', 'beside the world\'s');
  let list = keepEvents([], { text: 'a', at: 1000 }, 1000);
  list = keepEvents(list, { text: 'a', at: 30_000 }, 30_000);
  assert.equal(list.length, 1, 'the same words within a minute');
  list = keepEvents(list, { text: 'a', at: 70_000 }, 70_000);
  assert.equal(list.length, 2);
  for (let i = 0; i < 60; i++) list = keepEvents(list, { text: `e${i}`, at: 80_000 + i }, 80_000 + i);
  assert.equal(list.length, EVENTS_KEEP);
  assert.equal(keepEvents(list, null, 80_000 + EVENTS_MS + 100).length, 0, 'gone after eight hours');
  assert.ok(eventPlace({ text: '', at: 0, ev: { x: 1, y: 2 } }));
  assert.ok(eventPlace({ text: '', at: 0, ev: { goal: 'boss' } }));
  assert.ok(!eventPlace({ text: '', at: 0, ev: { x: 1 } }));
  assert.ok(!eventPlace({ text: '', at: 0 }));
});

test('the words: RU and EN alike, no Latin in the Russian', () => {
  for (const [en, ru] of [[TK_EN, TK_RU], [CH_EN, CH_RU]] as [Record<string, string>, Record<string, string>][]) {
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
    for (const [k, v] of Object.entries(ru)) if (k !== 'openKey') assert.ok(!latin(v), `${k}: ${v}`);
  }
});

test('the world\'s news never flashes over the sea: main.ts sends it to the chat\'s «События» and the events icon', () => {
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /m\.msg\.startsWith\('WORLD: '\) \|\| m\.ev\) \{\s*hud\.chatPanel\.event\(/);
  assert.doesNotMatch(main, /hud\.feed\(serverText\(m\.msg\)\)/);
  assert.match(main, /hud\.chatPanel\.onEvents = draw/);
});
