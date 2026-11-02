// «Шлюпы с острова» under way (owner, 2026-11-02; server/src/game/isleboats.ts): a pill in the top stack, as the work at
// a spot's (spotclock.ts) — the boats' icon in a ring of the way made, «Шлюпы идут», the time left and the distance
// («Шлюпы идут · 0:42 · 3,1 км») and a bar under it — the same in the effects' row by her portrait (fxrow.ts), and
// the round button of the «⋯» tray that opens her island's hire window in its boats' mode.

import type { BoatsView } from '../../../shared/src/data/islandboats.ts';
import { boatsClock } from '../../../shared/src/data/islandboats.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/boats.ts';
import { esc, icon } from './dom.ts';
import { buttonHtml } from './kit/button.ts';

const L = dict(EN, RU);

/** The boats' icon. */
export const BOATS_ICON = 'talent_brd_jolly_boat';

/** Metres left at world time `now` (the way carried on from their last place). */
export function boatsLeft(v: BoatsView, now: number): number {
  return v.wait ? v.left : Math.max(0, v.left - Math.max(0, now - v.at) * v.v);
}

/** Seconds left at `now`. */
export function boatsEta(v: BoatsView, now: number): number {
  return boatsLeft(v, now) / Math.max(1, v.v);
}

/** The share of the way made (the ring). */
export function boatsFrac(v: BoatsView, now: number): number {
  const gone = Math.max(0, now - v.started);
  const eta = boatsEta(v, now);
  return gone + eta > 0 ? Math.min(1, gone / (gone + eta)) : 1;
}

/** «3,1 км» / «850 м». */
export function boatsDist(m: number, ru: boolean): string {
  if (m >= 1000) return `${(Math.round(m / 100) / 10).toFixed(1).replace('.', ru ? ',' : '.')} ${ru ? 'км' : 'km'}`;
  return `${Math.max(0, Math.round(m / 10) * 10)} ${ru ? 'м' : 'm'}`;
}

/** The pill's one line («Шлюпы идут · 0:42 · 3,1 км»). */
export function boatsLine(v: BoatsView, now: number, ru: boolean): string {
  return `${L('pill')} · ${v.wait ? L('wait') : boatsClock(boatsEta(v, now))} · ${boatsDist(boatsLeft(v, now), ru)}`;
}

export class BoatsClock {
  private key = '';
  private el: HTMLElement | null = null;

  private host(): HTMLElement | null {
    if (this.el?.isConnected) return this.el;
    const stack = document.getElementById('hud-stack');
    if (!stack) return null;
    let el = document.getElementById('hud-boats');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-boats';
      el.className = 'hud-block hidden';
      el.setAttribute('role', 'timer');
      el.setAttribute('aria-live', 'off');
      const spot = document.getElementById('hud-spot');
      const fold = document.getElementById('hud-fold');
      if (spot?.parentElement === stack) spot.after(el);
      else if (fold?.parentElement === stack) fold.after(el);
      else stack.prepend(el);
    }
    return (this.el = el);
  }

  /** Each frame: shown while the boats are under way; its words redrawn when the second or the language moves. */
  render(v: BoatsView | null | undefined, now: number, lang: string): void {
    const el = this.host();
    if (!el) return;
    if (!v) {
      if (this.key) {
        this.key = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const ru = lang === 'ru';
    const clock = v.wait ? L('wait') : boatsClock(boatsEta(v, now));
    const dist = boatsDist(boatsLeft(v, now), ru);
    const key = `${lang}|${v.started}|${v.men}|${clock}|${dist}`;
    if (key !== this.key) {
      this.key = key;
      el.classList.remove('hidden');
      el.title = L('tip', { men: v.men });
      el.setAttribute('aria-label', boatsLine(v, now, ru));
      el.innerHTML = `<span class="sp-ring">${icon(BOATS_ICON, '⛵', 'sp-ico')}</span>`
        + `<span class="sp-t"><b class="sp-k">${esc(L('pill'))}</b><i class="sp-ph">${esc(L('men', { n: v.men }))}</i></span>`
        + `<b class="sp-c">${esc(clock)}</b><b class="bt-d">${esc(dist)}</b>`
        + '<i class="sp-bar"><i></i></i>';
    }
    el.style.setProperty('--sp-p', String(Math.round(boatsFrac(v, now) * 1000) / 10));
  }
}

/** The round button in the «⋯» tray (hudmore.ts MORE_ITEMS #tc-boats): her island's hire window, loading its boats.
 *  Shown with an island of her own at sea. */
export function boatsButton(show: boolean, onOpen: () => void): void {
  const host = document.getElementById('touch');
  if (!host) return;
  let el = document.getElementById('tc-boats') as HTMLButtonElement | null;
  if (!el) {
    const t = document.createElement('template');
    t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-boats', icon: BOATS_ICON, glyph: '⛵', aria: L('btnTip'), cls: 'sea-round tc-boats' }).trim();
    el = t.content.firstElementChild as HTMLButtonElement;
    el.insertAdjacentHTML('beforeend', `<span class="tc-boats-l">${esc(L('btn'))}</span>`);
    el.addEventListener('click', () => onOpen());
    host.append(el);
  }
  if (el.classList.contains('hidden') === show) el.classList.toggle('hidden', !show);
  const l = el.querySelector<HTMLElement>('.tc-boats-l')!;
  if (l.textContent !== L('btn')) l.textContent = L('btn');
  if (el.getAttribute('aria-label') !== L('btnTip')) {
    el.setAttribute('aria-label', L('btnTip'));
    el.title = L('btnTip');
  }
}

/** The effects' row's entry (fxrow.ts): after the work at a spot, before the rest. */
export function boatsFx(v: BoatsView, now: number, ru: boolean): { name: string; text: string; left: number; frac: number; n: string } {
  return { name: L('pill'), text: `${L('tip', { men: v.men })} · ${boatsDist(boatsLeft(v, now), ru)}`, left: boatsEta(v, now), frac: 1 - boatsFrac(v, now), n: v.wait ? '…' : boatsClock(boatsEta(v, now)) };
}
