// The beasts of the sea (docs/12 P4): orcas hunting in packs, the White Orca, whales in their migrations, the sperm
// whale that rams the boat that harpooned it, narwhals, sharks round the blood and a young serpent. A hunt has five
// parts: find it (a spout, a fin), come up on it quietly (noise over 60% of her speed spooks the shy ones), harpoon
// it (a line with a winch, not a twenty-second tether), play it on the line with the sails until it is spent, finish
// it and flense it alongside — with the blood in the water bringing the sharks and the orcas.
//
// A beast is a ship entity of a monster class with a level ⚓ like any ship's (canon D12): the ladder rules the
// fight between a captain and a beast as between her and any ship of the sea.

import type { GoodId } from './goods.ts';
import type { ShipClassId } from './ships.ts';
import type { RegionId } from '../world/regions.ts';

export type BeastId = 'orca' | 'white_orca' | 'humpback' | 'sperm_whale' | 'narwhal' | 'shark' | 'young_serpent';
export const BEAST_IDS: BeastId[] = ['orca', 'white_orca', 'humpback', 'sperm_whale', 'narwhal', 'shark', 'young_serpent'];

/** How a beast behaves: a pack hunter, a shy whale that flees, a whale that rams when struck, a tusk, blood-drawn, coils. */
export type BeastTemper = 'pack' | 'shy' | 'ram' | 'tusk' | 'blood' | 'coil';

/** The group a quest or an order counts: the whales, the orcas, the sharks, anything. */
export type BeastGroup = 'whale' | 'orca' | 'shark' | 'any';

export interface BeastDef {
  id: BeastId;
  cls: ShipClassId;
  name: [string, string];
  /** English and Russian: a pack of them. */
  many: [string, string];
  group: BeastGroup;
  temper: BeastTemper;
  /** Hunts a captain unprovoked. */
  predator: boolean;
  regions: RegionId[];
  level: [number, number];
  pack: [number, number];
  /** Its blow at the class's first level: hull, and how often (s). */
  bite: number;
  every: number;
  /** Staying power on the line (seconds at a fair tension), and how hard it pulls (0..1). */
  stamina: number;
  pull: number;
  /** A shy beast flees a ship this loud within this range (m); 0: it does not spook. */
  spookRange: number;
  /** What flensing it gives at its first level (a range each), and how long it takes alongside. */
  yields: Partial<Record<GoodId, [number, number]>>;
  rare?: { good: GoodId; chance: number };
  flense: number;
  /** Experience for taking it at its first level. */
  xp: number;
  /** How often it rises about its waters, against the others. */
  weight: number;
}

const COLD: RegionId[] = ['leviathan_reach', 'gravewater'];
const WARM: RegionId[] = ['black_coast', 'gravewater', 'whispering', 'ashen_isles'];
const OPEN: RegionId[] = ['dead_mans_expanse', 'gravewater', 'drowned_crown', 'leviathan_reach'];

export const BEASTS: Record<BeastId, BeastDef> = {
  orca: {
    id: 'orca', cls: 'orca', name: ['Orca', 'Касатка'], many: ['a pod of orcas', 'стая касаток'], group: 'orca', temper: 'pack', predator: true,
    regions: COLD, level: [3, 8], pack: [3, 6], bite: 33, every: 6, stamina: 40, pull: 0.55, spookRange: 0,
    yields: { whale_oil: [3, 5], orca_tooth: [1, 3], whalebone: [1, 2] }, flense: 30, xp: 70, weight: 6,
  },
  white_orca: {
    id: 'white_orca', cls: 'white_orca', name: ['The White Orca', 'Белая касатка'], many: ['the White Orca and her pod', 'Белая касатка со стаей'], group: 'orca', temper: 'pack', predator: true,
    regions: ['leviathan_reach'], level: [8, 8], pack: [4, 5], bite: 520, every: 20, stamina: 120, pull: 0.9, spookRange: 0,
    yields: { whale_oil: [8, 10], orca_tooth: [6, 8], whalebone: [4, 5] }, flense: 40, xp: 900, weight: 0,
  },
  humpback: {
    id: 'humpback', cls: 'humpback', name: ['Humpback Whale', 'Горбатый кит'], many: ['humpbacks', 'горбатые киты'], group: 'whale', temper: 'shy', predator: false,
    regions: WARM, level: [4, 6], pack: [1, 2], bite: 60, every: 10, stamina: 70, pull: 0.7, spookRange: 700,
    yields: { whale_oil: [4, 5], baleen: [2, 3] }, flense: 45, xp: 140, weight: 5,
  },
  sperm_whale: {
    id: 'sperm_whale', cls: 'sperm_whale', name: ['Sperm Whale', 'Кашалот'], many: ['sperm whales', 'кашалоты'], group: 'whale', temper: 'ram', predator: false,
    regions: OPEN, level: [6, 9], pack: [1, 1], bite: 220, every: 15, stamina: 100, pull: 0.95, spookRange: 600,
    yields: { whale_oil: [10, 14], whalebone: [3, 5], orca_tooth: [1, 2] }, rare: { good: 'ambergris', chance: 0.08 }, flense: 60, xp: 260, weight: 3,
  },
  narwhal: {
    id: 'narwhal', cls: 'narwhal', name: ['Narwhal', 'Нарвал'], many: ['narwhals', 'нарвалы'], group: 'whale', temper: 'tusk', predator: false,
    regions: ['leviathan_reach'], level: [5, 7], pack: [2, 4], bite: 40, every: 6, stamina: 30, pull: 0.4, spookRange: 500,
    yields: { narwhal_tusk: [1, 1], whale_oil: [1, 2] }, flense: 20, xp: 110, weight: 3,
  },
  shark: {
    id: 'shark', cls: 'shark', name: ['Shark', 'Акула'], many: ['sharks', 'акулы'], group: 'shark', temper: 'blood', predator: true,
    regions: [...WARM, 'dead_mans_expanse', 'drowned_crown'], level: [1, 6], pack: [1, 3], bite: 12, every: 3, stamina: 15, pull: 0.3, spookRange: 0,
    yields: { shark_skin: [1, 2], orca_tooth: [0, 1] }, flense: 20, xp: 31, weight: 5,
  },
  young_serpent: {
    id: 'young_serpent', cls: 'young_serpent', name: ['Young Sea Serpent', 'Морской змей-подросток'], many: ['a young serpent', 'молодой змей'], group: 'any', temper: 'coil', predator: true,
    regions: ['whispering', 'the_abyss'], level: [7, 9], pack: [1, 1], bite: 160, every: 2, stamina: 80, pull: 0.85, spookRange: 0,
    yields: { serpent_scale: [2, 4] }, flense: 40, xp: 420, weight: 1,
  },
};

export const BEAST_OF_CLASS: Partial<Record<ShipClassId, BeastId>> = Object.fromEntries(BEAST_IDS.map((b) => [BEASTS[b].cls, b]));

export function beastOfClass(classId: ShipClassId): BeastId | undefined {
  return BEAST_OF_CLASS[classId];
}

/** Whether a beast counts toward a group (a quest's, an order's). */
export function inGroup(id: BeastId, group: BeastGroup): boolean {
  return group === 'any' || BEASTS[id].group === group;
}

/** The waters the Choir holds sacred: whaling there is an offence to it. */
export const SACRED_WATERS: RegionId[] = ['drowned_crown', 'the_abyss'];

/** A level above the beast's first: more in the carcass, a tenth a level. */
export function yieldScale(id: BeastId, level: number): number {
  return 1 + 0.1 * Math.max(0, level - BEASTS[id].level[0]);
}

/** Its blow at a level: as a ship's guns, +14% a level. */
export function biteAt(id: BeastId, level: number): number {
  return BEASTS[id].bite * Math.pow(1.14, Math.max(0, level - BEASTS[id].level[0]));
}

// ------------------------------------------------------------------------------------------------ the approach

/** A ship's noise (0..1): her way through the water against her best, and a loud half-minute after her guns. */
export function hullNoise(speed: number, maxSpeed: number, firedAgo: number): number {
  const way = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));
  const guns = firedAgo < 30 ? 0.5 * (1 - firedAgo / 30) : 0;
  return Math.min(1, way + guns);
}

/** Above this a shy beast takes fright. */
export const SPOOK_NOISE = 0.6;

export function noiseBand(n: number): 'quiet' | 'heard' | 'loud' {
  return n < 0.4 ? 'quiet' : n < SPOOK_NOISE ? 'heard' : 'loud';
}

// ------------------------------------------------------------------------------------------------ the line

/**
 * The line: tension 0..120. Above SNAP for SNAP_HOLD seconds it parts and the beast is gone with the iron in it;
 * below SLACK for SLACK_HOLD seconds the iron works loose. Between, the beast tires — faster the harder it is held.
 */
export const LINE = { SNAP: 100, SNAP_HOLD: 1.5, SLACK: 15, SLACK_HOLD: 8, GOOD_LO: 40, GOOD_HI: 90, PAY_OUT: 30, PAY_OUT_COOLDOWN: 6, MAX_LEN: 420 } as const;

/**
 * One step of the line: the beast's pull (with its surges), the ship's own pull by her sails — away from the beast
 * she hauls against it, toward it she gives it line. Returns the new tension and how much stamina it cost the beast.
 */
export function lineStep(tension: number, pull: number, surge: boolean, sail: number, away: number, spent: boolean, dt: number): { tension: number; drain: number } {
  // The beast: its own pull, doubled in a surge; a spent beast barely pulls.
  const beast = (spent ? 0.15 : 1) * pull * (surge ? 2.1 : 1) * 60;
  // The ship: her sails pulling away from it (away = cos of the angle between her heading and the line to it, −1..1).
  const ship = sail * away * 40;
  const target = Math.max(0, Math.min(120, beast + ship));
  const next = tension + (target - tension) * Math.min(1, dt * 1.6);
  // It tires in proportion to the tension, most in the fair band, little when slack.
  const drain = next < LINE.SLACK ? 0.1 * dt : (next / 60) * dt;
  return { tension: next, drain };
}

// ------------------------------------------------------------------------------------------------ Russian

export function beastPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const id of BEAST_IDS) out.push(BEASTS[id].name);
  out.push(
    ['The harpoon bites! {0} is on the line — work her with the sails.', 'Гарпун вошёл! {0} на лине — работайте парусами.'],
    ['The line parts! {0} is away with your iron in her.', 'Линь лопнул! {0} уходит с вашим железом в боку.'],
    ['The iron works loose and {0} is free.', 'Гарпун выскочил, и {0} на свободе.'],
    ['{0} is spent and lies still. Finish her.', '{0}: зверь выбился из сил и лежит на воде. Добейте его.'],
    ['You pay out the line.', 'Вы травите линь.'],
    ['You cut the line.', 'Вы обрубаете линь.'],
    ['The winch is not ready.', 'Лебёдка ещё не готова.'],
    ['No line out.', 'Линь не заведён.'],
    ['Another line is in it already', 'В нём уже чужой линь'],
    ['It is under the water', 'Он под водой'],
    ['No ship', 'Нет корабля'],
    ['Nothing there to strike', 'Там некого бить'],
    ['{0} takes fright and sounds!', '{0} пугается и уходит на глубину!'],
    ['{0} is dead. Heave to alongside to flense her.', '{0}: зверь мёртв. Ложитесь в дрейф у туши, чтобы разделать её.'],
    ['Flensing {0}: the blood is in the water.', 'Разделка: {0}. Кровь в воде.'],
    ['Flensing stopped: stay alongside and hove to.', 'Разделка прервана: оставайтесь у туши и в дрейфе.'],
    ['Flensed: {0}.', 'Разделано: {0}.'],
    ['Ambergris! A lump of it in the belly — worth a fortune.', 'Амбра! Целый ком в брюхе — это состояние.'],
    ['Nothing to flense here.', 'Разделывать здесь нечего.'],
    ['Heave to alongside the carcass first.', 'Сначала лягте в дрейф у туши.'],
    ['Someone is already flensing it.', 'Тушу уже кто-то разделывает.'],
    ['The sharks smell the blood.', 'Акулы чуют кровь.'],
    ['Orcas come for the blood!', 'На кровь идут касатки!'],
    ['The orcas lose heart and scatter.', 'Касатки теряют кураж и уходят.'],
    ['The orcas go for your rudder!', 'Касатки бьют в руль!'],
    ['A narwhal’s tusk goes through the planking: a leak!', 'Бивень нарвала пробивает обшивку: течь!'],
    ['The sperm whale turns on you and rams!', 'Кашалот разворачивается и таранит!'],
    ['The serpent’s coils close round your hull!', 'Кольца змея смыкаются вокруг корпуса!'],
    ['The coils loosen.', 'Кольца разжимаются.'],
    ['The White Orca dives under your keel!', 'Белая касатка ныряет под киль!'],
    ['The White Orca calls her pod!', 'Белая касатка зовёт стаю!'],
    ['WORLD: {0} took the White Orca!', 'Вести: {0} добывает Белую касатку!'],
    ['The White Orca’s figurehead is yours.', 'Носовая фигура «Белая касатка» — ваша.'],
    ['You drove the orcas off the whale. The Choir hears of it.', 'Вы отогнали касаток от кита. Хор узнаёт об этом.'],
    ['The Choir will not forgive whaling in its waters.', 'Хор не простит китобойного промысла в своих водах.'],
    ['The Order of the Harpoon marks your catch.', 'Орден Гарпуна записывает вашу добычу.'],
    ['Took {0}', 'Добыча: {0}'],
    ['{0} took {1}', '{0}: добыча — {1}'],
    ['The Orca Migration', 'Миграция касаток'],
    ['The orcas are running south through {0}: pods everywhere, hungry, and something white among them.', 'Касатки идут на юг через воды «{0}»: стаи повсюду, голодные, и среди них — что-то белое.'],
    ['The orcas have passed through {0}.', 'Касатки прошли воды «{0}».'],
    ['The White Orca', 'Белая касатка'],
    ['Whalers have seen the White Orca in {0}. She has sunk three boats this season.', 'Китобои видели Белую касатку в водах «{0}». За сезон она потопила три шлюпки.'],
    ['The White Orca is gone from {0}, for now.', 'Белая касатка ушла из вод «{0}» — пока.'],
    ['The White Orca is slain in {0}!', 'Белая касатка убита в водах «{0}»!'],
  );
  return out;
}
