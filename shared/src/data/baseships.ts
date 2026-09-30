// The island's own ships (docs/15_PERSONAL_ISLAND.md, items 4–5). The shipyard of a captain's own island builds up
// to two ships of her own — a warship, a merchant, a fisher or a scout — from the island's yard and silver, on the
// wall clock like any other work of the base. They sail with her in the escorts' formation (fleet.ts), fight on her
// side, grow seasoned from what they help sink, fish and trade, and are raised a level at the island's shipyard,
// which in its level bounds how far they grow. A sunk one is not lost: she is towed home and laid up, to be mended.
//
// Squadron (the rule, both ways): no more than two of her own ships at sea at once, and they take the hired escorts'
// berths first — hired escorts only fill what berths her Command leaves over (escortSlots − own ships at sea). Her
// own ships need no commander, so a captain's squadron is never more than max(2, her escort berths) ≤ 3 ships.
//
// Island power (item 5): every building and producer counts its level, every ship of her own three times hers.
// The island's next level asks a power threshold as well as its silver and goods (ISLE_POWER); power of 60 or
// more also brings a third crew of builders.

import type { BaseCost, BaseRes } from './base.ts';
import type { Tr } from './estate.ts';
import { GUNS, SHIP_CLASSES, defaultGunFor } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { levelPower, levelRange, levelScale } from './shiplevel.ts';

export type OwnRole = 'war' | 'merchant' | 'fisher' | 'scout';
export const OWN_ROLES: OwnRole[] = ['war', 'merchant', 'fisher', 'scout'];

export interface OwnRoleDef {
  id: OwnRole;
  name: Tr;
  text: Tr;
  /** Her hulls as she grows, smallest first; the hull at a level is the last whose levels take it. */
  hulls: ShipClassId[];
  /** A hull first taken later than her class's first level (the warship's frigate only at ⚓8, docs/15 item 8). */
  from?: Partial<Record<ShipClassId, number>>;
  /** Building her: silver, the yard's goods and seconds of work. */
  silver: number;
  goods: Partial<Record<BaseRes, number>>;
  secs: number;
}

export const OWN_ROLE_DEFS: Record<OwnRole, OwnRoleDef> = {
  war: {
    id: 'war', name: ['Warship', 'Боевой корабль'], text: ['Fights at your side and takes the blows meant for you.', 'Бьётся рядом с вами и принимает удары на себя.'],
    hulls: ['cutter', 'brigantine', 'brig', 'frigate'], from: { frigate: 8 }, silver: 2500, goods: { timber: 80, coal: 20, tar: 25, iron: 30, provisions: 30 }, secs: 1200,
  },
  merchant: {
    id: 'merchant', name: ['Merchant', 'Торговый корабль'], text: ['Carries for you: half her hold is added to yours while she sails with you.', 'Везёт за вас: половина её трюма прибавляется к вашему, пока она идёт с вами.'],
    hulls: ['sloop', 'fluyt', 'galleon'], silver: 2000, goods: { timber: 90, coal: 10, tar: 25, iron: 15, provisions: 30 }, secs: 1200,
  },
  fisher: {
    id: 'fisher', name: ['Fisher', 'Рыбацкий корабль'], text: ['Nets the shoals you pass and brings the catch aboard.', 'Ловит в косяках на вашем пути и сдаёт улов вам в трюм.'],
    hulls: ['sloop', 'fishing_ketch'], silver: 1500, goods: { timber: 70, coal: 10, tar: 20, iron: 10, provisions: 25 }, secs: 900,
  },
  scout: {
    id: 'scout', name: ['Scout', 'Разведчик'], text: ['Her lookouts widen your sight: you see farther while she sails with you.', 'Её марсовые расширяют ваш обзор: вы видите дальше, пока она идёт с вами.'],
    hulls: ['cutter', 'schooner'], silver: 1800, goods: { timber: 60, coal: 10, tar: 20, iron: 15, provisions: 25 }, secs: 900,
  },
};

/** Her own ships: two at the most, built, laid up or at sea. */
export const OWN_SHIPS_MAX = 2;
/** The greatest level the island's shipyard builds to, by its own level (index: the shipyard's level). */
export const YARD_SHIP_LEVEL = [0, 3, 4, 5, 7, 8];
export const SHIPYARD_MAX = YARD_SHIP_LEVEL.length - 1;

/** The levels a role takes a hull at: her class's, from the role's own first level for it. */
function hullLevels(role: OwnRole, c: ShipClassId): [number, number] {
  const [lo, hi] = levelRange(c);
  return [Math.max(lo, OWN_ROLE_DEFS[role].from?.[c] ?? lo), hi];
}

/** Every level a role's hulls take, in order. */
export function roleLevels(role: OwnRole): number[] {
  const out = new Set<number>();
  for (const c of OWN_ROLE_DEFS[role].hulls) {
    const [lo, hi] = hullLevels(role, c);
    for (let l = lo; l <= hi; l++) out.add(l);
  }
  return [...out].sort((a, b) => a - b);
}

/** The hull she is at a level. */
export function hullFor(role: OwnRole, level: number): ShipClassId {
  const hulls = OWN_ROLE_DEFS[role].hulls;
  let best = hulls[0];
  for (const c of hulls) {
    const [lo, hi] = hullLevels(role, c);
    if (level >= lo && level <= hi) best = c;
  }
  return best;
}

// ------------------------------------------------------------------------------------------------ worth in a fight

/** The hulls a harbour master hires out as escorts (fleet.ts ESCORT_OFFERS): they sail at their commander's level,
 *  as far as each hull's levels go. */
export const HIRED_HULLS: ShipClassId[] = ['cutter', 'brigantine', 'brig'];

/** A hull's worth in a fight at a level, as the ladder reckons strength (docs/12 §3: hull times guns): her hull
 *  against her armour, times her broadside's weight of shot a second with her class's own guns. */
export function combatWorth(classId: ShipClassId, level: number): number {
  const d = SHIP_CLASSES[classId];
  const k = levelScale(classId, level);
  const g = GUNS[defaultGunFor(d)];
  return ((d.hull * k.hull) / (1 - d.armor)) * ((d.gunPortsPerSide * g.damage) / g.reload) * k.guns;
}

/** The best hired escort's worth at a level; beyond every hired hull's levels, the greatest of them grown by the
 *  ladder's 1.3 a level (what a hired hull of that level would be). */
export function hiredWorth(level: number): number {
  let best = 0, top = 0;
  for (const c of HIRED_HULLS) {
    const [lo, hi] = levelRange(c);
    if (level >= lo && level <= hi) best = Math.max(best, combatWorth(c, level));
    top = Math.max(top, combatWorth(c, Math.min(level, hi)) * levelPower(level - Math.min(level, hi) + 1));
  }
  return best || top;
}

/** Her own warship is worth no more than this many hired escorts of her level (docs/15 item 8). */
export const OWN_PARITY = 1.3;

/** The share of her hull and of her guns an own ship sails with, so that she is worth no more than OWN_PARITY hired
 *  escorts of her level (1: all of both; the island's frigate is lighter built and lighter gunned, ~0.83 each). */
export function ownParity(classId: ShipClassId, level: number): number {
  const w = combatWorth(classId, level), cap = OWN_PARITY * hiredWorth(level);
  return w <= cap ? 1 : Math.round(Math.sqrt(cap / w) * 1000) / 1000;
}

/** The level after this one (a bigger hull may skip one), or null at the role's greatest. */
export function nextOwnLevel(role: OwnRole, level: number): number | null {
  return roleLevels(role).find((l) => l > level) ?? null;
}

/** The shipyard's level that raises her to a level. */
export function yardLevelFor(level: number): number {
  const k = YARD_SHIP_LEVEL.findIndex((l, i) => i > 0 && l >= level);
  return k < 0 ? SHIPYARD_MAX + 1 : k;
}

/** Seasoning a ship needs before the shipyard raises her a level. */
export function ownXpNext(level: number): number {
  return Math.round(60 * Math.max(1, level) ** 1.6);
}

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
const MAX_SECS = 4 * 3600;

/** Building her (level 1). */
export function ownBuildCost(role: OwnRole): BaseCost {
  const d = OWN_ROLE_DEFS[role];
  return { silver: d.silver, goods: { ...d.goods }, secs: d.secs };
}

/** Raising her to a level at the island's shipyard. */
export function ownUpgradeCost(role: OwnRole, level: number): BaseCost {
  const d = OWN_ROLE_DEFS[role];
  const k = 0.5 + 0.25 * level;
  const goods: BaseCost['goods'] = {};
  for (const [g, n] of Object.entries(d.goods) as [BaseRes, number][]) goods[g] = Math.ceil(n * k);
  return { silver: round50(d.silver * 0.4 * level ** 1.7), goods, secs: Math.min(MAX_SECS, Math.round(d.secs * 0.75 * 1.45 ** (level - 1))) };
}

/** Mending her at the island: by the damage, dearer and longer for a hull that went down. */
export function ownRepairCost(role: OwnRole, level: number, hull: number, sunk: boolean): BaseCost {
  const d = OWN_ROLE_DEFS[role];
  const dmg = Math.max(0, Math.min(1, 1 - hull)) * (sunk ? 1.5 : 1);
  return {
    silver: round50(150 * Math.max(1, level) ** 1.3 * dmg),
    goods: { timber: Math.ceil((d.goods.timber ?? 0) * 0.4 * dmg), tar: Math.ceil((d.goods.tar ?? 0) * 0.4 * dmg) },
    secs: Math.round(300 + 1800 * dmg * (sunk ? 1.4 : 1)),
  };
}

/** Mending her in a port's yard: silver only, twice the island's. */
export function ownPortRepair(role: OwnRole, level: number, hull: number): number {
  const c = ownRepairCost(role, level, hull, false);
  return hull >= 0.999 ? 0 : c.silver * 2;
}

/** The merchant's share of her own hold added to the flagship's while she sails with her. */
export const MERCHANT_SHARE = 0.5;
export function merchantHold(classId: ShipClassId, level: number): number {
  return Math.round(SHIP_CLASSES[classId].holdVolume * levelScale(classId, level).hold * MERCHANT_SHARE);
}

/** The scout's lookouts: the flagship's sight widened by this share. */
export function scoutSight(level: number): number {
  return Math.round((0.15 + 0.03 * Math.max(1, level)) * 100) / 100;
}

/** The fisher's haul every FISH_EVERY seconds in a shoal. */
export const FISH_EVERY = 5;
export function fisherHaul(level: number): number {
  return 1 + Math.floor(Math.max(1, level) / 2);
}

/** Seasoning: a ship sunk or taken near her (its level), a minute at sea, a unit fished, silver of a sale. */
export const XP_FIGHT = 15;
export const XP_FIGHT_LEVEL = 6;
export const XP_SEA_EVERY = 30;
export const XP_FISH = 2;
export const XP_TRADE_SILVER = 100;
export const XP_TRADE_MAX = 60;

// ------------------------------------------------------------------------------------------------ island power

/** A ship of her own counts three times her level in the island's power; a building or producer its level. */
export const SHIP_POWER = 3;
/** The power the step up to each island level asks (index: the level; levels 1 and 2 ask none). */
export const ISLE_POWER = [0, 0, 0, 5, 12, 20, 32, 46, 62, 80, 100];
/** Power that brings a third crew of builders. */
export const POWER_CREW = 60;

export function islePower(things: number[], ships: number[]): number {
  return things.reduce((a, l) => a + Math.max(0, l), 0) + SHIP_POWER * ships.reduce((a, l) => a + Math.max(0, l), 0);
}

/** Her names (the same list for both tongues). */
export const OWN_NAMES: Tr[] = [
  ['Gull’s Luck', 'Удача чайки'], ['Black Wren', 'Чёрный крапивник'], ['Salt Widow', 'Солёная вдова'], ['Pale Lantern', 'Бледный фонарь'],
  ['Driftwood Maid', 'Дева с плавника'], ['Grey Heron', 'Серая цапля'], ['Quiet Undertow', 'Тихое течение'], ['Red Kestrel', 'Красная пустельга'],
  ['Low Tide Lady', 'Хозяйка отлива'], ['Brass Bell', 'Медный колокол'], ['Iron Bramble', 'Железный терн'], ['Hollow Oak', 'Дуплистый дуб'],
];
