// The Descent into the Abyss (docs/12 P10 #17): a weekly roguelike for one captain or a group. Each week the Maelstrom
// Stair opens in one sea; those who go down fight tier after tier, each a new mix of the deep's creatures, currents and
// darkness; between tiers they take a blessing or a curse; the deepest go on the week's board.

import type { StatMods } from './stats.ts';

type Tr = [string, string];

export const WEEK_MS = 7 * 86_400_000;
/** The arena about the Stair; leaving it this long ends a captain's descent. */
export const ARENA_R = 1800;
export const OUT_SEC = 20;
/** Within this of the Stair a descent is begun; group mates within this go down together. */
export const GATE_R = 600;
export const GROUP_R = 1500;
/** A tier is over when its creatures are gone, or after this long (the deep takes the rest). */
export const TIER_SEC = 5 * 60;
/** The choice waits this long for the leader, then takes the first blessing. */
export const CHOICE_SEC = 60;
/** Seconds between a choice and the next tier's creatures. */
export const BREATH_SEC = 5;

export type HostId = 'echoes' | 'reavers' | 'sharks' | 'orcas' | 'serpent';
export type CurrentId = 'still' | 'eddy' | 'undertow' | 'rip';
export type DarkId = 'moonlit' | 'dusk' | 'pitch';

export const HOSTS: Record<HostId, { name: Tr }> = {
  echoes: { name: ['Echoes of the drowned', 'Эхо утонувших'] },
  reavers: { name: ['Reavers of the deep', 'Налётчики глубин'] },
  sharks: { name: ['Sharks', 'Акулы'] },
  orcas: { name: ['Orcas', 'Касатки'] },
  serpent: { name: ['A young serpent', 'Молодой змей'] },
};
export const HOST_IDS = Object.keys(HOSTS) as HostId[];

export const CURRENTS: Record<CurrentId, { name: Tr; text: Tr }> = {
  still: { name: ['Still water', 'Стоячая вода'], text: ['No current.', 'Течения нет.'] },
  eddy: { name: ['Eddy', 'Водоворот'], text: ['The water turns about the Stair.', 'Вода кружит вокруг Лестницы.'] },
  undertow: { name: ['The Pull', 'Затягивание'], text: ['The water pulls toward the Stair.', 'Вода тянет к Лестнице.'] },
  rip: { name: ['Rip', 'Разрывное течение'], text: ['A strong stream across the arena.', 'Сильная струя поперёк арены.'] },
};
export const CURRENT_IDS = Object.keys(CURRENTS) as CurrentId[];

export const DARKS: Record<DarkId, { name: Tr; bite: number }> = {
  moonlit: { name: ['Moonlit', 'Лунный свет'], bite: 0 },
  dusk: { name: ['Dusk', 'Сумрак'], bite: 0.1 },
  pitch: { name: ['Pitch dark', 'Кромешная тьма'], bite: 0.2 },
};
export const DARK_IDS = Object.keys(DARKS) as DarkId[];

export type BoonId = 'salt_fury' | 'swift_current' | 'iron_skin' | 'quick_hands' | 'tide_mending' | 'lantern'
  | 'blood_in_water' | 'drowned_hands' | 'black_water' | 'undertow_curse';

export interface BoonDef {
  name: Tr;
  text: Tr;
  curse: boolean;
  /** For the rest of the descent. */
  mods?: StatMods;
  /** A curse's weight on the week's board: depth × (1 + the curses' glory). */
  glory?: number;
}

export const BOONS: Record<BoonId, BoonDef> = {
  salt_fury: { name: ['Salt Fury', 'Солёная ярость'], text: ['+10% gun damage', '+10% к урону орудий'], curse: false, mods: { gunDamageMul: 0.1 } },
  swift_current: { name: ['Swift Current', 'Быстрое течение'], text: ['+8% speed', '+8% к ходу'], curse: false, mods: { maxSpeed: 0.08 } },
  iron_skin: { name: ['Iron Skin', 'Железная шкура'], text: ['−10% damage taken', '−10% получаемого урона'], curse: false, mods: { incomingDamageMul: -0.1 } },
  quick_hands: { name: ['Quick Hands', 'Быстрые руки'], text: ['−10% reload', '−10% перезарядки'], curse: false, mods: { reloadMul: -0.1 } },
  tide_mending: { name: ['Tide Mending', 'Врачующий прилив'], text: ['Hull and canvas mended by a third now', 'Корпус и паруса сразу чинятся на треть'], curse: false },
  lantern: { name: ['The Pale Lantern', 'Бледный фонарь'], text: ['Darkness no longer helps the deep', 'Тьма больше не помогает глубине'], curse: false },
  blood_in_water: { name: ['Blood in the Water', 'Кровь в воде'], text: ['One more creature each tier; glory ×1.5', 'На ярус больше на одну тварь; слава ×1,5'], curse: true, glory: 0.5 },
  drowned_hands: { name: ['Drowned Hands', 'Руки утопленников'], text: ['+12% reload; glory ×1.3', '+12% перезарядки; слава ×1,3'], curse: true, mods: { reloadMul: 0.12 }, glory: 0.3 },
  black_water: { name: ['Black Water', 'Чёрная вода'], text: ['Always pitch dark; glory ×1.3', 'Всегда кромешная тьма; слава ×1,3'], curse: true, glory: 0.3 },
  undertow_curse: { name: ['The Deep Pull', 'Тяга глубины'], text: ['Currents twice as strong; glory ×1.3', 'Течения вдвое сильнее; слава ×1,3'], curse: true, glory: 0.3 },
};
export const BLESSINGS = (Object.keys(BOONS) as BoonId[]).filter((b) => !BOONS[b].curse);
export const CURSES = (Object.keys(BOONS) as BoonId[]).filter((b) => BOONS[b].curse);

/** How many creatures a tier brings (before curses), and their level over the group's. */
export function tierCount(tier: number): number {
  return Math.min(7, 2 + Math.floor(tier / 2));
}
export function tierLevelBonus(tier: number): number {
  return Math.floor(tier / 3);
}
/** Silver for each captain for a tier cleared. */
export function tierSilver(tier: number, level: number): number {
  return Math.round(120 * tier * (1 + level / 5));
}
/** The glory of a descent on the week's board. */
export function glory(depth: number, boons: BoonId[]): number {
  return Math.round(depth * (1 + boons.reduce((a, b) => a + (BOONS[b].glory ?? 0), 0)) * 10) / 10;
}

export function descentPatterns(): [string, string][] {
  const out: [string, string][] = [
    ['The Maelstrom Stair', 'Лестница Мальстрёма'],
    ['the way down', 'путь вниз'],
    ['The descent begins: tier 1.', 'Спуск начался: ярус 1.'],
    ['Tier {0}: {1}; {2}; {3}.', 'Ярус {0}: {1}; {2}; {3}.'],
    ['Tier {0}: {1} and {2}; {3}; {4}.', 'Ярус {0}: {1} и {2}; {3}; {4}.'],
    ['Tier {0} is cleared: {1} silver.', 'Ярус {0} пройден: {1} серебра.'],
    ['The deep takes the rest: tier {0} is behind you.', 'Глубина забрала остальных: ярус {0} позади.'],
    ['{0} is chosen.', 'Выбрано: {0}.'],
    ['The descent is over at tier {0} (glory {1}).', 'Спуск окончен на ярусе {0} (слава {1}).'],
    ['You have left the arena: your descent is over.', 'Вы покинули арену: ваш спуск окончен.'],
    ['Back to the arena, or your descent ends!', 'Вернитесь на арену, иначе спуск окончится!'],
    ['You are already going down.', 'Вы уже спускаетесь.'],
    ['The Stair is not here.', 'Лестницы здесь нет.'],
    ['Only the leader chooses.', 'Выбирает только ведущий.'],
    ['Nothing to choose now.', 'Сейчас выбирать нечего.'],
    ['The deep gives up {0}.', 'Глубина отдаёт: {0}.'],
    ['The Maelstrom Stair has opened in {0}.', 'Лестница Мальстрёма открылась: {0}.'],
  ];
  for (const b of Object.values(BOONS)) out.push([b.name[0], b.name[1]]);
  for (const h of Object.values(HOSTS)) out.push([h.name[0], h.name[1]]);
  for (const c of Object.values(CURRENTS)) out.push([c.name[0], c.name[1]]);
  for (const d of Object.values(DARKS)) out.push([d.name[0], d.name[1]]);
  return out;
}
