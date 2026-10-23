// Every quest chain's legs on the sea route (owner, 2026-10-23: no leg of a chain over 3 km): the campaign chapter by
// chapter (its hand-over into a chapter's waters apart), the ports' jobs, the creature jobs, the islands' people's jobs,
// the region arcs, the written quests. Prints the count over the limit by kind and the worst of them.
//   node --disable-warning=ExperimentalWarning tools/chain-legs.ts [seed] [--all]

import { WORLD_SEED } from '../shared/src/constants.ts';
import { chainAudit } from '../shared/src/data/chainaudit.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';

const seed = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? WORLD_SEED);
const all = process.argv.includes('--all');
const w = generateWorld(seed);
const t0 = Date.now();
const a = chainAudit(w, seed);
console.log(`seed ${seed} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const [kind, r] of Object.entries(a.byKind)) {
  const over = r.legs.filter((l) => l.d > 3000);
  const fin = r.legs.filter((l) => Number.isFinite(l.d)).map((l) => l.d);
  console.log(`  ${kind.padEnd(10)} legs ${String(r.legs.length).padStart(5)}  over 3 km ${String(over.length).padStart(4)}  longest ${over.some((l) => !Number.isFinite(l.d)) ? '>6 km' : `${((Math.max(0, ...fin)) / 1000).toFixed(1)} km`}`);
  for (const l of (all ? over : over.slice(0, 6))) console.log(`      ${l.quest} #${l.step} → ${l.to}: ${Number.isFinite(l.d) ? `${(l.d / 1000).toFixed(1)} km` : '>6 km'}`);
}
console.log(`  hand-overs: sailed ${a.handovers.filter((h) => !h.passage).length} (longest ${(Math.max(0, ...a.handovers.filter((h) => !h.passage).map((h) => h.d)) / 1000).toFixed(1)} km); passages: ${a.handovers.filter((h) => h.passage).map((h) => `ch${h.ch} ${(h.d / 1000).toFixed(1)} km`).join(', ') || 'none'}`);
