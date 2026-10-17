// The campaign's words as the client's translation patterns (client/src/lang/server.ts): the server fills the English
// with the world's names (build.ts), the client matches it and fills the Russian twin with the names in Russian. Every
// text of every chapter, its mentor put in; the steps' own words and the default wordings of each kind.

import { numberedPattern } from '../questgen.ts';
import { withGiver } from './build.ts';
import { CHAPTERS } from './chapters.ts';
import { STEP_WORDS, parseStep } from './steps.ts';
import type { ChapterSrc, T } from './types.ts';

function chapterPairs(ch: ChapterSrc): T[] {
  const out: T[] = [ch.title, ch.blurb, ch.giver, [ch.giver[0].split(',')[0].trim(), ch.giver[1].split(',')[0].trim()]];
  if (ch.reward?.title) out.push(ch.reward.title);
  const g = (p: T): T => numberedPattern(withGiver(p[0], ch, 0), withGiver(p[1], ch, 1));
  for (const q of ch.quests) {
    for (const w of [q, ...(q.alt ? [q.alt] : [])]) {
      out.push(w.t, g(w.b), g(w.d));
      for (const s of w.s) if (typeof s !== 'string') out.push(g([s[1], s[2]]));
    }
    if (q.alt) out.push(q.alt.label[0], q.alt.label[1]);
  }
  // the default wordings, the mentor of this chapter put in (only the hub's name him)
  for (const [kind, words] of Object.entries(STEP_WORDS)) {
    if (kind !== 'hub' && kind !== 'at') continue;
    for (const w of words) out.push(g(w));
  }
  return out;
}

/** Every pattern of the campaign: [English, Russian]. */
export function campaignPatterns(chapters: ChapterSrc[] = CHAPTERS): [string, string][] {
  const out: [string, string][] = [];
  for (const ch of chapters) out.push(...chapterPairs(ch));
  for (const [kind, words] of Object.entries(STEP_WORDS)) {
    if (kind === 'hub') continue;
    for (const w of words) out.push(numberedPattern(w[0], w[1]));
  }
  return out;
}

/** The step codes of the chapters that do not read (for the tests). */
export function badCodes(chapters: ChapterSrc[] = CHAPTERS): string[] {
  const out: string[] = [];
  for (const ch of chapters) for (const q of ch.quests) for (const s of q.s) {
    const p = parseStep(typeof s === 'string' ? s : s[0]);
    if (typeof p === 'string') out.push(`${ch.n}: ${p}`);
  }
  return out;
}
