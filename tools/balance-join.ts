// The beaten who come over after a boarding won (owner, 2026-10-08: «при успешном абордаже я должен забирать часть
// команды убитого корабля к себе, небольшую, чтобы поддерживать состав как-то и чтобы не посещать острова»): a captain
// of each level boarding the ships of her waters one after another, an hour at a time (KILLS_HOUR boardings an hour),
// her men lost against the beaten who come over to her (server/src/game/crew.ts beatenJoin: JOIN_SHARE and JOIN_LEAD
// a rank of her Leadership, never past her hammocks) — and the old prisoners' offer on top (30% of the survivors of a
// ship taken). Her crew is not refilled in port: what the boardings leave her is what she boards the next with.
//
//   node tools/balance-join.ts [chains] [leadership]

import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyMix, ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { ladder } from '../shared/src/data/shiplevel.ts';
import { Rng } from '../shared/src/rng.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { joinCount, joinKinds, joinShare } from '../server/src/game/crew.ts';
import { KILLS_HOUR } from '../tests/balance/island.ts';

const HAMMOCKS = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];
/** The contested waters' traffic (server/src/game/traffic.ts MIX): what she meets and boards, and how far below her each
 *  fights (a merchant two levels, a fisher one: canon D12's combat level), and the share of her hammocks it carries. */
const TRAFFIC: { role: string; w: number; mix: ArmyMix; gap: number; men: number }[] = [
  { role: 'merchant', w: 40, mix: 'merchant', gap: 2, men: 1 },
  { role: 'fisher', w: 20, mix: 'merchant', gap: 1, men: 0.5 },
  { role: 'patrol', w: 15, mix: 'navy', gap: 0, men: 1 },
  { role: 'pirate', w: 25, mix: 'pirate', gap: 0, men: 1 },
  { role: 'hunter', w: 8, mix: 'navy', gap: 0, men: 1 },
];

const side = (army: ArmyStack[], dealt: number): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

const tidy = (a: ArmyStack[]): ArmyStack[] => {
  const by = new Map<UnitId, number>();
  for (const x of a) if (x.n > 0) by.set(x.u, (by.get(x.u) ?? 0) + x.n);
  return [...by].map(([u, n]) => ({ u, n }));
};

/** One boarding: her army against a ship of the traffic. */
function board(me: ArmyStack[], L: number, t: (typeof TRAFFIC)[number], seed: number, lead: number): { won: boolean; lost: number; joined: number; prisoners: number; after: ArmyStack[] } {
  const foe = armyForLevel(Math.max(1, L - t.gap), Math.round(HAMMOCKS[L] * t.men), 7, t.mix);
  const rng = new Rng(seed);
  const bt = newBattle(side(me, ladder(L, L - t.gap, false).dealt), side(foe, ladder(L - t.gap, L, false).dealt), seed, 0, rng);
  quickFinish(bt, 0, rng);
  const won = bt.over?.winner === 0;
  const left = tidy(bt.stacks.filter((s) => s.side === 0).map((s) => ({ u: s.src, n: s.count })));
  const lost = armyMen(me) - armyMen(left);
  if (!won) return { won, lost, joined: 0, prisoners: 0, after: left };
  // Every man of the ship she took was beaten; a tenth of them live on her books to strike (tactical.ts sync).
  const beaten = foe;
  const pool = armyMen(beaten);
  const n = joinCount(pool, lead, HAMMOCKS[L] - armyMen(left));
  const came = joinKinds(beaten, n, false);
  const joined = came.reduce((a, x) => a + x.n, 0);
  const survivors = Math.max(2, Math.round(pool * 0.1)) - Math.round((joined * Math.max(2, Math.round(pool * 0.1))) / Math.max(1, pool));
  const prisoners = Math.max(0, Math.min(Math.floor(survivors * 0.3), HAMMOCKS[L] - armyMen(left) - joined));
  return { won, lost, joined, prisoners, after: tidy([...left, ...came]) };
}

const chains = Number(process.argv[2] ?? 40);
const lead = Number(process.argv[3] ?? 0);
const HOURS = 2;
console.log(`The beaten who come over: ${Math.round(joinShare(lead) * 100)}% of the men she beats (Leadership ${lead}), ${KILLS_HOUR} boardings an hour of the contested waters' traffic, ${HOURS} h without a port (${chains} runs a level).`);
console.log('Per hour: her men lost in the boardings she won · came over · with the prisoners\' offer · the share made good · her crew after the run · boardings lost (she limps to port, and the run goes on from a full crew).');
const rows: number[] = [];
for (let L = 1; L <= 10; L++) {
  let lost = 0, lostWon = 0, joined = 0, pris = 0, fights = 0, defeats = 0, endMen = 0;
  for (let c = 0; c < chains; c++) {
    let me = armyForLevel(L, HAMMOCKS[L], 7, 'player');
    const pick = new Rng(L * 7919 + c * 104729);
    for (let k = 0; k < KILLS_HOUR * HOURS; k++) {
      const t = pick.weighted(TRAFFIC.map((x) => [x, x.w] as const));
      const r = board(me, L, t, L * 1000003 + c * 9973 + k * 31 + 1, lead);
      fights++;
      lost += r.lost;
      if (!r.won) {
        // A boarding lost: she limps into port (the crew refilled there; the run goes on from a full crew).
        defeats++;
        me = armyForLevel(L, HAMMOCKS[L], 7, 'player');
        continue;
      }
      lostWon += r.lost;
      joined += r.joined;
      pris += r.prisoners;
      me = r.after;
    }
    endMen += armyMen(me) / HAMMOCKS[L];
  }
  const h = chains * HOURS;
  rows.push(joined / Math.max(1, lostWon));
  console.log(`  ⚓${L} (${HAMMOCKS[L]}): lost in the boardings won ${(lostWon / h).toFixed(1)} · came over ${(joined / h).toFixed(1)} · +prisoners ${((joined + pris) / h).toFixed(1)} · made good ${Math.round((joined / Math.max(1, lostWon)) * 100)}% (${Math.round(((joined + pris) / Math.max(1, lostWon)) * 100)}% with prisoners) · crew after ${HOURS} h ${Math.round((endMen / chains) * 100)}% · boardings lost ${Math.round((defeats / fights) * 100)}% (all lost ${(lost / h).toFixed(1)})`);
}
console.log(`  over the levels: ${Math.round((rows.reduce((a, b) => a + b, 0) / rows.length) * 100)}% of the men lost made good by the beaten alone`);
