// A captain's «Мощь» (owner, 2026-10-31: «рейтинг должен строиться на мощи: 1) армии 2) корабля 3) апгрейдов зданий» —
// «и вещей» — «выводи в рейтинг именно по этой мощи»). Four parts, each read off her save with the game's own math and
// put on one scale (a full top build ≈ 10 000 in each), and their weighted sum, the rating's main board:
//
//   ARMY   = armyPower(her stacks) / ARMY_DIV          — HoMM3's men × health × blows (army.ts), tiers and upgrades in it;
//                                                        10 000 = the norm army of a ⚓10 ship of the line, full hammocks.
//   SHIP   = √(broadside × staying power) × fittings / SHIP_DIV — her active ship as the yard made her (computeShipStats
//            without the captain's talents and gear: those are the hero's and the gear's): the broadside = guns a side ×
//            the gun's damage ÷ its reload × her gun and reload multipliers (her level ⚓ in them); the staying power =
//            hull ÷ (1 − armour) ÷ damage taken + ⅓ of her canvas; the fittings = 1 + 1.5% a level of every fitting
//            (a boss's plan 3%), so a refit never counts for nothing. 10 000 ≈ a ⚓10 ship of the line fully fitted.
//   ISLAND = 10 000 × √(the silver and the resources, at their base prices, sunk into her island's town — every level of
//            the hall, the keep, the market, the guild, the seven dwellings, the warehouse, the shipyard, the battery,
//            the fort, the Grail and the pen (townCost / treeCost) — plus half of what her workings and other buildings
//            cost (baseCost), against the whole town at its greatest); capped there: the greatest island is 10 000. (The
//            root: the dear last levels would leave a young island at a few dozen.)
//   GEAR   = the items she wears (the captain's ten slots) and her ship's (the slots her level has opened): each
//            ILVL × RARITY × Excellent × tempering, an artifact by its class, and every set bonus in force; 10 000 ≈
//            twenty legendary pieces of ⚓10, tempered and Excellent, in full sets.
//   TOTAL  = 0.35·ARMY + 0.25·SHIP + 0.20·ISLAND + 0.20·GEAR.
//
// Pure and deterministic: the server's rating (server/src/game/siterating.ts) and the Captain window read the same.
// Monotone: a man more, a level more of a ship, a fitting, a building or an item never lowers a part.

import { UNITS, armyForLevel, armyPower } from './army.ts';
import type { ArmyStack } from './army.ts';
import { CAPTAINS } from './captains.ts';
import type { CaptainId } from './captains.ts';
import { GUNS, MODULES, SHIP_CLASSES } from './ships.ts';
import type { ModuleId } from './ships.ts';
import { SETS, SHIP_SLOTS, SLOT_OPENS } from './items.ts';
import type { Item } from './items.ts';
import { ARTIFACTS, ART_SETS, fullRelics, fullSets } from './artifacts.ts';
import type { ArtClass } from './artifacts.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { TOWN_IDS, townCost } from './town.ts';
import type { TownId } from './town.ts';
import { TREE_BASE, TREE_MAX, isTree, treeCost } from './isletree.ts';
import type { TreeId } from './isletree.ts';
import { baseCost } from './base.ts';
import { levelRange, shipLevelOf } from './shiplevel.ts';
import { computeShipStats } from '../sim/shipstats.ts';
import type { ShipLoadout } from '../sim/shipstats.ts';

export type PowerPart = 'army' | 'ship' | 'isle' | 'gear';
export const POWER_PARTS: PowerPart[] = ['army', 'ship', 'isle', 'gear'];
/** The weights of the total (they sum to 1: a full top build ≈ 10 000). */
export const POWER_WEIGHTS: Record<PowerPart, number> = { army: 0.35, ship: 0.25, isle: 0.2, gear: 0.2 };
/** Each part's top (the greatest island exactly; the others a full top build, which a titan or a set may pass). */
export const POWER_TOP = 10_000;

export interface PowerScore {
  total: number;
  army: number;
  ship: number;
  isle: number;
  gear: number;
}

/** Her island as the power reads it: the town's buildings and the tree's of the base by id → level (hall, keep, market,
 *  guild, dw1…dw7, grail, pen, warehouse, shipyard, battery, fort), and the rest that stands on it — the workings
 *  (`p:lumber`…) and the other buildings (tavern, pier…) — each with its level. */
export interface PowerIsle {
  town: Partial<Record<string, number>>;
  other: { id: string; level: number }[];
}

export interface PowerInput {
  captain: CaptainId | string;
  army: readonly ArmyStack[];
  /** Her active ship (null: none). */
  loadout: ShipLoadout | null;
  /** The captain's own gear in its slots. */
  captainGear: readonly (Item | null | undefined)[];
  isle: PowerIsle | null;
}

const fin = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

// ------------------------------------------------------------------------------------------------ the army

/** The raw power of the norm army of a ⚓10 ship of the line at full hammocks: ARMY's 10 000. */
const ARMY_REF = (() => {
  const st = computeShipStats({ classId: 'ship_of_the_line', name: '', guns: { port: 'heavy_18', starboard: 'heavy_18' }, modules: {}, level: 10 }, 'navigator' as CaptainId, {});
  return armyPower(armyForLevel(10, st.crewMax, 7, 'player'));
})();

/** ARMY: her stacks' armyPower on the 10 000 scale (an unknown kind left out). */
export function armyScore(army: readonly ArmyStack[]): number {
  const ok = army.filter((s) => s && UNITS[s.u] && Number.isFinite(s.n) && s.n > 0);
  return Math.round(fin((armyPower(ok) / ARMY_REF) * POWER_TOP));
}

// ------------------------------------------------------------------------------------------------ the ship

/** A fitting's weight a level: a boss's plan twice a yard's. */
const fitWeight = (id: string) => (MODULES[id as ModuleId]?.blueprint ? 0.03 : 0.015);

/** The ship's raw might: √(broadside a second × what she takes) × her fittings. */
export function shipRaw(loadout: ShipLoadout, captain: CaptainId | string): number {
  if (!SHIP_CLASSES[loadout.classId]) return 0;
  const cap = (Object.hasOwn(CAPTAINS, captain) ? captain : 'navigator') as CaptainId;
  // (her hull as the yard made her: the gear is GEAR's, the talents and the hero the captain's)
  const st = computeShipStats({ ...loadout, gear: undefined }, cap, {});
  const side = (g: string | undefined) => {
    const d = GUNS[g as keyof typeof GUNS] ?? GUNS.light_6;
    return (st.gunsPerSide * d.damage * st.gunDamageMul) / (d.reload * st.reloadMul);
  };
  const broadside = (side(loadout.guns?.port) + side(loadout.guns?.starboard)) / 2 + (st.bowChasers * GUNS.long_9.damage * st.gunDamageMul) / (GUNS.long_9.reload * st.reloadMul) / 4;
  const stay = st.hullMax / Math.max(0.2, 1 - st.armor) / Math.max(0.2, st.incomingDamageMul) + st.sailHpMax / 3;
  let fits = 1;
  for (const [id, lv] of Object.entries(loadout.modules ?? {})) if ((lv ?? 0) > 0 && MODULES[id as ModuleId]) fits += fitWeight(id) * Math.min(lv ?? 0, MODULES[id as ModuleId].maxLevel + 1);
  if (loadout.keel) fits += 0.05;
  return fin(Math.sqrt(fin(broadside) * fin(stay)) * fits);
}

/** A ship of the line at ⚓10, her yard's fittings all at their greatest, 18-pounders: SHIP's 10 000. */
const SHIP_REF = (() => {
  const modules: Partial<Record<ModuleId, number>> = {};
  for (const id of ['hull_plating', 'sail_plan', 'rudder', 'hold_expansion', 'crew_quarters'] as ModuleId[]) modules[id] = MODULES[id].maxLevel;
  return shipRaw({ classId: 'ship_of_the_line', name: '', guns: { port: 'heavy_18', starboard: 'heavy_18' }, modules, level: levelRange('ship_of_the_line')[1] }, 'navigator');
})();

/** SHIP: her active ship on the 10 000 scale (none: 0). */
export function shipScore(loadout: ShipLoadout | null, captain: CaptainId | string): number {
  if (!loadout) return 0;
  try {
    return Math.round((shipRaw(loadout, captain) / SHIP_REF) * POWER_TOP);
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------------------------------------------ the island

/** What a cost is worth: its silver and its resources at their base prices. */
const worth = (c: { silver: number; goods: Partial<Record<GoodId, number>> }) =>
  c.silver + Object.entries(c.goods).reduce((s, [g, n]) => s + (GOODS[g as GoodId]?.basePrice ?? 0) * (n ?? 0), 0);

const TOWN_MAX: Record<string, number> = { grail: 1, pen: 2 };
/** Every level of a town (or tree) building up to `level`, what it cost. */
function townWorth(id: string, level: number): number {
  const top = isTree(id) ? TREE_MAX : TOWN_MAX[id] ?? 0;
  const L = Math.max(0, Math.min(top, Math.floor(level)));
  let w = 0;
  for (let l = 1; l <= L; l++) w += worth(isTree(id) ? treeCost(id as TreeId, l) : townCost(id as TownId, l));
  return w;
}
/** The rest: a working or a building, every level of it. */
function otherWorth(id: string, level: number): number {
  const L = Math.max(0, Math.min(5, Math.floor(level)));
  let w = 0;
  for (let l = 1; l <= L; l++) w += worth(baseCost(id, l));
  return w;
}

const TOWN_KEYS: string[] = [...new Set<string>([...TOWN_IDS, ...TREE_BASE])];
/** The whole town at its greatest: ISLAND's 10 000. */
const ISLE_REF = TOWN_KEYS.reduce((s, id) => s + townWorth(id, isTree(id) ? TREE_MAX : TOWN_MAX[id] ?? 0), 0);

/** ISLAND: what stands on her island on the 10 000 scale (no island: 0). */
export function isleScore(isle: PowerIsle | null): number {
  if (!isle) return 0;
  let w = 0;
  for (const id of TOWN_KEYS) w += townWorth(id, isle.town[id] ?? 0);
  for (const o of isle.other) if (!TOWN_KEYS.includes(o.id)) w += otherWorth(o.id, o.level) / 2;
  return Math.round(Math.sqrt(Math.min(1, fin(w) / ISLE_REF)) * POWER_TOP);
}

// ------------------------------------------------------------------------------------------------ the gear

/** Each rarity's weight (its lines: RARITY_MUL, and its extra lines: none, one, two, three, three and a gift). */
const RARITY_W = [1, 1.5, 2.2, 3.2, 4.6];
const ART_W: Record<ArtClass, number> = { treasure: 2.2, minor: 2.6, major: 3.6, relic: 4.6 };
/** One item's weight before the scale: ilvl × rarity × Excellent × tempering; an artifact by its class at ⚓10. */
export function itemRaw(it: Item): number {
  const a = it.art ? ARTIFACTS[it.art] : undefined;
  if (a) return 10 * ART_W[a.cls];
  const r = RARITY_W[Math.max(0, Math.min(4, Math.floor(it.rarity ?? 0)))];
  return Math.max(1, Math.min(10, Math.floor(it.ilvl ?? 1))) * r * (it.excellent ? 1.25 : 1) * (1 + 0.04 * Math.max(0, Math.min(5, it.temper ?? 0)));
}
/** A set bonus in force: this much a piece it asks; a whole artifact set or relic: SET_FULL. */
const SET_STEP = 4;
const SET_FULL = 30;

/** What she wears that counts: the captain's slots, and her ship's slots her level has opened. */
export function wornForPower(captainGear: readonly (Item | null | undefined)[], loadout: ShipLoadout | null): Item[] {
  const out = captainGear.filter((x): x is Item => !!x && typeof x === 'object');
  if (loadout?.gear) {
    const lvl = shipLevelOf(loadout);
    for (const sl of SHIP_SLOTS) {
      const it = loadout.gear[sl];
      if (it && lvl >= SLOT_OPENS[sl]) out.push(it);
    }
  }
  return out;
}

const GEAR_REF = (() => {
  // twenty legendary pieces of ⚓10, Excellent, tempered to the top, three six-piece sets in force
  const one = 10 * RARITY_W[4] * 1.25 * 1.2;
  return 20 * one + 3 * SET_STEP * (2 + 4 + 6);
})();

/** GEAR: the items worn on the 10 000 scale. */
export function gearScore(worn: readonly Item[]): number {
  let raw = 0;
  const sets = new Map<string, number>();
  for (const it of worn) {
    raw += itemRaw(it);
    if (it.set && SETS[it.set]) sets.set(it.set, (sets.get(it.set) ?? 0) + 1);
  }
  for (const [set, n] of sets) for (const b of SETS[set as keyof typeof SETS].bonus) if (n >= b.n) raw += SET_STEP * b.n;
  try {
    raw += SET_FULL * (fullSets(worn).filter((s) => ART_SETS[s]).length + fullRelics(worn).length);
  } catch {
    /* an old save's artifact: no set */
  }
  return Math.round((fin(raw) / GEAR_REF) * POWER_TOP);
}

// ------------------------------------------------------------------------------------------------ all four

export function totalOf(p: Omit<PowerScore, 'total'>): number {
  return Math.round(POWER_PARTS.reduce((s, k) => s + POWER_WEIGHTS[k] * p[k], 0));
}

/** Her power: the four parts and the total. */
export function powerOf(c: PowerInput): PowerScore {
  const parts = {
    army: armyScore(c.army ?? []),
    ship: shipScore(c.loadout, c.captain),
    isle: isleScore(c.isle),
    gear: gearScore(wornForPower(c.captainGear ?? [], c.loadout)),
  };
  return { total: totalOf(parts), ...parts };
}

/** The references (tests and the report). */
export const POWER_REFS = { army: ARMY_REF, ship: SHIP_REF, isle: ISLE_REF, gear: GEAR_REF };
