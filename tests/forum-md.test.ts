// The forum's Markdown (docs/32_FORUM.md §6): only the renderer's own tags and attributes reach the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foreignHosts, mentionsOf, plainText, quotesOf, renderMd, safeHref, safeMedia, youtubeId } from '../shared/src/forum/markdown.ts';

const o = { lang: 'ru' as const, userBase: '/site/forum/u/', postBase: '/site/forum/p/' };
const ALLOWED = new Set(['p', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'video', 'details', 'summary', 'h3', 'h4', 'hr', 'br', 'span', 'div', 'button', 'b']);

/** Every tag of the output is whitelisted, no attribute is an event handler, no URL is a script. */
function assertSafe(html: string, src: string): void {
  for (const m of html.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)) {
    assert.ok(ALLOWED.has(m[1].toLowerCase()), `tag <${m[1]}> from ${JSON.stringify(src)}`);
    assert.doesNotMatch(m[2], /\son\w+\s*=/i, `handler in ${m[0]}`);
    assert.doesNotMatch(m[2], /(?:href|src|poster)\s*=\s*"\s*(?:javascript|data|vbscript):/i, `script url in ${m[0]}`);
    assert.doesNotMatch(m[2], /(?:href|src|poster)\s*=\s*"\/\//, `protocol-relative in ${m[0]}`);
  }
  assert.doesNotMatch(html, /<script|<iframe|<style|<svg|<object|<embed|<form|<input/i);
}

const ATTACKS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[x](javascript:alert(1))',
  '[x](JaVaScRiPt:alert(1))',
  '[x](data:text/html,<script>alert(1)</script>)',
  '[x](//evil.com)',
  '[x](/\\evil.com)',
  '[x](https://ok.com" onmouseover="alert(1))',
  '![x](javascript:alert(1))',
  '![x](https://evil.com/a.png)',
  '![x](/api/forum/file/a.webp" onerror="alert(1))',
  '![x](/api/forum/file/../../etc/passwd.png)',
  '![v](/api/forum/file/v.mp4 javascript:alert(1))',
  '[quote=<b>x</b>#1]\nhi\n[/quote]',
  '[quote=" onmouseover="alert(1)#2]\nhi\n[/quote]',
  '[spoiler=<img src=x onerror=1>]x[/spoiler]',
  '`<script>`',
  '```\n</code></pre><script>alert(1)</script>\n```',
  '@[<script>x]',
  '**<i onclick=1>x</i>**',
  'https://www.youtube.com/watch?v=abc"onload=1',
  '<a href="javascript:alert(1)">x</a>',
  '[[x](javascript:1)](https://ok.com)',
  '> <script>alert(1)</script>',
  '- [x](vbscript:msgbox)',
  '![x](/assets/a.webp)\u0000<script>',
  'http://ok.com/"><script>alert(1)</script>',
];

test('markdown: nothing but the whitelist reaches the page', () => {
  for (const a of ATTACKS) assertSafe(renderMd(a, o), a);
  // and the escaped source is still readable as text
  assert.match(renderMd('<script>alert(1)</script>', o), /&lt;script&gt;/);
});

test('markdown: the marks it knows', () => {
  const h = renderMd('**жирный** *курсив* ~~нет~~ `код` ||тайна||', o);
  assert.match(h, /<strong>жирный<\/strong>/);
  assert.match(h, /<em>курсив<\/em>/);
  assert.match(h, /<del>нет<\/del>/);
  assert.match(h, /<code>код<\/code>/);
  assert.match(h, /class="md-sp"/);
  assert.match(renderMd('- раз\n- два', o), /<ul class="md-list"><li>раз<\/li><li>два<\/li><\/ul>/);
  assert.match(renderMd('1. раз\n2. два', o), /<ol/);
  assert.match(renderMd('[quote=Боб#12]\nтекст\n[/quote]', o), /<blockquote class="md-quote"><span class="md-quote-by"><a class="md-at" href="\/site\/forum\/u\/@%D0%91%D0%BE%D0%B1">Боб<\/a> писал: <a class="md-quote-to" href="\/site\/forum\/p\/12"/);
  assert.match(renderMd('[spoiler=Тайна]\nскрыто\n[/spoiler]', o), /<details class="md-spoiler"><summary>Тайна<\/summary>/);
  assert.match(renderMd('Привет @Флинт и @[Old Salt]', o), /href="\/site\/forum\/u\/@Old%20Salt">@Old Salt<\/a>/);
  assert.match(renderMd('[a](https://other.com/x)', o), /rel="nofollow ugc noopener noreferrer"/);
  assert.doesNotMatch(renderMd('[a](https://gravetidegame.com/x)', o), /nofollow/);
  assert.match(renderMd('![кот](/api/forum/file/abc.webp)', o), /<img class="md-img" src="\/api\/forum\/file\/abc.webp" alt="кот" loading="lazy"/);
  assert.match(renderMd('![клип](/api/forum/file/v.mp4 /api/forum/file/p.webp)', o), /<video controls preload="none" playsinline poster="\/api\/forum\/file\/p.webp" src="\/api\/forum\/file\/v.mp4"><\/video>/);
  assert.match(renderMd('https://youtu.be/dQw4w9WgXcQ', o), /data-yt="dQw4w9WgXcQ"/);
  assert.equal(renderMd('snake_case_name', o), '<p>snake_case_name</p>');
});

test('markdown: addresses, ids and the server scans', () => {
  assert.equal(safeHref('https://a.com/x?y=1'), 'https://a.com/x?y=1');
  assert.equal(safeHref('/site/forum/'), '/site/forum/');
  for (const bad of ['javascript:x', '//evil.com', '/\\evil.com', 'data:x', 'https://a.com/"x', ' https://a.com']) assert.equal(safeHref(bad), null, bad);
  assert.equal(safeMedia('/api/forum/file/0123.webp'), '/api/forum/file/0123.webp');
  for (const bad of ['https://x.com/a.png', '/api/forum/file/../a.png', '/etc/passwd', '/api/forum/file/a.html']) assert.equal(safeMedia(bad), null, bad);
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ'), null);
  assert.deepEqual(mentionsOf('@Боб и @[Old Salt] `@код` mail@host.com'), ['Боб', 'Old Salt']);
  assert.deepEqual(quotesOf('[quote=Боб#5]\nx\n[/quote][quote=Ann#7]y[/quote]'), [5, 7]);
  assert.deepEqual(foreignHosts('https://spam.com/x и https://gravetidegame.com/y'), ['spam.com']);
  assert.equal(plainText('**a** [b](https://c) ![d](/e.png)'), 'a b d');
});
