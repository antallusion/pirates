// Localization (RU/EN): the interface speaks the captain's language. `t(key, vars)` looks the key up in the
// current dictionary, falls back to English, and fills {placeholders}. The choice is kept in localStorage;
// the first visit follows the browser. Keys are grouped by screen; every English key has a Russian twin
// (tests/i18n.test.ts holds the dictionaries to that).

import { EN } from './lang/en.ts';
import { RU } from './lang/ru.ts';

export type Lang = 'en' | 'ru';
export type Key = keyof typeof EN;

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { en: EN, ru: RU };
const listeners: (() => void)[] = [];

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem('gravetide.lang');
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    /* no storage */
  }
  const nav = (globalThis.navigator?.language ?? 'en').toLowerCase();
  return nav.startsWith('ru') || nav.startsWith('uk') || nav.startsWith('be') ? 'ru' : 'en';
}

let current: Lang = detect();

export function lang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try {
    globalThis.localStorage?.setItem('gravetide.lang', l);
  } catch {
    /* no storage */
  }
  if (globalThis.document) document.documentElement.lang = l;
  for (const f of listeners) f();
}

/** Re-render hooks for screens that hold text. */
export function onLang(f: () => void): void {
  listeners.push(f);
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? EN[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return current === 'ru' ? typeset(s) : s;
}

/** Russian typesetting: a dash never opens a line, a one-letter word (в, с, к, и…) never ends one. */
export function typeset(s: string): string {
  return s.replace(/ ([—–])/g, '\u00a0$1').replace(/(?<=^|[\s(«„"])([вВкКсСуУоОиИаАяЯ]) /g, '$1\u00a0');
}

/** Whether a key exists (for ids that come from the server). */
export function has(key: string): key is Key {
  return key in EN;
}

/** Russian plural forms: 1 корабль, 2 корабля, 5 кораблей. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (current !== 'ru') return n === 1 ? one : few;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Applies translations to static markup: `data-i18n="key"` sets the text, `data-i18n-ph` the placeholder. */
export function translateDom(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n!;
    if (has(k)) el.textContent = t(k);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => {
    const k = el.dataset.i18nPh!;
    if (has(k)) el.placeholder = t(k);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const k = el.dataset.i18nTitle!;
    if (has(k)) el.title = t(k);
  });
}

/**
 * A screen's own dictionary: `const L = dict(EN, RU)` then `L('key', vars)`. Keeps each UI module's words next to it
 * (client/src/lang/ui/*.ts) with the same fallback and placeholders as `t`.
 */
export function dict<T extends Record<string, string>>(en: T, ru: Record<keyof T, string>): (key: keyof T & string, vars?: Record<string, string | number>) => string {
  return (key, vars) => {
    let s = (current === 'ru' ? ru[key] : undefined) ?? en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
    return current === 'ru' ? typeset(s) : s;
  };
}
