// The week of the Heroes (docs/17 H3 item 10): HoMM3's calendar on the sea's own clock. A day is the world's day of
// 48 real minutes (DAY_LENGTH_SEC) and dawns at six on its clock; a week is seven of them — five hours and thirty-six
// real minutes, about one evening's play — so a captain sees a new week, and her dwellings' new men, every session,
// and a week's growth never has to wait for the calendar of the real world. Every week is named for what it brings
// ("Week of the Marine: marines' growth +50%"), drawn by its own dice seeded by the week's number (never the sea's
// rng: the same week is the same everywhere and a test can replay it).

import { DAY_LENGTH_SEC } from '../constants.ts';
import { Rng } from '../rng.ts';
import type { CreatureId } from './bestiary.ts';
import type { Tr } from './estate.ts';

export const WEEK_DAYS = 7;
export const WEEK_SEC = WEEK_DAYS * DAY_LENGTH_SEC;

/** The sea's day by its world clock (seconds): a new one dawns at 06:00 on the clock the HUD shows. */
export function dayIndex(worldSec: number): number {
  return Math.floor(worldSec / DAY_LENGTH_SEC + 0.1);
}

/** World seconds until the next dawn. */
export function secsToDawn(worldSec: number): number {
  const d = dayIndex(worldSec) + 1;
  return Math.max(0, (d - 0.1) * DAY_LENGTH_SEC - worldSec);
}

export const weekOfDay = (day: number): number => Math.floor(day / WEEK_DAYS);

export type WeekKind = 'deckhand' | 'marine' | 'musketeer' | 'gunner' | 'boarder' | 'guard' | 'drowned' | 'plenty' | 'fair' | 'silver' | 'fever'
  // docs/18 #45: the weeks of the creatures
  | 'crab' | 'gull' | 'seal' | 'shark' | 'turtle' | 'serpent' | 'mermaid' | 'tentacle'
  // the wild beasts' (owner, 2026-10-03)
  | 'jaguar' | 'crocodile' | 'bat' | 'octopus';

export interface WeekDef {
  id: WeekKind;
  name: Tr;
  /** What it does, as the herald cries it. */
  text: Tr;
  weight: number;
  /** A tier whose growth is raised by half (the week of a kind of man). */
  tier?: number;
  /** Every dwelling's growth this week (the fever halves it). */
  growth?: number;
  /** The mines' daily yield. */
  mines?: number;
  /** The island market's rates: what it pays and what it asks. */
  sell?: number;
  buy?: number;
  /** The town hall's daily silver. */
  hall?: number;
  /** docs/18 #45: the creatures the week is named for — their lairs stand with more of them (and leave more), their
   *  dwellings and pens grow half as many again, and the lookouts find them adrift oftener. */
  beasts?: CreatureId[];
}

/** A week of a kind of man raises that tier's growth by half (HoMM3's week of a creature). */
export const WEEK_TIER_BONUS = 0.5;

export const WEEKS: Record<WeekKind, WeekDef> = {
  deckhand: { id: 'deckhand', name: ['Week of the Deckhand', 'Неделя юнги'], text: ['Deckhands and seasoned sailors grow half as many again.', 'Юнг и бывалых матросов в жилищах прибывает в полтора раза больше.'], weight: 9, tier: 1 },
  marine: { id: 'marine', name: ['Week of the Marine', 'Неделя морпеха'], text: ['Marines and sea guards grow half as many again.', 'Морпехов и морской гвардии прибывает в полтора раза больше.'], weight: 9, tier: 2 },
  musketeer: { id: 'musketeer', name: ['Week of the Musketeer', 'Неделя мушкетёра'], text: ['Musketeers and sharpshooters grow half as many again.', 'Мушкетёров и метких стрелков прибывает в полтора раза больше.'], weight: 8, tier: 3 },
  gunner: { id: 'gunner', name: ['Week of the Gunner', 'Неделя канонира'], text: ['Gunners and bombardiers grow half as many again.', 'Канониров и бомбардиров прибывает в полтора раза больше.'], weight: 7, tier: 4 },
  boarder: { id: 'boarder', name: ['Week of the Boarder', 'Неделя абордажника'], text: ['Boarders and cutthroats grow half as many again.', 'Абордажников и головорезов прибывает в полтора раза больше.'], weight: 6, tier: 5 },
  guard: { id: 'guard', name: ['Week of the Guard', 'Неделя гвардейца'], text: ['The officers’ guard grows half as many again.', 'Офицерской гвардии прибывает в полтора раза больше.'], weight: 5, tier: 6 },
  drowned: { id: 'drowned', name: ['Week of the Drowned', 'Неделя утопленника'], text: ['The drowned rise half as many again.', 'Утопленников поднимается в полтора раза больше.'], weight: 3, tier: 7 },
  plenty: { id: 'plenty', name: ['Week of Plenty', 'Неделя изобилия'], text: ['The mines yield half as much again.', 'Шахты дают в полтора раза больше.'], weight: 8, mines: 1.5 },
  fair: { id: 'fair', name: ['Week of the Fair', 'Ярмарочная неделя'], text: ['The island markets pay a quarter more and ask less.', 'Рынки островов платят на четверть больше и просят меньше.'], weight: 6, sell: 1.25, buy: 0.85 },
  silver: { id: 'silver', name: ['Week of Silver', 'Серебряная неделя'], text: ['The town halls take in half as much silver again.', 'Ратуши собирают в полтора раза больше серебра.'], weight: 6, hall: 1.5 },
  fever: { id: 'fever', name: ['Week of the Fever', 'Неделя лихорадки'], text: ['Fever in the ports: every dwelling grows half as many.', 'Лихорадка в портах: во всех жилищах прибывает вдвое меньше.'], weight: 3, growth: 0.5 },
  // docs/18 #45: HoMM3's weeks of a creature, for the land's and the sea's kinds.
  crab: { id: 'crab', name: ['Week of the Crab', 'Неделя краба'], text: ['The shore crabs swarm: a quarter more in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Береговые крабы кишат: в их логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['crab'] },
  gull: { id: 'gull', name: ['Week of the Gull', 'Неделя чайки'], text: ['The carrion gulls flock: a quarter more in their lairs and in their loot, their dwellings and pens grow half as many again, and they are found adrift oftener.', 'Чайки-падальщики сбиваются в стаи: в их логовах и в добыче на четверть больше, их жилища и загоны растут в полтора раза, и их чаще находят в дрейфе.'], weight: 3, beasts: ['gull'] },
  seal: { id: 'seal', name: ['Week of the Seal', 'Неделя тюленя'], text: ['The rookeries are full: a quarter more seals in their lairs and in their loot, their dwellings and pens grow half as many again, and they are found adrift oftener.', 'Лежбища полны: тюленей в логовах и в добыче на четверть больше, их жилища и загоны растут в полтора раза, и их чаще находят в дрейфе.'], weight: 3, beasts: ['seal'] },
  shark: { id: 'shark', name: ['Week of the Shark', 'Неделя акулы'], text: ['The sharks come into the shallows: a quarter more in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Акулы заходят на мелководье: в их логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['reef_shark'] },
  turtle: { id: 'turtle', name: ['Week of the Turtle', 'Неделя черепахи'], text: ['The turtles come ashore to lay: a quarter more in their lairs and in their loot, their dwellings and pens grow half as many again, and they are found adrift oftener.', 'Черепахи выходят на берег откладывать яйца: в их логовах и в добыче на четверть больше, их жилища и загоны растут в полтора раза, и их чаще находят в дрейфе.'], weight: 3, beasts: ['rock_turtle', 'sea_turtle', 'ancient_turtle'] },
  serpent: { id: 'serpent', name: ['Week of the Serpent', 'Неделя змея'], text: ['The serpents shed their skins: a quarter more in their lairs, grottoes and loot, their dwellings and pens grow half as many again, and they are found adrift oftener.', 'Змеи сбрасывают кожу: в их логовах, гротах и в добыче на четверть больше, их жилища и загоны растут в полтора раза, и их чаще находят в дрейфе.'], weight: 3, beasts: ['marsh_serpent', 'young_serpent'] },
  mermaid: { id: 'mermaid', name: ['Week of the Mermaid', 'Неделя русалки'], text: ['Songs on the water at night: mermaids are found in the nets oftener, and their pens grow half as many again.', 'По ночам над водой песни: русалок чаще находят в сетях, а их загоны растут в полтора раза.'], weight: 3, beasts: ['mermaid'] },
  tentacle: { id: 'tentacle', name: ['Week of the Tentacle', 'Неделя щупальца'], text: ['Something stirs in the lagoons: a quarter more tentacles in their lairs and in their loot, their dwellings and pens grow half as many again, and they are found adrift oftener.', 'В лагунах что-то шевелится: щупалец в логовах и в добыче на четверть больше, их жилища и загоны растут в полтора раза, и их чаще находят в дрейфе.'], weight: 3, beasts: ['lagoon_tentacle'] },
  // The wild beasts' weeks (owner, 2026-10-03): their lairs ashore, none of them found adrift.
  jaguar: { id: 'jaguar', name: ['Week of the Jaguar', 'Неделя ягуара'], text: ['The jaguars hunt by day: a quarter more in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Ягуары охотятся и днём: в их логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['jaguar'] },
  crocodile: { id: 'crocodile', name: ['Week of the Crocodile', 'Неделя крокодила'], text: ['The rains flood the mangroves: a quarter more crocodiles in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Дожди заливают мангры: крокодилов в логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['crocodile'] },
  bat: { id: 'bat', name: ['Week of the Bat', 'Неделя летучей мыши'], text: ['The caves breathe out bats at noon: a quarter more in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Пещеры выдыхают летучих мышей и в полдень: в их логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['cave_bat'] },
  octopus: { id: 'octopus', name: ['Week of the Octopus', 'Неделя осьминога'], text: ['The octopuses climb out of the wrecks: a quarter more in their lairs and in their loot, and their dwellings and pens grow half as many again.', 'Осьминоги выбираются из разбитых кораблей: в их логовах и в добыче на четверть больше, а их жилища и загоны растут в полтора раза.'], weight: 3, beasts: ['giant_octopus'] },
};

/** docs/18 #45: a creature week's lairs of its kind stand with this many more creatures (and leave as much more), its
 *  dwellings and pens grow this much, and its drifts are this many times as likely. */
export const WEEK_BEAST_LAIR = 1.25;
export const WEEK_BEAST_GROWTH = 1.5;
export const WEEK_BEAST_DRIFT = 4;

/** Whether the week is named for a creature kind. */
export const weekOfBeast = (kind: WeekKind, u: string): boolean => !!WEEKS[kind]?.beasts?.includes(u as CreatureId);
/** A creature kind's dwelling and pen growth this week. */
export const weekBeastGrowth = (kind: WeekKind, u: string): number => (weekOfBeast(kind, u) ? WEEK_BEAST_GROWTH : 1);

export const WEEK_KINDS = Object.keys(WEEKS) as WeekKind[];

/** The week's own dice: seeded by its number alone. */
export function weekRng(week: number): Rng {
  return new Rng((0x3e3c0a51 ^ Math.imul((week | 0) + 1, 0x9e3779b1)) >>> 0);
}

/** What the week is named for (the same everywhere for the same week). */
export function weekKind(week: number): WeekKind {
  return weekRng(week).weighted(WEEK_KINDS.map((k) => [k, WEEKS[k].weight] as const));
}

/** A tier's growth this week: half again in its own week, half in the fever. */
export function weekGrowth(kind: WeekKind, tier: number): number {
  const d = WEEKS[kind];
  return (d.growth ?? 1) * (d.tier === tier ? 1 + WEEK_TIER_BONUS : 1);
}

export const weekMines = (kind: WeekKind): number => WEEKS[kind].mines ?? 1;
export const weekHall = (kind: WeekKind): number => WEEKS[kind].hall ?? 1;
export const weekSell = (kind: WeekKind): number => WEEKS[kind].sell ?? 1;
export const weekBuy = (kind: WeekKind): number => WEEKS[kind].buy ?? 1;
