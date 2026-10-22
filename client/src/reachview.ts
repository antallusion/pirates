// The reach on the captain's screen (owner, 2026-10-22: «Взаимодействие с объектами и нпс надо делать на расстоянии 30
// метров … я не вижу ниче на карте, а уже могу брать абордаж, атаку»). Her hull and the others' as the server measures
// them (shared/src/data/reach.ts), the harbour's approach (shared/src/world/dock.ts), whether a thing is on her screen
// and out of the fog — the action bar offers a button only within reach of a thing she can see, and a short «ещё 12 м»
// when she is close but not yet there.

import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import type { Hull } from '../../shared/src/data/reach.ts';
import { underFog } from './render/fog.ts';

/** Her own hull now (null in port, or before her ship is known). */
export function ownHull(state: { ownDisplay: { x: number; y: number; heading: number } | null; ownStats: { length: number; beam: number } | null }): Hull | null {
  const o = state.ownDisplay, st = state.ownStats;
  if (!o || !st) return null;
  return { x: o.x, y: o.y, heading: o.heading, length: st.length, beam: st.beam };
}

/** Another ship's hull as her screen has it (its class's length and beam). */
export function viewHull(s: { cur: { x: number; y: number; h: number }; info: { classId: string } | null }): Hull | null {
  const cls = s.info ? SHIP_CLASSES[s.info.classId as keyof typeof SHIP_CLASSES] : undefined;
  if (!cls) return null;
  return { x: s.cur.x, y: s.cur.y, heading: s.cur.h, length: cls.length, beam: cls.beam };
}

/** The screen a thing must be on to be offered: the view's size and its camera (renderer.ts sx/sy). */
export interface ScreenView {
  w: number;
  h: number;
  sx(x: number): number;
  sy(y: number): number;
  zoom: number;
}

/** Whether a point (and `r` metres about it) shows on her screen, out of her fog of war. */
export function onScreen(view: ScreenView, seen: Uint8Array | null | undefined, x: number, y: number, r = 0): boolean {
  if (!view.w || !view.h) return true; // (no canvas yet: the tests, a hidden page — the server's reach still rules)
  const px = view.sx(x), py = view.sy(y), m = r * view.zoom;
  if (px < -m || py < -m || px > view.w + m || py > view.h + m) return false;
  return !underFog(seen, x, y);
}
