// The land's creatures (docs/18 II item 14): a family of fighting kinds beside H1's men — fourteen kinds over the seven
// tiers, from the crabs of a beach to the island's ancient guardian. They are units as the men are (UNITS takes them
// in, so the boarding battle, the army's slots and the recruit window read them the same way), each with its stats on
// the HoMM3 scale, its specials (docs/18 item 16) and its face from the art already in assets/: the creatures/* and
// monsters/* pictures, the portraits of the hermits, the Choir's cultists and the drowned. A kind with no picture of
// its own is a token of one that is, tinted and framed (BEAST_TINT; the list is in the journal of docs/18).

import type { UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type BeastId =
  | 'crab' | 'gull'
  | 'seal' | 'reef_shark'
  | 'rock_turtle' | 'marsh_serpent'
  | 'hermit' | 'lagoon_tentacle'
  | 'cultist' | 'surf_drowned'
  | 'young_serpent' | 'lantern_maw'
  | 'ancient_turtle' | 'shoal_leviathan';

export const BEAST_IDS: BeastId[] = ['crab', 'gull', 'seal', 'reef_shark', 'rock_turtle', 'marsh_serpent', 'hermit', 'lagoon_tentacle', 'cultist', 'surf_drowned', 'young_serpent', 'lantern_maw', 'ancient_turtle', 'shoal_leviathan'];

type BeastStats = Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade'>;
const B = (id: BeastId, tier: number, s: BeastStats): UnitDef => ({ id, tier, up: false, base: id, upgrade: null, beast: true, ...s });

/** One creature of each kind (HoMM3's scale beside the men: a crab is a deckhand's match, the leviathan two drowned). */
export const BEASTS: Record<BeastId, UnitDef> = {
  crab: B('crab', 1, { atk: 2, def: 5, dmin: 1, dmax: 2, hp: 5, speed: 3, init: 4, shots: 0, specials: ['shell', 'swarm'], art: 'creature.crab', cost: 16 }),
  gull: B('gull', 1, { atk: 3, def: 1, dmin: 1, dmax: 2, hp: 3, speed: 7, init: 9, shots: 0, specials: ['flying', 'swarm'], art: 'creature.gull', cost: 14 }),
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
  ancient_turtle: B('ancient_turtle', 7, { atk: 15, def: 22, dmin: 8, dmax: 14, hp: 70, speed: 2, init: 4, shots: 0, specials: ['shell', 'regen', 'retaliate_all'], art: 'monster.giant_turtle', cost: 700 }),
  shoal_leviathan: B('shoal_leviathan', 7, { atk: 20, def: 16, dmin: 12, dmax: 18, hp: 60, speed: 5, init: 8, shots: 0, specials: ['terror', 'diving', 'sweep'], art: 'creature.leviathan', cost: 800 }),
};

export const isBeast = (u: string): u is BeastId => (BEAST_IDS as string[]).includes(u);

/** The creatures with no picture of their own: a token of an existing one, tinted (a CSS/canvas filter) and framed
 *  (docs/18's rule; listed in its journal). The rest show their own art. */
export const BEAST_TINT: Partial<Record<BeastId, string>> = {
  rock_turtle: 'grayscale(0.7) sepia(0.35) brightness(0.8) contrast(1.15)',
  marsh_serpent: 'hue-rotate(70deg) saturate(1.4) brightness(0.85)',
  hermit: 'sepia(0.55) saturate(0.8) brightness(0.9)',
  cultist: 'hue-rotate(160deg) saturate(0.7) brightness(0.85)',
  surf_drowned: 'hue-rotate(110deg) saturate(0.6) brightness(0.8)',
  reef_shark: 'hue-rotate(-15deg) saturate(1.2)',
};

/** English plurals the server's lines name them by (the client words them in Russian). */
export const BEAST_PLURAL: Record<BeastId, Tr> = {
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
};
