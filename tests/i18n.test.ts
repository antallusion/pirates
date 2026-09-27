import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN } from '../client/src/lang/en.ts';
import { RU } from '../client/src/lang/ru.ts';
import { lang, plural, setLang, t } from '../client/src/i18n.ts';

test('localization: every English key has a Russian twin with the same placeholders', () => {
  for (const k of Object.keys(EN) as (keyof typeof EN)[]) {
    assert.ok(RU[k], `ru: ${k}`);
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(ph(RU[k]), ph(EN[k]), `placeholders of ${k}`);
  }
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort(), 'no stray Russian keys');
});

test('t() fills placeholders in the chosen language; Russian plurals', () => {
  setLang('en');
  assert.equal(lang(), 'en');
  assert.equal(t('goals.met', { name: 'X' }), 'Goal met: X');
  setLang('ru');
  assert.equal(t('goals.met', { name: 'X' }), 'Цель достигнута: X');
  assert.equal(plural(1, 'корабль', 'корабля', 'кораблей'), 'корабль');
  assert.equal(plural(3, 'корабль', 'корабля', 'кораблей'), 'корабля');
  assert.equal(plural(11, 'корабль', 'корабля', 'кораблей'), 'кораблей');
  assert.equal(plural(22, 'корабль', 'корабля', 'кораблей'), 'корабля');
  setLang('en');
  assert.equal(plural(1, 'ship', 'ships', 'ships'), 'ship');
});

test('generated island names read in Russian; unknown names stay as they are', async () => {
  const { composedNameRu } = await import('../client/src/lang/names.ts');
  assert.equal(composedNameRu('Ironreach'), 'Айронрич');
  assert.equal(composedNameRu('Widowstead Isle'), 'Видоустед-Айл');
  assert.equal(composedNameRu('Cinderforge 12'), 'Синдерфордж 12');
  assert.equal(composedNameRu("The Widow's Eye"), 'Вдовий Глаз');
  assert.equal(composedNameRu('Gravesend'), null);
  assert.equal(composedNameRu('Sold 5 rum.'), null);
});

test('names the server lowers inside a sentence come out in Russian; boss phases too', async () => {
  const { serverText } = await import('../client/src/lang/server.ts');
  const { applyDataLocale } = await import('../client/src/lang/data.ts');
  setLang('ru');
  applyDataLocale('ru');
  const out = serverText('Port Gravesend is short of provisions. Buy it anywhere — the buyer pays on delivery, on top of market price.');
  assert.ok(!/provisions/.test(out), out);
  assert.equal(serverText('Eight Arms'), 'Восемь щупалец');
  applyDataLocale('en');
  setLang('en');
});

test('dates the server writes in English read in Russian', async () => {
  const { serverText } = await import('../client/src/lang/server.ts');
  setLang('ru');
  assert.match(serverText('Coldholm Isle is yours until 04 Oct 2026 00:36 UTC.'), /04 окт 2026/);
  setLang('en');
});
