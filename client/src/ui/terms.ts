// The sea's vocabulary (docs/07 §11.6): every nautical term is underlined and explained in a line; with
// "Plain terms" on, the jargon gives way to a description. Names stay as they are.

import { has, t } from '../i18n.ts';
import type { Key } from '../i18n.ts';
import { settings } from '../settings.ts';
import { esc } from './dom.ts';

/** A term as HTML: the word (or its plain twin), dotted underline, a one-line explanation on hover. */
export function term(key: Key, cls = ''): string {
  const plainKey = `${key}.plain`;
  const word = settings().plainTerms && has(plainKey) ? t(plainKey) : t(key);
  const tipKey = `${key}.tip`;
  const tip = has(tipKey) ? t(tipKey) : '';
  return `<span class="term${cls ? ' ' + cls : ''}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(word)}</span>`;
}

/** The glossary for the logbook: every term with its explanation. */
export const GLOSSARY: Key[] = ['sail.irons', 'sail.close', 'sail.beam', 'sail.broad', 'sail.running', 'term.chain', 'term.grape', 'term.broadside', 'term.leeward', 'term.windward', 'term.bells'];

export function glossaryHtml(): string {
  return `<dl class="glossary">${GLOSSARY.map((k) => `<dt>${esc(t(k))}${has(`${k}.plain`) ? ` <span class="muted">— ${esc(t(`${k}.plain` as Key))}</span>` : ''}</dt><dd>${esc(has(`${k}.tip`) ? t(`${k}.tip` as Key) : '')}</dd>`).join('')}</dl>`;
}
