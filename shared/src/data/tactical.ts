// The turn-based boarding battle (docs/16 P4, «like Heroes of Might and Magic III»): two decks side by side on a
// hex field, joined by planks where the grapples bit; the crews fight as stacks (hands, marines, musketeers, an
// officer's party) in the order of their initiative, the captains stand on the side panel with two orders each.
// The server holds the battle (server/src/game/tactical.ts); the client draws it (client/src/ui/tactical.ts).

import type { CaptainId } from './captains.ts';
import type { OfficerRole } from './crew.ts';
import { UNITS } from './army.ts';
import type { UnitId } from './army.ts';
import { PATH_PAGES, PATH_PAGE_IDS } from './paths.ts';
import type { PathPageId } from './paths.ts';

/** The field: 11 columns by 9 rows of hexes, odd rows pushed half a hex to the right and one hex shorter ('#'). */
export const TAC_W = 11;
export const TAC_H = 9;
/** The water between the hulls; the planks cross it on a few rows. */
export const TAC_GAP = 5;
/** Seconds a captain has for each of his stacks' turns; then the stack defends. */
export const TAC_TURN = 30;
/** Seconds the sea's captains take over a stack's turn, so a player sees what they did. */
export const TAC_AI_DELAY = 0.7;
/** A battle not decided in this many rounds goes to the side with the more of its strength left. */
export const TAC_MAX_ROUNDS = 20;
/** Shots at more than this many hexes do half damage. */
export const TAC_LONG_SHOT = 6;
/** Each point of morale or luck: 4% a turn (HoMM3), at most three points. */
export const TAC_CHANCE_PER_POINT = 0.04;

/** Terrain of a hex: deck, water between the hulls, a plank across it, and what stands on the deck — and what the
 *  guns left of her deck before the grapples bit (docs/17 H1): a hole shot through it ('H', no footing) and a fire
 *  ('F', burning whoever stands in it as his turn comes). */
export type TacCell = '.' | '~' | '=' | 'M' | 'C' | 'B' | 'K' | '#' | 'H' | 'F';
export const TAC_BLOCKING: ReadonlySet<TacCell> = new Set(['~', 'M', 'C', 'B', 'K', '#', 'H']);
/** A stack on a burning hex loses this share of its strength (at least a man's hit points) as its turn comes. */
export const TAC_BURN = 0.1;
/** The deep's own freeze a living stack of the other side one turn in ten. */
export const TAC_FEAR = 0.1;

/** What a stack is, broadly (the old four, and the tiers above them). */
export type TacKind = 'hands' | 'marines' | 'gunners' | 'officer' | 'boarders' | 'guard' | 'deep';
export const TAC_KINDS: TacKind[] = ['hands', 'marines', 'gunners', 'officer', 'boarders', 'guard', 'deep'];

/** The broad kind of a kind of man. */
export function kindOfUnit(u: UnitId): TacKind {
  const d = UNITS[u];
  if (d.specials.includes('shooter')) return 'gunners';
  return d.tier <= 1 ? 'hands' : d.tier === 5 ? 'boarders' : d.tier === 6 ? 'guard' : d.tier >= 7 ? 'deep' : 'marines';
}

export interface TacUnitDef {
  kind: TacKind;
  atk: number;
  def: number;
  dmin: number;
  dmax: number;
  hp: number;
  speed: number;
  init: number;
  /** Musket balls a stack carries (0: steel only). */
  shots: number;
  /** The painted icon it shows. */
  icon: string;
}

/** One man of each kind (HoMM3 scale). Gunners carry the muskets and pistols; the officer's party is picked men. */
export const TAC_UNITS: Record<'hands' | 'marines' | 'gunners' | 'officer', TacUnitDef> = {
  hands: { kind: 'hands', atk: 4, def: 3, dmin: 1, dmax: 3, hp: 6, speed: 4, init: 5, shots: 0, icon: 'icon.prof_sailor' },
  marines: { kind: 'marines', atk: 7, def: 6, dmin: 2, dmax: 4, hp: 9, speed: 4, init: 7, shots: 0, icon: 'icon.prof_marine' },
  gunners: { kind: 'gunners', atk: 5, def: 3, dmin: 2, dmax: 3, hp: 5, speed: 3, init: 4, shots: 4, icon: 'icon.prof_gunner' },
  officer: { kind: 'officer', atk: 8, def: 7, dmin: 3, dmax: 5, hp: 10, speed: 5, init: 8, shots: 0, icon: 'icon.role_lieutenant' },
};

/** A captain's orders from the side panel (one a round, each with its cooldown in rounds). */
export type TacSpellId = 'grenades' | 'point_blank' | 'smoke_and_knives' | 'red_harvest' | 'turn_the_flank' | 'call_of_the_deep' | 'iron_discipline'
  /** The order book's common pages (docs/17 H1), after the captains' own abilities at sea. */
  | 'mark_target' | 'double_shot' | 'war_cry' | 'brine_mend'
  /** The order book's further pages (docs/17 H2, shared/src/data/hero.ts): learnt at guilds and shrines. */
  | 'musket_storm' | 'powder_keg' | 'following_wind' | 'head_wind' | 'tide_returns' | 'maelstrom' | 'shield_wall' | 'fury' | 'dread'
  /** The path books (docs/18 item 3, shared/src/data/paths.ts). */
  | PathPageId;
export interface TacSpellDef {
  id: TacSpellId;
  /** Rounds before it may be given again. */
  cd: number;
  /** 'enemy': the captain points at a foe's stack; 'own': at one of her own (docs/18); 'none': the whole deck. */
  target: 'enemy' | 'own' | 'none';
  icon: string;
}
export const TAC_SPELLS: Record<TacSpellId, TacSpellDef> = {
  grenades: { id: 'grenades', cd: 3, target: 'enemy', icon: 'icon.bt_grenades' },
  point_blank: { id: 'point_blank', cd: 4, target: 'enemy', icon: 'icon.bt_volley' },
  smoke_and_knives: { id: 'smoke_and_knives', cd: 4, target: 'none', icon: 'icon.bt_hold' },
  red_harvest: { id: 'red_harvest', cd: 4, target: 'none', icon: 'icon.bt_charge' },
  turn_the_flank: { id: 'turn_the_flank', cd: 4, target: 'none', icon: 'icon.bt_officers' },
  call_of_the_deep: { id: 'call_of_the_deep', cd: 5, target: 'none', icon: 'icon.bt_colours' },
  iron_discipline: { id: 'iron_discipline', cd: 4, target: 'none', icon: 'icon.bt_captain' },
  mark_target: { id: 'mark_target', cd: 3, target: 'enemy', icon: 'icon.ab_mark_target' },
  double_shot: { id: 'double_shot', cd: 4, target: 'none', icon: 'icon.ab_double_shot' },
  war_cry: { id: 'war_cry', cd: 4, target: 'none', icon: 'icon.ab_war_cry' },
  brine_mend: { id: 'brine_mend', cd: 5, target: 'none', icon: 'icon.ab_brine_mend' },
  musket_storm: { id: 'musket_storm', cd: 4, target: 'none', icon: 'icon.bt_volley' },
  powder_keg: { id: 'powder_keg', cd: 5, target: 'enemy', icon: 'icon.ab_admiralty_barrage' },
  following_wind: { id: 'following_wind', cd: 3, target: 'none', icon: 'icon.ab_current_rider' },
  head_wind: { id: 'head_wind', cd: 3, target: 'none', icon: 'icon.ab_hard_over' },
  tide_returns: { id: 'tide_returns', cd: 6, target: 'none', icon: 'icon.prof_surgeon' },
  maelstrom: { id: 'maelstrom', cd: 5, target: 'none', icon: 'icon.ab_maw_of_the_deep' },
  shield_wall: { id: 'shield_wall', cd: 3, target: 'none', icon: 'icon.ab_smoke_pots' },
  fury: { id: 'fury', cd: 4, target: 'none', icon: 'icon.ab_red_hook_boarding' },
  dread: { id: 'dread', cd: 5, target: 'none', icon: 'icon.ab_deep_call' },
  ...(Object.fromEntries(PATH_PAGE_IDS.map((id) => [id, { id, cd: PATH_PAGES[id].cd, target: PATH_PAGES[id].fx.target, icon: `icon.${PATH_PAGES[id].icon}` }])) as Record<PathPageId, TacSpellDef>),
};
/** Each captain's own order (the Boarding 2.0 captain's move, docs/11 P1) beside the grenades everyone has. */
export const TAC_SIGNATURE: Record<CaptainId, TacSpellId> = {
  corsair: 'point_blank', smuggler: 'smoke_and_knives', reaver: 'red_harvest', navigator: 'turn_the_flank', drowned: 'call_of_the_deep', admiral: 'iron_discipline',
};
/** The captain's order book (docs/17 H1, as a HoMM3 hero's spell book): his own move, the grenades everyone has, and
 *  two pages after his abilities at sea — the corsair's Double Shot and Mark Target, the Reaver's War Cry, the
 *  Drowned's Brine Mend… One order a round from the side panel. */
export const TAC_BOOK: Record<CaptainId, TacSpellId[]> = {
  corsair: ['point_blank', 'grenades', 'double_shot', 'mark_target'],
  smuggler: ['smoke_and_knives', 'grenades', 'mark_target', 'brine_mend'],
  reaver: ['red_harvest', 'grenades', 'war_cry', 'mark_target'],
  navigator: ['turn_the_flank', 'grenades', 'mark_target', 'brine_mend'],
  drowned: ['call_of_the_deep', 'grenades', 'brine_mend', 'war_cry'],
  admiral: ['iron_discipline', 'grenades', 'double_shot', 'war_cry'],
};
export function captainSpells(captain: CaptainId | null): TacSpellId[] {
  return captain ? [...TAC_BOOK[captain]] : ['grenades'];
}

/** An officer's party acts on the officer's word once a fight (instead of striking): what each post gives. Each post
 *  its own small ability (docs/18 item 7): the boatswain's stack braces (steady, a third less taken), the master
 *  gunner calls a volley from every musket that can see, the alchemist binds wounds, the sailmaker hangs wet canvas
 *  against her shot, the harpooner pins her worst stack. */
export type TacOrderId = 'rally' | 'all_hands' | 'lay_true' | 'steady' | 'brace' | 'volley' | 'bandage' | 'canvas' | 'harpoon';
export const TAC_ORDER_OF: Record<OfficerRole, TacOrderId> = {
  lieutenant: 'rally', boatswain: 'brace', quartermaster: 'steady', master_gunner: 'volley', pilot: 'all_hands',
  alchemist: 'bandage', deep_pastor: 'rally', sailmaker: 'canvas', harpooner: 'harpoon',
};
export const TAC_ORDER_IDS: TacOrderId[] = ['rally', 'all_hands', 'lay_true', 'steady', 'brace', 'volley', 'bandage', 'canvas', 'harpoon'];

// ------------------------------------------------------------------ hexes

export const hexIndex = (x: number, y: number): number => y * TAC_W + x;
export const hexX = (i: number): number => i % TAC_W;
export const hexY = (i: number): number => Math.floor(i / TAC_W);
export const onField = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < TAC_W && y < TAC_H;

const EVEN: [number, number][] = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
const ODD: [number, number][] = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

/** The (up to) six hexes around one. */
export function hexNeighbors(i: number): number[] {
  const x = hexX(i), y = hexY(i);
  const out: number[] = [];
  for (const [dx, dy] of y & 1 ? ODD : EVEN) if (onField(x + dx, y + dy)) out.push(hexIndex(x + dx, y + dy));
  return out;
}

/** The same hex seen from the other rail. */
export function hexMirror(i: number): number {
  const x = hexX(i), y = hexY(i);
  return hexIndex((y & 1 ? TAC_W - 2 : TAC_W - 1) - x, y);
}

/** Steps between two hexes. */
export function hexDist(a: number, b: number): number {
  const ay = hexY(a), by = hexY(b);
  const aq = hexX(a) - (ay - (ay & 1)) / 2, bq = hexX(b) - (by - (by & 1)) / 2;
  const dq = aq - bq, dr = ay - by;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
