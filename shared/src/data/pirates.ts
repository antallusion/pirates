// Named pirates (docs/12 P5): some seventy captains with a name and a price on the head, the same on every world —
// each with a hull and a level, habits (her waters, the hour, the weather she likes), a trick (the fog ambush, the
// pack, the fireship, the grapple), a temper (the coward runs, the brute never does, the cunning one waits, the
// proud one calls you out), two lieutenants and a lair on an island of her waters. Over the captains of each sea
// stands a baron of the Brethren of the Coast, who shows himself to a hunter only when three of his captains are
// sunk. The Hunters' Guild counts the heads.

import { Rng } from '../rng.ts';
import { REGIONS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import { hullsFor, watersBand } from './shiplevel.ts';
import type { ShipClassId } from './ships.ts';

export type PirateTrick = 'fog' | 'pack' | 'fireship' | 'boarder';
export type PirateTemper = 'coward' | 'brute' | 'cunning' | 'proud';
export type Tr = [string, string];

export interface Lieutenant {
  name: Tr;
  cls: ShipClassId;
  level: number;
}

export interface NamedPirate {
  id: string;
  /** "Morrow the Butcher" / "Морроу Мясник". */
  name: Tr;
  ship: Tr;
  region: RegionId;
  level: number;
  cls: ShipClassId;
  trick: PirateTrick;
  temper: PirateTemper;
  time: 'day' | 'night' | 'any';
  weather: 'fog' | 'storm' | 'any';
  /** A face from the pool, and the tint of the poster it is printed on. */
  portrait: string;
  hue: number;
  lieutenants: Lieutenant[];
  bounty: number;
  baron: boolean;
}

/** The seas the Brethren keep captains in (the Abyss keeps none). */
export const PIRATE_SEAS: RegionId[] = ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown'];
export const PER_SEA = 10;

const FIRST: Tr[] = [
  ['Silas', 'Сайлас'], ['Morgan', 'Морган'], ['Esme', 'Эсме'], ['Tobias', 'Тобиас'], ['Grace', 'Грейс'], ['Jonah', 'Иона'], ['Mercy', 'Мерси'],
  ['Caleb', 'Калеб'], ['Rook', 'Рук'], ['Anne', 'Энн'], ['Bartholomew', 'Варфоломей'], ['Hester', 'Эстер'], ['Ezra', 'Эзра'], ['Nell', 'Нелл'],
  ['Ambrose', 'Амброз'], ['Isolde', 'Изольда'], ['Fenwick', 'Фенвик'], ['Maud', 'Мод'], ['Lucius', 'Луций'], ['Temperance', 'Темперанс'],
];
const LAST: Tr[] = [
  ['Morrow', 'Морроу'], ['Blackwood', 'Блэквуд'], ['Crane', 'Крейн'], ['Vane', 'Вейн'], ['Harrow', 'Харроу'], ['Quill', 'Квилл'], ['Salt', 'Солт'],
  ['Teach', 'Тич'], ['Rackham', 'Рэкем'], ['Bonny', 'Бонни'], ['Kidd', 'Кидд'], ['Low', 'Лоу'], ['Every', 'Эвери'], ['Moody', 'Муди'],
  ['Gallows', 'Галлоуз'], ['Finch', 'Финч'], ['Grimsby', 'Гримсби'], ['Ashby', 'Эшби'], ['Crowe', 'Кроу'], ['Stroud', 'Страуд'],
];
/** Nicknames are nouns: they sit after the surname in Russian without a gender to agree with. */
const NICK: Tr[] = [
  ['the Butcher', 'Мясник'], ['the Shark', 'Акула'], ['the Raven', 'Ворон'], ['the Storm', 'Шторм'], ['the Hook', 'Крюк'], ['the Hangman', 'Висельник'],
  ['the Reaper', 'Жнец'], ['the Serpent', 'Змей'], ['the Plague', 'Чума'], ['the Barrel', 'Бочка'], ['the Knife', 'Нож'], ['the Wolf', 'Волк'],
  ['the Gull', 'Чайка'], ['the Bell', 'Колокол'], ['the Parson', 'Пастор'], ['the Ghost', 'Призрак'], ['the Smile', 'Улыбка'], ['the Fox', 'Лис'],
  ['the Cinder', 'Уголь'], ['the Tide', 'Прилив'], ['the Magpie', 'Сорока'], ['the Anvil', 'Наковальня'], ['the Cutlass', 'Абордажник'], ['the Crab', 'Краб'],
];
const SHIPS: Tr[] = [
  ['Red Widow', 'Красная Вдова'], ['Black Gull', 'Чёрная Чайка'], ['Mourning Bell', 'Погребальный Колокол'], ['Salt Wolf', 'Солёный Волк'], ['Gallows Bride', 'Невеста Виселицы'],
  ['Hungry Moon', 'Голодная Луна'], ['Rotten Oath', 'Гнилая Клятва'], ['Grinning Jack', 'Скалящийся Джек'], ['Last Mercy', 'Последняя Милость'], ['Sea Hag', 'Морская Карга'],
  ['Cinder Queen', 'Угольная Королева'], ['Drowned Saint', 'Утопший Святой'], ['Blood Tithe', 'Кровавая Десятина'], ['Crooked Cross', 'Кривой Крест'], ['Night Heron', 'Ночная Цапля'],
  ['Iron Maiden', 'Железная Дева'], ['Wicked Wren', 'Злая Крапивница'], ['Devil’s Due', 'Долг Дьяволу'], ['Fog Lantern', 'Туманный Фонарь'], ['Split Anchor', 'Расколотый Якорь'],
];
const BARON_NICK: Tr[] = [
  ['the Red Baron', 'Красный барон'], ['the Iron Baron', 'Железный барон'], ['the Salt Baron', 'Соляной барон'], ['the Black Baron', 'Чёрный барон'],
  ['the Frost Baron', 'Ледяной барон'], ['the Grave Baron', 'Могильный барон'], ['the Drowned Baron', 'Утопший барон'],
];
const FACES = ['corsair', 'reaver', 'giver_smuggler_m', 'giver_smuggler_f', 'giver_fence_m', 'giver_fence_f', 'officer_iron_jaw', 'giver_bosun_m', 'giver_cultist_m', 'giver_hermit_m'];
const TRICKS: PirateTrick[] = ['fog', 'pack', 'fireship', 'boarder'];
const TEMPERS: PirateTemper[] = ['coward', 'brute', 'cunning', 'proud'];

/** A head's price: grows with her level (and a baron's is a fortune). */
export function bountyFor(level: number, baron: boolean): number {
  return Math.round((300 + 90 * Math.pow(level, 1.6)) * (baron ? 4 : 1) / 10) * 10;
}

let roster: NamedPirate[] | null = null;

/** Every named pirate, the same on every world. */
export function namedPirates(): NamedPirate[] {
  if (roster) return roster;
  const rng = new Rng(0x9a7e5eed);
  const out: NamedPirate[] = [];
  const used = new Set<string>();
  PIRATE_SEAS.forEach((region, ri) => {
    const [lo, hi] = watersBand(REGIONS[region].safety);
    for (let i = 0; i <= PER_SEA; i++) {
      const baron = i === PER_SEA;
      let last = rng.pick(LAST), nick = baron ? BARON_NICK[ri] : rng.pick(NICK);
      for (let k = 0; k < 30 && used.has(`${last[0]} ${nick[0]}`); k++) {
        last = rng.pick(LAST);
        nick = rng.pick(NICK);
      }
      used.add(`${last[0]} ${nick[0]}`);
      const level = baron ? Math.min(10, hi + 1) : Math.max(1, Math.min(10, lo + Math.floor((i / PER_SEA) * (hi - lo + 1))));
      const cls = rng.pick(hullsFor('pirate', level));
      const lts: Lieutenant[] = [];
      for (let l = 0; l < (baron ? 3 : 2); l++) {
        const lv = Math.max(1, level - 1);
        const ln = rng.pick(FIRST), lk = rng.pick(NICK);
        lts.push({ name: [`${ln[0]} ${lk[0]}`, `${ln[1]} ${lk[1]}`], cls: rng.pick(hullsFor('pirate', lv)), level: lv });
      }
      out.push({
        id: baron ? `baron_${region}` : `np_${ri}_${i}`,
        name: [`${last[0]} ${nick[0]}`, `${last[1]} ${nick[1]}`],
        ship: rng.pick(SHIPS),
        region, level, cls,
        trick: rng.pick(TRICKS), temper: baron ? 'proud' : rng.pick(TEMPERS),
        time: rng.chance(0.35) ? 'night' : rng.chance(0.2) ? 'day' : 'any',
        weather: rng.chance(0.2) ? 'fog' : rng.chance(0.15) ? 'storm' : 'any',
        portrait: rng.pick(FACES), hue: rng.int(0, 359),
        lieutenants: lts, bounty: bountyFor(level, baron), baron,
      });
    }
  });
  roster = out;
  return out;
}

export function pirateById(id: string): NamedPirate | undefined {
  return namedPirates().find((p) => p.id === id);
}

export function baronOf(region: RegionId): NamedPirate | undefined {
  return namedPirates().find((p) => p.baron && p.region === region);
}

// ------------------------------------------------------------------------------------------------ the Hunters' Guild

/** Points for the rank (index = rank; rank 1 from the first point). */
export const HUNTER_RANKS = [0, 1, 20, 50, 100, 170, 260, 380, 530, 720, 960];
export const HUNTER_POINTS = { captain: 10, lieutenant: 3, baron: 40, pirate: 1 } as const;

export function hunterRank(points: number): number {
  let r = 0;
  for (let i = 1; i < HUNTER_RANKS.length; i++) if (points >= HUNTER_RANKS[i]) r = i;
  return r;
}

/** Rank 3: wanted pirates show on the chart within 5 km; 5: +15% bounty; 7: the hunter's pennant and the guild's
 *  wares; 10: the title. */
export const HUNTER_SIGHT_RANK = 3;
export const HUNTER_SIGHT_R = 5000;
export const HUNTER_BONUS_RANK = 5;
export const HUNTER_BONUS = 0.15;
export const HUNTER_PENNANT_RANK = 7;
export const HUNTER_PENNANT = '#c8502c';
export const HUNTER_TITLE_RANK = 10;
export const HUNTER_TITLE = 'Scourge of the Brethren';
/** Three captains of a sea sunk: its baron shows himself. */
export const BARON_AFTER = 3;
/** Ten named captains sunk: Captain Killer. */
export const CAPTAIN_KILLER = 10;
/** A tavern informant's price and how long his word holds. */
export function informantCost(level: number): number {
  return 150 + level * 45;
}
export const INFORMANT_SEC = 60;
/** A sunk captain comes back under a new flag after 12–24 hours. */
export const RESPAWN_H: [number, number] = [12, 24];

// ------------------------------------------------------------------------------------------------ Russian

export function piratePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const p of namedPirates()) {
    out.push(p.name, p.ship);
    for (const l of p.lieutenants) out.push(l.name);
  }
  out.push(
    [HUNTER_TITLE, 'Гроза Берегового братства'],
    ['WORLD: {0} sank the pirate {1} — {2} silver on the head.', 'Вести: {0} топит пирата «{1}» — за голову {2} серебра.'],
    ['WORLD: {0} sank {1}, baron of the Brethren in {2}!', 'Вести: {0} топит барона Братства «{1}» в водах «{2}»!'],
    ['The bounty on {0}: {1} silver.', 'Награда за голову «{0}»: {1} серебра.'],
    ['{0} hoists the black and calls you out!', '«{0}» поднимает чёрный флаг и вызывает вас на бой!'],
    ['{0} loses her nerve and runs!', '«{0}» теряет кураж и бежит!'],
    ['{0} lies in the fog and waits.', '«{0}» затаилась в тумане и ждёт.'],
    ['The informant takes {0} silver: {1} is there — for a minute.', 'Осведомитель берёт {0} серебра: «{1}» там — на минуту.'],
    ['Nobody here has seen that one of late.', 'Здесь этого давно никто не видел.'],
    ['Only a tavern knows where the wanted are.', 'Где разыскиваемые — знают только в таверне.'],
    ['Three of his captains are sunk: {0}, baron of the Brethren in {1}, will come for you himself.', 'Трое его капитанов потоплены: «{0}», барон Братства в водах «{1}», придёт за вами сам.'],
    ['Hunters’ Guild: rank {0}.', 'Гильдия охотников: звание {0}.'],
    ['The Hunters’ Guild gives you its pennant.', 'Гильдия охотников вручает вам свой вымпел.'],
    ['The Hunters’ Guild names you Scourge of the Brethren!', 'Гильдия охотников называет вас Грозой Берегового братства!'],
    ['The lair’s battery on {0} opens fire!', 'Батарея логова на острове {0} открывает огонь!'],
    ['The lair’s battery on {0} is silenced. Land now — the lair is open.', 'Батарея логова на острове {0} замолчала. Высаживайтесь — логово открыто.'],
    ['The lair’s battery drives your boats off!', 'Батарея логова отгоняет ваши шлюпки!'],
    ['The lair of {0} is stormed: {1} silver from its chest, {2} prisoners freed.', 'Логово «{0}» взято штурмом: {1} серебра из сундука, освобождено пленников: {2}.'],
    ['The freed prisoners join your crew.', 'Освобождённые пленники идут к вам в команду.'],
    ['Sank {0}', 'Потоплен: {0}'],
    ['{0} sank {1}', '{0}: потоплен {1}'],
    ['Wanted: {0}', 'Разыскивается: {0}'],
    ['{0} took the {1} {2} near {3}.', '«{0}» взяла {1} «{2}» у острова {3}.'],
  );
  return out;
}
