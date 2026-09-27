// What the server says, in the player's language. The server speaks English; every sentence it can say is a pattern
// (tools/i18n-server.ts: "Sold {0} {1}."). An incoming toast is matched against the patterns — exact sentences
// first, then the most specific template — and the Russian twin is filled with the captured parts, which are
// themselves translated when they are known names or phrases. Unknown text passes through unchanged.

import { lang, typeset } from '../i18n.ts';
import { COMMON_RU, NAME_RU, TEXT_RU } from './data.ts';
import { composedNameRu, personNameRu } from './names.ts';
import { SERVER_RU_A } from './server.ru.a.ts';
import { SERVER_RU_B } from './server.ru.b.ts';

const TABLE: Record<string, string> = { ...SERVER_RU_A, ...SERVER_RU_B };
const exact = new Map<string, string>();
let templates: { re: RegExp; ru: string; order: number[]; adjacent: number[] }[] | null = null;

function compile(): void {
  templates = [];
  for (const [en, ru] of Object.entries(TABLE)) {
    if (!/\{\d+\}/.test(en)) {
      exact.set(en, ru);
      continue;
    }
    const order: number[] = [];
    const src = en.split(/(\{\d+\})/).map((part) => {
      const m = /^\{(\d+)\}$/.exec(part);
      if (m) {
        order.push(Number(m[1]));
        return '(.*?)'; // may be empty: the English plural 's' of a singular
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    // Parts side by side ("in {0}{1}"): the lazy match leaves the first empty, so they are split again below.
    const adjacent: number[] = [];
    let seen = 0;
    for (const m of en.matchAll(/\{\d+\}(?=(\{\d+\})?)/g)) {
      if (m[1]) adjacent.push(seen);
      seen++;
    }
    templates.push({ re: new RegExp(`^${src}$`, 's'), ru, order, adjacent });
  }
  // The most literal text first: "Sold {0} sugar" before "{0} {1}".
  const lit = (t: { re: RegExp }) => t.re.source.replace(/\(\.\*\?\)/g, '').length;
  templates.sort((a, b) => lit(b) - lit(a));
}

/** Names the server lowers inside a sentence ("short of provisions"): the Russian name, lowered too. */
let lowerNames: Map<string, string> | null = null;
function lowerName(s: string): string | undefined {
  if (!lowerNames || lowerNames.size < NAME_RU.size) {
    lowerNames = new Map();
    for (const [en, ru] of NAME_RU) lowerNames.set(en.toLowerCase(), ru.charAt(0).toLowerCase() + ru.slice(1));
  }
  return s === s.toLowerCase() ? lowerNames.get(s) : undefined;
}

/** A fragment the tables know as it stands (a name, a phrase, a number). */
function known(s: string): boolean {
  return /^[\d\s.,:;×x+\-%]*$/.test(s) || NAME_RU.has(s) || exact.has(s) || TEXT_RU.has(s) || !!composedNameRu(s) || !!personNameRu(s) || lowerName(s) !== undefined;
}

/** A captured fragment: a known name, a known phrase, or itself. */
function part(s: string, depth: number): string {
  if (!s) return s;
  return NAME_RU.get(s) ?? lowerName(s) ?? exact.get(s) ?? composedNameRu(s) ?? personNameRu(s) ?? (depth < 2 ? translate(s, depth + 1) : s);
}

function translate(s: string, depth: number): string {
  if (!templates) compile();
  // World news ("WORLD: …") is a heading over any sentence: the sentence is translated on its own.
  if (depth === 0 && s.startsWith('WORLD: ') && !exact.has(s)) {
    const rest = s.slice(7);
    const inner = translate(rest, 0);
    if (inner !== rest || !templates!.some((t) => t.re.test(s))) return `${exact.get('WORLD:') ?? 'Вести:'} ${inner}`;
  }
  const hit = exact.get(s) ?? TEXT_RU.get(s) ?? composedNameRu(s);
  if (hit) return hit;
  for (const t of templates!) {
    const m = t.re.exec(s);
    if (!m) continue;
    const caps = m.slice(1);
    for (const i of t.adjacent) {
      const c = caps[i + 1];
      if (caps[i] !== '' || !c || known(c)) continue;
      // One side must be known as it stands; the other may be a sentence of its own.
      const says = (x: string) => known(x) || (depth < 2 && translate(x, depth + 1) !== x);
      for (let k = 1; k < c.length; k++) {
        const l = c.slice(0, k), r = c.slice(k);
        if ((known(l) && says(r)) || (says(l) && known(r))) {
          caps[i] = l;
          caps[i + 1] = r;
          break;
        }
      }
    }
    const vals: Record<number, string> = {};
    t.order.forEach((n, i) => (vals[n] = part(caps[i], depth)));
    // A good inside the sentence is a common noun: «Доставить соль», not «Доставить Соль».
    return t.ru.replace(/\{(\d+)\}/g, (_, n: string, at: number) => {
      const v = vals[Number(n)] ?? '';
      return at > 0 && COMMON_RU.has(v) ? v.charAt(0).toLowerCase() + v.slice(1) : v;
    });
  }
  return s;
}

const MONTHS_RU: Record<string, string> = { Jan: 'янв', Feb: 'фев', Mar: 'мар', Apr: 'апр', May: 'мая', Jun: 'июн', Jul: 'июл', Aug: 'авг', Sep: 'сен', Oct: 'окт', Nov: 'ноя', Dec: 'дек' };

export function serverText(s: string): string {
  if (lang() !== 'ru' || !s) return s;
  // Dates the server writes in English ("04 Oct 2026 00:36 UTC") keep their numbers, lose their English.
  // Thousands the server writes with commas (1,020 silver) take the Russian space that does not break.
  return typeset(translate(s, 0)).replace(/(\d),(?=\d{3}(?!\d))/g, '$1\u00a0').replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g, (_, d: string, m: string, y: string) => `${d} ${MONTHS_RU[m]} ${y}`);
}

/** For tests: how many patterns are known. */
export function serverPatterns(): number {
  return Object.keys(TABLE).length;
}
