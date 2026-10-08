// docs/19 E9: the seals' mythic depths against the reference captain of ⚓10 (tests/balance/lairs.ts's party — no hero,
// no glory, no mastery, no artifacts: the floor a captain at the cap stands on), both sides played by the sea's mind and
// the afflictions by the seal's director: how often she wins, wins in time, and what it costs her, by the seal's level.
//
// The table: node --disable-warning=ExperimentalWarning -e "import('./tests/balance/seals.ts').then((m) => m.printSeals())"

import { SEAL_KINDS, sealRounds } from '../../shared/src/data/seals.ts';
import type { LairKind } from '../../shared/src/data/lairs.ts';
import { simulateDepth } from '../../server/src/game/seals.ts';
import { refParty } from './lairs.ts';

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
  const party = refParty(10).map((x) => ({ ...x, n: Math.round(x.n * gear) }));
  let win = 0, timed = 0, loss = 0, rounds = 0, k = 0;
  for (const kind of kinds) {
    for (const week of weeks) {
      for (let i = 0; i < n; i++, k++) {
        const r = simulateDepth(kind, lv, week, party, 4000 + k * 37 + lv * 101);
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

/** The table: the reference captain (the floor at the cap) and one geared half as strong again (her hero, glory,
 *  mastery and artifacts, as a share of men). */
export function printSeals(levels = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]): void {
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  for (const lv of levels) {
    const f = depthFight(lv), g = depthFight(lv, SEAL_KINDS, [0, 7, 13, 22], 2, 1.5);
    console.log(`seal ${lv} (${sealRounds(lv)} r): floor win ${pc(f.win)} in time ${pc(f.timed)} lost ${pc(f.loss)} r ${f.rounds.toFixed(1)} · geared win ${pc(g.win)} in time ${pc(g.timed)} lost ${pc(g.loss)} r ${g.rounds.toFixed(1)}`);
  }
}
