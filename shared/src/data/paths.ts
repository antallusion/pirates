// The hero in the boarding battle — her path, her book (docs/18 I, items 1–12). Each of the six captains' paths
// brings its own battle identity onto the HoMM3-style deck fight of docs/17:
//
//  1. An innate move, once a battle and free (no will, no stamina): the corsair's Last Volley, the smuggler's Smoke
//     Screen, the Reaver's Blood Harvest, the navigator's Following Squall, the Drowned's Call of the Depths, the
//     Black Admiral's Line.
//  2. Each path has a home school among the order book's six. The four of H2 stay (fire and powder, wind, water and
//     the deep, steel and men) and two are added beside them (the hook and the boarding; fog and shadow). Three
//     schools are physical, three magical. Her home school is cheaper and stronger for her (HoMM3's native magic);
//     another path's page costs her more.
//  3. Six path books of six pages, levels 1–5, three physical and three magical a path: a fresh page opens as her
//     hero grows (PAGE_UNLOCK); the common pages of docs/17 stay common.
//  4. Stamina beside Will: physical moves spend Stamina (her Attack and Defense make it; it comes back a share every
//     round, and whole with rest), magical ones spend Will as before.
//  5. Her path's ultimate from hero level 20: once a battle, a great effect, drawn with the battle's own procedural
//     effects (client/src/ui/tactical.ts).
//  6. Talents: two or three nodes in every tree also lift her path book in the battle (TALENT_BOOK). Their sea side
//     is untouched.
//  7. The officers' own small abilities on their stacks live in shared/src/data/tactical.ts (TAC_ORDER_OF).
//  8. Named captains of the sea — pirates, barons, hunters — fight with paths and books (npcPathOf).
// 10. Scrolls of pages from lairs and bosses (each a page for one battle cast), and another path's page taught at a
//     guild for twice the price.
// And after them (owner, 2026-10-03): twenty more common pages of the order book over the six schools (BOOK_PAGES).
//
// Pure data and reckoning; the battle applies it in server/src/game/tacbattle.ts, the hero keeps it in
// server/src/game/hero.ts and server/src/game/pathbook.ts.

import type { CaptainId } from './captains.ts';

/** The order book's six schools (docs/17 H2's four, and the two the paths add). */
export type School = 'fire' | 'wind' | 'water' | 'steel' | 'board' | 'fog';
/** Physical (Stamina) or magical (Will). */
export type SchoolKind = 'phys' | 'magic';
export const SCHOOL_KIND: Record<School, SchoolKind> = { fire: 'phys', steel: 'phys', board: 'phys', wind: 'magic', water: 'magic', fog: 'magic' };
/** Each path's home school. */
export const PATH_SCHOOL: Record<CaptainId, School> = { corsair: 'fire', reaver: 'board', admiral: 'steel', navigator: 'wind', drowned: 'water', smuggler: 'fog' };
export const PATH_KIND: Record<CaptainId, SchoolKind> = { corsair: 'phys', reaver: 'phys', admiral: 'phys', navigator: 'magic', drowned: 'magic', smuggler: 'magic' };
export const PATH_IDS: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];

/** Her home school: its orders this much stronger and this much cheaper (HoMM3's native magic). */
export const HOME_MUL = 1.1;
export const HOME_COST = 0.85;
/** Another path's own page: this much dearer. */
export const FOREIGN_COST = 1.5;
/** Another path's page at a guild: twice the price of a common order of its level. */
export const FOREIGN_PRICE = 2;

/** What a move lays on stacks for a while (summed over everything that holds). Shares are fractions (+0.2 = 20%). */
export interface BtMods {
  /** Her blows (and the answers) and her shots, harder by a share. */
  melee?: number;
  shot?: number;
  /** Damage she takes, more (+) or less (−) by a share; and from shots only. */
  taken?: number;
  shotTaken?: number;
  speed?: number;
  init?: number;
  /** Morale and luck points. */
  morale?: number;
  luck?: number;
  /** Her shooters cannot see to fire. */
  blind?: boolean;
  /** Her blows draw no answer. */
  noRet?: boolean;
  /** She cannot answer a blow. */
  noAnswer?: boolean;
  /** She never freezes in fear. */
  steady?: boolean;
  /** The common pages after docs/18 (BOOK_PAGES): spellbound, she loses her turns (a blow or a shot wakes her);
   *  maddened, as her turn comes she falls on the nearest of her own she can reach (or stands lost). */
  still?: boolean;
  mad?: boolean;
}
export type BtModKey = keyof BtMods;

/** What a page, an innate move or an ultimate does when given. Damage is a share of the captain's blast (a share of
 *  her side's strength as it came aboard, the ladder on it, her Power and school on it); heals are shares of each
 *  stack's strength. `rounds` 0: for this round only; 1: this round and the next (as the H2 orders hold). */
export interface PageFx {
  target: 'enemy' | 'own' | 'none';
  /** A blow on the target, and half-blows on those beside it. */
  dmg?: number;
  ring?: number;
  /** A blow on every one of her stacks; on her shooters only. */
  all?: number;
  shooters?: number;
  /** A share of every one of her stacks dragged down (men, not damage). */
  drain?: number;
  /** Every stack of hers heals a share; `raise` stands the fallen up again, the dead men too. */
  heal?: number;
  raise?: number;
  /** On her own side, on hers, on the stack pointed at. */
  self?: BtMods;
  foe?: BtMods;
  one?: BtMods;
  rounds?: number;
  /** The stack pointed at acts again this round; every stack of hers acts once more (or, `allShare`, her strongest
   *  share of them). */
  again?: boolean;
  allAgain?: boolean;
  allShare?: number;
  /** docs/25 item 70: an echoed «another turn» (a second captain of one path, tacbattle.ts echoFx) — given this share of
   *  the times. */
  againShare?: number;
  /** Her side's next blows draw no answer (how many; a weak hand fewer). */
  free?: number;
  /** The crew's heart (0..100) up, hers down. */
  heart?: number;
  dread?: number;
  /** The common pages after docs/18 (BOOK_PAGES). The blow leaps on to this many more stacks of hers, each the
   *  nearest to the last and CHAIN_FALL of the blow before; a blow on every stack of hers in the row of the one
   *  pointed at. */
  chain?: number;
  row?: number;
  /** The stack of hers pointed at sickens: this share of the blast as each of her next SICK_TURNS turns comes. */
  sicken?: number;
  /** The deck under the stack of hers pointed at catches fire; every fire aboard goes out. */
  fire?: boolean;
  douse?: boolean;
  /** Her own stack pointed at heals this share. */
  mend?: number;
  /** All the other captain laid on both decks (orders, path moves, officers' words) ends at once; she can give no
   *  order nor path move this round and `hush` − 1 more. */
  clear?: boolean;
  hush?: number;
}
/** Each leap of the forked blow is this share of the one before; a sickness bites as this many of her turns come. */
export const CHAIN_FALL = 0.6;
export const SICK_TURNS = 3;

/** A page of a path book (an order of the book, shared/src/data/hero.ts makes it one). */
export interface PathPage {
  id: PathPageId;
  path: CaptainId;
  school: School;
  level: 1 | 2 | 3 | 4 | 5;
  /** Stamina or Will, by the school. */
  cost: number;
  /** Rounds before it may be given again. */
  cd: number;
  icon: string;
  name: [string, string];
  text: [string, string];
  fx: PageFx;
}

export type PathPageId =
  | 'cs_chain_shot' | 'cs_spotter' | 'cs_pistol_line' | 'cs_gunsmoke' | 'cs_grape' | 'cs_iron_tide'
  | 'sm_knives' | 'sm_fog_veil' | 'sm_caltrops' | 'sm_false_colours' | 'sm_powder_trail' | 'sm_blind_fog'
  | 'rv_hook' | 'rv_blood_scent' | 'rv_berserk' | 'rv_howl' | 'rv_butcher' | 'rv_red_mist'
  | 'nv_marlinspike' | 'nv_tailwind' | 'nv_flank_drill' | 'nv_squall' | 'nv_harpoon_line' | 'nv_eye_of_storm'
  | 'dr_drowning_grip' | 'dr_brine_kiss' | 'dr_anchor_chain' | 'dr_undertow' | 'dr_barnacles' | 'dr_abyss'
  | 'ad_volley_order' | 'ad_signal_flags' | 'ad_square' | 'ad_fog_of_war' | 'ad_bayonets' | 'ad_admiralty';

/** docs/25 item 53 (owner, 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и умения
 *  решали»): a path's moves by four separate knobs, tuned on real builds — her level's skills and artifacts
 *  (`node tools/balance-paths.ts --roles`; before, one figure scaled them all and fell with the level, tuned on
 *  skill-less, gear-less heroes, so the holds faded to nothing and lost their rounds by levels 16–46):
 *  - `power`: what her blows and drags lay, at each of POWER_AT's hero levels (the line between them; beyond, the
 *    last). Her school's lift grows with her Power, skills and artifacts and a boarding's blows slow with its level
 *    (docs/25 item 44), so this is what keeps a page's harm a like share of an army at every level;
 *  - `mend`: what her heals and raises stand up again, the same way (a heal is a share of a stack: the boarding's
 *    slower blows do not slow it, so it has its own figures);
 *  - `buff`: the shares a hold lays (blows harder, harm taken less …) — the same at every level;
 *  - `pts`: points of speed, initiative, morale and luck, and blows that draw no answer — never under one;
 *  - the hold: as long as written (`rounds`), and her Power a round more at most (PATH_HOLD_MAX) — never shorter.
 *  Each page lays 8–25% in its role at every level band (tests/balance/boarding.test.ts). */
export interface PathKnobs {
  power: readonly number[];
  mend: readonly number[];
  buff: number;
  pts: number;
}
/** The hero levels `power` and `mend` stand at (docs/25 item 70: the levels the paths' matrix is read at — 5, 15, 30, 45,
 *  60 — so each level's figures are its own; they stood at 25 and 40 before). */
export const POWER_AT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60] as const;
/** The path books' pages. */
export const PATH_KNOBS: Record<CaptainId, PathKnobs> = {
  corsair: { power: [0.78, 0.72, 0.88, 0.61, 0.55, 0.99, 0.55, 0.56, 0.63, 0.74, 0.35, 0.26, 0.39, 0.27, 0.41, 0.27, 0.23, 0.36, 0.13, 0.2, 0.16, 0.14, 0.24, 0.12, 0.26, 0.16, 0.16, 0.24, 0.23, 0.12, 0.16, 0.15, 0.22, 0.14, 0.22, 0.16, 0.19, 0.21, 0.18, 0.15, 0.15, 0.16, 0.24, 0.19, 0.21, 0.28, 0.25, 0.23, 0.2, 0.19, 0.2, 0.2, 0.2, 0.18, 0.2, 0.2, 0.18, 0.18, 0.18, 0.19], mend: [1.04, 0.96, 1.17, 0.8, 0.74, 1.32, 0.72, 0.75, 0.83, 0.98, 0.47, 0.35, 0.52, 0.36, 0.54, 0.36, 0.31, 0.48, 0.18, 0.26, 0.21, 0.19, 0.31, 0.17, 0.34, 0.21, 0.21, 0.32, 0.31, 0.16, 0.21, 0.2, 0.29, 0.19, 0.3, 0.21, 0.25, 0.28, 0.25, 0.21, 0.2, 0.21, 0.32, 0.25, 0.27, 0.37, 0.32, 0.3, 0.26, 0.25, 0.26, 0.26, 0.26, 0.24, 0.26, 0.26, 0.23, 0.24, 0.24, 0.25], buff: 1, pts: 1 },
  smuggler: { power: [1.48, 1.37, 1.28, 1.33, 1.5, 1.22, 1.1, 1.1, 1.01, 0.99, 0.95, 0.94, 0.86, 0.83, 0.86, 0.77, 0.72, 0.76, 0.5, 0.57, 0.16, 0.14, 0.25, 0.14, 0.16, 0.14, 0.15, 0.23, 0.14, 0.16, 0.18, 0.19, 0.22, 0.19, 0.25, 0.25, 0.22, 0.23, 0.23, 0.23, 0.22, 0.23, 0.25, 0.3, 0.28, 0.32, 0.34, 0.24, 0.35, 0.19, 0.22, 0.21, 0.2, 0.19, 0.22, 0.22, 0.3, 0.2, 0.27, 0.21], mend: [1.96, 1.8, 1.69, 1.76, 1.98, 1.62, 1.46, 1.46, 1.33, 1.31, 1.26, 1.22, 1.15, 1.1, 1.15, 1.02, 0.94, 1, 0.67, 0.75, 0.21, 0.18, 0.33, 0.18, 0.21, 0.19, 0.2, 0.3, 0.19, 0.22, 0.24, 0.25, 0.29, 0.26, 0.33, 0.33, 0.3, 0.31, 0.3, 0.31, 0.29, 0.31, 0.33, 0.41, 0.37, 0.42, 0.45, 0.33, 0.47, 0.25, 0.29, 0.28, 0.26, 0.25, 0.29, 0.29, 0.4, 0.26, 0.35, 0.28], buff: 0.95, pts: 1 },
  reaver: { power: [0.4, 0.45, 0.7, 0.47, 0.5, 0.45, 0.33, 0.56, 0.29, 0.28, 0.26, 0.26, 0.43, 0.26, 0.32, 0.26, 0.26, 0.35, 0.17, 0.52, 0.49, 0.39, 0.48, 0.43, 0.45, 0.36, 0.31, 0.3, 0.36, 0.42, 0.33, 0.28, 0.38, 0.32, 0.42, 0.42, 0.39, 0.38, 0.42, 0.39, 0.41, 0.41, 0.21, 0.32, 0.38, 0.41, 0.35, 0.21, 0.38, 0.36, 0.37, 0.38, 0.29, 0.32, 0.35, 0.3, 0.26, 0.25, 0.19, 0.35], mend: [0.53, 0.59, 0.92, 0.62, 0.66, 0.59, 0.44, 0.74, 0.38, 0.37, 0.35, 0.35, 0.58, 0.34, 0.43, 0.35, 0.34, 0.46, 0.22, 0.68, 0.65, 0.51, 0.63, 0.56, 0.59, 0.47, 0.41, 0.4, 0.48, 0.55, 0.44, 0.37, 0.5, 0.42, 0.56, 0.55, 0.51, 0.5, 0.56, 0.53, 0.54, 0.54, 0.28, 0.41, 0.49, 0.54, 0.46, 0.28, 0.49, 0.47, 0.49, 0.5, 0.38, 0.42, 0.47, 0.39, 0.34, 0.34, 0.24, 0.45], buff: 0.87, pts: 1 },
  navigator: { power: [1.42, 0.73, 0.96, 0.7, 1.22, 0.61, 0.57, 0.77, 0.53, 0.46, 0.63, 0.43, 0.83, 0.73, 0.85, 0.49, 0.66, 0.66, 0.34, 0.18, 0.2, 0.16, 0.24, 0.15, 0.2, 0.17, 0.21, 0.22, 0.23, 0.25, 0.19, 0.19, 0.21, 0.18, 0.22, 0.25, 0.25, 0.23, 0.24, 0.25, 0.22, 0.24, 0.25, 0.26, 0.24, 0.31, 0.3, 0.25, 0.29, 0.26, 0.18, 0.19, 0.19, 0.24, 0.17, 0.17, 0.17, 0.17, 0.17, 0.16], mend: [1.89, 0.96, 1.26, 0.93, 1.61, 0.81, 0.75, 1.02, 0.7, 0.61, 0.83, 0.56, 1.1, 0.98, 1.14, 0.65, 0.87, 0.87, 0.46, 0.24, 0.26, 0.21, 0.32, 0.2, 0.26, 0.22, 0.27, 0.29, 0.29, 0.33, 0.25, 0.25, 0.27, 0.23, 0.29, 0.32, 0.33, 0.29, 0.32, 0.35, 0.29, 0.32, 0.34, 0.35, 0.32, 0.42, 0.4, 0.33, 0.39, 0.35, 0.24, 0.25, 0.25, 0.33, 0.23, 0.23, 0.23, 0.23, 0.23, 0.21], buff: 0.87, pts: 1 },
  drowned: { power: [0.64, 0.69, 0.59, 0.64, 0.79, 0.67, 0.77, 0.83, 0.75, 0.72, 0.59, 0.59, 0.76, 0.76, 0.76, 0.7, 0.67, 0.65, 0.4, 0.12, 0.38, 0.36, 0.32, 0.34, 0.32, 0.32, 0.32, 0.28, 0.31, 0.31, 0.31, 0.31, 0.25, 0.31, 0.23, 0.23, 0.25, 0.23, 0.24, 0.21, 0.22, 0.23, 0.21, 0.25, 0.21, 0.25, 0.25, 0.2, 0.22, 0.23, 0.26, 0.24, 0.2, 0.22, 0.23, 0.26, 0.22, 0.2, 0.24, 0.27], mend: [0.85, 0.92, 0.79, 0.86, 1.05, 0.89, 1.01, 1.1, 1, 0.95, 0.79, 0.79, 0.99, 0.99, 0.99, 0.94, 0.88, 0.86, 0.52, 0.16, 0.49, 0.47, 0.42, 0.45, 0.41, 0.41, 0.41, 0.35, 0.41, 0.41, 0.41, 0.41, 0.34, 0.41, 0.32, 0.32, 0.33, 0.32, 0.32, 0.28, 0.3, 0.3, 0.3, 0.34, 0.29, 0.34, 0.35, 0.26, 0.3, 0.31, 0.34, 0.3, 0.26, 0.28, 0.29, 0.33, 0.27, 0.26, 0.31, 0.34], buff: 1, pts: 1 },
  admiral: { power: [1.24, 1.41, 1.29, 1.16, 1.14, 1.11, 1.19, 1.15, 1.06, 1.06, 1, 0.9, 0.85, 0.68, 0.9, 0.74, 0.69, 0.76, 0.43, 0.36, 0.2, 0.23, 0.19, 0.19, 0.2, 0.19, 0.23, 0.18, 0.17, 0.2, 0.17, 0.18, 0.19, 0.19, 0.2, 0.21, 0.22, 0.21, 0.21, 0.2, 0.21, 0.21, 0.21, 0.24, 0.23, 0.24, 0.25, 0.21, 0.2, 0.24, 0.22, 0.24, 0.2, 0.2, 0.22, 0.21, 0.2, 0.19, 0.19, 0.18], mend: [1.64, 1.87, 1.72, 1.52, 1.51, 1.47, 1.57, 1.53, 1.4, 1.4, 1.32, 1.2, 1.14, 0.91, 1.21, 0.99, 0.92, 1.01, 0.58, 0.48, 0.26, 0.3, 0.25, 0.26, 0.26, 0.25, 0.31, 0.23, 0.23, 0.27, 0.23, 0.23, 0.26, 0.26, 0.27, 0.28, 0.3, 0.28, 0.28, 0.28, 0.28, 0.27, 0.28, 0.31, 0.31, 0.32, 0.32, 0.27, 0.27, 0.32, 0.29, 0.31, 0.26, 0.27, 0.29, 0.28, 0.26, 0.25, 0.25, 0.24], buff: 0.87, pts: 1 },
};
/** The innate move and the ultimate. */
export const MOVE_KNOBS: Record<CaptainId, PathKnobs> = {
  corsair: { power: [1.88, 2.16, 1.41, 1.53, 1.51, 0.78, 1.36, 1.32, 1.16, 1.15, 0.44, 0.52, 0.42, 0.33, 0.34, 0.33, 0.31, 0.39, 0.22, 0.32, 0.2, 0.2, 0.34, 0.2, 0.46, 0.22, 0.21, 0.48, 0.47, 0.18, 0.22, 0.23, 0.26, 0.23, 0.24, 0.24, 0.27, 0.26, 0.25, 0.27, 0.28, 0.27, 0.23, 0.34, 0.34, 0.2, 0.27, 0.24, 0.23, 0.28, 0.27, 0.21, 0.24, 0.23, 0.21, 0.2, 0.2, 0.22, 0.24, 0.23], mend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], buff: 1, pts: 1 },
  smuggler: { power: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], mend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], buff: 0.87, pts: 1 },
  reaver: { power: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], mend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], buff: 1, pts: 1 },
  navigator: { power: [0.96, 1.09, 1.05, 1.15, 1.03, 1.11, 1.01, 1.08, 1.04, 1.02, 1.07, 1.05, 1.09, 1.12, 0.85, 0.96, 1.01, 1.01, 0.84, 0.72, 0.66, 0.62, 0.59, 0.57, 0.67, 0.7, 0.77, 0.62, 0.69, 0.6, 0.87, 0.85, 0.86, 0.87, 0.95, 0.94, 0.97, 1.02, 0.91, 0.99, 1.01, 0.95, 1.05, 1.09, 1.17, 0.78, 0.95, 0.96, 0.92, 1.09, 0.76, 0.75, 0.68, 1.05, 0.81, 0.78, 0.86, 0.73, 0.95, 1.12], mend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], buff: 0.87, pts: 1 },
  drowned: { power: [0.77, 0.71, 0.71, 0.71, 0.65, 0.65, 0.59, 0.52, 0.48, 0.47, 0.45, 0.45, 0.42, 0.42, 0.42, 0.41, 0.4, 0.4, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.24, 0.25, 0.26, 0.26, 0.25, 0.34, 0.26, 0.27, 0.28, 0.28, 0.29, 0.29, 0.3, 0.3, 0.31, 0.31, 0.3, 0.3, 0.29, 0.3, 0.38, 0.29, 0.28, 0.27, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.11], mend: [0.71, 1, 0.99, 1.25, 0.79, 1.45, 1.4, 1.34, 0.94, 1.34, 0.9, 0.81, 1.58, 1.6, 1.6, 1.48, 1.4, 1.42, 0.73, 0.25, 0.7, 0.73, 0.73, 0.68, 0.65, 0.65, 0.66, 0.68, 0.64, 0.68, 0.62, 0.64, 0.7, 0.7, 0.58, 0.56, 0.58, 0.75, 0.61, 0.58, 0.55, 0.56, 0.66, 0.51, 0.73, 0.41, 0.51, 0.73, 0.59, 0.55, 0.66, 0.55, 0.75, 0.61, 0.58, 0.7, 0.56, 0.78, 0.6, 0.4], buff: 0.87, pts: 1 },
  admiral: { power: [5.01, 3.74, 4.51, 2.99, 2.69, 3.91, 4.18, 4.18, 3.85, 3.85, 3.64, 3.07, 1.68, 2.05, 2.29, 1.36, 1.18, 1.38, 0.84, 0.92, 0.52, 0.35, 0.51, 0.42, 0.56, 0.42, 0.41, 0.46, 0.35, 0.49, 0.36, 0.4, 0.42, 0.3, 0.34, 0.39, 0.36, 0.45, 0.4, 0.4, 0.32, 0.35, 0.36, 0.39, 0.34, 0.29, 0.31, 0.4, 0.29, 0.4, 0.43, 0.36, 0.35, 0.38, 0.38, 0.38, 0.41, 0.39, 0.37, 0.86], mend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], buff: 0.66, pts: 1 },
};
// (docs/25 item 70's ORDER_KNOBS — her own order at ×0.35 to ×3 of what her book says, by her level, in a ship's
// boarding alone — is gone, owner 2026-10-10: «чини атаку всем». Her own order is what her book says at every level.)
export const pathKnobs = (path: CaptainId, kind: 'page' | 'move' = 'page'): PathKnobs => (kind === 'move' ? MOVE_KNOBS : PATH_KNOBS)[path];
/** A figure at each of POWER_AT's levels, at a hero level (the line between them; beyond, the last). */
function atLevel(k: readonly number[], level: number): number {
  const at = POWER_AT;
  if (level <= at[0]) return k[0];
  for (let i = 1; i < at.length; i++) if (level <= at[i]) return k[i - 1] + ((k[i] - k[i - 1]) * (level - at[i - 1])) / (at[i] - at[i - 1]);
  return k[k.length - 1];
}
/** The `power` knob at a hero level (`mend`: the `mend` knob). */
export function pathPower(path: CaptainId, level: number, kind: 'page' | 'move' = 'page', knob: 'power' | 'mend' = 'power'): number {
  return atLevel(pathKnobs(path, kind)?.[knob] ?? [1], level);
}

/** Rounds an order's effect holds past its own by the giver's Power (HoMM3's duration by power: 10+ one, 20+ two). */
export function powHold(pow: number): number {
  return pow >= 20 ? 2 : pow >= 10 ? 1 : 0;
}
/** docs/25 item 60: a path's move holds as written and her Power a round more at most — two or three rounds at any
 *  level for a page written for two (it was one round from the levels the old single figure fell under 0.6). */
export const PATH_HOLD_MAX = 1;
/** The rounds past the one it is given in that a path's move holds (0: this round only). */
export function pathHoldExtra(fx: PageFx, pow: number): number {
  const r = fx.rounds ?? 0;
  return r + (r > 0 && !fx.one?.still && !fx.one?.mad ? Math.min(PATH_HOLD_MAX, powHold(pow)) : 0);
}

/** docs/25 item 57: the fallen a move stands up again (a share of each stack) and the men the deep drags under (a
 *  share of each of hers), at most — the Drowned's own grow from level 20 to 50% and 18% at 60. */
export const RAISE_CAP = 0.35;
export const DRAIN_CAP = 0.12;
export const DROWNED_CAPS = { from: 20, to: 60, raise: 0.5, drain: 0.18 };
function drownedRamp(path: CaptainId | null | undefined, level: number): number {
  if (path !== 'drowned') return 0;
  return Math.max(0, Math.min(1, (level - DROWNED_CAPS.from) / (DROWNED_CAPS.to - DROWNED_CAPS.from)));
}
export function raiseCap(path: CaptainId | null | undefined, level: number): number {
  return RAISE_CAP + (DROWNED_CAPS.raise - RAISE_CAP) * drownedRamp(path, level);
}
export function drainCap(path: CaptainId | null | undefined, level: number): number {
  return DRAIN_CAP + (DROWNED_CAPS.drain - DRAIN_CAP) * drownedRamp(path, level);
}

const SHARE_KEYS = ['melee', 'shot', 'taken', 'shotTaken'] as const;
const POINT_KEYS = ['speed', 'init', 'morale', 'luck'] as const;
const FX_KEYS = ['dmg', 'ring', 'all', 'shooters', 'drain', 'row', 'sicken'] as const;
const MEND_KEYS = ['heal', 'raise', 'mend'] as const;
const scaled = new Map<PageFx, Map<string, PageFx>>();
/** A move's fx with its path's knobs at the caster's hero level on it (item 53): blows and drags by `power`, heals
 *  and raises by `mend`, the shares by `buff`, the points by `pts` (never under one), the rounds as written. */
export function powered(fx: PageFx, path: CaptainId, level: number, kind: 'page' | 'move' = 'page'): PageFx {
  const kn = pathKnobs(path, kind);
  const k = Math.round(pathPower(path, level, kind) * 1000) / 1000;
  const km = Math.round(pathPower(path, level, kind, 'mend') * 1000) / 1000;
  const key = `${k}:${km}:${kn.buff}:${kn.pts}`;
  let byK = scaled.get(fx);
  if (!byK) scaled.set(fx, (byK = new Map()));
  const c = byK.get(key);
  if (c) return c;
  const out: PageFx = { ...fx };
  for (const x of FX_KEYS) if (out[x] !== undefined) out[x] = out[x]! * k;
  for (const x of MEND_KEYS) if (out[x] !== undefined) out[x] = out[x]! * km;
  const pt = (v: number) => Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * kn.pts));
  for (const m of ['self', 'foe', 'one'] as const) {
    const src = fx[m];
    if (!src) continue;
    const mm: BtMods = { ...src };
    for (const x of SHARE_KEYS) if (mm[x] !== undefined) mm[x] = mm[x]! * kn.buff;
    for (const x of POINT_KEYS) if (mm[x]) mm[x] = pt(mm[x]!);
    out[m] = mm;
  }
  // The stacks that act again are her strongest share (a share, as the holds' are).
  if (out.allAgain) out.allShare = Math.min(1, (fx.allShare ?? 1) * kn.buff);
  if (out.free) out.free = pt(out.free);
  // docs/25 item 70: a move that gives one stack another turn (the Navigator's Following Squall) has no blow of its own
  // for `power` to scale — its `power` is the stack's blows and shots while it holds (×power: a third lighter at 0.67).
  // In a crew of four stacks at levels 1–10 the second turn alone won her three boardings in four against the Corsair.
  if (kind === 'move' && out.again && k !== 1) out.one = { ...out.one, melee: (out.one?.melee ?? 0) + k - 1, shot: (out.one?.shot ?? 0) + k - 1 };
  byK.set(key, out);
  return out;
}
/** Forget the powered fx (the tuner changes the knobs as it goes). */
export function clearPowered(): void {
  scaled.clear();
}

/** The hero level each page level opens at. */
export const PAGE_UNLOCK: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 1, 2: 8, 3: 15, 4: 25, 5: 35 };
/** The ultimate opens at this hero level, and is given from this round of a battle (docs/25 item 55: the second, once
 *  the decks have closed; it was the third, and a captain gave it in a third of her battles) — from the first when the
 *  other side came aboard ULT_EARLY times her strength or more. */
export const ULT_LEVEL = 20;
export const ULT_ROUND = 2;
export const ULT_EARLY = 1.5;

const P = (id: PathPageId, path: CaptainId, school: School, level: PathPage['level'], cost: number, cd: number, icon: string, name: [string, string], text: [string, string], fx: PageFx): PathPage =>
  ({ id, path, school, level, cost, cd, icon, name, text, fx });

export const PATH_PAGES: Record<PathPageId, PathPage> = Object.fromEntries([
  // The corsair: fire and powder at home; a gunner's eye and an officer's discipline.
  P('cs_chain_shot', 'corsair', 'fire', 1, 4, 3, 'ab_double_shot', ['Chain shot', 'Книппель'], ['Two balls on a chain into one stack of hers: a hard blow, and she is slower.', 'Два ядра на цепи в один её отряд: тяжёлый удар, и он медленнее.'],
    { target: 'enemy', dmg: 1.3, one: { speed: -1 }, rounds: 1 }),
  P('cs_spotter', 'corsair', 'wind', 1, 4, 3, 'ab_spotters_eye', ["Spotter's call", 'Корректировщик'], ['A spotter in the tops: your shots harder and your luck up.', 'Корректировщик на марсе: ваши выстрелы сильнее, удача выше.'],
    { target: 'none', self: { shot: 0.25, luck: 2 }, rounds: 1 }),
  P('cs_pistol_line', 'corsair', 'steel', 2, 6, 3, 'bt_volley', ['Pistol line', 'Пистолетная шеренга'], ['A line of pistols: every blow and shot of yours harder.', 'Шеренга пистолетов: каждый ваш удар и выстрел сильнее.'],
    { target: 'none', self: { melee: 0.2, shot: 0.2 }, rounds: 1 }),
  P('cs_gunsmoke', 'corsair', 'fog', 3, 8, 4, 'ab_smoke_pots', ['Gunsmoke', 'Пороховой дым'], ['A bank of powder smoke over her deck: her shots fly wide.', 'Пелена порохового дыма над её палубой: её выстрелы уходят мимо.'],
    { target: 'none', foe: { shot: -0.35, melee: -0.15 }, rounds: 1 }),
  P('cs_grape', 'corsair', 'fire', 4, 12, 4, 'ab_grapeshot_frenzy', ['Grape at the rail', 'Картечь в упор'], ['A swivel gun of grape into her: a terrible blow on one stack, and a heavy one on those beside it.', 'Фальконет с картечью в упор: страшный удар по одному отряду и тяжёлый — по соседним.'],
    { target: 'enemy', dmg: 1.7, ring: 0.8 }),
  P('cs_iron_tide', 'corsair', 'water', 5, 15, 5, 'ab_brine_mend', ['Iron tide', 'Железный прилив'], ['The brine and the drill: every stack of yours heals and takes less.', 'Солёная вода и выучка: каждый ваш отряд лечится и получает меньше урона.'],
    { target: 'none', heal: 0.1, self: { taken: -0.2 }, rounds: 1 }),
  // The smuggler: fog and shadow at home; knives in the dark.
  P('sm_knives', 'smuggler', 'board', 1, 4, 3, 'item_quill_cutlass', ['Knives in the dark', 'Ножи в темноте'], ['Thrown knives into one stack of hers; it cannot answer a blow this round.', 'Метательные ножи в один её отряд; в этом раунде он не может ответить на удар.'],
    { target: 'enemy', dmg: 1.3, one: { noAnswer: true }, rounds: 0 }),
  P('sm_fog_veil', 'smuggler', 'fog', 1, 4, 3, 'ab_vanish_into_fog', ['Fog veil', 'Туманная вуаль'], ['A veil of fog: your stacks take less from her shots, and a little less from her blows.', 'Туманная вуаль: ваши отряды получают меньше от её выстрелов и немного меньше от её ударов.'],
    { target: 'none', self: { shotTaken: -0.33, taken: -0.1 }, rounds: 1 }),
  P('sm_caltrops', 'smuggler', 'steel', 2, 6, 3, 'item_iron_belt', ['Caltrops', 'Чеснок'], ['Iron caltrops on her deck: her men slower and their blows lighter.', 'Железный чеснок на её палубе: её люди медленнее, удары слабее.'],
    { target: 'none', foe: { speed: -1, melee: -0.15 }, rounds: 1 }),
  P('sm_false_colours', 'smuggler', 'fog', 3, 8, 4, 'item_black_flag', ['False colours', 'Чужой флаг'], ['A false flag and a false word: her morale and her luck fall.', 'Чужой флаг и ложное слово: её дух и удача падают.'],
    { target: 'none', foe: { morale: -2, luck: -1 }, rounds: 1, dread: 5 }),
  P('sm_powder_trail', 'smuggler', 'fire', 4, 12, 4, 'ab_admiralty_barrage', ['Powder trail', 'Пороховая дорожка'], ['A trail of powder under her feet, lit: a terrible blow on one stack and a lesser on those beside it.', 'Подожжённая дорожка пороха у неё под ногами: страшный удар по отряду и слабее — по соседним.'],
    { target: 'enemy', dmg: 1.6, ring: 0.6 }),
  P('sm_blind_fog', 'smuggler', 'fog', 5, 15, 5, 'ab_dark_running', ['Blinding fog', 'Слепой туман'], ['Her shooters can hardly see to aim — their shots half as hard — and her blows are lighter.', 'Её стрелки почти ничего не видят — их выстрелы вдвое слабее, — а её удары слабее.'],
    { target: 'none', foe: { shot: -0.5, melee: -0.1 }, rounds: 1 }),
  // The Reaver: the hook and the boarding at home; blood and nerve.
  P('rv_hook', 'reaver', 'board', 1, 4, 3, 'item_boarding_axe', ['The hook', 'Крюк'], ['The hook in one stack of hers: a hard blow, and it cannot answer this round.', 'Крюк в её отряд: тяжёлый удар, и в этом раунде он не может ответить.'],
    { target: 'enemy', dmg: 1.4, one: { noAnswer: true }, rounds: 0 }),
  P('rv_blood_scent', 'reaver', 'water', 1, 4, 3, 'ab_war_cry', ['Blood in the water', 'Кровь в воде'], ['Blood in the water: your blows harder and your morale up.', 'Кровь в воде: ваши удары сильнее, дух выше.'],
    { target: 'none', self: { melee: 0.15, morale: 1 }, rounds: 1 }),
  P('rv_berserk', 'reaver', 'board', 2, 5, 3, 'tree_boarding', ['Berserk', 'Берсерк'], ['One stack of yours goes berserk: it strikes far harder and takes more.', 'Один ваш отряд впадает в раж: бьёт много сильнее, но и получает больше.'],
    { target: 'own', one: { melee: 0.8, taken: 0.2 }, rounds: 1 }),
  P('rv_howl', 'reaver', 'fog', 3, 8, 4, 'ab_deep_call', ['The howl', 'Вой'], ['A howl over the decks: her morale and her luck fall.', 'Вой над палубами: её дух и удача падают.'],
    { target: 'none', foe: { morale: -2, luck: -1 }, rounds: 1, dread: 8 }),
  P('rv_butcher', 'reaver', 'steel', 4, 12, 4, 'bt_charge', ['Butcher\'s cut', 'Мясницкий удар'], ['Cleavers into one stack of hers: the heaviest blow a hand can give.', 'Тесаки в один её отряд: самый тяжёлый удар, на какой способна рука.'],
    { target: 'enemy', dmg: 2.6 }),
  P('rv_red_mist', 'reaver', 'water', 5, 15, 5, 'ab_red_hook_boarding', ['Red mist', 'Красный туман'], ['Red mist: every stack of yours heals and strikes harder.', 'Красный туман: каждый ваш отряд лечится и бьёт сильнее.'],
    { target: 'none', heal: 0.08, self: { melee: 0.3 }, rounds: 1 }),
  // The navigator: the wind at home; speed and the lie of the deck.
  P('nv_marlinspike', 'navigator', 'steel', 1, 4, 3, 'prof_helmsman', ['Marlinspike', 'Свайка'], ['A spike where it hurts: a blow on one stack of hers.', 'Свайка туда, где больно: удар по одному её отряду.'],
    { target: 'enemy', dmg: 1.45 }),
  P('nv_tailwind', 'navigator', 'wind', 1, 4, 3, 'ab_trim_sails', ['Tailwind', 'Ветер в корму'], ['The wind at your back: your men faster and quicker to act.', 'Ветер в корму: ваши люди быстрее и раньше в очереди.'],
    { target: 'none', self: { speed: 1, init: 2 }, rounds: 1 }),
  P('nv_flank_drill', 'navigator', 'board', 2, 6, 3, 'bt_officers', ['Flank drill', 'Удар во фланг'], ['The flank drill: every blow of yours harder.', 'Удар во фланг: каждый ваш удар сильнее.'],
    { target: 'none', self: { melee: 0.2 }, rounds: 1 }),
  P('nv_squall', 'navigator', 'wind', 3, 9, 4, 'ab_storm_chaser', ['Squall', 'Шквал'], ['A squall across her deck: every stack of hers is hurt, and she is later to act.', 'Шквал по её палубе: ранен каждый её отряд, и она позже в очереди.'],
    { target: 'none', all: 0.3, foe: { init: -1 }, rounds: 1 }),
  P('nv_harpoon_line', 'navigator', 'fire', 4, 12, 4, 'role_harpooner', ['Harpoon line', 'Гарпун на линь'], ['A harpoon gun into one stack of hers: a terrible blow, and it is much slower.', 'Гарпунная пушка по её отряду: страшный удар, и он намного медленнее.'],
    { target: 'enemy', dmg: 2.0, one: { speed: -2 }, rounds: 1 }),
  P('nv_eye_of_storm', 'navigator', 'wind', 5, 15, 5, 'ab_current_rider', ['The quiet in the storm', 'Тишина в буре'], ['The quiet in the storm: your men faster, quicker to act and luckier.', 'Тишина в буре: ваши люди быстрее, раньше в очереди и удачливее.'],
    { target: 'none', self: { speed: 1, init: 1, luck: 2 }, rounds: 1 }),
  // The Drowned: water and the deep at home; the grip of the drowned.
  P('dr_drowning_grip', 'drowned', 'board', 1, 4, 3, 'ab_undertow', ['Drowning grip', 'Хватка утопленника'], ['Cold hands on one stack of hers: a blow, and it is much slower.', 'Холодные руки на её отряде: удар, и он намного медленнее.'],
    { target: 'enemy', dmg: 1.6, one: { speed: -2 }, rounds: 1 }),
  P('dr_brine_kiss', 'drowned', 'water', 1, 4, 3, 'ab_brine_mend', ['Brine kiss', 'Поцелуй соли'], ['A share of every stack of yours stands again — the drowned too.', 'Часть каждого вашего отряда снова на ногах — и утопленники тоже.'],
    { target: 'none', raise: 0.1 }),
  P('dr_anchor_chain', 'drowned', 'steel', 2, 6, 3, 'item_iron_rigging', ['Anchor chain', 'Якорная цепь'], ['An anchor chain swung through one stack of hers: a heavy blow.', 'Якорная цепь проходит сквозь её отряд: тяжёлый удар.'],
    { target: 'enemy', dmg: 1.6 }),
  P('dr_undertow', 'drowned', 'water', 3, 9, 4, 'ab_maw_of_the_deep', ['Undertow', 'Отбойное течение'], ['The undertow drags a share of every stack of hers under; she is later to act.', 'Течение утаскивает часть каждого её отряда; она позже в очереди.'],
    { target: 'none', drain: 0.09, foe: { init: -2 }, rounds: 1 }),
  P('dr_barnacles', 'drowned', 'steel', 4, 12, 4, 'mod_serpent_scale', ['Barnacle hide', 'Шкура из ракушек'], ['A hide of barnacles: every stack of yours takes less.', 'Шкура из ракушек: каждый ваш отряд получает меньше.'],
    { target: 'none', self: { taken: -0.25 }, rounds: 1 }),
  P('dr_abyss', 'drowned', 'water', 5, 15, 5, 'ab_deep_call', ['The abyss looks back', 'Бездна смотрит'], ['The abyss looks back: every stack of hers is hurt, and her morale falls.', 'Бездна смотрит: ранен каждый её отряд, её дух падает.'],
    { target: 'none', all: 0.3, foe: { morale: -1 }, rounds: 1 }),
  // The Black Admiral: steel and men at home; the line, the signal, the square.
  P('ad_volley_order', 'admiral', 'fire', 1, 4, 3, 'bt_volley', ['Volley by order', 'Залп по команде'], ['A volley on one stack of hers and on all her shooters, and your shots harder after it.', 'Залп по её отряду и по всем её стрелкам, и ваши выстрелы потом сильнее.'],
    { target: 'enemy', dmg: 1.4, shooters: 0.4, self: { shot: 0.25 }, rounds: 1 }),
  P('ad_signal_flags', 'admiral', 'wind', 1, 4, 3, 'ab_form_line', ['Signal flags', 'Сигнальные флаги'], ['Signal flags: your men quicker to act and your morale up.', 'Сигнальные флаги: ваши люди раньше в очереди, дух выше.'],
    { target: 'none', self: { init: 1, morale: 2 }, rounds: 1 }),
  P('ad_square', 'admiral', 'steel', 2, 6, 3, 'mod_hull_plating', ['Form square', 'В каре'], ['Form square: every stack of yours takes less.', 'В каре: каждый ваш отряд получает меньше.'],
    { target: 'none', self: { taken: -0.2 }, rounds: 1 }),
  P('ad_fog_of_war', 'admiral', 'fog', 3, 8, 4, 'ab_smoke_pots', ['Fog of war', 'Туман войны'], ['The fog of war: her shots fly wide and she is later to act.', 'Туман войны: её выстрелы мимо, и она позже в очереди.'],
    { target: 'none', foe: { shot: -0.35, init: -1 }, rounds: 1 }),
  P('ad_bayonets', 'admiral', 'steel', 4, 12, 4, 'item_cutlass', ['Bayonet charge', 'Штыковая'], ['A bayonet charge into one stack of hers: a heavy blow, and your blows harder after it.', 'Штыковая на её отряд: тяжёлый удар, и ваши удары потом сильнее.'],
    { target: 'enemy', dmg: 1.6, self: { melee: 0.2 }, rounds: 1 }),
  P('ad_admiralty', 'admiral', 'water', 5, 15, 5, 'item_admiral_hat', ['The Admiralty\'s surgeons', 'Лекари адмиралтейства'], ["The Admiralty's surgeons: a share of every stack of yours stands again.", 'Лекари адмиралтейства: часть каждого вашего отряда снова на ногах.'],
    { target: 'none', heal: 0.11 }),
].map((p) => [p.id, p])) as Record<PathPageId, PathPage>;

export const PATH_PAGE_IDS = Object.keys(PATH_PAGES) as PathPageId[];
export const isPathPage = (id: string): id is PathPageId => id in PATH_PAGES;

/** Her path's book. */
export function pathBook(path: CaptainId): PathPageId[] {
  return PATH_PAGE_IDS.filter((id) => PATH_PAGES[id].path === path).sort((a, b) => PATH_PAGES[a].level - PATH_PAGES[b].level);
}
/** The pages of her path's book open at her hero level. */
export function pathPagesAt(path: CaptainId, level: number): PathPageId[] {
  return pathBook(path).filter((id) => level >= PAGE_UNLOCK[PATH_PAGES[id].level]);
}

// ------------------------------------------------------------------ the common pages after docs/18

/** Twenty more common pages of the order book (owner, 2026-10-03: «около 20 новых заклинаний»), over all six schools
 *  and levels 1–5: taught as docs/17's are (the ports' guilds, the drowned shrines, the floors of her island's guild),
 *  given in the battle as the path pages are — what each `fx` says, at the strength of her school, with no path's
 *  power on it (they are no path's). The physical schools' spend Stamina, the magical ones' Will. Weighed against
 *  docs/17's of their level (tools/balance-orders.ts). */
export type BookPageId =
  | 'stinkpot' | 'heated_shot' | 'raking_fire'
  | 'hammock_nettings' | 'nail_colours'
  | 'belaying_pin' | 'double_grog' | 'swing_aboard' | 'no_quarter'
  | 'st_elmos_fire' | 'clearing_wind' | 'rain_squall' | 'forked_lightning'
  | 'foul_water' | 'kelp_poultice' | 'siren_song'
  | 'jonah' | 'muffled_oars' | 'silent_fog' | 'fog_madness';
export type BookPage = Omit<PathPage, 'id' | 'path'> & { id: BookPageId };

const B = (id: BookPageId, school: School, level: BookPage['level'], cost: number, cd: number, icon: string, name: [string, string], text: [string, string], fx: PageFx): BookPage =>
  ({ id, school, level, cost, cd, icon, name, text, fx });

export const BOOK_PAGES: Record<BookPageId, BookPage> = Object.fromEntries([
  // Fire and powder: sulphur, a red-hot ball, a line of muskets down her deck.
  B('stinkpot', 'fire', 2, 5, 3, 'sp_stinkpot', ['Stinkpot', 'Зловонный горшок'], ['A clay pot of burning sulphur into one stack of hers: a blow on it and on those beside it, and two rounds it strikes and shoots a third lighter.', 'Глиняный горшок с горящей серой в её отряд: удар по нему и по соседним, и два раунда он бьёт и стреляет на треть слабее.'],
    { target: 'enemy', dmg: 0.6, ring: 0.3, one: { melee: -0.33, shot: -0.33 }, rounds: 1 }),
  B('heated_shot', 'fire', 3, 8, 4, 'sp_heated_shot', ['Heated shot', 'Калёное ядро'], ['A red-hot ball into one stack of hers: a heavy blow, and the deck under it catches fire.', 'Раскалённое ядро в её отряд: тяжёлый удар, и палуба под ним загорается.'],
    { target: 'enemy', dmg: 1.1, fire: true }),
  B('raking_fire', 'fire', 4, 12, 4, 'sp_raking_fire', ['Raking fire', 'Продольный огонь'], ['Fire raked along her deck: a heavy blow on every stack of hers in the row of the one pointed at.', 'Огонь вдоль её палубы: тяжёлый удар по каждому её отряду в ряду того, на который вы указали.'],
    { target: 'enemy', row: 1.1 }),
  // Steel and men: the drill of a man-of-war.
  B('hammock_nettings', 'steel', 1, 3, 3, 'sp_hammock_nettings', ['Hammock nettings', 'Коечные сетки'], ['Hammocks packed in the nettings before one stack of yours: two rounds it takes half from her shots.', 'Койки, уложенные в сетки перед вашим отрядом: два раунда он получает вдвое меньше от её выстрелов.'],
    { target: 'own', one: { shotTaken: -0.5 }, rounds: 1 }),
  B('nail_colours', 'steel', 5, 15, 5, 'sp_nail_colours', ['Colours nailed to the mast', 'Флаг прибит к мачте'], ['The colours nailed to the mast: two rounds none of your men freezes in fear, your morale +2, your blows a quarter harder and the harm you take a quarter less.', 'Флаг прибит к мачте: два раунда никто из ваших людей не цепенеет от страха, ваш дух +2, удары на четверть сильнее, а урона на четверть меньше.'],
    { target: 'none', self: { steady: true, morale: 2, melee: 0.25, taken: -0.25 }, rounds: 1, heart: 10 }),
  // The hook and the boarding: a pin, a tot, the ropes, the black flag.
  B('belaying_pin', 'board', 1, 4, 3, 'sp_belaying_pin', ['Belaying pin', 'Кофель-нагель'], ['A belaying pin about the heads of one stack of hers: a blow, and two rounds it is slower and later to act.', 'Кофель-нагель по головам её отряда: удар, и два раунда он медленнее и позже в очереди.'],
    { target: 'enemy', dmg: 0.8, one: { speed: -1, init: -2 }, rounds: 1 }),
  B('double_grog', 'board', 2, 5, 4, 'sp_double_grog', ['Double grog', 'Двойной грог'], ['A double tot of grog all round: two rounds your morale +1 and your blows harder, but your men a little later to act.', 'Двойная порция грога на всех: два раунда ваш дух +1 и удары сильнее, но люди чуть позже в очереди.'],
    { target: 'none', self: { morale: 1, melee: 0.15, init: -1 }, rounds: 1 }),
  B('swing_aboard', 'board', 3, 8, 4, 'sp_swing_aboard', ['Swing aboard', 'По канатам!'], ['One stack of yours swings across on the ropes: this round it goes two hexes further, acts once more, and its blows land half again as hard and draw no answer.', 'Один ваш отряд перелетает по канатам: в этом раунде он идёт на два гекса дальше, ходит ещё раз, бьёт в полтора раза сильнее и без ответа.'],
    { target: 'own', again: true, one: { speed: 2, noRet: true, melee: 0.5 }, rounds: 0 }),
  B('no_quarter', 'board', 5, 15, 5, 'sp_no_quarter', ['No quarter', 'Пощады не будет'], ['The black flag run up: the next four blows of your men draw no answer; two rounds your blows harder and her morale −1.', 'Поднят чёрный флаг: четыре следующих удара ваших людей остаются без ответа; два раунда ваши удары сильнее, а её дух −1.'],
    { target: 'none', free: 4, self: { melee: 0.2 }, foe: { morale: -1 }, rounds: 1, dread: 8 }),
  // Wind: an omen on the yards, a clearing wind, the rain, the lightning.
  B('st_elmos_fire', 'wind', 1, 4, 3, 'sp_st_elmos_fire', ["St Elmo's fire", 'Огни святого Эльма'], ['Blue fire on the yards, a good omen: two rounds your luck +2.', 'Голубой огонь на реях — добрый знак: два раунда ваша удача +2.'],
    { target: 'none', self: { luck: 2 }, rounds: 1, heart: 4 }),
  B('clearing_wind', 'wind', 2, 5, 3, 'sp_clearing_wind', ['Clearing wind', 'Свежий ветер'], ['A clearing wind blows her smoke and her spells away: whatever she laid on your men and on hers ends now.', 'Свежий ветер уносит её дым и чары: всё, что она наложила на ваших людей и на своих, кончается.'],
    { target: 'none', clear: true }),
  B('rain_squall', 'wind', 3, 8, 4, 'sp_rain_squall', ['Rain squall', 'Ливень'], ['A squall of rain over the decks: her powder soaked, her shooters cannot fire this round, and every fire aboard goes out.', 'Шквал с ливнем над палубами: её порох отсырел — её стрелки не стреляют в этом раунде, — и гаснет всякий огонь на борту.'],
    { target: 'none', foe: { blind: true }, rounds: 0, douse: true }),
  B('forked_lightning', 'wind', 4, 12, 4, 'sp_forked_lightning', ['Forked lightning', 'Ветвистая молния'], ['Lightning out of the storm strikes one stack of hers and forks on to the nearest, and the next, and the next, each time weaker.', 'Молния из грозы бьёт в её отряд и перескакивает на ближайший, и дальше, и ещё дальше, всякий раз слабее.'],
    { target: 'enemy', dmg: 1.0, chain: 3 }),
  // Water and the deep: foul casks, kelp on the wounds, a song out of the deep.
  B('foul_water', 'water', 1, 4, 3, 'sp_foul_water', ['Foul water', 'Тухлая вода'], ['Her water casks fouled: one stack of hers sickens and loses men as each of its next three turns comes.', 'Её бочки с водой испорчены: её отряд болеет и теряет людей в начале каждого из трёх следующих ходов.'],
    { target: 'enemy', sicken: 0.4 }),
  B('kelp_poultice', 'water', 2, 5, 3, 'sp_kelp_poultice', ['Kelp poultice', 'Припарка из водорослей'], ['Kelp and brine bound on the wounds of one stack of yours: it heals a fifth of its strength.', 'Водоросли и рассол на раны вашего отряда: он лечится на пятую часть.'],
    { target: 'own', mend: 0.2 }),
  B('siren_song', 'water', 4, 12, 5, 'sp_siren_song', ['Siren song', 'Песнь сирены'], ['A song out of the deep: one stack of hers stands spellbound and loses its turns this round and the next two — until a blow or a shot wakes it, and the blow that wakes it goes unanswered.', 'Песнь из глубины: её отряд замирает зачарованный и пропускает ходы в этом раунде и двух следующих — пока его не разбудит удар или выстрел, и на разбудивший удар он не отвечает.'],
    { target: 'enemy', one: { still: true }, rounds: 2 }),
  // Fog and shadow: a whisper, muffled oars, a fog that swallows words, shapes in the murk.
  B('jonah', 'fog', 1, 4, 3, 'sp_jonah', ['A Jonah aboard', 'Иона на борту'], ['Whispers in the fog that she carries a Jonah: two rounds her luck −2 and her morale −1.', 'Шёпот в тумане: у неё на борту Иона. Два раунда её удача −2, дух −1.'],
    { target: 'none', foe: { luck: -2, morale: -1 }, rounds: 1, dread: 4 }),
  B('muffled_oars', 'fog', 2, 6, 4, 'sp_muffled_oars', ['Muffled oars', 'Обмотанные вёсла'], ['Muffled oars in the murk: the next two blows of your men draw no answer.', 'Обмотанные вёсла во мгле: два следующих удара ваших людей остаются без ответа.'],
    { target: 'none', free: 2 }),
  B('silent_fog', 'fog', 3, 8, 5, 'sp_silent_fog', ['Silent fog', 'Немой туман'], ["A fog that swallows every word: her captain can give no order nor her path's move this round or the next.", 'Туман глотает каждое слово: её капитан не может отдать ни приказа, ни приёма пути — ни в этом раунде, ни в следующем.'],
    { target: 'none', hush: 2 }),
  B('fog_madness', 'fog', 5, 15, 5, 'sp_fog_madness', ['Fog madness', 'Морок'], ['Shapes in the fog: one stack of hers takes her own for foes — as its turns come this round and the next two, it falls on the nearest of her stacks it can reach, or stands lost.', 'Морок в тумане: её отряд принимает своих за врагов — в свои ходы в этом раунде и двух следующих он бросается на ближайший её отряд, до какого дотянется, или стоит растерянный.'],
    { target: 'enemy', one: { mad: true }, rounds: 2 }),
].map((p) => [p.id, p])) as Record<BookPageId, BookPage>;

export const BOOK_PAGE_IDS = Object.keys(BOOK_PAGES) as BookPageId[];
export const isBookPage = (id: string): id is BookPageId => id in BOOK_PAGES;

// ------------------------------------------------------------------ 1. innate moves, 5. ultimates

export interface PathMove {
  path: CaptainId;
  icon: string;
  name: [string, string];
  text: [string, string];
  fx: PageFx;
}

export const INNATE: Record<CaptainId, PathMove> = {
  corsair: { path: 'corsair', icon: 'ab_last_volley', name: ['Last Volley', 'Последний залп'], text: ['Once a battle, free: every gun and pistol aboard at one stack of hers — a great blow, no answer.', 'Раз за бой, даром: все пушки и пистолеты разом по одному её отряду — страшный удар, без ответа.'],
    fx: { target: 'enemy', dmg: 1.2 } },
  smuggler: { path: 'smuggler', icon: 'ab_smoke_pots', name: ['Smoke Screen', 'Дымовая завеса'], text: ['Once a battle, free: tar pots over her deck — her shooters are blind, and her blows lighter.', 'Раз за бой, даром: смоляные горшки на её палубу — её стрелки слепнут, а удары слабее.'],
    fx: { target: 'none', foe: { blind: true, melee: -0.1 }, rounds: 1 } },
  reaver: { path: 'reaver', icon: 'ab_red_hook_boarding', name: ['Blood Harvest', 'Кровавая жатва'], text: ['Once a battle, free: the first two blows of your men this round draw no answer, and land harder.', 'Раз за бой, даром: два первых удара ваших людей в этом раунде остаются без ответа и бьют сильнее.'],
    fx: { target: 'none', free: 2, self: { melee: 0.1 }, rounds: 0 } },
  navigator: { path: 'navigator', icon: 'ab_storm_chaser', name: ['Following Squall', 'Попутный шквал'], text: ['Once a battle, free: one stack of yours acts twice this round, and is faster.', 'Раз за бой, даром: один ваш отряд ходит в этом раунде дважды и становится быстрее.'],
    fx: { target: 'own', again: true, one: { speed: 1 }, rounds: 1 } },
  drowned: { path: 'drowned', icon: 'ab_deep_call', name: ['Call of the Depths', 'Зов глубин'], text: ['Once a battle, free: the fallen rise — a share of every stack of yours stands again, the dead men too.', 'Раз за бой, даром: встают павшие — часть каждого вашего отряда снова на ногах, и мёртвые тоже.'],
    fx: { target: 'none', raise: 0.12 } },
  admiral: { path: 'admiral', icon: 'ab_form_line', name: ['The Line', 'Строй'], text: ['Once a battle, free: the line is formed — morale up for every stack of yours.', 'Раз за бой, даром: строй сомкнут — дух выше у каждого вашего отряда.'],
    fx: { target: 'none', self: { morale: 2 }, rounds: 1, heart: 6 } },
};

export const ULTIMATE: Record<CaptainId, PathMove> = {
  corsair: { path: 'corsair', icon: 'ab_admiralty_barrage', name: ["Hell's Broadside", 'Адский бортовой'], text: ['From level 20, once a battle: every gun of the ship fires into her deck — every stack of hers takes a blow.', 'С 20-го уровня, раз за бой: все пушки корабля бьют по её палубе — удар по каждому её отряду.'],
    fx: { target: 'none', all: 0.15 } },
  smuggler: { path: 'smuggler', icon: 'ab_vanish_into_fog', name: ['Killing Fog', 'Туман-убийца'], text: ['From level 20, once a battle: she is blind, her blows lighter, and she takes more.', 'С 20-го уровня, раз за бой: она слепа, её удары слабее, а получает она больше.'],
    fx: { target: 'none', foe: { blind: true, melee: -0.2, taken: 0.1 }, rounds: 1 } },
  reaver: { path: 'reaver', icon: 'ab_grapeshot_frenzy', name: ['Red Tide', 'Красный прилив'], text: ['From level 20, once a battle: the next three blows of your men draw no answer, and your blows are harder.', 'С 20-го уровня, раз за бой: три следующих удара ваших людей остаются без ответа, а ваши удары сильнее.'],
    fx: { target: 'none', free: 3, self: { melee: 0.12 }, rounds: 1 } },
  navigator: { path: 'navigator', icon: 'ab_current_rider', name: ['Eye of the Storm', 'Глаз бури'], text: ['From level 20, once a battle: your strongest stacks act once more this round.', 'С 20-го уровня, раз за бой: ваши сильнейшие отряды ходят в этом раунде ещё раз.'],
    fx: { target: 'none', allAgain: true, allShare: 0.75 } },
  drowned: { path: 'drowned', icon: 'ab_maw_of_the_deep', name: ['Tide of the Dead', 'Прилив мертвецов'], text: ['From level 20, once a battle: a share of every stack of yours rises again, and the deep drags some of hers under.', 'С 20-го уровня, раз за бой: часть каждого вашего отряда встаёт снова, а глубина утаскивает часть её людей.'],
    fx: { target: 'none', raise: 0.18, drain: 0.03 } },
  admiral: { path: 'admiral', icon: 'item_admiral_hat', name: ['Line of Battle', 'Линия баталии'], text: ['From level 20, once a battle: a broadside along her deck, then morale up, blows harder, less taken.', 'С 20-го уровня, раз за бой: бортовой залп вдоль её палубы, затем дух выше, удары сильнее, урона меньше.'],
    fx: { target: 'none', all: 0.1, self: { morale: 2, melee: 0.12, taken: -0.1 }, rounds: 1, heart: 8 } },
};

/** docs/25 item 57: a facet an ultimate gains at a hero level — laid beside what it does. */
export interface MoveFacet {
  level: number;
  text: [string, string];
  fx: PageFx;
}
export const ULT_FACET: Partial<Record<CaptainId, MoveFacet>> = {
  // The Tide of the Dead from level 40: the risen feel neither fear nor pain.
  drowned: { level: 40, text: ['From level 40: the risen feel neither fear nor pain — your stacks take less and never freeze in fear.', 'С 40-го уровня: поднятые не знают ни страха, ни боли — ваши отряды получают меньше и не цепенеют от страха.'],
    fx: { target: 'none', self: { taken: -0.15, steady: true }, rounds: 1 } },
};
const faceted = new Map<PageFx, PageFx>();
/** A path's move as it stands at her hero level: its own fx and the facet it has gained. */
export function moveFx(path: CaptainId, kind: 'innate' | 'ult', level: number): PageFx {
  const mv = (kind === 'innate' ? INNATE : ULTIMATE)[path];
  const fc = kind === 'ult' ? ULT_FACET[path] : undefined;
  if (!fc || level < fc.level) return mv.fx;
  let c = faceted.get(mv.fx);
  if (!c) {
    const a = mv.fx, b = fc.fx;
    c = { ...a, ...b, target: a.target, rounds: Math.max(a.rounds ?? 0, b.rounds ?? 0) };
    for (const m of ['self', 'foe', 'one'] as const) if (a[m] || b[m]) c[m] = { ...a[m], ...b[m] };
    faceted.set(mv.fx, c);
  }
  return c;
}

// ------------------------------------------------------------------ 4. stamina

/** Three points of stamina for each point of her Attack and Defense (and a base of ten). */
export function stamMaxOf(atk: number, def: number): number {
  return 10 + 3 * (Math.max(0, Math.round(atk)) + Math.max(0, Math.round(def)));
}
/** A share of her stamina comes back every round of a battle. */
export const STAM_ROUND = 0.1;
/** At sea her stamina comes back whole in this many seconds of rest; in port at once. */
export const STAM_REST_SEC = 300;

// ------------------------------------------------------------------ 6. talents that lift the path book

/** Per rank: the path book's pages stronger (`mul`), cheaper (`cost`), more stamina or will in the battle, the
 *  innate move and the ultimate stronger. Two or three nodes in every tree; their sea side is untouched. */
export interface TalentBook {
  mul?: number;
  cost?: number;
  stam?: number;
  will?: number;
  innate?: number;
}
export const TALENT_BOOK: Record<string, TalentBook> = {
  // Gunnery.
  gun_powder_discipline: { stam: 3 },
  gun_crew_drill: { mul: 0.03 },
  gun_spotter: { cost: 0.05 },
  // Navigation.
  nav_weather_gauge: { will: 3 },
  nav_second_wind: { stam: 6, innate: 0.1 },
  // Boarding.
  brd_cutlass_drill: { mul: 0.02 },
  brd_blooded: { innate: 0.1 },
  brd_warlord: { stam: 5 },
  // Command.
  cmd_drill_master: { mul: 0.03 },
  cmd_iron_discipline: { cost: 0.05 },
  cmd_legend_at_the_helm: { innate: 0.15 },
  // Trade.
  trd_ledger_keeper: { cost: 0.03 },
  trd_market_sense: { will: 2 },
  // Smuggling.
  smg_false_colors: { innate: 0.1 },
  smg_fog_sense: { mul: 0.03 },
  smg_shadow_strike: { cost: 0.06 },
  // Survival.
  srv_hardened_crew: { stam: 4 },
  srv_grim_endurance: { mul: 0.03, stam: 3 },
  // Shipwright.
  shp_master_fitter: { cost: 0.03 },
  shp_masterwork: { mul: 0.03 },
  // Exploration.
  exp_star_reader: { will: 3 },
  exp_legend_seeker: { mul: 0.03 },
  // Abyssal.
  abs_whispers_below: { will: 3 },
  abs_hymn_of_the_choir: { mul: 0.03 },
  abs_rising_dead: { innate: 0.12 },
};

export interface BookLift {
  mul: number;
  cost: number;
  stam: number;
  will: number;
  innate: number;
}
/** What her talents lift her book by (ranks × per rank; the cost cut at most a third). */
export function talentBook(ranks: Record<string, number> | null | undefined): BookLift {
  const out: BookLift = { mul: 0, cost: 0, stam: 0, will: 0, innate: 0 };
  if (!ranks) return out;
  for (const id in ranks) {
    const t = TALENT_BOOK[id], r = ranks[id] ?? 0;
    if (!t || r <= 0) continue;
    out.mul += (t.mul ?? 0) * r;
    out.cost += (t.cost ?? 0) * r;
    out.stam += (t.stam ?? 0) * r;
    out.will += (t.will ?? 0) * r;
    out.innate += (t.innate ?? 0) * r;
  }
  out.cost = Math.min(0.33, out.cost);
  return out;
}

// ------------------------------------------------------------------ 10. scrolls

/** A scroll of a page from a lair or a boss: one battle cast of it, free, whatever her path. Drawn by the source's
 *  strength (the page's level at most `top`). */
export function scrollPool(top: number): PathPageId[] {
  return PATH_PAGE_IDS.filter((id) => PATH_PAGES[id].level <= Math.max(1, Math.min(5, top)));
}
/** Scroll chances: a boss, a stormed lair, a guard's chest. */
export const SCROLL_CHANCE = { boss: 0.5, lair: 0.35, guard: 0.12 } as const;
/** At most this many scrolls of a kind in her bag. */
export const SCROLL_MAX = 5;

// ------------------------------------------------------------------ 8. the named captains of the sea

/** The path a named pirate's trick says she walks; a baron's by his sea; a hunter's from her hull's number. */
export function pathOfTrick(trick: string): CaptainId {
  return trick === 'fog' ? 'smuggler' : trick === 'pack' ? 'admiral' : trick === 'fireship' ? 'corsair' : 'reaver';
}
export const BARON_PATH: Record<string, CaptainId> = {
  black_coast: 'reaver', whispering: 'smuggler', ashen_isles: 'corsair', gravewater: 'drowned', leviathan_reach: 'navigator', dead_mans_expanse: 'admiral', drowned_crown: 'drowned',
};
export function hunterPath(id: number): CaptainId {
  return (['corsair', 'admiral', 'navigator'] as const)[Math.abs(id) % 3];
}

// ------------------------------------------------------------------ words

/** The server's words about the paths, English → Russian. */
export function pathPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const id of PATH_PAGE_IDS) out.push(PATH_PAGES[id].name);
  for (const c of PATH_IDS) out.push(INNATE[c].name, ULTIMATE[c].name);
  return out;
}
