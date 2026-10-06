// The kit's button (docs/23 item 9): three kinds and one height per kind.
//   primary   — the one main thing on a screen: gold on dark wood, 52 px on a phone;
//   secondary — the rest: brass frame, 44 px on a phone;
//   icon      — a round button with a picture and no word (its name is spoken by aria-label), 44 or 52 px.
// States: pressed (scales to 0.96 in 120 ms), focus ring (keyboard only), disabled, busy, toggled (aria-pressed),
// a count on a corner, and a short flash for «not now» instead of a line of text (docs/23 item 29).
// Markup comes as a string (the screens build their panels as markup) or as an element.

import { esc, icon } from '../dom.ts';

export type ButtonKind = 'primary' | 'secondary' | 'icon';
export type ButtonSize = 'md' | 'lg';

export interface ButtonOpts {
  kind?: ButtonKind;
  /** md = 44 px on a phone, lg = 52 px; a primary is lg unless asked otherwise. */
  size?: ButtonSize;
  label?: string;
  /** An art id for icon() (`fire`, `ammo_round`, `menu_map`…) and the glyph shown while it loads. */
  icon?: string;
  glyph?: string;
  /** The accessible name; required for an icon button (it has no words of its own). */
  aria?: string;
  title?: string;
  disabled?: boolean;
  busy?: boolean;
  pressed?: boolean;
  /** A count on the corner (a counter icon); 0 or less shows none. */
  badge?: number;
  /** Extra classes and data-* attributes (the screens' own hooks: data-act, data-tab…). */
  cls?: string;
  data?: Record<string, string | number>;
  id?: string;
  type?: 'button' | 'submit';
}

/** A count for a badge: up to 9, then «9+» (it must fit a corner). */
export function badgeText(n: number): string {
  return n <= 0 ? '' : n > 9 ? '9+' : String(Math.floor(n));
}

export function buttonClass(o: ButtonOpts): string {
  const kind = o.kind ?? 'secondary';
  const size = o.size ?? (kind === 'primary' ? 'lg' : 'md');
  return ['k-btn', `k-btn--${kind}`, `k-btn--${size}`, o.cls ?? ''].filter(Boolean).join(' ');
}

export function buttonHtml(o: ButtonOpts): string {
  const kind = o.kind ?? 'secondary';
  if (kind === 'icon' && !o.aria && !o.label) throw new Error('an icon button needs a name (aria)');
  const attrs: string[] = [`type="${o.type ?? 'button'}"`, `class="${esc(buttonClass(o))}"`];
  if (o.id) attrs.push(`id="${esc(o.id)}"`);
  const name = o.aria ?? (kind === 'icon' ? o.label : undefined);
  if (name) attrs.push(`aria-label="${esc(name)}"`);
  if (o.title ?? name) attrs.push(`title="${esc(o.title ?? name)}"`);
  if (o.disabled) attrs.push('disabled');
  if (o.busy) attrs.push('aria-busy="true"');
  if (o.pressed !== undefined) attrs.push(`aria-pressed="${o.pressed}"`);
  for (const [k, v] of Object.entries(o.data ?? {})) attrs.push(`data-${esc(k)}="${esc(v)}"`);
  const pic = o.icon ? icon(o.icon, o.glyph ?? '', 'k-btn-ico') : o.glyph ? `<span class="k-btn-ico glyph" aria-hidden="true">${esc(o.glyph)}</span>` : '';
  const word = kind !== 'icon' && o.label ? `<span class="k-btn-l">${esc(o.label)}</span>` : '';
  const badge = badgeText(o.badge ?? 0);
  return `<button ${attrs.join(' ')}>${pic}${word}${badge ? `<b class="k-badge" aria-hidden="true">${badge}</b>` : ''}</button>`;
}

/** The same as an element, ready to wire. */
export function makeButton(o: ButtonOpts, onClick?: (e: MouseEvent) => void): HTMLButtonElement {
  const t = document.createElement('template');
  t.innerHTML = buttonHtml(o);
  const b = t.content.firstElementChild as HTMLButtonElement;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Update a button's count in place. */
export function setBadge(b: HTMLElement, n: number): void {
  const text = badgeText(n);
  let el = b.querySelector<HTMLElement>('.k-badge');
  if (!text) return el?.remove();
  if (!el) {
    el = document.createElement('b');
    el.className = 'k-badge';
    el.setAttribute('aria-hidden', 'true');
    b.append(el);
  }
  el.textContent = text;
}

/** «Not now»: the button flashes and the phone gives a short buzz, instead of a toast (no ammunition, reloading). */
export function flash(b: HTMLElement, buzz = true): void {
  b.classList.remove('k-flash');
  void b.offsetWidth; // restart the animation
  b.classList.add('k-flash');
  setTimeout(() => b.classList.remove('k-flash'), 420);
  if (buzz) try { navigator.vibrate?.(30); } catch { /* not allowed before a touch */ }
}
