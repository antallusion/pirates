// Touch controls for phones and tablets: a helm stick that sets the course (the ship turns to it and holds it),
// sail steps, broadside buttons that aim themselves, chasers and the deck mount, the context action (board, dock,
// land, cast off), tap-to-aim on the sea and pinch zoom. Shown on coarse pointers or after the first touch.

import { assetUrl } from './assets.ts';
import { $ } from './ui/dom.ts';

export interface TouchHooks {
  /** Set sail steps up (+1) or down (−1). */
  sail(delta: number): void;
  fire(side: 'port' | 'starboard'): void;
  chasers(): void;
  mount(): void;
  context(): void;
  /** Aim the "cursor" at a screen point (abilities and the mount aim where you last touched the sea). */
  aim(px: number, py: number): void;
  zoom(factor: number): void;
  /** Open the in-game menu (map, ship, crew, …). */
  menu(): void;
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
  private root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private hooks: TouchHooks;

  constructor(hooks: TouchHooks) {
    this.hooks = hooks;
    this.root = $('touch');
    this.stick = $('tc-stick');
    this.knob = $('tc-knob');
    if (matchMedia('(pointer: coarse)').matches) this.enable();
    addEventListener('touchstart', () => this.enable(), { once: true, passive: true });
    this.bindStick();
    this.bindButtons();
    this.bindCanvas();
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    document.body.classList.add('touch');
  }

  /** Put the art on the buttons once it has loaded (their glyphs stay until then). */
  dress(): void {
    this.art('tc-port', 'icon.fire', true);
    this.art('tc-starboard', 'icon.fire');
    this.art('tc-chasers', 'icon.chasers');
    this.art('tc-sail-up', 'icon.sail_up');
    this.art('tc-sail-down', 'icon.sail_down');
    this.art('tc-menu', 'icon.menu_cabin');
    this.mountArt = '';
  }

  private mountArt = '';

  private art(id: string, art: string, flip = false): void {
    const url = assetUrl(art);
    const b = $(id);
    b.querySelector('img')?.remove();
    b.classList.toggle('has-art', !!url);
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    if (flip) img.style.transform = 'scaleX(-1)';
    b.prepend(img);
  }

  /** Show or hide the context button, with what it will do. */
  setContext(label: string | null): void {
    const b = $('tc-context');
    b.classList.toggle('hidden', !label);
    if (label && b.dataset.label !== label) {
      b.dataset.label = label;
      b.querySelector('span')!.textContent = label;
    }
  }

  /** Keep the wheel turned to the ship's heading and the course mark where the helm points. */
  frame(heading: number | null, sail: number, hasChasers: boolean, mount: string | null): void {
    if (!this.enabled) return;
    if (this.stickId === null && heading !== null) this.knob.style.transform = `translate(-50%, -50%) rotate(${heading}rad)`;
    const mark = $('tc-course');
    mark.classList.toggle('hidden', this.course === null);
    if (this.course !== null) mark.style.transform = `rotate(${this.course}rad)`;
    const sails = $('tc-sail');
    if (sails.dataset.sail !== String(sail)) sails.dataset.sail = String(sail);
    $('tc-chasers').classList.toggle('hidden', !hasChasers);
    $('tc-mount').classList.toggle('hidden', !mount);
    if (mount && mount !== this.mountArt) {
      this.mountArt = mount;
      this.art('tc-mount', `icon.mount_${mount}`);
    }
  }

  private bindStick(): void {
    const s = this.stick;
    const move = (e: PointerEvent) => {
      const r = s.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const c = stickCourse(dx, dy, r.width * 0.12);
      if (c !== null) this.course = c;
      const k = Math.min(1, (r.width * 0.32) / (Math.hypot(dx, dy) || 1));
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
      move(e);
    });
    s.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) move(e);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      s.classList.remove('held');
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
  }

  private bindButtons(): void {
    const tap = (id: string, run: () => void) => {
      $(id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 160);
        run();
      });
    };
    tap('tc-sail-up', () => this.hooks.sail(1));
    tap('tc-sail-down', () => this.hooks.sail(-1));
    tap('tc-port', () => this.hooks.fire('port'));
    tap('tc-starboard', () => this.hooks.fire('starboard'));
    tap('tc-chasers', () => this.hooks.chasers());
    tap('tc-mount', () => this.hooks.mount());
    tap('tc-context', () => this.hooks.context());
    tap('tc-menu', () => this.hooks.menu());
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
    void this.root;
  }

  private spread(): number {
    const [a, b] = [...this.pinch.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
