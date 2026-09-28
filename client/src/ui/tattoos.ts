// Tattoos (docs/12 P9): a captain's arms and back with their places — two at first, one more at levels 15, 30 and 45,
// one for Old Needle's own mark — and the collection: the ones inked, the ones waiting for Old Needle in a haven of the
// Brethren, and the ones still to earn with the deed that earns them. They are changed in port. And the chain's
// reward: a choice of three pieces of gear.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { TATTOOS, TATTOO_BY_ID } from '../../../shared/src/data/sidequests.ts';
import type { TattooDef } from '../../../shared/src/data/sidequests.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ClientMsg, TattooView } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';
import { itemCardHtml } from './gear.ts';

const L = dict({
  title: 'Tattoos',
  sub: 'Old Needle inks them in the havens of the Brethren. Change them in any port.',
  places: 'Places ({n} of {max})',
  pick: 'Tap a place, then a tattoo from the collection.',
  portOnly: 'Tattoos are changed in port.',
  empty: 'Empty',
  locked15: 'Level 15', locked30: 'Level 30', locked45: 'Level 45', lockedNeedle: 'Old Needle’s mark',
  owned: 'Inked ({n})',
  pending: 'Waiting for Old Needle',
  pendingHint: 'Dock in a haven of the Brethren: Old Needle will ink it.',
  unknown: 'Not yet earned ({n})',
  worn: 'Worn',
  take: 'Remove',
  choiceTitle: 'A reward of your choosing',
  choiceSub: '{quest}: take one of the three.',
  choose: 'Take this',
  lv: 'Level {n}',
}, {
  title: 'Татуировки',
  sub: 'Их набивает Старая Игла в гаванях Берегового братства. Менять — в любом порту.',
  places: 'Места ({n} из {max})',
  pick: 'Коснитесь места, затем татуировки из коллекции.',
  portOnly: 'Татуировки меняют в порту.',
  empty: 'Пусто',
  locked15: '15 уровень', locked30: '30 уровень', locked45: '45 уровень', lockedNeedle: 'Знак Старой Иглы',
  owned: 'Набиты ({n})',
  pending: 'Ждут Старую Иглу',
  pendingHint: 'Зайдите в гавань Братства — Старая Игла набьёт.',
  unknown: 'Ещё не заслужены ({n})',
  worn: 'Надета',
  take: 'Снять',
  choiceTitle: 'Награда на выбор',
  choiceSub: '{quest}: возьмите одну из трёх.',
  choose: 'Взять',
  lv: '{n} уровень',
});

const ru = () => (lang() === 'ru' ? 1 : 0);
const MAX_PLACES = 6;
/** The places down the portrait's left side, then its right (as a character sheet shows its gear). */
const LEFT = [0, 2, 4], RIGHT = [1, 3, 5];
/** Until a tattoo's own picture is painted, the nearest painted icon stands in (never a bare letter). */
const STAND_IN: Record<string, string> = {
  swallow: 'ab_trim_sails', anchor: 'anchor', turtle: 'tree_navigation', golden_dragon: 'fh_gilded_scale', fish: 'build_fishing_village',
  hook: 'ab_red_hook_boarding', octopus: 'mod_figurehead_kraken', orca: 'role_harpooner', white_fin: 'fh_harpooneer', harpoon: 'mount_harpoon',
  shark_tooth: 'good_leviathan_bone', skull: 'wanted', sabres: 'tree_boarding', cannon: 'gun_long_9', compass_rose: 'ab_star_fix', coin: 'coin',
  mermaid: 'fh_weeping_widow', eye: 'ab_spotters_eye', bell: 'mod_choir_bell', heart: 'prof_surgeon', star: 'xp', map: 'map_treasure',
  needle: 'role_sailmaker', cat: 'fh_fog_owl', lantern: 'mod_lantern_gland', bottle: 'tab_letters', dutchman: 'mod_ghost_timbers',
  kraken: 'mod_kraken_beak', crown: 'fh_crown_lion', rose: 'faction_free',
};

let sel: number | null = null;

/** A tattoo's picture: its painted icon, the nearest painted one while it is missing, an ink stamp at the last. */
export function tattooIcon(t: TattooDef, cls = 'tt-ico'): string {
  const url = assetUrl(`icon.tattoo_${t.id}`) ?? (STAND_IN[t.id] ? assetUrl(`icon.${STAND_IN[t.id]}`) : null);
  if (url) return `<img class="${cls}" src="${url}" alt="" draggable="false" />`;
  return `<span class="${cls} tt-ink">${esc(t.name[ru()].charAt(0))}</span>`;
}

/** Why a place is still shut: the next of its keys the captain lacks. */
function lockOf(i: number, level: number, owned: string[]): [string, string] {
  const keys: [boolean, string, string][] = [[level >= 15, L('locked15'), '15'], [level >= 30, L('locked30'), '30'], [level >= 45, L('locked45'), '45'], [owned.includes('needle'), L('lockedNeedle'), '✒']];
  const missing = keys.filter(([ok]) => !ok);
  const open = 2 + keys.filter(([ok]) => ok).length;
  const k = missing[i - open];
  return k ? [k[1], k[2]] : ['', ''];
}

export function renderTattoos(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v: TattooView = state.tattoos ?? { owned: [], pending: [], active: [], slots: 2 };
  const level = state.self?.level ?? 1;
  const docked = !!state.portView;
  if (sel !== null && sel >= v.slots) sel = null;
  const place = (i: number) => {
    const open = i < v.slots;
    const id = v.active[i] ?? null;
    const t = id ? TATTOO_BY_ID[id] : undefined;
    const lock = lockOf(i, level, v.owned);
    const title = open ? (t ? t.name[ru()] : L('empty')) : lock[0];
    return `<button class="doll-slot${t ? ' full' : ''}${open ? '' : ' locked'}${sel === i ? ' on' : ''}" ${open ? `data-place="${i}"` : 'disabled'} title="${esc(title)}" aria-label="${esc(title)}">
      ${t ? tattooIcon(t, 'doll-ico') : open ? '<span class="doll-empty">+</span>' : `<span class="doll-lock">${esc(lock[1])}</span>`}</button>`;
  };
  const cap = state.self ? CAPTAINS[state.self.captain] : undefined;
  const face = cap ? assetUrl(cap.portrait) : null;
  const chosen = sel !== null && v.active[sel] ? TATTOO_BY_ID[v.active[sel]!] : undefined;
  const worn = new Set(v.active.filter(Boolean) as string[]);
  // A card of the collection (a card, not a button: its words wrap as they need).
  const tile = (t: TattooDef, kind: 'owned' | 'pending' | 'unknown') => `<div class="tt-tile ${kind}${worn.has(t.id) ? ' worn' : ''}" ${kind === 'owned' ? `data-tt="${esc(t.id)}" role="button" tabindex="0"` : 'aria-disabled="true"'}>
      ${tattooIcon(t)}<span class="tt-text"><b>${esc(t.name[ru()])}${worn.has(t.id) ? ` <span class="tt-worn">${esc(L('worn'))}</span>` : ''}</b>
      <span class="tt-gives">${esc(t.gives[ru()])}</span>${kind === 'owned' ? '' : `<span class="muted tt-how">${esc(kind === 'pending' ? L('pendingHint') : t.how[ru()])}</span>`}</span></div>`;
  const owned = TATTOOS.filter((t) => v.owned.includes(t.id));
  const pending = TATTOOS.filter((t) => v.pending.includes(t.id));
  const unknown = TATTOOS.filter((t) => !v.owned.includes(t.id) && !v.pending.includes(t.id));
  const cur = sel !== null ? v.active[sel] ?? null : null;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
    <div class="modal-body tattoos">
      <div class="tt-figure-wrap">
        <div class="giver-h">${esc(L('places', { n: v.slots, max: MAX_PLACES }))}</div>
        <div class="doll">
          <div class="doll-col">${LEFT.map(place).join('')}</div>
          <div class="doll-face" style="background-image:${face ? `url('${face}')` : 'none'}">
            <div class="doll-plate"><b>${esc(state.self?.name ?? '')}</b><span>${esc(L('lv', { n: level }))}</span></div>
          </div>
          <div class="doll-col">${RIGHT.map(place).join('')}</div>
        </div>
        ${chosen ? `<p class="tt-chosen"><b>${esc(chosen.name[ru()])}</b> — ${esc(chosen.gives[ru()])}</p>` : ''}
        <p class="muted tt-hint">${esc(docked ? L('pick') : L('portOnly'))}</p>
        ${cur && docked ? `<button class="btn btn-small btn-danger" data-untt>${esc(L('take'))}</button>` : ''}
      </div>
      <div class="tt-coll">
        ${pending.length ? `<div class="giver-h">${esc(L('pending'))}</div><div class="tt-grid">${pending.map((t) => tile(t, 'pending')).join('')}</div>` : ''}
        <div class="giver-h">${esc(L('owned', { n: owned.length }))}</div><div class="tt-grid">${owned.map((t) => tile(t, 'owned')).join('')}</div>
        <div class="giver-h">${esc(L('unknown', { n: unknown.length }))}</div><div class="tt-grid">${unknown.map((t) => tile(t, 'unknown')).join('')}</div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-place]').forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.place);
    sel = sel === i ? null : i;
    renderTattoos(root, state, send);
  }));
  root.querySelectorAll<HTMLElement>('[data-tt]').forEach((b) => (b.onclick = () => {
    if (!docked) return;
    const slot = sel ?? v.active.findIndex((x, i) => i < v.slots && !x);
    const at = slot >= 0 ? slot : v.active.length < v.slots ? v.active.length : 0;
    send({ t: 'tattoo', action: 'set', slot: at, id: b.dataset.tt! });
    sel = null;
  }));
  root.querySelector<HTMLElement>('[data-untt]')?.addEventListener('click', () => {
    if (sel !== null) send({ t: 'tattoo', action: 'set', slot: sel, id: null });
    sel = null;
  });
}

/** The chain's reward: three pieces of gear to choose one of. */
export function renderChoice(root: HTMLElement, choice: { quest: string; items: Item[] }, send: (m: ClientMsg) => void): void {
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('choiceTitle'))}</h2><div class="sub">${esc(L('choiceSub', { quest: serverText(choice.quest) }))}</div></div></div>
    <div class="modal-body choice3">${choice.items.map((it, i) => `<div class="ch-col">${itemCardHtml(it)}<button class="btn btn-primary" data-choose="${i}">${esc(L('choose'))}</button></div>`).join('')}</div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-choose]').forEach((b) => (b.onclick = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-choose]').forEach((x) => (x.disabled = true));
    send({ t: 'choice', index: Number(b.dataset.choose) });
  }));
}
