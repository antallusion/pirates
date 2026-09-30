// The turn-based boarding battle itself (docs/16 P4), apart from the ships: a hex field of two decks, the stacks
// the crews make, the order of initiative, moves and blows with retaliation once a round, shots with a range
// penalty, wait and defend, morale and luck, the captains' orders, the sea's captains' mind and the end. Pure but for
// the dice it is handed; server/src/game/tactical.ts ties it to the ships, the clock and the captains' screens.

import { skillMul } from '../../../shared/src/data/crew.ts';
import type { OfficerRole } from '../../../shared/src/data/crew.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import {
  TAC_AI_DELAY, TAC_BLOCKING, TAC_CHANCE_PER_POINT, TAC_GAP, TAC_H, TAC_LONG_SHOT, TAC_MAX_ROUNDS, TAC_ORDER_OF, TAC_SPELLS, TAC_TURN, TAC_UNITS, TAC_W,
  captainSpells, hexDist, hexIndex, hexMirror, hexNeighbors,
} from '../../../shared/src/data/tactical.ts';
import type { TacCell, TacKind, TacOrderId, TacSpellId } from '../../../shared/src/data/tactical.ts';
import type { TacAction, TacEvent, TacHeroView, TacStackView, TacView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';

/** What one side brings to the fight, as the ship and her crew make it. */
export interface TacSideInput {
  name: string;
  ship: string;
  captain: CaptainId | null;
  /** Men by the stacks they make (the other trades fight among the hands). */
  hands: number;
  marines: number;
  gunners: number;
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
}

export interface TacStack {
  id: number;
  side: 0 | 1;
  kind: TacKind;
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
}

export interface TacHero {
  input: TacSideInput;
  morale: number;
  luck: number;
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
  over: null | { winner: 0 | 1; why: 'rout' | 'struck' | 'rounds' };
  /** Men fallen on each side so far. */
  dead: [number, number];
  /** Officers whose party was broken (dead) or badly cut (hurt). */
  hurt: { id: string; side: 0 | 1; heavy: boolean }[];
  broken: [number, number];
}

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

const ROWS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [1, 4, 7], 4: [1, 3, 5, 7], 5: [0, 2, 4, 6, 8] };

function place(cells: TacCell[], taken: Set<number>, x: number, y: number, side: 0 | 1): number {
  for (let d = 0; d < TAC_H; d++) {
    for (const yy of [y + d, y - d]) {
      if (yy < 0 || yy >= TAC_H) continue;
      const i = side ? hexMirror(hexIndex(x, yy)) : hexIndex(x, yy);
      if (!TAC_BLOCKING.has(cells[i]) && !taken.has(i)) return i;
    }
  }
  return side ? hexMirror(hexIndex(x, y)) : hexIndex(x, y);
}

/** The stacks a side's crew makes: the hands in one or two, the marines, the musketeers, each officer's party. */
export function buildStacks(input: TacSideInput, side: 0 | 1, cells: TacCell[], firstId: number): TacStack[] {
  const q = skillMul(input.skill);
  let hands = Math.max(0, Math.round(input.hands));
  const total = hands + input.marines + input.gunners;
  const out: TacStack[] = [];
  let id = firstId;
  const make = (kind: TacKind, n: number, extra?: Partial<TacStack>): void => {
    if (n <= 0) return;
    const u = TAC_UNITS[kind];
    const shots = u.shots ? u.shots + input.extraShots : 0;
    out.push({
      id: id++, side, kind, count: n, start: n, hpTop: u.hp, hpMax: u.hp, hex: -1,
      atk: Math.round(u.atk * q * 10) / 10, def: Math.round(u.def * q * 10) / 10, dmin: u.dmin, dmax: u.dmax, speed: u.speed, init: u.init,
      shots, shotsMax: shots, ret: true, defending: false, waited: false, surged: false, ...extra,
    });
  };
  // Each officer takes a twentieth of the men (at least two) as his party.
  const officers = input.officers.slice(0, 2);
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
  // The steel in front, the muskets and the officers behind.
  const front = out.filter((s) => s.kind === 'hands' || s.kind === 'marines');
  const back = out.filter((s) => !front.includes(s));
  const taken = new Set<number>();
  for (const [list, col] of [[front, 1], [back, 0]] as const) {
    const rows = ROWS[Math.min(5, list.length)] ?? ROWS[5];
    list.forEach((s, k) => {
      s.hex = place(cells, taken, col, rows[k % rows.length], side);
      taken.add(s.hex);
    });
  }
  return out;
}

const hpOf = (s: TacStack) => (s.count > 0 ? (s.count - 1) * s.hpMax + s.hpTop : 0);

function newHero(input: TacSideInput, stacks: TacStack[]): TacHero {
  const lucky = input.officers.filter((o) => o.lucky).length;
  return {
    input, morale: Math.max(0, Math.min(100, input.morale)), luck: Math.min(3, 1 + lucky),
    spells: captainSpells(input.captain).map((id) => ({ id, ready: 1 })), cast: 0, auto: !input.human, fx: [], kills: 0,
    startHp: stacks.reduce((n, s) => n + hpOf(s), 0), startMen: stacks.reduce((n, s) => n + s.count, 0), cutTried: 0,
  };
}

/** A battle laid out: the field, both sides' stacks, round one about to open. */
export function newBattle(a: TacSideInput, b: TacSideInput, seed: number, now: number, rng: Rng): TacBattle {
  const cells = makeField(seed);
  const sa = buildStacks(a, 0, cells, 1);
  const sb = buildStacks(b, 1, cells, sa.length + 1);
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

/** Morale points −3..+3: the crew's heart, the orders that steady or shake it. */
export function moralePoints(bt: TacBattle, side: 0 | 1): number {
  const h = bt.heroes[side], e = bt.heroes[1 - side];
  let m = Math.round((h.morale - 50) / 16);
  if (has(h, 'steady', bt.round) || has(h, 'iron_discipline', bt.round)) m++;
  if (has(e, 'red_harvest', bt.round) || has(e, 'call_of_the_deep', bt.round)) m--;
  return Math.max(-3, Math.min(3, m));
}

function speedOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side];
  return s.speed + (has(h, 'turn_the_flank', bt.round) || has(h, 'all_hands', bt.round) ? 1 : 0);
}

function initOf(bt: TacBattle, s: TacStack): number {
  const h = bt.heroes[s.side];
  return s.init + (has(h, 'turn_the_flank', bt.round) ? 3 : 0) + (has(h, 'all_hands', bt.round) ? 2 : 0);
}

const passable = (bt: TacBattle, i: number, self: TacStack | null) => !TAC_BLOCKING.has(bt.cells[i]) && !bt.stacks.some((s) => s.count > 0 && s !== self && s.hex === i);

/** Steps to every hex the stack can reach this turn (by the path around obstacles and stacks). */
export function reachOf(bt: TacBattle, s: TacStack): Map<number, number> {
  const out = new Map<number, number>();
  const sp = speedOf(bt, s);
  const seen = new Map<number, number>([[s.hex, 0]]);
  let frontier = [s.hex];
  for (let d = 1; d <= sp && frontier.length; d++) {
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

/** May the stack shoot: muskets loaded and no foe at arm's length. */
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
    if (d !== undefined && d < bd) {
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

/** Damage `s` does to `t` (rng null: the expected blow, for the sea's mind). */
export function blow(bt: TacBattle, s: TacStack, t: TacStack, how: 'melee' | 'shot' | 'ret', rng: Rng | null, from = s.hex): { dmg: number; lucky: boolean } {
  const h = bt.heroes[s.side], e = bt.heroes[t.side];
  const r = bt.round;
  const defMul = (t.defending ? 1.3 : 1) * (e.input.castle && t.side === 1 ? 1.25 : 1) * (has(e, 'iron_discipline', r) ? 1.4 : 1);
  const a = s.atk, d = t.def * defMul;
  const mod = Math.max(0.3, Math.min(3, a >= d ? 1 + 0.05 * (a - d) : 1 / (1 + 0.05 * (d - a))));
  let mul = h.input.dealt * h.input.power * (how === 'shot' ? 1 : h.input.melee);
  if (r === 1) mul *= h.input.firstRush * Math.max(0.2, 1 - e.input.nets);
  mul *= 1 + Math.min(0.2, h.kills * h.input.blooded);
  if (h.input.struck) mul *= 0.1;
  if (has(h, 'red_harvest', r)) mul *= 1.25;
  if (has(h, 'iron_discipline', r)) mul *= 1.15;
  if (has(e, 'smoke_and_knives', r)) mul *= 0.5;
  if (how === 'shot') {
    if (hexDist(from, t.hex) > TAC_LONG_SHOT) mul *= 0.5;
    if (has(h, 'lay_true', r)) mul *= 1.25;
  } else if (s.kind === 'gunners') mul *= 0.5; // a musket is a poor club
  // Flanking: a foe already engaged by another of ours on her other side.
  // Turn the Flank: the navigator reads the deck, every blow of his men lands as from the flank.
  if (how === 'melee' && (has(h, 'turn_the_flank', r) || alive(bt).some((o) => o.side === s.side && o !== s && hexNeighbors(t.hex).includes(o.hex)))) mul *= 1.2;
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

function strike(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  const { dmg, lucky } = blow(bt, s, t, 'melee', rng);
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const kills = hurt(bt, t, dmg, s.side);
  push(bt, { k: 'hit', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex });
  // Retaliation, once a round, by what is left of her.
  if (t.count > 0 && t.ret) {
    t.ret = false;
    const r = blow(bt, t, s, 'ret', rng);
    if (r.lucky) push(bt, { k: 'luck', side: t.side, s: t.id });
    const k2 = hurt(bt, s, r.dmg, t.side);
    push(bt, { k: 'ret', side: t.side, s: t.id, t: s.id, dmg: r.dmg, kills: k2, hex: s.hex });
  }
}

function shoot(bt: TacBattle, s: TacStack, t: TacStack, rng: Rng): void {
  const { dmg, lucky } = blow(bt, s, t, 'shot', rng);
  s.shots--;
  if (lucky) push(bt, { k: 'luck', side: s.side, s: s.id });
  const kills = hurt(bt, t, dmg, s.side);
  push(bt, { k: 'shot', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex });
}

// ------------------------------------------------------------------ the captains' orders

/** The captain's blast: a share of his own side's strength at the start, cut by the ladder. */
function spellPower(bt: TacBattle, side: 0 | 1): number {
  const h = bt.heroes[side];
  return h.startHp * 0.07 * h.input.dealt * h.input.power * (h.input.struck ? 0.1 : 1);
}

export function spellError(bt: TacBattle, side: 0 | 1, id: TacSpellId, target?: number): string | null {
  const h = bt.heroes[side];
  const sp = h.spells.find((x) => x.id === id);
  if (!sp) return 'Your captain has no such order';
  if (h.cast >= bt.round) return 'One captain\'s order a round';
  if (sp.ready > bt.round) return 'That order is not ready yet';
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
  const sp = h.spells.find((x) => x.id === id)!;
  sp.ready = bt.round + TAC_SPELLS[id].cd;
  h.cast = bt.round;
  const r = bt.round;
  const t = target !== undefined ? stackById(bt, target) : undefined;
  let kills = 0;
  const P = spellPower(bt, side) * (0.85 + rng.float() * 0.3);
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
      for (const o of alive(bt)) if (o.side !== side && o.count > 1) kills += hurt(bt, o, Math.max(1, Math.round(o.count * 0.08)) * o.hpMax, side);
      h.fx.push({ id, until: r + 1 });
      break;
    default:
      h.fx.push({ id, until: id === 'smoke_and_knives' ? r : r + 1 });
  }
  if (id === 'iron_discipline') h.morale = Math.min(100, h.morale + 10);
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
    for (const x of bt.stacks) {
      if (x.side !== s.side || x.count <= 0) continue;
      const room = x.start * x.hpMax - hpOf(x);
      const heal = Math.min(room, Math.round(x.start * x.hpMax * 0.15));
      if (heal <= 0) continue;
      const tot = hpOf(x) + heal;
      const was = x.count;
      x.count = Math.ceil(tot / x.hpMax);
      x.hpTop = tot - (x.count - 1) * x.hpMax;
      bt.dead[s.side] = Math.max(0, bt.dead[s.side] - (x.count - was));
    }
    h.morale = Math.min(100, h.morale + 8);
  } else if (o.order === 'lay_true') {
    for (const x of bt.stacks) if (x.side === s.side && x.kind === 'gunners' && x.count > 0) x.shots = Math.min(x.shotsMax + 1, x.shots + 1);
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
    // Low morale: the stack freezes and loses its turn.
    const m = moralePoints(bt, s.side);
    if (m < 0 && rng.chance(-m * TAC_CHANCE_PER_POINT)) {
      push(bt, { k: 'fear', side: s.side, s: s.id });
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
  const m = moralePoints(bt, s.side);
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
  // A crew with no heart left strikes (the old boarding's rule: morale all but gone).
  for (const side of [0, 1] as const) {
    if (bt.heroes[side].morale <= 5 && bt.heroes[1 - side].morale > 5) {
      bt.over = { winner: (1 - side) as 0 | 1, why: 'rout' };
      bt.active = null;
      bt.seq++;
      return;
    }
  }
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
  return (s.count * (s.dmin + s.dmax)) / 2 * (s.atk / 5) * (s.kind === 'gunners' && s.shots > 0 ? 1.4 : 1);
}

const valueOf = (bt: TacBattle, t: TacStack, dmg: number) => (Math.min(dmg, hpOf(t)) / Math.max(1, hpOf(t))) * threat(bt, t) + (dmg >= hpOf(t) ? threat(bt, t) * 0.3 : 0);

/** The captain's order the sea's mind would give now (or null). */
function aiSpell(bt: TacBattle, side: 0 | 1, rng: Rng): { id: TacSpellId; target?: number } | null {
  const h = bt.heroes[side];
  if (h.cast >= bt.round) return null;
  const foes = alive(bt).filter((o) => o.side !== side);
  let best: { id: TacSpellId; target?: number } | null = null, bv = 0;
  for (const sp of h.spells) {
    if (sp.ready > bt.round) continue;
    if (TAC_SPELLS[sp.id].target === 'enemy') {
      const P = spellPower(bt, side) * (sp.id === 'point_blank' ? 1.6 : 1);
      for (const t of foes) {
        let v = valueOf(bt, t, P);
        if (sp.id === 'grenades') for (const o of foes) if (o !== t && hexNeighbors(t.hex).includes(o.hex)) v += valueOf(bt, o, P / 2);
        if (v > bv) {
          bv = v;
          best = { id: sp.id, target: t.id };
        }
      }
    } else {
      const v = foes.reduce((n, t) => n + threat(bt, t), 0) * 0.12;
      if (v > bv) {
        bv = v;
        best = { id: sp.id };
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
    const gunners = own.some((x) => x.kind === 'gunners');
    if ((o === 'rally' && lost > 0.25) || (o === 'lay_true' && gunners) || (o === 'steady' && moralePoints(bt, s.side) < 1) || (o === 'all_hands' && bt.round === 1)) return { a: 'order' };
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
      const dmg = blow(bt, s, t, 'melee', null, h).dmg;
      const v = valueOf(bt, t, dmg) - (t.ret && dmg < hpOf(t) ? 0.5 * valueOf(bt, s, blow(bt, t, s, 'ret', null).dmg) : 0) - (h === s.hex ? 0 : 0.01 * (reach.get(h) ?? 0));
      if (v > pv) {
        pv = v;
        pick = { t, from: h };
      }
    }
  }
  if (pick) return { a: 'attack', target: pick.t.id, from: pick.from };
  // Out of reach: close on the nearest foe (a musket stack out of shot waits behind the steel).
  let to: number | null = null, td = Infinity;
  for (const [h] of reach) {
    const d = Math.min(...foes.map((t) => hexDist(h, t.hex)));
    if (d < td) {
      td = d;
      to = h;
    }
  }
  const here = Math.min(...foes.map((t) => hexDist(s.hex, t.hex)));
  if (to === null || td >= here) return { a: 'defend' };
  return { a: 'move', to };
}

/** The sea's mind (or a captain's auto-battle) plays the active turn: an order from the side panel, then the stack. */
export function aiAct(bt: TacBattle, now: number, rng: Rng): void {
  const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
  if (!s || bt.over) return;
  const sp = aiSpell(bt, s.side, rng);
  if (sp) castSpell(bt, s.side, sp.id, sp.target, rng);
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

/** Quick combat: both sides played out by the sea's mind at once. */
export function quickFinish(bt: TacBattle, now: number, rng: Rng): void {
  for (let i = 0; i < 5000 && !bt.over; i++) {
    if (bt.active === null) break;
    aiAct(bt, now, rng);
  }
  if (!bt.over) bt.over = { winner: 1, why: 'rounds' };
}

// ------------------------------------------------------------------ what a captain sees

export function viewOf(bt: TacBattle, side: 0 | 1, now: number, canCut: boolean): TacView {
  const act0 = bt.active !== null ? stackById(bt, bt.active) : undefined;
  const mine = !!act0 && act0.side === side && !bt.over && !bt.heroes[side].auto;
  const reach = mine && act0 ? reachOf(bt, act0) : new Map<number, number>();
  const stacks: TacStackView[] = bt.stacks.filter((s) => s.count > 0).map((s) => ({
    id: s.id, side: s.side, kind: s.kind, count: s.count, start: s.start, hp: s.hpTop, hpMax: s.hpMax, hex: s.hex, atk: s.atk, def: s.def, dmg: [s.dmin, s.dmax],
    speed: speedOf(bt, s), init: initOf(bt, s), shots: s.shots, shotsMax: s.shotsMax, ret: s.ret, defending: s.defending, waited: s.waited,
    ...(s.officer ? { officer: { role: s.officer.role, name: s.officer.name, ...(s.officer.unique ? { unique: s.officer.unique } : {}), order: s.officer.order, ready: !s.officer.used } } : {}),
  }));
  const hero = (x: 0 | 1): TacHeroView => {
    const h = bt.heroes[x];
    return { name: h.input.name, ship: h.input.ship, captain: h.input.captain, morale: moralePoints(bt, x), luck: h.luck, spells: h.spells.map((sp) => ({ id: sp.id, ready: sp.ready })), cast: h.cast >= bt.round, auto: h.auto };
  };
  const next = alive(bt).sort((x, y) => initOf(bt, y) - initOf(bt, x) || x.id - y.id).map((s) => s.id).slice(0, 6);
  return {
    you: side, round: bt.round, maxRounds: TAC_MAX_ROUNDS, cells: bt.cells.join(''), stacks,
    order: [...(bt.active !== null ? [bt.active] : []), ...bt.queue.filter((id) => stackById(bt, id))], next, active: bt.active, mine, ends: bt.turnEnds,
    reach: [...reach.keys()], melee: mine && act0 ? meleeTargets(bt, act0, reach).map((t) => t.id) : [], shoot: mine && act0 && canShoot(bt, act0) ? alive(bt).filter((t) => t.side !== side).map((t) => t.id) : [],
    heroes: [hero(0), hero(1)], log: bt.log.slice(-12), seq: bt.seq, over: bt.over, canCut, canStrike: side === 1,
  };
}

