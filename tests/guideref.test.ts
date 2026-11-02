// «Лоцманская книга» → «Справочник» (shared/src/data/guide/reference.ts, client/src/ui/guideref.ts) and its website
// mirror (tools/site/guide.ts): the reference covers every unit, ship class, item template, building and good; every
// entry's detail key resolves to a card; the filters and the search narrow it; the site's guide pages build in both
// tongues and their search index carries every article's title.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REF_KINDS, filterReference, referenceIndex, referenceKeys } from '../shared/src/data/guide/reference.ts';
import { GUIDE } from '../shared/src/data/guide/index.ts';
import { detailCard, DETAIL_KINDS } from '../shared/src/data/detail.ts';
import { UNITS } from '../shared/src/data/army.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { ITEM_BASES, LEGENDARY_ITEMS, SETS } from '../shared/src/data/items.ts';
import { ARTIFACTS, ART_SETS } from '../shared/src/data/artifacts.ts';
import { TOWN } from '../shared/src/data/town.ts';
import { PRODUCERS } from '../shared/src/data/base.ts';
import { BUILDINGS } from '../shared/src/data/holdings.ts';
import { GOOD_IDS } from '../shared/src/data/goods.ts';
import { LAND_RES_DEF } from '../shared/src/data/bestiary.ts';
import { guideSite, searchIndex, siteCard, slideImg } from '../tools/site/guide.ts';
import type { GuideDeps } from '../tools/site/guide.ts';

const SITE = join(import.meta.dirname, '..', 'site');
const keysOf = (kind: string) => new Set(referenceIndex('ru').entries.filter((e) => e.kind === kind).map((e) => e.detail));

test('the reference covers every unit, ship class, item template, building and good', () => {
  const has = (kind: string, keys: string[]) => {
    const got = keysOf(kind);
    for (const k of keys) assert.ok(got.has(k), `${kind}: ${k} is missing`);
  };
  has('creature', Object.keys(UNITS).map((u) => `unit:${u}`));
  has('ship', Object.keys(SHIP_CLASSES).map((c) => `hull:${c}`));
  has('item', [
    ...Object.keys(ITEM_BASES).map((b) => `base:${b}`), ...Object.keys(LEGENDARY_ITEMS).map((l) => `leg:${l}`), ...Object.keys(ARTIFACTS).map((a) => `art:${a}`),
    ...Object.keys(SETS).map((s) => `gset:${s}`), ...Object.keys(ART_SETS).map((s) => `aset:${s}`),
  ]);
  has('building', [...Object.keys(TOWN).map((t) => `town:${t}`), ...Object.keys(PRODUCERS).map((p) => `producer:${p}`), ...Object.keys(BUILDINGS).map((b) => `building:${b}`)]);
  has('good', [...GOOD_IDS.map((g) => `good:${g}`), ...Object.keys(LAND_RES_DEF).map((r) => `lres:${r}`)]);
  // nothing twice, nothing else
  const keys = referenceKeys();
  assert.equal(new Set(keys).size, keys.length, 'a key twice');
  assert.deepEqual(new Set(referenceIndex('en').entries.map((e) => e.kind)), new Set(REF_KINDS));
});

test('every detail key of the reference resolves to a card with a name in both tongues, a picture and something to read', () => {
  for (const key of referenceKeys()) {
    assert.ok((DETAIL_KINDS as readonly string[]).includes(key.split(':')[0]), `${key}: not a detail kind`);
    const c = detailCard(key);
    assert.ok(c, `${key}: no card`);
    assert.ok(c.name[0] && c.name[1], `${key}: no name`);
    assert.ok(c.art, `${key}: no picture`);
    assert.ok((c.rows?.length ?? 0) + (c.notes?.length ?? 0) > 0, `${key}: nothing to read`);
  }
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, unknown> };
  for (const e of referenceIndex('ru').entries) if (e.fig !== 'unit') assert.ok(manifest.assets[e.art!], `${e.detail}: ${e.art} is not in the manifest`);
});

test('an entry: its name in the tongue asked, its chip, facet values its facets know, the search words of both tongues', () => {
  const ru = referenceIndex('ru'), en = referenceIndex('en');
  assert.equal(ru.entries.length, en.entries.length);
  const m = ru.entries.find((e) => e.detail === 'unit:musketeer')!;
  assert.equal(m.name, detailCard('unit:musketeer')!.name[1]);
  assert.equal(en.entries.find((e) => e.detail === 'unit:musketeer')!.name, detailCard('unit:musketeer')!.name[0]);
  assert.ok(m.tags.includes('tier:3') && m.tags.includes('atk:ranged'));
  assert.equal(m.site, 'creatures/musketeer.html');
  assert.ok(m.search.includes('musketeer') && m.search.includes('мушкет'));
  for (const f of ru.facets) for (const v of f.values) assert.ok(v.name && v.n > 0, `${f.id}:${v.v}`);
  for (const e of ru.entries) {
    assert.ok(e.name && !/undefined|NaN/.test(`${e.name}${e.sub}${e.chip}`), e.detail);
    for (const t of e.tags) assert.match(t, /^[a-z]+:[\w-]+$/, `${e.detail}: ${t}`);
  }
  // the ships at sea's own pages: a playable hull leads to her card in the fleet
  assert.equal(ru.entries.find((e) => e.detail === 'hull:frigate')?.site, 'ships/#frigate');
});

test('the filters: a kind, facet values (OR within a facet, AND across) and the words', () => {
  const ix = referenceIndex('ru');
  const trade = filterReference(ix.entries, { kind: 'ship', sel: ['line:trade'] });
  assert.ok(trade.length > 5 && trade.every((e) => e.tags.includes('line:trade')));
  const two = filterReference(ix.entries, { kind: 'ship', sel: ['line:trade', 'line:fast'] });
  assert.ok(two.length > trade.length);
  const and = filterReference(ix.entries, { kind: 'ship', sel: ['line:trade', 'rank:1'] });
  assert.ok(and.length < trade.length && and.every((e) => e.tags.includes('rank:1')));
  // a value chosen on another kind's facet leaves this kind be
  assert.equal(filterReference(ix.entries, { kind: 'good', sel: ['line:trade'] }).length, ix.entries.filter((e) => e.kind === 'good').length);
  assert.ok(filterReference(ix.entries, { kind: 'creature', q: 'мушкетёр' }).some((e) => e.detail === 'unit:musketeer'), 'ё is е');
  assert.ok(filterReference(ix.entries, { q: 'timber' }).some((e) => e.detail === 'good:timber'));
  const stores = filterReference(ix.entries, { kind: 'good', sel: ['use:store'] });
  assert.ok(stores.length > 0 && stores.every((e) => e.tags.includes('cat:supply')));
  const tiers = filterReference(ix.entries, { kind: 'creature' }).map((e) => e.level);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b), 'by level');
});

test('the client view: tiles carry the detail attribute (the one card of the game), every word in both tongues', async () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'client', 'src', 'ui', 'guideref.ts'), 'utf8');
  assert.match(src, /export function renderReference\(/);
  assert.match(src, /detailAttr\(e\.detail\)/);
  assert.ok(existsSync(join(import.meta.dirname, '..', 'client', 'guideref.css')));
  const { EN, RU } = await import('../client/src/lang/ui/guideref.ts');
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const v of Object.values(RU)) assert.doesNotMatch(v, /[a-z]{3}/i, v);
});

// ------------------------------------------------------------------------------------------------ the website

const stub: GuideDeps = {
  page: (lang, o) => `<html lang="${lang}"><title>${o.title}</title><meta name="description" content="${o.desc}"><h1>${o.hero.title}</h1>${o.body}</html>`,
  sectionHead: (k, t) => `<h2>${t}</h2>`,
  asset: (id) => `/assets/${id}.webp`,
  K: (p) => `/site/img/${p}.webp`,
  esc: (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  T: (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
};

test('the site guide pages build: the index, every article, the five reference pages and the search index', () => {
  for (const lang of ['ru', 'en'] as const) {
    const files = new Map(guideSite(lang, stub));
    assert.ok(files.get('guide/index.html')?.includes('id="gq"'));
    for (const a of GUIDE) {
      const html = files.get(`guide/${a.id}.html`);
      assert.ok(html, `${lang} ${a.id}`);
      assert.ok(html.includes(lang === 'ru' ? a.title[1] : a.title[0]));
      assert.equal((html.match(/class="slide"/g) ?? []).length, a.slides.length, `${a.id}: every slide`);
    }
    const ix = referenceIndex(lang);
    for (const k of REF_KINDS) {
      const html = files.get(`guide/reference/${k}.html`)!;
      assert.ok(html, `${lang} ${k}`);
      assert.equal((html.match(/<li class="rt"/g) ?? []).length, ix.entries.filter((e) => e.kind === k).length, `${k}: every entry`);
      // the creatures and the playable hulls lead to their own pages; the rest carry their card
      if (k === 'creature') assert.ok(!html.includes('<template>') && html.includes('creatures/musketeer.html'));
      if (k === 'item') assert.ok((html.match(/<template>/g) ?? []).length === ix.entries.filter((e) => e.kind === 'item').length);
    }
  }
  assert.equal(slideImg('guide.sea_1'), '/assets/guide/sea_1.webp');
  assert.equal(slideImg('assets/ui/x.webp'), '/assets/ui/x.webp');
  assert.match(siteCard(detailCard('good:timber')!, 'ru', stub), /rc-name/);
});

test('the search index contains every article title and every reference entry, in each tongue', () => {
  for (const lang of ['ru', 'en'] as const) {
    const s = searchIndex(lang);
    const titles = new Set(s.a.map((a) => a.t));
    for (const a of GUIDE) assert.ok(titles.has(lang === 'ru' ? a.title[1] : a.title[0]), `${lang}: ${a.id}`);
    assert.equal(s.r.length, referenceIndex(lang).entries.length);
    // on disk too, as the build wrote it
    const file = join(SITE, ...(lang === 'en' ? ['en'] : []), 'guide', 'search.json');
    assert.ok(existsSync(file), file);
    const disk = JSON.parse(readFileSync(file, 'utf8')) as typeof s;
    const dt = new Set(disk.a.map((a) => a.t));
    for (const a of GUIDE) assert.ok(dt.has(lang === 'ru' ? a.title[1] : a.title[0]), `${lang} on disk: ${a.id}`);
  }
});

test('the built site: the guide in both tongues, in the nav, in the sitemap with its hreflang pair', () => {
  for (const p of ['guide/index.html', 'en/guide/index.html', ...GUIDE.map((a) => `guide/${a.id}.html`), ...REF_KINDS.map((k) => `guide/reference/${k}.html`), ...REF_KINDS.map((k) => `en/guide/reference/${k}.html`)]) assert.ok(existsSync(join(SITE, p)), p);
  const home = readFileSync(join(SITE, 'index.html'), 'utf8');
  assert.match(home, /href="\/site\/guide\/"[^>]*>.*Книга/);
  assert.match(readFileSync(join(SITE, 'en', 'index.html'), 'utf8'), /href="\/site\/en\/guide\/"[^>]*>.*Guide/);
  const g = readFileSync(join(SITE, 'guide', 'index.html'), 'utf8');
  assert.match(g, /<link rel="alternate" hreflang="en" href="https:\/\/gravetidegame\.com\/site\/en\/guide\/">/);
  assert.match(g, /<title>Лоцманская книга/);
  const sm = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
  assert.match(sm, /<loc>https:\/\/gravetidegame\.com\/site\/guide\/<\/loc>/);
  assert.match(sm, /<loc>https:\/\/gravetidegame\.com\/site\/en\/guide\/reference\/item\.html<\/loc>/);
  for (const r of ['css/guide.css', 'js/guide.js', 'img/ico/guides.webp']) assert.ok(existsSync(join(SITE, r)), r);
  // the fleet's cards answer the reference's links
  assert.match(readFileSync(join(SITE, 'ships', 'index.html'), 'utf8'), /id="frigate"/);
});
