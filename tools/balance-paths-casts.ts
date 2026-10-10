// Which orders and moves each path gives in a boarding against the other paths (real builds, the boarding's rules:
// tests/balance/boardlen.ts), a battle on average.
//   node tools/balance-paths-casts.ts [battles a pairing] [--levels=15,45] [--paths=drowned]
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { tacStats } from '../server/src/game/tacbattle.ts';
import { playBoard, sidesAt } from '../tests/balance/boardlen.ts';

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 10);
const LEVELS = (arg('levels') ?? '15,30,45,60').split(',').map(Number);
const WHO = (arg('paths')?.split(',') ?? CAPTAIN_IDS) as CaptainId[];

tacStats.on = true;
for (const L of LEVELS) {
  console.log(`\nLevel ${L}: a battle on average (${n * 5} battles a path, her side 0 against every other path)`);
  for (const p of WHO) {
    tacStats.casts.clear();
    let rounds = 0, k = 0;
    CAPTAIN_IDS.forEach((q, j) => {
      // Her side only: in a mirror the other side is the same path.
      if (q === p) return;
      for (let i = 0; i < n; i++) {
        const [a, b] = sidesAt(L, true, p, q, 4000 + i * 13 + j * 7);
        rounds += playBoard(a, b, 4000 + i * 31 + j * 5 + L).rounds;
        k++;
      }
    });
    const mine = [...tacStats.casts].filter(([key]) => key.startsWith(`${p}:`)).sort((a, b) => b[1] - a[1]);
    console.log(`  ${p.padEnd(10)} ${(rounds / k).toFixed(1)} r · ${mine.map(([key, v]) => `${key.slice(p.length + 1)} ${(v / k).toFixed(2)}`).join(' · ')}`);
  }
}
