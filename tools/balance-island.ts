// The personal island's balance report (docs/15 item 8): node tools/balance-island.ts
// A captain's weeks with her island by the simulation of tests/balance/island.ts, with and without speed-ups, in
// each water and on a rich and a poor land; the island's best yield by the hour against the sea's; the week's tax.

import { NORMAL, NO_GUARD, bestYield, daysTo, guardRating, raidDays, seaHour, simulate } from '../tests/balance/island.ts';
import { raidOdds, raidStrength } from '../shared/src/data/baseclaim.ts';
import { OWN_ROLES, combatWorth, hiredWorth, hullFor, ownParity, roleLevels } from '../shared/src/data/baseships.ts';
import type { Plan } from '../tests/balance/island.ts';
import { ISLE_MAX } from '../shared/src/data/estate.ts';
import { isleTax } from '../shared/src/data/baseclaim.ts';

const row = (name: string, plan: Plan) => {
  const r = simulate(plan);
  const d = [];
  for (let l = 2; l <= ISLE_MAX; l++) d.push(Number.isFinite(daysTo(r, l)) ? daysTo(r, l).toFixed(1).padStart(5) : '    —');
  const sp = r.spent;
  console.log(`${name.padEnd(26)}${d.join(' ')}   power ${r.power}  earned ${Math.round(r.earned / 1000)}k  build ${Math.round(sp.build / 1000)}k treas ${Math.round(sp.treasury / 1000)}k goods ${Math.round(sp.goods / 1000)}k upkeep ${Math.round(sp.upkeep / 1000)}k tax ${Math.round(sp.tax / 1000)}k speed ${Math.round(sp.speedup / 1000)}k`);
};
console.log(`Days to island level      ${Array.from({ length: ISLE_MAX - 1 }, (_, i) => String(i + 2).padStart(5)).join(' ')}`);
row('normal (3 h, safe)', NORMAL);
row('normal, rushed with silver', { ...NORMAL, rush: true });
row('contested water', { ...NORMAL, waters: 'contested' });
row('lawless water', { ...NORMAL, waters: 'lawless' });
row('poor land (bone)', { ...NORMAL, biome: 'bone' });
row('rich land (jungle, large)', { ...NORMAL, biome: 'jungle', size: 'large' });
row('light play (1.5 h)', { ...NORMAL, hours: 1.5 });
row('heavy play (5 h)', { ...NORMAL, hours: 5 });
row('with the town hall (H3)', { ...NORMAL, town: true });
row('heavy play with the hall', { ...NORMAL, hours: 5, town: true });
console.log('\nlevel  best yield/h  sea hour ⚓L  share   tax/week safe  tax vs a week of yield');
for (let l = 1; l <= ISLE_MAX; l++) {
  const y = bestYield(l, 'jungle');
  const sea = seaHour(l);
  const tax = isleTax('safe', l);
  console.log(`${String(l).padStart(5)}  ${String(Math.round(y)).padStart(12)}  ${String(sea).padStart(11)}  ${((y / sea) * 100).toFixed(0).padStart(4)}%  ${String(tax).padStart(13)}  ${((tax / (bestYield(l, 'temperate', 'small') * 24 * 7)) * 100).toFixed(1)}%`);
}

console.log('\nRaids on a fat island, owner never coming (share of yard and store lost a day: mean / worst; raids a day; the island holds)');
for (const w of ['contested', 'lawless'] as const) {
  for (const l of [3, 5, 7, 10]) {
    const cells = [NO_GUARD, { battery: Math.min(5, l), fort: 0, ship: 0 }, { battery: Math.min(5, l), fort: Math.max(1, Math.min(5, l - 3)), ship: 0 }, { battery: Math.min(5, l), fort: Math.max(1, Math.min(5, l - 3)), ship: l }]
      .map((g) => {
        const r = raidDays(w, l, g);
        return `${(r.mean * 100).toFixed(1).padStart(4)}%/${(r.max * 100).toFixed(0).padStart(2)}% ${(r.raids / 2000).toFixed(2)} ${Math.round(raidOdds(guardRating(g), raidStrength(w, l)) * 100).toString().padStart(2)}%`;
      });
    console.log(`${w.padEnd(9)} ⚓${String(l).padEnd(2)} none ${cells[0]} | battery ${cells[1]} | +fort ${cells[2]} | +own ship ${cells[3]}`);
  }
}
console.log('\nOwn warship against the best hired escort of her level (worth = hull × broadside; parity cap applied)');
for (const l of roleLevels('war')) {
  const c = hullFor('war', l), p = ownParity(c, l);
  console.log(`⚓${l} ${c.padEnd(11)} ${(combatWorth(c, l) / hiredWorth(l)).toFixed(2)} → ${((combatWorth(c, l) * p * p) / hiredWorth(l)).toFixed(2)} (parity ${p})`);
}
void OWN_ROLES;
