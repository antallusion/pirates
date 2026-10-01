// Artifacts (docs/17 H2 item 9, HoMM3's): the captain's own gear slots are the hero's slots, and an artifact in one
// gives her primaries (Attack, Defense, Power, Will), a line or two at sea, and something in the boarding battle. Three
// sets of three, as HoMM3's combination pieces: the whole set worn gives its bonus. They are found on bosses, in dug-up
// hoards and stormed lairs, won from guarded ships, and sold by the artifact merchants of a few ports. They never wear
// out. Their pictures are the item art already painted (icon.item_*).

import type { CaptainSlot, Item } from './items.ts';
import type { Flag, StatMods } from './stats.ts';
import type { Prims } from './hero.ts';
import type { School } from './hero.ts';
import { Rng } from '../rng.ts';

export type ArtClass = 'treasure' | 'minor' | 'major' | 'relic';
export const ART_CLASS_NAMES: Record<ArtClass, [string, string]> = { treasure: ['Treasure', 'Сокровище'], minor: ['Minor artifact', 'Малый артефакт'], major: ['Major artifact', 'Великий артефакт'], relic: ['Relic', 'Реликвия'] };
/** Rarity colour (the gear's scale) and the captain's level band it asks for. */
export const ART_RARITY: Record<ArtClass, 2 | 3 | 4> = { treasure: 2, minor: 2, major: 3, relic: 4 };
export const ART_ILVL: Record<ArtClass, number> = { treasure: 1, minor: 2, major: 4, relic: 6 };

/** What an artifact does in the boarding battle. */
export interface ArtBattle {
  /** Melee and shots, a share more; damage taken a share less. */
  melee?: number;
  shot?: number;
  taken?: number;
  morale?: number;
  luck?: number;
  /** Orders of every school (or one) a share stronger; their will a share cheaper. */
  orders?: number;
  school?: Partial<Record<School, number>>;
  cost?: number;
  /** A share of her fallen stand again after the battle. */
  raise?: number;
}

export type ArtSetId = 'drowned_regalia' | 'red_hook_arms' | 'stormcaller';

export interface ArtifactDef {
  id: string;
  slot: CaptainSlot;
  cls: ArtClass;
  /** The item art it wears (icon.item_*), and the base it stands on (its slot and kind). */
  icon: string;
  base: string;
  name: [string, string];
  text: [string, string];
  prim?: Partial<Prims>;
  mods?: StatMods;
  flags?: Flag[];
  battle?: ArtBattle;
  /** At sea: sea orders' will a share cheaper; the day's will a share more. */
  seaCost?: number;
  willDay?: number;
  set?: ArtSetId;
  price: number;
}

const A = (id: string, slot: CaptainSlot, cls: ArtClass, icon: string, base: string, name: [string, string], text: [string, string], rest: Partial<ArtifactDef> = {}): ArtifactDef =>
  ({ id, slot, cls, icon, base, name, text, price: { treasure: 1500, minor: 4000, major: 11000, relic: 30000 }[cls], ...rest });

export const ARTIFACTS: Record<string, ArtifactDef> = Object.fromEntries([
  // The Regalia of the Drowned Admiral (Water).
  A('drowned_bicorne', 'hat', 'major', 'item_admiral_hat', 'admiral_hat', ['Bicorne of the Drowned Admiral', 'Двууголка утопленного адмирала'], ['Salt in its braid that never dries.', 'Соль в галуне, что никогда не высыхает.'], { prim: { will: 2, pow: 1 }, set: 'drowned_regalia' }),
  A('kelp_coat', 'coat', 'major', 'item_oilskin', 'oilskin', ['Kelp-Woven Coat', 'Камзол из ламинарии'], ['Woven by the drowned for the drowned.', 'Соткан утопленниками для утопленников.'], { prim: { def: 2, will: 1 }, set: 'drowned_regalia' }),
  A('needle_of_the_deep', 'compass', 'major', 'item_drowned_compass', 'dead_compass', ['Needle of the Deep', 'Стрелка глубины'], ['It points down.', 'Она показывает вниз.'], { prim: { pow: 2 }, battle: { school: { water: 0.15 } }, set: 'drowned_regalia' }),
  // The Arms of the Red Hook (Steel).
  A('red_hook_axe', 'blade', 'major', 'item_boarding_axe', 'boarding_axe', ['Axe of the Red Hook', 'Топор Красного Крюка'], ['Forty ships of it.', 'На нём сорок кораблей.'], { prim: { atk: 3 }, set: 'red_hook_arms' }),
  A('hook_brace', 'pistols', 'major', 'item_blunderbuss', 'blunderbuss', ['The Hook’s Brace', 'Пара Крюка'], ['Two blunderbusses on one strap.', 'Два мушкетона на одном ремне.'], { prim: { atk: 1 }, battle: { shot: 0.1 }, set: 'red_hook_arms' }),
  A('bloodied_baldric', 'sash', 'major', 'item_baldric', 'baldric', ['Bloodied Baldric', 'Окровавленная портупея'], ['Nobody washes it.', 'Её никто не стирает.'], { prim: { atk: 1, def: 1 }, battle: { melee: 0.05 }, set: 'red_hook_arms' }),
  // The Stormcaller's Instruments (Wind).
  A('squall_glass', 'spyglass', 'major', 'item_night_glass', 'night_glass', ['Squall Glass', 'Шквальная труба'], ['In it the weather is always a day ahead.', 'В ней погода всегда на день впереди.'], { prim: { pow: 2 }, mods: { detection: 0.05 }, set: 'stormcaller' }),
  A('deck_grip_boots', 'boots', 'major', 'item_pilot_boots', 'pilot_boots', ['Deck-Grip Boots', 'Штормовые ботфорты'], ['No deck too steep.', 'Никакая палуба для них не крута.'], { prim: { def: 1, will: 1 }, mods: { maxSpeed: 0.03 }, set: 'stormcaller' }),
  A('ring_of_the_gale', 'ring', 'major', 'item_league_ring', 'league_ring', ['Ring of the Gale', 'Перстень шквала'], ['Cold as the wind it holds.', 'Холоден, как ветер, что в нём заключён.'], { prim: { pow: 1, will: 2 }, set: 'stormcaller' }),
  // The rest.
  A('first_mate_cutlass', 'blade', 'treasure', 'item_cutlass', 'cutlass', ['First Mate’s Cutlass', 'Сабля старпома'], ['Notched from a hundred rails.', 'Зазубрена о сотню бортов.'], { prim: { atk: 2 } }),
  A('quartermaster_rapier', 'blade', 'minor', 'item_rapier', 'rapier', ['Quartermaster’s Rapier', 'Рапира квартирмейстера'], ['It settles arguments over shares.', 'Решает споры о долях.'], { prim: { atk: 3, def: 1 } }),
  A('mail_lined_coat', 'coat', 'treasure', 'item_longcoat', 'longcoat', ['Mail-Lined Coat', 'Камзол на кольчуге'], ['Heavy, and worth it.', 'Тяжёлый — и того стоит.'], { prim: { def: 2 } }),
  A('dress_uniform', 'coat', 'minor', 'item_uniform', 'uniform', ['Captain’s Dress Uniform', 'Парадный мундир капитана'], ['Men follow braid.', 'За галуном идут.'], { prim: { def: 3, atk: 1 } }),
  A('tricorne_of_command', 'hat', 'minor', 'item_tricorne', 'tricorne', ['Tricorne of Command', 'Треуголка командира'], ['The crew straighten when it passes.', 'Команда подтягивается, когда она проходит мимо.'], { prim: { pow: 1, will: 1 }, battle: { morale: 1 } }),
  A('bandana_of_fury', 'hat', 'minor', 'item_bandana', 'bandana', ['Bandana of Fury', 'Бандана ярости'], ['Red, so the blood does not show.', 'Красная, чтобы не было видно крови.'], { prim: { atk: 2 }, battle: { melee: 0.05 } }),
  A('cartridge_bandolier', 'sash', 'minor', 'item_cartridge_belt', 'cartridge_belt', ['Marksman’s Bandolier', 'Патронташ стрелка'], ['Every cartridge weighed by hand.', 'Каждый патрон взвешен вручную.'], { prim: { atk: 1 }, battle: { shot: 0.15 } }),
  A('duellist_pistols', 'pistols', 'treasure', 'item_duelling_pistols', 'duelling_pistols', ['Duellist’s Pistols', 'Пистоли дуэлянта'], ['A pair that never missed at dawn.', 'Пара, ни разу не промахнувшаяся на рассвете.'], { prim: { atk: 1 }, battle: { shot: 0.1 } }),
  A('tide_boots', 'boots', 'treasure', 'item_seaboots', 'seaboots', ['Boots of the Tide', 'Сапоги прилива'], ['They walk with the current.', 'Шагают вместе с течением.'], { prim: { will: 1 }, mods: { maxSpeed: 0.04 } }),
  A('watch_glass', 'spyglass', 'treasure', 'item_brass_glass', 'brass_glass', ['Glass of the Night Watch', 'Труба ночной вахты'], ['It has seen every sail first.', 'Она первой видела каждый парус.'], { prim: { pow: 1 }, mods: { detection: 0.08 } }),
  A('lodestone_compass', 'compass', 'minor', 'item_brass_compass', 'brass_compass', ['Lodestone Compass', 'Магнитный компас'], ['It pulls at the mind as at the needle.', 'Тянет разум, как стрелку.'], { prim: { will: 2 }, willDay: 0.1 }),
  A('lucky_doubloon', 'charm', 'minor', 'item_rabbit_foot', 'rabbit_foot', ['Lucky Doubloon', 'Счастливый дублон'], ['Heads every time.', 'Всегда орёл.'], { prim: { def: 1 }, battle: { luck: 1 } }),
  A('mercy_medal', 'charm', 'major', 'item_saint_medal', 'saint_medal', ['Medal of Saint Mercy', 'Медаль святой Милости'], ['The surgeon kisses it before he cuts.', 'Хирург целует её, прежде чем резать.'], { prim: { will: 1 }, battle: { raise: 0.1, school: { water: 0.1 } } }),
  A('ring_of_brine', 'ring', 'major', 'item_skull_ring', 'skull_ring', ['Ring of Brine', 'Кольцо рассола'], ['Orders come easier with salt on the tongue.', 'С солью на языке приказы даются легче.'], { prim: { will: 3 }, battle: { cost: 0.1 }, seaCost: 0.1 }),
  A('orca_talisman', 'charm', 'minor', 'item_orca_tooth', 'orca_tooth', ['Orca Talisman', 'Талисман касатки'], ['The pod knows its own.', 'Стая знает своих.'], { prim: { def: 2, will: 1 } }),
  A('admirals_signet', 'ring', 'major', 'item_signet', 'signet', ['Admiral’s Signet', 'Адмиральская печатка'], ['It seals orders that are obeyed.', 'Ею скрепляют приказы, которые исполняют.'], { prim: { atk: 1, def: 1, pow: 1, will: 1 } }),
  A('last_volley_tricorne', 'hat', 'relic', 'item_vane_tricorne', 'tricorne', ['Tricorne of the Last Volley', 'Треуголка последнего залпа'], ['The hat Edric Vane wore the day he refused.', 'Та самая шляпа Эдрика Вейна, в которой он отказался стрелять.'], { prim: { atk: 3, def: 3 }, battle: { morale: 1 } }),
  A('white_orca_fang', 'charm', 'relic', 'item_white_orca_tooth', 'orca_tooth', ['Fang of the White Orca', 'Клык Белой касатки'], ['The deep knows who wears it.', 'Глубина знает, кто его носит.'], { prim: { atk: 2, def: 2, pow: 2, will: 2 }, battle: { luck: 1 } }),
].map((a) => [a.id, a]));

export const ARTIFACT_IDS = Object.keys(ARTIFACTS);

export interface ArtSetDef {
  id: ArtSetId;
  name: [string, string];
  pieces: string[];
  text: [string, string];
  prim?: Partial<Prims>;
  mods?: StatMods;
  battle?: ArtBattle;
  seaCost?: number;
  willDay?: number;
}

export const ART_SETS: Record<ArtSetId, ArtSetDef> = {
  drowned_regalia: {
    id: 'drowned_regalia', name: ['Regalia of the Drowned Admiral', 'Регалии утопленного адмирала'], pieces: ['drowned_bicorne', 'kelp_coat', 'needle_of_the_deep'],
    text: ['The whole regalia: Will +4, Water orders +50%, the day fills twice the will.', 'Все регалии: Воля +4, приказы Воды +50%, за день воли вдвое больше.'],
    prim: { will: 4 }, battle: { school: { water: 0.5 } }, willDay: 1,
  },
  red_hook_arms: {
    id: 'red_hook_arms', name: ['Arms of the Red Hook', 'Оружие Красного Крюка'], pieces: ['red_hook_axe', 'hook_brace', 'bloodied_baldric'],
    text: ['All three: Attack +4, melee +15%, morale +1 in a boarding.', 'Все три: Атака +4, рукопашная +15%, боевой дух +1 в абордаже.'],
    prim: { atk: 4 }, battle: { melee: 0.15, morale: 1 },
  },
  stormcaller: {
    id: 'stormcaller', name: ['Instruments of the Stormcaller', 'Инструменты Штормового'], pieces: ['squall_glass', 'deck_grip_boots', 'ring_of_the_gale'],
    text: ['All three: Power +3, sea orders for half the will, Wind orders +50%.', 'Все три: Сила приказов +3, морские приказы за полцены воли, приказы Ветра +50%.'],
    prim: { pow: 3 }, battle: { school: { wind: 0.5 } }, seaCost: 0.5, mods: { maxSpeed: 0.02 },
  },
};
export const ART_SET_IDS = Object.keys(ART_SETS) as ArtSetId[];

/** An artifact as an item in the locker (its uid given by the locker). */
export function makeArtifact(id: string, uid = 0): Item {
  const d = ARTIFACTS[id];
  return { uid, base: d.base, ilvl: ART_ILVL[d.cls], rarity: ART_RARITY[d.cls], affixes: [], dur: 100, art: id, bound: false };
}

/** The sets whose every piece is worn. */
export function fullSets(worn: readonly Item[]): ArtSetId[] {
  const have = new Set(worn.map((it) => it.art).filter((x): x is string => !!x));
  return ART_SET_IDS.filter((s) => ART_SETS[s].pieces.every((p) => have.has(p)));
}

/** Everything the worn artifacts and their full sets give the hero. */
export interface ArtTotals {
  prim: Prims;
  battle: Required<Omit<ArtBattle, 'school'>> & { school: Record<School, number> };
  seaCost: number;
  willDay: number;
  sets: ArtSetId[];
}

/** Everything the worn artifacts and their full sets give the hero: primaries, the battle's lines, the sea's. */
export function artTotals(worn: readonly Item[]): ArtTotals {
  const prim: Prims = { atk: 0, def: 0, pow: 0, will: 0 };
  const battle = { melee: 0, shot: 0, taken: 0, morale: 0, luck: 0, orders: 0, cost: 0, raise: 0, school: { fire: 0, wind: 0, water: 0, steel: 0, board: 0, fog: 0 } as Record<School, number> };
  let seaCost = 0, willDay = 0;
  const addB = (b?: ArtBattle) => {
    if (!b) return;
    for (const k of ['melee', 'shot', 'taken', 'morale', 'luck', 'orders', 'cost', 'raise'] as const) battle[k] += b[k] ?? 0;
    for (const sc in b.school ?? {}) battle.school[sc as School] += b.school![sc as School] ?? 0;
  };
  const addP = (p?: Partial<Prims>) => {
    for (const k in p ?? {}) prim[k as keyof Prims] += p![k as keyof Prims] ?? 0;
  };
  for (const it of worn) {
    const d = it.art ? ARTIFACTS[it.art] : undefined;
    if (!d) continue;
    addP(d.prim);
    addB(d.battle);
    seaCost += d.seaCost ?? 0;
    willDay += d.willDay ?? 0;
  }
  const sets = fullSets(worn);
  for (const s of sets) {
    const d = ART_SETS[s];
    addP(d.prim);
    addB(d.battle);
    seaCost += d.seaCost ?? 0;
    willDay += d.willDay ?? 0;
  }
  return { prim, battle, seaCost: Math.min(0.75, seaCost), willDay, sets };
}

/** The sea lines of the worn artifacts and their full sets (for the ship's stats). */
export function artSeaSource(worn: readonly Item[]): { mods: StatMods; flags: Flag[] } {
  const mods: StatMods = {};
  const flags: Flag[] = [];
  const add = (m?: StatMods) => {
    for (const k in m ?? {}) mods[k as keyof StatMods] = (mods[k as keyof StatMods] ?? 0) + (m![k as keyof StatMods] ?? 0);
  };
  for (const s of fullSets(worn)) add(ART_SETS[s].mods);
  return { mods, flags };
}

/** Where one comes from: its class's odds. */
export const ART_WEIGHTS: Record<'boss' | 'chest' | 'guard' | 'shop', Record<ArtClass, number>> = {
  boss: { treasure: 0, minor: 30, major: 60, relic: 10 },
  chest: { treasure: 50, minor: 35, major: 14, relic: 1 },
  guard: { treasure: 45, minor: 40, major: 14, relic: 1 },
  shop: { treasure: 55, minor: 35, major: 10, relic: 0 },
};

/** One artifact from a source, on the dice given. */
export function rollArtifact(rng: Rng, source: keyof typeof ART_WEIGHTS): string {
  const w = ART_WEIGHTS[source];
  const cls = rng.weighted((Object.keys(w) as ArtClass[]).filter((c) => w[c] > 0).map((c) => [c, w[c]] as const));
  const list = ARTIFACT_IDS.filter((id) => ARTIFACTS[id].cls === cls);
  return rng.pick(list.length ? list : ARTIFACT_IDS);
}

/** A few ports keep an artifact merchant. */
export function artMerchantAt(portId: string, size: number): boolean {
  if (size < 2) return false;
  let h = 0xa47;
  for (let i = 0; i < portId.length; i++) h = Math.imul(h ^ portId.charCodeAt(i), 16777619);
  return (h >>> 0) % 3 === 0 || size >= 3;
}

/** A merchant's three pieces on a day (the same for everyone all day). */
export function artWares(portId: string, day: number): string[] {
  let h = Math.imul(day + 7, 2654435761);
  for (let i = 0; i < portId.length; i++) h = Math.imul(h ^ portId.charCodeAt(i), 16777619);
  const rng = new Rng(h >>> 0);
  const out: string[] = [];
  for (let k = 0; k < 12 && out.length < 3; k++) {
    const id = rollArtifact(rng, 'shop');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** The artifacts' names and the sets', English → Russian (the server's lines). */
export function artifactPatterns(): [string, string][] {
  return [...Object.values(ARTIFACTS).map((a) => a.name), ...Object.values(ART_SETS).map((s) => s.name)];
}
