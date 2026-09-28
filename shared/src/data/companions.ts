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
