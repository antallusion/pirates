// The land's creatures (docs/18 II item 14): a family of fighting kinds beside H1's men — fourteen kinds over the seven
// tiers, from the crabs of a beach to the island's ancient guardian, the twelve wild beasts of the jungles, the
// marshes, the caves and the reefs after them, the five great beasts of the grottos and the guardians' seats
// (owner, 2026-10-03: the battle's creatures, tools/art/creatures.py), and the islands' third dozen (owner, 2026-10-04:
// «еще больше … существ»; docs/18 IX) for the lairs where an island's kind and level had the fewest to choose from.
// They are units as the men are (UNITS takes them in, so the boarding battle, the army's slots and the recruit window
// read them the same way), each with its stats on the HoMM3 scale, its specials (docs/18 item 16) and its face from
// the art in assets/: the creatures/* and monsters/* pictures, the portraits of the hermits, the Choir's cultists and
// the drowned, and the wild beasts' own battle figures (unit.<kind>). A kind with no picture of its own is a token of
// one that is, tinted and framed (BEAST_TINT; the list is in the journal of docs/18).

import type { UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type BeastId =
  | 'crab' | 'gull'
  | 'seal' | 'reef_shark'
  | 'rock_turtle' | 'marsh_serpent'
  | 'hermit' | 'lagoon_tentacle'
  | 'cultist' | 'surf_drowned'
  | 'young_serpent' | 'lantern_maw'
  | 'ancient_turtle' | 'shoal_leviathan'
  // The wild beasts (owner, 2026-10-03).
  | 'wild_boar' | 'giant_toad' | 'cave_bat' | 'barracuda'
  | 'jaguar' | 'monitor' | 'albatross' | 'moray' | 'bell_hermit'
  | 'island_ape' | 'crocodile'
  | 'giant_octopus'
  // The great beasts (owner, 2026-10-03).
  | 'crab_queen' | 'cave_wyrm' | 'mangrove_hydra' | 'ape_king' | 'storm_roc'
  // The islands' third dozen (owner, 2026-10-04).
  | 'poison_frog' | 'bilge_rat' | 'marine_iguana' | 'ghost_crab' | 'giant_centipede' | 'jungle_spider' | 'feral_bull'
  | 'cinder_hound' | 'cliff_harpy' | 'banshee' | 'plumed_serpent' | 'wreck_titan';

export const BEAST_IDS: BeastId[] = ['crab', 'gull', 'seal', 'reef_shark', 'rock_turtle', 'marsh_serpent', 'hermit', 'lagoon_tentacle', 'cultist', 'surf_drowned', 'young_serpent', 'lantern_maw', 'ancient_turtle', 'shoal_leviathan',
  'wild_boar', 'giant_toad', 'cave_bat', 'barracuda', 'jaguar', 'monitor', 'albatross', 'moray', 'bell_hermit', 'island_ape', 'crocodile', 'giant_octopus',
  'crab_queen', 'cave_wyrm', 'mangrove_hydra', 'ape_king', 'storm_roc',
  'poison_frog', 'bilge_rat', 'marine_iguana', 'ghost_crab', 'giant_centipede', 'jungle_spider', 'feral_bull', 'cinder_hound', 'cliff_harpy', 'banshee',
  'plumed_serpent', 'wreck_titan'];

type BeastStats = Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade'>;
const B = (id: BeastId, tier: number, s: BeastStats): UnitDef => ({ id, tier, up: false, base: id, upgrade: null, beast: true, ...s });

/** One creature of each kind (HoMM3's scale beside the men: a crab is a deckhand's match, the leviathan two drowned). */
export const BEASTS: Record<BeastId, UnitDef> = {
  crab: B('crab', 1, { atk: 2, def: 5, dmin: 1, dmax: 2, hp: 5, speed: 3, init: 4, shots: 0, specials: ['shell', 'swarm'], art: 'creature.crab', cost: 16 }),
  // docs/18 #47: a gull of the flock a seasoned sailor's match (it was two thirds of a deckhand: a flock aboard in
  // place of hands lost every fight).
  gull: B('gull', 1, { atk: 4, def: 2, dmin: 1, dmax: 3, hp: 6, speed: 7, init: 9, shots: 0, specials: ['flying', 'swarm'], art: 'creature.gull', cost: 24 }),
  seal: B('seal', 2, { atk: 5, def: 5, dmin: 2, dmax: 3, hp: 12, speed: 4, init: 6, shots: 0, specials: ['diving'], art: 'creature.seal', cost: 50 }),
  reef_shark: B('reef_shark', 2, { atk: 7, def: 3, dmin: 2, dmax: 5, hp: 8, speed: 5, init: 8, shots: 0, specials: ['diving'], art: 'monster.shark', cost: 60 }),
  rock_turtle: B('rock_turtle', 3, { atk: 4, def: 12, dmin: 2, dmax: 4, hp: 22, speed: 2, init: 3, shots: 0, specials: ['shell', 'regen'], art: 'creature.turtle', cost: 90 }),
  marsh_serpent: B('marsh_serpent', 3, { atk: 8, def: 5, dmin: 2, dmax: 5, hp: 12, speed: 5, init: 7, shots: 0, specials: ['poison'], art: 'monster.black_serpent', cost: 85 }),
  hermit: B('hermit', 4, { atk: 9, def: 6, dmin: 3, dmax: 5, hp: 12, speed: 4, init: 7, shots: 3, specials: ['shooter'], art: 'portrait.giver_hermit_m', cost: 110 }),
  lagoon_tentacle: B('lagoon_tentacle', 4, { atk: 10, def: 7, dmin: 3, dmax: 6, hp: 18, speed: 3, init: 6, shots: 0, specials: ['diving', 'retaliate_all'], art: 'monster.kraken_tentacle', cost: 140 }),
  cultist: B('cultist', 5, { atk: 10, def: 7, dmin: 4, dmax: 7, hp: 15, speed: 4, init: 8, shots: 4, specials: ['shooter', 'terror'], art: 'portrait.giver_cultist_m', cost: 200 }),
  surf_drowned: B('surf_drowned', 5, { atk: 11, def: 9, dmin: 4, dmax: 6, hp: 20, speed: 4, init: 6, shots: 0, specials: ['undead', 'diving'], art: 'portrait.drowned', cost: 190 }),
  young_serpent: B('young_serpent', 6, { atk: 14, def: 11, dmin: 6, dmax: 10, hp: 32, speed: 6, init: 10, shots: 0, specials: ['poison', 'diving'], art: 'monster.young_serpent', cost: 360 }),
  lantern_maw: B('lantern_maw', 6, { atk: 13, def: 12, dmin: 6, dmax: 9, hp: 30, speed: 5, init: 8, shots: 0, specials: ['terror', 'regen'], art: 'monster.lantern_maw', cost: 350 }),
  ancient_turtle: B('ancient_turtle', 7, { atk: 15, def: 22, dmin: 8, dmax: 14, hp: 70, speed: 2, init: 4, shots: 0, specials: ['shell', 'regen', 'retaliate_all'], art: 'sight.giant_turtle', cost: 700 }),
  shoal_leviathan: B('shoal_leviathan', 7, { atk: 20, def: 16, dmin: 12, dmax: 18, hp: 60, speed: 5, init: 8, shots: 0, specials: ['terror', 'diving', 'sweep'], art: 'creature.leviathan', cost: 800 }),
  // The wild beasts (owner, 2026-10-03): each its own painted figure, the first of its four poses its face.
  wild_boar: B('wild_boar', 2, { atk: 6, def: 4, dmin: 2, dmax: 4, hp: 11, speed: 5, init: 6, shots: 0, specials: [], art: 'unit.wild_boar', cost: 55 }),
  giant_toad: B('giant_toad', 2, { atk: 4, def: 5, dmin: 1, dmax: 3, hp: 12, speed: 3, init: 5, shots: 0, specials: ['poison'], art: 'unit.giant_toad', cost: 50 }),
  cave_bat: B('cave_bat', 2, { atk: 6, def: 3, dmin: 2, dmax: 3, hp: 8, speed: 8, init: 10, shots: 0, specials: ['flying', 'swarm'], art: 'unit.cave_bat', cost: 45 }),
  barracuda: B('barracuda', 2, { atk: 8, def: 2, dmin: 2, dmax: 5, hp: 7, speed: 6, init: 9, shots: 0, specials: ['diving'], art: 'unit.barracuda', cost: 55 }),
  jaguar: B('jaguar', 3, { atk: 9, def: 5, dmin: 2, dmax: 5, hp: 13, speed: 7, init: 10, shots: 0, specials: ['no_retaliation'], art: 'unit.jaguar', cost: 95 }),
  monitor: B('monitor', 3, { atk: 7, def: 7, dmin: 2, dmax: 4, hp: 18, speed: 4, init: 5, shots: 0, specials: ['poison'], art: 'unit.monitor', cost: 90 }),
  albatross: B('albatross', 3, { atk: 7, def: 4, dmin: 2, dmax: 5, hp: 12, speed: 9, init: 9, shots: 0, specials: ['flying'], art: 'unit.albatross', cost: 85 }),
  moray: B('moray', 3, { atk: 9, def: 5, dmin: 3, dmax: 5, hp: 14, speed: 4, init: 8, shots: 0, specials: ['diving'], art: 'unit.moray', cost: 95 }),
  bell_hermit: B('bell_hermit', 3, { atk: 5, def: 11, dmin: 2, dmax: 4, hp: 20, speed: 3, init: 4, shots: 0, specials: ['shell', 'retaliate_all'], art: 'unit.bell_hermit', cost: 95 }),
  island_ape: B('island_ape', 4, { atk: 11, def: 7, dmin: 3, dmax: 6, hp: 18, speed: 5, init: 7, shots: 0, specials: [], art: 'unit.island_ape', cost: 130 }),
  crocodile: B('crocodile', 4, { atk: 10, def: 10, dmin: 3, dmax: 6, hp: 20, speed: 3, init: 5, shots: 0, specials: ['diving'], art: 'unit.crocodile', cost: 145 }),
  giant_octopus: B('giant_octopus', 5, { atk: 12, def: 8, dmin: 4, dmax: 6, hp: 22, speed: 5, init: 8, shots: 0, specials: ['diving', 'retaliate_all'], art: 'unit.giant_octopus', cost: 210 }),
  // The great beasts (owner, 2026-10-03): a grotto's own or an island's guardian, each its own painted figure too — the
  // crab queen a heavy fifth tier, the wyrm and the hydra the serpent's and the maw's match, the ape king and the roc
  // the turtle's and the leviathan's.
  crab_queen: B('crab_queen', 5, { atk: 10, def: 14, dmin: 4, dmax: 7, hp: 32, speed: 3, init: 5, shots: 0, specials: ['shell', 'retaliate_all'], art: 'unit.crab_queen', cost: 270 }),
  cave_wyrm: B('cave_wyrm', 6, { atk: 14, def: 12, dmin: 6, dmax: 10, hp: 32, speed: 5, init: 8, shots: 0, specials: ['terror', 'poison'], art: 'unit.cave_wyrm', cost: 360 }),
  mangrove_hydra: B('mangrove_hydra', 6, { atk: 13, def: 11, dmin: 5, dmax: 9, hp: 38, speed: 4, init: 7, shots: 0, specials: ['retaliate_all', 'regen'], art: 'unit.mangrove_hydra', cost: 380 }),
  ape_king: B('ape_king', 7, { atk: 19, def: 15, dmin: 11, dmax: 17, hp: 64, speed: 6, init: 9, shots: 0, specials: ['sweep', 'terror'], art: 'unit.ape_king', cost: 780 }),
  storm_roc: B('storm_roc', 7, { atk: 20, def: 12, dmin: 10, dmax: 18, hp: 52, speed: 9, init: 11, shots: 0, specials: ['flying', 'sweep'], art: 'unit.storm_roc', cost: 760 }),
  // The islands' third dozen (owner, 2026-10-04: «еще больше … существ»; docs/18 IX): the kinds of the new lairs, where
  // an island's kind and level had the fewest to choose from — the swamps' and the beaches' first tiers, the volcanic
  // shores, the dead isles and the ship graveyards, the deepest waters' shores, grottos and guardians' seats. Each
  // calibrated by its tier's peers (none over the heaviest of its tier, so the shop's rule stands as it was); each its
  // own painted figure, a painted kindred of its body standing in till its sheet is cut (unitart.ts).
  poison_frog: B('poison_frog', 1, { atk: 3, def: 3, dmin: 1, dmax: 2, hp: 5, speed: 4, init: 7, shots: 0, specials: ['poison', 'swarm'], art: 'unit.poison_frog', cost: 18 }),
  bilge_rat: B('bilge_rat', 1, { atk: 4, def: 2, dmin: 1, dmax: 2, hp: 5, speed: 6, init: 8, shots: 0, specials: ['swarm', 'no_retaliation'], art: 'unit.bilge_rat', cost: 16 }),
  marine_iguana: B('marine_iguana', 2, { atk: 5, def: 6, dmin: 2, dmax: 3, hp: 12, speed: 3, init: 5, shots: 0, specials: ['diving', 'regen'], art: 'unit.marine_iguana', cost: 50 }),
  ghost_crab: B('ghost_crab', 2, { atk: 6, def: 5, dmin: 2, dmax: 3, hp: 9, speed: 7, init: 9, shots: 0, specials: ['shell', 'no_retaliation'], art: 'unit.ghost_crab', cost: 50 }),
  giant_centipede: B('giant_centipede', 3, { atk: 8, def: 6, dmin: 2, dmax: 4, hp: 14, speed: 5, init: 8, shots: 0, specials: ['poison', 'double_strike'], art: 'unit.giant_centipede', cost: 90 }),
  jungle_spider: B('jungle_spider', 4, { atk: 10, def: 7, dmin: 3, dmax: 5, hp: 16, speed: 5, init: 8, shots: 0, specials: ['poison', 'bind'], art: 'unit.jungle_spider', cost: 130 }),
  feral_bull: B('feral_bull', 4, { atk: 11, def: 8, dmin: 3, dmax: 6, hp: 19, speed: 5, init: 6, shots: 0, specials: ['retaliate_all'], art: 'unit.feral_bull', cost: 135 }),
  cinder_hound: B('cinder_hound', 5, { atk: 12, def: 8, dmin: 4, dmax: 7, hp: 20, speed: 7, init: 10, shots: 0, specials: ['breath'], art: 'unit.cinder_hound', cost: 210 }),
  cliff_harpy: B('cliff_harpy', 5, { atk: 11, def: 7, dmin: 4, dmax: 6, hp: 18, speed: 8, init: 11, shots: 0, specials: ['flying', 'terror'], art: 'unit.cliff_harpy', cost: 200 }),
  banshee: B('banshee', 6, { atk: 13, def: 11, dmin: 5, dmax: 9, hp: 30, speed: 7, init: 10, shots: 0, specials: ['flying', 'undead', 'chill'], art: 'unit.banshee', cost: 350 }),
  plumed_serpent: B('plumed_serpent', 7, { atk: 20, def: 15, dmin: 10, dmax: 16, hp: 56, speed: 9, init: 11, shots: 0, specials: ['flying', 'bind', 'regen'], art: 'unit.plumed_serpent', cost: 760 }),
  wreck_titan: B('wreck_titan', 7, { atk: 17, def: 20, dmin: 10, dmax: 15, hp: 66, speed: 3, init: 5, shots: 0, specials: ['shell', 'sweep', 'steady'], art: 'unit.wreck_titan', cost: 760 }),
};

export const isBeast = (u: string): u is BeastId => (BEAST_IDS as string[]).includes(u);

// ------------------------------------------------------------------------------------------------ docs/18 IV: the sea's kinds

/** The sea's own creatures that drift into a captain's army (docs/18 IV item 37) beside the land's kinds: the
 *  mermaid of the nets, the sea turtle of the weed, and the two legends of a season (the white whale, the young kraken).
 *  The seals, the sharks, the young serpent, the drowned of the surf and the tentacles are the land's kinds already. */
export type SeaBeastId = 'mermaid' | 'sea_turtle' | 'white_whale' | 'young_kraken';
export const SEA_BEAST_IDS: SeaBeastId[] = ['mermaid', 'sea_turtle', 'white_whale', 'young_kraken'];
/** Every creature kind: the land's and the sea's. */
export type CreatureId = BeastId | SeaBeastId;
export const CREATURE_IDS: CreatureId[] = [...BEAST_IDS, ...SEA_BEAST_IDS];

const S = (id: SeaBeastId, tier: number, s: BeastStats & { legend?: boolean }): UnitDef => ({ id, tier, up: false, base: id, upgrade: null, beast: true, ...s });

export const SEA_BEASTS: Record<SeaBeastId, UnitDef> = {
  mermaid: S('mermaid', 4, { atk: 9, def: 7, dmin: 3, dmax: 6, hp: 16, speed: 6, init: 9, shots: 3, specials: ['shooter', 'diving'], art: 'portrait.giver_pearl_diver_f', cost: 150 }),
  sea_turtle: S('sea_turtle', 3, { atk: 5, def: 11, dmin: 2, dmax: 4, hp: 24, speed: 3, init: 4, shots: 0, specials: ['shell', 'diving'], art: 'creature.turtle', cost: 95 }),
  white_whale: S('white_whale', 7, { atk: 22, def: 20, dmin: 14, dmax: 22, hp: 160, speed: 4, init: 6, shots: 0, specials: ['sweep', 'regen', 'diving', 'retaliate_all'], art: 'monster.sperm_whale', cost: 2400, legend: true }),
  young_kraken: S('young_kraken', 7, { atk: 24, def: 16, dmin: 12, dmax: 20, hp: 140, speed: 5, init: 8, shots: 0, specials: ['terror', 'sweep', 'retaliate_all'], art: 'monster.kraken', cost: 2400, legend: true }),
};

export const isSeaBeast = (u: string): u is SeaBeastId => (SEA_BEAST_IDS as string[]).includes(u);
/** Any creature, the land's or the sea's (not a man). */
export const isCreature = (u: string): u is CreatureId => isBeast(u) || isSeaBeast(u);

/** The creatures with no picture of their own: a token of an existing one, tinted (a CSS/canvas filter) and framed
 *  (docs/18's rule; listed in its journal). The rest show their own art. */
export const BEAST_TINT: Partial<Record<CreatureId, string>> = {
  rock_turtle: 'grayscale(0.7) sepia(0.35) brightness(0.8) contrast(1.15)',
  marsh_serpent: 'hue-rotate(70deg) saturate(1.4) brightness(0.85)',
  hermit: 'sepia(0.55) saturate(0.8) brightness(0.9)',
  cultist: 'hue-rotate(160deg) saturate(0.7) brightness(0.85)',
  surf_drowned: 'hue-rotate(110deg) saturate(0.6) brightness(0.8)',
  reef_shark: 'hue-rotate(-15deg) saturate(1.2)',
  // docs/18 IV: the mermaid is a pearl diver's portrait gone sea-green; the white whale a sperm whale bleached pale.
  mermaid: 'hue-rotate(115deg) saturate(1.3) brightness(0.95)',
  white_whale: 'grayscale(1) brightness(1.55) contrast(0.9)',
};

/** English plurals the server's lines name them by (the client words them in Russian). */
export const BEAST_PLURAL: Record<CreatureId, Tr> = {
  crab: ['shore crabs', 'береговые крабы'],
  gull: ['carrion gulls', 'чайки-падальщики'],
  seal: ['seals', 'тюлени'],
  reef_shark: ['shallows sharks', 'акулы мелководья'],
  rock_turtle: ['rock turtles', 'черепахи-скалы'],
  marsh_serpent: ['marsh serpents', 'болотные змеи'],
  hermit: ['hermit marauders', 'мародёры-отшельники'],
  lagoon_tentacle: ['lagoon tentacles', 'щупальца лагуны'],
  cultist: ['cultists of the Choir', 'культисты Хора'],
  surf_drowned: ['the surf’s drowned', 'утопленники прибоя'],
  young_serpent: ['young serpents', 'молодые змеи'],
  lantern_maw: ['lantern maws', 'светочи-пасти'],
  ancient_turtle: ['ancient turtles', 'древние черепахи'],
  shoal_leviathan: ['leviathans of the shoal', 'левиафаны на мели'],
  wild_boar: ['wild boars', 'дикие кабаны'],
  giant_toad: ['giant toads', 'гигантские жабы'],
  cave_bat: ['cave bats', 'пещерные летучие мыши'],
  barracuda: ['barracudas', 'барракуды'],
  jaguar: ['jaguars', 'ягуары'],
  monitor: ['giant monitors', 'гигантские вараны'],
  albatross: ['albatrosses', 'альбатросы'],
  moray: ['giant morays', 'гигантские мурены'],
  bell_hermit: ['bell hermits', 'крабы-колокола'],
  island_ape: ['island apes', 'островные обезьяны'],
  crocodile: ['swamp crocodiles', 'болотные крокодилы'],
  giant_octopus: ['giant octopuses', 'гигантские осьминоги'],
  crab_queen: ['coconut crab queens', 'королевы пальмовых крабов'],
  cave_wyrm: ['cave wyrms', 'пещерные змеи'],
  mangrove_hydra: ['mangrove hydras', 'мангровые гидры'],
  ape_king: ['ape kings', 'короли обезьян'],
  storm_roc: ['storm rocs', 'грозовые рухи'],
  poison_frog: ['poison frogs', 'ядовитые лягушки'],
  bilge_rat: ['bilge rats', 'трюмные крысы'],
  marine_iguana: ['marine iguanas', 'морские игуаны'],
  ghost_crab: ['ghost crabs', 'крабы-призраки'],
  giant_centipede: ['giant centipedes', 'гигантские сколопендры'],
  jungle_spider: ['jungle spiders', 'пауки джунглей'],
  feral_bull: ['feral bulls', 'одичавшие быки'],
  cinder_hound: ['cinder hounds', 'пепельные гончие'],
  cliff_harpy: ['cliff harpies', 'скальные гарпии'],
  banshee: ['banshees', 'банши'],
  plumed_serpent: ['plumed serpents', 'пернатые змеи'],
  wreck_titan: ['wreck titans', 'титаны обломков'],
  mermaid: ['mermaids', 'русалки'],
  sea_turtle: ['sea turtles', 'морские черепахи'],
  white_whale: ['the white whale', 'белый кит'],
  young_kraken: ['the young kraken', 'молодой кракен'],
};

// ------------------------------------------------------------------------------------------------ the land's resources

/** What the land's creatures leave besides the H3 resources (docs/18 item 17): shell, bone, venom — kept in the
 *  captain's own store (section V gives them their uses); pearls are the H3 resource of the same name. */
export type LandRes = 'shell' | 'bone' | 'venom';
export const LAND_RES: LandRes[] = ['shell', 'bone', 'venom'];
export const LAND_RES_DEF: Record<LandRes, { name: Tr; icon: string; /** silver a piece is reckoned at */ value: number }> = {
  shell: { name: ['shell', 'панцирь'], icon: 'tattoo_turtle', value: 40 },
  bone: { name: ['bone', 'кость'], icon: 'good_whalebone', value: 30 },
  venom: { name: ['venom', 'яд'], icon: 'mod_lantern_gland', value: 60 },
};

/** What each kind leaves of the land's resources, a creature (fractions grow into pieces over a lair). */
export const BEAST_RES: Record<BeastId, Partial<Record<LandRes | 'pearls', number>>> = {
  crab: { shell: 0.12 },
  gull: { bone: 0.05 },
  seal: { bone: 0.2 },
  reef_shark: { bone: 0.15 },
  rock_turtle: { shell: 0.4 },
  marsh_serpent: { venom: 0.25 },
  hermit: { bone: 0.1, pearls: 0.05 },
  lagoon_tentacle: { venom: 0.2, pearls: 0.05 },
  cultist: { bone: 0.2, pearls: 0.1 },
  surf_drowned: { bone: 0.3, pearls: 0.08 },
  young_serpent: { venom: 0.8, bone: 0.4 },
  lantern_maw: { venom: 0.6, pearls: 0.2 },
  ancient_turtle: { shell: 3, pearls: 0.5 },
  shoal_leviathan: { bone: 3, pearls: 0.6 },
  wild_boar: { bone: 0.15 },
  giant_toad: { venom: 0.15 },
  cave_bat: { bone: 0.06 },
  barracuda: { bone: 0.12 },
  jaguar: { bone: 0.25 },
  monitor: { venom: 0.2, bone: 0.1 },
  albatross: { bone: 0.15 },
  moray: { bone: 0.2 },
  bell_hermit: { shell: 0.3, pearls: 0.05 },
  island_ape: { bone: 0.4 },
  crocodile: { shell: 0.2, bone: 0.3 },
  giant_octopus: { venom: 0.3, pearls: 0.1 },
  crab_queen: { shell: 1.5, pearls: 0.3 },
  cave_wyrm: { venom: 0.8, bone: 0.5 },
  mangrove_hydra: { venom: 0.9, bone: 0.3 },
  ape_king: { bone: 3, pearls: 0.4 },
  storm_roc: { bone: 2.5, pearls: 0.4 },
  poison_frog: { venom: 0.08 },
  bilge_rat: { pearls: 0.02 },
  marine_iguana: { shell: 0.12 },
  ghost_crab: { shell: 0.12, pearls: 0.02 },
  giant_centipede: { venom: 0.25, shell: 0.05 },
  jungle_spider: { venom: 0.35 },
  feral_bull: { shell: 0.1, pearls: 0.03 },
  cinder_hound: { venom: 0.3 },
  cliff_harpy: { pearls: 0.1 },
  banshee: { pearls: 0.3 },
  plumed_serpent: { venom: 1, pearls: 0.5 },
  wreck_titan: { shell: 2, pearls: 0.6 },
};
