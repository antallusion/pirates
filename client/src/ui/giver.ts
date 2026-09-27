// The quest giver speaks (docs/11 P6): their face, their words, the steps and the pay — and the captain takes the
// job or leaves it. Used by the tavern's notice board and by the people met on an island's beach.

import type { PortView } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { askHtml } from './confirm.ts';
import { esc, money, xpBadge } from './dom.ts';

const EN = {
  take: 'Take it on',
  leave: 'Not now',
  steps: 'What is to be done',
  pay: 'Pay',
};
const RU: typeof EN = {
  take: 'Взяться',
  leave: 'Не сейчас',
  steps: 'Что нужно сделать',
  pay: 'Плата',
};
const L = dict(EN, RU);

type Offer = PortView['questOffers'][number];

/** The giver's window; resolves true when the captain takes the job. */
export function giverDialog(q: Offer): Promise<boolean> {
  const face = q.portrait ? assetUrl(`portrait.${q.portrait}`) : null;
  const body = `<div class="giver">
    ${face ? `<div class="giver-face" style="background-image:url('${face}')"></div>` : ''}
    <div class="giver-words">
      <h3 id="confirm-text" class="giver-name">${esc(serverText(q.name))}</h3>
      <div class="giver-who muted">${esc(serverText(q.mentor))}</div>
      <p class="giver-say">«${esc(serverText(q.summary))}»</p>
    </div></div>
    <div class="giver-steps"><div class="giver-h">${esc(L('steps'))}</div><ol>${q.steps.map((t) => `<li>${esc(serverText(t))}</li>`).join('')}</ol></div>
    <div class="giver-pay"><span class="giver-h">${esc(L('pay'))}</span>${money(q.silver)}${xpBadge(q.xp)}</div>`;
  return askHtml(body, L('take'), L('leave'), 'giver-panel');
}
