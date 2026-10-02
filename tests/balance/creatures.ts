// docs/18 #47: an army with creatures against the sea's pirates of its level — the ladder's crew of the level and her
// hammocks with a drift's group aboard in place of as many hands, as the boarding battle fights it out.
//
// The battle is steep in the make-up of small stacks (docs/17 H5): the ladder's own crew against the pirates is 50%
// at the hammocks PIRATE_CAL was measured at, but anywhere from 19% to 70% at ⚓4–5 with a tenth more or fewer men
// (node tools/balance-h7.ts prints it). So an army is judged here over a band of hammocks — 85% to 115% of the ladder's
// in seven steps — the pirates with the same men; the group is one stack more (the slot it takes is not reckoned:
// folding a stack of men into another to make room swings the battle by itself, and is no creature's doing).
//   node tools/balance-h7.ts           the report (section "armies with creatures")
//   node tools/balance-h7.ts --calibrate-drifts [kind…]    DRIFT_CAL from the battle

import { armyForLevel } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { DRIFTS, DRIFT_KINDS, NATIVE, driftCount, peopleOf } from '../../shared/src/data/drifts.ts';
import type { DriftKind } from '../../shared/src/data/drifts.ts';
import { Rng } from '../../shared/src/rng.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacArmyEntry, TacSideInput } from '../../server/src/game/tacbattle.ts';

/** The ladder's hammocks of each level (tests/heroes6.test.ts holds the ladder to them). */
export const CREW = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];
/** The band of hammocks an army is judged over. */
export const BAND = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15];

export function side(army: TacArmyEntry[], mixed = 0, captain: CaptainId | null = 'corsair'): TacSideInput {
  return {
    name: 'Captain', ship: 'Wake', captain, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
    extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, mixed,
  };
}

/** The first side's wins of `n` boardings. */
export function wins(a: TacSideInput, b: TacSideInput, n: number, seed = 7): number {
  let w = 0;
  for (let k = 0; k < n; k++) {
    const s = k * 31 + seed;
    const rng = new Rng(s);
    const bt = newBattle(a, b, s, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w / n;
}

/** The ladder's crew of ⚓L with `M` hammocks, a group of `n` creatures `u` aboard in place of as many hands (a
 *  favourite of her path: `fav`). */
export function withGroup(L: number, M: number, u: UnitId, n: number, fav = false): TacArmyEntry[] {
  const a: TacArmyEntry[] = armyForLevel(L, M, 7, 'player').map((x) => ({ ...x }));
  const hands = a.find((x) => x.u === 'deckhand') ?? a[a.length - 1];
  const k = Math.max(0, Math.min(hands.n - 1, n));
  hands.n -= k;
  a.push({ u, n: k, ...(fav ? { fav: true } : {}) });
  return a.filter((x) => x.n > 0);
}

/** The path whose own people a creature is (the native morale and the favourite's edge), if any. */
export function nativePath(u: UnitId): CaptainId | null {
  const p = peopleOf(u);
  return (Object.entries(NATIVE).find(([, q]) => q === p)?.[0] as CaptainId | undefined) ?? null;
}

export interface GroupWin {
  /** Over the band, with a mixed army's −1 morale; with her path's own people (morale 0, the favourite's edge). */
  band: number;
  native: number;
  /** At the ladder's own hammocks, −1. */
  exact: number;
  n: number;
}

/** A drift's group of ⚓L (n creatures: its count by default) with the ladder's crew against the pirates. */
export function groupWin(kind: DriftKind, L: number, fights = 60, n = driftCount(kind, L), parts: ('band' | 'native' | 'exact')[] = ['band', 'native', 'exact']): GroupWin {
  const u = DRIFTS[kind].u as UnitId;
  const nat = nativePath(u);
  const over = (fav: boolean, mixed: number) => BAND.reduce((acc, f) => {
    const M = Math.round(CREW[L] * f);
    // The same captain's book on both sides (a path's own book is the paths' table's business, not the creatures').
    return acc + wins(side(withGroup(L, M, u, n, fav && !!nat), mixed), side(armyForLevel(L, M, 7, 'pirate'), 0), fights);
  }, 0) / BAND.length;
  return {
    band: parts.includes('band') ? over(false, -1) : NaN,
    native: parts.includes('native') ? over(true, 0) : NaN,
    exact: parts.includes('exact') ? wins(side(withGroup(L, CREW[L], u, n), -1), side(armyForLevel(L, CREW[L], 7, 'pirate'), 0), fights * 4) : NaN,
    n,
  };
}

/** The everyday kinds of drift at a level (legends apart, any waters). */
export const driftKindsAt = (L: number): DriftKind[] => DRIFT_KINDS.filter((k) => !DRIFTS[k].legend && L >= DRIFTS[k].lv[0] && L <= DRIFTS[k].lv[1]);

/** The ladder's own crew against the pirates over the band (the baseline the creatures are weighed against). */
export function ladderBand(L: number, fights = 60): number {
  return BAND.reduce((acc, f) => {
    const M = Math.round(CREW[L] * f);
    return acc + wins(side(armyForLevel(L, M, 7, 'player')), side(armyForLevel(L, M, 7, 'pirate')), fights);
  }, 0) / BAND.length;
}

/** DRIFT_CAL for a kind: at each of its levels, the multiple of its uncalibrated count whose group — both in a mixed
 *  army (−1 morale) and with its path's own people (0, the favourite's edge) — wins within 45–60% over the band, the
 *  one nearest its worth's own head count; else the one whose worse case misses the band least. */
export function calibrateDrift(kind: DriftKind, base: (L: number) => number, fights = 60, target = 0.52, log?: (s: string) => void): number[] {
  const row = Array<number>(11).fill(1);
  for (let L = DRIFTS[kind].lv[0]; L <= DRIFTS[kind].lv[1]; L++) {
    const n0 = base(L);
    const tried = new Map<number, [number, number]>();
    for (const m of [0.08, 0.15, 0.25, 0.4, 0.6, 0.8, 1, 1.25, 1.6, 2, 2.6, 3.4]) {
      const n = Math.max(1, Math.round(n0 * m));
      if (!tried.has(n)) {
        const g = groupWin(kind, L, fights, n, ['band', 'native']);
        tried.set(n, [g.band, g.native]);
      }
    }
    const miss = ([a, b]: [number, number]) => Math.max(0, 0.45 - Math.min(a, b), Math.max(a, b) - 0.6) + Math.abs((a + b) / 2 - target) * 0.1;
    const inside = [...tried].filter(([, w]) => miss(w) < 0.01).sort((a, b) => Math.abs(Math.log(a[0] / n0)) - Math.abs(Math.log(b[0] / n0)));
    const [bn, bw] = inside[0] ?? [...tried].sort((a, b) => miss(a[1]) - miss(b[1]) || a[0] - b[0])[0];
    row[L] = Math.round((bn / n0) * 100) / 100;
    log?.(`${kind} ⚓${L}: ${n0} → ${bn} (${Math.round(bw[0] * 100)}/${Math.round(bw[1] * 100)}%) tried ${[...tried].map(([n, w]) => `${n}:${Math.round(w[0] * 100)}/${Math.round(w[1] * 100)}`).join(' ')}`);
  }
  return row;
}
