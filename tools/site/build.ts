// The game's website (owner, 2026-10-18): «сайт для игры… со своей библиотекой существ, описаны фишки… максимально
// графичный, всё пиратское». Every page is written from the game's own tables, so the bestiary, the captains and the
// fleet never fall behind the game. RU at /site/, EN at /site/en/.
//
//   node --disable-warning=ExperimentalWarning tools/site/build.ts
//
// The art is the game's own (/assets/…) plus the site kit cut by tools/site/slice_kit.py (site/img/…).

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
const specialName = (s: string): Tr => [(ARMY_EN as Record<string, string>)[`sp.${s}`] ?? s, (ARMY_RU as Record<string, string>)[`sp.${s}`] ?? s];
const specialNote = (s: string): Tr => [(ARMY_EN as Record<string, string>)[`spd.${s}`] ?? '', (ARMY_RU as Record<string, string>)[`spd.${s}`] ?? ''];

// ------------------------------------------------------------------------------------------------ the frame

const UI: Record<string, Tr> = {
  home: ['Home', 'Главная'], creatures: ['Bestiary', 'Бестиарий'], captains: ['Captains', 'Капитаны'], ships: ['Fleet', 'Флот'],
  forum: ['Forum', 'Форум'], play: ['Play', 'Играть'], playFree: ['Play free', 'Играть бесплатно'], tg: ['Play in Telegram', 'Играть в Telegram'],
  all: ['All', 'Все'], search: ['Search by name…', 'Поиск по имени…'], tier: ['Tier', 'Уровень'],
  atk: ['Attack', 'Атака'], def: ['Defence', 'Защита'], dmg: ['Damage', 'Урон'], hp: ['Health', 'Здоровье'], speed: ['Speed', 'Скорость'],
  init: ['Initiative', 'Инициатива'], shots: ['Shots', 'Выстрелы'], cost: ['Cost', 'Цена'], abilities: ['Abilities', 'Способности'],
  found: ['Where to find', 'Где встречается'], upgrade: ['Upgrades into', 'Улучшается до'], from: ['Upgraded from', 'Улучшение из'],
  back: ['← Bestiary', '← Бестиарий'], poses: ['In battle', 'В бою'], none: ['Nothing found', 'Ничего не нашлось'],
  footer: ['A dark Pirate Gothic sea: a ship is an army, a captain is a hero, boarding is a battle.', 'Мрачное море Pirate Gothic: корабль — армия, капитан — герой, абордаж — битва.'],
  silver: ['silver', 'серебра'], doubloons: ['doubloons', 'дублонов'], guns: ['Guns a side', 'Пушек на борт'], hull: ['Hull', 'Корпус'],
  crew: ['Crew', 'Команда'], rank: ['Rank', 'Ранг'], premium: ['Premium', 'Премиум'],
};
const u = (k: string, lang: Lang) => L(lang, UI[k]);
const root = (lang: Lang) => (lang === 'ru' ? '/site/' : '/site/en/');

interface Hero { img: string; imgM?: string; kicker: string; title: string; lead?: string; cta?: boolean; tall?: boolean; mini?: boolean }

function header(lang: Lang, active: string, path: string): string {
  const r = root(lang);
  const nav = [['', 'home', 'ico/home'], ['creatures/', 'creatures', 'ico/creatures'], ['captains/', 'captains', 'ico/captains'], ['ships/', 'ships', 'ico/ships'], ['forum/', 'forum', 'ico/forum']] as const;
  const other = lang === 'ru' ? `/site/en/${path}` : `/site/${path}`;
  return `<header class="hdr"><div class="hdr-pill">
<a class="hdr-logo" href="${r}" aria-label="GRAVETIDE"><img src="${K('brand/logo')}" alt="GRAVETIDE" width="120" height="96"></a>
<nav class="hdr-nav" id="nav">${nav.map(([href, k, ic]) => `<a href="${r + href}"${active === k ? ' class="on" aria-current="page"' : ''}><img src="${K(ic)}" alt="" width="22" height="22">${u(k, lang)}</a>`).join('')}</nav>
<div class="hdr-end"><a class="hdr-lang" href="${other}" hreflang="${lang === 'ru' ? 'en' : 'ru'}">${lang === 'ru' ? 'EN' : 'RU'}</a>
<a class="hdr-soc" href="https://t.me/gravetide_bot" target="_blank" rel="noopener" aria-label="Telegram"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg></a>
<a class="btn-gold sm" href="/play">${u('play', lang)}</a>
<button class="hdr-burger" aria-label="Menu" aria-controls="nav" aria-expanded="false"><span></span><span></span><span></span></button></div>
</div></header>`;
}

function heroBlock(h: Hero, lang: Lang): string {
  return `<section class="hero${h.tall ? ' tall' : ''}${h.mini ? ' mini' : ''}"><picture class="hero-art">${h.imgM ? `<source media="(max-width: 700px)" srcset="${h.imgM}">` : ''}<img src="${h.img}" alt="" fetchpriority="high"></picture>
<div class="hero-in wrap"><p class="kicker">${T(h.kicker, lang)}</p><h1>${T(h.title, lang)}</h1>${h.lead ? `<p class="lead">${T(h.lead, lang)}</p>` : ''}
${h.cta ? `<div class="hero-cta"><a class="btn-gold lg" href="/play">${u('playFree', lang)}</a><a class="btn-oak" href="https://t.me/gravetide_bot" target="_blank" rel="noopener">${u('tg', lang)}</a></div>` : ''}</div></section>`;
}

function page(lang: Lang, o: { path: string; active: string; title: string; desc: string; hero: Hero; body: string; css?: string; script?: string }): string {
  const r = root(lang);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.desc)}"><meta name="theme-color" content="#07090f">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:image" content="${o.hero.img}">
<link rel="icon" href="${K('brand/icon')}"><link rel="alternate" hreflang="ru" href="/site/${o.path}"><link rel="alternate" hreflang="en" href="/site/en/${o.path}">
<link rel="preload" href="/site/fonts/cormorantsc-700-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site/css/fonts.css"><link rel="stylesheet" href="/site/css/site.css">${o.css ? `<link rel="stylesheet" href="${o.css}">` : ''}</head>
<body class="pg-${o.active}">${header(lang, o.active, o.path)}
<main>${heroBlock(o.hero, lang)}${o.body}</main>
<footer class="ftr"><div class="wrap ftr-in"><img src="${K('brand/logo')}" alt="GRAVETIDE" width="110" height="88" loading="lazy">
<p>${T(u('footer', lang), lang)}</p><nav><a href="${r}creatures/">${u('creatures', lang)}</a><a href="${r}captains/">${u('captains', lang)}</a><a href="${r}ships/">${u('ships', lang)}</a><a href="${r}forum/">${u('forum', lang)}</a><a href="/play">${u('play', lang)}</a></nav>
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
<div class="hero-cta"><a class="btn-gold lg" href="/play">${u('playFree', lang)}</a><a class="btn-oak" href="/site/forum/">${u('forum', lang)}</a></div></div></section>`;
  return page(lang, {
    path: '', active: 'home', title: lang === 'ru' ? 'GRAVETIDE — пиратские «Герои» в море Pirate Gothic' : 'GRAVETIDE — pirate Heroes on a Pirate Gothic sea',
    desc: lang === 'ru' ? 'Онлайн-песочница про пиратов: корабль — армия, капитан — герой, абордаж — пошаговая битва на гексах.' : 'An online pirate sandbox: a ship is an army, a captain is a hero, boarding is a turn-based hex battle.',
    hero: { img: K('hero/home'), imgM: K('hero/home_m'), kicker: lang === 'ru' ? 'Онлайн-песочница · Pirate Gothic' : 'Online sandbox · Pirate Gothic', title: lang === 'ru' ? 'Море помнит каждого капитана' : 'The sea remembers every captain', lead: lang === 'ru' ? 'Соберите армию в трюме, отстройте остров, возьмите на абордаж флагман и поднимитесь на Престол глубин.' : 'Raise an army in your hold, build your island, board a flagship and climb to the Throne of the Deep.', cta: true, tall: true },
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
  const body = `<section class="wrap sec"><div class="cdet" style="--tint:${g.color}">
<div class="cdet-art reveal"><div class="stage">${c.poses.length > 1 ? c.poses.slice(0, 2).map((p, i) => `<img src="${p}" alt="${i ? '' : esc(L(lang, c.name))}" class="pose p${i}"${i ? ' aria-hidden="true"' : ''}>`).join('') : img(c.figure, L(lang, c.name), 'pose p0', false)}</div>
${c.poses.length > 2 ? `<div class="poses"><span>${u('poses', lang)}</span>${c.poses.map((p) => `<img src="${p}" alt="" loading="lazy">`).join('')}</div>` : ''}</div>
<div class="cdet-info reveal"><p class="kicker"><img src="${K(g.icon)}" alt="" width="18" height="18"> ${esc(c.roster ? L(lang, rosterName(c.roster)) : L(lang, g.name))}</p>
${L(lang, c.note) ? `<p class="lore">${T(L(lang, c.note), lang)}</p>` : ''}
<div class="stats panel">${stat('tier', c.u.tier, lang)}${stat('atk', c.u.atk, lang)}${stat('def', c.u.def, lang)}${stat('dmg', `${c.u.dmin}–${c.u.dmax}`, lang)}${stat('hp', c.u.hp, lang)}${stat('speed', c.u.speed, lang)}${stat('init', c.u.init, lang)}${c.u.shots ? stat('shots', c.u.shots, lang) : ''}${stat('cost', prem ? `${prem.price} ${u('doubloons', lang)}` : `${c.u.cost} ${u('silver', lang)}`, lang)}</div>
${c.u.specials.length ? `<h3>${u('abilities', lang)}</h3><ul class="abil">${c.u.specials.map((s) => `<li><b>${esc(L(lang, specialName(s)))}</b><span>${T(L(lang, specialNote(s)), lang)}</span></li>`).join('')}</ul>` : ''}
${c.lairs.length ? `<h3>${u('found', lang)}</h3><p class="tags">${c.lairs.map((l) => `<span class="tag">${esc(L(lang, l))}</span>`).join('')}</p>` : ''}
${up ? `<h3>${u('upgrade', lang)}</h3><p>${up}</p>` : ''}${base ? `<h3>${u('from', lang)}</h3><p>${base}</p>` : ''}
<p class="back"><a class="btn-oak sm" href="./">${u('back', lang)}</a></p></div></div></section>`;
  return page(lang, {
    path: `creatures/${c.id}.html`, active: 'creatures', title: `${L(lang, c.name)} — ${lang === 'ru' ? 'бестиарий' : 'bestiary'} GRAVETIDE`,
    desc: L(lang, c.note) || L(lang, c.name), hero: { img: K('hero/bestiary'), kicker: `${u('creatures', lang)} · ${u('tier', lang)} ${c.u.tier}`, title: L(lang, c.name), mini: true }, body,
  });
}

const capRu = (id: string, k: string, en: string) => DATA_RU[`captains.CAPTAINS.${id}.${k}`] ?? en;
function capMini(id: string, lang: Lang): string {
  const c = (CAPTAINS as Record<string, { name: string; archetype: string }>)[id];
  return `<a class="cap reveal" href="${root(lang)}captains/#${id}"><span class="cap-ring">${img(asset(`portrait.${id}`), c.name)}</span><b>${esc(lang === 'ru' ? capRu(id, 'name', c.name) : c.name)}</b><i>${esc(lang === 'ru' ? capRu(id, 'archetype', c.archetype) : c.archetype)}</i></a>`;
}

function captains(lang: Lang): string {
  const body = `<section class="wrap sec caps">${CAPTAIN_IDS.map((id, i) => {
    const c = CAPTAINS[id] as unknown as { name: string; epithet?: string; archetype: string; bio: string; playstyle: string; premium?: unknown; passive: { name: string; description: string }; abilities: { name: string; description: string }[] };
    const tr = (k: string, en: string) => (lang === 'ru' ? capRu(id, k, en) : en);
    return `<article class="capcard panel reveal${i % 2 ? ' flip' : ''}" id="${id}"><div class="capcard-art">${img(asset(`unit.hero_${id}`) ?? asset(`portrait.${id}`), c.name, 'fig')}<span class="cap-ring big">${img(asset(`portrait.${id}`), c.name)}</span></div>
<div class="capcard-txt"><p class="kicker">${esc(tr('archetype', c.archetype))}${c.premium ? ` · <span class="gold">${u('premium', lang)}</span>` : ''}</p><h2>${esc(tr('name', c.name))}</h2>${c.epithet ? `<p class="epithet">«${esc(tr('epithet', c.epithet))}»</p>` : ''}
<p>${T(tr('bio', c.bio), lang)}</p><p class="muted">${T(tr('playstyle', c.playstyle), lang)}</p>
<div class="passive"><img src="${K('ico/star')}" alt="" width="28" height="28"><div><b>${esc(tr('passive.name', c.passive.name))}</b><span>${T(tr('passive.description', c.passive.description), lang)}</span></div></div>
<ul class="abil">${c.abilities.map((a, k) => `<li><b>${esc(tr(`abilities.${k}.name`, a.name))}</b><span>${T(tr(`abilities.${k}.description`, a.description), lang)}</span></li>`).join('')}</ul></div></article>`;
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

function write(rel: string, html: string): void {
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
  for (const c of CREATURES) write(`${base}creatures/${c.id}.html`, creaturePage(c, lang));
  n += 4 + CREATURES.length;
}
console.log(`site: ${n} pages, ${CREATURES.length} creatures`);
