// The kit's toasts (docs/23 items 14, 29): one place — the top band — and two at most on screen. Each stays 2.5 s
// (a refusal 3, a spoken line 4, a First Watch hint 6). The same words again do not stack: the one up counts «×2».
// A third coming while two are up pushes out the older one once it has been read a moment (0.9 s), else it waits;
// three wait at most, the oldest that is not a refusal giving way. The queue is pure (tests/kit.test.ts); the
// Toasts class puts it on screen — in the HUD's own band (hud.ts) or the kit's top band (.k-toasts).

import { TOAST, toastLife } from './tokens.ts';

export interface ToastItem {
  id: number;
  key: string;
  kind: string;
  /** Up since (0 while waiting). */
  shown: number;
  /** Gone at. */
  until: number;
  count: number;
  /** How long it stays once up. */
  life: number;
  /** What the caller needs to draw it (its words, its markup). */
  data: unknown;
}

export type ToastChange = { show?: ToastItem[]; hide?: ToastItem[]; bump?: ToastItem[] };

export class ToastQueue {
  readonly visible: ToastItem[] = [];
  readonly waiting: ToastItem[] = [];
  private seq = 0;
  private max: number;
  private wait: number;
  private minShow: number;
  constructor(max: number = TOAST.visible, wait: number = TOAST.waiting, minShow: number = TOAST.minShow) {
    this.max = max;
    this.wait = wait;
    this.minShow = minShow;
  }

  /** A toast comes. `key` is what makes two the same (their words). */
  push(key: string, kind: string, now: number, data: unknown = null, life = toastLife(kind)): ToastChange {
    const same = this.visible.find((t) => t.key === key) ?? this.waiting.find((t) => t.key === key);
    if (same) {
      same.count++;
      same.data = data;
      if (this.visible.includes(same)) same.until = now + same.life; // up: its time starts again
      return { bump: [same] };
    }
    const item: ToastItem = { id: ++this.seq, key, kind, shown: 0, until: 0, count: 1, life, data };
    const ch: ToastChange = { show: [], hide: [] };
    if (this.visible.length >= this.max) {
      // The oldest up, if it has been read a moment, makes room at once.
      const old = [...this.visible].sort((a, b) => a.shown - b.shown)[0];
      if (old && now - old.shown >= this.minShow) {
        this.visible.splice(this.visible.indexOf(old), 1);
        ch.hide!.push(old);
      }
    }
    if (this.visible.length < this.max) {
      this.up(item, now);
      ch.show!.push(item);
    } else {
      this.waiting.push(item);
      while (this.waiting.length > this.wait) {
        const i = this.waiting.findIndex((t) => t.kind !== 'bad');
        this.waiting.splice(i >= 0 ? i : 0, 1);
      }
    }
    return ch;
  }

  /** Time passes: the spent ones go, the waiting come up in their order. */
  tick(now: number): ToastChange {
    const ch: ToastChange = { show: [], hide: [] };
    for (const t of [...this.visible]) if (t.until <= now) {
      this.visible.splice(this.visible.indexOf(t), 1);
      ch.hide!.push(t);
    }
    while (this.visible.length < this.max && this.waiting.length) {
      const t = this.waiting.shift()!;
      this.up(t, now);
      ch.show!.push(t);
    }
    return ch;
  }

  /** Take one off (the caller removed it: a window closed over it). */
  drop(id: number): void {
    for (const list of [this.visible, this.waiting]) {
      const i = list.findIndex((t) => t.id === id);
      if (i >= 0) list.splice(i, 1);
    }
  }

  /** When the next one is due to go (for one timer, not one per toast). */
  nextAt(): number {
    return this.visible.reduce((m, t) => Math.min(m, t.until), Infinity);
  }

  private up(t: ToastItem, now: number): void {
    t.shown = now;
    t.until = now + t.life;
    this.visible.push(t);
  }
}

export interface ToastsOpts {
  /** Where a toast goes as it comes up (the HUD picks the band, or the window's strip while a window is open). */
  host: () => HTMLElement;
  /** Its element. */
  render: (item: ToastItem) => HTMLElement;
  /** Its count changed (×2, ×3…). */
  bump?: (el: HTMLElement, item: ToastItem) => void;
  /** Called before one is put up (the HUD measures its band). */
  before?: (host: HTMLElement) => void;
  max?: number;
}

/** The queue on screen. */
export class Toasts {
  readonly queue: ToastQueue;
  private els = new Map<number, HTMLElement>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private o: ToastsOpts;
  constructor(o: ToastsOpts) {
    this.o = o;
    this.queue = new ToastQueue(o.max ?? TOAST.visible);
  }

  push(key: string, kind: string, data: unknown = null, life?: number): HTMLElement | null {
    const now = performance.now();
    this.apply(this.queue.push(key, kind, now, data, life ?? toastLife(kind)));
    this.schedule();
    const t = this.queue.visible.find((x) => x.key === key);
    return t ? this.els.get(t.id) ?? null : null;
  }

  /** Every toast off the screen and out of the queue. */
  clear(): void {
    for (const t of [...this.queue.visible, ...this.queue.waiting]) this.queue.drop(t.id);
    for (const el of this.els.values()) el.remove();
    this.els.clear();
  }

  private apply(ch: ToastChange): void {
    for (const t of ch.hide ?? []) {
      const el = this.els.get(t.id);
      this.els.delete(t.id);
      if (el) {
        el.classList.add('k-toast-out');
        setTimeout(() => el.remove(), 160);
      }
    }
    for (const t of ch.show ?? []) {
      const host = this.o.host();
      this.o.before?.(host);
      const el = this.o.render(t);
      el.dataset.toastId = String(t.id);
      // An element taken off by hand (a window's strip emptied) leaves the queue too.
      new MutationObserver((_, obs) => { if (!el.isConnected) { obs.disconnect(); if (this.els.get(t.id) === el) { this.els.delete(t.id); this.queue.drop(t.id); this.tickSoon(); } } }).observe(host, { childList: true });
      host.prepend(el);
      this.els.set(t.id, el);
    }
    for (const t of ch.bump ?? []) {
      const el = this.els.get(t.id);
      if (el) {
        this.o.bump?.(el, t);
        el.parentElement?.prepend(el);
      }
    }
  }

  private tickSoon(): void {
    setTimeout(() => { this.apply(this.queue.tick(performance.now())); this.schedule(); }, 0);
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const at = this.queue.nextAt();
    if (!Number.isFinite(at)) { this.timer = null; return; }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.apply(this.queue.tick(performance.now()));
      this.schedule();
    }, Math.max(16, at - performance.now()));
  }
}

let band: Toasts | null = null;

/** The kit's own top band (screens with no HUD: the demo, the login): toast('…', 'good'). */
export function toast(text: string, kind = 'info'): void {
  band ??= new Toasts({
    host: () => {
      let h = document.querySelector<HTMLElement>('.k-toasts');
      if (!h) {
        h = document.createElement('div');
        h.className = 'k-toasts';
        h.setAttribute('aria-live', 'polite');
        document.body.append(h);
      }
      return h;
    },
    render: (t) => {
      const el = document.createElement('div');
      el.className = `k-toast toast ${t.kind}`;
      el.setAttribute('role', t.kind === 'bad' ? 'alert' : 'status');
      el.textContent = String(t.data ?? t.key);
      return el;
    },
    bump: (el, t) => {
      let b = el.querySelector<HTMLElement>('.t-count');
      if (!b) { b = document.createElement('b'); b.className = 't-count'; el.append(b); }
      b.textContent = `×${t.count}`;
    },
  });
  band.push(text, kind, text);
}
