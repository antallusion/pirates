// Cosmetics other captains see (owner, 2026-10-19: «звания которые видят над кораблём другие игроки (на плашках),
// рамки аватаров», flags, ship trails, emotes; sails stay as painted). docs/32 §12 has the table in Russian.
//
// Six kinds of thing, each with an id, a name in both languages and a price on the shop's ladder (or none: free for
// everyone, or earned by a deed — `earn`):
//  - a title: words shown on a plate floating over her ship (TITLES), and the plate itself (PLATES, by tier);
//  - an avatar frame round her portrait (HUD, chat, the player's card, the leaderboards);
//  - a flag at her masthead: an emblem (bought) on a cloth colour (free or cheap), drawn by code;
//  - a ship's trail, drawn by code (a pooled particle wake, no art);
//  - emotes, sent from the chat and the quick button: two free, two earned, the rest in packs of four.
// Bundles (the starter, Halloween's and Winter's, the seasonal ones dated) hold several of these at a bundle's price.
//
// The shop sells every priced thing through its own path (shop.ts families on the «Косметика» tab, one offer each,
// once ever: server/src/game/shop.ts, its ledger row and purchase id); ownership and what she wears are her account's
// (server/src/game/cosmetics.ts, kv `cos:<account>`). Other captains learn what she wears from her ship's name card
// (ShipInfo.cos, `encodeCos` below: six small indices), her chat lines and her card (the frame's id).

import type { ShopFamily, ShopSec } from './shop.ts';

type Tr = [string, string];
const T = (en: string, ru: string): Tr => [en, ru];

export type CosKind = 'title' | 'plate' | 'frame' | 'emblem' | 'cloth' | 'trail' | 'emote';
export const COS_KINDS: CosKind[] = ['title', 'plate', 'frame', 'emblem', 'cloth', 'trail', 'emote'];

/** What earns a thing (checked by the server against her own stats; nothing to buy). */
export type CosEarn =
  | { k: 'level'; n: number }
  | { k: 'campaign' }
  | { k: 'boarded'; n: number }
  | { k: 'arena'; rating: number };

export interface CosItem {
  id: string;
  kind: CosKind;
  name: Tr;
  /** In doubloons; 0: free for every captain; absent: earned (`earn`) or a bundle's own (`only`). */
  price?: number;
  earn?: CosEarn;
  /** Had only from this bundle. */
  only?: string;
  /** 0 common … 4 legendary (the card's colour; the plates' order). */
  tier: number;
}

export interface PlateDef extends CosItem {
  /** The text's colour and its shadow, and the calm middle the text keeps to (shares of the plate's width). */
  ink: string;
  halo: string;
  span: [number, number];
}

export interface FrameDef extends CosItem {
  /** The hole's radius as a share of the frame picture's side (measured by tools/art/cosmetics_pack.py). */
  hole: number;
}

export interface ClothDef extends CosItem {
  /** The cloth and its emblem's tint. */
  rgb: string;
  ink: string;
}

export interface TrailDef extends CosItem {
  /** The renderer's particle look: colours (inner, outer), size, how long a mote lives, how it rises, additive glow. */
  c: [string, string];
  size: number;
  life: number;
  rise: number;
  glow: boolean;
}

export interface EmoteDef extends CosItem {
  /** The pack it is sold in (absent: free or earned). */
  pack?: string;
}

const item = <X extends CosItem>(x: X): X => x;

// ------------------------------------------------------------------------------------------------ titles

/** The words (owner: «Гроза Солтмарроу», «Морской дьявол», «Хозяин прилива», «Тень Грейвсенда» …): the places are
 *  the sea's own ports and waters. */
export const TITLES: CosItem[] = [
  item({ id: 'seawolf', kind: 'title', tier: 0, price: 0, name: T('Sea Wolf', 'Морской волк') }),
  item({ id: 'skipper', kind: 'title', tier: 0, price: 0, name: T('Free Skipper', 'Вольный шкипер') }),
  item({ id: 'saltmarrow', kind: 'title', tier: 1, price: 290, name: T('Terror of Saltmarrow', 'Гроза Солтмарроу') }),
  item({ id: 'blackwater', kind: 'title', tier: 1, price: 290, name: T('Fox of Blackwater', 'Лис Блэкуотера') }),
  item({ id: 'hollowmere', kind: 'title', tier: 1, price: 290, name: T('Prince of Hollowmere', 'Князь Холлоумира') }),
  item({ id: 'storm', kind: 'title', tier: 1, price: 290, name: T('Storm Petrel', 'Буревестник') }),
  item({ id: 'reef', kind: 'title', tier: 1, price: 290, name: T('Reef Runner', 'Знаток рифов') }),
  item({ id: 'rum', kind: 'title', tier: 1, price: 290, name: T('Keeper of the Rum', 'Хранитель рома') }),
  item({ id: 'gulls', kind: 'title', tier: 1, price: 290, name: T('Friend of Gulls', 'Друг чаек') }),
  item({ id: 'fogmouth', kind: 'title', tier: 1, price: 290, name: T('Voice of Fogmouth', 'Голос Фогмута') }),
  item({ id: 'gravesend', kind: 'title', tier: 2, price: 590, name: T('Shadow of Gravesend', 'Тень Грейвсенда') }),
  item({ id: 'cinderhold', kind: 'title', tier: 2, price: 590, name: T('Flame of Cinderhold', 'Пламя Синдерхолда') }),
  item({ id: 'leviathan', kind: 'title', tier: 2, price: 590, name: T('Bane of Leviathans', 'Гроза левиафанов') }),
  item({ id: 'wrecks', kind: 'title', tier: 2, price: 590, name: T('Lord of Wrecktide', 'Владыка Рэктайда') }),
  item({ id: 'elusive', kind: 'title', tier: 2, price: 590, name: T('The Elusive', 'Неуловимый') }),
  item({ id: 'devil', kind: 'title', tier: 3, price: 990, name: T('Sea Devil', 'Морской дьявол') }),
  item({ id: 'kraken', kind: 'title', tier: 3, price: 990, name: T('Kraken Tamer', 'Укротитель кракена') }),
  item({ id: 'crown', kind: 'title', tier: 3, price: 990, name: T('Heir of the Crown', 'Наследник короны') }),
  item({ id: 'abyss', kind: 'title', tier: 3, price: 990, name: T('Gaze of the Abyss', 'Взор Бездны') }),
  item({ id: 'tide', kind: 'title', tier: 3, earn: { k: 'campaign' }, name: T('Master of the Tide', 'Хозяин прилива') }),
  item({ id: 'boarder', kind: 'title', tier: 3, earn: { k: 'boarded', n: 100 }, name: T('Terror of the Boarding', 'Гроза абордажа') }),
  item({ id: 'arena', kind: 'title', tier: 3, earn: { k: 'arena', rating: 1200 }, name: T('Lion of the Colosseum', 'Лев Колизея') }),
  item({ id: 'admiral', kind: 'title', tier: 4, earn: { k: 'level', n: 60 }, name: T('Admiral of the Seas', 'Адмирал морей') }),
  item({ id: 'phantom', kind: 'title', tier: 3, only: 'cos_halloween', name: T('Phantom Captain', 'Призрачный капитан') }),
  item({ id: 'frost', kind: 'title', tier: 3, only: 'cos_winter', name: T('Frost Corsair', 'Ледяной корсар') }),
  // the PvP season's top three (shared/src/data/pvprank.ts): worn through the month after it, then taken back
  item({ id: 'pvp1', kind: 'title', tier: 4, only: 'pvp_season', name: T('Terror of the Seas', 'Гроза морей') }),
  item({ id: 'pvp2', kind: 'title', tier: 4, only: 'pvp_season', name: T('Sea Hawk', 'Морской ястреб') }),
  item({ id: 'pvp3', kind: 'title', tier: 3, only: 'pvp_season', name: T('The Boarder', 'Абордажник') }),
  // The season pass's own (owner, 2026-10-30; shared/src/data/seasonpass.ts): had from its tiers alone, `only: 'spass'`.
  item({ id: 'stormborn', kind: 'title', tier: 1, only: 'spass', name: T('Stormborn', 'Дитя бури') }),
  item({ id: 'stormwolf', kind: 'title', tier: 2, only: 'spass', name: T('Storm Wolf', 'Штормовой волк') }),
  item({ id: 'stormlord', kind: 'title', tier: 3, only: 'spass', name: T('Lord of the Storm', 'Повелитель бури') }),
  item({ id: 'frostborn', kind: 'title', tier: 1, only: 'spass', name: T('Frostborn', 'Дитя стужи') }),
  item({ id: 'icewolf', kind: 'title', tier: 2, only: 'spass', name: T('Ice Wolf', 'Ледяной волк') }),
  item({ id: 'icelord', kind: 'title', tier: 3, only: 'spass', name: T('Admiral of the Ice', 'Ледяной адмирал') }),
];

// ------------------------------------------------------------------------------------------------ plates

const plate = (id: string, tier: number, name: Tr, ink: string, halo: string, span: [number, number], x: Partial<PlateDef>): PlateDef =>
  ({ id, kind: 'plate', tier, name, ink, halo, span, ...x });

export const PLATES: PlateDef[] = [
  plate('driftwood', 0, T('Driftwood', 'Плавник'), '#f3e6c8', 'rgba(20,12,4,0.95)', [0.24, 0.76], { price: 0 }),
  plate('bronze', 1, T('Bronze', 'Бронза'), '#fbe9c0', 'rgba(24,16,6,0.95)', [0.2, 0.8], { price: 290 }),
  plate('silver', 2, T('Silver', 'Серебро'), '#1d2328', 'rgba(240,246,250,0.75)', [0.17, 0.83], { price: 590 }),
  plate('coral', 2, T('Coral', 'Коралл'), '#fff1e2', 'rgba(50,6,6,0.95)', [0.24, 0.76], { price: 590 }),
  plate('gold', 3, T('Gold', 'Золото'), '#2c1a04', 'rgba(255,236,170,0.7)', [0.19, 0.81], { price: 990 }),
  plate('ghost', 3, T('Ghostly', 'Призрачная'), '#eafffb', 'rgba(4,40,40,0.95)', [0.2, 0.8], { price: 990 }),
  plate('corsair', 3, T('Crimson Corsair', 'Алый корсар'), '#ffe7c4', 'rgba(40,4,4,0.95)', [0.23, 0.77], { earn: { k: 'boarded', n: 100 } }),
  plate('abyss', 4, T('Abyssal Legend', 'Легенда Бездны'), '#c8fff6', 'rgba(0,10,14,0.95)', [0.24, 0.76], { price: 4990 }),
];

// ------------------------------------------------------------------------------------------------ frames

const frame = (id: string, tier: number, name: Tr, hole: number, x: Partial<FrameDef>): FrameDef => ({ id, kind: 'frame', tier, name, hole, ...x });

export const FRAMES: FrameDef[] = [
  frame('rope', 0, T('Rope', 'Канат'), 0.254, { price: 0 }),
  frame('copper', 1, T('Copper Porthole', 'Медный иллюминатор'), 0.336, { earn: { k: 'level', n: 20 } }),
  frame('wheel', 1, T('Ship’s Wheel', 'Штурвал'), 0.231, { price: 290 }),
  frame('coral', 2, T('Coral and Pearls', 'Кораллы и жемчуг'), 0.232, { price: 590 }),
  frame('gold', 3, T('Gold Laurels', 'Золотые лавры'), 0.242, { price: 990 }),
  frame('ghost', 3, T('Ghost Ship', 'Корабль-призрак'), 0.165, { price: 990 }),
  frame('kraken', 3, T('Kraken', 'Кракен'), 0.204, { earn: { k: 'arena', rating: 1200 } }),
  frame('admiral', 3, T('Admiral', 'Адмиральская'), 0.202, { earn: { k: 'campaign' } }),
  // the Super Pass's own (owner, 2026-10-30: «одну рамку можешь так же вывести из продажи и давать только за покупку»):
  // off the shop since — a captain who bought her keeps her (shared/src/data/seasonpass.ts SUPER_FRAME)
  frame('abyss', 4, T('Abyssal', 'Бездна'), 0.169, { only: 'spass_super' }),
];

// ------------------------------------------------------------------------------------------------ flags

/** The emblems (white on the sheet, tinted by code). The shark's jaws were not kept: painted as a whole jawbone, they
 *  read as a bone (the owner's rule). */
export const EMBLEMS: CosItem[] = [
  item({ id: 'anchor', kind: 'emblem', tier: 0, price: 0, name: T('Anchor', 'Якорь') }),
  item({ id: 'hook', kind: 'emblem', tier: 1, price: 290, name: T('Hook', 'Крюк') }),
  item({ id: 'cannon', kind: 'emblem', tier: 1, price: 290, name: T('Cannon', 'Пушка') }),
  item({ id: 'compass', kind: 'emblem', tier: 1, price: 290, name: T('Compass Rose', 'Роза ветров') }),
  item({ id: 'bell', kind: 'emblem', tier: 1, price: 290, name: T('Ship’s Bell', 'Рында') }),
  item({ id: 'trident', kind: 'emblem', tier: 1, price: 290, name: T('Trident', 'Трезубец') }),
  item({ id: 'raven', kind: 'emblem', tier: 2, price: 590, name: T('Raven', 'Ворон') }),
  item({ id: 'pistols', kind: 'emblem', tier: 2, price: 590, name: T('Crossed Pistols', 'Скрещённые пистоли') }),
  item({ id: 'dagger', kind: 'emblem', tier: 2, price: 590, name: T('Roped Dagger', 'Кинжал в канате') }),
  item({ id: 'moon', kind: 'emblem', tier: 2, price: 590, name: T('Moon and Stars', 'Луна и звёзды') }),
  item({ id: 'heart', kind: 'emblem', tier: 2, price: 590, name: T('Burning Heart', 'Пылающее сердце') }),
  item({ id: 'hourglass', kind: 'emblem', tier: 2, price: 590, name: T('Winged Hourglass', 'Крылатые часы') }),
  item({ id: 'kraken', kind: 'emblem', tier: 3, price: 990, name: T('Kraken', 'Кракен') }),
  item({ id: 'crown', kind: 'emblem', tier: 3, price: 990, name: T('Crown', 'Корона') }),
  item({ id: 'serpent', kind: 'emblem', tier: 3, price: 990, name: T('Sea Serpent', 'Морской змей') }),
];

const cloth = (id: string, name: Tr, rgb: string, ink: string, price: number): ClothDef => ({ id, kind: 'cloth', tier: price ? 1 : 0, name, rgb, ink, price });

/** The cloth's colours (Pirate Gothic: deep, never bright). Four free, the rest cheap. */
export const CLOTHS: ClothDef[] = [
  cloth('black', T('Black', 'Чёрный'), '#17171a', '#ece3cf', 0),
  cloth('crimson', T('Crimson', 'Багровый'), '#6e1717', '#f1e2c4', 0),
  cloth('navy', T('Navy', 'Морской синий'), '#1a2c4e', '#efe6d0', 0),
  cloth('ivory', T('Sailcloth', 'Парусина'), '#d9cfb4', '#2a2118', 0),
  cloth('ochre', T('Ochre', 'Охра'), '#9a6f1e', '#1e1408', 290),
  cloth('forest', T('Forest', 'Хвойный'), '#1f3d2a', '#e6dcc2', 290),
  cloth('plum', T('Plum', 'Сливовый'), '#4a2342', '#efdcc8', 290),
  cloth('teal', T('Deep Teal', 'Бирюза глубин'), '#164a4c', '#e3f2ea', 290),
  cloth('ember', T('Ember', 'Тлеющий уголь'), '#8a3b12', '#f6e2c0', 290),
  cloth('slate', T('Slate', 'Сланец'), '#3d454f', '#eef0ee', 290),
  // the PvP season's banner (pvprank.ts): the top three's for good
  { id: 'pvp', kind: 'cloth', tier: 3, name: T('Season Banner', 'Знамя сезона'), rgb: '#3e0d1a', ink: '#e9c46a', only: 'pvp_season' },
  // the season pass's own (its free tracks): `only: 'spass'`
  { id: 'thunder', kind: 'cloth', tier: 1, name: T('Thundercloud', 'Грозовая туча'), rgb: '#2b2f4a', ink: '#d9e6ff', only: 'spass' },
  { id: 'glacier', kind: 'cloth', tier: 1, name: T('Glacier', 'Ледник'), rgb: '#3f6475', ink: '#f0fbff', only: 'spass' },
];

// ------------------------------------------------------------------------------------------------ trails

const trail = (id: string, tier: number, name: Tr, price: number, look: Omit<TrailDef, keyof CosItem>): TrailDef => ({ id, kind: 'trail', tier, name, price, ...look });

/** Drawn by the renderer (client/src/render/trails.ts): no art. */
export const TRAILS: TrailDef[] = [
  trail('plankton', 2, T('Glowing Plankton', 'Светящийся планктон'), 590, { c: ['#b9fff4', '#1fb7c9'], size: 2.2, life: 2.6, rise: 0, glow: true }),
  trail('ink', 2, T('Kraken Ink', 'Чернила кракена'), 590, { c: ['#2a1d3a', '#07060c'], size: 5.5, life: 3.2, rise: 0, glow: false }),
  trail('frost', 2, T('Frost', 'Иней'), 590, { c: ['#ffffff', '#9fd2ff'], size: 2.6, life: 2.4, rise: 0.2, glow: true }),
  trail('mist', 3, T('Ghost Mist', 'Призрачный туман'), 990, { c: ['#d9fff4', '#4fd6b3'], size: 6, life: 2.8, rise: 0.6, glow: true }),
  trail('fire', 3, T('Fire', 'Пламя'), 990, { c: ['#ffe28a', '#ff5a1a'], size: 3.4, life: 1.4, rise: 1.4, glow: true }),
  trail('gold', 3, T('Golden Sparks', 'Золотые искры'), 990, { c: ['#fff6c8', '#e0a526'], size: 2, life: 1.8, rise: 0.8, glow: true }),
  // the season pass's own (its premium tracks' 60th tier): `only: 'spass'`
  { id: 'storm', kind: 'trail', tier: 3, name: T('Storm Wake', 'Грозовой след'), only: 'spass', c: ['#e8f4ff', '#5a7dff'], size: 2.4, life: 1.6, rise: 0.3, glow: true },
  { id: 'aurora', kind: 'trail', tier: 3, name: T('Aurora', 'Северное сияние'), only: 'spass', c: ['#c8ffe6', '#7a4dff'], size: 4.2, life: 2.6, rise: 0.9, glow: true },
];

// ------------------------------------------------------------------------------------------------ emotes

/** The emote packs (four each, the shop's offers `cos_pack_<id>`). */
export const EMOTE_PACKS: { id: string; name: Tr; price: number; tier: number }[] = [
  { id: 'harbour', name: T('Harbour Cheer', 'Портовые радости'), price: 290, tier: 1 },
  { id: 'powder', name: T('Powder Smoke', 'Пороховой дым'), price: 590, tier: 2 },
  { id: 'yarns', name: T('Sea Yarns', 'Морские байки'), price: 590, tier: 2 },
];

const emote = (id: string, name: Tr, x: Partial<EmoteDef>): EmoteDef => ({ id, kind: 'emote', tier: 1, name, ...x });

export const COS_EMOTES: EmoteDef[] = [
  emote('parrot', T('Laughing Parrot', 'Хохочущий попугай'), { price: 0, tier: 0 }),
  emote('hook', T('Hook Up!', 'Крюк вверх!'), { price: 0, tier: 0 }),
  emote('rum', T('Rum Raised', 'За ром!'), { pack: 'harbour' }),
  emote('chest', T('Treasure!', 'Сокровище!'), { pack: 'harbour' }),
  emote('coin', T('Thanks!', 'Спасибо!'), { pack: 'harbour' }),
  emote('gull', T('Thief Gull', 'Чайка-воришка'), { pack: 'harbour' }),
  emote('cannon', T('Fire!', 'Огонь!'), { pack: 'powder', tier: 2 }),
  emote('keg', T('Powder Keg', 'Пороховая бочка'), { pack: 'powder', tier: 2 }),
  emote('sinking', T('I Give Up', 'Сдаюсь'), { pack: 'powder', tier: 2 }),
  emote('kraken', T('Angry Kraken', 'Злой кракен'), { pack: 'powder', tier: 2 }),
  emote('spyglass', T('I See You', 'Вижу тебя'), { pack: 'yarns', tier: 2 }),
  emote('ghost', T('Ghostly Wave', 'Привет от призрака'), { pack: 'yarns', tier: 2 }),
  emote('dizzy', T('Lost My Bearings', 'Сбился с курса'), { pack: 'yarns', tier: 2 }),
  emote('heartbreak', T('Heartbreak', 'Разбитое сердце'), { pack: 'yarns', tier: 2 }),
  emote('salute', T('Salute', 'Честь имею'), { tier: 2, earn: { k: 'level', n: 30 } }),
  emote('trophy', T('Champion', 'Чемпион'), { tier: 3, earn: { k: 'arena', rating: 1200 } }),
];

/** An emote over her ship lasts so long; she may send one every EMOTE_GAP seconds, EMOTE_BURST in EMOTE_WINDOW. */
export const EMOTE_SHOW_S = 3;
export const EMOTE_GAP = 2.5;
export const EMOTE_BURST = 4;
export const EMOTE_WINDOW = 30;

// ------------------------------------------------------------------------------------------------ bundles

export interface CosBundle {
  id: string;
  name: Tr;
  text: Tr;
  icon: string;
  price: number;
  /** Ownership keys (`kind:id`; `pack:<id>` for an emote pack). */
  keys: string[];
  /** On the shelf only between these (wall ms, UTC): the card counts down to `until`. */
  from?: number;
  until?: number;
  /** Once per account. */
  once?: boolean;
}

export const BUNDLES: CosBundle[] = [
  {
    id: 'cos_starter', icon: 'cos_bundle', price: 1990, once: true,
    name: T('Captain’s Finery', 'Наряд капитана'),
    text: T('A silver plate with «Storm Petrel», the ship’s-wheel frame, the raven on plum, the plankton trail and the harbour emotes.', 'Серебряная плашка со званием «Буревестник», рамка-штурвал, ворон на сливовом флаге, светящийся планктон и портовые эмоции.'),
    keys: ['plate:silver', 'title:storm', 'frame:wheel', 'emblem:raven', 'cloth:plum', 'trail:plankton', 'pack:harbour'],
  },
  {
    id: 'cos_halloween', icon: 'cos_halloween', price: 1990,
    from: Date.UTC(2026, 9, 17), until: Date.UTC(2026, 10, 3),
    name: T('All Hallows’ Tide', 'Ночь всех теней'),
    text: T('Halloween only: the title «Phantom Captain», the ghostly plate and frame, ghost mist in your wake, the moon on ember and the sea yarns.', 'Только на Хэллоуин: звание «Призрачный капитан», призрачные плашка и рамка, призрачный туман за кормой, луна на флаге цвета углей и морские байки.'),
    keys: ['title:phantom', 'plate:ghost', 'frame:ghost', 'trail:mist', 'emblem:moon', 'cloth:ember', 'pack:yarns'],
  },
  {
    id: 'cos_winter', icon: 'cos_winter', price: 1990,
    from: Date.UTC(2026, 11, 15), until: Date.UTC(2027, 0, 15),
    name: T('Ice and Bells', 'Лёд и колокола'),
    text: T('Winter only: the title «Frost Corsair», the gold plate and laurels, frost in your wake and the ship’s bell on slate.', 'Только зимой: звание «Ледяной корсар», золотые плашка и лавры, иней за кормой и рында на сланцевом флаге.'),
    keys: ['title:frost', 'plate:gold', 'frame:gold', 'trail:frost', 'emblem:bell', 'cloth:slate'],
  },
];

// ------------------------------------------------------------------------------------------------ lookups

export const COS_TABLES: Record<CosKind, readonly CosItem[]> = {
  title: TITLES, plate: PLATES, frame: FRAMES, emblem: EMBLEMS, cloth: CLOTHS, trail: TRAILS, emote: COS_EMOTES,
};

const BY_KEY = new Map<string, CosItem>(COS_KINDS.flatMap((k) => COS_TABLES[k].map((x) => [`${k}:${x.id}`, x] as const)));

/** The thing of an ownership key (`kind:id`), or undefined. */
export function cosItem(key: string): CosItem | undefined {
  return BY_KEY.get(key);
}

export const cosKey = (x: CosItem): string => `${x.kind}:${x.id}`;

export const plateOf = (id: string | null | undefined): PlateDef | undefined => (id ? PLATES.find((x) => x.id === id) : undefined);
export const frameOf = (id: string | null | undefined): FrameDef | undefined => (id ? FRAMES.find((x) => x.id === id) : undefined);
export const titleOf = (id: string | null | undefined): CosItem | undefined => (id ? TITLES.find((x) => x.id === id) : undefined);
export const emblemOf = (id: string | null | undefined): CosItem | undefined => (id ? EMBLEMS.find((x) => x.id === id) : undefined);
export const clothOf = (id: string | null | undefined): ClothDef | undefined => (id ? CLOTHS.find((x) => x.id === id) : undefined);
export const trailOf = (id: string | null | undefined): TrailDef | undefined => (id ? TRAILS.find((x) => x.id === id) : undefined);
export const cosEmoteOf = (id: string | null | undefined): EmoteDef | undefined => (id ? COS_EMOTES.find((x) => x.id === id) : undefined);

/** The keys a pack or bundle key stands for (`pack:harbour` → its four emotes). */
export function expandKeys(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (k.startsWith('pack:')) out.push(...COS_EMOTES.filter((e) => e.pack === k.slice(5)).map(cosKey));
    else out.push(k);
  }
  return out;
}

/** Everything every captain has from the start. */
export const FREE_KEYS: string[] = COS_KINDS.flatMap((k) => COS_TABLES[k].filter((x) => x.price === 0).map(cosKey));

/** The asset of a thing (the manifest's id), or null for what is drawn by code (a trail, a cloth, a title's words). */
export function cosArt(x: CosItem): string | null {
  switch (x.kind) {
    case 'plate': return `cos.plate_${x.id}`;
    case 'frame': return `cos.frame_${x.id}`;
    case 'emblem': return `cos.emblem_${x.id}`;
    case 'emote': return `cos.emote_${x.id}`;
    default: return null;
  }
}


// ------------------------------------------------------------------------------------------------ what she wears

export interface CosEquip {
  title: string | null;
  plate: string | null;
  frame: string | null;
  emblem: string | null;
  cloth: string | null;
  trail: string | null;
}

export const NO_EQUIP: CosEquip = { title: null, plate: null, frame: null, emblem: null, cloth: null, trail: null };
export const EQUIP_SLOTS: (keyof CosEquip)[] = ['title', 'plate', 'frame', 'emblem', 'cloth', 'trail'];
const SLOT_TABLE: Record<keyof CosEquip, readonly CosItem[]> = { title: TITLES, plate: PLATES, frame: FRAMES, emblem: EMBLEMS, cloth: CLOTHS, trail: TRAILS };

/** The wire's form (ShipInfo.cos): six indices in base 36, '-' for none, dotted — at most 17 characters. */
export function encodeCos(e: CosEquip): string {
  return EQUIP_SLOTS.map((s) => {
    const i = e[s] ? SLOT_TABLE[s].findIndex((x) => x.id === e[s]) : -1;
    return i < 0 ? '-' : i.toString(36);
  }).join('.');
}

/** Its reading back: null for anything malformed (too long, a part not a known index). */
export function decodeCos(raw: unknown): CosEquip | null {
  if (typeof raw !== 'string' || raw.length > 24) return null;
  const parts = raw.split('.');
  if (parts.length !== EQUIP_SLOTS.length) return null;
  const out: CosEquip = { ...NO_EQUIP };
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (p === '-') continue;
    if (!/^[0-9a-z]{1,2}$/.test(p)) return null;
    const x = SLOT_TABLE[EQUIP_SLOTS[k]][parseInt(p, 36)];
    if (!x) return null;
    out[EQUIP_SLOTS[k]] = x.id;
  }
  return out;
}

/** Whether a captain wears anything worth sending. */
export const wearsAny = (e: CosEquip): boolean => EQUIP_SLOTS.some((s) => e[s] !== null);

// ------------------------------------------------------------------------------------------------ the shop's prices

/** The price of a thing on its own (null: not sold alone). Emotes go by their pack. */
export function cosPrice(x: CosItem): number | null {
  return x.price && x.price > 0 && x.kind !== 'emote' ? x.price : null;
}

/** What a bundle's things would cost one by one (its «Выгода»). */
export function bundleWorth(b: CosBundle): number {
  let w = 0;
  for (const k of b.keys) {
    if (k.startsWith('pack:')) w += EMOTE_PACKS.find((p) => p.id === k.slice(5))?.price ?? 0;
    else {
      const x = cosItem(k);
      w += x ? cosPrice(x) ?? (x.only ? 990 : 0) : 0;
    }
  }
  return w;
}

// ------------------------------------------------------------------------------------------------ the shop's shelves

const SEC_OF: Record<Exclude<CosKind, 'emote'>, ShopSec> = { title: 'cos_titles', plate: 'cos_titles', frame: 'cos_frames', emblem: 'cos_flags', cloth: 'cos_flags', trail: 'cos_trails' };
const ICON_OF: Record<ShopSec, string> = { cos_titles: 'cos_titles', cos_frames: 'cos_frames', cos_flags: 'cos_flags', cos_trails: 'cos_trails', cos_emotes: 'cos_emotes', cos_sets: 'cos_bundle' } as Record<ShopSec, string>;
const KIND_TEXT: Record<Exclude<CosKind, 'emote'>, Tr> = {
  title: T('Words on your plate over your ship: every captain at sea reads them.', 'Слова на плашке над вашим кораблём: их читает каждый капитан в море.'),
  plate: T('The plate your title floats on over your ship.', 'Плашка, на которой звание парит над вашим кораблём.'),
  frame: T('Round your portrait: on the screen, in the chat, on your card and on the tables.', 'Вокруг вашего портрета: на экране, в чате, в карточке и в таблицах.'),
  emblem: T('The emblem of your flag at the masthead, on the cloth colour you choose.', 'Знак вашего флага на мачте — на ткани того цвета, что выберете.'),
  cloth: T('The cloth of your flag at the masthead.', 'Ткань вашего флага на мачте.'),
  trail: T('Follows your ship at sea for everyone to see.', 'Тянется за вашим кораблём в море — на виду у всех.'),
};

/** The shop's families of the «Косметика» tab: one offer each, once per account (shop.ts appends them to SHOP). */
export function cosFamilies(): ShopFamily[] {
  const out: ShopFamily[] = [];
  for (const k of ['title', 'plate', 'frame', 'emblem', 'cloth', 'trail'] as const) {
    for (const x of COS_TABLES[k]) {
      const price = cosPrice(x);
      if (!price) continue;
      const sec = SEC_OF[k];
      out.push({ id: `cos_${k}_${x.id}`, tabs: ['cos'], sec, icon: ICON_OF[sec], name: x.name, text: KIND_TEXT[k], offers: [{ id: `cos_${k}_${x.id}`, price, grants: [{ k: 'cos', keys: [cosKey(x)] }], limit: { n: 1, per: 'ever' } }] });
    }
  }
  for (const p of EMOTE_PACKS) {
    const names = COS_EMOTES.filter((e) => e.pack === p.id);
    out.push({
      id: `cos_pack_${p.id}`, tabs: ['cos'], sec: 'cos_emotes', icon: 'cos_emotes', name: p.name,
      text: T(`Four emotes for the chat and over your ship: ${names.map((e) => e.name[0]).join(', ')}.`, `Четыре эмоции для чата и над кораблём: ${names.map((e) => e.name[1]).join(', ')}.`),
      offers: [{ id: `cos_pack_${p.id}`, price: p.price, grants: [{ k: 'cos', keys: [`pack:${p.id}`] }], limit: { n: 1, per: 'ever' } }],
    });
  }
  for (const b of BUNDLES) {
    out.push({
      id: b.id, tabs: ['cos'], sec: 'cos_sets', icon: b.icon, name: b.name, text: b.text,
      offers: [{ id: b.id, price: b.price, grants: [{ k: 'cos', keys: b.keys }], limit: { n: 1, per: 'ever' }, ...(b.from !== undefined ? { from: b.from, until: b.until } : {}) }],
    });
  }
  return out;
}

/** Russian forms of the server's lines about cosmetics (client/src/lang/server.ts), and the things' names (the
 *  table's lowest: a name another table knows keeps that table's word). */
export function cosPatterns(): [string, string][] {
  return [
    ...COS_KINDS.flatMap((k) => COS_TABLES[k].map((x) => [x.name[0], x.name[1]] as [string, string])),
    ['Earned: {0}!', 'Получено: {0}!'],
    ['Not so fast: one emote at a time.', 'Не так быстро: по одной эмоции.'],
    ['Not so fast: one change at a time.', 'Не так быстро: по одной вещи.'],
    ['You do not own this yet.', 'Это у вас пока не куплено и не заслужено.'],
    ['Cosmetics: {0} yours; worn: {1}.', 'Косметика: ваших вещей — {0}; надето: {1}.'],
    ['Every cosmetic is yours.', 'Вся косметика теперь ваша.'],
    ['Your cosmetics are forgotten.', 'Ваша косметика сброшена.'],
    ['Usage: /cos [all|wear slot id|reset]', 'Как писать: /cos [all|wear слот id|reset]'],
  ];
}
