// «Где взять» (owner, 2026-10-30: «я хочу нажать на то что надо и в тултипе посмотреть где это можно купить или выбить.
// потому что не понятно часто что и где»). Every cost chip of the island's windows — a good, a land resource — and every
// building asked first carries `data-src` (srcAttr); one listener on the document shows the tooltip for it: its name,
// how many she has and needs, and where it is had (shared/src/data/sources.ts), with «Плыть» to the nearest seller or,
// for a building, «Открыть карточку». A mouse shows it on hover; a finger (and a click) pins it, a tap outside closes it.
// It stands beside its chip and never leaves the screen.

import { sourcesOf } from '../../../shared/src/data/sources.ts';
import type { SrcLine } from '../../../shared/src/data/sources.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { PRODUCERS } from '../../../shared/src/data/base.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import { MINES } from '../../../shared/src/data/mines.ts';
import { SHORE_BOSSES } from '../../../shared/src/data/shorebosses.ts';
import { TREK_PATH_NAMES } from '../../../shared/src/data/isles.ts';
import { TOWN } from '../../../shared/src/data/town.ts';
import { ISLE_TYPE_DEFS } from '../../../shared/src/world/archipelago.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/srctip.ts';
import { esc, fmt, icon } from './dom.ts';
import { placeName } from './maps.ts';
import { treeLabel } from './isletree.ts';

const L = dict(EN, RU);
const ru = (): 0 | 1 => (lang() === 'ru' ? 1 : 0);

/** The attributes that make a chip answer with the tooltip: `g:<good>`, `l:<land res>`, `b:<building>` (asked at
 *  `need`, standing at `have`). */
export function srcAttr(id: string, need?: number, have?: number): string {
  return ` data-src="${esc(id)}"${need !== undefined ? ` data-need="${Math.round(need)}"` : ''}${have !== undefined ? ` data-have="${Math.floor(have)}"` : ''} tabindex="0"`;
}

/** A building asked first, as the island's lists name it. */
function buildingName(id: string, level: number): string {
  return id === 'hall' ? TOWN.hall.names[0][ru()] : treeLabel(id, level);
}

const list = (xs: string[]) => xs.join(', ');

/** A source in words. */
export function srcText(s: SrcLine): string {
  const r = ru();
  switch (s.k) {
    case 'producer': return L('src.producer', { name: PRODUCERS[s.id].name[r] });
    case 'market': return L('src.market');
    case 'barge': return L('src.barge');
    case 'ports': {
      const names = list(s.ports.map((p) => placeName(p)));
      if (s.every) return names ? L('src.portsEvery', { list: names }) : L('src.portsEveryOnly');
      if (s.big) return names ? L('src.portsBig', { list: names }) : L('src.portsBigOnly');
      return L('src.ports', { list: names });
    }
    case 'mine': return L(s.mill ? 'src.mill' : 'src.mine', { name: MINES[s.id].name[r], n: MINES[s.id].daily });
    case 'lairs': return L('src.lairs', { list: list(s.lairs.map((k) => `${LAIRS[k].name[r]} ⚓${LAIRS[k].lv[0]}`)) });
    case 'isles': return L('src.isles', { list: list(s.types.map((t) => ISLE_TYPE_DEFS[t].adj[r])) });
    case 'bosses': return L('src.bosses', { list: list(s.ids.map((b) => SHORE_BOSSES[b].name[r])) });
    case 'wreck': return L('src.wreck');
    case 'trek': return L('src.trek', { list: list(s.paths.slice(0, 3).map((p) => TREK_PATH_NAMES[p][r].toLowerCase())) });
  }
}

/** The tooltip's body for a chip's `data-src`. */
export function srcHtml(id: string, need?: number, have?: number): string {
  const [kind, what] = id.split(':');
  const count = have !== undefined && need !== undefined
    ? `<p class="st-have${have < need ? ' bad' : ''}">${esc(L('have', { have: fmt(have), need: fmt(need) }))}${have < need ? ` · ${esc(L('more', { n: fmt(need - have) }))}` : ''}</p>`
    : have !== undefined ? `<p class="st-have">${esc(L('haveOnly', { have: fmt(have) }))}</p>` : '';
  if (kind === 'b') {
    const n = need ?? 1;
    return `<div class="st-h"><b>${esc(L('b.title'))}</b></div><p>${esc(L('b.need', { name: buildingName(what, n), n }))}</p>
      <p class="muted">${esc(have ? L('b.now', { n: have }) : L('b.none'))}</p>
      <div class="st-act"><button type="button" class="btn btn-small btn-primary" data-stopen="${esc(what)}">${esc(L('b.open'))}</button></div>`;
  }
  const head = kind === 'g' && GOODS[what as GoodId]
    ? `${icon(`good_${what}`, '', 'ico-sm')}<b>${esc(GOODS[what as GoodId].name)}</b>`
    : kind === 'l' && LAND_RES_DEF[what as LandRes]
      ? `${icon(LAND_RES_DEF[what as LandRes].icon, '', 'ico-sm')}<b>${esc(LAND_RES_DEF[what as LandRes].name[ru()].replace(/^./, (c) => c.toUpperCase()))}</b>`
      : `<b>${esc(what)}</b>`;
  const lines = sourcesOf(id);
  const go = lines.find((s): s is Extract<SrcLine, { k: 'ports' }> => s.k === 'ports');
  return `<div class="st-h">${head}</div>${count}<p class="st-where">${esc(L('where'))}</p>
    ${lines.length ? `<ul class="st-list">${lines.map((s) => `<li>${esc(srcText(s))}</li>`).join('')}</ul>` : `<p class="muted">${esc(L('none'))}</p>`}
    ${go ? `<div class="st-act"><button type="button" class="btn btn-small" data-stgo="${esc(go.key)}">${icon('menu_ship', '', 'ico-sm')}${esc(L('go'))}</button></div>` : ''}`;
}

export interface SrcTipHooks {
  /** «Плыть к ближайшему продавцу»: the route to a goal's key. */
  go(key: string): void;
  /** «Открыть карточку»: a building's card on the island. */
  open(id: string): void;
}

let tip: HTMLElement | null = null;
let anchor: HTMLElement | null = null;
let pinned = false;
let hideT = 0;

function hide(): void {
  clearTimeout(hideT);
  if (tip) tip.classList.add('hidden');
  anchor?.classList.remove('st-on');
  anchor = null;
  pinned = false;
}

/** Where the tooltip stands: over its chip, else under it, inside the screen. */
function place(el: HTMLElement, a: HTMLElement): void {
  const r = a.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight, m = 6;
  el.style.maxWidth = `${Math.min(300, vw - 2 * m)}px`;
  el.style.left = '0px';
  el.style.top = '0px';
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2));
  let top = r.top - h - 6;
  if (top < m) top = r.bottom + 6;
  if (top + h > vh - m) top = Math.max(m, vh - h - m);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function show(a: HTMLElement, pin: boolean): void {
  clearTimeout(hideT);
  if (!tip) return;
  const id = a.dataset.src ?? '';
  const num = (s: string | undefined) => (s === undefined || s === '' ? undefined : Number(s));
  if (anchor !== a) {
    anchor?.classList.remove('st-on');
    tip.innerHTML = srcHtml(id, num(a.dataset.need), num(a.dataset.have));
    anchor = a;
    a.classList.add('st-on');
  }
  pinned = pin || pinned;
  tip.classList.remove('hidden');
  place(tip, a);
}

/** Mounts the one tooltip and its listeners (once). */
export function mountSrcTip(hooks: SrcTipHooks): void {
  if (tip) return;
  tip = document.createElement('div');
  tip.id = 'srctip';
  tip.className = 'srctip hidden';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const chip = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('[data-src]') : null);
  tip.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-stgo],[data-stopen]');
    if (!b) return;
    e.stopPropagation();
    const go = b.dataset.stgo, open = b.dataset.stopen;
    hide();
    if (go) hooks.go(go);
    else if (open) hooks.open(open);
  });
  // a tap or a click: pin it (again: close it); anywhere else closes it
  document.addEventListener('click', (e) => {
    if (tip!.contains(e.target as Node)) return;
    const a = chip(e.target);
    if (!a) {
      if (anchor) hide();
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    if (anchor === a && pinned) hide();
    else show(a, true);
  }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const a = chip(e.target);
    if (a) show(a, false);
    else if (tip!.contains(e.target as Node)) clearTimeout(hideT);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || pinned || !anchor) return;
    const to = e.relatedTarget as Node | null;
    if (to && (anchor.contains(to) || tip!.contains(to))) return;
    clearTimeout(hideT);
    hideT = window.setTimeout(hide, 180);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && anchor) hide();
    else if ((e.key === 'Enter' || e.key === ' ') && chip(e.target)) {
      e.preventDefault();
      show(chip(e.target)!, true);
    }
  });
  window.addEventListener('resize', hide);
  // (a window's content redrawn under it: the same chip drawn again keeps it, a chip gone closes it)
  setInterval(() => {
    if (!anchor || anchor.isConnected) return;
    const id = anchor.dataset.src ?? '';
    const again = [...document.querySelectorAll<HTMLElement>('[data-src]')].find((x) => x.dataset.src === id && x.offsetParent !== null);
    if (!again) return hide();
    anchor = again;
    again.classList.add('st-on');
    if (tip) place(tip, again);
  }, 300);
}
