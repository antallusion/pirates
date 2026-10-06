// The kit's long-press hint (docs/23 item 76): a button says one or two words; what it does in a sentence is kept in
// its `data-hint` and shown while a finger rests on it (450 ms). The hint stands in the top band like a toast — never
// over the middle of the screen — and goes when the finger lifts; the tap a long press would end in is swallowed. A
// mouse reads the same words in the element's title (set where the markup is made).

import { esc } from '../dom.ts';

/** How long a finger rests before the hint shows. */
export const HINT_MS = 450;

let tip: HTMLElement | null = null;
let timer = 0;
let shownFor: Element | null = null;
let x0 = 0;
let y0 = 0;

function hide(): void {
  clearTimeout(timer);
  timer = 0;
  const t = tip;
  tip = null;
  if (!t) return;
  t.classList.remove('k-open');
  setTimeout(() => t.remove(), 160);
}

function show(el: HTMLElement): void {
  const text = el.dataset.hint;
  if (!text) return;
  // The same words as on the button are no hint at all.
  const own = (el.innerText || '').replace(/\s+/g, ' ').trim();
  if (own && own === text.trim()) return;
  hide();
  tip = document.createElement('div');
  tip.className = 'k-hint';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = esc(text);
  document.body.append(tip);
  requestAnimationFrame(() => tip?.classList.add('k-open'));
  shownFor = el;
  try { navigator.vibrate?.(10); } catch { /* not allowed */ }
}

/** Hints on every `[data-hint]` of the page (one listener; call once). */
export function wireHints(): void {
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-hint]');
    hide();
    shownFor = null;
    if (!el) return;
    x0 = e.clientX;
    y0 = e.clientY;
    timer = window.setTimeout(() => show(el), HINT_MS);
  }, true);
  addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) {
      clearTimeout(timer);
      timer = 0;
    }
  }, true);
  const up = () => {
    clearTimeout(timer);
    timer = 0;
    const t = tip;
    if (t) setTimeout(() => tip === t && hide(), 1200);
  };
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', up, true);
  // A long press is a question, not an order: the click it ends in does nothing.
  addEventListener('click', (e) => {
    if (!shownFor) return;
    const el = (e.target as HTMLElement | null)?.closest?.('[data-hint]');
    if (el === shownFor) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    shownFor = null;
  }, true);
  addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement | null)?.closest?.('[data-hint]')) e.preventDefault();
  });
}
