// Tattoos (docs/12 P9): a captain's arms and back with their places — two at first, one more at levels 15, 30 and 45,
// one for Old Needle's own mark — and the collection: the ones inked, the ones waiting for Old Needle in a haven of the
// Brethren, and the ones still to earn with the deed that earns them. They are changed in port. And the chain's
// reward: a choice of three pieces of gear.

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
});

const ru = () => (lang() === 'ru' ? 1 : 0);
const MAX_PLACES = 6;
/** Where each place sits on the silhouette (percent of the figure), in the order they open. */
const PLACE_AT: [number, number][] = [[15, 62], [85, 62], [50, 47], [27, 31], [73, 31], [50, 77]];

let sel: number | null = null;

/** A tattoo's picture: its painted icon, or a round ink stamp with its first letter while the art is missing. */
export function tattooIcon(t: TattooDef, cls = 'tt-ico'): string {
  const url = assetUrl(`icon.tattoo_${t.id}`);
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
  const places = Array.from({ length: MAX_PLACES }, (_, i) => {
    const [x, y] = PLACE_AT[i];
    const open = i < v.slots;
    const id = v.active[i] ?? null;
    const t = id ? TATTOO_BY_ID[id] : undefined;
    const lock = lockOf(i, level, v.owned);
    const title = open ? (t ? t.name[ru()] : L('empty')) : lock[0];
    return `<button class="tt-place${open ? '' : ' locked'}${sel === i ? ' on' : ''}" style="left:${x}%;top:${y}%" ${open ? `data-place="${i}"` : 'disabled'} title="${esc(title)}" aria-label="${esc(title)}">
      ${t ? tattooIcon(t) : open ? '<span class="tt-empty">+</span>' : `<span class="tt-lock">${esc(lock[1])}</span>`}</button>`;
  }).join('');
  const worn = new Set(v.active.filter(Boolean) as string[]);
  const tile = (t: TattooDef, kind: 'owned' | 'pending' | 'unknown') => `<button class="tt-tile ${kind}${worn.has(t.id) ? ' worn' : ''}" ${kind === 'owned' ? `data-tt="${esc(t.id)}"` : 'disabled'}>
      ${tattooIcon(t)}<span class="tt-text"><b>${esc(t.name[ru()])}${worn.has(t.id) ? ` <span class="tt-worn">${esc(L('worn'))}</span>` : ''}</b>
      <span class="tt-gives">${esc(t.gives[ru()])}</span>${kind === 'owned' ? '' : `<span class="muted tt-how">${esc(kind === 'pending' ? L('pendingHint') : t.how[ru()])}</span>`}</span></button>`;
  const owned = TATTOOS.filter((t) => v.owned.includes(t.id));
  const pending = TATTOOS.filter((t) => v.pending.includes(t.id));
  const unknown = TATTOOS.filter((t) => !v.owned.includes(t.id) && !v.pending.includes(t.id));
  const cur = sel !== null ? v.active[sel] ?? null : null;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
    <div class="modal-body tattoos">
      <div class="tt-figure-wrap">
        <div class="giver-h">${esc(L('places', { n: v.slots, max: MAX_PLACES }))}</div>
        <div class="tt-figure">${FIGURE}${places}</div>
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

/** A captain's figure, arms spread (the places sit on it). */
const FIGURE = `<svg class="tt-body" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <path d="M50 4c-6 0-10 5-10 11s4 10 10 10 10-4 10-10-4-11-10-11z" />
  <path d="M34 26c-8 2-14 6-18 12L4 66c-1 3 1 6 4 6l8-1 10-20 2 45h44l2-45 10 20 8 1c3 0 5-3 4-6L84 38c-4-6-10-10-18-12-4 3-10 4-16 4s-12-1-16-4z" />
</svg>`;

/** The chain's reward: three pieces of gear to choose one of. */
export function renderChoice(root: HTMLElement, choice: { quest: string; items: Item[] }, send: (m: ClientMsg) => void): void {
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('choiceTitle'))}</h2><div class="sub">${esc(L('choiceSub', { quest: serverText(choice.quest) }))}</div></div></div>
    <div class="modal-body choice3">${choice.items.map((it, i) => `<div class="ch-col">${itemCardHtml(it)}<button class="btn btn-primary" data-choose="${i}">${esc(L('choose'))}</button></div>`).join('')}</div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-choose]').forEach((b) => (b.onclick = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-choose]').forEach((x) => (x.disabled = true));
    send({ t: 'choice', index: Number(b.dataset.choose) });
  }));
}
