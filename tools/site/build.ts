// The game's website (owner, 2026-10-18): «сайт для игры… со своей библиотекой существ, описаны фишки… максимально
// графичный, всё пиратское». Every page is written from the game's own tables, so the bestiary, the captains and the
// fleet never fall behind the game. RU at /site/, EN at /site/en/.
//
//   node --disable-warning=ExperimentalWarning tools/site/build.ts
//
// The art is the game's own (/assets/…) plus the site kit cut by tools/site/slice_kit.py (site/img/…).

import { metrikaTag } from '../../shared/src/metrika.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../../shared/src/data/army.ts';
import type { UnitDef } from '../../shared/src/data/army.ts';
import { BEAST_IDS, SEA_BEAST_IDS } from '../../shared/src/data/bestiary.ts';
import { FACTION_KIND_IDS, FACTION_NAMES } from '../../shared/src/data/factionunits.ts';
import { PREMIUM_BEAST_IDS, PREMIUM_NAMES } from '../../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_IDS, SHIP_BEAST_NAMES } from '../../shared/src/data/shipbeasts.ts';
import { BOSS_UNIT_IDS, BOSS_UNIT_NAMES } from '../../shared/src/data/bossunits.ts';
import { TITAN_IDS, TITAN_NAMES } from '../../shared/src/data/titans.ts';
import { LAIRS } from '../../shared/src/data/lairs.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { LEVEL_RANGE } from '../../shared/src/data/shiplevel.ts';
import { CAPTAINS, CAPTAIN_IDS } from '../../shared/src/data/captains.ts';
import { ORDER_IDS } from '../../shared/src/data/hero.ts';
import { ARTIFACT_IDS } from '../../shared/src/data/artifacts.ts';
import { FACTIONS } from '../../shared/src/data/factions.ts';
import { FRAMES, PLATES, TITLES, TRAILS } from '../../shared/src/data/cosmetics.ts';
import { WEB_ITEMS, WEB_SECS, WEB_TABS, WEB_TAB_NAMES } from '../../shared/src/data/webshop.ts';
import { SHOP } from '../../shared/src/data/shop.ts';
import { SPECIAL_ICON as WD_SPECIAL_ICON } from '../../shared/src/data/webdetail.ts';
import { fitStage } from '../../shared/src/data/framefit.ts';
import { avatarHtml, faceFit, ringFit } from '../../shared/src/data/portraitfit.ts';
import { DOC_IDS, DOC_TITLES, EDITION, LEGAL, REQUISITES, SELLER } from './legal.ts';
import type { DocId } from './legal.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../client/src/lang/ui/army.ts';
import { DATA_RU } from '../../client/src/lang/data.ts';
import { typo } from './typo.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'site');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, { local: string }> };

type Lang = import('./typo.ts').Lang;
type Tr = [string, string];
const L = (lang: Lang, t: Tr | string[]): string => (lang === 'ru' ? t[1] : t[0]) ?? t[0];

// ------------------------------------------------------------------------------------------------ typography

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = (s: string, lang: Lang) => esc(typo(s, lang));
/** A Russian count with its noun: 1 существо, 2 существа, 5 существ. */
const plural = (n: number, one: string, few: string, many: string) => { const a = n % 100, b = n % 10; return `${n} ${a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`; };
const NC = (n: number) => plural(n, 'существо', 'существа', 'существ');

// ------------------------------------------------------------------------------------------------ art

const asset = (id: string): string | null => (MANIFEST.assets[id] ? `/assets/${MANIFEST.assets[id].local}` : null);
const img = (src: string | null, alt: string, cls = '', lazy = true, extra = '') =>
  src ? `<img src="${src}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''}${lazy ? ' loading="lazy" decoding="async"' : ''}${extra}>` : '';
const K = (p: string) => `/site/img/${p}.webp`;

// ------------------------------------------------------------------------------------------------ creatures

type Group = 'crew' | 'land' | 'sea' | 'faction' | 'premium' | 'shipbeast' | 'boss' | 'titan';
const GROUPS: Record<Group, { name: Tr; icon: string; color: string }> = {
  crew: { name: ['Pirate crew', 'Пиратская команда'], icon: 'ico/boarding', color: '#d9b25f' },
  land: { name: ['Island creatures', 'Существа островов'], icon: 'ico/island', color: '#8fb36a' },
  sea: { name: ['Sea creatures', 'Морские существа'], icon: 'ico/creatures', color: '#5fb8c9' },
  faction: { name: ['Faction troops', 'Войска фракций'], icon: 'ico/official', color: '#c46a5a' },
  premium: { name: ['Legendary hires', 'Легендарный найм'], icon: 'ico/doubloon', color: '#f5c451' },
  shipbeast: { name: ['Ship companions', 'Спутники кораблей'], icon: 'ico/ships', color: '#9d8fd6' },
  boss: { name: ['Shore bosses', 'Боссы побережья'], icon: 'ico/hot', color: '#e0703f' },
  titan: { name: ['Titans of the Grail', 'Титаны Грааля'], icon: 'ico/achievements', color: '#e7d27a' },
};
const ROSTERS: Record<string, Tr> = {
  dutchman: ['The Flying Dutchman', 'Летучий голландец'],
};
const rosterName = (r: string): Tr => {
  const f = (FACTIONS as Record<string, { name: string }>)[r];
  if (f) return [f.name, DATA_RU[`factions.FACTIONS.${r}.name`] ?? f.name];
  return ROSTERS[r] ?? [r, r];
};

interface Creature {
  id: string; u: UnitDef; group: Group; roster?: string; name: Tr; note: Tr; figure: string | null; poses: string[]; lairs: Tr[];
}
const groupOf = (id: string): Group => {
  if ((TITAN_IDS as string[]).includes(id)) return 'titan';
  if ((BOSS_UNIT_IDS as string[]).includes(id)) return 'boss';
  if ((SHIP_BEAST_IDS as string[]).includes(id)) return 'shipbeast';
  if ((PREMIUM_BEAST_IDS as string[]).includes(id)) return 'premium';
  if ((FACTION_KIND_IDS as string[]).includes(id)) return 'faction';
  if ((SEA_BEAST_IDS as string[]).includes(id)) return 'sea';
  if ((BEAST_IDS as string[]).includes(id)) return 'land';
  return 'crew';
};
function names(id: string): { name: Tr; note: Tr } {
  const bt = (BOSS_UNIT_NAMES as Record<string, { name: Tr; note: Tr }>)[id] ?? (TITAN_NAMES as Record<string, { name: Tr; note: Tr }>)[id];
  if (bt) return bt;
  const four = (FACTION_NAMES as Record<string, string[]>)[id] ?? (PREMIUM_NAMES as Record<string, string[]>)[id] ?? (SHIP_BEAST_NAMES as Record<string, string[]>)[id];
  if (four) return { name: [four[0], four[1]], note: [four[2] ?? '', four[3] ?? ''] };
  const en = ARMY_EN as Record<string, string>, ru = ARMY_RU as Record<string, string>;
  return { name: [en[`u.${id}`] ?? id, ru[`u.${id}`] ?? en[`u.${id}`] ?? id], note: [en[`ud.${id}`] ?? '', ru[`ud.${id}`] ?? en[`ud.${id}`] ?? ''] };
}
const lairsOf = (id: string): Tr[] =>
  Object.values(LAIRS as Record<string, { name: Tr; mix: [string, number][] }>).filter((l) => l.mix?.some(([b]) => b === id)).map((l) => l.name);

const CREATURES: Creature[] = (Object.keys(UNITS) as string[]).map((id) => {
  const u = UNITS[id as keyof typeof UNITS] as UnitDef;
  const { name, note } = names(id);
  return {
    id, u, group: groupOf(id), roster: (u as { roster?: string }).roster, name, note,
    figure: asset(`unit.${id}`) ?? asset(u.art),
    poses: ['', '_b', '_atk', '_hit'].map((f) => asset(`unit.${id}${f}`)).filter((x): x is string => !!x),
    lairs: lairsOf(id),
  };
});
const BY_ID = new Map(CREATURES.map((c) => [c.id, c]));
/** A creature ability's picture: the shop's cards and the bestiary share one table (shared/src/data/webdetail.ts). */
const SPECIAL_ICON = WD_SPECIAL_ICON;
/** An ability's line with its icon in a brass frame. */
const abil = (ico: string | null, name: string, text: string, lang: Lang) =>
  `<li${ico ? ' class="ico"' : ''}>${ico ? `<span class="abil-ico"><img src="${ico}" alt="" loading="lazy" decoding="async" width="48" height="48"></span>` : ''}<span class="abil-tx"><b>${esc(name)}</b><span>${T(text, lang)}</span></span></li>`;
const specialName = (s: string): Tr => [(ARMY_EN as Record<string, string>)[`sp.${s}`] ?? s, (ARMY_RU as Record<string, string>)[`sp.${s}`] ?? s];
const specialNote = (s: string): Tr => [(ARMY_EN as Record<string, string>)[`spd.${s}`] ?? '', (ARMY_RU as Record<string, string>)[`spd.${s}`] ?? ''];

// ------------------------------------------------------------------------------------------------ the frame

const UI: Record<string, Tr> = {
  home: ['Home', 'Главная'], creatures: ['Bestiary', 'Бестиарий'], captains: ['Captains', 'Капитаны'], ships: ['Fleet', 'Флот'],
  forum: ['Forum', 'Форум'], play: ['Play', 'Играть'], playFree: ['Play free', 'Играть бесплатно'], tg: ['Play in Telegram', 'Играть в Telegram'],
  vk: ['Play with VK', 'Играть через VK'],
  all: ['All', 'Все'], search: ['Search by name…', 'Поиск по имени…'], tier: ['Tier', 'Уровень'],
  atk: ['Attack', 'Атака'], def: ['Defence', 'Защита'], dmg: ['Damage', 'Урон'], hp: ['Health', 'Здоровье'], speed: ['Speed', 'Скорость'],
  init: ['Initiative', 'Инициатива'], shots: ['Shots', 'Выстрелы'], cost: ['Cost', 'Цена'], abilities: ['Abilities', 'Способности'],
  found: ['Where to find', 'Где встречается'], upgrade: ['Upgrades into', 'Улучшается до'], from: ['Upgraded from', 'Улучшение из'],
  back: ['← Bestiary', '← Бестиарий'], poses: ['In battle', 'В бою'], none: ['Nothing found', 'Ничего не нашлось'],
  footer: ['A dark Pirate Gothic sea: a ship is an army, a captain is a hero, boarding is a battle.', 'Мрачное море Pirate Gothic: корабль — армия, капитан — герой, абордаж — битва.'],
  silver: ['silver', 'серебра'], doubloons: ['doubloons', 'дублонов'], guns: ['Guns a side', 'Пушек на борт'], hull: ['Hull', 'Корпус'],
  crew: ['Crew', 'Команда'], rank: ['Rank', 'Ранг'], premium: ['Premium', 'Премиум'],
  rating: ['Rating', 'Рейтинг'], shop: ['Shop', 'Магазин'],
};
const u = (k: string, lang: Lang) => L(lang, UI[k]);
const root = (lang: Lang) => (lang === 'ru' ? '/site/' : '/site/en/');

/** «Play with VK» (owner, 2026-10-25: «сделай кнопку играть через вк на сайте в дизайне других кнопок»): VK ID's web
 *  login opens the game signed in; inside VK's own webview site.js swaps the address for the Mini App (data-vk). */
const VK_START = '/auth/vkid/start';
/** VK's mark alone, one colour (currentColor): ivory-brass in the header's round button like Telegram's glyph, the
 *  plate's dark ink on the brass buttons (owner, 2026-10-25: «логотип вк вверху переделать в стиле игры»). */
const VK_MARK = '<svg class="vk-mark" viewBox="3.4 3.4 17.2 17.2" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.376 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/></svg>';
/** The brass «Play with VK» plate; `cls` the size (sm, lg) and any placement class. */
const vkBtn = (lang: Lang, cls = '') => `<a class="btn-gold${cls ? ` ${cls}` : ''}" href="${VK_START}" data-vk>${VK_MARK}<span>${u('vk', lang)}</span></a>`;

interface Hero { img: string; imgM?: string; kicker: string; title: string; lead?: string; cta?: boolean; tall?: boolean; mini?: boolean; film?: boolean }

/** The header's links in the order they stand, and the order they leave the bar for the burger's drawer when the row
 *  is short (priority+, site.js): the home first (the logo leads there too), the forum last; the current page never. */
const NAV = [['', 'home', 'ico/home', 1], ['creatures/', 'creatures', 'ico/creatures', 6], ['captains/', 'captains', 'ico/captains', 4], ['ships/', 'ships', 'ico/ships', 3], ['rating/', 'rating', 'ico/achievements', 2], ['shop/', 'shop', 'ico/doubloon', 5], ['forum/', 'forum', 'ico/forum', 7]] as const;
const TG_MARK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg>';

/** The header (owner, 2026-10-25): logo · the links (exactly one lit: this page) · the end — the forum's member button
 *  (client/src/forum/main.ts puts it first), the language, Telegram and VK as twin round brass-ringed buttons, «Play»
 *  and the burger. The burger's drawer holds the links the bar has no room for, and on phones all of them. */
function header(lang: Lang, active: string, path: string): string {
  const r = root(lang);
  const link = ([href, k, ic, pri]: (typeof NAV)[number], bar: boolean) =>
    `<a href="${r + href}"${bar ? ` data-pri="${pri}"` : ''}${active === k ? ' class="on" aria-current="page"' : ''}><img src="${K(ic)}" alt="" width="22" height="22">${u(k, lang)}</a>`;
  const other = lang === 'ru' ? `/site/en/${path}` : `/site/${path}`;
  return `<header class="hdr"><div class="hdr-pill">
<a class="hdr-logo" href="${r}" aria-label="GRAVETIDE"><img src="${K('brand/logo')}" alt="GRAVETIDE" width="120" height="96"></a>
<nav class="hdr-nav" id="nav" aria-label="${lang === 'ru' ? 'Разделы' : 'Sections'}">${NAV.map((x) => link(x, true)).join('')}</nav>
<div class="hdr-end"><a class="hdr-lang" href="${other}" hreflang="${lang === 'ru' ? 'en' : 'ru'}">${lang === 'ru' ? 'EN' : 'RU'}</a>
<a class="hdr-soc" href="https://t.me/gravetide_bot" target="_blank" rel="noopener" aria-label="Telegram" title="Telegram">${TG_MARK}</a>
<a class="hdr-soc hdr-vk" href="${VK_START}" data-vk aria-label="${u('vk', lang)}" title="${u('vk', lang)}">${VK_MARK}</a>
<a class="btn-gold sm hdr-play" href="/play">${u('play', lang)}</a>
<button class="hdr-burger" type="button" aria-label="${lang === 'ru' ? 'Меню' : 'Menu'}" aria-controls="hdr-drawer" aria-expanded="false"><span></span><span></span><span></span></button></div>
<div class="hdr-drawer" id="hdr-drawer"><nav aria-label="${lang === 'ru' ? 'Разделы' : 'Sections'}">${NAV.map((x) => link(x, false)).join('')}</nav>
<div class="hdr-drawer-play"><a class="btn-gold" href="/play">${u('play', lang)}</a>${vkBtn(lang)}</div></div>
</div></header>`;
}

/** The home page's trailer (tools/site/trailer.mjs → site/video/): its poster is the hero's picture (the first frame, the
 *  largest paint, preloaded), the film is laid over it by site.js, never for reduced motion, Save-Data or a slow line.
 *  An upright phone gets the middle of the frame cut tall; the cut-off is FILM_TALL. */
const FILM = '/site/video/trailer';
const FILM_TALL = '(max-aspect-ratio: 4/5)';
const filmPreload = () =>
  `<link rel="preload" as="image" type="image/avif" href="${FILM}-poster-v.avif" media="${FILM_TALL}" fetchpriority="high"><link rel="preload" as="image" type="image/avif" href="${FILM}-poster.avif" media="not all and ${FILM_TALL}" fetchpriority="high">`;
const filmArt = () =>
  `<div class="hero-art hero-film"><picture><source media="${FILM_TALL}" type="image/avif" srcset="${FILM}-poster-v.avif"><source media="${FILM_TALL}" srcset="${FILM}-poster-v.jpg"><source type="image/avif" srcset="${FILM}-poster.avif"><img src="${FILM}-poster.jpg" alt="" width="1280" height="720" fetchpriority="high"></picture>` +
  `<video class="hero-vid" data-film="${FILM}" data-tall="${FILM_TALL}" muted loop playsinline autoplay preload="metadata" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video></div>`;

function heroBlock(h: Hero, lang: Lang): string {
  return `<section class="hero${h.tall ? ' tall' : ''}${h.mini ? ' mini' : ''}">${h.film ? filmArt() : `<picture class="hero-art">${h.imgM ? `<source media="(max-width: 700px)" srcset="${h.imgM}">` : ''}<img src="${h.img}" alt="" fetchpriority="high"></picture>`}
<div class="hero-in wrap"><p class="kicker">${T(h.kicker, lang)}</p><h1>${T(h.title, lang)}</h1>${h.lead ? `<p class="lead">${T(h.lead, lang)}</p>` : ''}
${h.cta ? `<div class="hero-cta"><a class="btn-gold lg" href="/play">${u('playFree', lang)}</a>${vkBtn(lang, 'lg')}<a class="btn-oak" href="https://t.me/gravetide_bot" target="_blank" rel="noopener">${u('tg', lang)}</a></div>` : ''}</div></section>`;
}


// ------------------------------------------------------------------------------------------------ search engines

const ORIGIN = 'https://gravetidegame.com';
/** A page's public address: the Russian home is the domain's root, every other page lives under /site/. */
const pageUrl = (lang: Lang, path: string) => (lang === 'ru' && path === '' ? `${ORIGIN}/` : `${ORIGIN}${root(lang)}${path}`);
const SECTION: Record<string, Tr> = { creatures: ['Bestiary', 'Бестиарий'], captains: ['Captains', 'Капитаны'], ships: ['Fleet', 'Флот'], forum: ['Forum', 'Форум'], rating: ['Rating', 'Рейтинг'], shop: ['Shop', 'Магазин'], terms: ['Terms', 'Оферта'], refunds: ['Refunds', 'Возврат'] };

/** The head every page shares for the search engines and the social cards (owner, 2026-10-20: «настрой крутую сеошку»):
 *  canonical and hreflang pairs, Open Graph and Twitter cards, the webmasters' verification, schema.org JSON-LD. */
function seoHead(lang: Lang, o: { path: string; active: string; title: string; desc: string; hero: Hero }): string {
  const url = pageUrl(lang, o.path);
  const img = o.hero.img.startsWith('http') ? o.hero.img : `${ORIGIN}${o.hero.img}`;
  const desc = o.desc.length > 300 ? `${o.desc.slice(0, 297)}…` : o.desc;
  const crumbs: { name: string; item: string }[] = [{ name: 'GRAVETIDE', item: pageUrl(lang, '') }];
  const seg = o.path.split('/')[0];
  if (seg && SECTION[seg]) crumbs.push({ name: L(lang, SECTION[seg]), item: pageUrl(lang, `${seg}/`) });
  if (o.path.endsWith('.html')) crumbs.push({ name: o.hero.title, item: url });
  const ld: object[] = [];
  if (crumbs.length > 1) ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) });
  if (o.path === '') {
    ld.push({ '@context': 'https://schema.org', '@type': 'VideoGame', name: 'GRAVETIDE', url, image: img, description: desc, inLanguage: ['ru', 'en'], genre: ['MMORPG', 'Strategy', 'Pirates'], gamePlatform: ['Web browser', 'Telegram'], applicationCategory: 'Game', operatingSystem: 'Any', playMode: 'MultiPlayer', offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB', availability: 'https://schema.org/InStock', url: `${ORIGIN}/play` }, publisher: { '@type': 'Organization', name: 'GRAVETIDE', url: `${ORIGIN}/` } });
    ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'GRAVETIDE', url: `${ORIGIN}/`, inLanguage: lang });
    ld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: 'GRAVETIDE', url: `${ORIGIN}/`, logo: `${ORIGIN}${K('brand/icon')}`, sameAs: ['https://t.me/gravetide_bot'] });
  }
  const json = (x: object) => JSON.stringify(x).replace(/</g, '\u003c');
  return `<title>${esc(o.title)}</title><meta name="description" content="${esc(desc)}"><meta name="theme-color" content="#07090f">
<meta name="robots" content="index, follow, max-image-preview:large"><meta name="yandex-verification" content="e7ce6a5f6d15ce06">
<link rel="canonical" href="${url}"><link rel="alternate" hreflang="ru" href="${pageUrl('ru', o.path)}"><link rel="alternate" hreflang="en" href="${pageUrl('en', o.path)}"><link rel="alternate" hreflang="x-default" href="${pageUrl('ru', o.path)}">
<meta property="og:type" content="${o.path === '' ? 'website' : 'article'}"><meta property="og:site_name" content="GRAVETIDE"><meta property="og:locale" content="${lang === 'ru' ? 'ru_RU' : 'en_US'}"><meta property="og:locale:alternate" content="${lang === 'ru' ? 'en_US' : 'ru_RU'}">
<meta property="og:url" content="${url}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${img}"><meta property="og:image:alt" content="${esc(o.hero.title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
<link rel="icon" href="${K('brand/icon')}"><link rel="apple-touch-icon" href="${K('brand/icon')}">
${ld.map((x) => `<script type="application/ld+json">${json(x)}</script>`).join('')}`;
}

function page(lang: Lang, o: { path: string; active: string; title: string; desc: string; hero: Hero; body: string; css?: string; script?: string }): string {
  const r = root(lang);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${seoHead(lang, o)}
${metrikaTag({ webvisor: true })}
${o.hero.film ? filmPreload() : ''}<link rel="preload" href="/site/fonts/cormorantsc-700-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site/css/fonts.css"><link rel="stylesheet" href="/site/css/site.css">${o.css ? `<link rel="stylesheet" href="${o.css}">` : ''}</head>
<body class="pg-${o.active}">${header(lang, o.active, o.path)}
<main>${heroBlock(o.hero, lang)}${o.body}</main>
<footer class="ftr"><div class="wrap ftr-in"><img src="${K('brand/logo')}" alt="GRAVETIDE" width="110" height="88" loading="lazy">
<p>${T(u('footer', lang), lang)}</p><nav><a href="${r}creatures/">${u('creatures', lang)}</a><a href="${r}captains/">${u('captains', lang)}</a><a href="${r}ships/">${u('ships', lang)}</a><a href="${r}rating/">${u('rating', lang)}</a><a href="${r}shop/">${u('shop', lang)}</a><a href="${r}forum/">${u('forum', lang)}</a><a href="/play">${u('play', lang)}</a></nav>
<nav class="ftr-legal" aria-label="${lang === 'ru' ? 'Документы' : 'Documents'}">${DOC_IDS.map((d) => `<a href="${r}${d}/">${L(lang, DOC_TITLES[d])}</a>`).join('')}</nav>
<p class="ftr-req">${lang === 'ru' ? `${SELLER.name[1]} · ИНН&nbsp;${SELLER.inn} · ОГРНИП&nbsp;${SELLER.ogrnip}` : `${SELLER.name[0]} · INN&nbsp;${SELLER.inn} · OGRNIP&nbsp;${SELLER.ogrnip}`}<br><a href="mailto:${SELLER.info}">${SELLER.info}</a> · <a href="mailto:${SELLER.support}">${SELLER.support}</a></p>
<small>© GRAVETIDE · gravetidegame.com</small></div></footer>
<script src="/site/js/site.js" defer></script>${o.script ? `<script type="module" src="${o.script}"></script>` : ''}</body></html>`;
}

const sectionHead = (kicker: string, title: string, lang: Lang, lead = '') =>
  `<div class="sec-head reveal"><p class="kicker">${T(kicker, lang)}</p><h2>${T(title, lang)}</h2><img class="divider" src="${K('ui/div_anchor')}" alt="" width="360" height="40" loading="lazy">${lead ? `<p class="lead">${T(lead, lang)}</p>` : ''}</div>`;

// ------------------------------------------------------------------------------------------------ cards

function creatureCard(c: Creature, lang: Lang, href: string): string {
  const g = GROUPS[c.group];
  return `<a class="ccard reveal" href="${href}" style="--tint:${g.color}" data-group="${c.group}" data-tier="${c.u.tier}" data-name="${esc((c.name[0] + ' ' + c.name[1]).toLowerCase())}">
<span class="ccard-art">${img(c.figure, L(lang, c.name))}</span>
<span class="tier-coin" title="${u('tier', lang)} ${c.u.tier}">${c.u.tier}</span>
<span class="ccard-body"><span class="ccard-name">${esc(L(lang, c.name))}</span><span class="ccard-grp"><img src="${K(g.icon)}" alt="" width="16" height="16" loading="lazy">${esc(c.roster ? L(lang, rosterName(c.roster)) : L(lang, g.name))}</span>
<span class="ccard-stats"><span title="${u('atk', lang)}">⚔ ${c.u.atk}</span><span title="${u('def', lang)}">⛨ ${c.u.def}</span><span title="${u('hp', lang)}">❤ ${c.u.hp}</span></span></span></a>`;
}

const stat = (k: string, v: string | number, lang: Lang) => `<div class="stat"><span>${u(k, lang)}</span><b>${v}</b></div>`;

// ------------------------------------------------------------------------------------------------ pages

const FEATURES: { icon: string; art: string; title: Tr; text: Tr }[] = [
  { icon: 'ico/boarding', art: K('hero/battle'), title: ['Boarding is a battle on hexes', 'Абордаж — битва на гексах'], text: ['Grapple an enemy ship and the fight goes turn-based, like in Heroes of Might and Magic III: initiative, retaliation, morale and luck, shooters and fliers, the captain’s book of orders.', 'Сцепились бортами — и бой становится пошаговым, как в Heroes of Might and Magic III: инициатива, ответный удар, мораль и удача, стрелки и летуны, книга приказов капитана.'] },
  { icon: 'ico/creatures', art: K('hero/bestiary'), title: ['Over 270 creatures in the hold', 'Более 270 существ в трюме'], text: ['Your ship is your army. Hire pirates in the dwellings of your island, tame crabs and sea serpents in their lairs, buy legendary beasts and raise titans at the Grail.', 'Корабль — это армия. Нанимайте пиратов в жилищах острова, приручайте крабов и морских змеев в логовах, берите легендарных зверей и растите титанов у Грааля.'] },
  { icon: 'ico/captains', art: K('hero/home_m'), title: ['Six captains, six ways to win', 'Шесть капитанов — шесть путей к победе'], text: ['A captain is a hero: attack, defence, power and will, eight secondary skills, talents, artifacts and a school of orders of their own.', 'Капитан — это герой: атака, защита, сила приказов и воля, восемь вторичных навыков, таланты, артефакты и своя школа приказов.'] },
  { icon: 'ico/world', art: K('hero/sea'), title: ['A living sea in real time', 'Живое море в реальном времени'], text: ['Lairs and guards, roaming beasts and drifting wrecks, patrols and traders, storms and the Grail: the sea is an adventure map where everyone sails at once.', 'Логова и стражи, бродячие звери и дрейфующие обломки, патрули и торговцы, штормы и Грааль: море — карта приключений, по которой все плывут одновременно.'] },
  { icon: 'ico/cannon', art: K('hero/home'), title: ['Broadside against broadside', 'Борт против борта'], text: ['Naval fights are real-time: wind, sails and the turn of the hull, round, chain and grape shot. Every volley thins the enemy’s crew before the boarding.', 'Морской бой идёт в реальном времени: ветер, паруса и разворот корпуса, ядра, книппели и картечь. Каждый залп редеет команду врага ещё до абордажа.'] },
  { icon: 'ico/island', art: K('hero/island'), title: ['Your own island-town', 'Свой остров-город'], text: ['Claim an island and build it up like a castle of Heroes: a town hall, a keep, a market, seven dwellings, a shipyard and guns, each up to the fifth level.', 'Займите остров и отстройте его, как замок из «Героев»: ратуша, крепость, рынок, семь жилищ, верфь и батареи — каждая постройка до пятого уровня.'] },
  { icon: 'ico/ships', art: asset('bg.deck_man_o_war') ?? K('hero/home'), title: ['A fleet of 90+ hulls', 'Флот из 90+ корпусов'], text: ['From a fishing ketch to a man-o’-war, ten ranks of ships, rebuilds and modules, cannons by calibre, rare premium hulls with their own companions.', 'От рыбацкого кеча до линейного корабля: десять рангов, перестройки и модули, пушки по калибрам, редкие премиум-корпуса со своими спутниками.'] },
  { icon: 'ico/hot', art: K('hero/cabin'), title: ['The endgame of the Throne', 'Эндгейм «Престол»'], text: ['Zone bosses for fleets of captains, the Seals of the Deep, the Colosseum, contracts of the Admiralty, guild wars and the glory ranks beyond level 60.', 'Боссы морских зон для флотилий капитанов, Печати глубин, Колизей, контракты Адмиралтейства, войны гильдий и ранги славы после 60-го уровня.'] },
];

function home(lang: Lang): string {
  const pick = ['young_kraken', 'white_whale', 'crab_queen', 'sea_hydra', 'cloud_whale', 'wreck_titan', 'coral_colossus', 'deep_spawn', 'life_guard', 'mermaid']
    .map((id) => BY_ID.get(id)).filter((c): c is Creature => !!c && !!c.figure);
  const teaser = pick.length >= 6 ? pick : CREATURES.filter((c) => c.figure && c.u.tier >= 6).slice(0, 10);
  const shipsN = Object.values(SHIP_CLASSES).filter((s) => (s as { list?: string }).list).length;
  const stats: [string, Tr][] = [
    [String(CREATURES.length), ['creatures', NC(CREATURES.length).split(' ')[1]]], [String(shipsN), ['ships', plural(shipsN, 'корабль', 'корабля', 'кораблей').split(' ')[1]]], ['6', ['captains', 'капитанов']],
    [String(ORDER_IDS.length), ['orders', plural(ORDER_IDS.length, 'приказ', 'приказа', 'приказов').split(' ')[1]]], [String(ARTIFACT_IDS.length), ['artifacts', plural(ARTIFACT_IDS.length, 'артефакт', 'артефакта', 'артефактов').split(' ')[1]]], ['1–60', ['levels', 'уровни']],
  ];
  const body = `
<section class="wrap statbar reveal">${stats.map(([n, t]) => `<div class="statbar-i"><b>${n}</b><span>${L(lang, t)}</span></div>`).join('')}</section>
<section class="wrap sec feats-head">${sectionHead(lang === 'ru' ? 'Чем живёт море' : 'What the sea is made of', lang === 'ru' ? 'Heroes of Might and Magic, только пиратская' : 'Heroes of Might and Magic, gone pirate', lang)}</section>
<section class="stack" aria-label="${lang === 'ru' ? 'Особенности игры' : 'Game features'}">${FEATURES.map((f, i) => `<article class="bnr${i % 2 ? ' flip' : ''}" style="z-index:${i + 1}"><div class="bnr-card"><img class="bnr-art" src="${f.art}" alt="" loading="${i ? 'lazy' : 'eager'}" decoding="async"><span class="bnr-shade"></span>
<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
<div class="wrap bnr-txt"><div class="bnr-in"><p class="kicker"><img src="${K(f.icon)}" alt="" width="28" height="28">${String(i + 1).padStart(2, '0')} / ${String(FEATURES.length).padStart(2, '0')}</p><h3>${T(L(lang, f.title), lang)}</h3><p>${T(L(lang, f.text), lang)}</p></div></div></div></article>`).join('')}</section>
<section class="sec band"><div class="wrap">${sectionHead(lang === 'ru' ? 'Бестиарий' : 'Bestiary', lang === 'ru' ? 'Кто ходит в вашем трюме' : 'Who sails in your hold', lang)}
<div class="strip" data-auto>${teaser.map((c) => creatureCard(c, lang, `${root(lang)}creatures/${c.id}.html`)).join('')}</div>
<p class="center reveal"><a class="btn-oak" href="${root(lang)}creatures/">${lang === 'ru' ? `Все ${NC(CREATURES.length)}` : `All ${CREATURES.length} creatures`}</a></p></div></section>
<section class="wrap sec">${sectionHead(lang === 'ru' ? 'Капитаны' : 'Captains', lang === 'ru' ? 'Выберите, кто встанет у штурвала' : 'Choose who takes the wheel', lang)}
<div class="capstrip">${CAPTAIN_IDS.map((id) => capMini(id, lang)).join('')}</div></section>
<section class="cta-band reveal"><div class="wrap cta-in"><img src="${K('brand/wheel')}" alt="" width="120" height="120" class="spin" loading="lazy"><div><h2>${T(lang === 'ru' ? 'Поднимайте якорь' : 'Weigh anchor', lang)}</h2><p>${T(lang === 'ru' ? 'Играйте в браузере на компьютере и телефоне или прямо в Telegram — без установки.' : 'Play in the browser on a computer or a phone, or right inside Telegram — nothing to install.', lang)}</p></div>
<div class="hero-cta"><a class="btn-gold lg" href="/play">${u('playFree', lang)}</a>${vkBtn(lang, 'lg')}<a class="btn-oak" href="/site/forum/">${u('forum', lang)}</a></div></div></section>`;
  return page(lang, {
    path: '', active: 'home', title: lang === 'ru' ? 'GRAVETIDE — пиратские «Герои» в море Pirate Gothic' : 'GRAVETIDE — pirate Heroes on a Pirate Gothic sea',
    desc: lang === 'ru' ? 'Онлайн-песочница про пиратов: корабль — армия, капитан — герой, абордаж — пошаговая битва на гексах.' : 'An online pirate sandbox: a ship is an army, a captain is a hero, boarding is a turn-based hex battle.',
    hero: { img: K('hero/home'), imgM: K('hero/home_m'), kicker: lang === 'ru' ? 'Онлайн-песочница · Pirate Gothic' : 'Online sandbox · Pirate Gothic', title: lang === 'ru' ? 'Море помнит каждого капитана' : 'The sea remembers every captain', lead: lang === 'ru' ? 'Соберите армию в трюме, отстройте остров, возьмите на абордаж флагман и поднимитесь на Престол глубин.' : 'Raise an army in your hold, build your island, board a flagship and climb to the Throne of the Deep.', cta: true, tall: true, film: true },
    body,
  });
}

function bestiary(lang: Lang): string {
  const order: Group[] = ['crew', 'land', 'sea', 'faction', 'premium', 'shipbeast', 'titan', 'boss'];
  const list = [...CREATURES].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.u.tier - b.u.tier || L(lang, a.name).localeCompare(L(lang, b.name)));
  const chips = `<div class="filters reveal" role="toolbar"><button class="chip on" data-g="">${u('all', lang)} <i>${CREATURES.length}</i></button>${order.map((g) => `<button class="chip" data-g="${g}" style="--tint:${GROUPS[g].color}"><img src="${K(GROUPS[g].icon)}" alt="" width="18" height="18">${L(lang, GROUPS[g].name)} <i>${CREATURES.filter((c) => c.group === g).length}</i></button>`).join('')}</div>
<div class="filters2 reveal"><label class="search"><img src="${K('ico/search')}" alt="" width="22" height="22"><input type="search" placeholder="${u('search', lang)}" aria-label="${u('search', lang)}"></label>
<div class="tiers">${[1, 2, 3, 4, 5, 6, 7, 8].map((t) => `<button class="coinbtn" data-t="${t}" aria-pressed="false" title="${u('tier', lang)} ${t}">${t}</button>`).join('')}</div></div>`;
  const body = `<section class="wrap sec">${chips}<div class="cgrid" id="cgrid">${list.map((c) => creatureCard(c, lang, `${c.id}.html`)).join('')}</div><p class="empty" hidden>${u('none', lang)}</p></section>`;
  return page(lang, {
    path: 'creatures/', active: 'creatures', title: lang === 'ru' ? `Бестиарий GRAVETIDE — ${NC(CREATURES.length)}` : `GRAVETIDE Bestiary — ${CREATURES.length} creatures`,
    desc: lang === 'ru' ? 'Все существа игры: характеристики, способности, где встречаются и во что улучшаются.' : 'Every creature of the game: stats, abilities, where they are found and what they upgrade into.',
    hero: { img: K('hero/bestiary'), kicker: lang === 'ru' ? 'Библиотека существ' : 'Creature library', title: lang === 'ru' ? 'Бестиарий' : 'Bestiary', lead: lang === 'ru' ? `${NC(CREATURES.length)}: команда, звери островов и глубин, войска фракций, спутники кораблей и титаны Грааля.` : `${CREATURES.length} creatures: the crew, beasts of the isles and the deep, faction troops, ship companions and the titans of the Grail.` },
    body,
  });
}

function creaturePage(c: Creature, lang: Lang): string {
  const g = GROUPS[c.group];
  const link = (id: string | null | undefined) => {
    const o = id ? BY_ID.get(id) : null;
    return o ? `<a class="chiplink" href="${o.id}.html">${img(o.figure, '', '', true, ' width="40" height="40"')}${esc(L(lang, o.name))}</a>` : '';
  };
  const up = c.u.upgrade && c.u.upgrade !== c.id ? link(c.u.upgrade) : '';
  const base = c.u.up && c.u.base !== c.id ? link(c.u.base) : '';
  const prem = (c.u as { premium?: { price: number } }).premium;
  // Its idle pose and the breath after it at one height (owner, 2026-10-21; shared/src/data/framefit.ts).
  const fit = asset(`unit.${c.id}`) && asset(`unit.${c.id}_b`) ? fitStage(`unit.${c.id}`, `unit.${c.id}_b`) : null;
  const body = `<section class="wrap sec"><div class="cdet" style="--tint:${g.color}">
<div class="cdet-art reveal"><div class="stage${fit ? ' fitbox' : ''}">${fit ? `<span class="fitstage" style="--r:${fit.ar}">${[fit.a, fit.b].map((q, i) => `<img src="${c.poses[i]}" alt="${i ? '' : esc(L(lang, c.name))}" class="pose p${i}" style="left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%"${i ? ' aria-hidden="true"' : ''}>`).join('')}</span>` : c.poses.length > 1 ? c.poses.slice(0, 2).map((p, i) => `<img src="${p}" alt="${i ? '' : esc(L(lang, c.name))}" class="pose p${i}"${i ? ' aria-hidden="true"' : ''}>`).join('') : img(c.figure, L(lang, c.name), 'pose p0', false)}</div>
${c.poses.length > 2 ? `<div class="poses"><span>${u('poses', lang)}</span>${c.poses.map((p) => `<img src="${p}" alt="" loading="lazy">`).join('')}</div>` : ''}</div>
<div class="cdet-info reveal"><p class="kicker"><img src="${K(g.icon)}" alt="" width="18" height="18"> ${esc(c.roster ? L(lang, rosterName(c.roster)) : L(lang, g.name))}</p>
${L(lang, c.note) ? `<p class="lore">${T(L(lang, c.note), lang)}</p>` : ''}
<div class="stats panel">${stat('tier', c.u.tier, lang)}${stat('atk', c.u.atk, lang)}${stat('def', c.u.def, lang)}${stat('dmg', `${c.u.dmin}–${c.u.dmax}`, lang)}${stat('hp', c.u.hp, lang)}${stat('speed', c.u.speed, lang)}${stat('init', c.u.init, lang)}${c.u.shots ? stat('shots', c.u.shots, lang) : ''}${stat('cost', prem ? `${prem.price} ${u('doubloons', lang)}` : `${c.u.cost} ${u('silver', lang)}`, lang)}</div>
${c.u.specials.length ? `<h3>${u('abilities', lang)}</h3><ul class="abil">${c.u.specials.map((s) => abil(SPECIAL_ICON[s] ? asset(`icon.${SPECIAL_ICON[s]}`) : null, L(lang, specialName(s)), L(lang, specialNote(s)), lang)).join('')}</ul>` : ''}
${c.lairs.length ? `<h3>${u('found', lang)}</h3><p class="tags">${c.lairs.map((l) => `<span class="tag">${esc(L(lang, l))}</span>`).join('')}</p>` : ''}
${up ? `<h3>${u('upgrade', lang)}</h3><p>${up}</p>` : ''}${base ? `<h3>${u('from', lang)}</h3><p>${base}</p>` : ''}
<p class="back"><a class="btn-oak sm" href="./">${u('back', lang)}</a></p></div></div></section>`;
  return page(lang, {
    path: `creatures/${c.id}.html`, active: 'creatures', title: `${L(lang, c.name)} — ${lang === 'ru' ? 'бестиарий' : 'bestiary'} GRAVETIDE`,
    desc: L(lang, c.note) || L(lang, c.name), hero: { img: K('hero/bestiary'), kicker: `${u('creatures', lang)} · ${u('tier', lang)} ${c.u.tier}`, title: L(lang, c.name), mini: true }, body,
  });
}

const capRu = (id: string, k: string, en: string) => DATA_RU[`captains.CAPTAINS.${id}.${k}`] ?? en;
/** A captain's face in the site's brass porthole (owner, 2026-10-26: «все лица должны находиться четко во фрейме»):
 *  shared/src/data/portraitfit.ts — the face in the hole's middle, the ring and the portrait one box. */
const SITE_RING = '/site/img/ui/ring_round.webp';
const capAv = (id: string, name: string, cls: string): string =>
  avatarHtml({ face: id, url: asset(`portrait.${id}`), ring: 'site', ringUrl: SITE_RING, stock: 'site', cls, attrs: `role="img" aria-label="${esc(name)}"` });
function capMini(id: string, lang: Lang): string {
  const c = (CAPTAINS as Record<string, { name: string; archetype: string }>)[id];
  return `<a class="cap reveal" href="${root(lang)}captains/#${id}">${capAv(id, c.name, 'cap-ring')}<b>${esc(lang === 'ru' ? capRu(id, 'name', c.name) : c.name)}</b><i>${esc(lang === 'ru' ? capRu(id, 'archetype', c.archetype) : c.archetype)}</i></a>`;
}

function captains(lang: Lang): string {
  const body = `<section class="wrap sec caps">${CAPTAIN_IDS.map((id, i) => {
    const c = CAPTAINS[id] as unknown as { name: string; epithet?: string; archetype: string; bio: string; playstyle: string; premium?: unknown; passive: { name: string; description: string }; abilities: { name: string; description: string }[] };
    const tr = (k: string, en: string) => (lang === 'ru' ? capRu(id, k, en) : en);
    return `<article class="capcard panel reveal${i % 2 ? ' flip' : ''}" id="${id}"><div class="capcard-art">${img(asset(`unit.hero_${id}`) ?? asset(`portrait.${id}`), c.name, 'fig')}${capAv(id, c.name, 'cap-ring big')}</div>
<div class="capcard-txt"><p class="kicker">${esc(tr('archetype', c.archetype))}${c.premium ? ` · <span class="gold">${u('premium', lang)}</span>` : ''}</p><h2>${esc(tr('name', c.name))}</h2>${c.epithet ? `<p class="epithet">«${esc(tr('epithet', c.epithet))}»</p>` : ''}
<p>${T(tr('bio', c.bio), lang)}</p><p class="muted">${T(tr('playstyle', c.playstyle), lang)}</p>
<div class="passive"><span class="abil-ico"><img src="${asset(`icon.school_${id}`) ?? K('ico/star')}" alt="" width="48" height="48"></span><div><b>${esc(tr('passive.name', c.passive.name))}</b><span>${T(tr('passive.description', c.passive.description), lang)}</span></div></div>
<ul class="abil">${c.abilities.map((a, k) => abil(asset(`icon.ab_${(a as { id?: string }).id}`), tr(`abilities.${k}.name`, a.name), tr(`abilities.${k}.description`, a.description), lang)).join('')}</ul></div></article>`;
  }).join('')}</section>`;
  return page(lang, {
    path: 'captains/', active: 'captains', title: lang === 'ru' ? 'Капитаны GRAVETIDE' : 'GRAVETIDE Captains', desc: lang === 'ru' ? 'Шесть капитанов: история, особенность и способности каждого.' : 'Six captains: the story, the trait and the abilities of each.',
    hero: { img: K('hero/home_m'), kicker: lang === 'ru' ? 'Герои морей' : 'Heroes of the sea', title: lang === 'ru' ? 'Капитаны' : 'Captains', lead: lang === 'ru' ? 'Капитан — это герой из «Героев»: первичные и вторичные навыки, таланты, артефакты и своя школа приказов.' : 'A captain is a hero of Heroes: primary and secondary skills, talents, artifacts and a school of orders.' },
    body,
  });
}

const LISTS: Record<string, Tr> = { fast: ['Fast ships', 'Быстрые корабли'], combat: ['Warships', 'Боевые корабли'], trade: ['Traders', 'Торговые корабли'], hauler: ['Haulers', 'Тяжёлые грузовозы'] };
function ships(lang: Lang): string {
  const all = Object.values(SHIP_CLASSES) as unknown as { id: string; name: string; role: string; list?: string; tier: number; hull: number; maxSpeed: number; gunPortsPerSide: number; crewMin: number; crewMax: number; premium?: { price: number }; passive?: { name: string; description: string }; sprite: string }[];
  const ru = (id: string, k: string, en: string) => (lang === 'ru' ? DATA_RU[`ships.SHIP_CLASSES.${id}.${k}`] ?? en : en);
  const lr = (id: string) => (LEVEL_RANGE as Record<string, [number, number]>)[id];
  const card = (s: (typeof all)[number]) => {
    const r = lr(s.id);
    return `<article class="ship panel reveal${s.premium ? ' prem' : ''}"><div class="ship-art">${img(asset(s.sprite), s.name)}</div><div class="ship-txt">
<h3>${esc(ru(s.id, 'name', s.name))}${s.premium ? ` <span class="badge gold">${u('premium', lang)}</span>` : ''}</h3><p class="muted">${T(ru(s.id, 'role', s.role), lang)}</p>
<div class="stats mini">${r ? stat('rank', `⚓${r[0]}${r[1] !== r[0] ? `–${r[1]}` : ''}`, lang) : ''}${stat('guns', s.gunPortsPerSide, lang)}${stat('hull', s.hull, lang)}${stat('speed', s.maxSpeed, lang)}${stat('crew', `${s.crewMin}–${s.crewMax}`, lang)}</div>
${s.passive ? `<p class="trait"><img src="${K('ico/star')}" alt="" width="18" height="18"><b>${esc(ru(s.id, 'passive.name', s.passive.name))}.</b> ${T(ru(s.id, 'passive.description', s.passive.description), lang)}</p>` : ''}</div></article>`;
  };
  const body = Object.keys(LISTS).map((k) => {
    const xs = all.filter((s) => s.list === k).sort((a, b) => (lr(a.id)?.[0] ?? 0) - (lr(b.id)?.[0] ?? 0) || a.tier - b.tier);
    return `<section class="wrap sec">${sectionHead(lang === 'ru' ? plural(xs.length, 'корпус', 'корпуса', 'корпусов') : `${xs.length} hulls`, L(lang, LISTS[k]), lang)}<div class="ships">${xs.map(card).join('')}</div></section>`;
  }).join('');
  return page(lang, {
    path: 'ships/', active: 'ships', title: lang === 'ru' ? 'Флот GRAVETIDE' : 'GRAVETIDE Fleet', desc: lang === 'ru' ? 'Все корабли игры: ранги, пушки, корпус, скорость и особенности.' : 'Every ship of the game: ranks, guns, hull, speed and traits.',
    hero: { img: K('hero/home'), kicker: lang === 'ru' ? 'Верфь' : 'Shipyard', title: lang === 'ru' ? 'Флот' : 'Fleet', lead: lang === 'ru' ? 'Десять рангов кораблей — от рыбацкого кеча до линейного корабля и премиум-корпусов со своими спутниками.' : 'Ten ranks of ships — from a fishing ketch to a man-o’-war and premium hulls with companions of their own.' },
    body,
  });
}

// ------------------------------------------------------------------------------------------------ the rating and the shop

/** The pictures the rating's and the shop's scripts draw with: the captains' portraits, the plates and frames other
 *  captains see (shared/src/data/cosmetics.ts), the catalogue's art — the game's own, from the manifest. */
const portraitOf = (id: string) => asset(`portrait.${id}`);
const capNames = (lang: Lang): Record<string, string> =>
  Object.fromEntries(CAPTAIN_IDS.map((id) => [id, lang === 'ru' ? capRu(id, 'name', (CAPTAINS as Record<string, { name: string }>)[id].name) : (CAPTAINS as Record<string, { name: string }>)[id].name]));
/** The avatars the pages' scripts draw (site.js gtAvatar, the same markup as shared/src/data/portraitfit.ts avatarHtml):
 *  each captain's face fit (the face in the hole's middle) and the site ring's and every frame's place in the box. */
const avatarData = () => ({
  fits: Object.fromEntries(CAPTAIN_IDS.map((id) => { const f = faceFit(id); return [id, { size: f.size, pos: f.pos }]; })),
  ring: { url: SITE_RING, ...ringFit('site', 'site') },
});
function cosData(lang: Lang) {
  return {
    portraits: Object.fromEntries(CAPTAIN_IDS.map((id) => [id, portraitOf(id)])),
    names: capNames(lang),
    plates: Object.fromEntries(PLATES.map((p) => [p.id, { url: asset(`cos.plate_${p.id}`), ink: p.ink, halo: p.halo, span: p.span }])),
    // (each frame laid so its own measured hole is the portrait's: portraitfit.ts ringFit)
    frames: Object.fromEntries(FRAMES.map((f) => [f.id, { url: asset(`cos.frame_${f.id}`), ...ringFit(f.id, 'site') }])),
    ...avatarData(),
    titles: Object.fromEntries(TITLES.map((t) => [t.id, L(lang, t.name)])),
  };
}
/** Data for a page's script, inline (no request of its own). */
const dataTag = (id: string, v: unknown) => `<script type="application/json" id="${id}">${JSON.stringify(v).replace(/</g, '\\u003c')}</script>`;

const BOARD_UI: { id: string; icon: string; name: Tr; unit: Tr }[] = [
  { id: 'level', icon: 'ico/star', name: ['Level', 'Уровень'], unit: ['level', 'уровень'] },
  { id: 'glory', icon: 'ico/achievements', name: ['Glory', 'Слава'], unit: ['glory rank', 'ранг славы'] },
  { id: 'boarded', icon: 'ico/boarding', name: ['Boardings', 'Абордажи'], unit: ['boardings won', 'абордажей'] },
  { id: 'arena', icon: 'ico/cutlasses', name: ['Colosseum', 'Колизей'], unit: ['rating', 'рейтинг'] },
  { id: 'campaign', icon: 'ico/scroll', name: ['Campaign', 'Кампания'], unit: ['chapter', 'глава'] },
  { id: 'guilds', icon: 'ico/official', name: ['Guilds', 'Гильдии'], unit: ['levels together', 'сумма уровней'] },
];

const RATING_T: Record<string, Tr> = {
  find: ['Find', 'Найти'], ph: ['A captain’s name…', 'Ник капитана…'], notFound: ['No such captain in the rating.', 'Такого капитана нет в рейтинге.'],
  ranks: ['Places on the boards', 'Места в рейтингах'], out: ['not in the top', 'вне таблицы'], lvl: ['lv.', 'ур.'], glory: ['glory', 'слава'],
  wins: ['wins', 'побед'], done: ['complete', 'пройдена'], members: ['captains', 'капитанов'], best: ['best', 'лучший'],
  empty: ['Nobody here yet: the sea waits for its first captains.', 'Пока пусто: море ждёт первых капитанов.'],
  at: ['Updated', 'Обновлено'], err: ['The rating could not be loaded. Try again later.', 'Не удалось загрузить рейтинг. Попробуйте позже.'],
  rate: ['Too many searches: wait a minute.', 'Слишком часто: подождите минуту.'], short: ['At least two letters.', 'Хотя бы две буквы.'],
  close: ['Close', 'Закрыть'], you: ['Found', 'Найден'], colCap: ['Captain', 'Капитан'], colGuild: ['Guild', 'Гильдия'],
};

function rating(lang: Lang): string {
  const tr = (t: Record<string, Tr>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, L(lang, v)]));
  const body = `<section class="wrap sec rt" id="rating">
<div class="rt-tabs" role="tablist" aria-label="${lang === 'ru' ? 'Таблицы' : 'Boards'}">${BOARD_UI.map((b, i) => `<button class="chip${i ? '' : ' on'}" role="tab" aria-selected="${i ? 'false' : 'true'}" data-board="${b.id}"><img src="${K(b.icon)}" alt="" width="18" height="18">${L(lang, b.name)}</button>`).join('')}</div>
<form class="rt-find" role="search"><label class="search"><img src="${K('ico/search')}" alt="" width="22" height="22"><input name="name" type="search" maxlength="24" autocomplete="off" placeholder="${esc(L(lang, RATING_T.ph))}" aria-label="${esc(L(lang, RATING_T.ph))}"></label><button class="btn-gold sm" type="submit">${L(lang, RATING_T.find)}</button></form>
<div class="rt-found" hidden aria-live="polite"></div>
<div class="rt-board panel"><div class="rt-head"><span>#</span><span class="rt-col">${L(lang, RATING_T.colCap)}</span><span class="rt-unit"></span></div><ol class="rt-list" aria-live="polite"></ol><p class="rt-empty muted" hidden></p></div>
<p class="rt-at muted"></p></section>
${dataTag('rt-data', { lang, api: '/api/site/rating', t: tr(RATING_T), boards: BOARD_UI.map((b) => ({ id: b.id, name: L(lang, b.name), unit: L(lang, b.unit) })), cos: cosData(lang) })}`;
  return page(lang, {
    path: 'rating/', active: 'rating', title: lang === 'ru' ? 'Рейтинг капитанов GRAVETIDE' : 'GRAVETIDE Captains’ rating',
    desc: lang === 'ru' ? 'Лучшие капитаны моря: уровень, слава, абордажи, Колизей, кампания и гильдии.' : 'The best captains of the sea: level, glory, boardings, the Colosseum, the campaign and the guilds.',
    hero: { img: K('hero/battle'), kicker: lang === 'ru' ? 'Таблицы славы' : 'The tables of glory', title: lang === 'ru' ? 'Рейтинг капитанов' : 'Captains’ rating', lead: lang === 'ru' ? 'Кто выше всех поднялся по уровням, сколько абордажей взято, кто держит Колизей и чья гильдия сильнее. Обновляется раз в минуту.' : 'Who has climbed highest, how many boardings were won, who holds the Colosseum and whose guild is strongest. Updated every minute.', mini: true },
    body, css: '/site/css/rating.css', script: '/site/js/rating.js',
  });
}

const SHOP_T: Record<string, Tr> = {
  step1: ['Your captain’s name', 'Ник капитана'], hint1: ['The purchase goes to this captain’s account. No sign-in needed.', 'Покупка придёт на счёт этого капитана. Входить на сайт не нужно.'],
  nickPh: ['As in the game', 'Как в игре'], find: ['Find', 'Найти'], finding: ['Looking…', 'Ищем…'],
  notFound: ['No captain of that name. Check the spelling: as in the game.', 'Капитан с таким ником не найден. Проверьте написание — как в игре.'],
  badName: ['A name is 2 to 24 letters and digits.', 'Ник — от 2 до 24 букв и цифр.'], rate: ['Too many tries: wait a minute.', 'Слишком много попыток: подождите минуту.'],
  net: ['No answer from the server. Try again.', 'Нет связи с сервером. Попробуйте ещё раз.'], to: ['For', 'Получатель'], level: ['Level', 'Уровень'],
  change: ['Another name', 'Другой ник'], noCap: ['no captain chosen yet', 'капитан ещё не выбран'],
  atSea: ['in the game now', 'сейчас в игре'], inPort: ['in port', 'в порту'], offline: ['not in the game', 'не в игре'],
  email: ['E-mail for the receipt', 'Почта для чека'], emailNote: ['The payment’s receipt is sent here.', 'Сюда придёт чек об оплате.'], needEmail: ['Enter an e-mail for the receipt.', 'Укажите почту для чека.'],
  all: ['All items', 'Все товары'], filters: ['Filters', 'Фильтры'], cats: ['Categories', 'Категории'], price: ['Price, ₽', 'Цена, ₽'], from: ['from', 'от'], to2: ['to', 'до'],
  mine: ['Available to me', 'Доступно мне'], mineHint: ['Enter your captain’s name first.', 'Сначала укажите ник капитана.'],
  sort: ['Sort', 'Сортировка'], s_pop: ['Popular', 'Популярные'], s_cheap: ['Cheaper first', 'Сначала дешевле'], s_dear: ['Dearer first', 'Сначала дороже'], s_new: ['New', 'Новые'],
  show: ['Show {n}', 'Показать {n}'], reset: ['Reset', 'Сбросить'], close: ['Close', 'Закрыть'], empty: ['Nothing matches these filters.', 'По этим фильтрам ничего нет.'],
  items: ['items', 'товаров'], buy: ['Buy', 'Купить'], owned: ['Owned', 'Уже есть'],
  needNick: ['Enter your captain’s name first: the purchase goes to the captain’s account.', 'Сначала укажите ник капитана: покупка придёт на его счёт.'], paying: ['To the payment…', 'Переходим к оплате…'],
  best: ['Best value', 'Выгодно'], hot: ['Popular', 'Хит'], until: ['Until {d}', 'До {d}'], since: ['From {d}', 'С {d}'], bonus: ['+{n} free', '+{n} в подарок'], once: ['Once per account', 'Один раз на счёт'],
  perDay: ['Once a day', 'Раз в день'], perWeek: ['Once a week', 'Раз в неделю'], aboard: ['Delivered aboard', 'Вручается на борту'],
  // why a thing cannot be bought (the server's word: server/src/game/webshop.ts Unavailable)
  w_owned: ['Owned', 'Уже есть'], w_claimed: ['Already claimed', 'Уже получено'], w_limit: ['Bought for now', 'Пока куплено'], w_max: ['At the limit', 'Предельный запас'],
  w_gone: ['Not on sale', 'Не продаётся'], w_season: ['Out of season', 'Не сезон'], w_level: ['Level too low', 'Мал уровень'], w_island: ['Needs an island', 'Нужен остров'],
  w_tier: ['Ship level too low', 'Мал уровень корабля'], w_slot: ['No free slot', 'Нет слота в армии'], w_room: ['No room', 'Нет места'], w_hold: ['Hold full', 'Трюм полон'],
  w_berths: ['Berths full', 'Причалы заняты'], w_yours: ['Your ship now', 'Уже ваш корабль'], w_order: ['First one first', 'Сначала первая'], w_none: ['Nothing to do', 'Сейчас не нужно'], w_deep: ['For the deep’s own', 'Только для глубин'],
  step3: ['Payment', 'Оплата'],
  pay3: ['By card or the SBP on YooKassa’s secure page: the card never passes through our server. Once paid, the purchase is on the captain’s account at once; a ship comes in port, creatures and ship’s stores out of a fight — as in the game. In the game a toast says «Web shop purchase».', 'Картой или через СБП на защищённой странице ЮKassa: данные карты не проходят через наш сервер. Сразу после оплаты покупка приходит на счёт капитана; корабль — в порту, существа и припасы — вне боя, как в игре. В игре появится сообщение «Покупка с сайта».'],
  confirm: ['Your order', 'Ваш заказ'], payBtn: ['Pay {p}', 'Оплатить {p}'], cancel: ['Cancel', 'Отмена'],
  test: ['TEST MODE: the payment system is not connected yet and no money is charged. Only the site’s administrators can make a test purchase.', 'ТЕСТОВЫЙ РЕЖИМ: платёжная система ещё не подключена, деньги не списываются. Тестовую покупку могут оформить только администраторы.'],
  testOpen: ['TEST MODE: no money is charged; the checkout is a test page of the game.', 'ТЕСТОВЫЙ РЕЖИМ: деньги не списываются, вместо оплаты — тестовая страница игры.'],
  o_pending: ['The payment is being processed…', 'Оплата в обработке…'], o_paid: ['Paid: the purchase is on its way…', 'Оплата прошла, вручаем покупку…'],
  o_done: ['Paid! The purchase is on the captain’s account.', 'Оплата прошла! Покупка уже на счёте капитана.'],
  o_kept: ['Paid! It could not be handed over in the game, so its doubloons are on the captain’s account.', 'Оплата прошла! Вручить вещь в игре не вышло, поэтому её стоимость зачислена дублонами на счёт капитана.'],
  o_wait_port: ['Paid! The ship waits for the captain in port: she is handed over at the next call at a port.', 'Оплата прошла! Корабль ждёт капитана: его вручат, как только капитан зайдёт в порт.'],
  o_wait_fight: ['Paid! It comes aboard as soon as the captain’s fight is over.', 'Оплата прошла! Покупка придёт на борт, как только закончится бой.'],
  o_wait_login: ['Paid! The purchase waits for the captain: it comes aboard at the next login.', 'Оплата прошла! Покупка ждёт капитана и придёт на борт при следующем входе в игру.'],
  o_canceled: ['The payment did not go through or was cancelled. No money was taken.', 'Оплата не прошла или отменена. Деньги не списаны.'],
  o_failed: ['The payment did not go through. If money was taken, write to support@gravetidegame.com and we will sort it out.', 'Оплата не прошла. Если деньги списались — напишите на support@gravetidegame.com, разберёмся.'],
  o_missing: ['No such order.', 'Заказ не найден.'], o_slow: ['Still waiting for the bank. The page checks again by itself; you may also come back later.', 'Банк ещё не ответил. Страница проверит сама; можно вернуться позже.'],
  orderNum: ['Order', 'Заказ'], forWho: ['for', 'для'],
  e_owned: ['The captain has this already.', 'Это у капитана уже есть.'], e_limit: ['Bought as often as it may be for now.', 'Куплено столько раз, сколько можно сейчас.'],
  e_max: ['The captain has as much of it as may be held.', 'У капитана уже предельный запас.'], e_gone: ['This is not on sale now.', 'Этот товар сейчас не продаётся.'],
  e_test_only: ['The shop is in test mode: purchases are not taken yet.', 'Магазин в тестовом режиме: покупки пока не принимаются.'],
  e_provider: ['The payment system did not answer. Try again in a minute.', 'Платёжная система не ответила. Попробуйте через минуту.'],
  e_bad_item: ['No such item.', 'Нет такого товара.'], e_origin: ['Open the shop from the site itself.', 'Откройте магазин с самого сайта.'], e_unknown: ['Something went wrong. Try again.', 'Что-то пошло не так. Попробуйте ещё раз.'],
  rub: ['₽', '₽'],
  // the thing's window (owner, 2026-10-21: «на тапу или нажатию я хочу видеть модалку красивую с иконками и описанием»)
  more: ['Details', 'Подробнее'], prev: ['Previous', 'Предыдущий товар'], next: ['Next', 'Следующий товар'], of: ['of', 'из'],
  loading: ['Loading…', 'Загружаем…'], loadErr: ['The card could not be loaded.', 'Не удалось загрузить карточку.'], retry: ['Try again', 'Повторить'],
  save: ['Saves {n}%', 'Выгода {n}%'], worth: ['{w} at single prices', 'По отдельности — {w}'], usual: ['Usually {p}', 'Обычно {p}'],
  perHead: ['{p} a head', '{p} за шт.'], ends: ['Ends in {t}', 'До конца — {t}'], starts: ['Starts in {t}', 'Начнётся через {t}'],
  dd: ['d', 'д'], hh: ['h', 'ч'], mm: ['min', 'мин'], choose: ['Choose a pack', 'Выберите набор'], range: ['From {a} to {b} in the list', 'В списке от {a} до {b}'],
  onlyHere: ['only here', 'только здесь'], alone: ['alone {p}', 'отдельно — {p}'], forCap: ['For', 'Для'], lv: ['lv.', 'ур.'],
  copy: ['Copy the link', 'Скопировать ссылку'], copied: ['Link copied', 'Ссылка скопирована'], swipe: ['Swipe down to close', 'Смахните вниз, чтобы закрыть'],
  emoteSay: ['Over your ship and in the chat', 'Над кораблём и в чате'], sample: ['Sample', 'Пример'],
  // the badges and the price buttons (owner, 2026-10-21: «красиво оформить эти числа уровня, и вообще числа»)
  h_once: ['Bought once per account', 'Покупается один раз на счёт'], h_day: ['Bought once a day', 'Покупается раз в день'], h_week: ['Bought once a week', 'Покупается раз в неделю'],
  h_aboard: ['Delivered aboard: the captain must be at sea and out of a fight', 'Вручается на борту: капитан в море и не в бою'],
  h_until: ['On sale until {d}', 'В продаже до {d}'], h_since: ['On sale from {d}', 'В продаже с {d}'], h_bonus: ['{n} doubloons more on top', 'Ещё {n} дублонов сверху'],
  bonusPct: ['+{n}% free', '+{n}% в подарок'], saveTag: ['Save {n}%', 'Выгода {n}%'], h_save: ['The goods inside are worth {w} at single prices', 'Товары внутри по отдельности стоят {w}'],
  off: ['−{n}%', '−{n}%'], h_off: ['{n}% cheaper a unit than the smallest pack', 'На {n}% дешевле за единицу, чем самый малый набор'],
  h_best: ['The best price a unit of this card', 'Самая выгодная цена за единицу на этой карточке'], h_hot: ['The most bought', 'Берут чаще всего'],
  u_pc: ['pc', 'шт.'], u_100: ['per 100', 'за 100'], u_1000: ['per 1,000', 'за 1000'], u_h: ['h', 'ч'], u_d: ['day', 'день'],
};

/** The store's categories (the site's tabs, shared/src/data/webshop.ts WEB_TABS) with their pictures: the site kit's and
 *  the game's own (the cosmetics' icons of the game's shop). */
const CAT_ICON: Record<string, string | null> = {
  all: K('ico/chest'), dbl: K('ico/doubloon'), cap: K('ico/captains'), ship: K('ico/ships'), unit: K('ico/creatures'),
  boost: asset('icon.ui_hourglass') ?? K('ico/hourglass'), set: asset('icon.ui_chest') ?? K('ico/chest'), cos: asset('icon.cos_bundle') ?? K('ico/star'), deal: K('ico/hot'),
  cos_titles: asset('icon.cos_titles'), cos_frames: asset('icon.cos_frames'), cos_flags: asset('icon.cos_flags'), cos_trails: asset('icon.cos_trails'), cos_emotes: asset('icon.cos_emotes'), cos_sets: asset('icon.cos_bundle'),
};
const COS_SUBS = ['cos_titles', 'cos_frames', 'cos_flags', 'cos_trails', 'cos_emotes', 'cos_sets'];
const COS_SUB_NAMES: Record<string, Tr> = {
  cos_titles: ['Titles and plates', 'Звания'], cos_frames: ['Frames', 'Рамки'], cos_flags: ['Flags', 'Флаги'], cos_trails: ['Trails', 'Следы'], cos_emotes: ['Emotes', 'Эмоции'], cos_sets: ['Outfits', 'Наряды'],
};

const PRICE_STEPS: [number, number][] = [[0, 590], [590, 1990], [1990, 4990], [4990, 0]];
/** A number with a no-break thin gap between thousands. */
const nb = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** The trails' little seas (owner, 2026-10-21: «следы в магазине прям покажи как визуально выглядят, то есть должен быть
 *  кусочек моря и какой-то рандомный корабль и как плывет»): the game's painted sea, the hulls a card picks one of at
 *  random (her sprite, length and beam, top speed), and every trail's look as the game's renderer draws it
 *  (shared/src/data/cosmetics.ts TRAILS → client/src/render/cosdraw.ts; site/js/trails.js ports it). */
function seaData() {
  const hulls = (Object.values(SHIP_CLASSES) as unknown as { id: string; list?: string; tier: number; sprite: string; length: number; beam: number; maxSpeed: number }[])
    .filter((s) => s.list && s.tier <= 6 && asset(s.sprite))
    .map((s) => ({ src: asset(s.sprite), len: s.length, beam: s.beam, v: s.maxSpeed }));
  return { tex: asset('tex.ocean'), hulls, trails: Object.fromEntries(TRAILS.map((t) => [t.id, { c: t.c, size: t.size, life: t.life, rise: t.rise, glow: t.glow }])) };
}

function shop(lang: Lang): string {
  const tr = (t: Record<string, Tr>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, L(lang, v)]));
  const r = root(lang);
  const ru = lang === 'ru';
  const badgeArt = WEB_ITEMS.flatMap((x) => (x.badges ?? []).map((b) => b.icon ?? '')).filter((a) => a && !a.startsWith('/') && !a.startsWith('#'));
  const art = Object.fromEntries([...new Set(WEB_ITEMS.map((x) => x.art).concat(SHOP.map((f) => (f.icon.startsWith('unit:') ? `unit.${f.icon.slice(5)}` : `icon.${f.icon}`)), badgeArt, ['icon.ui_hourglass', 'icon.doubloon']))].filter(Boolean).map((a) => [a, asset(a)]));
  const t = (k: string) => L(lang, SHOP_T[k]);
  const cat = (id: string, name: string, sub = false) => `<button type="button" class="st-cat${sub ? ' sub' : ''}" data-cat="${id}" aria-pressed="false"><span class="st-ico">${CAT_ICON[id] ? `<img src="${CAT_ICON[id]}" alt="" width="28" height="28" loading="lazy">` : ''}</span><span class="st-cn">${esc(name)}</span><i class="st-n"></i></button>`;
  const cats = `<button type="button" class="st-cat all" data-cat="all" aria-pressed="true"><span class="st-ico"><img src="${CAT_ICON.all}" alt="" width="28" height="28"></span><span class="st-cn">${t('all')}</span><i class="st-n"></i></button>
${WEB_TABS.map((id) => cat(id, L(lang, WEB_TAB_NAMES[id])) + (id === 'cos' ? `<div class="st-subs">${COS_SUBS.map((s) => cat(s, L(lang, COS_SUB_NAMES[s]), true)).join('')}</div>` : '')).join('')}`;
  const legalLine = ru
    ? `Нажимая «Оплатить», вы принимаете <a href="${r}offer/" target="_blank">публичную оферту</a>, <a href="${r}terms/" target="_blank">пользовательское соглашение</a> и <a href="${r}refunds/" target="_blank">условия возврата</a> и даёте <a href="${r}consent/" target="_blank">согласие на обработку персональных данных</a> по <a href="${r}privacy/" target="_blank">политике конфиденциальности</a>.`
    : `By pressing «Pay» you accept the <a href="${r}offer/" target="_blank">public offer</a>, the <a href="${r}terms/" target="_blank">terms of use</a> and the <a href="${r}refunds/" target="_blank">refund terms</a> and give your <a href="${r}consent/" target="_blank">consent to data processing</a> under the <a href="${r}privacy/" target="_blank">privacy policy</a>.`;
  const body = `<section class="wrap sec shop" id="shop">
<p class="shop-mode" role="note" hidden></p>
<div class="shop-order panel" role="status" aria-live="polite" hidden></div>
<div class="st-who panel" id="step1"><div class="st-who-in"><div class="st-who-l"><h2>${t('step1')}</h2><p class="muted">${T(t('hint1'), lang)}</p></div>
<form class="shop-find"><label class="search"><img src="${K('ico/captains')}" alt="" width="22" height="22"><input name="nick" maxlength="24" autocomplete="nickname" autocapitalize="off" spellcheck="false" placeholder="${esc(t('nickPh'))}" aria-label="${esc(t('step1'))}"></label><button class="btn-gold sm" type="submit">${t('find')}</button></form>
<div class="shop-who" hidden></div></div>
<label class="shop-mail" hidden><span class="kicker">${t('email')}</span><span class="search"><input type="email" name="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="mail@example.com"></span><small class="muted">${t('emailNote')}</small></label>
<p class="shop-err" role="alert" hidden></p></div>
<div class="store">
<aside class="st-side" id="st-filters" aria-label="${t('filters')}" tabindex="-1">
<div class="st-side-head"><b>${t('filters')}</b><button type="button" class="st-x" data-close aria-label="${t('close')}">×</button></div>
<div class="st-side-body">
<nav class="st-cats" aria-label="${t('cats')}">${cats}</nav>
<fieldset class="st-price"><legend>${t('price')}</legend><div class="st-range"><label><span>${t('from')}</span><input type="number" inputmode="numeric" min="0" step="10" name="min" placeholder="290"></label><label><span>${t('to2')}</span><input type="number" inputmode="numeric" min="0" step="10" name="max" placeholder="9 900"></label></div>
<div class="st-steps">${PRICE_STEPS.map(([a, b]) => `<button type="button" class="st-step" data-min="${a || ''}" data-max="${b || ''}">${!a ? `≤ ${nb(b)}` : !b ? `${nb(a)}+` : `${nb(a)}–${nb(b)}`}</button>`).join('')}</div></fieldset>
<label class="st-mine"><input type="checkbox" name="mine"><span class="st-sw" aria-hidden="true"></span><span>${t('mine')}<small class="muted">${t('mineHint')}</small></span></label>
</div>
<div class="st-side-foot"><button type="button" class="btn-oak sm" data-reset>${t('reset')}</button><button type="button" class="btn-gold sm" data-close data-show>${t('show').replace('{n}', '')}</button></div>
</aside>
<div class="st-main">
<div class="st-bar"><h2 class="st-title">${t('all')} <i class="st-total"></i></h2><label class="st-sort"><span class="muted">${t('sort')}</span><select name="sort"><option value="pop">${t('s_pop')}</option><option value="cheap">${t('s_cheap')}</option><option value="dear">${t('s_dear')}</option><option value="new">${t('s_new')}</option></select></label></div>
<div class="shop-cat st-grid" aria-busy="true" aria-live="polite"></div>
<p class="st-empty muted" hidden>${t('empty')}</p>
<div class="st-pay panel"><h3>${t('step3')}</h3><p>${T(t('pay3'), lang)}</p><p class="shop-legal muted">${ru ? `Цены — в рублях, 1 дублон = 1 ₽. Дублоны и предметы — цифровые товары игры: они остаются на счёте капитана и не обмениваются обратно на деньги. Продавец: ${SELLER.name[1]}, ИНН ${SELLER.inn}, ОГРНИП ${SELLER.ogrnip}. Поддержка: <a href="mailto:${SELLER.support}">${SELLER.support}</a>.` : `Prices are in roubles, 1 doubloon = 1 ₽. Doubloons and items are the game’s digital goods: they stay on the captain’s account and are not exchanged back for money. Seller: ${SELLER.name[0]}, INN ${SELLER.inn}, OGRNIP ${SELLER.ogrnip}. Support: <a href="mailto:${SELLER.support}">${SELLER.support}</a>.`}</p></div>
</div></div>
<button type="button" class="st-tab" aria-controls="st-filters" aria-expanded="false"><img src="${K('ico/spyglass')}" alt="" width="22" height="22"><span>${t('filters')}</span><i class="st-badge" hidden></i></button>
<div class="st-backdrop" hidden></div>
<div class="pd" role="dialog" aria-modal="true" aria-labelledby="pd-title" hidden><div class="pd-back" data-pd-close></div>
<div class="pd-box" tabindex="-1"><div class="pd-grab" aria-hidden="true"><span></span></div>
<div class="pd-top"><button type="button" class="pd-nav" data-pd-nav="-1" aria-label="${esc(t('prev'))}"><span aria-hidden="true">‹</span></button><span class="pd-pos muted" aria-live="polite"></span><button type="button" class="pd-nav" data-pd-nav="1" aria-label="${esc(t('next'))}"><span aria-hidden="true">›</span></button>
<button type="button" class="pd-link" data-pd-copy aria-label="${esc(t('copy'))}"><img src="${K('ico/link')}" alt="" width="20" height="20"></button><button type="button" class="pd-x" data-pd-close aria-label="${esc(t('close'))}">×</button></div>
<div class="pd-scroll"></div>
<div class="pd-foot"><p class="pd-err" role="alert" hidden></p><div class="pd-who"></div><div class="pd-buy"></div></div></div></div>
<div class="st-confirm" role="dialog" aria-modal="true" aria-labelledby="st-confirm-h" hidden><div class="st-confirm-in panel"><h3 id="st-confirm-h">${t('confirm')}</h3><div class="st-confirm-what"></div>
<div class="st-confirm-act"><button type="button" class="btn-oak sm" data-cancel>${t('cancel')}</button><button type="button" class="btn-gold sm" data-pay></button></div><p class="shop-legal muted">${legalLine}</p></div></div>
</section>
${dataTag('shop-data', { lang, t: tr(SHOP_T), art, tabs: WEB_TABS.map((id) => ({ id, name: L(lang, WEB_TAB_NAMES[id]) })), secs: Object.fromEntries(Object.entries(WEB_SECS).map(([k, v]) => [k, L(lang, v)])), subs: Object.fromEntries(COS_SUBS.map((s) => [s, L(lang, COS_SUB_NAMES[s])])), cos: { portraits: Object.fromEntries(CAPTAIN_IDS.map((id) => [id, portraitOf(id)])), names: capNames(lang), ...avatarData() }, coin: K('ico/doubloon'), sea: seaData() })}`;
  return page(lang, {
    path: 'shop/', active: 'shop', title: ru ? 'Магазин GRAVETIDE — дублоны, корабли, существа, косметика' : 'GRAVETIDE Shop — doubloons, ships, creatures, cosmetics',
    desc: ru ? 'Всё из премиум-лавки игры: дублоны, капитаны, корабли, существа, ускорители, наборы, косметика и акции. Введите ник, выберите товар и оплатите.' : 'Everything of the game’s premium shop: doubloons, captains, ships, creatures, boosters, supplies, cosmetics and offers. Enter the name, choose, pay.',
    hero: { img: K('hero/cabin'), kicker: ru ? 'Каюта казначея' : 'The purser’s cabin', title: ru ? 'Магазин' : 'Shop', lead: ru ? 'Всё, что продаётся в игре: ник капитана, товар, оплата — и покупка уже на счёте. Без входа и без установки.' : 'Everything the game sells: the captain’s name, the item, the payment — and it is on the account. No sign-in, nothing to install.', mini: true },
    body, css: '/site/css/shop.css', script: '/site/js/shop.js',
  });
}

// ------------------------------------------------------------------------------------------------ the legal pages

const DOC_ICON: Record<DocId, string> = { offer: 'ico/scroll', terms: 'ico/official', privacy: 'ico/locked', consent: 'ico/quest', cookies: 'ico/tools', refunds: 'ico/silver', contacts: 'ico/messages' };

/** The legal documents (tools/site/legal.ts): every one in both languages, the seller's details, dated 2026-10-20. */
function legal(lang: Lang, id: DocId): string {
  const ru = lang === 'ru';
  const r = root(lang);
  const d = LEGAL[lang][id];
  const para = (p: string | string[]) => (Array.isArray(p) ? `<ul>${p.map((li) => `<li>${T(li, lang)}</li>`).join('')}</ul>` : `<p>${T(p, lang).replace(/([a-z]+@gravetidegame\.com)/g, '<a href="mailto:$1">$1</a>')}</p>`);
  const reqs = `<dl class="reqs">${REQUISITES(ru).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v.includes('@gravetidegame.com') ? `<a href="mailto:${v}">${v}</a>` : v.startsWith('+7') ? `<a href="tel:${v.replace(/[^\d+]/g, '')}">${esc(v)}</a>` : esc(v)}</dd>`).join('')}</dl>`;
  const tabs = `<nav class="legal-tabs" aria-label="${ru ? 'Документы' : 'Documents'}">${DOC_IDS.map((x) => `<a href="${r}${x}/"${x === id ? ' class="on" aria-current="page"' : ''}><img src="${K(DOC_ICON[x])}" alt="" width="18" height="18">${esc(L(lang, DOC_TITLES[x]))}</a>`).join('')}</nav>`;
  const sections = d.sections.map(([h, ps]) => `<section><h2>${T(h, lang)}</h2>${ps.map(para).join('')}</section>`).join('');
  const tail = id === 'contacts' ? `<section><h2>${ru ? 'Реквизиты' : 'Details'}</h2>${reqs}</section>` : `<section><h2>${ru ? 'Реквизиты' : 'The seller'}</h2>${reqs}</section>`;
  const body = `<section class="wrap sec">${tabs}<article class="legal panel"><p class="lead">${T(d.lead, lang)}</p><p class="legal-ed muted">${L(lang, EDITION)}</p>${sections}${tail}<p class="back"><a class="btn-oak sm" href="${r}shop/">${ru ? '← В магазин' : '← To the shop'}</a></p></article></section>`;
  const title = L(lang, DOC_TITLES[id]);
  return page(lang, {
    path: `${id}/`, active: id, title: `${title} — GRAVETIDE`, desc: d.lead,
    hero: { img: K('hero/forum'), kicker: ru ? 'Документы' : 'Documents', title, mini: true },
    body, css: '/site/css/shop.css',
  });
}

// ------------------------------------------------------------------------------------------------ the forum's shell

/** The forum (docs/32_FORUM.md) is one page: the site's header, hero and footer around #forum, which
 *  client/src/forum/main.ts fills by the address (the server answers every /site/forum/… with this page). */
function forum(lang: Lang): string {
  return page(lang, {
    path: 'forum/', active: 'forum', title: lang === 'ru' ? 'Форум GRAVETIDE' : 'GRAVETIDE Forum',
    desc: lang === 'ru' ? 'Форум капитанов GRAVETIDE: новости, гайды, обсуждения, торговля и ошибки.' : 'The GRAVETIDE captains’ forum: news, guides, discussions, trade and bug reports.',
    hero: { img: K('hero/forum'), kicker: lang === 'ru' ? 'Таверна капитанов' : 'The captains’ tavern', title: lang === 'ru' ? 'Форум GRAVETIDE' : 'GRAVETIDE Forum', mini: true },
    body: '<div id="forum" class="wrap f-root"></div>', css: '/site/css/forum.css', script: '/src/forum/main.ts',
  });
}

// ------------------------------------------------------------------------------------------------ write

const WRITTEN: string[] = [];
function write(rel: string, html: string): void {
  if (rel.endsWith('.html')) WRITTEN.push(rel);
  const f = join(SITE, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
}

let n = 0;
for (const lang of ['ru', 'en'] as Lang[]) {
  const base = lang === 'ru' ? '' : 'en/';
  write(`${base}index.html`, home(lang));
  write(`${base}creatures/index.html`, bestiary(lang));
  write(`${base}captains/index.html`, captains(lang));
  write(`${base}ships/index.html`, ships(lang));
  write(`${base}forum/index.html`, forum(lang));
  write(`${base}rating/index.html`, rating(lang));
  write(`${base}shop/index.html`, shop(lang));
  for (const d of DOC_IDS) write(`${base}${d}/index.html`, legal(lang, d));
  for (const c of CREATURES) write(`${base}creatures/${c.id}.html`, creaturePage(c, lang));
  n += 6 + DOC_IDS.length + CREATURES.length;
}
// The sitemap (each page with its other tongue as an hreflang pair) and robots.txt; static.ts serves both at the root.
{
  const NL = '\n';
  const today = new Date().toISOString().slice(0, 10);
  const pages = WRITTEN.filter((r) => !r.startsWith('en/')).map((r) => r.replace(/index\.html$/, ''));
  const prio = (p: string) => (p === '' ? '1.0' : /^[a-z]+\/$/.test(p) ? '0.8' : '0.6');
  const alt = (p: string) => `<xhtml:link rel="alternate" hreflang="ru" href="${pageUrl('ru', p)}"/><xhtml:link rel="alternate" hreflang="en" href="${pageUrl('en', p)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('ru', p)}"/>`;
  const urls = pages.flatMap((p) => (['ru', 'en'] as Lang[]).map((lang) => `<url><loc>${pageUrl(lang, p)}</loc><lastmod>${today}</lastmod><changefreq>${p === '' || p === 'forum/' ? 'daily' : 'weekly'}</changefreq><priority>${prio(p)}</priority>${alt(p)}</url>`));
  writeFileSync(join(SITE, 'sitemap.xml'), ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', ...urls, '</urlset>', ''].join(NL));
  const shut = ['Disallow: /api/', 'Disallow: /ops/', 'Disallow: /telemetry/', 'Disallow: /auth/', 'Disallow: /tg/', 'Disallow: /site/forum/search', 'Disallow: /site/en/forum/search'];
  writeFileSync(join(SITE, 'robots.txt'), ['User-agent: *', 'Allow: /', ...shut, '', 'User-agent: Yandex', 'Allow: /', ...shut, 'Clean-param: n&kit&ref /', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join(NL));
  console.log(`sitemap: ${urls.length} addresses`);
}
console.log(`site: ${n} pages, ${CREATURES.length} creatures`);
