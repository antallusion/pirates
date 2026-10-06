// The kit's numbers for code (docs/23 items 8 and 16): what a script needs to time or size — the three durations, the
// two curves, the control heights, the toasts' lifetimes. The colours, spacing and type live in design-tokens.json and
// kit.css; tests/kit.test.ts holds the three together.

/** Motion (docs/23 item 16): a press answers in 120 ms, a thing appears or goes in 200, a sheet travels in 320. */
export const MOTION = { fast: 120, base: 200, slow: 320 } as const;
export type Pace = keyof typeof MOTION;

/** Two curves: things arriving decelerate (out); things moving across the screen ease both ways (in-out). */
export const EASE = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const;

/** Control heights: 36 for a mouse on a desk, 44 the least a finger is given, 52 the one main action on a phone. */
export const CONTROL = { dense: 36, touch: 44, main: 52 } as const;

/** Toasts (docs/23 items 14, 29): two at most on screen, 2.5 s each; a refusal a little longer, a spoken line and a
 *  First Watch hint long enough to be read. One waits at most three behind them. */
export const TOAST = {
  visible: 2,
  waiting: 3,
  /** A toast is up at least this long before a newer one may push it out. */
  minShow: 900,
  life: { default: 2500, bad: 3000, talk: 4000, herald: 3500, advice: 6000 } as Record<string, number>,
} as const;

export function toastLife(kind: string): number {
  return TOAST.life[kind] ?? TOAST.life.default;
}

/** Less motion: the system's wish or the game's own option (settings.ts puts `reduce-motion` on the body). */
export function reducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.body?.classList.contains('reduce-motion')) return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A duration for script-timed motion: none at all when less motion is wished. */
export function dur(pace: Pace): number {
  return reducedMotion() ? 0 : MOTION[pace];
}
