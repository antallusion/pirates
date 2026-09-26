// Building a ship at a yard (docs/02 §3): a plan, a frame and a planking of chosen timber, rare materials,
// a figurehead, and the side-grade lines of a good plan. The result rides on the loadout as `build` and is
// applied by computeShipStats as its own multipliers (docs/03 §3.3: class, modules and figureheads are separate).

import type { FactionId } from './factions.ts';
import type { GoodId } from './goods.ts';
import type { ShipClassId } from './ships.ts';
import type { Flag, StatMods } from './stats.ts';

export type WoodId = 'pine' | 'oak' | 'teak' | 'black_oak' | 'ironwood' | 'cursed_wood';
export type RareSlot = 'keel' | 'belt' | 'sails' | 'guns' | 'paint';
export type FigureheadId = 'fh_crown_lion' | 'fh_red_devil' | 'fh_weeping_widow' | 'fh_fog_owl' | 'fh_harpooneer' | 'fh_gilded_scale' | 'fh_drowned_man' | 'fh_serpent' | 'fh_saint_of_wrecks';
export type PlanQuality = 'common' | 'good' | 'masterwork' | 'legendary';
export type VariantId = 'roomy_hold' | 'stiff_frame' | 'light_rig' | 'gun_deck' | 'fast_lines' | 'thick_skin' | 'wide_beam' | 'sharp_helm';

export interface WoodDef {
  id: WoodId;
  name: string;
  hull: number; // frame HP multiplier
  armor: number; // planking armour multiplier
  speed: number; // from weight
  fire: number; // flammability (fireRisk)
  cost: number; // price multiplier
  time: number; // build time multiplier
  /** Region or ports where the timber grows or is sold. */
  ports: string[] | 'all';
  description: string;
}

export const WOODS: Record<WoodId, WoodDef> = {
  pine: { id: 'pine', name: 'Pine', hull: 0.85, armor: 0.8, speed: 0.03, fire: 0.25, cost: 0.7, time: 0.8, ports: 'all', description: 'Light and cheap, quick to mend — and quick to burn.' },
  oak: { id: 'oak', name: 'Oak', hull: 1, armor: 1, speed: 0, fire: 0, cost: 1, time: 1, ports: ['gravesend', 'blackwater', 'saltmarrow', 'hollowmere'], description: 'The measure of every other timber.' },
  teak: { id: 'teak', name: 'Teak', hull: 1.05, armor: 1.05, speed: 0.01, fire: -0.15, cost: 1.1, time: 1, ports: ['hollowmere', 'fogmouth'], description: 'Does not rot in warm water; the worm will not touch it.' },
  black_oak: { id: 'black_oak', name: 'Black Oak', hull: 1.2, armor: 1.25, speed: -0.04, fire: -0.2, cost: 1.35, time: 1.5, ports: ['fogmouth'], description: 'From the Whispering marshes. Shot glances off it.' },
  ironwood: { id: 'ironwood', name: 'Ironwood', hull: 1.1, armor: 1.45, speed: -0.08, fire: -0.4, cost: 2, time: 1.3, ports: ['cinderhold'], description: 'Volcanic groves of the Ashen Isles. Heavy, deep-drawing, nearly fireproof.' },
  cursed_wood: { id: 'cursed_wood', name: 'Cursed Wood', hull: 1, armor: 1.1, speed: 0.04, fire: 0.1, cost: 1.5, time: 1.2, ports: ['saint_maw'], description: 'Heals itself in the dark, even in battle. The crew hears it breathing (−1 morale in 10 min without a deep pastor).' },
};

export interface RareDef {
  slot: RareSlot;
  good: GoodId;
  units: number;
  name: string;
  mods: StatMods;
  flags?: Flag[];
  description: string;
}

export const RARES: Record<RareSlot, RareDef[]> = {
  keel: [{ slot: 'keel', good: 'leviathan_bone', units: 4, name: 'Leviathan-bone keel', mods: { hullMax: 0.15 }, description: '+15% hull.' }],
  belt: [{ slot: 'belt', good: 'abyssal_ore', units: 6, name: 'Abyssal-metal belt', mods: { armorPct: 0.2, leakInflow: -0.3 }, description: '+20% armour at the waterline, leaks −30%.' }],
  sails: [
    { slot: 'sails', good: 'drowned_silk', units: 3, name: 'Drowned-silk sails', mods: { maxSpeed: 0.06 }, flags: ['drowned_silk'], description: '+6% speed; the canvas mends itself (1% every 10 s). −1 morale an hour.' },
    { slot: 'sails', good: 'whale_oil', units: 8, name: 'Oil-proofed canvas', mods: { fireRisk: -0.2 }, description: 'Fire damage −20%.' },
  ],
  guns: [{ slot: 'guns', good: 'sulfur_iron', units: 5, name: 'Sulfur-iron guns', mods: { gunDamageMul: 0.05 }, description: '+5% gun damage.' }],
  paint: [{ slot: 'paint', good: 'kraken_ink', units: 2, name: 'Kraken-ink paint', mods: { signature: -0.1 }, description: '−10% signature.' }],
};

export interface FigureheadDef {
  id: FigureheadId;
  name: string;
  port: string | null; // null: found, not sold
  price: number;
  mods: StatMods;
  flags?: Flag[];
  description: string;
}

export const FIGUREHEADS: Record<FigureheadId, FigureheadDef> = {
  fh_crown_lion: { id: 'fh_crown_lion', name: 'Crown Lion', port: 'gravesend', price: 900, mods: {}, flags: ['fh_crown_lion'], description: 'Crown standing grows 10% faster; patrols search you less (−10%).' },
  fh_red_devil: { id: 'fh_red_devil', name: 'Red Devil', port: 'cinderhold', price: 900, mods: { boardingPower: 0.05 }, description: '+5% boarding power.' },
  fh_weeping_widow: { id: 'fh_weeping_widow', name: 'Weeping Widow', port: 'tidewrack', price: 800, mods: { moraleLoss: -0.1 }, description: 'Morale lost to dead shipmates −20% (−10% of all morale losses).' },
  fh_fog_owl: { id: 'fh_fog_owl', name: 'Fog Owl', port: 'fogmouth', price: 800, mods: { fogSight: 0.1 }, description: '+10% sight in fog.' },
  fh_harpooneer: { id: 'fh_harpooneer', name: 'Harpooneer', port: 'harpoon_rest', price: 800, mods: {}, flags: ['fh_harpooneer'], description: '+10% damage against monsters.' },
  fh_gilded_scale: { id: 'fh_gilded_scale', name: 'Gilded Scale', port: 'hollowmere', price: 1100, mods: {}, flags: ['fh_gilded_scale'], description: 'League ports: +5% on what you sell.' },
  fh_drowned_man: { id: 'fh_drowned_man', name: 'Drowned Man', port: 'saint_maw', price: 1000, mods: {}, flags: ['fh_drowned_man'], description: 'The Drowned Captain enters every fight with 10 Dread.' },
  fh_serpent: { id: 'fh_serpent', name: 'Sea Serpent', port: null, price: 0, mods: { maxSpeed: 0.03, ramDealt: 0.1 }, description: '+3% speed, rams +10%. Found in ship graveyards.' },
  fh_saint_of_wrecks: { id: 'fh_saint_of_wrecks', name: 'Saint of Wrecks', port: 'wrecktide', price: 900, mods: {}, flags: ['fh_saint_of_wrecks'], description: '+5 s before she goes down.' },
};

export interface VariantDef {
  id: VariantId;
  name: string;
  mods: StatMods;
}

/** Side-grade lines of a plan: every gain is paid for. */
export const VARIANTS: Record<VariantId, VariantDef> = {
  roomy_hold: { id: 'roomy_hold', name: '+6% hold / −4% speed', mods: { holdVolume: 0.06, maxSpeed: -0.04 } },
  stiff_frame: { id: 'stiff_frame', name: '+8% hull / −4% turn', mods: { hullMax: 0.08, turnRate: -0.04 } },
  light_rig: { id: 'light_rig', name: '+4% speed / −8% sail HP', mods: { maxSpeed: 0.04, sailHpMax: -0.08 } },
  gun_deck: { id: 'gun_deck', name: '+5% gun damage / −6% hull', mods: { gunDamageMul: 0.05, hullMax: -0.06 } },
  fast_lines: { id: 'fast_lines', name: '+3% speed / −6% hold', mods: { maxSpeed: 0.03, holdVolume: -0.06 } },
  thick_skin: { id: 'thick_skin', name: '+8% armour / −3% speed', mods: { armorPct: 0.08, maxSpeed: -0.03 } },
  wide_beam: { id: 'wide_beam', name: '+10% crew / −3% speed', mods: { crewMax: 0.1, maxSpeed: -0.03 } },
  sharp_helm: { id: 'sharp_helm', name: '+6% turn / −5% hull', mods: { turnRate: 0.06, hullMax: -0.05 } },
};

export const PLAN_LINES: Record<PlanQuality, number> = { common: 0, good: 1, masterwork: 2, legendary: 3 };
export const PLAN_USES: Record<PlanQuality, number> = { common: Infinity, good: 10, masterwork: 3, legendary: 1 };

export interface ShipBuild {
  frame: WoodId;
  plank: WoodId;
  rares: { slot: RareSlot; good: GoodId }[];
  figurehead?: FigureheadId;
  quality: PlanQuality;
  variants: VariantId[];
  excellent?: boolean;
  builder: string; // the yard that laid her down
}

export interface Plan {
  id: string;
  classId: ShipClassId | null; // null: any class
  quality: PlanQuality;
  variants: VariantId[];
  uses: number;
}

/** Plans a yard sells to captains its faction respects (Good quality). */
export const PLAN_REP = 30;
export const YARD_FACTIONS_WITH_PLANS: FactionId[] = ['crown', 'league', 'confederacy', 'harpoon', 'choir'];

/** Timber, planks, sailcloth and iron a hull of this tier eats. */
export function buildMaterials(tier: number): Partial<Record<GoodId, number>> {
  return { timber: 20 * tier + 10, planks: 10 * tier, sailcloth: 6 * tier, iron: 4 * tier };
}

/** Build time in seconds by class tier. */
export const BUILD_TIME = [0, 300, 900, 1800, 3600, 7200];

/** The stat sources a build adds to a ship (frame, planking, rares, figurehead, plan lines, excellence). */
export function buildSources(build: ShipBuild | undefined, baseArmor: number): { mods: StatMods; flags: Flag[] }[] {
  if (!build) return [];
  const f = WOODS[build.frame], pl = WOODS[build.plank];
  const out: { mods: StatMods; flags: Flag[] }[] = [];
  out.push({
    mods: {
      hullMax: f.hull - 1,
      armor: baseArmor * (pl.armor - 1),
      maxSpeed: (f.speed + pl.speed) / 2,
      fireRisk: pl.fire,
      repairRate: build.frame === 'pine' ? 0.3 : 0,
      draftMul: build.frame === 'ironwood' || build.plank === 'ironwood' ? 0.1 : 0,
    },
    flags: build.frame === 'cursed_wood' || build.plank === 'cursed_wood' ? ['cursed_wood'] : [],
  });
  for (const r of build.rares) {
    const def = RARES[r.slot].find((x) => x.good === r.good);
    if (def) out.push({ mods: def.mods, flags: def.flags ?? [] });
  }
  if (build.figurehead) {
    const fh = FIGUREHEADS[build.figurehead];
    out.push({ mods: fh.mods, flags: fh.flags ?? [] });
  }
  for (const v of build.variants) out.push({ mods: VARIANTS[v].mods, flags: [] });
  if (build.excellent) out.push({ mods: { hullMax: 0.05, maxSpeed: 0.03 }, flags: [] });
  // Armour percentages of a build are shares of the class's own armour.
  for (const o of out) {
    if (o.mods.armorPct) {
      o.mods = { ...o.mods, armor: (o.mods.armor ?? 0) + baseArmor * o.mods.armorPct };
      delete o.mods.armorPct;
    }
  }
  return out;
}
