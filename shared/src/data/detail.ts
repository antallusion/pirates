// The detail card (owner, 2026-10-30: «при нажатии на корабль или существо я должен видеть подробное описание со всеми
// иконками … вообще у всего в игре описания при нажатии должны быть … нажал — тултип а-ля модалка и крестик чтоб
// закрыть»). One card for every thing the player sees as an icon: a key `kind:id[:n]` (the same the client's
// `data-detail` attribute carries) → its name in its colour, what kind it is, a big picture, its numbers with their
// icons, its words and, for a good, where it is had. The words are the game's own — the gear card's, the site's hover
// cards' (sitetips.ts), the shop's creature card (webdetail.ts) — in both tongues. The things only the client knows
// (an item by its uid, a ship at sea by her entity) are turned into these by client/src/ui/detail.ts.

import { GOODS, GOOD_IDS, isSupply } from './goods.ts';
import type { GoodCategory, GoodId } from './goods.ts';
import { AMMO, GUNS, MODULES, MOUNTS, SHIP_CLASSES } from './ships.ts';
import type { AmmoId, ShipClassId } from './ships.ts';
import { UNITS, armyPower, armySlots } from './army.ts';
import type { UnitId } from './army.ts';
import { unitCard } from './webdetail.ts';
import { shipName } from './webshop.ts';
import { giftOf } from './shipgifts.ts';
import { levelRange } from './shiplevel.ts';
import { ITEM_BASES, SETS, RARITY_COLOR, SLOT_NAMES } from './items.ts';
import type { Item, SetId } from './items.ts';
import { ARTIFACTS, ART_SETS, RELICS, makeArtifact } from './artifacts.ts';
import { ORDERS, SKILLS } from './hero.ts';
import type { OrderId, SkillId } from './hero.ts';
import { TALENTS_BY_ID } from './talents.ts';
import { TATTOO_BY_ID } from './sidequests.ts';
import { PETS } from './companions.ts';
import { cosItem, cosArt } from './cosmetics.ts';
import { LAND_RES_DEF } from './bestiary.ts';
import type { LandRes } from './bestiary.ts';
import { FIGUREHEADS } from './shipbuild.ts';
import {
  buildingTip, deedTip, featTip, figureheadTip, gunTip, itemTip, moduleTip, mountTip, orderTip, petTip, producerTip, relicTip, setTip, skillTip,
  talentTip, tattooTip, townTip,
} from './sitetips.ts';
import type { Tip, TipNote, TipRow } from './sitetips.ts';
import { DATA_RU } from '../../../client/src/lang/data.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../../../client/src/lang/ui/army.ts';

type Tr = [string, string];

/** A line of numbers of the card, with its icon (an asset id the client's `icon()` draws) and, for a share, a bar. */
export interface DRow extends TipRow { icon?: string; bar?: number }
/** The card: name in its colour, kind, the big picture (`art`: an asset id; `fig`: what draws it — a creature's figure,
 *  a hull's sprite, a plain icon), its numbers and words; `src`: a good's or a land resource's sources id (sources.ts),
 *  worded by the client. */
export interface DCard {
  name: Tr;
  color?: string;
  sub?: Tr;
  art?: string;
  fig?: 'unit' | 'ship' | 'icon';
  rows?: DRow[];
  notes?: TipNote[];
  src?: string;
}

/** Every kind a key may name (the tests walk each). */
export const DETAIL_KINDS = [
  'unit', 'good', 'lres', 'hull', 'gun', 'mount', 'module', 'fh', 'ammo', 'skill', 'order', 'talent', 'relic', 'aset', 'gset', 'art', 'base',
  'town', 'producer', 'building', 'tattoo', 'pet', 'deed', 'feat', 'cos',
] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

const same = (s: string | number): Tr => [String(s), String(s)];
const both = (f: (i: 0 | 1) => string): Tr => [f(0), f(1)];
const ru = (key: string, en: string): Tr => [en, DATA_RU[key] ?? en];
const dec = (x: number, d = 1): Tr => {
  const r = String(Math.round(x * 10 ** d) / 10 ** d);
  return [r, r.replace('.', ',')];
};
const pct = (x: number): Tr => same(`${Math.round(x * 100)}%`);

/** The icons of the numbers the cards share (by their English names). */
const ROW_ICON: Record<string, string> = {
  Hull: 'icon.stat_hull', Armour: 'icon.item_armoury', Speed: 'icon.sp_fair_wind', 'Sail strength': 'icon.stat_sails', Turning: 'icon.item_ship_wheel',
  Hold: 'icon.bt_hold', Crew: 'icon.stat_crew', Boarding: 'icon.ab_red_hook_boarding', Damage: 'icon.sp_powder_keg', Range: 'icon.item_ranging_glass',
  'Least range': 'icon.item_ranging_glass', Reload: 'icon.ui_hourglass', 'Crew a gun': 'icon.stat_crew', Spread: 'icon.ui_cannon', Cooldown: 'icon.ui_hourglass',
  Lasts: 'icon.ui_hourglass', Will: 'icon.ab_brine_mend', Signature: 'icon.ab_spotters_eye', Power: 'icon.act_attack',
};
/** A sitetips card as a detail card, its picture given. */
export function fromTip(t: Tip | undefined, art?: string, fig: DCard['fig'] = 'icon'): DCard | undefined {
  if (!t) return undefined;
  const rows = t.rows?.map((r): DRow => (ROW_ICON[r.k[0]] ? { ...r, icon: ROW_ICON[r.k[0]] } : r));
  return { name: t.name, color: t.color, sub: t.sub, rows, notes: t.notes, ...(art ? { art, fig } : {}) };
}

// ------------------------------------------------------------------------------------------------ a creature

/** The site's art addresses are its own; the game's icons are asset ids, passed through. */
const passArt = (id: string): string | null => (id.startsWith('/') ? null : id);
const TIER_COLOR = ['#c9b98f', '#c9b98f', '#c9b98f', '#7fd07a', '#7fd07a', '#5aa9ff', '#5aa9ff', '#c07cff', '#ff9a3c'];

/** A creature: tier, upgraded, its numbers with their icons, steel or shot, specials and what each does, its
 *  once-a-battle ability, its power, the words about it; `n` men of it (0: the kind only). */
export function unitDetail(u: string, n = 0): DCard | undefined {
  const d = UNITS[u as UnitId];
  if (!d) return undefined;
  const c = unitCard(u as UnitId, passArt);
  const rows: DRow[] = c.stats.map((s) => ({ k: s.name, v: s.v, ...(s.icon ? { icon: s.icon } : {}), ...(s.hi && s.n !== undefined ? { bar: Math.max(0.04, Math.min(1, s.n / s.hi)) } : {}) }));
  const worth = armyPower([{ u: u as UnitId, n: 1 }]);
  if (worth > 0) rows.push({ k: ['Power, each', 'Сила, за одного'], v: same(Math.round(worth)), icon: 'icon.act_attack' });
  if (n > 1) rows.push({ k: [`Power of ×${n}`, `Сила отряда ×${n}`], v: same(Math.round(armyPower([{ u: u as UnitId, n }]))), icon: 'icon.act_attack' });
  const notes: TipNote[] = [];
  for (const ch of c.chips) {
    const plain = ch.k === 'melee' || ch.k === 'ranged';
    notes.push({ t: ch.hint && ch.hint[0] ? (plain ? ch.hint : both((i) => `${ch.name[i]}: ${ch.hint![i]}`)) : ch.name, tone: plain ? 'muted' : 'gift' });
  }
  if (c.skill) {
    notes.push({ t: both((i) => `${c.skill!.name[i]}${c.skill!.tag ? ` (${c.skill!.tag[i]})` : ''}`), tone: 'head' });
    notes.push({ t: c.skill.text, tone: 'on' });
    if (c.skill.nums?.length) notes.push({ t: both((i) => c.skill!.nums!.map((x) => `${x.name[i]} ${x.v[i]}`).join(' · ')), tone: 'muted' });
  }
  const fe = (ARMY_EN as Record<string, string>)[`ud.${u}`];
  if (fe) notes.push({ t: [fe, (ARMY_RU as Record<string, string>)[`ud.${u}`] ?? fe], tone: 'flavor' });
  return {
    name: n > 0 ? both((i) => `${c.name[i]} ×${n}`) : c.name, color: TIER_COLOR[Math.min(8, d.tier)],
    sub: both((i) => `${i ? 'Уровень' : 'Tier'} ${d.tier}${d.up ? (i ? ' · улучшенный' : ' · upgraded') : ''}${d.shots ? (i ? ' · стрелок' : ' · ranged') : ''}`),
    art: u, fig: 'unit', rows, notes,
  };
}

// ------------------------------------------------------------------------------------------------ a good

const CAT_NAMES: Record<GoodCategory, Tr> = {
  staple: ['Staple', 'Ходовой товар'], luxury: ['Luxury', 'Роскошь'], industrial: ['Industrial', 'Сырьё для мастерских'], military: ['Military', 'Военный товар'],
  supply: ['Ship’s supply', 'Судовые припасы'], contraband: ['Contraband', 'Контрабанда'], mystic: ['Mystic', 'Мистический'], rare: ['Rare material', 'Редкий материал'],
};
const CAT_COLOR: Record<GoodCategory, string> = {
  staple: '#e8d9b0', luxury: '#e8c872', industrial: '#c9b98f', military: '#e07a5f', supply: '#9fd3e6', contraband: '#c07cff', mystic: '#7fd0c0', rare: '#ff9a3c',
};
const USES: Partial<Record<GoodId, Tr>> = {
  rum: ['Raises the crew’s spirits; every port buys it.', 'Поднимает дух команды; покупает каждый порт.'],
  salt: ['Salts fresh fish into a cargo that keeps.', 'Засаливает свежую рыбу в товар, который не портится.'],
  timber: ['The island’s yard and the shipwrights use it.', 'Идёт на верфь острова и корабелам.'],
  iron: ['The island’s forges and the yards use it.', 'Идёт в кузни острова и на верфи.'],
};

/** A good: its category, how much room one takes and its weight, its base price (and `local`: the price here), what
 *  it is for, how it keeps, its danger, the law — and where it is had (`src`). */
export function goodDetail(id: string, local?: { buy?: number; sell?: number }): DCard | undefined {
  const g = GOODS[id as GoodId];
  if (!g) return undefined;
  const rows: DRow[] = [
    { k: ['Category', 'Категория'], v: CAT_NAMES[g.category], icon: 'icon.tab_market' },
    { k: ['Room, each', 'Место в трюме, шт.'], v: dec(g.volume, 2), icon: 'icon.bt_hold' },
    { k: ['Weight, each', 'Вес, шт.'], v: dec(g.weight, 2) },
    { k: ['Base price', 'Базовая цена'], v: same(g.basePrice), icon: 'icon.coin' },
  ];
  if (local?.buy) rows.push({ k: ['Bought here at', 'Купить здесь'], v: same(local.buy), icon: 'icon.coin' });
  if (local?.sell) rows.push({ k: ['Sold here at', 'Продать здесь'], v: same(local.sell), icon: 'icon.coin' });
  if (g.spoilPerHour > 0) rows.push({ k: ['Spoils at sea', 'Портится в море'], v: both((i) => `${dec(g.spoilPerHour * 100, 1)[i]}% / ${i ? 'ч' : 'h'}`), tone: 'down' });
  if (g.danger > 0) rows.push({ k: ['Danger in the hold', 'Опасность в трюме'], v: pct(g.danger), tone: 'down' });
  const notes: TipNote[] = [{ t: ru(`goods.GOODS.${id}.description`, g.description), tone: 'flavor' }];
  const use = USES[id as GoodId];
  if (use) notes.push({ t: use, tone: 'gift' });
  else if (isSupply(id as GoodId)) notes.push({ t: ['A ship’s supply: every harbour sells it.', 'Судовой припас: продаётся в каждой гавани.'], tone: 'gift' });
  if (g.contraband) notes.push({ t: ['Contraband: Crown ports seize it; black markets pay best.', 'Контрабанда: в портах Короны конфискуют, лучше всего платит чёрный рынок.'], tone: 'off' });
  return { name: ru(`goods.GOODS.${id}.name`, g.name), color: CAT_COLOR[g.category], sub: both((i) => `${i ? 'Товар' : 'Trade good'} · ${CAT_NAMES[g.category][i]}`), art: `icon.good_${id}`, fig: 'icon', rows, notes, src: `g:${id}` };
}

export function landResDetail(id: string): DCard | undefined {
  const d = LAND_RES_DEF[id as LandRes];
  if (!d) return undefined;
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  return {
    name: [cap(d.name[0]), cap(d.name[1])], color: '#c9b98f', sub: ['Resource of the land', 'Ресурс суши'], art: `icon.${d.icon}`, fig: 'icon',
    rows: [{ k: ['Reckoned at', 'Ценится в'], v: same(d.value), icon: 'icon.coin' }],
    notes: [{ t: ['Left by the creatures of the lairs ashore; the island’s buildings and the hire ask it.', 'Остаётся от существ береговых логов; его просят постройки острова и найм.'], tone: 'gift' }],
    src: `l:${id}`,
  };
}

// ------------------------------------------------------------------------------------------------ a hull (her class)

/** A ship's class, as the shipyard's and the fleet tree's card (`hull:<classId>`, reusable by the tree): rank and
 *  level, her role, her numbers with their icons, her trait and gift. */
export function hullDetail(c: string): DCard | undefined {
  const d = SHIP_CLASSES[c as ShipClassId];
  if (!d) return undefined;
  const [lo, hi] = levelRange(c as ShipClassId);
  const rows: DRow[] = [
    { k: ['Ship level', 'Уровень корабля'], v: same(`⚓${lo}${hi !== lo ? `–${hi}` : ''}`), icon: 'icon.ui_anchor' },
    { k: ['Hull', 'Корпус'], v: same(d.hull), icon: 'icon.stat_hull' },
    { k: ['Sails', 'Паруса'], v: same(d.sailHp), icon: 'icon.stat_sails' },
    { k: ['Speed', 'Скорость'], v: both((i) => `${dec(d.maxSpeed)[i]} ${i ? 'уз' : 'kn'}`), icon: 'icon.sp_fair_wind' },
    { k: ['Turn', 'Поворот'], v: both((i) => `${dec(d.turnRate)[i]}°/${i ? 'с' : 's'}`), icon: 'icon.item_ship_wheel' },
    { k: ['Guns a side', 'Пушек на борт'], v: same(d.gunPortsPerSide), icon: 'icon.ui_cannon' },
    { k: ['Chasers bow / stern', 'Погонные нос / корма'], v: same(`${d.bowChasers} / ${d.sternChasers}`), icon: 'icon.gun_long_9' },
    { k: ['Crew', 'Команда'], v: same(`${d.crewMin}–${d.crewMax}`), icon: 'icon.stat_crew' },
    { k: ['Army stacks', 'Слотов армии'], v: same(armySlots(d.tier)), icon: 'icon.ui_cutlasses' },
    { k: ['Hold', 'Трюм'], v: same(d.holdVolume), icon: 'icon.bt_hold' },
    { k: ['Armour', 'Броня'], v: pct(d.armor), icon: 'icon.item_armoury' },
    { k: ['Draught', 'Осадка'], v: both((i) => `${dec(d.draft)[i]} ${i ? 'м' : 'm'}`) },
  ];
  const notes: TipNote[] = [{ t: ru(`ships.SHIP_CLASSES.${c}.role`, d.role), tone: 'flavor' }];
  if (d.passive) {
    notes.push({ t: ru(`ships.SHIP_CLASSES.${c}.passive.name`, d.passive.name), tone: 'head' });
    notes.push({ t: ru(`ships.SHIP_CLASSES.${c}.passive.description`, d.passive.description), tone: 'gift' });
  }
  const gift = giftOf(c as ShipClassId);
  if (gift) {
    notes.push({ t: gift.name, tone: 'head' });
    notes.push({ t: gift.text, tone: 'on' });
  }
  if (d.premium) notes.push({ t: ['Sold for doubloons in the shop.', 'Продаётся за дублоны в лавке.'], tone: 'muted' });
  return { name: shipName(c as ShipClassId), color: '#e8c872', sub: both((i) => `${i ? 'Корабль' : 'Ship'} · ${i ? 'ранг' : 'rank'} ${d.tier}`), art: d.sprite, fig: 'ship', rows, notes };
}

// ------------------------------------------------------------------------------------------------ fittings and shot

export function ammoDetail(id: string): DCard | undefined {
  const a = AMMO[id as AmmoId];
  if (!a) return undefined;
  const rows: DRow[] = [
    { k: ['Against the hull', 'По корпусу'], v: same(`×${dec(a.hullMul, 2)[0]}`), icon: 'icon.stat_hull' },
    { k: ['Against the sails', 'По парусам'], v: same(`×${dec(a.sailMul, 2)[0]}`), icon: 'icon.stat_sails' },
    { k: ['Men struck down', 'Выбивает людей'], v: dec(a.crewKill, 2), icon: 'icon.stat_crew' },
    { k: ['Range', 'Дальность'], v: same(`×${dec(a.rangeMul, 2)[0]}`) },
    { k: ['Price a shot', 'Цена выстрела'], v: same(a.price), icon: 'icon.coin' },
  ];
  if (a.reloadMul && a.reloadMul !== 1) rows.push({ k: ['Reload', 'Перезарядка'], v: same(`×${dec(a.reloadMul, 2)[0]}`), tone: a.reloadMul > 1 ? 'down' : 'up' });
  return { name: ru(`ships.AMMO.${id}.name`, a.name), color: '#e8c872', sub: ['Shot', 'Снаряд'], art: `icon.ammo_${id}`, fig: 'icon', rows, notes: [{ t: ru(`ships.AMMO.${id}.description`, a.description), tone: 'flavor' }] };
}

// ------------------------------------------------------------------------------------------------ an item's kind

/** A plain item at level 1, common (a base: `base:<id>`), or an artifact as it is found (`art:<id>`). */
function baseItem(id: string): Item | undefined {
  if (ARTIFACTS[id]) return makeArtifact(id);
  return ITEM_BASES[id] ? { uid: 0, base: id, ilvl: 1, rarity: 0, affixes: [], dur: 100 } : undefined;
}
export function itemDetail(it: Item, worn: readonly Item[] = []): DCard {
  const t = itemTip(it, worn);
  const a = it.art ? ARTIFACTS[it.art] : null;
  const art = a ? `icon.${a.icon}` : it.legendary ? `icon.item_${it.legendary}` : `icon.item_${ITEM_BASES[it.base]?.icon ?? it.base}`;
  return { ...fromTip(t)!, art, fig: 'icon' };
}

export function gearSetDetail(id: string): DCard | undefined {
  const d = SETS[id as SetId];
  if (!d) return undefined;
  const pieces = Object.keys(d.pieces);
  return {
    name: d.name, color: RARITY_COLOR[3], sub: both((i) => `${i ? 'Комплект снаряжения' : 'Gear set'} · ${pieces.length}`), art: `icon.set_${id}`, fig: 'icon',
    notes: [
      ...d.bonus.map((b): TipNote => ({ t: both((i) => `(${b.n}) ${b.text[i]}`), tone: 'gift' })),
      { t: both((i) => pieces.map((s) => `${d.pieces[s as keyof typeof d.pieces]?.[i] ?? s} (${SLOT_NAMES[s as keyof typeof SLOT_NAMES]?.[i] ?? s})`).join(' · ')), tone: 'muted' },
    ],
  };
}

// ------------------------------------------------------------------------------------------------ the key

/** The card of a key `kind:id[:n]`, or undefined: no such thing. */
export function detailCard(key: string): DCard | undefined {
  const i = key.indexOf(':');
  if (i < 0) return undefined;
  const kind = key.slice(0, i);
  let rest = key.slice(i + 1);
  let n = NaN;
  const j = rest.lastIndexOf(':');
  if (j > 0 && kind !== 'cos' && /^\d+$/.test(rest.slice(j + 1))) {
    n = Number(rest.slice(j + 1));
    rest = rest.slice(0, j);
  }
  const lv = Number.isFinite(n) ? n : 1;
  switch (kind as DetailKind) {
    case 'unit': return unitDetail(rest, Number.isFinite(n) ? n : 0);
    case 'good': return goodDetail(rest);
    case 'lres': return landResDetail(rest);
    case 'hull': return hullDetail(rest);
    case 'gun': return fromTip(gunTip(rest), `icon.gun_${rest}`);
    case 'mount': return fromTip(mountTip(rest), `icon.mount_${rest}`);
    case 'module': return fromTip(moduleTip(rest, Number.isFinite(n) ? n : MODULES[rest as keyof typeof MODULES]?.maxLevel ?? 1), `icon.mod_${rest}`);
    case 'fh': return fromTip(figureheadTip(rest), `icon.${rest}`);
    case 'ammo': return ammoDetail(rest);
    case 'skill': return fromTip(skillTip(rest, lv), SKILLS[rest as SkillId] ? `icon.${SKILLS[rest as SkillId].icon}` : undefined);
    case 'order': return fromTip(orderTip(rest), ORDERS[rest as OrderId] ? `icon.${ORDERS[rest as OrderId].icon}` : undefined);
    case 'talent': return fromTip(talentTip(rest, lv), TALENTS_BY_ID[rest] ? `icon.talent_${rest}` : undefined);
    case 'relic': return fromTip(relicTip(rest, Number.isFinite(n) ? n : 0, false), `icon.relic_${rest}`);
    case 'aset': return fromTip(setTip(rest), (ART_SETS as Record<string, { pieces: string[] }>)[rest] ? `icon.${ARTIFACTS[(ART_SETS as Record<string, { pieces: string[] }>)[rest].pieces[0]]?.icon}` : undefined);
    case 'gset': return gearSetDetail(rest);
    case 'art': case 'base': {
      const it = baseItem(rest);
      return it ? itemDetail(it) : undefined;
    }
    case 'town': return fromTip(townTip(rest, lv));
    case 'producer': return fromTip(producerTip(rest, lv));
    case 'building': return fromTip(buildingTip(rest, lv));
    case 'tattoo': return fromTip(tattooTip(rest, false), TATTOO_BY_ID[rest] ? `icon.tattoo_${rest}` : undefined);
    case 'pet': return fromTip(petTip(rest, false), PETS[rest as keyof typeof PETS] ? `icon.pet_${rest}` : undefined);
    case 'deed': return fromTip(deedTip(rest));
    case 'feat': return fromTip(featTip(rest));
    case 'cos': {
      const x = cosItem(rest);
      if (!x) return undefined;
      const KIND: Record<string, Tr> = {
        title: ['Title', 'Титул'], plate: ['Name plate', 'Табличка'], frame: ['Portrait frame', 'Рамка портрета'], emblem: ['Emblem', 'Эмблема'],
        cloth: ['Sail cloth', 'Парусина'], trail: ['Wake trail', 'След за кормой'], emote: ['Emote', 'Эмоция'],
      };
      const how: Tr = x.price === 0 ? ['Free for every captain.', 'Бесплатно для всех капитанов.']
        : x.price ? [`Sold in the shop for ${x.price} doubloons.`, `Продаётся в лавке за ${x.price} дублонов.`]
        : x.earn ? (x.earn.k === 'level' ? [`Earned at captain level ${x.earn.n}.`, `Даётся на ${x.earn.n}-м уровне капитана.`]
          : x.earn.k === 'boarded' ? [`Earned for ${x.earn.n} ships boarded.`, `Даётся за ${x.earn.n} взятых на абордаж кораблей.`]
          : x.earn.k === 'arena' ? [`Earned at duel rating ${x.earn.rating}.`, `Даётся за рейтинг дуэлей ${x.earn.rating}.`]
          : ['Earned by finishing the campaign.', 'Даётся за прохождение кампании.'])
        : ['Comes only in its bundle.', 'Только в своём наборе.'];
      const art = cosArt(x);
      return { name: x.name, color: RARITY_COLOR[Math.max(0, Math.min(4, x.tier))], sub: both((i) => `${KIND[x.kind]?.[i] ?? x.kind}`), ...(art ? { art: art.includes('.') || art.startsWith('/') ? art : `icon.${art}`, fig: 'icon' as const } : {}), notes: [{ t: how, tone: 'gift' }] };
    }
  }
  return undefined;
}

/** Every key the tests walk: each unit, good, land resource, hull, gun, mount, module, figurehead, shot, skill, order,
 *  talent, relic, set, artifact and item base. */
export function allDetailKeys(): string[] {
  const out: string[] = [];
  const add = (kind: string, ids: Iterable<string>) => { for (const id of ids) out.push(`${kind}:${id}`); };
  add('unit', Object.keys(UNITS));
  add('good', GOOD_IDS);
  add('lres', Object.keys(LAND_RES_DEF));
  add('hull', Object.keys(SHIP_CLASSES));
  add('gun', Object.keys(GUNS));
  add('mount', Object.keys(MOUNTS));
  add('module', Object.keys(MODULES));
  add('fh', Object.keys(FIGUREHEADS));
  add('ammo', Object.keys(AMMO));
  add('skill', Object.keys(SKILLS));
  add('order', Object.keys(ORDERS));
  add('talent', Object.keys(TALENTS_BY_ID));
  add('tattoo', Object.keys(TATTOO_BY_ID));
  add('pet', Object.keys(PETS));
  add('gset', Object.keys(SETS));
  add('relic', Object.keys(RELICS));
  add('aset', Object.keys(ART_SETS));
  add('art', Object.keys(ARTIFACTS));
  add('base', Object.keys(ITEM_BASES));
  return out;
}
