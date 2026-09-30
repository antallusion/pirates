// Survival — "Stay afloat. Everything else is luxury." docs/03_TALENT_TREES.md §4.7. 24 talents, 39 ranks.
// Repairs, fires, leaks, provisions, sickness, weather and sinking; rules in server/src/game/survivalfx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'survival' });

export const SURVIVAL: TalentDef[] = [
  // T1
  t({ id: 'srv_carpenters', name: 'Carpenters', tier: 1, maxRank: 3, keystone: false, description: 'Repair speed +15% per rank.', perRank: { repairRate: 0.15 } }),
  t({ id: 'srv_ration_master', name: 'Ration Master', tier: 1, maxRank: 2, keystone: false, description: 'Provisions consumption −15% per rank.', perRank: { provisionUse: -0.15 } }),
  t({ id: 'srv_bucket_brigade', name: 'Bucket Brigade', tier: 1, maxRank: 3, keystone: false, description: 'Fires aboard are put out 15% faster per rank.', perRank: { fireFight: -0.15 } }),
  t({ id: 'srv_bilge_pumps', name: 'Bilge Pumps', tier: 1, maxRank: 2, keystone: false, description: 'Leaks let in 20% less water per rank.', perRank: { leakInflow: -0.2 } }),
  t({ id: 'srv_ships_surgeon', name: "Ship's Surgeon", tier: 1, maxRank: 2, keystone: false, description: '10% more per rank of the sailors "killed" in battle are only wounded, and each rank tends the wounded below as a surgeon would.', perRank: { surgeon: 0.1 } }),
  // T2
  t({ id: 'srv_iron_hull', name: 'Iron Hull', tier: 2, maxRank: 3, keystone: false, description: 'Maximum hull +5% per rank.', perRank: { hullMax: 0.05 } }),
  t({ id: 'srv_lime_and_salt', name: 'Lime and Salt', tier: 2, maxRank: 1, keystone: false, description: 'Immune to scurvy on long voyages.', flags: ['lime_and_salt'] }),
  t({ id: 'srv_storm_lashings', name: 'Storm Lashings', tier: 2, maxRank: 2, keystone: false, description: 'Hull damage from storm seas, whirlpools and the Maelstrom Wall −20% per rank.', perRank: { stormHull: -0.2 } }),
  t({ id: 'srv_spare_timber', name: 'Spare Timber', tier: 2, maxRank: 2, keystone: false, description: 'Planks and sailcloth take 20% less hold per rank and repairs use 10% less of them per rank.', perRank: { materialVolume: -0.2, materialUse: -0.1 } }),
  t({ id: 'srv_brace', name: 'Brace for Impact', tier: 2, maxRank: 1, keystone: false, description: 'ACTIVE (45 s). For 3 s: −30% hull damage, but the guns stop loading. Duck under an Iron Rain broadside.', active: { cooldown: 45 } }),
  // T3
  t({ id: 'srv_battle_repair', name: 'Battle Repair', tier: 3, maxRank: 1, keystone: false, description: 'Carpenters can repair the hull during combat at 40% speed.', flags: ['battle_repair'], fixed: { battleRepairRate: 0.4 } }),
  t({ id: 'srv_damage_control', name: 'Damage Control', tier: 3, maxRank: 2, keystone: false, description: 'Critical damage is dealt with 20% faster per rank: fires and breaches burn out sooner, the rudder is mended faster, and a broken mast is jury-rigged at sea.', perRank: { damageControl: 0.2 } }),
  t({ id: 'srv_hardened_crew', name: 'Hardened Crew', tier: 3, maxRank: 2, keystone: false, description: 'Crew casualties from hits −8% per rank.', perRank: { hardenedCrew: -0.08 } }),
  t({ id: 'srv_sealed_magazine', name: 'Sealed Magazine', tier: 3, maxRank: 1, keystone: false, description: 'Chance of your magazine exploding −75%.', flags: ['sealed_magazine'] }),
  t({ id: 'srv_long_voyage', name: 'Long Voyage', tier: 3, maxRank: 2, keystone: false, description: 'Sea wear on the hull −15% per rank; the crew does not tire of a long voyage for an extra 30 min (rank 1) / 60 min (rank 2).', perRank: { longVoyage: 1 } }),
  // T4
  t({ id: 'srv_plug_the_breach', name: 'Plug the Breach', tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (90 s). At once +8% of maximum hull and every leak and breach stopped. Works under fire.', active: { cooldown: 90 } }),
  t({ id: 'srv_lifeboats', name: 'Lifeboats', tier: 4, maxRank: 2, keystone: false, description: 'When she sinks, 20% of the legal cargo per rank is saved and 30% fewer crew per rank are lost.', perRank: { lifeboats: 1 } }),
  t({ id: 'srv_double_planking', name: 'Double Planking', tier: 4, maxRank: 2, keystone: false, requires: 'srv_iron_hull', requiresRank: 2, description: 'In each fight the first 3% of maximum hull damage per rank is absorbed. The buffer refills 60 s after combat.', perRank: { planking: 0.03 } }),
  t({ id: 'srv_wet_decks', name: 'Wet Decks', tier: 4, maxRank: 1, keystone: false, description: 'Fires do not spread: they do 40% less damage. A bursting gun of your own sets nothing alight and does half damage.', flags: ['wet_decks'] }),
  // T5
  t({ id: 'srv_grim_endurance', name: 'Grim Endurance', tier: 5, maxRank: 2, keystone: false, description: 'While the hull is below 35%, damage taken −6% per rank.', perRank: { grimEndurance: 0.06 } }),
  t({ id: 'srv_scuttle_charges', name: 'Scuttle Charges', tier: 5, maxRank: 1, keystone: false, description: 'Fire the magazine at any morale with a 3 s fuse (while being boarded: B then Shift+B), and it blows by itself when she sinks: the hold is destroyed and ships within 60 m take 10% of their maximum hull. Nobody gets your cargo.', flags: ['scuttle_charges'] }),
  t({ id: 'srv_old_salt', name: 'Old Salt', tier: 5, maxRank: 1, keystone: false, description: 'Repairs at sea without planks or sailcloth, at half speed.', flags: ['old_salt'] }),
  // Keystones
  t({ id: 'srv_unsinkable', name: 'Unsinkable', tier: 6, maxRank: 1, keystone: true, excludes: 'srv_patchwork_hull', description: 'KEYSTONE. Once per 5 minutes lethal damage leaves the hull at 1 and she cannot sink for 6 s. Maximum sail strength −10%.', flags: ['unsinkable'], fixed: { sailHpMax: -0.1 } }),
  t({ id: 'srv_patchwork_hull', name: 'Patchwork Hull', tier: 6, maxRank: 1, keystone: true, excludes: 'srv_unsinkable', description: 'KEYSTONE. The hull patches itself: 0.25% of maximum per second, in combat too (paused 3 s after each critical hit). Maximum hull −30%; shipyard repairs cost 50% more.', flags: ['patchwork_hull'], fixed: { hullMax: -0.3 } }),
];
