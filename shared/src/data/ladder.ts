// «Лестница открытий» (VK moderation, 2026-11-05: rule 4.2.4 — «на старте в интерфейсе важно оставить минимальное число
// функций и механик для первого опыта в режиме обучения. Остальное важно последовательно вводить через постепенное
// обучение, прогрессию, кривую сложности»; owner: «нужно начало игры полностью переделать и скрыть часть интерфейса,
// покупки можно предлагать постепенно тоже а не сразу пачкой»).
//
// A captain made since then (Tutorial.ladder) meets the game a rung at a time: the First Watch (sail, «Атаковать»,
// «Огонь», «На абордаж», «В порт») with nothing but the wheel and the guns, then the port's four plain places (the
// market, the shipyard, the tavern, the quests) and the campaign's «Портовые лавки»; each further thing comes at its
// level, with a pill «Открыто: <что>» and the Pilot's Book's article. Captains made before keep everything as it was.
//
// The rungs follow the campaign (tools/onb-gates.ts prints its gates): it asks a chart bought at level 4 and a prize
// court at 8, and founds the island at level 1 — so the island is never laddered (the campaign brings it in). The first
// hour is about levels 1–6 (docs/26), so the rungs spread over the first few hours.
//
// The shop the same: nothing for doubloons before SHOP_LEVEL, then one offer at a time, the rest by level (promoRung).

export type Feature =
  | 'ammo' | 'harbour' | 'daily'
  | 'abilities' | 'talents' | 'chat'
  | 'berths' | 'rumours' | 'charts' | 'ferry'
  | 'shop'
  | 'army' | 'pets'
  | 'colours' | 'season'
  | 'holdings' | 'exchange'
  | 'auction' | 'dice' | 'tattoos' | 'guilds'
  | 'glory';

export interface Rung {
  id: Feature;
  /** The captain's level it opens at. */
  level: number;
  /** [en, ru]: the pill's «Открыто: <name>». */
  name: [string, string];
  /** [en, ru]: one line what it is for. */
  line: [string, string];
  /** The Pilot's Book's article «Читать» opens. */
  article?: string;
  /** What it hides on the screen while shut (the client's style: `body.lock-<id> <selector> { display: none }`). */
  hide: string[];
}

export const LADDER: Rung[] = [
  {
    id: 'ammo', level: 2,
    name: ['Shot types', 'Виды снарядов'],
    line: ['Chain shot tears sails, grapeshot clears the deck before a boarding.', 'Книппели рвут паруса, картечь косит команду перед абордажем.'],
    article: 'combat-ammo',
    hide: ['#tc-ammo', '.dk-shot:not([data-shot="round"])'],
  },
  {
    id: 'harbour', level: 2,
    name: ['The harbour', 'Гавань'],
    line: ['The port\'s news, its regatta and its passages.', 'Новости порта, регата и переходы.'],
    article: 'sea-ports',
    hide: ['[data-ptab="harbour"]'],
  },
  {
    id: 'daily', level: 2,
    name: ['The daily gift', 'Ежедневный подарок'],
    line: ['Come aboard every day: a gift waits each morning.', 'Заходите каждый день: каждое утро вас ждёт подарок.'],
    article: 'prog-gift',
    hide: ['#tc-daily'],
  },
  {
    id: 'abilities', level: 3,
    name: ['Captain\'s tricks', 'Приёмы капитана'],
    line: ['Double charge, hard over and more: buttons beside «Fire».', 'Двойной заряд, руль на борт и другие — кнопки рядом с «Огнём».'],
    article: 'prog-skills',
    hide: ['#tc-special', '#tc-abil', '#tc-skill', '.dk-abil'],
  },
  {
    id: 'talents', level: 3,
    name: ['Talents', 'Таланты'],
    line: ['Each level gives a point: spend it in the captain\'s window.', 'Каждый уровень даёт очко — вложите его в окне капитана.'],
    article: 'prog-talents',
    hide: ['[data-menu="talents"]', '[data-tile="talents"]', '.cs-pts'],
  },
  {
    id: 'chat', level: 3,
    name: ['Chat', 'Чат'],
    line: ['Talk to the other captains, the port and your guild.', 'Говорите с другими капитанами, портом и гильдией.'],
    hide: ['#hud-chat', '#chat-toggle', '[data-menu="chat"]', '[data-tile="chat"]', '#cos-qbtn'],
  },
  {
    id: 'berths', level: 4,
    name: ['Berths', 'Причал'],
    line: ['Keep several ships and change into the one you need.', 'Держите несколько кораблей и пересаживайтесь на нужный.'],
    article: 'army-berths',
    hide: ['[data-ptab="berths"]'],
  },
  {
    id: 'rumours', level: 4,
    name: ['Rumours', 'Слухи'],
    line: ['The tavern\'s talk: treasures, wrecks and rich prizes.', 'Разговоры в таверне: клады, обломки и богатая добыча.'],
    hide: ['[data-ptab="rumours"]'],
  },
  {
    id: 'charts', level: 4,
    name: ['Charts', 'Карты'],
    line: ['Buy a chart of the sea: its ports and shipyards on your map.', 'Купите карту моря: её порты и верфи появятся у вас на карте.'],
    article: 'exp-chart',
    hide: ['[data-ptab="charts"]'],
  },
  {
    id: 'ferry', level: 4,
    name: ['Passage', 'Переход'],
    line: ['From a hub port to another at ten times the speed, for silver.', 'Из порта-узла в другой узел в десять раз быстрее, за серебро.'],
    article: 'travel-ferry',
    hide: ['[data-ptab="ferry"]', '.fy-card', '.pcd-ferry'],
  },
  {
    id: 'shop', level: 5,
    name: ['The shop', 'Лавка'],
    line: ['Doubloons: speed-ups, scrolls and packs. One offer at a time.', 'Дублоны: ускорения, свитки и наборы. По одному предложению за раз.'],
    article: 'prog-shop',
    hide: ['[data-hudshop]', '[data-hudexch]', '.cs-dbl', '.hud-exch', '[data-menu="shop"]', '[data-tile="shop"]', '#tc-offer'],
  },
  {
    id: 'army', level: 6,
    name: ['The port\'s army', 'Армия порта'],
    line: ['The port\'s dwellings: higher tiers of men for your decks.', 'Жилища порта: бойцы старших рангов для вашей палубы.'],
    article: 'army-tiers',
    hide: ['[data-ptab="army"]'],
  },
  {
    id: 'pets', level: 6,
    name: ['Pets', 'Питомцы'],
    line: ['A ship\'s cat, a parrot or stranger: each helps in its way.', 'Корабельный кот, попугай и кто похитрее — каждый помогает по-своему.'],
    hide: ['[data-ptab="pets"]'],
  },
  {
    id: 'colours', level: 8,
    name: ['Flags and patents', 'Флаги и патенты'],
    line: ['Choose your colours: the Crown, the League, the Harpoon or the black flag.', 'Выберите флаг: Корона, Лига, Гарпун или чёрный флаг.'],
    article: 'flags-three',
    hide: ['[data-ptab="colours"]'],
  },
  {
    id: 'season', level: 8,
    name: ['The season pass', 'Сезонный пропуск'],
    line: ['Rewards for every step of the season.', 'Награды за каждую ступень сезона.'],
    article: 'prog-pass',
    hide: ['#tc-pass', '[data-menu="pass"]', '[data-tile="pass"]'],
  },
  {
    id: 'holdings', level: 10,
    name: ['Holdings', 'Владения'],
    line: ['Warehouses, shares and licences in the ports.', 'Склады, доли и лицензии в портах.'],
    article: 'trade-warehouse',
    hide: ['[data-ptab="holdings"]'],
  },
  {
    id: 'exchange', level: 10,
    name: ['The exchange', 'Биржа'],
    line: ['Orders to buy and sell goods between captains.', 'Заявки на покупку и продажу товаров между капитанами.'],
    article: 'trade-exchange',
    hide: ['[data-ptab="exchange"]'],
  },
  {
    id: 'auction', level: 12,
    name: ['The auction', 'Аукцион'],
    line: ['Rare gear and trophies from other captains.', 'Редкое снаряжение и трофеи от других капитанов.'],
    hide: ['[data-ptab="auction"]', '.au-card', '#k-kind option[value="auction"]'],
  },
  {
    id: 'dice', level: 12,
    name: ['Dice', 'Кости'],
    line: ['A game in the tavern for silver.', 'Игра в таверне на серебро.'],
    hide: ['[data-ptab="dice"]', '.dice-card'],
  },
  {
    id: 'tattoos', level: 12,
    name: ['Tattoos', 'Татуировки'],
    line: ['Marks of your deeds that give small bonuses.', 'Знаки ваших подвигов с небольшими бонусами.'],
    hide: ['[data-ptab="tattoo"]', '[data-jchip="tattoos"]'],
  },
  {
    id: 'guilds', level: 12,
    name: ['Guilds', 'Гильдии'],
    line: ['Join other captains: a guild chat, wars and a shared treasury.', 'Объединяйтесь с капитанами: чат гильдии, войны и общая казна.'],
    hide: ['[data-jtab="guild"]'],
  },
  {
    id: 'glory', level: 60,
    name: ['Glory', 'Слава'],
    line: ['From level 60 all experience goes into glory.', 'С 60-го уровня весь опыт идёт в славу.'],
    article: 'prog-rating',
    hide: ['.cs-glory'],
  },
];

export const RUNG: Record<Feature, Rung> = Object.fromEntries(LADDER.map((r) => [r.id, r])) as Record<Feature, Rung>;

/** The rungs still shut at a level. */
export function ladderLocked(level: number): Feature[] {
  return LADDER.filter((r) => level < r.level).map((r) => r.id);
}

/** Whether a feature is open to a captain (an old captain, off the ladder: always). */
export function featureOpen(f: Feature, level: number, ladder: boolean): boolean {
  return !ladder || level >= RUNG[f].level;
}

// ------------------------------------------------------------------------------------------------ the shop's pace

/** No doubloons asked before this level (the shop's rung). */
export const SHOP_LEVEL = RUNG.shop.level;

export type PromoKind = 'personal' | 'first' | 'starter' | 'level' | 'weekly' | 'sub' | 'global';

/** What the offers may show at a level, on the ladder: how many cards at once, which kinds, which contexts of the
 *  personal offers, and whether the entry carousel comes at all. Off the ladder (null): everything as before. */
export interface PromoRung {
  cards: number;
  kinds: PromoKind[];
  ctxs: ('sea' | 'board' | 'isle')[];
  carousel: boolean;
}

export function promoRung(level: number): PromoRung {
  if (level < SHOP_LEVEL) return { cards: 0, kinds: [], ctxs: [], carousel: false };
  if (level < 8) return { cards: 1, kinds: ['starter', 'first'], ctxs: [], carousel: false };
  if (level < 12) return { cards: 1, kinds: ['starter', 'first', 'level', 'personal'], ctxs: ['sea'], carousel: false };
  if (level < 16) return { cards: 2, kinds: ['starter', 'first', 'level', 'personal', 'weekly'], ctxs: ['sea', 'board'], carousel: true };
  return { cards: 99, kinds: ['personal', 'first', 'starter', 'level', 'weekly', 'sub', 'global'], ctxs: ['sea', 'board', 'isle'], carousel: true };
}
