// The lairs of the land's creatures (docs/18 II, items 13 and 17–24): where they stand — on the islands, by the
// island's kind and level, one shore lair on many wild islands, and on the great islands of the deeper waters a chain
// of three (a shore lair, a grotto, the island's guardian, and the island's chest for the whole of it); the turtle
// islands and the sandbars of the low tide keep lairs of their own while they are up — what each lair's creatures are,
// how many (calibrated by the land battle itself, as GUARD_CAL calibrates the guards: a captain of the lair's level
// loses 12 / 30 / 60% of the men she lands against a weak / average / strong lair), and what a lair leaves: experience,
// silver, the H3 resource of its island, the land's resources (shell, bone, venom, pearls), now and then an artifact
// or an egg — a quarter of an hour at sea or so over the men it costs. Everything here is a function of the world and
// the island alone (each island its own Rng), the same for the server, the client's tests and the balance tools.

import { DAY_LENGTH_SEC } from '../constants.ts';
import { advHour, advLevelXp, GUARD_LOSS, GUARD_SIZE, GUARD_SIZES, guardBaseMight } from './advmap.ts';
import type { GuardSize } from './advmap.ts';
import { UNITS, armyPower } from './army.ts';
import type { ArmyStack } from './army.ts';
import { BEAST_RES, LAND_RES_DEF } from './bestiary.ts';
import type { BeastId, LandRes } from './bestiary.ts';
import type { Tr } from './estate.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { GROWTH } from './town.ts';
import { pointInPolygon } from '../math.ts';
import { Rng, hashString } from '../rng.ts';
import { ISLE_TYPE_DEFS, isleLevel, isleLoot, isleType } from '../world/archipelago.ts';
import type { IsleType } from '../world/archipelago.ts';
import { turtles } from '../world/drift.ts';
import { SANDBAR_COUNT, TIDAL_COUNT, tidalIsles } from '../world/tidal.ts';
import type { Island, World } from '../world/worldgen.ts';

export type LairSize = GuardSize;
export const LAIR_SIZES = GUARD_SIZES;

export type LairKind =
  | 'crab_beach' | 'gull_cliffs' | 'seal_rookery' | 'shark_shallows' | 'turtle_rocks' | 'serpent_marsh' | 'hermit_camp' | 'tentacle_lagoon' | 'choir_circle' | 'drowned_surf'
  | 'serpent_grotto' | 'maw_pit'
  | 'turtle_guardian' | 'leviathan_shoal'
  // The wild beasts' (owner, 2026-10-03).
  | 'bat_cave' | 'jaguar_den' | 'moray_reef' | 'albatross_rock' | 'ape_ridge' | 'croc_mangroves' | 'octopus_wreck';
export const LAIR_KINDS: LairKind[] = ['crab_beach', 'gull_cliffs', 'seal_rookery', 'shark_shallows', 'turtle_rocks', 'serpent_marsh', 'hermit_camp', 'tentacle_lagoon', 'choir_circle', 'drowned_surf', 'serpent_grotto', 'maw_pit', 'turtle_guardian', 'leviathan_shoal',
  'bat_cave', 'jaguar_den', 'moray_reef', 'albatross_rock', 'ape_ridge', 'croc_mangroves', 'octopus_wreck'];

/** A shore lair (the first a landing party meets), a grotto inland, the island's guardian at her heart. */
export type LairRole = 'shore' | 'grotto' | 'guardian';

export interface LairDef {
  kind: LairKind;
  name: Tr;
  text: Tr;
  role: LairRole;
  /** Its creatures and each kind's share of its might (the first is its own, its face). */
  mix: [BeastId, number][];
  /** The island levels it lives at, and the kinds of island. */
  lv: [number, number];
  types: IsleType[];
  /** Beaten, it may be flagged as a dwelling of its first kind (docs/18 #19). */
  dwell?: boolean;
  /** HoMM3's offer to a far stronger army: they may sign on ('deep': only with the Choir's and the cursed). */
  join: 'yes' | 'deep' | 'never';
  /** The chance its loot holds an egg or a young one of its first kind (docs/18 #20). */
  egg: number;
}

const D = (kind: LairKind, role: LairRole, name: Tr, text: Tr, mix: [BeastId, number][], lv: [number, number], types: IsleType[], o: Partial<Pick<LairDef, 'dwell' | 'join' | 'egg'>> = {}): LairDef =>
  ({ kind, role, name, text, mix, lv, types, join: o.join ?? 'yes', egg: o.egg ?? 0, ...(o.dwell ? { dwell: true } : {}) });

const ALL_BUT_DEAD: IsleType[] = ['tropical', 'rocky', 'volcanic', 'swamp', 'graveyard'];

export const LAIRS: Record<LairKind, LairDef> = {
  crab_beach: D('crab_beach', 'shore', ['Crab Beach', 'Крабовый пляж'], ['The sand moves: shore crabs in their hundreds, and the gulls that follow them.', 'Песок шевелится: сотни береговых крабов и чайки, что кружат над ними.'], [['crab', 0.75], ['gull', 0.25]], [1, 4], ALL_BUT_DEAD, { dwell: true }),
  gull_cliffs: D('gull_cliffs', 'shore', ['Gull Cliffs', 'Птичий утёс'], ['A white cliff of carrion gulls that drop on anything that lands below.', 'Белый от птиц утёс: чайки-падальщики падают на всё, что высадится внизу.'], [['gull', 0.7], ['crab', 0.3]], [1, 4], ['rocky', 'tropical', 'volcanic'], { dwell: true }),
  seal_rookery: D('seal_rookery', 'shore', ['Seal Rookery', 'Тюленье лежбище'], ['Bulls on the rocks guard their cows; the pups are worth a ship’s cook his weight in silver.', 'Самцы на камнях стерегут самок; за детёныша кок отдаст столько серебра, сколько тот весит.'], [['seal', 0.8], ['gull', 0.2]], [1, 5], ['rocky', 'graveyard', 'tropical'], { dwell: true, egg: 0.08 }),
  shark_shallows: D('shark_shallows', 'shore', ['Shark Shallows', 'Акулья отмель'], ['Warm shallows where the sharks come into the surf after anything that wades.', 'Тёплое мелководье: акулы заходят в прибой за всем, что бредёт по воде.'], [['reef_shark', 0.7], ['crab', 0.3]], [2, 6], ['tropical', 'volcanic', 'rocky'], { dwell: true }),
  turtle_rocks: D('turtle_rocks', 'shore', ['Turtle Rocks', 'Черепашьи скалы'], ['What look like boulders are turtles as old as the charts; their nests are in the sand.', 'То, что кажется валунами, — черепахи старше карт; их кладки — в песке.'], [['rock_turtle', 0.7], ['crab', 0.3]], [3, 7], ['tropical', 'rocky', 'swamp'], { dwell: true, egg: 0.15 }),
  serpent_marsh: D('serpent_marsh', 'shore', ['Serpent Marsh', 'Змеиная топь'], ['A black marsh where the serpents lie in the reeds and the water burns the skin.', 'Чёрная топь: змеи лежат в тростнике, а вода жжёт кожу.'], [['marsh_serpent', 0.75], ['rock_turtle', 0.25]], [3, 7], ['swamp', 'volcanic'], { dwell: true, egg: 0.12 }),
  hermit_camp: D('hermit_camp', 'shore', ['Hermits’ Camp', 'Стоянка отшельников'], ['Castaways gone wild: they harpoon from the dunes and keep what the wrecks bring.', 'Одичавшие отверженные: бьют гарпунами из-за дюн и держат всё, что приносят крушения.'], [['hermit', 0.7], ['seal', 0.3]], [3, 8], ['graveyard', 'rocky', 'swamp', 'tropical'], { dwell: true }),
  tentacle_lagoon: D('tentacle_lagoon', 'shore', ['Tentacle Lagoon', 'Лагуна щупалец'], ['Something lives in the lagoon and puts its arms out over the sand when the tide is in.', 'В лагуне живёт что-то, и в прилив оно выкидывает щупальца на песок.'], [['lagoon_tentacle', 0.7], ['reef_shark', 0.3]], [4, 8], ['graveyard', 'volcanic', 'tropical'], { dwell: true, egg: 0.08 }),
  choir_circle: D('choir_circle', 'shore', ['Circle of the Choir', 'Круг Хора'], ['Cultists sing in a ring of stones to the drowned who stand with them.', 'Культисты поют в каменном круге утопленникам, что стоят рядом с ними.'], [['cultist', 0.6], ['surf_drowned', 0.4]], [5, 10], ['dead'], { join: 'deep' }),
  drowned_surf: D('drowned_surf', 'shore', ['Surf of the Drowned', 'Прибой утопленников'], ['The sea gives its dead back here, every tide, and they walk up the beach.', 'Здесь море каждый прилив отдаёт своих мертвецов, и они выходят на берег.'], [['surf_drowned', 0.8], ['lagoon_tentacle', 0.2]], [5, 10], ['dead', 'graveyard'], { join: 'deep', dwell: true }),
  serpent_grotto: D('serpent_grotto', 'grotto', ['Serpent’s Grotto', 'Грот змея'], ['A sea cave inland where a young serpent sleeps on its brood, with its kin about it.', 'Морской грот в глубине острова: молодой змей спит на кладке, вокруг его родня.'], [['young_serpent', 0.6], ['marsh_serpent', 0.4]], [5, 10], ['volcanic', 'swamp', 'rocky', 'tropical'], { join: 'never', egg: 0.2 }),
  maw_pit: D('maw_pit', 'grotto', ['Pit of the Lantern', 'Яма светоча'], ['A drowned pit where a lantern maw hangs its light, and the cultists come to look into it.', 'Затопленная яма: светоч-пасть подвешивает свой огонь, а культисты приходят смотреть в него.'], [['lantern_maw', 0.6], ['cultist', 0.4]], [6, 10], ['dead', 'graveyard'], { join: 'never', egg: 0.1 }),
  turtle_guardian: D('turtle_guardian', 'guardian', ['The Ancient Turtle', 'Древняя черепаха'], ['The island’s guardian: a turtle older than the island’s name, with the rock turtles of her brood.', 'Страж острова: черепаха старше самого имени острова, с черепахами-скалами своего выводка.'], [['ancient_turtle', 0.6], ['rock_turtle', 0.4]], [5, 10], ['tropical', 'rocky', 'swamp', 'volcanic'], { join: 'never', egg: 0.35 }),
  leviathan_shoal: D('leviathan_shoal', 'guardian', ['Leviathan on the Shoal', 'Левиафан на мели'], ['The island’s guardian: a leviathan beached on her shoal for a hundred years, and the drowned that serve it.', 'Страж острова: левиафан, сто лет лежащий на её мели, и утопленники, что служат ему.'], [['shoal_leviathan', 0.6], ['surf_drowned', 0.4]], [6, 10], ['dead', 'graveyard', 'rocky'], { join: 'never', egg: 0.3 }),
  // The wild beasts' shore lairs (owner, 2026-10-03), each where its kind would live and at the levels of its tier.
  bat_cave: D('bat_cave', 'shore', ['Bat Cave', 'Пещера летучих мышей'], ['A cave in the cliff that breathes out bats at dusk; the monitors live on what falls from its roof.', 'Пещера в скале выдыхает в сумерках летучих мышей; вараны живут тем, что падает с её свода.'], [['cave_bat', 0.7], ['monitor', 0.3]], [2, 6], ['rocky', 'volcanic', 'graveyard'], { dwell: true }),
  jaguar_den: D('jaguar_den', 'shore', ['Jaguar Den', 'Логово ягуаров'], ['The jaguars lie up in the green dark of the jungle, over the boars they hunt.', 'Ягуары лежат в зелёном сумраке джунглей, над кабанами, на которых охотятся.'], [['jaguar', 0.7], ['wild_boar', 0.3]], [3, 7], ['tropical'], { dwell: true, egg: 0.1 }),
  moray_reef: D('moray_reef', 'shore', ['Moray Reef', 'Риф мурен'], ['A reef so close in that the surf runs over it: morays in every hole, barracudas in the channels.', 'Риф у самого берега, прибой перекатывается через него: мурены в каждой норе, барракуды в протоках.'], [['moray', 0.7], ['barracuda', 0.3]], [3, 7], ['tropical', 'rocky'], { dwell: true }),
  albatross_rock: D('albatross_rock', 'shore', ['Albatross Rock', 'Скала альбатросов'], ['A bare rock where the albatrosses of the open sea come to nest, and the gulls rob the nests.', 'Голая скала, куда альбатросы открытого моря прилетают гнездиться, а чайки грабят их гнёзда.'], [['albatross', 0.7], ['gull', 0.3]], [3, 7], ['rocky', 'volcanic'], { dwell: true, egg: 0.1 }),
  ape_ridge: D('ape_ridge', 'shore', ['Ape Ridge', 'Обезьяний хребет'], ['Grey-backed apes hold the ridge over the beach and beat their chests at anything that lands; the boars root below.', 'Седоспинные обезьяны держат хребет над пляжем и бьют себя в грудь при виде всякого, кто высадится; внизу роются кабаны.'], [['island_ape', 0.7], ['wild_boar', 0.3]], [4, 8], ['tropical', 'volcanic'], { dwell: true }),
  croc_mangroves: D('croc_mangroves', 'shore', ['Crocodile Mangroves', 'Крокодильи мангры'], ['Logs in the brown water of the mangroves open their eyes; the toads sing on the roots above them.', 'Брёвна в бурой воде мангровых зарослей открывают глаза; на корнях над ними поют жабы.'], [['crocodile', 0.7], ['giant_toad', 0.3]], [4, 8], ['swamp', 'tropical'], { dwell: true, egg: 0.12 }),
  octopus_wreck: D('octopus_wreck', 'shore', ['Octopus Wreck', 'Осьминожий остов'], ['A wreck high on the beach with an octopus living in her hold; the crabs that wear her bells keep its door.', 'Разбитый корабль высоко на пляже: в его трюме живёт осьминог, а крабы, что носят его колокола, стерегут вход.'], [['giant_octopus', 0.8], ['bell_hermit', 0.2]], [5, 10], ['graveyard', 'rocky'], { dwell: true, egg: 0.08 }),
};

// ------------------------------------------------------------------------------------------------ 24. the calibration

/** What a lair of a size costs a captain of its level in the battle ashore: the share of the men she lands lost, on
 *  average over many fights (a fight lost counts as all of them) — GUARD_LOSS's 12 / 30 / 60%. */
export const LAIR_LOSS: Record<LairSize, number> = GUARD_LOSS;

/** A lair's creatures are first reckoned at the might the sea's guards are (three quarters of the army of a captain
 *  of ⚓L), and then each kind of lair stands with the multiple of it that costs a captain of that level its LAIR_LOSS
 *  in the battle ashore (node tools/balance-lairs.ts --calibrate; tests/balance/lairs.test.ts holds it). Index: the
 *  level; a level out of the kind's range is never stood (zeros). */
export const LAIR_CAL: Record<LairKind, [number, number, number][]> = {
  crab_beach: [[0, 0, 0], [0.84, 1.17, 1.5], [0.63, 0.94, 1.17], [0.42, 0.7, 1.1], [0.32, 0.56, 0.94], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  gull_cliffs: [[0, 0, 0], [0.75, 1.42, 2.25], [0.92, 1.43, 1.94], [0.5, 0.94, 1.39], [0.4, 0.74, 1.28], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  seal_rookery: [[0, 0, 0], [0.87, 1.62, 2.25], [0.9, 1.17, 1.7], [0.63, 1.12, 1.87], [0.58, 0.92, 1.58], [0.46, 0.79, 1.21], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  shark_shallows: [[0, 0, 0], [0, 0, 0], [1.19, 1.62, 2.13], [0.63, 1.04, 1.36], [0.5, 0.93, 1.36], [0.5, 0.86, 1.13], [0.46, 0.78, 1.09], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  turtle_rocks: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.71, 1.17, 1.5], [0.69, 1.07, 1.31], [0.5, 0.88, 1.14], [0.65, 0.86, 1.08], [0.54, 0.77, 0.95], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  serpent_marsh: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.9, 1.5, 1.9], [0.87, 1.37, 1.62], [0.93, 1.31, 1.56], [0.86, 1.13, 1.5], [0.73, 1.03, 1.33], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  hermit_camp: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1.17, 1.5, 2.17], [0.9, 1.3, 1.75], [0.75, 1.25, 1.58], [0.65, 1.12, 1.58], [0.6, 1.02, 1.48], [0.53, 0.98, 1.44], [0, 0, 0], [0, 0, 0]],
  tentacle_lagoon: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.87, 1.37, 2.13], [0.85, 1.21, 1.65], [0.7, 1.3, 1.7], [0.61, 1.17, 1.54], [0.53, 1.04, 1.5], [0, 0, 0], [0, 0, 0]],
  choir_circle: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.9, 1.5, 2.17], [0.93, 1.37, 2.13], [0.79, 1.25, 1.78], [0.65, 1.25, 1.7], [0.92, 1.19, 1.5], [0.9, 1.22, 1.55]],
  drowned_surf: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.09, 1.58, 2.25], [0.9, 1.5, 1.9], [0.81, 1.43, 1.9], [0.79, 1.32, 1.77], [0.9, 1.23, 1.5], [0.95, 1.24, 1.52]],
  serpent_grotto: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.58, 1.12, 1.66], [0.84, 1.34, 1.98], [0.49, 0.91, 1.23], [0.54, 1.04, 1.35], [0.51, 0.84, 1.1], [0.55, 0.81, 1.14]],
  maw_pit: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.39, 2.28, 3.06], [1.33, 2.09, 2.91], [1.28, 1.72, 2.42], [1.03, 1.58, 2.14], [1.05, 1.53, 2.12]],
  turtle_guardian: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [2.83, 4.18, 5.16], [3.13, 4.62, 5.37], [1.28, 1.78, 2.15], [1.9, 2.57, 3.04], [1.04, 1.22, 1.33], [1.04, 1.23, 1.36]],
  leviathan_shoal: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.5, 2.5, 4.83], [0.81, 2.19, 3.55], [1.07, 3.36, 5.77], [1.04, 1.13, 1.93], [0.99, 1.12, 1.94]],
  bat_cave: [[0, 0, 0], [0, 0, 0], [1.09, 1.5, 2.25], [0.7, 1.3, 2.3], [0.61, 1.06, 1.5], [0.5, 0.91, 1.3], [0.41, 0.85, 1.21], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  jaguar_den: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1.12, 1.5, 2.5], [0.9, 1.36, 2.11], [0.75, 1.09, 1.64], [0.61, 1.05, 1.35], [0.56, 0.98, 1.26], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  moray_reef: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.84, 1.5, 3.5], [0.58, 1.25, 1.75], [0.5, 1.13, 1.5], [0.47, 1.09, 1.53], [0.36, 0.82, 1.43], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  albatross_rock: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.56, 1.1, 1.5], [0.39, 0.82, 1.18], [0.38, 0.66, 1.06], [0.36, 0.64, 0.93], [0.33, 0.55, 0.78], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  ape_ridge: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.87, 1.3, 1.7], [0.93, 1.31, 1.64], [0.87, 1.29, 1.5], [0.79, 1.17, 1.39], [0.73, 1.12, 1.5], [0, 0, 0], [0, 0, 0]],
  croc_mangroves: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.92, 1.42, 1.92], [0.79, 1.21, 1.54], [0.85, 1.15, 1.62], [0.69, 1.07, 1.39], [0.63, 0.97, 1.32], [0, 0, 0], [0, 0, 0]],
  octopus_wreck: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.09, 1.42, 1.83], [0.87, 1.37, 1.87], [0.79, 1.36, 1.78], [0.75, 1.25, 1.77], [0.79, 1.12, 1.4], [0.8, 1.08, 1.45]],
};

/** Silver the men an average lair costs the captain of ⚓L to refill when she wins (measured in the battle ashore:
 *  node tools/balance-lairs.ts --calibrate). */
export const LAIR_REFILL = [0, 168, 241, 427, 651, 1156, 1603, 2499, 3959, 8199, 13818];

/** The silver the men a lair of a size costs the captain of its level to refill, on average. */
export function lairRefill(level: number, size: LairSize): number {
  const L = Math.max(1, Math.min(10, level));
  return LAIR_REFILL[L] * (LAIR_LOSS[size] / LAIR_LOSS.avg);
}

/** The lair's creatures at their first reckoning: the guards' might, shared among its kinds; its own kind in two
 *  stacks when there are many of them (HoMM3's neutrals stand in several), the rest in one each. */
export function lairBaseArmy(kind: LairKind, level: number): ArmyStack[] {
  const L = Math.max(1, Math.min(10, level));
  let might = guardBaseMight(L);
  const out: ArmyStack[] = [];
  // The island's guardian is one great beast (two, three in the deepest waters), a grotto's its few; its brood makes
  // up the rest.
  if (LAIRS[kind].role !== 'shore') {
    const [u] = LAIRS[kind].mix[0];
    const n = LAIRS[kind].role === 'guardian' ? guardianCount(L) : grottoCount(L);
    out.push({ u, n });
    might = Math.max(might * 0.25, might - armyPower([{ u, n }]));
    const [c] = LAIRS[kind].mix[1];
    out.push({ u: c, n: Math.max(1, Math.round(might / armyPower([{ u: c, n: 1 }]))) });
    return out;
  }
  LAIRS[kind].mix.forEach(([u, share], i) => {
    const n = Math.max(1, Math.round((might * share) / armyPower([{ u, n: 1 }])));
    if (i === 0 && n >= 8) {
      out.push({ u, n: Math.ceil(n / 2) }, { u, n: Math.floor(n / 2) });
    } else out.push({ u, n });
  });
  return out;
}

/** A lair's creatures as it stands at a level and a size (no dice: the same lair stands with the same creatures). */
export function lairArmy(kind: LairKind, level: number, size: LairSize): ArmyStack[] {
  const L = Math.max(1, Math.min(10, level));
  const row = LAIR_CAL[kind][L];
  const k = row[LAIR_SIZES.indexOf(size)] || LAIR_CAL[kind][nearestCal(kind, L)][LAIR_SIZES.indexOf(size)] || 1;
  const fixed = LAIRS[kind].role !== 'shore';
  return lairBaseArmy(kind, L).map((s, i) => ({ u: s.u, n: fixed && i === 0 ? s.n : Math.max(1, Math.round(s.n * k)) }));
}

/** The guardian itself: one great beast, two at ⚓8–9, three at ⚓10 (its brood is what the calibration scales). */
export function guardianCount(level: number): number {
  return level <= 7 ? 1 : level <= 9 ? 2 : 3;
}

/** A grotto's own: one young serpent or lantern maw at ⚓5–6, two at ⚓7–8, three at ⚓9, four at ⚓10. */
export function grottoCount(level: number): number {
  return level <= 6 ? 1 : level <= 8 ? 2 : level <= 9 ? 3 : 4;
}

function nearestCal(kind: LairKind, L: number): number {
  let best = 1, bd = Infinity;
  for (let k = 1; k <= 10; k++) if (LAIR_CAL[kind][k][1] > 0 && Math.abs(k - L) < bd) [best, bd] = [k, Math.abs(k - L)];
  return best;
}

/** The kinds of lair an island of a kind and a level keeps, for each role. */
export function lairKindsFor(type: IsleType, level: number, role: LairRole): LairKind[] {
  return LAIR_KINDS.filter((k) => {
    const d = LAIRS[k];
    return d.role === role && d.types.includes(type) && level >= d.lv[0] && level <= d.lv[1];
  });
}

/** The men a captain lands at a lair (docs/18 #15): her whole army but a watch left aboard — a tenth of her men, from
 *  the lowest tiers (the ship's guns stay aboard with them). */
export function landParty<T extends { u: ArmyStack['u']; n: number }>(army: readonly T[]): T[] {
  const men = army.reduce((a, s) => a + s.n, 0);
  let watch = men > 1 ? Math.max(1, Math.round(men * WATCH_SHARE)) : 0;
  const out = army.map((s) => ({ ...s }));
  for (const s of [...out].sort((a, b) => UNITS[a.u].tier - UNITS[b.u].tier)) {
    if (watch <= 0) break;
    const k = Math.min(watch, s.n - (out.filter((x) => x.n > 0).length === 1 ? 1 : 0));
    s.n -= Math.max(0, k);
    watch -= Math.max(0, k);
  }
  return out.filter((s) => s.n > 0);
}
export const WATCH_SHARE = 0.1;

// ------------------------------------------------------------------------------------------------ 17. the loot

/** What a lair leaves, by its level and size (and an island's hidden finds): its silver, its lesson, the H3 resource
 *  of its island, the land's resources of its creatures — worth the men it costs and a fifth, a quarter or three
 *  tenths of an hour at sea more (weak, average, strong). Its artifact's chance and its egg's are apart. */
export interface LairPay {
  silver: number;
  xp: number;
  good: GoodId;
  goods: number;
  res: Partial<Record<LandRes | 'pearls', number>>;
}

export const LAIR_HOURS: Record<LairSize, number> = { weak: 0.2, avg: 0.25, strong: 0.3 };
/** The chance a lair's loot holds an artifact (H2's maybeArtifact), by size; a guardian's half as much again. */
export const LAIR_ART: Record<LairSize, number> = { weak: 0.05, avg: 0.12, strong: 0.25 };
/** Of a lair's worth: the H3 resource of its island, and the land's resources of its creatures (the rest silver). */
const GOODS_SHARE = 0.2, RES_SHARE = 0.25;
/** Silver a pearl is reckoned at (the H3 resource's own price). */
const pearlValue = () => GOODS.pearls.basePrice;

export function lairPay(kind: LairKind, level: number, size: LairSize, type: IsleType, mul = 1): LairPay {
  const L = Math.max(1, Math.min(10, level));
  const worth = (lairRefill(L, size) + LAIR_HOURS[size] * advHour(L)) * mul;
  const good = ISLE_TYPE_DEFS[type].supply;
  const goods = Math.max(1, Math.round((worth * GOODS_SHARE) / GOODS[good].basePrice));
  // The land's resources by its creatures' own: their shares of the lair's might, weighted by what each leaves.
  const weights: Partial<Record<LandRes | 'pearls', number>> = {};
  for (const [u, share] of LAIRS[kind].mix) for (const [r, n] of Object.entries(BEAST_RES[u]) as [LandRes | 'pearls', number][]) weights[r] = (weights[r] ?? 0) + share * n;
  const tot = Object.entries(weights).reduce((a, [r, w]) => a + (w ?? 0) * (r === 'pearls' ? pearlValue() : LAND_RES_DEF[r as LandRes].value), 0) || 1;
  const res: Partial<Record<LandRes | 'pearls', number>> = {};
  let resWorth = 0;
  for (const [r, w] of Object.entries(weights) as [LandRes | 'pearls', number][]) {
    const v = r === 'pearls' ? pearlValue() : LAND_RES_DEF[r].value;
    const n = Math.max(1, Math.round((worth * RES_SHARE * (w * v)) / tot / v));
    res[r] = n;
    resWorth += n * v;
  }
  const silver = Math.max(10, Math.round((worth - goods * GOODS[good].basePrice - resWorth) / 10) * 10);
  return { silver, xp: Math.max(10, Math.round((advLevelXp(L) * 0.05 * GUARD_SIZE[size]) / 10) * 10), good, goods, res };
}

/** What the whole of a lair's pay is worth in silver (its goods and resources at their reckoning). */
export function payWorth(p: LairPay): number {
  let v = p.silver + p.goods * GOODS[p.good].basePrice;
  for (const [r, n] of Object.entries(p.res) as [LandRes | 'pearls', number][]) v += n * (r === 'pearls' ? pearlValue() : LAND_RES_DEF[r].value);
  return v;
}

/** The island's chest for the whole chain (docs/18 #22): half an hour at sea and a fifth of a level of experience;
 *  an artifact one time in two. */
export function chainChest(level: number): { silver: number; xp: number; art: number } {
  const L = Math.max(1, Math.min(10, level));
  return { silver: Math.round((advHour(L) * 0.5) / 50) * 50, xp: Math.round((advLevelXp(L) * 0.2) / 10) * 10, art: 0.5 };
}

// ------------------------------------------------------------------------------------------------ 18–20. the times

/** A lair beaten (fled, signed on) stands again: a shore lair two days of the sea later, a grotto three, a guardian
 *  four. Its loot is each captain's once a week of the calendar (as a guard's chest, docs/17 H5). */
export const LAIR_RESPAWN: Record<LairRole, number> = { shore: 2 * DAY_LENGTH_SEC, grotto: 3 * DAY_LENGTH_SEC, guardian: 4 * DAY_LENGTH_SEC };

/** A creature dwelling's growth a week (half a town dwelling's of its tier, at least one), and the weeks its pool
 *  keeps; a captain flies her flag over this many at most. */
export function dwellGrowth(u: BeastId): number {
  return Math.max(1, Math.round(GROWTH[UNITS[u].tier] / 2));
}
export const DWELL_WEEKS = 2;
export const DWELL_MAX = 4;

/** The pen (docs/18 #20): an egg hatches two days of the sea after it is laid in, the young is grown a week after
 *  that; a grown kind breeds in the pen a week like a creature dwelling. Nests by the pen's level; eggs carried. */
export const PEN_HATCH_DAYS = 2;
export const PEN_GROW_DAYS = 7;
export const PEN_NESTS = [0, 1, 3];
export const EGG_MAX = 6;

/** An egg's stage in the pen, by the days since it was laid in. */
export function penStage(days: number): 'egg' | 'young' | 'grown' {
  return days < PEN_HATCH_DAYS ? 'egg' : days < PEN_HATCH_DAYS + PEN_GROW_DAYS ? 'young' : 'grown';
}

// ------------------------------------------------------------------------------------------------ 13, 22. where they stand

export interface Lair {
  id: string;
  kind: LairKind;
  role: LairRole;
  size: LairSize;
  level: number;
  /** Its island (−1: a turtle island's back or a sandbar). */
  island: number;
  x: number;
  y: number;
  type: IsleType;
  /** A hidden island's lair: a level up, its loot half as rich again (isleLoot). */
  mul: number;
  /** A link of the island's chain (docs/18 #22): the step it is (0 shore, 1 grotto, 2 guardian). */
  chain?: number;
  /** It lives on a turtle island's back, or on a sandbar of the low tide: there only while she is up. */
  turtle?: number;
  bank?: number;
}

const cache = new WeakMap<World, Lair[]>();

/** A point inside an island toward an angle: off her shore by `inset` (a share of the way from the shore to her
 *  middle when below 1). */
function inland(is: Island, angle: number, inset: number): [number, number] {
  const dx = Math.sin(angle), dy = -Math.cos(angle);
  let d = 0;
  while (d < is.radius + 60 && pointInPolygon(is.x + dx * (d + 12), is.y + dy * (d + 12), is.poly)) d += 12;
  const back = inset < 1 ? d * inset : Math.min(d * 0.8, inset);
  const k = Math.max(0, d - back);
  return [Math.round(is.x + dx * k), Math.round(is.y + dy * k)];
}

/** The size a shore lair stands at: weak a third of the time, average a little under half, strong the rest. */
function sizeOf(rng: Rng): LairSize {
  const r = rng.float();
  return r < 0.35 ? 'weak' : r < 0.8 ? 'avg' : 'strong';
}

/** The world's lairs: each island's from her own dice (the island's id and the world's seed), so a lair stays where
 *  it is whatever else the sea grows; the turtles' and the sandbars' after them. */
export function buildLairs(world: World): Lair[] {
  const hit = cache.get(world);
  if (hit) return hit;
  const out: Lair[] = [];
  for (const is of world.islands) {
    if (is.portId || is.raft || is.minor || is.slot || is.radius < 110 || is.region === 'the_abyss') continue;
    const rng = new Rng((hashString(`lair:${world.seed}:${is.id}`) ^ 0x18b2) >>> 0);
    const type = isleType(is);
    // (docs/19 D4: the second lot of hidden islands keeps the lairs she had before she was hidden)
    const hidden = !!is.hidden && !is.veil;
    const loot = isleLoot({ ...is, hidden });
    const level = Math.min(10, isleLevel(world, is) + loot.tier);
    const chance = hidden ? 1 : is.radius > 600 ? 0.75 : is.radius > 250 ? 0.5 : 0.28;
    if (!rng.chance(chance)) continue;
    const shore = lairKindsFor(type, level, 'shore');
    if (!shore.length) continue;
    const a0 = rng.float() * Math.PI * 2;
    const n = hidden ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const [x, y] = inland(is, a0 + k * 2.3, 45);
      out.push({ id: `l${is.id}${k ? 's2' : 's'}`, kind: shore[rng.int(0, shore.length - 1)], role: 'shore', size: hidden && k ? 'strong' : sizeOf(rng), level, island: is.id, x, y, type, mul: loot.mul });
    }
    // The chain of a great island of the deeper waters: its grotto inland, its guardian at the heart of it.
    const grotto = lairKindsFor(type, level, 'grotto'), guard = lairKindsFor(type, Math.min(10, level + 1), 'guardian');
    if (is.radius >= 420 && level >= 5 && grotto.length && guard.length && (hidden || rng.chance(0.55))) {
      const first = out[out.length - n];
      first.chain = 0;
      first.size = 'avg';
      const [gx, gy] = inland(is, a0 + 1.1, 0.45);
      out.push({ id: `l${is.id}g`, kind: grotto[rng.int(0, grotto.length - 1)], role: 'grotto', size: 'strong', level, island: is.id, x: gx, y: gy, type, mul: loot.mul, chain: 1 });
      const [hx, hy] = inland(is, a0 + 3.4, 0.85);
      out.push({ id: `l${is.id}G`, kind: guard[rng.int(0, guard.length - 1)], role: 'guardian', size: 'strong', level: Math.min(10, level + 1), island: is.id, x: hx, y: hy, type, mul: loot.mul, chain: 2 });
    }
  }
  // docs/18 #31: the turtle islands carry a lair on their backs, the sandbars of the low tide one of crabs or seals.
  for (const d of turtles(world)) {
    const level = isleLevel(world, { x: d.cx, y: d.cy });
    const kinds = lairKindsFor('tropical', level, 'shore');
    const rng = new Rng((hashString(`lairT:${world.seed}:${d.id}`) ^ 0x7e) >>> 0);
    if (kinds.length) out.push({ id: `lt${d.id}`, kind: kinds.includes('turtle_rocks') ? 'turtle_rocks' : kinds[rng.int(0, kinds.length - 1)], role: 'shore', size: 'avg', level, island: -1, x: d.cx, y: d.cy, type: 'tropical', mul: 1.2, turtle: d.id });
  }
  for (const b of tidalIsles(world).slice(TIDAL_COUNT, TIDAL_COUNT + SANDBAR_COUNT)) {
    const level = isleLevel(world, b);
    const kinds = (['crab_beach', 'seal_rookery', 'shark_shallows'] as LairKind[]).filter((k) => level >= LAIRS[k].lv[0] && level <= LAIRS[k].lv[1]);
    const rng = new Rng((hashString(`lairB:${world.seed}:${b.id}`) ^ 0xb4) >>> 0);
    if (kinds.length) out.push({ id: `lb${b.id}`, kind: kinds[rng.int(0, kinds.length - 1)], role: 'shore', size: sizeOf(rng), level, island: -1, x: Math.round(b.x), y: Math.round(b.y), type: 'tropical', mul: 1.2, bank: b.id });
  }
  out.push(...deepLairs(world, out));
  cache.set(world, out);
  return out;
}

/** docs/19 D2 (owner, 2026-10-02: «увеличь всё ровно в 2 раза»): as many lairs again — on an island with one lair
 *  already, a second of another depth further inland (a level deeper; one shallower at ⚓10); on an island with
 *  none, its first. No island keeps more than two this way (the chains and the hidden islands' pairs are left as they
 *  are). Each island's from dice of its own and in an order of the world's, after every lair before, which keep
 *  their ids and places; the new ones' ids end in «d». */
function deepLairs(world: World, before: Lair[]): Lair[] {
  const per = new Map<number, Lair[]>();
  for (const l of before) if (l.island >= 0) per.set(l.island, [...(per.get(l.island) ?? []), l]);
  const cands: { k: number; l: Lair }[] = [];
  for (const is of world.islands) {
    if (is.portId || is.raft || is.minor || is.slot || is.radius < 110 || is.region === 'the_abyss') continue;
    const has = per.get(is.id) ?? [];
    if (has.length >= 2) continue;
    const rng = new Rng((hashString(`lairD:${world.seed}:${is.id}`) ^ 0x19d2) >>> 0);
    const type = isleType(is);
    const loot = isleLoot({ ...is, hidden: !!is.hidden && !is.veil });
    const level0 = Math.min(10, isleLevel(world, is) + loot.tier);
    const level = has.length ? (has[0].level >= 10 ? 9 : has[0].level + 1) : level0;
    const shore = lairKindsFor(type, level, 'shore').filter((k) => !has.some((l) => l.kind === k));
    if (!shore.length) continue;
    // Deeper inland than the first: the other side of the island, half way in.
    const a = (has.length ? Math.atan2(has[0].x - is.x, -(has[0].y - is.y)) + Math.PI : rng.float() * Math.PI * 2) + rng.range(-0.5, 0.5);
    const [x, y] = inland(is, a, has.length ? 0.45 : 45);
    cands.push({ k: hashString(`lairD:${world.seed}:${is.id}:order`), l: { id: `l${is.id}d`, kind: shore[rng.int(0, shore.length - 1)], role: 'shore', size: sizeOf(rng), level, island: is.id, x, y, type, mul: loot.mul } });
  }
  // Exactly as many as before: the islands with one lair first (the second depth), then the bare ones, each lot in the
  // world's own order.
  cands.sort((p, q) => (per.has(q.l.island) ? 1 : 0) - (per.has(p.l.island) ? 1 : 0) || p.k - q.k || p.l.island - q.l.island);
  return cands.slice(0, before.length).map((c) => c.l);
}
