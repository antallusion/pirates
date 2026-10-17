// docs/31 §9: the silver of an hour's play by level band, before the cut (2026-10-17) and after — what each way of
// playing brings in and costs, the mixed captain's net, the hours a refit to the next ⚓ takes.
//   node tools/balance-silver.ts
// (the model: tests/balance/silver.ts; the targets: tests/balance/silver.test.ts)

import { CURRENT_SILVER, LEGACY_SILVER, SILVER_BANDS, SILVER_STYLES, bandLevel, hoursFor, mixedSilver, nextRefit, styleSilver } from '../tests/balance/silver.ts';
import { hourSilver, shipBandOf } from '../shared/src/data/xpcurve.ts';

const pad = (s: string | number, n: number): string => String(s).padStart(n);
const k = (x: number): string => (Math.abs(x) >= 10000 ? `${(x / 1000).toFixed(0)}k` : Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(1)}k` : `${Math.round(x)}`);

for (const R of [LEGACY_SILVER, CURRENT_SILVER]) {
  console.log(`\n=== ${R.name.toUpperCase()} ===`);
  console.log('Net silver an hour by the way she plays (income − costs; in hours at sea of her waters):');
  console.log(`  band    L  ⚓  sea-hour ${SILVER_STYLES.map((s) => pad(s, 15)).join('')}`);
  for (const b of SILVER_BANDS) {
    const L = bandLevel(b), v = shipBandOf(L), sea = hourSilver(v);
    console.log(`  ${pad(`${b[0]}-${b[1]}`, 5)} ${pad(L, 3)} ${pad(v, 3)} ${pad(sea, 8)} ${SILVER_STYLES.map((s) => {
      const h = styleSilver(R, s, L);
      return pad(`${k(h.income - h.costs)} (${((h.income - h.costs) / sea).toFixed(2)})`, 15);
    }).join('')}`);
  }
  console.log('\nThe mixed captain: income, costs, net an hour; the refit to the next ⚓ in hours of play:');
  for (const b of SILVER_BANDS) {
    const L = bandLevel(b), m = mixedSilver(R, L), refit = nextRefit(L);
    console.log(`  ${pad(`${b[0]}-${b[1]}`, 5)}: in ${pad(k(m.income), 6)}  out ${pad(k(m.costs), 6)}  net ${pad(k(m.net), 6)} (${m.hours.toFixed(2)} sea-h)${refit ? `  refit ${k(refit)} = ${hoursFor(R, L, refit).toFixed(1)} h` : ''}`);
  }
}
