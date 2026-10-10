// The turn-based boarding battle itself (docs/16 P4, docs/17 H1 «as in Heroes of Might and Magic III»), apart from
// the ships: a hex field of two decks, the ships' armies laid out stack by stack, the order of initiative, moves and
// blows with retaliation once a round, shots with their range and melee penalties, wait and defend, morale and luck,
// the specials of every kind of man (double strike, no retaliation, the swivel gun's blast, the deep's terror…), what
// the guns left of each deck (holes, fires, dismounted guns), the captains' order books, the sea's captains' mind and
// the end. Pure but for the dice it is handed; server/src/game/tactical.ts ties it to the ships and the captains.

import { skillMul } from '../../../shared/src/data/crew.ts';
import type { OfficerRole } from '../../../shared/src/data/crew.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId, UnitSpecial } from '../../../shared/src/data/army.ts';
import {
  TAC_AI_DELAY, TAC_BLOCKING, TAC_FAST, TAC_BURN, TAC_CHANCE_PER_POINT, TAC_COVER, TAC_FEAR, TAC_FLANK, TAC_GAP, TAC_H, TAC_LONG_SHOT, TAC_MAX_ROUNDS, TAC_ORDER_OF, TAC_SPELLS, TAC_TURN, TAC_UNITS, TAC_W,
  TAC_PLAY_WINDOW, TAC_SIGNATURE, captainSpells, flankOf, hexDir, hexDist, hexIndex, hexMirror, hexNeighbors, hexX, hexY, kindOfUnit, tacSchedule, TAC_DECK_COVER, deckCover, unitResist,
  SIEGE, insideWalls, isGateCell, siegeCell, siegePart, TAC_LEN, TAC_GROUP, TAC_ROLES, tacBring, tacEcho, tacGroupPace, tacLevel, tacBankSecs, tacFatigue, tacFlagHex, tacNpc, tacOpen, tacTempo, tacTurnSecs,
} from '../../../shared/src/data/tactical.ts';
import type { TacCell, TacKind, TacOrderId, TacSpellId } from '../../../shared/src/data/tactical.ts';
import type { TacAction, TacAllyView, TacEvent, TacHeroView, TacPreview, TacStackView, TacView } from '../../../shared/src/protocol.ts';
import { ORDERS, TACTICS_DEPLOY, homeMul, orderRes } from '../../../shared/src/data/hero.ts';
import type { HeroBattle, OrderRes } from '../../../shared/src/data/hero.ts';
import { BOOK_PAGES, CHAIN_FALL, HOME_MUL, INNATE, PATH_PAGES, orderPower, PATH_SCHOOL, RAISE_CAP, DRAIN_CAP, SICK_TURNS, ULTIMATE, ULT_EARLY, ULT_ROUND, drainCap, isBookPage, isPathPage, moveFx, pathHoldExtra, powHold, powered, raiseCap } from '../../../shared/src/data/paths.ts';
import type { BtMods, PageFx } from '../../../shared/src/data/paths.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { FAV_BONUS } from '../../../shared/src/data/drifts.ts';

/** One stack of a ship's army as it comes to the battle; `src` the ship's own stack its men are drawn from (the
 *  Marines talent drills hands into marines for the fight only). */
export interface TacArmyEntry {
  u: UnitId;
  n: number;
  src?: UnitId;
  /** docs/18 #39: a creature kind's rank (1–3): a tenth more attack, defence and hit points a rank. */
  rank?: number;
  /** docs/18 #44: a favourite kind of her path — attack and defence FAV_BONUS more. */
  fav?: boolean;
  /** docs/25 item 50: a stack the sea's fewer stacks were merged into carries the merged men's hit points and blows
   *  (a share on its own men's). */
  hpK?: number;
  dmgK?: number;
}

/** What one side brings to the fight, as the ship and her crew make it. */
export interface TacSideInput {
  name: string;
  ship: string;
  /** Her hull's class: the deck she fights on is painted for it (owner, 2026-10-02). */
  hull?: string;
  captain: CaptainId | null;
  /** Men by the stacks they make (the old reckoning, when no army is given; the other trades fight among the hands). */
  hands: number;
  marines: number;
  gunners: number;
  /** The ship's army (docs/17 H1): every stack of it on deck as it stands. */
  army?: TacArmyEntry[];
  /** Officers who lead a party of picked men (two at most). */
  officers: { id: string; role: OfficerRole; name: string; level: number; unique?: string; lucky: boolean }[];
  /** Veterancy stars 1..5. */
  skill: number;
  /** The crew's morale 0..100. */
  morale: number;
  /** The ladder of levels on every blow it deals (canon D12). */
  dealt: number;
  /** Boarding power (talents, captain, gear) and the melee bonus. */
  power: number;
  melee: number;
  extraShots: number;
  /** First Over the Rail: damage in the first round; Boarding Nets: a cut to the boarders' first round. */
  firstRush: number;
  nets: number;
  /** Blooded: damage per foe fallen (up to +20%). */
  blooded: number;
  /** Her hull is a castle: defenders stand a quarter firmer. */
  castle: boolean;
  /** She struck her colours before the grapples bit: a tenth of the fight in her. */
  struck: boolean;
  /** A captain plays this side (else the sea's mind). */
  human: boolean;
  /** What the guns left of her deck (docs/17 H1): holes shot through it (0–4), the share of her guns dismounted
   *  (her gunners' swivels with them), and a fire aboard. */
  holes?: number;
  gunsOut?: number;
  fire?: boolean;
  /** Her captain as a hero (docs/17 H2): primaries on every stack, her will and book, her skills' and artifacts'
   *  gifts. Absent: the old reckoning (the orders cost nothing). */
  hero?: HeroBattle;
  /** The face her captain shows on the side panel (a named captain of the sea's own portrait, docs/18 item 8). */
  face?: string;
  /** docs/18 II: a lair's creatures have no captain's book (no orders, not even grenades). */
  noBook?: boolean;
  /** docs/18 #38: the morale of a mixed army (HoMM3's peoples): 0 for an army of men, down to −3. */
  mixed?: number;
  /** A premium hull's deck gift (docs/02 §1.A.9): laid on her side's stacks (`mine`) and the other side's (`theirs`) for
   *  the first `rounds` rounds, as an order is — a clearing page lifts it as it lifts any. */
  gift?: { rounds: number; mine?: BtMods; theirs?: BtMods };
  /** docs/19 E5: the hit points her orders are reckoned from (absent: her side's own as it came aboard) — a citadel's
   *  castellan commands a garrison many times a captain's crew, but her orders are a captain's. */
  spellHp?: number;
  /** docs/25 item 56: the share of the other captain's orders and path pages every stack of hers shrugs off (a legend
   *  of the trials, a great ship of the sea); a legend, a titan and a great one ashore bring their own (unitResist). */
  resist?: number;
}

/** docs/19 E5: a citadel's siege as it is laid out — the ground it stands on, the wall line as an assault before left
 *  it (stones left in each row's wall, gate or tower: SIEGE.hp each, a hit more under the Masters of the Throne), the
 *  ship's broadside before the assault (stones on the wall), the catapult's stones a round, a tower's shot (hit points
 *  before her stack's defence). The boarders are side 0, the garrison side 1. */
export interface SiegeInput {
  type: string;
  hp?: number[];
  max?: number[];
  bombard?: number;
  catapult?: number;
  tower?: number;
  name?: string;
}

export interface SiegeState {
  hp: number[];
  max: number[];
  catapult: number;
  tower: number;
  name?: string;
}

export interface TacStack {
  id: number;
  side: 0 | 1;
  kind: TacKind;
  /** The kind of man, his specials, and the ship's stack he is drawn from. */
  unit: UnitId;
  sp: UnitSpecial[];
  src: UnitId;
  count: number;
  start: number;
  hpTop: number;
  hpMax: number;
  hex: number;
  atk: number;
  def: number;
  dmin: number;
  dmax: number;
  speed: number;
  init: number;
  shots: number;
  shotsMax: number;
  /** Her guns dismounted: the swivel crews' blows cut. */
  dmgMul: number;
  ret: boolean;
  defending: boolean;
  waited: boolean;
  surged: boolean;
  /** Turns more she acts this round (docs/18: the Following Squall, the Eye of the Storm). */
  again: number;
  /** docs/18 II: a creature's poison in her — the harm it does as her next turns come, how many more, and whose (`sick`:
   *  the Foul Water's sickness, a common page after docs/18). */
  poison?: { dmg: number; left: number; by: 0 | 1; sick?: boolean; who?: number };
  /** The way she faces (owner, 2026-10-08; shared/src/data/tactical.ts hexDir): toward the other deck as she comes
   *  aboard, then the way of her last move, blow or shot. A blow into her side or from behind lands harder. */
  face: number;
  officer?: { id: string; role: OfficerRole; name: string; unique?: string; order: TacOrderId; used: boolean };
  /** docs/25 item 64: the allied captain whose stack she is (her slot on the side, TacAlly); absent: the side's own. */
  own?: number;
  /** docs/25 item 65: the round a captain's move last gave her another turn (in a group, once a round). */
  extra?: number;
  /** docs/25 item 66: men a group's foe was grown by (not her ship's: the reckoning takes her losses back by it). */
  boost?: number;
}

/** docs/25 item 64: an allied captain on a side — a mate of the group of the captain who grappled (or was grappled):
 *  her own hero (her will, stamina, book and path, her chess clock and auto-battle), the stacks of her own army she
 *  brought (TacStack.own = `slot`), the round she came aboard. Her orders lay on the whole side: what she lays is in
 *  the side captain's list (`hero.fx` is the same list). */
export interface TacAlly {
  side: 0 | 1;
  slot: number;
  hero: TacHero;
  joined: number;
  /** Whose she is to the server (her account). */
  tag?: number;
}

interface Fx {
  id: string;
  /** The last round it holds. */
  until: number;
  /** The stack it is laid on (Mark Target). */
  on?: number;
  /** What it lays on stacks while it holds (docs/18): on her own side's, or (`foe`) on the other's. */
  mods?: BtMods;
  foe?: boolean;
  /** docs/25 item 56: the stacks of hers that shrugged it off. */
  res?: number[];
  /** docs/25 item 65: the captain of the side who laid it (her ally slot; absent: the side's own captain). */
  by?: number;
  /** docs/25 item 70: a captain's own order — how strong she gave it (ORDER_KNOBS; absent: 1). */
  k?: number;
}

export interface TacHero {
  input: TacSideInput;
  morale: number;
  luck: number;
  /** Her will in the battle (−1: the old reckoning, orders free). */
  mana: number;
  spells: { id: TacSpellId; ready: number }[];
  cast: number;
  auto: boolean;
  /** «Ускорить ×2» (docs/23 item 60). */
  fast?: boolean;
  fx: Fx[];
  kills: number;
  startHp: number;
  startMen: number;
  cutTried: number;
  /** docs/18: her stamina (−1: the old reckoning), her innate move and ultimate (0 none, 1 ready, 2 used), the
   *  scroll pages she read. */
  stam: number;
  innate: 0 | 1 | 2;
  ult: 0 | 1 | 2;
  /** The round she last gave her innate move or ultimate (one of them a round, beside her order). */
  moved: number;
  /** Her side's next blows that draw no answer (docs/18: Blood Harvest, the Red Tide). */
  free: number;
  scrollsUsed: TacSpellId[];
  /** The last round her signals are lost in the other's fog (the Silent Fog): no order nor path move till it ends. */
  hush?: number;
  /** docs/25 item 48: seconds left on her chess clock (−1: none — the sea's mind, a long battle). */
  bank: number;
  /** docs/25 item 55: the round her ultimate may be given from — the second, the first when the other side came
   *  aboard ULT_EARLY times her strength or more. */
  ultFrom: number;
}

/** docs/25 block Г: what a battle's length is reckoned by. 'board': a boarding (a ship's or the Colosseum's) — its
 *  blows by its level (tempo), the fatigue from round 8, the chess clocks, the quarterdeck's flag from level 40.
 *  'long': the legends, the Abyss raid, the citadels and the trials — long by design (owner, docs/25 §1.2): none of
 *  that. Absent: a battle as before (the land's fights and the tests' bare armies), but the turn's clock by level. */
export type TacLen = 'board' | 'long';

export interface TacBattle {
  cells: TacCell[];
  stacks: TacStack[];
  heroes: [TacHero, TacHero];
  round: number;
  queue: number[];
  active: number | null;
  turnEnds: number;
  /** A side whose screen opened the fight with a film has had the clock held for it (once a battle). */
  filmHeld?: [boolean, boolean];
  aiAt: number;
  log: TacEvent[];
  events: number;
  seq: number;
  over: null | { winner: 0 | 1; why: 'rout' | 'struck' | 'rounds' | 'ransom' | 'flag' };
  /** docs/25 block Г: the battle's level (the captains' mean; 0: none), its kind of length, its blows' scale. */
  level: number;
  len?: TacLen;
  tempo: number;
  /** The orders' scale (docs/25 item 44): the tempo's slowing, and of its speeding up no more than TAC_LEN.blastMax — a
   *  low level's orders already land hard (her path's power is at its highest there); its quick fights come from the
   *  men's blows. */
  blast: number;
  /** docs/25 item 48: the turn running on a captain's chess clock — whose, and from when (her clock starts once what
   *  came before her turn is played). */
  clock?: { side: 0 | 1; from: number; slot?: number };
  /** docs/25 item 64: the allied captains on the field, both sides; those who asked to come aboard as the next round
   *  opens (up to TAC_GROUP.late), with what her side's foe grows by as she does (item 66). */
  allies?: TacAlly[];
  joinQ?: { side: 0 | 1; input: TacSideInput; grow: boolean | number; tag?: number }[];
  /** docs/25 item 67: the hit points of the other side each captain cut down — `side:slot` (0: the side's own captain). */
  dealt?: Record<string, number>;
  /** docs/25 item 64: the captain whose order or path move is being given now (her ally slot), while it lands. */
  casting?: number;
  /** docs/25 item 66: what each side was grown by against a group (1: as she came), and the men each stack was grown by
   *  since the server last took her losses (it takes them back from its count). */
  boost?: [number, number];
  grown?: { id: number; n: number }[];
  /** docs/25 block Е: the lift on blows and orders the allies on the field brought (TAC_GROUP.pace; in `tempo`, `blast`). */
  groupPace?: number;
  /** docs/25 item 65: the captains (slots) of each side who gave a path's page or move this round, by `side:round:path`. */
  echo?: Record<string, number[]>;
  /** docs/25 item 52: the quarterdeck's flags (from level 40) — each side's own hex (the other side takes it), whole
   *  rounds a stack of each side has stood on the other's, and whether one stood there as the round opened. */
  flag?: { hex: [number, number]; held: [number, number]; open: [boolean, boolean] };
  /** docs/25 item 49: a quick fight offered at once to this side (the sea's side clearly the weaker). */
  quick?: [boolean, boolean];
  /** Men fallen on each side so far. */
  dead: [number, number];
  /** Officers whose party was broken (dead) or badly cut (hurt). */
  hurt: { id: string; side: 0 | 1; heavy: boolean }[];
  broken: [number, number];
  /** docs/18 II: fought ashore — the kind of island the field is (sand, rocks, palms and the surf; no guns). */
  land?: string;
  /** The hexes a great one ashore will fall on as the next round opens (shorebosses.ts), shown to the captain. */
  warn?: number[];
  /** The last event before the turn now running: what came after it is played on the screens before the next turn
   *  (owner, 2026-10-08: the field's pace, TAC_PACE). */
  beatFrom?: number;
  /** docs/19 E5: a citadel's siege — the wall line's stones, the catapult, the towers. */
  siege?: SiegeState;
  /** docs/19 E14: a bout of the Colosseum, on its sand. */
  arena?: true;
}

const sp = (s: TacStack, x: UnitSpecial): boolean => s.sp.includes(x);
/** What a captain laid that still holds, kept in place (docs/25 item 64: her allies read the same list). */
function keepFx(h: TacHero, keep: (f: Fx) => boolean): void {
  let j = 0;
  for (const f of h.fx) if (keep(f)) h.fx[j++] = f;
  h.fx.length = j;
}
export const isShooter = (s: TacStack): boolean => sp(s, 'shooter');

// ------------------------------------------------------------------ the field

/** The two decks, the water between, the planks across it and what stands on deck, from a seed. The field is the
 *  same seen from either rail (the right deck mirrors the left), so neither side stands nearer the planks. */
export function makeField(seed: number): TacCell[] {
  const rng = new Rng(seed);
  const cells: TacCell[] = Array.from({ length: TAC_W * TAC_H }, () => '.');
  for (let y = 1; y < TAC_H; y += 2) cells[hexIndex(TAC_W - 1, y)] = '#'; // odd rows are a hex shorter
  for (let y = 0; y < TAC_H; y++) {
    cells[hexIndex(TAC_GAP, y)] = '~';
    if (y & 1) cells[hexIndex(TAC_GAP - 1, y)] = '~';
  }
  // Three planks where the grapples bit: amidships, and one fore and one aft.
  for (const rows of [[0, 2], [4], [6, 8]]) cells[hexIndex(TAC_GAP, rng.pick(rows))] = '=';
  // The left deck: its mast, the guns run in at the bow and stern, a barrel or crates in the waist; the right the same.
  const set = (i: number, c: TacCell) => {
    cells[i] = c;
    cells[hexMirror(i)] = c;
  };
  set(hexIndex(2, rng.pick([3, 4, 5])), 'M');
  set(hexIndex(2, 0), 'C');
  set(hexIndex(2, TAC_H - 1), 'C');
  let n = 1 + rng.int(0, 1);
  for (let tries = 0; n > 0 && tries < 20; tries++) {
    const i = hexIndex(3, rng.int(1, TAC_H - 2));
    if (cells[i] !== '.' || hexNeighbors(i).some((j) => cells[j] === '=')) continue;
    set(i, rng.chance(0.5) ? 'B' : 'K');
    n--;
  }
  return cells;
}

/** The battlefield ashore (docs/18 II item 15): the same hexes, sand where the decks were — the surf along the shore
 *  (the bottom rows), rocks and palms in the middle ground (cover from shots for a stack beside them) by the kind of
 *  island, a tidal pool or two on the marshy and the dead ones; the same seen from either side, as the decks are. */
export function makeLandField(seed: number, type: string): TacCell[] {
  const rng = new Rng((seed ^ 0x1a2d) >>> 0);
  const cells: TacCell[] = Array.from({ length: TAC_W * TAC_H }, () => '.');
  for (let y = 1; y < TAC_H; y += 2) cells[hexIndex(TAC_W - 1, y)] = '#';
  const set = (i: number, c: TacCell) => {
    cells[i] = c;
    cells[hexMirror(i)] = c;
  };
  // The surf: the last row whole, and a tongue of it in the row above where the beach dips.
  for (let x = 0; x < TAC_W; x++) cells[hexIndex(x, TAC_H - 1)] = 'W';
  for (const x of [3, 4]) if (rng.chance(0.6)) set(hexIndex(x, TAC_H - 2), 'W');
  // The middle ground: what stands there by the kind of island (rocks 'R', palms 'P', pools of the surf 'W').
  const kinds: Record<string, TacCell[]> = {
    tropical: ['P', 'P', 'P', 'R'], rocky: ['R', 'R', 'R', 'P'], volcanic: ['R', 'R', 'R'], swamp: ['P', 'P', 'W', 'R'], graveyard: ['K', 'B', 'R', 'R'], dead: ['R', 'W', 'R'],
  };
  const pool = kinds[type] ?? kinds.rocky;
  let n = 3 + rng.int(0, 1);
  for (let tries = 0; n > 0 && tries < 40; tries++) {
    const x = rng.int(2, 4), y = rng.int(0, TAC_H - 3);
    const i = hexIndex(x, y);
    if (cells[i] !== '.' || hexNeighbors(i).some((j) => cells[j] !== '.' && cells[j] !== '#')) continue;
    set(i, pool[rng.int(0, pool.length - 1)]);
    n--;
  }
  // A rock or a palm amidst the field, now and then.
  if (rng.chance(0.5)) {
    const i = hexIndex(5, rng.pick([2, 4]));
    if (cells[i] === '.') cells[i] = pool[0] === 'W' ? 'R' : pool[0];
  }
  return cells;
}

/** docs/19 E5: the siege field — the island's ground before the citadel (a rock or two, or palms, on the approach), the
 *  moat down the column before the wall with the causeway at the gate, the wall line as it stands (`hp` of `max` in each
 *  row: SIEGE), the courtyard within with a stack of the stores by the back wall. Not mirrored: the walls are the
 *  garrison's. */
export function makeSiegeField(seed: number, type: string, hp: readonly number[], max: readonly number[]): TacCell[] {
  const rng = new Rng((seed ^ 0x51e6e) >>> 0);
  const cells: TacCell[] = Array.from({ length: TAC_W * TAC_H }, () => '.');
  for (let y = 1; y < TAC_H; y += 2) cells[hexIndex(TAC_W - 1, y)] = '#';
  for (let y = 0; y < TAC_H; y++) {
    cells[hexIndex(SIEGE.moatX, y)] = y === SIEGE.gateY ? 'D' : 'O';
    cells[hexIndex(SIEGE.wallX, y)] = siegeCell(siegePart(y), hp[y] ?? SIEGE.hp, max[y] ?? SIEGE.hp);
  }
  const pool: TacCell[] = type === 'tropical' || type === 'swamp' ? ['P', 'R'] : ['R', 'R', 'P'];
  let n = 1 + rng.int(0, 1);
  for (let tries = 0; n > 0 && tries < 40; tries++) {
    const i = hexIndex(rng.int(2, 4), rng.int(0, TAC_H - 1));
    if (cells[i] !== '.' || hexNeighbors(i).some((j) => cells[j] !== '.' && cells[j] !== '#')) continue;
    cells[i] = pool[rng.int(0, pool.length - 1)];
    n--;
  }
  const back = hexIndex(TAC_W - 1, rng.pick([0, 8]));
  cells[back] = rng.chance(0.5) ? 'B' : 'K';
  return cells;
}

/** docs/19 E14: the sand of the Colosseum — one open ring, no planks and no surf, a stack of barrels and one of crates in
 *  the middle ground of each half (the same seen from either side, as the decks are), so a bout is the draft's and the
 *  captains' and nobody's deck. */
export function makeArenaField(seed: number): TacCell[] {
  const rng = new Rng((seed ^ 0xa7e4a) >>> 0);
  const cells: TacCell[] = Array.from({ length: TAC_W * TAC_H }, () => '.');
  for (let y = 1; y < TAC_H; y += 2) cells[hexIndex(TAC_W - 1, y)] = '#';
  const set = (i: number, c: TacCell) => {
    cells[i] = c;
    cells[hexMirror(i)] = c;
  };
  const rows = rng.chance(0.5) ? [1, 6] : [2, 7];
  set(hexIndex(3, rows[0]), 'B');
  set(hexIndex(3, rows[1]), 'K');
  return cells;
}

/** docs/25 item 62: every hex a stack may stand on reaches the planks (a fire and a hole are no way through). */
function deckOpen(cells: readonly TacCell[]): boolean {
  const walk = (i: number) => !TAC_BLOCKING.has(cells[i]) && cells[i] !== 'F';
  const start = cells.findIndex((c) => c === '=');
  if (start < 0) return true;
  const seen = new Set<number>([start]);
  const q = [start];
  while (q.length) for (const j of hexNeighbors(q.pop()!)) if (!seen.has(j) && walk(j)) {
    seen.add(j);
    q.push(j);
  }
  for (let i = 0; i < cells.length; i++) if (walk(i) && !seen.has(i)) return false;
  return true;
}

/** What the guns left of one side's deck (docs/17 H1): holes where the balls went through (no footing), fires still
 *  burning. Never beside a plank, so the way across stays open. */
export function scarDeck(cells: TacCell[], side: 0 | 1, holes: number, fire: boolean, seed: number): void {
  const rng = new Rng(seed ^ (side ? 0x5ca2 : 0x5ca1));
  const put = (c: TacCell, n: number, cols: number[]) => {
    for (let tries = 0; n > 0 && tries < 60; tries++) {
      const x = rng.pick(cols), y = rng.int(0, TAC_H - 1);
      const l = hexIndex(x, y);
      const i = side ? hexMirror(l) : l;
      if (cells[i] !== '.' || hexNeighbors(i).some((j) => cells[j] === '=' || cells[j] === 'H')) continue;
      cells[i] = c;
      // docs/25 item 62: a fire splits the deck, but never shuts a corner of it off from the planks.
      if (!deckOpen(cells)) {
        cells[i] = '.';
        continue;
      }
      n--;
    }
  };
  put('H', Math.max(0, Math.min(4, Math.round(holes))), [2, 3]);
  if (fire) put('F', 3, [1, 2, 3]);
}

const ROWS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [1, 4, 7], 4: [1, 3, 5, 7], 5: [0, 2, 4, 6, 8] };

function place(cells: TacCell[], taken: Set<number>, x: number, y: number, side: 0 | 1): number {
  for (let d = 0; d < TAC_H; d++) {
    for (const yy of [y + d, y - d]) {
      if (yy < 0 || yy >= TAC_H) continue;
      const i = side ? hexMirror(hexIndex(x, yy)) : hexIndex(x, yy);
      if (!TAC_BLOCKING.has(cells[i]) && cells[i] !== 'F' && !taken.has(i)) return i;
    }
  }
  // The rail is full: the next column in.
  for (let xx = x + 1; xx < TAC_GAP - 1; xx++) {
    for (let yy = 0; yy < TAC_H; yy++) {
      const i = side ? hexMirror(hexIndex(xx, yy)) : hexIndex(xx, yy);
      if (!TAC_BLOCKING.has(cells[i]) && !taken.has(i)) return i;
    }
  }
  return side ? hexMirror(hexIndex(x, y)) : hexIndex(x, y);
}

/** The old reckoning's kinds as kinds of man (a battle laid out from head counts, not an army). */
const LEGACY_UNIT: Record<'hands' | 'marines' | 'gunners' | 'officer', UnitId> = { hands: 'sailor', marines: 'marine', gunners: 'musketeer', officer: 'guard' };

/** The stacks a side brings: every stack of her army as it stands (docs/17 H1), or — from head counts — the hands in
 *  one or two, the marines, the musketeers and each officer's party. The steel in front, the shooters behind. */
export function buildStacks(input: TacSideInput, side: 0 | 1, cells: TacCell[], firstId: number, deploy = 0): TacStack[] {
  const q = skillMul(input.skill);
  const out: TacStack[] = [];
  let id = firstId;
  const r1 = (v: number) => Math.round(v * q * 10) / 10;
  const gunsOut = Math.max(0, Math.min(1, input.gunsOut ?? 0));
  const officers = input.officers.slice(0, 2);
  if (input.army) {
    for (const e of input.army) {
      if (!(e.n > 0) || !UNITS[e.u]) continue;
      const d = UNITS[e.u];
      // Dismounted guns: the swivel crews have fewer charges and lighter ones.
      const blast = d.specials.includes('blast');
      // docs/18 #39: a tamed kind's rank.
      const rk = 1 + 0.1 * Math.max(0, Math.min(3, Math.floor(e.rank ?? 0)));
      // docs/18 #44: her path's favourite kind.
      const fk = e.fav ? 1 + FAV_BONUS : 1;
      let shots = d.shots ? d.shots + input.extraShots : 0;
      if (blast && gunsOut > 0) shots = Math.max(1, Math.round(shots * (1 - gunsOut)));
      const hpM = Math.max(1, Math.round(d.hp * rk * (e.hpK ?? 1)));
      out.push({
        id: id++, side, kind: kindOfUnit(e.u), unit: e.u, sp: [...d.specials], src: e.src ?? e.u, count: Math.floor(e.n), start: Math.floor(e.n), hpTop: hpM, hpMax: hpM, hex: -1,
        atk: r1(d.atk * rk * fk), def: r1(d.def * rk * fk), dmin: d.dmin, dmax: d.dmax, speed: d.speed, init: d.init, shots, shotsMax: shots, dmgMul: (blast ? 1 - 0.5 * gunsOut : 1) * (e.dmgK ?? 1),
        ret: true, defending: false, waited: false, surged: false, again: 0, face: side ? 3 : 0,
      });
    }
    // Each officer leads one of the melee stacks, the strongest first: his word once a fight, his craft in its blows.
    const lead = [...out].filter((s) => !isShooter(s)).sort((a, b) => UNITS[b.unit].tier - UNITS[a.unit].tier || b.count - a.count);
    officers.forEach((o, k) => {
      const s = lead[k];
      if (!s) return;
      s.atk = Math.round((s.atk + o.level * 0.25 * q) * 10) / 10;
      s.def = Math.round((s.def + o.level * 0.2 * q) * 10) / 10;
      s.officer = { id: o.id, role: o.role, name: o.name, ...(o.unique ? { unique: o.unique } : {}), order: TAC_ORDER_OF[o.role], used: false };
    });
  } else {
    let hands = Math.max(0, Math.round(input.hands));
    const total = hands + input.marines + input.gunners;
    const make = (kind: 'hands' | 'marines' | 'gunners' | 'officer', n: number, extra?: Partial<TacStack>): void => {
      if (n <= 0) return;
      const u = TAC_UNITS[kind];
      const shots = u.shots ? u.shots + input.extraShots : 0;
      const unit = LEGACY_UNIT[kind];
      out.push({
        id: id++, side, kind, unit, sp: kind === 'gunners' ? ['shooter'] : [], src: kind === 'officer' ? 'sailor' : unit, count: n, start: n, hpTop: u.hp, hpMax: u.hp, hex: -1,
        atk: r1(u.atk), def: r1(u.def), dmin: u.dmin, dmax: u.dmax, speed: u.speed, init: u.init,
        shots, shotsMax: shots, dmgMul: 1, ret: true, defending: false, waited: false, surged: false, again: 0, face: side ? 3 : 0, ...extra,
      });
    };
    // Each officer takes a twentieth of the men (at least two) as his party.
    for (const o of officers) {
      const party = Math.min(hands, Math.max(2, Math.round(total * 0.05)));
      if (party <= 0) continue;
      hands -= party;
      make('officer', party, {
        atk: Math.round((TAC_UNITS.officer.atk + o.level * 0.25) * q * 10) / 10,
        def: Math.round((TAC_UNITS.officer.def + o.level * 0.2) * q * 10) / 10,
        officer: { id: o.id, role: o.role, name: o.name, ...(o.unique ? { unique: o.unique } : {}), order: TAC_ORDER_OF[o.role], used: false },
      });
    }
    make('marines', input.marines);
    make('gunners', input.gunners);
    if (hands >= 16) {
      make('hands', Math.ceil(hands / 2));
      make('hands', Math.floor(hands / 2));
    } else make('hands', hands);
  }
  // The hero's Attack and Defense on every stack of hers (HoMM3).
  const hb = input.hero;
  if (hb) for (const s of out) {
    s.atk = Math.round((s.atk + hb.atk) * 10) / 10;
    s.def = Math.round((s.def + hb.def) * 10) / 10;
  }
  // The steel in front, the shooters and the officers' parties behind (her Tactics bring the line nearer the planks).
  const front = out.filter((s) => !isShooter(s) && s.kind !== 'officer');
  const back = out.filter((s) => !front.includes(s));
  const taken = new Set<number>();
  const d = Math.max(0, Math.min(2, deploy));
  for (const [list, col0] of [[front, 1], [back, 0]] as const) {
    const col = col0 + d;
    const rows = ROWS[Math.min(5, list.length)] ?? ROWS[5];
    list.forEach((s, k) => {
      s.hex = place(cells, taken, k < 5 ? col : col + 1, rows[k % rows.length], side);
      taken.add(s.hex);
    });
  }
  return out;
}

const hpOf = (s: TacStack) => (s.count > 0 ? (s.count - 1) * s.hpMax + s.hpTop : 0);
/** docs/18 II: a creature that grows back takes this share of its strength as its turn comes; a creature of terror
 *  freezes the living beside it this often. */
export const REGEN_SHARE = 0.1;
export const TAC_TERROR = 0.2;
/** Owner, 2026-10-03 (docs/18 VII): the shop's creatures' and the factions' elites' crafts — a healer gives each of its
 *  side within two hexes this share of its strength; one blow in four binds; a chill takes two hexes and three of
 *  initiative; a drinker takes back half the harm it does; a breath or a chain lays half the blow on one more. */
export const MEND_SHARE = 0.05;
export const MEND_REACH = 2;
export const BIND_CHANCE = 0.25;
export const CHILL = { speed: -2, init: -3 };
export const DRAIN_SHARE = 0.5;
export const SPILL_SHARE = 0.5;

/** A premium hull's deck gift as the moves of the battle hold (docs/02 §1.A.9): on her side, and on the other. */
function giftFx(input: TacSideInput): Fx[] {
  const g = input.gift;
  if (!g) return [];
  const out: Fx[] = [];
  if (g.mine) out.push({ id: 'ship_gift', until: g.rounds, mods: g.mine });
  if (g.theirs) out.push({ id: 'ship_gift_foe', until: g.rounds, mods: g.theirs, foe: true });
  return out;
}

function newHero(input: TacSideInput, stacks: TacStack[]): TacHero {
  const lucky = input.officers.filter((o) => o.lucky).length;
  return {
    input, morale: Math.max(0, Math.min(100, input.morale)), luck: Math.max(-3, Math.min(3, 1 + lucky + (input.hero?.luck ?? 0))),
    mana: input.hero ? input.hero.mana : -1,
    spells: (input.noBook ? [] : input.hero ? input.hero.book : captainSpells(input.captain)).map((id) => ({ id, ready: 1 })), cast: 0, auto: !input.human, fx: giftFx(input), kills: 0,
    startHp: stacks.reduce((n, s) => n + hpOf(s), 0), startMen: stacks.reduce((n, s) => n + s.count, 0), cutTried: 0,
    stam: input.hero?.stamMax !== undefined ? input.hero.stam ?? input.hero.stamMax : -1,
    innate: input.hero?.path ? 1 : 0, ult: input.hero?.path && input.hero.ult ? 1 : 0, scrollsUsed: [], moved: 0, free: 0, bank: -1, ultFrom: ULT_ROUND,
  };
}

/** docs/25 block Г: a battle's level — the captains' mean (a side without one aside); 0 when neither has one. */
export function battleLevel(a: TacSideInput, b: TacSideInput): number {
  const ls = [a.hero?.level, b.hero?.level].filter((x): x is number => typeof x === 'number' && x > 0);
  return ls.length ? Math.round(ls.reduce((n, x) => n + x, 0) / ls.length) : 0;
}

/** A battle laid out: the field, what the guns left of each deck, both sides' stacks, round one about to open. */
export function newBattle(a: TacSideInput, b: TacSideInput, seed: number, now: number, rng: Rng, opts: { land?: string; siege?: SiegeInput; arena?: boolean; len?: TacLen; level?: number; allies?: { side: 0 | 1; input: TacSideInput; grow?: boolean | number; tag?: number }[] } = {}): TacBattle {
  // docs/19 E5: a citadel's siege is fought ashore before its walls.
  const sg = opts.siege;
  const land = sg ? sg.type : opts.land;
  const max = sg ? Array.from({ length: TAC_H }, (_, y) => Math.max(1, Math.round(sg.max?.[y] ?? SIEGE.hp))) : [];
  const hp = sg ? max.map((m, y) => Math.max(0, Math.min(m, Math.round(sg.hp?.[y] ?? m)))) : [];
  // docs/19 E14: a bout of the Colosseum on its own sand (no deck of either ship: no holes, no fire).
  const cells = sg ? makeSiegeField(seed, sg.type, hp, max) : land ? makeLandField(seed, land) : opts.arena ? makeArenaField(seed) : makeField(seed);
  // Ashore (docs/18 II) the ship's guns are not there: no holes, no fire, no swivels.
  if (!land && !opts.arena) for (const [x, side] of [[a, 0], [b, 1]] as const) if ((x.holes ?? 0) > 0 || x.fire) scarDeck(cells, side, x.holes ?? 0, !!x.fire, seed);
  // Tactics (docs/17 H2): the higher hand has the field, the lower none — but a garrison keeps within its walls.
  const ta = a.hero?.tactics ?? 0, tb = b.hero?.tactics ?? 0;
  const sa = buildStacks(a, 0, cells, 1, ta > tb ? TACTICS_DEPLOY[ta] : 0);
  const sb = buildStacks(b, 1, cells, sa.length + 1, tb > ta && !sg ? TACTICS_DEPLOY[tb] : 0);
  if (land) for (const s of [...sa, ...sb]) {
    s.sp = s.sp.filter((x) => x !== 'blast');
    s.dmgMul = 1;
  }
  // docs/25 block Г: its level, its blows' scale, the flags on a boarding's decks from level 40.
  const level = Math.max(0, Math.round(opts.level ?? battleLevel(a, b)));
  const board = opts.len === 'board';
  const bt: TacBattle = {
    cells, stacks: [...sa, ...sb], heroes: [newHero(a, sa), newHero(b, sb)], round: 0, queue: [], active: null, turnEnds: now, aiAt: now,
    log: [], events: 0, seq: 0, over: null, dead: [0, 0], hurt: [], broken: [0, 0], ...(land ? { land } : {}), ...(opts.arena ? { arena: true as const } : {}),
    ...(sg ? { siege: { hp, max, catapult: Math.max(0, Math.round(sg.catapult ?? 1)), tower: Math.max(0, sg.tower ?? 0), ...(sg.name ? { name: sg.name } : {}) } } : {}),
    level, ...(opts.len ? { len: opts.len } : {}), tempo: board ? tacTempo(level) * (a.human && b.human ? 1 : tacNpc(level)) : 1,
    blast: board ? Math.min(TAC_LEN.blastMax, tacTempo(level)) * (a.human && b.human ? 1 : tacNpc(level)) : 1,
    ...(board && !land && !opts.arena && level >= TAC_LEN.flag.level ? { flag: { hex: [tacFlagHex(0), tacFlagHex(1)] as [number, number], held: [0, 0] as [number, number], open: [false, false] as [boolean, boolean] } } : {}),
  };
  // docs/25 item 48: a captain's chess clock over a boarding (the sea's mind keeps none).
  if (board) for (const [x, h] of [[a, 0], [b, 1]] as const) if (x.human) bt.heroes[h].bank = tacBankSecs(level);
  // The flag's hex is kept clear of what the guns left (a hole or a fire on it).
  if (bt.flag) for (const i of bt.flag.hex) if (bt.cells[i] === 'H' || bt.cells[i] === 'F') bt.cells[i] = '.';
  // docs/25 item 64: the allies of each side who came with the grapples (her group's mates within TAC_GROUP.range).
  for (const x of opts.allies ?? []) addAlly(bt, x.side, x.input, x.grow ?? false, x.tag);
  // docs/25 item 55: against an army half as large again as hers, her ultimate from the first round.
  for (const x of [0, 1] as const) if (sideStrength(bt, (1 - x) as 0 | 1) >= ULT_EARLY * sideStrength(bt, x)) for (const h of sideHeroes(bt, x)) h.ultFrom = 1;
  // The ship's broadside before the assault: its balls on the wall, the gate and the towers.
  if (sg) for (let k = 0; k < Math.max(0, Math.min(8, Math.round(sg.bombard ?? 0))); k++) siegeStone(bt, rng, 'gun');
  checkOver(bt);
  if (!bt.over) newRound(bt, now, rng);
  return bt;
}

// ------------------------------------------------------------------ a group aboard (docs/25 block Е)

/** Every captain on the field: the two sides' own, then the allies. */
export function heroesAll(bt: TacBattle): TacHero[] {
  return bt.allies?.length ? [...bt.heroes, ...bt.allies.map((x) => x.hero)] : bt.heroes;
}
/** The captains of one side: her own first, then her allies. */
export function sideHeroes(bt: TacBattle, side: 0 | 1): TacHero[] {
  return [bt.heroes[side], ...(bt.allies ?? []).filter((x) => x.side === side).map((x) => x.hero)];
}
export function allyOf(bt: TacBattle, side: 0 | 1, slot: number): TacAlly | undefined {
  return slot > 0 ? bt.allies?.find((x) => x.side === side && x.slot === slot) : undefined;
}
/** The captain of side `side` at `slot` (0: the side's own). */
export function heroAt(bt: TacBattle, side: 0 | 1, slot: number): TacHero {
  return allyOf(bt, side, slot)?.hero ?? bt.heroes[side];
}
/** The captain whose stack she is: her blows carry her captain's ladder, power and skills, her turns her clock. */
export const capOf = (bt: TacBattle, s: TacStack): TacHero => heroAt(bt, s.side, s.own ?? 0);
/** Captains of a side on the field. */
export const captainsOn = (bt: TacBattle, side: 0 | 1): number => 1 + (bt.allies ?? []).filter((x) => x.side === side).length;

/** docs/25 items 64–65: an allied captain's order or path move, given as hers — her will and stamina, her book, her
 *  path and its power, once a round for her; what it lays falls on her whole side (the side's list is hers too), the
 *  side's heart and free blows are the side's; what it cuts down is counted to her (item 67). */
function asCaptain<T>(bt: TacBattle, side: 0 | 1, slot: number, fn: () => T): T {
  const ally = allyOf(bt, side, slot);
  if (!ally) return fn();
  const main = bt.heroes[side], h = ally.hero;
  h.fx = main.fx;
  h.morale = main.morale;
  h.free = main.free;
  if (main.hush !== undefined) h.hush = main.hush;
  const was = bt.casting;
  bt.heroes[side] = h;
  bt.casting = slot;
  try {
    return fn();
  } finally {
    bt.heroes[side] = main;
    if (was === undefined) delete bt.casting;
    else bt.casting = was;
    main.fx = h.fx;
    main.morale = h.morale;
    main.free = h.free;
  }
}

/** docs/25 item 64: the stacks an ally brings come aboard on her side's back rows — the rail column (between the side's
 *  shooters), then the next column in, amidships first; never on a fire, a hole, a plank or a flag. A side of seven
 *  stacks has nine hexes on its rail and nine in the next column: two allies' four stacks always find room. */
const ALLY_ROWS = [4, 2, 6, 3, 5, 1, 7, 0, 8];
function placeAllies(bt: TacBattle, side: 0 | 1, stacks: TacStack[]): void {
  const flags: number[] = bt.flag ? [...bt.flag.hex] : [];
  const taken = new Set(bt.stacks.filter((s) => s.count > 0).map((s) => s.hex));
  const free = (i: number) => !TAC_BLOCKING.has(bt.cells[i]) && bt.cells[i] !== 'F' && bt.cells[i] !== '=' && !flags.includes(i) && !taken.has(i)
    && !(bt.siege && side === 0 && hexX(i) >= SIEGE.moatX);
  for (const s of stacks) {
    s.hex = -1;
    for (let x = 0; x < TAC_GAP && s.hex < 0; x++) for (const y of ALLY_ROWS) {
      const l = hexIndex(x, y);
      const i = side ? hexMirror(l) : l;
      if (i < 0 || i >= bt.cells.length || !free(i)) continue;
      s.hex = i;
      taken.add(i);
      break;
    }
    if (s.hex < 0) s.hex = place(bt.cells, taken, 0, 4, side);
    s.face = side ? 3 : 0;
  }
}

/** docs/25 item 64: an allied captain comes aboard side `side` with the stacks of her own army she brought (at most
 *  TAC_GROUP.bring): on her side's back rows, her primaries on them, her clock her share of the side's (by the stacks
 *  each captain plays: a side's clock stays one captain's), the battle's pace lifted for the group (TAC_GROUP.pace), the
 *  other side grown (item 66 — `grow`: true for the sea's ships, the legends, the raid and a citadel: by the strength she
 *  brought, TAC_GROUP.foe; a number: by that; false between captains). `tag`: whose she is to the server. Returns her
 *  slot, or why not. */
export function addAlly(bt: TacBattle, side: 0 | 1, input: TacSideInput, grow: boolean | number = false, tag?: number): number | string {
  const mine = (bt.allies ?? []).filter((x) => x.side === side);
  if (mine.length + 1 >= TAC_GROUP.side) return 'Three captains a side at the most';
  const slot = mine.length ? Math.max(...mine.map((x) => x.slot)) + 1 : 1;
  const first = bt.stacks.reduce((n, s) => Math.max(n, s.id), 0) + 1;
  const stacks = buildStacks({ ...input, officers: [] }, side, [...bt.cells], first).slice(0, tacBring(bt.level));
  if (!stacks.length) return 'She brings no men';
  if (bt.land) for (const s of stacks) {
    s.sp = s.sp.filter((x) => x !== 'blast');
    s.dmgMul = 1;
  }
  const sideStacks = bt.stacks.filter((s) => s.side === side && s.count > 0).length;
  const s0 = grow === true ? sideStrength(bt, side) : 0;
  placeAllies(bt, side, stacks);
  for (const s of stacks) s.own = slot;
  const main = bt.heroes[side];
  const hero = newHero(input, stacks);
  hero.fx = main.fx;
  hero.ultFrom = main.ultFrom;
  // The side's own captain's orders stay reckoned from her own men (the allies' are not hers).
  if (main.input.spellHp === undefined) main.input = { ...main.input, spellHp: main.startHp };
  main.startHp += hero.startHp;
  main.startMen += hero.startMen;
  // docs/25 item 48: the side's chess clock shared by the stacks each captain plays.
  if (bt.len === 'board') {
    const all = sideStacks + stacks.length;
    for (const h of sideHeroes(bt, side)) if (h.bank >= 0) h.bank = Math.round(h.bank * (sideStacks / Math.max(1, all)) * 10) / 10;
    if (input.human) hero.bank = Math.round(tacBankSecs(bt.level) * (stacks.length / Math.max(1, all)) * 10) / 10;
  }
  bt.stacks.push(...stacks);
  (bt.allies ??= []).push({ side, slot, hero, joined: Math.max(1, bt.round), ...(tag !== undefined ? { tag } : {}) });
  // A group's pace: its rounds fewer, so its many stacks keep the boarding's length (a legend's, the raid's and a
  // citadel's are long by design and keep theirs).
  if (bt.len === 'board') {
    const n = bt.allies.length, sea = !(bt.heroes[0].input.human && bt.heroes[1].input.human);
    const k = tacGroupPace(bt.level, n, sea) / tacGroupPace(bt.level, n - 1, sea);
    bt.tempo *= k;
    bt.blast *= k;
    bt.groupPace = tacGroupPace(bt.level, n, sea);
  }
  // docs/25 item 66: the strength she brought, by the square law (her book and path `order` on top of it).
  growSide(bt, (1 - side) as 0 | 1, grow === true ? foeGrowth(bt.level, sideStrength(bt, side) / Math.max(1e-9, s0)) : typeof grow === 'number' ? grow : 1);
  setRoles(bt, side);
  if (bt.round > 0) push(bt, { k: 'join', side, n: slot, on: stacks.map((s) => s.id) });
  return slot;
}

/** docs/25 item 66: what a group's foe of the sea grows by as an ally comes aboard her side, which grew `ratio` times by
 *  the square law (TAC_GROUP.foe: that share of the growth, and `order` more for her book and path). */
export function foeGrowth(level: number, ratio: number): number {
  return (1 + Math.max(0, ratio - 1) * tacLevel(TAC_GROUP.foe.share, Math.max(1, level))) * (1 + tacLevel(TAC_GROUP.foe.order, Math.max(1, level)));
}

/** docs/25 item 65: the paths a side fights with as a group (none for a captain alone): each once. */
export function rolesOf(bt: TacBattle, side: 0 | 1): CaptainId[] {
  if (captainsOn(bt, side) < 2) return [];
  const out: CaptainId[] = [];
  for (const h of sideHeroes(bt, side)) {
    const p = h.input.hero?.path;
    if (p && TAC_ROLES[p] && !out.includes(p)) out.push(p);
  }
  return out;
}
/** docs/25 item 65: the roles a side's paths lay on her stacks and on the other side's, while the battle lasts. */
function setRoles(bt: TacBattle, side: 0 | 1): void {
  const h = bt.heroes[side];
  keepFx(h, (f) => !f.id.startsWith('role:'));
  for (const p of rolesOf(bt, side)) {
    const r = TAC_ROLES[p];
    if (r.self) h.fx.push({ id: `role:${p}`, until: 1e9, mods: r.self });
    if (r.foe) h.fx.push({ id: `role:${p}:foe`, until: 1e9, mods: r.foe, foe: true });
  }
}

/** docs/25 item 64: an ally arriving mid-battle comes aboard as the next round opens, up to round TAC_GROUP.late. */
export function queueAlly(bt: TacBattle, side: 0 | 1, input: TacSideInput, grow: boolean | number = false, tag?: number): string | null {
  if (bt.over) return 'The fight is over';
  if (bt.round + 1 > TAC_GROUP.late) return 'Allies come aboard up to round 3';
  const n = (bt.allies ?? []).filter((x) => x.side === side).length + (bt.joinQ ?? []).filter((x) => x.side === side).length;
  if (n + 1 >= TAC_GROUP.side) return 'Three captains a side at the most';
  if (tag !== undefined && ((bt.allies ?? []).some((x) => x.tag === tag) || (bt.joinQ ?? []).some((x) => x.tag === tag))) return 'She is aboard already';
  (bt.joinQ ??= []).push({ side, input, grow, ...(tag !== undefined ? { tag } : {}) });
  return null;
}

/** docs/25 item 66: a side grown by `k` against a group — each living stack's men, now and as she came aboard (her
 *  captain's orders with them, reckoned from her side's hit points unless she brings her own). The server takes the
 *  grown men back out of her losses (`boost`, `grown`): her ship's army is not grown. */
export function growSide(bt: TacBattle, side: 0 | 1, k: number): void {
  if (!(k > 1)) return;
  const h = bt.heroes[side];
  for (const s of bt.stacks) {
    if (s.side !== side || s.count <= 0) continue;
    const add = Math.round(s.count * (k - 1)), more = Math.round(s.start * (k - 1));
    if (add > 0) {
      s.count += add;
      (bt.grown ??= []).push({ id: s.id, n: add });
    }
    s.start += more;
    s.boost = (s.boost ?? 0) + more;
    h.startHp += more * s.hpMax;
    h.startMen += more;
  }
  (bt.boost ??= [1, 1])[side] *= k;
}

/** docs/25 item 67: each captain's share of what her side cut down (slot → share; 0: the side's own captain). */
export function sharesOf(bt: TacBattle, side: 0 | 1): Map<number, number> {
  const slots = [0, ...(bt.allies ?? []).filter((x) => x.side === side).map((x) => x.slot)];
  const cut = slots.map((sl) => bt.dealt?.[`${side}:${sl}`] ?? 0);
  const total = cut.reduce((n, x) => n + x, 0);
  return new Map(slots.map((sl, i) => [sl, total > 0 ? cut[i] / total : sl === 0 ? 1 : 0]));
}

// ------------------------------------------------------------------ the siege (docs/19 E5)

/** A row of the wall line brought to `hp` stones, and its cell with it. */
function setWall(bt: TacBattle, y: number, hp: number): void {
  const sg = bt.siege!;
  sg.hp[y] = Math.max(0, hp);
  bt.cells[hexIndex(SIEGE.wallX, y)] = siegeCell(siegePart(y), sg.hp[y], sg.max[y]);
}

/** The row the besiegers' stones are laid on (-1: nothing left standing): the gate first, then what is closest to
 *  falling, the stones nearest the gate before the far ones; the towers after the segments beside the gate. */
export function siegeAim(bt: TacBattle, rng: Rng | null): number {
  const sg = bt.siege;
  if (!sg) return -1;
  let best = -1, bs = Infinity;
  for (let y = 0; y < TAC_H; y++) {
    if (sg.hp[y] <= 0) continue;
    const part = siegePart(y);
    const score = sg.hp[y] * 10 + (part === 'gate' ? -1 : part === 'tower' ? 2.5 : Math.abs(y - SIEGE.gateY)) + (rng ? rng.float() * 0.4 : 0);
    if (score < bs) {
      bs = score;
      best = y;
    }
  }
  return best;
}

/** One stone of the catapult (or one ball of the ship's broadside before the assault) at the wall line. */
function siegeStone(bt: TacBattle, rng: Rng, id: 'catapult' | 'gun'): void {
  const y = siegeAim(bt, rng);
  if (y < 0) return;
  const hit = rng.chance(SIEGE.hit);
  if (hit) setWall(bt, y, bt.siege!.hp[y] - 1);
  push(bt, { k: 'siege', side: 0, id, hex: hexIndex(SIEGE.wallX, y), dmg: hit ? 1 : 0, n: bt.siege!.hp[y] });
}

/** A tower's shot at one of her stacks (rng null: the expected one): the tower's own strength against the stack's
 *  defence (the garrison's captain's Attack in its aim), her captain's armour, a shield or a shell, what the moves lay. */
export function towerShot(bt: TacBattle, t: TacStack, shot: number, rng: Rng | null): number {
  const h0 = bt.heroes[t.side].input.hero, h1 = bt.heroes[1 - t.side].input.hero;
  const a = 10 + (h1?.atk ?? 0);
  // docs/25 items 45 and 47: the moat and the stance on the stack's own Defense; all that guards her at most halves it.
  const rules = boardRules(bt);
  const heroDef = rules ? Math.min(t.def, h0?.def ?? 0) : 0;
  const d = (t.def - heroDef) * (bt.cells[t.hex] === 'O' ? SIEGE.moatDef : 1) * (t.defending ? 1.3 : 1) + heroDef;
  const m = smods(bt, t);
  const took = 1 + m.taken + m.shotTaken;
  let mul: number;
  if (rules) {
    const mod = adMod(a, d);
    let guard = Math.min(1, mod);
    if (h0) guard *= 1 - h0.taken;
    if (took < 1) guard *= Math.max(0.1, took);
    mul = Math.max(1, mod) * Math.max(1, took) * Math.max(TAC_GUARD_MIN, guard);
  } else mul = adModOld(a, d) * (h0 ? 1 - h0.taken : 1) * Math.max(0.1, took);
  if (sp(t, 'shield_wall')) mul *= 0.5;
  if (sp(t, 'shell')) mul *= 0.38;
  return Math.max(1, Math.round(shot * mul * (rng ? 0.85 + rng.float() * 0.3 : 1)));
}

/** A round of the siege opens: the catapult's stones, then each standing tower shoots her stack most worth it. */
function siegeRound(bt: TacBattle, rng: Rng): void {
  const sg = bt.siege!;
  for (let k = 0; k < sg.catapult && alive(bt).some((s) => s.side === 0); k++) siegeStone(bt, rng, 'catapult');
  for (const y of SIEGE.towers) {
    if (sg.hp[y] <= 0 || sg.tower <= 0) continue;
    const foes = alive(bt).filter((o) => o.side === 0);
    if (!foes.length) return;
    const shot = sg.tower * (sg.hp[y] < sg.max[y] ? SIEGE.cracked : 1);
    let best = foes[0], bv = -1;
    for (const t of foes) {
      const v = valueOf(bt, t, towerShot(bt, t, shot, null));
      if (v > bv) {
        bv = v;
        best = t;
      }
    }
    const dmg = towerShot(bt, best, shot, rng);
    const kills = hurt(bt, best, dmg, 1);
    wake(bt, best);
    push(bt, { k: 'siege', side: 1, id: 'tower', n: hexIndex(SIEGE.wallX, y), t: best.id, hex: best.hex, dmg, kills });
    checkOver(bt);
    if (bt.over) return;
  }
}

/** The wall line as the battle left it (stones left in each row), for the next assault of the siege. */
export function siegeLeft(bt: TacBattle): number[] | null {
  return bt.siege ? [...bt.siege.hp] : null;
}

/** docs/19 E5: steps from each hex to the nearest hex beside a stack of the other side, round the walls (the stacks
 *  aside - they move; the moat three steps, as it stops whoever steps in; the gate the garrison's alone). */
function siegeDist(bt: TacBattle, s: TacStack): Map<number, number> {
  const fly = sp(s, 'flying');
  const ground = (i: number) => {
    const c = bt.cells[i];
    if (c === '#') return false;
    // docs/25: the way round the deck for the sea's mind anywhere (a creature that dives goes through the surf).
    if (c === 'F' && !fly && onDeck(bt)) return false; // docs/25 item 62: the fire splits the deck
    return fly || !TAC_BLOCKING.has(c) || (s.side === 1 && isGateCell(c)) || (c === 'W' && sp(s, 'diving'));
  };
  const out = new Map<number, number>();
  const buckets: number[][] = [[]];
  for (const o of alive(bt)) {
    if (o.side === s.side) continue;
    for (const j of hexNeighbors(o.hex)) if (ground(j) && !out.has(j)) {
      out.set(j, 0);
      buckets[0].push(j);
    }
  }
  for (let d = 0; d < buckets.length; d++) {
    for (const i of buckets[d] ?? []) {
      if (out.get(i) !== d) continue;
      for (const j of hexNeighbors(i)) {
        if (!ground(j)) continue;
        const nd = d + (bt.cells[j] === 'O' && !fly ? 3 : 1);
        if (nd >= (out.get(j) ?? Infinity)) continue;
        out.set(j, nd);
        (buckets[nd] ??= []).push(j);
      }
    }
  }
  return out;
}

/** The sea's mind in a siege when no foe is in reach: the garrison keeps within its walls (one gone out comes back);
 *  the besiegers walk round the walls to the way in - or, while there is none, wait before the moat over against the
 *  stone the catapult is working on. */
function siegeMove(bt: TacBattle, s: TacStack, reach: Map<number, number>): TacAction {
  if (s.side === 1) {
    if (insideWalls(s.hex) || hexX(s.hex) === SIEGE.wallX) return { a: 'defend' };
    let to: number | null = null, td = Infinity;
    for (const [h, d] of reach) if ((insideWalls(h) || hexX(h) === SIEGE.wallX) && d < td) {
      td = d;
      to = h;
    }
    return to === null ? { a: 'defend' } : { a: 'move', to };
  }
  const dist = siegeDist(bt, s);
  const here = dist.get(s.hex) ?? Infinity;
  let to: number | null = null, td = here;
  for (const [h] of reach) {
    const d = dist.get(h) ?? Infinity;
    if (d < td || (d === td && to !== null && bt.cells[h] !== 'O' && bt.cells[to] === 'O')) {
      td = d;
      to = h;
    }
  }
  if (to !== null && td < Infinity) return { a: 'move', to };
  if (here < Infinity) return { a: 'defend' };
  // No way in yet: before the moat, over against the stone the catapult works on (a flier never waits: it has gone over).
  const y = Math.max(0, siegeAim(bt, null));
  const at = hexIndex(SIEGE.moatX - 1, y);
  const far = (h: number) => hexDist(h, at) + (hexX(h) >= SIEGE.moatX ? 99 : 0);
  let best: number | null = null, bd = far(s.hex);
  for (const [h] of reach) if (far(h) < bd) {
    bd = far(h);
    best = h;
  }
  return best === null ? { a: 'defend' } : { a: 'move', to: best };
}

// ------------------------------------------------------------------ what a stack is worth right now

const alive = (bt: TacBattle) => bt.stacks.filter((s) => s.count > 0);
export const stackById = (bt: TacBattle, id: number): TacStack | undefined => bt.stacks.find((s) => s.id === id && s.count > 0);
const has = (h: TacHero, id: string, round: number) => h.fx.some((f) => f.id === id && f.until >= round);
/** docs/25 item 70: how strong an order of hers holds now (0: it does not; her own order by ORDER_KNOBS, else 1). */
const held = (h: TacHero, id: string, round: number) => h.fx.reduce((n, f) => (f.id === id && f.until >= round ? Math.max(n, f.k ?? 1) : n), 0);
/** docs/25 item 70: how strong a captain gives an order — her own order (TAC_SIGNATURE) in a ship's boarding by her
 *  path's knob at her level (ORDER_KNOBS), every other order and every other battle as before. */
export function orderK(bt: TacBattle, side: 0 | 1, id: TacSpellId): number {
  const hb = bt.heroes[side].input.hero;
  if (bt.len !== 'board' || !hb?.path || TAC_SIGNATURE[hb.path] !== id) return 1;
  return orderPower(hb.path, hb.level ?? 1);
}
const sideHas = (bt: TacBattle, side: 0 | 1, x: UnitSpecial) => bt.stacks.some((s) => s.side === side && s.count > 0 && sp(s, x));

/** What the moves of both captains lay on a stack now (docs/18): her own side's that hold for all of hers or for
 *  her, and the other side's laid on hers or on her. `id` absent: what lies on the whole side. */
export interface StackMods {
  melee: number;
  shot: number;
  taken: number;
  shotTaken: number;
  speed: number;
  init: number;
  morale: number;
  luck: number;
  blind: boolean;
  noRet: boolean;
  noAnswer: boolean;
  steady: boolean;
  still: boolean;
  mad: boolean;
}
export function modsOf(bt: TacBattle, side: 0 | 1, id?: number): StackMods {
  const out: StackMods = { melee: 0, shot: 0, taken: 0, shotTaken: 0, speed: 0, init: 0, morale: 0, luck: 0, blind: false, noRet: false, noAnswer: false, steady: false, still: false, mad: false };
  const r = bt.round;
  const add = (m: BtMods) => {
    out.melee += m.melee ?? 0;
    out.shot += m.shot ?? 0;
    out.taken += m.taken ?? 0;
    out.shotTaken += m.shotTaken ?? 0;
    out.speed += m.speed ?? 0;
    out.init += m.init ?? 0;
    out.morale += m.morale ?? 0;
    out.luck += m.luck ?? 0;
    if (m.blind) out.blind = true;
    if (m.noRet) out.noRet = true;
    if (m.noAnswer) out.noAnswer = true;
    if (m.steady) out.steady = true;
    if (m.still) out.still = true;
    if (m.mad) out.mad = true;
  };
  for (const k of [0, 1] as const) {
    const foe = k !== side;
    for (const f of bt.heroes[k].fx) {
      if (!f.mods || !!f.foe !== foe || f.until < r) continue;
      if (f.on !== undefined && f.on !== id) continue;
      if (id !== undefined && f.res?.includes(id)) continue;
      add(f.mods);
    }
  }
  return out;
}
const smods = (bt: TacBattle, s: TacStack) => modsOf(bt, s.side, s.id);

/** Morale points −3..+3: the crew's heart, the orders that steady or shake it, a guard of officers among them. */
export function moralePoints(bt: TacBattle, side: 0 | 1): number {
  const h = bt.heroes[side], e = bt.heroes[1 - side];
  let m = Math.round((h.morale - 50) / 16);
  if (has(h, 'steady', bt.round) || has(h, 'iron_discipline', bt.round)) m++;
  if (has(h, 'war_cry', bt.round)) m++;
  if (has(e, 'red_harvest', bt.round) || has(e, 'call_of_the_deep', bt.round) || has(e, 'war_cry', bt.round)) m--;
  if (sideHas(bt, side, 'leader')) m++;
  // The hero's Leadership and artifacts; the other captain's Dread and Maelstrom.
  m += h.input.hero?.morale ?? 0;
  if (has(e, 'dread', bt.round)) m -= 2;
  if (has(e, 'maelstrom', bt.round)) m--;
  // docs/18 #38: the peoples of a mixed army.
  m += h.input.mixed ?? 0;
  // The paths' moves (docs/18): the Line, the howl, false colours — over the ±3 her skills and artifacts reach (docs/25
  // items 59–61: from level 20 a captain's Leadership and kit hold her at +3, and a page's point was lost on it).
  return Math.max(-TAC_MOVE_POINTS, Math.min(TAC_MOVE_POINTS, Math.max(-3, Math.min(3, m)) + modsOf(bt, side).morale));
}
/** docs/25 items 59–61: the morale and luck the moves laid on the deck may lift a side to (or sink her to), past the ±3
 *  of her skills and artifacts. */
export const TAC_MOVE_POINTS = 5;

/** A side's luck: her officers' and her captain's, and a point more while a luck-bringer of hers stands (docs/18 VII). */
export function luckOf(bt: TacBattle, side: 0 | 1): number {
  return Math.max(-3, Math.min(3, bt.heroes[side].luck + (sideHas(bt, side, 'fortune') ? 1 : 0)));
}

/** The morale one stack fights with: the dead feel none, the steady never break. */
export function stackMorale(bt: TacBattle, s: TacStack): number {
  if (sp(s, 'undead')) return 0;
  const m = moralePoints(bt, s.side);
  return sp(s, 'steady') || smods(bt, s).steady ? Math.max(0, m) : m;
}

function speedOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side], e = bt.heroes[1 - s.side];
  const v = s.speed + (has(h, 'turn_the_flank', bt.round) || has(h, 'all_hands', bt.round) ? 1 : 0) + (has(h, 'following_wind', bt.round) ? 1 : 0) + smods(bt, s).speed;
  return Math.max(1, v - (has(e, 'head_wind', bt.round) ? 1 : 0));
}

function initOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side], e = bt.heroes[1 - s.side];
  const flank = held(h, 'turn_the_flank', bt.round);
  return s.init + (flank ? Math.max(1, Math.round(3 * flank)) : 0) + (has(h, 'all_hands', bt.round) ? 2 : 0) + (has(h, 'following_wind', bt.round) ? 2 : 0)
    - (has(e, 'head_wind', bt.round) ? 2 : 0) + (bt.round <= 1 ? capOf(bt, s).input.hero?.init1 ?? 0 : 0) + smods(bt, s).init;
}

/** A hex a stack may stand on: no obstacle (the surf only for a creature that dives, docs/18 II) and nobody there. */
const passable = (bt: TacBattle, i: number, self: TacStack | null) => (!TAC_BLOCKING.has(bt.cells[i]) || (bt.cells[i] === 'W' && !!self && sp(self, 'diving'))
  || (isGateCell(bt.cells[i]) && !!self && self.side === 1)) && !(bt.cells[i] === 'F' && onDeck(bt)) && !bt.stacks.some((s) => s.count > 0 && s !== self && s.hex === i); // docs/19 E5: the gate opens for the garrison
/** docs/25 item 62: a ship's deck in a boarding (not the sand ashore, a siege's ground or the Colosseum's; and not a
 *  battle of no length — the tests' bare armies and the land's reckoning, calibrated on the old deck): its fires split
 *  it (no way through the flames; a stack caught in one walks out of it), its mast, barrels, crates and guns cover from
 *  shots, its planks are a narrow pass. */
export const onDeck = (bt: TacBattle): boolean => bt.len !== undefined && !bt.land && !bt.siege && !bt.arena;
/** docs/25 item 62: the cover a stack on `hex` has on a deck from a shot out of `from` (−1: none). */
export function coverAt(bt: TacBattle, hex: number, from: number): number {
  return onDeck(bt) ? deckCover(bt.cells, hex, from) : -1;
}
/** docs/25 item 56: the share of the captains' orders and path pages a stack shrugs off — in a boarding (a ship's, a
 *  legend's, the raid's, a siege's); the land's fights keep the reckoning their great ones are calibrated on. */
export function resistOf(bt: TacBattle, s: TacStack): number {
  return boardRules(bt) ? Math.max(unitResist(s.unit), capOf(bt, s).input.resist ?? 0) : 0;
}

/** Steps to every hex the stack can reach this turn (by the path around obstacles and stacks). A creature that flies
 *  goes over them (docs/18 II), landing where it may; one that dives goes into the surf and comes out of it anywhere
 *  along the shore (the surf is one water). */
export function reachOf(bt: TacBattle, s: TacStack): Map<number, number> {
  const out = new Map<number, number>();
  const spd = speedOf(bt, s);
  const seen = new Map<number, number>([[s.hex, 0]]);
  const fly = sp(s, 'flying'), dive = sp(s, 'diving') && !!bt.land;
  let surfed = false;
  let frontier = [s.hex];
  for (let d = 1; d <= spd && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      // docs/19 E5: whoever steps into the moat stops there (a flier goes over it).
      if (i !== s.hex && !fly && bt.cells[i] === 'O') continue;
      for (const j of hexNeighbors(i)) {
        if (seen.has(j)) continue;
        const ok = passable(bt, j, s);
        if (!ok && !(fly && bt.cells[j] !== '#')) continue;
        seen.set(j, d);
        if (ok) out.set(j, d);
        next.push(j);
        if (dive && !surfed && ok && bt.cells[j] === 'W') {
          surfed = true;
          for (let k = 0; k < bt.cells.length; k++) {
            if (bt.cells[k] !== 'W' || seen.has(k) || !passable(bt, k, s)) continue;
            seen.set(k, d);
            out.set(k, d);
            next.push(k);
          }
        }
      }
    }
    frontier = next;
  }
  return out;
}

const enemiesAdjacent = (bt: TacBattle, s: TacStack, at = s.hex) => alive(bt).filter((o) => o.side !== s.side && hexNeighbors(at).includes(o.hex));

/** May the stack shoot: shots loaded and no foe at arm's length. */
export function canShoot(bt: TacBattle, s: TacStack): boolean {
  return s.shots > 0 && enemiesAdjacent(bt, s).length === 0 && !smods(bt, s).blind;
}

/** The hex it would strike `t` from: where it stands if alongside, else the nearest reachable one beside her. */
function strikeFrom(bt: TacBattle, s: TacStack, t: TacStack, reach: Map<number, number>, want?: number): number | null {
  const around = hexNeighbors(t.hex);
  if (want !== undefined) return (want === s.hex || reach.has(want)) && around.includes(want) ? want : null;
  if (around.includes(s.hex)) return s.hex;
  let best: number | null = null, bd = Infinity;
  for (const h of around) {
    const d = reach.get(h);
    if (d !== undefined && (d < bd || (d === bd && bt.cells[h] !== 'F'))) {
      bd = d;
      best = h;
    }
  }
  return best;
}

export function meleeTargets(bt: TacBattle, s: TacStack, reach = reachOf(bt, s)): TacStack[] {
  return alive(bt).filter((t) => t.side !== s.side && strikeFrom(bt, s, t, reach) !== null);
}

// ------------------------------------------------------------------ blows

function rollBase(s: TacStack, rng: Rng | null): number {
  if (!rng) return (s.count * (s.dmin + s.dmax)) / 2;
  if (s.count <= 12) {
    let n = 0;
    for (let i = 0; i < s.count; i++) n += rng.int(s.dmin, s.dmax);
    return n;
  }
  return ((s.count * (s.dmin + s.dmax)) / 2) * (0.9 + rng.float() * 0.2);
}

/** Backs to the rail (docs/17 H5): a side whose living strength on deck (hit points) is less than the other's strikes
 *  harder — by TAC_DESPERATION of the shortfall, up to TAC_DESPERATION_MAX. HoMM3's square law left a tenth fewer
 *  men a lost fight nine times in ten; with it, seven in ten. (After H5 the sea's pirates carry more shooters, whose
 *  fights are steeper: twice the shortfall, to 40%, keeps the tenth fewer at seven in ten.) */
export const TAC_DESPERATION = 2;
export const TAC_DESPERATION_MAX = 0.4;

export function desperation(bt: TacBattle, side: 0 | 1): number {
  let mine = 0, foe = 0;
  for (const o of bt.stacks) {
    if (o.count <= 0) continue;
    if (o.side === side) mine += hpOf(o);
    else foe += hpOf(o);
  }
  if (mine >= foe || foe <= 0) return 1;
  return 1 + Math.min(TAC_DESPERATION_MAX, TAC_DESPERATION * (1 - mine / foe));
}

/** What a blow (or a shot, or an answer) of `s` on `t` is made of before the dice: her attack against the other's
 *  defence (`mod`), every multiplier laid on it (`mul`), the luck that may double it (points), and whether it comes
 *  into the other's side or from behind (`flank`). The blow itself and the captain's preview of it (previewBlow) are
 *  both reckoned from it, so the two cannot part. */
export interface BlowParts {
  mod: number;
  mul: number;
  luck: number;
  flank: 0 | 1 | 2;
}

/** docs/25 item 45 (HoMM3's own): her Attack over the other's Defense lands TAC_AD.up a point harder, up to TAC_AD.max
 *  more; under it TAC_AD.down a point lighter, down to TAC_AD.min. (Before: to ×3 and down to ×0.3 — the hero's
 *  primaries, two to ten times the men's own at level 60, decided everything.) */
export const TAC_AD = { up: 0.05, max: 1, down: 0.025, min: 0.5 };
/** docs/25 item 47: all that guards a stack (her Defense, her captain's armour, the moves that shield her) together
 *  takes at most half of a blow. */
export const TAC_GUARD_MIN = 0.5;

/** Her Attack against the other's Defense (item 45). */
export function adMod(a: number, d: number): number {
  return a >= d ? 1 + Math.min(TAC_AD.max, TAC_AD.up * (a - d)) : Math.max(TAC_AD.min, 1 - TAC_AD.down * (d - a));
}
/** The old reckoning of it (the land's fights, calibrated on it: the lairs, the roamers, the guards, the great ones
 *  ashore): +5% a point to ×3, down as 1/(1 + 5% a point) to ×0.3. */
export function adModOld(a: number, d: number): number {
  return Math.max(0.3, Math.min(3, a >= d ? 1 + 0.05 * (a - d) : 1 / (1 + 0.05 * (d - a))));
}
/** docs/25 items 45–47 hold in a boarding (a ship's, the Colosseum's, a siege's, the raid's, a legend's: every battle
 *  with a length); the land's fights keep the reckoning they were calibrated on. */
export const boardRules = (bt: TacBattle): boolean => bt.len !== undefined;

export function blowParts(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot' | 'ret', from = s.hex): BlowParts {
  // docs/25 item 64: an ally's stack strikes with her captain's ladder, power and skills, and is guarded by them.
  const h = capOf(bt, s), e = capOf(bt, t);
  const r = bt.round;
  // docs/25 item 47: the defending stance, the castle, Iron Discipline, the Shield Wall and the moat lift (or sink) the
  // stack's own Defense — not her captain's, which every stack of hers carries (they cost the attacker up to −68% on top
  // of it, and in a siege 99% of the stacks sat on the old floor).
  const defMul = (t.defending ? 1.3 : 1) * (e.input.castle && t.side === 1 ? 1.25 : 1) * (1 + 0.4 * held(e, 'iron_discipline', r)) * (has(e, 'shield_wall', r) ? 1.3 : 1)
    * (bt.siege && bt.cells[t.hex] === 'O' ? SIEGE.moatDef : 1); // docs/19 E5: wet to the waist in the moat
  const rules = boardRules(bt);
  const heroDef = rules ? Math.min(t.def, e.input.hero?.def ?? 0) : 0;
  const a = s.atk, d = (t.def - heroDef) * defMul + heroDef;
  const mod = rules ? adMod(a, d) : adModOld(a, d);
  // What guards her (item 47): her Defense's share of the blow, her captain's armour and what the moves lay on her.
  let guard = rules ? Math.min(1, mod) : 1;
  let mul = h.input.dealt * h.input.power * (how === 'shot' ? 1 : h.input.melee) * s.dmgMul;
  // docs/25 items 44 and 51: a boarding's blows by its level, and harder from round 8 on.
  if (bt.len === 'board') mul *= bt.tempo * tacFatigue(r) * (r <= 1 ? tacOpen(bt.level) : 1);
  if (r === 1) mul *= h.input.firstRush * Math.max(0.2, 1 - e.input.nets);
  mul *= 1 + Math.min(0.2, h.kills * h.input.blooded);
  if (h.input.struck) mul *= 0.1;
  mul *= 1 + 0.25 * held(h, 'red_harvest', r);
  mul *= 1 + 0.15 * held(h, 'iron_discipline', r);
  mul *= Math.max(0.1, 1 - 0.5 * held(e, 'smoke_and_knives', r));
  if (h.fx.some((f) => f.id === 'mark_target' && f.on === t.id && f.until >= r)) mul *= 1.3;
  // The heroes' skills and artifacts (docs/17 H2): her blows and shots, the other's armour; Fury on the melee.
  const hb = h.input.hero, eb = e.input.hero;
  if (hb) mul *= 1 + (how === 'shot' ? hb.shot : hb.melee);
  if (eb) {
    if (rules) guard *= 1 - eb.taken;
    else mul *= 1 - eb.taken;
  }
  if (how !== 'shot' && has(h, 'fury', r)) mul *= 1.3;
  // The paths' moves on both (docs/18): her blows and shots, what the other takes.
  const ma = smods(bt, s), mt = smods(bt, t);
  mul *= Math.max(0.1, 1 + (how === 'shot' ? ma.shot : ma.melee));
  const took = 1 + mt.taken + (how === 'shot' ? mt.shotTaken : 0);
  // A move that lays more harm on her (a mark, a curse) is the attacker's; one that shields her is her guard.
  if (!rules) mul *= Math.max(0.1, took);
  else {
    if (took >= 1) mul *= took;
    else guard *= Math.max(0.1, took);
    // `mod` stays the blow's own (the dice are multiplied by it); its share of the guard is taken back out of `mul`.
    mul *= Math.max(TAC_GUARD_MIN, guard) / Math.min(1, mod);
  }
  if (how === 'shot') {
    if (hexDist(from, t.hex) > TAC_LONG_SHOT && !sp(s, 'no_penalty')) mul *= 0.5;
    if (has(h, 'lay_true', r)) mul *= 1.25;
    if (has(h, 'double_shot', r)) mul *= 1.3;
    if (sp(t, 'shield_wall')) mul *= 0.5;
    // docs/18 II: a shell, a diver under the surf, cover beside a rock or a palm.
    if (sp(t, 'shell')) mul *= 0.38;
    if (bt.cells[t.hex] === 'W') mul *= 0.5;
    if (bt.land && hexNeighbors(t.hex).some((j) => bt.cells[j] === 'R' || bt.cells[j] === 'P')) mul *= TAC_COVER;
    // docs/25 item 62: on a deck, the mast, a barrel, crates or a gun between her and the shooter.
    if (coverAt(bt, t.hex, from) >= 0) mul *= TAC_DECK_COVER;
    // docs/19 E5: a shot from without the walls at a stack within them.
    if (bt.siege && insideWalls(t.hex) && hexX(from) < SIEGE.wallX) mul *= SIEGE.cover;
  } else if (isShooter(s) && !sp(s, 'no_penalty')) mul *= 0.5; // a musket is a poor club
  // docs/18 II: a swarm's foes answer it half as hard.
  if (how === 'ret' && sp(t, 'swarm')) mul *= 0.5;
  // Flanking (owner, 2026-10-08: «удары сзади должны наносить больше урона»): the way she faces leaves her sides and
  // her back open — a blow into a side lands TAC_FLANK[1] harder, from behind TAC_FLANK[2]. (It took the place of the
  // old pincer, a fifth more on any foe another of ours stood beside: a stack hemmed in is struck from its sides and
  // back now, and the player sees which.) Turn the Flank (the navigator reads the deck) and a swarm (struck from every
  // side at once) keep the old fifth at the least. Her answer is the same from anywhere.
  // docs/25 item 62: a stack on a plank holds a narrow pass — the water on both sides, no way into her side or back.
  const flank = how === 'melee' && !(onDeck(bt) && bt.cells[t.hex] === '=') ? flankOf(t.face, t.hex, from) : 0;
  mul *= Math.max(TAC_FLANK[flank], how === 'melee' ? Math.max(sp(t, 'swarm') ? TAC_PINCER : 1, 1 + (TAC_PINCER - 1) * held(h, 'turn_the_flank', r)) : 1);
  // Backs to the rail (docs/17 H5): the side with less of her strength left on deck strikes harder by the shortfall —
  // a tenth fewer men is a hard fight, not a lost one.
  mul *= desperation(bt, s.side);
  return { mod, mul, luck: Math.max(-TAC_MOVE_POINTS, Math.min(TAC_MOVE_POINTS, luckOf(bt, s.side) + ma.luck)), flank };
}

/** Turn the Flank's and a swarm's blows: at least this much harder (the old pincer's fifth). */
export const TAC_PINCER = 1.2;

/** Damage `s` does to `t` (rng null: the expected blow, for the sea's mind); whether luck doubled it, and whether it
 *  came into her side or from behind. */
export function blow(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot' | 'ret', rng: Rng | null, from = s.hex): { dmg: number; lucky: boolean; flank: 0 | 1 | 2 } {
  const p = blowParts(bt, s, t, how, from);
  let mul = p.mul;
  const lucky = !!rng && rng.chance(p.luck * TAC_CHANCE_PER_POINT);
  if (lucky) mul *= 2;
  return { dmg: Math.max(1, Math.round(rollBase(s, rng) * p.mod * mul)), lucky, flank: p.flank };
}

/** Lay `dmg` on a stack: its foremost man's hit points, then whole men. Returns the fallen. */
function hurt(bt: TacBattle, t: TacStack, dmg: number, by: 0 | 1, who = bt.casting ?? 0): number {
  const before = t.count;
  const had = hpOf(t);
  const left = had - dmg;
  // docs/25 item 67: what each captain cut down (her blows, her stacks' shots, her orders and path moves).
  if (by !== t.side && had > 0) {
    const key = `${by}:${who}`;
    (bt.dealt ??= {})[key] = (bt.dealt[key] ?? 0) + Math.min(had, dmg);
  }
  if (left <= 0) {
    t.count = 0;
    t.hpTop = 0;
  } else {
    t.count = Math.ceil(left / t.hpMax);
    t.hpTop = left - (t.count - 1) * t.hpMax;
  }
  const kills = before - t.count;
  if (kills > 0) {
    bt.dead[t.side] += kills;
    heroAt(bt, by, who).kills += kills;
    const h = bt.heroes[t.side], k = bt.heroes[by];
    h.morale = Math.max(0, h.morale - (kills / Math.max(1, h.startMen)) * 70);
    k.morale = Math.min(100, k.morale + (kills / Math.max(1, h.startMen)) * 15);
  }
  if (t.count === 0) {
    bt.broken[t.side]++;
    push(bt, { k: 'die', side: t.side, s: t.id, hex: t.hex });
    if (t.officer) bt.hurt.push({ id: t.officer.id, side: t.side, heavy: true });
  } else if (t.officer && t.count <= t.start / 2 && !bt.hurt.some((x) => x.id === t.officer!.id)) bt.hurt.push({ id: t.officer.id, side: t.side, heavy: false });
  return kills;
}

/** A blow or a shot wakes a stack the Siren Song holds spellbound (true: it slept). */
function wake(bt: TacBattle, t: TacStack): boolean {
  let slept = false;
  for (const h of bt.heroes) {
    if (!h.fx.some((f) => f.on === t.id && f.mods?.still)) continue;
    keepFx(h, (f) => !(f.on === t.id && f.mods?.still));
    slept = true;
  }
  return slept;
}

function push(bt: TacBattle, e: Omit<TacEvent, 'i'>): void {
  // docs/25 item 64: what an ally gave is told as hers.
  bt.log.push({ i: ++bt.events, ...e, ...(bt.casting && e.who === undefined ? { who: bt.casting } : {}) });
  if (bt.log.length > 40) bt.log.splice(0, bt.log.length - 40);
  bt.seq++;
}

/** She turns to face `hex` from `from` (owner, 2026-10-08): the way she walked, struck or fired last. */
function turnTo(s: TacStack, hex: number, from = s.hex): void {
  const d = hexDir(from, hex);
  if (d >= 0) s.face = d;
}

/** A stack walks (or a flier glides) to `to`, `steps` hexes: she turns the way she went; the event tells the screens
 *  how long a walk to play (TAC_PACE). */
function walkTo(bt: TacBattle, s: TacStack, to: number, steps: number): void {
  turnTo(s, to);
  s.hex = to;
  push(bt, { k: 'move', side: s.side, s: s.id, hex: to, n: Math.max(1, steps), ...(sp(s, 'flying') ? { id: 'fly' } : {}) });
}

/** One blow and what it leaves. `force`: the harm it does, given (previewBlow tries the answers to each). */
function oneBlow(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng, k: 'hit' | 'ret', force?: number): void {
  const { dmg, lucky, flank } = force !== undefined ? { dmg: force, lucky: false, flank: 0 as const } : blow(bt, s, t, k === 'ret' ? 'ret' : 'melee', rng);
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const had = hpOf(t);
  const kills = hurt(bt, t, dmg, s.side, s.own ?? 0);
  if (wake(bt, t) && k === 'hit') t.ret = false; // caught asleep: no answer to the blow that wakes her
  push(bt, { k, side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex, ...(flank ? { fl: flank } : {}) });
  // docs/18 II: a poisonous bite stays in the living — a third of it again as each of her next two turns comes.
  if (sp(s, 'poison') && t.count > 0 && !sp(t, 'undead')) t.poison = { dmg: Math.max(1, Math.round(dmg * 0.3)), left: 2, by: s.side, ...(s.own ? { who: s.own } : {}) };
  afterHit(bt, s, t, had - hpOf(t), rng);
}

/** Strength back into one stack, up to what came aboard — its fallen stand again; how much. */
function restore(bt: TacBattle, x: TacStack, amount: number): number {
  const a = Math.min(x.start * x.hpMax - hpOf(x), Math.round(amount));
  if (a <= 0 || x.count <= 0) return 0;
  const tot = hpOf(x) + a;
  const was = x.count;
  x.count = Math.ceil(tot / x.hpMax);
  x.hpTop = tot - (x.count - 1) * x.hpMax;
  bt.dead[x.side] = Math.max(0, bt.dead[x.side] - (x.count - was));
  return a;
}

/** What a blow or a shot (an answer too) leaves beyond its harm (docs/18 VII): the drinker takes back half of what it
 *  did the living; the struck may be bound through its next turn (Siren Song's spell: a blow wakes it) or chilled. */
function afterHit(bt: TacBattle, s: TacStack, t: TacStack, dealt: number, rng: Rng): void {
  if (sp(s, 'drain') && !sp(t, 'undead') && s.count > 0) {
    const n = restore(bt, s, dealt * DRAIN_SHARE);
    if (n > 0) push(bt, { k: 'regen', side: s.side, s: s.id, dmg: n, hex: s.hex, id: 'drain' });
  }
  if (t.count <= 0) return;
  const h = bt.heroes[s.side];
  if (sp(s, 'bind') && !h.fx.some((f) => f.id === 'bind' && f.on === t.id) && rng.chance(BIND_CHANCE)) h.fx.push({ id: 'bind', until: bt.round + 1, on: t.id, foe: true, mods: { still: true } });
  if (sp(s, 'chill')) {
    keepFx(h, (f) => !(f.id === 'chill' && f.on === t.id));
    h.fx.push({ id: 'chill', until: bt.round + 1, on: t.id, foe: true, mods: { ...CHILL } });
  }
}

/** Half a blow on one more foe, unanswered (docs/18 VII): a breath on the one behind the struck stack, a chain on the
 *  most dangerous beside it. */
function spill(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot'): void {
  const near = alive(bt).filter((o) => o.side !== s.side && o !== t && hexNeighbors(t.hex).includes(o.hex));
  const most = (xs: TacStack[]) => xs.sort((a, b) => threat(bt, b) - threat(bt, a) || a.id - b.id)[0];
  const hits: [TacStack | undefined, string][] = [];
  if (sp(s, 'breath') && how === 'melee') hits.push([most(near.filter((o) => hexDist(s.hex, o.hex) >= 2)), 'breath']);
  if (sp(s, 'chain')) hits.push([most(near.filter((o) => !hits.some(([x]) => x === o))), 'chain']);
  for (const [o, id] of hits) {
    if (!o || o.count <= 0) continue;
    const b = Math.max(1, Math.round(blow(bt, s, o, how, null).dmg * SPILL_SHARE));
    const k2 = hurt(bt, o, b, s.side, s.own ?? 0);
    wake(bt, o);
    push(bt, { k: how === 'shot' ? 'shot' : 'hit', side: s.side, s: s.id, t: o.id, dmg: b, kills: k2, hex: o.hex, id });
  }
}

/** Her answer: once a round (every blow for a guard that answers all), by what is left of her. */
function retaliate(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  if (t.count <= 0 || s.count <= 0 || !t.ret || sp(s, 'no_retaliation')) return;
  if (smods(bt, s).noRet || smods(bt, t).noAnswer) return; // docs/18: the hook, knives in the dark
  const hs = bt.heroes[s.side];
  if (hs.free > 0 && !isShooter(s)) {
    hs.free--; // docs/18: Blood Harvest — the first blows unanswered
    return;
  }
  if (!sp(t, 'retaliate_all')) t.ret = false;
  // She turns on whom she answers, as a HoMM3 stack does: her back is to the others now (draw her answer with one
  // stack, and the next may take her from behind).
  turnTo(t, s.hex, t.hex);
  oneBlow(bt, t, s, rng, 'ret');
}

/** A blow in melee: hers, what spills from it, the answer, her second. `answer` the dice of the answer (the preview's
 *  own; the battle's are one), `force` the harm of her first blow, given. */
function strike(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng, answer: Rng = rng, force?: number): void {
  // The deep's spawn sweeps every foe about it, and none of them answers.
  if (sp(s, 'sweep')) {
    for (const o of [t, ...enemiesAdjacent(bt, s).filter((o) => o !== t)]) if (o.count > 0) oneBlow(bt, s, o, rng, 'hit', o === t ? force : undefined);
    return;
  }
  oneBlow(bt, s, t, rng, 'hit', force);
  spill(bt, s, t, 'melee');
  retaliate(bt, s, t, answer);
  // Double strike: the second blow after her answer, if both still stand.
  if (sp(s, 'double_strike') && s.count > 0 && t.count > 0) oneBlow(bt, s, t, rng, 'hit');
}

function shoot(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  const { dmg, lucky } = blow(bt, s, t, 'shot', rng);
  s.shots--;
  turnTo(s, t.hex);
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const ring = sp(s, 'blast') ? alive(bt).filter((o) => o.side !== s.side && o !== t && hexNeighbors(t.hex).includes(o.hex)) : [];
  const had = hpOf(t);
  const kills = hurt(bt, t, dmg, s.side, s.own ?? 0);
  wake(bt, t);
  push(bt, { k: 'shot', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex });
  // A swivel gun's burst: the stacks beside the target take half as much.
  for (const o of ring) {
    const b = Math.max(1, Math.round(blow(bt, s, o, 'shot', null).dmg * 0.5));
    const k2 = hurt(bt, o, b, s.side, s.own ?? 0);
    wake(bt, o);
    push(bt, { k: 'shot', side: s.side, s: s.id, t: o.id, dmg: b, kills: k2, hex: o.hex, id: 'blast' });
  }
  // docs/18 VII: a venomed dart stays in the living as a bite does; the bolt that leaps on, the toll that binds.
  if (sp(s, 'poison') && t.count > 0 && !sp(t, 'undead')) t.poison = { dmg: Math.max(1, Math.round(dmg * 0.3)), left: 2, by: s.side, ...(s.own ? { who: s.own } : {}) };
  spill(bt, s, t, 'shot');
  afterHit(bt, s, t, had - hpOf(t), rng);
}

// ------------------------------------------------------------------ the captains' orders

/** docs/25 items 44 and 51: what a boarding's level and its fatigue make of every blow and order (1 elsewhere). */
export function blastScale(bt: TacBattle): number {
  return bt.len === 'board' ? bt.blast * tacFatigue(bt.round) * (bt.round <= 1 ? tacOpen(bt.level) : 1) : 1;
}

/** The captain's blast: a share of his own side's strength at the start, cut by the ladder. */
function spellPower(bt: TacBattle, side: 0 | 1): number {
  const h = bt.heroes[side];
  return (h.input.spellHp ?? h.startHp) * 0.07 * h.input.dealt * h.input.power * (h.input.struck ? 0.1 : 1) * blastScale(bt);
}

/** docs/25 item 46: a common order's lift — her Power, her school, Mysticism and artifacts — with a waning return,
 *  never past ×TAC_ORDER_CAP (it was ×4.7–8.4 at level 60, and «Водоворот» took 77–100% of an equal army). The path
 *  books, the innate move and the ultimate keep their own (docs/25 item 53 is theirs). */
export const TAC_ORDER_CAP = 3;
export function commonMul(raw: number): number {
  if (raw <= 1) return raw;
  const room = TAC_ORDER_CAP - 1;
  return 1 + room * (1 - Math.exp(-(raw - 1) / room));
}
/** docs/25 item 46: the blast is reckoned from the stack it falls on too — a common order lays on one stack at most
 *  this share of what that stack brought aboard (by the battle's scale), times its own share. */
export const TAC_BLAST_STACK = 0.35;
/** docs/25 item 70: the common heals of the order book — a share of every stack (`k` her lift on it), at most `cap`; in
 *  a boarding at most `board`. A heal is a share of a stack and the boarding's slower blows do not slow it, so with her
 *  lift growing to ×3 a Brine Mend stood up 15% of every stack at level 5 and 34–35% from level 30 — two or three times
 *  the Drowned's own «Поцелуй соли», and the sea's mind never gave the page. Now no more than a path's own heal is set
 *  at (tools/balance-paths.ts FIT.page.healAim, 13%) and a little; the Tide Returns, a guild's third-level order, twice it. */
export const TAC_HEAL = { brine_mend: { base: 0.12, cap: 0.4, board: 0.15 }, tide_returns: { base: 0.25, cap: 0.6, board: 0.3 } } as const;
export function commonHeal(bt: TacBattle, id: keyof typeof TAC_HEAL, k: number): number {
  const h = TAC_HEAL[id];
  return Math.min(boardRules(bt) ? h.board : h.cap, h.base * k);
}
function blastOn(bt: TacBattle, t: TacStack, P: number, share: number, common = true, pierce = false): number {
  const p = common && boardRules(bt) ? Math.min(P, TAC_BLAST_STACK * t.start * t.hpMax * blastScale(bt)) : P;
  // docs/25 item 56: a legend, a titan, a great one shrugs off a share (her path's innate move and ultimate pass).
  return Math.max(1, Math.round(p * share * (pierce ? 1 : 1 - resistOf(bt, t))));
}

/** docs/25 item 53: a path's blows are set for a boarding of her level (its blows slow with the level, docs/25 item
 *  44, and her path's `power` stands against it: tools/balance-paths.ts --fit); in a battle that keeps no such tempo
 *  (the long ones, the Colosseum's sand, the land) they land the same share of an army — her level's boarding scale. */
function pathScale(bt: TacBattle, side: 0 | 1, pathMove: boolean): number {
  if (!pathMove || bt.len === 'board') return 1;
  return Math.min(TAC_LEN.blastMax, tacTempo(bt.heroes[side].input.hero?.level ?? 1));
}

/** The fallen of a side stand up again: a share of each stack's strength as it came aboard (`dead`: the drowned
 *  too, docs/18's Call of the Depths). */
function heal(bt: TacBattle, side: 0 | 1, share: number, dead = false, only?: TacStack): void {
  for (const x of bt.stacks) {
    if (x.side !== side || x.count <= 0 || (sp(x, 'undead') && !dead) || (only && x !== only)) continue;
    restore(bt, x, x.start * x.hpMax * share);
  }
}

/** A page she holds only on a scroll (docs/18 item 10): read once a scroll, free. */
export function onScroll(bt: TacBattle, side: 0 | 1, id: TacSpellId): boolean {
  const h = bt.heroes[side];
  const n = h.input.hero?.scroll?.[id] ?? 0;
  return n > 0 && h.scrollsUsed.filter((x) => x === id).length < n;
}

/** What an order spends this side (docs/18 item 4): with stamina in the battle, physical moves spend it, magical
 *  ones will; in H2's reckoning (no stamina) everything is will. */
export function spellRes(bt: TacBattle, side: 0 | 1, id: TacSpellId): OrderRes {
  return bt.heroes[side].stam >= 0 ? orderRes(id) : 'will';
}

/** The will (or stamina) an order costs this side (0 in the old reckoning, and read from a scroll). */
export function spellCost(bt: TacBattle, side: 0 | 1, id: TacSpellId): number {
  const hb = bt.heroes[side].input.hero;
  if (hb?.scroll?.[id]) return 0;
  return hb ? hb.cost[id] ?? ORDERS[id]?.cost ?? 0 : 0;
}

/** How much stronger the hero makes this order (her Power, her school's skill, Mysticism, artifacts, her home
 *  school; her talents on her path's own pages). */
function spellMul(bt: TacBattle, side: 0 | 1, id: TacSpellId): number {
  const hb = bt.heroes[side].input.hero;
  if (!hb) return 1;
  const d = ORDERS[id];
  const raw = (hb.mul[d?.school ?? 'fire'] ?? 1) * homeMul(hb.path, id) * (d?.path && d.path === hb.path ? hb.pageMul ?? 1 : 1);
  return isPathPage(id) || !boardRules(bt) ? raw : commonMul(raw);
}
/** The pool an order is paid from now. */
function poolOf(h: TacHero, res: OrderRes): number {
  return res === 'stam' ? h.stam : h.mana;
}

/** Rounds an order's effect holds past the next: a strong Power holds it longer (HoMM3's duration by power). */
function holdOf(bt: TacBattle, side: 0 | 1): number {
  return powHold(bt.heroes[side].input.hero?.pow ?? 0);
}
/** docs/25 items 53 and 57: what the captain of a side is (her path and level) for her moves' caps. */
const capsOf = (bt: TacBattle, side: 0 | 1) => {
  const hb = bt.heroes[side].input.hero;
  return { raise: raiseCap(hb?.path, hb?.level ?? 1), drain: drainCap(hb?.path, hb?.level ?? 1) };
};

export function spellError(bt: TacBattle, side: 0 | 1, id: TacSpellId, target?: number): string | null {
  const h = bt.heroes[side];
  const sp0 = h.spells.find((x) => x.id === id);
  if (!sp0) return 'Your captain has no such order';
  if ((h.hush ?? 0) >= bt.round) return 'Your signals are lost in her fog';
  if (h.cast >= bt.round) return 'One captain\'s order a round';
  if (sp0.ready > bt.round) return 'That order is not ready yet';
  if (h.input.hero?.scroll?.[id] && !onScroll(bt, side, id)) return 'That scroll is read';
  const res = spellRes(bt, side, id);
  if (poolOf(h, res) >= 0 && poolOf(h, res) < spellCost(bt, side, id)) return res === 'stam' ? 'Not enough stamina' : 'Not enough will';
  return targetError(bt, side, TAC_SPELLS[id].target, target);
}

function targetError(bt: TacBattle, side: 0 | 1, kind: 'enemy' | 'own' | 'none', target?: number): string | null {
  if (kind === 'none') return null;
  const t = target !== undefined ? stackById(bt, target) : undefined;
  if (kind === 'enemy' && (!t || t.side === side)) return 'Point at one of her stacks';
  if (kind === 'own' && (!t || t.side !== side)) return 'Point at one of your stacks';
  return null;
}

/** A move of the paths (docs/18): a page, the innate move, the ultimate — what its `fx` says, `k` its strength.
 *  Returns the fallen and the stacks it laid itself on. */
function applyFx(bt: TacBattle, side: 0 | 1, id: string, fx: PageFx, k: number, target: number | undefined, rng: Rng, common = false): { kills: number; on: number[]; res?: number[] } {
  const h = bt.heroes[side], e = bt.heroes[1 - side];
  const r = bt.round;
  // docs/25 items 53–60: a path's own move (a page of a path book, the innate move, the ultimate); item 56: the innate
  // move and the ultimate pass every resistance.
  const exempt = id.startsWith('innate:') || id.startsWith('ult:');
  const pathMove = exempt || isPathPage(id);
  const resistMul = (o: TacStack, pierce: boolean) => (pierce ? 1 : 1 - resistOf(bt, o));
  const t = target !== undefined ? stackById(bt, target) : undefined;
  const P = spellPower(bt, side) * (0.85 + rng.float() * 0.3) * k * pathScale(bt, side, pathMove);
  // docs/25 item 46: a common page's blast is reckoned from the stack it falls on too.
  const on1 = (o: TacStack, share: number) => blastOn(bt, o, P, share, common, exempt);
  const foes = () => alive(bt).filter((o) => o.side !== side);
  const own = () => alive(bt).filter((o) => o.side === side);
  let kills = 0;
  const on = new Set<number>();
  const resisted: number[] = [];
  if (t && fx.target !== 'none') on.add(t.id);
  if (t && t.side !== side) {
    const ring = fx.ring ? foes().filter((o) => o !== t && hexNeighbors(t.hex).includes(o.hex)) : [];
    const row = fx.row ? foes().filter((o) => hexY(o.hex) === hexY(t.hex)) : [];
    if (fx.dmg) kills += hurt(bt, t, on1(t, fx.dmg), side);
    for (const o of ring) {
      kills += hurt(bt, o, on1(o, fx.ring ?? 0), side);
      on.add(o.id);
    }
    // The common pages after docs/18: the forked blow, the raking line, a sickness, a fire under her.
    const hit = [t];
    for (let share = fx.dmg ?? 0; fx.chain && hit.length <= fx.chain; ) {
      const next = leapFrom(bt, side, hit[hit.length - 1], hit);
      if (!next) break;
      share *= CHAIN_FALL;
      kills += hurt(bt, next, on1(next, share), side);
      on.add(next.id);
      hit.push(next);
    }
    for (const o of row) {
      kills += hurt(bt, o, on1(o, fx.row ?? 0), side);
      on.add(o.id);
    }
    if (fx.sicken && t.count > 0 && !sp(t, 'undead')) t.poison = { dmg: on1(t, fx.sicken), left: SICK_TURNS, by: side, sick: true, ...(bt.casting ? { who: bt.casting } : {}) };
    if (fx.fire && bt.cells[t.hex] === '.') bt.cells[t.hex] = 'F';
  }
  if (fx.mend && t && t.side === side) heal(bt, side, Math.min(0.5, fx.mend * k), false, t);
  if (fx.all) for (const o of foes()) {
    kills += hurt(bt, o, on1(o, fx.all), side);
    on.add(o.id);
  }
  if (fx.shooters) for (const o of foes()) if (isShooter(o)) {
    kills += hurt(bt, o, on1(o, fx.shooters), side);
    on.add(o.id);
  }
  const caps = pathMove ? capsOf(bt, side) : { raise: RAISE_CAP, drain: DRAIN_CAP };
  if (fx.drain) for (const o of foes()) if (o.count > 1) {
    kills += hurt(bt, o, Math.max(1, Math.round(o.count * Math.min(caps.drain, fx.drain * k) * resistMul(o, exempt))) * o.hpMax, side);
    on.add(o.id);
  }
  if (fx.heal || fx.raise) {
    heal(bt, side, Math.min(fx.raise ? caps.raise : RAISE_CAP, (fx.heal ?? fx.raise ?? 0) * k), !!fx.raise);
    for (const x of own()) on.add(x.id);
  }
  const rounds = fx.rounds ?? 0;
  // A strong Power holds a move longer — but a spell on her very turns (spellbound, maddened) holds as written; a
  // path's move (docs/25 item 60) as written and a round more at most.
  const until = r + (pathMove ? pathHoldExtra(fx, bt.heroes[side].input.hero?.pow ?? 0) : rounds + (rounds > 0 && !fx.one?.still && !fx.one?.mad ? holdOf(bt, side) : 0));
  // The clearing wind: all she laid on both decks ends before anything new is laid.
  if (fx.clear && (e.fx.length || e.free)) {
    for (const f of e.fx) for (const x of f.on !== undefined ? [stackById(bt, f.on)] : f.foe ? own() : foes()) if (x) on.add(x.id);
    keepFx(e, (f) => f.id.startsWith('role:')); // docs/25 item 65: a group's roles are its captains', not orders
    e.free = 0;
  }
  // docs/25 item 56: each of hers that resists shrugs off what is laid on her as often as she resists.
  const shrug = (xs: TacStack[]) => (exempt ? [] : xs.filter((x) => resistOf(bt, x) > 0 && rng.chance(resistOf(bt, x))).map((x) => x.id));
  if (fx.self) {
    layFx(bt, h, { id, until, mods: fx.self });
    for (const x of own()) on.add(x.id);
  }
  if (fx.foe) {
    const res = shrug(foes());
    layFx(bt, h, { id, until, mods: fx.foe, foe: true, ...(res.length ? { res } : {}) });
    for (const x of foes()) if (!res.includes(x.id)) on.add(x.id);
    if (res.length) resisted.push(...res);
  }
  if (fx.one && t) {
    const res = t.side !== side ? shrug([t]) : [];
    if (res.length) resisted.push(...res);
    else layFx(bt, h, { id, until, mods: fx.one, on: t.id, ...(t.side !== side ? { foe: true } : {}) });
  }
  // Another turn this round: a stack that has acted goes again at the round's end; one still to act, twice.
  const again = (x: TacStack) => {
    // docs/25 item 65: in a group, a stack is given another turn by her side's moves once a round.
    if (bt.allies?.length && x.extra === bt.round) return;
    x.extra = bt.round;
    if (x.id === bt.active || bt.queue.includes(x.id)) x.again++;
    else bt.queue.push(x.id);
    on.add(x.id);
  };
  if (fx.again && t && t.side === side && (fx.againShare === undefined || rng.chance(fx.againShare))) again(t);
  if (fx.allAgain) {
    const list = own().sort((a, b) => threat(bt, b) - threat(bt, a));
    for (const x of list.slice(0, Math.max(1, Math.ceil(list.length * (fx.allShare ?? 1))))) again(x);
  }
  if (fx.free) {
    h.free += fx.free;
    for (const x of own()) if (!isShooter(x)) on.add(x.id);
  }
  if (fx.heart) h.morale = Math.min(100, h.morale + fx.heart);
  if (fx.dread) e.morale = Math.max(0, e.morale - fx.dread);
  if (fx.douse) for (let i = 0; i < bt.cells.length; i++) if (bt.cells[i] === 'F') bt.cells[i] = '.';
  if (fx.hush) e.hush = Math.max(e.hush ?? 0, r + fx.hush - 1);
  return { kills, on: [...on], ...(resisted.length ? { res: resisted } : {}) };
}

/** docs/25 item 65: a move laid by one captain of a side — what another captain of hers already laid of the same
 *  page or path move (on the same stacks) is renewed by it, not doubled: three of one book hold once, a mixed group
 *  lays more. A captain's own page laid again keeps the old reckoning. */
function layFx(bt: TacBattle, h: TacHero, f: Fx): void {
  const by = bt.casting ?? 0;
  if (bt.allies?.length) for (let i = h.fx.length - 1; i >= 0; i--) {
    const o = h.fx[i];
    if (o.id !== f.id || (o.by ?? 0) === by || o.on !== f.on || !!o.foe !== !!f.foe || o.until < bt.round) continue;
    f.until = Math.max(f.until, o.until);
    h.fx.splice(i, 1);
  }
  h.fx.push(by ? { ...f, by } : f);
}
/** docs/25 item 65: the second captain of one path to give her path's page or move in a round gives it at
 *  ×TAC_GROUP.echo, the third at its square — her foe has just read that book (a common page: the second captain to give
 *  that page in a round); the innate move and the ultimate so over the whole battle (`give`: count her as having given
 *  one). */
/** docs/25 item 65: a move echoed — its blows and raises by `e` (applyFx's strength), what it lays and the share of her
 *  side it gives another turn by `e` too (points rounded: a third captain's one point may be none). */
function echoFx(fx: PageFx, e: number): PageFx {
  if (e >= 1) return fx;
  const m = (x: BtMods | undefined): BtMods | undefined => {
    if (!x) return x;
    const o: BtMods = { ...x };
    for (const k of ['melee', 'shot', 'taken', 'shotTaken'] as const) if (o[k] !== undefined) o[k] = o[k]! * e;
    for (const k of ['speed', 'init', 'morale', 'luck'] as const) if (o[k] !== undefined) o[k] = Math.round(o[k]! * e);
    return o;
  };
  return { ...fx, ...(fx.self ? { self: m(fx.self) } : {}), ...(fx.foe ? { foe: m(fx.foe) } : {}), ...(fx.one ? { one: m(fx.one) } : {}), ...(fx.allAgain ? { allShare: (fx.allShare ?? 1) * e } : {}), ...(fx.again ? { againShare: (fx.againShare ?? 1) * e } : {}) };
}
/** docs/25 item 65: what echoes — a path's pages by her path, a common page by itself. */
const echoKey = (id: TacSpellId): string => (isPathPage(id) ? PATH_PAGES[id].path : `page_${id}`);
function echoMul(bt: TacBattle, side: 0 | 1, path: string | null | undefined, give: boolean, move?: 'innate' | 'ult'): number {
  if (!path || !bt.allies?.length) return 1;
  const by = bt.casting ?? 0;
  // A page echoes in its round; the innate move and the ultimate (once a battle each) over the whole battle.
  const key = move ? `${side}:${move}:${path}` : `${side}:${bt.round}:${path}`;
  const who = (bt.echo ??= {})[key] ?? [];
  const others = who.filter((x) => x !== by).length;
  if (give && !who.includes(by)) bt.echo[key] = [...who, by];
  return Math.pow(tacEcho(bt.level), others);
}
/** docs/25 item 65: another captain of her side laid this move and it holds past this round (the sea's mind weighs a
 *  renewal as little). */
function echoed(bt: TacBattle, side: 0 | 1, id: string): boolean {
  const by = bt.casting ?? 0;
  return !!bt.allies?.length && bt.heroes[side].fx.some((f) => f.id === id && !!f.mods && (f.by ?? 0) !== by && f.until > bt.round);
}

/** Where the forked blow leaps from `last`: the nearest stack of hers it has not struck (the stronger on a tie). */
function leapFrom(bt: TacBattle, side: 0 | 1, last: TacStack, hit: readonly TacStack[]): TacStack | undefined {
  let best: TacStack | undefined, bd = Infinity;
  for (const o of alive(bt)) {
    if (o.side === side || hit.includes(o)) continue;
    const d = hexDist(last.hex, o.hex) - threat(bt, o) * 1e-6;
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** Her path's innate move (once a battle, free) or her ultimate (from level 20, once a battle): given beside the
 *  round's order, one of the two a round (docs/18 items 1 and 5). */
export function moveError(bt: TacBattle, side: 0 | 1, kind: 'innate' | 'ult', target?: number): string | null {
  const h = bt.heroes[side];
  const path = h.input.hero?.path;
  if (!path) return 'Your captain walks no path';
  if (kind === 'ult' && !h.input.hero?.ult) return 'The ultimate opens at level 20';
  if (kind === 'ult' && bt.round < h.ultFrom) return 'The ultimate waits for the second round';
  if ((kind === 'innate' ? h.innate : h.ult) !== 1) return kind === 'innate' ? "Your path's move is spent this battle" : 'Your ultimate is spent this battle';
  if ((h.hush ?? 0) >= bt.round) return 'Your signals are lost in her fog';
  if (h.moved >= bt.round) return 'One path move a round';
  return targetError(bt, side, (kind === 'innate' ? INNATE : ULTIMATE)[path].fx.target, target);
}

/** The point-blank volley's blow, a share of the captain's blast: H2's corsair signature in the sea's book (`k`), and
 *  in a corsair's own hands (`path`: docs/18 #47 — her path book carries her now, the volley a little less). */
export const TAC_POINT_BLANK = { k: 1.6, path: 1.1 };
/** The point-blank volley's share of her blast as she gives it (docs/25 item 70: a corsair's by her ORDER_KNOBS). */
function pointBlank(bt: TacBattle, side: 0 | 1): number {
  return bt.heroes[side].input.hero?.path === 'corsair' ? TAC_POINT_BLANK.path * orderK(bt, side, 'point_blank') : TAC_POINT_BLANK.k;
}

/** The balance tools' count of what each captain gives (tools/balance-paths-casts.ts); off in the game. */
export const tacStats: { on: boolean; casts: Map<string, number>; harm: Map<string, number> } = { on: false, casts: new Map(), harm: new Map() };
/** docs/25 item 69: the hit points of the other side a captain's move took (the balance tools' share of a page). */
const foeHp = (bt: TacBattle, side: 0 | 1): number => (tacStats.on ? bt.stacks.reduce((n, s) => n + (s.side !== side ? hpOf(s) : 0), 0) : 0);
const tallyHarm = (bt: TacBattle, side: 0 | 1, id: string, before: number): void => {
  if (!tacStats.on) return;
  const k = `${bt.heroes[side].input.hero?.path ?? 'sea'}:${id}`;
  tacStats.harm.set(k, (tacStats.harm.get(k) ?? 0) + Math.max(0, before - foeHp(bt, side)));
};
const tally = (bt: TacBattle, side: 0 | 1, id: string) => {
  if (!tacStats.on) return;
  const k = `${bt.heroes[side].input.hero?.path ?? 'sea'}:${id}`;
  tacStats.casts.set(k, (tacStats.casts.get(k) ?? 0) + 1);
};

export function castMove(bt: TacBattle, side: 0 | 1, kind: 'innate' | 'ult', target: number | undefined, rng: Rng): string | null {
  const why = moveError(bt, side, kind, target);
  if (why) return why;
  tally(bt, side, kind);
  const h = bt.heroes[side];
  const hb = h.input.hero!;
  const path = hb.path!;
  const mv = (kind === 'innate' ? INNATE : ULTIMATE)[path];
  if (kind === 'innate') h.innate = 2;
  else h.ult = 2;
  h.moved = bt.round;
  const t = target !== undefined ? stackById(bt, target) : undefined;
  const hex = t?.hex;
  const hp0 = foeHp(bt, side);
  // docs/25 item 65: the second captain of her path to give this move in the battle gives it echoed — its blows and
  // raises, and the share of her side that acts again.
  const echo = echoMul(bt, side, path, true, kind);
  const mfx = echoFx(powered(moveFx(path, kind, hb.level ?? 1), path, hb.level ?? 1, 'move'), echo);
  const { kills, on, res } = applyFx(bt, side, `${kind}:${path}`, mfx, moveMul(bt, side) * echo, target, rng);
  tallyHarm(bt, side, kind, hp0);
  push(bt, { k: kind, side, id: path, ...(t ? { t: t.id, hex } : {}), kills, on, ...(res ? { res } : {}) });
  checkOver(bt);
  return null;
}

/** How strong her innate move and ultimate land: her home school's lift and her talents'. */
function moveMul(bt: TacBattle, side: 0 | 1): number {
  const hb = bt.heroes[side].input.hero;
  if (!hb?.path) return 1;
  return (hb.mul[PATH_SCHOOL[hb.path]] ?? 1) * HOME_MUL * (hb.innateMul ?? 1);
}

/** A page's fx as it lands for her: a path book's with its path's power at her level on it, a common page's after
 *  docs/18 as it stands (it is no path's); null for the orders the battle gives by hand below. */
function pageFx(bt: TacBattle, side: 0 | 1, id: TacSpellId): PageFx | null {
  if (isPathPage(id)) return powered(PATH_PAGES[id].fx, PATH_PAGES[id].path, bt.heroes[side].input.hero?.level ?? 1);
  return isBookPage(id) ? BOOK_PAGES[id].fx : null;
}

export function castSpell(bt: TacBattle, side: 0 | 1, id: TacSpellId, target: number | undefined, rng: Rng): string | null {
  const why = spellError(bt, side, id, target);
  if (why) return why;
  const h = bt.heroes[side];
  const sp0 = h.spells.find((x) => x.id === id)!;
  sp0.ready = bt.round + TAC_SPELLS[id].cd;
  h.cast = bt.round;
  tally(bt, side, id);
  const scroll = !!h.input.hero?.scroll?.[id];
  const res = spellRes(bt, side, id);
  if (scroll) h.scrollsUsed.push(id);
  else if (res === 'stam' && h.stam >= 0) h.stam = Math.max(0, h.stam - spellCost(bt, side, id));
  else if (h.mana >= 0) h.mana = Math.max(0, h.mana - spellCost(bt, side, id));
  const r = bt.round;
  // The path books' pages (docs/18 item 3) and the common pages after them: what each page's fx says.
  const pfx = pageFx(bt, side, id);
  if (pfx) {
    const t0 = target !== undefined ? stackById(bt, target) : undefined;
    const hex = t0?.hex;
    const hp0 = foeHp(bt, side);
    const echo = echoMul(bt, side, echoKey(id), true);
    const { kills, on, res } = applyFx(bt, side, id, echoFx(pfx, echo), spellMul(bt, side, id) * echo, target, rng, !isPathPage(id));
    tallyHarm(bt, side, id, hp0);
    push(bt, { k: 'spell', side, id, ...(t0 ? { t: t0.id, hex } : {}), kills, on, ...(res ? { res } : {}), ...(scroll ? { via: 'scroll' as const } : {}) });
    checkOver(bt);
    return null;
  }
  const t = target !== undefined ? stackById(bt, target) : undefined;
  let kills = 0;
  const hp0 = foeHp(bt, side);
  const k = spellMul(bt, side, id) * echoMul(bt, side, echoKey(id), true);
  const hold = r + 1 + holdOf(bt, side);
  const P = spellPower(bt, side) * (0.85 + rng.float() * 0.3) * k;
  const foes = () => alive(bt).filter((o) => o.side !== side);
  switch (id) {
    case 'grenades':
      if (t) {
        const ring = alive(bt).filter((o) => o.side !== side && o !== t && hexNeighbors(t.hex).includes(o.hex));
        kills += hurt(bt, t, blastOn(bt, t, P, 1), side);
        for (const o of ring) kills += hurt(bt, o, blastOn(bt, o, P, 0.5), side);
      }
      break;
    case 'point_blank':
      if (t) kills += hurt(bt, t, blastOn(bt, t, P, pointBlank(bt, side)), side);
      break;
    case 'call_of_the_deep':
      for (const o of alive(bt)) if (o.side !== side && o.count > 1) kills += hurt(bt, o, Math.max(1, Math.round(o.count * Math.min(0.25, 0.08 * k * orderK(bt, side, id)) * (1 - resistOf(bt, o)))) * o.hpMax, side);
      h.fx.push({ id, until: hold });
      break;
    case 'mark_target':
      if (t) h.fx.push({ id, until: hold, on: t.id });
      break;
    case 'double_shot':
      for (const x of bt.stacks) if (x.side === side && x.count > 0 && isShooter(x)) x.shots = Math.min(x.shotsMax + 1, x.shots + 1);
      h.fx.push({ id, until: hold });
      break;
    case 'brine_mend':
      heal(bt, side, commonHeal(bt, 'brine_mend', k));
      break;
    // The order book's further pages (docs/17 H2).
    case 'musket_storm':
      for (const o of foes()) kills += hurt(bt, o, blastOn(bt, o, P, 0.45), side);
      break;
    case 'powder_keg':
      if (t) {
        const ring = foes().filter((o) => o !== t && hexNeighbors(t.hex).includes(o.hex));
        kills += hurt(bt, t, blastOn(bt, t, P, 2.4), side);
        for (const o of ring) kills += hurt(bt, o, blastOn(bt, o, P, 0.8), side);
      }
      break;
    case 'tide_returns':
      heal(bt, side, commonHeal(bt, 'tide_returns', k));
      break;
    case 'maelstrom':
      for (const o of foes()) kills += hurt(bt, o, blastOn(bt, o, P, 0.55), side);
      h.fx.push({ id, until: r });
      bt.heroes[1 - side].morale = Math.max(0, bt.heroes[1 - side].morale - 6);
      break;
    case 'dread':
      h.fx.push({ id, until: hold });
      bt.heroes[1 - side].morale = Math.max(0, bt.heroes[1 - side].morale - 8);
      break;
    default:
      h.fx.push({ id, until: id === 'smoke_and_knives' ? r : hold, ...(orderK(bt, side, id) !== 1 ? { k: orderK(bt, side, id) } : {}) });
  }
  tallyHarm(bt, side, id, hp0);
  if (id === 'iron_discipline') h.morale = Math.min(100, h.morale + 10);
  if (id === 'war_cry') h.morale = Math.min(100, h.morale + 6);
  push(bt, { k: 'spell', side, id, ...(t ? { t: t.id, hex: t.hex } : {}), kills, ...(scroll ? { via: 'scroll' as const } : {}) });
  checkOver(bt);
  return null;
}

/** An officer's word (once a fight), given instead of his party's blow. */
function giveOrder(bt: TacBattle, s: TacStack, rng: Rng): void {
  const o = s.officer!;
  o.used = true;
  const h = bt.heroes[s.side];
  const r = bt.round;
  if (o.order === 'rally') {
    heal(bt, s.side, 0.15);
    h.morale = Math.min(100, h.morale + 8);
  } else if (o.order === 'lay_true') {
    for (const x of bt.stacks) if (x.side === s.side && isShooter(x) && x.count > 0) x.shots = Math.min(x.shotsMax + 1, x.shots + 1);
    h.fx.push({ id: 'lay_true', until: r + 1 });
  } else if (o.order === 'steady') {
    h.fx.push({ id: 'steady', until: r + 1 });
    h.morale = Math.min(100, h.morale + 10);
  } else if (o.order === 'brace') {
    // The boatswain: his stack braces — steady, a third less taken, two rounds.
    h.fx.push({ id: 'brace', until: r + 1, on: s.id, mods: { taken: -0.3, steady: true } });
  } else if (o.order === 'volley') {
    // The master gunner: every musket that can see fires at once, free of its charge, at what is worth it most.
    for (const x of alive(bt)) {
      if (x.side !== s.side || !isShooter(x) || !canShoot(bt, x)) continue;
      const foes = alive(bt).filter((t) => t.side !== s.side);
      if (!foes.length) break;
      let best = foes[0], bv = -1;
      for (const t of foes) {
        const v = valueOf(bt, t, blow(bt, x, t, 'shot', null).dmg);
        if (v > bv) {
          bv = v;
          best = t;
        }
      }
      const dmg = Math.max(1, Math.round(blow(bt, x, best, 'shot', rng).dmg * 0.6));
      const kills = hurt(bt, best, dmg, s.side);
      push(bt, { k: 'shot', side: s.side, s: x.id, t: best.id, dmg, kills, hex: best.hex, id: 'volley' });
    }
  } else if (o.order === 'bandage') {
    // The alchemist: salves and lint — every stack of his side a little, his own more.
    heal(bt, s.side, 0.05);
    heal(bt, s.side, 0.15, false, s);
  } else if (o.order === 'canvas') {
    // The sailmaker: wet canvas hung along the rail — two rounds his side takes a third less from her shots.
    h.fx.push({ id: 'canvas', until: r + 1, mods: { shotTaken: -0.35 } });
  } else if (o.order === 'harpoon') {
    // The harpooner: an iron into her most dangerous stack — a blow, and it is a hex slower two rounds.
    const foes = alive(bt).filter((t) => t.side !== s.side);
    const t = foes.sort((a, b) => threat(bt, b) - threat(bt, a))[0];
    if (t) {
      const dmg = Math.max(1, Math.round(blow(bt, s, t, 'shot', rng).dmg * 0.8));
      const kills = hurt(bt, t, dmg, s.side);
      h.fx.push({ id: 'harpoon', until: r + 1, on: t.id, foe: true, mods: { speed: -1 } });
      push(bt, { k: 'order', side: s.side, s: s.id, id: o.order, t: t.id, hex: t.hex, dmg, kills });
      checkOver(bt);
      return;
    }
  } else h.fx.push({ id: 'all_hands', until: r + 1 });
  push(bt, { k: 'order', side: s.side, s: s.id, id: o.order });
  checkOver(bt);
}

// ------------------------------------------------------------------ turns and rounds

function newRound(bt: TacBattle, now: number, rng: Rng): void {
  // docs/25 item 52: the round that ends counts on the quarterdeck's flags.
  if (bt.round > 0) {
    flagRound(bt);
    if (bt.over) return;
  }
  bt.round++;
  if (bt.echo) for (const k of Object.keys(bt.echo)) if (!/:(innate|ult):/.test(k)) delete bt.echo[k];
  // docs/25 item 64: the allies who asked to come aboard do so as the round opens (up to TAC_GROUP.late).
  if (bt.joinQ?.length) {
    const q = bt.joinQ;
    bt.joinQ = [];
    if (bt.round <= TAC_GROUP.late) for (const j of q) addAlly(bt, j.side, j.input, j.grow, j.tag);
  }
  const list = alive(bt);
  for (const s of list) {
    s.ret = true;
    s.waited = false;
    s.surged = false;
    s.again = 0;
  }
  // docs/25 item 65: a group's Drowned raises a share of every stack of her side as the round opens.
  if (bt.round > 1 && bt.allies?.length) for (const x of [0, 1] as const) {
    const raise = rolesOf(bt, x).reduce((n, p) => n + (TAC_ROLES[p].raise ?? 0), 0);
    if (raise > 0) for (const s of list) {
      if (s.side !== x) continue;
      const n = restore(bt, s, s.start * s.hpMax * raise);
      if (n > 0) push(bt, { k: 'regen', side: x, s: s.id, dmg: n, hex: s.hex, id: 'role' });
    }
  }
  // Stamina comes back a share every round (docs/18 item 4).
  if (bt.round > 1) for (const h of heroesAll(bt)) if (h.stam >= 0) h.stam = Math.min(h.input.hero?.stamMax ?? 0, h.stam + (h.input.hero?.stamRegen ?? 0));
  // Initiative, the higher first; a tie falls by the dice.
  const tie = new Map(list.map((s) => [s.id, rng.float()]));
  bt.queue = list.sort((x, y) => initOf(bt, y) - initOf(bt, x) || tie.get(x.id)! - tie.get(y.id)!).map((s) => s.id);
  if (bt.round > 1) push(bt, { k: 'round', side: 0, n: bt.round });
  // docs/19 E5: the catapult and the towers as the round opens.
  if (bt.siege) {
    siegeRound(bt, rng);
    if (bt.over) {
      bt.active = null;
      return;
    }
  }
  nextTurn(bt, now, rng);
}

function nextTurn(bt: TacBattle, now: number, rng: Rng): void {
  for (let guard = 0; guard < 200 && !bt.over; guard++) {
    const id = bt.queue.shift();
    if (id === undefined) {
      if (bt.round >= TAC_MAX_ROUNDS) {
        const left = (side: 0 | 1) => alive(bt).filter((s) => s.side === side).reduce((n, s) => n + hpOf(s), 0) / Math.max(1, bt.heroes[side].startHp);
        // docs/19 E5: a siege not carried in time is the garrison's.
        bt.over = { winner: bt.siege ? 1 : left(0) > left(1) ? 0 : 1, why: 'rounds' };
        bt.active = null;
        bt.seq++;
        return;
      }
      return newRound(bt, now, rng);
    }
    const s = stackById(bt, id);
    if (!s) continue;
    s.defending = false;
    // docs/18 II: the poison in her bites again; a creature that grows back does.
    if (s.poison && s.poison.left > 0) {
      const p = s.poison;
      p.left--;
      const kills = hurt(bt, s, p.dmg, p.by, p.who ?? 0);
      push(bt, { k: 'poison', side: s.side, s: s.id, dmg: p.dmg, kills, hex: s.hex, ...(p.sick ? { id: 'sick' } : {}) });
      if (p.left <= 0) delete s.poison;
      checkOver(bt);
      if (bt.over) {
        bt.active = null;
        return;
      }
      if (s.count <= 0) continue;
    }
    if (sp(s, 'regen') && hpOf(s) < s.start * s.hpMax) {
      const was = hpOf(s);
      heal(bt, s.side, REGEN_SHARE, false, s);
      const n = hpOf(s) - was;
      if (n > 0) push(bt, { k: 'regen', side: s.side, s: s.id, dmg: n, hex: s.hex });
    }
    // docs/18 VII: a healer — the living of her side within two hexes of her (the next stack of the line) take back a
    // share of their strength.
    if (sp(s, 'mend')) for (const o of alive(bt)) {
      if (o.side !== s.side || o === s || sp(o, 'undead') || hexDist(s.hex, o.hex) > MEND_REACH) continue;
      const n = restore(bt, o, o.start * o.hpMax * MEND_SHARE);
      if (n > 0) push(bt, { k: 'regen', side: o.side, s: o.id, dmg: n, hex: o.hex, id: 'mend' });
    }
    // A fire on deck: whoever stands in it burns as his turn comes.
    if (bt.cells[s.hex] === 'F') {
      const dmg = Math.max(s.hpMax, Math.round(hpOf(s) * TAC_BURN));
      const kills = hurt(bt, s, dmg, (1 - s.side) as 0 | 1);
      push(bt, { k: 'burn', side: s.side, s: s.id, dmg, kills, hex: s.hex });
      checkOver(bt);
      if (bt.over) {
        bt.active = null;
        return;
      }
      if (s.count <= 0) continue;
    }
    // The common pages after docs/18: the Siren Song holds her spellbound; Fog Madness turns her on her own.
    const held = smods(bt, s);
    if (held.still) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'still' });
      for (const h of bt.heroes) keepFx(h, (f) => !(f.id === 'bind' && f.on === s.id)); // a bind holds one turn
      continue;
    }
    if (held.mad) {
      madBlow(bt, s, rng);
      if (bt.over) {
        bt.active = null;
        return;
      }
      continue;
    }
    // Bad morale (HoMM3): the stack freezes in fear and loses its turn, 1/25 a point below nought — a crew's 0..100
    // heart is −3 at under 10, −2 at 10–25, −1 at 26–41 (moralePoints), so a crew all but broken loses one turn in eight.
    const m = stackMorale(bt, s);
    const braced = smods(bt, s).steady;
    if (m < 0 && !braced && rng.chance(-m * TAC_CHANCE_PER_POINT)) {
      push(bt, { k: 'fear', side: s.side, s: s.id });
      continue;
    }
    // Dread (docs/17 H2): a fifth of her turns lost to fear while it holds.
    if (!sp(s, 'undead') && !braced && has(bt.heroes[1 - s.side], 'dread', bt.round) && rng.chance(0.2)) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'dread' });
      continue;
    }
    // The deep's own on the other deck: the living may freeze in terror.
    if (!sp(s, 'undead') && !sp(s, 'steady') && !braced && sideHas(bt, (1 - s.side) as 0 | 1, 'fear') && rng.chance(TAC_FEAR)) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'terror' });
      continue;
    }
    // docs/18 II: a creature of terror beside her — the living freeze one turn in five.
    if (!sp(s, 'undead') && !sp(s, 'steady') && !braced && enemiesAdjacent(bt, s).some((o) => sp(o, 'terror')) && rng.chance(TAC_TERROR)) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'terror' });
      continue;
    }
    bt.active = s.id;
    giveTurn(bt, now);
    bt.seq++;
    return;
  }
}

/** Seconds the screens take to play what happened since the turn before began (TAC_PACE): the next turn waits for it.
 *  `window`: the most of the last events they play (TAC_PLAY_WINDOW; the end, TAC_END_WINDOW). */
export function playSince(bt: TacBattle, from = bt.beatFrom ?? 0, window = TAC_PLAY_WINDOW): number {
  const after = Math.max(from, bt.events - window);
  return tacSchedule(bt.log.filter((e) => e.i > after), heroesAll(bt).some((h) => h.fast) ? 2 : 1).total;
}

/** A turn given: her clock (or the sea's breath) runs from the moment what came before it has been played. docs/25
 *  item 48: a stack's turn lasts by the battle's level (tacTurnSecs); on a boarding no longer than is left on her chess
 *  clock — spent, the turn runs out at once and her stack defends. */
function giveTurn(bt: TacBattle, now: number): void {
  const play = playSince(bt);
  bt.beatFrom = bt.events;
  chargeClock(bt, now);
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  // docs/25 item 64: the turn of an ally's stack runs on her own clock.
  const h = s ? capOf(bt, s) : undefined;
  const from = now + play;
  const turn = tacTurnSecs(bt.level);
  if (s && h && h.bank >= 0 && !h.auto) {
    bt.turnEnds = from + Math.max(0, Math.min(turn, h.bank));
    bt.clock = { side: s.side, from, ...(s.own ? { slot: s.own } : {}) };
  } else bt.turnEnds = from + turn;
  bt.aiAt = from + aiDelay(bt);
}

/** docs/25 item 48: the seconds of the turn just over come off her chess clock (from when her clock started, to when
 *  she acted or it ran out). */
export function chargeClock(bt: TacBattle, now: number): void {
  const c = bt.clock;
  if (!c) return;
  delete bt.clock;
  const h = heroAt(bt, c.side, c.slot ?? 0);
  if (h.bank >= 0) h.bank = Math.max(0, h.bank - Math.max(0, Math.min(now, bt.turnEnds) - c.from));
}

/** docs/25 item 52: the quarterdeck's flags as a round ends — a stack of a side that stood on the other's flag through
 *  the whole round counts it; one that only came to it this round starts its count; a side that has held it
 *  TAC_LEN.flag.rounds whole rounds has taken the ship. */
function flagRound(bt: TacBattle): void {
  const f = bt.flag;
  if (!f || bt.over) return;
  for (const x of [0, 1] as const) {
    const on = alive(bt).some((s) => s.side === x && s.hex === f.hex[1 - x]);
    f.held[x] = on ? f.held[x] + (f.open[x] ? 1 : 0) : 0;
    f.open[x] = on;
  }
  const won = ([0, 1] as const).filter((x) => f.held[x] >= TAC_LEN.flag.rounds);
  if (won.length === 1) {
    bt.over = { winner: won[0], why: 'flag' };
    bt.active = null;
    push(bt, { k: 'flag', side: won[0], hex: f.hex[1 - won[0]] });
  }
}

/** Fog Madness (a common page after docs/18): as her turn comes she falls on the nearest of her own — a shot if she
 *  has one left, else a blow from beside the nearest she can reach — or stands lost; the fallen are the other
 *  captain's, and her turn is gone either way. */
function madBlow(bt: TacBattle, s: TacStack, rng: Rng): void {
  const by = (1 - s.side) as 0 | 1;
  const mine = alive(bt).filter((o) => o.side === s.side && o !== s).sort((a, b) => hexDist(s.hex, a.hex) - hexDist(s.hex, b.hex) || threat(bt, b) - threat(bt, a));
  let t: TacStack | undefined, from = s.hex, steps = 0;
  if (isShooter(s) && s.shots > 0) t = mine[0];
  else {
    const reach = reachOf(bt, s);
    let bd = Infinity;
    for (const o of mine) {
      const at = strikeFrom(bt, s, o, reach);
      const d = at === null ? Infinity : at === s.hex ? 0 : reach.get(at) ?? Infinity;
      if (at !== null && d < bd) {
        bd = d;
        t = o;
        from = at;
        steps = d;
      }
    }
  }
  if (!t) return void push(bt, { k: 'fear', side: s.side, s: s.id, id: 'mad' });
  const how = isShooter(s) && s.shots > 0 ? 'shot' : 'melee';
  if (how === 'shot') s.shots--;
  else if (from !== s.hex) walkTo(bt, s, from, steps);
  turnTo(s, t.hex);
  const { dmg } = blow(bt, s, t, how, rng, from);
  const kills = hurt(bt, t, dmg, by);
  wake(bt, t);
  push(bt, { k: how === 'shot' ? 'shot' : 'hit', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex, id: 'mad' });
  checkOver(bt);
}

/** The turn is done: high morale may give the stack another at once; else the next in the order. */
function endTurn(bt: TacBattle, s: TacStack, now: number, rng: Rng, surgeOk: boolean): void {
  checkOver(bt);
  if (bt.over) {
    bt.active = null;
    return;
  }
  // Another turn at once (docs/18: the Following Squall, the Eye of the Storm).
  if (s.count > 0 && s.again > 0) {
    s.again--;
    push(bt, { k: 'again', side: s.side, s: s.id });
    giveTurn(bt, now);
    return;
  }
  const m = stackMorale(bt, s);
  if (surgeOk && s.count > 0 && !s.surged && m > 0 && rng.chance(m * TAC_CHANCE_PER_POINT)) {
    s.surged = true;
    push(bt, { k: 'morale', side: s.side, s: s.id });
    giveTurn(bt, now);
    return;
  }
  nextTurn(bt, now, rng);
}

export function checkOver(bt: TacBattle): void {
  if (bt.over) return;
  const left: [number, number] = [0, 0];
  for (const s of alive(bt)) left[s.side] += s.count;
  if (!left[1] || !left[0]) {
    bt.over = { winner: left[0] ? 0 : 1, why: 'rout' };
    bt.active = null;
    bt.seq++;
    return;
  }
  // No crew strikes of herself (docs/17, after H5): a heart all but gone is HoMM3's bad morale — her stacks freeze in
  // fear and lose turns (nextTurn) — and striking, the ransom and falling back stay her captain's own orders.
}

/** The battle ended by a ransom paid (tactical.ts takes the silver): the side that paid keeps her ship. */
export function endByRansom(bt: TacBattle, payer: 0 | 1): void {
  if (bt.over) return;
  bt.over = { winner: (1 - payer) as 0 | 1, why: 'ransom' };
  bt.active = null;
  bt.seq++;
}

/** The sea's breath over a turn (docs/23 item 60): halved while a captain on the field has asked «Ускорить ×2». */
export function aiDelay(bt: TacBattle): number {
  return TAC_AI_DELAY * (heroesAll(bt).some((h) => h.fast) ? TAC_FAST : 1);
}

/** One order from side `side` — from her captain at `slot` (docs/25 item 64: 0 the side's own, else an ally, who plays
 *  her own stacks, gives her own orders and keeps her own clock). Null when done; else why not. */
export function act(bt: TacBattle, side: 0 | 1, a: TacAction, now: number, rng: Rng, slot = 0): string | null {
  if (bt.over) return 'The fight is over';
  if (slot && !allyOf(bt, side, slot)) return 'You are not aboard yet';
  if (a.a === 'auto') {
    heroAt(bt, side, slot).auto = a.on;
    bt.aiAt = now + aiDelay(bt);
    bt.seq++;
    return null;
  }
  if (a.a === 'pace') {
    const was = heroesAll(bt).some((h) => h.fast);
    heroAt(bt, side, slot).fast = !!a.fast;
    // Asked mid-turn: what is left of the sea's wait goes at the new pace.
    const k = heroesAll(bt).some((h) => h.fast) === was ? 1 : was ? 1 / TAC_FAST : TAC_FAST;
    if (bt.aiAt > now) bt.aiAt = now + (bt.aiAt - now) * k;
    bt.seq++;
    return null;
  }
  // docs/25 item 64: the colours, the quick fight and the ransom are the captain's who grappled (or was grappled).
  if (slot && (a.a === 'surrender' || a.a === 'quick' || a.a === 'ransom')) return 'Only the captain of the ship decides that';
  if (a.a === 'surrender') {
    bt.over = { winner: (1 - side) as 0 | 1, why: 'struck' };
    bt.active = null;
    bt.seq++;
    return null;
  }
  if (a.a === 'quick') {
    quickFinish(bt, now, rng);
    return null;
  }
  if (a.a === 'ransom') return 'The ransom is paid in silver aboard';
  if (a.a === 'film') {
    // The film over her field: the turn that runs and the sea's next move wait as long (once a side, capped).
    const held = (bt.filmHeld ??= [false, false]);
    if (held[side]) return null;
    held[side] = true;
    // The film's length comes in milliseconds; the battle's clock runs in seconds (QA circle, 2026-10-05: 6500 was
    // added as seconds — «Ваш ход 6519 с», and a foe moving first stood still for 108 minutes).
    const secs = Math.max(0, Math.min(TAC_FILM_HOLD, Math.round(Number(a.ms) || 0))) / 1000;
    bt.turnEnds = Math.max(bt.turnEnds, now) + secs;
    bt.aiAt = Math.max(bt.aiAt, now) + secs;
    // docs/25 item 48: the film's seconds are not her chess clock's.
    if (bt.clock) bt.clock.from = Math.max(bt.clock.from, now) + secs;
    bt.seq++;
    return null;
  }
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  if (!s || s.side !== side || (s.own ?? 0) !== slot) return 'Not your turn';
  if (a.a === 'spell') return asCaptain(bt, side, slot, () => castSpell(bt, side, a.id, a.target, rng));
  if (a.a === 'innate' || a.a === 'ult') return asCaptain(bt, side, slot, () => castMove(bt, side, a.a as 'innate' | 'ult', a.target, rng));
  if (a.a === 'wait') {
    if (s.waited) return 'This stack has waited once this round';
    s.waited = true;
    bt.queue.push(s.id);
    push(bt, { k: 'wait', side, s: s.id });
    nextTurn(bt, now, rng);
    return null;
  }
  if (a.a === 'defend') {
    s.defending = true;
    push(bt, { k: 'defend', side, s: s.id });
    endTurn(bt, s, now, rng, false);
    return null;
  }
  if (a.a === 'order') {
    if (!s.officer || s.officer.used) return 'No officer\'s order to give';
    giveOrder(bt, s, rng);
    endTurn(bt, s, now, rng, true);
    return null;
  }
  const reach = reachOf(bt, s);
  if (a.a === 'move') {
    if (!reach.has(a.to)) return 'Out of reach';
    walkTo(bt, s, a.to, reach.get(a.to)!);
    endTurn(bt, s, now, rng, true);
    return null;
  }
  const t = stackById(bt, a.target);
  if (!t || t.side === side) return 'Pick one of her stacks';
  if (a.a === 'shoot') {
    if (!canShoot(bt, s)) return s.shots > 0 ? 'A foe at arm\'s length: no room to shoot' : 'No shots left';
    shoot(bt, s, t, rng);
    endTurn(bt, s, now, rng, true);
    return null;
  }
  const from = strikeFrom(bt, s, t, reach, a.from);
  if (from === null) return 'Out of reach';
  if (from !== s.hex) walkTo(bt, s, from, reach.get(from) ?? 1);
  // She squares up to whom she strikes; the blow is reckoned on the way the other faces.
  turnTo(s, t.hex);
  strike(bt, s, t, rng);
  endTurn(bt, s, now, rng, true);
  return null;
}

// ------------------------------------------------------------------ the captain's preview (owner, 2026-10-08)

/** The dice of a preview: every roll its lowest (or its highest: the best the battle's own dice can throw), no luck,
 *  nothing left to chance. */
class EdgeDice extends Rng {
  hi: boolean;
  constructor(hi: boolean) {
    super(1);
    this.hi = hi;
  }
  override float(): number {
    return this.hi ? 4294967295 / 4294967296 : 0;
  }
  override int(lo: number, hi: number): number {
    return this.hi ? hi : lo;
  }
  override chance(): boolean {
    return false;
  }
}
const LOW_DICE = new EdgeDice(false), HIGH_DICE = new EdgeDice(true);

/** A copy of the battle to try a blow on: its stacks, captains and tallies its own, the field and the inputs shared. */
function trial(bt: TacBattle): TacBattle {
  return {
    ...bt,
    stacks: bt.stacks.map((x) => ({ ...x, ...(x.poison ? { poison: { ...x.poison } } : {}), ...(x.officer ? { officer: { ...x.officer } } : {}) })),
    heroes: bt.heroes.map((h) => ({ ...h, fx: h.fx.map((f) => ({ ...f })) })) as [TacHero, TacHero],
    queue: [...bt.queue], log: [], dead: [bt.dead[0], bt.dead[1]], broken: [bt.broken[0], bt.broken[1]], hurt: [...bt.hurt],
  };
}

/** Men of `t` left standing after `dmg` (as hurt() lays it). */
function countAfter(t: TacStack, dmg: number): number {
  const left = hpOf(t) - dmg;
  return left <= 0 ? 0 : Math.ceil(left / t.hpMax);
}

/** Her stack on the copy, stepped up to `from` and squared up to `t` as act() does it. */
function trialPair(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot', from: number): { c: TacBattle; cs: TacStack; ct: TacStack } {
  const c = trial(bt);
  const cs = c.stacks.find((x) => x.id === s.id)!, ct = c.stacks.find((x) => x.id === t.id)!;
  if (how === 'melee' && from !== cs.hex) {
    turnTo(cs, from);
    cs.hex = from;
  }
  turnTo(cs, ct.hex);
  return { c, cs, ct };
}

/** Her men the answer would fell after a first blow of `dmg` (−1: no answer), the answer's dice at their lowest or
 *  highest. */
function answerAt(bt: TacBattle, s: TacStack, t: TacStack, from: number, dmg: number, high: boolean, cache: Map<string, number>): number {
  const key = `${t.id}:${dmg}:${high ? 1 : 0}:${sp(s, 'breath') || sp(s, 'chain') ? from : ''}`;
  const had = cache.get(key);
  if (had !== undefined) return had;
  const { c, cs, ct } = trialPair(bt, s, t, 'melee', from);
  strike(c, cs, ct, LOW_DICE, high ? HIGH_DICE : LOW_DICE, dmg);
  const r = c.log.find((e) => e.k === 'ret' && e.s === t.id);
  const out = r ? r.kills ?? 0 : -1;
  cache.set(key, out);
  return out;
}

/** The men of hers the answer would fell, over every first blow from `a` to `b`: within the harms that leave her the
 *  same count the answer only grows with the harm (her side's shortfall, backs to the rail), so it is tried at both
 *  ends of each count; null when no answer comes at all. */
function answerRange(bt: TacBattle, s: TacStack, t: TacStack, from: number, a: number, b: number, cache: Map<string, number>): [number, number] | null {
  const hp = hpOf(t), H = t.hpMax;
  let counts: number[] = [];
  for (let m = countAfter(t, b); m <= countAfter(t, a); m++) counts.push(m);
  // A blow on a great stack: two dozen counts of it, its ends among them.
  if (counts.length > 24) counts = Array.from({ length: 24 }, (_, i) => counts[Math.round((i * (counts.length - 1)) / 23)]);
  let lo = Infinity, hi = -1, answered = false;
  for (const m of counts) {
    if (m <= 0) {
      lo = 0; // she falls to the last man: no answer
      continue;
    }
    const left = Math.max(a, hp - m * H), right = Math.min(b, hp - (m - 1) * H - 1);
    if (left > right) continue;
    const rl = answerAt(bt, s, t, from, left, false, cache), rh = answerAt(bt, s, t, from, right, true, cache);
    if (rl >= 0 || rh >= 0) answered = true;
    lo = Math.min(lo, Math.max(0, rl));
    hi = Math.max(hi, rh, rl);
  }
  return answered ? [lo === Infinity ? 0 : lo, Math.max(0, hi)] : null;
}

/** What her stack `s` would do to `t` (owner, 2026-10-08: «при наведении во время хода … сколько я убью и какой урон
 *  нанесу»), as HoMM3 shows it: the harm of her blow from `from` (or her shot) with the dice at their lowest and their
 *  highest, the men it would fell, and the men of hers the answer would fell — reckoned by the battle's own hand
 *  (blowParts, strike) on a copy of it, so the preview and the blow cannot part. Luck aside: a lucky blow does twice
 *  (`luck` its chance in percent). `answers` keeps the answers tried for one target across the hexes she may strike
 *  it from. */
export function previewBlow(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot', from = s.hex, answers = new Map<string, number>()): TacPreview {
  const { c, cs, ct } = trialPair(bt, s, t, how, from);
  const at = how === 'melee' ? from : cs.hex;
  const lo = blow(c, cs, ct, how, LOW_DICE, at), hi = blow(c, cs, ct, how, HIGH_DICE, at);
  const luck = blowParts(c, cs, ct, how, at).luck;
  const out: TacPreview = { t: t.id, ...(how === 'melee' ? { from } : { shot: true }), fl: lo.flank, dmg: [lo.dmg, hi.dmg], kills: [t.count - countAfter(t, lo.dmg), t.count - countAfter(t, hi.dmg)] };
  if (luck > 0) out.luck = Math.round(luck * TAC_CHANCE_PER_POINT * 100);
  if (how === 'melee' && sp(s, 'double_strike')) out.twice = true;
  if (how === 'melee' && sp(s, 'sweep')) out.sweep = true;
  if (how === 'shot' && hexDist(at, t.hex) > TAC_LONG_SHOT && !sp(s, 'no_penalty')) out.far = true;
  if (how === 'shot' && coverAt(bt, t.hex, at) >= 0) out.cov = true;
  if (how === 'melee') {
    const r = answerRange(bt, s, t, from, lo.dmg, hi.dmg, answers);
    if (r) out.ret = r;
  }
  return out;
}

/** Every preview her active stack offers this turn: each foe she may shoot, or each she may reach from every hex
 *  beside it she may strike from. */
export function previewsOf(bt: TacBattle, s: TacStack, reach = reachOf(bt, s)): TacPreview[] {
  const out: TacPreview[] = [];
  if (canShoot(bt, s)) {
    for (const t of alive(bt)) if (t.side !== s.side) out.push(previewBlow(bt, s, t, 'shot'));
    return out;
  }
  for (const t of meleeTargets(bt, s, reach)) {
    const answers = new Map<string, number>();
    for (const h of hexNeighbors(t.hex)) if (h === s.hex || reach.has(h)) out.push(previewBlow(bt, s, t, 'melee', h, answers));
  }
  return out;
}

// ------------------------------------------------------------------ the sea's mind

/** How much a stack hurts each turn (what killing its men is worth). */
function threat(bt: TacBattle, s: TacStack): number {
  return (s.count * (s.dmin + s.dmax)) / 2 * (s.atk / 5) * (isShooter(s) && s.shots > 0 ? 1.4 : 1) * (sp(s, 'double_strike') ? 1.6 : 1) * s.dmgMul;
}

const valueOf = (bt: TacBattle, t: TacStack, dmg: number) => (Math.min(dmg, hpOf(t)) / Math.max(1, hpOf(t))) * threat(bt, t) + (dmg >= hpOf(t) ? threat(bt, t) * 0.3 : 0);

/** docs/25 item 70: what the sea's mind takes a hold to be worth a round it holds, as a share of the strength it
 *  lifts or blunts (a blow, a cut of the other side's army, is worth that share of her strength once): measured by the
 *  engine itself (`node tools/balance-paths.ts --rates`, 1200 mirrors a line at levels 5, 15, 30, 45 and 60 — a side
 *  given the hold for three rounds against one given nothing, and against one that cut a share of the other's army
 *  before the first turn). Blows +20% for three rounds won as a strike of 15% did (0.25 a round); harm taken −20% a
 *  third more than blows +20% (0.33); two points of morale as a strike of 3%, of luck 5%, of speed 9%; initiative
 *  helps at some levels and hurts at others (+3: −12 … +20 points), 6% for three points on the mean. Before, harm
 *  taken was weighed 0.2, morale 0.015 and luck 0.02 a point: the sea's mind passed over «Шкура из ракушек» and «В
 *  каре» and gave a page of morale or luck before a blow. */
export const TAC_AI_RATE = { blow: 0.25, taken: 0.33, speed: 0.015, init: 0.007, morale: 0.005, luck: 0.008 };

/** What a path's move is worth to the sea's mind now (docs/18): its blows as the stacks' worth, its holds as a share
 *  of the strength they lift or blunt for the rounds they hold (TAC_AI_RATE), another turn as the stack's own. docs/25
 *  items 56 and 70: what a stack of hers shrugs off is worth that much less (`pierce`: the innate move and the
 *  ultimate pass every resistance), and the Drowned's own caps stand for her raising and her drowning. */
export function fxValue(bt: TacBattle, side: 0 | 1, fx: PageFx, k: number, t?: TacStack, common = false, pierce = false): number {
  const e = bt.heroes[1 - side];
  const foes = alive(bt).filter((o) => o.side !== side);
  const own = alive(bt).filter((o) => o.side === side);
  const P = spellPower(bt, side) * k * pathScale(bt, side, !common);
  const keep = (o: TacStack) => (pierce ? 1 : 1 - resistOf(bt, o));
  // docs/25 item 46: a common page's blast on one stack as it would land.
  const on1 = (o: TacStack, share: number) => (common && boardRules(bt) ? Math.min(P, TAC_BLAST_STACK * o.start * o.hpMax * blastScale(bt)) : P) * share * keep(o);
  const sum = (xs: TacStack[], f: (x: TacStack) => boolean = () => true) => xs.reduce((n, x) => n + (f(x) ? threat(bt, x) : 0), 0);
  const caps = common ? { raise: RAISE_CAP, drain: DRAIN_CAP } : capsOf(bt, side);
  const shoots = (x: TacStack) => isShooter(x) && x.shots > 0;
  let v = 0;
  if (t && t.side !== side) {
    if (fx.dmg) v += valueOf(bt, t, on1(t, fx.dmg));
    if (fx.ring) for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, on1(o, fx.ring));
    // The common pages after docs/18: the forked blow, the raking line, a sickness (its bites to come), a fire under
    // her (a burn or two before she moves off it).
    const hit = [t];
    for (let share = fx.dmg ?? 0; fx.chain && hit.length <= fx.chain; ) {
      const next = leapFrom(bt, side, hit[hit.length - 1], hit);
      if (!next) break;
      share *= CHAIN_FALL;
      v += valueOf(bt, next, on1(next, share));
      hit.push(next);
    }
    if (fx.row) for (const o of foes) if (hexY(o.hex) === hexY(t.hex)) v += valueOf(bt, o, on1(o, fx.row));
    if (fx.sicken && !sp(t, 'undead')) v += valueOf(bt, t, on1(t, fx.sicken * SICK_TURNS)) * (t.poison ? 0.5 : 0.85);
    if (fx.fire && bt.cells[t.hex] === '.') v += valueOf(bt, t, Math.max(t.hpMax, hpOf(t) * TAC_BURN)) * 1.5;
  }
  if (fx.mend && t && t.side === side) v += (Math.min(t.start * t.hpMax - hpOf(t), t.start * t.hpMax * Math.min(0.5, fx.mend * k)) / Math.max(1, hpOf(t))) * threat(bt, t);
  if (fx.all) for (const o of foes) v += valueOf(bt, o, on1(o, fx.all));
  if (fx.shooters) for (const o of foes) if (isShooter(o)) v += valueOf(bt, o, on1(o, fx.shooters));
  if (fx.drain) for (const o of foes) if (o.count > 1) v += valueOf(bt, o, o.count * Math.min(caps.drain, fx.drain * k) * o.hpMax * keep(o));
  const sh = fx.heal ?? fx.raise;
  if (sh) for (const x of own) if (!sp(x, 'undead') || fx.raise) v += (Math.min(x.start * x.hpMax - hpOf(x), x.start * x.hpMax * Math.min(fx.raise ? caps.raise : RAISE_CAP, sh * k)) / Math.max(1, hpOf(x))) * threat(bt, x);
  // The rounds it holds, as applyFx lays it (a path's move as written and her Power a round more at most) — of this
  // round, the share of its turns still to come.
  const left = Math.min(1, (bt.queue.length + 1) / Math.max(1, foes.length + own.length));
  const R = left + (fx.rounds ? (common ? fx.rounds + (fx.one?.still || fx.one?.mad ? 0 : holdOf(bt, side)) : pathHoldExtra(fx, bt.heroes[side].input.hero?.pow ?? 0)) : 0);
  // What is laid on her side is shrugged off by the share of her strength that resists.
  const foeKeep = pierce ? 1 : foes.reduce((n, o) => n + threat(bt, o) * keep(o), 0) / Math.max(1, sum(foes));
  const A = TAC_AI_RATE;
  // `cover`: the share of her fire one stack's own cover from her shots is worth (the whole of it for a whole side).
  const lay = (m: BtMods | undefined, mine: TacStack[], theirs: TacStack[], sign: 1 | -1, cover = 1) => {
    if (!m) return 0;
    let w = 0;
    w += sign * (m.melee ?? 0) * sum(mine, (x) => !shoots(x)) * A.blow;
    w += sign * (m.shot ?? 0) * sum(mine, shoots) * A.blow;
    w -= sign * (m.taken ?? 0) * sum(theirs) * A.taken;
    w -= sign * (m.shotTaken ?? 0) * sum(theirs, shoots) * A.taken * cover;
    w += sign * ((m.speed ?? 0) * A.speed + (m.init ?? 0) * A.init + (m.morale ?? 0) * A.morale + (m.luck ?? 0) * A.luck) * sum(mine);
    if (m.blind) w -= sign * sum(mine, (x) => shoots(x) && enemiesAdjacent(bt, x).length === 0) * 0.8;
    if (m.noRet) w += sign * sum(mine, (x) => !shoots(x)) * 0.1;
    if (m.noAnswer) w += sign * sum(mine) * 0.08;
    // Spellbound or maddened: her turns lost (a blow of ours may wake the one), the mad one's blows on her own.
    if (m.still) w -= sign * sum(mine) * 0.2;
    if (m.mad) w -= sign * sum(mine) * 0.45;
    return w * R;
  };
  v += lay(fx.self, own, foes, 1);
  v += lay(fx.foe, foes, own, -1) * foeKeep;
  if (fx.one && t) v += t.side === side ? lay(fx.one, [t], foes, 1, threat(bt, t) / Math.max(1, sum(own))) : lay(fx.one, [t], own, -1) * keep(t);
  // docs/25 item 70: another turn is a turn of blows — this round her smoke (Smoke and Knives) takes that share of them
  // (the Navigator gave her squall into the Smuggler's smoke and lost three in four).
  const blowsNow = Math.max(0.1, 1 - 0.5 * held(e, 'smoke_and_knives', bt.round));
  if (fx.again && t && t.side === side) v += threat(bt, t) * 0.9 * (fx.againShare ?? 1) * blowsNow;
  if (fx.allAgain) v += sum(own) * 0.6 * (fx.allShare ?? 1) * blowsNow;
  if (fx.free) v += Math.min(fx.free, own.length) / Math.max(1, own.length) * sum(own, (x) => !shoots(x)) * 0.15;
  v += ((fx.heart ?? 0) + (fx.dread ?? 0)) * 0.003 * sum(own);
  // The clearing wind: what she has laid on both decks undone for the rounds it had left (her orders given by hand
  // a share of the strength of both); the fires put out under hers and ours; her signals lost while she has an order
  // ready to give.
  if (fx.clear) {
    for (const f of e.fx) {
      if (f.until < bt.round || f.id.startsWith('role:')) continue;
      const on = f.on !== undefined ? alive(bt).filter((x) => x.id === f.on) : null;
      const n = Math.min(2, f.until - bt.round + 1);
      v += f.mods ? -(f.foe ? lay(f.mods, on ?? own, foes, 1) : lay(f.mods, on ?? foes, own, -1)) / R * n : 0.025 * (sum(own) + sum(foes)) * n;
    }
    v += Math.min(4, e.free) * 0.02 * sum(own, (x) => !shoots(x));
  }
  if (fx.douse) for (const x of [...own, ...foes]) if (bt.cells[x.hex] === 'F') v += (x.side === side ? 2 : -2) * threat(bt, x) * TAC_BURN;
  const hush = fx.hush ?? 0;
  if (hush && e.spells.some((x) => x.ready <= bt.round + hush - 1)) v += Math.max(0, bt.round + hush - 1 - Math.max(e.hush ?? 0, e.cast >= bt.round ? bt.round : bt.round - 1)) * 0.06 * sum(own);
  return Math.max(0, v);
}

/** The best stack to point a move at (or none), and what it is worth. */
function bestFx(bt: TacBattle, side: 0 | 1, fx: PageFx, k: number, common = false, pierce = false): { v: number; target?: number } {
  if (fx.target === 'none') return { v: fxValue(bt, side, fx, k, undefined, common, pierce) };
  let v = 0, target: number | undefined;
  for (const t of alive(bt)) {
    if ((fx.target === 'enemy') === (t.side === side)) continue;
    const x = fxValue(bt, side, fx, k, t, common, pierce);
    if (x > v) {
      v = x;
      target = t.id;
    }
  }
  return target === undefined ? { v: 0 } : { v, target };
}

type AiOrder = { id: TacSpellId; target?: number };

/** docs/25 item 70: the captains' own orders given by hand (castSpell's switch, blowParts) as the sea's mind reads them
 *  — what each lays, in the moves' own terms, so it weighs them by TAC_AI_RATE as it weighs a page. Before, every one
 *  of them was «a tenth of her strength» (the War Cry half that), whatever it did: the Navigator gave her Marlinspike
 *  before Turning the Flank, which wins her more. */
export const TAC_ORDER_READ: Partial<Record<TacSpellId, PageFx>> = {
  // Initiative +3, speed +1, every blow of hers a pincer (TAC_PINCER) — this round and the next, her Power longer.
  turn_the_flank: { target: 'none', self: { speed: 1, init: 3, melee: 0.2 }, rounds: 1 },
  // Her stacks' Defense ×1.4 (about a seventh less taken), her blows ×1.15, morale +1 and heart +10.
  iron_discipline: { target: 'none', self: { melee: 0.15, shot: 0.15, taken: -0.15, morale: 1 }, rounds: 1, heart: 10 },
  // Her blows ×1.25, the other side's morale −1.
  red_harvest: { target: 'none', self: { melee: 0.25, shot: 0.25 }, foe: { morale: -1 }, rounds: 1 },
  // This round every blow and shot on her side lands half as hard.
  smoke_and_knives: { target: 'none', self: { taken: -0.5 } },
  // Her morale +1 and heart +6, the other side's −1.
  war_cry: { target: 'none', self: { morale: 1 }, foe: { morale: -1 }, rounds: 1, heart: 6 },
  // The deep drags 8% of every stack of hers under (her Power on it), and her morale −1.
  call_of_the_deep: { target: 'none', drain: 0.08, foe: { morale: -1 }, rounds: 1 },
};

/** The captain's order the sea's mind would give now (or null): a page, or her path's innate move or ultimate. She
 *  keeps an eye on what is left of each store: the scarcer one, the dearer it seems (docs/18 item 8). */
function aiSpell(bt: TacBattle, side: 0 | 1, rng: Rng): AiOrder | null {
  const h = bt.heroes[side];
  if (h.cast >= bt.round || (h.hush ?? 0) >= bt.round) return null;
  const foes = alive(bt).filter((o) => o.side !== side);
  const own = alive(bt).filter((o) => o.side === side);
  let best: AiOrder | null = null, bv = 0;
  // What one of ours would do to her with a blow or a shot now (the expected one).
  const hitOn = (t: TacStack, x: TacStack) => blow(bt, x, t, canShoot(bt, x) ? 'shot' : 'melee', null).dmg;
  for (const s0 of h.spells) {
    if (s0.ready > bt.round || spellError(bt, side, s0.id, foes[0]?.id) === 'That scroll is read') continue;
    const cost = spellCost(bt, side, s0.id);
    const res = spellRes(bt, side, s0.id);
    const pool = poolOf(h, res);
    if (pool >= 0 && pool < cost) continue;
    // A thrifty captain: with a small store she keeps it for what is worth it (and the scarcer the store, the more).
    const max = res === 'stam' ? h.input.hero?.stamMax ?? 0 : h.input.hero?.manaMax ?? 0;
    const thrift = pool >= 0 && h.input.hero ? (1 - Math.min(0.5, cost / Math.max(1, max)) * 0.5) * (res === 'stam' && h.stam >= 0 ? 0.8 + 0.2 * Math.min(1, pool / Math.max(1, max)) : 1) : 1;
    const km = spellMul(bt, side, s0.id) * echoMul(bt, side, echoKey(s0.id), false);
    const pfx = pageFx(bt, side, s0.id);
    if (pfx) {
      const b = bestFx(bt, side, pfx, km, !isPathPage(s0.id));
      const v = b.v * thrift * (echoed(bt, side, s0.id) && (pfx.self || pfx.foe || pfx.one) ? 0.4 : 1);
      if (v > bv) {
        bv = v;
        best = { id: s0.id, ...(b.target !== undefined ? { target: b.target } : {}) };
      }
      continue;
    }
    const pick = (v: number, target?: number) => {
      v *= thrift;
      if (v > bv) {
        bv = v;
        best = { id: s0.id, ...(target !== undefined ? { target } : {}) };
      }
    };
    // docs/25 item 46: what a common order's blast would lay on each stack (the blast reckoned from the stack too).
    const P0 = spellPower(bt, side) * km;
    // docs/25 items 56 and 70: what a stack of hers shrugs off is worth that much less.
    const on1 = (o: TacStack, share: number) => (boardRules(bt) ? Math.min(P0, TAC_BLAST_STACK * o.start * o.hpMax * blastScale(bt)) : P0) * share * (1 - resistOf(bt, o));
    if (s0.id === 'musket_storm' || s0.id === 'maelstrom') {
      const share = s0.id === 'musket_storm' ? 0.45 : 0.55;
      pick(foes.reduce((n, t) => n + valueOf(bt, t, on1(t, share)), 0) + (s0.id === 'maelstrom' ? foes.reduce((n, t) => n + threat(bt, t), 0) * 0.03 : 0));
      continue;
    }
    if (s0.id === 'powder_keg') {
      for (const t of foes) {
        let v = valueOf(bt, t, on1(t, 2.4));
        for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, on1(o, 0.8));
        pick(v, t.id);
      }
      continue;
    }
    if (s0.id === 'tide_returns') {
      pick(own.reduce((n, x) => n + (Math.min(x.start * x.hpMax - hpOf(x), x.start * x.hpMax * commonHeal(bt, 'tide_returns', km)) / Math.max(1, hpOf(x))) * threat(bt, x), 0));
      continue;
    }
    if (s0.id === 'fury' || s0.id === 'shield_wall' || s0.id === 'dread' || s0.id === 'following_wind' || s0.id === 'head_wind') {
      const f = { fury: 0.14, shield_wall: 0.1, dread: 0.12, following_wind: 0.07, head_wind: 0.07 }[s0.id];
      pick((s0.id === 'fury' || s0.id === 'following_wind' ? own : foes).reduce((n, t) => n + threat(bt, t), 0) * f);
      continue;
    }
    if (s0.id === 'mark_target') {
      // A third more from every one of ours on her, for this round and the next.
      for (const t of foes) {
        const v = valueOf(bt, t, own.reduce((n, x) => n + hitOn(t, x), 0) * 0.3) * 0.6;
        if (v > bv) {
          bv = v;
          best = { id: s0.id, target: t.id };
        }
      }
    } else if (TAC_SPELLS[s0.id].target === 'enemy') {
      const k1 = s0.id === 'point_blank' ? pointBlank(bt, side) : 1;
      for (const t of foes) {
        let v = valueOf(bt, t, on1(t, k1));
        if (s0.id === 'grenades') for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, on1(o, 0.5));
        if (v > bv) {
          bv = v;
          best = { id: s0.id, target: t.id };
        }
      }
    } else {
      const read = TAC_ORDER_READ[s0.id];
      let v = read ? fxValue(bt, side, read, km, undefined, true) * orderK(bt, side, s0.id) : foes.reduce((n, t) => n + threat(bt, t), 0) * 0.12;
      if (s0.id === 'brine_mend') v = own.reduce((n, x) => n + (sp(x, 'undead') ? 0 : (Math.min(x.start * x.hpMax - hpOf(x), x.start * x.hpMax * commonHeal(bt, 'brine_mend', km)) / Math.max(1, hpOf(x))) * threat(bt, x)), 0);
      if (s0.id === 'double_shot') {
        // One shot more for every shooter, and a third on its shots for two rounds.
        v = 0;
        for (const x of own) {
          if (!isShooter(x) || !canShoot(bt, x) || !foes.length) continue;
          const d = Math.max(...foes.map((t) => valueOf(bt, t, blow(bt, x, t, 'shot', null).dmg)));
          v += d * (1 + 0.3 * Math.min(2, x.shots));
        }
        v *= 0.5;
      }
      if (v > bv) {
        bv = v;
        best = { id: s0.id };
      }
    }
  }
  return best && rng.chance(0.75) ? best : null;
}

/** Her path's innate move or ultimate the sea's mind would give now, beside the round's order (docs/18): free and
 *  once a battle each, so she gives them early but not blindly — the innate move when it is worth something, the
 *  ultimate once the decks have closed (from the second round), each at its best target. */
function aiMove(bt: TacBattle, side: 0 | 1, rng: Rng): { kind: 'innate' | 'ult'; target?: number } | null {
  const h = bt.heroes[side];
  const hb = h.input.hero;
  if (!hb?.path || h.moved >= bt.round || (h.hush ?? 0) >= bt.round) return null;
  let best: { kind: 'innate' | 'ult'; target?: number } | null = null, bv = 0;
  const total = alive(bt).filter((o) => o.side === side).reduce((n, x) => n + threat(bt, x), 0);
  for (const kind of ['ult', 'innate'] as const) {
    if ((kind === 'innate' ? h.innate : h.ult) !== 1 || (kind === 'ult' && bt.round < h.ultFrom)) continue;
    const mfx = powered(moveFx(hb.path, kind, hb.level ?? 1), hb.path, hb.level ?? 1, 'move');
    const b = bestFx(bt, side, mfx, moveMul(bt, side) * echoMul(bt, side, hb.path, false, kind), false, true);
    b.v *= echoed(bt, side, `${kind}:${hb.path}`) && (mfx.self || mfx.foe || mfx.one) ? 0.4 : 1;
    if (b.v > total * 0.03 && b.v > bv) {
      bv = b.v;
      best = { kind, ...(b.target !== undefined ? { target: b.target } : {}) };
    }
  }
  return best && rng.chance(0.6) ? best : null;
}

/** docs/25 item 52: what the sea's mind makes of the flags — a foe on ours is worth `defend` of her threat more to
 *  strike (and as much again a round she has held it); stepping on to hers is worth `take` of her whole side's threat. */
export const TAC_FLAG_AI = { defend: 1, take: 0.12 };

/** docs/25 item 62: the steps of the way a hex in cover from her shooters is worth to the sea's mind as it closes. */
export const TAC_COVER_STEP = 1.2;

/** What the sea's mind has the active stack do. */
export function aiChoice(bt: TacBattle, rng: Rng): TacAction {
  const s = stackById(bt, bt.active ?? -1)!;
  if (s.officer && !s.officer.used) {
    const o = s.officer.order;
    const h = bt.heroes[s.side];
    const own = alive(bt).filter((x) => x.side === s.side);
    const lost = own.reduce((n, x) => n + (x.start * x.hpMax - hpOf(x)), 0) / Math.max(1, h.startHp);
    const shooters = own.some(isShooter);
    const foeShoots = alive(bt).some((x) => x.side !== s.side && isShooter(x) && x.shots > 0);
    if ((o === 'rally' && lost > 0.25) || (o === 'lay_true' && shooters) || (o === 'steady' && moralePoints(bt, s.side) < 1) || (o === 'all_hands' && bt.round === 1)
      || (o === 'brace' && enemiesAdjacent(bt, s).length > 0) || (o === 'volley' && own.some((x) => isShooter(x) && canShoot(bt, x))) || (o === 'bandage' && lost > 0.15)
      || (o === 'canvas' && foeShoots) || o === 'harpoon') return { a: 'order' };
  }
  const foes = alive(bt).filter((o) => o.side !== s.side);
  // docs/25 item 62: on a deck, the hexes the mast, a barrel, crates or a gun shield from her shooters.
  const guns = onDeck(bt) ? foes.filter((t) => isShooter(t) && t.shots > 0 && !smods(bt, t).blind) : [];
  const covered = (h: number) => guns.some((t) => coverAt(bt, h, t.hex) >= 0);
  // A stack of hers held spellbound is left asleep while another is worth the blow.
  const nap = (t: TacStack) => (smods(bt, t).still ? 0.4 : 1);
  // docs/25 item 52: a stack of hers on our quarterdeck's flag is struck first, the more the longer she has held it.
  const fl = bt.flag;
  const onFlag = (t: TacStack) => (fl && t.hex === fl.hex[s.side] ? threat(bt, t) * TAC_FLAG_AI.defend * (1 + fl.held[t.side]) : 0);
  if (canShoot(bt, s)) {
    let best = foes[0], bv = -1;
    for (const t of foes) {
      const v = valueOf(bt, t, blow(bt, s, t, 'shot', null).dmg) * nap(t) + onFlag(t);
      if (v > bv) {
        bv = v;
        best = t;
      }
    }
    return { a: 'shoot', target: best.id };
  }
  const reach = reachOf(bt, s);
  let pick: { t: TacStack; from: number } | null = null, pv = -Infinity;
  for (const t of foes) {
    for (const h of hexNeighbors(t.hex)) {
      if (h !== s.hex && !reach.has(h)) continue;
      // docs/19 E5: the garrison strikes from within its walls, from the gate and the breaches, never from without.
      if (bt.siege && s.side === 1 && hexX(h) < SIEGE.wallX && !sp(s, 'flying')) continue;
      const dmg = blow(bt, s, t, 'melee', null, h).dmg * (sp(s, 'double_strike') ? 2 : 1);
      const answered = t.ret && !sp(s, 'no_retaliation') && !sp(s, 'sweep') && dmg < hpOf(t);
      const v = valueOf(bt, t, dmg) * nap(t) - (answered ? 0.5 * valueOf(bt, s, blow(bt, t, s, 'ret', null).dmg) : 0) - (h === s.hex ? 0 : 0.01 * (reach.get(h) ?? 0)) - (bt.cells[h] === 'F' ? threat(bt, s) * 0.1 : 0)
        - (bt.siege && bt.cells[h] === 'O' ? threat(bt, s) * 0.05 : 0) + onFlag(t) + (guns.length && covered(h) ? threat(bt, s) * 0.02 : 0);
      if (v > pv) {
        pv = v;
        pick = { t, from: h };
      }
    }
  }
  // docs/25 item 52: the other's flag — held, she strikes from it or stands; within reach and worth more than her best
  // blow, she steps on to it.
  if (fl) {
    const goal = fl.hex[1 - s.side];
    if (s.hex === goal) return pick && pick.from === s.hex ? { a: 'attack', target: pick.t.id, from: s.hex } : { a: 'defend' };
    if (reach.has(goal)) {
      const worth = foes.reduce((n, t) => n + threat(bt, t), 0) * TAC_FLAG_AI.take;
      if (!pick || worth > pv) return { a: 'move', to: goal };
    }
  }
  if (pick) return { a: 'attack', target: pick.t.id, from: pick.from };
  if (bt.siege) return siegeMove(bt, s, reach);
  // Out of reach: close on the nearest foe (a shooter out of shot waits behind the steel), round the fires. The way is
  // counted round what stands on deck (docs/25, 2026-10-09: by the straight line a stack two hexes from a foe behind the
  // mast and a barrel stood «defending» to the twentieth round, and so did the foe). The land's fights keep the straight
  // line they were calibrated on.
  const way = boardRules(bt) ? siegeDist(bt, s) : null;
  const line = (h: number) => Math.min(...foes.map((t) => hexDist(h, t.hex)));
  const far = (h: number) => (way ? way.get(h) ?? 50 + line(h) : line(h)) + (bt.cells[h] === 'F' ? 1.5 : 0);
  // docs/25 item 62: of the hexes that bring her nearer, one in cover from her shooters is worth a step of the way.
  const here = far(s.hex);
  let to: number | null = null, td = Infinity, score = Infinity;
  for (const [h] of reach) {
    const d = far(h);
    if (d >= here) continue;
    const v = d - (guns.length && covered(h) ? TAC_COVER_STEP : 0);
    if (v < score) {
      score = v;
      td = d;
      to = h;
    }
  }
  if (to === null || td >= here) {
    // Nowhere nearer: out of her shooters' sight behind the mast or a barrel, if a step takes her there.
    if (guns.length && !covered(s.hex)) for (const [h] of reach) if (covered(h) && line(h) <= line(s.hex)) return { a: 'move', to: h };
    return { a: 'defend' };
  }
  return { a: 'move', to };
}

/** The sea's mind (or a captain's auto-battle) plays the active turn: an order from the side panel, then the stack. */
export function aiAct(bt: TacBattle, now: number, rng: Rng): void {
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  if (!s || bt.over) return;
  // docs/25 item 64: an ally's stack is played as hers — her path move and order from her own book.
  const slot = s.own ?? 0;
  asCaptain(bt, s.side, slot, () => {
    const mv = aiMove(bt, s.side, rng);
    if (mv) castMove(bt, s.side, mv.kind, mv.target, rng);
    if (bt.over) return;
    const spl = aiSpell(bt, s.side, rng);
    if (spl) castSpell(bt, s.side, spl.id, spl.target, rng);
  });
  if (bt.over) return;
  const choice = aiChoice(bt, rng);
  if (act(bt, s.side, choice, now, rng, slot) !== null) act(bt, s.side, { a: 'defend' }, now, rng, slot);
}

/** The longest a film at a fight's start holds the clock, in ms as the client sends it (the reels are 5 s clips; with
 *  their fades). */
export const TAC_FILM_HOLD = 8000;

/** The clock: the sea's side (and auto-battle) acts after a breath; a captain's turn runs out into a defence. */
export function stepBattle(bt: TacBattle, now: number, rng: Rng): void {
  if (bt.over || bt.active === null) return;
  const s = stackById(bt, bt.active);
  if (!s) return nextTurn(bt, now, rng);
  const h = capOf(bt, s);
  if (h.auto) {
    if (now >= bt.aiAt) aiAct(bt, now, rng);
    return;
  }
  if (now >= bt.turnEnds) {
    push(bt, { k: 'timeout', side: s.side, s: s.id });
    act(bt, s.side, { a: 'defend' }, now, rng, s.own ?? 0);
  }
}

/** docs/25 item 49: a side's strength as the quick fight's offer weighs it — HoMM3's square law over what stands on
 *  deck: her hit points behind her Defense by her blows behind her Attack, the ladder, her captain's skills and
 *  artifacts on both. */
export function sideStrength(bt: TacBattle, side: 0 | 1): number {
  const inp = bt.heroes[side].input, hb = inp.hero;
  let hp = 0, dmg = 0;
  for (const s of alive(bt)) {
    if (s.side !== side) continue;
    hp += hpOf(s) * (1 + 0.05 * s.def);
    dmg += ((s.count * (s.dmin + s.dmax)) / 2) * (1 + 0.05 * s.atk) * (isShooter(s) ? 1.15 : 1) * (sp(s, 'double_strike') ? 1.5 : 1) * s.dmgMul;
  }
  dmg *= inp.dealt * inp.power * inp.melee * (inp.struck ? 0.1 : 1) * (1 + (hb?.melee ?? 0));
  hp /= Math.max(0.5, 1 - (hb?.taken ?? 0));
  return Math.sqrt(Math.max(0, hp * dmg));
}

/** Quick combat: both sides played out by the sea's mind at once — the same rules, the same dice, only faster. */
export function quickFinish(bt: TacBattle, now: number, rng: Rng): void {
  for (let i = 0; i < 5000 && !bt.over; i++) {
    if (bt.active === null) break;
    aiAct(bt, now, rng);
  }
  if (!bt.over) bt.over = { winner: 1, why: 'rounds' };
}

// ------------------------------------------------------------------ the reckoning

/** Men of each kind a side lost (the start less the living, the risen counted back). */
export function lossesOf(bt: TacBattle, side: 0 | 1, slot?: number): { u: UnitId; n: number }[] {
  const by = new Map<UnitId, number>();
  // docs/25 item 67: one captain's own (`slot`; 0 the side's own captain), or the whole side's.
  for (const s of bt.stacks) if (s.side === side && s.start > s.count && (slot === undefined || (s.own ?? 0) === slot)) by.set(s.unit, (by.get(s.unit) ?? 0) + s.start - s.count);
  return [...by].map(([u, n]) => ({ u, n }));
}

/** Hit points of the other side's men cut down: what the victor's captain learns from the fight (HoMM3 reckons a
 *  hero's experience so). */
export function killedHp(bt: TacBattle, side: 0 | 1): number {
  let hp = 0;
  for (const s of bt.stacks) if (s.side !== side) hp += Math.max(0, s.start - s.count) * s.hpMax;
  return hp;
}

// ------------------------------------------------------------------ what a captain sees

/** What lies on a stack for the field's marks (docs/18). */
function flagsOf(bt: TacBattle, s: TacStack): Partial<TacStackView> {
  const m = smods(bt, s);
  const out: Partial<TacStackView> = {};
  if (m.blind && isShooter(s)) out.blind = true;
  if (s.again > 0 || (bt.queue.filter((id) => id === s.id).length > 1)) out.again = true;
  if (m.noRet) out.noRet = true;
  if (m.steady && m.taken < 0) out.braced = true;
  if (s.poison) out.poisoned = true;
  if (bt.cells[s.hex] === 'W') out.wet = true;
  if (m.still) out.still = true;
  if (m.mad) out.mad = true;
  return out;
}

export function viewOf(bt: TacBattle, side: 0 | 1, now: number, canCut: boolean, extra: Partial<Pick<TacView, 'ransom' | 'result' | 'land' | 'canStrike' | 'arena' | 'quickNow' | 'noQuick'>> = {}, slot = 0): TacView {
  const act0 = bt.active !== null ? stackById(bt, bt.active) : undefined;
  // docs/25 item 64: an ally sees her own stacks' turns as hers, and her own captain on her side's panel.
  const mine = !!act0 && act0.side === side && (act0.own ?? 0) === slot && !bt.over && !capOf(bt, act0).auto;
  const reach = mine && act0 ? reachOf(bt, act0) : new Map<number, number>();
  const stacks: TacStackView[] = bt.stacks.filter((s) => s.count > 0).map((s) => ({
    id: s.id, side: s.side, kind: s.kind, unit: s.unit, sp: s.sp, count: s.count, start: s.start, hp: s.hpTop, hpMax: s.hpMax, hex: s.hex, atk: s.atk, def: s.def, dmg: [s.dmin, s.dmax],
    speed: speedOf(bt, s), init: initOf(bt, s), shots: s.shots, shotsMax: s.shotsMax, ret: s.ret, defending: s.defending, waited: s.waited, face: s.face,
    ...(s.officer ? { officer: { role: s.officer.role, name: s.officer.name, ...(s.officer.unique ? { unique: s.officer.unique } : {}), order: s.officer.order, ready: !s.officer.used } } : {}),
    ...(bt.heroes[s.side].fx.some((f) => f.id === 'mark_target' && f.on === s.id && f.until >= bt.round) || bt.heroes[1 - s.side].fx.some((f) => f.id === 'mark_target' && f.on === s.id && f.until >= bt.round) ? { marked: true } : {}),
    ...flagsOf(bt, s),
    ...(resistOf(bt, s) > 0 ? { resist: Math.round(resistOf(bt, s) * 100) / 100 } : {}),
    ...(s.own ? { own: s.own } : {}),
  }));
  const hero = (x: 0 | 1): TacHeroView => {
    const h = bt.heroes[x];
    const hb = h.input.hero;
    return {
      name: h.input.name, ship: h.input.ship, ...(h.input.hull ? { hull: h.input.hull } : {}), captain: h.input.captain, morale: moralePoints(bt, x), luck: luckOf(bt, x), spells: h.spells.filter((s0) => !hb?.scroll?.[s0.id] || onScroll(bt, x, s0.id)).map((s0) => ({ id: s0.id, ready: s0.ready, ...(hb ? { cost: spellCost(bt, x, s0.id), res: spellRes(bt, x, s0.id) } : {}), ...(hb?.scroll?.[s0.id] ? { scroll: hb.scroll[s0.id]! - h.scrollsUsed.filter((y) => y === s0.id).length } : {}) })), cast: h.cast >= bt.round || (h.hush ?? 0) >= bt.round, ...((h.hush ?? 0) >= bt.round ? { hush: true } : {}), auto: h.auto, ...(h.fast ? { fast: true } : {}), men: alive(bt).filter((s) => s.side === x).reduce((n, s) => n + s.count, 0), menStart: h.startMen,
      ...(hb ? { prim: { atk: hb.atk, def: hb.def, pow: hb.pow, will: hb.will }, mana: Math.round(h.mana), manaMax: hb.manaMax } : {}),
      // docs/18: her path, stamina, innate move and ultimate, her spells' stores and scrolls, her face.
      ...(hb?.level !== undefined ? { path: hb.path ?? null, level: hb.level } : {}),
      ...(h.stam >= 0 && hb?.path ? { stam: Math.round(h.stam), stamMax: hb.stamMax ?? 0 } : {}),
      ...(hb?.path ? { innate: h.innate === 1 ? 'ready' as const : 'used' as const, ult: !hb.ult ? 'locked' as const : h.ult === 1 ? 'ready' as const : 'used' as const, ultFrom: h.ultFrom } : {}),
      ...(h.input.face ? { face: h.input.face } : {}),
    };
  };
  const next = alive(bt).sort((x, y) => initOf(bt, y) - initOf(bt, x) || x.id - y.id).map((s) => s.id).slice(0, 6);
  return {
    you: side, round: bt.round, maxRounds: TAC_MAX_ROUNDS, cells: bt.cells.join(''), stacks,
    order: [...(bt.active !== null ? [bt.active] : []), ...bt.queue.filter((id) => stackById(bt, id))], next, active: bt.active, mine, ends: bt.turnEnds,
    reach: [...reach.keys()], melee: mine && act0 ? meleeTargets(bt, act0, reach).map((t) => t.id) : [], shoot: mine && act0 && canShoot(bt, act0) ? alive(bt).filter((t) => t.side !== side).map((t) => t.id) : [],
    ...(mine && act0 ? { pv: previewsOf(bt, act0, reach) } : {}),
    heroes: ([0, 1] as const).map((x) => (x === side && slot ? asCaptain(bt, side, slot, () => hero(x)) : hero(x))) as [TacHeroView, TacHeroView], log: bt.log.slice(-12), seq: bt.seq, over: bt.over, canCut, canStrike: side === 1, ...(bt.warn?.length && !bt.over ? { warn: [...bt.warn] } : {}), ...extra,
    ...(bt.siege ? { siege: { type: bt.land ?? 'rocky', hp: [...bt.siege.hp], max: [...bt.siege.max], cat: bt.siege.catapult, ...(bt.siege.name ? { name: bt.siege.name } : {}) } } : {}),
    // docs/25 block Г: the level, the turn's seconds, the chess clocks, the flags.
    level: bt.level, turn: tacTurnSecs(bt.level),
    ...(bt.heroes.some((h) => h.bank >= 0) ? { bank: [Math.round(bt.heroes[0].bank * 10) / 10, Math.round(bt.heroes[1].bank * 10) / 10] as [number, number] } : {}),
    ...(bt.flag ? { flag: { hex: [...bt.flag.hex] as [number, number], held: [...bt.flag.held] as [number, number], need: TAC_LEN.flag.rounds } } : {}),
    // docs/25 item 64: the allied captains on the field (and who comes aboard as the next round opens), her own slot.
    ...(slot ? { slot } : {}),
    ...(bt.allies?.length ? { allies: [...([0, 1] as const).map((x) => ({ side: x, slot: 0, hero: bt.heroes[x], joined: 1 })), ...bt.allies].map((x): TacAllyView => {
      const hb = x.hero.input.hero;
      // The side's own captain's men as she came, without her allies' (her side's count carries theirs).
      const start = x.slot ? x.hero.startMen : x.hero.startMen - (bt.allies ?? []).filter((y) => y.side === x.side).reduce((n, y) => n + y.hero.startMen, 0);
      return {
        side: x.side, slot: x.slot, name: x.hero.input.name, ship: x.hero.input.ship, captain: x.hero.input.captain, ...(hb?.path ? { path: hb.path } : {}), ...(hb?.level ? { level: hb.level } : {}),
        ...(x.hero.input.face ? { face: x.hero.input.face } : {}), ...(x.hero.bank >= 0 ? { bank: Math.round(x.hero.bank * 10) / 10 } : {}), auto: x.hero.auto, cast: x.hero.cast >= bt.round,
        men: alive(bt).filter((s) => s.side === x.side && (s.own ?? 0) === x.slot).reduce((n, s) => n + s.count, 0), menStart: Math.max(0, start), joined: x.joined, ...(x.side === side && x.slot === Math.max(0, slot) ? { you: true } : {}),
      };
    }) } : {}),
    ...(bt.joinQ?.length ? { coming: bt.joinQ.map((q) => ({ side: q.side, name: q.input.name, ...(q.input.hero?.path ? { path: q.input.hero.path } : {}) })) } : {}),
  };
}

// ------------------------------------------------------------------ the great ones ashore

/** The battle's own hand for a system that plays a great one's moves between the turns (server/src/game/
 *  shorebosses.ts, owner 2026-10-03): harm laid on a stack and its fallen counted as a blow's are, an event told to the
 *  captain, a stack's strength in hit points. */
export const tacHurt = hurt;
export const tacPush = push;
export const tacHp = hpOf;
