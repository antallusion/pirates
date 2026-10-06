// The kit's counter icon (docs/23 items 15, 27): a round picture with a number on its corner, in place of a plate of
// text on the HUD — goals, news, hints, holidays, letters. A tap opens what is behind it in a sheet. With nothing
// behind it, it hides (or stays, dimmed, when asked to keep its place).

import { dict } from '../../i18n.ts';
import { EN, RU } from '../../lang/ui/kit.ts';
import { buttonHtml, setBadge } from './button.ts';
import { openSheet } from './sheet.ts';
import type { SheetHandle, SheetHeight } from './sheet.ts';

const L = dict(EN, RU);

export interface CounterOpts {
  id: string;
  /** Art id (icon()) and the glyph shown while it loads. */
  icon: string;
  glyph?: string;
  label: string;
  n: number;
  /** Keep the place when the count is 0 (dimmed), rather than hide. */
  keep?: boolean;
}

export function counterSpeech(label: string, n: number): string {
  return L('counter.label', { label, n });
}

export function counterHtml(o: CounterOpts): string {
  return buttonHtml({ kind: 'icon', icon: o.icon, glyph: o.glyph ?? '•', aria: counterSpeech(o.label, o.n), title: o.label, badge: o.n, cls: `k-count${o.n <= 0 ? (o.keep ? ' k-count--zero' : ' hidden') : ''}`, data: { count: o.id } });
}

/** A counter on screen: set its number; a tap opens its sheet with what `content()` gives. */
export class CounterIcon {
  readonly el: HTMLButtonElement;
  private n: number;
  private sheet: SheetHandle | null = null;
  private o: CounterOpts & { content: () => string | HTMLElement; height?: SheetHeight; onOpen?: () => void };
  constructor(o: CounterOpts & { content: () => string | HTMLElement; height?: SheetHeight; onOpen?: () => void }) {
    this.o = o;
    const t = document.createElement('template');
    t.innerHTML = counterHtml(o);
    this.el = t.content.firstElementChild as HTMLButtonElement;
    this.n = o.n;
    this.el.addEventListener('click', () => this.open());
  }
  get count(): number {
    return this.n;
  }
  set(n: number): void {
    if (n === this.n) return;
    this.n = n;
    setBadge(this.el, n);
    this.el.setAttribute('aria-label', counterSpeech(this.o.label, n));
    this.el.classList.toggle('hidden', n <= 0 && !this.o.keep);
    this.el.classList.toggle('k-count--zero', n <= 0 && !!this.o.keep);
    if (n > 0) {
      this.el.classList.remove('k-count--new');
      void this.el.offsetWidth;
      this.el.classList.add('k-count--new'); // a small pulse when something new comes in
    }
  }
  open(): SheetHandle {
    if (this.sheet?.open) return this.sheet;
    this.o.onOpen?.();
    this.sheet = openSheet({ title: this.o.label, body: this.o.content(), height: this.o.height ?? 0.6 });
    return this.sheet;
  }
}
