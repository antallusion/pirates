// The curve of experience and what every source pays (docs/26_XP_CURVE.md; owner, 2026-10-08: «уровень сейчас растёт
// непропорционально, почти каждый бой даёт +1… чем больше уровень, тем больше кораблей потопить, абордажей сделать и
// квестов выполнить»).
//
// One unit: what a ship of her own level sunk teaches a captain (xpUnit, shared/src/constants.ts). A level asks
// killsPerLevel of them — 5 at the first, ~29 at the tenth, ~69 at the thirtieth, 200 and more past the fiftieth. Every
// source pays a number of units at the captain's own level, so a source keeps its worth in time at every level:
//
//  - a ship sunk 1, taken by boarding 2; the boarding battle's own lesson is a small bonus on top (≤ 0.2), never a second
//    prize (no double count);
//  - a quest of her level 6 (by its size), the main steady source of a captain who plays as the game asks;
//  - the creatures, the guards, the finds, the trade — each its share, held by tests/xpcurve.test.ts and the sim
//    tests/balance/xp.ts (node tools/balance-xp.ts).
//
// The colours of the prize (canon D12 as WoW's): a captain of level L may command ships up to ⚓shipBandOf(L); a target
// of that ⚓ is yellow (×1), one or more ⚓ above orange, red, a skull (×1.2, ×1.4, ×1.5); below her band it is green,
// worth less the further its band's top lies below her (1 − Δ/G, as WoW's zero difference: G = 0.31·L levels, at least
// 1.25), and grey past G: nothing. At level 4 a ship of ⚓1 (band 1–3) is green at a fifth of a ship of her own; at 5
// grey. At 20 a ship of ⚓4 (13–18) still pays two thirds, at 24 a fifth, at 26 nothing.

import { MAX_LEVEL, killsPerLevel, xpForLevel, xpUnit } from '../constants.ts';
import { CAPTAIN_LEVEL_FOR_SHIP, SHIP_LEVEL_MAX, hullsFor } from './shiplevel.ts';
import { SHIP_CLASSES } from './ships.ts';
import type { Threat } from './shiplevel.ts';
import type { Contract } from '../protocol.ts';

export { killsPerLevel, xpForLevel, xpUnit };

// ------------------------------------------------------------------------------------------------ the bands

/** The highest ⚓ a captain of this level may command (canon D12): the ships of her own level. */
export function shipBandOf(level: number): number {
  let v = 1;
  for (let k = 2; k <= SHIP_LEVEL_MAX; k++) if (CAPTAIN_LEVEL_FOR_SHIP[k] <= level) v = k;
  return v;
}

/** The captain levels whose own ships are of ⚓`ship`: from the one that may command her to the one before the next ⚓. */
export function bandLevels(ship: number): [number, number] {
  const v = Math.max(1, Math.min(SHIP_LEVEL_MAX, Math.round(ship)));
  return [CAPTAIN_LEVEL_FOR_SHIP[v], v >= SHIP_LEVEL_MAX ? MAX_LEVEL : CAPTAIN_LEVEL_FOR_SHIP[v + 1] - 1];
}

/** The captain a ship of ⚓`ship` is an even match for, at the middle of her band: a card's experience is quoted for her. */
export function refLevel(ship: number): number {
  const [lo, hi] = bandLevels(ship);
  return Math.round((lo + hi) / 2);
}

// ------------------------------------------------------------------------------------------------ the colours

/** Levels past a band's top at which its ships turn grey for a captain of this level (WoW's zero difference: wider as
 *  she grows, as a level is a smaller step for a senior). */
export function greyAfter(level: number): number {
  return Math.max(1.25, 0.31 * level);
}

/** The bonus of a target above her band: one ⚓ up, two, three and more. */
export const XP_ABOVE = [1, 1.2, 1.4, 1.5];

/** How a target of ⚓`ship` (her fighting level; null: off the ladder, a boss or a hulk) looks to a captain of this level
 *  for experience: grey, green, yellow, orange, red, a skull (the D12 colours). */
export function xpThreat(level: number, ship: number | null): Threat {
  if (ship === null) return 'even';
  const mine = shipBandOf(level), v = Math.max(0, Math.round(ship));
  if (v > mine) return v - mine === 1 ? 'hard' : v - mine === 2 ? 'deadly' : 'skull';
  if (v === mine) return 'even';
  return greenShare(level, v) > 0 ? 'easy' : 'trivial';
}

/** A green target's share: 1 − Δ/G, Δ the levels she stands past the top of its band; grey (nothing) once it would be
 *  less than GREY_BELOW. */
function greenShare(level: number, ship: number): number {
  const top = ship < 1 ? 0 : bandLevels(ship)[1];
  const d = level - top;
  if (d <= 0) return 1;
  const k = 1 - d / greyAfter(level);
  return k >= GREY_BELOW ? Math.round(k * 1000) / 1000 : 0;
}

/** A green share smaller than this is grey. */
export const GREY_BELOW = 0.05;

/** The share of a prize's experience by the colour of the target: 0 for a grey one. */
export function xpGap(level: number, ship: number | null): number {
  if (ship === null) return 1;
  const mine = shipBandOf(level), v = Math.max(0, Math.round(ship));
  if (v >= mine) return XP_ABOVE[Math.min(3, v - mine)];
  return greenShare(level, v);
}

// ------------------------------------------------------------------------------------------------ what each source is worth

/** Every source in units of her own level's ship sunk (docs/26 §3). */
export const XP_UNITS = {
  /** A ship of her level sunk; taken by boarding (the fight and the prize). */
  sunk: 1,
  boarded: 2,
  /** The boarding battle's own lesson (HoMM3's killed creatures), a bonus by the share of the enemy cut down. */
  battle: 0.2,
  /** Boarders thrown back. */
  repelled: 1,
  /** A captain of her group near when she takes a prize: this share of it. */
  mate: 0.4,
  /** A fight ashore or at sea against a lair's creatures (the fight is the lesson), by the share cut down. */
  creatures: 1,
  /** A quest of her level of the usual size (docs/26: the main steady source). */
  quest: 5,
  /** A port's contract: letters, a delivery (each of the usual length), a bounty for each ship (beside her prize). */
  courier: 1.5,
  delivery: 2,
  bounty: 0.4,
  /** A day's order (by its size, the order's legacy weight / 40) and the chest of all three. */
  dailyChest: 7,
  /** A deed of legend. */
  deed: 4,
  /** A shared goal of the sea, the guild or the world, a task of an island's people. */
  goal: 5,
  task: 5,
  /** A tutorial goal, and the first of the First Watch's five stages (each next a quarter more): its first three bring
   *  the second level before its boarding, which is weighed for a hero of the second level (docs/23 item 81). */
  tutorialGoal: 1.5,
  tutorialStage: 2,
} as const;

/** The small finds of the sea keep their old proportions: this many of their old points make one unit at her level. */
export const XP_POINT = 80;
/** The great ones — the world's bosses, the Dutchman, the ritual of the Abyss — twice as many (a raid's lesson is shared
 *  by the many who fought). */
export const BOSS_POINT = 160;
/** A zone's boss (docs/21): the whole of her lesson in units of her level's ship, shared by each captain's part. */
export const ZONE_BOSS_UNITS = 150;

/** A level's worth of the shares the adventure map and the creatures were written in (advLevelXp: a guard's 0.04 of
 *  it, a chest's 0.2, an altar's 0.25…): this many units of the ⚓'s even captain. */
export const ADV_UNITS = 25;

/** Units a sea-hour of silver earned by trade, charts or deliveries teaches (a trader's road is slower than a fighter's). */
export const SILVER_UNITS = 10;

/** A quest done far below her: never less than this share. */
export const QUEST_FLOOR = 0.1;

/** The usual hour at sea of a captain who hunts ships of her level (tests/balance/xp.ts, the hunting hour): units. The
 *  roaming stacks are held to a share of it (ROAM_XP_TARGET). */
export const HUNT_HOUR_UNITS = 42;

// ------------------------------------------------------------------------------------------------ the reckonings

/** `units` of her own level's ship, to a captain of this level. */
export function lumpXp(level: number, units: number): number {
  return Math.max(0, Math.round(units * xpUnit(level)));
}

/** `units` against a target of ⚓`ship` (null: off the ladder), by its colour: nothing for a grey one. */
export function targetXp(level: number, ship: number | null, units: number): number {
  return Math.max(0, Math.round(units * xpUnit(level) * xpGap(level, ship)));
}

/** A ship of ⚓`ship` (her fighting level) sunk or taken. */
export function prizeXp(level: number, ship: number | null, how: 'sunk' | 'boarded'): number {
  return targetXp(level, ship, how === 'sunk' ? XP_UNITS.sunk : XP_UNITS.boarded);
}

/** A battle won: `units` by the share of the enemy's hit points cut down. */
export function battleXp(level: number, ship: number | null, killedHp: number, totalHp: number, units: number = XP_UNITS.battle): number {
  const share = totalHp > 0 ? Math.max(0, Math.min(1, killedHp / totalHp)) : 0;
  return targetXp(level, ship, units * share);
}

/** Experience quoted for the even captain of ⚓`ship` (refLevel: the adventure map's and the creatures' cards), to a
 *  captain of this level: at her level's unit, by the colour. */
export function xpAt(level: number, ship: number, refXp: number): number {
  const v = Math.max(1, Math.min(SHIP_LEVEL_MAX, Math.round(ship)));
  return Math.max(0, Math.round((refXp * xpUnit(level) / xpUnit(refLevel(v))) * xpGap(level, v)));
}

/** A level's worth of experience as the adventure map reckons it at ⚓`ship` (ADV_UNITS of its even captain). */
export function advXp(ship: number): number {
  const v = Math.max(1, Math.min(SHIP_LEVEL_MAX, Math.round(ship)));
  return ADV_UNITS * xpUnit(refLevel(v));
}

/** Old points of a small find, at her level. */
export function pointsXp(level: number, points: number): number {
  return lumpXp(level, Math.max(0, points) / XP_POINT);
}

/** Old points of a great one (a world boss, a legend of the sea), at her level. */
export function bossXp(level: number, points: number): number {
  return lumpXp(level, Math.max(0, points) / BOSS_POINT);
}

/** A prize written before docs/26 as old experience at ⚓`ship` (a beast's, by its first level): its units — the old
 *  prize over the old sinking of a pirate of that level (40 × tier × (1 + tier/4)). */
export function legacyPrizeUnits(oldXp: number, ship: number): number {
  const hs = hullsFor('pirate', Math.max(1, Math.min(SHIP_LEVEL_MAX, ship)));
  const t = hs.reduce((a, c) => a + SHIP_CLASSES[c].tier, 0) / Math.max(1, hs.length);
  return Math.round((oldXp / (40 * t * (1 + t / 4))) * 100) / 100;
}

/** Silver an hour at sea earns a captain of ⚓`ship` (tests/balance/island.ts seaHour, advmap's advHour). */
export function hourSilver(ship: number): number {
  return Math.round(6 * 320 * 1.3 ** (Math.max(1, Math.min(SHIP_LEVEL_MAX, ship)) - 1));
}

/** Silver earned by trade, charts or deliveries, in experience: SILVER_UNITS a sea-hour of her ⚓'s silver. */
export function silverXp(level: number, silver: number, ship: number): number {
  return lumpXp(level, (Math.max(0, silver) / hourSilver(ship)) * SILVER_UNITS);
}

/** The usual hour's experience at ⚓`ship` (the hunting hour of her even captain). */
export function huntHourXp(ship: number): number {
  return HUNT_HOUR_UNITS * xpUnit(refLevel(ship));
}

// ------------------------------------------------------------------------------------------------ quests

/** A quest written before docs/26, by its old reward: its size against the old usual quest of its level (150 + 40 a
 *  level), held to 0.5–4 — the old proportions between the quests kept, their worth now in units. */
export function legacyQuestSize(oldXp: number, level: number): number {
  return Math.max(0.5, Math.min(4, Math.round((oldXp / (150 + 40 * Math.max(1, level))) * 100) / 100));
}

/** A quest's reward at its own level: `size` quests of the usual size (a generated job's plot weighs its steps). */
export function questXp(questLevel: number, size = 1): number {
  const x = size * XP_UNITS.quest * xpUnit(questLevel);
  return Math.max(10, Math.round(x / 10) * 10);
}

/** The level a quest pays at for a captain: her own while it is no higher than the top of the waters it was given in
 *  (as a zone of today's WoW scales to the player), never below the quest's own. */
export function questLevelFor(level: number, questLevel: number, watersTop: number): number {
  return Math.max(questLevel, Math.min(level, Math.max(questLevel, watersTop)));
}

/** A quest's share for a captain above the level it pays at: green as a ship, never below QUEST_FLOOR. */
export function questGap(level: number, paysAt: number): number {
  const d = level - paysAt;
  if (d <= 0) return 1;
  return Math.max(QUEST_FLOOR, 1 - d / greyAfter(level));
}

/** What a quest whose reward is `xp` at its level `questLevel` pays a captain of this level, given in waters whose
 *  captains reach `watersTop`. */
export function questXpFor(level: number, xp: number, questLevel: number, watersTop: number): number {
  const at = questLevelFor(level, Math.max(1, questLevel), watersTop);
  return Math.max(0, Math.round((xp * xpUnit(at)) / xpUnit(Math.max(1, questLevel)) * questGap(level, at)));
}

/** A level as a share past where she stands: "N% to the next level". */
export function levelPct(xp: number, next: number): number {
  return next > 0 ? Math.max(0, Math.min(99, Math.floor((xp / next) * 100))) : 0;
}

/** A port's contract done (ports.ts generateContracts): letters or a delivery over `n` legs of the usual length
 *  (12 km), or a bounty of `n` ships (each beside its own prize; a grey ship does not count towards it). */
export function contractXp(level: number, kind: 'courier' | 'delivery' | 'bounty', n = 1): number {
  const per = kind === 'courier' ? XP_UNITS.courier : kind === 'delivery' ? XP_UNITS.delivery : XP_UNITS.bounty;
  return lumpXp(level, per * Math.max(0.5, n));
}

/** The usual length of a contract's leg (metres). */
export const CONTRACT_LEG = 12000;

/** What a contract pays a captain of this level (one made before docs/26, without its units: its old points). */
export function contractPay(level: number, c: Pick<Contract, 'xp' | 'units'>): number {
  return c.units !== undefined ? lumpXp(level, c.units) : pointsXp(level, c.xp);
}

/** A contract as a captain of this level sees it. */
export function contractFor<T extends Pick<Contract, 'xp' | 'units'>>(level: number, c: T): T {
  return { ...c, xp: contractPay(level, c) };
}
