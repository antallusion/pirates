// The touch screen's action row (owner, 2026-10-18: «внизу кнопки есть при атаке на корабли там рисуется +1, +2, +3 это
// действия которые ты скрываешь, нельзя скрывать ничего они должны быть видны все действия сразу»): every thing to do
// is a button of its own — the gold one at the thumb's end, the rest small beside it with their words where one row
// holds them, else their pictures only in squares wrapping upward — and no «+N» badge anywhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actRowFit } from '../client/src/ui/seahud.ts';

test('the row’s shape: the words in one or two rows where they fit, else squares in as many rows as they need', () => {
  // 844×390 in a fight: ~330 px between the helm and the fight's buttons
  assert.deepEqual(actRowFit(130, [90, 90], 36, 6, 330), { mode: 'words', rows: 1 });
  assert.deepEqual(actRowFit(130, [110, 100], 36, 6, 330), { mode: 'words', rows: 2 }, 'the second pill above');
  assert.deepEqual(actRowFit(130, [110, 100, 120, 100], 36, 6, 330), { mode: 'icons', rows: 1 }, 'three rows of words: squares');
  assert.deepEqual(actRowFit(130, [], 36, 6, 100), { mode: 'words', rows: 1 }, 'the gold one alone, however narrow');
  // the worst case: a pirate pursued near a harbour and a lair with a stack, a find and the carpenters — twelve
  const many = Array.from({ length: 11 }, () => 100);
  const wide = actRowFit(130, many, 36, 6, 330);
  assert.deepEqual(wide, { mode: 'icons', rows: 2 }, '4 squares beside the gold one, 7 in the row above');
  const narrow = actRowFit(110, many, 36, 6, 170); // 480×270
  assert.deepEqual(narrow, { mode: 'icons', rows: 4 });
  // never fewer rows than the squares need, never a square left out
  for (const avail of [120, 170, 240, 330, 500]) for (let n = 0; n <= 14; n++) {
    const f = actRowFit(110, Array(n).fill(100), 36, 6, avail);
    const per = Math.floor((avail + 6 - 0.05) / 42), first = Math.floor((avail - 110 - 0.05) / 42);
    if (f.mode === 'icons') assert.ok(first + (f.rows - 1) * per >= n, `${avail} ${n} ${JSON.stringify(f)}`);
    else assert.ok(f.rows <= 2);
  }
});

test('the row in the page: every one of curActs, the small ones wrapping upward, no «+N» badge', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes('extra: curActs.slice(1).map('), 'every act after the gold one');
  assert.ok(!/more: Math\.max/.test(main));
  const hud = readFileSync(new URL('../client/src/ui/seahud.ts', import.meta.url), 'utf8');
  assert.ok(!hud.includes('tc-act-more') && !hud.includes('actMore'), 'no «+N» on the gold button');
  const css = readFileSync(new URL('../client/seahud.css', import.meta.url), 'utf8') + readFileSync(new URL('../client/styles.css', import.meta.url), 'utf8') + readFileSync(new URL('../client/fit.css', import.meta.url), 'utf8');
  assert.ok(!css.includes('tc-act-more'));
  assert.match(css, /body\.touch #touch > \.tc-actrow \{ display: flex; flex-direction: row-reverse; flex-wrap: wrap-reverse;/);
  assert.match(css, /body\.touch #touch > \.tc-actrow > \.k-btn \{ flex: none;/);
  assert.match(css, /\.tc-actrow\.tc-icons > \.tc-act2 \{ width: var\(--f-tap, 36px\); padding: 0;/);
  // (the small ones' words for the long press and the screen reader)
  assert.ok(hud.includes('data-hint="${esc(words)}"'));
});
