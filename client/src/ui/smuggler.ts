// «Услуга контрабандиста» (forum, Эдуард, post 92): a harbour that shuts its quay to her for her patent or her standing
// asks — in the game's own bottom sheet — whether the smuggler's boat should put her in: why it is shut, the three ways
// in, the fare and what it buys. Her yes sends the dock again with `smuggle` (the server pays and puts her in).

import type { SmuggleOffer } from '../../../shared/src/data/smuggler.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/smuggler.ts';
import { esc, fmt, icon } from './dom.ts';
import { askHtml } from './confirm.ts';

const L = dict(EN, RU);

/** The question's body (pure: the tests read it). */
export function smugglerHtml(o: SmuggleOffer, port: string): string {
  const ways = o.why === 'patent' ? [L('wait', { n: o.days }), L('strike'), L('boat')] : [L('mend'), L('boat')];
  return `<div class="smg-ask"><h3 id="confirm-text">${icon('item_smugglers_cloak', '', 'ico-md')}${esc(L('title'))}</h3>`
    + `<p>${esc(L(o.why, { port }))}</p><p class="muted">${esc(L('ways'))}</p><ul class="smg-ways">${ways.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`
    + `<p class="muted">${esc(L(o.quest ? 'quest' : 'trade'))} ${esc(L('keep', { n: o.mins }))}</p></div>`;
}

/** The fare on the yes button. */
export function smugglerYes(o: SmuggleOffer): string {
  return L('yes', { price: fmt(o.price) });
}

let asking = '';
/** Ask her (once at a time for a harbour); her yes runs `go`. */
export function askSmuggler(o: SmuggleOffer, port: string, go: () => void): void {
  if (asking === o.port) return;
  asking = o.port;
  void askHtml(smugglerHtml(o, port), smugglerYes(o), L('no'), 'smg-panel').then((yes) => {
    asking = '';
    if (yes) go();
  });
}
