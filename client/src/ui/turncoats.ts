// Captive captains in service on the client (docs/12 P10 #16): the harbour master's card of captains in irons — what
// each would make, his loyalty, and ransom, hand-over or turning him into an officer or a skipper — and her skippers.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { OFFICER_DEFS } from '../../../shared/src/data/crew.ts';
import type { SkipperTrait } from '../../../shared/src/data/turncoats.ts';
import { dict, lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { traitChips } from './crew.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { personName } from '../lang/names.ts';
import { ESCAPE_BELOW, SKIPPER_TRAITS } from '../../../shared/src/data/turncoats.ts';

const L = dict({
  title: 'Captives in irons',
  text: 'A taken captain may be ransomed, handed to his enemies — or turned. He signs as an officer or a skipper of your caravans if his loyalty allows; refused, he may slip his irons. Days in irons and your standing with his flag soften him.',
  as: 'Would make: {role}, level {n}',
  skipper: 'As a skipper:',
  loyalty: 'Loyalty {n}%',
  chance: 'Chance he signs: {n}%',
  risk: 'A refusal may be an escape',
  ransom: 'Ransom',
  hand: 'Hand over',
  handTitle: 'Only to his enemies: reputation instead of silver',
  officer: 'Officer',
  skipperBtn: 'Skipper',
  tried: 'He will not hear of it again today.',
  skippers: 'Your skippers',
  voyages: 'voyages {n}',
}, {
  title: 'Пленники в кандалах',
  text: 'Пленного капитана можно выкупить, сдать его врагам — или перевербовать. Если позволит верность, он подпишет договор офицером или шкипером ваших караванов; при отказе может сбросить кандалы и бежать. Дни в кандалах и ваша репутация у его флага смягчают его.',
  as: 'Годится в: {role}, уровень {n}',
  skipper: 'Как шкипер:',
  loyalty: 'Верность {n}%',
  chance: 'Шанс согласия: {n}%',
  risk: 'При отказе может сбежать',
  ransom: 'Выкуп',
  hand: 'Сдать',
  handTitle: 'Только его врагам: репутация вместо серебра',
  officer: 'Офицером',
  skipperBtn: 'Шкипером',
  tried: 'Сегодня он и слушать об этом не станет.',
  skippers: 'Ваши шкиперы',
  voyages: 'рейсов: {n}',
});

const ru = () => (lang() === 'ru' ? 1 : 0);

function skillChips(skills: SkipperTrait[] | undefined): string {
  return (skills ?? []).map((t) => {
    const d = SKIPPER_TRAITS[t];
    return d ? `<span class="chip ${d.good ? 'good' : 'bad'}" title="${esc(d.text[ru()])}">${esc(d.name[ru()])}</span>` : '';
  }).join(' ');
}

/** The harbour master's card of captains in irons. */
export function captivesCard(state: ClientState): string {
  const self = state.self;
  if (!self?.captives.length) return '';
  const rows = self.captives.map((c, i) => {
    const role = c.role ? OFFICER_DEFS[c.role].name : '';
    const loy = c.loyalty ?? 0;
    const cost = c.turnCost ?? 0;
    return `<div class="tc-cap">
      <div class="tc-head"><b>${esc(personName(c.name))}</b> <span class="muted">${esc(FACTIONS[c.faction].short)}</span><span class="tc-loy ${loy < 30 ? 'bad' : loy >= 60 ? 'good' : ''}">${esc(L('loyalty', { n: loy }))}</span></div>
      ${role ? `<p class="muted">${esc(L('as', { role: ru() ? role.toLowerCase() : role, n: c.level ?? 1 }))}</p><p>${traitChips(c.traits ?? [])}</p>` : ''}
      ${c.skills?.length ? `<p><span class="muted">${esc(L('skipper'))}</span> ${skillChips(c.skills)}</p>` : ''}
      <p class="muted">${esc(L('chance', { n: Math.max(10, Math.min(90, loy)) }))}${loy < ESCAPE_BELOW ? ` · <span class="bad">${esc(L('risk'))}</span>` : ''}</p>
      ${c.tried ? `<p class="muted">${esc(L('tried'))}</p>` : ''}
      <div class="tc-acts">
        <button class="btn btn-small" data-act="captive" data-i="${i}" data-mode="ransom">${esc(L('ransom'))} ${money(c.ransom)}</button>
        <button class="btn btn-small" data-act="captive" data-i="${i}" data-mode="hand_over" title="${esc(L('handTitle'))}">${esc(L('hand'))}</button>
        <button class="btn btn-small btn-primary" data-act="captive" data-i="${i}" data-mode="officer" ${c.tried || self.gold < cost ? 'disabled' : ''}>${esc(L('officer'))} ${money(cost)}</button>
        <button class="btn btn-small btn-primary" data-act="captive" data-i="${i}" data-mode="skipper" ${c.tried || self.gold < cost ? 'disabled' : ''}>${esc(L('skipperBtn'))} ${money(cost)}</button>
      </div></div>`;
  }).join('');
  return `<div class="card tc-card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${esc(L('title'))}</h4><p class="muted">${esc(L('text'))}</p>${rows}</div>`;
}

/** Her turned skippers, in the caravans' tab. */
export function skippersCard(state: ClientState): string {
  const list = state.self?.skippers ?? [];
  if (!list.length) return '';
  return `<div class="card tc-card"><h4 class="card-h">${icon('role_pilot', '', 'ico-md')}${esc(L('skippers'))}</h4>
    ${list.map((k) => `<div class="tc-cap"><div class="tc-head"><b>${esc(personName(k.name))}</b> <span class="muted">${esc(FACTIONS[k.faction].short)} · ${esc(L('voyages', { n: fmt(k.voyages) }))}</span><span class="tc-loy ${k.loyalty < 35 ? 'bad' : k.loyalty >= 60 ? 'good' : ''}">${esc(L('loyalty', { n: k.loyalty }))}</span></div><p>${skillChips(k.traits)}</p></div>`).join('')}</div>`;
}
