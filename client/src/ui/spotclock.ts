// The work at a spot's countdown (owner, 2026-11-02: «показывай таймер с обратным отсчётом и зафиксируй корабль»):
// a pill in the top stack — its icon in a ring of the time gone, what is done and its phase («Водолазы на дне · поиск на
// дне»), the time left («0:18») and «Прервать» — and a bar under it. The server sends its start and end on the sea's
// clock (PrivateState.spot); it is counted down against the client's estimate of that clock. The same work shows in the
// effects' row by her portrait (fxrow.ts, spotFx).

import type { SpotView } from '../../../shared/src/data/spotwork.ts';
import { SPOT_ICON, spotClock, spotFrac, spotLeft, spotPhase } from '../../../shared/src/data/spotwork.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/spot.ts';
import { serverText } from '../lang/server.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

/** Its title («Водолазы на дне»). */
export function spotTitle(v: Pick<SpotView, 'kind'>): string {
  return L(`k.${v.kind}` as keyof typeof EN);
}

/** Its phase in words at `now` («поиск на дне»). */
export function spotPhaseWord(v: Pick<SpotView, 'kind' | 'started' | 'until'>, now: number): string {
  return L(`p.${spotPhase(v, now)}` as keyof typeof EN);
}

/** «At anchor: …» (the effects' row's card). */
export function spotAnchored(): string {
  return L('anchored');
}

/** The pill's one line as a screen reader and the tests read it: «Водолазы на дне · поиск на дне · 0:18». */
export function spotLine(v: SpotView, now: number): string {
  return `${spotTitle(v)} · ${spotPhaseWord(v, now)} · ${spotClock(spotLeft(v, now))}`;
}

export class SpotClock {
  private key = '';
  private el: HTMLElement | null = null;
  private readonly onAbort: () => void;
  constructor(onAbort: () => void) {
    this.onAbort = onAbort;
  }

  private host(): HTMLElement | null {
    if (this.el?.isConnected) return this.el;
    const stack = document.getElementById('hud-stack');
    if (!stack) return null;
    let el = document.getElementById('hud-spot');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-spot';
      el.className = 'hud-block hidden';
      el.setAttribute('role', 'timer');
      el.setAttribute('aria-live', 'off');
      const fold = document.getElementById('hud-fold');
      if (fold?.parentElement === stack) fold.after(el);
      else stack.prepend(el);
    }
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.sp-stop')) this.onAbort();
    });
    return (this.el = el);
  }

  /** Each frame: shown while the work runs; its words redrawn when the second, the phase or the language moves. */
  render(v: SpotView | null | undefined, now: number, lang: string): void {
    const el = this.host();
    if (!el) return;
    const left = v ? spotLeft(v, now) : 0;
    if (!v || left <= 0) {
      if (this.key) {
        this.key = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const frac = spotFrac(v, now);
    const clock = spotClock(left);
    const phase = spotPhaseWord(v, now);
    const key = `${lang}|${v.kind}|${v.started}|${v.until}|${clock}|${phase}`;
    if (key !== this.key) {
      this.key = key;
      const title = spotTitle(v);
      const what = v.name ? serverText(v.name) : '';
      el.classList.remove('hidden');
      el.title = `${title}${what ? ` — ${what}` : ''}. ${L('anchored')}`;
      el.setAttribute('aria-label', spotLine(v, now));
      el.innerHTML = `<span class="sp-ring">${icon(SPOT_ICON[v.kind], '⚓', 'sp-ico')}</span>`
        + `<span class="sp-t"><b class="sp-k">${esc(title)}</b><i class="sp-ph">${esc(phase)}</i></span>`
        + `<b class="sp-c">${esc(clock)}</b>`
        + `<button type="button" class="sp-stop" title="${esc(L('abortTip'))}">${esc(L('abort'))}</button>`
        + '<i class="sp-bar"><i></i></i>';
    }
    // (the ring and the bar move every frame without a rebuild)
    el.style.setProperty('--sp-p', String(Math.round(frac * 1000) / 10));
  }
}
