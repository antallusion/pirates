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
