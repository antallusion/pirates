// A question in the game's own frame: the browser's confirm() was a grey system box on a phone, and some
// embedded browsers block it outright. Since docs/23 phase 1 it is the kit's bottom sheet (ui/kit/sheet.ts) sized to
// its words: the text, a button to step back and one to go ahead (kit buttons, 44/52 px on a phone). Enter takes the
// focused button, Esc, a tap beside it or a swipe down step back; while it is open no key reaches the game.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/confirm.ts';
import { esc } from './dom.ts';
import { buttonHtml } from './kit/button.ts';
import { openSheet } from './kit/sheet.ts';

const L = dict(EN, RU);

let open: ((ok: boolean) => void) | null = null;

/** Ask the captain; resolves true for «go ahead». A new question closes an unanswered one as «no». */
export function ask(text: string, yes: string = L('yes'), no: string | null = L('no')): Promise<boolean> {
  return askHtml(`<p id="confirm-text">${esc(text)}</p>`, yes, no);
}

/** The two buttons of a question: the step back (secondary) and the verb (primary, the focus). */
export function confirmRowHtml(yes: string, no: string | null): string {
  return `<div class="confirm-row${no === null ? ' one' : ''}">${no === null ? '' : buttonHtml({ kind: 'secondary', label: no, data: { no: '' } })}${buttonHtml({ kind: 'primary', size: 'md', label: yes, data: { yes: '', autofocus: '' } })}</div>`;
}

/** The same frame round ready-made markup (the caller escapes it): a quest giver's words, a portrait. */
export function askHtml(body: string, yes: string = L('yes'), no: string | null = L('no'), cls = ''): Promise<boolean> {
  open?.(false);
  return new Promise((done) => {
    let answer = false;
    const sheet = openSheet({
      id: 'confirm',
      cls: `confirm-panel${cls ? ` ${cls}` : ''}`,
      role: 'alertdialog',
      height: 'auto',
      noClose: true,
      labelledBy: body.includes('id="confirm-text"') ? 'confirm-text' : undefined,
      body: `<div class="confirm-body">${body}</div>`,
      foot: confirmRowHtml(yes, no),
      onClose: () => {
        if (open === close) open = null;
        done(answer);
      },
    });
    const close = (ok: boolean) => {
      answer = ok;
      sheet.close('button');
    };
    open = close;
    sheet.panel.querySelector<HTMLElement>('[data-no]')?.addEventListener('click', () => close(false));
    sheet.panel.querySelector<HTMLElement>('[data-yes]')!.addEventListener('click', () => close(true));
  });
}

/** Tell the captain something that needs a reading (the browser's alert() before): one button. */
export function tell(text: string): Promise<boolean> {
  return ask(text, L('ok'), null);
}
