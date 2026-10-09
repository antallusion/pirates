// docs/23 (2026-10-09, batch-fight): the hex battle's order book and panel at 1500×600, and the sea fight's camera on a
// desk. Measured in the browser by tools/mobile/fight/book.mjs and cam.mjs; what holds them is held here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN, RU } from '../client/src/lang/ui/tactical.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the open book lies over the whole battle, not inside the field\'s box (its top row stood 8–9 px over it at 1500×600)', () => {
  const src = read('client/src/ui/tactical.ts');
  const stage = src.split('\n').find((l) => l.includes('<div class="tb-stage">'))!;
  assert.ok(stage, 'the field\'s markup');
  assert.ok(!stage.includes('tb-book'), 'no book inside the field');
  assert.match(src, /<div class="tb-pad"><\/div>\s*<div class="tb-book hidden"><\/div>\s*<\/div>`;/);
});

test('the painted book\'s pages end inside its parchment (73.5 % of the painting at the lowest)', () => {
  const css = read('client/styles.css');
  const m = css.match(/\.tb-book\.bk\.painted \{[^}]*--bk-t: (\d+(?:\.\d+)?)%; --bk-b: (\d+(?:\.\d+)?)%;/);
  assert.ok(m, 'the painted book\'s margins');
  assert.ok(100 - Number(m![2]) <= 73.5 - 1, `pages end at ${100 - Number(m![2])} %`);
  assert.ok(Number(m![1]) >= 11, 'below the parchment\'s top edge');
});

test('a page of the desk\'s panel stands one height every turn; its words take 2, 3 or 4 lines by the screen\'s height', () => {
  const css = read('client/styles.css');
  assert.match(css, /\.tb-root \.tb-spells \.tb-spell \{ box-sizing: border-box; height: calc\(16px \+ 1\.15 \* 14px \+ var\(--pg-lines\) \* 1\.15 \* 11px\); min-height: 0;/);
  assert.match(css, /\.tb-root \.tb-spells \.tb-spell small \{ -webkit-line-clamp: var\(--pg-lines\); line-clamp: var\(--pg-lines\); \}/);
  for (const [h, n] of [['521', 2], ['701', 3], ['861', 4]] as const) {
    assert.ok(new RegExp(`min-height: ${h}px\\) and \\(min-aspect-ratio: 7/5\\) \\{[^@]*--pg-lines: ${n};`).test(css), `${n} lines from ${h} px`);
  }
  // the height a page needs for its name and words never above the height it is given (skinned: 5 + 5 border, 2 + 2 padding)
  for (const n of [2, 3, 4]) assert.ok(14 + 1.15 * 14 + n * 1.15 * 11 <= 16 + 1.15 * 14 + n * 1.15 * 11);
  // 1500×600: the will, the two moves, four pages and the book's button in the field's 462 px
  const page = 16 + 1.15 * 14 + 2 * 1.15 * 11;
  assert.ok(24 + 6 * page + 49 + 7 * 5 <= 462, `${24 + 6 * page + 49 + 7 * 5}`);
});

test('an order\'s whole words: under the mouse, a key\'s focus or a finger held on a phone\'s card; no browser title over them', () => {
  const src = read('client/src/ui/tactical.ts');
  for (const k of ['private wordsHtml(', 'private showWords(', 'private hideWords(', 'private refreshWords(', "'pointerover'", "'focusin'", 'this.wordsHeld = true;', 'e.stopImmediatePropagation();']) assert.ok(src.includes(k), k);
  // the panel's pages and the book's carry no title with the words (the browser's slow tooltip lay over the popover)
  assert.ok(!src.includes('title="${esc(spText(sp.id))}"'));
  assert.ok(!src.includes('title="${esc(`${spName(sp.id)} — ${spText(sp.id)}`)}"'));
  assert.ok(!src.includes('title="${esc(moveText(me.path, kind === \'ult\'))}"'));
  assert.equal(EN['words.level'], 'level {n}');
  assert.equal(RU['words.level'], '{n}-й уровень');
  // over a phone's book (the kit's sheet), under nothing the battle shows
  const z = Number(read('client/styles.css').match(/\.tb-words \{ position: fixed; z-index: (\d+);/)![1]);
  const sheet = Number(read('client/src/ui/kit/kit.css').match(/--k-z-sheet: (\d+);/)![1]);
  assert.ok(z > sheet, `${z} > ${sheet}`);
});
