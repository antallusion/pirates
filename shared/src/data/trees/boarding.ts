// Boarding — "Steel, rope and nerve." docs/03_TALENT_TREES.md §4.3. 24 talents, 37 ranks before keystones.
// Melee rules live in server/src/game/boarding.ts; prizes and captives in Game.ts / progression.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'boarding' });

export const BOARDING: TalentDef[] = [
  // T1
  t({ id: 'brd_grapples', name: 'Grapples', tier: 1, maxRank: 2, keystone: false, description: 'Boarding range +15% per rank.', perRank: { boardingRange: 0.15 } }),
  t({ id: 'brd_careful_hands', name: 'Careful Hands', tier: 1, maxRank: 3, keystone: false, description: 'Cargo destroyed in a boarding −5 percentage points per rank.', perRank: { boardingCargoLoss: -0.05 } }),
  t({ id: 'brd_cutlass_drill', name: 'Cutlass Drill', tier: 1, maxRank: 3, keystone: false, description: 'Your crew deals +5% melee damage per rank.', perRank: { meleeDamage: 0.05 } }),
  t({ id: 'brd_boarding_nets', name: 'Boarding Nets', tier: 1, maxRank: 2, keystone: false, description: 'When an enemy boards you, for the first 10 s their crew deals 8% less damage per rank.', perRank: { boardingNets: 0.08 } }),
  t({ id: 'brd_match_speed', name: 'Match Speed', tier: 1, maxRank: 2, keystone: false, description: 'Speed difference allowed for grappling +20% per rank: you can board a ship under way.', perRank: { matchSpeed: 0.2 } }),
  // T2
  t({ id: 'brd_victory_cheer', name: 'Victory Cheer', tier: 2, maxRank: 1, keystone: false, description: 'A won boarding restores 25 morale.', fixed: { moraleOnBoard: 25 } }),
  t({ id: 'brd_pistol_volley', name: 'Pistol Volley', tier: 2, maxRank: 1, keystone: false, description: 'As the grapples bite your crew fires a pistol volley: 6% of the enemy crew falls at once (at least 2).', flags: ['pistol_volley'] }),
  t({ id: 'brd_marines', name: 'Marines', tier: 2, maxRank: 2, keystone: false, description: '10% of the crew per rank are marines: each counts as 1.5 fighters in a boarding, but they do not serve the guns (reload +3% per rank).', perRank: { marines: 0.1, reloadMul: 0.03 } }),
  t({ id: 'brd_swift_plunder', name: 'Swift Plunder', tier: 2, maxRank: 2, keystone: false, description: 'Moving plunder across after a boarding is 25% faster per rank.', perRank: { transferSpeed: 0.25 } }),
  t({ id: 'brd_bow_and_stern', name: 'Bow and Stern', tier: 2, maxRank: 1, keystone: false, description: 'Grapple bow or stern to any part of her, not only broadside to broadside: your reach runs the length of both hulls.', flags: ['bow_and_stern'] }),
  // T3
  t({ id: 'brd_terror', name: 'Terror', tier: 3, maxRank: 1, keystone: false, description: 'Enemy crews below 30% lose morale twice as fast.', flags: ['terror'], fixed: { enemyMoraleCollapse: 1 } }),
  t({ id: 'brd_boarding_axes', name: 'Boarding Axes', tier: 3, maxRank: 2, keystone: false, description: 'While boarding, your men hack the rigging: the target loses 10% of her sails per rank. She will not run once you cast off.', perRank: { boardingAxes: 0.1 } }),
  t({ id: 'brd_first_over_the_rail', name: 'First Over the Rail', tier: 3, maxRank: 1, keystone: false, requires: 'brd_cutlass_drill', requiresRank: 2, description: 'For the first 8 s of a boarding your crew deals +25% damage. If the enemy loses a quarter of her crew in those 8 s, her morale −15.', flags: ['first_over_rail'] }),
  t({ id: 'brd_prize_crew', name: 'Prize Crew', tier: 3, maxRank: 2, keystone: false, description: 'A prize needs 20% fewer of your men per rank to sail home, and she is patched up: +10% hull when taken.', perRank: { prizeCrew: 0.2 } }),
  t({ id: 'brd_blooded', name: 'Blooded', tier: 3, maxRank: 2, keystone: false, description: 'Each enemy that falls gives your crew +0.5% damage per rank for the rest of the boarding (up to +20%).', perRank: { blooded: 0.005 } }),
  // T4
  t({ id: 'brd_surrender_terms', name: 'Surrender Terms', tier: 4, maxRank: 1, keystone: false, description: 'An NPC ship with morale under 20 and hull under 40% strikes without a fight (35% chance) when you close to boarding range, and hands over her whole hold intact.', flags: ['surrender_terms'] }),
  t({ id: 'brd_iron_grip', name: 'Iron Grip', tier: 4, maxRank: 2, keystone: false, requires: 'brd_grapples', requiresRank: 2, description: 'For 5 s per rank the enemy cannot cut your grapples.', perRank: { ironGrip: 5 } }),
  t({ id: 'brd_hold_the_line', name: 'Hold the Line', tier: 4, maxRank: 2, keystone: false, description: 'When you are boarded, for the first 20 s your morale does not fall below 20 (rank 1) / 35 (rank 2).', perRank: { holdTheLine: 1 } }),
  t({ id: 'brd_jolly_boat', name: 'Jolly Boat Raid', tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (120 s). A jolly boat with 15% of your crew rows to board a crippled ship within 150 m while you keep sailing and firing. If her guns sink the boat before it touches, the men are lost.', active: { cooldown: 120 } }),
  // T5
  t({ id: 'brd_hull_to_hull', name: 'Hull to Hull', tier: 5, maxRank: 1, keystone: false, description: 'Ramming is grappling: for 3 s after a ram the ships lock together at any speed difference.', flags: ['hull_to_hull'] }),
  t({ id: 'brd_warlord', name: 'Warlord', tier: 5, maxRank: 2, keystone: false, description: 'Every won boarding gives a stack of Glory for 10 min (up to 3): +4% crew damage per rank and +3 morale per stack.', flags: ['warlord'] }),
  t({ id: 'brd_ransom', name: 'Ransom', tier: 5, maxRank: 1, keystone: false, description: 'Take the captain of a boarded NPC ship prisoner: sell him at a harbour master for ransom (200–2,000 by class), or hand him to his enemies for reputation.', flags: ['ransom'] }),
  // Keystones
  t({ id: 'brd_blood_tide', name: 'Blood Tide', tier: 6, maxRank: 1, keystone: true, excludes: 'brd_no_quarter', description: 'KEYSTONE. Each won boarding restores 15% of maximum hull. Maximum crew −20%.', flags: ['blood_tide'], fixed: { crewMax: -0.2 } }),
  t({ id: 'brd_no_quarter', name: 'No Quarter', tier: 6, maxRank: 1, keystone: true, excludes: 'brd_blood_tide', description: 'KEYSTONE. +30% crew damage in boardings; every enemy that falls costs his mates 1 more morale. No prizes, no prisoners: the enemy ship sinks 60 s after you take her, Surrender Terms and Ransom do not work, and you cannot cut loose. In contested waters every boarding adds a wanted level.', flags: ['no_quarter'], fixed: { meleeDamage: 0.3 } }),
];
