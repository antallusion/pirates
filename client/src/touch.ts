// Touch controls for phones and tablets (docs/23 phase 2): the helm stick and the sea under the finger. Everything
// else on a phone's sea is the sea HUD's (ui/seahud.ts: «Огонь», «Действие», «Особое», the menu). The same painted
// helm stands on a desk too (owner, 2026-10-07: «ты удалил… штурвал»): it shows her heading, sail and speed there,
// its keys on chips round it, and a mouse may drag it as a finger would.
//   the stick   pull the way she should go (she turns to that course and holds it); the farther from the middle,
//               the more sail (1–4 steps); let go and she keeps both. Hold the middle still to take all sail in;
//               a double tap is the dash (every hand on the braces).
//   − / +       beside the wheel on a touch screen (owner, 2026-10-16: «на мобиле нужна кнопка сбавить и добавить
//               скорость»): a step of sail less or more (0 · ¼ · ½ · ¾ · full), the same input as the keys; the four
//               pips between them are her sail now.
//   the sea     a tap aims (a ship tapped becomes the target); a finger dragged looks about, two pinch the zoom
//               (freecam.ts: the far view and the free look, owner 2026-10-17).
// Shown on coarse pointers or after the first touch.

import { STICK_DOUBLE_MS, STICK_REEF_MS, seaWord, stickSail } from './ui/seahud.ts';

/** A press held still this long steers (a quicker one may be a tap of the dash). */
export const STICK_STEER_MS = 140;
import { $, glyphSvg } from './ui/dom.ts';
import type { GlyphKind } from './ui/dom.ts';
import { SeaGesture } from './render/freecam.ts';

export interface TouchHooks {
  /** Set the sail to a step (0–4): the stick's pull, or the middle held. */
  sail(step: number): void;
  /** A hard turn with every hand on the braces (a double tap on the stick). */
  dash(): void;
  /** Aim the "cursor" at a screen point (abilities and the mount aim where you last touched the sea). */
  aim(px: number, py: number): void;
  zoom(factor: number): void;
  /** The view dragged by (dx, dy) px: the free look (freecam.ts). */
  pan?(dx: number, dy: number): void;
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
  /** The sea's fingers: taps, drags and pinches (freecam.ts). */
  private sea = new SeaGesture();
  private hooks: TouchHooks;
  /** The «−» / «+» of the sail beside the wheel and the sail they last showed. */
  private sailBox: HTMLElement;
  private sailNow = -1;

  constructor(hooks: TouchHooks) {
    this.hooks = hooks;
    this.stick = $('tc-stick');
    this.knob = $('tc-knob');
    this.sailBox = sailButtons((d) => {
      const want = Math.max(0, Math.min(4, Math.max(0, this.sailNow) + d));
      if (want === this.sailNow) return;
      this.hooks.sail(want);
      this.showSail(want);
      try { navigator.vibrate?.(8); } catch { /* not allowed */ }
    });
    $('touch').append(this.sailBox);
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
   *  sail, the dash's readiness (1 just used – 0 ready) on its chip and her speed under the wheel (knots, as words). */
  frame(heading: number | null, sail: number, dashLeft: number, speed = ''): void {
    if (!this.enabled && !document.body.classList.contains('simple')) return;
    const sp = document.getElementById('tc-speed');
    if (sp && sp.dataset.v !== `${speed}|${sail}`) {
      sp.dataset.v = `${speed}|${sail}`;
      sp.textContent = speed ? seaWord('speed', { n: speed }) : '';
      sp.setAttribute('aria-label', seaWord('speedAria', { n: speed, s: sail }));
    }
    if (this.stickId === null && heading !== null) this.knob.style.transform = `translate(-50%, -50%) rotate(${heading}rad)`;
    const mark = $('tc-course');
    mark.classList.toggle('hidden', this.course === null);
    if (this.course !== null) mark.style.transform = `rotate(${this.course}rad)`;
    if (this.stick.dataset.sail !== String(sail)) this.stick.dataset.sail = String(sail);
    this.showSail(sail);
    const cd = Math.max(0, Math.min(1, dashLeft)).toFixed(2);
    if (this.stick.style.getPropertyValue('--cd') !== cd) {
      this.stick.style.setProperty('--cd', cd);
      this.stick.classList.toggle('cooling', dashLeft > 0);
    }
  }

  /** The sail's pips and the two buttons' names and limits (none less than furled, none more than full). */
  private showSail(sail: number): void {
    if (sail === this.sailNow) return;
    this.sailNow = sail;
    this.sailBox.dataset.sail = String(sail);
    const [down, up] = [this.sailBox.querySelector<HTMLButtonElement>('[data-sail="-1"]')!, this.sailBox.querySelector<HTMLButtonElement>('[data-sail="1"]')!];
    down.disabled = sail <= 0;
    up.disabled = sail >= 4;
    for (const [b, k] of [[down, 'sailDown'], [up, 'sailUp']] as const) {
      const w = seaWord(k, { s: sail });
      b.setAttribute('aria-label', w);
      b.title = w;
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

  /** The sea under the fingers (freecam.ts SeaGesture): a tap aims (and sails to a thing), a finger dragged looks
   *  about (owner, 2026-10-17: «просто возить пальцем и просматривать где что»), two pinch the zoom and drag the view.
   *  A mouse drags the view too (its click stays main.ts's). */
  private bindCanvas(): void {
    const c = $('world');
    c.addEventListener('pointerdown', (e) => {
      const mouse = e.pointerType === 'mouse';
      // (a mouse drags with its middle button, or its left one in the simple HUD — the detailed one fires on a click)
      if (mouse && e.button !== 1 && !(e.button === 0 && document.body.classList.contains('simple'))) return;
      this.sea.down(e.pointerId, e.clientX, e.clientY);
      if (mouse) {
        if (e.button === 1) e.preventDefault(); // (no autoscroll)
        try { c.setPointerCapture(e.pointerId); } catch { /* not tracked */ }
      }
    });
    c.addEventListener('pointermove', (e) => {
      const o = this.sea.move(e.pointerId, e.clientX, e.clientY);
      if (o.zoom) this.hooks.zoom(o.zoom);
      if (o.pan && (o.pan[0] || o.pan[1])) this.hooks.pan?.(o.pan[0], o.pan[1]);
    });
    const end = (e: PointerEvent) => {
      const o = this.sea.up(e.pointerId, e.clientX, e.clientY, e.type === 'pointercancel');
      // (a mouse's click is main.ts's own: its tap aims nothing here)
      if (o.tap && e.pointerType !== 'mouse') this.hooks.aim(o.tap[0], o.tap[1]);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }
}

/** «+» over the four pips over «−», beside the wheel (seahud.css #tc-sail). A press acts at once
 *  (pointerdown, not the click's lift: a thumb on a rolling deck), one step a press. */
function sailButtons(step: (d: 1 | -1) => void): HTMLElement {
  const box = document.createElement('div');
  box.id = 'tc-sail';
  box.setAttribute('role', 'group');
  // (the signs drawn: a «+» set in letters sat 1.5 px low in its ring — owner, 2026-10-18)
  const b = (d: 1 | -1, glyph: GlyphKind) => `<button type="button" class="k-btn k-btn--icon sea-round tc-sail-b" data-sail="${d}"><span class="tc-sail-g" aria-hidden="true">${glyphSvg(glyph)}</span></button>`;
  box.innerHTML = `${b(1, 'plus')}<span class="tc-sail-pips" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${b(-1, 'minus')}`;
  for (const el of box.querySelectorAll<HTMLButtonElement>('button')) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!el.disabled) step(Number(el.dataset.sail) as 1 | -1);
    });
    // (a keyboard's Enter or Space: the click with no pointer before it)
    el.addEventListener('click', (e) => {
      if (e.detail === 0 && !el.disabled) step(Number(el.dataset.sail) as 1 | -1);
    });
  }
  return box;
}
