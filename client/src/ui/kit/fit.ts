// The phone fit's pager (docs/23, owner 2026-10-10: «должно помещаться без прокрутов всяких»). On a phone held
// sideways (a screen 520 px tall or less) a window's page that would scroll is laid out in pages side by side instead
// — CSS columns as wide as the page, in client/fit.css — and a «‹ 1/3 ›» bar under it turns them (a tap, a swipe, the
// wheel). Nothing scrolls; every window stays the height of the screen. The windows themselves are not touched: the
// pager watches the panes they draw (PAGED) and follows their redraws, keeping the page she was on.

/** The panes that turn into pages when they would scroll: a window's page, a sheet's, and the inner lists a window
 *  keeps beside a part that stays (the talents' tree beside the rose). */
export const PAGED = [
  '#modal-panel .modal-body',
  '#modal-panel #company-body',
  '.k-sheet-root .k-sheet-body',
  '#modal-panel[data-modal="talents"] .tal-main',
].join(', ');
/** A phone held sideways (the stylesheets' own breakpoint). */
export const PHONE = '(max-height: 520px)';

/** How many pages a pane of `scrollW` px holds when one page steps `step` px (the last may be part-filled). */
export function pageCount(scrollW: number, step: number): number {
  if (step <= 0) return 1;
  return Math.max(1, Math.ceil((scrollW - 2) / step));
}

/** The page a pane scrolled by `left` px shows (snapped to the nearest), within 0…n-1. */
export function pageAt(left: number, step: number, n: number): number {
  if (step <= 0) return 0;
  return Math.min(Math.max(0, Math.round(left / step)), Math.max(0, n - 1));
}

/** The page a swipe of dx, dy px turns to: a mostly sideways stroke of 40 px or more, else none (null). */
export function swipeTo(page: number, n: number, dx: number, dy: number): number | null {
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
  const to = page + (dx < 0 ? 1 : -1);
  return to < 0 || to >= n ? null : to;
}

interface Pane { el: HTMLElement; bar: HTMLElement | null; page: number; n: number; key: string }

const panes = new Map<HTMLElement, Pane>();
const wired = new WeakSet<HTMLElement>();
/** The page she was on, by window and place, so a redraw (the window's own innerHTML) keeps it. */
const kept = new Map<string, number>();

function keyOf(el: HTMLElement): string {
  const win = el.closest<HTMLElement>('#modal-panel')?.dataset.modal ?? el.closest('.k-sheet')?.className ?? '';
  const on = el.closest('#modal-panel, .k-sheet')?.querySelector('.w-tab.on, .w-chip.on, .tab.active, .tab.on, [aria-selected="true"]')?.textContent ?? '';
  return `${win}|${el.dataset.page ?? ''}|${on.trim().slice(0, 24)}`;
}

function shown(el: HTMLElement): boolean {
  return el.isConnected && el.getClientRects().length > 0 && el.clientHeight > 0;
}

function step(el: HTMLElement): number {
  return el.clientWidth;
}

function drawBar(p: Pane): void {
  if (p.n <= 1) {
    p.bar?.remove();
    p.bar = null;
    return;
  }
  if (!p.bar || !p.bar.isConnected) {
    p.bar = document.createElement('div');
    p.bar.className = 'fit-pager';
    p.bar.setAttribute('role', 'navigation');
    p.bar.innerHTML = '<button type="button" class="fit-pg-b" data-fitpg="-1" aria-label="‹">‹</button><span class="fit-pg-n" aria-live="polite"></span><button type="button" class="fit-pg-b" data-fitpg="1" aria-label="›">›</button>';
    p.bar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-fitpg]');
      if (b) turn(p, p.page + Number(b.dataset.fitpg));
    });
    p.el.after(p.bar);
  }
  p.bar.querySelector('.fit-pg-n')!.textContent = `${p.page + 1}/${p.n}`;
  (p.bar.querySelector('[data-fitpg="-1"]') as HTMLButtonElement).disabled = p.page <= 0;
  (p.bar.querySelector('[data-fitpg="1"]') as HTMLButtonElement).disabled = p.page >= p.n - 1;
}

function turn(p: Pane, to: number): void {
  p.page = Math.min(Math.max(0, to), p.n - 1);
  kept.set(p.key, p.page);
  p.el.scrollLeft = p.page * step(p.el);
  drawBar(p);
}

function unpage(el: HTMLElement): void {
  const p = panes.get(el);
  el.classList.remove('fit-paged', 'fit-flow');
  el.style.removeProperty('--fit-cols');
  delete el.dataset.fitGrid;
  el.style.removeProperty('--fit-gap');
  el.scrollLeft = 0;
  p?.bar?.remove();
  panes.delete(el);
}

/** Lay out one pane: pages when it would scroll on a phone, as it was otherwise. */
function fit(el: HTMLElement, phone: boolean): void {
  if (!phone || !shown(el)) {
    if (panes.has(el) || el.classList.contains('fit-paged')) unpage(el);
    return;
  }
  let p = panes.get(el);
  if (!p) {
    // Would it scroll as it is?
    if (el.scrollHeight <= el.clientHeight + 2) return;
    p = { el, bar: null, page: 0, n: 1, key: keyOf(el) };
    panes.set(el, p);
    flow(el);
    el.classList.add('fit-paged');
    if (!wired.has(el)) { wired.add(el); wire(p); }
  }
  p.key = keyOf(el);
  const cols = String(pageCols(el.clientWidth, Number(el.dataset.fitGrid ?? 1), getComputedStyle(el).getPropertyValue('--fit-two').trim() === '1'));
  if (el.style.getPropertyValue('--fit-cols') !== cols) el.style.setProperty('--fit-cols', cols);
  p.n = pageCount(el.scrollWidth, step(el));
  // One page: no bar. Back to the plain pane only if that would not scroll (a few px of margin overflow a plain pane
  // and not a column).
  if (p.n <= 1) {
    const cls = [...el.classList].filter((c) => c === 'fit-paged' || c === 'fit-flow');
    el.classList.remove(...cls);
    const plainFits = el.scrollHeight <= el.clientHeight + 2;
    if (plainFits) { el.classList.add(...cls); unpage(el); return; }
    el.classList.add(...cls);
    p.page = 0;
    el.scrollLeft = 0;
    drawBar(p);
    return;
  }
  p.page = Math.min(kept.get(p.key) ?? p.page, p.n - 1);
  el.scrollLeft = p.page * step(el);
  drawBar(p);
  // the bar took its height from the pane: count again
  const n2 = pageCount(el.scrollWidth, step(el));
  if (n2 !== p.n) { p.n = n2; p.page = Math.min(p.page, n2 - 1); el.scrollLeft = p.page * step(el); drawBar(p); }
}

/** Columns only lay out a block: a grid or a flex pane becomes one, its grid's tracks the page's columns (a grid of
 *  three cards reads as three columns a page) and its gap the space between its parts. */
export function gridCols(template: string): number {
  const n = template.trim() && template !== 'none' ? template.trim().split(/\s+(?![^(]*\))/).length : 1;
  return Math.max(1, Math.min(3, n));
}
function flow(el: HTMLElement): void {
  const cs = getComputedStyle(el);
  el.dataset.fitGrid = String(cs.display.includes('grid') ? gridCols(cs.gridTemplateColumns) : 1);
  if (cs.display === 'block' || cs.display === 'flow-root') return;
  el.style.setProperty('--fit-gap', cs.rowGap === 'normal' ? '0px' : cs.rowGap);
  el.classList.add('fit-flow');
}

/** Columns a page: a grid's own tracks; else two where the stylesheet allows it (--fit-two: 1 — lists of short
 *  rows and cards, where a tall stack reads better across the landscape) on a pane wide enough for two readable
 *  columns; else one. */
export function pageCols(paneWidth: number, grid: number, two: boolean): number {
  if (grid > 1) return grid;
  return two && paneWidth >= 520 ? 2 : 1;
}

function wire(p0: Pane): void {
  const el = p0.el;
  // (the pane may be laid out afresh later: the handlers take its current state)
  const cur = () => panes.get(el);
  let x0 = 0, y0 = 0, down = false;
  el.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; y0 = e.clientY; }, { passive: true });
  el.addEventListener('pointerup', (e) => {
    const p = cur();
    if (!down || !p) return;
    down = false;
    if ((e.target as HTMLElement).closest('input, textarea, select, canvas')) return;
    const to = swipeTo(p.page, p.n, e.clientX - x0, e.clientY - y0);
    if (to !== null) turn(p, to);
  }, { passive: true });
  el.addEventListener('pointercancel', () => (down = false), { passive: true });
  let wheelAt = 0;
  el.addEventListener('wheel', (e) => {
    const p = cur();
    if (!p || p.n <= 1 || Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 280) return;
    wheelAt = now;
    turn(p, p.page + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  // Focus or a script that scrolled the pane (a field brought into view): settle on the page it shows.
  el.addEventListener('scroll', () => {
    const p = cur();
    if (!p) return;
    const s = step(el);
    const at = pageAt(el.scrollLeft, s, p.n);
    if (el.scrollLeft !== at * s || at !== p.page) { p.page = at; kept.set(p.key, at); el.scrollLeft = at * s; drawBar(p); }
  }, { passive: true });
}

let queued = false;
function sweep(): void {
  queued = false;
  const phone = matchMedia(PHONE).matches;
  for (const el of [...panes.keys()]) if (!el.isConnected) { panes.get(el)?.bar?.remove(); panes.delete(el); }
  for (const el of document.querySelectorAll<HTMLElement>(PAGED)) fit(el, phone);
}

/** Watch the windows and the sheets: called once at start (main.ts). */
export function installPager(): void {
  if (typeof MutationObserver === 'undefined') return;
  // A redraw is laid out at once — before the frame is painted, so the page she is on never flickers to the first.
  // Only the windows and the sheets are watched (the sea's HUD changes many times a second and is none of this).
  const mo = new MutationObserver((recs) => {
    if (recs.every((r) => (r.target as HTMLElement).closest?.('.fit-pager, #modal-toasts'))) return;
    sweep();
    // what the sweep itself changed (a pane's class, its bar) is not a redraw to answer
    mo.takeRecords();
  });
  const watch = (el: Element) => mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
  const modal = document.getElementById('modal');
  if (modal) watch(modal);
  document.querySelectorAll('.k-sheet-root').forEach(watch);
  new MutationObserver((recs) => {
    for (const r of recs) r.addedNodes.forEach((n) => { if (n instanceof HTMLElement && n.classList.contains('k-sheet-root')) { watch(n); sweep(); } });
  }).observe(document.body, { childList: true });
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(sweep); } };
  addEventListener('resize', later);
  matchMedia(PHONE).addEventListener?.('change', later);
  document.fonts?.ready.then(later).catch(() => undefined);
  // Pictures that load late make a page taller.
  document.addEventListener('load', later, true);
}
