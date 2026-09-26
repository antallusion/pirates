// Seeds an established population for a zone load test: N captains already at sea, scattered over open
// water in one region, as if they had sailed there. Writes their session tokens for tools/loadtest.ts.
// Run against a stopped server's database:
//   node tools/seed-bots.ts --db data/load.db --bots 500 --region gravewater --out /tmp/tokens.json

import { writeFileSync } from 'node:fs';
import { WORLD_SEED, WORLD_SIZE } from '../shared/src/constants.ts';
import { CAPTAINS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { generateWorld, isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { AuthService } from '../server/src/auth.ts';
import { newProfile } from '../server/src/game/player.ts';
import { Database } from '../server/src/persistence/db.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BOTS = Number(args.get('bots') ?? 500);
const REGION = (args.get('region') ?? 'gravewater') as RegionId;
const OUT = args.get('out') ?? 'tokens.json';
const db = new Database(args.get('db') ?? 'data/load.db');
const auth = new AuthService(db);
const world = generateWorld(WORLD_SEED);

// Open water in the region, clear of any shore by 150 m.
const clear = (x: number, y: number) => {
  for (const [dx, dy] of [[0, 0], [150, 0], [-150, 0], [0, 150], [0, -150]]) if (isLand(world, x + dx, y + dy)) return false;
  return true;
};
const spots: [number, number][] = [];
let guard = 0;
while (spots.length < BOTS && guard++ < BOTS * 4000) {
  const x = Math.random() * WORLD_SIZE, y = Math.random() * WORLD_SIZE;
  if (regionAt(world, x, y) === REGION && clear(x, y)) spots.push([x, y]);
}
if (spots.length < BOTS) throw new Error(`only ${spots.length} spots of open water found in ${REGION}`);

const tag = Math.random().toString(36).slice(2, 5);
const ids = Object.keys(CAPTAINS).filter((c) => !CAPTAINS[c as CaptainId].premium) as CaptainId[];
const tokens: string[] = [];
db.transaction(() => {
  for (let i = 0; i < BOTS; i++) {
    const r = auth.register(`Zone ${tag} ${i}`);
    if ('error' in r) throw new Error(r.error);
    const p = newProfile(ids[i % ids.length], `Wake ${i}`, 'saltmarrow', 0);
    p.docked = null;
    p.level = 5 + (i % 20);
    const [x, y] = spots[i];
    db.saveCaptain(r.accountId, p, x, y, Math.random() * Math.PI * 2);
    tokens.push(r.token);
  }
});
writeFileSync(OUT, JSON.stringify(tokens));
console.log(`${BOTS} captains at sea in ${REGION}; tokens in ${OUT}`);
db.close();
