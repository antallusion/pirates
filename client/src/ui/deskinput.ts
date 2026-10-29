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

/** A finger's tap on the sea (touch.ts SeaGesture: short and still, never a drag or a pinch). A ship or a creature
 *  stack under it is the target; a thing on the sea (a find, a wreck, a waystation, a quest's beacon) its own order;
 *  a harbour or an island its selection. Anything else — the open sea — is a course there: the helmsman takes her and
 *  the autopilot pill shows (owner, 2026-10-29: «поставить просто пальцем точку на карту и начать движение не
 *  получается» — the open sea's tap did nothing on a phone since the sail-to came in: only things sailed her). */
export function seaTapAct(f: { mark: boolean; thing: boolean; place: boolean; docked: boolean; modal: boolean }): 'sail' | null {
  if (f.docked || f.modal || f.mark || f.thing || f.place) return null;
  return 'sail';
}

/** A press that travelled this far (px) between down and up was a drag (the view panned), not a click. */
export const CLICK_SLOP = 10;

/** What a left click on the open sea does (nothing under it: no ship, stack, harbour, find). In the simple HUD — every
 *  desk's own — the helmsman takes her there, as the right button does without a mount (before, it did nothing at all
 *  on a PC: owner, 2026-10-26); in the detailed one it fires the side the cursor lies off, as it always did. A press
 *  that was dragged (the view panned), one under an open window, or docked: nothing. */
export function leftClickSea(f: { docked: boolean; simple: boolean; modal: boolean; moved: number }): 'sail' | 'fire' | null {
  if (f.docked || f.modal || f.moved > CLICK_SLOP) return null;
  return f.simple ? 'sail' : 'fire';
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

/** The sea's zoom for one wheel event. A mouse's notch (Chrome on Windows: deltaY 100 in pixels; Firefox: 3 lines) is
 *  one step, as before; a laptop's touchpad sends dozens of small deltas in one stroke (2–10 px each) and each of them
 *  was a whole step — one light stroke flung the view from the nearest to the farthest. Now the step goes by the
 *  distance the wheel moved, a notch at most at once. `step` the notch's factor (>1); returns the factor to multiply by. */
export function wheelZoom(deltaY: number, deltaMode: number, step: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const px = deltaMode === 1 ? (deltaY * 100) / 3 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const notches = Math.min(1, Math.abs(px) / 100);
  return Math.pow(px < 0 ? step : 1 / step, notches);
}

/** A key typed into a field (the chat, a price): no game's key. The mini-games' Space (the net's haul, the fish's line)
 *  took the chat's spaces while one was up. */
export function inField(e: { target: EventTarget | null }): boolean {
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || !!t.isContentEditable);
}

/** Whether a modifier's press, alone so far, may count as a tap of its own (Shift: the dash). Not with another modifier
 *  held: Alt+Shift and Ctrl+Shift switch a Windows keyboard's layout (every Russian player does it to write in the
 *  chat) — and each switch was a dash. `k` the modifier pressed (keyOf), `e` its event's modifier flags. */
export function soloModifier(k: string, e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
  const others = (e.altKey && k !== 'alt' ? 1 : 0) + (e.ctrlKey && k !== 'control' ? 1 : 0) + (e.metaKey ? 1 : 0) + (e.shiftKey && k !== 'shift' ? 1 : 0);
  return others === 0;
}

/** The keymap's actions that still act with a window open: the windows' own keys (one opens, or shuts, its window;
 *  the harbour's brings the port back) and the sound. Every ship's order — F (to sea / dock), the guns, the sails, the
 *  helm — waits until the window is shut (batch-pc, owner 2026-10-26: F undocked her under the settings). Esc is
 *  handled before the keymap. */
const WINDOW_KEYS = new Set(['map', 'journal', 'talents', 'ship', 'crew', 'company', 'help', 'harbour', 'mute', 'readAloud']);
export function keyActsInWindow(act: string): boolean {
  return WINDOW_KEYS.has(act);
}
