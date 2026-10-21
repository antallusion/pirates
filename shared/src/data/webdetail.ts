// The website's shop: a thing's whole card (owner, 2026-10-21: «на тапу или нажатию я хочу видеть модалку красивую с
// иконками и описанием всех существ, кораблей, пекеджей. должны быть подробные характеристики и все должно быть сделано
// удобно и на мобиле и везде»). Everything is read from the game's own tables, the words in both languages:
//
//   a hull       her class and role, her numbers against the hulls of her list (hull, sails, speed, turn, guns a side,
//                stacks, crew, hold, armour), her trait and her premium gift (its kind and what it does), her own
//                creatures with their numbers, the level she needs, how she is delivered;
//   a creature   its figure and its blow, tier, people, roles, numbers against its tier, specials, its once-a-battle
//                ability (icon.sk_*) with its numbers, ranged or steel and its missile, the packs and a head's price;
//   a captain    the portrait, the story, the trait, the four abilities with their numbers, what she starts with;
//   a bundle     every good inside with its icon and quantity, its worth against the price, the limits and the season;
//   a cosmetic   what other captains see (the plate with its words, the frame round a face, the flag on a ship, the
//                wake, the emotes) and how it is had;
//   doubloons    the amount, the bonus, and what they buy.
//
// The server answers it (GET /api/site/shop/item?id=, server/src/http/site-routes.ts) with the pictures' addresses;
// the page draws it (site/js/shop.js). Public things only: no captain's, no order's.

import { UNITS } from './army.ts';
import type { UnitDef, UnitId } from './army.ts';
import { armySlots } from './army.ts';
import { CAPTAINS, CAPTAIN_PRICE } from './captains.ts';
import type { CaptainId } from './captains.ts';
import { CLOTHS, COS_EMOTES, EMBLEMS, EMOTE_PACKS, FRAMES, PLATES, TITLES, TRAILS, cosItem, cosPrice } from './cosmetics.ts';
import type { CosItem } from './cosmetics.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { DOUBLOON_PACKS } from './premium.ts';
import { PREMIUM_NAMES, PREMIUM_PEOPLE, isPremiumBeast, premiumFrom } from './premiumbeasts.ts';
import { OFFERS, RECRUIT_KINDS, offerBonus, unitPacks, worthOf } from './shop.ts';
import type { ShopGrant, ShopOffer } from './shop.ts';
import { AMMO, GUNS, SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { SHIP_BEAST_NAMES, isShipBeast, shipBeastHull } from './shipbeasts.ts';
import { giftOf } from './shipgifts.ts';
import type { ShipGift } from './shipgifts.ts';
import { captainLevelFor, levelRange } from './shiplevel.ts';
import { MAGIC_SHOTS, SKILLS, shotOf, skillOf, skillVars } from './creatureskills.ts';
import { WEB_ITEMS, WEB_SECS, WEB_TAB_NAMES, dealItem, shipName, unitNames, webItem } from './webshop.ts';
import type { WebItem } from './webshop.ts';
import { DATA_RU_CORE } from '../../../client/src/lang/data.ru.ts';
import { DATA_RU_FLEET } from '../../../client/src/lang/data.fleet.ru.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../../client/src/lang/ui/army.ts';
import { EN as SK_EN, RU as SK_RU } from '../../../client/src/lang/ui/skills.ts';
import { EN as FL_EN, RU as FL_RU } from '../../../client/src/lang/ui/fleet.ts';

type Tr = [string, string];
/** A picture's address (or null: none painted). */
type Img = string | null;
/** How the site finds a picture: an asset id of the manifest (icon.…, unit.…) → its address; a site kit path as is. */
export type ArtOf = (id: string) => Img;

/** A number of the card: its icon, name, value as written; a bar's own value and the range it is set against. */
export interface DStat { k: string; icon: Img; name: Tr; v: Tr; n?: number; lo?: number; hi?: number; hint?: Tr }
/** An ability, a trait or a gift: its icon, name, a tag (its kind, its key), what it does, and its numbers. */
export interface DAbil { k: string; icon: Img; name: Tr; tag?: Tr; text: Tr; nums?: { name: Tr; v: Tr }[] }
/** A chip (a special, a role, a limit). */
export interface DChip { k: string; icon: Img; name: Tr; hint?: Tr; tone?: 'gold' | 'ice' | 'red' | 'green' }
/** A creature on the card (a hull's own, a recruiter's kind): its figure, numbers, ability. */
export interface DUnit { id: string; art: Img; name: Tr; n?: number; up?: number; tier: number; stats: DStat[]; chips: DChip[]; skill?: DAbil }
/** A good of a bundle: its icon, name and quantity (a cosmetic's swatch for a cloth or a wake). */
export interface DLine { k: string; icon: Img; name: Tr; qty: Tr; swatch?: string; hint?: Tr }
/** A cosmetic as other captains see it. */
export interface DCos {
  k: 'title' | 'plate' | 'frame' | 'emblem' | 'cloth' | 'trail' | 'emote';
  name: Tr;
  art?: Img;
  /** A title's words (on its plate), a plate's sample words. */
  words?: Tr;
  plate?: Img;
  ink?: string;
  halo?: string;
  /** A frame: the face inside and how much wider the frame is drawn than the face. */
  face?: Img;
  scale?: number;
  /** A flag: its cloth colour, its emblem, the ship under it. */
  rgb?: string;
  emblem?: Img;
  ship?: Img;
  /** A wake: its two colours and whether it glows. */
  c?: [string, string];
  glow?: boolean;
  emotes?: { art: Img; name: Tr }[];
  /** Sold alone too (its price), or had only in this bundle. */
  alone?: number;
  only?: boolean;
}
export type DBlock =
  | { t: 'bars'; k: string; h?: Tr; note?: Tr; rows: DStat[] }
  | { t: 'tiles'; k: string; h?: Tr; rows: DStat[] }
  | { t: 'abil'; k: string; h?: Tr; rows: DAbil[] }
  | { t: 'chips'; k: string; h?: Tr; rows: DChip[] }
  | { t: 'units'; k: string; h?: Tr; rows: DUnit[] }
  | { t: 'lines'; k: string; h?: Tr; rows: DLine[]; worth?: number; price?: number; save?: number }
  | { t: 'cos'; k: string; h?: Tr; rows: DCos[] }
  | { t: 'text'; k: string; h?: Tr; icon?: Img; body: Tr };
export type DTabId = 'stats' | 'abil' | 'set' | 'look' | 'about';
export interface DTab { id: DTabId; name: Tr; blocks: DBlock[] }
export type DView = 'ship' | 'unit' | 'captain' | 'set' | 'cos' | 'pack';
export interface WebDetail {
  id: string;
  view: DView;
  hero: { art: Img; alt?: Img; cls: 'hull' | 'fig' | 'face' | 'icon' | 'coin' | 'cos'; kicker: Tr; title: Tr; lead: Tr; chips: DChip[]; swatch?: string; label?: Tr; ink?: string; halo?: string };
  tabs: DTab[];
  /** The plain numbers of the card (the tests hold them to the game's tables). */
  facts: Record<string, number | string | boolean>;
}

const TAB_NAMES: Record<DTabId, Tr> = {
  stats: ['Stats', 'Характеристики'], abil: ['Abilities', 'Способности'], set: ['Contents', 'Состав'], look: ['Preview', 'Как выглядит'], about: ['About', 'Описание'],
};
const tab = (id: DTabId, blocks: DBlock[]): DTab => ({ id, name: TAB_NAMES[id], blocks });

// ------------------------------------------------------------------------------------------------ words

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** A decimal as a Russian writes it (a comma) and as an English one does. */
const dec = (n: number, d = 1): Tr => {
  const s = String(Number(n.toFixed(d)));
  return [s, s.replace('.', ',')];
};
const same = (s: string | number): Tr => [String(s), String(s)];
const ruN = (n: number, one: string, few: string, many: string) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const hoursTr = (h: number): Tr => (h >= 48 && h % 24 === 0 ? [`${h / 24} d`, `${h / 24} ${ruN(h / 24, 'день', 'дня', 'дней')}`] : [`${fmt(h)} h`, `${fmt(h)} ч`]);
const daysTr = (d: number): Tr => [`${d} d`, `${d} ${ruN(d, 'день', 'дня', 'дней')}`];
const times = (n: number): Tr => [`×${fmt(n)}`, `×${fmt(n)}`];
const upTo = (n: number): Tr => [`up to ${fmt(n)}`, `до ${fmt(n)}`];
const secs = (s: number): Tr => [`${s} s`, `${s} с`];
const metres = (m: number): Tr => [`${fmt(m)} m`, `${fmt(m)} м`];
const pct = (x: number): Tr => same(`${Math.round(x * 100)}%`);
const rub = (n: number): Tr => [`${fmt(n)} ₽`, `${fmt(n)} ₽`];
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));
const ruData = (key: string, en: string): string => DATA_RU_FLEET[key] ?? DATA_RU_CORE[key] ?? en;
const army = (k: string): Tr => {
  const en = (ARMY_EN as Record<string, string>)[k] ?? k;
  return [en, (ARMY_RU as Record<string, string>)[k] ?? en];
};
const skw = (k: string): Tr => {
  const en = (SK_EN as Record<string, string>)[k] ?? k;
  return [en, (SK_RU as Record<string, string>)[k] ?? en];
};
const flw = (k: string): Tr => [(FL_EN as Record<string, string>)[k] ?? k, (FL_RU as Record<string, string>)[k] ?? k];

// ------------------------------------------------------------------------------------------------ pictures

/** A creature special's picture: the game paints none of its own, so each takes the nearest of the game's icons (the
 *  bestiary's own choice, tools/site/build.ts). */
export const SPECIAL_ICON: Record<string, string> = {
  shooter: 'sp_musket_storm', no_penalty: 'talent_gun_steady_aim', blast: 'sp_powder_keg', double_strike: 'talent_brd_cutlass_drill',
  no_retaliation: 'sp_sm_knives', retaliate_all: 'sp_rv_butcher', leader: 'talent_cmd_inspiring_presence', steady: 'sp_iron_discipline',
  undead: 'sp_dr_brine_kiss', fear: 'sp_dread', sweep: 'talent_brd_boarding_axes', shield_wall: 'sp_shield_wall', shell: 'talent_srv_iron_hull',
  poison: 'sp_foul_water', swarm: 'sp_red_harvest', regen: 'sp_tide_returns', terror: 'talent_brd_terror', flying: 'sp_following_wind',
  diving: 'sp_dr_undertow', mend: 'sp_brine_mend', bind: 'sp_dr_anchor_chain', chill: 'sp_rain_squall', drain: 'sp_dr_drowning_grip',
  breath: 'sp_st_elmos_fire', chain: 'sp_forked_lightning', fortune: 'talent_smg_smugglers_luck',
};
/** The numbers' pictures (the game's own icons; a site kit picture where the game has none). */
const ICON = {
  hull: 'icon.stat_hull', sails: 'icon.stat_sails', speed: 'icon.sp_fair_wind', turn: 'icon.item_ship_wheel', guns: 'icon.ui_cannon',
  chasers: 'icon.gun_long_9', slots: 'icon.ui_cutlasses', crew: 'icon.stat_crew', hold: 'icon.bt_hold', armor: 'icon.item_armoury',
  level: 'icon.ui_anchor', tier: '/site/img/ico/star.webp', atk: 'icon.ui_cutlasses', def: 'icon.bt_defend', dmg: 'icon.sp_powder_keg',
  hp: 'icon.tattoo_heart', move: 'icon.item_seaboots', init: 'icon.ui_hourglass', shots: 'icon.ammo_round', magic: 'icon.sk_chain',
  melee: 'icon.talent_brd_cutlass_drill', people: '/site/img/ico/world.webp', price: '/site/img/ico/doubloon.webp', count: '/site/img/ico/creatures.webp',
  once: '/site/img/ico/locked.webp', clock: '/site/img/ico/clock.webp', gift: '/site/img/ico/gift.webp', trait: '/site/img/ico/star.webp',
  port: '/site/img/ico/anchor.webp', ship: '/site/img/ico/ships.webp', captain: '/site/img/ico/captains.webp', silver: '/site/img/ico/silver.webp',
  doubloon: 'icon.doubloon', quest: '/site/img/ico/quest.webp',
} as const;
const GIFT_ICON: Record<ShipGift['kind'], string> = {
  rally: 'icon.ab_war_cry', strike: 'icon.ammo_incendiary', toll: 'icon.ab_storm_chaser', deck: 'icon.ab_red_hook_boarding', sail: 'icon.sp_fair_wind', trade: 'icon.ui_chest', muster: 'icon.menu_crew',
};

// ------------------------------------------------------------------------------------------------ the creatures

const BAR_KEYS = ['hp', 'atk', 'def', 'dmg', 'speed', 'init'] as const;
/** The kinds a creature is set against on its bars: the sea's and the shop's of its tier (no boss, titan nor legend). */
function tierRange(tier: number): Record<(typeof BAR_KEYS)[number], [number, number]> {
  const xs = (Object.values(UNITS) as UnitDef[]).filter((u) => u.tier === tier && !u.titan && !u.legend && !(u.id as string).startsWith('boss_'));
  const r = (f: (u: UnitDef) => number): [number, number] => [Math.min(...xs.map(f)), Math.max(...xs.map(f))];
  return { hp: r((u) => u.hp), atk: r((u) => u.atk), def: r((u) => u.def), dmg: r((u) => (u.dmin + u.dmax) / 2), speed: r((u) => u.speed), init: r((u) => u.init) };
}
const unitNote = (u: UnitId): Tr => {
  const p = (PREMIUM_NAMES as Record<string, string[]>)[u] ?? (SHIP_BEAST_NAMES as Record<string, string[]>)[u];
  if (p) return [p[2] ?? '', p[3] ?? p[2] ?? ''];
  return army(`ud.${u}`).map((s) => (s.startsWith('ud.') ? '' : s)) as Tr;
};
const unitArt = (u: UnitId, art: ArtOf): Img => art(`unit.${u}`) ?? art(UNITS[u].art);

function unitStats(d: UnitDef): DStat[] {
  const r = tierRange(d.tier);
  const bar = (k: (typeof BAR_KEYS)[number], name: Tr, n: number, v: Tr): DStat => ({ k, icon: ICON[k === 'speed' ? 'move' : k], name, v, n, lo: r[k][0], hi: r[k][1] });
  const out = [
    bar('hp', ['Health', 'Здоровье'], d.hp, same(d.hp)),
    bar('atk', ['Attack', 'Атака'], d.atk, same(d.atk)),
    bar('def', ['Defence', 'Защита'], d.def, same(d.def)),
    bar('dmg', ['Damage', 'Урон'], (d.dmin + d.dmax) / 2, same(`${d.dmin}–${d.dmax}`)),
    bar('speed', ['Speed', 'Скорость'], d.speed, same(d.speed)),
    bar('init', ['Initiative', 'Инициатива'], d.init, same(d.init)),
  ];
  if (d.shots) out.push({ k: 'shots', icon: ICON.shots, name: ['Shots', 'Выстрелы'], v: same(d.shots) });
  return out;
}
/** A creature's specials as chips, with what each does. */
const specialChips = (d: UnitDef, art: ArtOf): DChip[] =>
  d.specials.map((s) => ({ k: s, icon: SPECIAL_ICON[s] ? art(`icon.${SPECIAL_ICON[s]}`) : null, name: army(`sp.${s}`), hint: army(`spd.${s}`).map((x) => (x.startsWith('spd.') ? '' : x)) as Tr }));
/** Its once-a-battle ability with its numbers filled in. */
function skillAbil(u: UnitId, art: ArtOf): DAbil | undefined {
  const id = skillOf(u);
  if (!id) return undefined;
  const d = SKILLS[id];
  const v = skillVars(id);
  const text = skw(`d.${id}`).map((s) => fill(s, v)) as Tr;
  const nums: { name: Tr; v: Tr }[] = [];
  if (v.k) nums.push({ name: ['Of her blow', 'От её удара'], v: same(`${v.k}%`) });
  if (v.ring) nums.push({ name: ['On the rest', 'По остальным'], v: same(`${v.ring}%`) });
  if (v.heal) nums.push({ name: ['Heal', 'Лечение'], v: same(`${v.heal}%`) });
  if (v.cap) nums.push({ name: ['At most', 'Не больше'], v: same(`${v.cap}%`) });
  if (d.range) nums.push({ name: ['Reach', 'Дальность'], v: [`${d.range} hexes`, `${d.range} ${ruN(d.range, 'клетка', 'клетки', 'клеток')}`] });
  if (d.n) nums.push({ name: ['Count', 'Число'], v: same(d.n) });
  if (d.rounds !== undefined || ['ward', 'bulwark', 'haste', 'rally', 'toast', 'slow', 'freeze', 'curse', 'mark', 'ink', 'taunt', 'frenzy', 'entangle', 'toll'].includes(id)) nums.push({ name: ['Rounds', 'Раундов'], v: same(v.r) });
  return {
    k: id, icon: art(d.art) ?? art(d.icon), name: skw(`n.${id}`),
    tag: d.aim === 'death' ? skw('passive') : skw('ready'), text, nums,
  };
}
/** Steel or shot, and its missile. */
function rangedChip(d: UnitDef): DChip {
  if (!d.shots) return { k: 'melee', icon: ICON.melee, name: ['Melee', 'Ближний бой'], hint: ['Fights hand to hand.', 'Бьётся вплотную.'] };
  const kind = shotOf(d.id);
  const magic = MAGIC_SHOTS.has(kind);
  return { k: 'ranged', icon: magic ? ICON.magic : ICON.shots, name: magic ? ['Ranged, magic', 'Стрелок, магия'] : ['Ranged', 'Стрелок'], hint: skw('ranged').map((s, i) => fill(s, { kind: skw(`sh.${kind}`)[i], n: d.shots })) as Tr, tone: 'ice' };
}
/** The roles a creature plays, read from its numbers, specials and ability. */
function roleChips(d: UnitDef): DChip[] {
  const out: DChip[] = [];
  const s = skillOf(d.id);
  const sp = new Set(d.specials);
  if (sp.has('flying')) out.push({ k: 'fly', icon: null, name: ['Flier', 'Летает'] });
  if (s && ['mend', 'mass_mend', 'raise', 'cleanse'].includes(s)) out.push({ k: 'heal', icon: null, name: ['Healer', 'Лекарь'], tone: 'green' });
  if (s && SKILLS[s].control) out.push({ k: 'ctrl', icon: null, name: ['Control', 'Контроль'] });
  if (s && ['chain', 'fireball', 'firepot', 'cone', 'pierce', 'volley', 'toll', 'tidal'].includes(s)) out.push({ k: 'aoe', icon: null, name: ['Area harm', 'Урон по площади'], tone: 'red' });
  if (s && ['ward', 'bulwark', 'haste', 'rally', 'toast'].includes(s)) out.push({ k: 'aid', icon: null, name: ['Support', 'Поддержка'] });
  if (sp.has('shield_wall') || sp.has('shell') || sp.has('steady') || d.def >= d.atk * 1.3) out.push({ k: 'tank', icon: null, name: ['Defender', 'Защитник'] });
  if (sp.has('double_strike') || sp.has('no_retaliation') || sp.has('sweep') || d.atk >= d.def * 1.3) out.push({ k: 'dps', icon: null, name: ['Striker', 'Ударный'], tone: 'red' });
  if (sp.has('leader')) out.push({ k: 'lead', icon: null, name: ['Leader', 'Вожак'], tone: 'gold' });
  return out;
}
/** Whose it is: the shop's people (sea or land), a hull's company, the line kinds. */
function peopleOf(u: UnitId): Tr {
  if (isPremiumBeast(u)) return PREMIUM_PEOPLE[u] === 'land' ? ['Legendary hire · the land', 'Легендарный найм · суша'] : ['Legendary hire · the sea', 'Легендарный найм · море'];
  if (isShipBeast(u)) {
    const h = shipBeastHull(u);
    return h ? [`Companion of the ${shipName(h)[0]}`, `Спутник корабля «${shipName(h)[1]}»`] : ['Ship companion', 'Спутник корабля'];
  }
  return ['Pirate crew', 'Пиратская команда'];
}
function unitCard(u: UnitId, art: ArtOf, n?: number): DUnit {
  const d = UNITS[u];
  const skill = skillAbil(u, art);
  return { id: u, art: unitArt(u, art), name: unitNames(u), ...(n !== undefined ? { n } : {}), tier: d.tier, stats: unitStats(d), chips: [rangedChip(d), ...specialChips(d, art)], ...(skill ? { skill } : {}) };
}

// ------------------------------------------------------------------------------------------------ the goods of a bundle

const RES_NAMES: Record<string, Tr> = {
  timber: ['Timber', 'Брёвна'], coal: ['Coal and stone', 'Уголь и камень'], tar: ['Pine tar', 'Смола'], iron: ['Iron', 'Железо'], provisions: ['Island provisions', 'Провизия острова'],
};
const goodName = (g: string): Tr => {
  const en = (GOODS as Record<string, { name: string }>)[g]?.name ?? g;
  return [en, ruData(`goods.GOODS.${g}.name`, en)];
};
/** One good of a bundle, as a line: its icon, name and quantity, and what it does. */
function grantLine(g: ShopGrant, art: ArtOf, n = 1): DLine[] {
  const L = (k: string, icon: string, name: Tr, qty: Tr, hint?: Tr): DLine[] => [{ k, icon: art(icon), name, qty, ...(hint ? { hint } : {}) }];
  switch (g.k) {
    case 'speed': return L('speed', 'icon.ui_hourglass', ['Speed-ups', 'Ускорения'], hoursTr(Math.round(g.min / 60)), ['Into your store: any work on the island or the yard’s refit.', 'В запас: на любую стройку острова и перестройку корабля.']);
    case 'builder': return L('builder', 'icon.ui_brigade', ['Hired brigade', 'Наёмная бригада'], daysTr(g.days), ['One more building goes up at once.', 'Ещё одна постройка строится одновременно.']);
    case 'perm': return L('perm', 'icon.build_workshop', ['Brigade for good', 'Своя бригада навсегда'], times(1), ['Moves with you to a new island.', 'Переезжает с вами на новый остров.']);
    case 'res': return L(`res_${g.good}`, `icon.good_${g.good}`, RES_NAMES[g.good] ?? goodName(g.good), times(g.n), ['Into your island’s yard.', 'Во двор острова.']);
    case 'prod': return L('prod', 'icon.build_farm', ['Harvest season', 'Урожайный сезон'], hoursTr(g.hours), ['+50% from every producer of your island.', '+50% к добыче всех промыслов острова.']);
    case 'shield': return L('shield', 'icon.build_fort', ['Charter of protection', 'Охранная грамота'], hoursTr(g.hours), ['No raiders land on your island.', 'Налётчики не высадятся на ваш остров.']);
    case 'move': return L('move', 'icon.tab_isles', ['Charter of removal', 'Грамота на переезд'], times(1), ['Your island’s next move without its fee.', 'Следующий переезд острова без платы.']);
    case 'xp': return L('xp', 'icon.xp', ['Elixir of experience', 'Эликсир опыта'], hoursTr(g.hours), ['+50% experience for battles.', '+50% опыта за бои.']);
    case 'wind': return L('wind', 'icon.sp_fair_wind', ['Fair wind', 'Попутный ветер'], hoursTr(g.hours), ['+10% speed on a voyage.', '+10% к скорости в походе.']);
    case 'charm': return L('charm', 'icon.item_rabbit_foot', ['Lucky charms', 'Талисманы удачи'], times(g.n), ['+1 luck and +15 morale for one boarding.', '+1 к удаче и +15 к духу на один абордаж.']);
    case 'kit': return L('kit', 'icon.sp_mend_hull', ['Repair kits', 'Ремкомплекты'], times(g.n), ['Hull, canvas, rudder and guns whole at once.', 'Корпус, паруса, руль и пушки — целы сразу.']);
    case 'scrolls': return L('scrolls', 'icon.tab_contracts', ['Auto-battle scrolls', 'Свитки автобоя'], times(g.n), ['One scroll for one battle fought by «Auto».', 'Один свиток — один бой на «Авто».']);
    case 'pages': return L('pages', 'icon.bt_book', ['Scrolls of the path', 'Свитки техник'], times(g.n), ['Pages of your path’s book.', 'Страницы книги вашего пути.']);
    case 'art': return L('art', 'icon.item_saint_medal', ['Artifact from a hoard', 'Артефакт из клада'], times(n), ['Into your locker.', 'В сундук снаряжения.']);
    case 'ammo': {
      const a = AMMO[g.ammo];
      return L(`ammo_${g.ammo}`, `icon.ammo_${g.ammo}`, [a.name, ruData(`ships.AMMO.${g.ammo}.name`, a.name)], times(g.n), ['Into your magazine.', 'В крюйт-камеру.']);
    }
    case 'cargo': return L(`cargo_${g.good}`, `icon.good_${g.good}`, goodName(g.good), times(g.n), ['Into your hold.', 'В трюм.']);
    case 'crew': return [{ k: 'crew', icon: unitArt('deckhand', art), name: unitNames('deckhand'), qty: upTo(g.n), hint: ['Into your free hammocks.', 'В свободные койки.'] }];
    case 'units': {
      const u = RECRUIT_KINDS[g.tier - 1] as UnitId;
      return [{ k: `units_${u}`, icon: unitArt(u, art), name: unitNames(u), qty: upTo(g.n), hint: ['Into your free hammocks.', 'В свободные койки.'] }];
    }
    case 'refill': return L('refill', 'icon.ui_phial', ['Infirmary', 'Лазарет'], times(1));
    case 'rscroll': return L('rscroll', 'icon.ui_phial', ['Scrolls of resurrection', 'Свитки воскрешения'], times(g.n), ['One raises one stack of your fallen.', 'Один поднимает один отряд павших.']);
    case 'pardon': return L('pardon', 'icon.tab_law', ['Letters of pardon', 'Помилование'], times(1), ['Your infamy struck off.', 'Дурная слава стёрта.']);
    case 'map': return L('map', 'icon.map_treasure', ['Treasure maps', 'Карты сокровищ'], times(g.n), ['Of your waters’ tier.', 'По силам ваших вод.']);
    case 'looks': return L('looks', 'icon.item_silk_sails', ['Ship’s finery', 'Облик корабля'], times(g.n), ['Sails, paints, lanterns and flags not yet yours.', 'Паруса, краски, фонари и флаги, которых ещё нет.']);
    case 'sub': return L('sub', 'icon.tattoo_crown', ['Captain’s subscription', 'Капитанская подписка'], daysTr(g.days), ['100 doubloons and a scroll a day, a brigade, +20% experience.', '100 дублонов и свиток в день, бригада, +20% опыта.']);
    case 'cos': return g.keys.flatMap((key) => cosLine(key, art));
  }
}
const KIND_NAME: Record<string, Tr> = {
  title: ['Title', 'Звание'], plate: ['Plate', 'Плашка'], frame: ['Frame', 'Рамка'], emblem: ['Emblem', 'Эмблема'], cloth: ['Flag cloth', 'Полотнище'], trail: ['Wake', 'След'], emote: ['Emote', 'Эмоция'], pack: ['Emote pack', 'Набор эмоций'],
};
function cosLine(key: string, art: ArtOf): DLine[] {
  if (key.startsWith('pack:')) {
    const p = EMOTE_PACKS.find((x) => x.id === key.slice(5));
    const first = COS_EMOTES.find((e) => e.pack === key.slice(5));
    return p ? [{ k: key, icon: first ? art(`cos.emote_${first.id}`) : null, name: p.name, qty: KIND_NAME.pack }] : [];
  }
  const x = cosItem(key);
  if (!x) return [];
  const swatch = x.kind === 'cloth' ? (x as CosItem & { rgb: string }).rgb : x.kind === 'trail' ? `radial-gradient(circle, ${(x as CosItem & { c: string[] }).c[0]}, ${(x as CosItem & { c: string[] }).c[1]})` : undefined;
  const icon = x.kind === 'title' ? art(`cos.plate_${plateForTier(x.tier)}`) : x.kind === 'cloth' || x.kind === 'trail' ? null : art(`cos.${x.kind}_${x.id}`);
  return [{ k: key, icon, name: x.name, qty: KIND_NAME[x.kind], ...(swatch ? { swatch } : {}) }];
}
/** Merges the grants of a bundle into its lines (eight artifacts are one line «×8»). */
function lines(grants: readonly ShopGrant[], art: ArtOf): DLine[] {
  const arts = grants.filter((g) => g.k === 'art').length;
  const out: DLine[] = [];
  let artDone = false;
  for (const g of grants) {
    if (g.k === 'art') {
      if (!artDone) out.push(...grantLine(g, art, arts));
      artDone = true;
      continue;
    }
    out.push(...grantLine(g, art));
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ cosmetics

const plateForTier = (tier: number) => ['driftwood', 'bronze', 'silver', 'gold', 'abyss'][Math.max(0, Math.min(4, tier))];
const SAMPLE_FACE = 'portrait.corsair';
const SAMPLE_SHIP = 'ship.sloop';
const frameScale = (hole: number) => Number(Math.min(2.1, 1 / (2 * hole * 0.94)).toFixed(3));
/** A thing as others see it, for the card's preview. */
function cosPreview(key: string, art: ArtOf): DCos[] {
  if (key.startsWith('pack:')) {
    const p = EMOTE_PACKS.find((x) => x.id === key.slice(5));
    if (!p) return [];
    return [{ k: 'emote', name: p.name, emotes: COS_EMOTES.filter((e) => e.pack === p.id).map((e) => ({ art: art(`cos.emote_${e.id}`), name: e.name })), alone: p.price }];
  }
  const x = cosItem(key);
  if (!x) return [];
  const alone = cosPrice(x) ?? undefined;
  const base = { name: x.name, ...(alone ? { alone } : {}), ...(x.only ? { only: true } : {}) };
  switch (x.kind) {
    case 'title': {
      const pl = PLATES.find((y) => y.id === plateForTier(x.tier))!;
      return [{ k: 'title', ...base, words: x.name, plate: art(`cos.plate_${pl.id}`), ink: pl.ink, halo: pl.halo }];
    }
    case 'plate': {
      const pl = PLATES.find((y) => y.id === x.id)!;
      return [{ k: 'plate', ...base, plate: art(`cos.plate_${pl.id}`), ink: pl.ink, halo: pl.halo, words: ['Your title', 'Ваше звание'] }];
    }
    case 'frame': {
      const f = FRAMES.find((y) => y.id === x.id)!;
      return [{ k: 'frame', ...base, art: art(`cos.frame_${f.id}`), face: art(SAMPLE_FACE), scale: frameScale(f.hole) }];
    }
    case 'emblem': {
      const cl = CLOTHS.find((c) => !c.price) ?? CLOTHS[0];
      return [{ k: 'emblem', ...base, emblem: art(`cos.emblem_${x.id}`), rgb: cl.rgb, ship: art(SAMPLE_SHIP) }];
    }
    case 'cloth': {
      const c = CLOTHS.find((y) => y.id === x.id)!;
      const em = EMBLEMS.find((e) => e.price === 0) ?? EMBLEMS[0];
      return [{ k: 'cloth', ...base, rgb: c.rgb, emblem: art(`cos.emblem_${em.id}`), ship: art(SAMPLE_SHIP) }];
    }
    case 'trail': {
      const t = TRAILS.find((y) => y.id === x.id)!;
      return [{ k: 'trail', ...base, c: t.c, glow: t.glow, ship: art(SAMPLE_SHIP) }];
    }
    case 'emote': return [{ k: 'emote', ...base, emotes: [{ art: art(`cos.emote_${x.id}`), name: x.name }] }];
  }
}

// ------------------------------------------------------------------------------------------------ the kinds

/** The shelf a thing stands on (its tab's, or the shelf's inside it). */
const shelf = (x: WebItem): Tr => (x.sec && WEB_SECS[x.sec] ? WEB_SECS[x.sec] : WEB_TAB_NAMES[x.tab]);
const limitChips = (x: WebItem): DChip[] => {
  const out: DChip[] = [];
  if (x.once) out.push({ k: 'once', icon: ICON.once, name: ['Once per account', 'Один раз на счёт'] });
  else if (x.per) out.push({ k: x.per, icon: ICON.clock, name: x.per === 'day' ? ['Once a day', 'Раз в день'] : ['Once a week', 'Раз в неделю'] });
  if (x.from !== undefined && x.until !== undefined) out.push({ k: 'season', icon: ICON.clock, name: ['Seasonal', 'Сезонное'], tone: 'red' });
  if (x.level) out.push({ k: 'level', icon: ICON.level, name: [`From level ${x.level}`, `С ${x.level}-го уровня`] });
  return out;
};

function shipDetail(x: WebItem, art: ArtOf): WebDetail {
  const c = x.ship!;
  const d = SHIP_CLASSES[c];
  const list = (Object.values(SHIP_CLASSES) as (typeof d)[]).filter((s) => s.list === (d.list ?? 'combat'));
  const range = (f: (s: typeof d) => number): [number, number] => [Math.min(...list.map(f)), Math.max(...list.map(f))];
  const bar = (k: keyof typeof ICON, name: Tr, f: (s: typeof d) => number, v?: Tr): DStat => {
    const [lo, hi] = range(f);
    return { k, icon: ICON[k], name, v: v ?? same(fmt(f(d))), n: f(d), lo, hi };
  };
  const [lvLo, lvHi] = levelRange(c);
  const lv = captainLevelFor(lvLo);
  const listName = flw(`list.${d.list ?? 'combat'}`);
  const bars: DStat[] = [
    bar('hull', ['Hull', 'Корпус'], (s) => s.hull),
    bar('sails', ['Sails', 'Паруса'], (s) => s.sailHp),
    bar('speed', ['Speed', 'Скорость'], (s) => s.maxSpeed, [`${dec(d.maxSpeed)[0]} kn`, `${dec(d.maxSpeed)[1]} уз`]),
    bar('turn', ['Turn', 'Поворот'], (s) => s.turnRate, [`${dec(d.turnRate)[0]}°/s`, `${dec(d.turnRate)[1]}°/с`]),
    bar('guns', ['Guns a side', 'Пушек на борт'], (s) => s.gunPortsPerSide),
    bar('crew', ['Crew, most', 'Команда, макс.'], (s) => s.crewMax),
    bar('hold', ['Hold', 'Трюм'], (s) => s.holdVolume),
    bar('armor', ['Armour', 'Броня'], (s) => s.armor, pct(d.armor)),
  ];
  const tiles: DStat[] = [
    { k: 'slots', icon: ICON.slots, name: ['Army stacks', 'Слотов армии'], v: same(armySlots(d.tier)) },
    { k: 'chasers', icon: ICON.chasers, name: ['Chasers bow / stern', 'Погонные нос / корма'], v: same(`${d.bowChasers} / ${d.sternChasers}`) },
    { k: 'crewmin', icon: ICON.crew, name: ['Crew, least', 'Команда, мин.'], v: same(d.crewMin) },
    { k: 'level', icon: ICON.level, name: ['Ship level', 'Уровень корабля'], v: same(`⚓${lvLo}${lvHi !== lvLo ? `–${lvHi}` : ''}`) },
  ];
  const gift = giftOf(c);
  const abil: DAbil[] = [{
    k: 'trait', icon: art('icon.tattoo_compass_rose') ?? ICON.trait, name: [d.passive.name, ruData(`ships.SHIP_CLASSES.${c}.passive.name`, d.passive.name)], tag: ['Her trait', 'Особенность корпуса'],
    text: [d.passive.description, ruData(`ships.SHIP_CLASSES.${c}.passive.description`, d.passive.description)],
  }];
  if (gift) {
    const nums: { name: Tr; v: Tr }[] = [];
    const gg = gift as ShipGift & Record<string, unknown>;
    if (typeof gg.below === 'number') nums.push({ name: ['Hull below', 'Корпус ниже'], v: pct(gg.below as number) });
    if (typeof gg.chance === 'number') nums.push({ name: ['Chance', 'Шанс'], v: pct(gg.chance as number) });
    if (typeof gg.secs === 'number' && gg.secs) nums.push({ name: ['Lasts', 'Длится'], v: secs(gg.secs as number) });
    if (typeof gg.cd === 'number') nums.push({ name: [gift.kind === 'toll' ? 'Every' : 'Cooldown', gift.kind === 'toll' ? 'Каждые' : 'Перезарядка'], v: secs(gg.cd as number) });
    if (typeof gg.r === 'number') nums.push({ name: ['Reach', 'Радиус'], v: metres(gg.r as number) });
    if (typeof gg.rounds === 'number') nums.push({ name: ['Rounds', 'Раунды'], v: gg.rounds === 99 ? ['the whole battle', 'весь бой'] : same(gg.rounds as number) });
    if (typeof gg.mend === 'number') nums.push({ name: ['Hull mended', 'Починка корпуса'], v: pct(gg.mend as number) });
    if (typeof gg.sell === 'number') nums.push({ name: ['Sells dearer', 'Продаёт дороже'], v: same(`+${Math.round(((gg.sell as number) - 1) * 100)}%`) });
    if (typeof gg.buy === 'number') nums.push({ name: ['Buys cheaper', 'Покупает дешевле'], v: same(`−${Math.round((1 - (gg.buy as number)) * 100)}%`) });
    if (typeof gg.every === 'number') nums.push({ name: ['One more every', 'Ещё один каждые'], v: secs(gg.every as number) });
    abil.unshift({ k: `gift_${gift.kind}`, icon: art(GIFT_ICON[gift.kind]), name: gift.name, tag: [`${flw('gift')[0]} · ${flw(`kind.${gift.kind}`)[0]}`, `${flw('gift')[1]} · ${flw(`kind.${gift.kind}`)[1]}`], text: gift.text, nums });
  }
  const beasts = d.premium?.beasts ?? [];
  const sets: DBlock[] = [];
  if (beasts.length) sets.push({ t: 'units', k: 'beasts', h: ['Her own creatures', 'Её существа'], rows: beasts.map((b) => unitCard(b.u, art, b.n)) }, { t: 'text', k: 'own', icon: ICON.count, body: flw('own') });
  sets.push({
    t: 'text', k: 'deliver', icon: ICON.port, h: ['Delivery', 'Вручение'],
    body: [`From captain level ${lv}. Delivered in port; your old ship is berthed there. Three berths at most.`, `С ${lv}-го уровня капитана. Вручается в порту, прежний корабль остаётся у причала. Причалов — не больше трёх.`],
  });
  const role: Tr = [d.role, ruData(`ships.SHIP_CLASSES.${c}.role`, d.role)];
  return {
    id: x.id, view: 'ship',
    hero: {
      art: art(d.sprite), cls: 'hull', kicker: [`${listName[0]} · rank ${d.tier}`, `${listName[1]} · ранг ${d.tier}`], title: shipName(c), lead: role,
      chips: [{ k: 'level', icon: ICON.level, name: [`Captain level ${lv}+`, `С ${lv}-го уровня`], tone: 'gold' }, ...(gift ? [{ k: 'gift', icon: ICON.gift, name: gift.name, tone: 'ice' as const }] : []), ...(beasts.length ? [{ k: 'beasts', icon: ICON.count, name: [`+${beasts.reduce((a, b) => a + b.n, 0)} creatures`, `+${beasts.reduce((a, b) => a + b.n, 0)} существ`] as Tr }] : [])],
    },
    tabs: [
      tab('stats', [{ t: 'bars', k: 'ship', note: [`Against the ${listName[0].toLowerCase()} of the fleet (${list.length} hulls)`, `Среди кораблей списка «${listName[1]}» (${list.length})`], rows: bars }, { t: 'tiles', k: 'more', rows: tiles }]),
      tab('abil', [{ t: 'abil', k: 'ship', rows: abil }]),
      tab('set', sets),
      tab('about', [{ t: 'text', k: 'note', body: d.premium?.note ?? role }]),
    ],
    facts: { hull: d.hull, sails: d.sailHp, speed: d.maxSpeed, turn: d.turnRate, guns: d.gunPortsPerSide, slots: armySlots(d.tier), crew: d.crewMax, hold: d.holdVolume, armor: d.armor, lv, gift: gift?.kind ?? '', beasts: beasts.length },
  };
}

function unitDetail(x: WebItem, art: ArtOf): WebDetail {
  const u = x.unit!;
  const d = UNITS[u];
  const o = d.premium!;
  const packs = unitPacks(o.price);
  const k = x.k ?? 1;
  const n = o.n * k;
  const lv = premiumFrom(d.tier);
  const skill = skillAbil(u, art);
  const per = Math.round(x.rub / n);
  const note = unitNote(u);
  return {
    id: x.id, view: 'unit',
    hero: {
      art: unitArt(u, art), alt: art(`unit.${u}_atk`), cls: 'fig', kicker: [`Tier ${d.tier} · ${peopleOf(u)[0]}`, `Уровень ${d.tier} · ${peopleOf(u)[1]}`], title: unitNames(u), lead: note[1] ? note : o.note,
      chips: [{ k: 'tier', icon: ICON.tier, name: [`Tier ${d.tier}`, `Уровень ${d.tier}`], tone: 'gold' }, rangedChip(d), ...roleChips(d)],
    },
    tabs: [
      tab('stats', [{ t: 'bars', k: 'unit', note: [`One creature, against the kinds of tier ${d.tier}`, `Одно существо — среди существ ${d.tier}-го уровня`], rows: unitStats(d) }]),
      tab('abil', [
        ...(skill ? [{ t: 'abil' as const, k: 'skill', h: ['Once a battle', 'Раз за бой'] as Tr, rows: [skill] }] : []),
        ...(d.specials.length ? [{ t: 'chips' as const, k: 'specials', h: ['Specials', 'Особенности'] as Tr, rows: specialChips(d, art) }] : []),
        { t: 'chips', k: 'attack', h: ['How it fights', 'Как бьёт'], rows: [rangedChip(d)] },
      ]),
      tab('set', [
        { t: 'tiles', k: 'pack', rows: [
          { k: 'count', icon: ICON.count, name: ['In this pack', 'В наборе'], v: same(n) },
          { k: 'per', icon: ICON.price, name: ['A head', 'За одно существо'], v: rub(per) },
          { k: 'level', icon: ICON.level, name: ['Ship level', 'Уровень корабля'], v: same(`⚓${lv}+`) },
          { k: 'slots', icon: ICON.slots, name: ['Needs', 'Нужно'], v: ['a free stack', 'свободный слот'] },
        ] },
        { t: 'lines', k: 'packs', h: ['Packs', 'Наборы'], rows: packs.map((p) => ({ k: `unit_${u}_${p.k}`, icon: unitArt(u, art), name: [`×${o.n * p.k} · ${fmt(p.price)} ₽`, `×${o.n * p.k} · ${fmt(p.price)} ₽`] as Tr, qty: [`${fmt(Math.round(p.price / (o.n * p.k)))} ₽ a head`, `${fmt(Math.round(p.price / (o.n * p.k)))} ₽ за шт.`] as Tr })) },
        { t: 'text', k: 'deliver', icon: ICON.ship, h: ['Delivery', 'Вручение'], body: [`Into your army out of a fight: a ship of level ${lv} or more, a free stack and hammocks aboard. A kind already aboard joins its stack.`, `В армию вне боя: корабль ${lv}-го уровня и выше, свободный слот и койки на борту. Если такие уже есть — встают в тот же отряд.`] },
      ]),
      tab('about', [{ t: 'text', k: 'note', body: o.note }]),
    ],
    facts: { tier: d.tier, hp: d.hp, atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, speed: d.speed, init: d.init, shots: d.shots, n, per, lv, skill: skillOf(u) ?? '', ranged: d.shots > 0 },
  };
}

function captainDetail(x: WebItem, art: ArtOf): WebDetail {
  const id = x.captain as CaptainId;
  const c = CAPTAINS[id];
  const r = (k: string, en: string) => ruData(`captains.CAPTAINS.${id}.${k}`, en);
  const ab: DAbil[] = c.abilities.map((a, i) => {
    const nums: { name: Tr; v: Tr }[] = [{ name: ['Key', 'Клавиша'], v: same(a.key) }, { name: ['Cooldown', 'Перезарядка'], v: secs(a.cooldown) }];
    if (a.duration) nums.push({ name: ['Lasts', 'Длится'], v: secs(a.duration) });
    if (a.range) nums.push({ name: ['Reach', 'Дальность'], v: metres(a.range) });
    if (a.dreadCost) nums.push({ name: ['Dread', 'Ужас'], v: same(a.dreadCost) });
    if (a.moraleCost) nums.push({ name: ['Morale', 'Боевой дух'], v: same(`−${a.moraleCost}`) });
    return { k: a.id, icon: art(`icon.ab_${a.id}`), name: [a.name, r(`abilities.${i}.name`, a.name)], tag: a.kind === 'ultimate' ? ['Ultimate', 'Ульта'] : ['Active', 'Активная'], text: [a.description, r(`abilities.${i}.description`, a.description)], nums };
  });
  const s = c.start;
  const gun = GUNS[s.gun];
  const start: DLine[] = [
    { k: 'ship', icon: art(SHIP_CLASSES[s.ship].sprite), name: shipName(s.ship), qty: ['ship', 'корабль'] },
    { k: 'gun', icon: art(`icon.gun_${s.gun}`), name: [gun.name, ruData(`ships.GUNS.${s.gun}.name`, gun.name)], qty: ['guns', 'пушки'] },
    { k: 'crew', icon: art('icon.stat_crew'), name: ['Crew', 'Команда'], qty: times(s.crew) },
    { k: 'gold', icon: ICON.silver, name: ['Silver', 'Серебро'], qty: same(fmt(s.gold)) },
    ...(Object.entries(s.cargo) as [GoodId, number][]).map(([g, n]) => ({ k: `cargo_${g}`, icon: art(`icon.good_${g}`), name: goodName(g), qty: times(n) })),
  ];
  const name: Tr = [c.name, r('name', c.name)];
  return {
    id: x.id, view: 'captain',
    hero: {
      art: art(c.portrait), alt: art(`unit.hero_${id}`), cls: 'face', kicker: [c.archetype, r('archetype', c.archetype)], title: name, lead: [`«${c.epithet}»`, `«${r('epithet', c.epithet)}»`],
      chips: [{ k: 'premium', icon: ICON.captain, name: ['Premium captain', 'Премиум-капитан'], tone: 'gold' }, { k: 'once', icon: ICON.once, name: ['Once per account', 'Один раз на счёт'] }],
    },
    tabs: [
      tab('about', [{ t: 'text', k: 'bio', h: ['Story', 'История'], body: [c.bio, r('bio', c.bio)] }, { t: 'text', k: 'play', h: ['How she plays', 'Стиль игры'], body: [c.playstyle, r('playstyle', c.playstyle)] }]),
      tab('abil', [
        { t: 'abil', k: 'trait', h: ['Trait', 'Особенность'], rows: [{ k: c.passive.id, icon: art(`icon.school_${id}`) ?? ICON.trait, name: [c.passive.name, r('passive.name', c.passive.name)], tag: ['Always on', 'Всегда действует'], text: [c.passive.description, r('passive.description', c.passive.description)] }] },
        { t: 'abil', k: 'abilities', h: ['Abilities', 'Способности'], rows: ab },
      ]),
      tab('set', [
        { t: 'lines', k: 'start', h: ['She starts with', 'Стартовый набор'], rows: start },
        { t: 'text', k: 'how', icon: ICON.captain, body: ['Chosen when you start a new captain, for good. Bought once per account.', 'Выбирается при создании нового капитана — навсегда. Покупается один раз на счёт.'] },
      ]),
    ],
    facts: { abilities: c.abilities.length, crew: s.crew, gold: s.gold, ship: s.ship, price: CAPTAIN_PRICE },
  };
}

/** What a bundle's goods are worth against its price. */
function value(offer: ShopOffer, rubNow: number, usual?: number): { worth?: number; save?: number } {
  const worth = usual ?? offer.worth ?? worthOf(offer.grants);
  if (!worth || worth <= rubNow) return {};
  return { worth, save: Math.round((worth / rubNow - 1) * 100) };
}

function offerDetail(x: WebItem, art: ArtOf): WebDetail {
  const f = OFFERS.get(x.offer!)!;
  const { fam, offer } = f;
  const isDeal = x.kind === 'deal';
  const v = value(offer, x.rub, isDeal ? offer.price : undefined);
  const bonus = !isDeal && !offer.worth ? offerBonus(fam, offer) : 0;
  const rows = lines(offer.grants, art);
  const timed = offer.grants.find((g) => 'hours' in g || 'days' in g || g.k === 'speed');
  const chips = limitChips(x);
  if (x.aboard) chips.push({ k: 'aboard', icon: ICON.ship, name: ['Delivered aboard', 'Вручается на борту'] });
  const blocks: DBlock[] = [{ t: 'lines', k: 'items', h: ['Inside', 'Что внутри'], rows, ...(v.worth ? { worth: v.worth, price: x.rub, save: v.save } : {}) }];
  const tiles: DStat[] = [];
  if (bonus) tiles.push({ k: 'bonus', icon: ICON.gift, name: ['Bonus against the smallest', 'Бонус к малому набору'], v: same(`+${bonus}%`) });
  if (timed && 'hours' in timed) tiles.push({ k: 'lasts', icon: ICON.clock, name: ['Lasts', 'Действует'], v: hoursTr(timed.hours) });
  if (timed && 'days' in timed) tiles.push({ k: 'lasts', icon: ICON.clock, name: ['Lasts', 'Действует'], v: daysTr(timed.days) });
  if (x.level) tiles.push({ k: 'level', icon: ICON.level, name: ['Opens at level', 'Открывается на уровне'], v: same(x.level) });
  if (tiles.length) blocks.push({ t: 'tiles', k: 'terms', rows: tiles });
  const recruit = offer.grants.find((g) => g.k === 'units' || g.k === 'crew');
  if (recruit) {
    const u = (recruit.k === 'units' ? RECRUIT_KINDS[recruit.tier - 1] : 'deckhand') as UnitId;
    blocks.push({ t: 'units', k: 'kind', h: ['Who signs on', 'Кто приходит'], rows: [unitCard(u, art)] });
  }
  const about: DBlock[] = isDeal ? [] : [{ t: 'text', k: 'text', body: fam.text }];
  if (x.meta) about.push({ t: 'text', k: 'meta', icon: ICON.quest, body: x.meta });
  if (isDeal) about.push({ t: 'text', k: 'deal', icon: ICON.clock, body: ['The deal changes at midnight (UTC); bought once a day.', 'Товар дня меняется в полночь по Гринвичу; купить можно раз в день.'] });
  const cos = offer.grants.find((g) => g.k === 'cos');
  const isCos = !!cos && x.tab === 'cos';
  const tabs: DTab[] = [];
  if (isCos) {
    const prev = cos.keys.flatMap((k) => cosPreview(k, art));
    tabs.push(tab('look', [{ t: 'cos', k: 'preview', rows: prev }]));
    if (cos.keys.length > 1) tabs.push(tab('set', blocks));
    about.push({
      t: 'text', k: 'how', icon: ICON.gift, h: ['How to get it', 'Как получить'],
      body: cos.keys.length > 1
        ? ['Bought here or in the game’s shop: everything inside is the account’s for good, on every captain. Things marked «only here» are had in this outfit alone.', 'Покупкой здесь или в лавке игры: всё внутри навсегда на счёте, у всех капитанов. Вещи с пометкой «только здесь» есть лишь в этом наряде.']
        : ['Bought here or in the game’s shop, once: it is the account’s for good, on every captain. Some titles and emotes are earned in the game instead (levels, boardings, the Colosseum).', 'Покупкой здесь или в лавке игры, один раз: вещь навсегда на счёте, у всех капитанов. Часть званий и эмоций вместо покупки заслуживается в игре (уровни, абордажи, Колизей).'],
    });
  } else tabs.push(tab('set', blocks));
  tabs.push(tab('about', about));
  const lead: Tr = fam.text;
  return {
    id: x.id, view: isCos ? 'cos' : 'set',
    hero: {
      art: x.art ? art(x.art) : null, cls: isCos ? 'cos' : x.art.startsWith('unit.') ? 'fig' : 'icon', kicker: isDeal ? ['Deal of the day', 'Товар дня'] : x.qty ? [`${shelf(x)[0]} · ${x.qty[0]}`, `${shelf(x)[1]} · ${x.qty[1]}`] : shelf(x), title: isDeal ? x.title : fam.name, lead,
      chips: [...(v.save ? [{ k: 'save', icon: ICON.gift, name: [`Saves ${v.save}%`, `Выгода ${v.save}%`] as Tr, tone: 'green' as const }] : []), ...(isDeal ? [{ k: 'off', icon: ICON.gift, name: [`−${Math.round((1 - x.rub / offer.price) * 100)}%`, `−${Math.round((1 - x.rub / offer.price) * 100)}%`] as Tr, tone: 'red' as const }] : []), ...chips],
      ...(x.swatch ? { swatch: x.swatch } : {}), ...(x.label ? { label: x.label, ink: x.ink, halo: x.halo } : {}),
    },
    tabs,
    facts: { items: rows.length, worth: v.worth ?? 0, save: v.save ?? 0, bonus, price: x.rub, offer: offer.id },
  };
}

function packDetail(x: WebItem, art: ArtOf): WebDetail {
  const p = DOUBLOON_PACKS.find((y) => y.id === x.id)!;
  const n = p.n + p.bonus;
  // what they buy: the dearest of each kind the sum reaches, from the catalogue
  const kinds: [WebItem['kind'], Tr][] = [['captain', ['a premium captain', 'премиум-капитан']], ['ship', ['a premium hull', 'премиум-корабль']], ['unit', ['legendary creatures', 'легендарные существа']], ['offer', ['the shop’s goods', 'товары лавки']]];
  const buys: DLine[] = [];
  for (const [k, what] of kinds) {
    const best = WEB_ITEMS.filter((y) => y.kind === k && y.rub > 0 && y.rub <= n && y.tab !== 'deal').sort((a, b) => b.rub - a.rub)[0];
    if (best) buys.push({ k: best.id, icon: best.art ? art(best.art) : null, name: best.name, qty: [`${fmt(best.rub)} dbl.`, `${fmt(best.rub)} дубл.`], hint: what, ...(best.swatch ? { swatch: best.swatch } : {}) });
  }
  return {
    id: x.id, view: 'pack',
    hero: {
      art: art('icon.doubloon'), cls: 'coin', kicker: ['Doubloons', 'Дублоны'], title: x.name, lead: x.text,
      chips: [...(p.bonus ? [{ k: 'bonus', icon: ICON.gift, name: [`+${fmt(p.bonus)} free`, `+${fmt(p.bonus)} в подарок`] as Tr, tone: 'green' as const }] : []), { k: 'rate', icon: ICON.price, name: ['1 doubloon = 1 ₽', '1 дублон = 1 ₽'] }],
    },
    tabs: [
      tab('set', [
        { t: 'tiles', k: 'pack', rows: [
          { k: 'total', icon: art('icon.doubloon'), name: ['Doubloons', 'Дублонов'], v: same(fmt(n)) },
          { k: 'base', icon: ICON.price, name: ['For the price', 'За цену'], v: same(fmt(p.n)) },
          { k: 'bonus', icon: ICON.gift, name: ['Bonus', 'Бонус'], v: p.bonus ? same(`+${fmt(p.bonus)} (${Math.round((p.bonus / p.n) * 100)}%)`) : ['none', 'нет'] },
        ] },
        { t: 'lines', k: 'buys', h: ['What they buy, for example', 'Что можно купить, например'], rows: buys },
        { t: 'text', k: 'how', icon: ICON.quest, body: ['On the captain’s account at once: spend them in the game’s premium shop on hulls, creatures, speed-ups and looks. Doubloons are not changed back into money.', 'Сразу на счёте капитана: тратьте в премиум-лавке игры на корабли, существ, ускорения и облики. Обратно в деньги дублоны не обмениваются.'] },
      ]),
    ],
    facts: { doubloons: n, base: p.n, bonus: p.bonus, buys: buys.length },
  };
}

/** The whole card of a catalogue's item (the deal of the day as today's: pass its own item). */
export function webDetailOf(x: WebItem, art: ArtOf): WebDetail {
  const d = x.kind === 'ship' ? shipDetail(x, art) : x.kind === 'unit' ? unitDetail(x, art) : x.kind === 'captain' ? captainDetail(x, art) : x.kind === 'pack' ? packDetail(x, art) : offerDetail(x, art);
  return icons(d, art);
}

/** The numbers' own pictures (ICON: asset ids and site kit paths) to their addresses, wherever an `icon` stands. */
function icons<T>(v: T, art: ArtOf): T {
  if (Array.isArray(v)) return v.map((y) => icons(y, art)) as T;
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, y] of Object.entries(v)) out[k] = k === 'icon' && typeof y === 'string' && !y.startsWith('/') ? art(y) : icons(y, art);
  return out as T;
}

/** The card of an item by its id (the deal of the day: of this offer at this price). Undefined: no such item. */
export function webDetail(id: unknown, art: ArtOf, deal?: { offer: string; rub: number }): WebDetail | undefined {
  const x = webItem(id);
  if (!x) return undefined;
  if (x.kind === 'deal') return deal ? webDetailOf(dealItem(deal.offer, deal.rub), art) : undefined;
  return webDetailOf(x, art);
}
