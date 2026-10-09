// docs/19 E11: the boardings each tier of the Abyss asks of a captain of the cap — the ladder's ⚓10 crew (times `gear`:
// her hero, glory, mastery and artifacts as a share of men), fresh for every boarding, against what is left of the
// tier's legend army from the boarding before (the raid wears it down all week), both sides played by the sea's mind.
//
// The table: node --disable-warning=ExperimentalWarning -e "import('./tests/balance/abyssraid.ts').then((m) => console.log(m.raidBoardings(1.3, 12)))"

import { armyForLevel } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { RAID_TIERS, raidArmy } from '../../shared/src/data/abyssraid.ts';
import { Rng } from '../../shared/src/rng.ts';
import { newBattle, quickFinish } from '../../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../../server/src/game/tacbattle.ts';

const side = (army: ArmyStack[], captain: TacSideInput['captain']): TacSideInput => ({
  name: 'x', ship: 'y', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
  morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

/** The median boardings to take each tier, over `runs` raids. */
export function raidBoardings(gear: number, runs: number): number[] {
  const out: number[] = [];
  for (let t = 1; t <= RAID_TIERS; t++) {
    const tries: number[] = [];
    for (let run = 0; run < runs; run++) {
      let foe = raidArmy(t), k = 0;
      for (; k < 30; k++) {
        const me = armyForLevel(10, 600, 7, 'player').map((x) => ({ ...x, n: Math.round(x.n * gear) }));
        const seed = 1000 + run * 97 + k * 13 + t;
        const rng = new Rng(seed);
        const bt = newBattle(side(me, 'corsair'), side(foe, 'drowned'), seed, 0, rng);
        quickFinish(bt, 0, rng);
        if (bt.over!.winner === 0) break;
        foe = bt.stacks.filter((s) => s.side === 1 && s.count > 0).map((s) => ({ u: s.unit as UnitId, n: s.count }));
      }
      tries.push(k + 1);
    }
    tries.sort((a, b) => a - b);
    out.push(tries[Math.floor(tries.length / 2)]);
  }
  return out;
}
