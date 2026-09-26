// Shipwright — "The hull remembers every hand." docs/03_TALENT_TREES.md §4.8. 24 talents, 37 ranks.
// Construction, armour, weight, fittings, crafting and salvage; rules in server/src/game/wrightfx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'shipwright' });

export const SHIPWRIGHT: TalentDef[] = [
  // T1
  t({ id: 'shp_sound_timbers', name: 'Sound Timbers', tier: 1, maxRank: 3, keystone: false, description: 'Armour +4% per rank.', perRank: { armorPct: 0.04 } }),
  t({ id: 'shp_trim_ballast', name: 'Trim the Ballast', tier: 1, maxRank: 2, keystone: false, description: 'Speed lost to the weight of guns and fittings −10% per rank.', perRank: { ballast: -0.1 } }),
  t({ id: 'shp_salvager', name: 'Salvager', tier: 1, maxRank: 3, keystone: false, description: 'Wrecks yield 10% more materials per rank: planks, iron, sailcloth, powder.', perRank: { salvage: 0.1 } }),
  t({ id: 'shp_yard_credit', name: 'Yard Credit', tier: 1, maxRank: 2, keystone: false, description: 'Shipyard repairs and refits 10% cheaper per rank.', perRank: { yardCost: -0.1 } }),
  t({ id: 'shp_copper_sheathing', name: 'Copper Sheathing', tier: 1, maxRank: 1, keystone: false, description: 'Growth on the hull (the curse of the sea) and wear on a long voyage build up 50% slower.', flags: ['copper_sheathing'] }),
  // T2
  t({ id: 'shp_master_fitter', name: 'Master Fitter', tier: 2, maxRank: 1, keystone: false, description: 'One fitting of your choice may be taken one level beyond its limit.', flags: ['master_fitter'] }),
  t({ id: 'shp_reinforced_bow', name: 'Reinforced Bow', tier: 2, maxRank: 2, keystone: false, description: 'Ramming damage dealt +20% per rank; ramming damage taken −20% per rank.', perRank: { ramDealt: 0.2, ramTaken: -0.2 } }),
  t({ id: 'shp_improved_carriages', name: 'Improved Carriages', tier: 2, maxRank: 2, keystone: false, description: 'Broadside guns train 5° per rank toward where you aim.', perRank: { gunTrain: 5 } }),
  t({ id: 'shp_sail_loft', name: 'Sail Loft', tier: 2, maxRank: 2, keystone: false, description: 'Sail strength +8% per rank.', perRank: { sailHpMax: 0.08 } }),
  t({ id: 'shp_field_forge', name: 'Field Forge', tier: 2, maxRank: 1, keystone: false, description: 'Craft at sea from what is in the hold: round, chain and grape from iron and powder; planks from timber.', flags: ['field_forge'] }),
  // T3
  t({ id: 'shp_bulkheads', name: 'Watertight Bulkheads', tier: 3, maxRank: 2, keystone: false, description: 'Leaks are plugged 25% faster per rank, and no more than 2 (rank 1) / 1 (rank 2) can be open at once.', perRank: { bulkheads: 1 } }),
  t({ id: 'shp_modular_refit', name: 'Modular Refit', tier: 3, maxRank: 1, keystone: false, description: 'Fittings can be changed in any port, and taking one out costs nothing.', flags: ['modular_refit'] }),
  t({ id: 'shp_masterwork', name: 'Masterwork', tier: 3, maxRank: 2, keystone: false, description: 'Each fitting made at a yard has a 10% per rank better chance to come out Excellent (its bonus +50%).', perRank: { masterwork: 0.1 } }),
  t({ id: 'shp_ironbound_masts', name: 'Ironbound Masts', tier: 3, maxRank: 1, keystone: false, description: 'Your masts cannot be shot away; the sails still suffer as usual.', flags: ['ironbound_masts'] }),
  t({ id: 'shp_light_frame', name: 'Light Frame', tier: 3, maxRank: 2, keystone: false, description: 'Acceleration +6% per rank; maximum hull −2% per rank.', perRank: { accel: 0.06, hullMax: -0.02 } }),
  // T4
  t({ id: 'shp_iron_strapping', name: 'Iron Strapping', tier: 4, maxRank: 2, keystone: false, requires: 'shp_sound_timbers', requiresRank: 2, description: 'Against heavy (armour-piercing) shot and rams, armour +10% per rank.', perRank: { strapping: 0.1 } }),
  t({ id: 'shp_hold_expansion', name: 'Hold Expansion', tier: 4, maxRank: 2, keystone: false, description: 'Hold +6% per rank; maximum speed −1% per rank.', perRank: { holdVolume: 0.06, maxSpeed: -0.01 } }),
  t({ id: 'shp_spare_rigging', name: 'Spare Rigging', tier: 4, maxRank: 1, keystone: false, description: 'Sails can be repaired in combat at 30% speed.', flags: ['spare_rigging'] }),
  t({ id: 'shp_prize_refit', name: 'Prize Refit', tier: 4, maxRank: 1, keystone: false, description: 'Prizes are patched to full hull when taken, and free and Confederacy prize courts pay 20% more for them.', flags: ['prize_refit'] }),
  // T5
  t({ id: 'shp_legendary_keel', name: 'Legendary Keel', tier: 5, maxRank: 1, keystone: false, description: 'One hull class of your choice gets a Legendary Keel: +5% hull, +5% hold, +3% speed. It can be moved to another class once per 7 days.', flags: ['legendary_keel'] }),
  t({ id: 'shp_perfect_balance', name: 'Perfect Balance', tier: 5, maxRank: 2, keystone: false, requires: 'shp_master_fitter', description: 'Bonuses of your fittings +5% per rank.', perRank: { fittings: 0.05 } }),
  t({ id: 'shp_boneyard_secrets', name: 'Boneyard Secrets', tier: 5, maxRank: 1, keystone: false, requires: 'shp_salvager', requiresRank: 2, description: "Salvaging wrecks in Dead Man's Expanse has a 1% chance to turn up the plans of Ghost Timbers — a fitting no yard sells.", flags: ['boneyard_secrets'] }),
  // Keystones
  t({ id: 'shp_iron_coffin', name: 'Iron Coffin', tier: 6, maxRank: 1, keystone: true, excludes: 'shp_overgunned', description: 'KEYSTONE. Armour +40% (cap +90%) and no single broadside can take more than 20% of your hull. Nothing restores your hull in combat — no repairs, no regeneration, no healing. Maximum speed −5%.', flags: ['iron_coffin'], fixed: { armorPct: 0.4, maxSpeed: -0.05 } }),
  t({ id: 'shp_overgunned', name: 'Overgunned', tier: 6, maxRank: 1, keystone: true, excludes: 'shp_iron_coffin', description: 'KEYSTONE. Two more guns on each side than the class allows and one more bow chaser. −12% maximum speed, −15% turn, and every full broadside strains the hull for 0.5% of its maximum.', flags: ['overgunned'], fixed: { maxSpeed: -0.12, turnRate: -0.15 } }),
];
