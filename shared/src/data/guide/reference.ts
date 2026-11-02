// «Лоцманская книга» → «Справочник» (2026-11-02): the reference half of the book, written by nobody — every entry is
// read from the game's own tables, so it never falls behind the game. Five kinds:
//   creature — every unit (UNITS): tier, group/faction, ranged or melee, upgraded;
//   ship     — every hull class (SHIP_CLASSES): line (trade / war / fast / hauler / the sea's beasts), rank, ⚓, hold;
//   item     — every item template: gear bases, legendaries, artifacts, gear sets, artifact sets: slot, rarity, level, set;
//   building — every building: the island town (TOWN), its producers (PRODUCERS), the holdings (BUILDINGS): kind, level;
//   good     — every good (GOODS) and land resource: category, room, price; ship's stores apart from trade goods.
//
// An entry names its card by the detail key the whole game uses (`data-detail`, shared/src/data/detail.ts): the card is
// never built here — `detail` is the key, the name and the picture are the card's own.
//
//   referenceIndex(lang)            → { entries, facets, kinds } (cached per tongue)
//   filterReference(entries, q)     → the entries a kind, a search and a set of chosen facet values leave
//   creatureGroup(id)               → the bestiary's group of a unit (the site's /site/creatures/ chips)
//
// Facet values ride in `tags` as `<facet>:<value>`: within a facet the chosen values are OR, across facets AND.

import { UNITS } from '../army.ts';
import type { UnitDef } from '../army.ts';
import { BEAST_IDS, LAND_RES_DEF, SEA_BEAST_IDS } from '../bestiary.ts';
import { FACTION_KIND_IDS } from '../factionunits.ts';
import { PREMIUM_BEAST_IDS } from '../premiumbeasts.ts';
import { SHIP_BEAST_IDS } from '../shipbeasts.ts';
import { BOSS_UNIT_IDS } from '../bossunits.ts';
import { TITAN_IDS } from '../titans.ts';
import { SHIP_CLASSES } from '../ships.ts';
import type { ShipClassId } from '../ships.ts';
import { levelRange } from '../shiplevel.ts';
import { ITEM_BASES, LEGENDARY_ITEMS, RARITY_NAMES, SETS, SLOT_NAMES, SLOT_OPENS, isShipSlot } from '../items.ts';
import type { Slot } from '../items.ts';
import { ARTIFACTS, ART_CLASS_NAMES, ART_ILVL, ART_RARITY, ART_SETS } from '../artifacts.ts';
import type { ArtClass } from '../artifacts.ts';
import { TOWN, TOWN_IDS } from '../town.ts';
import { PRODUCERS, PRODUCER_MAX } from '../base.ts';
import { BUILDINGS } from '../holdings.ts';
import { GOODS, GOOD_IDS, isSupply } from '../goods.ts';
import type { GoodCategory } from '../goods.ts';
import { FACTIONS } from '../factions.ts';
import { detailCard } from '../detail.ts';
import type { DCard } from '../detail.ts';
import { DATA_RU } from '../../../../client/src/lang/data.ts';

type Tr = [string, string];
export type RefLang = 'ru' | 'en';
export type RefKind = 'creature' | 'ship' | 'item' | 'building' | 'good';
export const REF_KINDS: RefKind[] = ['creature', 'ship', 'item', 'building', 'good'];

export interface RefEntry {
  kind: RefKind;
  /** The thing's own id (a unit id, a class id, a base id …); unique within its kind. */
  id: string;
  /** The detail card's key: 'unit:musketeer', 'hull:frigate', 'base:<id>', 'art:<id>', 'leg:<id>', 'gset:<id>',
   *  'aset:<id>', 'town:dw3', 'producer:lumber', 'building:fort', 'good:timber', 'lres:shell'. */
  detail: string;
  /** In the tongue asked. */
  name: string;
  /** The card's line under the name (its kind, tier …), in the tongue asked. */
  sub: string;
  /** The number the list sorts by and the tile shows: a creature's tier, a ship's ⚓ (lowest), an item's level, a
   *  building's top level, a good's base price. */
  level: number;
  /** The tile's short chip: «3», «⚓4–6», «Ур. 2», «120». */
  chip: string;
  /** The card's picture: an asset id and what draws it (a creature's figure, a hull's sprite, an icon). */
  art?: string;
  fig?: DCard['fig'];
  color?: string;
  /** The facet values it carries: '<facet>:<value>' (see `facets`). */
  tags: string[];
  /** Lower-case words a search matches: both tongues' names, the id, the kind's words, the facet values' names. */
  search: string;
  /** Its own page on the website, under the tongue's root (/site/ or /site/en/), where it has one. */
  site?: string;
  /** Numbers to sort by besides `level` (a ship's hold, a good's room …). */
  nums?: Record<string, number>;
}

export interface RefFacetValue { v: string; name: string; n: number }
export interface RefFacet { id: string; kind: RefKind; name: string; values: RefFacetValue[] }
export interface RefIndex {
  entries: RefEntry[];
  facets: RefFacet[];
  kinds: { kind: RefKind; name: string; n: number }[];
}

// ------------------------------------------------------------------------------------------------ the words

const KIND_NAMES: Record<RefKind, Tr> = {
  creature: ['Creatures', 'Существа'], ship: ['Ships', 'Корабли'], item: ['Items', 'Предметы'], building: ['Buildings', 'Постройки'], good: ['Goods', 'Товары'],
};
/** What a search for the kind itself finds (any tongue). */
const KIND_WORDS: Record<RefKind, string> = {
  creature: 'creature unit army существо отряд армия юнит', ship: 'ship hull class корабль корпус судно', item: 'item gear artifact предмет снаряжение шмот артефакт',
  building: 'building town island постройка здание остров город', good: 'good cargo resource товар груз ресурс',
};

export type CreatureGroup = 'crew' | 'land' | 'sea' | 'faction' | 'premium' | 'shipbeast' | 'boss' | 'titan';
export const CREATURE_GROUPS: CreatureGroup[] = ['crew', 'land', 'sea', 'faction', 'premium', 'shipbeast', 'titan', 'boss'];
export const CREATURE_GROUP_NAMES: Record<CreatureGroup, Tr> = {
  crew: ['Pirate crew', 'Пиратская команда'], land: ['Island creatures', 'Существа островов'], sea: ['Sea creatures', 'Морские существа'],
  faction: ['Faction troops', 'Войска фракций'], premium: ['Legendary hires', 'Легендарный найм'], shipbeast: ['Ship companions', 'Спутники кораблей'],
  boss: ['Shore bosses', 'Боссы побережья'], titan: ['Titans of the Grail', 'Титаны Грааля'],
};
/** The bestiary's group of a unit (the site's chips; the first list it is in, the titans first). */
export function creatureGroup(id: string): CreatureGroup {
  if ((TITAN_IDS as string[]).includes(id)) return 'titan';
  if ((BOSS_UNIT_IDS as string[]).includes(id)) return 'boss';
  if ((SHIP_BEAST_IDS as string[]).includes(id)) return 'shipbeast';
  if ((PREMIUM_BEAST_IDS as string[]).includes(id)) return 'premium';
  if ((FACTION_KIND_IDS as string[]).includes(id)) return 'faction';
  if ((SEA_BEAST_IDS as string[]).includes(id)) return 'sea';
  if ((BEAST_IDS as string[]).includes(id)) return 'land';
  return 'crew';
}
const ROSTER_NAMES: Record<string, Tr> = { dutchman: ['The Flying Dutchman', 'Летучий голландец'] };
const rosterName = (r: string): Tr => {
  const f = (FACTIONS as Record<string, { name: string }>)[r];
  return f ? [f.name, DATA_RU[`factions.FACTIONS.${r}.name`] ?? f.name] : ROSTER_NAMES[r] ?? [r, r];
};

const LINE_NAMES: Record<string, Tr> = { trade: ['Traders', 'Торговые'], combat: ['Warships', 'Боевые'], fast: ['Fast ships', 'Быстрые'], hauler: ['Haulers', 'Грузовозы'], beast: ['Beasts and bosses', 'Чудища и боссы'] };
const LINES = ['trade', 'combat', 'fast', 'hauler', 'beast'];
const LINE_ONE: Record<string, Tr> = { trade: ['Trader', 'Торговый'], combat: ['Warship', 'Боевой'], fast: ['Fast', 'Быстрый'], hauler: ['Hauler', 'Грузовоз'], beast: ['Beast of the sea', 'Чудище моря'] };

type ItemClass = 'gear' | 'legendary' | 'artifact' | 'gset' | 'aset';
const ITEM_CLASS_NAMES: Record<ItemClass, Tr> = {
  gear: ['Gear', 'Снаряжение'], legendary: ['Legendary', 'Легендарные'], artifact: ['Artifacts', 'Артефакты'], gset: ['Gear sets', 'Комплекты'], aset: ['Artifact sets', 'Наборы артефактов'],
};
const SLOT_GROUP_NAMES: Record<'ship' | 'captain', Tr> = { ship: ['Ship', 'Корабль'], captain: ['Captain', 'Капитан'] };

type BuildingKind = 'town' | 'dwelling' | 'producer' | 'holding';
const BUILDING_KIND_NAMES: Record<BuildingKind, Tr> = { town: ['Town', 'Город'], dwelling: ['Dwellings', 'Жилища'], producer: ['Producers', 'Промыслы'], holding: ['Holdings', 'Владения'] };

const CAT_NAMES: Record<GoodCategory | 'land', Tr> = {
  staple: ['Staple', 'Ходовые'], luxury: ['Luxury', 'Роскошь'], industrial: ['Industrial', 'Сырьё'], military: ['Military', 'Военные'],
  supply: ['Ship’s stores', 'Припасы'], contraband: ['Contraband', 'Контрабанда'], mystic: ['Mystic', 'Мистические'], rare: ['Rare', 'Редкие'], land: ['Land', 'Ресурсы суши'],
};
const CATS: (GoodCategory | 'land')[] = ['staple', 'luxury', 'industrial', 'military', 'supply', 'contraband', 'mystic', 'rare', 'land'];

/** The facets of each kind: id, name, values in order, each value's name. */
const FACETS: { id: string; kind: RefKind; name: Tr; values: [string, Tr][] }[] = [
  { id: 'tier', kind: 'creature', name: ['Tier', 'Уровень'], values: [1, 2, 3, 4, 5, 6, 7, 8].map((t) => [String(t), [String(t), String(t)]]) },
  { id: 'grp', kind: 'creature', name: ['Group', 'Группа'], values: CREATURE_GROUPS.map((g) => [g, CREATURE_GROUP_NAMES[g]]) },
  { id: 'fac', kind: 'creature', name: ['Faction', 'Фракция'], values: [] },
  { id: 'atk', kind: 'creature', name: ['Attack', 'Атака'], values: [['ranged', ['Ranged', 'Стрелки']], ['melee', ['Melee', 'Ближний бой']]] },
  { id: 'up', kind: 'creature', name: ['Upgrade', 'Улучшение'], values: [['up', ['Upgraded', 'Улучшенные']], ['plain', ['Plain', 'Обычные']]] },
  { id: 'line', kind: 'ship', name: ['Line', 'Линия'], values: LINES.map((l) => [l, LINE_NAMES[l]]) },
  { id: 'rank', kind: 'ship', name: ['Rank', 'Ранг'], values: [] },
  { id: 'anchor', kind: 'ship', name: ['Ship level', 'Уровень ⚓'], values: [] },
  { id: 'hold', kind: 'ship', name: ['Hold', 'Трюм'], values: [['s', ['Small', 'Малый']], ['m', ['Middling', 'Средний']], ['l', ['Large', 'Большой']], ['xl', ['Huge', 'Огромный']]] },
  { id: 'prem', kind: 'ship', name: ['Sold for', 'Продаётся за'], values: [['silver', ['Silver', 'Серебро']], ['doubloons', ['Doubloons', 'Дублоны']]] },
  { id: 'cls', kind: 'item', name: ['Kind', 'Вид'], values: (Object.keys(ITEM_CLASS_NAMES) as ItemClass[]).map((c) => [c, ITEM_CLASS_NAMES[c]]) },
  { id: 'who', kind: 'item', name: ['Worn by', 'Для кого'], values: [['ship', SLOT_GROUP_NAMES.ship], ['captain', SLOT_GROUP_NAMES.captain]] },
  { id: 'slot', kind: 'item', name: ['Slot', 'Слот'], values: (Object.keys(SLOT_NAMES) as Slot[]).map((s) => [s, SLOT_NAMES[s]]) },
  { id: 'rar', kind: 'item', name: ['Rarity', 'Редкость'], values: [['any', ['Any rarity', 'Любая редкость']], ...[2, 3, 4].map((r): [string, Tr] => [String(r), RARITY_NAMES[r]])] },
  { id: 'lvl', kind: 'item', name: ['Level', 'Уровень'], values: [] },
  { id: 'set', kind: 'item', name: ['Set', 'Комплект'], values: [] },
  { id: 'bk', kind: 'building', name: ['Kind', 'Вид'], values: (Object.keys(BUILDING_KIND_NAMES) as BuildingKind[]).map((k) => [k, BUILDING_KIND_NAMES[k]]) },
  { id: 'max', kind: 'building', name: ['Levels', 'Уровней'], values: [] },
  { id: 'cat', kind: 'good', name: ['Category', 'Категория'], values: CATS.map((c) => [c, CAT_NAMES[c]]) },
  { id: 'use', kind: 'good', name: ['Use', 'Назначение'], values: [['trade', ['Trade goods', 'Товары']], ['store', ['Ship’s stores', 'Судовые припасы']], ['land', ['Land resources', 'Ресурсы суши']]] },
  { id: 'room', kind: 'good', name: ['Room', 'Объём'], values: [['light', ['Light', 'Лёгкие']], ['mid', ['Middling', 'Средние']], ['bulk', ['Bulky', 'Объёмные']]] },
  { id: 'price', kind: 'good', name: ['Price', 'Цена'], values: [['cheap', ['Cheap', 'Дешёвые']], ['mid', ['Middling', 'Средние']], ['dear', ['Dear', 'Дорогие']]] },
];

/** Each facet's kind (a chosen value of another kind's facet leaves an entry be). */
const FACET_KIND = new Map(FACETS.map((f) => [f.id, f.kind]));

// ------------------------------------------------------------------------------------------------ building the list

/** One entry before its tongue is chosen. */
interface Raw {
  kind: RefKind; id: string; detail: string; level: number; chip: Tr; tags: string[]; site?: string; nums?: Record<string, number>; words?: string;
  /** A name other than the card's (a whole set's), or none: the card's. */
  name?: Tr;
  /** The tile's line, shorter than the card's (its group, line, slot), or none: the card's. */
  sub?: Tr;
}
const same = (s: string | number): Tr => [String(s), String(s)];
const LV: Tr = ['Lv', 'Ур.'];

function creatures(): Raw[] {
  return (Object.keys(UNITS) as string[]).map((id) => {
    const u = UNITS[id as keyof typeof UNITS] as UnitDef;
    const tags = [`tier:${u.tier}`, `grp:${creatureGroup(id)}`, `atk:${u.shots > 0 ? 'ranged' : 'melee'}`, `up:${u.up ? 'up' : 'plain'}`];
    if (u.roster) tags.push(`fac:${u.roster}`);
    const g = u.roster ? rosterName(u.roster) : CREATURE_GROUP_NAMES[creatureGroup(id)];
    const sub: Tr = [`${g[0]}${u.shots ? ' · ranged' : ''}`, `${g[1]}${u.shots ? ' · стрелок' : ''}`];
    return { kind: 'creature', id, detail: `unit:${id}`, sub, level: u.tier, chip: same(u.tier), tags, site: `creatures/${id}.html`, nums: { atk: u.atk, def: u.def, hp: u.hp } };
  });
}

const holdBand = (v: number) => (v < 60 ? 's' : v < 150 ? 'm' : v < 300 ? 'l' : 'xl');
function ships(): Raw[] {
  return (Object.keys(SHIP_CLASSES) as ShipClassId[]).map((id) => {
    const c = SHIP_CLASSES[id] as unknown as { tier: number; list?: string; holdVolume: number; premium?: unknown };
    const [lo, hi] = levelRange(id);
    const line = c.list ?? 'beast';
    const tags = [`line:${line}`, `rank:${c.tier}`, `anchor:${lo}`, `hold:${holdBand(c.holdVolume)}`];
    if (line !== 'beast') tags.push(`prem:${c.premium ? 'doubloons' : 'silver'}`);
    const one = LINE_ONE[line];
    return {
      kind: 'ship', id, detail: `hull:${id}`, level: lo, sub: [`${one[0]} · rank ${c.tier}`, `${one[1]} · ранг ${c.tier}`], chip: same(`⚓${lo}${hi !== lo ? `–${hi}` : ''}`), tags,
      ...(line !== 'beast' ? { site: `ships/#${id}` } : {}), nums: { rank: c.tier, hold: c.holdVolume },
    };
  });
}

function items(): Raw[] {
  const out: Raw[] = [];
  const slotTags = (s: Slot) => [`slot:${s}`, `who:${isShipSlot(s) ? 'ship' : 'captain'}`];
  // a slot's own level: a ship's slot opens at a ship level (SLOT_OPENS), a captain's is worn from the first
  const slotLv = (s: Slot) => (isShipSlot(s) ? SLOT_OPENS[s] : 1);
  const setOf = new Map<string, string>();
  for (const [sid, d] of Object.entries(SETS)) for (const s of Object.keys(d.pieces)) setOf.set(s, sid);
  for (const [id, b] of Object.entries(ITEM_BASES)) {
    const lv = slotLv(b.slot);
    out.push({ kind: 'item', id: `base:${id}`, detail: `base:${id}`, sub: SLOT_NAMES[b.slot], level: lv, chip: [`${LV[0]} ${lv}`, `${LV[1]} ${lv}`], tags: ['cls:gear', ...slotTags(b.slot), 'rar:any', `lvl:${lv}`] });
  }
  for (const [id, l] of Object.entries(LEGENDARY_ITEMS)) {
    const s = ITEM_BASES[l.base].slot, lv = slotLv(s);
    out.push({ kind: 'item', id: `leg:${id}`, detail: `leg:${id}`, sub: [`${SLOT_NAMES[s][0]} · legendary`, `${SLOT_NAMES[s][1]} · легендарный`], level: lv, chip: [`${LV[0]} ${lv}`, `${LV[1]} ${lv}`], tags: ['cls:legendary', ...slotTags(s), 'rar:4', `lvl:${lv}`] });
  }
  for (const [id, a] of Object.entries(ARTIFACTS)) {
    const lv = ART_ILVL[a.cls as ArtClass];
    const tags = ['cls:artifact', ...slotTags(a.slot), `rar:${ART_RARITY[a.cls as ArtClass]}`, `lvl:${lv}`, `acls:${a.cls}`];
    if (a.set) tags.push(`set:${a.set}`);
    const an = ART_CLASS_NAMES[a.cls as ArtClass], sn = SLOT_NAMES[a.slot as Slot];
    out.push({ kind: 'item', id: `art:${id}`, detail: `art:${id}`, sub: [`${an[0]} · ${sn[0]}`, `${an[1]} · ${sn[1]}`], level: lv, chip: [`${LV[0]} ${lv}`, `${LV[1]} ${lv}`], tags, words: `${ART_CLASS_NAMES[a.cls as ArtClass].join(' ')}` });
  }
  for (const [id, d] of Object.entries(SETS)) {
    const slots = Object.keys(d.pieces) as Slot[];
    const words = slots.map((s) => `${d.pieces[s]![0]} ${d.pieces[s]![1]}`).join(' ');
    out.push({ kind: 'item', id: `gset:${id}`, detail: `gset:${id}`, level: 1, chip: same(`×${slots.length}`), tags: ['cls:gset', 'rar:3', `set:${id}`, ...new Set(slots.flatMap(slotTags))], words });
  }
  for (const [id, d] of Object.entries(ART_SETS) as [string, { pieces: string[] }][]) {
    const lv = Math.max(...d.pieces.map((p) => ART_ILVL[ARTIFACTS[p].cls as ArtClass]));
    const slots = d.pieces.map((p) => ARTIFACTS[p].slot as Slot);
    const words = d.pieces.map((p) => ARTIFACTS[p].name.join(' ')).join(' ');
    out.push({ kind: 'item', id: `aset:${id}`, detail: `aset:${id}`, level: lv, chip: same(`×${d.pieces.length}`), tags: ['cls:aset', 'rar:4', `set:${id}`, `lvl:${lv}`, ...new Set(slots.flatMap(slotTags))], words });
  }
  return out;
}

function buildings(): Raw[] {
  const out: Raw[] = [];
  for (const id of TOWN_IDS) {
    const d = TOWN[id];
    const k: BuildingKind = d.tier ? 'dwelling' : 'town';
    const sub: Tr = d.tier ? [`Dwelling, tier ${d.tier}`, `Жилище ${d.tier}-го уровня`] : ['Town building', 'Здание города'];
    out.push({ kind: 'building', id: `town:${id}`, detail: `town:${id}`, sub, level: d.max, chip: [`${LV[0]} 1–${d.max}`, `${LV[1]} 1–${d.max}`], tags: [`bk:${k}`, `max:${d.max}`], words: d.names.flat().join(' '), nums: d.tier ? { tier: d.tier } : {} });
  }
  for (const id of Object.keys(PRODUCERS)) out.push({ kind: 'building', id: `producer:${id}`, detail: `producer:${id}`, sub: ['Producer of the island', 'Промысел острова'], level: PRODUCER_MAX, chip: [`${LV[0]} 1–${PRODUCER_MAX}`, `${LV[1]} 1–${PRODUCER_MAX}`], tags: ['bk:producer', `max:${PRODUCER_MAX}`] });
  for (const id of Object.keys(BUILDINGS)) out.push({ kind: 'building', id: `building:${id}`, detail: `building:${id}`, sub: ['Holding', 'Владение'], level: 1, chip: same(''), tags: ['bk:holding', 'max:1'], nums: { cost: (BUILDINGS as Record<string, { cost: number }>)[id].cost } });
  return out;
}

const roomBand = (v: number) => (v <= 0.5 ? 'light' : v <= 1.5 ? 'mid' : 'bulk');
const priceBand = (p: number) => (p < 40 ? 'cheap' : p < 200 ? 'mid' : 'dear');
function goods(): Raw[] {
  const out: Raw[] = GOOD_IDS.map((id) => {
    const g = GOODS[id];
    return { kind: 'good', id: `good:${id}`, detail: `good:${id}`, level: g.basePrice, chip: same(g.basePrice), tags: [`cat:${g.category}`, `use:${isSupply(id) ? 'store' : 'trade'}`, `room:${roomBand(g.volume)}`, `price:${priceBand(g.basePrice)}`], nums: { volume: g.volume, price: g.basePrice } };
  });
  for (const [id, d] of Object.entries(LAND_RES_DEF)) out.push({ kind: 'good', id: `lres:${id}`, detail: `lres:${id}`, level: d.value, chip: same(d.value), tags: ['cat:land', 'use:land', 'room:light', `price:${priceBand(d.value)}`], nums: { volume: 0, price: d.value } });
  return out;
}

// ------------------------------------------------------------------------------------------------ the index

const cache: Partial<Record<RefLang, RefIndex>> = {};
let raws: { r: Raw; card: DCard }[] | null = null;

/** Every entry with its card (the cards are built once for both tongues). */
function allRaw(): { r: Raw; card: DCard }[] {
  if (raws) return raws;
  raws = [...creatures(), ...ships(), ...items(), ...buildings(), ...goods()].map((r) => {
    const card = detailCard(r.detail);
    if (!card) throw new Error(`reference: no card for ${r.detail}`);
    return { r, card };
  });
  return raws;
}

/** The facets' value names that are not fixed above: factions, ranks, levels, sets. */
function facetValues(f: (typeof FACETS)[number], present: Set<string>): [string, Tr][] {
  if (f.values.length) return f.values;
  const vals = [...present].map((t) => t.slice(f.id.length + 1));
  const num = (a: string, b: string) => Number(a) - Number(b);
  switch (f.id) {
    case 'fac': return vals.sort().map((v) => [v, rosterName(v)]);
    case 'rank': return vals.sort(num).map((v) => [v, same(v)]);
    case 'anchor': return vals.sort(num).map((v) => [v, same(`⚓${v}`)]);
    case 'lvl': return vals.sort(num).map((v) => [v, [`${LV[0]} ${v}`, `${LV[1]} ${v}`]]);
    case 'max': return vals.sort(num).map((v) => [v, same(v)]);
    case 'set': return vals.sort().map((v) => [v, (SETS as Record<string, { name: Tr }>)[v]?.name ?? (ART_SETS as Record<string, { name: Tr }>)[v]?.name ?? same(v)]);
  }
  return vals.map((v) => [v, same(v)]);
}

/** The reference in a tongue: every creature, ship, item template, building and good, each with its card's key, its
 *  facet values and its search words; the facets with their values and counts; the kinds with their counts. */
export function referenceIndex(lang: RefLang): RefIndex {
  const hit = cache[lang];
  if (hit) return hit;
  const i = lang === 'ru' ? 1 : 0;
  const all = allRaw();
  const facetName = new Map<string, Tr>();
  const facets: RefFacet[] = [];
  for (const f of FACETS) {
    const present = new Set(all.filter((x) => x.r.kind === f.kind).flatMap((x) => x.r.tags.filter((t) => t.startsWith(`${f.id}:`))));
    const values = facetValues(f, present).filter(([v]) => present.has(`${f.id}:${v}`));
    for (const [v, n] of values) facetName.set(`${f.id}:${v}`, n);
    facets.push({
      id: f.id, kind: f.kind, name: f.name[i],
      values: values.map(([v, n]) => ({ v, name: n[i], n: all.filter((x) => x.r.kind === f.kind && x.r.tags.includes(`${f.id}:${v}`)).length })),
    });
  }
  const entries: RefEntry[] = all.map(({ r, card }) => {
    const name = r.name ?? card.name;
    const words = [name[0], name[1], card.sub?.[0], card.sub?.[1], r.sub?.[0], r.sub?.[1], r.id.replace(/^[a-z]+:/, '').replace(/_/g, ' '), KIND_WORDS[r.kind], r.words, ...r.tags.map((t) => facetName.get(t)?.join(' '))];
    return {
      kind: r.kind, id: r.id, detail: r.detail, name: name[i], sub: (r.sub ?? card.sub)?.[i] ?? '', level: r.level, chip: r.chip[i],
      ...(card.art ? { art: card.art, fig: card.fig } : {}), ...(card.color ? { color: card.color } : {}),
      tags: r.tags, search: [...new Set(words.filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е').split(/[\s·,()]+/).filter(Boolean))].join(' '), ...(r.site ? { site: r.site } : {}), ...(r.nums ? { nums: r.nums } : {}),
    };
  });
  const out: RefIndex = { entries, facets, kinds: REF_KINDS.map((k) => ({ kind: k, name: KIND_NAMES[k][i], n: entries.filter((e) => e.kind === k).length })) };
  cache[lang] = out;
  return out;
}

export interface RefQuery {
  kind?: RefKind | '';
  /** Free text: every word must be found in the entry's search words. */
  q?: string;
  /** Chosen facet values, '<facet>:<value>'. */
  sel?: Iterable<string>;
  sort?: 'level' | 'name' | string;
}

/** The entries a kind, a search and the chosen facet values leave, sorted (by level, then name; or by a `nums` key,
 *  the greatest first). */
export function filterReference(entries: readonly RefEntry[], o: RefQuery = {}): RefEntry[] {
  const words = (o.q ?? '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  const byFacet = new Map<string, Set<string>>();
  for (const t of o.sel ?? []) {
    const f = t.slice(0, t.indexOf(':'));
    if (!byFacet.has(f)) byFacet.set(f, new Set());
    byFacet.get(f)!.add(t);
  }
  const xs = entries.filter((e) => {
    if (o.kind && e.kind !== o.kind) return false;
    for (const [f, vs] of byFacet) if (FACET_KIND.get(f) === e.kind && !e.tags.some((t) => vs.has(t))) return false;
    return words.every((w) => e.search.includes(w));
  });
  const k = o.sort ?? 'level';
  return xs.sort((a, b) => (k === 'name' ? 0 : k === 'level' ? a.level - b.level : (b.nums?.[k] ?? 0) - (a.nums?.[k] ?? 0)) || a.name.localeCompare(b.name));
}

/** Every detail key the reference opens (the tests resolve each). */
export function referenceKeys(): string[] {
  return allRaw().map((x) => x.r.detail);
}
