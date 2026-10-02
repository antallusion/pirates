// docs/19 D7: the roaming stacks' balance report: node tools/balance-roamers.ts [--calibrate [kind…]] [--xp]
// Each kind fought by a captain of its level (tests/balance/roamers.ts): what it costs her in men against ROAM_LOSS,
// her might against its (HoMM3's ×3), and an hour of steady fighting against the game's usual hour of experience.
// --calibrate rebuilds ROAM_CAL from the battle; --xp prints ROAM_XP_SHARE for the target share.

import { advLevelXp } from '../shared/src/data/advmap.ts';
import { ROAM_KINDS, ROAM_LOSS, ROAM_SIZES, ROAM_XP_TARGET, roamCount, seaHourXp } from '../shared/src/data/roamers.ts';
import type { RoamKind } from '../shared/src/data/roamers.ts';
import { calibrate, lessonFor, roamLevels, roamOdds, silverFor, stackFight, xpHour } from '../tests/balance/roamers.ts';

const args = process.argv.slice(2);
if (args.includes('--calibrate')) {
  const only = args.filter((a) => (ROAM_KINDS as string[]).includes(a)) as RoamKind[];
  const cal = calibrate(only.length ? only : ROAM_KINDS, (s) => console.error(s));
  for (const [kind, rows] of Object.entries(cal)) console.log(`  ${kind}: [${rows.map((r) => `[${r.join(', ')}]`).join(', ')}],`);
  process.exit(0);
}
if (args.includes('--silver')) {
  const out = [0];
  for (let L = 1; L <= 10; L++) out.push(Math.round(silverFor(L, 0.2) * 1000) / 1000);
  console.log(`ROAM_SILVER = [${out.join(', ')}]`);
  process.exit(0);
}
if (args.includes('--xp')) {
  const out = [0];
  for (let L = 1; L <= 10; L++) {
    const l = lessonFor(L, ROAM_XP_TARGET);
    out.push(Math.round((l.need / advLevelXp(L)) * 10000) / 10000);
    console.error(`⚓${L}: battle ${l.battle.toFixed(0)} a fight, the stack's own ${l.need.toFixed(0)} (level ${advLevelXp(L)})`);
  }
  console.log(`ROAM_XP_SHARE = [${out.join(', ')}]`);
  process.exit(0);
}

console.log(`Targets: a captain of the stack's level loses ${ROAM_SIZES.map((s) => `${s} ${Math.round(ROAM_LOSS[s] * 100)}%`).join(', ')} of the men she lands.\n`);
for (const kind of ROAM_KINDS) {
  const rows: string[] = [];
  for (const L of roamLevels(kind)) {
    rows.push(`⚓${L}: ${ROAM_SIZES.map((z) => {
      const f = stackFight(kind, L, z, 24);
      return `${z} ${roamCount(kind, L, z)}: −${Math.round(f.loss * 100)}% (wins ${Math.round(f.win * 100)}%, ×${roamOdds(kind, L, z).toFixed(1)})`;
    }).join(' · ')}`);
  }
  console.log(`${kind}:\n    ${rows.join('\n    ')}`);
}
console.log('\nAn hour of steady fighting against the stacks of her waters:');
for (let L = 1; L <= 10; L++) {
  const h = xpHour(L);
  const q = xpHour(L, undefined, 12, 'quick'), pl = xpHour(L, undefined, 12, 'played');
  console.log(`⚓${L}: ${h.fights} fights, ${h.xp} XP (${Math.round(h.share * 100)}% of the usual hour's ${Math.round(seaHourXp(L))}; quick combat ${Math.round(q.share * 100)}%, played out ${Math.round(pl.share * 100)}%), silver and spoils ${h.silver.toFixed(2)} h at sea, men lost ${h.refill.toFixed(2)} h, net ${(h.silver - h.refill).toFixed(2)} h`);
}
