// docs/19 D1–D4: the doubled sea's hour of income from the sources it doubled — before, after, and with the per-captain
// caps (shared/src/data/seahaul.ts), for an all-rounder and a gleaner, at ⚓2/5/8, days of 1, 2 and 4 hours at sea.
//   node tools/balance-density.ts [routes]

import { seaHourIncome } from '../tests/balance/density.ts';

const routes = Math.max(2, Number(process.argv[2] ?? 10));
console.log('way      level  day  before   after (×)        capped (×)   by source after (silver an hour)');
for (const way of ['all', 'gleaner'] as const) {
  for (const L of [2, 5, 8]) {
    for (const H of [1, 2, 4]) {
      const b = seaHourIncome(L, H, 'before', routes, way), a = seaHourIncome(L, H, 'after', routes, way), c = seaHourIncome(L, H, 'capped', routes, way);
      console.log(`${way.padEnd(8)} ⚓${L}     ${H} h  ${String(b.total).padStart(6)}  ${String(a.total).padStart(6)} (${(a.total / b.total).toFixed(2)})  ${String(c.total).padStart(6)} (${(c.total / b.total).toFixed(2)})  ${JSON.stringify(c.by)}`);
    }
  }
}
