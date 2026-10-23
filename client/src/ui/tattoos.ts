// Tattoos (docs/12 P9): a captain's arms and back with their places — two at first, one more at levels 15, 30 and 45,
// one for Old Needle's own mark — and the collection: the ones inked, the ones ready for Old Needle, and the ones still
// to earn with the deed that earns them. And the chain's reward: a choice of three pieces of gear.
// Owner, 2026-10-23: «татуировки невозможно накинуть в порту… зажать тапом и перенести в слот, либо нажать на слот и
// выбрать тату». A tattoo waiting for Old Needle was a dead card (no handler at all) and she inked only in the
// Brethren's havens. Now, in any port: (a) tap a place → a picker → tap a tattoo; (b) hold a card and drag it onto a
// place. A waiting one is inked as it is set; changing or removing one is free.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { TATTOOS, TATTOO_BY_ID } from '../../../shared/src/data/sidequests.ts';
import type { TattooDef } from '../../../shared/src/data/sidequests.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ClientMsg, TattooView } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { itemCardHtml } from './gear.ts';

const L = dict({
  title: 'Tattoos',
  sub: 'Old Needle inks them in any port. Changing or removing one is free.',
  places: 'Places ({n} of {max})',
  pick: 'Tap a «+» place and choose a tattoo — or hold a tattoo and drag it onto a place.',
  portOnly: 'Tattoos are inked and changed in port.',
  pickTitle: 'Place {n}: choose a tattoo',
  pickNone: 'No earned tattoos yet: the ones still to earn are listed in the collection.',
  pickInk: 'Old Needle inks it now',
  pickWornAt: 'Now in place {n}: it moves here',
  close: 'Close',
  empty: 'Empty',
  locked15: 'Level 15', locked30: 'Level 30', locked45: 'Level 45', lockedNeedle: 'Old Needle’s mark',
  owned: 'Inked ({n})',
  pending: 'Ready for Old Needle',
  pendingHint: 'Tap it or drag it onto a place: Old Needle inks it in any port.',
  unknown: 'Not yet earned ({n})',
  worn: 'Worn',
  take: 'Remove',
  choiceTitle: 'A reward of your choosing',
  choiceSub: '{quest}: take one of the three.',
  choose: 'Take this',
  lv: 'Level {n}',
}, {
  title: 'Татуировки',
  sub: 'Их набивает Старая Игла в любом порту. Сменить или снять — бесплатно.',
  places: 'Места ({n} из {max})',
  pick: 'Коснитесь места «+» и выберите татуировку — или зажмите татуировку и перетащите на место.',
  portOnly: 'Татуировки набивают и меняют в порту.',
  pickTitle: 'Место {n}: выберите татуировку',
  pickNone: 'Заслуженных татуировок пока нет: какие можно заслужить — в коллекции.',
  pickInk: 'Старая Игла набьёт сейчас',
  pickWornAt: 'Сейчас на месте {n} — переедет сюда',
  close: 'Закрыть',
  empty: 'Пусто',
  locked15: '15 уровень', locked30: '30 уровень', locked45: '45 уровень', lockedNeedle: 'Знак Старой Иглы',
  owned: 'Набиты ({n})',
  pending: 'Готовы к набивке',
  pendingHint: 'Коснитесь или перетащите на место — Старая Игла набьёт в любом порту.',
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
/** The place whose picker is open (tap an open place → choose a tattoo). */
let picker: number | null = null;
/** The places as last drawn, and the ones newly filled (they glow once: «Роза набита» besides the toast). */
let lastActive: (string | null)[] | null = null;
let dragging = false;
let justDropped = false;

/** A tattoo's picture: its painted icon, the nearest painted one while it is missing, an ink stamp at the last. */
export function tattooIcon(t: TattooDef, cls = 'tt-ico'): string {
  const url = assetUrl(`icon.tattoo_${t.id}`) ?? (STAND_IN[t.id] ? assetUrl(`icon.${STAND_IN[t.id]}`) : null);
  if (url) return `<img class="${cls}" src="${url}" alt="" draggable="false" />`;
  return `<span class="${cls} tt-ink">${esc(t.name[ru()].charAt(0))}</span>`;
}

/** Why a place is still shut: the next of its keys the captain lacks. */
function lockOf(i: number, level: number, owned: string[]): [string, string] {
  const keys: [boolean, string, string][] = [[level >= 15, L('locked15'), '⚓15'], [level >= 30, L('locked30'), '⚓30'], [level >= 45, L('locked45'), '⚓45'], [owned.includes('needle'), L('lockedNeedle'), 'needle']];
  const missing = keys.filter(([ok]) => !ok);
  const open = 2 + keys.filter(([ok]) => ok).length;
  const k = missing[i - open];
  return k ? [k[1], k[2]] : ['', ''];
}

/** The place a tap on a card goes to: the chosen one, else the first empty one, else the first. */
export function tapSlot(v: TattooView, chosen: number | null): number {
  if (chosen !== null && chosen < v.slots) return chosen;
  for (let i = 0; i < v.slots; i++) if (!v.active[i]) return i;
  return 0;
}

/** The picker's choices for a place: the earned tattoos not already in it — the ones waiting for Old Needle first. */
export function pickChoices(v: TattooView, slot: number): string[] {
  const here = v.active[slot] ?? null;
  return [...v.pending, ...v.owned].filter((id, i, a) => id !== here && a.indexOf(id) === i && !!TATTOO_BY_ID[id]);
}

export function renderTattoos(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v: TattooView = state.tattoos ?? { owned: [], pending: [], active: [], slots: 2 };
  const level = state.self?.level ?? 1;
  const docked = !!state.portView || !!state.self?.dockedAt;
  if (sel !== null && sel >= v.slots) sel = null;
  if (picker !== null && picker >= v.slots) picker = null;
  const glow = new Set<number>();
  if (lastActive) for (let i = 0; i < v.slots; i++) if (v.active[i] && v.active[i] !== lastActive[i]) glow.add(i);
  lastActive = [...v.active];
  const place = (i: number) => {
    const open = i < v.slots;
    const id = v.active[i] ?? null;
    const t = id ? TATTOO_BY_ID[id] : undefined;
    const lock = lockOf(i, level, v.owned);
    const title = open ? (t ? t.name[ru()] : L('empty')) : lock[0];
    return `<button class="doll-slot${t ? ' full' : ''}${open ? '' : ' locked'}${sel === i || picker === i ? ' on' : ''}${glow.has(i) ? ' tt-new' : ''}" ${open ? `data-place="${i}"` : 'disabled'} title="${esc(title)}" aria-label="${esc(title)}">
      ${t ? tattooIcon(t, 'doll-ico') : open ? '<span class="doll-empty">+</span>' : (lock[1] === 'needle' ? icon('tattoo_needle', '', 'doll-ico doll-ico--lock') : `<span class="doll-lock">${esc(lock[1])}</span>`)}</button>`;
  };
  const cap = state.self ? CAPTAINS[state.self.captain] : undefined;
  const face = cap ? assetUrl(cap.portrait) : null;
  const chosen = sel !== null && v.active[sel] ? TATTOO_BY_ID[v.active[sel]!] : undefined;
  const worn = new Set(v.active.filter(Boolean) as string[]);
  // A card of the collection (a card, not a button: its words wrap as they need). Inked and waiting ones are both
  // tappable and draggable onto a place; the ones still to earn are not.
  const tile = (t: TattooDef, kind: 'owned' | 'pending' | 'unknown') => `<div class="tt-tile ${kind}${worn.has(t.id) ? ' worn' : ''}" ${kind !== 'unknown' ? `data-tt="${esc(t.id)}" role="button" tabindex="0"` : 'aria-disabled="true"'}>
      ${tattooIcon(t)}<span class="tt-text"><b>${esc(t.name[ru()])}${worn.has(t.id) ? ` <span class="tt-worn">${esc(L('worn'))}</span>` : ''}</b>
      <span class="tt-gives">${esc(t.gives[ru()])}</span>${kind === 'owned' ? '' : `<span class="muted tt-how">${esc(kind === 'pending' ? L('pendingHint') : t.how[ru()])}</span>`}</span></div>`;
  const owned = TATTOOS.filter((t) => v.owned.includes(t.id));
  const pending = TATTOOS.filter((t) => v.pending.includes(t.id));
  const unknown = TATTOOS.filter((t) => !v.owned.includes(t.id) && !v.pending.includes(t.id));
  const cur = sel !== null ? v.active[sel] ?? null : null;
  const pickHtml = (() => {
    if (picker === null) return '';
    const here = v.active[picker] ?? null;
    const row = (id: string) => {
      const t = TATTOO_BY_ID[id];
      const at = v.active.indexOf(id);
      const note = v.pending.includes(id) ? L('pickInk') : at >= 0 && at < v.slots ? L('pickWornAt', { n: at + 1 }) : '';
      return `<button class="tt-pick-row${v.pending.includes(id) ? ' pending' : ''}" data-pick="${esc(id)}"${docked ? '' : ' disabled'}>${tattooIcon(t)}<span class="tt-text"><b>${esc(t.name[ru()])}</b><span class="tt-gives">${esc(t.gives[ru()])}</span>${note ? `<span class="muted tt-how">${esc(note)}</span>` : ''}</span></button>`;
    };
    const choices = pickChoices(v, picker);
    return `<div class="tt-picker" data-picker><div class="tt-pick-card panel" role="dialog" aria-label="${esc(L('pickTitle', { n: picker + 1 }))}">
      <div class="tt-pick-head"><b>${esc(L('pickTitle', { n: picker + 1 }))}</b><button class="btn btn-small" data-pick-close>${esc(L('close'))}</button></div>
      ${docked ? '' : `<p class="muted tt-hint">${esc(L('portOnly'))}</p>`}
      <div class="tt-pick-list">${choices.length ? choices.map(row).join('') : `<p class="muted tt-hint">${esc(L('pickNone'))}</p>`}</div>
      ${here ? `<button class="btn btn-small btn-danger tt-pick-off" data-pick-off${docked ? '' : ' disabled'}>${esc(L('take'))}: ${esc(TATTOO_BY_ID[here]?.name[ru()] ?? '')}</button>` : ''}
    </div></div>`;
  })();
  const scroll = root.querySelector('.modal-body')?.scrollTop ?? 0;
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
        ${cur && docked && picker === null ? `<button class="btn btn-small btn-danger" data-untt>${esc(L('take'))}</button>` : ''}
      </div>
      <div class="tt-coll">
        ${pending.length ? `<div class="giver-h">${esc(L('pending'))}</div><div class="tt-grid">${pending.map((t) => tile(t, 'pending')).join('')}</div>` : ''}
        <div class="giver-h">${esc(L('owned', { n: owned.length }))}</div><div class="tt-grid">${owned.map((t) => tile(t, 'owned')).join('')}</div>
        <div class="giver-h">${esc(L('unknown', { n: unknown.length }))}</div><div class="tt-grid">${unknown.map((t) => tile(t, 'unknown')).join('')}</div>
      </div>
    </div>${pickHtml}`;
  const body = root.querySelector('.modal-body');
  if (body) body.scrollTop = scroll;
  const rerender = () => renderTattoos(root, state, send);
  // Every set goes to the server, which checks it and says why when it refuses (a toast).
  const put = (slot: number, id: string | null) => {
    send({ t: 'tattoo', action: 'set', slot, id });
    sel = null;
    picker = null;
    rerender();
  };
  // (a) Tap a place: its picker (and in it, «Remove» when the place is full).
  root.querySelectorAll<HTMLElement>('[data-place]').forEach((b) => (b.onclick = () => {
    if (dragging || justDropped) return;
    const i = Number(b.dataset.place);
    sel = i;
    picker = i;
    rerender();
  }));
  root.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => (b.onclick = () => {
    if (picker !== null) put(picker, b.dataset.pick!);
  }));
  root.querySelector<HTMLElement>('[data-pick-off]')?.addEventListener('click', () => {
    if (picker !== null) put(picker, null);
  });
  const shut = () => { picker = null; sel = null; rerender(); };
  root.querySelector<HTMLElement>('[data-pick-close]')?.addEventListener('click', shut);
  root.querySelector<HTMLElement>('[data-picker]')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) shut(); });
  // A tap on a card: into the chosen place, else the first empty one, else the first place.
  root.querySelectorAll<HTMLElement>('[data-tt]').forEach((b) => {
    b.onclick = () => {
      if (dragging || justDropped) return;
      put(tapSlot(v, sel), b.dataset.tt!); // at sea the server answers «Tattoos are changed in port.»
    };
    b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } };
    // (b) Hold a card and drag it onto a place (touch: hold still ~0.3 s first, so the list still scrolls; mouse: drag).
    bindDrag(b, (slot) => put(slot, b.dataset.tt!));
  });
  root.querySelector<HTMLElement>('[data-untt]')?.addEventListener('click', () => {
    if (sel !== null) put(sel, null);
  });
}

/** Hold-and-drag of a tattoo card onto an open place, with pointer events (touch in the Telegram webview, and mouse). */
function bindDrag(card: HTMLElement, drop: (slot: number) => void): void {
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    let armed = !touch;
    // The window's page scrolls under a lifted card held near its top or bottom edge (on a phone on its side the places
    // scroll away above a long collection).
    const body = card.closest<HTMLElement>('.modal-body');
    let lastY = y0;
    const edge = window.setInterval(() => {
      if (!ghost || !body) return;
      const r = body.getBoundingClientRect();
      const d = lastY < r.top + 44 ? -14 : lastY > r.bottom - 44 ? 14 : 0;
      if (d) body.scrollTop += d;
    }, 30);
    const move = (x: number, y: number) => {
      lastY = y;
      if (!ghost) return;
      ghost.style.transform = `translate(${Math.round(x - 28)}px, ${Math.round(y - 28)}px)`;
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.doll-slot[data-place]') ?? null;
      if (el !== over) { over?.classList.remove('tt-over'); el?.classList.add('tt-over'); over = el; }
    };
    const begin = (x: number, y: number) => {
      if (ghost) return;
      dragging = true;
      ghost = document.createElement('div');
      ghost.className = 'tt-ghost';
      ghost.innerHTML = card.querySelector('.tt-ico')?.outerHTML ?? '';
      document.body.appendChild(ghost);
      card.classList.add('tt-lifted');
      document.querySelectorAll('.doll-slot[data-place]').forEach((el) => el.classList.add('tt-target'));
      try { navigator.vibrate?.(15); } catch { /* not every webview */ }
      move(x, y);
    };
    const hold = touch ? window.setTimeout(() => { armed = true; begin(x0, y0); }, 300) : 0;
    // While a card is lifted the page must not scroll under the finger.
    const noScroll = (te: TouchEvent) => { if (ghost) te.preventDefault(); };
    const end = (ok: boolean) => {
      window.clearTimeout(hold);
      window.clearInterval(edge);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', noScroll);
      const target = over;
      over?.classList.remove('tt-over');
      document.querySelectorAll('.tt-target').forEach((el) => el.classList.remove('tt-target'));
      card.classList.remove('tt-lifted');
      const had = !!ghost;
      ghost?.remove();
      ghost = null;
      if (had) {
        // The click that follows a drag must not also tap the card or the place.
        justDropped = true;
        window.setTimeout(() => { dragging = false; justDropped = false; }, 80);
      }
      if (ok && had && target) drop(Number(target.dataset.place));
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
        if (!armed) return end(false); // a touch that moved before the hold: the list scrolls
        begin(ev.clientX, ev.clientY);
      }
      move(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) end(true); };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) end(false); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', noScroll, { passive: false });
  });
  card.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press is a drag, not the webview's menu
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
