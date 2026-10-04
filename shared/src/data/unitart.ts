// The battle figures of the kinds still in the painter's queue (owner, 2026-10-03; tools/art/creatures.py, docs/18
// VII): the body each is painted in — a man on his feet, a big one, a beast, a flyer, a thing rising out of the water —
// how tall it stands beside a hex, and, until its four-pose sheet is cut into the manifest, the painted kind that stands
// in for it on the field, on a card and in an army slot: the nearest it names, else one of its own people and body,
// else any of its body. The client asks here whenever a `unit.<kind>` picture is missing (client/src/assets.ts); once
// the kind's own sheet is cut it is drawn, with no change to the code. Nothing here is a kind's numbers: the battle
// never reads it.

import type { UnitId } from './army.ts';

/** How a kind is painted (tools/art/creatures.py's `body`). */
export type Body = 'man' | 'big' | 'beast' | 'fly' | 'water';

export interface Figure {
  body: Body;
  /** Its height beside a hex's width (client/src/ui/tactical.ts; a man is 1.28). */
  size: number;
  /** Whose it is: a roster of the world's armies, or the premium shop's. */
  of: string;
  /** The painted kinds that look most like it, the nearest first. */
  like?: UnitId[];
}

const F = (body: Body, size: number, of: string, ...like: UnitId[]): Figure => ({ body, size, of, like });

/** The figures of the kinds added by docs/18 VII (the shop's twenty and the factions' new kinds), VIII (the second
 *  dozen) and IX (the third: the shop's and the islands' new creatures). */
export const FIGURES: Partial<Record<UnitId, Figure>> = {
  // The shop's creatures.
  golden_crab: F('beast', 1.05, 'premium', 'crab_queen', 'bell_hermit', 'crab'),
  giant_manta: F('fly', 1.3, 'premium', 'cave_bat', 'albatross'),
  ember_salamander: F('beast', 1.15, 'premium', 'monitor', 'giant_toad'),
  sea_wolf: F('beast', 1.15, 'premium', 'jaguar', 'wild_boar'),
  hippocampus: F('water', 1.45, 'premium', 'barracuda', 'moray'),
  coral_basilisk: F('beast', 1.35, 'premium', 'monitor', 'cave_wyrm'),
  kraken_spawn: F('water', 1.65, 'premium', 'young_kraken', 'lagoon_tentacle'),
  storm_eagle: F('fly', 1.5, 'premium', 'albatross', 'storm_roc'),
  abyssal_angler: F('water', 1.5, 'premium', 'moray', 'young_serpent'),
  frost_serpent: F('water', 1.6, 'premium', 'young_serpent'),
  nautilus_knight: F('man', 1.38, 'premium', 'deep_zealot', 'crown_ironclad'),
  siren_queen: F('fly', 1.45, 'premium', 'mermaid', 'lantern_wraith'),
  tidal_elemental: F('big', 1.6, 'premium', 'basalt_guardian', 'volcano_guardian'),
  obsidian_golem: F('big', 1.6, 'premium', 'volcano_guardian', 'basalt_guardian'),
  lava_drake: F('fly', 1.55, 'premium', 'storm_roc', 'cave_bat'),
  sea_griffin: F('fly', 1.55, 'premium', 'albatross', 'storm_roc'),
  sea_dragon: F('fly', 1.8, 'premium', 'storm_roc'),
  dragon_turtle: F('beast', 1.75, 'premium', 'ancient_turtle', 'sea_turtle'),
  thunderbird: F('fly', 1.75, 'premium', 'storm_roc', 'albatross'),
  abyss_knight: F('man', 1.5, 'premium', 'crown_cuirassier', 'drowned_officer'),
  // The world's armies' new kinds.
  crown_surgeon: F('man', 1.28, 'crown', 'crown_chaplain'),
  crown_midshipman: F('man', 1.2, 'crown', 'crown_drummer', 'crown_boy'),
  crown_provost: F('man', 1.3, 'crown', 'crown_inquisitor', 'crown_marine'),
  brine_sister: F('man', 1.28, 'choir', 'brine_witch', 'choir_acolyte'),
  choir_toller: F('man', 1.3, 'choir', 'choir_bellringer'),
  lamprey_zealot: F('man', 1.3, 'choir', 'tide_zealot'),
  abyss_ascendant: F('big', 1.78, 'choir', 'abyss_herald'),
  harpoon_commander: F('man', 1.36, 'harpoon', 'baleen_knight', 'leviathan_slayer'),
  try_pot: F('man', 1.28, 'harpoon', 'net_thrower', 'flenser'),
  harpoon_preceptor: F('man', 1.32, 'harpoon', 'baleen_knight'),
  fog_cutpurse: F('man', 1.24, 'brokers', 'smuggler', 'fog_runner'),
  fog_cardsharp: F('man', 1.26, 'brokers', 'fog_runner', 'duelist'),
  fog_viper: F('man', 1.28, 'brokers', 'poisoner'),
  company_cannoneer: F('man', 1.28, 'league', 'gunner'),
  petardier: F('man', 1.28, 'league', 'bombardier'),
  ledger_factor: F('man', 1.3, 'league', 'paymaster', 'company_musketeer'),
  island_elder: F('man', 1.28, 'free', 'tide_shaman'),
  shark_dancer: F('man', 1.26, 'free', 'spear_fisher', 'sharktooth'),
  reef_raider: F('man', 1.3, 'free', 'sharktooth'),
  volcano_guardian: F('big', 1.6, 'free', 'basalt_guardian'),
  dutchman_bulwark: F('man', 1.32, 'dutchman', 'dutchman_boarder'),
  ghost_marksman: F('man', 1.28, 'dutchman', 'ghost_musketeer'),
  ghost_cutthroat: F('man', 1.28, 'dutchman', 'ghost_sailor'),
  // The second dozen of the shop (2026-10-04), painted four to a sheet (tools/art/fleet_next.py).
  lantern_jelly: F('water', 1.3, 'premium', 'kraken_spawn', 'moray'),
  mantis_shrimp: F('beast', 1.1, 'premium', 'golden_crab', 'bell_hermit'),
  hammerhead: F('water', 1.4, 'premium', 'great_white', 'barracuda'),
  walrus_bull: F('beast', 1.4, 'premium', 'crocodile', 'monitor'),
  merrow_warden: F('man', 1.38, 'premium', 'deep_one', 'nautilus_knight'),
  sea_naga: F('water', 1.5, 'premium', 'pearl_siren', 'mermaid_queen', 'moray'),
  brass_automaton: F('big', 1.5, 'premium', 'gilded_golem', 'obsidian_golem'),
  storm_giant: F('big', 1.72, 'premium', 'leviathan_slayer', 'tidal_elemental'),
  ember_phoenix: F('fly', 1.55, 'premium', 'lava_drake', 'storm_eagle'),
  megalodon: F('water', 1.78, 'premium', 'great_white', 'kraken_spawn'),
  marid: F('water', 1.72, 'premium', 'mermaid_queen', 'pearl_siren'),
  ice_wyvern: F('fly', 1.78, 'premium', 'sea_wyvern', 'sea_dragon'),
  // The world's armies' second dozen (2026-10-04).
  hunt_master: F('man', 1.34, 'harpoon', 'harpoon_preceptor', 'master_harpooner'),
  stone_axeman: F('man', 1.3, 'free', 'sharktooth', 'reef_raider'),
  mask_archer: F('man', 1.3, 'free', 'island_archer', 'shark_dancer'),
  island_chief: F('man', 1.36, 'free', 'island_elder', 'island_warrior'),
  ghost_bomber: F('man', 1.28, 'dutchman', 'phantom_gunner', 'ghost_sailor'),
  ghost_commodore: F('man', 1.36, 'dutchman', 'drowned_officer'),
  crown_pikeman: F('man', 1.3, 'crown', 'crown_marine'),
  rime_witch: F('man', 1.28, 'choir', 'brine_witch', 'storm_witch'),
  line_harpooner: F('man', 1.28, 'harpoon', 'harpooner'),
  fog_chemist: F('man', 1.28, 'brokers', 'alchemist'),
  bounty_hunter: F('man', 1.3, 'league', 'debt_collector', 'enforcer'),
  frostbound: F('man', 1.28, 'dutchman', 'dutchman_boarder', 'ghost_sailor'),
  // The third dozen of the shop (2026-10-04), painted four to a sheet (tools/art/fleet_b3.py).
  war_parrot: F('fly', 1.1, 'premium', 'albatross', 'gull'),
  electric_eel: F('water', 1.35, 'premium', 'moray', 'sea_viper'),
  sea_otter: F('beast', 1.1, 'premium', 'sea_wolf', 'seal'),
  flying_squid: F('fly', 1.3, 'premium', 'giant_manta', 'lantern_wraith'),
  selkie: F('man', 1.3, 'premium', 'nautilus_knight', 'deep_one'),
  kelp_golem: F('big', 1.55, 'premium', 'coral_elemental', 'tidal_elemental'),
  giant_lobster: F('beast', 1.3, 'premium', 'golden_crab', 'crab_queen'),
  manticore: F('beast', 1.4, 'premium', 'sea_wolf', 'jaguar'),
  sea_cyclops: F('big', 1.72, 'premium', 'island_ape', 'basalt_guardian'),
  sea_hydra: F('water', 1.78, 'premium', 'frost_serpent', 'young_serpent'),
  coral_colossus: F('big', 1.8, 'premium', 'coral_elemental', 'tidal_elemental'),
  cloud_whale: F('fly', 1.8, 'premium', 'giant_manta', 'sea_dragon'),
  // The islands' third dozen (2026-10-04): the land's and the shore's creatures of the new lairs, painted four to a
  // sheet with the shop's (tools/art/fleet_b3.py).
  poison_frog: F('beast', 0.85, 'wild', 'giant_toad'),
  bilge_rat: F('beast', 0.85, 'wild', 'wild_boar', 'crab'),
  marine_iguana: F('beast', 1.05, 'wild', 'monitor'),
  ghost_crab: F('beast', 0.9, 'wild', 'crab', 'bell_hermit'),
  giant_centipede: F('beast', 1.2, 'wild', 'monitor', 'cave_wyrm'),
  jungle_spider: F('beast', 1.25, 'wild', 'giant_toad', 'crab_queen'),
  feral_bull: F('beast', 1.3, 'wild', 'wild_boar'),
  cinder_hound: F('beast', 1.25, 'wild', 'sea_wolf', 'jaguar'),
  cliff_harpy: F('fly', 1.3, 'wild', 'albatross', 'cave_bat'),
  banshee: F('fly', 1.35, 'wild', 'lantern_wraith'),
  plumed_serpent: F('fly', 1.75, 'wild', 'sea_dragon', 'storm_roc'),
  wreck_titan: F('big', 1.8, 'wild', 'basalt_guardian', 'abyss_herald'),
};

/** Painted kinds by body and whose: the stand-ins when none a kind names is there. */
const POOL: Record<Body, Record<string, UnitId[]>> = {
  man: {
    crown: ['crown_marine'], choir: ['tide_zealot', 'choir_acolyte'], harpoon: ['lancer', 'flenser'], brokers: ['fog_thief', 'smuggler'], league: ['company_guard', 'porter'],
    free: ['island_warrior', 'fisher'], dutchman: ['ghost_sailor'], premium: ['life_guard'], any: ['marine', 'sailor', 'deckhand'],
  },
  big: { choir: ['abyss_herald'], free: ['basalt_guardian'], any: ['deep_spawn', 'basalt_guardian'] },
  beast: { any: ['monitor', 'jaguar', 'crab'] },
  fly: { dutchman: ['lantern_wraith'], any: ['albatross', 'storm_roc', 'gull'] },
  water: { any: ['young_serpent', 'moray', 'reef_shark'] },
};

/** The painted kind that stands in for one not painted yet (`has`: whether a kind's own figure is there); null for a
 *  kind painted already, one not in the queue, or when nothing of its body is painted either. */
export function figureStandIn(u: string, has: (kind: string) => boolean): string | null {
  const f = FIGURES[u as UnitId];
  if (!f || has(u)) return null;
  for (const k of [...(f.like ?? []), ...(POOL[f.body][f.of] ?? []), ...POOL[f.body].any]) if (k !== u && has(k)) return k;
  return null;
}
