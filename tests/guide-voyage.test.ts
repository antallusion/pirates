// «Лоцманская книга»: the sections sea (sea2.ts), combat, flags, travel and trade — ids unique, every picture on disk
// and light, RU and EN on every line, no Latin in the Russian but names and keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { ARTICLES as SEA2 } from '../shared/src/data/guide/sea2.ts';
import { ARTICLES as COMBAT } from '../shared/src/data/guide/combat.ts';
import { ARTICLES as FLAGS } from '../shared/src/data/guide/flags.ts';
import { ARTICLES as TRAVEL } from '../shared/src/data/guide/travel.ts';
import { ARTICLES as TRADE } from '../shared/src/data/guide/trade.ts';
import type { GuideArticle, GuideSection } from '../shared/src/data/guide/types.ts';

const BOOK: [GuideSection, GuideArticle[]][] = [['sea', SEA2], ['combat', COMBAT], ['flags', FLAGS], ['travel', TRAVEL], ['trade', TRADE]];
const ALL = BOOK.flatMap(([, a]) => a);
const WINDOWS = /^(port(:[a-z]+)?|isle|hire|map|journal|settings(:[a-z]+)?|crew|shipyard|flag|pass|pvp|boarding|shop)$/;
// Keys and names a Russian line may carry in Latin letters: the keyboard's keys and the controls preset «Классика WASD».
const LATIN_OK = new Set(['W', 'A', 'S', 'D', 'Q', 'E', 'R', 'M', 'Shift', 'WASD']);
const latin = (s: string) => (s.match(/[A-Za-z]+/g) ?? []).filter((w) => !LATIN_OK.has(w));
const both = (p: [string, string], where: string) => {
  assert.ok(p[0].trim().length > 2, `${where}: EN empty`);
  assert.ok(p[1].trim().length > 2, `${where}: RU empty`);
  assert.deepEqual(latin(p[1]), [], `${where}: Latin in RU «${p[1]}»`);
  assert.ok(/[А-Яа-яЁё]/.test(p[1]), `${where}: RU has no Cyrillic`);
  assert.ok(!/[А-Яа-яЁё]/.test(p[0]), `${where}: Cyrillic in EN «${p[0]}»`);
};

test('guide (sea2, combat, flags, travel, trade): ids unique, sections right, 3–6 slides', () => {
  const seen = new Set<string>();
  for (const [sec, list] of BOOK) {
    assert.ok(list.length >= 5, `${sec}: few articles`);
    for (const a of list) {
      assert.ok(!seen.has(a.id), `duplicate id ${a.id}`);
      seen.add(a.id);
      assert.equal(a.section, sec, `${a.id}: section`);
      assert.match(a.id, /^[a-z0-9-]+$/);
      assert.ok(a.slides.length >= 2 && a.slides.length <= 6, `${a.id}: ${a.slides.length} slides`);
      assert.ok(a.tags.length >= 3, `${a.id}: tags`);
    }
  }
  for (const a of ALL) for (const r of a.related ?? []) assert.ok(seen.has(r) || !BOOK.some(([s]) => r.startsWith(`${s}-`)), `${a.id}: related ${r} unknown`);
});

test('guide (sea2, combat, flags, travel, trade): every line in RU and EN, no Latin in RU', () => {
  for (const a of ALL) {
    both(a.title, `${a.id} title`);
    both(a.summary, `${a.id} summary`);
    a.slides.forEach((s, i) => both(s.text, `${a.id} slide ${i + 1}`));
  }
});

test('guide (sea2, combat, flags, travel, trade): every slide has a real picture, light enough', () => {
  for (const a of ALL) a.slides.forEach((s, i) => {
    assert.ok(s.img, `${a.id} slide ${i + 1}: no picture`);
    const f = `assets/guide/${s.img}`;
    assert.ok(existsSync(f), `${f} missing`);
    assert.match(s.img!, /\.webp$/);
    assert.ok(statSync(f).size <= 60 * 1024, `${f}: ${statSync(f).size} bytes`);
  });
});

test('guide (sea2, combat, flags, travel, trade): windows and «show» point at known windows', () => {
  for (const a of ALL) {
    if (a.window) assert.match(a.window, WINDOWS, `${a.id}: window ${a.window}`);
    for (const s of a.slides) if (s.show) assert.match(s.show.open, WINDOWS, `${a.id}: show ${s.show.open}`);
    if (a.firstTime) assert.match(a.firstTime, /^[a-z-]+$/);
  }
});
