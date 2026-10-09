// docs/25 §1.2 (owner, 2026-10-09: «абордаж на высоких уровнях должен быть такой, чтобы люди играли по 5-10 минут… На
// низких 1 минуты норма это если игрок против игрока. С нпс можно быстрее сражаться»): how long a boarding takes in
// real time, band by band, against a captain and against the sea, beside the owner's table.
//
//   node --disable-warning=ExperimentalWarning tools/boarding-time.ts [n=4] [levels=3,8,13,…]
//
// The model (tests/balance/boardlen.ts): whole battles played by the engine's own mind on both sides, each stack's
// turn timed as the screens play it (TAC_PACE through tacSchedule, as the server waits for it) plus the decision:
// HUMAN_DECIDE = 6 s a stack for a captain (the assumption: a practised hand picking a step or a blow with the preview
// shown, an order now and then), TAC_AI_DELAY for the sea's mind. Against a captain both sides think; against the sea
// only the boarder does. The armies: her waters' crew in her hull's stacks (boardSlots), the pirate's a stack or two
// fewer (npcBoardSlots), the captains in their level's kit (skills a pick a level, the artifacts of their band).

import { BANDS, HUMAN_DECIDE, bandStat } from '../tests/balance/boardlen.ts';
import { TAC_AI_DELAY, boardSlots, npcBoardSlots, tacOpen, tacTempo } from '../shared/src/data/tactical.ts';

const arg = (k: string, d: string): string => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const N = Number(arg('n', '4'));
const LEVELS = arg('levels', '3,8,13,18,23,28,33,38,43,48,53,58').split(',').map(Number);

const pc = (x: number) => `${Math.round(x * 100)}%`;
const mm = (m: number) => {
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const span = (a: [number, number], f: (x: number) => string) => (a[0] === a[1] ? `≈${f(a[0])}` : `${f(a[0])}–${f(a[1])}`);

console.log(`Boarding time by level (docs/25 §1.2) — ${N * 6} battles a level and side; a captain's decision ${HUMAN_DECIDE} s a stack, the sea's ${TAC_AI_DELAY} s.`);
console.log('');
console.log('| L | tempo | r.1 | stacks (her / sea) | rounds vs captain [table] | min vs captain [table] | min vs sea [table] | round-1 cut [table] | flag wins | turns |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const band: Record<number, { r: number[]; p: number[]; s: number[]; c: number[] }> = {};
for (const L of LEVELS) {
  const b = BANDS.find((x) => L >= x.lo && L <= x.hi)!;
  const pvp = bandStat(L, true, N), npc = bandStat(L, false, N);
  const k = (band[b.lo] ??= { r: [], p: [], s: [], c: [] });
  k.r.push(pvp.rounds);
  k.p.push(pvp.mins);
  k.s.push(npc.mins);
  k.c.push(pvp.cut1);
  console.log(`| ${L} | ×${tacTempo(L).toFixed(2)} | ×${tacOpen(L).toFixed(2)} | ${boardSlots(L)} / ${npcBoardSlots(L)} | ${pvp.rounds.toFixed(1)} [${span(b.rounds, String)}] | ${mm(pvp.mins)} [${span(b.pvp, mm)}] | ${mm(npc.mins)} [${span(b.npc, mm)}] | ${pc(pvp.cut1)} | ${pc(pvp.flags)} | ${pvp.turns.toFixed(0)} / ${npc.turns.toFixed(0)} |`);
}
console.log('');
console.log('By band (the mean of its levels):');
console.log('| levels | rounds [table] | vs captain [table] | vs sea [table] | round-1 cut [owner: ~35% → 15–18%] |');
console.log('|---|---|---|---|---|');
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
for (const b of BANDS) {
  const k = band[b.lo];
  if (!k) continue;
  console.log(`| ${b.lo}–${b.hi} | ${mean(k.r).toFixed(1)} [${span(b.rounds, String)}] | ${mm(mean(k.p))} [${span(b.pvp, mm)}] | ${mm(mean(k.s))} [${span(b.npc, mm)}] | ${pc(mean(k.c))} |`);
}
