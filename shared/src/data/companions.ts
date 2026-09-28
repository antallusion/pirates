// The orca companion (docs/12 P10 #2): a White Orca's calf — orphaned when its mother is taken, or entrusted by
// Ingrid at the end of her chain — swims in its captain's wake. It finds shoals and whales, strikes an enemy's
// rudder in a fight, grows to level ten, and wears a harness made at a forge.

type Tr = [string, string];

export type HarnessId = 'leather' | 'iron' | 'bell';
/** The ship's pets on deck (docs/12 P10 #3). */
export type PetId = 'cat' | 'parrot' | 'monkey' | 'dog';
export const HARNESS_IDS: HarnessId[] = ['leather', 'iron', 'bell'];

export interface HarnessDef {
  name: Tr;
  gives: Tr;
  cost: Partial<Record<string, number>>;
  silver: number;
}

export const HARNESSES: Record<HarnessId, HarnessDef> = {
  leather: { name: ['Sharkskin Harness', 'Сбруя из акульей кожи'], gives: ['Dives for shoals and whales twice as often', 'Ищет косяки и китов вдвое чаще'], cost: { shark_skin: 4, whalebone: 2 }, silver: 400 },
  iron: { name: ['Iron-Shod Harness', 'Окованная сбруя'], gives: ['Strikes rudders sooner and harder', 'Бьёт по рулю чаще и сильнее'], cost: { iron: 10, whalebone: 4 }, silver: 900 },
  bell: { name: ['Bell Harness', 'Сбруя с колокольцем'], gives: ['Hears whales and shoals twice as far', 'Слышит китов и косяки вдвое дальше'], cost: { whalebone: 3, pearls: 2 }, silver: 700 },
};

export const CALF_MAX_LEVEL = 10;
/** Experience to the next level: a calf grows at sea with its captain, faster in a fight. */
export function calfXpNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.5));
}
/** How far it finds shoals and whales (m), and how often (s). */
export function calfFindRange(level: number, harness: HarnessId | null): number {
  return (2500 + 250 * level) * (harness === 'bell' ? 2 : 1);
}
export function calfFindEvery(harness: HarnessId | null): number {
  return harness === 'leather' ? 45 : 90;
}
/** Its strike at an enemy's rudder: every so many seconds, the rudder's share it takes, the hull's share. */
export function calfStrike(level: number, harness: HarnessId | null): { every: number; rudder: number; hull: number } {
  const iron = harness === 'iron';
  return { every: Math.max(8, 26 - level - (iron ? 6 : 0)), rudder: (0.12 + 0.015 * level) * (iron ? 1.5 : 1), hull: (0.004 + 0.001 * level) * (iron ? 1.3 : 1) };
}
/** The calf's length on the water (m). */
export function calfLength(level: number): number {
  return 4 + level * 0.5;
}

export const CALF_NAME: Tr = ['Snowdrop', 'Белянка'];

const COMPASS: Tr[] = [['north', 'севере'], ['north-east', 'северо-востоке'], ['east', 'востоке'], ['south-east', 'юго-востоке'], ['south', 'юге'], ['south-west', 'юго-западе'], ['west', 'западе'], ['north-west', 'северо-западе']];
/** The compass point from one place to another (y grows southwards). */
export function compassPoint(dx: number, dy: number): Tr {
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return COMPASS[Math.round(a / (Math.PI / 4)) % 8];
}

export function companionPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const h of Object.values(HARNESSES)) out.push(h.name, h.gives);
  // Each compass point in its own sentence (a bare 'north-east' already means something else to the table).
  for (const [en, ru] of COMPASS) out.push([`{0} dives and comes up to the ${en}: a shoal.`, `{0} ныряет и выныривает на ${ru}: там косяк.`], [`{0} dives and comes up to the ${en}: whales.`, `{0} ныряет и выныривает на ${ru}: там киты.`]);
  out.push(
    CALF_NAME,
    ['An orphaned White Orca calf follows your wake. Name it in the ship window.', 'За кормой плывёт осиротевший детёныш Белой касатки. Дайте ему имя в окне корабля.'],
    ['Ingrid entrusts you with a White Orca calf. Name it in the ship window.', 'Ингрид доверяет вам детёныша Белой касатки. Дайте ему имя в окне корабля.'],
    ['{0} strikes the rudder of {1}!', '{0} бьёт по рулю: «{1}»!'],
    ['{0} grows: level {1}.', '{0} подрастает: уровень {1}.'],
    ['{0} wears the {1}.', '{0} — новая сбруя: {1}.'],
    ['The forge makes the {0}.', 'Кузня делает: {0}.'],
    ['A harness is made at a forge: a shipyard of the second rank or your island’s.', 'Сбрую делают в кузне: на верфи второго ранга или на вашем острове.'],
    ['You have no companion.', 'У вас нет спутника.'],
    ['That harness is not made yet.', 'Эта сбруя ещё не сделана.'],
    ['Not enough for the harness: {0}.', 'На сбрую не хватает: {0}.'],
    ['A name of one to twenty letters.', 'Имя — от одной до двадцати букв.'],
  );
  return out;
}

// ------------------------------------------------------------------------------------------------ ship's pets (#3)

export const PET_IDS: PetId[] = ['cat', 'parrot', 'monkey', 'dog'];

export interface PetDef {
  name: Tr;
  gives: Tr;
  /** A pet seller's price in a tavern. */
  price: number;
}

export const PETS: Record<PetId, PetDef> = {
  cat: { name: ['Ship’s Cat', 'Корабельный кот'], gives: ['Catches rats: stores spoil half as fast, and no rats come aboard', 'Ловит крыс: товары портятся вдвое медленнее, крысы не заводятся'], price: 400 },
  parrot: { name: ['Parrot', 'Попугай'], gives: ['Screams when a hostile sail turns towards you, and curses your enemies', 'Кричит, когда к вам поворачивает враждебный парус, и бранит врагов'], price: 1200 },
  monkey: { name: ['Monkey', 'Обезьянка'], gives: ['Comes back from the quay with other people’s small change', 'Приносит с причала чужую мелочь'], price: 900 },
  dog: { name: ['Sea Dog', 'Морской пёс'], gives: ['Sniffs out buried things when a party goes ashore', 'Чует зарытое, когда десант сходит на берег'], price: 800 },
};

/** The pets a port's pet seller has today (two of four, by the port and the day). */
export function petsForSale(portId: string, day: number): PetId[] {
  let h = day * 7919;
  for (const ch of portId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % 4, b = (a + 1 + ((h >>> 8) % 3)) % 4;
  return [PET_IDS[a], PET_IDS[b]];
}

const PARROT_CURSES: Tr[] = [
  ['“Bilge rats! Bilge rats!”', '«Трюмные крысы! Трюмные крысы!»'],
  ['“Pieces of eight! Pieces of eight!”', '«Пиастры! Пиастры!»'],
  ['“Cowards! Cowards!”', '«Трусы! Трусы!»'],
  ['“Feed ’em to the fish!”', '«На корм рыбам!»'],
];
export function parrotCurse(i: number): Tr {
  return PARROT_CURSES[i % PARROT_CURSES.length];
}

export function petPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const p of Object.values(PETS)) out.push(p.name, p.gives);
  for (const [en, ru] of [['north', 'севере'], ['north-east', 'северо-востоке'], ['east', 'востоке'], ['south-east', 'юго-востоке'], ['south', 'юге'], ['south-west', 'юго-западе'], ['west', 'западе'], ['north-west', 'северо-западе']]) {
    out.push([`The parrot screams: “Sail to the ${en}! Sail to the ${en}!”`, `Попугай вопит: «Парус на ${ru}! Парус на ${ru}!»`]);
  }
  for (const c of PARROT_CURSES) out.push([`The parrot screeches at the enemy: ${c[0]}`, `Попугай орёт на врага: ${c[1]}`]);
  out.push(
    ['A new pet aboard: {0}.', 'Новый питомец на борту: {0}.'],
    ['{0} is on deck now.', 'Теперь на палубе: {0}.'],
    ['Your monkey comes back from the quay with a stolen purse: {0} silver.', 'Обезьянка возвращается с причала с чужим кошельком: {0} серебра.'],
    ['Your monkey is caught at it: the harbour watch fines you {0} silver.', 'Обезьянку поймали за руку: портовая стража штрафует вас на {0} серебра.'],
    ['Your dog digs by a rock and barks: {0} silver in an old tin.', 'Пёс роет у камня и лает: в старой жестянке {0} серебра.'],
    ['Your dog sniffs out a buried scrap of chart.', 'Пёс вынюхивает зарытый обрывок карты.'],
    ['A hamlet’s dog follows your party back aboard.', 'Пёс из посёлка увязывается за десантом на борт.'],
    ['A monkey drops out of the trees onto your boat and will not leave.', 'Обезьянка прыгает с деревьев в вашу шлюпку и не хочет уходить.'],
    ['You have that pet already.', 'Такой питомец у вас уже есть.'],
    ['No pet seller here has that one.', 'У здешнего торговца такого нет.'],
    ['That pet is not yours.', 'Это не ваш питомец.'],
    ['Pet seller', 'Торговец животными'],
    ['Dug up by your dog', 'Выкопал ваш пёс'],
  );
  return out;
}
