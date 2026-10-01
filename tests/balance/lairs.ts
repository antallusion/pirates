// The lairs of the land's creatures against the sea's income (docs/18 II item 24): each kind of lair fought out ashore
// (the battle of docs/17 H1 on the land field, docs/18 #15) by a captain of its level — the ladder's usual crew of that
// level (REF_MEN) landing all but her watch — and what its loot is worth against the men it costs and the hour at sea.
//
// The full report: node tools/balance-lairs.ts (and --calibrate to rebuild LAIR_CAL and LAIR_REFILL from the battle).

import { UNITS, armyCost, armyMen, armyPower } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { advHour } from '../../shared/src/data/advmap.ts';
import { LAIRS, LAIR_KINDS, LAIR_LOSS, LAIR_SIZES, lairArmy, lairBaseArmy, lairPay, landParty, payWorth } from '../../shared/src/data/lairs.ts';
import type { LairKind, LairSize } from '../../shared/src/data/lairs.ts';
import { Rng } from '../../shared/src/rng.ts';
import { lossesOf, newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';
import { refArmy } from './guards.ts';

const side = (army: ArmyStack[], beasts: boolean): TacSideInput => ({
  name: beasts ? 'Lair' : 'Captain', ship: beasts ? 'Island' : 'Wake', captain: beasts ? null : 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3,
  morale: beasts ? 50 : 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(beasts ? { noBook: true } : {}),
});

/** The men the captain of ⚓L lands. */
export const refParty = (L: number): ArmyStack[] => landParty(refArmy(L));

export interface LairFight {
  win: number;
  /** Her landed men lost in a won fight (share), and on average over all (a lost fight counting as all of them). */
  lostWin: number;
  loss: number;
  /** Silver her lost men were worth, on average over the won fights. */
  refill: number;
}

/** `n` battles ashore of her party against the lair's creatures (quick battle), on its first kind of island. */
export function landFight(me: ArmyStack[], lair: ArmyStack[], kind: LairKind, n = 24): LairFight {
  let win = 0, lostWin = 0, loss = 0, refill = 0;
  const men = armyMen(me);
  const land = LAIRS[kind].types[0];
  for (let k = 0; k < n; k++) {
    const seed = k * 37 + 11;
    const rng = new Rng(seed);
    const bt = newBattle(side(me, false), side(lair, true), seed, 0, rng, { land });
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

export const lairFight = (kind: LairKind, L: number, size: LairSize, n = 24): LairFight => landFight(refParty(L), lairArmy(kind, L, size), kind, n);

/** The levels a kind of lair lives at. */
export const levelsOf = (kind: LairKind): number[] => {
  const out: number[] = [];
  for (let L = LAIRS[kind].lv[0]; L <= LAIRS[kind].lv[1]; L++) out.push(L);
  return out;
};

/** Rebuild LAIR_CAL: for each kind, level and size, the multiple of its first creatures that costs the captain its
 *  LAIR_LOSS (bisection on the battle itself). */
export function calibrate(kinds: LairKind[] = LAIR_KINDS, log?: (s: string) => void): Record<LairKind, [number, number, number][]> {
  const out = {} as Record<LairKind, [number, number, number][]>;
  for (const kind of kinds) {
    const rows: [number, number, number][] = [[0, 0, 0]];
    for (let L = 1; L <= 10; L++) {
      if (L < LAIRS[kind].lv[0] || L > LAIRS[kind].lv[1]) {
        rows.push([0, 0, 0]);
        continue;
      }
      const me = refParty(L), base = lairBaseArmy(kind, L);
      const fixed = LAIRS[kind].role === 'guardian';
      const row = LAIR_SIZES.map((size) => {
        let lo = Math.log(0.05), hi = Math.log(15);
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          const g = base.map((s, j) => ({ u: s.u, n: fixed && j === 0 ? s.n : Math.max(1, Math.round(s.n * Math.exp(mid))) }));
          if (landFight(me, g, kind).loss > LAIR_LOSS[size]) hi = mid;
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

/** Rebuild LAIR_REFILL: the silver an average lair costs the captain of each level in men (over the kinds there). */
export function calibrateRefill(): number[] {
  const out = [0];
  for (let L = 1; L <= 10; L++) {
    const kinds = LAIR_KINDS.filter((k) => LAIRS[k].role === 'shore' && L >= LAIRS[k].lv[0] && L <= LAIRS[k].lv[1]);
    const r = kinds.map((k) => lairFight(k, L, 'avg').refill);
    out.push(Math.round(r.reduce((a, b) => a + b, 0) / Math.max(1, r.length)));
  }
  return out;
}

/** What beating a lair is worth at ⚓L against the men it costs and the hour at sea. */
export function lairWorth(kind: LairKind, L: number, size: LairSize): { worth: number; refill: number; net: number; hours: number } {
  const f = lairFight(kind, L, size);
  const worth = payWorth(lairPay(kind, L, size, LAIRS[kind].types[0]));
  return { worth: Math.round(worth), refill: Math.round(f.refill), net: Math.round(worth - f.refill), hours: (worth - f.refill) / advHour(L) };
}

/** The might of a lair's creatures against the captain's party (HoMM3's offer comes at three times). */
export const lairOdds = (kind: LairKind, L: number, size: LairSize): number => armyPower(refParty(L)) / Math.max(1, armyPower(lairArmy(kind, L, size)));
