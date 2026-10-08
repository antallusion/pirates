// The sea's navigation, measured (2026-10-09): chases past what a keel strikes and the helmsman's runs to a mark, on
// the full sea (its islands, reefs, hulks, skerries and piers), deterministic (tools/nav/harness.ts).
//
//   node --disable-warning=ExperimentalWarning tools/nav/measure.ts [--per 7] [--who captain,npc,sail] [--json out.json] [-v]

import { writeFileSync } from 'node:fs';
import { makeGame } from '../../tests/helpers.ts';
import { chaseRun, chaseScenes, sailRun, sailScenes, sumChases, sumSails } from './harness.ts';
import type { ChaseResult, SailResult } from './harness.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PER = Number(arg('per', '5'));
/** The helmsman's runs: this many of each of their six kinds. */
const SAIL_PER = Number(arg('sail-per', '7'));
const WHO = arg('who', 'captain,guns,npc,sail').split(',');
const OUT = arg('json', '');
const V = process.argv.includes('-v');

const { game } = makeGame();
const out: Record<string, unknown> = {};
let ms = 0, ticks = 0;
const step = game.step.bind(game);
game.step = (...a: Parameters<typeof game.step>) => {
  const t0 = performance.now();
  const r = step(...a);
  ms += performance.now() - t0;
  ticks++;
  return r;
};

/** Only these kinds (`--kinds reef,dense`): all by default. */
const KINDS = arg('kinds', '');
const scenes = chaseScenes(game.world, PER).filter((sc) => !KINDS || KINDS.split(',').includes(sc.kind));
const byKind = (rs: { kind: string }[]) => [...new Set(rs.map((r) => r.kind))];
for (const who of (['captain', 'guns', 'npc'] as const).filter((w) => WHO.includes(w))) {
  const rs: ChaseResult[] = [];
  for (const sc of scenes) {
    const r = chaseRun(game, sc, who, sc.kind === 'reef' ? 'frigate' : 'brig', who === 'npc' ? 120 : sc.kind === 'behind' ? 120 : who === 'guns' ? 45 : 60);
    rs.push(r);
    if (V) console.log(who, JSON.stringify(r));
  }
  const all = sumChases(rs);
  console.log(`\n${who}: ${rs.length} chases`);
  console.log('kind     n  stuck  stuck s  blows(runs)  reef runs  reef %hull  grappled  median s  p90 s');
  for (const k of [...byKind(rs), 'all']) {
    const s = k === 'all' ? all : sumChases(rs.filter((r) => r.kind === k));
    console.log(`${k.padEnd(7)} ${String(s.n).padStart(2)}  ${String(s.stuck).padStart(5)}  ${String(s.stuckSec).padStart(7)}  ${`${s.blows}(${s.blowRuns})`.padStart(11)}  ${String(s.reefRuns).padStart(9)}  ${String(s.reef).padStart(10)}  ${String(s.grappled).padStart(8)}  ${String(s.median).padStart(8)}  ${String(s.p90).padStart(5)}`);
  }
  const ends: Record<string, number> = {};
  for (const r of rs) ends[r.end] = (ends[r.end] ?? 0) + 1;
  console.log('ends', JSON.stringify(ends));
  out[who] = { summary: all, runs: rs };
}
if (WHO.includes('sail')) {
  const rs: SailResult[] = [];
  for (const sc of sailScenes(game.world, SAIL_PER)) {
    const r = sailRun(game, sc);
    rs.push(r);
    if (V) console.log('sail', JSON.stringify(r));
  }
  console.log(`\nautosail: ${rs.length} runs`);
  console.log('kind        n  arrived  blocked  blows  median s  why');
  for (const k of [...byKind(rs), 'all']) {
    const s = sumSails(k === 'all' ? rs : rs.filter((r) => r.kind === k));
    console.log(`${k.padEnd(10)} ${String(s.n).padStart(2)}  ${String(s.arrived).padStart(7)}  ${String(s.blocked).padStart(7)}  ${String(s.blows).padStart(5)}  ${String(s.median).padStart(8)}  ${JSON.stringify(s.whys)}`);
  }
  out.sail = { summary: sumSails(rs), runs: rs };
}
console.log(`\nticks ${ticks}, ${(ms / Math.max(1, ticks)).toFixed(2)} ms a tick (the whole sea, these runs)`);
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
