// The advice mailer's dry run against a COPY of the database (read-only; nothing is sent, nothing is written):
//   node tools/advice-dry.ts <path/to/gravetide.db>
// Every captain as the day's pass would see her now (all taken as away: the copy knows no sessions), the hints due
// on each channel by the limits, in the words she would read. The same rules as the server
// (shared/src/data/advice.ts); her island, her notices' links and the hints already sent from the kv table.

import { DatabaseSync } from 'node:sqlite';
import { ADVICE_CHANNELS, adviceHints, letterWords, newAdviceState, notACaptain, outsideWords, pickHint } from '../shared/src/data/advice.ts';
import type { AdviceCaptain, AdviceChannel, AdviceState } from '../shared/src/data/advice.ts';
import { CAMPAIGN_SIZE } from '../shared/src/data/campaign/plan.ts';
import { chapterOfSlot } from '../shared/src/data/campaign/progress.ts';
import { shipLevelOf } from '../shared/src/data/shiplevel.ts';

const path = process.argv[2];
if (!path) {
  console.log('usage: node tools/advice-dry.ts <db copy>');
  process.exit(1);
}
const db = new DatabaseSync(path, { readOnly: true });
const kv = <T,>(k: string): T | undefined => {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(k) as { value: string } | undefined;
  return r ? (JSON.parse(r.value) as T) : undefined;
};
const now = Date.now();
type Hold = { owned?: boolean; owner: { kind: string; id: number }; yard?: { town?: { b: Record<string, number> } } };
const holdings = Object.values(kv<Record<string, Hold>>('holdings') ?? {});
const rows = db.prepare('SELECT a.id, a.name, a.email, a.email_verified, a.last_seen, c.data FROM accounts a JOIN captains c ON c.account_id = a.id').all() as { id: number; name: string; email: string | null; email_verified: number; last_seen: number; data: string }[];
const links = new Map<number, string[]>();
for (const r of db.prepare('SELECT provider, account_id FROM oauth_links').all() as { provider: string; account_id: number }[]) links.set(r.account_id, [...(links.get(r.account_id) ?? []), r.provider]);

const lines: string[] = [];
const by: Record<string, number> = {};
let n = 0;
for (const r of rows) {
  if (notACaptain(r.name)) continue;
  let p: { level: number; army?: { u: string; n: number }[]; loadout: { classId: string; level?: number }; campaign?: { at: number; started?: boolean }; ashoreAt?: number };
  try {
    p = JSON.parse(r.data);
  } catch {
    continue;
  }
  const h = holdings.find((x) => x.owned && x.owner.kind === 'player' && x.owner.id === r.id);
  const tgn = kv<{ on: boolean | null; chat: number; blocked: boolean; vk?: number; vkOff?: boolean; lang: 'ru' | 'en'; seen: number }>(`tgn:${r.id}`);
  let shipLevel = 1;
  try {
    shipLevel = shipLevelOf(p.loadout as Parameters<typeof shipLevelOf>[0]);
  } catch {
    /* an old save */
  }
  const seen = p.ashoreAt ?? tgn?.seen ?? r.last_seen;
  const c: AdviceCaptain = {
    acc: r.id, name: r.name, level: p.level, army: (p.army ?? []) as AdviceCaptain['army'], shipLevel,
    town: h ? (h.yard?.town?.b ?? { hall: 1 }) : null, online: false, awayMs: Math.max(0, now - seen),
    campaign: p.campaign && p.campaign.at < CAMPAIGN_SIZE ? chapterOfSlot(p.campaign.at) : null,
  };
  const st: AdviceState = { ...newAdviceState(), ...(kv<AdviceState>(`advice:${r.id}`) ?? {}) };
  const hints = adviceHints(c);
  if (!hints.length) continue;
  const can: Record<AdviceChannel, boolean> = {
    letter: true,
    email: !!(r.email && r.email_verified),
    push: !!(tgn && tgn.on === true && ((tgn.vk && !tgn.vkOff) || (tgn.chat && !tgn.blocked))),
  };
  const lang = tgn?.lang === 'en' ? 'en' : 'ru';
  const plan: string[] = [];
  let outside = false;
  for (const ch of ADVICE_CHANNELS) {
    if (!can[ch] || (ch === 'push' && outside)) continue;
    const hint = pickHint(hints, st, ch, now, c);
    if (!hint) continue;
    if (ch !== 'letter') outside = true;
    by[`${ch}:${hint.kind}`] = (by[`${ch}:${hint.kind}`] ?? 0) + 1;
    const words = ch === 'letter' ? letterWords(hint, lang)!.subject : outsideWords(hint, lang, r.name).line;
    plan.push(`${ch}:${hint.kind}${ch === 'letter' ? '' : ` «${words.slice(0, 90)}${words.length > 90 ? '…' : ''}»`}`);
  }
  if (!plan.length) continue;
  n++;
  const away = Math.round(c.awayMs / 3_600_000);
  lines.push(`#${r.id} ${r.name} ⚓${c.level} [${(links.get(r.id) ?? []).join('+') || 'browser'}${can.email ? '+email' : ''}] away ${away}h, hints ${hints.map((x) => x.kind).join('/')} → ${plan.join(' | ')}`);
}
console.log(lines.join('\n'));
console.log(`\n${n} captains would get something; by channel:kind ${JSON.stringify(by)}`);
