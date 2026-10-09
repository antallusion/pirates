// The turn-based boarding battle (docs/16 P4, «like Heroes of Might and Magic III»): two decks side by side on a
// hex field, joined by planks where the grapples bit; the crews fight as stacks (hands, marines, musketeers, an
// officer's party) in the order of their initiative, the captains stand on the side panel with two orders each.
// The server holds the battle (server/src/game/tactical.ts); the client draws it (client/src/ui/tactical.ts).

import type { CaptainId } from './captains.ts';
import type { OfficerRole } from './crew.ts';
import { UNITS } from './army.ts';
import type { UnitId } from './army.ts';
import { BOOK_PAGES, BOOK_PAGE_IDS, PATH_PAGES, PATH_PAGE_IDS } from './paths.ts';
import type { BookPageId, PathPageId } from './paths.ts';

/** The field: 11 columns by 9 rows of hexes, odd rows pushed half a hex to the right and one hex shorter ('#'). */
export const TAC_W = 11;
export const TAC_H = 9;
/** The water between the hulls; the planks cross it on a few rows. */
export const TAC_GAP = 5;
/** Seconds a captain has for each of his stacks' turns; then the stack defends. */
export const TAC_TURN = 30;
/** Seconds the sea's captains wait before a stack's turn, once what was done before it has been played on the screen
 *  (owner, 2026-10-08: «там как-то слишком быстро всё перемещается, непонятно даже» — docs/23 item 60 had it 0.45 s
 *  and the walks 0.25 s, too quick to follow). */
export const TAC_AI_DELAY = 0.7;
/** «Ускорить ×2» (docs/23 item 60): the sea's breath and the field's pace, × while a captain on the field has asked
 *  for it. */
export const TAC_FAST = 0.5;

/** The field's pace (owner, 2026-10-08), seconds at ×1: a stack walks hex by hex, eased in and out; a blow is a lunge
 *  that lands, the struck stack's flash and its numbers rising, and the answer is a beat of its own after a breath; a
 *  shot is the muzzle and the ball's flight, then the same. The server waits as long before the sea's next turn (and
 *  her own clock starts after it), so every foe's turn is seen whole: who moved, who struck whom, how many fell. */
export const TAC_PACE = {
  /** A step of a walk. */
  hex: 0.42,
  /** A flier's glide over the field, a hex of it; and its bounds. */
  glide: 0.3,
  glideMin: 0.5,
  glideMax: 1.4,
  /** The wind-up and the blow landing (the struck stack's flash at its end). */
  lunge: 0.34,
  /** The struck stack's flash and its numbers rising, before anything else moves. */
  hit: 0.55,
  /** The breath before the answer. */
  answer: 0.3,
  /** The muzzle and the ball in flight (the struck stack's flash at its end). */
  shot: 0.38,
  /** A captain's order, a path's innate move and her ultimate; an officer's word; the poison, the fire, a creature
   *  growing back; a stack frozen in fear; a morale or luck mark; a stack waiting or defending; a round opening; a great
   *  one ashore. */
  spell: 0.9,
  innate: 1.2,
  ult: 2.2,
  order: 0.7,
  mark: 0.45,
  fear: 0.6,
  morale: 0.45,
  idle: 0.25,
  round: 0.35,
  boss: 1,
} as const;

/** The most of a turn's events the screens play (the view carries the last dozen of the log); and of the battle's last
 *  (a quick combat's end is shown by its last blows, not the whole fight again). */
export const TAC_PLAY_WINDOW = 12;
export const TAC_END_WINDOW = 6;

/** What the schedule reads of an event (shared/src/protocol.ts TacEvent). */
export interface TacBeatEvent {
  k: string;
  id?: string;
  n?: number;
}
/** One event's place on the screen's clock: from when, how long, and the moment its blow lands. Seconds from the first. */
export interface TacBeat {
  at: number;
  dur: number;
  impact: number;
}

/** A walk's (or a glide's) length on the screen: `steps` hexes, `fly` over the field. */
export function walkSecs(steps: number, fly = false, speed = 1): number {
  const n = Math.max(1, steps);
  return (fly ? Math.max(TAC_PACE.glideMin, Math.min(TAC_PACE.glideMax, n * TAC_PACE.glide)) : n * TAC_PACE.hex) / Math.max(1, speed);
}

/** The screen's clock over a run of events (one turn's, or whatever came in one view): each event's start, length and
 *  the moment it lands, and the whole. The client plays them so; the server waits as long before the sea's next turn.
 *  A blow that spills on to one more (a breath, a chain, a swivel's burst) lands with the blow it came from; a
 *  volley's shots overlap. `speed` 2 under «×2». */
export function tacSchedule(events: readonly TacBeatEvent[], speed = 1): { beats: TacBeat[]; total: number } {
  const P = TAC_PACE;
  const k = 1 / Math.max(1, speed);
  const beats: TacBeat[] = [];
  let at = 0, last: TacBeat | null = null, volley = false;
  const held: number[] = [];
  const put = (start: number, dur: number, impact = start): TacBeat => {
    const b = { at: start, dur, impact };
    beats.push(b);
    at = Math.max(at, start + dur);
    for (const i of held.splice(0)) beats[i] = { at: impact, dur: 0, impact };
    return b;
  };
  for (const e of events) {
    const rides = (e.k === 'hit' || e.k === 'shot') && (e.id === 'breath' || e.id === 'chain' || e.id === 'blast');
    if (rides && last) {
      const impact = last.impact + 0.12 * k;
      for (const i of held.splice(0)) beats[i] = { at: impact, dur: 0, impact };
      beats.push({ at: last.at, dur: 0, impact });
      continue;
    }
    const wasVolley = volley;
    volley = (e.k === 'shot' && e.id === 'volley') || (e.k === 'siege' && e.id === 'gun');
    switch (e.k) {
      case 'siege': {
        // docs/19 E5: a stone of the catapult or a tower's shot is a shot's beat; the ship's broadside before the
        // assault fires gun after gun, a third of a second apart, as a volley's muskets do.
        const start = volley && wasVolley && last ? last.at + 0.32 * k : at;
        last = put(start, (P.shot + P.hit) * k, start + P.shot * k);
        break;
      }
      case 'move':
        last = put(at, walkSecs(e.n ?? 1, e.id === 'fly', speed));
        break;
      case 'hit':
        last = put(at, (P.lunge + P.hit) * k, at + P.lunge * k);
        break;
      case 'ret':
        last = put(at, (P.answer + P.lunge + P.hit) * k, at + (P.answer + P.lunge) * k);
        break;
      case 'shot': {
        // A volley's muskets fire one after another, a quarter second apart, not each its own whole beat.
        const start = volley && wasVolley && last ? last.at + 0.25 * k : at;
        last = put(start, (P.shot + P.hit) * k, start + P.shot * k);
        break;
      }
      case 'die':
      case 'luck':
        // The fallen go when the blow that felled them lands, luck is told with the blow it doubles: both are told
        // before that blow (the battle's log), so they wait for it.
        held.push(beats.length);
        beats.push({ at, dur: 0, impact: at });
        break;
      case 'spell':
        last = put(at, P.spell * k, at + P.spell * 0.35 * k);
        break;
      case 'innate':
      case 'ult':
        last = put(at, P[e.k] * k, at + P[e.k] * 0.3 * k);
        break;
      case 'order':
        last = put(at, P.order * k, at + P.order * 0.4 * k);
        break;
      case 'poison':
      case 'burn':
      case 'regen':
        last = put(at, P.mark * k, at);
        break;
      case 'fear':
        last = put(at, P.fear * k, at);
        break;
      case 'morale':
      case 'again':
        last = put(at, P.morale * k, at);
        break;
      case 'round':
        last = put(at, P.round * k, at);
        break;
      case 'boss':
        last = put(at, P.boss * k, at + P.boss * 0.4 * k);
        break;
      default:
        // A wait, a defence, the clock run out.
        last = put(at, P.idle * k, at);
    }
  }
  for (const i of held) beats[i] = { at: last?.impact ?? at, dur: 0, impact: last?.impact ?? at };
  return { beats, total: at };
}

/** The six ways a hex looks, as the board lies (y down): 0 east, 1 south-east, 2 south-west, 3 west, 4 north-west, 5
 *  north-east. */
export type HexDir = 0 | 1 | 2 | 3 | 4 | 5;

/** Which of the six ways `to` lies from `from` (the nearest of them for a hex further off); −1 for the hex itself. */
export function hexDir(from: number, to: number): number {
  const fy = hexY(from), ty = hexY(to);
  const dq = hexX(to) - (ty - (ty & 1)) / 2 - (hexX(from) - (fy - (fy & 1)) / 2), dr = ty - fy;
  const x = Math.sqrt(3) * (dq + dr / 2), y = 1.5 * dr;
  if (!x && !y) return -1;
  return ((Math.round(Math.atan2(y, x) / (Math.PI / 3)) % 6) + 6) % 6;
}

/** Blows into a stack's side and from behind (owner, 2026-10-08: «удары сзади должны наносить больше урона»): the
 *  front three hexes of the way it faces strike as ever, its two sides a sixth and a half more, the one behind it 30%
 *  more. Its answer is the same from anywhere. */
export const TAC_FLANK = [1, 1.15, 1.3] as const;

/** How a blow from the hex `from` comes in at a stack on `at` facing `face`: 0 from its front, 1 into its side, 2
 *  from behind. */
export function flankOf(face: number, at: number, from: number): 0 | 1 | 2 {
  const d = hexDir(at, from);
  if (d < 0 || face < 0) return 0;
  const k = Math.abs(d - face) % 6;
  const off = Math.min(k, 6 - k);
  return off >= 3 ? 2 : off === 2 ? 1 : 0;
}
/** A battle not decided in this many rounds goes to the side with the more of its strength left. */
export const TAC_MAX_ROUNDS = 20;
/** Shots at more than this many hexes do half damage. */
export const TAC_LONG_SHOT = 6;
/** Each point of morale or luck: 4% a turn (HoMM3), at most three points. */
export const TAC_CHANCE_PER_POINT = 0.04;

/** Terrain of a hex: deck, water between the hulls, a plank across it, and what stands on the deck — and what the
 *  guns left of her deck before the grapples bit (docs/17 H1): a hole shot through it ('H', no footing) and a fire
 *  ('F', burning whoever stands in it as his turn comes). */
export type TacCell = '.' | '~' | '=' | 'M' | 'C' | 'B' | 'K' | '#' | 'H' | 'F'
  /** docs/18 II, the battlefield ashore: a rock, a palm (both give cover from shots to a stack beside them), the surf
   *  (no footing but for the creatures that dive). The sand is '.'. */
  | 'R' | 'P' | 'W'
  /** docs/19 E5, a citadel's siege: a wall segment whole and cracked ('X', 'Y'), the gate whole and cracked ('G', 'J':
   *  the defenders' way out, nobody else's), an arrow tower whole, cracked and silenced ('T', 'U', 'V'), the rubble of
   *  what fell ('r', ground again), the moat ('O': a stack that steps in stops there) and the causeway before the gate
   *  ('D', ground). */
  | 'X' | 'Y' | 'G' | 'J' | 'T' | 'U' | 'V' | 'r' | 'O' | 'D';
export const TAC_BLOCKING: ReadonlySet<TacCell> = new Set(['~', 'M', 'C', 'B', 'K', '#', 'H', 'R', 'P', 'W', 'X', 'Y', 'G', 'J', 'T', 'U', 'V']);

/** docs/19 E5: the siege of a citadel on the same hexes (as HoMM3's castle battle). The wall line stands down the
 *  column `wallX` (it bars the field from edge to edge: no hex steps across a whole column), the gate in its middle row,
 *  an arrow tower two rows from each end; the moat runs down the column before it but for the causeway at the gate.
 *  The defenders stand behind it (side 1, the right). A segment, the gate or a tower takes `hp` stones to bring down —
 *  a broken segment or gate is rubble, ground for both; a silenced tower is a stump. */
export const SIEGE = {
  wallX: 7,
  moatX: 6,
  gateY: 4,
  towers: [1, 7] as readonly number[],
  hp: 2,
  /** A stack in the moat, wet to the waist: its defence. */
  moatDef: 0.8,
  /** Shots from without the wall at a stack within it. */
  cover: 0.5,
  /** The catapult's stone (and the ship's ball) finds the stone it is laid on. */
  hit: 0.75,
  /** A cracked tower shoots this share of a whole one's shot. */
  cracked: 0.5,
} as const;

export type SiegePart = 'wall' | 'gate' | 'tower';
/** What stands in a row of the wall line. */
export const siegePart = (y: number): SiegePart => (y === SIEGE.gateY ? 'gate' : SIEGE.towers.includes(y) ? 'tower' : 'wall');
/** The cell a part of the wall line shows with `hp` of its `max` left. */
export function siegeCell(part: SiegePart, hp: number, max: number): TacCell {
  if (part === 'tower') return hp <= 0 ? 'V' : hp < max ? 'U' : 'T';
  if (hp <= 0) return 'r';
  if (part === 'gate') return hp < max ? 'J' : 'G';
  return hp < max ? 'Y' : 'X';
}
export const isGateCell = (c: string): boolean => c === 'G' || c === 'J';
/** Within the walls: behind the wall line. */
export const insideWalls = (i: number): boolean => hexX(i) > SIEGE.wallX;
/** Cover ashore: a shot at a stack beside a rock or a palm does this share of its harm. */
export const TAC_COVER = 0.75;
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
  /** The path books (docs/18 item 3, shared/src/data/paths.ts), and the common pages after them (BOOK_PAGES). */
  | PathPageId | BookPageId;
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
  ...(Object.fromEntries(BOOK_PAGE_IDS.map((id) => [id, { id, cd: BOOK_PAGES[id].cd, target: BOOK_PAGES[id].fx.target, icon: `icon.${BOOK_PAGES[id].icon}` }])) as Record<BookPageId, TacSpellDef>),
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
