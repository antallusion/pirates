// The beaten who come over after a boarding won (owner, 2026-10-08): the report of tests/balance/join.ts — a captain of
// each level boarding the ships of her waters, KILLS_HOUR an hour, two hours without a port: her men lost against the
// beaten who come over (and the prisoners' offer on top).
//
//   node tools/balance-join.ts [chains] [leadership] [--trade | --roles]

import { armyForLevel } from '../shared/src/data/army.ts';
import { joinShare } from '../server/src/game/crew.ts';
import { KILLS_HOUR } from '../tests/balance/island.ts';
import { HAMMOCKS, TRADE, TRAFFIC, board, steady } from '../tests/balance/join.ts';

const chains = Number(process.argv[2] ?? 40);
const lead = Number(process.argv[3] ?? 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
if (process.argv.includes('--roles')) {
  // Each kind of ship of her waters boarded from a full crew: how often she wins, what a win costs her (of her
  // hammocks) and how many come over.
  console.log(`Each ship of her waters boarded from a full crew (${chains} boardings; Leadership ${lead}): wins · her men lost in a win · came over in a win (of her hammocks).`);
  for (const L of [2, 4, 6, 8, 10]) {
    const cells = TRAFFIC.map((t) => {
      let w = 0, lost = 0, came = 0;
      for (let k = 0; k < chains; k++) {
        const r = board(armyForLevel(L, HAMMOCKS[L], 7, 'player'), L, t, L * 7777 + k * 131 + 3, lead);
        if (!r.won) continue;
        w++;
        lost += r.lost;
        came += r.joined;
      }
      return `${t.role} ${pct(w / chains)} −${pct(lost / Math.max(1, w) / HAMMOCKS[L])} +${pct(came / Math.max(1, w) / HAMMOCKS[L])}`;
    });
    console.log(`  ⚓${L}: ${cells.join(' · ')}`);
  }
  process.exit(0);
}
const trade = process.argv.includes('--trade');
console.log(`The beaten who come over: ${pct(joinShare(lead))} of the men she beats (Leadership ${lead}), ${KILLS_HOUR} boardings an hour of the contested waters' ${trade ? 'trade (merchants and fishers)' : 'traffic, warships of her level and all'}, 2 h without a port (${chains} runs a level).`);
console.log("Per hour: her men lost in the boardings she won · came over · with the prisoners' offer · made good · her crew after 2 h · boardings lost (she limps to port; the run goes on from a full crew).");
const rows: number[] = [];
for (let L = 1; L <= 10; L++) {
  const r = steady(L, trade ? TRADE : TRAFFIC, chains, lead);
  rows.push(r.joined / Math.max(1e-9, r.lostWon));
  console.log(`  ⚓${L} (${HAMMOCKS[L]}): lost ${r.lostWon.toFixed(1)} · came over ${r.joined.toFixed(1)} · +prisoners ${r.withPrisoners.toFixed(1)} · made good ${pct(r.joined / Math.max(1e-9, r.lostWon))} (${pct(r.withPrisoners / Math.max(1e-9, r.lostWon))}) · crew after ${pct(r.crewAfter)} · lost ${pct(r.defeats)} of boardings (all her losses ${r.lostAll.toFixed(1)}/h)`);
}
console.log(`  over the levels: ${pct(rows.reduce((a, b) => a + b, 0) / rows.length)} of the men lost in the boardings won made good by the beaten alone`);
