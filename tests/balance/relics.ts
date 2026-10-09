// docs/19 E12, E17 (relics): a captain of the cap in her artifacts against another in hers, in the boarding battle.
// Both walk the same path at level 60 (⚓10, 600 men of the ladder's army) with the same eight secondary skills at
// expert (tools/balance-glory.ts BUILD); only what they wear differs:
//   bare         no artifacts at all;
//   sets         the best kit of the old artifacts — the three sets of three and the Medal of Saint Mercy (ten slots);
//   union_crown  the Boarding Union and the Crown of the Deep (ten slots: the pair that shares none);
//   orb_compass  the Storm Orb and the Compass of the Throne (the other such pair);
//   <relic>      that relic alone (its parts' slots, the rest empty);
//   forged       the sets' kit with every piece forged at its best line's top (the anvil's ceiling, docs/19 E13).
// `node tools/balance-relics.ts [battles]` prints the table; tests/relics.test.ts holds the bounds.

import { Rng } from '../../shared/src/rng.ts';
import { armyForLevel } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../../shared/src/data/captains.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { ART_SETS, ARTIFACTS, FORGE_LINE, RELICS, RELIC_IDS, artTotals, forgeSpan, makeArtifact } from '../../shared/src/data/artifacts.ts';
import type { ForgeLine, RelicId } from '../../shared/src/data/artifacts.ts';
import { heroBattle, primsAtLevel, startingOrders } from '../../shared/src/data/hero.ts';
import type { HeroBattle, SkillSlot } from '../../shared/src/data/hero.ts';
import type { Item } from '../../shared/src/data/items.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';

export const LEVEL = 60;
export const MEN = 600;
/** The build both share (tools/balance-glory.ts). */
export const BUILD: SkillSlot['id'][] = ['boarding', 'armor', 'artillery', 'leadership', 'tactics', 'luck', 'first_aid', 'mysticism'];

export type Kit = 'bare' | 'sets' | 'union_crown' | 'orb_compass' | 'forged' | RelicId;

const parts = (r: RelicId): string[] => RELICS[r].parts;

/** What a kit wears. */
export function kitItems(kit: Kit): Item[] {
  let ids: string[] = [];
  if (kit === 'sets' || kit === 'forged') ids = [...Object.values(ART_SETS).flatMap((s) => s.pieces), 'mercy_medal'];
  else if (kit === 'union_crown') ids = [...parts('boarding_union'), ...parts('crown_of_the_deep')];
  else if (kit === 'orb_compass') ids = [...parts('storm_orb'), ...parts('throne_compass')];
  else if (kit !== 'bare') ids = parts(kit);
  const items = ids.map((id, i) => makeArtifact(id, i + 1));
  if (kit === 'forged') {
    // Each piece's forged line at its top, in turn over the battle's lines (the caps hold the sum).
    const lines: ForgeLine[] = ['melee', 'shot', 'taken', 'orders', 'cost', 'raise'];
    items.forEach((it, i) => {
      const k = lines[i % lines.length];
      it.forge = { n: 1, k, v: forgeSpan(it.art!, k)[1] };
    });
  }
  return items;
}

/** A captain of her path at the cap with the build and a kit. */
export function kitHero(c: CaptainId, seed: number, kit: Kit): HeroBattle {
  const prim = primsAtLevel(c, seed, LEVEL);
  const a = artTotals(kitItems(kit));
  const p = { atk: prim.atk + a.prim.atk, def: prim.def + a.prim.def, pow: prim.pow + a.prim.pow, will: prim.will + a.prim.will };
  const skills: SkillSlot[] = BUILD.map((id) => ({ id, r: 3 as SkillSlot['r'] }));
  return heroBattle(p, skills, a, startingOrders(c), Number.POSITIVE_INFINITY, { path: c, level: LEVEL });
}

const side = (army: ArmyStack[], hero: HeroBattle, captain: CaptainId): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero,
});

function fight(A: TacSideInput, B: TacSideInput, k: number): boolean {
  const rng = new Rng(9100 + k * 37);
  const flip = k % 2 === 1;
  const bt = newBattle(flip ? B : A, flip ? A : B, k + 5, 0, rng);
  quickFinish(bt, 0, rng);
  return (bt.over!.winner === 0) !== flip;
}

/** The share of battles a captain in kit `a` wins against one in kit `b` (every path, its own mirror). */
export function kitShare(a: Kit, b: Kit, n: number): number {
  let w = 0, all = 0;
  for (const c of CAPTAIN_IDS) for (let k = 0; k < n; k++) {
    const army = () => armyForLevel(10, MEN, 7, 'player');
    if (fight(side(army(), kitHero(c, 11 + k * 7, a), c), side(army(), kitHero(c, 5 + k * 13, b), c), k)) w++;
    all++;
  }
  return w / all;
}

/** A relic's gift over its parts', in primaries and the battle's lines, for the table. */
export function relicBudget(r: RelicId): { prim: number; parts: number } {
  const d = RELICS[r];
  const sum = (p?: Partial<Record<string, number>>): number => Object.values(p ?? {}).reduce((x: number, y) => x + (y ?? 0), 0);
  return { prim: sum(d.prim), parts: d.parts.reduce((n, id) => n + sum(ARTIFACTS[id].prim), 0) };
}

/** Drops of relic parts until the first relic is whole (relics.ts PART_WEIGHT; the common parts come only by drops
 *  here, though the sea gives them too) — the mean over many captains. */
export function dropsToFirst(trials: number, weights = { lackOnly: 4, lackCommon: 1, held: 0.25 }): number {
  const rng = new Rng(4242);
  let total = 0;
  for (let t = 0; t < trials; t++) {
    const have = new Set<string>();
    let n = 0;
    while (!RELIC_IDS.some((r) => RELICS[r].parts.every((p) => have.has(p))) && n < 500) {
      const list: [string, number][] = [];
      for (const r of RELIC_IDS) for (const id of RELICS[r].parts) list.push([id, have.has(id) ? weights.held : ARTIFACTS[id].only ? weights.lackOnly : weights.lackCommon]);
      have.add(rng.weighted(list));
      n++;
    }
    total += n;
  }
  return total / trials;
}

export const FORGE_CAPS = Object.fromEntries(Object.entries(FORGE_LINE).map(([k, v]) => [k, v.cap]));
