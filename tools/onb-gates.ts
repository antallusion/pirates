import { CHAPTERS } from '../shared/src/data/campaign/chapters.ts';
import { campaignPaces } from '../shared/src/data/campaign/pacing.ts';
const paces = campaignPaces();
let i = 0;
for (const ch of CHAPTERS.slice(0, 8)) for (const q of ch.quests) { const g = paces[i++]?.gate; console.log(ch.n, g, (q.s as unknown[]).map((x) => (Array.isArray(x) ? x[0] : x)).join(',')); }
