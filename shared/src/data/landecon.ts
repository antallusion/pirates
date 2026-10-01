// The land's resources in the economy (docs/18 V, item 43). The lairs leave shell, bone and venom (and pearls, the
// H3 resource of the same name); here is what they are for, and where they go so that they do not only pile up:
//
//  - the town (H3): the upgrades of the dwellings of tiers 2–7, the pen and the castle ask for some of them besides
//    their silver and goods (TOWN_LAND);
//  - the creature dwellings flagged over beaten lairs (docs/18 #19): "settled" for shell and bone, they grow half as
//    many again and keep three weeks — and eat a little bone each week they grow so (DWELL_UP);
//  - the island's workshop: four artifacts of docs/17 H2 made from them (CRAFTS — the pictures they already wear);
//  - the ship's fittings: three of the captain's own, a rank at a time — shell plating, bone knees, venomed grape
//    (FITTINGS; they go with the captain from hull to hull, as her gear does);
//  - the sinks: the store keeps LAND_RES_CAP of each at most (the rest rots on the beach), the island's market buys
//    them at its poor rates, the upgraded dwellings eat bone, the creatures of the deep eat it when the rum runs out.
//
// Pure data and reckoning: server/src/game/landecon.ts applies it, the town's screen shows it.

import type { LandRes } from './bestiary.ts';
import type { Tr } from './estate.ts';
import type { GoodId } from './goods.ts';
import type { StatMods } from './stats.ts';
import type { TownId } from './town.ts';

export type LandCost = Partial<Record<LandRes, number>>;

/** The most of each of the land's resources a captain's store keeps (more rots on the beach). */
export const LAND_RES_CAP = 250;

/** What a level of a town building asks of the land's resources besides its silver and goods (none: nothing). The
 *  upgraded dwellings of tiers 2–7 (their level 2), the pen and the great pen, the castle. */
export function townLand(id: TownId, level: number): LandCost {
  switch (id) {
    case 'dw2': return level >= 2 ? { shell: 6 } : {};
    case 'dw3': return level >= 2 ? { bone: 6 } : {};
    case 'dw4': return level >= 2 ? { shell: 8, bone: 4 } : {};
    case 'dw5': return level >= 2 ? { bone: 10, venom: 4 } : {};
    case 'dw6': return level >= 2 ? { shell: 12, venom: 6 } : {};
    case 'dw7': return level >= 2 ? { bone: 14, venom: 8 } : {};
    case 'pen': return level >= 2 ? { shell: 12, bone: 12 } : { bone: 6 };
    case 'keep': return level >= 3 ? { shell: 20, bone: 10 } : {};
    default: return {};
  }
}

// ------------------------------------------------------------------------------------------------ the creature dwellings

/** A creature dwelling settled (its level 2): shell and bone and silver by its kind's tier; it grows half as many
 *  again, keeps three weeks' growth, and eats `upkeep` bone each week it grows so (a week without the bone in her
 *  store, it grows as a plain one). */
export const DWELL_UP = {
  growth: 1.5,
  weeks: 3,
  cost: (tier: number): { silver: number; land: LandCost } => ({ silver: 250 * tier, land: { shell: 3 * tier, bone: 3 * tier } }),
  upkeep: (tier: number): number => Math.ceil(tier / 2),
};

// ------------------------------------------------------------------------------------------------ the workshop

export interface CraftDef {
  /** The artifact made (shared/src/data/artifacts.ts). */
  art: string;
  land: LandCost;
  goods: Partial<Record<GoodId, number>>;
  silver: number;
  /** The island's market level the workshop needs. */
  market: number;
}

/** What the island's workshop makes of the land's resources: four artifacts of H2, cheaper than a merchant's price
 *  (their worth is in the shell, the bone and the venom spent). */
export const CRAFTS: CraftDef[] = [
  { art: 'mail_lined_coat', land: { shell: 16, bone: 6 }, goods: {}, silver: 600, market: 1 },
  { art: 'cartridge_bandolier', land: { venom: 10, bone: 8 }, goods: {}, silver: 1200, market: 1 },
  { art: 'orca_talisman', land: { bone: 22 }, goods: { pearls: 3 }, silver: 1200, market: 2 },
  { art: 'mercy_medal', land: { venom: 20, shell: 14 }, goods: { pearls: 6 }, silver: 3500, market: 3 },
];

// ------------------------------------------------------------------------------------------------ the ship's fittings

export type FittingId = 'shell_plating' | 'bone_knees' | 'venom_grape';
export const FITTING_IDS: FittingId[] = ['shell_plating', 'bone_knees', 'venom_grape'];

export interface FittingDef {
  id: FittingId;
  name: Tr;
  text: Tr;
  icon: string;
  /** The land's resource it is made of (a rank: per × rank of it), and the silver. */
  res: LandRes;
  per: number;
  silver: number;
  /** A rank's line at sea. */
  mods: StatMods;
}

export const FITTING_MAX = 3;

export const FITTINGS: Record<FittingId, FittingDef> = {
  shell_plating: { id: 'shell_plating', name: ['Shell Plating', 'Панцирная обшивка'], text: ['Turtle shell under the wales: every rank −2% damage to the hull.', 'Черепаший панцирь под привальным брусом: каждая ступень — −2% урона корпусу.'], icon: 'tattoo_turtle', res: 'shell', per: 12, silver: 600, mods: { incomingDamageMul: -0.02 } },
  bone_knees: { id: 'bone_knees', name: ['Bone Knees', 'Костяные кницы'], text: ['Knees and riders of leviathan bone: every rank +3% hull.', 'Кницы и ридерсы из кости левиафана: каждая ступень — +3% прочности корпуса.'], icon: 'good_whalebone', res: 'bone', per: 12, silver: 600, mods: { hullMax: 0.03 } },
  venom_grape: { id: 'venom_grape', name: ['Venomed Grape', 'Ядовитая картечь'], text: ['Grape rolled in the marsh serpents’ venom: every rank +5% men struck down by the guns.', 'Картечь, вываленная в яде болотных змей: каждая ступень — +5% людей, выбитых пушками.'], icon: 'mod_lantern_gland', res: 'venom', per: 8, silver: 800, mods: { crewKillMul: 0.05 } },
};

/** A fitting's next rank: what it asks. */
export function fittingCost(id: FittingId, rank: number): { silver: number; land: LandCost } {
  const d = FITTINGS[id];
  const r = Math.max(1, Math.min(FITTING_MAX, rank));
  return { silver: d.silver * r, land: { [d.res]: d.per * r } };
}

/** What her fittings do at sea, summed. */
export function fittingMods(fit: Partial<Record<FittingId, number>> | undefined): StatMods {
  const m: StatMods = {};
  for (const id of FITTING_IDS) {
    const r = Math.max(0, Math.min(FITTING_MAX, Math.floor(fit?.[id] ?? 0)));
    if (!r) continue;
    for (const [k, v] of Object.entries(FITTINGS[id].mods) as [keyof StatMods, number][]) m[k] = (m[k] ?? 0) + v * r;
  }
  return m;
}

// ------------------------------------------------------------------------------------------------ the market's price

/** What the island's market pays for a piece of the land's resources: twice its poor rate for goods (a fifth, a
 *  quarter, three tenths of the base) of the piece's reckoned silver — four tenths to six tenths. */
export function landSell(value: number, marketLevel: number): number {
  return Math.round(value * [0, 0.4, 0.5, 0.6][Math.max(0, Math.min(3, marketLevel))] * 10) / 10;
}

/** Whether a store holds a cost. */
export function landHas(have: Partial<Record<LandRes, number>>, cost: LandCost): boolean {
  return (Object.entries(cost) as [LandRes, number][]).every(([r, n]) => (have[r] ?? 0) >= n);
}
