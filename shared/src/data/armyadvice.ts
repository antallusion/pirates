// PLACEHOLDER (2026-10-28, the advice mailer — server/src/game/advice.ts). The real `armyAdvice` is being written on the
// branch batch-pc; on the merge THEIR file wins whole — keep this one's signature only: armyAdvice(captain) →
// {weak, ratio, step: {kind, textRu, textEn, building?, unit?}} | null.
// Here: the army's power (armyPower) against the ladder's own army of her level with as many men (armyForLevel), weak
// under 70%; the step — hire the best tier her island already grows, else build the next dwelling, else fill the stacks.

import { UNITS, armyForLevel, armyMen, armyPower } from './army.ts';
import type { ArmyStack } from './army.ts';
import { TIER_SHIP_LEVEL, TIER_UNIT, TOWN } from './town.ts';
import type { TownId } from './town.ts';

export interface ArmyAdviceCaptain {
  level: number;
  army: readonly ArmyStack[];
  /** Her island's town buildings by level (null: no island). */
  town?: Partial<Record<string, number>> | null;
  /** Her ship's level (the tiers it berths), her hammocks and stacks when known. */
  shipLevel?: number;
  crewMax?: number;
  slots?: number;
}

export interface ArmyAdviceStep {
  kind: 'hire' | 'build' | 'island' | 'fill' | (string & {});
  textRu: string;
  textEn: string;
  building?: string;
  unit?: string;
}

export interface ArmyAdvice {
  weak: boolean;
  ratio: number;
  step: ArmyAdviceStep;
}

/** Weak under this share of her level's norm. */
export const WEAK_RATIO = 0.7;

export function armyAdvice(c: ArmyAdviceCaptain): ArmyAdvice | null {
  if (!c || !Number.isFinite(c.level) || c.level < 2) return null;
  const men = Math.max(armyMen(c.army), c.crewMax ?? 0);
  const norm = armyPower(armyForLevel(c.level, Math.max(1, men), c.slots ?? 5, 'player'));
  if (norm <= 0) return null;
  const ratio = Math.round((armyPower(c.army) / norm) * 100) / 100;
  const ship = c.shipLevel ?? 10;
  const has = (t: number) => c.army.some((s) => (UNITS[s.u]?.tier ?? 0) >= t);
  let step: ArmyAdviceStep = { kind: 'fill', textRu: 'Заполните пустые места в отрядах лучшими бойцами, каких можно нанять.', textEn: 'Fill the empty places in your stacks with the best men you can hire.' };
  const town = c.town;
  if (!town) step = { kind: 'island', textRu: 'Займите свой остров и постройте на нём Казарму морпехов.', textEn: 'Claim an island of your own and build a Marine Barracks on it.' };
  else {
    let hire = 0;
    for (let t = 7; t >= 2; t--) if ((town[`dw${t}`] ?? 0) > 0 && ship >= TIER_SHIP_LEVEL[t] && !has(t)) { hire = t; break; }
    if (hire) {
      const u = TIER_UNIT[hire];
      step = { kind: 'hire', unit: u, textRu: `Наймите бойцов ${hire}-го тира на острове или в любом порту.`, textEn: `Hire tier ${hire} men on your island or in any port.` };
    } else {
      for (let t = 2; t <= 6; t++) {
        if ((town[`dw${t}`] ?? 0) > 0) continue;
        const id = `dw${t}` as TownId;
        step = { kind: 'build', building: id, textRu: `Постройте на острове «${TOWN[id].names[0][1]}»: оно откроет бойцов ${t}-го тира.`, textEn: `Build the ${TOWN[id].names[0][0]} on your island: it opens tier ${t} men.` };
        break;
      }
    }
  }
  return { weak: ratio < WEAK_RATIO, ratio, step };
}
