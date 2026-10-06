// The kit's modal layers (a sheet, a question, the risk window): one stack. The top one owns the keyboard — Tab
// cycles inside it, Esc steps back, Enter takes its default — and no other key reaches the game while it is up.
// Focus goes back where it was when it closes.

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface Layer {
  root: HTMLElement;
  /** Esc (and the sheet's swipe, a tap beside it). */
  onEscape?: () => void;
  /** Enter outside a field. */
  onEnter?: () => void;
}

const stack: { layer: Layer; back: Element | null }[] = [];

/** The element of a list that Tab lands on next (wrapping), pure for the tests. */
export function nextFocus<T>(list: T[], current: T | null, backwards: boolean): T | null {
  if (!list.length) return null;
  const i = current === null ? -1 : list.indexOf(current);
  if (i < 0) return backwards ? list[list.length - 1] : list[0];
  return list[(i + (backwards ? -1 : 1) + list.length) % list.length];
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.getClientRects().length > 0 && !e.closest('[inert], .hidden'));
}

function onKey(e: KeyboardEvent): void {
  const top = stack.at(-1)?.layer;
  if (!top) return;
  if (e.key === 'Tab') {
    const list = focusables(top.root);
    const next = nextFocus(list, document.activeElement as HTMLElement | null, e.shiftKey);
    if (next) {
      e.preventDefault();
      next.focus({ preventScroll: true });
    }
    e.stopImmediatePropagation();
    return;
  }
  e.stopImmediatePropagation();
  const field = (e.target as HTMLElement | null)?.closest?.('input, textarea, select');
  if (e.key === 'Escape') {
    e.preventDefault();
    top.onEscape?.();
  } else if (e.key === 'Enter' && !field && top.onEnter && !(e.target as HTMLElement | null)?.closest?.('button')) {
    e.preventDefault();
    top.onEnter();
  }
}

/** Put a layer on top: it takes the keyboard and the focus (its `[data-autofocus]`, else its first control). */
export function pushLayer(layer: Layer): void {
  if (!stack.length) addEventListener('keydown', onKey, true);
  stack.push({ layer, back: document.activeElement });
  const first = layer.root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(layer.root)[0];
  first?.focus({ preventScroll: true });
}

/** Take a layer off (wherever it is in the stack); the focus goes back where it was before it. */
export function popLayer(layer: Layer): void {
  const i = stack.findIndex((s) => s.layer === layer);
  if (i < 0) return;
  const [{ back }] = stack.splice(i, 1);
  if (!stack.length) removeEventListener('keydown', onKey, true);
  if (i === stack.length && back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
}

/** Whether a kit layer is up (the game's own keys wait). */
export function layerOpen(): boolean {
  return stack.length > 0;
}
