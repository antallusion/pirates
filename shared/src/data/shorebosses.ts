// The great ones that come ashore (owner, 2026-10-03: «еще больше всяких там боссов»; docs/02 §11.A.4, «Боссы на
// суше»): four bosses of the hex battle on the land, beside the six new ones at sea. Where the sea's are fought by a
// whole fleet at once, these are a captain's own trial: a great one comes ashore on an island of its kind and level for
// a few hours, the taverns of the sea hear of it, and every captain who lands against it fights it with her own landing
// party on the battle ashore (docs/17 H1, docs/18 II) — one at a time, each her own fight, the spoils hers once a rising
// and the rarer ones once a week. Each has its retinue of the land's creatures, two phases, signature moves played
// between the battle's turns (server/src/game/shorebosses.ts) and a counterplay a captain learns:
//
//   the Mire Mother (swamps):      her tongue drags in your farthest stack — one beside a rock or a palm holds fast;
//                                  her brood hatches every few rounds — kill it or burst her down;
//   the Cinder Salamander (fire):  she marks the ground she will breathe on next round — step off it; wounded, her hide
//                                  burns whoever strikes her — then shoot her instead;
//   the Abbess (the dead isles):   her bell-ringers' prayer shields her — kill them first; her toll stills the living
//                                  within two hexes of her (marked the round before) and raises her drowned;
//   the Walrus Tyrant (the rocks): he lowers his tusks at one of your stacks and charges it next round — box it in with
//                                  your own stacks and the rocks (he breaks on them) or let it brace (Defend).
//
// Everything here is a function of the definitions and the level alone: the battle's numbers, the pay, the names.

import { advHour, advLevelXp, guardBaseMight } from './advmap.ts';
import { armyPower } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import { LAND_RES_DEF } from './bestiary.ts';
import type { BeastId, LandRes } from './bestiary.ts';
import { BOSS_UNIT_IDS } from './bossunits.ts';
import type { BossUnitId } from './bossunits.ts';
import type { Tr } from './estate.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { lairRefill } from './lairs.ts';
import { ISLE_TYPE_DEFS } from '../world/archipelago.ts';
import type { IsleType } from '../world/archipelago.ts';
import type { RegionId } from '../world/regions.ts';

export type ShoreBossId = BossUnitId;
export const SHORE_BOSS_IDS: ShoreBossId[] = BOSS_UNIT_IDS;
export const isShoreBoss = (k: unknown): k is ShoreBossId => typeof k === 'string' && (SHORE_BOSS_IDS as string[]).includes(k);

/** A move of a great one: its name on the field and in the battle's line. */
export type ShoreMove = 'aim' | 'tongue' | 'hold' | 'brood' | 'bloat' | 'mark' | 'breath' | 'hide' | 'ward' | 'toll' | 'choir' | 'charge' | 'broke' | 'rut';

export interface ShoreBossDef {
  id: ShoreBossId;
  name: Tr;
  /** Its legend, one line (the taverns' and the bestiary's). */
  legend: Tr;
  /** What a captain learns of it: said as she lands, and over the battle. */
  hint: Tr;
  /** The kinds of island it comes ashore on, its seas, and the levels of island. */
  types: IsleType[];
  regions: RegionId[];
  lv: [number, number];
  /** Seconds of the wall clock between its risings, the window it waits for, and how long it stands ashore. */
  every: number;
  window: 'any' | 'night';
  lifetime: number;
  /** Its retinue: the land's creatures beside it, each kind's share of their might. */
  retinue: [BeastId, number][];
  /** The great one's build: its kind's hit points and blows each by these (a boss outlasts a stack of its tier and hits
   *  no harder for it, so the fight runs long enough for its moves to matter), before the level's calibration
   *  (SHORE_CAL). Its retinue's might: a multiple of the sea's guards' at the level. */
  shape: [number, number];
  might: number;
  /** The share of its strength at which the second phase opens. */
  turn: number;
  phases: [Tr, Tr];
  trophy: Tr;
  /** The land's resources it leaves (its own weights; the pay's resource share is laid out by them). */
  res: Partial<Record<LandRes | 'pearls', number>>;
}

const H = 3600;

export const SHORE_BOSSES: Record<ShoreBossId, ShoreBossDef> = {
  mire_mother: {
    id: 'mire_mother', name: ['Mire Mother', 'Мать Трясины'],
    legend: ['A toad-queen the size of a longboat who comes up out of the black water to spawn, her back heaped with her brood.', 'Жаба-королева величиной со шлюпку: выходит из чёрной воды метать икру, и спина её вся в выводке.'],
    hint: ['Her tongue drags your farthest stack beside her: one standing by a rock or a palm holds fast. Her brood hatches every few rounds — kill it, or burst her down.', 'Её язык подтаскивает ваш самый дальний отряд вплотную к ней: отряд у скалы или пальмы держится. Выводок вылупляется раз в несколько раундов — бейте его или добейте её.'],
    types: ['swamp'], regions: ['whispering', 'gravewater', 'black_coast', 'drowned_crown'], lv: [5, 9],
    every: 10 * H, window: 'any', lifetime: 3 * H,
    retinue: [['giant_toad', 0.55], ['crocodile', 0.45]], shape: [3, 0.7], might: 0.55, turn: 0.5,
    phases: [['The Spawning', 'Нерест'], ['The Bloat', 'Вздутие']],
    trophy: ['Spawn-Pearl of the Mire Mother', 'Икряная жемчужина Матери Трясины'],
    res: { venom: 2, pearls: 0.6 },
  },
  cinder_salamander: {
    id: 'cinder_salamander', name: ['Cinder Salamander', 'Пепельная саламандра'],
    legend: ['A salamander as long as a pinnace that sleeps in the cooling lava and wakes when the mountain does.', 'Саламандра длиной с пинас: спит в остывающей лаве и просыпается, когда просыпается гора.'],
    hint: ['She marks the ground she will breathe on as the next round opens — step off it. Wounded, her hide burns whoever strikes her: shoot her then.', 'Она отмечает землю, на которую дохнёт в начале следующего раунда, — уйдите с неё. Раненая, её шкура обжигает бьющих вплотную: тогда стреляйте.'],
    types: ['volcanic'], regions: ['ashen_isles', 'leviathan_reach', 'the_abyss'], lv: [6, 10],
    every: 12 * H, window: 'any', lifetime: 3 * H,
    retinue: [['monitor', 0.6], ['cave_bat', 0.4]], shape: [3, 0.7], might: 0.55, turn: 0.5,
    phases: [['The Waking Fire', 'Пробуждение огня'], ['The Molten Hide', 'Расплавленная шкура']],
    trophy: ['Ember Heart of the Salamander', 'Тлеющее сердце саламандры'],
    res: { bone: 1.5, venom: 1 },
  },
  drowned_abbess: {
    id: 'drowned_abbess', name: ['Abbess of the Drowned Bell', 'Аббатиса Утонувшего Колокола'],
    legend: ['The abbess of an abbey the sea took whole; on still nights she walks up the beach with its bell, and her drowned sisters follow.', 'Аббатиса аббатства, которое море забрало целиком; в тихие ночи она выходит на берег с его колоколом, и утонувшие сёстры идут следом.'],
    hint: ['Her bell-ringers’ prayer shields her: kill the cultists first. Her toll stills the living within two hexes of her — marked the round before — and raises her drowned.', 'Молитва звонарей хранит её: сначала убейте культистов. Её звон сковывает живых в двух гексах от неё — их отмечают раундом раньше — и поднимает её утопленников.'],
    types: ['dead', 'graveyard'], regions: ['drowned_crown', 'the_abyss', 'dead_mans_expanse'], lv: [7, 10],
    every: 14 * H, window: 'night', lifetime: 3 * H,
    retinue: [['cultist', 0.35], ['surf_drowned', 0.65]], shape: [4, 0.6], might: 0.5, turn: 0.4,
    phases: [['The Vigil', 'Бдение'], ['The Drowned Choir', 'Хор утопленниц']],
    trophy: ['Tongue of the Drowned Bell', 'Язык Утонувшего Колокола'],
    res: { pearls: 1.5, bone: 1 },
  },
  walrus_tyrant: {
    id: 'walrus_tyrant', name: ['Walrus Tyrant', 'Морж-тиран'],
    legend: ['An old walrus bull who has held the rookeries of the cold rocks for longer than the whalers have counted, and broken their boats when they came.', 'Старый морж-самец, что держит лежбища холодных скал дольше, чем помнят китобои, и разбивает их лодки, когда те приходят.'],
    hint: ['He lowers his tusks at one of your stacks and charges it as the next round opens: box it in with your own stacks and the rocks — he breaks on them — or let it brace (Defend).', 'Он наводит бивни на один из ваших отрядов и бросается на него в начале следующего раунда: зажмите его своими отрядами и скалами — он о них разобьётся — или пусть отряд встанет в оборону.'],
    types: ['rocky'], regions: ['leviathan_reach', 'black_coast', 'whispering', 'gravewater'], lv: [5, 9],
    every: 10 * H, window: 'any', lifetime: 3 * H,
    retinue: [['seal', 0.7], ['albatross', 0.3]], shape: [3, 0.6], might: 0.6, turn: 0.5,
    phases: [['The Rookery', 'Лежбище'], ['The Rut', 'Гон']],
    trophy: ['Tusk of the Walrus Tyrant', 'Бивень моржа-тирана'],
    res: { bone: 2.5, shell: 0.4 },
  },
};

/** The names of the moves on the field (the battle's big line and its log). */
export const SHORE_MOVES: Record<ShoreMove, Tr> = {
  aim: ['Its Eye Is on You', 'Взгляд на вас'],
  tongue: ['The Tongue', 'Язык'],
  hold: ['Holds Fast', 'Устоял'],
  brood: ['The Brood Hatches', 'Выводок вылупился'],
  bloat: ['The Bloat', 'Вздутие'],
  mark: ['Marked Ground', 'Намеченная земля'],
  breath: ['Lava Breath', 'Лавовое дыхание'],
  hide: ['Molten Hide', 'Расплавленная шкура'],
  ward: ['The Prayer Is Broken', 'Молитва прервана'],
  toll: ['The Toll', 'Звон'],
  choir: ['The Drowned Choir', 'Хор утопленниц'],
  charge: ['The Charge', 'Бросок'],
  broke: ['Broken on the Wall', 'Разбился о стену'],
  rut: ['The Rut', 'Гон'],
};

/** The great one's multiple at each island level (index ⚓1–10; 0 where it never stands), on its hit points and its
 *  blows alike: what costs the reference captain of that level (tests/balance/lairs.ts's party, played by the sea's
 *  mind, who knows none of the counterplay) about SHORE_LOSS of the men she lands, a lost fight counting as all of them
 *  — rebuilt by bisection on the battle itself (calibrateShore, tests/balance/shore.ts; tests/bosses10.test.ts holds it). */
export const SHORE_CAL: Record<ShoreBossId, number[]> = {
  mire_mother: [0, 0, 0, 0, 0, 0.41, 0.53, 0.96, 1.25, 1.82, 0],
  cinder_salamander: [0, 0, 0, 0, 0, 0, 0.56, 1.01, 1.38, 1.85, 3.19],
  drowned_abbess: [0, 0, 0, 0, 0, 0, 0, 1.74, 2.6, 3.9, 6.17],
  walrus_tyrant: [0, 0, 0, 0, 0, 0.31, 0.45, 0.66, 1.25, 1.77, 0],
};
/** The share of her landed men a great one costs the reference captain of its level, on average. */
export const SHORE_LOSS = 0.55;

/** How the great one itself stands at an island's level: its kind's hit points and blows by its build and the level's
 *  calibration. */
export function shoreScale(id: ShoreBossId, level: number): { hp: number; dmg: number } {
  const def = SHORE_BOSSES[id];
  const L = Math.max(def.lv[0], Math.min(def.lv[1], level));
  const k = SHORE_CAL[id][L] || 1;
  return { hp: def.shape[0] * k, dmg: def.shape[1] * k };
}

/** The great one and its retinue as they stand at a level (no dice: the same every time). The great one is one, first. */
export function shoreArmy(id: ShoreBossId, level: number): ArmyStack[] {
  const def = SHORE_BOSSES[id];
  const L = Math.max(def.lv[0], Math.min(def.lv[1], level));
  const might = guardBaseMight(L) * def.might;
  const out: ArmyStack[] = [{ u: id, n: 1 }];
  for (const [u, share] of def.retinue) out.push({ u, n: Math.max(1, Math.round((might * share) / armyPower([{ u, n: 1 }]))) });
  return out;
}

/** A brood, a summoned choir: so many of a kind as a share of the retinue's might at the level. */
export function shoreSummon(id: ShoreBossId, u: UnitId, level: number, share: number): number {
  const def = SHORE_BOSSES[id];
  const L = Math.max(def.lv[0], Math.min(def.lv[1], level));
  return Math.max(1, Math.round((guardBaseMight(L) * def.might * share) / armyPower([{ u, n: 1 }])));
}

export interface ShorePay {
  silver: number;
  xp: number;
  good: GoodId;
  goods: number;
  res: Partial<Record<LandRes | 'pearls', number>>;
}

/** What a great one beaten leaves a captain (once a rising): the men a strong lair costs her at the level and an hour
 *  and a quarter at sea over them; a quarter of a level of experience; the island's H3 resource, the land's resources
 *  by its own weights, the rest silver. Its trophy and, once a week, an artifact come besides (the server). */
export function shorePay(id: ShoreBossId, level: number, type: IsleType): ShorePay {
  const L = Math.max(1, Math.min(10, level));
  const worth = lairRefill(L, 'strong') + 1.25 * advHour(L);
  const good = ISLE_TYPE_DEFS[type].supply;
  const goods = Math.max(1, Math.round((worth * 0.15) / GOODS[good].basePrice));
  const w = SHORE_BOSSES[id].res;
  const val = (r: LandRes | 'pearls') => (r === 'pearls' ? GOODS.pearls.basePrice : LAND_RES_DEF[r].value);
  const tot = Object.entries(w).reduce((a, [r, x]) => a + (x ?? 0) * val(r as LandRes | 'pearls'), 0) || 1;
  const res: Partial<Record<LandRes | 'pearls', number>> = {};
  let resWorth = 0;
  for (const [r, x] of Object.entries(w) as [LandRes | 'pearls', number][]) {
    const n = Math.max(1, Math.round((worth * 0.25 * x) / tot));
    res[r] = n;
    resWorth += n * val(r);
  }
  const silver = Math.max(50, Math.round((worth - goods * GOODS[good].basePrice - resWorth) / 50) * 50);
  return { silver, xp: Math.round((advLevelXp(L) * 0.25) / 10) * 10, good, goods, res };
}
