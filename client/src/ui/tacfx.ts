// docs/25 §3 (owner, 2026-10-09: «20 улучшений визуальных для боя абордажа, именно визуальных эффектов, плавности
// какой-то еще каких-то фишек… делай все пункты»): the boarding field's clockwork, pure (no canvas, no DOM) so the tests
// hold it — the hit-stop's field clock, the knock by the share of the army a blow takes, the count rolling down to the
// server's number, the decks' roll, the weather read off the sea, the quality by device, and what «меньше движения»
// turns off. ui/tacvfx.ts draws with it; ui/tactical.ts feeds it.

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** What the player asked of motion: `still` («меньше движения», or the system's reduced motion) turns off the shake, the
 *  hit-stop, the zooms, the opening and the idle sway; `shake` the screen shake alone (the sea's own switch); `flash`
 *  the strength of flashes (muzzle light, lightning: «меньше вспышек» makes them a gentle brightening). */
export interface Motion {
  still: boolean;
  shake: boolean;
  flash: number;
}
export function motionOf(s: { reduceMotion: boolean; screenShake: boolean; reduceFlashes: boolean }, systemCalm = false): Motion {
  const still = s.reduceMotion || systemCalm;
  return { still, shake: !still && s.screenShake, flash: s.reduceFlashes ? 0.35 : 1 };
}

/** How much a screen draws (owner: a phone gets the lighter versions — fewer particles, no parallax). */
export interface FxLevel {
  /** The most particles alive at once. */
  parts: number;
  /** A burst's share of its particles (sparks, splinters, drops). */
  burst: number;
  /** Rain streaks over the field. */
  rain: number;
  /** The sea and the far deck shifting with the roll, the rigging in the foreground. */
  parallax: boolean;
  /** The heat haze over fires, the sails' shadows over the decks, the fog's third bank. */
  fine: boolean;
}
export function fxLevel(phone: boolean, low: boolean): FxLevel {
  if (low) return { parts: 60, burst: 0.4, rain: 18, parallax: false, fine: false };
  if (phone) return { parts: 110, burst: 0.55, rain: 32, parallax: false, fine: false };
  return { parts: 260, burst: 1, rain: 80, parallax: true, fine: true };
}

// ------------------------------------------------------------------ 1. the hit-stop

/** A heavy blow (a tenth of the struck side's army or more, or one that fells men by the fifth) and a stack's fall hold
 *  the field still 50–90 ms. */
export const STOP_MIN = 50;
export const STOP_MAX = 90;
/** How long the field takes to catch up with the battle's clock after a hold (ms): it plays a little quicker. */
export const STOP_CATCH = 160;
export function stopMs(share: number, death = false): number {
  if (death) return STOP_MAX;
  if (!(share >= 0.05)) return 0;
  return Math.round(clamp(STOP_MIN + ((share - 0.05) / 0.15) * (STOP_MAX - STOP_MIN), STOP_MIN, STOP_MAX));
}

/** The field's own clock (performance ms): the battle's, held still through a hit-stop and caught up after it, so the
 *  play queue (the server's pace, the counts, the turn) never waits on it — the field is behind by 90 ms at most and
 *  level again 160 ms later. */
export class FieldClock {
  off = false;
  private stops: { at: number; ms: number }[] = [];

  /** Hold the field at `at` for `ms`. A hold inside one still being caught up is let go, unless it is the longer. */
  stop(at: number, ms: number): void {
    if (this.off || !(ms > 0)) return;
    ms = Math.min(STOP_MAX, ms);
    const last = this.stops[this.stops.length - 1];
    if (last && at < last.at + last.ms + STOP_CATCH) {
      if (ms <= last.ms || at < last.at) return;
      this.stops.pop();
    }
    this.stops.push({ at, ms });
    if (this.stops.length > 16) this.stops.splice(0, this.stops.length - 16);
  }

  /** The field's time at the battle's time `t`: never ahead of it, never going back. */
  at(t: number): number {
    if (this.off) return t;
    for (const s of this.stops) {
      if (t < s.at) break;
      const e = s.at + s.ms;
      if (t <= e) return s.at;
      if (t < e + STOP_CATCH) return s.at + ((t - e) * (s.ms + STOP_CATCH)) / STOP_CATCH;
    }
    return t;
  }

  /** The field held still now. */
  held(t: number): boolean {
    return !this.off && this.stops.some((s) => t >= s.at && t <= s.at + s.ms);
  }

  clear(): void {
    this.stops = [];
  }
}

// ------------------------------------------------------------------ 2. the shake

/** The knock by the share of the struck side's army a blow takes (owner: «1% армии — 2 px, 10%+ — 6 px»); a scratch
 *  under a fifth of a percent none. */
export const KNOCK_MIN = 2;
export const KNOCK_MAX = 6;
export const KNOCK_MS = 400;
export function boardKnockPx(share: number): number {
  if (!(share >= 0.002)) return 0;
  if (share < 0.01) return 1 + (share - 0.002) / 0.008;
  return clamp(KNOCK_MIN + ((share - 0.01) / 0.09) * (KNOCK_MAX - KNOCK_MIN), KNOCK_MIN, KNOCK_MAX);
}

/** The field knocked away from each blow as it lands and swinging back, damped (as the sea's camera, render/camfight.ts);
 *  blows at once add up, never past KNOCK_MAX. Off: nothing. */
export class FieldShake {
  off = false;
  private list: { at: number; amp: number; dx: number; dy: number }[] = [];

  /** A blow landing at `at` (performance ms) that takes `share` of the struck side; (dx, dy) the way it drives. */
  kick(at: number, share: number, dx: number, dy: number): void {
    const amp = boardKnockPx(share);
    if (this.off || amp <= 0) return;
    const l = Math.hypot(dx, dy);
    this.list.push({ at, amp, dx: l > 1e-6 ? dx / l : 0, dy: l > 1e-6 ? dy / l : 1 });
    if (this.list.length > 24) this.list.splice(0, this.list.length - 24);
  }

  /** The knock's offset at `t` (CSS px). */
  at(t: number): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.off) return { x, y };
    for (const k of this.list) {
      const s = (t - k.at) / 1000;
      if (s < 0 || s >= KNOCK_MS / 1000) continue;
      const e = Math.exp(-s / 0.12) * (1 - s / (KNOCK_MS / 1000));
      const a = k.amp * e * Math.cos(2 * Math.PI * 9 * s), b = k.amp * 0.3 * e * Math.sin(2 * Math.PI * 13 * s);
      x += k.dx * a - k.dy * b;
      y += k.dy * a + k.dx * b;
    }
    const m = Math.hypot(x, y);
    if (m > KNOCK_MAX) {
      x *= KNOCK_MAX / m;
      y *= KNOCK_MAX / m;
    }
    return { x, y };
  }

  /** A knock still swinging at `t`. */
  busy(t: number): boolean {
    return !this.off && this.list.some((k) => t >= k.at && t < k.at + KNOCK_MS);
  }

  /** The knocks done by `t` let go. */
  prune(t: number): void {
    this.list = this.list.filter((k) => k.at + KNOCK_MS > t);
  }

  clear(): void {
    this.list = [];
  }
}

// ------------------------------------------------------------------ 15. the count rolling down

export const ROLL_MS = 420;
/** The number a stack's plate shows `k` (0–1) of the way through rolling from `from` to `to`: whole men, eased out,
 *  `from` at the start and the server's `to` at the end exactly. */
export function rollCount(from: number, to: number, k: number): number {
  if (!(k > 0)) return from;
  if (k >= 1 || from === to) return to;
  const e = 1 - (1 - k) ** 3;
  const n = from + (to - from) * e;
  return to < from ? Math.max(to, Math.ceil(n - 1e-9)) : Math.min(to, Math.floor(n + 1e-9));
}

// ------------------------------------------------------------------ 3. the decks' roll

/** Each deck's rise and fall on the swell (board px, + down), the two out of step: hers a longer swell than the
 *  boarders'. The gangway between them sags at its middle as they part. */
export function deckRoll(t: number, side: 0 | 1, amp: number): number {
  const s = t / 1000;
  return side === 0 ? amp * (Math.sin(s * 1.21) * 0.8 + Math.sin(s * 0.53 + 1.3) * 0.2) : amp * (Math.sin(s * 0.97 + 2.1) * 0.8 + Math.sin(s * 0.41 + 0.4) * 0.2);
}
/** A lantern's or a rope's swing (rad) on a deck rolling so. */
export function swing(t: number, side: 0 | 1, seed: number): number {
  const s = t / 1000;
  return (side === 0 ? Math.cos(s * 1.21 + seed) : Math.cos(s * 0.97 + 2.1 + seed)) * 0.16 + Math.sin(s * 2.3 + seed * 3) * 0.03;
}

// ------------------------------------------------------------------ 16. the weather and the hour off the sea

export interface Sky {
  /** 0–1: rain on the field (rain 0.6, a storm 1). */
  rain: number;
  /** 0–1: fog in banks over the field. */
  fog: number;
  /** Lightning now and then. */
  storm: boolean;
  /** 0 by day, 1 at deep night (shared nightFactor). */
  night: number;
  /** The wind's way on the screen (a unit vector; east by default): the rain's slant, the smoke and the embers. */
  wx: number;
  wy: number;
  /** The wind's strength 0–1. */
  wk: number;
}
export function skyOf(weather: string | undefined, fog: number, night: number, wind: [number, number] | undefined): Sky {
  const w = weather ?? 'breeze';
  const rain = w === 'black_storm' ? 1 : w === 'storm' ? 0.9 : w === 'rain' ? 0.6 : 0;
  const f = Math.max(w === 'fog' ? 0.75 : 0, clamp((fog - 0.25) / 0.6, 0, 1) * 0.8);
  const [x, y] = wind ?? [1, 0];
  const l = Math.hypot(x, y);
  return { rain, fog: f, storm: w === 'storm' || w === 'black_storm', night: clamp(night, 0, 1), wx: l > 1e-6 ? x / l : 1, wy: l > 1e-6 ? y / l : 0, wk: clamp(l / 6, 0.15, 1) };
}

/** A lightning stroke over the field: the share (0–1) of its flash at `t` (ms), every 5–9 s in a storm. */
export function lightning(t: number): number {
  const period = 7000;
  const n = Math.floor(t / period);
  const at = n * period + ((n * 2654435761) % 3000);
  const d = t - at;
  if (d < 0 || d > 420) return 0;
  // A double flash: a stroke, a breath, a smaller one.
  return d < 90 ? 1 - d / 90 : d > 180 && d < 300 ? 0.55 * (1 - (d - 180) / 120) : 0;
}

// ------------------------------------------------------------------ 11, 12, 20: the camera's own moves

/** The opening's push (1.5–2 s): from a little near to the whole field. */
export const INTRO_MS = 1800;
export function introZoom(k: number): number {
  return 1 + 0.06 * (1 - clamp(k, 0, 1)) ** 2;
}
/** An ultimate as a film's frame (owner: «камера на 6–8% ближе к удару»): in over a quarter of it, held, back out. */
export function ultZoom(k: number): number {
  if (!(k > 0) || k >= 1) return 1;
  const z = 0.07;
  if (k < 0.18) return 1 + z * (1 - (1 - k / 0.18) ** 3);
  if (k < 0.7) return 1 + z;
  return 1 + z * (1 - ((k - 0.7) / 0.3) ** 2);
}
/** The end: the camera slowly drawn back (3 s). */
export const FINALE_MS = 3000;
export function finaleZoom(k: number): number {
  const e = clamp(k, 0, 1);
  return 1 - 0.05 * (1 - (1 - e) ** 2);
}

/** A seeded share 0–1 (the same for the same seed): the battle's marks fall where they fell on a re-laid field too. */
export function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
