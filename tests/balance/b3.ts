// docs/24 B3 (owner, 2026-10-07): «когда ядрами атакуешь корабль — убиваются сперва существа с маленьким HP и потом по
// возрастанию». A cannonade on a crew of a level's usual make, its dead taken
//   old   — by exposure, every stack its share (the rule before B3: shared/src/data/army.ts armyRemove);
//   count — the same number of men, the fewest hit points a man first (only the order changed; not the game's rule);
//   hp    — the game's rule (armyShot): the same hit points of men as before, the fewest hit points a man first, the
//           top man's wounds carried to the next ball (HoMM3's damage rolling over its stacks).
// Each ball is weighed as combat.ts weighs it: a few deckhands' worth, times her army's toughness against her level's
// usual (army.ts killFactor). The full table: node tools/balance-b3.ts

import { UNITS, armyForLevel, armyKillFactor, armyRemove, armyShot, armyTidy } from '../../shared/src/data/army.ts';
import type { ArmyMix, ArmyStack } from '../../shared/src/data/army.ts';
import { Rng } from '../../shared/src/rng.ts';

export type LossRule = 'old' | 'count' | 'hp';

const base = (L: number, mix: ArmyMix) => armyKillFactor(armyForLevel(L, 1000, 7, mix));

function byCount(army: ArmyStack[], k: number): void {
  const order = [...army].sort((a, b) => UNITS[a.u].hp - UNITS[b.u].hp || UNITS[a.u].def - UNITS[b.u].def);
  for (const s of order) {
    const t = Math.min(s.n, k);
    s.n -= t;
    k -= t;
    if (k <= 0) break;
  }
  for (let i = army.length - 1; i >= 0; i--) if (army[i].n <= 0) army.splice(i, 1);
}

/** A crew of `men` of ⚓`L`'s usual `mix` after `hits` balls, its dead taken by `rule`. */
export function cannonade(L: number, mix: ArmyMix, rule: LossRule, seed: number, hits = 12, men = 120): ArmyStack[] {
  const army = armyForLevel(L, men, 7, mix).map((s) => ({ ...s }));
  const rng = new Rng(seed);
  const b = base(L, mix);
  let wound = 0;
  for (let h = 0; h < hits; h++) {
    const x = 3 * (0.5 + rng.float());
    const want = x * Math.max(0.2, Math.min(2, armyKillFactor(army) / b));
    let k = Math.floor(want);
    if (rng.float() < want - k) k++;
    if (rule === 'old') armyRemove(army, k);
    else if (rule === 'count') byCount(army, k);
    else wound = armyShot(army, k, wound).wound;
  }
  return armyTidy(army);
}
