// docs/18 IV, the balance of the creatures in the army: the docs/17 targets kept (an even fight of two ladder crews,
// the ladder's crew against the sea's pirates), a ladder crew that took a drift's creatures aboard in place of as many
// hands — with the morale of a mixed army (−1) and with its path's own people (0) — against the pirates of her level,
// and what the creatures eat an hour against an hour at sea.
//   node tools/balance-drifts.ts [fights]

import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { advHour } from '../shared/src/data/advmap.ts';
import { DRIFTS, driftCount, upkeepHour } from '../shared/src/data/drifts.ts';
import type { DriftKind } from '../shared/src/data/drifts.ts';
import { Rng } from '../shared/src/rng.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';

const N = Number(process.argv[2] ?? 300);
const CREW = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600]; // the hammocks tests/heroes6.test.ts holds the ladder to

function win(a: ArmyStack[], b: ArmyStack[], mixedA = 0): number {
  const side = (army: ArmyStack[], mixed: number): TacSideInput => ({
    name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
    extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, mixed,
  });
  let w = 0;
  for (let k = 0; k < N; k++) {
    const rng = new Rng(k * 31 + 7);
    const bt = newBattle(side(a, mixedA), side(b, 0), k * 31 + 7, 0, rng);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return Math.round((w / N) * 100);
}

/** The ladder's crew with a slot made free for creatures: her seasoned sailors counted as deckhands (the baseline the
 *  creatures are weighed against — folding a stack of hers away would weaken her more than any creature lifts her). */
function freed(L: number): ArmyStack[] {
  const a = armyForLevel(L, CREW[L], 7, 'player').map((x) => ({ ...x }));
  const sailors = a.find((x) => x.u === 'sailor');
  const hands = a.find((x) => x.u === 'deckhand');
  if (sailors && hands) {
    hands.n += sailors.n;
    a.splice(a.indexOf(sailors), 1);
  }
  return a;
}

/** The ladder's crew with a drift's creatures aboard in place of as many of her hands. */
function withDrift(L: number, kind: DriftKind): ArmyStack[] {
  const a = freed(L);
  const n = driftCount(kind, L);
  const hands = a.find((x) => x.u === 'deckhand')!;
  const k = Math.min(hands.n - 1, n);
  hands.n -= k;
  a.push({ u: DRIFTS[kind].u as UnitId, n: k });
  return a.filter((x) => x.n > 0);
}

const KIND: Record<number, DriftKind> = { 1: 'seal_floe', 2: 'turtle_weed', 3: 'mermaid_net', 4: 'mermaid_net', 5: 'tentacle_chain', 6: 'serpent_wreck', 7: 'serpent_wreck', 8: 'mermaid_net', 9: 'serpent_wreck', 10: 'serpent_wreck' };
console.log(`fights a pair: ${N}`);
console.log('L  even(ladder×ladder)  ladder×pirates  freed×pirates  +drift(−1)×pirates  +drift(native 0)×pirates  drift  upkeep/h (share of an hour at sea)');
for (let L = 1; L <= 10; L++) {
  const ladder = armyForLevel(L, CREW[L], 7, 'player');
  const pirate = armyForLevel(L, CREW[L], 7, 'pirate');
  const kind = KIND[L];
  const mixed = withDrift(L, kind);
  const up = upkeepHour(mixed);
  console.log(`⚓${L}  ${win(ladder, ladder)}%  ${win(ladder, pirate)}%  ${win(freed(L), pirate)}%  ${win(mixed, pirate, -1)}%  ${win(mixed, pirate, 0)}%  ${driftCount(kind, L)} ${DRIFTS[kind].u} of ${armyMen(mixed)}  ${Math.round(up)} (${Math.round((up / advHour(L)) * 1000) / 10}%)`);
}
