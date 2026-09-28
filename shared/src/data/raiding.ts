// The pirate's and the privateer's trade (docs/12 P6): the Brethren of the Coast's ranks for a raider, the heat of
// a sea's shipping lanes, the tavern's tips and the clerk's manifest, tribute from a merchant who has struck.

export type Tr = [string, string];

/** Fame with the Brethren for each rank (index = rank 0..5). */
export const BRETHREN_RANKS = [0, 10, 40, 100, 220, 400];
export const BRETHREN_NAMES: Tr[] = [
  ['Landlubber', 'Сухопутная крыса'], ['Cutthroat', 'Головорез'], ['Boarder', 'Абордажник'], ['Captain of the Brethren', 'Капитан Братства'],
  ['Scourge of the Lanes', 'Гроза трасс'], ['Terror of the Merchants', 'Гроза торговцев'],
];
export const FAME = { tribute: 2, board: 3, prize: 5, convoy: 10, release: 1 } as const;
/** Rank 1: the havens' fences pay 66% instead of 60%; 2: a raid cheers the crew more; 3: the Code at any haven;
 *  4: the havens' fences pay 75%; 5: the title. */
export const FENCE_RANK = 1;
export const MORALE_RANK = 2;
export const CODE_RANK = 3;
export const WARES_RANK = 4;
export const TITLE_RANK = 5;
export const TERROR_TITLE = 'Terror of the Merchants';

export function brethrenRank(fame: number): number {
  let r = 0;
  for (let i = 1; i < BRETHREN_RANKS.length; i++) if (fame >= BRETHREN_RANKS[i]) r = i;
  return r;
}

/** A tribute: this share of what she carries. */
export const TRIBUTE: [number, number] = [0.2, 0.4];
/** The heat of a sea's lanes (0..100): what raids add, how fast it cools (an hour), where it starts to bite. */
export const HEAT = { tribute: 5, raid: 8, convoy: 20, coolPerHour: 10, escort: 40, hunters: 60 } as const;
/** Prices in a hot sea: dearer to buy, and a runner who gets through sells high. */
export function heatPrices(heat: number): { buy: number; sell: number } {
  return { buy: 1 + heat / 400, sell: 1 + heat / 250 };
}

/** The clerk's price for a port's manifest (an hour), and a tip's. */
export function clerkCost(size: number): number {
  return 250 + 60 * size;
}
export function tipCost(value: number): number {
  return Math.round(Math.max(120, Math.min(900, value * 0.04)) / 10) * 10;
}
export const TIP_WINDOW = 900; // seconds between a port's new tips
export const CONVOY_EVERY: [number, number] = [1200, 2400];
export const DEED_CONVOYS = 5;

export function raidPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const n of BRETHREN_NAMES) out.push(n);
  out.push(
    [TERROR_TITLE, 'Гроза торговцев'],
    ['{0} pays tribute: {1} silver. She sails on.', '«{0}» платит дань: {1} серебра. Она идёт дальше.'],
    ['Only a merchant who has struck pays tribute.', 'Дань платит только сдавшийся торговец.'],
    ['Come within hail of her first.', 'Сначала подойдите на голос.'],
    ['She has paid you already.', 'Она уже заплатила вам.'],
    ['{0} sends up a rocket — a patrol will come!', '«{0}» пускает ракету — придёт патруль!'],
    ['Swivel guns bark from her rail!', 'С её борта рявкают фальконеты!'],
    ['A League cutter answers the rocket: {0}.', 'На ракету отвечает катер Лиги: «{0}».'],
    ['WORLD: {0} broke a League convoy in {1}!', 'Вести: {0} разбивает конвой Лиги в водах «{1}»!'],
    ['A League convoy of {0} sails from {1} for {2}.', 'Конвой Лиги из {0} судов идёт из {1} в {2}.'],
    ['The lanes of {0} run hot: the League sends escorts.', 'На трассах вод «{0}» жарко: Лига даёт торговцам эскорт.'],
    ['The tip: {0} leaves {1} for {2} in {3} min.', 'Наводка: «{0}» выходит из {1} в {2} через {3} мин.'],
    ['The tip is yours already.', 'Эта наводка уже ваша.'],
    ['That tip has gone cold.', 'Эта наводка остыла.'],
    ['The clerk slips you the manifest: every merchant out of {0} this hour is an open book.', 'Писарь суёт вам манифест: каждый торговец из {0} в этот час — открытая книга.'],
    ['The tipped merchant puts to sea: {0}.', 'Торговец по наводке выходит в море: «{0}».'],
    ['The Brethren of the Coast: {0}.', 'Береговое братство: {0}.'],
    ['The Brethren hear you kept the Code.', 'Братство слышит: вы соблюли Кодекс.'],
    ['The Brethren name you Terror of the Merchants!', 'Братство называет вас Грозой торговцев!'],
    ['You broke your word to {0}: the lanes will remember.', 'Вы нарушили слово, данное «{0}»: трассы это запомнят.'],
    ['Nothing to appraise there.', 'Там нечего оценивать.'],
    ['Too far for the glass.', 'Слишком далеко для подзорной трубы.'],
  );
  return out;
}
