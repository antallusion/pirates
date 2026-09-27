// Tiny DOM helpers. All server-provided strings are escaped before being placed in markup.

import { assetUrl } from '../assets.ts';
import { lang } from '../i18n.ts';

export function $(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** A whole number the reader's way: 410,485 in English, 410 485 (a space that does not break) in Russian. */
export function fmt(n: number): string {
  return lang() === 'ru' ? Math.round(n).toLocaleString('en-US').replace(/,/g, '\u00a0') : Math.round(n).toLocaleString('en-US');
}

/** A number with one decimal: 2.5 in English, 2,5 in Russian. */
export function dec1(n: number): string {
  const s = n.toFixed(1);
  return lang() === 'ru' ? s.replace('.', ',') : s;
}

/** A number with two decimals (a multiplier): 1.40 in English, 1,40 in Russian. */
export function dec2(n: number): string {
  const s = n.toFixed(2);
  return lang() === 'ru' ? s.replace('.', ',') : s;
}

export function pct(v: number): string {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

export function bar(cls: string, frac: number): string {
  return `<div class="bar ${cls}"><i style="width:${pct(frac)}"></i></div>`;
}

export function knots(ms: number): string {
  // Game meters/second → displayed knots on the compressed world scale.
  return dec1(ms * 0.8);
}

/** Re-renders a panel without losing what the player is typing: values and focus survive by id or data key. */
export function keepInputs(root: HTMLElement, render: () => void): void {
  const key = (el: Element) => el.id || [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-dirty').map((a) => `${a.name}=${a.value}`).join('&');
  const saved = new Map<string, string>();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && el.dataset.dirty) saved.set(k, el.value);
  });
  const active = document.activeElement && root.contains(document.activeElement) ? key(document.activeElement) : '';
  render();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && saved.has(k)) {
      el.value = saved.get(k)!;
      el.dataset.dirty = '1';
      el.dispatchEvent(new Event('change'));
    }
    el.addEventListener('input', () => (el.dataset.dirty = '1'));
    el.addEventListener('change', () => (el.dataset.dirty = '1'));
    if (active && k === active) el.focus();
  });
}

/**
 * An icon from the art registry (`icon.<id>` by default), or the text glyph when the art has not loaded.
 * `cls` sizes it (`ico` inline with text, `ico-lg` in slots and tiles).
 */
export function icon(id: string, glyph = '', cls = 'ico'): string {
  const url = assetUrl(id.includes('.') ? id : `icon.${id}`);
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false" />` : glyph ? `<span class="${cls} glyph">${esc(glyph)}</span>` : '';
}

/** An officer's face: the unique officers have portraits, the rest the mark of their post. */
export function officerIcon(o: { role: string; unique?: string }, cls = 'ico-md'): string {
  return (o.unique ? icon(`portrait.officer_${o.unique}`, '', `${cls} ico-round`) : '') || icon(`role_${o.role}`, '', cls);
}

/** Silver as the game shows it everywhere: the coin and the sum. */
export function money(n: number): string {
  const sum = Number.isInteger(n) || Math.abs(n) >= 100 ? fmt(n) : dec1(n).replace(/[.,]0$/, '');
  return `<span class="money">${icon('coin', '⛁', 'ico-sm')}${sum}</span>`;
}

/** Experience: the navigator's star and the sum. */
export function xpBadge(n: number): string {
  return `<span class="xpv">${icon('xp', '✦', 'ico-sm')}${fmt(n)}</span>`;
}

const SUM = /(\d[\d,.  ]*\d|\d)\s*(серебра|серебро|серебром|silver)/gi;
const XP = /(\d[\d,.  ]*\d|\d)\s*(опыта|XP)/g;

/**
 * Every "N silver" and "N XP" written anywhere in a screen becomes the coin or the star with the sum — server
 * sentences, prices on buttons, letters — without each screen having to say so. Idempotent: a sum it has dressed
 * no longer matches.
 */
export function decorateSums(root: HTMLElement): void {
  const coin = assetUrl('icon.coin'), star = assetUrl('icon.xp');
  if (!coin || !star) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/серебр|silver|опыта|XP/i.test(n.nodeValue ?? '')) hits.push(n as Text);
  for (const t of hits) {
    if (t.parentElement?.closest('input, textarea, select, option, script, style, title')) continue;
    const plain = esc(t.nodeValue);
    const html = plain
      .replace(SUM, `<span class="money"><img class="ico-sm" src="${coin}" alt="" draggable="false">$1</span>`)
      .replace(XP, `<span class="xpv"><img class="ico-sm" src="${star}" alt="" draggable="false">$1</span>`);
    if (html === plain) continue;
    const box = document.createElement('span');
    box.innerHTML = html;
    t.replaceWith(...box.childNodes);
  }
}

/** Words in the language's own quotation marks: «Последний залп», “Last Broadside” (escaped). */
export function quote(s: string): string {
  return lang() === 'ru' ? `«${esc(s)}»` : `“${esc(s)}”`;
}
