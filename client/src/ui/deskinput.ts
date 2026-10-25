// The desk's mouse and keys (batch-pc, 2026-10-26; owner: «все чини, все делай идеально… невозможно играть»): the
// choices a mouse press or a key makes on a Windows desk, pure and tested (tests/deskinput.test.ts).

import { nextFocus } from './kit/layer.ts';

/** What the right button does on the sea. With a deck mount fitted it fires the mount at the cursor (as it always did);
 *  without one — most captains, the first hours whole — it sails her there by the helmsman, as a right click does in
 *  every game of the kind, instead of «Палубная установка не стоит» at every press. Docked, nothing. */
export function rightClickAct(f: { docked: boolean; mount: boolean }): 'mount' | 'sail' | null {
  if (f.docked) return null;
  return f.mount ? 'mount' : 'sail';
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab in an open window walks its own controls, round and round (a focus trap), as the kit's sheets do (kit/layer.ts):
 *  before, Tab was the sea's «next target» even over a window — the keyboard could never reach a window's field or
 *  button, and from a field it walked out onto the HUD behind. Returns the control focused, or null (nothing to walk). */
export function windowTab(root: HTMLElement | null, backwards: boolean): HTMLElement | null {
  if (!root) return null;
  const list = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.getClientRects().length > 0 && !e.closest('[inert], .hidden'));
  const next = nextFocus(list, document.activeElement as HTMLElement | null, backwards);
  next?.focus({ preventScroll: false });
  return next;
}
