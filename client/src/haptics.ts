// The phone in the hand (docs/23 item 84): short pulses of the Vibration API on her own broadside, on a ball that
// lands (hers on her mark a tick, theirs on her hull a knock) and on the grapples biting. Short — the longest pattern
// is under a fifth of a second — spaced out so a battery of balls is one knock and not a buzz, and off with the
// options' «Вибрация». A desktop (no `navigator.vibrate`) never notices.

import { settings } from './settings.ts';

export type Buzz = 'fire' | 'hit' | 'hurt' | 'board';

/** Each pulse in milliseconds (pause, pulse… for the patterns). */
export const BUZZ: Record<Buzz, number | number[]> = {
  fire: 18,
  hit: 8,
  hurt: 32,
  board: [40, 50, 60],
};

/** The least time between two pulses of a kind (ms): a broadside's eight balls landing are one knock. */
export const BUZZ_GAP: Record<Buzz, number> = { fire: 250, hit: 160, hurt: 220, board: 1500 };

const last: Record<Buzz, number> = { fire: -1e9, hit: -1e9, hurt: -1e9, board: -1e9 };

/** Whether a pulse of `kind` may go at `now` (ms): the option on and the kind's gap passed. Pure but for the clock. */
export function mayBuzz(kind: Buzz, now: number, on: boolean, lastAt: number): boolean {
  return on && now - lastAt >= BUZZ_GAP[kind];
}

export function buzz(kind: Buzz): void {
  const now = performance.now();
  if (!mayBuzz(kind, now, settings().vibrate, last[kind])) return;
  last[kind] = now;
  // A fresh hit outranks the light ones: no tick on top of the knock.
  if (kind === 'hurt') last.hit = now;
  try {
    navigator.vibrate?.(BUZZ[kind]);
  } catch {
    /* not allowed before the first touch, or no motor */
  }
}

/** Every other pulse in the game (a refused tap's flash, the wheel's tick, the stick's dash) obeys the same option:
 *  `navigator.vibrate` is wrapped once, at start, to stay still when «Вибрация» is off. */
export function guardVibrate(): void {
  const nav = globalThis.navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean };
  if (!nav?.vibrate || (nav.vibrate as { guarded?: boolean }).guarded) return;
  const raw = nav.vibrate.bind(nav);
  const guarded = ((p: VibratePattern) => (settings().vibrate ? raw(p) : false)) as ((p: VibratePattern) => boolean) & { guarded?: boolean };
  guarded.guarded = true;
  try {
    Object.defineProperty(nav, 'vibrate', { value: guarded, configurable: true });
  } catch {
    /* a locked navigator: the game's own pulses still obey */
  }
}
