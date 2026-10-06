// The kit's window parts (docs/23 phase 6): every window of the game is a bottom sheet on a phone held sideways, and
// is built from the same few pieces on a desk:
//   railTabs   — the window's main places as big icon tabs (one or two words), a rail down the left on a phone;
//   chipRow    — the second row: the rest of the window's places as small chips;
//   winHead    — one band: the window's name, a few figures, room for the close button;
//   quickBar   — the one-tap actions a window is mostly opened for («Продать всё», «Починить»…);
//   wasBecomes — an upgrade as «было → стало» with one button;
//   rangeHtml  — a slider and its number (the tavern's hire).
// Long words go to a hint on a long press (hint.ts), never on the button.

import { esc, icon } from '../dom.ts';
import { badgeText } from './button.ts';

export interface WinTab {
  id: string;
  /** An art id for icon(), and a glyph until it loads. */
  icon: string;
  glyph?: string;
  /** One or two words. */
  label: string;
  /** A longer line for the long-press hint (and the mouse's title). */
  hint?: string;
  badge?: number;
  /** The gold one (a port's «В море»): an action, not a place. */
  primary?: boolean;
  disabled?: boolean;
}

function tabInner(t: WinTab, cls: string): string {
  const b = badgeText(t.badge ?? 0);
  return `${icon(t.icon, t.glyph ?? '', `${cls}-ico`)}<span class="${cls}-l">${esc(t.label)}</span>${b ? `<b class="k-badge" aria-hidden="true">${b}</b>` : ''}`;
}

/** The main places as big tabs. `attr` is the data attribute the window wires (`data-ptab="market"`). */
export function railTabs(tabs: WinTab[], active: string, attr: string, cls = ''): string {
  return `<nav class="w-rail${cls ? ` ${cls}` : ''}" role="tablist">${tabs.map((t) => {
    const on = t.id === active;
    const hint = t.hint ?? t.label;
    return `<button type="button" class="w-tab${on ? ' on' : ''}${t.primary ? ' w-tab--go' : ''}" ${t.primary ? '' : `role="tab" aria-selected="${on}"`} data-${attr}="${esc(t.id)}" data-hint="${esc(hint)}" aria-label="${esc(t.label)}"${t.disabled ? ' disabled' : ''}>${tabInner(t, 'w-tab')}</button>`;
  }).join('')}</nav>`;
}

/** The second row: smaller chips for the rest (one lit, or several — a chart's layers). */
export function chipRow(items: WinTab[], active: string | readonly string[], attr: string): string {
  if (!items.length) return '';
  return `<div class="w-chips" role="tablist">${items.map((t) => {
    const on = typeof active === 'string' ? t.id === active : active.includes(t.id);
    return `<button type="button" class="w-chip${on ? ' on' : ''}" role="tab" aria-selected="${on}" data-${attr}="${esc(t.id)}" data-hint="${esc(t.hint ?? t.label)}"${t.disabled ? ' disabled' : ''}>${tabInner(t, 'w-chip')}</button>`;
  }).join('')}</div>`;
}

/** The window's band: its name (with a crest), a line under it on a desk, figures; a window with few places of its
 *  own puts its second row (chipRow's markup) in the band itself — one band less over the page on a phone. */
export function winHead(title: string, o: { crest?: string; figures?: string; sub?: string; id?: string; chips?: string } = {}): string {
  return `<header class="modal-head w-head${o.chips ? ' w-head--chips' : ''}"><h2${o.id ? ` id="${esc(o.id)}"` : ''} class="w-title">${o.crest ? icon(o.crest, '', 'w-crest') : ''}<span>${esc(title)}</span></h2>${o.chips ?? ''}${o.sub ? `<span class="w-sub">${esc(o.sub)}</span>` : ''}${o.figures ? `<div class="w-figs">${o.figures}</div>` : ''}</header>`;
}

/** A figure in the band: an icon and a number (the purse, the hold). */
export function figure(art: string, text: string, hint: string, cls = ''): string {
  return `<span class="w-fig${cls ? ` ${cls}` : ''}" data-hint="${esc(hint)}" title="${esc(hint)}">${icon(art, '', 'w-fig-ico')}<b>${esc(text)}</b></span>`;
}

export interface QuickBtn {
  label: string;
  /** What it costs or brings, small under the word («+1 240», «340»). */
  sub?: string;
  icon?: string;
  hint?: string;
  primary?: boolean;
  disabled?: boolean;
  data: Record<string, string | number>;
}

/** The window's one-tap actions, big, in one row. */
export function quickBar(btns: QuickBtn[], cls = ''): string {
  const live = btns.filter(Boolean);
  if (!live.length) return '';
  return `<div class="w-quick${cls ? ` ${cls}` : ''}">${live.map((b) => quickBtn(b)).join('')}</div>`;
}

export function quickBtn(b: QuickBtn): string {
  const data = Object.entries(b.data).map(([k, v]) => `data-${esc(k)}="${esc(v)}"`).join(' ');
  return `<button type="button" class="k-btn ${b.primary ? 'k-btn--primary' : 'k-btn--secondary'} k-btn--lg w-qbtn" ${data}${b.hint ? ` data-hint="${esc(b.hint)}"` : ''}${b.disabled ? ' disabled' : ''}>${b.icon ? icon(b.icon, '', 'k-btn-ico') : ''}<span class="w-qtext"><span class="k-btn-l">${esc(b.label)}</span>${b.sub ? `<small class="w-qsub">${b.sub}</small>` : ''}</span></button>`;
}

export interface WasRow {
  label: string;
  icon?: string;
  was: string | number;
  becomes: string | number;
  /** Whether the new value is better (green) — lower is better for some (a fee, a reload). */
  better?: boolean;
}

/** An upgrade: a picture, its name, rows of «было → стало», and one button. */
export function wasBecomes(o: { title: string; sub?: string; art?: string; rows: WasRow[]; button: QuickBtn; note?: string }): string {
  return `<div class="w-wb card">
    <div class="w-wb-h">${o.art ? `<span class="w-wb-art">${o.art}</span>` : ''}<span class="w-wb-t"><b>${esc(o.title)}</b>${o.sub ? `<small class="muted">${esc(o.sub)}</small>` : ''}</span></div>
    <div class="w-wb-rows">${o.rows.map((r) => `<div class="w-wb-row"><span class="w-wb-k">${r.icon ? icon(r.icon, '', 'ico-sm') : ''}${esc(r.label)}</span><span class="w-wb-was">${esc(r.was)}</span><span class="w-wb-arrow" aria-hidden="true">→</span><b class="w-wb-new${r.better === false ? ' worse' : r.better ? ' better' : ''}">${esc(r.becomes)}</b></div>`).join('')}</div>
    ${o.note ? `<p class="muted w-wb-note">${esc(o.note)}</p>` : ''}
    ${quickBtn(o.button)}
  </div>`;
}

/** A slider with its number shown big beside it. */
export function rangeHtml(o: { id: string; min: number; max: number; value: number; step?: number; label: string; unit?: string }): string {
  return `<label class="w-range"><span class="w-range-l">${esc(o.label)}</span><input type="range" id="${esc(o.id)}" min="${o.min}" max="${o.max}" step="${o.step ?? 1}" value="${o.value}" aria-label="${esc(o.label)}"><output for="${esc(o.id)}" class="w-range-v">${o.value}${o.unit ? ` <small>${esc(o.unit)}</small>` : ''}</output></label>`;
}

/** A section's heading inside a window body (one line, small caps), with an optional count. */
export function sec(title: string, count?: string): string {
  return `<h3 class="w-sec">${esc(title)}${count ? ` <span class="w-sec-n">${esc(count)}</span>` : ''}</h3>`;
}

/** A body that keeps more below a fold: «Подробнее» opens it. What is folded is not laid out at all (hidden), so
 *  nothing folded stands under a finger or a check. */
export function more(label: string, inner: string, key: string, open = false): string {
  if (!inner.trim()) return '';
  return `<div class="w-more${open ? ' open' : ''}" data-more="${esc(key)}"><button type="button" class="k-btn k-btn--secondary k-btn--md w-more-s" aria-expanded="${open}" data-fold>${esc(label)}</button><div class="w-more-b"${open ? '' : ' hidden'}>${inner}</div></div>`;
}

function setFold(f: HTMLElement, open: boolean): void {
  f.classList.toggle('open', open);
  f.querySelector(':scope > .w-more-s')?.setAttribute('aria-expanded', String(open));
  f.querySelector<HTMLElement>(':scope > .w-more-b')?.toggleAttribute('hidden', !open);
}

// One listener for every fold of every window.
globalThis.document?.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-fold]');
  const f = b?.closest<HTMLElement>('.w-more');
  if (f) setFold(f, !f.classList.contains('open'));
});

/** Which «Подробнее» folds were open, so a redraw keeps them (the server pushes a port's view every second). */
export function keepFolds(root: HTMLElement, render: () => void): void {
  const open = new Set([...root.querySelectorAll<HTMLElement>('.w-more.open[data-more]')].map((d) => d.dataset.more!));
  render();
  root.querySelectorAll<HTMLElement>('.w-more[data-more]').forEach((d) => {
    if (open.has(d.dataset.more!)) setFold(d, true);
  });
}
