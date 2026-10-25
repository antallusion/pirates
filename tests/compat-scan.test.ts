// The browsers' floor — iOS 15 / Safari 15.0 (prod 2026-10-25: «Invalid regular expression: invalid group specifier
// name» on iOS 15.8 and macOS Safari 16.3, the game did not start). Every file the browser may load is parsed and
// searched for what Safari 15 cannot parse or run (tools/compat-scan.ts); the scanner itself is checked on samples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clientFiles, hasLookbehind, pageScripts, ROOT, scanClient, scanSource } from '../tools/compat-scan.ts';

test('nothing the browser may load is below the floor (iOS 15 / Safari 15)', () => {
  const found = scanClient();
  assert.deepEqual(found.map((f) => `${f.file}:${f.line} ${f.what}`), []);
});

test('the scan reaches the whole client: the game, the forum, the kit, shared/ and the lazy chunks', () => {
  const files = clientFiles().map((f) => f.replace(/\\/g, '/'));
  for (const f of ['client/src/main.ts', 'client/src/forum/main.ts', 'client/src/ui/kit/demo.ts', 'client/src/i18n.ts', 'client/src/compat.ts',
    'shared/src/chat.ts', 'shared/src/forum/markdown.ts', 'shared/src/data/campaign/patterns.ts', 'shared/src/data/campaign/chapters.ts', 'client/src/lang/data.ru.ts'])
    assert.ok(files.some((x) => x.endsWith(f)), `${f} is scanned`);
  assert.ok(files.length > 300, `${files.length} modules`);
  assert.ok(pageScripts().length >= 3, 'the page\'s inline scripts are scanned');
});

test('the scanner finds lookbehinds (literal and in strings), flag v, static blocks, import attributes and unfilled new calls', () => {
  const what = (src: string) => scanSource('x.ts', src).map((f) => f.what.split(' (')[0]);
  assert.deepEqual(what('const a = /(?<=x)y/g;'), ['regex lookbehind']);
  assert.deepEqual(what('const a = /(?<![а-я])y/i;'), ['regex lookbehind']);
  assert.deepEqual(what("const a = new RegExp('(?<!a)b' + c);"), ['regex lookbehind in a string']);
  assert.deepEqual(what('const a = new RegExp(`${x}(?<=a)b`);'), ['regex lookbehind in a string']);
  assert.deepEqual(what('const a = /\\(?<=x/;'), [], 'an escaped bracket is no lookbehind');
  assert.deepEqual(what('const a = /(?<name>x)\\k<name>/;'), [], 'a named group is fine (Safari 11.1)');
  assert.deepEqual(what('const a = /[\\p{L}]/v;'), ['regex flag v']);
  assert.deepEqual(what("const a = new RegExp('x', 'gv');"), ['RegExp flag v']);
  assert.deepEqual(what('class A { static { init(); } }'), ['class static block']);
  assert.deepEqual(what("import d from './d.json' with { type: 'json' };"), ['import attributes']);
  assert.deepEqual(what('const b = a.toSorted();'), ['.toSorted()']);
  assert.deepEqual(what('const g = Object.groupBy(a, f);'), ['Object.groupBy()']);
  assert.deepEqual(what('requestIdleCallback(f);'), ['requestIdleCallback() bare']);
  assert.deepEqual(what('const c = new OffscreenCanvas(1, 1);'), ['OffscreenCanvas() bare']);
  assert.deepEqual(what('const x = a.at(-1); Object.hasOwn(o, k); structuredClone(v); a.findLast(f);'), [], 'filled by client/src/compat.ts');
  assert.deepEqual(what('// a comment about (?<=x) is no code\nconst a = 1;'), []);
  assert.equal(hasLookbehind('\\\\(?<=x)'), true, 'an escaped backslash before the bracket leaves it a group');
});

test('the old lookbehind regexes would be caught (the five that failed the start on iOS 15.8 / Safari 16.3)', () => {
  const old = [
    ".replace(/(?<=^|[\\s(«„\"])([вВкКсСуУоОиИаАяЯ]) /g, '$1 ')",
    "const RU_WORD = '(?<![а-яa-z])';",
    'const GRAVE_RU = /(?<![а-яё])(кров)/i;',
    'const INLINE = /(?<![\\p{L}\\p{N}*])\\*(?=\\S)(.+?)(?<=\\S)\\*/gu;',
    'for (const m of s.matchAll(/(?<![\\p{L}\\p{N}_@/])@x/gu)) {}',
  ];
  for (const src of old) assert.ok(scanSource('x.ts', src).length > 0, src);
});

test('every entry imports client/src/compat.ts first (before any other module runs)', () => {
  for (const e of ['client/src/main.ts', 'client/src/forum/main.ts', 'client/src/ui/kit/demo.ts']) {
    const first = readFileSync(join(ROOT, e), 'utf8').split('\n').find((l) => l.startsWith('import '));
    assert.match(first ?? '', /^import '(\.\.\/)*(\.\/)?compat\.ts';/, e);
  }
});
