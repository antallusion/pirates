// The website's mirror of «Лоцманская книга» (2026-11-02): /site/guide/ and /site/en/guide/, written by build.ts.
//   guide/index.html               — the sections with their articles, a search box over guide/search.json, the
//                                    reference's five kinds;
//   guide/<article>.html           — an article: its slides as pictures with their captions, its neighbours, related;
//   guide/reference/<kind>.html    — the reference from the game's tables (shared/src/data/guide/reference.ts) with its
//                                    filters: a creature leads to its bestiary page, a ship to her card in the fleet, the
//                                    rest open their detail card (shared/src/data/detail.ts) in a dialog;
//   guide/search.json              — the client-side search's index: every article and every reference entry.
// The articles come from shared/src/data/guide/index.ts (GUIDE); the pictures from assets/guide/*.webp (/assets/guide/…).

import { GUIDE, GUIDE_SECTIONS } from '../../shared/src/data/guide/index.ts';
import type { GuideArticle, GuideSection, GuideSlide } from '../../shared/src/data/guide/index.ts';
import { REF_KINDS, referenceIndex } from '../../shared/src/data/guide/reference.ts';
import type { RefEntry, RefKind } from '../../shared/src/data/guide/reference.ts';
import { detailCard } from '../../shared/src/data/detail.ts';
import type { DCard } from '../../shared/src/data/detail.ts';
import { UNITS } from '../../shared/src/data/army.ts';

type Lang = 'ru' | 'en';
type Tr = [string, string];
interface Hero { img: string; imgM?: string; kicker: string; title: string; lead?: string; mini?: boolean }

/** What build.ts lends: its page frame and helpers. */
export interface GuideDeps {
  page(lang: Lang, o: { path: string; active: string; title: string; desc: string; hero: Hero; body: string; css?: string; script?: string }): string;
  sectionHead(kicker: string, title: string, lang: Lang, lead?: string): string;
  /** An asset id → its /assets/… address (the manifest), or null. */
  asset(id: string): string | null;
  /** The site kit's picture: 'ico/x' → /site/img/ico/x.webp. */
  K(p: string): string;
  esc(s: string): string;
  /** Escaped and typeset. */
  T(s: string, lang: Lang): string;
}

const L = (lang: Lang, t: Tr): string => (lang === 'ru' ? t[1] : t[0]);
const root = (lang: Lang) => (lang === 'ru' ? '/site/' : '/site/en/');

export const SECTION_NAMES: Record<GuideSection, Tr> = {
  sea: ['Sea and sailing', 'Море и плавание'], combat: ['Battle', 'Бой'], flags: ['Flags and the law', 'Флаги и закон'], trade: ['Trade', 'Торговля'],
  island: ['The island', 'Остров'], army: ['The army', 'Армия'], explore: ['Exploring', 'Исследования'], travel: ['Travel', 'Путешествия'],
  progress: ['Growing stronger', 'Развитие'], faq: ['Questions and answers', 'Вопросы и ответы'],
};
const SECTION_ICON: Record<GuideSection, string> = {
  sea: 'ico/compass', combat: 'ico/cannon', flags: 'ico/official', trade: 'ico/trade', island: 'ico/island', army: 'ico/cutlasses',
  explore: 'ico/spyglass', travel: 'ico/world', progress: 'ico/achievements', faq: 'ico/quest',
};
const KIND_ICON: Record<RefKind, string> = { creature: 'ico/creatures', ship: 'ico/ships', item: 'ico/chest', building: 'ico/island', good: 'ico/trade' };
const KIND_LEAD: Record<RefKind, Tr> = {
  creature: ['Every creature of the game: tier, group, shooters and fighters, the upgraded kinds.', 'Все существа игры: уровень, группа, стрелки и бойцы, улучшенные виды.'],
  ship: ['Every hull: traders, warships, fast ships, haulers and the sea’s beasts; rank, ship level, hold.', 'Все корпуса: торговые, боевые, быстрые, грузовозы и чудища моря; ранг, уровень, трюм.'],
  item: ['Gear for the ship and the captain, legendaries, artifacts and sets: slot, rarity, level.', 'Снаряжение корабля и капитана, легендарные вещи, артефакты и комплекты: слот, редкость, уровень.'],
  building: ['The island town, its producers and holdings: what each does and how far it grows.', 'Город острова, промыслы и владения: что делает каждая постройка и до какого уровня растёт.'],
  good: ['Trade goods, the ship’s stores and the land’s resources: category, room in the hold, price.', 'Товары, судовые припасы и ресурсы суши: категория, место в трюме, цена.'],
};

const W: Record<string, Tr> = {
  guide: ['Encyclopedia', 'Энциклопедия'], book: ['The Pilot’s Book', 'Лоцманская книга'], ref: ['Reference', 'Справочник'],
  kicker: ['The game’s encyclopedia', 'Энциклопедия игры'],
  lead: ['How the sea works: sailing, battle, trade, the island and the army — step by step, with pictures. And the reference of every creature, ship, item, building and good.', 'Как устроено море: плавание, бой, торговля, остров и армия — по шагам и с картинками. И справочник всех существ, кораблей, предметов, построек и товаров.'],
  search: ['Search the book and the reference…', 'Поиск по книге и справочнику…'], searchRef: ['Search by name…', 'Поиск по названию…'],
  none: ['Nothing found', 'Ничего не нашлось'], soon: ['The articles are being written: they appear here as the book fills.', 'Статьи пишутся: они появятся здесь по мере того, как книга наполняется.'],
  articles: ['articles', 'статей'], related: ['See also', 'Смотрите также'], back: ['← The book', '← Книга'], prev: ['← Before', '← Назад'], next: ['Next →', 'Дальше →'],
  play: ['Try it in the game', 'Попробовать в игре'], step: ['Step', 'Шаг'], all: ['All', 'Все'], reset: ['Reset', 'Сброс'], close: ['Close', 'Закрыть'],
  refTitle: ['Reference', 'Справочник'], refLead: ['Read from the game’s own tables: it never falls behind the game.', 'Собран из таблиц самой игры, поэтому никогда от неё не отстаёт.'],
  page: ['Its page', 'Страница'], open: ['Open the card', 'Открыть карточку'],
};
const w = (k: string, lang: Lang) => L(lang, W[k]);

// ------------------------------------------------------------------------------------------------ helpers

/** A slide's picture: 'guide.<file>' → /assets/guide/<file>.webp; a path as it is (rooted). */
export function slideImg(img: string | undefined): string | null {
  if (!img) return null;
  if (img.startsWith('guide.')) return `/assets/guide/${img.slice(6)}.webp`;
  if (/^https?:\/\//.test(img) || img.startsWith('/')) return img;
  if (!img.includes('/')) return `/assets/guide/${/\.\w+$/.test(img) ? img : img + '.webp'}`;
  return `/${img}`;
}
const articleUrl = (lang: Lang, id: string) => `${root(lang)}guide/${id}.html`;
const refUrl = (lang: Lang, k: RefKind) => `${root(lang)}guide/reference/${k}.html`;
/** A reference entry's address: its own site page where it has one, else its kind's page opened at it. */
export function entryUrl(lang: Lang, e: RefEntry): string {
  return e.site ? `${root(lang)}${e.site}` : `${refUrl(lang, e.kind)}?open=${encodeURIComponent(e.detail)}`;
}
/** «3 шага», «5 шагов», «1 step». */
const steps = (n: number, lang: Lang) => {
  if (lang === 'en') return `${n} ${n === 1 ? 'step' : 'steps'}`;
  const a = n % 100, b = n % 10;
  return `${n} ${a > 10 && a < 20 ? 'шагов' : b === 1 ? 'шаг' : b >= 2 && b <= 4 ? 'шага' : 'шагов'}`;
};
const articles = (s: GuideSection) => GUIDE.filter((a) => a.section === s);

// ------------------------------------------------------------------------------------------------ the detail card, static

/** A detail card (the game's, shared/src/data/detail.ts) as the website's markup: its picture, name, numbers and words. */
export function siteCard(c: DCard, lang: Lang, d: GuideDeps): string {
  const i = lang === 'ru' ? 1 : 0;
  let art = '';
  if (c.art) {
    const u = c.fig === 'unit' ? d.asset(`unit.${c.art}`) ?? d.asset((UNITS as Record<string, { art: string }>)[c.art]?.art ?? '') : d.asset(c.art);
    if (u) art = `<span class="rc-art rc-art-${c.fig ?? 'icon'}"><img src="${u}" alt="" loading="lazy" decoding="async"></span>`;
  }
  const rows = (c.rows ?? []).map((r) => {
    const ic = r.icon ? d.asset(r.icon) : null;
    return `<div class="rc-row${r.tone ? ` rc-${r.tone}` : ''}"><span class="rc-ri">${ic ? `<img src="${ic}" alt="" loading="lazy" width="18" height="18">` : ''}</span><span class="rc-k">${d.esc(r.k[i])}</span><b>${d.esc(r.v[i])}</b></div>`;
  }).join('');
  const notes = (c.notes ?? []).map((n) => `<p class="rc-n${n.tone ? ` rc-n-${n.tone}` : ''}">${d.T(n.t[i], lang)}</p>`).join('');
  return `<div class="rc-head">${art}<div><h3 class="rc-name" style="color:${d.esc(c.color ?? '#e8c872')}">${d.esc(c.name[i])}</h3>${c.sub ? `<p class="rc-sub">${d.esc(c.sub[i])}</p>` : ''}</div></div>`
    + `<div class="rc-body">${rows ? `<div class="rc-rows">${rows}</div>` : ''}${notes ? `<div class="rc-notes">${notes}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------------------------------------ pages

const HERO = 'hero/cabin';

function artCard(a: GuideArticle, lang: Lang, d: GuideDeps): string {
  const pic = slideImg(a.slides.find((s) => s.img)?.img);
  return `<a class="gcard" href="${articleUrl(lang, a.id)}">${pic ? `<span class="gcard-art"><img src="${pic}" alt="" loading="lazy" decoding="async"></span>` : ''}<span class="gcard-tx"><b>${d.T(L(lang, a.title), lang)}</b><span>${d.T(L(lang, a.summary), lang)}</span><i>${steps(a.slides.length, lang)}</i></span></a>`;
}

function indexPage(lang: Lang, d: GuideDeps): string {
  const ix = referenceIndex(lang);
  const secs = GUIDE_SECTIONS.filter((s) => articles(s).length);
  const toc = secs.length ? `<nav class="gtoc" aria-label="${w('book', lang)}">${secs.map((s) => `<a class="chip" href="#${s}"><img src="${d.K(SECTION_ICON[s])}" alt="" width="18" height="18">${d.esc(L(lang, SECTION_NAMES[s]))} <i>${articles(s).length}</i></a>`).join('')}</nav>` : '';
  const book = secs.length
    ? secs.map((s) => `<section class="gsec" id="${s}"><h2 class="gsec-h"><img src="${d.K(SECTION_ICON[s])}" alt="" width="34" height="34">${d.esc(L(lang, SECTION_NAMES[s]))}</h2><div class="ggrid">${articles(s).map((a) => artCard(a, lang, d)).join('')}</div></section>`).join('')
    : `<p class="empty">${d.T(w('soon', lang), lang)}</p>`;
  const kinds = `<div class="rkinds">${ix.kinds.map((k) => `<a class="rkind panel" href="${refUrl(lang, k.kind)}"><img src="${d.K(KIND_ICON[k.kind])}" alt="" width="44" height="44"><b>${d.esc(k.name)}</b><i>${k.n}</i><span>${d.T(L(lang, KIND_LEAD[k.kind]), lang)}</span></a>`).join('')}</div>`;
  const body = `<section class="wrap sec gsearch-sec"><label class="search gsearch"><img src="${d.K('ico/search')}" alt="" width="22" height="22"><input type="search" id="gq" placeholder="${w('search', lang)}" aria-label="${w('search', lang)}" autocomplete="off" data-index="${root(lang)}guide/search.json"></label>
<ul class="gresults" id="gres" hidden></ul><p class="empty" id="gnone" hidden>${w('none', lang)}</p>${toc}</section>
<section class="wrap sec gbook">${book}</section>
<section class="sec band"><div class="wrap">${d.sectionHead(w('ref', lang), w('refTitle', lang), lang, w('refLead', lang))}${kinds}</div></section>`;
  const n = GUIDE.length;
  return d.page(lang, {
    path: 'guide/', active: 'guide', title: lang === 'ru' ? 'Лоцманская книга — энциклопедия GRAVETIDE' : 'The Pilot’s Book — the GRAVETIDE encyclopedia',
    desc: lang === 'ru' ? `Энциклопедия игры GRAVETIDE: ${n ? `${n} статей о море, бое, торговле, острове и армии, ` : ''}справочник всех существ, кораблей, предметов, построек и товаров.` : `The GRAVETIDE encyclopedia: ${n ? `${n} articles on the sea, battle, trade, the island and the army, ` : ''}a reference of every creature, ship, item, building and good.`,
    hero: { img: d.K(HERO), kicker: w('kicker', lang), title: w('book', lang), lead: w('lead', lang), mini: true },
    body, css: '/site/css/guide.css', script: '/site/js/guide.js',
  });
}

function slideHtml(s: GuideSlide, n: number, lang: Lang, d: GuideDeps): string {
  const pic = slideImg(s.img);
  const cap = L(lang, s.text);
  return `<li class="slide"><figure>${pic ? `<span class="slide-art"><img src="${pic}" alt="${d.esc(cap)}" loading="${n > 1 ? 'lazy' : 'eager'}" decoding="async"></span>` : ''}<figcaption><span class="slide-n" aria-label="${w('step', lang)} ${n}">${n}</span><span>${d.T(cap, lang)}</span></figcaption></figure></li>`;
}

function articlePage(a: GuideArticle, lang: Lang, d: GuideDeps): string {
  const sib = articles(a.section);
  const at = sib.indexOf(a);
  const prev = sib[at - 1], next = sib[at + 1];
  const rel = (a.related ?? []).map((id) => GUIDE.find((x) => x.id === id)).filter((x): x is GuideArticle => !!x);
  const body = `<section class="wrap sec gart"><p class="kicker"><img src="${d.K(SECTION_ICON[a.section])}" alt="" width="18" height="18"><a href="${root(lang)}guide/#${a.section}">${d.esc(L(lang, SECTION_NAMES[a.section]))}</a></p>
<p class="lead">${d.T(L(lang, a.summary), lang)}</p>
<ol class="slides">${a.slides.map((s, i) => slideHtml(s, i + 1, lang, d)).join('')}</ol>
<p class="center"><a class="btn-gold" href="/play">${w('play', lang)}</a></p>
${rel.length ? `<h2 class="gsec-h">${w('related', lang)}</h2><div class="ggrid">${rel.map((x) => artCard(x, lang, d)).join('')}</div>` : ''}
<nav class="gpager">${prev ? `<a class="btn-oak sm" href="${articleUrl(lang, prev.id)}" rel="prev">${w('prev', lang)}<span class="gp-t">: ${d.esc(L(lang, prev.title))}</span></a>` : '<span></span>'}<a class="btn-oak sm" href="${root(lang)}guide/">${w('back', lang)}</a>${next ? `<a class="btn-oak sm" href="${articleUrl(lang, next.id)}" rel="next"><span class="gp-t">${d.esc(L(lang, next.title))}: </span>${w('next', lang)}</a>` : '<span></span>'}</nav></section>`;
  return d.page(lang, {
    path: `guide/${a.id}.html`, active: 'guide', title: `${L(lang, a.title)} — ${w('book', lang)} GRAVETIDE`, desc: L(lang, a.summary),
    hero: { img: d.K(HERO), kicker: `${w('book', lang)} · ${L(lang, SECTION_NAMES[a.section])}`, title: L(lang, a.title), mini: true },
    body, css: '/site/css/guide.css', script: '/site/js/guide.js',
  });
}

function tile(e: RefEntry, lang: Lang, d: GuideDeps): string {
  const c = detailCard(e.detail)!;
  const pic = c.art ? (c.fig === 'unit' ? d.asset(`unit.${c.art}`) ?? d.asset((UNITS as Record<string, { art: string }>)[c.art]?.art ?? '') : d.asset(c.art)) : null;
  const inner = `<span class="rt-art rt-art-${e.fig ?? 'icon'}">${pic ? `<img src="${pic}" alt="" loading="lazy" decoding="async">` : ''}</span><span class="rt-tx"><b>${d.esc(e.name)}</b><small>${d.esc(e.sub)}</small></span>${e.chip ? `<i class="rt-chip">${d.esc(e.chip)}</i>` : ''}`;
  const attrs = `data-t="${d.esc(e.tags.join(' '))}" data-s="${d.esc(e.search)}" data-d="${d.esc(e.detail)}" style="--c:${d.esc(e.color ?? '#e8c872')}"`;
  return e.site
    ? `<li class="rt" ${attrs}><a class="rt-in" href="${root(lang)}${e.site}">${inner}</a></li>`
    : `<li class="rt" ${attrs}><button type="button" class="rt-in" aria-haspopup="dialog" title="${w('open', lang)}">${inner}</button><template>${siteCard(c, lang, d)}</template></li>`;
}

function refPage(k: RefKind, lang: Lang, d: GuideDeps): string {
  const ix = referenceIndex(lang);
  const xs = ix.entries.filter((e) => e.kind === k).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const kind = ix.kinds.find((x) => x.kind === k)!;
  const kinds = `<nav class="filters rnav" aria-label="${w('ref', lang)}">${ix.kinds.map((x) => `<a class="chip${x.kind === k ? ' on' : ''}" href="${refUrl(lang, x.kind)}"${x.kind === k ? ' aria-current="page"' : ''}><img src="${d.K(KIND_ICON[x.kind])}" alt="" width="18" height="18">${d.esc(x.name)} <i>${x.n}</i></a>`).join('')}</nav>`;
  const facets = ix.facets.filter((f) => f.kind === k && f.values.length > 1).map((f) => `<div class="rfg" role="group" aria-label="${d.esc(f.name)}"><span class="rfn">${d.esc(f.name)}</span>${f.values.map((v) => `<button type="button" class="rf" data-f="${d.esc(`${f.id}:${v.v}`)}" aria-pressed="false">${d.esc(v.name)} <i>${v.n}</i></button>`).join('')}</div>`).join('');
  const body = `<section class="wrap sec rref">${kinds}
<div class="filters2"><label class="search"><img src="${d.K('ico/search')}" alt="" width="22" height="22"><input type="search" id="rq" placeholder="${w('searchRef', lang)}" aria-label="${w('searchRef', lang)}" autocomplete="off"></label><button type="button" class="chip" id="rreset">✕ ${w('reset', lang)}</button><span class="rcount" id="rcount" aria-live="polite">${xs.length}</span></div>
<div class="rfacets">${facets}</div>
<ul class="rgrid" id="rgrid">${xs.map((e) => tile(e, lang, d)).join('')}</ul><p class="empty" id="rnone" hidden>${w('none', lang)}</p></section>
<dialog class="rdlg" id="rdlg" aria-label="${w('open', lang)}"><button type="button" class="rdlg-x" data-close aria-label="${w('close', lang)}">✕</button><div class="rdlg-in"></div></dialog>`;
  return d.page(lang, {
    path: `guide/reference/${k}.html`, active: 'guide', title: `${kind.name} — ${w('ref', lang).toLowerCase()} GRAVETIDE`,
    desc: `${L(lang, KIND_LEAD[k])} ${lang === 'ru' ? `Всего: ${kind.n}.` : `${kind.n} in all.`}`,
    hero: { img: d.K(HERO), kicker: `${w('book', lang)} · ${w('ref', lang)}`, title: kind.name, lead: L(lang, KIND_LEAD[k]), mini: true },
    body, css: '/site/css/guide.css', script: '/site/js/guide.js',
  });
}

// ------------------------------------------------------------------------------------------------ the search index

export interface GuideSearchIndex {
  /** The articles: id, section's name, title, summary, the words to search (tags and the slides' text), address. */
  a: { id: string; sec: string; t: string; s: string; k: string; u: string }[];
  /** The reference: name, line under it, kind's name, the words to search, address. */
  r: { n: string; d: string; k: string; w: string; u: string }[];
}
export function searchIndex(lang: Lang): GuideSearchIndex {
  const ix = referenceIndex(lang);
  const other = referenceIndex(lang === 'ru' ? 'en' : 'ru');
  const kn = new Map(ix.kinds.map((k) => [k.kind, k.name]));
  const low = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
  return {
    a: GUIDE.map((a) => ({
      id: a.id, sec: L(lang, SECTION_NAMES[a.section]), t: L(lang, a.title), s: L(lang, a.summary),
      k: low([a.title[0], a.title[1], ...a.tags, L(lang, a.summary), ...a.slides.map((s) => L(lang, s.text))].join(' ')), u: articleUrl(lang, a.id),
    })),
    // the book's box finds a thing by its name in either tongue and its line; the reference's own page searches deeper
    r: ix.entries.map((e, j) => ({ n: e.name, d: e.sub, k: kn.get(e.kind)!, w: low(`${e.name} ${other.entries[j].name} ${e.sub} ${e.id.replace(/^[a-z]+:/, '').replace(/_/g, ' ')}`), u: entryUrl(lang, e) })),
  };
}

/** Every file of the guide in a tongue: [path under the tongue's root, contents]. */
export function guideSite(lang: Lang, d: GuideDeps): [string, string][] {
  const out: [string, string][] = [['guide/index.html', indexPage(lang, d)]];
  for (const a of GUIDE) out.push([`guide/${a.id}.html`, articlePage(a, lang, d)]);
  for (const k of REF_KINDS) out.push([`guide/reference/${k}.html`, refPage(k, lang, d)]);
  out.push(['guide/search.json', JSON.stringify(searchIndex(lang))]);
  return out;
}
