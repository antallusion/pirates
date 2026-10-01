// Islands and the shore, batch E of docs/16 (2026-09-30): a landing party that walks the island (paths to choose,
// something on each), lighthouses that guide at night, lookouts on the headlands, and banks the tide or the season
// raises out of the sea. The words are here in both languages; the server rolls every chance and sends ids and
// numbers.

import type { GoodId } from './goods.ts';

export type Tr = [string, string];

// ------------------------------------------------------------------ 21. the walk across an island

/** The ways a party can go from where it stands. */
export type TrekPath = 'ruins' | 'stream' | 'hill' | 'shore' | 'thicket' | 'cave' | 'smoke' | 'rocks';
export const TREK_PATHS: TrekPath[] = ['ruins', 'stream', 'hill', 'shore', 'thicket', 'cave', 'smoke', 'rocks'];
export const TREK_PATH_NAMES: Record<TrekPath, Tr> = {
  ruins: ['Toward the ruins', 'К руинам'],
  stream: ['Along the stream', 'Вдоль ручья'],
  hill: ['Up the hill', 'На холм'],
  shore: ['Along the shore', 'Берегом'],
  thicket: ['Through the thicket', 'Через заросли'],
  cave: ['To the cave mouth', 'К гроту'],
  smoke: ['Toward the smoke', 'На дым'],
  rocks: ['Over the rocks', 'По скалам'],
};
/** A picture for each path on its button (existing icons). */
export const TREK_PATH_ICON: Record<TrekPath, string> = {
  ruins: 'tattoo_skull', stream: 'good_whale_oil', hill: 'talent_exp_crows_nest', shore: 'map_wreck', thicket: 'tree_survival', cave: 'good_pearls', smoke: 'fire', rocks: 'talent_exp_pathfinder',
};

/** What an outcome pays or costs. `silver` is a base the server scales by the ship's level (like the island games). */
export interface TrekPay {
  silver?: [number, number];
  goods?: [GoodId, number, number];
  xp?: number;
  /** Hands lost, hands who join. */
  crew?: number;
  hands?: number;
  morale?: number;
  curse?: number;
  /** Silver paid out (a base, scaled by level): a price. */
  cost?: number;
  /** Islands charted within this many metres (the view from a hilltop). */
  chart?: number;
  /** The chance of a treasure map (tier 1). */
  map?: number;
  /** A risk taken and survived: the chest at the far side is richer. */
  nerve?: boolean;
}

export interface TrekOutcome {
  /** {silver}, {n}, {good}, {crew}, {hands}, {charted}, {cost} filled from the server's numbers. */
  text: Tr;
  good: boolean;
  pay: TrekPay;
}

export interface TrekChoice {
  id: string;
  label: Tr;
  /** A fixed outcome, or a roll of the server's dice between two. */
  to?: string;
  chance?: number;
  win?: string;
  lose?: string;
}

export type TrekEventKind = 'find' | 'risk' | 'choice' | 'game' | 'view';

export interface TrekEvent {
  id: string;
  kind: TrekEventKind;
  paths: TrekPath[];
  weight: number;
  text: Tr;
  /** A risk: the chance it goes well, and the two outcomes ('ok' and 'hurt'). */
  chance?: number;
  choices?: TrekChoice[];
  outcomes: Record<string, TrekOutcome>;
}

const E = (e: TrekEvent): TrekEvent => e;

export const TREK_EVENTS: Record<string, TrekEvent> = {
  spring: E({
    id: 'spring', kind: 'find', paths: ['stream', 'thicket'], weight: 8,
    text: ['A spring bubbles cold between mossy stones.', 'Между мшистых камней бьёт холодный родник.'],
    outcomes: { found: { text: ['The men drink their fill and fill the casks: {n} of provisions.', 'Люди напиваются вволю и наполняют бочонки: провизии {n}.'], good: true, pay: { goods: ['provisions', 4, 8], morale: 3, xp: 15 } } },
  }),
  timber: E({
    id: 'timber', kind: 'find', paths: ['thicket', 'stream'], weight: 6,
    text: ['A stand of tall, straight trees, the kind a carpenter dreams of.', 'Роща высоких прямых деревьев — о таких мечтает плотник.'],
    outcomes: { found: { text: ['The axes ring for an hour: {n} of timber down to the boats.', 'Час звенят топоры: к шлюпкам спускают строевого леса {n}.'], good: true, pay: { goods: ['timber', 3, 7], xp: 15 } } },
  }),
  coins: E({
    id: 'coins', kind: 'find', paths: ['ruins'], weight: 8,
    text: ['Under a fallen lintel lies a rotten purse.', 'Под упавшей притолокой лежит истлевший кошель.'],
    outcomes: { found: { text: ['Old coin spills out of it: {silver}.', 'Из него сыплются старые монеты: {silver}.'], good: true, pay: { silver: [40, 110], xp: 25 } } },
  }),
  carvings: E({
    id: 'carvings', kind: 'choice', paths: ['ruins', 'cave'], weight: 7,
    text: ['Carvings on a wall: a ship, a skull, and a cross cut deeper than the rest. A warning, or a boast of treasure?', 'Резьба на стене: корабль, череп и крест, вырезанный глубже остального. Предупреждение — или похвальба кладом?'],
    choices: [
      { id: 'dig', label: ['Dig under the cross', 'Копать под крестом'], chance: 0.55, win: 'dug', lose: 'fell' },
      { id: 'copy', label: ['Copy it and go on', 'Срисовать и идти дальше'], to: 'copied' },
    ],
    outcomes: {
      dug: { text: ['A clay jar, sealed with wax: {silver}.', 'Глиняный кувшин, запечатанный воском: {silver}.'], good: true, pay: { silver: [90, 180], xp: 35, nerve: true } },
      fell: { text: ['The wall comes down on the diggers. {crew} lost under the stones.', 'Стена обрушивается на копающих. Под камнями погибших: {crew}.'], good: false, pay: { crew: 1, morale: -4, xp: 15 } },
      copied: { text: ['The navigator copies the carvings into the log. Someone in port will want to read them.', 'Штурман перерисовывает резьбу в журнал. В порту кто-нибудь захочет её прочесть.'], good: true, pay: { xp: 40, map: 0.25 } },
    },
  }),
  snake: E({
    id: 'snake', kind: 'risk', paths: ['thicket', 'shore', 'rocks'], weight: 6, chance: 0.6,
    text: ['Something moves in the grass at the bosun\'s feet.', 'Что-то шевелится в траве у ног боцмана.'],
    outcomes: {
      ok: { text: ['A snake — and the bosun\'s cutlass is quicker. The men laugh all the way up the path.', 'Змея — но тесак боцмана быстрее. Люди смеются всю дорогу вверх по тропе.'], good: true, pay: { xp: 15, morale: 2, nerve: true } },
      hurt: { text: ['A snake bites a topman. They carry him back to the boats; he will not walk again today. {crew} out of the party.', 'Змея кусает марсового. Его уносят к шлюпкам; сегодня он уже не встанет. Из отряда выбыл: {crew}.'], good: false, pay: { crew: 1, morale: -3, xp: 10 } },
    },
  }),
  boar: E({
    id: 'boar', kind: 'choice', paths: ['thicket', 'hill'], weight: 6,
    text: ['A wild boar crashes out of the brush and stands its ground, tusks low.', 'Из кустов вырывается дикий кабан и встаёт, опустив клыки.'],
    choices: [
      { id: 'hunt', label: ['Hunt it', 'Охотиться'], chance: 0.6, win: 'roast', lose: 'gored' },
      { id: 'leave', label: ['Back away', 'Отступить'], to: 'left' },
    ],
    outcomes: {
      roast: { text: ['Fresh meat tonight: {n} of provisions, and a feast the crew will remember.', 'Сегодня будет свежее мясо: провизии {n} — и пир, который команда запомнит.'], good: true, pay: { goods: ['provisions', 6, 12], morale: 5, xp: 25, nerve: true } },
      gored: { text: ['The boar takes a man before it goes down in the brush. {crew} gored.', 'Прежде чем уйти в заросли, кабан поднимает на клыки человека. Ранен насмерть: {crew}.'], good: false, pay: { crew: 1, morale: -3, xp: 15 } },
      left: { text: ['The boar snorts and goes. The party takes the long way round.', 'Кабан фыркает и уходит. Отряд обходит стороной.'], good: true, pay: { xp: 10 } },
    },
  }),
  castaway: E({
    id: 'castaway', kind: 'choice', paths: ['shore', 'smoke'], weight: 5,
    text: ['A castaway, all beard and bone, waves from a lean-to of driftwood. He has good boots.', 'Отшельник — одна борода да кости — машет из шалаша из плавника. Сапоги у него хорошие.'],
    choices: [
      { id: 'take', label: ['Take him aboard', 'Взять на борт'], to: 'aboard' },
      { id: 'boots', label: ['Take his boots', 'Забрать сапоги'], to: 'boots' },
    ],
    outcomes: {
      aboard: { text: ['He weeps into the bosun\'s coat and signs on for nothing. {hands} new hand.', 'Он плачет боцману в плечо и нанимается даром. Новых матросов: {hands}.'], good: true, pay: { hands: 1, morale: 3, xp: 25 } },
      boots: { text: ['The boots fetch {silver} in any port. The crew do not look at you for a while.', 'Сапоги потянут на {silver} в любом порту. Команда какое-то время не смотрит вам в глаза.'], good: false, pay: { silver: [20, 50], morale: -4, xp: 10 } },
    },
  }),
  grave: E({
    id: 'grave', kind: 'choice', paths: ['hill', 'rocks', 'ruins'], weight: 5,
    text: ['A lone grave under a cairn, a cutlass rusted into the stones for a cross.', 'Одинокая могила под грудой камней; вместо креста в камни вбит ржавый тесак.'],
    choices: [
      { id: 'dig', label: ['Open it', 'Разрыть'], chance: 0.5, win: 'robbed', lose: 'cursed' },
      { id: 'coin', label: ['Leave a coin', 'Оставить монету'], to: 'honoured' },
    ],
    outcomes: {
      robbed: { text: ['A captain\'s purse in the bones\' hands: {silver}. The wind turns cold.', 'В руках скелета — капитанский кошель: {silver}. Ветер холодеет.'], good: true, pay: { silver: [120, 240], curse: 6, xp: 30, nerve: true } },
      cursed: { text: ['Only bones, and a smell that follows the party back to the ship.', 'Одни кости — и запах, который тянется за отрядом до самого корабля.'], good: false, pay: { curse: 10, morale: -5, xp: 15 } },
      honoured: { text: ['A coin on the stones. The men walk lighter for it.', 'Монета на камнях. Люди идут дальше легче.'], good: true, pay: { morale: 4, xp: 20 } },
    },
  }),
  eggs: E({
    id: 'eggs', kind: 'find', paths: ['rocks', 'shore'], weight: 6,
    text: ['Sea-birds scream off a ledge white with their nests.', 'С уступа, белого от гнёзд, с криком срываются морские птицы.'],
    outcomes: { found: { text: ['Eggs by the hundred: {n} of provisions.', 'Яиц — сотни: провизии {n}.'], good: true, pay: { goods: ['provisions', 3, 7], xp: 10 } } },
  }),
  view: E({
    id: 'view', kind: 'view', paths: ['hill', 'rocks'], weight: 6,
    text: ['From the top the whole island lies below, and the sea beyond it.', 'С вершины виден весь остров — и море за ним.'],
    outcomes: { seen: { text: ['The navigator takes bearings on every rock in sight: {charted} islands charted.', 'Штурман берёт пеленги на каждый видимый камень: нанесено на карту островов — {charted}.'], good: true, pay: { chart: 3000, xp: 30 } } },
  }),
  flotsam: E({
    id: 'flotsam', kind: 'find', paths: ['shore'], weight: 6,
    text: ['A ship\'s boat lies stove in on the sand, her gear still in her.', 'На песке лежит разбитая шлюпка, снасти ещё в ней.'],
    outcomes: { found: { text: ['{n} of planks and good cordage carried back.', 'Унесено досок {n} и добрые снасти.'], good: true, pay: { goods: ['planks', 2, 5], xp: 15 } } },
  }),
  quicksand: E({
    id: 'quicksand', kind: 'risk', paths: ['stream', 'shore'], weight: 5, chance: 0.65,
    text: ['The sand by the water is smooth, and very soft.', 'Песок у воды гладкий — и очень мягкий.'],
    outcomes: {
      ok: { text: ['It gives under a man; the others haul him out with a rope and a curse.', 'Он проваливается под человеком; остальные вытаскивают его верёвкой и бранью.'], good: true, pay: { xp: 15, nerve: true } },
      hurt: { text: ['It takes a man to the waist, then to the chest, and his mates cannot reach him. {crew} lost.', 'Он затягивает человека по пояс, потом по грудь, и товарищи не могут дотянуться. Погиб: {crew}.'], good: false, pay: { crew: 1, morale: -5, xp: 10 } },
    },
  }),
  camp: E({
    id: 'camp', kind: 'choice', paths: ['smoke'], weight: 7,
    text: ['A smugglers\' fire, still warm: three men, a pot of stew and a stack of casks.', 'Костёр контрабандистов, ещё тёплый: трое, котёл похлёбки и штабель бочонков.'],
    choices: [
      { id: 'trade', label: ['Buy a few casks', 'Купить пару бочонков'], to: 'bought' },
      { id: 'rush', label: ['Rush them', 'Напасть'], chance: 0.55, win: 'taken', lose: 'beaten' },
    ],
    outcomes: {
      bought: { text: ['{cost} changes hands for {n} of rum, and a tale of where the Crown\'s cutter lies tonight.', 'За {cost} к вам переходит рома {n} — и рассказ, где этой ночью стоит таможенный катер.'], good: true, pay: { cost: 60, goods: ['rum', 3, 6], xp: 20 } },
      taken: { text: ['They run for the trees and leave it all: {silver} and {n} of weapons.', 'Они бегут в лес и бросают всё: {silver} и оружия {n}.'], good: true, pay: { silver: [80, 200], goods: ['weapons', 2, 4], xp: 35, nerve: true } },
      beaten: { text: ['They were more than three. {crew} lost in the scrub before the party gets away.', 'Их было больше трёх. Пока отряд отходил, в кустах погибло: {crew}.'], good: false, pay: { crew: 2, morale: -4, xp: 20 } },
    },
  }),
  pearls: E({
    id: 'pearls', kind: 'risk', paths: ['cave'], weight: 6, chance: 0.7,
    text: ['Oyster beds in the cave\'s pool, and the tide beginning to turn.', 'Устричная банка в заводи грота — а прилив уже начинает прибывать.'],
    outcomes: {
      ok: { text: ['The divers come up with {n} pearls before the water rises.', 'Ныряльщики успевают поднять жемчуга: {n}, прежде чем вода поднялась.'], good: true, pay: { goods: ['pearls', 1, 3], xp: 25, nerve: true } },
      hurt: { text: ['The tide fills the cave faster than a man can swim. {crew} does not come out.', 'Прилив заполняет грот быстрее, чем плывёт человек. Не выплыл: {crew}.'], good: false, pay: { crew: 1, morale: -4, xp: 10 } },
    },
  }),
  haunt: E({
    id: 'haunt', kind: 'game', paths: ['cave', 'ruins', 'smoke', 'hill'], weight: 4,
    text: ['Someone — or something — is waiting further on.', 'Дальше кто-то — или что-то — ждёт.'],
    outcomes: { met: { text: ['The party meets what waits on the island.', 'Отряд встречает то, что ждёт на острове.'], good: true, pay: {} } },
  }),
};
export const TREK_EVENT_IDS = Object.keys(TREK_EVENTS);

/** The far side: every walk ends at something worth the walk, richer for each risk taken and survived. */
export const TREK_END: TrekOutcome = { text: ['At the far side, under a cairn of stones, a smugglers\' cache: {silver}.', 'На дальнем краю, под грудой камней, — тайник контрабандистов: {silver}.'], good: true, pay: { silver: [70, 140], xp: 40 } };
/** How much more the far side pays for each risk survived, and the chances of a piece of gear and a map there. */
export const TREK_NERVE_SILVER = 45;
export const TREK_END_ITEM = 0.15;
export const TREK_END_ITEM_PER_NERVE = 0.06;
export const TREK_END_MAP = 0.12;
/** The walk's words the card shows: its title, the step, the buttons. */
export const TREK_WORDS = {
  title: ['Across {island}', 'Через остров {island}'] as Tr,
};

// ------------------------------------------------------------------ 23. lighthouses at night

/** A lit lighthouse shows the shoals within this many metres at night; its keeper lights it this long for her pay. */
export const LIGHT_R = 3500;
export const LIGHT_PAID_SEC = 30 * 60;
/** The keeper's price: a base and so much a level of the square's ships. */
export const KEEPER_BASE = 40;
export const KEEPER_PER_LEVEL = 15;
/** The keeper hears a boat within this many metres of the island's shore. */
export const KEEPER_RANGE = 1500;

// ------------------------------------------------------------------ 24. lookouts on the headlands

/** From a lookout the sea is charted this far. */
export const LOOKOUT_R = 5000;
/** A lookout is climbed again by the same captain two hours later. */
export const LOOKOUT_REST = 2 * 3600;

// ------------------------------------------------------------------ 25. banks the tide raises

/** Two tides a day (48 real minutes): each ebb bares a bank for a third of its tide. */
export const TIDE_SEC = 24 * 60;
export const TIDE_LOW = -0.5;
export const TIDAL_NAMES: Tr[] = [
  ['Low-Water Bank', 'Отмель Малой воды'], ['The Drowned Knoll', 'Утопленный холм'], ['Ebb Rock', 'Отливная скала'], ['Gull Sand', 'Чаячья коса'],
  ['The Bare Bones', 'Голые кости'], ['Widow\'s Shelf', 'Вдовья полка'], ['The Sometime Isle', 'Остров-иногда'], ['Neap Bar', 'Квадратурный бар'],
  ['Salt Tooth', 'Соляной зуб'], ['The Shifting Key', 'Блуждающий риф'], ['Crab Tables', 'Крабьи столы'], ['Moon Sand', 'Лунный песок'],
  ['The Ghost Bar', 'Призрачный бар'], ['Kelp Crown', 'Венец из ламинарий'], ['Pilgrim Shoal', 'Отмель паломников'], ['The Low Door', 'Низкая дверь'],
  ['Ashbar', 'Пепельный бар'], ['Winter Spit', 'Зимняя коса'], ['Thaw Holm', 'Оттаявший холм'], ['The Tide\'s Purse', 'Кошель прилива'],
  // docs/18 #31: the sandbars of the low tide.
  ['Shell Bar', 'Ракушечный бар'], ['The Long Spit', 'Долгая коса'], ['Ebbsand', 'Отливной песок'], ['Plover Bank', 'Ржанкина банка'],
  ['The Low Cay', 'Низкий кей'], ['Sandpiper Bar', 'Куличья отмель'], ['Wrack Spit', 'Коса водорослей'], ['Mermaid Sand', 'Русалочий песок'],
  ['The Brief Isle', 'Остров-миг'], ['Cockle Bank', 'Сердцевидная банка'], ['Tern Bar', 'Крачкин бар'], ['The Turning Sand', 'Песок на повороте'],
];
/** A seasonal isle stands above the sea through one of the year's four seasons (worldgen.seasonName). */
export const SEASON_NAMES: Tr[] = [['Thaw', 'Оттепель'], ['High Tide', 'Большая вода'], ['Ashfall', 'Пеплопад'], ['Deep Winter', 'Глухая зима']];
/** What a bared bank gives a landing party (rare, once each time it rises). */
export const TIDAL_SILVER: [number, number] = [160, 320];
export const TIDAL_GOODS: GoodId[] = ['ambergris', 'pearls', 'drowned_silk', 'scrimshaw', 'narwhal_tusk'];
export const TIDAL_ITEM = 0.35;
export const TIDAL_MAP = 0.2;
