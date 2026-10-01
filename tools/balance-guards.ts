// The adventure map's balance report (docs/17 H4): node tools/balance-guards.ts [--calibrate]
// The guards fought out by a captain of their level (tests/balance/guards.ts); what the guarded chests and the things on
// the map pay against the hour at sea; with --calibrate, GUARD_CAL rebuilt from the battle itself.

import { armyMen, armyPower } from '../shared/src/data/army.ts';
import { GUARD_LOSS, GUARD_SIZES, MILL_DAYS, OBJS, REF_MEN, altarXp, advLevelXp, chestPay, guardArmy, guardPay, millLoad } from '../shared/src/data/advmap.ts';
import { seaHour } from '../tests/balance/island.ts';
import { calibrate, calibrateRefill, guardFight, guardedChest, kindsAt, offerArmy, refArmy } from '../tests/balance/guards.ts';

if (process.argv.includes('--calibrate')) {
  const cal = calibrate();
  for (const [kind, rows] of Object.entries(cal)) console.log(`  ${kind}: [${rows.map((r) => `[${r.join(', ')}]`).join(', ')}],`);
  console.log(`GUARD_REFILL = [${calibrateRefill().join(', ')}]`);
  process.exit(0);
}

console.log(`Targets: a captain of the guard's level loses ${GUARD_SIZES.map((s) => `${s} ${Math.round(GUARD_LOSS[s] * 100)}%`).join(', ')} of her men (a lost fight counts as all).\n`);
for (let L = 1; L <= 10; L++) {
  const me = refArmy(L);
  const cells: string[] = [];
  for (const kind of kindsAt(L)) {
    for (const size of GUARD_SIZES) {
      const g = guardArmy(kind, L, size);
      const f = guardFight(kind, L, size, 30);
      cells.push(`${kind} ${size}: ${armyMen(g)} men, wins ${Math.round(f.win * 100)}%, −${Math.round(f.lostWin * 100)}% (avg −${Math.round(f.loss * 100)}%)`);
    }
  }
  console.log(`⚓${L} (her ${REF_MEN[L]} men, might ${Math.round(armyPower(me))}):\n    ${cells.join('\n    ')}`);
}
console.log('\nWhat a guarded chest pays (chest + the guard\'s own silver, less the men an average hold-out costs to refill):');
for (let L = 1; L <= 10; L++) {
  const c = guardedChest(L);
  console.log(`⚓${L}: ${c.silver} silver − refill ${c.refill} = ${c.net} (${c.hours.toFixed(2)} sea hours of ${seaHour(L)}) + ${c.xp} xp from the guard, or the chest's ${chestPay(L, true).xp} xp instead of its silver (a level is ${advLevelXp(L)})`);
}
console.log('\nThe things on the map at ⚓5 (sea hour ' + seaHour(5) + '):');
console.log(`  chest unguarded ${chestPay(5, false).silver} silver / ${chestPay(5, false).xp} xp a week; guarded ${chestPay(5, true).silver} / ${chestPay(5, true).xp}`);
console.log(`  altar: a talent point (4 in all), then ${altarXp(5)} xp; windmill ${MILL_DAYS} days of a mine (timber ${millLoad('timber', 'gravewater', MILL_DAYS)}, pearls ${millLoad('pearls', 'gravewater', MILL_DAYS)}) a week; ${Object.keys(OBJS).length} kinds`);
console.log('\nThe army that sees a guard flee or sign on (×3 its might), against the reference captain\'s:');
for (const L of [2, 5, 8]) console.log(`  ⚓${L}: ${kindsAt(L).map((k) => `${k} avg ×${offerArmy(L, k, 'avg').toFixed(1)}`).join(', ')}; a guard's own pay ${guardPay(L, 'avg').silver} silver, ${guardPay(L, 'avg').xp} xp`);
