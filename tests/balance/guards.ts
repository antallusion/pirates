// The adventure map against the sea's income (docs/17 H4): the neutral guards fought out in the boarding battle of
// docs/17 H1 by a captain of their waters' level (the ladder's usual crew of that level, REF_MEN, both sides the same
// captain's craft), and what beating them and visiting the things on the map is worth against the hour at sea
// (seaHour of island.ts) and against the men it costs to refill.
//
// The full report: node tools/balance-guards.ts (and --calibrate to rebuild GUARD_CAL from the battle itself).

import { UNITS, armyCost, armyForLevel, armyMen, armyPower } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { GUARD_KINDS, GUARD_LOSS, GUARD_SIZES, JOIN_RATIO, REF_MEN, chestPay, guardArmy, guardBaseArmy, guardKindsAt, guardPay } from '../../shared/src/data/advmap.ts';
import type { GuardKind, GuardSize } from '../../shared/src/data/advmap.ts';
import { Rng } from '../../shared/src/rng.ts';
import { lossesOf, newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';
import { seaHour } from './island.ts';

const side = (army: ArmyStack[]): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

/** The captain of ⚓L's army: the ladder's usual crew of her level. */
export const refArmy = (L: number): ArmyStack[] => armyForLevel(L, REF_MEN[L], 7, 'player');

export interface Fight {
  win: number;
  /** Her men lost in a won fight (share), and on average over all (a lost fight counting as all of them). */
  lostWin: number;
  loss: number;
  /** Silver her lost men were worth (the price of refilling them), on average over the won fights. */
  refill: number;
}

/** `n` boarding battles of her army against the guard's, fought out (quick battle). */
export function fight(me: ArmyStack[], guard: ArmyStack[], n = 24): Fight {
  let win = 0, lostWin = 0, loss = 0, refill = 0;
  const men = armyMen(me);
  for (let k = 0; k < n; k++) {
    const rng = new Rng(k * 31 + 7);
    const bt = newBattle(side(me), side(guard), k * 31 + 7, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) {
      const lost = lossesOf(bt, 0);
      const share = armyMen(lost) / men;
      win++;
      lostWin += share;
      loss += share;
      refill += lost.reduce((a, x) => a + x.n * UNITS[x.u].cost, 0);
    } else loss += 1;
  }
  return { win: win / n, lostWin: win ? lostWin / win : 1, loss: loss / n, refill: win ? refill / win : armyCost(me) };
}

export const guardFight = (kind: GuardKind, L: number, size: GuardSize, n = 24): Fight => fight(refArmy(L), guardArmy(kind, L, size), n);

/** The kinds of guard each level's waters keep (as the map puts them, the strange waters' too). */
export const kindsAt = (L: number): GuardKind[] => [...new Set([...guardKindsAt(L, true), ...guardKindsAt(L, false)])];

/** What a guarded chest pays at ⚓L against the hour at sea and the men an average guard costs: silver of the chest
 *  and the guard's own, less the refill. */
export function guardedChest(L: number, kind: GuardKind = 'holdout'): { silver: number; refill: number; net: number; hours: number; xp: number } {
  const f = guardFight(kind, L, 'avg');
  const silver = chestPay(L, true).silver + guardPay(L, 'avg').silver;
  return { silver, refill: Math.round(f.refill), net: Math.round(silver - f.refill), hours: (silver - f.refill) / seaHour(L), xp: guardPay(L, 'avg').xp };
}

/** The army that sees a guard flee or sign on: three times its might (HoMM3's offer). */
export function offerArmy(L: number, kind: GuardKind, size: GuardSize): number {
  return (JOIN_RATIO * armyPower(guardArmy(kind, L, size))) / Math.max(1, armyPower(refArmy(L)));
}

/** Rebuild GUARD_CAL: for each kind, level and size, the multiple of its first men that costs the reference captain
 *  its GUARD_LOSS (bisection on the battle itself). */
export function calibrate(): Record<GuardKind, [number, number, number][]> {
  const out = {} as Record<GuardKind, [number, number, number][]>;
  for (const kind of GUARD_KINDS) {
    out[kind] = [[0, 0, 0]];
    for (let L = 1; L <= 10; L++) {
      const me = refArmy(L), base = guardBaseArmy(kind, L);
      const row = GUARD_SIZES.map((size) => {
        let lo = Math.log(0.05), hi = Math.log(15);
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          const g = base.map((s) => ({ u: s.u, n: Math.max(1, Math.round(s.n * Math.exp(mid))) }));
          if (fight(me, g).loss > GUARD_LOSS[size]) hi = mid;
          else lo = mid;
        }
        return Math.round(Math.exp((lo + hi) / 2) * 100) / 100;
      }) as [number, number, number];
      out[kind].push(row);
    }
  }
  return out;
}

/** Rebuild GUARD_REFILL: the silver an average hold-out's fight costs the reference captain of each level in men. */
export function calibrateRefill(): number[] {
  const out = [0];
  for (let L = 1; L <= 10; L++) out.push(Math.round(guardFight('holdout', L, 'avg').refill));
  return out;
}
