// The window before a risky boarding (docs/23 items 49–52, owner 2026-10-06: «надо давать возможность, но открывать
// какое-то окно, где будет сказано, что скорее всего вы проиграете»): her honest chance, what a loss costs, what a win
// brings, «Рискнуть» and «Отступить». A modal decision, so it stands in the middle as the confirms do.
//
// A minimal window of its own behind `showRiskConfirm(opts)`: the UI kit's reusable RiskConfirm (client/src/ui/kit/,
// branch batch-m01) takes its place when the branches meet — only this function's body changes, its callers do not.

import { esc } from './dom.ts';

export interface RiskConfirmOpts {
  title: string;
  /** 0..1, drawn as a big percentage and a bar. */
  chance: number;
  /** The muted line under the chance (levels, how it was reckoned). */
  note?: string;
  /** The heading of the losses and the losses, one a line. */
  loseHead: string;
  lose: string[];
  /** What a win brings. */
  win?: string;
  go: string;
  back: string;
}

let closeOpen: ((go: boolean) => void) | null = null;

/** Show the window; resolves true for «Рискнуть», false for «Отступить» (Esc, a tap beside it). One at a time: a new
 *  one closes an unanswered one as «Отступить». */
export function showRiskConfirm(o: RiskConfirmOpts): Promise<boolean> {
  closeOpen?.(false);
  return new Promise((done) => {
    const el = document.createElement('div');
    el.id = 'risk-confirm';
    const pct = Math.round(Math.max(0, Math.min(1, o.chance)) * 100);
    const tone = pct < 35 ? 'bad' : pct < 55 ? 'warn' : 'good';
    el.innerHTML = `<div class="panel risk-panel" role="alertdialog" aria-modal="true" aria-labelledby="risk-title" aria-describedby="risk-chance">
      <h3 id="risk-title" class="risk-title">${esc(o.title)}</h3>
      <div id="risk-chance" class="risk-chance risk-${tone}"><b>${pct}%</b><span class="risk-bar"><i style="width:${pct}%"></i></span></div>
      ${o.note ? `<div class="risk-note muted">${esc(o.note)}</div>` : ''}
      <div class="risk-lose"><span class="risk-h">${esc(o.loseHead)}</span> ${o.lose.map(esc).join(' · ')}</div>
      ${o.win ? `<div class="risk-win">${esc(o.win)}</div>` : ''}
      <div class="risk-row"><button class="btn" data-back>${esc(o.back)}</button><button class="btn btn-primary" data-go>${esc(o.go)}</button></div></div>`;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
      else return;
      e.preventDefault();
    };
    const close = (go: boolean) => {
      removeEventListener('keydown', key, true);
      el.remove();
      closeOpen = null;
      done(go);
    };
    closeOpen = close;
    addEventListener('keydown', key, true);
    el.addEventListener('click', (e) => e.target === el && close(false));
    el.querySelector<HTMLElement>('[data-back]')!.onclick = () => close(false);
    el.querySelector<HTMLElement>('[data-go]')!.onclick = () => close(true);
    document.body.append(el);
    // Backing off is the safe default: the focus starts there.
    el.querySelector<HTMLElement>('[data-back]')!.focus({ preventScroll: true });
  });
}

/** Is the window up (the debug handle and the QA scripts)? */
export function riskConfirmOpen(): boolean {
  return closeOpen !== null;
}
