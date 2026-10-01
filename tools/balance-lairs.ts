// The lairs' balance report (docs/18 II item 24): node tools/balance-lairs.ts [--calibrate [kind…]]
// Each kind of lair fought out ashore by a captain of its level (tests/balance/lairs.ts); what its loot is worth against
// the men it costs and the hour at sea; with --calibrate, LAIR_CAL (and LAIR_REFILL) rebuilt from the battle itself.

import { armyMen } from '../shared/src/data/army.ts';
import { advHour } from '../shared/src/data/advmap.ts';
import { LAIRS, LAIR_KINDS, LAIR_LOSS, LAIR_SIZES, lairArmy, lairPay } from '../shared/src/data/lairs.ts';
import type { LairKind } from '../shared/src/data/lairs.ts';
import { calibrate, calibrateRefill, lairFight, lairOdds, lairWorth, levelsOf, refParty } from '../tests/balance/lairs.ts';

const args = process.argv.slice(2);
if (args.includes('--calibrate')) {
  const only = args.filter((a) => (LAIR_KINDS as string[]).includes(a)) as LairKind[];
  const cal = calibrate(only.length ? only : LAIR_KINDS, (s) => console.error(s));
  for (const [kind, rows] of Object.entries(cal)) console.log(`  ${kind}: [${rows.map((r) => `[${r.join(', ')}]`).join(', ')}],`);
  if (!only.length) console.log(`LAIR_REFILL = [${calibrateRefill().join(', ')}]`);
  process.exit(0);
}
if (args.includes('--refill')) {
  console.log(`LAIR_REFILL = [${calibrateRefill().join(', ')}]`);
  process.exit(0);
}

console.log(`Targets: a captain of the lair's level loses ${LAIR_SIZES.map((s) => `${s} ${Math.round(LAIR_LOSS[s] * 100)}%`).join(', ')} of the men she lands (a lost fight counts as all).\n`);
for (const kind of LAIR_KINDS) {
  const cells: string[] = [];
  for (const L of levelsOf(kind)) {
    const row = LAIR_SIZES.map((size) => {
      const f = lairFight(kind, L, size, 30);
      return `${size} ${armyMen(lairArmy(kind, L, size))}: −${Math.round(f.loss * 100)}% (wins ${Math.round(f.win * 100)}%)`;
    });
    cells.push(`⚓${L} [party ${armyMen(refParty(L))}]: ${row.join(' · ')}`);
  }
  console.log(`${kind} (${LAIRS[kind].role}):\n    ${cells.join('\n    ')}`);
}
console.log('\nWhat an average lair is worth (its loot less the men it costs), in hours at sea:');
for (let L = 1; L <= 10; L++) {
  const kinds = LAIR_KINDS.filter((k) => L >= LAIRS[k].lv[0] && L <= LAIRS[k].lv[1]);
  const cells = kinds.map((k) => {
    const w = lairWorth(k, L, 'avg');
    return `${k} ${w.hours.toFixed(2)}`;
  });
  const p = lairPay(kinds[0], L, 'avg', LAIRS[kinds[0]].types[0]);
  console.log(`⚓${L} (hour ${advHour(L)}; ${kinds[0]}: ${p.silver} silver, ${p.goods} ${p.good}, ${JSON.stringify(p.res)}, ${p.xp} xp): ${cells.join(', ')}`);
}
console.log('\nHer party against an average lair (HoMM3\'s offer at ×3):');
for (const L of [2, 5, 8]) console.log(`  ⚓${L}: ${LAIR_KINDS.filter((k) => L >= LAIRS[k].lv[0] && L <= LAIRS[k].lv[1]).map((k) => `${k} ×${lairOdds(k, L, 'avg').toFixed(1)}`).join(', ')}`);
