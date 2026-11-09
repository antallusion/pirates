// The forum's pages for the search engines (server/src/forum/seo.ts; Search Console 2026-11-09: soft 404s and copies —
// every forum address came as the same empty shell with one canonical).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ForumStore } from '../server/src/forum/store.ts';
import { ForumService, NO_GAME } from '../server/src/forum/service.ts';
import { excerpt, forumSeoHtml, forumSeoPage, forumSitemap } from '../server/src/forum/seo.ts';

const svc = new ForumService({ store: new ForumStore(':memory:'), link: NO_GAME, now: () => Date.UTC(2026, 10, 9) });
const shell = readFileSync('site/forum/index.html', 'utf8');
const ORIGIN = 'https://gravetidegame.com';
const page = (rel: string, p = 1) => {
  const pg = forumSeoPage(svc, rel, 'ru', p);
  return { pg, html: forumSeoHtml(shell, pg, ORIGIN, 'ru') };
};

test('each forum address has its own title, canonical and text', () => {
  const home = page('');
  assert.match(home.html, /<link rel="canonical" href="https:\/\/gravetidegame\.com\/site\/forum\/">/);
  assert.match(home.html, /class="f-page f-ssr"><h2>/);
  const slug = svc.home(null, 'ru').categories[0].sections[0].slug;
  const sec = page(`s/${slug}`);
  assert.equal(sec.pg.status, 200);
  assert.match(sec.html, new RegExp(`<link rel="canonical" href="${ORIGIN}/site/forum/s/${slug}">`));
  assert.match(sec.html, /<meta name="robots" content="index, follow/);
  assert.notEqual(sec.pg.title, home.pg.title);
  const t = page('t/1');
  assert.match(t.html, /<link rel="canonical" href="https:\/\/gravetidegame\.com\/site\/forum\/t\/1">/);
  assert.match(t.html, /<link rel="alternate" hreflang="en" href="https:\/\/gravetidegame\.com\/site\/en\/forum\/t\/1">/);
  assert.match(t.html, /<article class="f-ssr-post"/);
  assert.ok(t.pg.desc.length > 20 && t.pg.desc.length <= 161, t.pg.desc);
  // the server's render counts no view
  assert.equal(svc.store.topic(1)!.views, 0);
});

test('a missing topic or section is a real 404, the lists are not indexed', () => {
  for (const rel of ['t/999999', 's/no-such-section']) {
    const x = page(rel);
    assert.equal(x.pg.status, 404);
    assert.match(x.html, /<meta name="robots" content="noindex, follow">/);
    assert.doesNotMatch(x.html, /rel="canonical"/);
  }
  const list = page('l/today');
  assert.equal(list.pg.status, 200);
  assert.match(list.html, /noindex, follow/);
});

test('the forum\'s sitemap: its front, the sections with topics and every open topic, in both languages', () => {
  const xml = forumSitemap(svc, ORIGIN);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset /);
  assert.match(xml, /<loc>https:\/\/gravetidegame\.com\/site\/forum\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/gravetidegame\.com\/site\/en\/forum\/t\/1<\/loc>/);
  assert.match(xml, /hreflang="en" href="https:\/\/gravetidegame\.com\/site\/en\/forum\/t\/1"/);
  const topics = svc.store.countTopics(false);
  assert.equal((xml.match(/<loc>[^<]*\/forum\/t\/\d+<\/loc>/g) ?? []).length, topics * 2);
  assert.doesNotMatch(xml, /\/(l|u|p|search)\//);
  assert.match(readFileSync('site/robots.txt', 'utf8'), /^Sitemap: https:\/\/gravetidegame\.com\/sitemap-forum\.xml$/m);
});

test('the excerpt: text without the inline tags\' gaps, cut at a word', () => {
  assert.equal(excerpt('<p>This is the <strong>forum</strong>: here.</p>'), 'This is the forum: here.');
  const long = excerpt(`<p>${'word '.repeat(60)}</p>`);
  assert.ok(long.endsWith('…') && long.length <= 161);
});
