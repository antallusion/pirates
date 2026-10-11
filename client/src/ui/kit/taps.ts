// Taps that are never lost (ux2, owner 2026-10-11: «журнал иногда подзаедает и не переключает вкладки»).
//
// The root cause: a window is drawn anew as a whole (innerHTML) whenever the server says something it shows — the
// company's pages ask the server for their lists on every tab, and each answer (the group, the friends, who is at sea,
// the letters…) redraws the window; the private state's beat redraws the port, the talents and the rest. A finger that
// came down on a tab and lifted off it a moment later lifted off a *new* tab — the old one, where it came down, was gone
// from the page — and a browser fires a click only when the finger goes down and up on the same element: the tap did
// nothing. Two guards, for every window and tabbed sheet:
//  1. `holdRedraw()` — while a finger (or the mouse's button) is down on a window, its redraw waits; it is drawn the
//     moment after the tap's click (or the stroke's end), so the click lands on the element the finger saw.
//  2. `rescueTaps()` — a tap that still lost its element (a window that redraws itself on its own clock): on the
//     finger's lift, the element is found again in the page by what it was (its tab's data attribute and value) and
//     clicked once.
// And a long press on a tab shows its hint without swallowing the tap (hint.ts): a tab is a place, never an order.

/** A tab, a chip of the second row, an old window's tab: what a lost tap is looked for again by. */
export const TAB_SEL = '[role="tab"], .w-tab, .w-chip, .tab';

let down = 0;
let downAt = 0;
let pending: (() => void) | null = null;
let flushTimer = 0;

/** Whether a finger is down on a window now (a redraw would take the element from under it). */
export function pressing(): boolean {
  // (a press held over two seconds is a stroke, a scroll or a long press: the window may redraw under it)
  return down > 0 && performance.now() - downAt < 2000;
}

/** Runs `draw` now, or — a finger down on the window — once the tap is over (the last asked redraw only). */
export function holdRedraw(draw: () => void): void {
  if (!pressing()) {
    pending = null;
    draw();
    return;
  }
  pending = draw;
}

function flush(): void {
  clearTimeout(flushTimer);
  flushTimer = 0;
  const f = pending;
  pending = null;
  if (f && !pressing()) f();
}

/** Watches the presses on `roots` (the game's window and the kit's sheets): call once. */
export function installTapGuard(roots: () => HTMLElement[]): void {
  const inside = (t: EventTarget | null) => t instanceof Node && roots().some((r) => r.contains(t));
  addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || !inside(e.target)) return;
    down = 1;
    downAt = performance.now();
  }, true);
  const up = () => {
    if (!down) return;
    down = 0;
    // the click of a tap comes after the lift: the redraw waits for it (or for nothing, after a stroke)
    clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 400);
  };
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', up, true);
  // after the click's own handlers (a tab's switch draws its page itself; the held redraw then brings the news in)
  addEventListener('click', () => {
    if (pending) setTimeout(flush, 0);
  }, true);
}

/** A tap on a tab the browser gave no click to — its element drawn away between the finger's down and lift, or moved
 *  from under a still finger (the window still sliding up: a tap 40 ms after it opened landed beside the tab) — is given
 *  to the tab the finger came down on (or its new self), once. A finger that moved (a stroke) or stayed (900 ms) is no
 *  tap. A click that does come is never doubled: the rescue waits for it. */
export function rescueTaps(): void {
  let from: { el: HTMLElement; key: string; x: number; y: number; t: number; id: number } | null = null;
  let clicked = false;
  let lastKey = '';
  addEventListener('pointerdown', (e) => {
    clicked = false;
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(TAB_SEL);
    const key = el ? keyOf(el) : '';
    lastKey = key;
    from = el && key ? { el, key, x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
  }, true);
  // (a click on the common ancestor of a gone element and the new one is no click of the tab: only one on the tab itself)
  addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(TAB_SEL);
    if (el && keyOf(el) === lastKey) clicked = true;
  }, true);
  addEventListener('pointerup', (e) => {
    const f = from;
    from = null;
    if (!f || f.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - f.x, e.clientY - f.y) > 12 || performance.now() - f.t > 900) return;
    // after the browser's own click (it comes at once after the lift, or not at all): the tab, or its new self
    setTimeout(() => {
      if (clicked) return;
      const now = f.el.isConnected ? f.el : document.querySelector<HTMLElement>(f.key);
      if (now && !(now as HTMLButtonElement).disabled && now.getClientRects().length) now.click();
    }, 80);
  }, true);
}

/** A selector that finds an element again by its data attribute (`[data-jtab="company"]`), or '' when it has none. */
export function keyOf(el: HTMLElement): string {
  for (const a of Array.from(el.attributes)) {
    if (!a.name.startsWith('data-') || a.name === 'data-hint') continue;
    const v = a.value.replace(/["\\]/g, '\\$&');
    return `[${a.name}="${v}"]`;
  }
  return '';
}
