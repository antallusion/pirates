// docs/19 E12–E13, E17 (relics): the relics' and the anvil's weight in the boarding battle at the cap.
//   node tools/balance-relics.ts [battles a path]
// See tests/balance/relics.ts for the kits.

import { RELIC_IDS, RELICS } from '../shared/src/data/artifacts.ts';
import { dropsToFirst, kitShare, relicBudget } from '../tests/balance/relics.ts';
import type { Kit } from '../tests/balance/relics.ts';

const N = Number(process.argv[2] ?? 100);
const pc = (x: number) => `${Math.round(x * 100)}%`;
const rows: [Kit, Kit][] = [
  ['sets', 'bare'], ['union_crown', 'bare'], ['orb_compass', 'bare'],
  ['union_crown', 'sets'], ['orb_compass', 'sets'], ['union_crown', 'orb_compass'], ['forged', 'sets'],
  ...RELIC_IDS.map((r): [Kit, Kit] => [r, 'bare']),
];
console.log(`Relics in the boarding battle (level 60, ⚓10, 600 men, ${N} battles a path):`);
for (const [a, b] of rows) console.log(`  ${a.padEnd(18)} vs ${b.padEnd(12)} ${pc(kitShare(a, b, N)).padStart(4)}`);
for (const r of RELIC_IDS) {
  const b = relicBudget(r);
  console.log(`  ${RELICS[r].name[0].padEnd(22)} parts ${RELICS[r].parts.length}, primaries: parts ${b.parts} + whole ${b.prim}`);
}
console.log(`Drops of parts to the first relic whole: ${dropsToFirst(2000).toFixed(1)} (mean of 2000 captains)`);
