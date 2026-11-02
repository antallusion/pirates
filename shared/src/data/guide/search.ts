// «Лоцманская книга»: the search (pure, shared: the site's mirror may use it too). Instant and forgiving: lowercased,
// ё read as е, a word matched by its stem's prefix (so «порта», «порту», «порты» all find «порт»), one slip forgiven in
// a long word. Over the titles, the tags, the summaries and the slides' texts in both languages. Every word of the
// query must be found somewhere; the title weighs most, then the tags, the summary, the slides.

import type { GuideArticle } from './types.ts';

/** Lowercase, ё → е, everything that is not a letter or a digit → a space. */
export function guideNorm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function guideWords(s: string): string[] {
  const n = guideNorm(s);
  return n ? n.split(' ') : [];
}

/** The part of a query's word a text's word must begin with: short words whole, longer ones without their ending. */
export function guideStem(w: string): string {
  if (w.length <= 3) return w;
  if (w.length <= 5) return w.slice(0, w.length - 1);
  return w.slice(0, Math.max(4, w.length - 2));
}

/** One slip (a letter wrong, missing or extra) between two short strings. */
function oneSlip(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++d > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}

/** How well a text's word answers a query's word: 3 whole, 2 by its stem, 1 with one slip, 0 not. */
export function wordMatch(q: string, w: string): number {
  if (w === q) return 3;
  const st = guideStem(q);
  if (w.startsWith(st)) return 2;
  // (the first letter kept: a slip there finds too much)
  if (q.length >= 5 && w[0] === q[0] && w.length >= st.length - 1 && oneSlip(st, w.slice(0, st.length))) return 1;
  return 0;
}

export type GuideField = 'title' | 'tags' | 'summary' | 'slide';
const WEIGHT: Record<GuideField, number> = { title: 6, tags: 4, summary: 2, slide: 1 };

export interface GuideHit {
  article: GuideArticle;
  score: number;
  /** The text to show under the title (her language): the summary, or the slide that alone says it. */
  snippet: string;
  slide: number | null;
}

interface Doc {
  a: GuideArticle;
  fields: { f: GuideField; words: string[]; slide: number | null }[];
}

const CACHE = new WeakMap<readonly GuideArticle[], Doc[]>();

function docs(list: readonly GuideArticle[]): Doc[] {
  let d = CACHE.get(list);
  if (d) return d;
  d = list.map((a) => ({
    a,
    fields: [
      { f: 'title' as const, words: guideWords(a.title.join(' ')), slide: null },
      { f: 'tags' as const, words: guideWords(a.tags.join(' ')), slide: null },
      { f: 'summary' as const, words: guideWords(a.summary.join(' ')), slide: null },
      ...a.slides.map((s, i) => ({ f: 'slide' as const, words: guideWords(s.text.join(' ')), slide: i })),
    ],
  }));
  CACHE.set(list, d);
  return d;
}

/** The query's words worth looking for (one letter alone finds everything). */
function queryWords(query: string): string[] {
  return [...new Set(guideWords(query))].filter((w) => w.length >= 2 || /\d/.test(w));
}

const hasMatch = (qs: string[], text: string) => guideWords(text).some((w) => qs.some((q) => wordMatch(q, w) > 0));

/** The articles a query finds, best first. `ru`: the snippets in Russian. */
export function guideSearch(list: readonly GuideArticle[], query: string, ru: boolean, limit = 30): GuideHit[] {
  const qs = queryWords(query);
  if (!qs.length) return [];
  const li = ru ? 1 : 0;
  const out: GuideHit[] = [];
  for (const d of docs(list)) {
    let score = 0, ok = true, slide: number | null = null, slideBest = 0;
    for (const q of qs) {
      let best = 0;
      for (const fl of d.fields) {
        let m = 0;
        for (const w of fl.words) {
          const x = wordMatch(q, w);
          if (x > m) m = x;
          if (m === 3) break;
        }
        if (!m) continue;
        const v = m * WEIGHT[fl.f];
        if (v > best) best = v;
        if (fl.slide !== null && v > slideBest) {
          slideBest = v;
          slide = fl.slide;
        }
      }
      if (!best) {
        ok = false;
        break;
      }
      score += best;
    }
    if (!ok) continue;
    const fromSlide = slide !== null && !hasMatch(qs, d.a.summary[li]) && hasMatch(qs, d.a.slides[slide].text[li]);
    out.push({ article: d.a, score, snippet: fromSlide ? d.a.slides[slide!].text[li] : d.a.summary[li], slide: fromSlide ? slide : null });
  }
  out.sort((a, b) => b.score - a.score || a.article.title[li].localeCompare(b.article.title[li]));
  return out.slice(0, limit);
}

/** Where a query's words stand in a text: [from, to) ranges, for the highlight. */
export function guideMarks(text: string, query: string): [number, number][] {
  const qs = queryWords(query);
  if (!qs.length) return [];
  const out: [number, number][] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const w = guideNorm(m[0]);
    let q = '', best = 0;
    for (const x of qs) {
      const v = wordMatch(x, w);
      if (v > best) [q, best] = [x, v];
    }
    if (!best) continue;
    const from = m.index!;
    const len = best === 3 ? m[0].length : Math.min(m[0].length, q.length);
    out.push([from, from + len]);
  }
  return out;
}
