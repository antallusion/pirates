// Abyssal — "The deep answers those who call." docs/03_TALENT_TREES.md §4.10. 24 talents, 36 ranks before keystones.
// "Dread" here is the ship's pressure of the deep (docs/00 D4): the Drowned Captain's own Dread, for everyone else
// the sanity the crew has lost (100 − sanity). Rules live in server/src/game/abyssfx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'abyssal' });

export const ABYSSAL: TalentDef[] = [
  // T1
  t({ id: 'abs_grasp_of_the_deep', name: 'Grasp of the Deep', tier: 1, maxRank: 1, keystone: false, description: 'ACTIVE (30 s, +8 Dread). Tentacles seize the ship nearest your cursor within 300 m: −40% speed for 3 s.', active: { cooldown: 30 } }),
  t({ id: 'abs_whispers_below', name: 'Whispers Below', tier: 1, maxRank: 3, keystone: false, description: 'Abyssal abilities +5% damage and strength per rank.', perRank: { abyssPower: 0.05 } }),
  t({ id: 'abs_salt_ward', name: 'Salt Ward', tier: 1, maxRank: 2, keystone: false, description: 'The penalties of fear and terror weigh 20% less on your ship per rank.', perRank: { saltWard: 0.2 } }),
  t({ id: 'abs_drowned_eyes', name: 'Drowned Eyes', tier: 1, maxRank: 2, keystone: false, description: '+10% sight in fog per rank. Rank 2: phantom sails no longer fool your lookouts, and uncanny waters show further.', perRank: { fogSight: 0.1 } }),
  t({ id: 'abs_offering', name: 'Offering', tier: 1, maxRank: 2, keystone: false, description: 'Cargo thrown overboard is an offering: +1 Dread per 50 silver of its worth (up to 20 at once). Rank 2: abyssal cooldowns −10% for 30 s after an offering.', perRank: { offering: 1 } }),
  // T2
  t({ id: 'abs_drowned_shot', name: 'Drowned Shot', tier: 2, maxRank: 2, keystone: false, description: 'Cursed shot no longer costs your crew morale, and weighs its target down: −10% speed per rank for 5 s, up to 2 stacks. Every cursed volley +1 Dread.', perRank: { drownedShot: 1 } }),
  t({ id: 'abs_hymn_of_the_choir', name: 'Hymn of the Choir', tier: 2, maxRank: 1, keystone: false, description: 'ACTIVE (90 s, +12 Dread). The Choir sings through the planks: enemies within 400 m lose 15 morale and take +10 Dread; NPC crews below 30 morale panic.', active: { cooldown: 90 } }),
  t({ id: 'abs_still_waters', name: 'Still Waters', tier: 2, maxRank: 2, keystone: false, description: 'The thresholds of Dread come 5 points later per rank; rum, lanterns and chapels ease it 20% more per rank.', perRank: { stillWaters: 1 } }),
  t({ id: 'abs_eyes_of_the_choir', name: 'Eyes of the Choir', tier: 2, maxRank: 1, keystone: false, description: 'Monsters and ghost ships show on your minimap twice as far.', flags: ['eyes_of_choir'] }),
  t({ id: 'abs_small_bargain', name: 'Small Bargain', tier: 2, maxRank: 2, keystone: false, description: 'ACTIVE (3 min, +6 Dread). Give the deep 3% of the crew: at once +6% hull per rank.', active: { cooldown: 180 } }),
  // T3
  t({ id: 'abs_rising_dead', name: 'Rising Dead', tier: 3, maxRank: 2, keystone: false, description: '10% per rank of your crew who die in a fight rise again after 10 s as drowned sailors for 3 min (they do not eat, and fight like the living).', perRank: { risingDead: 0.1 } }),
  t({ id: 'abs_black_water', name: 'Black Water', tier: 3, maxRank: 1, keystone: false, description: 'ACTIVE (60 s, +15 Dread). A pool of black water 80 m across for 8 s within 350 m: −30% speed, and no hull can be mended inside it.', active: { cooldown: 60 } }),
  t({ id: 'abs_sirens_call', name: "Siren's Call", tier: 3, maxRank: 1, keystone: false, description: 'ACTIVE (2 min, +15 Dread). An NPC ship within 300 m turns toward you for 4 s; a player ship is drawn toward you for 2 s.', active: { cooldown: 120 } }),
  t({ id: 'abs_cursed_cargo', name: 'Cursed Cargo', tier: 3, maxRank: 2, keystone: false, description: 'Cursed relics take 25% less hold per rank. Their whispering reaches your crew at half strength (rank 1) or not at all (rank 2).', perRank: { cursedCargo: 1 } }),
  t({ id: 'abs_creeping_horror', name: 'Creeping Horror', tier: 3, maxRank: 2, keystone: false, description: 'Your fear is catching: while your Dread is 50+, enemies within 250 m lose 1 morale per rank every 3 s and take +1 Dread every 10 s.', perRank: { creepingHorror: 1 } }),
  // T4
  t({ id: 'abs_krakens_embrace', name: "Kraken's Embrace", tier: 4, maxRank: 1, keystone: false, requires: 'abs_grasp_of_the_deep', description: 'Grasp of the Deep holds its target dead in the water for 1.5 s (0.75 s against players) and lets you board her at any speed.', flags: ['krakens_embrace'] }),
  t({ id: 'abs_hollow_men', name: 'Hollow Men', tier: 4, maxRank: 2, keystone: false, requires: 'abs_rising_dead', description: 'Your drowned sailors last 60 s longer per rank and deal +20% boarding damage per rank.', perRank: { hollowMen: 1 } }),
  t({ id: 'abs_sea_rot', name: 'Sea Rot', tier: 4, maxRank: 2, keystone: false, requires: 'abs_drowned_shot', description: 'Cursed shot also spreads sea rot: −0.5% hull a second for 4 s through any armour (1 stack at rank 1, up to 2 at rank 2).', perRank: { seaRot: 1 } }),
  t({ id: 'abs_abyss_step', name: 'Abyss Step', tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (3 min, +20 Dread). The ship sinks into black water and rises 200 m ahead 2 s later. Below, nothing can touch her — and she cannot fire.', active: { cooldown: 180 } }),
  // T5
  t({ id: 'abs_voice_of_the_choir', name: 'Voice of the Choir', tier: 5, maxRank: 1, keystone: false, description: 'At 75+ Dread: abyssal cooldowns −30%, and the penalties of terror and madness and the monsters roused by the Call trouble you half as much.', flags: ['voice_of_choir'] }),
  t({ id: 'abs_pact_of_salt_and_bone', name: 'Pact of Salt and Bone', tier: 5, maxRank: 2, keystone: false, description: 'Damage from monsters of the deep −15% per rank. Rank 2: they leave you be while your Dread is 60+ and you do not strike them.', perRank: { pact: 1 } }),
  t({ id: 'abs_mark_of_the_drowned_king', name: 'Mark of the Drowned King', tier: 5, maxRank: 1, keystone: false, description: 'Once an hour, when she sinks, she does not go to port: 15 s later she rises where she went down, a ghost with 30% hull, untouchable for 10 s and unable to fire. Her cargo stays on the water. Not after Drowned Once or Unsinkable in the same fight.', flags: ['drowned_king'] }),
  // Keystones
  t({ id: 'abs_crew_of_the_drowned', name: 'Crew of the Drowned', tier: 6, maxRank: 1, keystone: true, excludes: 'abs_heart_of_the_abyss', description: 'KEYSTONE. The crew never falls below 40% of full: the fallen rise drowned. Morale is fixed at 50 for ever — no panic, no murmurs, no mutiny, no surrender, no one over the side. No bonuses either. Crown and League ports will not sign living sailors for you; a surgeon is useless.', flags: ['crew_of_drowned'] }),
  t({ id: 'abs_heart_of_the_abyss', name: 'Heart of the Abyss', tier: 6, maxRank: 1, keystone: true, excludes: 'abs_crew_of_the_drowned', description: 'KEYSTONE. Dread no longer ebbs by itself, and rum, lanterns and chapels ease it half as much. Each point of Dread: +0.5% abyssal and cursed-shot damage. At 100 Dread an Abyss Spawn rises — hostile to everyone, you included — and Dread falls to 0. Abyssal cooldowns cannot be shortened.', flags: ['heart_of_abyss'] }),
];
