// Exploration — "Beyond the last lighthouse." docs/03_TALENT_TREES.md §4.9. 24 talents, 36 ranks.
// Treasure maps, digs, sunken wrecks, trails and forecasts live in server/src/game/explorefx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'exploration' });

export const EXPLORATION: TalentDef[] = [
  // T1
  t({ id: 'exp_keen_spyglass', name: 'Keen Spyglass', tier: 1, maxRank: 3, keystone: false, description: 'Sighting range +6% per rank.', perRank: { detection: 0.06 } }),
  t({ id: 'exp_cartographer', name: 'Cartographer', tier: 1, maxRank: 2, keystone: false, description: 'Charting new islands gives +20% experience per rank; your charts sell for 15% more per rank.', perRank: { cartography: 0.2 } }),
  t({ id: 'exp_weather_eye', name: 'Weather Eye', tier: 1, maxRank: 2, keystone: false, description: 'You know the next weather in your region 3 min (rank 1) / 6 min (rank 2) before it comes.', perRank: { forecast: 180 } }),
  t({ id: 'exp_beachcomber', name: 'Beachcomber', tier: 1, maxRank: 2, keystone: false, description: 'Floating wreckage holds something of value 15% more often per rank: coin, pearls, a treasure map.', perRank: { beachcomber: 0.15 } }),
  t({ id: 'exp_star_reader', name: 'Star Reader', tier: 1, maxRank: 1, keystone: false, description: 'At night your minimap shows islands and ports twice as far.', flags: ['star_reader'] }),
  // T2
  t({ id: 'exp_treasure_hunter', name: 'Treasure Hunter', tier: 2, maxRank: 2, keystone: false, description: 'The search circle on your treasure maps is 20% smaller per rank; digging is 15% faster per rank.', perRank: { treasureHunter: 1 } }),
  t({ id: 'exp_pearl_diver', name: 'Pearl Diver', tier: 2, maxRank: 2, keystone: false, description: 'Your divers raise cargo from sunken ships as deep as 20 m (rank 1) / 40 m (rank 2); without it, only 8 m.', perRank: { diveDepth: 1 } }),
  t({ id: 'exp_rumor_hound', name: 'Rumor Hound', tier: 2, maxRank: 1, keystone: false, description: 'Once a game day a tavern gives you a free rumour: a sunken wreck or a treasure map.', flags: ['rumor_hound'] }),
  t({ id: 'exp_pathfinder', name: 'Pathfinder', tier: 2, maxRank: 2, keystone: false, description: 'Charting a new island: +10 morale and +2% speed per rank for 10 min.', perRank: { pathfinder: 0.02 } }),
  t({ id: 'exp_sounding_line', name: 'Sounding Line', tier: 2, maxRank: 1, keystone: false, description: 'Water too shallow for your keel shows on the minimap around you.', flags: ['sounding_line'] }),
  // T3
  t({ id: 'exp_trackers', name: 'Tracker', tier: 3, maxRank: 2, keystone: false, description: 'You see the wakes of ships that passed in the last 60 s (rank 1) / 120 s (rank 2), with their class.', perRank: { tracking: 60 } }),
  t({ id: 'exp_ruin_reader', name: 'Ruin Reader', tier: 3, maxRank: 1, keystone: false, description: 'You read the inscriptions in the ruins of the Drowned Crown: every third one points to a hidden cache (a treasure map).', flags: ['ruin_reader'] }),
  t({ id: 'exp_map_of_the_dead', name: 'Map of the Dead', tier: 3, maxRank: 1, keystone: false, requires: 'exp_treasure_hunter', description: 'A cartographer can merge three treasure maps of one tier into one of the next.', flags: ['map_of_the_dead'] }),
  t({ id: 'exp_frontier_spirit', name: 'Frontier Spirit', tier: 3, maxRank: 2, keystone: false, description: 'In lawless waters +8% experience and −10% provisions per rank.', perRank: { frontier: 0.08 } }),
  t({ id: 'exp_anomaly_sense', name: 'Anomaly Sense', tier: 3, maxRank: 2, keystone: false, description: 'Whirlpools and uncanny waters show 30% further per rank; their damage −15% per rank.', perRank: { stormHull: -0.15, anomalySight: 0.3 } }),
  // T4
  t({ id: 'exp_charted_waters', name: 'Charted Waters', tier: 4, maxRank: 2, keystone: false, description: 'In regions you have fully charted: +3% speed and −10% signature to NPCs per rank.', perRank: { chartedWaters: 1 } }),
  t({ id: 'exp_lucky_dig', name: 'Lucky Dig', tier: 4, maxRank: 1, keystone: false, description: 'A 15% chance that a hoard holds an extra piece one grade finer.', flags: ['lucky_dig'] }),
  t({ id: 'exp_expedition_stores', name: 'Expedition Stores', tier: 4, maxRank: 2, keystone: false, description: 'Provisions take 15% less hold per rank.', perRank: { storesVolume: -0.15 } }),
  t({ id: 'exp_leviathan_lore', name: 'Leviathan Lore', tier: 4, maxRank: 1, keystone: false, description: 'Monsters of the deep (ghost ships and worse): +10% damage against them and +20% of what they leave behind.', flags: ['leviathan_lore'] }),
  // T5
  t({ id: 'exp_legend_seeker', name: 'Legend Seeker', tier: 5, maxRank: 1, keystone: false, description: 'Fragments of legendary maps turn up three times as often, and a legendary map you assemble marks its spot exactly.', flags: ['legend_seeker'] }),
  t({ id: 'exp_eye_of_the_storm', name: 'Eye of the Storm', tier: 5, maxRank: 2, keystone: false, description: 'Rank 1: storms do not shorten your sight. Rank 2: when a storm passes, storm wreckage with rare goods floats nearby for you alone for 5 min.', perRank: { eyeOfStorm: 1 } }),
  t({ id: 'exp_crows_nest', name: "Crow's Nest", tier: 5, maxRank: 1, keystone: false, requires: 'exp_keen_spyglass', requiresRank: 3, description: 'ACTIVE (5 min). A lookout at the masthead: for 20 s +50% sight, and every ship within it is revealed to you — hidden ones included.', active: { cooldown: 300 } }),
  // Keystones
  t({ id: 'exp_gold_fever', name: 'Gold Fever', tier: 6, maxRank: 1, keystone: true, excludes: 'exp_beyond_the_edge', description: 'KEYSTONE. Hoards are one grade finer and treasure maps turn up twice as often. While a hoard is in your hold, a gold trail follows you: pirates of the region and wanted captains see roughly where you are.', flags: ['gold_fever'] }),
  t({ id: 'exp_beyond_the_edge', name: 'Beyond the Edge', tier: 6, maxRank: 1, keystone: true, excludes: 'exp_gold_fever', description: "KEYSTONE. In Dead Man's Expanse, the Drowned Crown, the Abyss and uncharted water: +10% speed, +10% reload speed, +15% sight, −25% anomaly damage. In safe and contested waters −10% speed and reload speed, and the crew pines for the horizon (−1 morale every 5 min).", flags: ['beyond_the_edge'] }),
];
