// Checks the campaign's chapter files as written (shared/src/data/campaign/chNN.ts):
//   node --disable-warning=ExperimentalWarning tools/campaign-check.ts [n ...]
// Prints what is wrong with each chapter (nothing: all is well) and the step mix.

import { existsSync } from 'node:fs';
import { checkChapter } from '../shared/src/data/campaign/check.ts';
import { PLAN } from '../shared/src/data/campaign/plan.ts';
import { parseStep } from '../shared/src/data/campaign/steps.ts';
import type { ChapterSrc } from '../shared/src/data/campaign/types.ts';

const want = process.argv.slice(2).map(Number).filter((n) => n > 0);
let bad = 0, quests = 0;
const mix: Record<string, number> = {};
for (const p of PLAN) {
  if (want.length && !want.includes(p.n)) continue;
  const file = new URL(`../shared/src/data/campaign/ch${String(p.n).padStart(2, '0')}.ts`, import.meta.url);
  if (!existsSync(file)) {
    console.log(`ch${p.n}: not written yet`);
    continue;
  }
  const ch = ((await import(file.href)) as { CHAPTER: ChapterSrc }).CHAPTER;
  const errs = checkChapter(ch);
  quests += ch.quests?.length ?? 0;
  for (const q of ch.quests ?? []) for (const s of q.s) {
    const sp = parseStep(typeof s === 'string' ? s : s[0]);
    if (typeof sp !== 'string') mix[sp.kind] = (mix[sp.kind] ?? 0) + 1;
  }
  if (errs.length) {
    bad += errs.length;
    console.log(errs.join('\n'));
  } else console.log(`ch${p.n}: ok (${ch.quests.length} quests)`);
}
console.log(`${quests} quests, ${bad} problems`);
console.log(JSON.stringify(Object.entries(mix).sort((a, b) => b[1] - a[1])));
process.exitCode = bad ? 1 : 0;
