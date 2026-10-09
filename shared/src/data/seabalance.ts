// The sea fight by the table (docs/25 §1.1 and items 1–12, owner 2026-10-09): «должно быть 11-15 залпов при полном
// вооружении коробля и капитана, и где-то 21-25 залпов при голых короблях - но на высоких уровнях. на низких можно
// сократить это количество… Если это нпс то на 30% меньше».
//
// Broadsides to sink an equal of her ⚓ = base(⚓) × her defence / the shooter's offence:
//   base(⚓)  = 6 + 2·(⚓−1): bare against bare (their talents and hero, no gear) — 6 at ⚓1, 24 at ⚓10;
//   offence  = what gear adds to a broadside, toward ×(1.1 + 0.11·⚓) in full gear (×2.2 at ⚓10), each line a little less;
//   defence  = what gear adds to her hull, toward ×(1 + 0.025·⚓) in full gear (×1.25 at ⚓10), the same way.
// «Full gear» is the reference kit below (every open slot legendary, Excellent, tempered ×5, at her ⚓), so the ceilings
// follow the items as they are. A ball into a ship of the ladder strikes by her ⚓ (SEA_HULL_PACE) so that the bare
// warship of each ⚓ sinks in base(⚓); the sea's own ships are scaled to the table by their ⚓ (NPC_SEA, ELITE_SEA).
// All measured and re-weighed by tools/balance-sea.ts; held by tests/balance/sea.test.ts.

import { AFFIXES, CAPTAIN_SLOTS, ITEM_BASES, LEGENDARY_ITEMS, SHIP_SLOTS, SLOT_OPENS, affixValue, gearSource } from './items.ts';
import type { AffixId, Item, Rarity } from './items.ts';
import type { StatMods } from './stats.ts';

export const SEA_ANCHOR_MAX = 10;
const clampA = (a: number) => Math.max(1, Math.min(SEA_ANCHOR_MAX, Math.round(a)));

/** Broadsides that sink a bare equal of her ⚓, bare (talents and hero, no gear). */
export function seaBase(anchor: number): number {
  return 6 + 2 * (clampA(anchor) - 1);
}
/** What full gear makes of a broadside at her ⚓ (×1.21 at ⚓1, ×2.2 at ⚓10). */
export function gearOffCeil(anchor: number): number {
  return 1.1 + 0.11 * clampA(anchor);
}
/** What full gear makes of her hull against broadsides at her ⚓ (×1.025 at ⚓1, ×1.25 at ⚓10). */
export function gearDefCeil(anchor: number): number {
  return 1 + 0.025 * clampA(anchor);
}

/** Diminishing returns: 0 at nothing, 1 at the full kit's lines, a little more past it, never more than 1.16. */
export const DR_K = 2;
export function seaDr(x: number): number {
  if (x <= 0) return x; // a cost line is felt as it reads
  return (1 - Math.exp(-DR_K * x)) / (1 - Math.exp(-DR_K));
}

/** Armour against the hull's lines: a point of armour (0.01) weighs as 1.5% of hull. */
export const ARMOR_WEIGHT = 1.5;
/** The share of her armour a heavy ball meets (the demi-cannon's pierce, Iron Rain's): her gear's armour is raised so
 *  that it holds its share of her defence through it (shipstats.ts gearArmor). */
export const ARMOR_SEEN = 0.7;
/** The gear's lines for her hull against broadsides, in shares of hull: hull, armour and «less damage». */
export function defRaw(mods: StatMods): number {
  return (mods.hullMax ?? 0) + ARMOR_WEIGHT * (mods.armor ?? 0) - (mods.incomingDamageMul ?? 0);
}

// ------------------------------------------------------------------------------------------------ the full kit

const REF_SHIP: Record<string, string> = { sails: 'canvas_sails', rigging: 'iron_rigging', plating: 'iron_belt', rudder: 'balanced_rudder', hold: 'deep_hold', quarters: 'hammocks', battery: 'double_charge', banner: 'crown_ensign', relic: 'storm_glass' };
const REF_CAPTAIN: Record<string, string> = { hat: 'gunner_cap', coat: 'uniform', sash: 'powder_horn', boots: 'seaboots', blade: 'cutlass', pistols: 'duelling_pistols', spyglass: 'ranging_glass', compass: 'brass_compass', charm: 'orca_tooth', ring: 'gold_hoop' };
const REF_SHIP_LINES: AffixId[] = ['damage', 'armor', 'hull', 'reload'];
const REF_CAPTAIN_LINES: AffixId[] = ['marksmanship', 'reload', 'spread', 'nerve', 'leadership'];

/** «Full gear» at her ⚓: every slot her ⚓ has opened (the fishing tackle aside) and all ten of the captain's, each
 *  legendary, Excellent, tempered ×5, of her ⚓, with three extra lines — gun damage, armour, hull on the ship's; aim,
 *  reload, spread on the captain's. The reference the ceilings above are reached at. */
export function referenceKit(anchor: number): Item[] {
  const a = clampA(anchor);
  const out: Item[] = [];
  let uid = 1;
  const make = (baseId: string, lines: AffixId[]): void => {
    const b = ITEM_BASES[baseId as keyof typeof ITEM_BASES];
    if (!b) return;
    const it: Item = { uid: uid++, base: b.id, ilvl: a, rarity: 4 as Rarity, affixes: [], dur: 100, excellent: true, temper: 5 };
    const leg = Object.values(LEGENDARY_ITEMS).find((l) => l.base === b.id);
    if (leg) it.legendary = leg.id;
    for (const id of lines) {
      if (it.affixes.length >= 3) break;
      const d = AFFIXES[id];
      if ((b.main && d.stat && d.stat in b.main) || (b.cap && d.cap && d.cap in b.cap)) continue;
      it.affixes.push({ a: id, v: affixValue(id, a, 4 as Rarity) });
    }
    out.push(it);
  };
  for (const sl of SHIP_SLOTS) if (sl !== 'tackle' && a >= SLOT_OPENS[sl]) make(REF_SHIP[sl], REF_SHIP_LINES);
  for (const sl of CAPTAIN_SLOTS) make(REF_CAPTAIN[sl], REF_CAPTAIN_LINES);
  return out;
}

const fullMemo = new Map<number, { off: number; def: number; reload: number }>();
/** The full kit's raw lines at her ⚓: gun damage, hull (defRaw) and reload (as a positive share). */
export function fullRaw(anchor: number): { off: number; def: number; reload: number } {
  const a = clampA(anchor);
  let f = fullMemo.get(a);
  if (!f) {
    const m = gearSource(referenceKit(a)).mods;
    f = { off: Math.max(0.01, m.gunDamageMul ?? 0), def: Math.max(0.01, defRaw(m)), reload: Math.max(0.01, -(m.reloadMul ?? 0)) };
    fullMemo.set(a, f);
  }
  return f;
}

/** Her gear's broadside multiplier at her ⚓ from its gun-damage lines. */
export function gearOffence(raw: number, anchor: number): number {
  return Math.max(0.5, 1 + (gearOffCeil(anchor) - 1) * seaDr(raw / fullRaw(anchor).off));
}
/** Her gear's hull multiplier against broadsides at her ⚓ from its hull, armour and «less damage» lines. */
export function gearDefence(raw: number, anchor: number): number {
  return Math.max(0.5, 1 + (gearDefCeil(anchor) - 1) * seaDr(raw / fullRaw(anchor).def));
}
/** Her gear's reload multiplier: the full kit's lines take a sixth off her reload, more lines less each (a cost line
 *  slows her as it reads). Reload is time, not broadsides: the table counts broadsides. */
export const GEAR_RELOAD_FULL = 0.16;
export function gearReload(raw: number, anchor: number): number {
  if (raw >= 0) return 1 + raw;
  return Math.max(0.7, 1 - GEAR_RELOAD_FULL * seaDr(-raw / fullRaw(anchor).reload));
}

/** Half the gain of full gear (the sea's own ships' gunnery and hulls, docs/25 item 7). */
export function halfGearOff(anchor: number): number {
  return 1 + (gearOffCeil(anchor) - 1) / 2;
}
export function halfGearDef(anchor: number): number {
  return 1 + (gearDefCeil(anchor) - 1) / 2;
}

/** The sea's own ships sink in 30% fewer broadsides than a captain of the same gear (item 7). */
export const NPC_VOLLEYS = 0.7;

/** The table's broadsides: `def` her defence factor, `off` the shooter's offence factor (both 1 when bare). */
export function seaVolleys(anchor: number, def: number, off: number): number {
  return (seaBase(anchor) * def) / Math.max(0.01, off);
}

/** What a sea ship of her ⚓ is to the table: a common one fights as a captain in half gear and sinks in 30% fewer
 *  broadsides; an elite as a captain in full gear, without the discount. */
export function npcFactors(anchor: number, elite: boolean): { off: number; def: number } {
  return elite ? { off: gearOffCeil(anchor), def: gearDefCeil(anchor) } : { off: halfGearOff(anchor), def: NPC_VOLLEYS * halfGearDef(anchor) };
}

// ------------------------------------------------------------------------------------------------ the alpha strike

/** No broadside takes more than 2.5 times the table's share of a hull of her ⚓ (a full captain on a bare one: ≈ 50% at
 *  ⚓1, ≈ 23% at ⚓10); past it the balls strike a quarter as hard — never for nothing (item 1). */
export const ALPHA_MUL = 2.5;
export const ALPHA_OVER = 0.25;
export function alphaShare(anchor: number): number {
  return (ALPHA_MUL * gearOffCeil(anchor)) / seaBase(anchor);
}
/** Off the ladder (monsters, bosses, hulks): their old 30% a broadside, the balls past it a quarter as hard. */
export const ALPHA_OFF_LADDER = 0.3;

// ------------------------------------------------------------------------------------------------ the measured scales

/** A ball into the hull of a ship of the ladder, × by her (fighting) ⚓: the bare warship of each ⚓ sinks in base(⚓)
 *  bare broadsides of her equal (was SEA_DAMAGE 5, ×1.3 from ⚓7: every equal in 4 broadsides, the 30% cap's). Measured
 *  by tools/balance-sea.ts --calibrate, index = ⚓ (0 unused). */
export const SEA_HULL_PACE = [5, 1.382, 1.029, 0.592, 0.397, 0.274, 0.185, 0.154, 0.16, 0.147, 0.135];
export function seaHullPace(anchor: number): number {
  return SEA_HULL_PACE[clampA(anchor)];
}

/** Her men a round-shot broadside of a bare equal takes (item 8: «каждый лёгший залп — 2–4% её абордажной армии,
 *  картечь — вдвое»): 2% while her side is sound, 4% through a shattered one (army.ts wallsOf), by her ⚓. Was the hull's
 *  ×5 — 15–24% of her men a broadside. Index = ⚓, measured by tools/balance-sea.ts --calibrate. */
export const SEA_CREW_PACE = [5, 0.567, 0.542, 0.554, 0.634, 0.23, 0.209, 0.244, 0.214, 0.314, 0.334];
export function seaCrewPace(anchor: number): number {
  return SEA_CREW_PACE[clampA(anchor)];
}
/** …and a broadside of grape: 6% of her men (twice round's on the mean side: grape sweeps the open deck whatever her
 *  side), by her ⚓. */
export const SEA_GRAPE_PACE = [5, 0.247, 0.24, 0.24, 0.229, 0.244, 0.232, 0.278, 0.264, 0.391, 0.389];
export function seaGrapePace(anchor: number): number {
  return SEA_GRAPE_PACE[clampA(anchor)];
}
/** Her parts struck (rudder, a gun dismounted, a leak, a fire, a breach, the powder room): the chance a ball keeps the
 *  same count over a fight as in the fights of four broadsides it was weighed in (more broadsides, each less likely). */
export function seaCritPace(anchor: number): number {
  return Math.min(1, 4 / seaBase(anchor));
}
/** Iron Rain (item 9): the share of any armour her balls go through. */
export const IRON_RAIN_PIERCE = 0.1;

/** Her guns' reload by her own ⚓, × the quick fight's (gunnery.ts SEA_RELOAD): a fight of the table's broadsides under way
 *  takes 25–35 s at ⚓1 and about two minutes at ⚓10 in full gear (§1.1). Measured under way, bot against bot, by
 *  tools/balance-sea.ts --moving --calibrate. Index = ⚓. */
export const SEA_RELOAD_BY = [1, 2.9, 3, 2.8, 2.6, 2.6, 2.7, 2.8, 2.9, 2.6, 2.6];
export function seaReloadBy(anchor: number): number {
  return SEA_RELOAD_BY[clampA(anchor)];
}

/** The sea's own ships of each ⚓ against the table (index = ⚓): hull × and guns × over her class at her level. */
export const NPC_SEA_TABLE: [number, number][] = [[1, 1], [0.709, 1.149], [0.74, 1.279], [0.773, 2.037], [0.788, 2.576], [0.845, 2.434], [0.87, 3.333], [0.824, 3.478], [1.018, 3.597], [1.012, 6.241], [1.025, 6.452]];
export const ELITE_SEA_TABLE: [number, number][] = [[2.5, 1.5], [1.026, 1.285], [1.083, 1.425], [1.144, 2.398], [1.22, 3.124], [1.278, 3.032], [1.273, 4.251], [1.309, 4.532], [1.524, 4.78], [1.604, 8.443], [1.61, 8.871]];
export const NPC_SEA = NPC_SEA_TABLE.map(([hull, guns]) => ({ hull, guns }));
export const ELITE_SEA = ELITE_SEA_TABLE.map(([hull, guns]) => ({ hull, guns }));
export function npcSeaScale(anchor: number, elite: boolean): { hull: number; guns: number } {
  return (elite ? ELITE_SEA : NPC_SEA)[clampA(anchor)];
}
