// «Лоцманская книга»: the sections ISLAND, ARMY, EXPLORE, PROGRESS and FAQ (shared/src/data/guide/*.ts) — ids unique,
// every slide's shot on disk (assets/guide, ≤ 60 KB), both languages there, no Latin in the Russian but names and keys,
// the first-time triggers and the windows only those the engine knows (shared/src/data/guide/triggers.ts on its side).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import type { GuideArticle, GuideSection } from '../shared/src/data/guide/types.ts';
import { ARTICLES as ISLAND } from '../shared/src/data/guide/island.ts';
import { ARTICLES as ARMY } from '../shared/src/data/guide/army.ts';
import { ARTICLES as EXPLORE } from '../shared/src/data/guide/explore.ts';
import { ARTICLES as PROGRESS } from '../shared/src/data/guide/progress.ts';
import { ARTICLES as FAQ } from '../shared/src/data/guide/faq.ts';

const MINE: [GuideSection, GuideArticle[]][] = [['island', ISLAND], ['army', ARMY], ['explore', EXPLORE], ['progress', PROGRESS], ['faq', FAQ]];
const ALL = MINE.flatMap(([, a]) => a);

/** The engine's lists (shared/src/data/guide/triggers.ts, owned there; the merge brings the file itself). */
const TRIGGERS = ['first-sea', 'first-port', 'wreck-near', 'first-isle', 'struck-pirate', 'first-boarding', 'treasure-map', 'overload', 'skull', 'storm', 'lighthouse', 'fishing', 'dive', 'first-trade', 'first-hire', 'level-2', 'first-quest', 'season-pass'];
const WINDOWS = ['port', 'port:market', 'port:shipyard', 'port:tavern', 'port:quests', 'port:harbour', 'port:ferry', 'port:berths', 'port:flag', 'port:colours',
  'port:holdings', 'port:exchange', 'port:auction', 'port:dice', 'port:rumours', 'port:charts', 'port:army', 'port:pets',
  'isle', 'hire', 'shipyard', 'flag', 'crew', 'army', 'ship', 'map', 'journal', 'settings', 'settings:promo', 'pass', 'pvp',
  'hero', 'skills', 'book', 'gear', 'talents', 'company', 'throne', 'shop', 'research', 'tame', 'keys'];
/** Articles of the other sections a «related» may name (the engine's samples and the other helper's). */
const OTHERS = ['sea-sailing', 'sea-ports', 'sea-helm', 'sea-hold', 'sea-stores', 'combat-boarding', 'combat-hex', 'flags-three', 'flags-skulls', 'flags-patent', 'travel-ferry', 'trade-market', 'trade-volume', 'trade-warehouse'];
/** Latin allowed in Russian text: the game's name, a time zone, a key on the keyboard. */
const LATIN_OK = new Set(['GRAVETIDE', 'UTC']);

const shotPath = (img: string) => (img.includes('/') ? img : `assets/guide/${img}`);

test('guide (qa sections): each article in its own section, ids unique, 3–6 slides each', () => {
  const ids = new Set<string>();
  for (const [sec, list] of MINE) {
    assert.ok(list.length >= 3, `${sec}: too few articles`);
    for (const a of list) {
      assert.equal(a.section, sec, `${a.id}: section`);
      assert.ok(/^[a-z0-9-]+$/.test(a.id), `${a.id}: id`);
      assert.ok(!ids.has(a.id), `${a.id}: twice`);
      ids.add(a.id);
      assert.ok(a.slides.length >= 3 && a.slides.length <= 6, `${a.id}: ${a.slides.length} slides`);
      assert.ok(a.tags.length >= 3, `${a.id}: tags`);
    }
  }
});

test('guide (qa sections): every slide has its real shot on disk, at most 60 KB, none shared', () => {
  const seen = new Map<string, string>();
  for (const a of ALL) {
    for (const [i, s] of a.slides.entries()) {
      assert.ok(s.img, `${a.id} #${i + 1}: no shot`);
      const p = shotPath(s.img!);
      assert.ok(p.endsWith('.webp'), `${a.id} #${i + 1}: ${p} is not a webp`);
      assert.ok(existsSync(p), `${a.id} #${i + 1}: ${p} missing`);
      assert.ok(statSync(p).size <= 60 * 1024, `${p}: ${Math.round(statSync(p).size / 1024)} KB`);
      assert.ok(!seen.has(p), `${p}: used by ${seen.get(p)} and ${a.id}`);
      seen.set(p, a.id);
    }
  }
});

test('guide (qa sections): English and Russian both there; no Cyrillic in English, no Latin in Russian but names and keys', () => {
  const pairs = (a: GuideArticle): [string, [string, string]][] => [['title', a.title], ['summary', a.summary], ...a.slides.map((s, i) => [`slide ${i + 1}`, s.text] as [string, [string, string]])];
  for (const a of ALL) {
    for (const [what, [en, ru]] of pairs(a)) {
      assert.ok(en && en.trim().length > 2, `${a.id} ${what}: no English`);
      assert.ok(ru && ru.trim().length > 2, `${a.id} ${what}: no Russian`);
      assert.ok(!/[А-Яа-яЁё]/.test(en), `${a.id} ${what}: Cyrillic in English: ${en}`);
      assert.ok(/[А-Яа-яЁё]/.test(ru), `${a.id} ${what}: Russian without Russian`);
      const latin = (ru.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_OK.has(w));
      assert.deepEqual(latin, [], `${a.id} ${what}: Latin in Russian: ${latin.join(', ')}`);
    }
  }
});

test('guide (qa sections): triggers and windows are the engine\'s, each trigger in one article; related articles exist', () => {
  const ids = new Set([...ALL.map((a) => a.id), ...OTHERS]);
  const used = new Map<string, string>();
  for (const a of ALL) {
    if (a.firstTime) {
      assert.ok(TRIGGERS.includes(a.firstTime), `${a.id}: trigger ${a.firstTime}`);
      assert.ok(!used.has(a.firstTime), `${a.firstTime}: in ${used.get(a.firstTime)} and ${a.id}`);
      used.set(a.firstTime, a.id);
    }
    if (a.window) assert.ok(WINDOWS.includes(a.window), `${a.id}: window ${a.window}`);
    for (const s of a.slides) if (s.show) assert.ok(WINDOWS.includes(s.show.open), `${a.id}: show ${s.show.open}`);
    for (const r of a.related ?? []) assert.ok(ids.has(r), `${a.id}: related ${r}`);
  }
});
