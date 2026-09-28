// The sea's holidays on the client (docs/12 P10 #18): the line under the chart while one is on, and the harbour's card
// (what the holiday is, its deed and her progress, the tournament's leaders, the fair; or when the next one comes).

import { HOLIDAYS } from '../../../shared/src/data/holidays.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';
import { TOURNAMENT_PRIZES } from '../../../shared/src/data/holidays.ts';
import { personName } from '../lang/names.ts';

const L = dict({
  line: '{name} · {left}',
  title: 'The sea’s holiday',
  deed: 'The holiday’s flag: {deed} ({n}/{need})',
  won: 'The holiday’s flag is yours.',
  board: 'The tournament',
  empty: 'Nobody has scored yet.',
  prizes: 'Prizes for the first three: {a} / {b} / {c}, by letter when the holiday ends.',
  ends: '{t} left',
  fair: 'The holiday fair: all four pets at every pet seller, at half price.',
  next: 'Next: {name}, in {left}.',
  none: 'No holiday on now.',
  days: '{n} d',
  hours: '{n} h',
  mins: '{n} min',
}, {
  line: '{name} · ещё {left}',
  title: 'Морской праздник',
  deed: 'Флаг праздника: {deed} ({n}/{need})',
  won: 'Флаг праздника уже ваш.',
  board: 'Турнир',
  empty: 'Пока никто не набрал очков.',
  prizes: 'Призы первым трём: {a} / {b} / {c} — письмом, когда праздник кончится.',
  ends: 'ещё {t}',
  fair: 'Праздничная ярмарка: у каждого продавца все четыре питомца за полцены.',
  next: 'Следующий: {name}, через {left}.',
  none: 'Сейчас праздника нет.',
  days: '{n} дн.',
  hours: '{n} ч',
  mins: '{n} мин',
});

const ru = () => (lang() === 'ru' ? 1 : 0);

function left(sec: number): string {
  return sec >= 86400 ? L('days', { n: Math.round(sec / 86400) }) : sec >= 3600 ? L('hours', { n: Math.round(sec / 3600) }) : L('mins', { n: Math.max(1, Math.round(sec / 60)) });
}

/** The line under the chart while a holiday is on. */
export function holidayLine(state: ClientState): string {
  const v = state.holiday;
  if (!v?.id) return '';
  return `<span class="hol-star">✦</span><span class="hol-line">${esc(L('line', { name: HOLIDAYS[v.id].name[ru()], left: left(v.endsIn) }))}</span>`;
}

/** The harbour's card of the holiday. */
export function holidayCard(state: ClientState): string {
  const v = state.holiday;
  if (!v) return '';
  if (!v.id) {
    return `<div class="card hol-card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(L('title'))}</h4><p class="muted">${esc(L('none'))}</p>
      ${v.next ? `<p>${esc(L('next', { name: HOLIDAYS[v.next].name[ru()], left: left(v.nextIn) }))}</p>` : ''}</div>`;
  }
  const h = HOLIDAYS[v.id];
  const won = (state.self?.unlocks ?? []).includes(`emblem:${h.flag}`);
  const tourney = v.id === 'herring_run' || v.id === 'powder_night';
  const pts = (n: number) => (v.id === 'herring_run' ? `${Math.round(n)} ${ru() ? 'кг' : 'kg'}` : String(Math.round(n)));
  return `<div class="card hol-card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(h.name[ru()])} <span class="muted hol-left">${esc(L('ends', { t: left(v.endsIn) }))}</span></h4>
    <p>${esc(h.text[ru()])}</p>
    <p class="hol-deed${won ? ' good' : ''}">${esc(won ? L('won') : L('deed', { deed: h.deed[ru()], n: Math.min(Math.round(v.mine), h.need), need: h.need }))}</p>
    ${tourney ? `<div class="giver-h">${esc(L('board'))}</div>${v.board.length ? v.board.map((r, i) => `<p class="hol-row"><span>${i + 1}. ${esc(personName(r.name))}</span><b>${esc(pts(r.pts))}</b></p>`).join('') : `<p class="muted">${esc(L('empty'))}</p>`}<p class="muted hol-prizes">${esc(L('prizes', { a: '@A@', b: '@B@', c: '@C@' })).replace('@A@', money(TOURNAMENT_PRIZES[0])).replace('@B@', money(TOURNAMENT_PRIZES[1])).replace('@C@', money(TOURNAMENT_PRIZES[2]))}</p>` : ''}
    <p class="muted">${esc(L('fair'))}</p></div>`;
}
