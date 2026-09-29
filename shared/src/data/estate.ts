// A captain's own island and her outposts (docs/12 P7). The island is a real island of the world, bought outright:
// it cannot be besieged, it grows through ten levels on materials brought from every corner of the sea, and its
// residents — the rescued, the freed, the hired — work its buildings and its outposts. Outposts on other islands
// take a resource from the land by the hour, without their owner, until their store is full; they are claimed for
// a week at a time, and pirates come for a full store.

import type { GoodId } from './goods.ts';
import type { IslandBiome, RegionId } from '../world/regions.ts';
import { GOODS } from './goods.ts';

export type Tr = [string, string];

export interface IsleLevel {
  name: Tr;
  slots: number;
  outposts: number;
  caravans: number;
  residents: number;
  /** What the step up to this level asks: silver from the treasury, goods from the island's store. */
  silver: number;
  goods: Partial<Record<GoodId, number>>;
}

/** Levels 1..10 (index 0 unused). */
export const ISLE_LEVELS: IsleLevel[] = [
  { name: ['', ''], slots: 0, outposts: 0, caravans: 0, residents: 0, silver: 0, goods: {} },
  { name: ['Anchorage', 'Стоянка'], slots: 3, outposts: 1, caravans: 1, residents: 2, silver: 0, goods: {} },
  { name: ['Homestead', 'Хутор'], slots: 4, outposts: 2, caravans: 1, residents: 4, silver: 2_000, goods: { planks: 60 } },
  { name: ['Settlement', 'Посёлок'], slots: 5, outposts: 2, caravans: 2, residents: 6, silver: 6_000, goods: { planks: 150, iron: 40 } },
  { name: ['Trading Post', 'Фактория'], slots: 6, outposts: 3, caravans: 2, residents: 8, silver: 12_000, goods: { planks: 260, iron: 80, tar: 40 } },
  { name: ['Harbour', 'Гавань'], slots: 7, outposts: 4, caravans: 3, residents: 10, silver: 25_000, goods: { planks: 400, iron: 140, salt: 60 } },
  { name: ['Township', 'Городок'], slots: 8, outposts: 5, caravans: 3, residents: 12, silver: 45_000, goods: { planks: 500, iron: 180, pearls: 20, spices: 40 } },
  { name: ['Stronghold', 'Крепость'], slots: 9, outposts: 6, caravans: 4, residents: 14, silver: 70_000, goods: { planks: 600, iron: 220, gunpowder: 80, sulfur_iron: 4 } },
  { name: ['Bastion', 'Твердыня'], slots: 10, outposts: 7, caravans: 4, residents: 16, silver: 110_000, goods: { planks: 700, iron: 260, timber: 200, whalebone: 30 } },
  { name: ['Citadel', 'Цитадель'], slots: 11, outposts: 8, caravans: 5, residents: 18, silver: 160_000, goods: { planks: 800, iron: 300, ambergris: 2, serpent_scale: 6 } },
  { name: ['Pirate Capital', 'Пиратская столица'], slots: 12, outposts: 8, caravans: 6, residents: 20, silver: 250_000, goods: { planks: 1000, iron: 400, sulfur_iron: 10 } },
];
export const ISLE_MAX = 10;

/** Where a captain may buy an island outright: the safe and contested seas (the lawless are for outposts). */
export const BUY_REGIONS: RegionId[] = ['black_coast', 'gravewater', 'whispering', 'leviathan_reach'];
/** The price of an island bought outright against a month's lease of it. */
export const BUY_MUL = 2.5;
/** Home: from a port to one's own island, once in half an hour, with an empty hold. */
export const HOME_COOLDOWN = 1800;

// ------------------------------------------------------------------------------------------------ residents

export type Profession = 'fisher' | 'carpenter' | 'smith' | 'cook' | 'cartographer' | 'herbalist' | 'gunner' | 'pilot';
export const PROFESSIONS: Profession[] = ['fisher', 'carpenter', 'smith', 'cook', 'cartographer', 'herbalist', 'gunner', 'pilot'];

export interface ProfessionDef {
  name: Tr;
  /** Where the trade tells most (+40% like anyone, and a knack of its own). */
  knack: Tr;
  lines: Tr[];
}

export const PROFESSION_DEFS: Record<Profession, ProfessionDef> = {
  fisher: { name: ['Fisher', 'Рыбак'], knack: ['a fishery or a smokehouse yields a tenth more again', 'артель или коптильня дают ещё на десятую больше'], lines: [['The herring are thick off the north point this week.', 'У северного мыса на этой неделе густо сельди.'], ['Nets don’t mend themselves, captain.', 'Сети сами не чинятся, капитан.']] },
  carpenter: { name: ['Carpenter', 'Плотник'], knack: ['buildings wear half as fast', 'постройки изнашиваются вдвое медленнее'], lines: [['Good timber, this. It’ll stand a hundred years.', 'Добрый лес. Сто лет простоит.'], ['Give me planks and I’ll give you a town.', 'Дайте мне брусья — дам вам город.']] },
  smith: { name: ['Smith', 'Кузнец'], knack: ['tempering at the forge may make a piece excellent', 'закалка в кузнице может сделать вещь отличной'], lines: [['The forge is hot. Bring me iron worth the fire.', 'Горн горячий. Несите железо, достойное огня.'], ['A blade is only as good as its temper.', 'Клинок хорош настолько, насколько хороша закалка.']] },
  cook: { name: ['Cook', 'Кок'], knack: ['a crew moored here keeps its spirits high', 'команда у острова не падает духом'], lines: [['Salt pork again? No, captain — tonight it’s fish stew.', 'Опять солонина? Нет, капитан, сегодня уха.'], ['A fed crew is a loyal crew.', 'Сытая команда — верная команда.']] },
  cartographer: { name: ['Cartographer', 'Картограф'], knack: ['copies charts in the chart house for free', 'бесплатно копирует карты в картографической'], lines: [['There’s an island on your chart that isn’t there.', 'На вашей карте есть остров, которого нет.'], ['Every coast has a secret. Mine is patience.', 'У каждого берега есть тайна. Моя — терпение.']] },
  herbalist: { name: ['Herbalist', 'Травник'], knack: ['two medicine a day into the store', 'два лекарства в день в склад'], lines: [['Chew this. Don’t ask what it is.', 'Жуйте. Не спрашивайте, что это.'], ['The fever takes the careless first.', 'Лихорадка первой берёт беспечных.']] },
  gunner: { name: ['Gunner', 'Канонир'], knack: ['the island’s guns fire a third more often', 'пушки острова стреляют на треть чаще'], lines: [['Powder dry, guns run out. Let them come.', 'Порох сухой, пушки выкачены. Пусть приходят.'], ['I can hit a gull at half a mile. Twice.', 'Попаду в чайку за полмили. Дважды.']] },
  pilot: { name: ['Pilot', 'Лоцман'], knack: ['caravans from here sail a tenth faster', 'караваны отсюда идут на десятую быстрее'], lines: [['I know every reef from here to the Ashen Isles.', 'Я знаю каждый риф отсюда до Пепельных островов.'], ['Wind’s backing. Weather by nightfall.', 'Ветер заходит. К ночи будет погода.']] },
};

const RES_FIRST: Tr[] = [
  ['Aldo', 'Альдо'], ['Bessa', 'Бесса'], ['Corin', 'Корин'], ['Dunya', 'Дуня'], ['Emeric', 'Эмерик'], ['Fen', 'Фен'], ['Greta', 'Грета'], ['Hob', 'Хоб'],
  ['Ilse', 'Ильза'], ['Jory', 'Джори'], ['Kit', 'Кит'], ['Lorna', 'Лорна'], ['Mads', 'Мадс'], ['Nora', 'Нора'], ['Olek', 'Олек'], ['Pim', 'Пим'],
  ['Quenna', 'Квенна'], ['Ruth', 'Рут'], ['Sven', 'Свен'], ['Tilda', 'Тильда'], ['Ulf', 'Ульф'], ['Vera', 'Вера'], ['Wat', 'Уот'], ['Yves', 'Ив'],
];

/** A resident's name from her number (the same everywhere). */
export function residentName(n: number): Tr {
  return RES_FIRST[Math.abs(n) % RES_FIRST.length];
}

const RES_WOMEN = new Set(['Bessa', 'Dunya', 'Greta', 'Ilse', 'Lorna', 'Nora', 'Quenna', 'Ruth', 'Tilda', 'Vera']);

/** Whether the resident of that number is a woman (her portrait, docs/12 P11). */
export function residentIsWoman(n: number): boolean {
  return RES_WOMEN.has(residentName(n)[0]);
}

/** Hiring a resident in a tavern of one's own island. */
export const RESIDENT_HIRE = 800;
/** A resident's hand in a building or an outpost; hired hands' at an outpost (and their wage a day). */
export const RESIDENT_BONUS = 0.4;
export const HANDS_BONUS = 0.2;
export const HANDS_WAGE = 150;

// ------------------------------------------------------------------------------------------------ outposts

export type OutpostKind = 'lumber' | 'mine' | 'saltworks' | 'fishery' | 'whaling' | 'pearls' | 'sulfur' | 'plantation' | 'tar' | 'deep_shaft';
export const OUTPOST_KINDS: OutpostKind[] = ['lumber', 'mine', 'saltworks', 'fishery', 'whaling', 'pearls', 'sulfur', 'plantation', 'tar', 'deep_shaft'];

export interface OutpostDef {
  id: OutpostKind;
  name: Tr;
  /** Where it may stand: an island feature, a biome, a sea (any one of them). */
  features?: string[];
  biomes?: IslandBiome[];
  regions?: RegionId[];
  /** What it gives by the hour at level 1 and level 5 (a biome may change the good). */
  good: GoodId;
  rate: [number, number];
  cap: [number, number];
  /** How much the sea's pirates want it (0..1). */
  risk: number;
  /** A second good now and then. */
  extra?: { good: GoodId; chance: number };
}

export const OUTPOSTS: Record<OutpostKind, OutpostDef> = {
  lumber: { id: 'lumber', name: ['Lumber Camp', 'Лесопилка'], features: ['grove'], biomes: ['jungle', 'mangrove', 'temperate'], good: 'timber', rate: [6, 18], cap: [80, 240], risk: 0.2 },
  mine: { id: 'mine', name: ['Mine', 'Рудник'], features: ['mine'], biomes: ['volcanic', 'blacksand', 'crystal'], good: 'iron', rate: [4, 12], cap: [60, 180], risk: 0.5 },
  saltworks: { id: 'saltworks', name: ['Saltworks', 'Солеварня'], biomes: ['saltflat'], regions: ['black_coast'], good: 'salt', rate: [3, 9], cap: [40, 120], risk: 0.2 },
  fishery: { id: 'fishery', name: ['Fishing Crew', 'Рыбная артель'], biomes: ['temperate', 'mangrove', 'atoll', 'mossy'], good: 'fish', rate: [8, 24], cap: [60, 180], risk: 0.15 },
  whaling: { id: 'whaling', name: ['Whaling Station', 'Китобойная станция'], regions: ['leviathan_reach', 'gravewater'], good: 'whale_oil', rate: [1, 4], cap: [20, 60], risk: 0.8, extra: { good: 'baleen', chance: 0.25 } },
  pearls: { id: 'pearls', name: ['Pearl Farm', 'Жемчужная ферма'], features: ['pearl_bank'], biomes: ['atoll'], good: 'pearls', rate: [0.5, 2], cap: [10, 30], risk: 0.8 },
  sulfur: { id: 'sulfur', name: ['Sulphur Pit', 'Серный карьер'], biomes: ['volcanic'], good: 'sulfur_iron', rate: [0.3, 1.2], cap: [6, 18], risk: 0.5 },
  plantation: { id: 'plantation', name: ['Plantation', 'Плантация'], biomes: ['jungle', 'mossy'], good: 'sugar', rate: [2, 6], cap: [30, 90], risk: 0.5 },
  tar: { id: 'tar', name: ['Tar Kiln', 'Смолокурня'], features: ['grove'], biomes: ['mangrove', 'ice'], good: 'tar', rate: [2, 6], cap: [30, 90], risk: 0.2 },
  deep_shaft: { id: 'deep_shaft', name: ['Deep Shaft', 'Глубинная шахта'], regions: ['drowned_crown'], good: 'abyssal_ore', rate: [0.2, 0.8], cap: [5, 15], risk: 1 },
};

export const OUTPOST_MAX_LEVEL = 5;
/** Founding: materials brought in the hold; a level up, the same again times the level; a week's claim. */
export const OUTPOST_BUILD: Partial<Record<GoodId, number>> = { planks: 40, iron: 10 };
export function outpostUpgrade(level: number, kind?: OutpostKind): { silver: number; goods: Partial<Record<GoodId, number>> } {
  // Priced by what the outpost is worth (docs/12 P12): a salt pan is not raised for what a mine is, so every
  // kind's next level pays for itself within a fortnight of hauling.
  const w = kind ? outpostWorth(kind) : 1;
  return { silver: Math.round((3000 * level * w) / 50) * 50, goods: { planks: Math.ceil(30 * level * w), iron: Math.ceil(10 * level * w) } };
}

/** An outpost's worth beside a lumber camp's (0.35 .. 1.25): what its first level yields in a day of two hauls. */
export function outpostWorth(kind: OutpostKind): number {
  const d = OUTPOSTS[kind];
  const day = Math.min(d.rate[0] * 24, d.cap[0] * 2) * GOODS[d.good].basePrice;
  return Math.max(0.35, Math.min(1.25, day / 2400));
}
export function claimCost(safety: 'safe' | 'contested' | 'lawless'): number {
  return safety === 'lawless' ? 0 : safety === 'contested' ? 1500 : 2500;
}
export const CLAIM_DAYS = 7;

export type Guard = 'none' | 'militia' | 'battery' | 'fort';
export const GUARDS: Record<Guard, { name: Tr; cost: number; chance: number; holds: boolean }> = {
  none: { name: ['None', 'Нет'], cost: 0, chance: 1, holds: false },
  militia: { name: ['Militia', 'Ополчение'], cost: 500, chance: 0.7, holds: false },
  battery: { name: ['Battery', 'Батарея'], cost: 4000, chance: 0.4, holds: false },
  fort: { name: ['Fort', 'Форт'], cost: 12000, chance: 0.15, holds: true },
};
/** A raid's chance a day by the safety of the waters, before the store's fill and the guard. */
export const RAID_DAY: Record<string, number> = { safe: 0.05, contested: 0.25, lawless: 0.5 };
export const RAID_MIN = 10;
export const ROB_SEC = 300;

/** Output by the hour at a level (level 1..5), before hands. */
export function outpostRate(kind: OutpostKind, level: number): number {
  const d = OUTPOSTS[kind];
  return d.rate[0] + ((d.rate[1] - d.rate[0]) * (Math.max(1, Math.min(5, level)) - 1)) / 4;
}

export function outpostCap(kind: OutpostKind, level: number): number {
  const d = OUTPOSTS[kind];
  return Math.round(d.cap[0] + ((d.cap[1] - d.cap[0]) * (Math.max(1, Math.min(5, level)) - 1)) / 4);
}

/** The good an outpost gives on its island (a mine of coal off the volcanoes; a plantation's crop by its soil). */
export function outpostGood(kind: OutpostKind, biome: IslandBiome): GoodId {
  if (kind === 'mine') return biome === 'volcanic' || biome === 'blacksand' || biome === 'crystal' ? 'iron' : 'coal';
  if (kind === 'plantation') return biome === 'mossy' ? 'tobacco' : biome === 'jungle' ? 'spices' : 'sugar';
  return OUTPOSTS[kind].good;
}

/** Whether an island may bear an outpost of this kind. */
export function outpostFits(kind: OutpostKind, is: { biome: IslandBiome; features: string[]; region: RegionId }): boolean {
  const d = OUTPOSTS[kind];
  return (d.features?.some((f) => is.features.includes(f)) ?? false) || (d.biomes?.includes(is.biome) ?? false) || (d.regions?.includes(is.region) ?? false);
}

// ------------------------------------------------------------------------------------------------ trophies

export type TrophyKind = 'flag' | 'skull' | 'fish';
/** A trophy's share of its trade (half a percent each, to a tenth). */
export const TROPHY_STEP = 0.005;
export const TROPHY_MAX = 0.1;

export function estatePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const l of ISLE_LEVELS.slice(1)) out.push(l.name);
  for (const k of OUTPOST_KINDS) out.push(OUTPOSTS[k].name);
  for (const p of PROFESSIONS) out.push(PROFESSION_DEFS[p].name, ...PROFESSION_DEFS[p].lines);
  for (const n of RES_FIRST) out.push(n);
  out.push(
    ['{0} is yours for ever. Its upkeep is paid from its treasury, day by day.', '{0} — ваш навсегда. Содержание платится из казны острова, день за днём.'],
    ['Islands are bought outright only in the safe and contested seas.', 'Острова выкупают навсегда только в безопасных и спорных водах.'],
    ['{0} is held by {1}.', '{0} принадлежит: {1}.'],
    ['The island costs {0} silver.', 'Остров стоит {0} серебра.'],
    ['{0} grows: {1}.', '{0} растёт: {1}.'],
    ['The island’s store lacks {0}.', 'На складе острова не хватает: {0}.'],
    ['The treasury lacks {0} silver.', 'В казне не хватает {0} серебра.'],
    ['Your island is at its greatest.', 'Ваш остров уже велик как никогда.'],
    ['A captain’s own island cannot be besieged.', 'Собственный остров капитана нельзя осадить.'],
    ['Home: {0}.', 'Домой: {0}.'],
    ['Home is only from a port, with an empty hold.', 'Домой — только из порта и с пустым трюмом.'],
    ['Home again in {0} min.', 'Домой снова — через {0} мин.'],
    ['You have no island of your own.', 'У вас нет собственного острова.'],
    ['{0} settles on your island: {1}.', 'На острове поселяется {0}: {1}.'],
    ['The houses are full: build a Residents’ House or raise the island.', 'Дома полны: постройте дом жителей или поднимите остров.'],
    ['{0} goes to work: {1}.', '{0} идёт работать: {1}.'],
    ['An outpost is founded on {0}: {1}.', 'На острове {0} основан аванпост: {1}.'],
    ['This island does not suit a {0}.', 'Этот остров не годится для такого аванпоста: {0}.'],
    ['Bring {0} in the hold to found it.', 'Для основания привезите в трюме: {0}.'],
    ['Your island allows {0} outposts; raise it for more.', 'Ваш остров позволяет {0} аванпостов; поднимите его, чтобы было больше.'],
    ['Someone already works this island.', 'На этом острове уже кто-то хозяйничает.'],
    ['An outpost stands on a wild island, not a port’s or another’s.', 'Аванпост ставят на диком острове, не на портовом и не на чужом.'],
    ['{0} on {1}: level {2}.', '{0} на острове {1}: уровень {2}.'],
    ['The claim on {0} is renewed for a week.', 'Заявка на {0} продлена на неделю.'],
    ['Pirates have landed at your {0} on {1} — {2} minutes before it is ruined!', 'Пираты высадились у вашего аванпоста «{0}» на острове {1} — {2} минут до разорения!'],
    ['The raiders at your {0} are driven off. Their plunder is yours.', 'Налётчики у аванпоста «{0}» отбиты. Их добыча — ваша.'],
    ['The raiders stripped your {0} on {1}: {2}% of its store is gone.', 'Налётчики разграбили аванпост «{0}» на острове {1}: пропало {2}% склада.'],
    ['The fort at your {0} beat the raiders off.', 'Форт у аванпоста «{0}» отбил налётчиков.'],
    ['The store of your {0} is in the hold.', 'Склад аванпоста «{0}» — в трюме.'],
    ['Your {0} on {1} is being robbed!', 'Ваш аванпост «{0}» на острове {1} грабят!'],
    ['The store of {0}’s outpost is yours: {1} units.', 'Склад аванпоста капитана {0} ваш: {1} ед.'],
    ['An outpost is robbed only in lawless waters.', 'Аванпост можно ограбить только в беззаконных водах.'],
    ['The claim on your {0} on {1} has lapsed: the outpost is abandoned.', 'Заявка на аванпост «{0}» на острове {1} истекла: аванпост брошен.'],
    ['The trophy hall of {0}', 'Зал трофеев: {0}'],
    ['Visitors to your trophy hall: {0}.', 'Гостей в вашем зале трофеев: {0}.'],
    ['Outposts', 'Аванпосты'],
  );
  return out;
}
