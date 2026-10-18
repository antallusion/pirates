// The website (tools/site/build.ts): built from the game's tables, every page there in both tongues, every picture of the
// site kit it names on disk, the typography's non-breaking spaces where the owner's brief asks for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS } from '../shared/src/data/army.ts';
import { typo } from '../tools/site/typo.ts';

const SITE = join(import.meta.dirname, '..', 'site');

test('every creature has its page in Russian and in English', () => {
  for (const id of Object.keys(UNITS)) {
    assert.ok(existsSync(join(SITE, 'creatures', `${id}.html`)), `ru ${id}`);
    assert.ok(existsSync(join(SITE, 'en', 'creatures', `${id}.html`)), `en ${id}`);
  }
});

test('every site picture and font a page or the stylesheet names is on disk', () => {
  const pages = ['index.html', 'creatures/index.html', 'captains/index.html', 'ships/index.html', 'creatures/crab.html'];
  const texts = [...pages.map((p) => readFileSync(join(SITE, p), 'utf8')), readFileSync(join(SITE, 'css', 'site.css'), 'utf8'), readFileSync(join(SITE, 'css', 'fonts.css'), 'utf8')];
  const refs = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\/site\/((?:img|fonts|css|js)\/[\w./-]+?\.(?:webp|woff2|css|js))/g)) refs.add(m[1]);
  assert.ok(refs.size > 30);
  for (const r of refs) assert.ok(existsSync(join(SITE, r)), r);
});

test('the Russian pages carry the creature names of the game, the English ones theirs', () => {
  const html = readFileSync(join(SITE, 'creatures', 'index.html'), 'utf8');
  assert.match(html, /Береговые крабы/);
  assert.match(html, /lang="ru"/);
  const en = readFileSync(join(SITE, 'en', 'creatures', 'index.html'), 'utf8');
  assert.match(en, /Shore crabs/);
});

test('typography: no lone last word, no dash starting a line, short words held to the next', () => {
  const t = typo('Корабль — это армия и капитан у штурвала в бурю', 'ru');
  assert.ok(t.includes(' —'), 'a dash is held to the word before it');
  assert.ok(/в бурю$/.test(t), 'the last words are held together');
  assert.ok(t.includes('и капитан'), 'a short word is held to the next');
});

test('the site kit is there', () => {
  assert.ok(readdirSync(join(SITE, 'img', 'ico')).length >= 40);
  assert.ok(existsSync(join(SITE, 'img', 'brand', 'logo.webp')));
});
