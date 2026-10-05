// Fixes found in the full playthrough (level 1 to the endgame, in the browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict, fill, setLang } from '../client/src/i18n.ts';

test('playthrough: an abbreviation at a sentence\'s end keeps one dot («через 5 дн.», not «дн..»)', () => {
  assert.equal(fill('Next: {name}, in {left}.', { name: 'X', left: '5 дн.' }), 'Next: X, in 5 дн.');
  assert.equal(fill('in {left}.', { left: '3 h' }), 'in 3 h.');
  assert.equal(fill('{a}.{b}', { a: '1', b: '2' }), '1.2');
  assert.equal(fill('{a}', {}), '{a}');
  setLang('ru');
  const L = dict({ next: 'Next: {name}, in {left}.' }, { next: 'Следующий: {name}, через {left}.' });
  assert.ok(!L('next', { name: 'Пороховая ночь', left: '5 дн.' }).includes('..'));
  setLang('en');
});

test('playthrough: a phone on its side gives the harbour\'s page room (head in one band, no 118 px painted head)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8');
  const m = css.match(/@media \(max-height: 520px\) and \(min-width: 600px\) and \(orientation: landscape\) \{\n  #modal-panel\[data-modal="port"\] \.modal-head \{ min-height: 0; \}[\s\S]*?\n\}/);
  assert.ok(m, 'the landscape harbour head rule');
  assert.match(m[0], /\.port-head \{ grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(m[0], /\.ph-sail \{ flex: 0 0 auto;/);
  assert.match(css, /\.skinned \.icon-tabs \.tab\.active \.ico \{ filter: brightness/);
});
