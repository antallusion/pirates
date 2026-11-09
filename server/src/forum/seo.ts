// The forum's pages as the search engines see them (Search Console 2026-11-09: the forum is one script page — every address
// came with the same empty shell, «Форум GRAVETIDE» and a canonical to the forum's front, so Google took its sections and
// topics for soft 404s and duplicates). The server now writes into the shell each page's own title, description,
// canonical and its text: the sections' list, a section's topics, a topic's posts. The script replaces it when it starts.
import { ForumError } from './service.ts';
import type { ForumService, Lang } from './service.ts';

export interface ForumSeoPage {
  status: number;
  title: string;
  desc: string;
  /** the page's own address (no host), for canonical, og:url and the hreflang pair */
  path: string;
  /** false: «noindex, follow» (lists, profiles, search, the writing pages) */
  index: boolean;
  h1: string;
  body: string;
}

const SITE = { ru: 'Форум GRAVETIDE', en: 'GRAVETIDE Forum' } as const;
const WORDS = {
  ru: { page: 'стр.', fresh: 'Свежие темы', topics: 'Темы раздела', replies: 'ответов', pages: 'Страницы', none: 'Страница не найдена', noneText: 'Такой темы или раздела нет — загляните в разделы форума.', home: 'Все разделы форума' },
  en: { page: 'page', fresh: 'Fresh topics', topics: 'Topics', replies: 'replies', pages: 'Pages', none: 'Page not found', noneText: 'There is no such topic or section — look through the forum\'s sections.', home: 'All forum sections' },
} as const;

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A description from a post's HTML: its text, one line, cut at a word near 160 letters. */
export function excerpt(html: string, max = 160): string {
  const text = html.replace(/<\/?(?:p|br|li|ul|ol|h\d|div|blockquote|pre|tr|td|th|figure|figcaption)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
}

function pager(base: string, pages: number, page: number, lang: Lang): string {
  if (pages <= 1) return '';
  const links: string[] = [];
  for (let i = 1; i <= pages; i++) links.push(i === page ? `<b>${i}</b>` : `<a href="${base}${i > 1 ? `?p=${i}` : ''}">${i}</a>`);
  return `<nav class="f-ssr-pages" aria-label="${WORDS[lang].pages}">${links.join(' ')}</nav>`;
}

/** The page at `rel` (the address after /site/forum/ or /site/en/forum/) and its `?p=`. */
export function forumSeoPage(forum: ForumService, rel: string, lang: Lang, pageArg: number): ForumSeoPage {
  const W = WORDS[lang];
  const site = SITE[lang];
  const base = lang === 'ru' ? '/site/forum/' : '/site/en/forum/';
  const [a, b, more] = rel.split('/').filter(Boolean);
  const page = Number.isFinite(pageArg) && pageArg >= 1 ? Math.floor(pageArg) : 1;
  try {
    if (!a) {
      const h = forum.home(null, lang);
      const cats = h.categories.map((c) => `<h2>${esc(c.title)}</h2><ul>${c.sections.filter((s) => !s.staffOnly || s.topics > 0).map((s) => `<li><a href="${base}s/${encodeURIComponent(s.slug)}">${esc(s.title)}</a>${s.desc ? ` — ${esc(s.desc)}` : ''}</li>`).join('')}</ul>`).join('');
      const fresh = h.fresh.map((t) => `<li><a href="${base}t/${t.id}">${esc(t.title)}</a></li>`).join('');
      return {
        status: 200, title: site, index: true, path: base, h1: site,
        desc: lang === 'ru' ? 'Форум капитанов GRAVETIDE: новости, гайды, обсуждения, торговля и ошибки.' : 'The GRAVETIDE captains\' forum: news, guides, talk, trade and bug reports.',
        body: `${cats}${fresh ? `<h2>${W.fresh}</h2><ul>${fresh}</ul>` : ''}`,
      };
    }
    if (a === 's' && b && !more) {
      const s = forum.section(null, b, page, lang);
      const p = s.page;
      const sb = `${base}s/${encodeURIComponent(s.section.slug)}`;
      const list = s.topics.map((t) => `<li><a href="${base}t/${t.id}">${esc(t.title)}</a> · ${t.replies} ${W.replies}</li>`).join('');
      return {
        status: 200, index: true, path: `${sb}${p > 1 ? `?p=${p}` : ''}`, h1: s.section.title,
        title: `${s.section.title}${p > 1 ? ` — ${W.page} ${p}` : ''} — ${site}`,
        desc: s.section.desc || `${s.section.title} — ${site}`,
        body: `${s.section.desc ? `<p>${esc(s.section.desc)}</p>` : ''}<h2>${W.topics}</h2><ul>${list}</ul>${pager(sb, s.pages, p, lang)}<p><a href="${base}">${W.home}</a></p>`,
      };
    }
    if (a === 't' && b && /^\d+$/.test(b) && !more) {
      const t = forum.topic(null, Number(b), page, lang, '');
      const p = t.page;
      const tb = `${base}t/${t.topic.id}`;
      const posts = t.posts.filter((x) => x.html).map((x) => `<article class="f-ssr-post" id="p${x.id}"><h3>${esc(x.author?.name ?? '?')}</h3>${x.html}</article>`).join('');
      const first = t.posts.find((x) => x.html)?.html ?? '';
      return {
        status: 200, index: true, path: `${tb}${p > 1 ? `?p=${p}` : ''}`, h1: t.topic.title,
        title: `${t.topic.title}${p > 1 ? ` — ${W.page} ${p}` : ''} — ${site}`,
        desc: excerpt(first) || `${t.topic.title} — ${t.section.title}`,
        body: `<p><a href="${base}s/${encodeURIComponent(t.section.slug)}">${esc(t.section.title)}</a></p>${posts}${pager(tb, t.pages, p, lang)}`,
      };
    }
  } catch (e) {
    if (!(e instanceof ForumError) || e.status !== 404) throw e;
    return { status: 404, title: `${W.none} — ${site}`, desc: W.noneText, path: base, index: false, h1: W.none, body: `<p>${W.noneText}</p><p><a href="${base}">${W.home}</a></p>` };
  }
  // the lists, the profiles, a post's address, the search and the writing pages: followed, not kept in the index
  return { status: 200, title: site, desc: site, path: base, index: false, h1: site, body: '' };
}

/** The forum's shell with the page written in: its head's title, description, canonical, og/twitter and hreflang pair,
 *  the robots line, the hero's heading and the text in #forum. */
export function forumSeoHtml(shell: string, pg: ForumSeoPage, origin: string, lang: Lang): string {
  const url = origin + pg.path;
  const other = lang === 'ru' ? pg.path.replace(/^\/site\/forum\//, '/site/en/forum/') : pg.path.replace(/^\/site\/en\/forum\//, '/site/forum/');
  const ru = origin + (lang === 'ru' ? pg.path : other);
  const en = origin + (lang === 'en' ? pg.path : other);
  const t = esc(pg.title);
  const d = esc(pg.desc);
  let h = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`)
    .replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${pg.index ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, pg.index ? `<link rel="canonical" href="${esc(url)}">` : '')
    .replace(/<link rel="alternate" hreflang="ru" href="[^"]*">/, `<link rel="alternate" hreflang="ru" href="${esc(ru)}">`)
    .replace(/<link rel="alternate" hreflang="en" href="[^"]*">/, `<link rel="alternate" hreflang="en" href="${esc(en)}">`)
    .replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, `<link rel="alternate" hreflang="x-default" href="${esc(ru)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${d}">`)
    // the language switch leads to the same page in the other language
    .replace(/(<a class="hdr-lang" href=")[^"]*(")/, `$1${esc(other)}$2`);
  if (pg.h1 !== SITE[lang]) h = h.replace(/(<div class="hero-in wrap">(?:<p class="kicker">[^<]*<\/p>)?<h1>)[^<]*(<\/h1>)/, `$1${esc(pg.h1)}$2`);
  if (pg.body) h = h.replace('<div id="forum" class="wrap f-root"></div>', `<div id="forum" class="wrap f-root"><div class="f-page f-ssr">${pg.body}</div></div>`);
  return h;
}
