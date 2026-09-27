// Daily orders on the client (docs/11 P6): the card in the tavern and the lines in the chart's quest log.

import { dailyText } from '../../../shared/src/data/dailies.ts';
import type { PrivateState } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { esc, icon, money } from './dom.ts';

const EN = {
  title: 'Daily orders',
  streak: 'Days in a row: {n}',
  chest: 'All three: a chest of {silver}',
  opened: 'The chest is open. New orders at midnight (UTC).',
  hint: 'Three orders a day. Each pays; all three open a chest, and every day in a row adds a tenth to it (up to half again).',
};
const RU: typeof EN = {
  title: 'Поручения дня',
  streak: 'Дней подряд: {n}',
  chest: 'За все три — сундук: {silver}',
  opened: 'Сундук открыт. Новые поручения — в полночь (UTC).',
  hint: 'Три поручения в день. Каждое оплачивается; все три открывают сундук, и каждый день подряд прибавляет к нему десятую долю (до половины сверху).',
};
const L = dict(EN, RU);

type Daily = PrivateState['daily'];

function rows(d: Daily): string {
  const ru = lang() === 'ru' ? 1 : 0;
  return d.orders.map((o) => `<div class="dl-row${o.done ? ' done' : ''}">${o.done ? '<span class="dl-mark">✓</span>' : icon('goal', '◆', 'ico-sm')}<span class="dl-text">${esc(dailyText(o.kind, o.need, ru))}</span><span class="dl-count">${o.done ? '' : `${o.progress}/${o.need}`}</span>${money(o.silver)}</div>`).join('');
}

function foot(d: Daily): string {
  if (d.chest) return `<div class="dl-foot muted">${esc(L('opened'))}${d.streak > 1 ? ` · ${esc(L('streak', { n: d.streak }))}` : ''}</div>`;
  return `<div class="dl-foot">${esc(L('chest', { silver: '§' })).replace('§', money(d.chestSilver))}${d.streak > 0 ? ` <span class="muted">· ${esc(L('streak', { n: d.streak }))}</span>` : ''}</div>`;
}

/** The tavern's card. */
export function dailyCard(d: Daily | undefined): string {
  if (!d || !d.orders.length) return '';
  return `<div class="card daily" title="${esc(L('hint'))}"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('title'))}</h4>${rows(d)}${foot(d)}</div>`;
}

/** The chart log's block. */
export function dailyLog(d: Daily | undefined): string {
  if (!d || !d.orders.length) return '';
  return `<div class="map-daily" title="${esc(L('hint'))}"><div class="mq-head">${icon('tab_letters', '', 'ico-sm')}${esc(L('title'))}</div>${rows(d)}${foot(d)}</div>`;
}
