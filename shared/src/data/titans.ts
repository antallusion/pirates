// docs/19 E10: the titans — the eighth tier of an army, one to a stack: the Kraken, the Leviathan, the White Whale,
// the Ancient Turtle and the Mother of Wrecks. A titan is hired only at the Grail raised over her island's town (the
// citadels of docs/19 E4 will keep them too), one a week, at a great price in silver and pearls; she carries two at
// the most and never two of a kind. One titan weighs about an eighth of the army of her level (some 12% of the
// ladder's ⚓10 army in the sea's reckoning, armyPower: docs/19 asked 8–10%, but the shop's seventh tier already stands
// at 8–11%, and the eighth must stand over it — under the sea's own legends, 17–22%) — a stack of its own with a
// temper of its own, not a war won.
// They are units as the great ones ashore are (bossunits.ts): UNITS takes them in with one line (army.ts), the might
// cap of the picked men leaves them out (town.ts mightRoom), no capture, joining, sale or lair ever hands one out.
//
// Until each has its own four-pose sheet (`unit.<id>`), a titan stands on the field as the figure of its nearest kind,
// tinted and drawn larger (TITAN_STAND_IN, as BOSS_UNIT_STAND_IN); its face on the cards is the painted monster.

import type { UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type TitanId = 'titan_kraken' | 'titan_leviathan' | 'titan_whale' | 'titan_turtle' | 'titan_wrecks';
export const TITAN_IDS: TitanId[] = ['titan_kraken', 'titan_leviathan', 'titan_whale', 'titan_turtle', 'titan_wrecks'];

type Stats = Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade'>;
const T = (id: TitanId, s: Stats): UnitDef => ({ id, tier: 8, up: false, base: id, upgrade: null, beast: true, legend: true, titan: true, ...s });

/** The five (balance: tests/titans.test.ts — each some 12% of the ladder's ⚓10 army in armyPower, over every beast
 *  of the shop's seventh tier, under the legends). */
export const TITANS: Record<TitanId, UnitDef> = {
  titan_kraken: T('titan_kraken', { atk: 23, def: 19, dmin: 15, dmax: 21, hp: 85, speed: 5, init: 8, shots: 0, specials: ['bind', 'sweep'], art: 'monster.kraken', cost: 4200 }),
  titan_leviathan: T('titan_leviathan', { atk: 24, def: 18, dmin: 16, dmax: 22, hp: 80, speed: 6, init: 9, shots: 0, specials: ['diving', 'terror'], art: 'monster.leviathan', cost: 4200 }),
  titan_whale: T('titan_whale', { atk: 20, def: 22, dmin: 13, dmax: 17, hp: 104, speed: 4, init: 6, shots: 0, specials: ['regen', 'retaliate_all'], art: 'monster.sperm_whale', cost: 4200 }),
  titan_turtle: T('titan_turtle', { atk: 16, def: 28, dmin: 10, dmax: 15, hp: 118, speed: 3, init: 4, shots: 0, specials: ['shell', 'regen', 'steady'], art: 'sight.giant_turtle', cost: 4200 }),
  titan_wrecks: T('titan_wrecks', { atk: 21, def: 23, dmin: 14, dmax: 18, hp: 92, speed: 3, init: 5, shots: 0, specials: ['sweep', 'drain'], art: 'monster.mother_of_wrecks', cost: 4200 }),
};

export const isTitan = (u: string): u is TitanId => (TITAN_IDS as string[]).includes(u);

/** Their names and what they do, for the cards and the battle (English, Russian). */
export const TITAN_NAMES: Record<TitanId, { name: Tr; note: Tr }> = {
  titan_kraken: {
    name: ['Kraken', 'Кракен'],
    note: ['The kraken of the old charts, raised and fed at the Grail: its arms hold a stack fast and sweep the hexes about it.', 'Кракен старых карт, выкормленный у Грааля: щупальца держат отряд на месте и сметают соседние клетки.'],
  },
  titan_leviathan: {
    name: ['Leviathan', 'Левиафан'],
    note: ['A leviathan that answers the Grail’s light: it dives under the field and comes up where it likes, and the living break before it.', 'Левиафан, что идёт на свет Грааля: ныряет под поле и всплывает где хочет, а живые бегут от него.'],
  },
  titan_whale: {
    name: ['White Whale', 'Белый кит'],
    note: ['A white whale grown old in the deep: it mends as the fight goes on and answers every blow.', 'Белый кит, состарившийся в глубине: заживает по ходу боя и отвечает на каждый удар.'],
  },
  titan_turtle: {
    name: ['Ancient Turtle', 'Древняя черепаха'],
    note: ['An island’s age of shell: slow, all but unhurt by steel, and it heals and holds its ground.', 'Панцирь возрастом с остров: медленная, сталь её почти не берёт, она заживает и не сходит с места.'],
  },
  titan_wrecks: {
    name: ['Mother of Wrecks', 'Мать обломков'],
    note: ['A crab-mother armoured in the wrecks she has eaten: her claws sweep the hexes about her and drink the strength of what they cut.', 'Крабья матка в броне из съеденных кораблей: клешни сметают соседние клетки и пьют силу тех, кого режут.'],
  },
};

/** Until `unit.<id>` is painted: the kind whose figure stands in for it, its tint, and how tall it stands. */
export const TITAN_STAND_IN: Record<TitanId, { u: string; tint: string; size: number }> = {
  titan_kraken: { u: 'young_kraken', tint: 'hue-rotate(-25deg) saturate(1.35) brightness(0.8) contrast(1.15)', size: 2 },
  titan_leviathan: { u: 'shoal_leviathan', tint: 'hue-rotate(150deg) saturate(1.2) brightness(0.8) contrast(1.15)', size: 2 },
  titan_whale: { u: 'white_whale', tint: 'brightness(1.15) contrast(1.1)', size: 2 },
  titan_turtle: { u: 'ancient_turtle', tint: 'sepia(0.4) saturate(1.3) brightness(0.85) contrast(1.15)', size: 2 },
  titan_wrecks: { u: 'wreck_titan', tint: 'sepia(0.6) hue-rotate(-20deg) saturate(1.4) brightness(0.8) contrast(1.2)', size: 2 },
};

/** A titan's price at the Grail (silver and pearls), how many she may carry, and how many a week she may hire. */
export const TITAN_PRICE = { silver: 40_000, pearls: 10 } as const;
export const TITAN_MAX = 2;
export const TITAN_WEEKLY = 1;
/** A titan serves a ship of this level and up. */
export const TITAN_SHIP_LEVEL = 9;

/** How many titans an army carries. */
export const titansIn = (army: readonly { u: string; n: number }[]): number => army.reduce((a, x) => a + (isTitan(x.u) ? x.n : 0), 0);
