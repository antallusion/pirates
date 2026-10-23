// The campaign's runs audited (owner, 2026-10-18 and the mid-game QA of 2026-10-23: «чтобы все было недалеко»): every
// voyage between two locations, every delivery's run, every good's nearest seller and every black market — the ones
// over the limit printed. Both worlds (the tests' 1337 and the live WORLD_SEED).
//   node --disable-warning=ExperimentalWarning tools/campaign-legs.ts [km=8]

import { WORLD_SEED } from '../shared/src/constants.ts';
import { campaignLegs } from '../shared/src/data/campaign/build.ts';
import { buildCampaign } from '../shared/src/data/campaign/build.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';

const lim = Number(process.argv[2] ?? 8) * 1000;
for (const seed of [WORLD_SEED, 1337]) {
  const w = generateWorld(seed);
  const c = buildCampaign(w, seed, CHAPTERS);
  const legs = campaignLegs(w, c);
  const long = legs.filter((l) => l.d > lim);
  const inner = legs.filter((l) => !l.crossing);
  console.log(`seed ${seed}: ${legs.length} legs, ${long.length} over ${lim / 1000} km (${long.filter((l) => !l.crossing).length} not a crossing), the longest not a crossing ${(Math.max(...inner.map((l) => l.d)) / 1000).toFixed(1)} km`);
  for (const l of long) console.log(`  ${l.q.padEnd(8)} ${(l.crossing ? 'crossing' : l.kind).padEnd(8)} ${l.from} → ${l.to}: ${(l.d / 1000).toFixed(1)} km`);
}
