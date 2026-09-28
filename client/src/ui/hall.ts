// A captain's island as her guests see it (docs/12 P10 #13): the trophy hall, her records, her people, a round in her
// tavern, her guestbook, the week's ranking of islands; and, for her, whom she invites.

import { FISH } from '../../../shared/src/data/fishing.ts';
import type { FishId } from '../../../shared/src/data/fishing.ts';
import { PROFESSION_DEFS as ISLE_PROFESSIONS } from '../../../shared/src/data/estate.ts';
import type { ClientMsg, HallView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { esc, fishIcon, icon, money } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict({
  title: '{owner}’s island',
  sub: '{island}. Friends, guildmates and those invited are welcome.',
  trophies: 'The trophy hall',
  flags: 'Pirate flags: {n}',
  skulls: 'Orca skulls: {n}',
  fish: 'Record fish: {n}',
  heads: 'Nemeses’ heads: {n}',
  records: 'Records of the sea',
  people: 'Her people',
  none: 'Nobody yet.',
  tavern: 'A round in the tavern',
  drink: 'Buy a round',
  book: 'The guestbook',
  sign: 'Sign',
  signPh: 'A line for the host (up to 120 letters)',
  empty: 'No one has signed yet.',
  week: 'Islands of the week',
  invited: 'Invited',
  invite: 'Invite',
  invitePh: 'Captain’s name',
}, {
  title: 'Остров капитана {owner}',
  sub: '{island}. Здесь рады друзьям, согильдийцам и приглашённым.',
  trophies: 'Зал трофеев',
  flags: 'Пиратских флагов: {n}',
  skulls: 'Черепов касаток: {n}',
  fish: 'Рекордных рыб: {n}',
  heads: 'Голов заклятых врагов: {n}',
  records: 'Рекорды моря',
  people: 'Жители',
  none: 'Пока никого.',
  tavern: 'Выпивка в таверне',
  drink: 'Угостить команду',
  book: 'Книга гостей',
  sign: 'Расписаться',
  signPh: 'Строка для хозяина (до 120 знаков)',
  empty: 'Пока никто не расписался.',
  week: 'Острова недели',
  invited: 'Приглашены',
  invite: 'Пригласить',
  invitePh: 'Имя капитана',
});

export function renderHall(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v: HallView | null = state.hall;
  if (!v) return;
  const ru = lang() === 'ru' ? 1 : 0;
  const tr = v.trophies;
  const people = Object.entries(v.people).map(([k, n]) => `${esc((ISLE_PROFESSIONS as unknown as Record<string, { name: [string, string] }>)[k]?.name[ru] ?? k)} × ${n}`).join(' · ');
  const records = v.records.map((r) => `<p class="jr-fish jr-catch">${fishIcon(r.fish)}${esc(FISH[r.fish as FishId]?.name[ru] ?? r.fish)} — ${r.kg.toLocaleString(ru ? 'ru-RU' : 'en-GB')} ${ru ? 'кг' : 'kg'}</p>`).join('');
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title', { owner: v.owner }))}</h2><div class="sub">${esc(L('sub', { island: placeName(v.name) }))}</div></div></div>
    <div class="modal-body hall"><div class="cols"><div>
      <div class="card"><h4 class="card-h">${icon('tab_legends', '', 'ico-md')}${esc(L('trophies'))}</h4>
        <div class="hall-trophies"><span>${icon('wanted', '', 'ico-sm')}${esc(L('flags', { n: tr.flag }))}</span><span>${icon('role_harpooner', '', 'ico-sm')}${esc(L('skulls', { n: tr.skull }))}</span><span>${icon('build_fishing_village', '', 'ico-sm')}${esc(L('fish', { n: tr.fish }))}</span><span>${icon('danger', '', 'ico-sm')}${esc(L('heads', { n: tr.heads }))}</span></div>
        ${records ? `<div class="giver-h">${esc(L('records'))}</div>${records}` : ''}</div>
      <div class="card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${esc(L('people'))}</h4><p>${people || `<span class="muted">${esc(L('none'))}</span>`}</p></div>
      ${v.tavern && !v.mine ? `<div class="card"><h4 class="card-h">${icon('tab_tavern', '', 'ico-md')}${esc(L('tavern'))}</h4><button class="btn btn-small btn-primary" data-hdrink>${esc(L('drink'))} ${money(20)}</button></div>` : ''}
      ${v.week.length ? `<div class="card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(L('week'))}</h4>${v.week.map((w, i) => `<p class="jr-fish">${i + 1}. ${esc(placeName(w.island))} — ${esc(w.owner)} · ${w.score}</p>`).join('')}</div>` : ''}
    </div><div>
      <div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('book'))}</h4>
        ${v.mine ? '' : `<div class="cmp-name"><input class="field" data-hsign maxlength="120" placeholder="${esc(L('signPh'))}"><button class="btn btn-small" data-hsignbtn>${esc(L('sign'))}</button></div>`}
        ${v.guestbook.map((e) => `<p class="hall-entry"><b>${esc(e.name)}</b>: «${esc(e.text)}»</p>`).join('') || `<p class="muted">${esc(L('empty'))}</p>`}</div>
      ${v.mine ? `<div class="card"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${esc(L('invited'))}</h4>
        <div class="cmp-name"><input class="field" data-hinvite maxlength="24" placeholder="${esc(L('invitePh'))}"><button class="btn btn-small" data-hinvitebtn>${esc(L('invite'))}</button></div>
        <div class="hall-invited">${v.invited.map((n) => `<span class="chip">${esc(n)} <button class="hall-x" data-huninvite="${esc(n)}" aria-label="×">×</button></span>`).join(' ') || `<span class="muted">${esc(L('none'))}</span>`}</div></div>` : ''}
    </div></div></div>`;
  root.querySelector<HTMLElement>('[data-hdrink]')?.addEventListener('click', () => send({ t: 'guest', action: 'drink', island: v.island }));
  root.querySelector<HTMLElement>('[data-hsignbtn]')?.addEventListener('click', () => send({ t: 'guest', action: 'sign', island: v.island, text: root.querySelector<HTMLInputElement>('[data-hsign]')?.value ?? '' }));
  root.querySelector<HTMLElement>('[data-hinvitebtn]')?.addEventListener('click', () => send({ t: 'guest', action: 'invite', name: root.querySelector<HTMLInputElement>('[data-hinvite]')?.value ?? '' }));
  root.querySelectorAll<HTMLElement>('[data-huninvite]').forEach((b) => (b.onclick = () => send({ t: 'guest', action: 'uninvite', name: b.dataset.huninvite! })));
}
