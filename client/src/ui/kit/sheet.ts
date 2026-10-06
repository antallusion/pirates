// The kit's bottom sheet (docs/23 item 10), in place of windows over the whole screen: it comes up from the bottom
// edge to 60–90% of the height (or its content's height, for a question), with a grip on top. Drag it down past a
// quarter of its height — or flick it — and it goes; Esc or a tap beside it does the same. While it is up the
// keyboard stays in it (layer.ts) and the sea's keys wait. One sheet over another is allowed (the risk window over a
// card); the top one owns the keys.

import { dict } from '../../i18n.ts';
import { EN, RU } from '../../lang/ui/kit.ts';
import { esc } from '../dom.ts';
import { popLayer, pushLayer } from './layer.ts';
import type { Layer } from './layer.ts';
import { dur } from './tokens.ts';

const L = dict(EN, RU);

/** How tall a sheet stands: a share of the screen (clamped to 60–90%), or its content's height (≤ 90%). */
export type SheetHeight = number | 'auto';

export function sheetHeight(h: SheetHeight | undefined): string {
  if (h === 'auto') return 'auto';
  const f = Math.max(0.6, Math.min(0.9, h ?? 0.75));
  return `${Math.round(f * 100)}dvh`;
}

/** A drag let go: does the sheet go (past a quarter of its height, or flicked down faster than 0.6 px/ms), or come
 *  back? A drag up never closes it. */
export function dragCloses(dy: number, vy: number, height: number): boolean {
  if (dy <= 0) return false;
  return dy > Math.min(140, height * 0.25) || (vy > 0.6 && dy > 16);
}

/** How far the sheet follows the finger: one to one down, a little resistance up (it is already as high as it goes). */
export function dragFollow(dy: number): number {
  return dy >= 0 ? dy : -Math.min(16, Math.sqrt(-dy) * 2);
}

export type CloseWhy = 'esc' | 'swipe' | 'scrim' | 'button' | 'code';

export interface SheetOpts {
  title?: string;
  /** Markup (the caller escapes it) or an element. */
  body: string | HTMLElement;
  /** Buttons along the bottom (kit buttons' markup); '' makes an empty foot the caller fills later. */
  foot?: string;
  /** The id of the heading inside the body that names the sheet (when it has no title of its own). */
  labelledBy?: string;
  height?: SheetHeight;
  /** The root's id (`confirm` for the game's questions, which other code looks up). */
  id?: string;
  cls?: string;
  /** A sheet that must be answered: no swipe, no tap beside it (Esc still answers «no» through onClose). */
  modal?: boolean;
  role?: 'dialog' | 'alertdialog';
  onClose?: (why: CloseWhy) => void;
  onEnter?: () => void;
  /** No close button in the head (a question has its own buttons). */
  noClose?: boolean;
}

export interface SheetHandle {
  root: HTMLElement;
  panel: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement | null;
  close: (why?: CloseWhy) => void;
  readonly open: boolean;
}

let seq = 0;

export function openSheet(o: SheetOpts): SheetHandle {
  const root = document.createElement('div');
  root.className = 'k-sheet-root';
  if (o.id) root.id = o.id;
  const titleId = `k-sheet-t${++seq}`;
  root.innerHTML = `<div class="k-scrim"></div>
    <section class="k-sheet panel${o.cls ? ` ${o.cls}` : ''}${o.height === 'auto' ? ' k-sheet--auto' : ''}" role="${o.role ?? 'dialog'}" aria-modal="true"${o.title ? ` aria-labelledby="${titleId}"` : o.labelledBy ? ` aria-labelledby="${esc(o.labelledBy)}"` : ''}>
      <div class="k-sheet-grip" title="${esc(L('sheet.grip'))}"><i aria-hidden="true"></i></div>
      ${o.title || !o.noClose ? `<header class="k-sheet-head">${o.title ? `<h2 id="${titleId}" class="k-sheet-title">${esc(o.title)}</h2>` : '<span></span>'}${o.noClose ? '' : `<button type="button" class="k-btn k-btn--icon k-btn--md k-sheet-x" aria-label="${esc(L('close'))}" title="${esc(L('close'))}"><span aria-hidden="true">✕</span></button>`}</header>` : ''}
      <div class="k-sheet-body"></div>
      ${o.foot !== undefined ? `<footer class="k-sheet-foot">${o.foot}</footer>` : ''}
    </section>`;
  const panel = root.querySelector<HTMLElement>('.k-sheet')!;
  panel.style.height = sheetHeight(o.height);
  const body = root.querySelector<HTMLElement>('.k-sheet-body')!;
  if (typeof o.body === 'string') body.innerHTML = o.body;
  else body.append(o.body);
  let open = true;
  const close = (why: CloseWhy = 'code') => {
    if (!open) return;
    open = false;
    popLayer(layer);
    // Out of the way at once (a new question looks its buttons up by id), gone once it has slid down.
    root.removeAttribute('id');
    root.classList.remove('k-open');
    root.classList.add('k-closing');
    panel.style.transform = ''; // a swiped sheet slides on down from where the finger left it
    setTimeout(() => root.remove(), dur('base'));
    o.onClose?.(why);
  };
  const layer: Layer = { root: panel, onEscape: () => close('esc'), onEnter: o.onEnter };
  root.querySelector('.k-scrim')!.addEventListener('click', () => !o.modal && close('scrim'));
  root.querySelector('.k-sheet-x')?.addEventListener('click', () => close('button'));
  if (!o.modal) wireSwipe(panel, () => close('swipe'));
  document.body.append(root);
  // Up from the bottom edge on the next frame (the closed state is the stylesheet's start).
  requestAnimationFrame(() => open && root.classList.add('k-open'));
  pushLayer(layer);
  return { root, panel, body, foot: root.querySelector<HTMLElement>('.k-sheet-foot'), close, get open() { return open; } };
}

/** The grip and the head drag the sheet; a list inside it still scrolls (a drag starts there only from its top). */
function wireSwipe(panel: HTMLElement, done: () => void): void {
  let y0 = 0, dy = 0, id: number | null = null, lastY = 0, lastT = 0, vy = 0;
  panel.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, select, textarea, [data-no-swipe]')) return;
    const body = t.closest<HTMLElement>('.k-sheet-body');
    if (body && body.scrollTop > 0) return;
    if (!t.closest('.k-sheet-grip, .k-sheet-head') && !body) return;
    id = e.pointerId;
    y0 = lastY = e.clientY;
    lastT = performance.now();
    dy = vy = 0;
  });
  panel.addEventListener('pointermove', (e) => {
    if (id !== e.pointerId) return;
    dy = e.clientY - y0;
    if (Math.abs(dy) > 6 && !panel.hasPointerCapture(e.pointerId)) {
      panel.setPointerCapture(e.pointerId);
      panel.classList.add('k-dragging');
    }
    const now = performance.now();
    if (now - lastT > 0) vy = (e.clientY - lastY) / (now - lastT);
    lastY = e.clientY;
    lastT = now;
    if (panel.classList.contains('k-dragging')) panel.style.transform = `translateY(${dragFollow(dy)}px)`;
  });
  const end = (e: PointerEvent) => {
    if (id !== e.pointerId) return;
    id = null;
    const dragged = panel.classList.contains('k-dragging');
    panel.classList.remove('k-dragging');
    if (!dragged) return;
    if (dragCloses(dy, vy, panel.getBoundingClientRect().height)) done();
    else panel.style.transform = '';
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
}
