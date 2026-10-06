// The kit's wheel (docs/23 item 11): a long press opens 4–6 choices round the finger — the shots, the captain's
// abilities, orders — the finger slides toward one and lets go to take it; let go in the middle and nothing is taken.
// A short tap stays the button's own (the volley with the shot loaded). A mouse does the same (hold, or right-click);
// a keyboard opens it with the context key or Shift+Enter, the arrows go round and Enter takes. The gamepad's wheel
// (main.ts) draws through the same wheel and picks with its stick.

import { esc, icon } from '../dom.ts';

export interface WheelOption {
  id: string;
  label: string;
  /** Art id for icon(); the glyph stands in while it loads. */
  icon?: string;
  glyph?: string;
  /** Shown but not to be taken (out of that shot). */
  disabled?: boolean;
  /** The one in use now (the loaded shot): ringed. */
  active?: boolean;
  /** A small number under it (how many shots are left). */
  count?: number;
}

/** The most a wheel holds. */
export const WHEEL_MAX = 12;

export interface WheelGeometry {
  /** The wheel's centre: the finger, moved in only as far as the screen's edge needs. */
  cx: number;
  cy: number;
  items: { x: number; y: number; a: number }[];
}

/** Where the choices stand: round the centre from straight up, clockwise, a full circle whatever their number; the
 *  centre is kept far enough from the screen's edges that every choice is on it. */
export function wheelLayout(n: number, x: number, y: number, vw: number, vh: number, r = 82, item = 52, margin = 6): WheelGeometry {
  // More than eight (the fire wheel's shots, abilities and talents: docs/23 items 19–21) stand on a wider circle, a
  // finger's width apart.
  r = Math.max(r, (n * (item + 10)) / (Math.PI * 2));
  const reach = r + item / 2 + margin;
  const cx = Math.max(Math.min(reach, vw / 2), Math.min(vw - Math.min(reach, vw / 2), x));
  const cy = Math.max(Math.min(reach, vh / 2), Math.min(vh - Math.min(reach, vh / 2), y));
  const items = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r, a };
  });
  return { cx, cy, items };
}

/** Over eight choices (the fire wheel at the screen's corner): a compact grid over the finger instead of a circle —
 *  a circle of twelve about a thumb in the corner had to stand far off it, over the target line and «Атаковать», and
 *  the finger's angle no longer matched the choice under it (owner, 2026-10-06: «всё должно быть идеально на мобиле»).
 *  Rows of up to `cols`, the lowest row just above the finger, the whole grid kept on the screen. */
export function wheelGrid(n: number, x: number, y: number, vw: number, vh: number, item = 44, gap = 12, cols = 6, margin = 6): WheelGeometry {
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.ceil(n / c);
  const step = item + gap;
  const w = c * step - gap, h = rows * step - gap;
  const left = Math.max(margin, Math.min(vw - margin - w, x - w / 2));
  // Above the finger with room for its label; on a short screen as high as it fits.
  const top = Math.max(margin, Math.min(vh - margin - h, y - item - 18 - h));
  const items = Array.from({ length: n }, (_, i) => {
    const r = rows - 1 - Math.floor(i / c), col = i % c; // the first choices on the row nearest the finger
    return { x: left + col * step + item / 2, y: top + r * step + item / 2, a: 0 };
  });
  return { cx: left + w / 2, cy: top - 14, items };
}

/** The choice under the finger: the nearest choice within reach of it, or -1. */
export function nearestChoice(items: readonly { x: number; y: number }[], x: number, y: number, reach: number): number {
  let best = -1, bd = reach;
  items.forEach((it, i) => {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** The choice a pull points at (dx, dy from where the wheel opened; screen axes, y down): the nearest by angle, or
 *  none (-1) inside the dead centre. Up is the first, then clockwise — the gamepad's convention (gamepad.ts). */
export function pickSector(dx: number, dy: number, n: number, dead = 24): number {
  if (n <= 0 || Math.hypot(dx, dy) < dead) return -1;
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / ((Math.PI * 2) / n)) % n;
}

/** One wheel on screen at a time; its layer is made on first use. */
export class RadialWheel {
  private el: HTMLElement | null = null;
  private opts: WheelOption[] = [];
  private sel = -1;
  private x0 = 0;
  private y0 = 0;
  private geo: WheelGeometry | null = null;
  private item = 52;
  private many = false;
  get isOpen(): boolean {
    return !!this.el && !this.el.classList.contains('hidden');
  }
  get selected(): number {
    return this.sel;
  }

  open(x: number, y: number, options: WheelOption[], title = ''): void {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'k-wheel hidden';
      this.el.setAttribute('role', 'menu');
      document.body.append(this.el);
    }
    this.opts = options.slice(0, WHEEL_MAX);
    this.sel = -1;
    this.x0 = x;
    this.y0 = y;
    // Over eight (the fire wheel): smaller choices without their words round them; the lit one's name is in the hub.
    const many = this.opts.length > 8;
    const item = many ? 44 : 52;
    const g = many ? wheelGrid(this.opts.length, x, y, innerWidth, innerHeight, item) : wheelLayout(this.opts.length, x, y, innerWidth, innerHeight, 82, item, 22);
    this.geo = g;
    this.item = item;
    this.many = many;
    const hub = many ? 0 : Math.round(2 * Math.hypot(g.items[0]?.x - g.cx || 0, g.items[0]?.y - g.cy || 82) + item - 20);
    this.el.classList.toggle('k-wheel--many', many);
    this.el.setAttribute('aria-label', title);
    this.el.innerHTML = `<div class="k-wheel-hub" style="left:${g.cx}px;top:${g.cy}px;width:${hub}px;height:${hub}px"></div><div class="k-wheel-cap" style="left:${g.cx}px;top:${g.cy}px" aria-hidden="true"></div>${this.opts.map((o, i) => `<div class="k-wheel-item${o.disabled ? ' off' : ''}${o.active ? ' on' : ''}" role="menuitem" aria-disabled="${!!o.disabled}" data-i="${i}" style="left:${g.items[i].x}px;top:${g.items[i].y}px;--k-i:${i}">
      ${o.icon ? icon(o.icon, o.glyph ?? '', 'k-wheel-ico') : `<span class="k-wheel-ico glyph">${esc(o.glyph ?? '•')}</span>`}<span class="k-wheel-l">${esc(o.label)}</span>${o.count !== undefined ? `<b class="k-wheel-n">${o.count}</b>` : ''}</div>`).join('')}`;
    this.el.classList.remove('hidden', 'k-open');
    requestAnimationFrame(() => this.el?.classList.add('k-open'));
  }

  /** The finger (or mouse) has moved: light the choice it points at. */
  move(x: number, y: number): number {
    // The choice under the finger first, so the lit one is always the one the finger is on; a circle also takes a
    // pull's direction from its own centre (moved off the finger at a screen's edge) once the finger is clear of it.
    const g = this.geo;
    if (!g) return this.select(-1);
    const near = nearestChoice(g.items, x, y, this.item * 0.85);
    if (near >= 0 || this.many) return this.select(near);
    if (Math.hypot(x - this.x0, y - this.y0) < 24) return this.select(-1);
    return this.select(pickSector(x - g.cx, y - g.cy, this.opts.length));
  }

  /** Light a choice by its index (the gamepad's stick, the keyboard's arrows); -1 lights none. */
  select(i: number): number {
    if (i >= 0 && this.opts[i]?.disabled) i = -1;
    if (i === this.sel) return i;
    this.sel = i;
    this.el?.querySelectorAll<HTMLElement>('.k-wheel-item').forEach((e) => e.classList.toggle('sel', Number(e.dataset.i) === i));
    const cap = this.el?.querySelector<HTMLElement>('.k-wheel-cap');
    if (cap) cap.textContent = i >= 0 ? this.opts[i].label : '';
    if (i >= 0) try { navigator.vibrate?.(8); } catch { /* not allowed */ }
    return i;
  }

  /** Put it away; with `pick`, what was lit is taken (null when none was). */
  close(pick: boolean): WheelOption | null {
    const it = pick && this.sel >= 0 ? this.opts[this.sel] : null;
    this.el?.classList.add('hidden');
    this.el?.classList.remove('k-open');
    this.sel = -1;
    return it;
  }
}

export const wheel = new RadialWheel();

export interface WheelBinding {
  options: () => WheelOption[];
  onPick: (o: WheelOption) => void;
  /** A short tap (the button's own work). */
  onTap?: () => void;
  /** How long a press is held before the wheel opens. */
  holdMs?: number;
  title?: string;
}

/** A button that opens the wheel on a long press. Returns a function that takes the wiring off again. */
export function attachWheel(el: HTMLElement, b: WheelBinding): () => void {
  const hold = b.holdMs ?? 350;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let id: number | null = null, x0 = 0, y0 = 0, opened = false, swallow = 0;
  const openAt = (x: number, y: number) => {
    opened = true;
    wheel.open(x, y, b.options(), b.title);
    el.classList.add('k-wheel-src');
  };
  const finish = (pick: boolean) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!opened) return;
    opened = false;
    swallow = performance.now() + 400; // the click that follows a wheel's release is not the button's tap
    el.classList.remove('k-wheel-src');
    const o = wheel.close(pick);
    if (o) b.onPick(o);
  };
  const down = (e: PointerEvent) => {
    if (e.button > 0) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    opened = false;
    timer = setTimeout(() => {
      timer = null;
      try { el.setPointerCapture(e.pointerId); } catch { /* gone */ }
      openAt(x0, y0);
    }, hold);
  };
  const move = (e: PointerEvent) => {
    if (id !== e.pointerId) return;
    if (opened) wheel.move(e.clientX, e.clientY);
    else if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) {
      clearTimeout(timer); // a slide, not a press: neither the wheel nor a tap
      timer = null;
      id = null;
    }
  };
  const up = (e: PointerEvent) => {
    if (id !== e.pointerId) return;
    id = null;
    if (opened) {
      e.preventDefault();
      finish(true);
    } else if (timer) {
      clearTimeout(timer);
      timer = null;
      b.onTap?.();
    }
  };
  const cancel = (e: PointerEvent) => {
    if (id !== e.pointerId) return;
    id = null;
    finish(false);
  };
  const menu = (e: MouseEvent) => {
    e.preventDefault();
    if (opened) return;
    const r = el.getBoundingClientRect();
    openAt(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    // A right-click's wheel is taken with a left click on a choice, or put away with a click elsewhere / Esc.
    const pickByClick = (ev: PointerEvent) => {
      wheel.move(ev.clientX, ev.clientY);
      removeEventListener('pointerdown', pickByClick, true);
      ev.preventDefault();
      ev.stopPropagation();
      finish(true);
    };
    addEventListener('pointerdown', pickByClick, true);
    const moveByMouse = (ev: PointerEvent) => (opened ? wheel.move(ev.clientX, ev.clientY) : removeEventListener('pointermove', moveByMouse));
    addEventListener('pointermove', moveByMouse);
  };
  const key = (e: KeyboardEvent) => {
    if (!opened && (e.key === 'ContextMenu' || (e.key === 'Enter' && e.shiftKey))) {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      openAt(r.left + r.width / 2, r.top + r.height / 2);
      wheel.select(0);
      return;
    }
    if (!opened) return;
    const n = b.options().length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') wheel.select((wheel.selected + 1 + n) % n);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') wheel.select((wheel.selected - 1 + n) % n);
    else if (e.key === 'Enter' || e.key === ' ') finish(true);
    else if (e.key === 'Escape') finish(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const click = (e: MouseEvent) => {
    if (performance.now() < swallow) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  el.addEventListener('click', click, true);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', menu);
  el.addEventListener('keydown', key);
  el.setAttribute('aria-haspopup', 'menu');
  // The finger's slide is the wheel's, not the page's pan (a pan would cancel the press).
  el.style.touchAction = 'none';
  return () => {
    el.removeEventListener('click', click, true);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('contextmenu', menu);
    el.removeEventListener('keydown', key);
  };
}
