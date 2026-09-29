// The orca calf's card in the ship window (docs/12 P10 #2): its name, its growth, what it does, and its harnesses.

import { HARNESSES, HARNESS_IDS, PETS, calfFindEvery, calfFindRange, calfStrike } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { BOTTLE_COST, BOTTLE_MAX_NOTE, BOTTLE_MAX_SILVER } from '../../../shared/src/data/bottles.ts';
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
  bottle: 'Bottle mail',
  bottleText: 'A note in a bottle — and silver, if you like — into the sea. The currents carry it; after an hour afloat a captain may fish it out. The bottle costs {cost} silver.',
  bottleNote: 'Your note (up to 240 letters)',
  bottleSilver: 'Silver inside',
  bottleThrow: 'Into the sea',
  chest: 'Bury a chest',
  chestText: 'Off an island’s shore, bury silver (100–20000) and a good from your hold; you get its map with your riddle. Hand it over or post it on a port’s map board. Whoever digs it up takes it; you gain a cartographer’s fame. Costs 50 silver.',
  chestRiddle: 'The riddle for the map',
  chestSilver: 'Silver in the chest',
  chestGood: 'A good from the hold',
  chestNoGood: 'No goods',
  chestQty: 'How many',
  chestBury: 'Bury',
  fame: 'Cartographer’s fame: {n}',
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
  bottle: 'Бутылочная почта',
  bottleText: 'Записка в бутылке — и серебро, если хотите, — в море. Её понесут течения; через час её может выловить другой капитан. Бутылка стоит {cost} серебра.',
  bottleNote: 'Ваша записка (до 240 знаков)',
  bottleSilver: 'Серебро внутри',
  bottleThrow: 'В море',
  chest: 'Зарыть сундук',
  chestText: 'У берега острова заройте серебро (100–20000) и товар из трюма — получите карту с вашей загадкой. Её можно отдать или выставить на доску карт в порту. Кто выкопает — заберёт, а вам — слава картографа. Стоит 50 серебра.',
  chestRiddle: 'Загадка для карты',
  chestSilver: 'Серебро в сундуке',
  chestGood: 'Товар из трюма',
  chestNoGood: 'Без товара',
  chestQty: 'Сколько',
  chestBury: 'Зарыть',
  fame: 'Слава картографа: {n}',
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
    return `<div class="cmp-h${on ? ' on' : ''}">${icon(`harness_${h}`, '', 'ico-md')}<div class="cmp-h-t"><b>${esc(def.name[ru])}${on ? ` <span class="tt-worn">${esc(L('worn'))}</span>` : ''}</b><span class="muted">${esc(def.gives[ru])}</span>${made ? '' : `<span class="cmp-cost">${cost}</span>`}</div>${btn}</div>`;
  }).join('');
  return `<div class="card cmp-card"><h4 class="card-h">${icon('tattoo_white_fin', '', 'ico-md') || icon('role_harpooner', '', 'ico-md')}${esc(L('title'))}: ${esc(name)}</h4>
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

/** Captains' treasure (docs/12 P10 #7): a chest buried on the nearest island's shore, with a riddle for its map. */
export function chestCard(state: ClientState): string {
  const self = state.self;
  if (!self || self.dockedAt) return '';
  const goods = Object.entries(self.cargo).filter(([, n]) => (n ?? 0) >= 1);
  return `<div class="card cmp-card chest-card"><h4 class="card-h">${icon('map_treasure', '', 'ico-md')}${esc(L('chest'))}</h4><p class="muted">${esc(L('chestText'))}</p>
    <textarea class="field" data-criddle maxlength="200" rows="2" placeholder="${esc(L('chestRiddle'))}" aria-label="${esc(L('chestRiddle'))}"></textarea>
    <div class="cmp-name bottle-row"><label class="bottle-silver"><span class="muted">${esc(L('chestSilver'))}</span><input class="field" data-csilver type="number" min="100" max="20000" value="500"></label></div>
    ${goods.length ? `<div class="cmp-name bottle-row"><select class="field" data-cgood aria-label="${esc(L('chestGood'))}"><option value="">${esc(L('chestNoGood'))}</option>${goods.map(([g]) => `<option value="${g}">${esc(GOODS[g as GoodId].name)}</option>`).join('')}</select><input class="field" data-cqty type="number" min="0" value="0" style="width:80px" aria-label="${esc(L('chestQty'))}"></div>` : ''}
    <div class="cmp-name bottle-row"><span class="muted">${esc(L('fame', { n: self.cartoFame ?? 0 }))}</span><button class="btn btn-small btn-primary" data-cbury>${esc(L('chestBury'))}</button></div></div>`;
}

/** Bottle mail (docs/12 P10 #6): a note, and silver if she likes, into the sea. */
export function bottleCard(atSea: boolean): string {
  if (!atSea) return '';
  return `<div class="card cmp-card bottle-card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('bottle'))}</h4><p class="muted">${esc(L('bottleText', { cost: BOTTLE_COST }))}</p>
    <textarea class="field" data-bnote maxlength="${BOTTLE_MAX_NOTE}" rows="3" aria-label="${esc(L('bottleNote'))}" placeholder="${esc(L('bottleNote'))}"></textarea>
    <div class="cmp-name bottle-row"><label class="bottle-silver"><span class="muted">${esc(L('bottleSilver'))}</span><input class="field" data-bsilver type="number" min="0" max="${BOTTLE_MAX_SILVER}" value="0"></label><button class="btn btn-small btn-primary" data-bthrow>${esc(L('bottleThrow'))}</button></div></div>`;
}

export function bindCompanion(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelector<HTMLElement>('[data-cbury]')?.addEventListener('click', () => {
    const riddle = root.querySelector<HTMLTextAreaElement>('[data-criddle]')?.value ?? '';
    const silver = Number(root.querySelector<HTMLInputElement>('[data-csilver]')?.value ?? 0);
    const good = (root.querySelector<HTMLSelectElement>('[data-cgood]')?.value || null) as GoodId | null;
    const qty = Number(root.querySelector<HTMLInputElement>('[data-cqty]')?.value ?? 0);
    send({ t: 'chest', silver, riddle, good, qty });
  });
  root.querySelector<HTMLElement>('[data-bthrow]')?.addEventListener('click', () => {
    const note = root.querySelector<HTMLTextAreaElement>('[data-bnote]')?.value ?? '';
    const silver = Number(root.querySelector<HTMLInputElement>('[data-bsilver]')?.value ?? 0);
    send({ t: 'bottle', note, silver });
    const ta = root.querySelector<HTMLTextAreaElement>('[data-bnote]');
    if (ta && note.trim()) ta.value = '';
  });
  root.querySelectorAll<HTMLElement>('[data-petdeck]').forEach((b) => (b.onclick = () => send({ t: 'pet', action: 'deck', pet: (b.dataset.petdeck || null) as PetId | null })));
  root.querySelectorAll<HTMLElement>('[data-cmp]').forEach((b) => (b.onclick = () => {
    const action = b.dataset.cmp as 'name' | 'craft' | 'wear';
    const arg = action === 'name' ? root.querySelector<HTMLInputElement>('[data-cmp-name]')?.value ?? '' : b.dataset.arg || null;
    send({ t: 'companion', action, arg });
  }));
}
