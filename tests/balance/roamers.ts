// docs/19 D7: the creatures roaming the sea against a captain of their level — the ladder's usual crew of the level
// landing all but her watch (refParty, as the lairs and the drifts are fought), on the battle at sea of the stack's
// kind of field. What a stack costs her in men (ROAM_LOSS, calibrated), HoMM3's offer at ×3, and the lesson of an
// hour of steady fighting against seaHourXp (the target 0.6–0.8 of it): fights back to back, the sail between them
// measured on the world's own stacks, a fight's time by its rounds.
//   node tools/balance-roamers.ts [--calibrate [kind…]] [--xp]

import { UNITS, armyMen, armyPower } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { advHour } from '../../shared/src/data/advmap.ts';
import { ROAMS, ROAM_KINDS, ROAM_LOSS, ROAM_SIZES, ROAM_SIZE_W, ROAM_BATTLE_XP, ROAM_RAISE, ROAM_XP_SIZE, roamBase, roamCount, roamPay, roamRes, roamStacks, resWorth, seaHourXp } from '../../shared/src/data/roamers.ts';
import type { RoamKind, RoamSize } from '../../shared/src/data/roamers.ts';
import { Rng } from '../../shared/src/rng.ts';
import { killedHp, lossesOf, newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';
import { XP_UNITS, refLevel, xpUnit } from '../../shared/src/data/xpcurve.ts';
import { refParty } from './lairs.ts';

const side = (army: ArmyStack[], beasts: boolean): TacSideInput => ({
  name: beasts ? 'Stack' : 'Captain', ship: beasts ? 'Sea' : 'Wake', captain: beasts ? null : 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3,
  morale: beasts ? 50 : 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(beasts ? { noBook: true } : {}),
});

export interface RoamFight {
  win: number;
  /** Her landed men lost on average over all (a lost fight counting as all of them). */
  loss: number;
  /** Silver her lost men were worth, over the won fights. */
  refill: number;
  /** The share of the stack's hit points cut down, over the won fights (the battle's own lesson is XP_UNITS.creatures
   *  of it, docs/26: battleLesson); and its rounds. */
  battleXp: number;
  rounds: number;
}

/** `n` battles of her party against a stack (quick battle) on its own field. */
export function roamFight(me: ArmyStack[], stack: ArmyStack[], kind: RoamKind, n = 24): RoamFight {
  let win = 0, loss = 0, refill = 0, xp = 0, rounds = 0;
  const men = armyMen(me);
  for (let k = 0; k < n; k++) {
    const seed = k * 41 + 5;
    const rng = new Rng(seed);
    const bt = newBattle(side(me, false), side(stack, true), seed, 0, rng, { land: ROAMS[kind].field });
    quickFinish(bt, 0, rng);
    rounds += bt.round;
    if (bt.over!.winner === 0) {
      const lost = lossesOf(bt, 0);
      win++;
      loss += armyMen(lost) / men;
      refill += lost.reduce((a, x) => a + x.n * UNITS[x.u].cost, 0);
      xp += killedHp(bt, 0) / Math.max(1, bt.stacks.reduce((a, x) => a + (x.side === 1 ? x.start * x.hpMax : 0), 0));
    } else loss += 1;
  }
  return { win: win / n, loss: loss / n, refill: win ? refill / win : 0, battleXp: win ? xp / win : 0, rounds: rounds / n };
}

export const stackFight = (kind: RoamKind, L: number, size: RoamSize, n = 24): RoamFight => roamFight(refParty(L), roamStacks(kind, roamCount(kind, L, size)), kind, n);

/** The reference captain's might against a stack's (as the server reckons the ×3 of HoMM3's offer at her morale 70). */
export function roamOdds(kind: RoamKind, L: number, size: RoamSize): number {
  return (armyPower(refParty(L)) * 1.2) / (armyPower(roamStacks(kind, roamCount(kind, L, size))) * 1.2);
}

export const roamLevels = (kind: RoamKind): number[] => {
  const out: number[] = [];
  for (let L = ROAMS[kind].lv[0]; L <= ROAMS[kind].lv[1]; L++) out.push(L);
  return out;
};

/** Rebuild ROAM_CAL: for each kind, level and size, the multiple of its first reckoning that costs the captain its
 *  ROAM_LOSS (bisection on the battle itself). */
export function calibrate(kinds: RoamKind[] = ROAM_KINDS, log?: (s: string) => void): Record<RoamKind, [number, number, number][]> {
  const out = {} as Record<RoamKind, [number, number, number][]>;
  for (const kind of kinds) {
    const rows: [number, number, number][] = [[0, 0, 0]];
    for (let L = 1; L <= 10; L++) {
      if (L < ROAMS[kind].lv[0] || L > ROAMS[kind].lv[1]) {
        rows.push([0, 0, 0]);
        continue;
      }
      const me = refParty(L), base = roamBase(kind, L);
      const row = ROAM_SIZES.map((size) => {
        let lo = Math.log(0.05), hi = Math.log(20);
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          const n = Math.max(1, Math.round(base * Math.exp(mid)));
          if (roamFight(me, roamStacks(kind, n), kind).loss > ROAM_LOSS[size]) hi = mid;
          else lo = mid;
        }
        return Math.round(Math.exp((lo + hi) / 2) * 100) / 100;
      }) as [number, number, number];
      rows.push(row);
      log?.(`${kind} ⚓${L}: ${row.join(', ')}`);
    }
    out[kind] = rows;
  }
  return out;
}

/** Seconds a fight takes a captain at the table: the field opened and the reckoning read (25 s), and — played out —
 *  each round her stacks' turns (4 s each) and the creatures' (the sea's breath, 0.7 s); by quick combat, 5 s more.
 *  Steady fighting is reckoned half and half. */
export type FightPace = 'quick' | 'played' | 'steady';
export function fightSecs(rounds: number, mine: number, theirs: number, pace: FightPace = 'steady'): number {
  const quick = 30, played = 25 + rounds * (mine * 4 + theirs * 0.7);
  return pace === 'quick' ? quick : pace === 'played' ? played : (quick + played) / 2;
}

/** The sail between two stacks she means to fight (metres: the world's spacing, tests/roamers19.test.ts measures it,
 *  and a little of the way round to the next) at a cruising 12 m/s, and heaving to (10 s). */
export const ROAM_GAP = 1300;
export const sailSecs = (gap: number): number => gap / 12 + 10;

export interface XpHour {
  level: number;
  /** The lesson an hour (battle and stack), against seaHourXp. */
  xp: number;
  share: number;
  /** Silver and resources an hour, and the refill of the men lost, both in hours at sea. */
  silver: number;
  refill: number;
  fights: number;
}

interface Mix {
  w: number;
  f: RoamFight;
  size: RoamSize;
  kind: RoamKind;
  n: number;
  st: number;
}

function mixOf(L: number, fightsEach: number): Mix[] {
  const out: Mix[] = [];
  for (const kind of ROAM_KINDS) {
    if (L < ROAMS[kind].lv[0] || L > ROAMS[kind].lv[1]) continue;
    for (const size of ROAM_SIZES) {
      const n = roamCount(kind, L, size);
      const st = roamStacks(kind, n);
      out.push({ w: ROAMS[kind].weight * ROAM_SIZE_W[size], f: roamFight(refParty(L), st, kind, fightsEach), size, kind, n, st: st.length });
    }
  }
  return out;
}

/** The battle's whole lesson at ⚓L for its even captain (docs/26: XP_UNITS.creatures of her level's ship sunk). */
export const battleLesson = (L: number): number => XP_UNITS.creatures * xpUnit(refLevel(L));

/** An hour of steady fighting at ⚓L against the stacks of its waters (their kinds and sizes as the sea mixes them). */
export function xpHour(L: number, gap = ROAM_GAP, fightsEach = 12, pace: FightPace = 'steady'): XpHour {
  const me = refParty(L);
  let wsum = 0, secs = 0, xp = 0, silver = 0, refill = 0;
  for (const m of mixOf(L, fightsEach)) {
    const pay = roamPay(L, m.size);
    secs += m.w * (fightSecs(m.f.rounds, me.length, m.st, pace) + sailSecs(gap));
    xp += m.w * m.f.win * (m.f.battleXp * battleLesson(L) * ROAM_BATTLE_XP + pay.xp);
    silver += m.w * m.f.win * (pay.silver + resWorth(roamRes(m.kind, m.n)));
    refill += m.w * m.f.refill * m.f.win * (1 - ROAM_RAISE);
    wsum += m.w;
  }
  const fights = 3600 / (secs / wsum);
  const xpH = (xp / wsum) * fights;
  return { level: L, xp: Math.round(xpH), share: xpH / seaHourXp(L), silver: ((silver / wsum) * fights) / advHour(L), refill: ((refill / wsum) * fights) / advHour(L), fights: Math.round(fights) };
}

/** What an average stack's own lesson must be at ⚓L for the hour to come to `target` of seaHourXp: the battle's part
 *  measured, the rest the stack's (by the size mix of the fights won). */
export function lessonFor(L: number, target: number): { battle: number; need: number } {
  const h = xpHour(L);
  let wsum = 0, battle = 0, sizeMul = 0;
  for (const m of mixOf(L, 12)) {
    battle += m.w * m.f.win * m.f.battleXp * battleLesson(L) * ROAM_BATTLE_XP;
    sizeMul += m.w * m.f.win * ROAM_XP_SIZE[m.size];
    wsum += m.w;
  }
  const want = (target * seaHourXp(L)) / h.fights;
  const perBattle = battle / wsum;
  return { battle: perBattle, need: Math.max(0, (want - perBattle) / (sizeMul / wsum)) };
}

/** What an average stack's silver must be at ⚓L (a share of an hour at sea) for the steady hour's net — silver and
 *  spoils less the men it costs — to come to `net` hours at sea. */
export function silverFor(L: number, net: number): number {
  const h = xpHour(L);
  let wsum = 0, spoils = 0, sizeMul = 0;
  for (const m of mixOf(L, 12)) {
    spoils += m.w * m.f.win * resWorth(roamRes(m.kind, m.n));
    sizeMul += m.w * m.f.win * ROAM_XP_SIZE[m.size];
    wsum += m.w;
  }
  const wantFight = ((net + h.refill) * advHour(L)) / h.fights - spoils / wsum;
  return Math.max(0, wantFight / (sizeMul / wsum) / advHour(L));
}
