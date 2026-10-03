// The adventure map of the Heroes on the sea (docs/17 H4 items 14–16): the neutral guards that stand at the sea's
// treasures, mines, shrines and straits; the things on the map a captain sails up to and visits — a treasure chest, an
// altar of skill, a well, a watchtower, a windmill and a warehouse, a prison, an obelisk; and the Grail the obelisks'
// puzzle points to. Everything here stands where the world alone puts it (the same world, the same map), in open deep
// water off the wild islands of each region — never on land, never on a reef, never under a port's guns.
//
// Balance (tests/balance/guards.test.ts, node tools/balance-guards.ts): a guard's might is a share of the army of a
// captain of its waters' level (the ladder's usual hull and her men, docs/17 H1), whatever it is made of — many green
// castaways on a hulk, a few drowned in a wreck — so a weak guard is an easy win, an average one costs men, a strong
// one is a hard fight for a ship of its level. What they guard pays in parts of the hour at sea of those waters
// (advHour, the same reckoning as seaHour of tests/balance/island.ts), and in parts of a captain's level of experience.

import { DAY_LENGTH_SEC, xpForLevel } from '../constants.ts';
import { armyFit, armyForLevel, armyPower, armyTidy, upgradedShare } from './army.ts';
import type { ArmyMix, ArmyStack, UnitId } from './army.ts';
import type { Tr } from './estate.ts';
import type { GoodId } from './goods.ts';
import { MINES, MINE_WATERS, buildMines } from './mines.ts';
import { captainLevelFor } from './shiplevel.ts';
import { closestOnPolygon, pointInPolygon } from '../math.ts';
import { hashString } from '../rng.ts';
import { REGIONS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import { WORLD_EDGE_MARGIN } from '../world/regions.ts';
import { sectorAt } from '../world/sectors.ts';
import { DEEP_WATER, beforePorts, depthAt, isLand, legacyWorld, marksNear } from '../world/worldgen.ts';
import type { Island, World } from '../world/worldgen.ts';

// ------------------------------------------------------------------------------------------------ the sea's hour

/** Silver an hour at sea earns a captain of ship level ⚓L (the reference of tests/balance/island.ts seaHour). */
export function advHour(level: number): number {
  return Math.round(6 * 320 * 1.3 ** (Math.max(1, Math.min(10, level)) - 1));
}

/** Experience of one captain's level at the level that commands ⚓L. */
export function advLevelXp(level: number): number {
  return xpForLevel(captainLevelFor(Math.max(1, Math.min(10, level))));
}

// ------------------------------------------------------------------------------------------------ 14. the guards

export type GuardKind = 'holdout' | 'hulk' | 'wreck' | 'beasts';
export const GUARD_KINDS: GuardKind[] = ['holdout', 'hulk', 'wreck', 'beasts'];
export type GuardSize = 'weak' | 'avg' | 'strong';

export interface GuardDef {
  kind: GuardKind;
  name: Tr;
  text: Tr;
  /** Whose men they are (armyForLevel's mix); the pack of the deep is the deep's own spawn alone. */
  mix: ArmyMix;
  /** Men of it may sign on with a much stronger captain (the deep's things only with the Choir's and the cursed). */
  join: 'yes' | 'deep' | 'never';
  /** The ship's name the sea gives it and the captain's. */
  ship: string;
  captain: string;
}

export const GUARDS: Record<GuardKind, GuardDef> = {
  holdout: { kind: 'holdout', name: ['Pirate Hold-out', 'Пиратская застава'], text: ['A crew that will not leave its reef: a stockade, a black flag and a ship at anchor.', 'Команда, что не уходит со своего рифа: частокол, чёрный флаг и корабль на якоре.'], mix: 'pirate', join: 'yes', ship: 'Hold-out', captain: 'The Hold-out’s Chief' },
  hulk: { kind: 'hulk', name: ['Rotting Hulk', 'Гнилой остов'], text: ['A dead ship run aground on nothing, crowded with castaways and mutineers.', 'Мёртвый корабль, застрявший посреди моря, а на нём — толпа отверженных и бунтовщиков.'], mix: 'merchant', join: 'yes', ship: 'Rotting Hulk', captain: 'The Castaways' },
  wreck: { kind: 'wreck', name: ['Wreck of the Drowned', 'Остов утопленников'], text: ['A wreck the sea gave back with her crew still aboard. They do not breathe.', 'Остов, который море вернуло вместе с командой. Они не дышат.'], mix: 'deep', join: 'deep', ship: 'Wreck of the Drowned', captain: 'The Drowned Crew' },
  beasts: { kind: 'beasts', name: ['Pack of the Deep', 'Стая глубин'], text: ['Things from under the sea that nest in the wrack and come over any rail.', 'Твари из-под моря, что гнездятся в плавнике и лезут через любой борт.'], mix: 'deep', join: 'never', ship: 'Pack of the Deep', captain: 'The Deep' },
};

/** Men a captain of ⚓L usually carries (the ladder's usual hull, a little short of her hammocks). */
export const REF_MEN = [0, 24, 26, 34, 50, 80, 100, 150, 190, 260, 400];
/** What a guard of a size costs that captain in the boarding battle: the share of her men lost, on average over
 *  many fights (a fight lost counts as all of them) — a weak guard an easy win, an average one a real price, a strong
 *  one an even fight. */
export const GUARD_LOSS: Record<GuardSize, number> = { weak: 0.12, avg: 0.3, strong: 0.6 };
export const GUARD_SIZES: GuardSize[] = ['weak', 'avg', 'strong'];
/** A guard's chest and lesson grow with its size. */
export const GUARD_SIZE: Record<GuardSize, number> = { weak: 0.5, avg: 1, strong: 1.6 };
/** A guard beaten, fled or signed on stands again after two days of the sea (96 real minutes). */
export const GUARD_RESPAWN_SEC = 2 * DAY_LENGTH_SEC;
/** HoMM3's offer: an army this many times the guard's might sees them flee or sign on. */
export const JOIN_RATIO = 3;
/** The share of the guard's men who sign on (as many as the hammocks take). */
export const JOIN_SHARE = 0.5;

/** The might a guard's men are first reckoned at: three quarters of the might of the army of a captain of ⚓L. */
export function guardBaseMight(level: number): number {
  const L = Math.max(1, Math.min(10, level));
  return armyPower(armyForLevel(L, REF_MEN[L], 7, 'player')) * 0.75;
}

/** How many times the first reckoning of its men each kind of guard stands with, by level (1–10) and size, so that
 *  it costs the reference captain its GUARD_LOSS — a crowd of green men fights above its might, a few drowned below
 *  it. Calibrated by the boarding battle itself (node tools/balance-guards.ts --calibrate; tests/balance/guards.test.ts
 *  holds it to its targets). */
export const GUARD_CAL: Record<GuardKind, [number, number, number][]> = {
  holdout: [[0, 0, 0], [0.47, 0.84, 1.09], [0.41, 0.78, 1.09], [0.3, 0.55, 0.87], [0.47, 0.92, 1.25], [0.56, 0.75, 1.06], [0.52, 0.79, 1.02], [0.72, 0.99, 1.33], [0.68, 1.09, 1.34], [0.67, 1.01, 1.35], [0.61, 0.97, 1.28]],
  hulk: [[0, 0, 0], [0.53, 0.78, 1.03], [0.31, 0.59, 0.88], [0.32, 0.58, 0.79], [0.37, 0.53, 0.73], [0.29, 0.48, 0.64], [0.37, 0.55, 0.69], [0.29, 0.46, 0.68], [0.28, 0.45, 0.65], [0.3, 0.41, 0.59], [0.25, 0.4, 0.58]],
  // (The deep's things keep to their waters — the wreck from ⚓5, the pack from ⚓6; the rows below are never stood.)
  wreck: [[0, 0, 0], [0.94, 1.47, 1.75], [0.94, 1.47, 1.75], [0.94, 1.47, 1.75], [0.94, 1.47, 1.75], [0.94, 1.47, 1.75], [1.35, 1.75, 2.38], [0.86, 1.37, 1.69], [1.25, 1.73, 2.25], [1.1, 1.5, 1.9], [1.04, 1.39, 1.82]],
  beasts: [[0, 0, 0], [2.5, 3.5, 5.2], [2.5, 3.5, 5.2], [2.5, 3.5, 5.2], [2.5, 3.5, 5.2], [2.5, 3.5, 5.2], [2.5, 3.5, 5.2], [2.75, 4.25, 5.25], [2.13, 3.13, 3.89], [1.78, 2.5, 3.08], [1.86, 2.41, 3.16]],
};

/** A guard's stacks: its men first reckoned by might, then scaled by its calibration. No dice: the same guard stands
 *  with the same men. */
export function guardArmy(kind: GuardKind, level: number, size: GuardSize): ArmyStack[] {
  const L = Math.max(1, Math.min(10, level));
  const k = GUARD_CAL[kind][L][GUARD_SIZES.indexOf(size)];
  return guardBaseArmy(kind, L).map((s) => ({ u: s.u, n: Math.max(1, Math.round(s.n * k)) }));
}

/** The might of a guard as it stands. */
export function guardMight(level: number, size: GuardSize, kind: GuardKind = 'holdout'): number {
  return armyPower(guardArmy(kind, level, size));
}

/** A guard's men at their first reckoning (three quarters of the reference captain's might, made of its own men). */
export function guardBaseArmy(kind: GuardKind, level: number): ArmyStack[] {
  const L = Math.max(1, Math.min(10, level));
  const might = guardBaseMight(L);
  if (kind === 'beasts') {
    // The deep's own spawn alone: the drowned, and their risen kind as the waters grow stranger.
    const up = Math.min(0.8, upgradedShare(L) + 0.1);
    const per = (1 - up) * armyPower([{ u: 'drowned', n: 1 }]) + up * armyPower([{ u: 'deep_spawn', n: 1 }]);
    return deepSpawn(Math.max(1, Math.round(might / per)), up);
  }
  // The wreck's crew: a stack of the drowned themselves (two fifths of its might), the rest the deep's usual men.
  const own = kind === 'wreck' ? deepSpawn(Math.max(1, Math.round((might * 0.4) / armyPower([{ u: 'drowned', n: 1 }]))), Math.min(0.8, upgradedShare(L))) : [];
  const rest = might - armyPower(own);
  // (The wreck's living-looking rest are drowned sailors: the pirates' spread of men, the deep's own counted apart.)
  const mix: ArmyMix = kind === 'wreck' ? 'pirate' : GUARDS[kind].mix;
  // Whole men by the might they make (a few passes: the slots fold the small stacks of a small army together).
  let n = 200;
  for (let pass = 0; pass < 4; pass++) {
    const probe = armyForLevel(L, n, 7 - own.length, mix);
    n = Math.max(3, Math.round((n * Math.max(0, rest)) / Math.max(1, armyPower(probe))));
  }
  const out = armyTidy([...own, ...(rest > 0 ? armyForLevel(L, n, 7 - own.length, mix) : [])]);
  armyFit(out, 7);
  return out;
}

/** `n` of the deep's spawn: the drowned, and a share `up` of them risen into the spawn of the deep. */
function deepSpawn(n: number, up: number): ArmyStack[] {
  const k = Math.round(n * up);
  const out: ArmyStack[] = [];
  if (k > 0) out.push({ u: 'deep_spawn' as UnitId, n: k });
  if (n - k > 0) out.push({ u: 'drowned' as UnitId, n: n - k });
  return out;
}

/** What a guard of each kind stands for at a level (the kinds the waters of that level keep). */
export function guardKindsAt(level: number, strange: boolean): GuardKind[] {
  if (level <= 4) return ['hulk', 'holdout'];
  if (level <= 5) return strange ? ['holdout', 'hulk', 'wreck'] : ['holdout', 'hulk'];
  return strange ? ['holdout', 'wreck', 'beasts'] : ['holdout', 'wreck', 'beasts'];
}

/** Silver and experience for beating a guard (its chest and the fight's lesson, beside the battle's own). */
export function guardPay(level: number, size: GuardSize): { silver: number; xp: number } {
  // Its own chest pays half the men it costs (a guard alone is a lesson, not a profit); the lesson grows with its size.
  return { silver: round10(0.5 * refill(level, size)), xp: round10(advLevelXp(level) * 0.04 * GUARD_SIZE[size]) };
}

/** Silver the men an average guard costs the reference captain of ⚓L to refill when she wins (measured in the boarding
 *  battle: node tools/balance-guards.ts --calibrate; the higher tiers die dearer than their share of the heads). */
export const GUARD_REFILL = [0, 178, 281, 475, 952, 1572, 2028, 3396, 4659, 9018, 13853];

/** Silver the men a guard of a size costs the reference captain of ⚓L to refill, on average. */
export function refill(level: number, size: GuardSize): number {
  const L = Math.max(1, Math.min(10, level));
  return GUARD_REFILL[L] * (GUARD_LOSS[size] / GUARD_LOSS.avg);
}

// ------------------------------------------------------------------------------------------------ 15. things on the map

export type ObjKind = 'chest' | 'altar' | 'well' | 'tower' | 'mill' | 'store' | 'prison' | 'obelisk';
export const OBJ_KINDS: ObjKind[] = ['chest', 'altar', 'well', 'tower', 'mill', 'store', 'prison', 'obelisk'];
/** How often a captain may visit: once ever, once a week of the calendar, once a day, once a season. */
export type VisitRule = 'once' | 'week' | 'day' | 'season';

export interface ObjDef {
  kind: ObjKind;
  name: Tr;
  text: Tr;
  rule: VisitRule;
  /** Its painted picture (the props already in the art) and its mark on the chart. */
  art: string;
  icon: string;
  /** How many of it a region keeps. */
  per: number;
  /** How many of them stand guarded, and by what size of guard. */
  guarded: number;
  size: GuardSize;
}

export const OBJS: Record<ObjKind, ObjDef> = {
  chest: { kind: 'chest', name: ['Treasure Chest', 'Сундук с сокровищем'], text: ['A chest wedged in the rocks, filled again each week by the sea’s own traffic. Silver, or what its owner knew.', 'Сундук, застрявший в скалах; море наполняет его каждую неделю. Серебро — или то, что знал его хозяин.'], rule: 'week', art: 'prop.cache', icon: 'map_treasure', per: 6, guarded: 3, size: 'avg' },
  altar: { kind: 'altar', name: ['Altar of Skill', 'Алтарь умений'], text: ['An old altar of the sea under a bell. A captain who rings it once learns something that stays.', 'Старый морской алтарь под колоколом. Капитан, звонивший в него, учится чему-то навсегда.'], rule: 'once', art: 'prop.shrine', icon: 'build_chapel', per: 2, guarded: 2, size: 'strong' },
  well: { kind: 'well', name: ['Well', 'Колодец'], text: ['Sweet water on a rock in the salt sea: a day’s rest for the crew, their heart and their nerve.', 'Пресная вода на скале посреди солёного моря: день отдыха команде, её духу и нервам.'], rule: 'day', art: 'prop.spring', icon: 'build_chapel', per: 2, guarded: 0, size: 'weak' },
  tower: { kind: 'tower', name: ['Watchtower', 'Сторожевая башня'], text: ['A bell tower standing in the sea. From its top the waters lie open for seven kilometres.', 'Колокольня посреди моря. С её верха воды видны на семь километров.'], rule: 'once', art: 'prop.bell_tower', icon: 'build_signal_tower', per: 2, guarded: 0, size: 'weak' },
  mill: { kind: 'mill', name: ['Windmill', 'Мельница'], text: ['A mill on a skerry that grinds whatever the week brings: a load of one of the resources, each week.', 'Мельница на шхере, что мелет всё, что принесёт неделя: груз одного из ресурсов каждую неделю.'], rule: 'week', art: 'prop.life_hut', icon: 'build_sawmill', per: 1, guarded: 0, size: 'weak' },
  store: { kind: 'store', name: ['Warehouse', 'Склад'], text: ['A smugglers’ store on a jetty with nobody left to keep it: the same resource, each week.', 'Склад контрабандистов на причале, который некому сторожить: один и тот же ресурс каждую неделю.'], rule: 'week', art: 'prop.life_crates', icon: 'build_warehouse', per: 1, guarded: 0, size: 'weak' },
  prison: { kind: 'prison', name: ['Sea Prison', 'Морская тюрьма'], text: ['A fort in the sea where an officer waits in chains. Free them and they sail with you.', 'Морской форт, где в цепях ждёт офицер. Освободите — и он пойдёт с вами.'], rule: 'once', art: 'prop.life_fort', icon: 'build_fort', per: 1, guarded: 1, size: 'strong' },
  obelisk: { kind: 'obelisk', name: ['Obelisk', 'Обелиск'], text: ['A black stone older than the ports. Its carving is a piece of a chart to a legendary treasure.', 'Чёрный камень старше портов. Резьба на нём — кусок карты легендарного сокровища.'], rule: 'season', art: 'prop.ruins', icon: 'good_cursed_relics', per: 2, guarded: 0, size: 'weak' },
};

/** Visits from an obelisk's region are the Grail's pieces: sixteen in the world (two a region, three in the two
 *  largest), a four-by-four puzzle. */
export const OBELISKS = 16;
export const PUZZLE_GRID = 4;
/** The puzzle's chart is this many metres on a side (the Grail somewhere in its middle half). */
export const PUZZLE_W = 3600;

/** A captain who drinks at a well: her crew's heart up to this, their nerve by this much. */
export const WELL_MORALE = 95;
export const WELL_SANITY = 30;
/** The sea charted from a watchtower (metres). */
export const TOWER_R = 7000;
/** Talent points a captain takes from the altars in all (then each altar teaches experience instead). */
export const ALTAR_POINTS = 4;
/** A windmill's load is two days of a mine's yield of its resource, a warehouse's three. */
export const MILL_DAYS = 2;
export const STORE_DAYS = 3;
/** The six resources a windmill grinds, by the week. */
export const MILL_GOODS: GoodId[] = ['timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum'];

/** A treasure chest: silver, or its owner's knowledge (a guarded chest holds more). */
export function chestPay(level: number, guarded: boolean): { silver: number; xp: number } {
  // Behind its (average) guard a chest holds a quarter of an hour at sea more than the men it cost, the guard's own
  // chest counted (half of them): the fight is worth it at every level, never a mint.
  return { silver: round50(guarded ? advHour(level) * 0.25 + 0.5 * refill(level, 'avg') : advHour(level) * 0.15), xp: round10(advLevelXp(level) * (guarded ? 0.2 : 0.08)) };
}

/** An altar a captain has used up her points on: a quarter of a level of experience. */
export function altarXp(level: number): number {
  return round10(advLevelXp(level) * 0.25);
}

// ------------------------------------------------------------------------------------------------ docs/17 H5

/** The primary skill an altar teaches (HoMM3's Marletto Tower, Star Axis, Garden of Revelation, the learning stone…):
 *  each its own, by its id. */
export function altarPrim(id: string): 'atk' | 'def' | 'pow' | 'will' {
  return (['atk', 'def', 'pow', 'will'] as const)[hashString(`altar:${id}`) % 4];
}

/** The chance a chest on the map holds an artifact for a captain this week (guarded, open), and a beaten guard's chest
 *  by its size. Rolled on the chest's own dice for the captain and the week, so the card shows what the boats find. */
export const CHEST_ART = { guarded: 0.3, open: 0.12 };
export const GUARD_ART: Record<GuardSize, number> = { weak: 0.08, avg: 0.18, strong: 0.35 };

/** A windmill's or a warehouse's load of a resource at a level's waters. */
export function millLoad(good: GoodId, region: RegionId, days: number): number {
  const kind = (Object.keys(MINES) as (keyof typeof MINES)[]).find((k) => k === good);
  const daily = kind ? MINES[kind].daily : 5;
  return Math.max(1, Math.round(daily * MINE_WATERS[REGIONS[region].safety] * days));
}

// ------------------------------------------------------------------------------------------------ 16. the Grail

/** Digging for the Grail: from the boats within this many metres of the spot; a dig takes this long. */
export const GRAIL_R = 400;
export const GRAIL_DIG_SECS = 20;
/** A spade in the wrong sand: the next try waits a minute. */
export const GRAIL_MISS_SECS = 60;
/** The Grail raised in the town: growth of every dwelling ×1.5, 500 silver a day into the treasury, +10 will. */
export const GRAIL_GROWTH = 1.5;
export const GRAIL_SILVER = 500;
export const GRAIL_WILL = 10;
/** A Grail found after hers already stands: a treasure of three hours at sea of her level instead. */
export const GRAIL_TREASURE_HOURS = 3;

// ------------------------------------------------------------------------------------------------ where they stand

export interface AdvObj {
  id: string;
  kind: ObjKind;
  x: number;
  y: number;
  level: number;
  region: RegionId;
  island: string;
  /** Its guard, when one stands before it. */
  guard?: string;
  /** A warehouse's resource. */
  good?: GoodId;
}

export interface AdvGuard {
  id: string;
  kind: GuardKind;
  x: number;
  y: number;
  level: number;
  size: GuardSize;
  region: RegionId;
  /** What it guards: a thing on the map ('o…'), a mine ('m…'), or a strait (none). */
  at?: string;
  heading: number;
}

export interface AdvMap {
  objs: AdvObj[];
  guards: AdvGuard[];
  /** docs/19 D2: how many of each stood before (the rest are appended after them). */
  legacy?: { objs: number; guards: number };
}

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
const h = (s: string) => hashString(s);

/** Open deep water: off every island (and the sea's rocks), over no reef, out of the maelstroms, off the Wall. */
export function openWater(world: World, x: number, y: number): boolean {
  if (x < WORLD_EDGE_MARGIN + 800 || y < WORLD_EDGE_MARGIN + 800 || x > 96_000 - WORLD_EDGE_MARGIN - 800 || y > 96_000 - WORLD_EDGE_MARGIN - 800) return false;
  if (isLand(world, x, y) || depthAt(world, x, y) < DEEP_WATER) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isLand(world, x + Math.sin(a) * 70, y - Math.cos(a) * 70)) return false;
  }
  for (const rf of world.reefs) {
    if (Math.abs(rf.x - x) > rf.radius + 200 || Math.abs(rf.y - y) > rf.radius + 200) continue;
    if (pointInPolygon(x, y, rf.poly) || closestOnPolygon(x, y, rf.poly).d2 < 150 * 150) return false;
  }
  for (const w of world.whirlpools) if (Math.hypot(w.x - x, w.y - y) < w.radius * 1.3) return false;
  return true;
}

/** A point `off` metres out from an island's shore toward an angle (null: the water there is not open). */
export function offshore(world: World, is: Island, angle: number, off: number): [number, number] | null {
  const dx = Math.sin(angle), dy = -Math.cos(angle);
  let d = 0;
  while (d < is.radius + 40 && pointInPolygon(is.x + dx * d, is.y + dy * d, is.poly)) d += 12;
  for (let k = d; k < d + off + 900; k += 20) {
    const x = is.x + dx * k, y = is.y + dy * k;
    if (isLand(world, x, y)) continue;
    if (Math.sqrt(closestOnPolygon(x, y, is.poly).d2) < off) continue;
    return openWater(world, x, y) ? [Math.round(x), Math.round(y)] : null;
  }
  return null;
}

const cache = new WeakMap<World, AdvMap>();

/** The adventure map of a world: every thing and every guard, where the world alone puts them. `keep` false: worked
 *  out and not kept (step 6 of the generation looks at it before the islands the sea has raised since are put back). */
export function buildAdv(world: World, keep = true): AdvMap {
  const hit = cache.get(world);
  if (hit) return hit;
  // Step 8 (shared/src/world/newports.ts): the map of the world as she stood before her twenty new towns, whose islands
  // keep off all of it — every thing and guard where and what it was, its id with it.
  const pre = beforePorts(world);
  if (pre !== world) {
    const out = buildAdv(pre, keep);
    if (keep) cache.set(world, out);
    return out;
  }
  // docs/18 III: placed on the world as it stood before her new islands (which keep off all of it).
  const base = legacyWorld(world);
  if (base !== world) {
    // docs/19 D2: the old map as it was, and as many again appended on the world as she is now.
    const old = buildAdv(base);
    const more = buildAdvMore(world, old);
    const out = { objs: [...old.objs, ...more.objs], guards: [...old.guards, ...more.guards], legacy: { objs: old.objs.length, guards: old.guards.length } };
    if (keep) cache.set(world, out);
    return out;
  }
  const objs: AdvObj[] = [];
  const guards: AdvGuard[] = [];
  const taken: [number, number][] = [];
  const ports = world.ports.filter((p) => !p.raft);
  const free = (x: number, y: number, gap = 700) => taken.every(([a, b]) => Math.hypot(a - x, b - y) >= gap) && ports.every((p) => Math.hypot(p.x - x, p.y - y) >= 1600);
  const levelAt = (x: number, y: number) => sectorAt(world, x, y).level;
  let gseq = 0;
  const addGuard = (x: number, y: number, region: RegionId, size: GuardSize, at: string | undefined, salt: string): AdvGuard => {
    const level = levelAt(x, y);
    const kinds = guardKindsAt(level, REGIONS[region].strangeness > 0.3);
    const kind = at?.startsWith('m') ? (level >= 6 && h(`gk:${salt}`) % 3 === 0 ? 'wreck' : 'holdout') : kinds[h(`gk:${salt}`) % kinds.length];
    const g: AdvGuard = { id: `g${gseq++}`, kind, x, y, level, size, region, ...(at ? { at } : {}), heading: ((h(`gh:${salt}`) % 628) / 100) };
    guards.push(g);
    taken.push([x, y]);
    return g;
  };
  // Each region's wild islands in an order of their own (the Abyss keeps none of this).
  const by = new Map<RegionId, Island[]>();
  for (const is of world.islands) {
    if (is.portId || is.minor || is.raft || is.region === 'the_abyss' || is.radius < 140) continue;
    const list = by.get(is.region) ?? [];
    list.push(is);
    by.set(is.region, list);
  }
  const regions = [...by.keys()].sort();
  // Two obelisks a region; a third in the two regions with the most islands (sixteen in all).
  const extra = new Set([...regions].sort((a, b) => (by.get(b)!.length - by.get(a)!.length) || a.localeCompare(b)).slice(0, Math.max(0, OBELISKS - 2 * regions.length)));
  let oseq = 0;
  for (const region of regions) {
    const order = [...by.get(region)!].sort((a, b) => h(`adv:${world.seed}:${a.id}`) - h(`adv:${world.seed}:${b.id}`) || a.id - b.id);
    let cursor = 0;
    for (const kind of OBJ_KINDS) {
      const def = OBJS[kind];
      const want = kind === 'obelisk' ? 2 + (extra.has(region) ? 1 : 0) : def.per;
      let made = 0, guardedMade = 0;
      for (let tries = 0; made < want && tries < order.length * 2; tries++) {
        const is = order[cursor++ % order.length];
        const angle = ((h(`oa:${kind}:${is.id}:${tries}`) % 6283) / 1000);
        const off = 240 + (h(`oo:${is.id}:${tries}`) % 140);
        const p = offshore(world, is, angle, off);
        if (!p || !free(p[0], p[1])) continue;
        const id = `o${oseq++}`;
        const o: AdvObj = { id, kind, x: p[0], y: p[1], level: levelAt(p[0], p[1]), region, island: is.name };
        if (kind === 'store') o.good = MILL_GOODS[h(`og:${id}`) % MILL_GOODS.length];
        taken.push(p);
        // Its guard stands a little further out, between it and the open sea.
        if (guardedMade < def.guarded) {
          const g = offshore(world, is, angle, off + 150);
          if (g && taken.every(([a, b]) => (a === p[0] && b === p[1]) || Math.hypot(a - g[0], b - g[1]) >= 400)) {
            o.guard = addGuard(g[0], g[1], region, def.size, id, id).id;
            guardedMade++;
          }
        }
        objs.push(o);
        made++;
      }
    }
    // Two straits a region: the narrow water between two islands a little way apart.
    const isl = order.slice(0, 60);
    let straits = 0;
    for (let i = 0; i < isl.length && straits < 2; i++) {
      for (let j = i + 1; j < isl.length && straits < 2; j++) {
        const a = isl[i], b = isl[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
        if (gap < 250 || gap > 900) continue;
        const x = Math.round((a.x * b.radius + b.x * a.radius) / (a.radius + b.radius)), y = Math.round((a.y * b.radius + b.y * a.radius) / (a.radius + b.radius));
        if (!openWater(world, x, y) || !free(x, y, 900)) continue;
        addGuard(x, y, region, h(`gs:${a.id}:${b.id}`) % 2 ? 'avg' : 'weak', undefined, `s${a.id}:${b.id}`);
        straits++;
      }
    }
  }
  // Half the mines stand guarded (by each mine's own hash): off the island, where the boats would land.
  for (const m of buildMines(world).filter((x) => !x.extra)) {
    if (h(`mguard:${m.id}`) % 2) continue;
    const is = world.islands[m.islandId];
    for (let k = 0; k < 6; k++) {
      const p = offshore(world, is, ((h(`ma:${m.id}`) % 628) / 100) + k * 1.05, 200);
      if (!p || !free(p[0], p[1], 500)) continue;
      addGuard(p[0], p[1], m.region, 'avg', m.id, m.id);
      break;
    }
  }
  const out = { objs, guards };
  if (keep) cache.set(world, out);
  return out;
}

// ------------------------------------------------------------------------------------------------ docs/19 D2: twice as many

/** docs/19 D2 (owner, 2026-10-02: «увеличь всё ровно в 2 раза»): the adventure map's things and guards as many again,
 *  the obelisks left at sixteen. The new ones stand on the world as she is now (step 6's islands, the dense sea's marks
 *  of step 7 kept clear), each region's wild islands in an order of their own, off every old point; their ids follow
 *  the old ones (o…, g…), which keep theirs and their places. Their guards: the guarded things' own, the second six
 *  mines' (half of them, by each mine's own hash), and the straits to make up as many as there were. */
function buildAdvMore(world: World, old: AdvMap): AdvMap {
  const objs: AdvObj[] = [];
  const guards: AdvGuard[] = [];
  const taken: [number, number][] = [...old.objs.map((o) => [o.x, o.y] as [number, number]), ...old.guards.map((g) => [g.x, g.y] as [number, number])];
  const ports = world.ports.filter((p) => !p.raft);
  const markClear = (x: number, y: number) => marksNear(world, x, y, 400).every((m) => Math.hypot(m.x - x, m.y - y) > m.r + 160);
  const free = (x: number, y: number, gap = 700) => taken.every(([a, b]) => Math.hypot(a - x, b - y) >= gap) && ports.every((p) => Math.hypot(p.x - x, p.y - y) >= 1600) && markClear(x, y);
  const levelAt = (x: number, y: number) => sectorAt(world, x, y).level;
  let gseq = old.guards.length, oseq = old.objs.length;
  const addGuard = (x: number, y: number, region: RegionId, size: GuardSize, at: string | undefined, salt: string): AdvGuard => {
    const level = levelAt(x, y);
    const kinds = guardKindsAt(level, REGIONS[region].strangeness > 0.3);
    const kind = at?.startsWith('m') ? (level >= 6 && h(`gk:${salt}`) % 3 === 0 ? 'wreck' : 'holdout') : kinds[h(`gk:${salt}`) % kinds.length];
    const g: AdvGuard = { id: `g${gseq++}`, kind, x, y, level, size, region, ...(at ? { at } : {}), heading: ((h(`gh:${salt}`) % 628) / 100) };
    guards.push(g);
    taken.push([x, y]);
    return g;
  };
  const by = new Map<RegionId, Island[]>();
  for (const is of world.islands) {
    if (is.portId || is.minor || is.raft || is.slot || is.region === 'the_abyss' || is.radius < 140) continue;
    const list = by.get(is.region) ?? [];
    list.push(is);
    by.set(is.region, list);
  }
  const regions = [...by.keys()].sort();
  const orders = new Map(regions.map((r) => [r, [...by.get(r)!].sort((a, b) => h(`adv2:${world.seed}:${a.id}`) - h(`adv2:${world.seed}:${b.id}`) || a.id - b.id)]));
  for (const region of regions) {
    const order = orders.get(region)!;
    let cursor = 0;
    for (const kind of OBJ_KINDS) {
      if (kind === 'obelisk') continue; // sixteen of them, as ever
      const def = OBJS[kind];
      let made = 0, guardedMade = 0;
      for (let tries = 0; made < def.per && tries < order.length * 3; tries++) {
        const is = order[cursor++ % order.length];
        const angle = ((h(`oa2:${kind}:${is.id}:${tries}`) % 6283) / 1000);
        const off = 240 + (h(`oo2:${is.id}:${tries}`) % 140);
        const p = offshore(world, is, angle, off);
        if (!p || !free(p[0], p[1])) continue;
        const id = `o${oseq++}`;
        const o: AdvObj = { id, kind, x: p[0], y: p[1], level: levelAt(p[0], p[1]), region, island: is.name };
        if (kind === 'store') o.good = MILL_GOODS[h(`og:${id}`) % MILL_GOODS.length];
        taken.push(p);
        if (guardedMade < def.guarded) {
          const g = offshore(world, is, angle, off + 150);
          if (g && taken.every(([a, b]) => (a === p[0] && b === p[1]) || Math.hypot(a - g[0], b - g[1]) >= 400) && markClear(g[0], g[1]) && ports.every((q) => Math.hypot(q.x - g[0], q.y - g[1]) >= 1600)) {
            o.guard = addGuard(g[0], g[1], region, def.size, id, id).id;
            guardedMade++;
          }
        }
        objs.push(o);
        made++;
      }
    }
  }
  // The second six mines: half guarded, as the first.
  for (const m of buildMines(world).filter((x) => x.extra)) {
    if (h(`mguard:${m.id}`) % 2) continue;
    const is = world.islands[m.islandId];
    for (let k = 0; k < 6; k++) {
      const p = offshore(world, is, ((h(`ma:${m.id}`) % 628) / 100) + k * 1.05, 200);
      if (!p || !free(p[0], p[1], 500)) continue;
      addGuard(p[0], p[1], m.region, 'avg', m.id, m.id);
      break;
    }
  }
  // Straits to make up as many guards as there were, the regions by turns.
  const want = old.guards.length;
  const pairs = new Map(regions.map((r) => [r, { i: 0, j: 1 }]));
  for (let round = 0; guards.length < want && round < 400; round++) {
    let any = false;
    for (const region of regions) {
      if (guards.length >= want) break;
      const isl = orders.get(region)!.slice(0, 80);
      const c = pairs.get(region)!;
      let done = false;
      while (!done && c.i < isl.length) {
        if (c.j >= isl.length) {
          c.i++;
          c.j = c.i + 1;
          continue;
        }
        const a = isl[c.i], b = isl[c.j++];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
        if (gap < 250 || gap > 900) continue;
        const x = Math.round((a.x * b.radius + b.x * a.radius) / (a.radius + b.radius)), y = Math.round((a.y * b.radius + b.y * a.radius) / (a.radius + b.radius));
        if (!openWater(world, x, y) || !free(x, y, 900)) continue;
        addGuard(x, y, region, h(`gs:${a.id}:${b.id}`) % 2 ? 'avg' : 'weak', undefined, `s${a.id}:${b.id}`);
        done = any = true;
      }
    }
    if (!any) break;
  }
  return { objs, guards };
}
