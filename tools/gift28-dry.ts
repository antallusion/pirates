// The thank-you letter's dry run (server/src/game/gift28.ts) against a COPY of the database — nothing sent:
//   node tools/gift28-dry.ts <path/to/copy-of-gravetide.db>
// Who would get it now (every saved captain, not a bot, an NPC, a QA or a test account, not had it yet), and how many
// of them have no room aboard for the 10 musketeers as their saves stand (a free slot and ten hammocks).

import { Database } from '../server/src/persistence/db.ts';
import { GIFT28_DONE, giftPlan } from '../server/src/game/gift28.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { armySlots } from '../shared/src/data/army.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';

const path = process.argv[2];
if (!path) {
  console.log('usage: node tools/gift28-dry.ts <db copy>');
  process.exit(1);
}
const db = new Database(path);
const all = db.allCaptains().length;
const plan = giftPlan(db, Date.now());
const noRoom = plan.filter((r) => !r.room);
console.log(`captains saved: ${all}`);
console.log(`already sent: ${db.getKv(GIFT28_DONE) ? JSON.stringify(db.getKv(GIFT28_DONE)) : 'no'}`);
console.log(`would get the letter: ${plan.length}`);
console.log(`no room for the musketeers now: ${noRoom.length}`);
// Why: no free slot, fewer than ten free hammocks, or both.
const rows = new Map(db.allCaptains().map((r) => [r.account_id, r.data]));
let slot = 0, ham = 0, both = 0;
for (const r of noRoom) {
  const p = JSON.parse(rows.get(r.acc) ?? '{}');
  const cls = SHIP_CLASSES[p.loadout?.classId as keyof typeof SHIP_CLASSES];
  if (!cls) continue;
  const crewMax = computeShipStats(p.loadout, p.captain, p.talents ?? {}).crewMax;
  const s = (p.army?.length ?? 0) >= armySlots(cls.tier), h = crewMax - (p.crew ?? 0) < 10;
  if (s && h) both++;
  else if (s) slot++;
  else if (h) ham++;
}
console.log(`  no free slot only: ${slot}; fewer than 10 free hammocks only: ${ham}; both: ${both}`);
if (process.argv.includes('--list')) for (const r of plan) console.log(`  #${r.acc} ${r.name}${r.room ? '' : '  (no room)'}`);
