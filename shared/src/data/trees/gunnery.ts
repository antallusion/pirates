// Gunnery — "Speak in iron." docs/03_TALENT_TREES.md §4.2. 26 talents, 42 ranks before keystones.
// Situational effects are implemented in server/src/game/combat.ts and talentfx.ts, keyed by talent id.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'gunnery' });

export const GUNNERY: TalentDef[] = [
  // T1
  t({ id: 'gun_fast_hands', name: 'Fast Hands', tier: 1, maxRank: 3, keystone: false, description: 'Reload time −5% per rank.', perRank: { reloadMul: -0.05 } }),
  t({ id: 'gun_steady_aim', name: 'Steady Aim', tier: 1, maxRank: 3, keystone: false, description: 'Broadside spread −8% per rank.', perRank: { spreadMul: -0.08 } }),
  t({ id: 'gun_range_finder', name: 'Range Finder', tier: 1, maxRank: 2, keystone: false, description: 'Gun range +5% per rank.', perRank: { rangeMul: 0.05 } }),
  t({ id: 'gun_chain_master', name: 'Chain Master', tier: 1, maxRank: 2, keystone: false, description: 'Chain shot: sail damage +10% per rank, range +8% per rank.', perRank: { chainSail: 0.1, chainRange: 0.08 } }),
  t({ id: 'gun_powder_discipline', name: 'Powder Discipline', tier: 1, maxRank: 2, keystone: false, description: 'Chance that hits on you start a fire −20% per rank; fires aboard burn out 20% sooner per rank.', perRank: { fireRisk: -0.2 } }),
  // T2
  t({ id: 'gun_tangled_rigging', name: 'Tangled Rigging', tier: 2, maxRank: 1, keystone: false, description: 'Chain-shot hits apply Tangled Rigging: target turn rate −35% for 6 s. A new hit refreshes it; it does not stack.', flags: ['tangled_rigging'] }),
  t({ id: 'gun_grapeshot_storm', name: 'Grapeshot Storm', tier: 2, maxRank: 2, keystone: false, description: 'Grapeshot: crew casualties +12% per rank; each grape hit costs the target 1 morale per rank.', perRank: { grapeCrew: 0.12, grapeMorale: 1 } }),
  t({ id: 'gun_heated_shot', name: 'Heated Shot', tier: 2, maxRank: 2, keystone: false, description: 'Round shot sets the target on fire with a 6% chance per rank.', perRank: { heatedShot: 0.06 } }),
  t({ id: 'gun_rolling_broadside', name: 'Rolling Broadside', tier: 2, maxRank: 1, keystone: false, description: 'Rolling fire (K) becomes accurate: its spread penalty is replaced by −20% spread, and a rolling broadside counts as a full volley for Thunderous Broadside and Broadside Discipline.', flags: ['rolling_broadside'] }),
  t({ id: 'gun_crew_drill', name: 'Gun Crew Drill', tier: 2, maxRank: 2, keystone: false, description: 'Reload penalty from a short-handed gun crew −25% per rank.', perRank: { gunCrewDrill: 0.25 } }),
  t({ id: 'gun_swivel_guns', name: 'Swivel Guns', tier: 2, maxRank: 2, keystone: false, description: 'Swivels on the rail fire grape at hostile ships closer than 60 m by themselves every 4 s (1 / 2 shots per cycle), each hit killing a sailor. The gunner\'s answer to boarders.', perRank: { swivels: 1 } }),
  // T3
  t({ id: 'gun_double_charge', name: 'Double Charge', tier: 3, maxRank: 1, keystone: false, description: 'Each cannon has a 20% chance to fire two balls, each with its own spread. Works with any shot.', fixed: { doubleShotChance: 0.2 } }),
  t({ id: 'gun_raking_fire', name: 'Raking Fire', tier: 3, maxRank: 2, keystone: false, description: 'Hits on the stern quarter deal +10% damage per rank and are 10% per rank more likely to smash the rudder.', perRank: { rakingFire: 0.1 } }),
  t({ id: 'gun_mast_breaker', name: 'Mast Breaker', tier: 3, maxRank: 2, keystone: false, requires: 'gun_chain_master', requiresRank: 2, description: 'Chain hits on a target whose sails are below 50% break a mast with a 5% chance per rank: −30% maximum speed until repaired in port.', perRank: { mastBreak: 0.05 } }),
  t({ id: 'gun_skipping_shot', name: 'Skipping Shot', tier: 3, maxRank: 1, keystone: false, description: 'Balls that fall short within 30 m of a ship skip off the water and may still hit for 60% damage.', flags: ['skipping_shot'] }),
  t({ id: 'gun_waterline', name: 'Waterline Gunner', tier: 3, maxRank: 3, keystone: false, description: 'Chance to breach at the waterline +3% per rank: a breach leaks 1% of maximum hull per second for 10 s, ignoring armour.', perRank: { breachChance: 0.03 } }),
  // T4
  t({ id: 'gun_quick_swap', name: 'Quick Swap', tier: 4, maxRank: 2, keystone: false, description: 'Changing shot type while loaded costs 30% less reloading per rank; the first volley of the new shot reloads 10% faster.', perRank: { quickSwap: 0.3 } }),
  t({ id: 'gun_chaser_master', name: 'Chaser Master', tier: 4, maxRank: 2, keystone: false, description: 'Bow and stern chasers: damage +15% per rank, training arc +10° per rank.', perRank: { chaserDamage: 0.15, chaserArc: 10 } }),
  t({ id: 'gun_spotter', name: 'Spotter', tier: 4, maxRank: 1, keystone: false, requires: 'gun_steady_aim', requiresRank: 3, description: 'After three of your broadsides in a row hit the same ship she is Ranged In for 10 s: every friendly broadside at her has −15% spread.', flags: ['spotter'] }),
  t({ id: 'gun_splinter_storm', name: 'Splinter Storm', tier: 4, maxRank: 1, keystone: false, description: 'Every ball that strikes the hull kills one more sailor with splinters. Against a crew below 30%, each of your broadsides also costs 5 morale.', flags: ['splinter_storm'] }),
  t({ id: 'gun_mortar_lore', name: 'Mortar Lore', tier: 4, maxRank: 1, keystone: false, description: 'Any hull that can carry a deck mount can carry a mortar; mortars reload 20% faster and burst 25% wider.', flags: ['mortar_lore'] }),
  // T5
  t({ id: 'gun_thunder_broadside', name: 'Thunderous Broadside', tier: 5, maxRank: 1, keystone: false, description: 'If every ball of one broadside (at least 6) hits the same ship, her gun crews are stunned: her reload +25% for 5 s.', flags: ['thunder_broadside'] }),
  t({ id: 'gun_powder_mastery', name: 'Powder Mastery', tier: 5, maxRank: 2, keystone: false, description: 'Shot damage +5% per rank; muzzle velocity +10% per rank (less lead, easier hits at range).', perRank: { gunDamageMul: 0.05, shotSpeed: 0.1 } }),
  t({ id: 'gun_crossfire', name: 'Crossfire', tier: 5, maxRank: 1, keystone: false, description: 'Hits on a ship from two directions at least 90° apart within 3 s put her in a Crossfire for 6 s: +12% damage from every source and −10 morale. Once per 20 s per target.', flags: ['crossfire'] }),
  // Keystones
  t({ id: 'gun_iron_rain', name: 'Iron Rain', tier: 6, maxRank: 1, keystone: true, excludes: 'gun_red_hot_barrels', description: 'KEYSTONE. +25% cannon damage, but reloading is 20% slower. Every broadside must count. (Your damage cap rises to +50%.)', fixed: { gunDamageMul: 0.25, reloadMul: 0.2 } }),
  t({ id: 'gun_red_hot_barrels', name: 'Red-Hot Barrels', tier: 6, maxRank: 1, keystone: true, excludes: 'gun_iron_rain', description: 'KEYSTONE. Reload −35% (cap −45%). Each broadside adds 12 Heat to that side; a loaded side holding fire for 10 s cools 10 Heat per second. At 100 Heat a gun bursts: 4% hull damage, 3 crew dead, the gun is dismounted, Heat drops to 50.', fixed: { reloadMul: -0.35 }, flags: ['red_hot'] }),
];
