// docs/19 E9: the seals' mythic depths against the captain of the cap (capParty: her man-of-war's crew, her hero of
// level 60 with her level's skills and artifacts — no glory, no mastery, no relics: the floor a captain at the cap
// stands on), both sides played by the sea's mind and the afflictions by the seal's director: how often she wins, wins
// in time, and what it costs her, by the seal's level.
//
// The table: node --disable-warning=ExperimentalWarning -e "import('./tests/balance/seals.ts').then((m) => m.printSeals())"

import { SEAL_KINDS, sealRounds } from '../../shared/src/data/seals.ts';
import type { LairKind } from '../../shared/src/data/lairs.ts';
import { landParty } from '../../shared/src/data/lairs.ts';
import { armyForLevel } from '../../shared/src/data/army.ts';
import { MAX_LEVEL } from '../../shared/src/constants.ts';
import { referenceKit } from '../../shared/src/data/seabalance.ts';
import { CAPTAIN_SLOTS, ITEM_BASES } from '../../shared/src/data/items.ts';
import { computeShipStats } from '../../shared/src/sim/shipstats.ts';
import { simulateDepth } from '../../server/src/game/seals.ts';
import { PATHS, captainAt } from './boardlen.ts';

/** Playthrough C: the cap's own captain — her man-of-war of ⚓10 in the yard's reference kit (as `/kit build` fits her:
 *  911 hands), her army by the ladder, landed all but her watch, and her hero of level 60 with her level's skills and
 *  artifacts (boardlen.ts captainAt), her path in turn. The table stood on a party without a hero (360 men, no skills,
 *  no book), and ashore the hero is most of the fight. */
export function capParty(gear = 1): ReturnType<typeof landParty> {
  const kit = referenceKit(10);
  const worn = kit.filter((it) => (CAPTAIN_SLOTS as readonly string[]).includes(ITEM_BASES[it.base].slot));
  const gearOn = Object.fromEntries(kit.filter((it) => !worn.includes(it)).map((it) => [ITEM_BASES[it.base].slot, it]));
  const st = computeShipStats({ classId: 'man_o_war', level: 10, name: 'Cap', guns: { port: 'demi_cannon_32', starboard: 'demi_cannon_32' }, modules: {}, gear: gearOn }, 'corsair', {}, [], worn);
  return landParty(armyForLevel(10, Math.round(st.crewMax * gear), 7, 'player'));
}

export interface DepthFight {
  win: number;
  /** Won within the seal's rounds. */
  timed: number;
  /** Her landed men lost on average (a lost fight counting as all of them), and the rounds the fight ran. */
  loss: number;
  rounds: number;
}

/** `n` mythic depths of the reference ⚓10 party at a seal's level, over the kinds and the weeks given. */
export function depthFight(lv: number, kinds: readonly LairKind[] = SEAL_KINDS, weeks: readonly number[] = [0, 7, 13, 22], n = 2, gear = 1): DepthFight {
  const party = capParty(gear);
  let win = 0, timed = 0, loss = 0, rounds = 0, k = 0;
  for (const kind of kinds) {
    for (const week of weeks) {
      for (let i = 0; i < n; i++, k++) {
        const path = PATHS[k % PATHS.length];
        const r = simulateDepth(kind, lv, week, party, 4000 + k * 37 + lv * 101, captainAt(path, MAX_LEVEL, 11 + k), path);
        if (r.won) {
          win++;
          if (r.rounds <= sealRounds(lv)) timed++;
          loss += r.lost;
        } else loss += 1;
        rounds += r.rounds;
      }
    }
  }
  return { win: win / k, timed: timed / k, loss: loss / k, rounds: rounds / k };
}

/** The table: the cap's own captain (the floor) and one geared a fifth stronger (her glory, mastery and relics, as a
 *  share of men). */
export function printSeals(levels = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]): void {
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  for (const lv of levels) {
    const f = depthFight(lv), g = depthFight(lv, SEAL_KINDS, [0, 7, 13, 22], 2, 1.2);
    console.log(`seal ${lv} (${sealRounds(lv)} r): floor win ${pc(f.win)} in time ${pc(f.timed)} lost ${pc(f.loss)} r ${f.rounds.toFixed(1)} · geared win ${pc(g.win)} in time ${pc(g.timed)} lost ${pc(g.loss)} r ${g.rounds.toFixed(1)}`);
  }
}
