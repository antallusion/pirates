// World bosses (docs/02 §11.A.4): who they are, where and when they rise, and what they leave behind.
// The fights themselves live in server/src/game/bosses.ts.

import type { GoodId } from './goods.ts';
import type { FigureheadId } from './shipbuild.ts';
import type { ModuleId, ShipClassId } from './ships.ts';
import type { RegionId } from '../world/regions.ts';

export type BossId = 'leviathan' | 'kraken' | 'drowned_whale' | 'lantern_maw' | 'black_serpent' | 'hollow_admiral' | 'mother_of_wrecks' | 'storm_widow'
  // The Abyss (docs/02 §14.A.1): its ancient leviathans and the season's raid on the Eye.
  | 'ancient_leviathan' | 'abyss_eye'
  // Six more (owner, 2026-10-03: «еще больше всяких там боссов»; docs/02 §11.A.4, the second table): one for each sea
  // that had none of its own or only one — their fights in server/src/game/bosses10.ts.
  | 'old_moorings' | 'old_tithe' | 'fog_changeling' | 'cinder_ray' | 'drowned_prelate' | 'rime_twins';

export type BossWindow = 'any' | 'night' | 'storm';

export interface BossDrop {
  kind: 'module' | 'figurehead' | 'good';
  id: ModuleId | FigureheadId | GoodId;
  qty?: number;
  chance: number; // at full contribution
}

export interface BossDef {
  id: BossId;
  name: string;
  classId: ShipClassId;
  regions: RegionId[];
  /** Near which port it rises, if anywhere in particular (Mother of Wrecks at Wrecktide). */
  nearPort?: string;
  /** Recommended fleet: contribution beyond the upper figure does not raise anyone's drop. */
  ships: [number, number];
  /** Seconds between risings (world time), and the window it needs. */
  every: number;
  window: BossWindow;
  /** Chance that a due rising happens at all (the Maw hunts on three nights in ten). */
  chance: number;
  /** Seconds before it gives up and sinks back. */
  lifetime: number;
  phases: string[];
  /** Goods everyone who fought takes home, scaled by contribution: [min, max]. */
  goods: Partial<Record<GoodId, [number, number]>>;
  rare: BossDrop[];
  trophy: string;
  xp: number;
  lore: string;
}

export const BOSS_ANNOUNCE = 1800; // taverns of the region hear of it half an hour ahead
export const BOSS_LOCKOUT = 7 * 24 * 3600; // rare drops: once a week per captain per boss (wall clock)
export const BOSS_RANGE = 2600; // who counts as in the fight

export const BOSSES: Record<BossId, BossDef> = {
  leviathan: {
    id: 'leviathan', name: 'Leviathan', classId: 'leviathan', regions: ['leviathan_reach', 'the_abyss'], ships: [8, 15], every: 16 * 3600, window: 'any', chance: 1, lifetime: 2700,
    phases: ['The Hunt', 'Roar of the Deep', 'Death Frenzy'],
    goods: { leviathan_bone: [10, 30], whale_oil: [6, 20], pearls: [2, 8] },
    rare: [{ kind: 'module', id: 'bone_culverin', chance: 0.25 }, { kind: 'module', id: 'leviathan_ribs', chance: 0.2 }, { kind: 'figurehead', id: 'fh_leviathan', chance: 0.1 }],
    trophy: 'Leviathan Skull', xp: 5200,
    lore: 'It surfaces in white water and rams. Six harpoon lines hold it up and open its gills; loose, it dives and turns the sea into a mouth.',
  },
  kraken: {
    id: 'kraken', name: 'Kraken', classId: 'kraken', regions: ['whispering', 'dead_mans_expanse'], ships: [5, 10], every: 10 * 3600, window: 'any', chance: 1, lifetime: 2400,
    phases: ['Eight Arms', 'The Open Body'],
    goods: { kraken_ink: [4, 14], pearls: [2, 6] },
    rare: [{ kind: 'module', id: 'kraken_beak', chance: 0.25 }, { kind: 'module', id: 'figurehead_kraken', chance: 0.1 }, { kind: 'module', id: 'ink_sacs', chance: 0.2 }],
    trophy: 'Kraken Eye', xp: 3600,
    lore: 'Eight arms, each its own foe. An arm that holds a ship for 30 s tears her open. Cut four away and the body is yours to shoot.',
  },
  drowned_whale: {
    id: 'drowned_whale', name: 'The Drowned Whale', classId: 'drowned_whale', regions: ['drowned_crown'], ships: [6, 12], every: 20 * 3600, window: 'night', chance: 1, lifetime: 2700,
    phases: ['The Dead Come Down', 'The Song', 'The Heart'],
    goods: { drowned_silk: [3, 10], cursed_relics: [2, 6], abyssal_ore: [2, 6] },
    rare: [{ kind: 'figurehead', id: 'fh_drowned_man', chance: 0.3 }],
    trophy: 'Bell of the Whale', xp: 4800,
    lore: 'The drowned come down off its back to board you. Then the Choir sings; bells and deep pastors quiet it. At the last, board it and kill the heart.',
  },
  lantern_maw: {
    id: 'lantern_maw', name: 'The Lantern Maw', classId: 'lantern_maw', regions: ['dead_mans_expanse'], ships: [4, 8], every: 20 * 60, window: 'night', chance: 0.3, lifetime: 2100,
    phases: ['False Lights', 'The Hungry Dark'],
    goods: { pearls: [4, 12], whale_oil: [4, 10] },
    rare: [{ kind: 'module', id: 'lantern_cannon', chance: 0.25 }, { kind: 'module', id: 'lantern_gland', chance: 0.2 }, { kind: 'module', id: 'maw_grapnels', chance: 0.15 }],
    trophy: 'Lure of the Maw', xp: 3000,
    lore: 'Its false lights look like ports and ships. Lanterns draw it: sail dark. Swallowed, you have a minute — every gun inside hits thrice.',
  },
  black_serpent: {
    id: 'black_serpent', name: 'The Black Serpent', classId: 'black_serpent', regions: ['ashen_isles'], ships: [6, 10], every: 20 * 3600, window: 'any', chance: 1, lifetime: 2400,
    phases: ['The Coil', 'The Chase'],
    goods: { sulfur_iron: [4, 12], cursed_relics: [1, 4] },
    rare: [{ kind: 'module', id: 'serpent_scale', chance: 0.25 }, { kind: 'figurehead', id: 'fh_serpent', chance: 0.08 }, { kind: 'module', id: 'serpent_spine', chance: 0.2 }],
    trophy: 'Serpent Fang', xp: 3800,
    lore: 'It rings a fleet with its body and spits bile that eats canvas. Wounded, it runs for the shoals — only small fast ships keep up.',
  },
  hollow_admiral: {
    id: 'hollow_admiral', name: 'The Hollow Admiral', classId: 'ghost_ship', regions: ['dead_mans_expanse'], ships: [10, 20], every: 7 * 24 * 3600, window: 'any', chance: 1, lifetime: 3600,
    phases: ['Line of Battle', 'The Last Flag'],
    goods: { cursed_relics: [4, 12], abyssal_ore: [2, 8], weapons: [4, 12] },
    rare: [{ kind: 'module', id: 'crown_old_pattern', chance: 0.3 }, { kind: 'module', id: 'ghost_timbers', chance: 0.15 }, { kind: 'module', id: 'drowned_gunlocks', chance: 0.25 }, { kind: 'figurehead', id: 'fh_hollow_admiral', chance: 0.12 }],
    trophy: "Drey's Lantern", xp: 7000,
    lore: 'Three lost ships of the line and their flagship. They hold the weather gauge on a wind of their own; a sunk ghost rises again until its soul-lantern is put out by boarders.',
  },
  mother_of_wrecks: {
    id: 'mother_of_wrecks', name: 'Mother of Wrecks', classId: 'mother_of_wrecks', regions: ['dead_mans_expanse'], nearPort: 'wrecktide', ships: [6, 12], every: 48 * 3600, window: 'any', chance: 1, lifetime: 3000,
    phases: ['The Shell', 'The Cores'],
    goods: { planks: [10, 30], iron: [6, 18], timber: [8, 24] },
    rare: [{ kind: 'module', id: 'galleass_sweeps', chance: 0.25 }, { kind: 'module', id: 'wreck_bulwarks', chance: 0.2 }, { kind: 'module', id: 'tiller_chains', chance: 0.15 }, { kind: 'figurehead', id: 'fh_hermit_crab', chance: 0.12 }],
    trophy: 'Crown of Wrecks', xp: 4400,
    lore: 'Heavy guns break the shell; only keels drawing 2.5 m or less can thread the maze to its cores. While the cores beat, the shell grows back.',
  },
  storm_widow: {
    id: 'storm_widow', name: 'The Storm Widow', classId: 'storm_widow', regions: ['leviathan_reach'], ships: [8, 14], every: 16 * 3600, window: 'storm', chance: 1, lifetime: 2400,
    phases: ['The Gale', 'The Eye Closes'],
    goods: { sailcloth: [8, 24], sulfur_iron: [2, 8] },
    rare: [{ kind: 'module', id: 'storm_glass', chance: 0.25 }, { kind: 'module', id: 'widow_ribbons', chance: 0.2 }, { kind: 'figurehead', id: 'fh_storm_widow', chance: 0.12 }],
    trophy: 'Veil of the Widow', xp: 4600,
    lore: 'A fight against the weather: the wind turns every 15 s, lightning finds the tallest mast. She can only be hurt from inside the moving eye.',
  },
  ancient_leviathan: {
    id: 'ancient_leviathan', name: 'The Ancient Leviathan', classId: 'leviathan', regions: ['the_abyss'], ships: [15, 25], every: 3 * 24 * 3600, window: 'any', chance: 1, lifetime: 3600,
    phases: ['The Hunt', 'Roar of the Deep', 'Death Frenzy'],
    goods: { leviathan_bone: [25, 60], abyssal_ore: [8, 20], cursed_relics: [3, 8] },
    rare: [{ kind: 'module', id: 'bone_culverin', chance: 0.4 }, { kind: 'module', id: 'leviathan_ribs', chance: 0.35 }, { kind: 'figurehead', id: 'fh_leviathan', chance: 0.2 }],
    trophy: 'Skull of an Ancient', xp: 12000,
    lore: 'Older than the Leviathans of the Reach, grown in the dark past the Wall. It hunts as they do, but it is three times the beast. Alliances are made for it — and broken over the carcass.',
  },
  abyss_eye: {
    id: 'abyss_eye', name: 'The Eye of the Abyss', classId: 'abyss_eye', regions: ['the_abyss'], ships: [25, 40], every: 30 * 24 * 3600, window: 'any', chance: 1, lifetime: 5400,
    phases: ['The Black Storm', 'The Dead Wind', 'The Fall'],
    goods: { abyssal_ore: [20, 50], cursed_relics: [8, 20], pearls: [10, 30] },
    rare: [{ kind: 'module', id: 'storm_glass', chance: 0.5 }, { kind: 'module', id: 'ghost_timbers', chance: 0.5 }, { kind: 'module', id: 'eye_lantern', chance: 0.5 }],
    trophy: 'A Shard of the Eye', xp: 25000,
    lore: 'Once a season the Eye at the heart of the Abyss opens. First the black storm, then a wind that is not there, then the fall. Only the whole sea together can close it again.',
  },
  // ---- The six of 2026-10-03 (server/src/game/bosses10.ts). The Black Coast's is the sea's first boss, for a handful of
  // young captains; the Prelate is a night's work for a whole guild.
  old_moorings: {
    id: 'old_moorings', name: 'Old Moorings', classId: 'old_moorings', regions: ['black_coast'], ships: [3, 6], every: 8 * 3600, window: 'any', chance: 1, lifetime: 1800,
    phases: ['The Silt', 'The Moorings'],
    goods: { fish: [10, 30], whale_oil: [3, 10], pearls: [1, 4] },
    rare: [{ kind: 'module', id: 'tiller_chains', chance: 0.2 }, { kind: 'figurehead', id: 'fh_wrecker', chance: 0.12 }],
    trophy: 'Jaw of Old Moorings', xp: 1800,
    lore: 'A conger as thick as a mainmast, out of the silt under the Crown’s breakwaters. It rears where a ship lies still — keep way on, and fire when it lies sprawled after a miss.',
  },
  old_tithe: {
    id: 'old_tithe', name: 'The Tithe-Taker', classId: 'old_tithe', regions: ['gravewater'], ships: [4, 8], every: 12 * 3600, window: 'any', chance: 1, lifetime: 2400,
    phases: ['The Tithe', 'The Disgorging'],
    goods: { shark_skin: [4, 12], spices: [3, 10], cloth: [4, 12], pearls: [1, 5] },
    rare: [{ kind: 'module', id: 'wreck_bulwarks', chance: 0.2 }, { kind: 'module', id: 'maw_grapnels', chance: 0.15 }, { kind: 'figurehead', id: 'fh_fishwife', chance: 0.1 }],
    trophy: 'Tithe-Tooth', xp: 2800,
    lore: 'A barnacled shark that has followed the Gravewater convoys for a century. It hunts the fullest hold and heals on what it takes — come with empty holds, or bring one laden ship to bait it.',
  },
  fog_changeling: {
    id: 'fog_changeling', name: 'The Fog Changeling', classId: 'fog_changeling', regions: ['whispering'], ships: [4, 8], every: 12 * 3600, window: 'any', chance: 1, lifetime: 2400,
    phases: ['Many Faces', 'The Colours'],
    goods: { kraken_ink: [4, 12], pearls: [2, 6], dreamleaf: [1, 4] },
    rare: [{ kind: 'module', id: 'ink_sacs', chance: 0.25 }, { kind: 'module', id: 'lantern_gland', chance: 0.15 }, { kind: 'figurehead', id: 'fh_veiled_lady', chance: 0.12 }],
    trophy: 'Mirror-Skin of the Changeling', xp: 3000,
    lore: 'A cuttlefish the size of a brig that throws four shapes of itself onto the fog. Only the true one casts a wake: close in to see it, or set a harpoon — a false shape bursts into ink.',
  },
  cinder_ray: {
    id: 'cinder_ray', name: 'The Cinder Ray', classId: 'cinder_ray', regions: ['ashen_isles'], ships: [6, 10], every: 16 * 3600, window: 'any', chance: 1, lifetime: 2400,
    phases: ['Ashfall', 'The Kindling'],
    goods: { sulfur_iron: [4, 12], gunpowder: [3, 10], abyssal_ore: [1, 4] },
    rare: [{ kind: 'module', id: 'serpent_scale', chance: 0.2 }, { kind: 'module', id: 'bone_culverin', chance: 0.1 }, { kind: 'figurehead', id: 'fh_salamander', chance: 0.12 }],
    trophy: 'Ember Barb of the Ray', xp: 3900,
    lore: 'A manta of black glass and ember-light under the ash-falls of the powder isles. Guns fired inside its ash set their own powder alight; when it glides down onto a ship it lies grounded — fire then.',
  },
  drowned_prelate: {
    id: 'drowned_prelate', name: 'The Drowned Prelate', classId: 'drowned_prelate', regions: ['drowned_crown'], ships: [8, 14], every: 24 * 3600, window: 'night', chance: 1, lifetime: 3000,
    phases: ['The Three Bells', 'The Last Rite'],
    goods: { drowned_silk: [4, 12], cursed_relics: [3, 8], pearls: [2, 8] },
    rare: [{ kind: 'module', id: 'crown_old_pattern', chance: 0.25 }, { kind: 'module', id: 'ghost_timbers', chance: 0.12 }, { kind: 'figurehead', id: 'fh_seraph', chance: 0.12 }],
    trophy: 'The Prelate’s Mitre', xp: 5000,
    lore: 'The Crown’s last high priest, drowned in his cathedral, rises in weed and coral with the bells of three spires. Hold a ship beside a spire to silence its bell: each silent bell opens him to shot and shelters you from his sermon.',
  },
  rime_twins: {
    id: 'rime_twins', name: 'The Rime Twins', classId: 'rime_narwhal', regions: ['leviathan_reach'], ships: [6, 12], every: 18 * 3600, window: 'any', chance: 1, lifetime: 2700,
    phases: ['The Hunt of Two', 'The Freeze'],
    goods: { narwhal_tusk: [2, 6], whale_oil: [6, 16], leviathan_bone: [3, 10] },
    rare: [{ kind: 'module', id: 'kraken_beak', chance: 0.2 }, { kind: 'module', id: 'leviathan_ribs', chance: 0.15 }, { kind: 'figurehead', id: 'fh_narwhal', chance: 0.15 }],
    trophy: 'The Twin Tusks', xp: 4600,
    lore: 'Two white narwhals born of one ice, hunting as one. The one that falls is sung back from the sea while its twin stands strong — bring both down together.',
  },
};

export const BOSS_IDS = Object.keys(BOSSES) as BossId[];

/** A captain's share of the spoils: contribution share scaled to the recommended fleet, 0.25–1. */
export function lootFactor(def: BossDef, share: number): number {
  return Math.max(0.25, Math.min(1, share * def.ships[1]));
}
