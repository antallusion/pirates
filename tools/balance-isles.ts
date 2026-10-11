// The island's tech tree (docs/29_ISLANDS.md): the days, the silver and the builders' hours to each hall level for a
// steady captain (tests/balance/isletree.ts), light and heavy play, a rush, a poor land; then each building's costs.
//   node --disable-warning=ExperimentalWarning tools/balance-isles.ts

import { STEADY, daysToHall, simulateTree } from '../tests/balance/isletree.ts';
import type { TreePlan } from '../tests/balance/isletree.ts';
import { TREE_IDS, TREE_MAX, treeClosure, treeCost, treeNeeds } from '../shared/src/data/isletree.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
const hm = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : `${Math.round(s / 60)}m`);

const plans: [string, TreePlan][] = [
  ['steady (3 h a day, half to the island)', STEADY],
  ['light (1.5 h)', { ...STEADY, hours: 1.5, days: 90 }],
  ['heavy (5 h)', { ...STEADY, hours: 5 }],
  ['steady, rushing with silver', { ...STEADY, rush: true }],
  ['steady on bone (a poor land)', { ...STEADY, biome: 'bone' }],
];
for (const [name, plan] of plans) {
  const r = simulateTree(plan);
  console.log(`\n${name}`);
  for (let h = 2; h <= TREE_MAX; h++) {
    console.log(`  hall ${h}: day ${daysToHall(r, h).toFixed(1).padStart(5)}  silver ${fmt(r.silverAt[h]).padStart(9)}  builders' hours since hall ${h - 1}: ${r.workAt[h].toFixed(0).padStart(4)}`);
  }
  console.log(`  earned at sea ${fmt(r.earned)}, the hall paid ${fmt(r.hallIncome)}; spent: build ${fmt(r.spent.build)}, goods bought ${fmt(r.spent.goods)}, speed-ups ${fmt(r.spent.speedup)}`);
}

console.log('\nThe tree: each building, level by level — silver · time · goods · what it asks');
for (const id of TREE_IDS) {
  const rows: string[] = [];
  for (let L = 1; L <= TREE_MAX; L++) {
    const c = treeCost(id, L);
    rows.push(`  ${id} ${L}: ${fmt(c.silver)} · ${hm(c.secs)} · ${Object.entries(c.goods).map(([g, n]) => `${g} ${n}`).join(', ')} · ${treeNeeds(id, L).map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`);
  }
  console.log(rows.join('\n'));
}
const all = treeClosure('hall', 5);
let silver = 0, secs = 0;
for (const [k, n] of all) for (let L = 1; L <= n; L++) if (!(k === 'hall' && L === 1)) {
  silver += treeCost(k, L).silver;
  secs += treeCost(k, L).secs;
}
console.log(`\nHall 5 asks ${[...all].map(([k, n]) => `${k} ${n}`).join(', ')}: ${fmt(silver)} silver of building and ${(secs / 3600).toFixed(0)} builders' hours in all.`);
