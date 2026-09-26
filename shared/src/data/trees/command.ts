// Command — "A crew is a blade — keep it sharp." docs/03_TALENT_TREES.md §4.4. 24 talents, 36 ranks before keystones.
// Crew, officers and mutiny live in server/src/game/crew.ts; escorts, formations and orders in server/src/game/fleet.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'command' });

export const COMMAND: TalentDef[] = [
  // T1
  t({ id: 'cmd_steady_voice', name: 'Steady Voice', tier: 1, maxRank: 3, keystone: false, description: 'Morale lost to damage and dead shipmates −6% per rank.', perRank: { moraleLoss: -0.06 } }),
  t({ id: 'cmd_fair_share', name: 'Fair Share', tier: 1, maxRank: 2, keystone: false, description: 'Crew wages −10% per rank; leaving port, morale +5 per rank.', perRank: { wages: -0.1 } }),
  t({ id: 'cmd_officers_mess', name: "Officers' Mess", tier: 1, maxRank: 2, keystone: false, description: 'Officers gain experience 15% faster per rank.', perRank: { officerXp: 0.15 } }),
  t({ id: 'cmd_press_gang', name: 'Press Gang', tier: 1, maxRank: 2, keystone: false, description: 'Sailors cost 15% less to sign per rank. Rank 2: in lawless ports you may hire the dregs — half price, but they come aboard with morale 30.', perRank: { hireCost: -0.15 } }),
  t({ id: 'cmd_signal_flags', name: 'Signal Flags', tier: 1, maxRank: 1, keystone: false, description: 'Flag signals to your escorts, three formations: Line (escorts +10% damage), Wedge (+10% speed), Ring (+10% armour). Changing formation takes 3 s.', flags: ['signal_flags'] }),
  // T2
  t({ id: 'cmd_rally', name: 'Rally the Crew', tier: 2, maxRank: 1, keystone: false, description: 'ACTIVE (90 s). +20 morale at once; panic is gone.', active: { cooldown: 90 } }),
  t({ id: 'cmd_escort_captain', name: 'Escort Captain', tier: 2, maxRank: 1, keystone: false, requires: 'cmd_signal_flags', description: 'One more escort berth beyond the one ten points in Command open (a squadron is at most two, three under an Admiral\'s Pennant).', flags: ['escort_captain'] }),
  t({ id: 'cmd_sea_shanty', name: 'Sea Shanty', tier: 2, maxRank: 2, keystone: false, description: 'ACTIVE (out of combat; 10 min at rank 1, 6 min at rank 2). A shanty: +15 sanity and +5 morale per rank.', active: { cooldown: 600 } }),
  t({ id: 'cmd_drill_master', name: 'Drill Master', tier: 2, maxRank: 2, keystone: false, description: 'Fresh hands season 25% faster per rank; a veteran crew (★3+) reloads 2% faster and repairs 2% faster per rank.', perRank: { drill: 1 } }),
  t({ id: 'cmd_inspiring_presence', name: 'Inspiring Presence', tier: 2, maxRank: 3, keystone: false, description: 'AURA 400 m: you, your escorts and allies lose 3% less morale per rank and gain 1 morale a minute per rank. Several captains do not stack (the strongest counts).', perRank: { inspire: 1 } }),
  // T3
  t({ id: 'cmd_iron_discipline', name: 'Iron Discipline', tier: 3, maxRank: 2, keystone: false, description: 'While morale is above 70: reload and repairs 4% faster per rank.', perRank: { discipline: 0.04 } }),
  t({ id: 'cmd_line_of_battle', name: 'Line of Battle', tier: 3, maxRank: 1, keystone: false, requires: 'cmd_signal_flags', description: 'Escorts in Line fire at your target with your broadside; a synchronised volley does +10% damage.', flags: ['line_of_battle'] }),
  t({ id: 'cmd_veteran_officers', name: 'Veteran Officers', tier: 3, maxRank: 2, keystone: false, requires: 'cmd_officers_mess', description: 'Rank 1: one more officer berth. Rank 2: every officer\'s bonus +10%.', perRank: { veteranOfficers: 1 } }),
  t({ id: 'cmd_fear_and_respect', name: 'Fear and Respect', tier: 3, maxRank: 1, keystone: false, description: 'The crew only murmurs below 15 morale instead of 30; putting down a mutiny gets +25% strength.', flags: ['fear_and_respect'] }),
  t({ id: 'cmd_field_promotion', name: 'Field Promotion', tier: 3, maxRank: 2, keystone: false, description: 'When an officer falls (wounded or dead), a sailor takes his place to the end of the fight with 50% (rank 1) / 75% (rank 2) of his bonus.', perRank: { fieldPromotion: 1 } }),
  // T4
  t({ id: 'cmd_fleet_logistics', name: 'Fleet Logistics', tier: 4, maxRank: 2, keystone: false, requires: 'cmd_escort_captain', description: 'Escorts repair at sea out of combat (0.3% hull a second per rank) and cost 20% less upkeep per rank.', perRank: { fleetLogistics: 1 } }),
  t({ id: 'cmd_concentrate_fire', name: 'Concentrate Fire!', tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (60 s). The ship nearest your cursor takes +15% damage from everyone for 10 s. Does not stack with the Admiral\'s Mark Target.', active: { cooldown: 60 } }),
  t({ id: 'cmd_screen_the_flagship', name: 'Screen the Flagship', tier: 4, maxRank: 1, keystone: false, requires: 'cmd_escort_captain', description: 'The nearest escort within 150 m takes 25% of the damage aimed at your flagship.', flags: ['screen_flagship'] }),
  t({ id: 'cmd_cat_o_nine_tails', name: "Cat-o'-Nine-Tails", tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (5 min). A flogging before the mast: +30 morale at once, but 3% of the crew are out (wounded or run).', active: { cooldown: 300 } }),
  // T5
  t({ id: 'cmd_black_flag', name: 'Black Flag', tier: 5, maxRank: 1, keystone: false, description: 'ACTIVE (20 s, 3 min). Merchants within 500 m with morale below 60 strike or flee; every enemy within 300 m loses 10 morale. In contested water you are marked an aggressor for 5 min (your first attack costs a wanted level).', active: { cooldown: 180 } }),
  t({ id: 'cmd_admirals_eye', name: "Admiral's Eye", tier: 5, maxRank: 2, keystone: false, description: 'You see hull, crew, morale and loaded batteries of every ship within 600 m. Rank 2: your escorts pass what they see (range 900 m).', perRank: { admiralsEye: 1 } }),
  t({ id: 'cmd_legend_at_the_helm', name: 'Legend at the Helm', tier: 5, maxRank: 1, keystone: false, description: 'They know your name: pirate NPCs lose 15 morale on meeting you; new sailors come aboard with morale 80; hiring in Confederacy ports −20%.', flags: ['legend_at_helm'] }),
  // Keystones
  t({ id: 'cmd_admirals_pennant', name: "Admiral's Pennant", tier: 6, maxRank: 1, keystone: true, excludes: 'cmd_rule_of_the_lash', description: 'KEYSTONE. One more escort berth (a squadron of three); escorts get +20% hull, damage and reload. Your own guns deal 30% less.', flags: ['admirals_pennant'], perRank: { gunDamageMul: -0.3 } }),
  t({ id: 'cmd_rule_of_the_lash', name: 'Rule of the Lash', tier: 6, maxRank: 1, keystone: true, excludes: 'cmd_admirals_pennant', description: 'KEYSTONE. In combat morale never falls below 50; Command actives recharge 30% faster. Out of combat morale stays under 60 and falls 3 every 10 min without a fight; in every port 4% desert unless you pay the fear bonus (10 silver a sailor).', flags: ['rule_of_the_lash'] }),
];
