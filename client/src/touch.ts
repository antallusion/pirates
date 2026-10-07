// Touch controls for phones and tablets (docs/23 phase 2): the helm stick and the sea under the finger. Everything
// else on a phone's sea is the sea HUD's (ui/seahud.ts: «Огонь», «Действие», «Особое», the menu).
//   the stick   pull the way she should go (she turns to that course and holds it); the farther from the middle,
//               the more sail (1–4 steps); let go and she keeps both. Hold the middle still to take all sail in;
//               a double tap is the dash (every hand on the braces).
//   the sea     a tap aims (a ship tapped becomes the target); two fingers pinch the zoom.
// Shown on coarse pointers or after the first touch.

import { STICK_DOUBLE_MS, STICK_REEF_MS, seaWord, stickSail } from './ui/seahud.ts';

/** A press held still this long steers (a quicker one may be a tap of the dash). */
export const STICK_STEER_MS = 140;
import { $ } from './ui/dom.ts';

export interface TouchHooks {
  /** Set the sail to a step (0–4): the stick's pull, or the middle held. */
  sail(step: number): void;
  /** A hard turn with every hand on the braces (a double tap on the stick). */
  dash(): void;
  /** Aim the "cursor" at a screen point (abilities and the mount aim where you last touched the sea). */
  aim(px: number, py: number): void;
  zoom(factor: number): void;
}

/** Angle difference a − b wrapped into −π…π. */
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** The course a stick deflection asks for (0 = north, clockwise), or null inside the dead zone. */
export function stickCourse(dx: number, dy: number, dead = 14): number | null {
  if (Math.hypot(dx, dy) < dead) return null;
  return Math.atan2(dx, -dy);
}

/** Rudder toward a course: full over for large errors, easing in so she settles on it without hunting. */
export function rudderToward(course: number, heading: number): number {
  const d = angleDiff(course, heading);
  if (Math.abs(d) < 0.015) return 0;
  return Math.max(-1, Math.min(1, d * 3));
}

export class TouchControls {
  /** The course the helm stick last set; null when the stick has not been used (or keys took the helm). */
  course: number | null = null;
  enabled = false;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private hooks: TouchHooks;

  constructor(hooks: TouchHooks) {
    this.hooks = hooks;
    this.stick = $('tc-stick');
    this.knob = $('tc-knob');
    if (matchMedia('(pointer: coarse)').matches) this.enable();
    addEventListener('touchstart', () => this.enable(), { once: true, passive: true });
    this.bindStick();
    this.bindCanvas();
  }

  /** The captain's thumb on the helm stick now (docs/23 item 33: it takes the wheel from the helmsman). */
  held(): boolean {
    return this.stickId !== null;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    document.body.classList.add('touch');
  }

  /** Keep the wheel turned to the ship's heading, the course mark where the helm points, the sail ring lit to her
   *  sail and the dash's readiness (1 just used – 0 ready) on its chip. */
  frame(heading: number | null, sail: number, dashLeft: number): void {
    if (!this.enabled) return;
    if (this.stickId === null && heading !== null) this.knob.style.transform = `translate(-50%, -50%) rotate(${heading}rad)`;
    const mark = $('tc-course');
    mark.classList.toggle('hidden', this.course === null);
    if (this.course !== null) mark.style.transform = `rotate(${this.course}rad)`;
    if (this.stick.dataset.sail !== String(sail)) this.stick.dataset.sail = String(sail);
    const cd = Math.max(0, Math.min(1, dashLeft)).toFixed(2);
    if (this.stick.style.getPropertyValue('--cd') !== cd) {
      this.stick.style.setProperty('--cd', cd);
      this.stick.classList.toggle('cooling', dashLeft > 0);
    }
  }

  private bindStick(): void {
    const s = this.stick;
    s.setAttribute('role', 'slider');
    s.setAttribute('aria-label', seaWord('stick'));
    let x0 = 0, y0 = 0, t0 = 0, moved = false, lastTap = 0, sail: number | null = null;
    let reef: ReturnType<typeof setTimeout> | null = null;
    // A press steers once the finger slides (6 px) or stays (STICK_STEER_MS); a quick still tap is a tap — two are the
    // dash, anywhere on the wheel, and one alone sets the course where it fell once the second did not come. (A press
    // steered at once: a tap off the dead middle counted as a pull, so the dash only came from the middle 12%, and
    // tapping the «»» chip twice turned her to the upper right at full sail — docs/23 item 94.)
    let steering = false, last: PointerEvent | null = null;
    let steerT: ReturnType<typeof setTimeout> | null = null, single: ReturnType<typeof setTimeout> | null = null;
    const stopReef = () => {
      if (reef) clearTimeout(reef);
      reef = null;
    };
    const steer = () => {
      if (steerT) clearTimeout(steerT);
      steerT = null;
      steering = true;
      if (last) move(last);
    };
    const move = (e: PointerEvent) => {
      const r = s.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      const d = Math.hypot(dx, dy);
      const c = stickCourse(dx, dy, dead);
      if (c !== null) {
        this.course = c;
        moved = true;
        stopReef();
        // The pull is the sail: farther from the middle, more canvas (full sail at 85% of the rim and beyond).
        const want = stickSail(d, r.width * 0.5 * 0.85, dead);
        if (want !== null && want !== sail) {
          sail = want;
          this.hooks.sail(want);
        }
      }
      const k = Math.min(1, (r.width * 0.32) / (d || 1));
      this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px)) rotate(${this.course ?? 0}rad)`;
    };
    s.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      try {
        s.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer the browser no longer tracks: steer without capture */
      }
      s.classList.add('held');
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = performance.now();
      moved = false;
      sail = null;
      steering = false;
      last = e;
      if (single) clearTimeout(single);
      single = null;
      if (steerT) clearTimeout(steerT);
      steerT = setTimeout(steer, STICK_STEER_MS);
      // The middle held still: all sail in (there is no «−» button any more).
      stopReef();
      reef = setTimeout(() => {
        reef = null;
        if (moved || this.stickId === null) return;
        this.hooks.sail(0);
        s.classList.add('reefed');
        setTimeout(() => s.classList.remove('reefed'), 500);
        try { navigator.vibrate?.(20); } catch { /* not allowed */ }
      }, STICK_REEF_MS);
    });
    s.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      last = e;
      if (!steering && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) steer();
      else if (steering) move(e);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      s.classList.remove('held');
      stopReef();
      if (steerT) clearTimeout(steerT);
      steerT = null;
      // A tap (short and still, never steered): two in a row are the dash; one alone steers where it fell.
      const now = performance.now();
      const tap = e.type === 'pointerup' && !steering && now - t0 < 260 && Math.hypot(e.clientX - x0, e.clientY - y0) < 12;
      if (!tap) lastTap = 0;
      else if (now - lastTap < STICK_DOUBLE_MS) {
        lastTap = 0;
        this.hooks.dash();
      } else {
        lastTap = now;
        const at = e;
        single = setTimeout(() => {
          single = null;
          if (this.stickId !== null) return;
          move(at);
          this.knob.style.transform = '';
        }, STICK_DOUBLE_MS);
      }
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
  }

  private bindCanvas(): void {
    const c = $('world');
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) this.pinchDist = this.spread();
      else this.hooks.aim(e.clientX, e.clientY);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pinch.has(e.pointerId)) return;
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const d = this.spread();
        if (this.pinchDist > 0 && d > 0) this.hooks.zoom(d / this.pinchDist);
        this.pinchDist = d;
      }
    });
    const end = (e: PointerEvent) => {
      this.pinch.delete(e.pointerId);
      if (this.pinch.size < 2) this.pinchDist = 0;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  private spread(): number {
    const [a, b] = [...this.pinch.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
