// The orca calf's card in the ship window (docs/12 P10 #2): its name, its growth, what it does, and its harnesses.

import { HARNESSES, HARNESS_IDS, PETS, calfFindEvery, calfFindRange, calfStrike } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { bar, esc, icon, money } from './dom.ts';

const L = dict({
  title: 'Companion',
  level: 'Level {n}',
  max: 'Grown',
  finds: 'Dives for shoals and whales within {km} km, every {s} s',
  strikes: 'In a fight strikes the enemy’s rudder every {s} s',
  rename: 'Name',
  harness: 'Harness',
  make: 'Make',
  wear: 'Put on',
  worn: 'Worn',
  off: 'Take off',
  forge: 'Harnesses are made at a forge: a shipyard of the second rank, or your island’s.',
  pets: 'Pets',
  onDeck: 'On deck',
  toDeck: 'On deck',
  below: 'Below',
  petsHint: 'One rides on deck at a time and does its trade. More are sold by a tavern’s pet seller.',
}, {
  title: 'Спутник',
  level: 'Уровень {n}',
  max: 'Выросла',
  finds: 'Ищет косяки и китов в {km} км, раз в {s} с',
  strikes: 'В бою бьёт по рулю врага раз в {s} с',
  rename: 'Имя',
  harness: 'Сбруя',
  make: 'Сделать',
  wear: 'Надеть',
  worn: 'Надета',
  off: 'Снять',
  forge: 'Сбрую делают в кузне: на верфи второго ранга или на вашем острове.',
  pets: 'Питомцы',
  onDeck: 'На палубе',
  toDeck: 'На палубу',
  below: 'В кубрик',
  petsHint: 'На палубе — один, и он делает своё дело. Других продаёт торговец животными в таверне.',
});

export function companionCard(state: ClientState): string {
  const c = state.companion;
  if (!c) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  // The name it was found with reads in the captain's tongue until she gives it her own.
  const name = serverText(c.name);
  const st = calfStrike(c.level, c.harness);
  const km = (calfFindRange(c.level, c.harness) / 1000).toLocaleString(ru ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 });
  const harness = HARNESS_IDS.map((h) => {
    const def = HARNESSES[h];
    const made = c.made.includes(h), on = c.harness === h;
    const cost = Object.entries(def.cost).map(([g, n]) => `<span class="nowrap">${icon(`good_${g}`, '', 'ico-xs')}${esc(GOODS[g as GoodId]?.name ?? g)} ×${n}</span>`).join(' ');
    const btn = on ? `<button class="btn btn-small" data-cmp="wear" data-arg="">${esc(L('off'))}</button>`
      : made ? `<button class="btn btn-small" data-cmp="wear" data-arg="${h}">${esc(L('wear'))}</button>`
      : `<button class="btn btn-small" data-cmp="craft" data-arg="${h}">${esc(L('make'))} ${money(def.silver)}</button>`;
    return `<div class="cmp-h${on ? ' on' : ''}"><div class="cmp-h-t"><b>${esc(def.name[ru])}${on ? ` <span class="tt-worn">${esc(L('worn'))}</span>` : ''}</b><span class="muted">${esc(def.gives[ru])}</span>${made ? '' : `<span class="cmp-cost">${cost}</span>`}</div>${btn}</div>`;
  }).join('');
  return `<div class="card cmp-card"><h4 class="card-h">${icon('creature.beast_white_orca', '', 'ico-md') || icon('role_harpooner', '', 'ico-md')}${esc(L('title'))}: ${esc(name)}</h4>
    <div class="cmp-lv"><span>${esc(c.next ? L('level', { n: c.level }) : L('max'))}</span>${c.next ? `${bar('xp', c.xp / c.next)}<span class="muted">${c.xp}/${c.next}</span>` : ''}</div>
    <p class="muted cmp-does">${esc(L('finds', { km, s: calfFindEvery(c.harness) }))}<br>${esc(L('strikes', { s: st.every }))}</p>
    <div class="cmp-name"><input class="field" data-cmp-name maxlength="20" value="${esc(name)}" aria-label="${esc(L('rename'))}"><button class="btn btn-small" data-cmp="name">${esc(L('rename'))}</button></div>
    <div class="giver-h">${esc(L('harness'))}</div>${harness}<p class="muted cmp-forge">${esc(L('forge'))}</p></div>`;
}

/** A pet's picture: its painted icon, or the nearest painted one until it is painted. */
const PET_STAND_IN: Record<PetId, string> = { cat: 'fh_fog_owl', parrot: 'fh_red_devil', monkey: 'coin', dog: 'map_cove' };
export function petIcon(pet: PetId, cls = 'ico-md'): string {
  return icon(`pet_${pet}`, '', cls) || icon(PET_STAND_IN[pet], '', cls);
}

/** The ship's pets: the one on deck, the rest below. */
export function petsCard(state: ClientState): string {
  const v = state.petsOwn;
  if (!v?.owned.length) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const rows = v.owned.map((pet) => {
    const on = v.deck === pet;
    return `<div class="cmp-h${on ? ' on' : ''}">${petIcon(pet, 'pet-ico')}<div class="cmp-h-t"><b>${esc(PETS[pet].name[ru])}${on ? ` <span class="tt-worn">${esc(L('onDeck'))}</span>` : ''}</b><span class="muted">${esc(PETS[pet].gives[ru])}</span></div>
      ${on ? `<button class="btn btn-small" data-petdeck="">${esc(L('below'))}</button>` : `<button class="btn btn-small" data-petdeck="${pet}">${esc(L('toDeck'))}</button>`}</div>`;
  }).join('');
  return `<div class="card cmp-card"><h4 class="card-h">${petIcon(v.deck ?? v.owned[0], 'ico-md')}${esc(L('pets'))}</h4>${rows}<p class="muted cmp-forge">${esc(L('petsHint'))}</p></div>`;
}

export function bindCompanion(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLElement>('[data-petdeck]').forEach((b) => (b.onclick = () => send({ t: 'pet', action: 'deck', pet: (b.dataset.petdeck || null) as PetId | null })));
  root.querySelectorAll<HTMLElement>('[data-cmp]').forEach((b) => (b.onclick = () => {
    const action = b.dataset.cmp as 'name' | 'craft' | 'wear';
    const arg = action === 'name' ? root.querySelector<HTMLInputElement>('[data-cmp-name]')?.value ?? '' : b.dataset.arg || null;
    send({ t: 'companion', action, arg });
  }));
}
