// docs/25 block Е (items 64–67): a group's boarding measured — how a group of the sea's foes is grown (item 66), a mixed
// group against three of one path (item 65), how long a group's boarding runs (§1.2).
//
//   node --disable-warning=ExperimentalWarning tools/balance-group.ts [--foe] [--roles] [--time] [n=4] [levels=8,30,55]
//     [echo=0.6] [roles=0]   (the «before» of item 65: echo=1 roles=0 — the books alone, no echo, no roles)
//
// tests/balance/boardgroup.ts plays the battles (the engine's own mind on every side, each turn timed as boardlen does).

import type { CaptainId } from '../shared/src/data/captains.ts';
import { PATHS, bandStat } from '../tests/balance/boardlen.ts';
import { TAC_GROUP, TAC_ROLES } from '../shared/src/data/tactical.ts';
import { groupStat, mixedVsSame } from '../tests/balance/boardgroup.ts';

const arg = (k: string, d: string): string => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const N = Number(arg('n', '4'));
const LEVELS = arg('levels', '8,30,55').split(',').map(Number);
const pc = (x: number) => `${Math.round(x * 100)}%`;
const mm = (m: number) => {
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const has = (f: string) => process.argv.includes(f);
if (arg('echo', '')) TAC_GROUP.echo = [[1, Number(arg('echo', ''))]];
if (arg('roles', '1') === '0') for (const k of Object.keys(TAC_ROLES) as (keyof typeof TAC_ROLES)[]) TAC_ROLES[k] = { name: TAC_ROLES[k].name, text: TAC_ROLES[k].text };

if (has('--foe')) {
  const grows = arg('grow', 'none,auto').split(',');
  console.log(`Item 66: a group against the sea — ${N * 6} boardings a cell (wins of the boarders, rounds, minutes, men lost: mean of the captains / her own)`);
  console.log('| L | solo | 2, not grown | 3, not grown | 2, grown | 3, grown |');
  console.log('|---|---|---|---|---|---|');
  for (const L of LEVELS) {
    const cell = (size: number, grow: boolean | number) => {
      const s = groupStat(L, size, null, N, { grow });
      return `${pc(s.win)} · ${s.rounds.toFixed(1)} r · ${mm(s.mins)} · ${pc(s.lost)}/${pc(s.lostMain)}`;
    };
    const g = grows.includes('auto') ? true : Number(grows[1]);
    console.log(`| ${L} | ${cell(1, false)} | ${cell(2, false)} | ${cell(3, false)} | ${cell(2, g)} | ${cell(3, g)} |`);
  }
}

if (has('--roles')) {
  console.log(`Item 65: six mixed groups of three against three of one path (${N * 2} boardings a pair, each side boarding in turn; echo ${TAC_GROUP.echo.map(([l, e]) => `×${e}@${l}`).join(' ')}, roles ${arg('roles', '1') === '0' ? 'off' : 'on'}): the mixed side's wins, the mean and against each path`);
  const MIXES: CaptainId[][] = [['admiral', 'drowned', 'corsair'], ['navigator', 'reaver', 'smuggler'], ['admiral', 'navigator', 'reaver'], ['drowned', 'corsair', 'smuggler'], ['corsair', 'navigator', 'admiral'], ['reaver', 'drowned', 'smuggler']];
  console.log(`| L | mean | ${PATHS.map((p) => `vs 3 × ${p}`).join(' | ')} |`);
  console.log(`|---|---|${PATHS.map(() => '---').join('|')}|`);
  for (const L of LEVELS) {
    const col = PATHS.map(() => 0);
    for (const m of MIXES) PATHS.forEach((p, i) => (col[i] += mixedVsSame(L, m, p, N) / MIXES.length));
    console.log(`| ${L} | ${pc(col.reduce((a, x) => a + x, 0) / col.length)} | ${col.map(pc).join(' | ')} |`);
  }
}

if (has('--time')) {
  console.log(`A group's boarding in real time (a captain's decision 6 s a stack): ${N * 6} boardings a cell`);
  console.log('| L | 1 v 1 | 2 v 2 | 3 v 3 | 3 v 1 | vs sea: solo | 2 | 3 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const L of LEVELS) {
    const solo = bandStat(L, true, N), sea = bandStat(L, false, N);
    const c = (size: number, q: number | null) => {
      const s = groupStat(L, size, q, N);
      return `${mm(s.mins)} (${s.rounds.toFixed(1)} r)`;
    };
    console.log(`| ${L} | ${mm(solo.mins)} (${solo.rounds.toFixed(1)} r) | ${c(2, 2)} | ${c(3, 3)} | ${c(3, 1)} | ${mm(sea.mins)} (${sea.rounds.toFixed(1)} r) | ${c(2, null)} | ${c(3, null)} |`);
  }
}
