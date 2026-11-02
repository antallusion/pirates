// «Лоцманская книга»: what has been learnt (pure, shared by the server and the client). An article is read when its
// last slide is reached (the client says `guide_read`); a section whose every article is read pays its silver once.

import type { GuideArticle, GuideSection } from './types.ts';

export interface GuideCount {
  n: number;
  m: number;
}

/** «Изучено N / M», in all and by section. */
export function guideCounts(list: readonly GuideArticle[], read: Iterable<string>): { all: GuideCount; by: Partial<Record<GuideSection, GuideCount>> } {
  const r = new Set(read);
  const by: Partial<Record<GuideSection, GuideCount>> = {};
  let n = 0;
  for (const a of list) {
    const c = (by[a.section] ??= { n: 0, m: 0 });
    c.m++;
    if (r.has(a.id)) {
      c.n++;
      n++;
    }
  }
  return { all: { n, m: list.length }, by };
}

/** The sections every article of which is read (an empty section is never done). */
export function guideSectionsDone(list: readonly GuideArticle[], read: Iterable<string>): GuideSection[] {
  const { by } = guideCounts(list, read);
  return (Object.entries(by) as [GuideSection, GuideCount][]).filter(([, c]) => c.m > 0 && c.n === c.m).map(([s]) => s);
}
