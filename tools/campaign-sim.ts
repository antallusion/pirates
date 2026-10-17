// The campaign's pace, chapter by chapter (docs/36 §4): a captain who does nothing but the campaign — the levels she
// stands at as each chapter begins and ends, its quests, its experience, a quest's worth in ships of her level, the
// steps it asks (the fights, the islands). The real run through the game is tests/campaign.test.ts («a captain who does
// only the campaign»); this prints the table of docs/36.
//   node --disable-warning=ExperimentalWarning tools/campaign-sim.ts [--md]

import { MAX_LEVEL, xpForLevel, xpUnit } from '../shared/src/constants.ts';
import { buildCampaign } from '../shared/src/data/campaign/build.ts';
import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import { campaignPaces, chapterPurse } from '../shared/src/data/campaign/pacing.ts';
import { PLAN } from '../shared/src/data/campaign/plan.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';

const md = process.argv.includes('--md');
const world = generateWorld(1337);
const c = buildCampaign(world, 1337, CHAPTERS);
const paces = campaignPaces();
let level = 1, xp = 0, slot = 0, silver = 0;
const rows: string[] = [];
const mix: Record<string, number> = {};
for (const p of PLAN) {
  const from = level;
  let gained = 0, units = 0, fights = 0, isles = 0;
  for (let k = 0; k < p.size; k++, slot++) {
    const pace = paces[slot];
    if (pace.gate > level) throw new Error(`slot ${slot}: gate ${pace.gate} above level ${level}`);
    gained += pace.xp;
    units += pace.xp / xpUnit(pace.gate);
    silver += pace.silver;
    const q = c.bySlot.get(slot)!.a;
    for (const st of q.steps) {
      mix[st.type] = (mix[st.type] ?? 0) + 1;
      if (st.type === 'board' || st.type === 'sink') fights += st.count;
      if (st.type === 'isle' || st.type === 'land') isles++;
    }
    xp += pace.xp;
    while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }
  }
  silver += chapterPurse(paces[slot - 1].gate);
  const ch = CHAPTERS.find((x) => x.n === p.n)!;
  rows.push(md
    ? `| ${p.n} | ${ch.title[1]} | ${p.region} | ${p.size} | ${from}→${level} | ${gained.toLocaleString('ru-RU')} | ${(units / p.size).toFixed(1)} | ${fights} | ${isles} |`
    : `ch${String(p.n).padStart(2)} ${ch.title[0].padEnd(30)} ${p.region.padEnd(18)} q${String(p.size).padStart(3)}  L${String(from).padStart(2)}→${String(level).padStart(2)}  xp ${String(gained).padStart(8)}  ${(units / p.size).toFixed(1).padStart(5)} ships/quest  fights ${String(fights).padStart(3)}  islands ${isles}`);
}
if (md) console.log('| Глава | Название | Море | Заданий | Уровень | Опыт | Кораблей своего уровня за задание | Боёв (абордаж + потопить) | Островов |\n|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(`\nend: level ${level}, xp past it ${xp}; silver ${silver.toLocaleString('en-GB')} (quests and chapter purses)`);
console.log('steps:', JSON.stringify(Object.entries(mix).sort((a, b) => b[1] - a[1])));
