// docs/19 E9 on the server: the Seals of the Deep. A captain at the cap is given her first seal (2, a grotto or a
// guardian of the sea's chains); at any lair of its kind her boats reach she may open its mythic depth — her own fight
// ashore (beastlairs.ts startCreatureFight), the lair at ⚓10 grown by the seal, the week's afflictions played on the
// field by this file's director (the poisoned tide as each round opens, the fury of creatures cut below half, the
// shields of the first rounds, the reinforcements of rounds 3 and 6) and the round limit; then the seal moves (+2 won
// fast, +1 in time, 0 late, −1 lost) and, grown, turns to another lair. Her best of the week goes on the sea's table.
// Every roll here is on this system's own Rng.

import { MAX_LEVEL } from '../../../shared/src/constants.ts';
import { armyCost } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { LAIRS, lairArmy } from '../../../shared/src/data/lairs.ts';
import type { Lair, LairKind } from '../../../shared/src/data/lairs.ts';
import {
  SEAL_FURY, SEAL_KINDS, SEAL_LAIR_LEVEL, SEAL_LAIR_SIZE, SEAL_MAX, SEAL_MIN, SEAL_REINFORCE, SEAL_SHIELDS, SEAL_TIDE, clampSeal, fastRounds, sealAffixes, sealMight, sealPay,
  sealRounds, sealStep,
} from '../../../shared/src/data/seals.ts';
import type { SealAffix, SealRec, SealRow, SealView } from '../../../shared/src/data/seals.ts';
import { TAC_BLOCKING, hexDist } from '../../../shared/src/data/tactical.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { goToLair, lairCardHooks, lairInReachOf, lairIsland, lairName, lairsOfKind, landFighting, startCreatureFight } from './beastlairs.ts';
import { giveGoods } from './director.ts';
import { weekOf } from './empires.ts';
import type { Game } from './Game.ts';
import { artifactFind } from './hero.ts';
import { relicPartDrop } from './relics.ts'; // docs/19 E12
import { contractSeal } from './admiralty.ts'; // docs/19 E15
import { sealPartChance } from '../../../shared/src/data/artifacts.ts';
import type { PlayerSession, Profile } from './player.ts';
import { chronicle } from './renown.ts';
import { aiAct, buildStacks, checkOver, lossesOf, newBattle, tacHurt, tacPush } from './tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from './tacbattle.ts';

const KINDS = new Set<LairKind>(SEAL_KINDS);
const BOARD_KEY = 'seal_board';
/** The table keeps this many rows of the week. */
const BOARD_ROWS = 50;

/** The seals' own dice (as the Throne's: throne.ts). */
const rngs = new WeakMap<Game, Rng>();
function sr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x5ea1d0e9)));
  return r;
}

export const sealWeek = (game: Game): number => weekOf(game.wallNow());

/** The kinds of lair the sea has (a seal never names one nobody can find). */
function kindsAfloat(game: Game): LairKind[] {
  return SEAL_KINDS.filter((k) => lairsOfKind(game, k).length > 0);
}

/** A kind for a seal, other than `not` when the sea has another. */
function pickKind(game: Game, not?: LairKind): LairKind {
  const all = kindsAfloat(game);
  const pool = all.filter((k) => k !== not);
  const list = pool.length ? pool : all.length ? all : [...SEAL_KINDS];
  return list[sr(game).int(0, list.length - 1)];
}

/** Her seal: given at the cap (seal 2 of a kind the sea has), kept within the rules after. */
export function sealOf(game: Game, p: Profile): SealRec | null {
  if (p.level < MAX_LEVEL) return null;
  const r = (p.seal ??= { lv: SEAL_MIN, kind: pickKind(game), runs: 0, timed: 0 });
  r.lv = clampSeal(r.lv);
  if (!KINDS.has(r.kind)) r.kind = pickKind(game);
  r.runs = Math.max(0, Math.floor(r.runs || 0));
  r.timed = Math.max(0, Math.floor(r.timed || 0));
  return r;
}

// ------------------------------------------------------------------ the mythic depth's army

/** The mythic depth's creatures: the lair's army at ⚓10, each stack grown by the seal's might. */
export function sealArmy(kind: LairKind, lv: number): ArmyStack[] {
  const k = sealMight(lv);
  return lairArmy(kind, SEAL_LAIR_LEVEL, SEAL_LAIR_SIZE).map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * k)) }));
}

// ------------------------------------------------------------------ the director on the field

interface Depth {
  lv: number;
  affixes: SealAffix[];
  limit: number;
  /** The last round its round-opening afflictions were played on, and whether the limit has passed. */
  round: number;
  late: boolean;
  /** The army it stood with (the reinforcements are a share of it), the stacks already in a fury. */
  base: ArmyStack[];
  furious: Set<number>;
}

const depths = new WeakMap<TacBattle, Depth>();
const has = (d: Depth, a: SealAffix) => d.affixes.includes(a);

/** The seal laid on a battle as it opens (the shields over the creatures for their first rounds). */
export function startDepth(bt: TacBattle, lv: number, affixes: SealAffix[], base: ArmyStack[]): Depth {
  const d: Depth = { lv, affixes, limit: sealRounds(lv), round: 0, late: false, base, furious: new Set() };
  depths.set(bt, d);
  if (has(d, 'shields')) {
    bt.heroes[1].fx.push({ id: 'seal_shields', until: SEAL_SHIELDS.rounds, mods: { taken: -SEAL_SHIELDS.cut } });
    tacPush(bt, { k: 'boss', side: 1, id: 'seal_shields', on: bt.stacks.filter((x) => x.side === 1 && x.count > 0).map((x) => x.id) });
  }
  return d;
}

const ground = (bt: TacBattle, i: number): boolean => i >= 0 && i < bt.cells.length && !TAC_BLOCKING.has(bt.cells[i]);
const occupied = (bt: TacBattle, i: number): boolean => bt.stacks.some((x) => x.count > 0 && x.hex === i);

/** The free hex nearest to the creatures' own (where the dark gives up a fresh pack). */
function freeOnTheirSide(bt: TacBattle): number | null {
  const theirs = bt.stacks.filter((x) => x.side === 1 && x.count > 0);
  const near = theirs.length ? theirs[0].hex : bt.cells.length - 1;
  let best: number | null = null, bd = Infinity;
  for (let i = 0; i < bt.cells.length; i++) {
    if (!ground(bt, i) || occupied(bt, i)) continue;
    const d = hexDist(i, near);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function beastSide(army: ArmyStack[]): TacSideInput {
  return {
    name: '', ship: '', captain: null, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
    morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, noBook: true,
  };
}

/** A fresh pack of the lair's kind beside its own (the reinforcements). */
function summon(bt: TacBattle, u: UnitId, n: number): TacStack | null {
  const at = freeOnTheirSide(bt);
  if (at === null) return null;
  const id = Math.max(...bt.stacks.map((x) => x.id)) + 1;
  const [st] = buildStacks(beastSide([{ u, n }]), 1, bt.cells, id);
  if (!st) return null;
  st.hex = at;
  bt.stacks.push(st);
  tacPush(bt, { k: 'move', side: 1, s: st.id, hex: at });
  return st;
}

/** The seal's own doings, played as the fight opens and after every turn: the limit, the round's afflictions, a
 *  creature's fury the moment it is cut below half. */
export function direct(bt: TacBattle): void {
  const d = depths.get(bt);
  if (!d || bt.over) return;
  if (!d.late && bt.round > d.limit) {
    d.late = true;
    tacPush(bt, { k: 'boss', side: 1, id: 'seal_late' });
  }
  if (has(d, 'fury')) {
    const on: number[] = [];
    for (const st of bt.stacks) {
      if (st.side !== 1 || st.count <= 0 || d.furious.has(st.id) || st.count > st.start / 2) continue;
      d.furious.add(st.id);
      bt.heroes[1].fx.push({ id: 'seal_fury', until: 1e9, on: st.id, mods: { melee: SEAL_FURY, shot: SEAL_FURY } });
      on.push(st.id);
    }
    if (on.length) tacPush(bt, { k: 'boss', side: 1, s: on[0], id: 'seal_fury', on });
  }
  if (bt.round <= d.round) return;
  d.round = bt.round;
  if (has(d, 'tide') && bt.round > 1) {
    const on: number[] = [];
    for (const st of bt.stacks) {
      if (st.side !== 0 || st.count <= 0) continue;
      tacHurt(bt, st, Math.max(1, Math.round(st.start * st.hpMax * SEAL_TIDE)), 1);
      on.push(st.id);
    }
    if (on.length) tacPush(bt, { k: 'boss', side: 1, id: 'seal_tide', on });
    checkOver(bt);
  }
  if (has(d, 'reinforce') && SEAL_REINFORCE.rounds.includes(bt.round) && !bt.over) {
    const on: number[] = [];
    for (const x of d.base) {
      const st = summon(bt, x.u, Math.max(1, Math.round(x.n * SEAL_REINFORCE.share)));
      if (st) on.push(st.id);
    }
    if (on.length) tacPush(bt, { k: 'boss', side: 1, s: on[0], id: 'seal_reinforce', on });
  }
}

/** The battle played out at once, the seal's doings in it (quick combat, a captain gone from the sea, the sims). */
export function playOut(bt: TacBattle, rng: Rng, now: number): void {
  direct(bt);
  for (let i = 0; i < 5000 && !bt.over; i++) {
    if (bt.active === null) break;
    aiAct(bt, now, rng);
    direct(bt);
  }
  if (!bt.over) {
    bt.over = { winner: 1, why: 'rounds' };
    bt.active = null;
    bt.seq++;
  }
}

/** One mythic depth of a party against a seal's lair, both sides played by the sea's mind (the balance's): won, the
 *  share of her men lost, the rounds it ran. */
export function simulateDepth(kind: LairKind, lv: number, week: number, party: ArmyStack[], seed: number): { won: boolean; lost: number; rounds: number } {
  const rng = new Rng(seed);
  const base = sealArmy(kind, lv);
  const bt = newBattle({ ...beastSide(party), captain: 'corsair', morale: 70, noBook: undefined }, { ...beastSide(base), name: LAIRS[kind].name[0] }, seed, 0, rng, { land: 'rocky' });
  startDepth(bt, lv, sealAffixes(lv, week), base);
  playOut(bt, rng, 0);
  const men = party.reduce((a, x) => a + x.n, 0);
  const lost = lossesOf(bt, 0).reduce((a, x) => a + x.n, 0);
  return { won: bt.over?.winner === 0, lost: lost / Math.max(1, men), rounds: bt.round };
}

// ------------------------------------------------------------------ entering and the end

/** Why her seal's depth may not be entered now (null: it may). `l` the lair her boats reach, if any. */
function whyNot(game: Game, s: PlayerSession, l: Lair | null): string | null {
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not in the middle of a boarding';
  if (landFighting(game, s)) return 'Your party is ashore already.';
  if (!l) return 'Come in to the shore of a lair of your seal: within the boats’ reach.';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  if (ship.crew < 3) return 'Too few hands to spare a landing party';
  return null;
}

/** Her seal's mythic depth at the lair her boats reach. */
export function enterDepth(game: Game, s: PlayerSession): string | null {
  const p = s.profile;
  if (!p) return 'Not now';
  const seal = sealOf(game, p);
  if (!seal) return `The seals open at level ${MAX_LEVEL}.`;
  const l = lairInReachOf(game, s, new Set([seal.kind]));
  const why = whyNot(game, s, l);
  if (why || !l) return why ?? 'Not now';
  const lv = seal.lv, week = sealWeek(game), affixes = sealAffixes(lv, week);
  const base = sealArmy(seal.kind, lv);
  const e = startCreatureFight(game, s, {
    type: l.type, kind: l.kind, place: lairIsland(game, l), level: SEAL_LAIR_LEVEL, xpMul: sealPay(lv).xpMul,
    onStep: (_g, _s, bt) => {
      if (!depths.has(bt)) startDepth(bt, lv, affixes, base);
      direct(bt);
    },
    quick: (bt, rng) => playOut(bt, rng, game.now),
    onEnd: (g, ss, won, bt) => endDepth(g, ss, l, lv, won, bt),
  }, lairName(l), base, `unit.${LAIRS[l.kind].mix[0][0]}`, SEAL_LAIR_LEVEL);
  if (e) return e;
  game.toastShip(s.ship!, `Seal ${lv} opens the mythic depth: ${lairName(l)}, ${sealRounds(lv)} rounds.`, 'info');
  return null;
}

/** The depth is over: the seal moves, the week's best and the table, and — in time — the spoils. */
function endDepth(game: Game, s: PlayerSession, l: Lair, lv: number, won: boolean, bt: TacBattle): LairLoot | undefined {
  const p = s.profile!;
  const ship = s.ship!;
  const seal = sealOf(game, p)!;
  const rounds = bt.round;
  const step = sealStep(won, rounds, lv);
  const timed = won && rounds <= sealRounds(lv);
  const before = seal.lv;
  seal.runs++;
  if (timed) seal.timed++;
  seal.lv = clampSeal(seal.lv + step);
  if (step > 0) seal.kind = pickKind(game, seal.kind);
  if (timed) noteBest(game, s, seal, lv, rounds);
  if (timed) contractSeal(game, s, lv); // docs/19 E15: the Admiralty's seal contract
  if (!won) {
    game.toastShip(ship, `The mythic depth throws your party back into the surf. The seal falls to ${seal.lv}.`, 'bad');
    return undefined;
  }
  if (!timed) {
    game.toastShip(ship, `The depth is won, but late: ${rounds} rounds of ${sealRounds(lv)}. The seal holds at ${seal.lv}.`, 'info');
    return undefined;
  }
  // The men it cost paid back at their price, and the seal's own over it.
  const pay = sealPay(lv);
  const silver = armyCost(lossesOf(bt, 0)) + pay.silver;
  const loot: LairLoot = { silver, xp: 0, goods: [], res: {} };
  p.gold += silver;
  game.db.ledger(s.accountId, 'seal', silver, l.kind);
  const q = giveGoods(ship, 'pearls', pay.pearls);
  if (q > 0) loot.res.pearls = q;
  if (sr(game).chance(pay.art)) {
    const it = artifactFind(game, s, 'boss');
    if (it?.art) loot.artifact = it.art;
  }
  // docs/19 E12: a relic's part, now and then, from a depth won in time.
  const part = relicPartDrop(game, s, 'seal', sealPartChance(lv));
  if (part && !loot.artifact) loot.artifact = part;
  game.toastShip(ship, `Seal ${lv} won in ${rounds} rounds: the seal rises to ${seal.lv} and now opens ${lairName(seal.kind)}.`, 'good');
  if (before < 10 && seal.lv >= 10) chronicle(game, `${s.name} carries a seal of the deep to ${seal.lv}.`);
  return loot;
}

// ------------------------------------------------------------------ the week's table

interface Board {
  week: number;
  rows: { acc: number; name: string; lv: number; rounds: number }[];
}

function board(game: Game): Board {
  const week = sealWeek(game);
  const b = game.db.getKv<Board>(BOARD_KEY);
  return b && b.week === week ? b : { week, rows: [] };
}

/** Her best of the week, on her and on the table: a higher seal first, then fewer rounds. */
function noteBest(game: Game, s: PlayerSession, seal: SealRec, lv: number, rounds: number): void {
  const week = sealWeek(game);
  const better = (a: { lv: number; rounds: number } | undefined) => !a || lv > a.lv || (lv === a.lv && rounds < a.rounds);
  if (seal.best?.week !== week || better(seal.best)) seal.best = { week, lv, rounds };
  const b = board(game);
  const row = b.rows.find((r) => r.acc === s.accountId);
  if (!row) b.rows.push({ acc: s.accountId, name: s.name, lv, rounds });
  else if (better(row)) Object.assign(row, { name: s.name, lv, rounds });
  b.rows.sort((x, y) => y.lv - x.lv || x.rounds - y.rounds);
  b.rows.length = Math.min(b.rows.length, BOARD_ROWS);
  game.db.setKv(BOARD_KEY, b);
}

/** The week's first ten (hers marked). */
export function sealBoard(game: Game, acc?: number): SealRow[] {
  return board(game).rows.slice(0, 10).map((r) => ({ name: r.name, lv: r.lv, rounds: r.rounds, ...(r.acc === acc ? { you: true } : {}) }));
}

// ------------------------------------------------------------------ the view and the card

/** Her seal for the Throne's tab (undefined below the cap). */
export function sealView(game: Game, s: PlayerSession): SealView | undefined {
  const p = s.profile;
  if (!p || p.level < MAX_LEVEL) return undefined;
  const seal = sealOf(game, p)!;
  const week = sealWeek(game);
  const ship = s.ship;
  let near: SealView['near'] = null;
  if (ship) {
    for (const l of lairsOfKind(game, seal.kind)) {
      const d = dist(l.x, l.y, ship.state.x, ship.state.y);
      if (!near || d < near.d) near = { x: Math.round(l.x), y: Math.round(l.y), d: Math.round(d), island: lairIsland(game, l) };
    }
  }
  const l = ship ? lairInReachOf(game, s, new Set([seal.kind])) : null;
  const pay = sealPay(seal.lv);
  return {
    lv: seal.lv, kind: seal.kind, affixes: sealAffixes(seal.lv, week), rounds: sealRounds(seal.lv), fast: fastRounds(seal.lv), week,
    best: seal.best?.week === week ? { lv: seal.best.lv, rounds: seal.best.rounds } : null, near, reach: !!l, why: whyNot(game, s, l),
    pay: { silver: pay.silver, pearls: pay.pearls, art: pay.art }, board: sealBoard(game, s.accountId), runs: seal.runs, timed: seal.timed,
    ...(landFighting(game, s) ? { fighting: true } : {}),
  };
}

/** A lair's card: the seal's depth when she holds a seal of its kind (installed by Game, as the lairs' own hooks). */
export function installSealHooks(): void {
  lairCardHooks.sealOf = (game, s) => {
    const p = s.profile;
    const seal = p && p.level >= MAX_LEVEL ? sealOf(game, p) : null;
    return seal ? { kind: seal.kind, lv: seal.lv } : null;
  };
  lairCardHooks.enter = enterDepth;
  lairCardHooks.seal = (game, s, l) => {
    const p = s.profile;
    if (!p || p.level < MAX_LEVEL) return undefined;
    const seal = sealOf(game, p);
    if (!seal) return undefined;
    // On whichever lair's card she sees while her boats reach her seal's (an island's chain shows its nearest step).
    const at = lairInReachOf(game, s, new Set([seal.kind]));
    if (!at && seal.kind !== l.kind) return undefined;
    return { lv: seal.lv, kind: seal.kind, why: whyNot(game, s, at) };
  };
}

// ------------------------------------------------------------------ the tester's command

/** `/seal [lv N|kind K|go|win [rounds]|lose|reset|board]` (admin.ts). */
export function adminSeal(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  if (p.level < MAX_LEVEL) return `The seals open at level ${MAX_LEVEL} (/level ${MAX_LEVEL}).`;
  const seal = sealOf(game, p)!;
  const say = () => `Seal ${seal.lv}: ${lairName(seal.kind)}, ${sealRounds(seal.lv)} rounds.`;
  switch (args[0]) {
    case undefined:
      return say();
    case 'lv': {
      const n = Number(args[1]);
      if (!(n >= SEAL_MIN && n <= SEAL_MAX)) return `Usage: /seal lv ${SEAL_MIN}-${SEAL_MAX}`;
      seal.lv = clampSeal(n);
      return say();
    }
    case 'kind': {
      const k = args[1] as LairKind;
      if (!KINDS.has(k)) return `Kinds: ${SEAL_KINDS.join(', ')}`;
      seal.kind = k;
      return say();
    }
    case 'go': {
      const ship = s.ship!;
      let best: Lair | null = null, bd = Infinity;
      for (const l of lairsOfKind(game, seal.kind)) {
        const d = dist(l.x, l.y, ship.state.x, ship.state.y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      if (!best) return `${lairName(seal.kind)}: none on the sea.`;
      goToLair(game, s, best);
      return `Off ${lairName(seal.kind)} on ${lairIsland(game, best)}.`;
    }
    case 'win':
    case 'lose': {
      const won = args[0] === 'win';
      const lv = seal.lv;
      const rounds = Number(args[1]) || (won ? fastRounds(lv) : sealRounds(lv));
      const step = sealStep(won, rounds, lv);
      seal.runs++;
      if (won && rounds <= sealRounds(lv)) {
        seal.timed++;
        noteBest(game, s, seal, lv, rounds);
      }
      seal.lv = clampSeal(seal.lv + step);
      if (step > 0) seal.kind = pickKind(game, seal.kind);
      return say();
    }
    case 'reset':
      p.seal = undefined;
      sealOf(game, p);
      return say();
    case 'board':
      return sealBoard(game, s.accountId).map((r, i) => `${i + 1}. ${r.name} ${r.lv} (${r.rounds})`).join(' · ') || 'The table is empty this week.';
    default:
      return 'Usage: /seal [lv N|kind K|go|win [rounds]|lose|reset|board]';
  }
}
