// A question in the game's own frame: the browser's confirm() was a grey system box on a phone, and some
// embedded browsers block it outright. The text, a button to step back and one to go ahead; Enter and Esc on a
// keyboard, a tap beside the frame steps back. While it is open, no key reaches the game.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/confirm.ts';
import { esc } from './dom.ts';

const L = dict(EN, RU);

let open: ((ok: boolean) => void) | null = null;

/** Ask the captain; resolves true for «go ahead». A new question closes an unanswered one as «no». */
export function ask(text: string, yes: string = L('yes'), no: string | null = L('no')): Promise<boolean> {
  return askHtml(`<p id="confirm-text">${esc(text)}</p>`, yes, no);
}

/** The same frame round ready-made markup (the caller escapes it): a quest giver's words, a portrait. */
export function askHtml(body: string, yes: string = L('yes'), no: string | null = L('no'), cls = ''): Promise<boolean> {
  open?.(false);
  return new Promise((done) => {
    const el = document.createElement('div');
    el.id = 'confirm';
    el.innerHTML = `<div class="panel confirm-panel${cls ? ` ${cls}` : ''}" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
      <div class="confirm-body">${body}</div>
      <div class="confirm-row${no === null ? ' one' : ''}">${no === null ? '' : `<button class="btn" data-no>${esc(no)}</button>`}<button class="btn btn-primary" data-yes>${esc(yes)}</button></div></div>`;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
      else return;
      e.preventDefault();
    };
    const close = (ok: boolean) => {
      removeEventListener('keydown', key, true);
      el.remove();
      open = null;
      done(ok);
    };
    open = close;
    addEventListener('keydown', key, true);
    el.addEventListener('click', (e) => e.target === el && close(false));
    const back = el.querySelector<HTMLElement>('[data-no]');
    if (back) back.onclick = () => close(false);
    el.querySelector<HTMLElement>('[data-yes]')!.onclick = () => close(true);
    document.body.append(el);
    el.querySelector<HTMLElement>('[data-yes]')!.focus({ preventScroll: true });
  });
}

/** Tell the captain something that needs a reading (the browser's alert() before): one button. */
export function tell(text: string): Promise<boolean> {
  return ask(text, L('ok'), null);
}
