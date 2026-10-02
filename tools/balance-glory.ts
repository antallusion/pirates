// docs/19 E17 (glory against might): a captain far past the cap against a fresh captain of the cap in the boarding
// battle, and the trials of mastery (E3).
//   node tools/balance-glory.ts [battles]             the table
//   node tools/balance-glory.ts 60 --calibrate        each legend's army (`men` in LEGENDS) for TRIAL_TARGET
//
// Both captains walk the same path at level 60 (⚓10, 600 men of the ladder's army), with the same eight secondary
// skills at expert. The captain of glory N has her glory's boons (each primary up to its cap, in turn), N/5 points of
// mastery spent on the battle's branches (Boarder, then Mystic), and — from glory 25 — her skills at grandmaster, one
// more each 10 ranks (all eight by glory 95). The trial: the fresh captain against each skill's legend (her army a
// share bigger, her primaries a little over, the skill at grandmaster).

import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { GM_RANK, PRIMS, SKILL_IDS, heroBattle, primsAtLevel, startingOrders } from '../shared/src/data/hero.ts';
import type { HeroBattle, PrimId, SkillId, SkillSlot } from '../shared/src/data/hero.ts';
import { GLORY_CAP, LEGENDS, MASTERY, TRIAL_MEN, TRIAL_TARGET, masteryPoints, throneLift } from '../shared/src/data/throne.ts';
import type { MasteryRanks } from '../shared/src/data/throne.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { applyLift, legendArmy, legendHero } from '../server/src/game/throne.ts';

const N = Number(process.argv[2] ?? 200);
const LEVEL = 60;
const SL = 10;
const MEN = 600;

/** The build both captains share: eight battle skills at expert. */
export const BUILD: SkillId[] = ['boarding', 'armor', 'artillery', 'leadership', 'tactics', 'luck', 'first_aid', 'mysticism'];

const side = (army: ArmyStack[], hero: HeroBattle, captain: CaptainId | null): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero,
});

/** Glory N's boons and mastery: the boons in turn over the primaries; the points on the Boarder, then the Mystic. */
export function gloryBuild(rank: number): { picks: Partial<Record<PrimId, number>>; nodes: MasteryRanks; gm: number } {
  const picks: Partial<Record<PrimId, number>> = {};
  for (let i = 0; i < Math.min(rank, 4 * GLORY_CAP); i++) {
    const k = PRIMS[i % 4];
    picks[k] = (picks[k] ?? 0) + 1;
  }
  const nodes: MasteryRanks = {};
  let pts = masteryPoints(rank);
  for (const b of ['boarder', 'mystic', 'admiral', 'merchant']) for (const n of MASTERY.filter((x) => x.branch === b)) while (pts > 0 && (nodes[n.id] ?? 0) < n.max) {
    nodes[n.id] = (nodes[n.id] ?? 0) + 1;
    pts--;
  }
  return { picks, nodes, gm: rank < 25 ? 0 : Math.min(BUILD.length, 1 + Math.floor((rank - 25) / 10)) };
}

/** A captain of her path at the cap with the build, and (glory > 0) her glory. */
export function capHero(c: CaptainId, seed: number, glory = 0): HeroBattle {
  const prim = primsAtLevel(c, seed, LEVEL);
  const g = gloryBuild(glory);
  const skills: SkillSlot[] = BUILD.map((id, i) => ({ id, r: (i < g.gm ? GM_RANK : 3) as SkillSlot['r'] }));
  const hb = heroBattle(prim, skills, null, startingOrders(c), prim.will * 10, { path: c, level: LEVEL });
  return glory > 0 ? applyLift(hb, throneLift(g.picks, g.nodes), Number.POSITIVE_INFINITY) : hb;
}

function fight(A: TacSideInput, B: TacSideInput, k: number): boolean {
  const rng = new Rng(7000 + k * 31);
  const flip = k % 2 === 1;
  const bt = newBattle(flip ? B : A, flip ? A : B, k + 3, 0, rng);
  quickFinish(bt, 0, rng);
  return (bt.over!.winner === 0) !== flip;
}

const army = (): ArmyStack[] => armyForLevel(SL, MEN, 7, 'player');

/** The share of battles a captain of glory `g` wins against a fresh one of the cap (every path, its own mirror). */
export function gloryShare(g: number, n: number): number {
  let w = 0, all = 0;
  for (const c of CAPTAIN_IDS) for (let k = 0; k < n; k++) {
    if (fight(side(army(), capHero(c, 11 + k * 7, g), c), side(army(), capHero(c, 5 + k * 13, 0), c), k)) w++;
    all++;
  }
  return w / all;
}

/** The share of trials a fresh captain of the cap wins against each skill's legend. */
export function trialShare(skill: SkillId, n: number): number {
  let w = 0, all = 0;
  for (const c of CAPTAIN_IDS) for (let k = 0; k < n; k++) {
    const prim = primsAtLevel(c, 11 + k * 7, LEVEL);
    const mine = capHero(c, 11 + k * 7, 0);
    const a = army();
    const skills: SkillSlot[] = BUILD.map((id) => ({ id, r: 3 as SkillSlot['r'] }));
    if (fight(side(a, mine, c), side(legendArmy(a, skill), legendHero(skill, prim, skills), null), k)) w++;
    all++;
  }
  return w / all;
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
if ((import.meta.main ?? process.argv[1]?.endsWith('balance-glory.ts')) && process.argv.includes('--calibrate')) {
  // Bisection on each legend's army for TRIAL_TARGET (the same battles each step).
  const out: Record<string, number> = {};
  for (const id of SKILL_IDS) {
    let lo = TRIAL_MEN, hi = 1.5;
    const L = LEGENDS[id] as { men: number };
    L.men = lo;
    if (trialShare(id, N) <= TRIAL_TARGET) {
      out[id] = lo;
      continue;
    }
    for (let i = 0; i < 9; i++) {
      L.men = (lo + hi) / 2;
      if (trialShare(id, N) > TRIAL_TARGET) lo = L.men;
      else hi = L.men;
    }
    out[id] = Math.round(((lo + hi) / 2) * 100) / 100;
    L.men = out[id];
    console.log(`  ${id}: ${out[id]} → ${pc(trialShare(id, N))}`);
  }
  console.log(JSON.stringify(out));
} else if (import.meta.main ?? process.argv[1]?.endsWith('balance-glory.ts')) {
  console.log(`Glory against might (level ${LEVEL}, ⚓${SL}, ${MEN} men, ${N} battles a path):`);
  for (const g of [0, 10, 25, 50, 75, 100, 200]) {
    const b = gloryBuild(g);
    const l = throneLift(b.picks, b.nodes);
    console.log(`  glory ${String(g).padStart(3)}: ${pc(gloryShare(g, N)).padStart(4)}  (grandmasters ${b.gm}, lift melee ${pc(l.melee)} shot ${pc(l.shot)} taken ${pc(l.taken)} orders ${pc(l.orders)} will ${pc(l.will)})`);
  }
  console.log(`Trials of mastery (a fresh captain of the cap against each legend, ${N} battles a path):`);
  const shares = SKILL_IDS.map((id) => [id, trialShare(id, N)] as const);
  for (const [id, x] of shares) console.log(`  ${id.padEnd(11)} ${pc(x)}`);
  console.log(`  mean ${pc(shares.reduce((n, [, x]) => n + x, 0) / shares.length)}`);
}
