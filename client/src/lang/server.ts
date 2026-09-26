// What the server says, in the player's language. The server speaks English; every sentence it can say is a pattern
// (tools/i18n-server.ts: "Sold {0} {1}."). An incoming toast is matched against the patterns — exact sentences
// first, then the most specific template — and the Russian twin is filled with the captured parts, which are
// themselves translated when they are known names or phrases. Unknown text passes through unchanged.

import { lang } from '../i18n.ts';
import { NAME_RU } from './data.ts';
import { SERVER_RU_A } from './server.ru.a.ts';
import { SERVER_RU_B } from './server.ru.b.ts';

const TABLE: Record<string, string> = { ...SERVER_RU_A, ...SERVER_RU_B };
const exact = new Map<string, string>();
let templates: { re: RegExp; ru: string; order: number[] }[] | null = null;

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
        return '(.+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    templates.push({ re: new RegExp(`^${src}$`, 's'), ru, order });
  }
  // The most literal text first: "Sold {0} sugar" before "{0} {1}".
  const lit = (t: { re: RegExp }) => t.re.source.replace(/\(\.\+\?\)/g, '').length;
  templates.sort((a, b) => lit(b) - lit(a));
}

/** A captured fragment: a known name, a known phrase, or itself. */
function part(s: string, depth: number): string {
  return NAME_RU.get(s) ?? exact.get(s) ?? (depth < 2 ? translate(s, depth + 1) : s);
}

function translate(s: string, depth: number): string {
  if (!templates) compile();
  const hit = exact.get(s);
  if (hit) return hit;
  for (const t of templates!) {
    const m = t.re.exec(s);
    if (!m) continue;
    const vals: Record<number, string> = {};
    t.order.forEach((n, i) => (vals[n] = part(m[i + 1], depth)));
    return t.ru.replace(/\{(\d+)\}/g, (_, n: string) => vals[Number(n)] ?? '');
  }
  return s;
}

export function serverText(s: string): string {
  if (lang() !== 'ru' || !s) return s;
  return translate(s, 0);
}

/** For tests: how many patterns are known. */
export function serverPatterns(): number {
  return Object.keys(TABLE).length;
}
