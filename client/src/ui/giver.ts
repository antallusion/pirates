// The quest giver speaks (docs/11 P6): their face, their words, the steps and the pay — and the captain takes the
// job or leaves it. Used by the tavern's notice board and by the people met on an island's beach.

import { levelChip } from './levels.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { QuestPay } from '../../../shared/src/data/questpay.ts';
import type { PortView, QuestPayView } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { askHtml } from './confirm.ts';
import { esc, money, portraitUrl, xpBadge } from './dom.ts';

const EN = {
  shared: '{name} shares this quest with you',
  take: 'Take it on',
  leave: 'Not now',
  steps: 'What is to be done',
  shipLevel: 'The fight asks for a ship of',
  pay: 'Pay',
  pay_silver: 'All in silver',
  pay_stores: 'Silver and fine shot',
  pay_favour: 'Silver and favour',
  pay_rep: '{faction} +{n}',
  pay_shot: 'heavy shot ×{h}, fire shot ×{f}',
  pay_pick: 'Choose the pay',
  pay_favour_n: 'favour +{n}',
  group: 'A contract for a company of {n}: the flagship sails with two escorts. A groupmate\'s kill counts for all who hold it.',
};
const RU: typeof EN = {
  shared: '{name} делится с вами этим заданием',
  take: 'Взяться',
  leave: 'Не сейчас',
  steps: 'Что нужно сделать',
  shipLevel: 'Для боя нужен корабль уровня',
  pay: 'Плата',
  pay_silver: 'Всё серебром',
  pay_stores: 'Серебро и ядра',
  pay_favour: 'Серебро и почёт',
  pay_rep: '{faction} +{n}',
  pay_shot: 'тяжёлые ядра ×{h}, огненные ×{f}',
  pay_pick: 'Выберите плату',
  pay_favour_n: 'почёт +{n}',
  group: 'Контракт на отряд из {n}: флагман ходит с двумя конвоирами. Потопит любой из отряда — засчитается всем, кто взялся.',
};
const L = dict(EN, RU);

type Offer = PortView['questOffers'][number];

/** The pay to choose from (docs/11 P6), as a quest giver in WoW lays out the rewards: all silver, silver and
 *  fine shot, silver and the port's favour — each with what it comes to. */
export function payPicker(silver: number, v: QuestPayView, chosen: QuestPay = 'silver'): string {
  const rep = (n: number) => (v.faction ? `<span class="pay-rep">${esc(L('pay_rep', { faction: serverText(FACTIONS[v.faction].name), n }))}</span>` : '');
  const opt = (pay: QuestPay, what: string) => `<label class="pay-opt"><input type="radio" name="gpay" value="${pay}"${pay === chosen ? ' checked' : ''}><span class="pay-name">${esc(L(`pay_${pay}`))}</span><span class="pay-what">${what}</span></label>`;
  return `<div class="pay-pick" role="radiogroup" aria-label="${esc(L('pay_pick'))}">
    ${opt('silver', `${money(silver)}${v.rep ? rep(v.rep) : ''}`)}
    ${opt('stores', `${money(v.stores.silver)}<span class="pay-shot">${esc(L('pay_shot', { h: v.stores.heavy, f: v.stores.incendiary }))}</span>`)}
    ${v.favour ? opt('favour', `${money(v.favour.silver)}${rep(v.favour.rep)}`) : ''}
  </div>`;
}

/** A job's pay as chosen, for the journal: the silver, and the shot or the favour that come with it. */
export function paidHtml(silver: number, pay?: QuestPay, paid?: { silver: number; heavy: number; incendiary: number; rep: number }): string {
  if (!pay || !paid || pay === 'silver') return money(silver);
  const more = pay === 'stores' ? L('pay_shot', { h: paid.heavy, f: paid.incendiary }) : L('pay_favour_n', { n: paid.rep });
  return `${money(paid.silver)}<span class="pay-shot">${esc(more)}</span>`;
}

/** The giver's window; resolves with the pay chosen when the captain takes the job, null when not now.
 *  `from`: the groupmate who shared it. */
export function giverDialog(q: Offer, from?: string): Promise<QuestPay | null> {
  const face = q.portrait ? portraitUrl(q.portrait) : null;
  const body = `${from ? `<div class="giver-shared">${esc(L('shared', { name: from }))}</div>` : ''}<div class="giver">
    ${face ? `<div class="giver-face" style="background-image:url('${face}')"></div>` : ''}
    <div class="giver-words">
      <h3 id="confirm-text" class="giver-name">${esc(serverText(q.name))}</h3>
      <div class="giver-who muted">${esc(serverText(q.mentor))}</div>
      <p class="giver-say">«${esc(serverText(q.summary))}»</p>
    </div></div>
    <div class="giver-steps"><div class="giver-h">${esc(L('steps'))}</div><ol>${q.steps.map((t) => `<li>${esc(serverText(t))}</li>`).join('')}</ol></div>
    ${q.group ? `<p class="giver-group">${esc(L('group', { n: q.group }))}</p>` : ''}
    ${q.ship ? `<p class="giver-level">${esc(L('shipLevel'))} ${levelChip(q.ship)}</p>` : ''}
    ${q.pays ? `<div class="giver-pay giver-pay-pick"><span class="giver-h">${esc(L('pay'))}</span>${xpBadge(q.xp)}</div>${payPicker(q.silver, q.pays)}` : `<div class="giver-pay"><span class="giver-h">${esc(L('pay'))}</span>${money(q.silver)}${xpBadge(q.xp)}</div>`}`;
  // The choice is read as the captain says yes (the window is still in the page then).
  let pay: QuestPay = 'silver';
  const pick = (e: Event) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'gpay') pay = t.value as QuestPay;
  };
  document.addEventListener('change', pick);
  return askHtml(body, L('take'), L('leave'), 'giver-panel').then((ok) => {
    document.removeEventListener('change', pick);
    return ok ? pay : null;
  });
}
