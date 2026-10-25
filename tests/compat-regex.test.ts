// The regexes that lost their lookbehind (prod 2026-10-25: Safari before 16.4 — iOS 15.8, macOS Safari 16.3 — cannot parse
// `(?<=…)` / `(?<!…)`, and the game did not start there): each new form against the old one, kept here as the reference
// (Node parses lookbehinds), on hand-picked lines and on thousands of random ones built from the characters that matter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charBefore, execAfter, matchAllAfter } from '../shared/src/lookbehind.ts';
import { inlineMatches, mentionsOf, renderMd } from '../shared/src/forum/markdown.ts';
import { maskBadWords, ruCoarse, RU_BAD } from '../shared/src/chat.ts';
import { typeset } from '../client/src/i18n.ts';
import { cloneData } from '../client/src/compat.ts';

/** A seeded random (the same lines on every run). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
function lines(seed: number, parts: string[], n: number, maxLen = 14): string[] {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let s = '';
    const len = Math.floor(r() * maxLen);
    for (let j = 0; j < len; j++) s += parts[Math.floor(r() * parts.length)];
    out.push(s);
  }
  return out;
}
const shape = (ms: Iterable<RegExpMatchArray>) => [...ms].map((m) => [m.index, ...m]);

// ---------------------------------------------------------------- the old regexes (the reference)

const OLD_INLINE =
  /(`+)([^`\n]+?)\1|!\[([^\]\n]{0,200})\]\(\s*([^\s)]+)(?:\s+([^\s)]+))?\s*\)|\[([^\]\n]{1,300})\]\(\s*([^\s)]+)\s*\)|\*\*(?=\S)(.+?)\*\*|~~(?=\S)(.+?)~~|\|\|(?=\S)(.+?)\|\||(?<![\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])|(https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]])|(?<![\p{L}\p{N}_@/])@(?:\[([^\]\n]{3,20})\]|([\p{L}\p{N}_'-]{3,20}))/gu;
const OLD_MENTION = /(?<![\p{L}\p{N}_@/])@(?:\[([^\]\n]{3,20})\]|([\p{L}\p{N}_'-]{3,20}))/gu;
const OLD_RU_BAD = new RegExp(`(?<![а-яa-z])${RU_BAD.source}`, 'g');
const OLD_TYPESET_ONE = /(?<=^|[\s(«„"])([вВкКсСуУоОиИаАяЯ]) /g;
const OLD_GRAVE_RU = /(?<![а-яё])(кров(ь|и|ью|ав|ян|оточ)|череп(?!ах)|скелет|кост(ь|и|ей|ям|ями|ях|ян|ляв)|труп|мертвец)/i;
const NEW_GRAVE_RU = /(?:^|[^а-яё])(кров(ь|и|ью|ав|ян|оточ)|череп(?!ах)|скелет|кост(ь|и|ей|ям|ями|ях|ян|ляв)|труп|мертвец)/i;

/** The old inline() loop's matches: exec after exec on a fresh copy, as the renderer does. */
function oldInline(s: string): RegExpExecArray[] {
  const re = new RegExp(OLD_INLINE.source, OLD_INLINE.flags);
  const out: RegExpExecArray[] = [];
  for (let m = re.exec(s); m; m = re.exec(s)) out.push(m);
  return out;
}
/** The old typeset step on its own (the new one is the whole typeset(), so its neighbours run on both sides). */
const oldTypeset = (s: string) =>
  s
    .replace(/««([^«»]*)»»/g, '«$1»')
    .replace(/ ([—–/])/g, ' $1')
    .replace(OLD_TYPESET_ONE, '$1 ')
    .replace(/(\d) (?=(?:с|сек|мин|ч|м|км|т|уз\.|дн\.?|сут\.?|шт\.?|%)(?![А-Яа-яЁё]))/g, '$1 ');

// ---------------------------------------------------------------- the helper

test('charBefore: the character before an index, a whole surrogate pair under /u, "" at the start', () => {
  assert.equal(charBefore('abc', 0), '');
  assert.equal(charBefore('abc', 2), 'b');
  assert.equal(charBefore('a😀*', 3, true), '😀');
  assert.equal(charBefore('a😀*', 3, false), '\ude00');
});

test('execAfter / matchAllAfter: a refused match is retried one character on, like a failed lookbehind', () => {
  const re = /ab/g;
  assert.deepEqual(matchAllAfter(re, 'xab ab', (b) => b !== 'x').map((m) => m.index), [4]);
  assert.equal(re.lastIndex, 0, 'the given regex is left untouched');
  const g = /a+/g;
  const m = execAfter(g, 'baa aa', (b) => b !== 'b');
  // «aa» after «b» refused; the engine would then try «a» at 2 (after an «a»: allowed) — exactly as (?<!b)a+ does
  assert.deepEqual([m?.index, m?.[0]], [2, 'a']);
  assert.deepEqual([...'baa aa'.matchAll(/(?<!b)a+/g)].map((x) => [x.index, x[0]]), [[2, 'a'], [4, 'aa']]);
});

// ---------------------------------------------------------------- the forum's Markdown

const MD_PARTS = ['*', '**', '_', '__', '@', '@[', ']', 'ab', 'Я', '1', ' ', ' ', '\n', '`', '~~', '||', '/', 'http://x.io', '(', ')', '![', '[', '](', '😀', '-', "'", 'é', '.', ' '];

test('forum Markdown: the inline marks match the old lookbehind regex exactly (hand-picked lines)', () => {
  const cases = [
    'a *b* c', 'a*b*c', '2*3*4', '**bold** *it*', '*a *', '* a*', '_a_', 'snake_case_name', 'x_y_ _z_', '@Name hi', 'mail@Name',
    '@@Name', '/@Name', '_@Name', '@[Two words]', 'a@[Two words]', '😀*x*', '😀_x_', '😀@Name', '***x***', '**x*', '*x**', '*😀*',
    'an *em* and _em_ and @Who, http://x.io/a. `*code*`', '*a* *b*', '_a__b_', 'ё*a*', '1@abc', '* a*',
  ];
  for (const s of cases) assert.deepEqual(shape(inlineMatches(s)), shape(oldInline(s)), JSON.stringify(s));
});

test('forum Markdown: the inline marks match the old lookbehind regex exactly (20 000 random lines)', () => {
  for (const s of lines(7, MD_PARTS, 20000)) assert.deepEqual(shape(inlineMatches(s)), shape(oldInline(s)), JSON.stringify(s));
});

test('forum Markdown: @mentions found as by the old lookbehind regex (hand-picked and 20 000 random lines)', () => {
  const old = (s: string) => {
    const out = new Set<string>();
    for (const m of s.matchAll(OLD_MENTION)) {
      out.add((m[1] ?? m[2]).replace(/ /g, ' ').trim());
      if (out.size >= 10) break;
    }
    return [...out];
  };
  for (const s of ['@Anna and @Boris', 'mail@host.com', '@abc-@def', '/@path', '@[Two words] @@x', 'a1@xyz _@xyz'])
    assert.deepEqual(mentionsOf(s), old(s), s);
  for (const s of lines(11, ['@', '@[', ']', 'ab', 'Я', '1', ' ', '_', '/', '-', "'", '😀', '\n'], 20000)) assert.deepEqual(mentionsOf(s), old(s), JSON.stringify(s));
});

test('forum Markdown: the rendered italics and mentions read as before', () => {
  const o = { lang: 'ru' as const, userBase: '/u/' };
  assert.match(renderMd('a *b* c', o), /<em>b<\/em>/);
  assert.doesNotMatch(renderMd('2*3*4', o), /<em>/);
  assert.doesNotMatch(renderMd('snake_case_name', o), /<em>/);
  assert.match(renderMd('x _y_ z', o), /<em>y<\/em>/);
  assert.match(renderMd('hi @Anna', o), /<a class="md-at" href="\/u\/@Anna">@Anna<\/a>/);
  assert.doesNotMatch(renderMd('mail@Anna', o), /md-at/);
});

// ---------------------------------------------------------------- the chat's coarse words

test('chat: the Russian coarse words are found as by the old lookbehind regex (hand-picked and 20 000 random lines)', () => {
  const old = (s: string) => [...s.matchAll(OLD_RU_BAD)];
  for (const s of ['сука', 'не сука', 'насука', 'бля бля', 'xбля', 'хуйня', 'страхуй', 'на хуй', 'ёбля', '1бля', 'пиздец', 'запизд'])
    assert.deepEqual(shape(ruCoarse(s)), shape(old(s)), s);
  const parts = ['хуй', 'хуя', 'бля', 'сука', 'суки', 'сук', 'пизд', 'еба', 'ёбу', 'ебл', 'на', 'за', 'по', 'у', 'а', 'я', 'x', 'q', 'ё', ' ', '1', '-', 'мудак', 'гандон', 'о'];
  for (const s of lines(3, parts, 20000)) assert.deepEqual(shape(ruCoarse(s)), shape(old(s)), JSON.stringify(s));
  assert.equal(maskBadWords('ты сука, а не судак'), 'ты с***, а не судак');
  assert.equal(maskBadWords('корабля и небо'), 'корабля и небо');
});

// ---------------------------------------------------------------- the Russian typesetting

test('typeset: a one-letter word is bound to the next as by the old lookbehind regex (hand-picked and 20 000 random lines)', () => {
  for (const s of ['в море и в порту', 'В порту (и в море)', '«в огне»', 'и к с', 'ов и', 'а', 'и и и и', '„с ним"', '"в доке"', '9 мин в пути', 'то — и это'])
    assert.equal(typeset(s), oldTypeset(s), s);
  const parts = ['в', 'В', 'к', 'с', 'и', 'я', 'а', 'о', 'у', ' ', ' ', '(', '«', '„', '"', 'x', 'мо', ' ', '\n', '—', '9', 'мин', '»'];
  for (const s of lines(5, parts, 20000)) assert.equal(typeset(s), oldTypeset(s), JSON.stringify(s));
});

// ---------------------------------------------------------------- the campaign's check for grave words

test('campaign check: the grave words found as by the old lookbehind regex (hand-picked and 20 000 random lines)', () => {
  for (const s of ['кровь', 'Кровь', 'малокровие', 'череп', 'черепах', 'костёр', 'кость', 'гость', 'трупы', ' мертвец'])
    assert.equal(NEW_GRAVE_RU.test(s), OLD_GRAVE_RU.test(s), s);
  const parts = ['кровь', 'кров', 'череп', 'ах', 'кость', 'кост', 'труп', 'мертвец', 'а', 'Я', 'ё', ' ', '1', 'x', '-'];
  for (const s of lines(9, parts, 20000)) assert.equal(NEW_GRAVE_RU.test(s), OLD_GRAVE_RU.test(s), JSON.stringify(s));
});

test('campaign check uses the lookbehind-free GRAVE_RU', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../shared/src/data/campaign/check.ts', import.meta.url), 'utf8');
  assert.ok(src.includes(`const GRAVE_RU = ${NEW_GRAVE_RU}`), 'the tested regex is the one in check.ts');
});

// ---------------------------------------------------------------- the polyfills (client/src/compat.ts)

test('compat: structuredClone stand-in copies plain data deeply (objects, arrays, Map, Set, Date, cycles)', () => {
  const src: Record<string, unknown> = { a: 1, b: [1, { c: 'x' }], m: new Map([['k', { v: 2 }]]), s: new Set([1, 2]), d: new Date(5), u: new Uint8Array([1, 2]) };
  src.self = src;
  const c = cloneData(src);
  assert.notEqual(c, src);
  assert.deepEqual((c.b as unknown[])[1], { c: 'x' });
  assert.notEqual((c.b as unknown[])[1], (src.b as unknown[])[1]);
  assert.deepEqual([...(c.m as Map<string, unknown>)], [['k', { v: 2 }]]);
  assert.deepEqual([...(c.s as Set<number>)], [1, 2]);
  assert.equal((c.d as Date).getTime(), 5);
  assert.deepEqual([...(c.u as Uint8Array)], [1, 2]);
  assert.equal(c.self, c);
  assert.deepEqual(cloneData({ keys: { up: ['w', 'ArrowUp'] } }), structuredClone({ keys: { up: ['w', 'ArrowUp'] } }));
});
