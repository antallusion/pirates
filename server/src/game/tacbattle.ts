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
  TAC_AI_DELAY, TAC_BLOCKING, TAC_BURN, TAC_CHANCE_PER_POINT, TAC_FEAR, TAC_GAP, TAC_H, TAC_LONG_SHOT, TAC_MAX_ROUNDS, TAC_ORDER_OF, TAC_SPELLS, TAC_TURN, TAC_UNITS, TAC_W,
  captainSpells, hexDist, hexIndex, hexMirror, hexNeighbors, hexX, kindOfUnit,
} from '../../../shared/src/data/tactical.ts';
import type { TacCell, TacKind, TacOrderId, TacSpellId } from '../../../shared/src/data/tactical.ts';
import type { TacAction, TacEvent, TacHeroView, TacStackView, TacView } from '../../../shared/src/protocol.ts';
import { ORDERS, TACTICS_DEPLOY } from '../../../shared/src/data/hero.ts';
import type { HeroBattle } from '../../../shared/src/data/hero.ts';
import { Rng } from '../../../shared/src/rng.ts';

/** One stack of a ship's army as it comes to the battle; `src` the ship's own stack its men are drawn from (the
 *  Marines talent drills hands into marines for the fight only). */
export interface TacArmyEntry {
  u: UnitId;
  n: number;
  src?: UnitId;
}

/** What one side brings to the fight, as the ship and her crew make it. */
export interface TacSideInput {
  name: string;
  ship: string;
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
  officer?: { id: string; role: OfficerRole; name: string; unique?: string; order: TacOrderId; used: boolean };
}

interface Fx {
  id: string;
  /** The last round it holds. */
  until: number;
  /** The stack it is laid on (Mark Target). */
  on?: number;
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
  fx: Fx[];
  kills: number;
  startHp: number;
  startMen: number;
  cutTried: number;
}

export interface TacBattle {
  cells: TacCell[];
  stacks: TacStack[];
  heroes: [TacHero, TacHero];
  round: number;
  queue: number[];
  active: number | null;
  turnEnds: number;
  aiAt: number;
  log: TacEvent[];
  events: number;
  seq: number;
  over: null | { winner: 0 | 1; why: 'rout' | 'struck' | 'rounds' | 'ransom' };
  /** Men fallen on each side so far. */
  dead: [number, number];
  /** Officers whose party was broken (dead) or badly cut (hurt). */
  hurt: { id: string; side: 0 | 1; heavy: boolean }[];
  broken: [number, number];
}

const sp = (s: TacStack, x: UnitSpecial): boolean => s.sp.includes(x);
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
      let shots = d.shots ? d.shots + input.extraShots : 0;
      if (blast && gunsOut > 0) shots = Math.max(1, Math.round(shots * (1 - gunsOut)));
      out.push({
        id: id++, side, kind: kindOfUnit(e.u), unit: e.u, sp: [...d.specials], src: e.src ?? e.u, count: Math.floor(e.n), start: Math.floor(e.n), hpTop: d.hp, hpMax: d.hp, hex: -1,
        atk: r1(d.atk), def: r1(d.def), dmin: d.dmin, dmax: d.dmax, speed: d.speed, init: d.init, shots, shotsMax: shots, dmgMul: blast ? 1 - 0.5 * gunsOut : 1,
        ret: true, defending: false, waited: false, surged: false,
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
        shots, shotsMax: shots, dmgMul: 1, ret: true, defending: false, waited: false, surged: false, ...extra,
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

function newHero(input: TacSideInput, stacks: TacStack[]): TacHero {
  const lucky = input.officers.filter((o) => o.lucky).length;
  return {
    input, morale: Math.max(0, Math.min(100, input.morale)), luck: Math.max(-3, Math.min(3, 1 + lucky + (input.hero?.luck ?? 0))),
    mana: input.hero ? input.hero.mana : -1,
    spells: (input.hero ? input.hero.book : captainSpells(input.captain)).map((id) => ({ id, ready: 1 })), cast: 0, auto: !input.human, fx: [], kills: 0,
    startHp: stacks.reduce((n, s) => n + hpOf(s), 0), startMen: stacks.reduce((n, s) => n + s.count, 0), cutTried: 0,
  };
}

/** A battle laid out: the field, what the guns left of each deck, both sides' stacks, round one about to open. */
export function newBattle(a: TacSideInput, b: TacSideInput, seed: number, now: number, rng: Rng): TacBattle {
  const cells = makeField(seed);
  for (const [x, side] of [[a, 0], [b, 1]] as const) if ((x.holes ?? 0) > 0 || x.fire) scarDeck(cells, side, x.holes ?? 0, !!x.fire, seed);
  // Tactics (docs/17 H2): the higher hand has the field, the lower none.
  const ta = a.hero?.tactics ?? 0, tb = b.hero?.tactics ?? 0;
  const sa = buildStacks(a, 0, cells, 1, ta > tb ? TACTICS_DEPLOY[ta] : 0);
  const sb = buildStacks(b, 1, cells, sa.length + 1, tb > ta ? TACTICS_DEPLOY[tb] : 0);
  const bt: TacBattle = {
    cells, stacks: [...sa, ...sb], heroes: [newHero(a, sa), newHero(b, sb)], round: 0, queue: [], active: null, turnEnds: now, aiAt: now,
    log: [], events: 0, seq: 0, over: null, dead: [0, 0], hurt: [], broken: [0, 0],
  };
  checkOver(bt);
  if (!bt.over) newRound(bt, now, rng);
  return bt;
}

// ------------------------------------------------------------------ what a stack is worth right now

const alive = (bt: TacBattle) => bt.stacks.filter((s) => s.count > 0);
export const stackById = (bt: TacBattle, id: number): TacStack | undefined => bt.stacks.find((s) => s.id === id && s.count > 0);
const has = (h: TacHero, id: string, round: number) => h.fx.some((f) => f.id === id && f.until >= round);
const sideHas = (bt: TacBattle, side: 0 | 1, x: UnitSpecial) => bt.stacks.some((s) => s.side === side && s.count > 0 && sp(s, x));

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
  return Math.max(-3, Math.min(3, m));
}

/** The morale one stack fights with: the dead feel none, the steady never break. */
export function stackMorale(bt: TacBattle, s: TacStack): number {
  if (sp(s, 'undead')) return 0;
  const m = moralePoints(bt, s.side);
  return sp(s, 'steady') ? Math.max(0, m) : m;
}

function speedOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side], e = bt.heroes[1 - s.side];
  const v = s.speed + (has(h, 'turn_the_flank', bt.round) || has(h, 'all_hands', bt.round) ? 1 : 0) + (has(h, 'following_wind', bt.round) ? 1 : 0);
  return Math.max(1, v - (has(e, 'head_wind', bt.round) ? 1 : 0));
}

function initOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side], e = bt.heroes[1 - s.side];
  return s.init + (has(h, 'turn_the_flank', bt.round) ? 3 : 0) + (has(h, 'all_hands', bt.round) ? 2 : 0) + (has(h, 'following_wind', bt.round) ? 2 : 0)
    - (has(e, 'head_wind', bt.round) ? 2 : 0) + (bt.round <= 1 ? h.input.hero?.init1 ?? 0 : 0);
}

const passable = (bt: TacBattle, i: number, self: TacStack | null) => !TAC_BLOCKING.has(bt.cells[i]) && !bt.stacks.some((s) => s.count > 0 && s !== self && s.hex === i);

/** Steps to every hex the stack can reach this turn (by the path around obstacles and stacks). */
export function reachOf(bt: TacBattle, s: TacStack): Map<number, number> {
  const out = new Map<number, number>();
  const spd = speedOf(bt, s);
  const seen = new Map<number, number>([[s.hex, 0]]);
  let frontier = [s.hex];
  for (let d = 1; d <= spd && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const j of hexNeighbors(i)) {
        if (seen.has(j) || !passable(bt, j, s)) continue;
        seen.set(j, d);
        out.set(j, d);
        next.push(j);
      }
    }
    frontier = next;
  }
  return out;
}

const enemiesAdjacent = (bt: TacBattle, s: TacStack, at = s.hex) => alive(bt).filter((o) => o.side !== s.side && hexNeighbors(at).includes(o.hex));

/** May the stack shoot: shots loaded and no foe at arm's length. */
export function canShoot(bt: TacBattle, s: TacStack): boolean {
  return s.shots > 0 && enemiesAdjacent(bt, s).length === 0;
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

/** Damage `s` does to `t` (rng null: the expected blow, for the sea's mind). */
export function blow(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot' | 'ret', rng: Rng | null, from = s.hex): { dmg: number; lucky: boolean } {
  const h = bt.heroes[s.side], e = bt.heroes[t.side];
  const r = bt.round;
  const defMul = (t.defending ? 1.3 : 1) * (e.input.castle && t.side === 1 ? 1.25 : 1) * (has(e, 'iron_discipline', r) ? 1.4 : 1) * (has(e, 'shield_wall', r) ? 1.3 : 1);
  const a = s.atk, d = t.def * defMul;
  const mod = Math.max(0.3, Math.min(3, a >= d ? 1 + 0.05 * (a - d) : 1 / (1 + 0.05 * (d - a))));
  let mul = h.input.dealt * h.input.power * (how === 'shot' ? 1 : h.input.melee) * s.dmgMul;
  if (r === 1) mul *= h.input.firstRush * Math.max(0.2, 1 - e.input.nets);
  mul *= 1 + Math.min(0.2, h.kills * h.input.blooded);
  if (h.input.struck) mul *= 0.1;
  if (has(h, 'red_harvest', r)) mul *= 1.25;
  if (has(h, 'iron_discipline', r)) mul *= 1.15;
  if (has(e, 'smoke_and_knives', r)) mul *= 0.5;
  if (h.fx.some((f) => f.id === 'mark_target' && f.on === t.id && f.until >= r)) mul *= 1.3;
  // The heroes' skills and artifacts (docs/17 H2): her blows and shots, the other's armour; Fury on the melee.
  const hb = h.input.hero, eb = e.input.hero;
  if (hb) mul *= 1 + (how === 'shot' ? hb.shot : hb.melee);
  if (eb) mul *= 1 - eb.taken;
  if (how !== 'shot' && has(h, 'fury', r)) mul *= 1.3;
  if (how === 'shot') {
    if (hexDist(from, t.hex) > TAC_LONG_SHOT && !sp(s, 'no_penalty')) mul *= 0.5;
    if (has(h, 'lay_true', r)) mul *= 1.25;
    if (has(h, 'double_shot', r)) mul *= 1.3;
    if (sp(t, 'shield_wall')) mul *= 0.5;
  } else if (isShooter(s) && !sp(s, 'no_penalty')) mul *= 0.5; // a musket is a poor club
  // Flanking: a foe already engaged by another of ours on her other side.
  // Turn the Flank: the navigator reads the deck, every blow of his men lands as from the flank.
  if (how === 'melee' && (has(h, 'turn_the_flank', r) || alive(bt).some((o) => o.side === s.side && o !== s && hexNeighbors(t.hex).includes(o.hex)))) mul *= 1.2;
  // Backs to the rail (docs/17 H5): the side with less of her strength left on deck strikes harder by the shortfall —
  // a tenth fewer men is a hard fight, not a lost one.
  mul *= desperation(bt, s.side);
  const lucky = !!rng && rng.chance(h.luck * TAC_CHANCE_PER_POINT);
  if (lucky) mul *= 2;
  return { dmg: Math.max(1, Math.round(rollBase(s, rng) * mod * mul)), lucky };
}

/** Lay `dmg` on a stack: its foremost man's hit points, then whole men. Returns the fallen. */
function hurt(bt: TacBattle, t: TacStack, dmg: number, by: 0 | 1): number {
  const before = t.count;
  const left = hpOf(t) - dmg;
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
    bt.heroes[by].kills += kills;
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

function push(bt: TacBattle, e: Omit<TacEvent, 'i'>): void {
  bt.log.push({ i: ++bt.events, ...e });
  if (bt.log.length > 40) bt.log.splice(0, bt.log.length - 40);
  bt.seq++;
}

function oneBlow(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng, k: 'hit' | 'ret'): void {
  const { dmg, lucky } = blow(bt, s, t, k === 'ret' ? 'ret' : 'melee', rng);
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const kills = hurt(bt, t, dmg, s.side);
  push(bt, { k, side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex });
}

/** Her answer: once a round (every blow for a guard that answers all), by what is left of her. */
function retaliate(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  if (t.count <= 0 || s.count <= 0 || !t.ret || sp(s, 'no_retaliation')) return;
  if (!sp(t, 'retaliate_all')) t.ret = false;
  oneBlow(bt, t, s, rng, 'ret');
}

function strike(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  // The deep's spawn sweeps every foe about it, and none of them answers.
  if (sp(s, 'sweep')) {
    for (const o of [t, ...enemiesAdjacent(bt, s).filter((o) => o !== t)]) if (o.count > 0) oneBlow(bt, s, o, rng, 'hit');
    return;
  }
  oneBlow(bt, s, t, rng, 'hit');
  retaliate(bt, s, t, rng);
  // Double strike: the second blow after her answer, if both still stand.
  if (sp(s, 'double_strike') && s.count > 0 && t.count > 0) oneBlow(bt, s, t, rng, 'hit');
}

function shoot(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  const { dmg, lucky } = blow(bt, s, t, 'shot', rng);
  s.shots--;
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const ring = sp(s, 'blast') ? alive(bt).filter((o) => o.side !== s.side && o !== t && hexNeighbors(t.hex).includes(o.hex)) : [];
  const kills = hurt(bt, t, dmg, s.side);
  push(bt, { k: 'shot', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex });
  // A swivel gun's burst: the stacks beside the target take half as much.
  for (const o of ring) {
    const b = Math.max(1, Math.round(blow(bt, s, o, 'shot', null).dmg * 0.5));
    const k2 = hurt(bt, o, b, s.side);
    push(bt, { k: 'shot', side: s.side, s: s.id, t: o.id, dmg: b, kills: k2, hex: o.hex, id: 'blast' });
  }
}

// ------------------------------------------------------------------ the captains' orders

/** The captain's blast: a share of his own side's strength at the start, cut by the ladder. */
function spellPower(bt: TacBattle, side: 0 | 1): number {
  const h = bt.heroes[side];
  return h.startHp * 0.07 * h.input.dealt * h.input.power * (h.input.struck ? 0.1 : 1);
}

/** The fallen of a side stand up again: a share of each stack's strength as it came aboard. */
function heal(bt: TacBattle, side: 0 | 1, share: number): void {
  for (const x of bt.stacks) {
    if (x.side !== side || x.count <= 0 || sp(x, 'undead')) continue;
    const room = x.start * x.hpMax - hpOf(x);
    const amount = Math.min(room, Math.round(x.start * x.hpMax * share));
    if (amount <= 0) continue;
    const tot = hpOf(x) + amount;
    const was = x.count;
    x.count = Math.ceil(tot / x.hpMax);
    x.hpTop = tot - (x.count - 1) * x.hpMax;
    bt.dead[side] = Math.max(0, bt.dead[side] - (x.count - was));
  }
}

/** The will an order costs this side (0 in the old reckoning). */
export function spellCost(bt: TacBattle, side: 0 | 1, id: TacSpellId): number {
  const hb = bt.heroes[side].input.hero;
  return hb ? hb.cost[id] ?? ORDERS[id]?.cost ?? 0 : 0;
}

/** How much stronger the hero makes this order (her Power, her school's skill, Mysticism, artifacts). */
function spellMul(bt: TacBattle, side: 0 | 1, id: TacSpellId): number {
  const hb = bt.heroes[side].input.hero;
  return hb ? hb.mul[ORDERS[id]?.school ?? 'fire'] ?? 1 : 1;
}

/** Rounds an order's effect holds past the next: a strong Power holds it longer (HoMM3's duration by power). */
function holdOf(bt: TacBattle, side: 0 | 1): number {
  const pow = bt.heroes[side].input.hero?.pow ?? 0;
  return pow >= 20 ? 2 : pow >= 10 ? 1 : 0;
}

export function spellError(bt: TacBattle, side: 0 | 1, id: TacSpellId, target?: number): string | null {
  const h = bt.heroes[side];
  const sp0 = h.spells.find((x) => x.id === id);
  if (!sp0) return 'Your captain has no such order';
  if (h.cast >= bt.round) return 'One captain\'s order a round';
  if (sp0.ready > bt.round) return 'That order is not ready yet';
  if (h.mana >= 0 && h.mana < spellCost(bt, side, id)) return 'Not enough will';
  if (TAC_SPELLS[id].target === 'enemy') {
    const t = target !== undefined ? stackById(bt, target) : undefined;
    if (!t || t.side === side) return 'Point at one of her stacks';
  }
  return null;
}

export function castSpell(bt: TacBattle, side: 0 | 1, id: TacSpellId, target: number | undefined, rng: Rng): string | null {
  const why = spellError(bt, side, id, target);
  if (why) return why;
  const h = bt.heroes[side];
  const sp0 = h.spells.find((x) => x.id === id)!;
  sp0.ready = bt.round + TAC_SPELLS[id].cd;
  h.cast = bt.round;
  if (h.mana >= 0) h.mana = Math.max(0, h.mana - spellCost(bt, side, id));
  const r = bt.round;
  const t = target !== undefined ? stackById(bt, target) : undefined;
  let kills = 0;
  const k = spellMul(bt, side, id);
  const hold = r + 1 + holdOf(bt, side);
  const P = spellPower(bt, side) * (0.85 + rng.float() * 0.3) * k;
  const foes = () => alive(bt).filter((o) => o.side !== side);
  switch (id) {
    case 'grenades':
      if (t) {
        const ring = alive(bt).filter((o) => o.side !== side && o !== t && hexNeighbors(t.hex).includes(o.hex));
        kills += hurt(bt, t, Math.round(P), side);
        for (const o of ring) kills += hurt(bt, o, Math.round(P / 2), side);
      }
      break;
    case 'point_blank':
      if (t) kills += hurt(bt, t, Math.round(P * 1.6), side);
      break;
    case 'call_of_the_deep':
      for (const o of alive(bt)) if (o.side !== side && o.count > 1) kills += hurt(bt, o, Math.max(1, Math.round(o.count * Math.min(0.25, 0.08 * k))) * o.hpMax, side);
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
      heal(bt, side, Math.min(0.4, 0.12 * k));
      break;
    // The order book's further pages (docs/17 H2).
    case 'musket_storm':
      for (const o of foes()) kills += hurt(bt, o, Math.max(1, Math.round(P * 0.45)), side);
      break;
    case 'powder_keg':
      if (t) {
        const ring = foes().filter((o) => o !== t && hexNeighbors(t.hex).includes(o.hex));
        kills += hurt(bt, t, Math.round(P * 2.4), side);
        for (const o of ring) kills += hurt(bt, o, Math.round(P * 0.8), side);
      }
      break;
    case 'tide_returns':
      heal(bt, side, Math.min(0.6, 0.25 * k));
      break;
    case 'maelstrom':
      for (const o of foes()) kills += hurt(bt, o, Math.max(1, Math.round(P * 0.55)), side);
      h.fx.push({ id, until: r });
      bt.heroes[1 - side].morale = Math.max(0, bt.heroes[1 - side].morale - 6);
      break;
    case 'dread':
      h.fx.push({ id, until: hold });
      bt.heroes[1 - side].morale = Math.max(0, bt.heroes[1 - side].morale - 8);
      break;
    default:
      h.fx.push({ id, until: id === 'smoke_and_knives' ? r : hold });
  }
  if (id === 'iron_discipline') h.morale = Math.min(100, h.morale + 10);
  if (id === 'war_cry') h.morale = Math.min(100, h.morale + 6);
  push(bt, { k: 'spell', side, id, ...(t ? { t: t.id, hex: t.hex } : {}), kills });
  checkOver(bt);
  return null;
}

/** An officer's word (once a fight), given instead of his party's blow. */
function giveOrder(bt: TacBattle, s: TacStack): void {
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
  } else h.fx.push({ id: 'all_hands', until: r + 1 });
  push(bt, { k: 'order', side: s.side, s: s.id, id: o.order });
}

// ------------------------------------------------------------------ turns and rounds

function newRound(bt: TacBattle, now: number, rng: Rng): void {
  bt.round++;
  const list = alive(bt);
  for (const s of list) {
    s.ret = true;
    s.waited = false;
    s.surged = false;
  }
  // Initiative, the higher first; a tie falls by the dice.
  const tie = new Map(list.map((s) => [s.id, rng.float()]));
  bt.queue = list.sort((x, y) => initOf(bt, y) - initOf(bt, x) || tie.get(x.id)! - tie.get(y.id)!).map((s) => s.id);
  if (bt.round > 1) push(bt, { k: 'round', side: 0, n: bt.round });
  nextTurn(bt, now, rng);
}

function nextTurn(bt: TacBattle, now: number, rng: Rng): void {
  for (let guard = 0; guard < 200 && !bt.over; guard++) {
    const id = bt.queue.shift();
    if (id === undefined) {
      if (bt.round >= TAC_MAX_ROUNDS) {
        const left = (side: 0 | 1) => alive(bt).filter((s) => s.side === side).reduce((n, s) => n + hpOf(s), 0) / Math.max(1, bt.heroes[side].startHp);
        bt.over = { winner: left(0) > left(1) ? 0 : 1, why: 'rounds' };
        bt.active = null;
        bt.seq++;
        return;
      }
      return newRound(bt, now, rng);
    }
    const s = stackById(bt, id);
    if (!s) continue;
    s.defending = false;
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
    // Bad morale (HoMM3): the stack freezes in fear and loses its turn, 1/25 a point below nought — a crew's 0..100
    // heart is −3 at under 10, −2 at 10–25, −1 at 26–41 (moralePoints), so a crew all but broken loses one turn in eight.
    const m = stackMorale(bt, s);
    if (m < 0 && rng.chance(-m * TAC_CHANCE_PER_POINT)) {
      push(bt, { k: 'fear', side: s.side, s: s.id });
      continue;
    }
    // Dread (docs/17 H2): a fifth of her turns lost to fear while it holds.
    if (!sp(s, 'undead') && has(bt.heroes[1 - s.side], 'dread', bt.round) && rng.chance(0.2)) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'dread' });
      continue;
    }
    // The deep's own on the other deck: the living may freeze in terror.
    if (!sp(s, 'undead') && !sp(s, 'steady') && sideHas(bt, (1 - s.side) as 0 | 1, 'fear') && rng.chance(TAC_FEAR)) {
      push(bt, { k: 'fear', side: s.side, s: s.id, id: 'terror' });
      continue;
    }
    bt.active = s.id;
    bt.turnEnds = now + TAC_TURN;
    bt.aiAt = now + TAC_AI_DELAY;
    bt.seq++;
    return;
  }
}

/** The turn is done: high morale may give the stack another at once; else the next in the order. */
function endTurn(bt: TacBattle, s: TacStack, now: number, rng: Rng, surgeOk: boolean): void {
  checkOver(bt);
  if (bt.over) {
    bt.active = null;
    return;
  }
  const m = stackMorale(bt, s);
  if (surgeOk && s.count > 0 && !s.surged && m > 0 && rng.chance(m * TAC_CHANCE_PER_POINT)) {
    s.surged = true;
    push(bt, { k: 'morale', side: s.side, s: s.id });
    bt.turnEnds = now + TAC_TURN;
    bt.aiAt = now + TAC_AI_DELAY;
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

/** One order from side `side`. Null when done; else why not. */
export function act(bt: TacBattle, side: 0 | 1, a: TacAction, now: number, rng: Rng): string | null {
  if (bt.over) return 'The fight is over';
  if (a.a === 'auto') {
    bt.heroes[side].auto = a.on;
    bt.aiAt = now + TAC_AI_DELAY;
    bt.seq++;
    return null;
  }
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
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  if (!s || s.side !== side) return 'Not your turn';
  if (a.a === 'spell') return castSpell(bt, side, a.id, a.target, rng);
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
    giveOrder(bt, s);
    endTurn(bt, s, now, rng, true);
    return null;
  }
  const reach = reachOf(bt, s);
  if (a.a === 'move') {
    if (!reach.has(a.to)) return 'Out of reach';
    s.hex = a.to;
    push(bt, { k: 'move', side, s: s.id, hex: a.to });
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
  if (from !== s.hex) {
    s.hex = from;
    push(bt, { k: 'move', side, s: s.id, hex: from });
  }
  strike(bt, s, t, rng);
  endTurn(bt, s, now, rng, true);
  return null;
}

// ------------------------------------------------------------------ the sea's mind

/** How much a stack hurts each turn (what killing its men is worth). */
function threat(bt: TacBattle, s: TacStack): number {
  return (s.count * (s.dmin + s.dmax)) / 2 * (s.atk / 5) * (isShooter(s) && s.shots > 0 ? 1.4 : 1) * (sp(s, 'double_strike') ? 1.6 : 1) * s.dmgMul;
}

const valueOf = (bt: TacBattle, t: TacStack, dmg: number) => (Math.min(dmg, hpOf(t)) / Math.max(1, hpOf(t))) * threat(bt, t) + (dmg >= hpOf(t) ? threat(bt, t) * 0.3 : 0);

/** The captain's order the sea's mind would give now (or null). */
function aiSpell(bt: TacBattle, side: 0 | 1, rng: Rng): { id: TacSpellId; target?: number } | null {
  const h = bt.heroes[side];
  if (h.cast >= bt.round) return null;
  const foes = alive(bt).filter((o) => o.side !== side);
  const own = alive(bt).filter((o) => o.side === side);
  let best: { id: TacSpellId; target?: number } | null = null, bv = 0;
  // What one of ours would do to her with a blow or a shot now (the expected one).
  const hitOn = (t: TacStack, x: TacStack) => blow(bt, x, t, canShoot(bt, x) ? 'shot' : 'melee', null).dmg;
  for (const s0 of h.spells) {
    if (s0.ready > bt.round) continue;
    const cost = spellCost(bt, side, s0.id);
    if (h.mana >= 0 && h.mana < cost) continue;
    // A thrifty captain: with a small store she keeps it for what is worth it.
    const thrift = h.mana >= 0 && h.input.hero ? 1 - Math.min(0.5, cost / Math.max(1, h.input.hero.manaMax)) * 0.5 : 1;
    const km = spellMul(bt, side, s0.id);
    const pick = (v: number, target?: number) => {
      v *= thrift;
      if (v > bv) {
        bv = v;
        best = { id: s0.id, ...(target !== undefined ? { target } : {}) };
      }
    };
    if (s0.id === 'musket_storm' || s0.id === 'maelstrom') {
      const P = spellPower(bt, side) * km * (s0.id === 'musket_storm' ? 0.45 : 0.55);
      pick(foes.reduce((n, t) => n + valueOf(bt, t, P), 0) + (s0.id === 'maelstrom' ? foes.reduce((n, t) => n + threat(bt, t), 0) * 0.03 : 0));
      continue;
    }
    if (s0.id === 'powder_keg') {
      const P = spellPower(bt, side) * km;
      for (const t of foes) {
        let v = valueOf(bt, t, P * 2.4);
        for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, P * 0.8);
        pick(v, t.id);
      }
      continue;
    }
    if (s0.id === 'tide_returns') {
      pick(own.reduce((n, x) => n + (Math.min(x.start * x.hpMax - hpOf(x), x.start * x.hpMax * 0.25 * km) / Math.max(1, hpOf(x))) * threat(bt, x), 0));
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
      const P = spellPower(bt, side) * km * (s0.id === 'point_blank' ? 1.6 : 1);
      for (const t of foes) {
        let v = valueOf(bt, t, P);
        if (s0.id === 'grenades') for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, P / 2);
        if (v > bv) {
          bv = v;
          best = { id: s0.id, target: t.id };
        }
      }
    } else {
      let v = foes.reduce((n, t) => n + threat(bt, t), 0) * 0.12;
      if (s0.id === 'brine_mend') v = own.reduce((n, x) => n + (Math.min(x.start * x.hpMax - hpOf(x), x.start * x.hpMax * 0.12) / Math.max(1, hpOf(x))) * threat(bt, x), 0);
      if (s0.id === 'war_cry') v = foes.reduce((n, t) => n + threat(bt, t), 0) * 0.06;
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

/** What the sea's mind has the active stack do. */
export function aiChoice(bt: TacBattle, rng: Rng): TacAction {
  const s = stackById(bt, bt.active ?? -1)!;
  if (s.officer && !s.officer.used) {
    const o = s.officer.order;
    const h = bt.heroes[s.side];
    const own = alive(bt).filter((x) => x.side === s.side);
    const lost = own.reduce((n, x) => n + (x.start * x.hpMax - hpOf(x)), 0) / Math.max(1, h.startHp);
    const shooters = own.some(isShooter);
    if ((o === 'rally' && lost > 0.25) || (o === 'lay_true' && shooters) || (o === 'steady' && moralePoints(bt, s.side) < 1) || (o === 'all_hands' && bt.round === 1)) return { a: 'order' };
  }
  const foes = alive(bt).filter((o) => o.side !== s.side);
  if (canShoot(bt, s)) {
    let best = foes[0], bv = -1;
    for (const t of foes) {
      const v = valueOf(bt, t, blow(bt, s, t, 'shot', null).dmg);
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
      const dmg = blow(bt, s, t, 'melee', null, h).dmg * (sp(s, 'double_strike') ? 2 : 1);
      const answered = t.ret && !sp(s, 'no_retaliation') && !sp(s, 'sweep') && dmg < hpOf(t);
      const v = valueOf(bt, t, dmg) - (answered ? 0.5 * valueOf(bt, s, blow(bt, t, s, 'ret', null).dmg) : 0) - (h === s.hex ? 0 : 0.01 * (reach.get(h) ?? 0)) - (bt.cells[h] === 'F' ? threat(bt, s) * 0.1 : 0);
      if (v > pv) {
        pv = v;
        pick = { t, from: h };
      }
    }
  }
  if (pick) return { a: 'attack', target: pick.t.id, from: pick.from };
  // Out of reach: close on the nearest foe (a shooter out of shot waits behind the steel), round the fires.
  let to: number | null = null, td = Infinity;
  for (const [h] of reach) {
    const d = Math.min(...foes.map((t) => hexDist(h, t.hex))) + (bt.cells[h] === 'F' ? 1.5 : 0);
    if (d < td) {
      td = d;
      to = h;
    }
  }
  const here = Math.min(...foes.map((t) => hexDist(s.hex, t.hex))) + (bt.cells[s.hex] === 'F' ? 1.5 : 0);
  if (to === null || td >= here) return { a: 'defend' };
  return { a: 'move', to };
}

/** The sea's mind (or a captain's auto-battle) plays the active turn: an order from the side panel, then the stack. */
export function aiAct(bt: TacBattle, now: number, rng: Rng): void {
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  if (!s || bt.over) return;
  const spl = aiSpell(bt, s.side, rng);
  if (spl) castSpell(bt, s.side, spl.id, spl.target, rng);
  if (bt.over) return;
  const choice = aiChoice(bt, rng);
  if (act(bt, s.side, choice, now, rng) !== null) act(bt, s.side, { a: 'defend' }, now, rng);
}

/** The clock: the sea's side (and auto-battle) acts after a breath; a captain's turn runs out into a defence. */
export function stepBattle(bt: TacBattle, now: number, rng: Rng): void {
  if (bt.over || bt.active === null) return;
  const s = stackById(bt, bt.active);
  if (!s) return nextTurn(bt, now, rng);
  const h = bt.heroes[s.side];
  if (h.auto) {
    if (now >= bt.aiAt) aiAct(bt, now, rng);
    return;
  }
  if (now >= bt.turnEnds) {
    push(bt, { k: 'timeout', side: s.side, s: s.id });
    act(bt, s.side, { a: 'defend' }, now, rng);
  }
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
export function lossesOf(bt: TacBattle, side: 0 | 1): { u: UnitId; n: number }[] {
  const by = new Map<UnitId, number>();
  for (const s of bt.stacks) if (s.side === side && s.start > s.count) by.set(s.unit, (by.get(s.unit) ?? 0) + s.start - s.count);
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

export function viewOf(bt: TacBattle, side: 0 | 1, now: number, canCut: boolean, extra: Partial<Pick<TacView, 'ransom' | 'result'>> = {}): TacView {
  const act0 = bt.active !== null ? stackById(bt, bt.active) : undefined;
  const mine = !!act0 && act0.side === side && !bt.over && !bt.heroes[side].auto;
  const reach = mine && act0 ? reachOf(bt, act0) : new Map<number, number>();
  const stacks: TacStackView[] = bt.stacks.filter((s) => s.count > 0).map((s) => ({
    id: s.id, side: s.side, kind: s.kind, unit: s.unit, sp: s.sp, count: s.count, start: s.start, hp: s.hpTop, hpMax: s.hpMax, hex: s.hex, atk: s.atk, def: s.def, dmg: [s.dmin, s.dmax],
    speed: speedOf(bt, s), init: initOf(bt, s), shots: s.shots, shotsMax: s.shotsMax, ret: s.ret, defending: s.defending, waited: s.waited,
    ...(s.officer ? { officer: { role: s.officer.role, name: s.officer.name, ...(s.officer.unique ? { unique: s.officer.unique } : {}), order: s.officer.order, ready: !s.officer.used } } : {}),
    ...(bt.heroes[s.side].fx.some((f) => f.id === 'mark_target' && f.on === s.id && f.until >= bt.round) || bt.heroes[1 - s.side].fx.some((f) => f.id === 'mark_target' && f.on === s.id && f.until >= bt.round) ? { marked: true } : {}),
  }));
  const hero = (x: 0 | 1): TacHeroView => {
    const h = bt.heroes[x];
    const hb = h.input.hero;
    return {
      name: h.input.name, ship: h.input.ship, captain: h.input.captain, morale: moralePoints(bt, x), luck: h.luck, spells: h.spells.map((s0) => ({ id: s0.id, ready: s0.ready, ...(hb ? { cost: spellCost(bt, x, s0.id) } : {}) })), cast: h.cast >= bt.round, auto: h.auto, men: alive(bt).filter((s) => s.side === x).reduce((n, s) => n + s.count, 0), menStart: h.startMen,
      ...(hb ? { prim: { atk: hb.atk, def: hb.def, pow: hb.pow, will: hb.will }, mana: Math.round(h.mana), manaMax: hb.manaMax } : {}),
    };
  };
  const next = alive(bt).sort((x, y) => initOf(bt, y) - initOf(bt, x) || x.id - y.id).map((s) => s.id).slice(0, 6);
  return {
    you: side, round: bt.round, maxRounds: TAC_MAX_ROUNDS, cells: bt.cells.join(''), stacks,
    order: [...(bt.active !== null ? [bt.active] : []), ...bt.queue.filter((id) => stackById(bt, id))], next, active: bt.active, mine, ends: bt.turnEnds,
    reach: [...reach.keys()], melee: mine && act0 ? meleeTargets(bt, act0, reach).map((t) => t.id) : [], shoot: mine && act0 && canShoot(bt, act0) ? alive(bt).filter((t) => t.side !== side).map((t) => t.id) : [],
    heroes: [hero(0), hero(1)], log: bt.log.slice(-12), seq: bt.seq, over: bt.over, canCut, canStrike: side === 1, ...extra,
  };
}
