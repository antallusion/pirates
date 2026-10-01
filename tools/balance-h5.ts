// docs/17 H5 item 17: the balance pass of the Heroes on the sea — how steep a boarding is in the head count, the
// town-fed crew against the sea's armies of her level, the guards' chests, recruits against income, artifacts and will.
// node tools/balance-h5.ts

import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { MONTH, month, winRate } from '../tests/balance/recruit.ts';

function thin(a: ArmyStack[], share: number): ArmyStack[] {
  const out = a.map((x) => ({ ...x }));
  let left = Math.round(armyMen(a) * share);
  for (const s of out) {
    const k = Math.min(s.n - 1, Math.round(s.n * share), left);
    s.n -= k;
    left -= k;
  }
  return out;
}

const N = Number(process.argv[2] ?? 200);
console.log('Steepness (⚓5 pirates, 100 men, the defender thinned):');
for (const L of [3, 5, 7]) {
  const a = armyForLevel(L, 100, 6, 'pirate');
  const row = [0, 0.05, 0.1, 0.2, 0.34].map((f) => `${Math.round(f * 100)}% fewer: ${Math.round(winRate(a, thin(a, f), N) * 100)}%`);
  console.log(`  ⚓${L}: ${row.join(' · ')}`);
}
console.log('\nThe town-fed crew against the sea (a month of MONTH):');
for (const [L, M] of [[4, 110], [7, 220], [10, 600]] as const) {
  const r = month({ ...MONTH, level: L, crewMax: M });
  const lad = armyForLevel(L, M, 7, 'player');
  console.log(`  ⚓${L} (${M}): town-fed vs pirate ⚓${L}: ${Math.round(winRate(r.army, armyForLevel(L, M, 7, 'pirate'), N / 2) * 100)}% · ladder vs pirate: ${Math.round(winRate(lad, armyForLevel(L, M, 7, 'pirate'), N / 2) * 100)}% · vs navy: ${Math.round(winRate(r.army, armyForLevel(L, M, 7, 'navy'), N / 2) * 100)}% / ${Math.round(winRate(lad, armyForLevel(L, M, 7, 'navy'), N / 2) * 100)}%`);
}
